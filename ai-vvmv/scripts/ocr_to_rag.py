#!/usr/bin/env python3
"""Convert OCR JSONL output to RAG corpus and optional instruction data."""

from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path
from typing import Any, Dict, Iterable


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = ROOT / "llm-dataset" / "ocr-assets" / "ocr_documents.jsonl"
DEFAULT_OUTPUT = ROOT / "llm-dataset" / "ocr-assets"


def iter_jsonl(path: Path) -> Iterable[Dict[str, Any]]:
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def mask_sensitive(text: str) -> str:
    text = re.sub(r"\b\d{10,14}\b", "[TAX_CODE]", text)
    text = re.sub(r"\b[A-Z]{4}\d{7}\b", "[CONTAINER]", text)
    return text


def compact_text(doc: Dict[str, Any], max_chars: int) -> str:
    text = doc.get("text") or ""
    if len(text) > max_chars:
        text = text[:max_chars].rstrip() + "\n...[truncated]"
    return text


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert OCR docs to RAG/training assets")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--max-chars", type=int, default=12000)
    args = parser.parse_args()

    if not args.input.exists():
        raise SystemExit(f"Input not found: {args.input}")

    rag_dir = args.output_dir / "private_rag"
    train_dir = args.output_dir / "training"
    report_dir = args.output_dir / "reports"
    for folder in (rag_dir, train_dir, report_dir):
        folder.mkdir(parents=True, exist_ok=True)

    rag_path = rag_dir / "ocr_corpus.jsonl"
    train_path = train_dir / "ocr_instruction_tuning.jsonl"
    ok = 0
    errors = 0
    type_counts: Dict[str, int] = {}

    with rag_path.open("w", encoding="utf-8") as rag, train_path.open("w", encoding="utf-8") as train:
        for doc in iter_jsonl(args.input):
            if doc.get("error"):
                errors += 1
                continue
            doc_id = doc.get("document_id") or Path(doc.get("source_file", "document")).stem
            doc_type = doc.get("document_type") or "unknown"
            type_counts[doc_type] = type_counts.get(doc_type, 0) + 1
            text = compact_text(doc, args.max_chars)
            extracted = doc.get("extracted_fields") or {}
            rag_doc = {
                "id": f"ocr:{doc_id}",
                "text": (
                    f"Chung tu OCR ID {doc_id}. Loai chung tu: {doc_type}. "
                    f"File: {doc.get('file_name')}. Confidence: {doc.get('avg_confidence')}.\n"
                    f"Fields: {json.dumps(extracted, ensure_ascii=False)}\n\n{text}"
                ),
                "metadata": {
                    "source": "ocr",
                    "document_id": doc_id,
                    "document_type": doc_type,
                    "source_file": doc.get("source_file"),
                    "avg_confidence": doc.get("avg_confidence"),
                    "extracted_fields": extracted,
                },
            }
            rag.write(json.dumps(rag_doc, ensure_ascii=False, separators=(",", ":")) + "\n")

            masked_text = mask_sensitive(text)
            sample = {
                "task": "ocr_document_extraction",
                "messages": [
                    {
                        "role": "system",
                        "content": "Ban la tro ly AI xuat nhap khau. Hay trich xuat thong tin chung tu OCR va neu ro muc do tin cay.",
                    },
                    {
                        "role": "user",
                        "content": "Trich xuat thong tin quan trong tu chung tu OCR sau:\n" + masked_text,
                    },
                    {
                        "role": "assistant",
                        "content": (
                            f"Loai chung tu du doan: {doc_type}. "
                            f"Thong tin trich xuat: {json.dumps(extracted, ensure_ascii=False)}. "
                            f"Do tin cay OCR trung binh: {doc.get('avg_confidence')}."
                        ),
                    },
                ],
                "metadata": {
                    "document_id": doc_id,
                    "document_type": doc_type,
                    "source": "ocr",
                },
            }
            train.write(json.dumps(sample, ensure_ascii=False, separators=(",", ":")) + "\n")
            ok += 1

    summary = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "input": str(args.input),
        "ok_documents": ok,
        "error_documents": errors,
        "document_types": type_counts,
        "outputs": {
            "rag": str(rag_path),
            "training": str(train_path),
        },
    }
    summary_path = report_dir / "ocr_assets_summary.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
