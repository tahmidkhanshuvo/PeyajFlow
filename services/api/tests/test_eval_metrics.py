import pytest

from evals.intent_eval import Prediction, evaluate
from evals.metrics import classification


def test_classification_matches_hand_computed_values():
    expected = ["a", "a", "a", "b", "b", "c"]
    predicted = ["a", "a", "b", "b", "c", "c"]
    report = classification(expected, predicted)
    assert report["accuracy"] == pytest.approx(4 / 6)
    a, b, c = (report["per_label"][label] for label in "abc")
    assert (a["precision"], a["recall"], a["support"]) == (1.0, pytest.approx(2 / 3), 3)
    assert a["f1"] == pytest.approx(0.8)
    assert (b["precision"], b["recall"]) == (0.5, 0.5)
    assert (c["precision"], c["recall"]) == (0.5, 1.0)
    assert report["macro"]["recall"] == pytest.approx((2 / 3 + 0.5 + 1) / 3)
    assert report["confusion"] == {
        "a": {"a": 2, "b": 1},
        "b": {"b": 1, "c": 1},
        "c": {"c": 1},
    }


def test_invented_labels_count_against_the_macro_average():
    report = classification(["a", "a"], ["a", "z"])
    assert report["labels"] == ["a", "z"]
    assert report["per_label"]["z"] == {
        "precision": 0.0,
        "recall": 0.0,
        "f1": 0.0,
        "support": 0,
    }
    assert report["macro"]["precision"] == 0.5


def test_mismatched_lengths_are_rejected():
    with pytest.raises(ValueError):
        classification(["a"], [])


def test_evaluation_counts_wrong_changes_and_false_actions():
    rows = [
        {
            "id": "1",
            "split": "dev",
            "lang": "en",
            "category": "x",
            "text": "a",
            "status": "resolved",
            "tool": "accept",
            "quantity": "5",
            "unit": "kg",
        },
        {
            "id": "2",
            "split": "dev",
            "lang": "en",
            "category": "x",
            "text": "b",
            "status": "negated",
            "tool": None,
            "quantity": None,
            "unit": None,
        },
        {
            "id": "3",
            "split": "dev",
            "lang": "en",
            "category": "x",
            "text": "c",
            "status": "resolved",
            "tool": "prices",
            "quantity": None,
            "unit": None,
        },
    ]
    answers = {
        "a": Prediction("resolved", "accept", None, None),
        "b": Prediction("resolved", "reject"),
        "c": Prediction("resolved", "stock"),
    }
    result = evaluate(rows, answers.__getitem__)
    assert result["intent"]["accuracy"] == pytest.approx(1 / 3)
    assert result["quantity"] == {
        "rows": 1,
        "exact_accuracy": 0.0,
        "unit_accuracy": 0.0,
    }
    assert result["abstention"]["false_actions"] == ["2"]
    assert result["wrong_write_actions"] == ["2"]
    assert {item["id"] for item in result["failures"]} == {"1", "2", "3"}
