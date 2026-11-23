"""Import explicitly public, licensed local PDF/Markdown files from a manifest.

Extraction runs in a bounded subprocess. No URL fetching, OCR, account records
or public upload endpoint is provided.
"""

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

from app.database import database_engine
from app.knowledge import ingest


def pdf_sections(path: Path) -> list[dict]:
    from pypdf import Configuration, PdfReader

    if path.is_symlink() or not 0 < path.stat().st_size <= 10_000_000:
        raise ValueError("PDF must be a regular file up to 10 MB")
    if not path.read_bytes()[:8].startswith(b"%PDF-"):
        raise ValueError("Invalid PDF header")
    Configuration.zlib_maximum_output_length = 2_000_000
    reader = PdfReader(path, strict=True)
    if reader.is_encrypted or not 1 <= len(reader.pages) <= 25:
        raise ValueError("Encrypted PDFs and PDFs over 25 pages are not supported")
    sections, total = [], 0
    for number, page in enumerate(reader.pages, 1):
        content = page.get_contents()
        if content is not None and len(content.get_data()) > 2_000_000:
            raise ValueError("PDF page content is too large")
        text = (page.extract_text() or "").strip()
        if not text:
            raise ValueError(
                "PDF has an empty/scanned page; reviewed OCR text is required"
            )
        total += len(text)
        if total > 200_000:
            raise ValueError("PDF extracted text exceeds 200000 characters")
        sections.append({"heading": f"Page {number}", "body": text})
    return sections


def markdown_sections(text: str) -> list[dict]:
    if not text.strip() or len(text) > 200_000:
        raise ValueError("Markdown must contain at most 200000 characters")
    result, heading, body = [], "Introduction", []
    for line in text.splitlines(keepends=True):
        match = re.match(r"^#{1,6}\s+(.+?)\s*$", line)
        if match:
            if "".join(body).strip():
                result.append({"heading": heading, "body": "".join(body).strip()})
            heading, body = match[1][:200], []
        else:
            body.append(line)
    if "".join(body).strip():
        result.append({"heading": heading, "body": "".join(body).strip()})
    if not result or len(result) > 200:
        raise ValueError("Document must have 1–200 nonempty sections")
    return result


def load_manifest(path: Path) -> list[dict]:
    if path.stat().st_size > 100_000:
        raise ValueError("Manifest exceeds 100 KB")
    records = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(records, list) or not 1 <= len(records) <= 20:
        raise ValueError("Manifest must contain 1–20 public documents")
    root, documents, ids = path.resolve().parent, [], set()
    for record in records:
        required = {
            "id",
            "title",
            "source_url",
            "licence",
            "updated_on",
            "language",
            "path",
            "public",
        }
        if (
            not isinstance(record, dict)
            or set(record) != required
            or record["public"] is not True
        ):
            raise ValueError(
                "Each document needs explicit public=true and complete provenance"
            )
        if any(
            not isinstance(record[key], str) or not record[key].strip()
            for key in required - {"public"}
        ):
            raise ValueError("Manifest strings cannot be empty")
        url = urlparse(record["source_url"])
        if url.scheme != "https" or not url.hostname or url.username or url.password:
            raise ValueError(
                "A public HTTPS source URL without credentials is required"
            )
        if not re.fullmatch(r"[a-z0-9-]{1,80}", record["id"]) or record["id"] in ids:
            raise ValueError("Document IDs must be unique lowercase slugs")
        if (
            len(record["title"]) > 200
            or len(record["licence"]) > 200
            or len(record["source_url"]) > 500
            or len(record["language"]) > 8
        ):
            raise ValueError("Manifest metadata exceeds database limits")
        date.fromisoformat(record["updated_on"])
        ids.add(record["id"])
        source = root / record["path"]
        if (
            source.is_symlink()
            or root not in source.resolve().parents
            or not source.is_file()
        ):
            raise ValueError(
                "Files must stay inside the manifest folder without symlinks"
            )
        if source.suffix.lower() == ".pdf":
            try:
                extracted = subprocess.run(
                    [
                        sys.executable,
                        "-m",
                        "app.knowledge_import",
                        "--extract",
                        str(source),
                    ],
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    timeout=30,
                    env={**os.environ, "PYTHONIOENCODING": "utf-8"},
                )
            except subprocess.TimeoutExpired as error:
                raise ValueError("PDF extraction exceeded 30 seconds") from error
            if extracted.returncode:
                raise ValueError(
                    "PDF extraction refused; check limits, encryption and selectable text"
                )
            sections = json.loads(extracted.stdout)
        elif source.suffix.lower() == ".md":
            if source.stat().st_size > 1_000_000:
                raise ValueError("Markdown file exceeds 1 MB")
            sections = markdown_sections(source.read_text(encoding="utf-8"))
        else:
            raise ValueError("Only local .pdf and .md documents are supported")
        documents.append(
            {
                key: value
                for key, value in record.items()
                if key not in {"path", "public"}
            }
            | {"sections": sections}
        )
    return documents


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument("--contextual", action="store_true")
    parser.add_argument("--require-context", action="store_true")
    parser.add_argument("--refresh-context", action="store_true")
    parser.add_argument("--extract", type=Path, help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.extract:
        if sys.platform != "win32":
            import resource

            resource.setrlimit(resource.RLIMIT_AS, (1024**3, 1024**3))
            resource.setrlimit(resource.RLIMIT_CPU, (20, 20))
        print(json.dumps(pdf_sections(args.extract), ensure_ascii=False))
        return
    if args.manifest is None:
        parser.error("--manifest is required")
    documents = load_manifest(args.manifest)
    if args.validate_only:
        print(
            json.dumps(
                {
                    "documents": len(documents),
                    "sections": sum(len(doc["sections"]) for doc in documents),
                }
            )
        )
        return
    engine = database_engine()
    if engine is None:
        parser.error("DATABASE_URL is required")
    from sqlalchemy.orm import Session

    try:
        with Session(engine) as db:
            print(
                json.dumps(
                    ingest(
                        db,
                        documents,
                        args.contextual,
                        require_context=args.require_context,
                        refresh_context=args.refresh_context,
                    )
                )
            )
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
