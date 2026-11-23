"""Forward bounded CSV files to n8n's authenticated staging webhook.

No file is approved or deleted. Stable content-derived keys make retries safe.
The operator supplies both a watched folder and a separately protected receipt
file. Real reports require --real; the default labels imports as synthetic.
"""

import argparse
import hashlib
import json
import os
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import UUID, uuid5

NAMESPACE = UUID("ff290577-d320-4ada-949c-ad11071f5c7e")


def scan(folder: Path, receipt: Path, *, synthetic: bool, send=None) -> dict:
    processed = set(json.loads(receipt.read_text()) if receipt.exists() else [])
    sent, failed = 0, 0
    for path in sorted(folder.glob("*.csv"))[:100]:
        if path.is_symlink() or not path.is_file() or path.stat().st_size > 400000:
            failed += 1
            continue
        raw = path.read_bytes()
        digest = hashlib.sha256(raw + str(synthetic).encode()).hexdigest()
        if digest in processed:
            continue
        try:
            payload = {
                "request_key": str(uuid5(NAMESPACE, digest)),
                "label": "Report intake: " + path.stem[:80],
                "synthetic": synthetic,
                "csv": raw.decode("utf-8-sig"),
            }
            if send:
                response = send(payload)
            else:
                request = Request(
                    os.environ["N8N_IMPORT_WEBHOOK_URL"],
                    data=json.dumps(payload).encode(),
                    headers={
                        "Content-Type": "application/json",
                        "X-PeyajFlow-Intake": os.environ["N8N_INTAKE_SECRET"],
                    },
                )
                with urlopen(request, timeout=30) as result:
                    response = json.loads(result.read(10000))
            if not isinstance(response, dict) or "batch_id" not in response:
                failed += 1
                continue
            processed.add(digest)
            receipt.parent.mkdir(parents=True, exist_ok=True)
            temporary = receipt.with_suffix(".tmp")
            temporary.write_text(json.dumps(sorted(processed)) + "\n")
            temporary.replace(receipt)
            sent += 1
        except (URLError, HTTPError, OSError, ValueError):
            failed += 1
    return {"staged": sent, "failed": failed}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--folder", type=Path, required=True)
    parser.add_argument("--receipt", type=Path, required=True)
    parser.add_argument("--real", action="store_true")
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    if (
        not args.folder.is_dir()
        or not os.getenv("N8N_IMPORT_WEBHOOK_URL")
        or not os.getenv("N8N_INTAKE_SECRET")
    ):
        parser.error(
            "Provide an existing folder and the webhook URL/secret environment settings"
        )
    while True:
        result = scan(args.folder, args.receipt, synthetic=not args.real)
        print(json.dumps(result), flush=True)
        if args.once:
            return int(result["failed"] > 0)
        time.sleep(15)


if __name__ == "__main__":
    raise SystemExit(main())
