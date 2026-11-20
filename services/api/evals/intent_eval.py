"""Evaluate the Bangla call simulator's command resolver.

Run from services/api:

    uv run --locked python -m evals.intent_eval --label after
    uv run --locked python -m evals.intent_eval --check

Each dataset row states the expected outcome of resolving one utterance:
``resolved`` with a command (and optional spoken quantity), or one of the
abstaining outcomes ``ambiguous``, ``negated`` and ``unknown``. For intent
metrics every abstaining outcome counts as the single label ``abstain``.
"""

import argparse
import json
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

from fastapi import HTTPException

from evals.metrics import classification, ratio

HERE = Path(__file__).parent
DATASET = HERE / "data" / "intent.jsonl"
RESULTS = HERE / "results"
READ_TOOLS = {"prices", "stock", "advice", "offers", "orders"}


@dataclass(frozen=True)
class Prediction:
    status: str
    tool: str | None = None
    quantity: Decimal | None = None
    unit: str | None = None
    reason: str | None = None

    @property
    def label(self) -> str:
        return self.tool if self.status == "resolved" and self.tool else "abstain"


def resolver():
    """Return the resolver under test, adapted to ``Prediction``."""
    try:
        from app.intent import interpret
    except ImportError:  # the original exact-match resolver
        from app.voice import resolve

        def legacy(text: str) -> Prediction:
            try:
                tool, spoken = resolve(text)
            except HTTPException:
                return Prediction("unknown", reason="no_match")
            amount, unit = spoken if spoken else (None, None)
            return Prediction("resolved", tool, amount, unit)

        return "legacy-exact-match", legacy

    def current(text: str) -> Prediction:
        result = interpret(text)
        return Prediction(
            result.status,
            result.tool,
            result.quantity,
            result.unit,
            result.reason,
        )

    return "rules", current


