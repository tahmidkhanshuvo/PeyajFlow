"""Classification metrics shared by PeyajFlow evaluations.

Precision, recall and F1 follow the usual one-vs-rest definitions. A ratio with
a zero denominator is reported as 0. Macro averages use every label that occurs
in either the expected or the predicted values, so a label the system invents
lowers the average instead of being ignored.
"""

from collections import Counter
from collections.abc import Sequence


def ratio(numerator: int, denominator: int) -> float:
    return numerator / denominator if denominator else 0.0


def classification(expected: Sequence[str], predicted: Sequence[str]) -> dict:
    if len(expected) != len(predicted):
        raise ValueError("expected and predicted must have the same length")
    labels = sorted(set(expected) | set(predicted))
    pairs = Counter(zip(expected, predicted, strict=True))
    per_label = {}
    for label in labels:
        true_positive = pairs[(label, label)]
        false_positive = sum(
            count
            for (actual, guess), count in pairs.items()
            if guess == label and actual != label
        )
        false_negative = sum(
            count
            for (actual, guess), count in pairs.items()
            if actual == label and guess != label
        )
        precision = ratio(true_positive, true_positive + false_positive)
        recall = ratio(true_positive, true_positive + false_negative)
        per_label[label] = {
            "precision": precision,
            "recall": recall,
            "f1": ratio(2 * precision * recall, precision + recall)
            if precision + recall
            else 0.0,
            "support": true_positive + false_negative,
        }
    count = len(labels)
    return {
        "total": len(expected),
        "accuracy": ratio(
            sum(pairs[(label, label)] for label in labels), len(expected)
        ),
        "labels": labels,
        "per_label": per_label,
        "macro": {
            name: sum(item[name] for item in per_label.values()) / count
            if count
            else 0.0
            for name in ("precision", "recall", "f1")
        },
        "confusion": {
            actual: {
                guess: pairs[(actual, guess)]
                for guess in labels
                if pairs[(actual, guess)]
            }
            for actual in labels
            if any(pairs[(actual, guess)] for guess in labels)
        },
    }
