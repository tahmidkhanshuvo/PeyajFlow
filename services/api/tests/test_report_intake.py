from app.report_intake import scan


def test_intake_retries_same_key_and_does_not_delete_or_approve(tmp_path):
    folder = tmp_path / "reports"
    folder.mkdir()
    report = folder / "sample.csv"
    report.write_text("observed_on,source_url\n2026-11-21,https://example.org/report\n")
    receipt = tmp_path / "state/receipts.json"
    attempts = []

    def failed(payload):
        attempts.append(payload)
        return {"error": "not_staged"}

    assert scan(folder, receipt, synthetic=True, send=failed) == {
        "staged": 0,
        "failed": 1,
    }

    def accepted(payload):
        attempts.append(payload)
        return {"batch_id": "fixture", "status": "pending"}

    assert scan(folder, receipt, synthetic=True, send=accepted) == {
        "staged": 1,
        "failed": 0,
    }
    assert attempts[0]["request_key"] == attempts[1]["request_key"]
    assert attempts[1]["synthetic"] is True
    assert scan(folder, receipt, synthetic=True, send=accepted) == {
        "staged": 0,
        "failed": 0,
    }
    assert report.exists()


def test_intake_refuses_oversized_csv(tmp_path):
    (tmp_path / "large.csv").write_bytes(b"x" * 400001)
    assert scan(
        tmp_path, tmp_path / "receipts.json", synthetic=True, send=lambda _: None
    ) == {"staged": 0, "failed": 1}