def load(path: Path = DATASET) -> list[dict]:
    rows = [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    if len({row["id"] for row in rows}) != len(rows):
        raise ValueError("dataset ids must be unique")
    for row in rows:
        if (row["status"] == "resolved") != (row["tool"] is not None):
            raise ValueError(f"{row['id']}: only resolved rows name a tool")
        if (row["quantity"] is None) != (row["unit"] is None):
            raise ValueError(f"{row['id']}: quantity and unit go together")
    return rows


def expected_label(row: dict) -> str:
    return row["tool"] if row["status"] == "resolved" else "abstain"


def evaluate(rows: list[dict], predict) -> dict:
    predictions = [predict(row["text"]) for row in rows]
    expected = [expected_label(row) for row in rows]
    predicted = [item.label for item in predictions]
    report = classification(expected, predicted)

    groups: dict[str, dict[str, list[bool]]] = defaultdict(lambda: defaultdict(list))
    for row, actual, guess in zip(rows, expected, predicted, strict=True):
        for key in ("split", "lang", "category"):
            groups[key][row[key]].append(actual == guess)

    quantity_rows = [
        (row, item)
        for row, item in zip(rows, predictions, strict=True)
        if row["quantity"] is not None
    ]
    quantity_correct = sum(
        item.label == row["tool"]
        and item.quantity is not None
        and Decimal(row["quantity"]) == item.quantity
        and item.unit == row["unit"]
        for row, item in quantity_rows
    )
    unit_correct = sum(item.unit == row["unit"] for row, item in quantity_rows)
    abstain_rows = [
        (row, item)
        for row, item in zip(rows, predictions, strict=True)
        if row["status"] != "resolved"
    ]
    false_actions = [row["id"] for row, item in abstain_rows if item.label != "abstain"]
    wrong_writes = [
        row["id"]
        for row, item in zip(rows, predictions, strict=True)
        if item.label not in READ_TOOLS | {"abstain"}
        and item.label != expected_label(row)
    ]
    failures = [
        {
            "id": row["id"],
            "text": row["text"],
            "expected": {
                key: row[key] for key in ("status", "tool", "quantity", "unit")
            },
            "predicted": {
                "status": item.status,
                "tool": item.tool,
                "quantity": None if item.quantity is None else str(item.quantity),
                "unit": item.unit,
                "reason": item.reason,
            },
        }
        for row, item in zip(rows, predictions, strict=True)
        if item.label != expected_label(row)
        or item.status != row["status"]
        or (
            row["quantity"] is not None
            and (item.quantity is None or Decimal(row["quantity"]) != item.quantity)
        )
        or item.unit != row["unit"]
    ]
    return {
        "rows": len(rows),
        "intent": report,
        "status_accuracy": ratio(
            sum(
                item.status == row["status"]
                for row, item in zip(rows, predictions, strict=True)
            ),
            len(rows),
        ),
        "quantity": {
            "rows": len(quantity_rows),
            "exact_accuracy": ratio(quantity_correct, len(quantity_rows)),
            "unit_accuracy": ratio(unit_correct, len(quantity_rows)),
        },
        "abstention": {
            "rows": len(abstain_rows),
            "false_action_rate": ratio(len(false_actions), len(abstain_rows)),
            "false_actions": false_actions,
        },
        "wrong_write_actions": wrong_writes,
        "accuracy_by": {
            key: {
                name: {"rows": len(values), "accuracy": ratio(sum(values), len(values))}
                for name, values in sorted(groups[key].items())
            }
            for key in ("split", "lang", "category")
        },
        "failures": failures,
    }


def commit() -> str | None:
    try:
        return subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def markdown(result: dict) -> str:
    intent = result["intent"]
    lines = [
        f"# Intent evaluation: {result['label']}",
        "",
        f"- Resolver: `{result['resolver']}`",
        f"- Commit: `{result['commit']}` (working tree may differ)",
        f"- Dataset: `{result['dataset']}`, {result['rows']} rows",
        f"- Run at: {result['run_at']}",
        "",
        "| Metric | Value |",
        "| --- | --- |",
        f"| Intent accuracy | {intent['accuracy']:.3f} |",
        f"| Macro precision | {intent['macro']['precision']:.3f} |",
        f"| Macro recall | {intent['macro']['recall']:.3f} |",
        f"| Macro F1 | {intent['macro']['f1']:.3f} |",
        f"| Outcome accuracy (resolved / ambiguous / negated / unknown) | "
        f"{result['status_accuracy']:.3f} |",
        f"| Quantity and unit exact match ({result['quantity']['rows']} rows) | "
        f"{result['quantity']['exact_accuracy']:.3f} |",
        f"| Unit accuracy | {result['quantity']['unit_accuracy']:.3f} |",
        f"| Acted when it should abstain ({result['abstention']['rows']} rows) | "
        f"{result['abstention']['false_action_rate']:.3f} |",
        f"| Wrong change commands | {len(result['wrong_write_actions'])} |",
        "",
        "## Accuracy by group",
        "",
        "| Group | Value | Rows | Accuracy |",
        "| --- | --- | --- | --- |",
    ]
    for key, values in result["accuracy_by"].items():
        for name, item in values.items():
            lines.append(
                f"| {key} | {name} | {item['rows']} | {item['accuracy']:.3f} |"
            )
    lines += ["", "## Per command", "", "| Label | Precision | Recall | F1 | Support |"]
    lines.append("| --- | --- | --- | --- | --- |")
    for label, item in intent["per_label"].items():
        lines.append(
            f"| {label} | {item['precision']:.3f} | {item['recall']:.3f} | "
            f"{item['f1']:.3f} | {item['support']} |"
        )
    lines += ["", "## Confusion (expected → predicted counts)", ""]
    for actual, guesses in intent["confusion"].items():
        cells = ", ".join(f"{guess}: {count}" for guess, count in guesses.items())
        lines.append(f"- {actual} → {cells}")
    lines += ["", f"## Failures ({len(result['failures'])})", ""]
    if not result["failures"]:
        lines.append("None.")
    for item in result["failures"]:
        lines.append(
            f"- `{item['id']}` {item['text']!r}: expected {item['expected']}, "
            f"got {item['predicted']}"
        )
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--label", help="write results/intent-<label>.json and .md")
    parser.add_argument("--dataset", type=Path, default=DATASET)
    parser.add_argument("--check", action="store_true", help="enforce thresholds")
    parser.add_argument("--min-accuracy", type=float, default=0.95)
    parser.add_argument("--min-quantity-accuracy", type=float, default=0.95)
    parser.add_argument("--max-false-action-rate", type=float, default=0.0)
    args = parser.parse_args(argv)

    name, predict = resolver()
    rows = load(args.dataset)
    result = {
        "label": args.label or "check",
        "resolver": name,
        "commit": commit(),
        "dataset": args.dataset.resolve().relative_to(HERE.parent.resolve()).as_posix(),
        "run_at": datetime.now(UTC).isoformat(timespec="seconds"),
        **evaluate(rows, predict),
    }
    intent = result["intent"]
    print(
        f"{name}: accuracy {intent['accuracy']:.3f}, macro F1 "
        f"{intent['macro']['f1']:.3f}, quantity "
        f"{result['quantity']['exact_accuracy']:.3f}, false actions "
        f"{result['abstention']['false_action_rate']:.3f}, wrong change commands "
        f"{len(result['wrong_write_actions'])}, failures {len(result['failures'])}"
    )
    if args.label:
        RESULTS.mkdir(exist_ok=True)
        stem = RESULTS / f"intent-{args.label}"
        stem.with_suffix(".json").write_text(
            json.dumps(result, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        stem.with_suffix(".md").write_text(
            markdown(result), encoding="utf-8", newline="\n"
        )
    if args.check:
        problems = []
        if result["wrong_write_actions"]:
            problems.append(f"wrong change commands: {result['wrong_write_actions']}")
        if intent["accuracy"] < args.min_accuracy:
            problems.append(f"accuracy {intent['accuracy']:.3f} < {args.min_accuracy}")
        if result["quantity"]["exact_accuracy"] < args.min_quantity_accuracy:
            problems.append("quantity accuracy below threshold")
        if result["abstention"]["false_action_rate"] > args.max_false_action_rate:
            problems.append(
                f"acted on abstaining rows: {result['abstention']['false_actions']}"
            )
        for problem in problems:
            print(f"FAIL {problem}", file=sys.stderr)
        return 1 if problems else 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
