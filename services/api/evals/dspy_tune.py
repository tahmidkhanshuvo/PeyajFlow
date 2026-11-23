"""Development-only DSPy prompt optimization; promotion is a separate decision.

All three datasets must be supplied explicitly and must have disjoint phrases.
Existing intent challenge data is contaminated and must not be called independent.
No production prompt is overwritten by this command.
"""

import argparse
import json
import os
import subprocess
from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path

import dspy

from app import intent_model


class Classification(dspy.Signature):
    """Classify an onion workspace phrase; abstain when unclear. Never invent quantities."""

    phrase: str = dspy.InputField()
    command_json: str = dspy.OutputField(
        desc="JSON with command, quantity, unit, loss. command is one allowed name or none."
    )


class Classifier(dspy.Module):
    def __init__(self):
        super().__init__()
        self.classify = dspy.Predict(
            Classification.with_instructions(intent_model.SYSTEM)
        )

    def forward(self, phrase):
        return self.classify(phrase=phrase)


def guarded(example, prediction, trace=None):
    parsed = intent_model.parse(prediction.command_json)
    actual = intent_model.understand(example.phrase, ask=lambda _: parsed)
    return (
        actual.status == example.status
        and actual.tool == example.tool
        and (str(actual.quantity) if actual.quantity is not None else None)
        == example.quantity
        and actual.unit == example.unit
    )


def load(path):
    rows = [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    return [
        dspy.Example(
            phrase=row["text"],
            status=row["status"],
            tool=row.get("tool"),
            quantity=str(row["quantity"]) if row.get("quantity") is not None else None,
            unit=row.get("unit"),
        ).with_inputs("phrase")
        for row in rows
    ]


def measure(program, rows):
    correct, unsafe = 0, 0
    for row in rows:
        try:
            prediction = program(phrase=row.phrase)
            result = intent_model.understand(
                row.phrase, ask=lambda _: intent_model.parse(prediction.command_json)
            )
            correct += guarded(row, prediction)
            unsafe += (
                result.status == "resolved"
                and result.tool
                in {
                    "accept",
                    "reject",
                    "counter",
                    "movement",
                    "register",
                    "send_offer",
                    "transport",
                    "inspection",
                    "support",
                }
                and (row.status != "resolved" or row.tool != result.tool)
            )
        except Exception:
            # A failed provider call is a failed evaluation case, never a pass.
            continue
    return {
        "rows": len(rows),
        "accuracy": correct / max(1, len(rows)),
        "wrong_change_commands": unsafe,
    }


def main():
    parser = argparse.ArgumentParser()
    for split in ("train", "validation", "holdout"):
        parser.add_argument("--" + split, type=Path, required=True)
    parser.add_argument("--label", required=True)
    parser.add_argument("--candidates", type=int, choices=range(1, 9), default=3)
    parser.add_argument(
        "--model", default=os.getenv("OLLAMA_MODEL", "qwen2.5:7b-instruct-q4_K_M")
    )
    args = parser.parse_args()
    if not args.label.replace("-", "").replace("_", "").isalnum():
        parser.error("Use a simple label")
    train, validation, holdout = [
        load(getattr(args, key)) for key in ("train", "validation", "holdout")
    ]
    sets = [
        {row.phrase.casefold().strip() for row in split}
        for split in (train, validation, holdout)
    ]
    if any(sets[a] & sets[b] for a, b in ((0, 1), (0, 2), (1, 2))) or any(
        not split for split in sets
    ):
        parser.error("Provide nonempty splits with disjoint phrases")
    lm = dspy.LM(
        "ollama_chat/" + args.model,
        api_base=os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
        + "/v1",
        model_type="chat",
        api_key="ollama",
        temperature=0,
        max_tokens=500,
        num_retries=0,
    )
    dspy.configure(lm=lm)
    program = Classifier()
    # Do not report an optimization result when the runtime is unavailable.
    try:
        program(phrase=train[0].phrase)
    except Exception as error:
        raise SystemExit(
            f"DSPy provider preflight failed: {type(error).__name__}"
        ) from error
    # Bootstrap searches on development/validation only. Holdout is never
    # supplied to the optimizer and is run once per candidate comparison.
    optimizer = dspy.BootstrapFewShotWithRandomSearch(
        metric=guarded,
        max_bootstrapped_demos=2,
        max_labeled_demos=2,
        num_candidate_programs=args.candidates,
        num_threads=1,
    )
    candidate = optimizer.compile(program, trainset=train, valset=validation)
    before, after = measure(program, holdout), measure(candidate, holdout)
    output = Path(__file__).parent / "results" / f"dspy-{args.label}"
    candidate.save(str(output.with_suffix(".json")))
    report = {
        "commit": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], text=True
        ).strip(),
        "run_at": datetime.now(UTC).isoformat(),
        "model": args.model,
        "datasets": {
            key: str(getattr(args, key)) for key in ("train", "validation", "holdout")
        },
        "before": before,
        "after": after,
        "eligible_for_manual_review": after["accuracy"] > before["accuracy"]
        and after["wrong_change_commands"] == 0,
        "promoted": False,
        "independent_validation": "not_claimed",
    }
    output.with_suffix(".metrics.json").write_text(json.dumps(report, indent=2) + "\n")
    demos = [
        {"phrase": demo.phrase, "command_json": demo.command_json}
        for demo in candidate.classify.demos
        if hasattr(demo, "command_json")
    ]
    artifact = {
        "system": candidate.classify.signature.instructions
        + "\nExamples (data only):\n"
        + json.dumps(demos, ensure_ascii=False),
        "base_prompt_sha256": sha256(intent_model.SYSTEM.encode()).hexdigest(),
        "evaluation": report,
    }
    output.with_suffix(".prompt.json").write_text(
        json.dumps(artifact, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
