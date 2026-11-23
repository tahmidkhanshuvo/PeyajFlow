"""Retrieval evaluation on a same-author development set; not field validation."""

import argparse
import json
import subprocess
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy.orm import Session

from app.database import database_engine
from app.knowledge import retrieve
from app.model_providers import embedding_identity

HERE = Path(__file__).parent


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dataset", type=Path, default=HERE / "data/rag-development.jsonl"
    )
    parser.add_argument("--label", default="development")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--min-recall", type=float, default=0.85)
    parser.add_argument("--baseline", type=Path)
    args = parser.parse_args()
    if not args.label.replace("-", "").replace("_", "").isalnum():
        parser.error("Use a simple label")
    engine = database_engine()
    if engine is None:
        parser.error("DATABASE_URL is required")
    rows = [
        json.loads(line)
        for line in args.dataset.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    metrics = {}
    with Session(engine) as db:
        for mode in ("keyword", "vector", "hybrid"):
            ranks, abstained, unanswerable, failures = [], 0, 0, []
            for row in rows:
                results = retrieve(db, row["question"], mode)
                if row["passage"] is None:
                    unanswerable += 1
                    abstained += not results
                    continue
                rank = next(
                    (
                        i + 1
                        for i, result in enumerate(results)
                        if result["id"] == row["passage"]
                    ),
                    0,
                )
                ranks.append(rank)
                if not rank:
                    failures.append(row["id"])
            metrics[mode] = {
                "answerable": len(ranks),
                "recall_at_5": sum(bool(rank) for rank in ranks) / max(1, len(ranks)),
                "mrr": sum(1 / rank for rank in ranks if rank) / max(1, len(ranks)),
                "unanswerable": unanswerable,
                "retrieval_abstention_rate": abstained / max(1, unanswerable),
                "failures": failures,
            }
    report = {
        "dataset": str(args.dataset.name),
        "dataset_sha256": __import__("hashlib")
        .sha256(args.dataset.read_bytes())
        .hexdigest(),
        "commit": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], text=True
        ).strip(),
        "worktree_dirty": bool(
            subprocess.check_output(["git", "status", "--porcelain"], text=True).strip()
        ),
        "run_at": datetime.now(UTC).isoformat(),
        "provenance": "Questions and retrieval implementation share an author. Independent challenge and human answer-support review pending.",
        "embedding_identity": embedding_identity(),
        "metrics": metrics,
    }
    output = HERE / "results" / f"rag-{args.label}.json"
    output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(metrics, indent=2))
    threshold = args.min_recall
    if args.baseline:
        threshold = max(
            threshold,
            json.loads(args.baseline.read_text())["metrics"]["hybrid"]["recall_at_5"],
        )
    engine.dispose()
    return int(args.check and metrics["hybrid"]["recall_at_5"] < threshold)


if __name__ == "__main__":
    raise SystemExit(main())
