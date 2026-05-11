#!/usr/bin/env python3
"""OCR import/export documents into normalized JSONL.

The script uses local command-line tools only:
- tesseract for OCR
- ImageMagick `magick` for image preprocessing/PDF rasterization

Vietnamese OCR requires the `vie` traineddata language. The current machine
only has `eng`, `osd`, and `snum`, so Vietnamese documents will work better
after installing `vie`.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = ROOT / "llm-dataset" / "ocr-assets" / "ocr_documents.jsonl"
SUPPORTED_EXTS = {".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp"}


def require_binary(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise SystemExit(f"Missing required binary: {name}")
    return path


def list_tesseract_languages() -> List[str]:
    try:
        result = subprocess.run(["tesseract", "--list-langs"], capture_output=True, text=True, check=False)
    except FileNotFoundError:
        return []
    langs = []
    for line in (result.stdout + "\n" + result.stderr).splitlines():
        line = line.strip()
        if not line or line.startswith("List of available"):
            continue
        langs.append(line)
    return sorted(set(langs))


def iter_input_files(input_path: Path, recursive: bool) -> Iterable[Path]:
    if input_path.is_file():
        if input_path.suffix.lower() in SUPPORTED_EXTS:
            yield input_path
        return
    pattern = "**/*" if recursive else "*"
    for path in sorted(input_path.glob(pattern)):
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTS:
            yield path


def run_cmd(args: List[str], timeout: int = 300) -> subprocess.CompletedProcess:
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=False)


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines()]
    lines = [line for line in lines if line]
    return "\n".join(lines)


def preprocess_image(image_path: Path, output_path: Path) -> None:
    # A conservative preprocessing profile that improves scanned documents
    # without destroying small invoice/packing list text.
    args = [
        "magick",
        str(image_path),
        "-auto-orient",
        "-colorspace",
        "Gray",
        "-contrast-stretch",
        "0.5%x0.5%",
        "-sharpen",
        "0x1",
        str(output_path),
    ]
    result = run_cmd(args)
    if result.returncode != 0:
        # Fallback to the original image if ImageMagick cannot decode it.
        shutil.copyfile(image_path, output_path)


def rasterize_pdf(pdf_path: Path, work_dir: Path, dpi: int) -> List[Path]:
    output_pattern = work_dir / "page-%04d.png"
    args = [
        "magick",
        "-density",
        str(dpi),
        str(pdf_path),
        "-background",
        "white",
        "-alpha",
        "remove",
        "-alpha",
        "off",
        str(output_pattern),
    ]
    result = run_cmd(args, timeout=1200)
    if result.returncode != 0:
        raise RuntimeError(
            "PDF rasterization failed. Install Ghostscript or use image files. "
            f"stderr={result.stderr[:500]}"
        )
    pages = sorted(work_dir.glob("page-*.png"))
    if not pages:
        raise RuntimeError("PDF rasterization produced no pages")
    return pages


def image_pages(file_path: Path, work_dir: Path, dpi: int) -> List[Path]:
    if file_path.suffix.lower() == ".pdf":
        return rasterize_pdf(file_path, work_dir, dpi)
    preprocessed = work_dir / f"{file_path.stem}-preprocessed.png"
    preprocess_image(file_path, preprocessed)
    return [preprocessed]


def parse_tsv_confidence(tsv: str) -> Tuple[Optional[float], int]:
    confidences: List[float] = []
    words = 0
    for idx, line in enumerate(tsv.splitlines()):
        if idx == 0:
            continue
        cols = line.split("\t")
        if len(cols) < 12:
            continue
        text = cols[11].strip()
        if not text:
            continue
        words += 1
        try:
            conf = float(cols[10])
        except ValueError:
            continue
        if conf >= 0:
            confidences.append(conf)
    if not confidences:
        return None, words
    return round(sum(confidences) / len(confidences), 2), words


def ocr_page(image_path: Path, lang: str, psm: int) -> Dict[str, Any]:
    text_result = run_cmd(["tesseract", str(image_path), "stdout", "-l", lang, "--oem", "1", "--psm", str(psm)], timeout=600)
    if text_result.returncode != 0:
        raise RuntimeError(f"tesseract text failed: {text_result.stderr[:500]}")
    tsv_result = run_cmd(
        ["tesseract", str(image_path), "stdout", "-l", lang, "--oem", "1", "--psm", str(psm), "tsv"],
        timeout=600,
    )
    confidence, word_count = parse_tsv_confidence(tsv_result.stdout if tsv_result.returncode == 0 else "")
    text = normalize_text(text_result.stdout)
    return {
        "text": text,
        "confidence": confidence,
        "word_count": word_count or len(re.findall(r"\w+", text, flags=re.UNICODE)),
    }


def classify_document(text: str) -> str:
    upper = text.upper()
    rules = [
        ("commercial_invoice", ["COMMERCIAL INVOICE", "INVOICE NO", "INVOICE NUMBER", "HOA DON", "HÓA ĐƠN"]),
        ("packing_list", ["PACKING LIST", "QUY CACH DONG GOI", "KIEN", "KIỆN"]),
        ("bill_of_lading", ["BILL OF LADING", "B/L", "BL NO", "AWB", "MAWB", "HAWB"]),
        ("certificate_of_origin", ["CERTIFICATE OF ORIGIN", "C/O", "FORM E", "FORM D"]),
        ("customs_declaration", ["TO KHAI", "TỜ KHAI", "CUSTOMS DECLARATION", "MA HAI QUAN", "MÃ HẢI QUAN"]),
        ("sales_contract", ["SALES CONTRACT", "CONTRACT NO", "HOP DONG", "HỢP ĐỒNG"]),
    ]
    for doc_type, keywords in rules:
        if any(keyword in upper for keyword in keywords):
            return doc_type
    return "unknown"


def extract_fields(text: str) -> Dict[str, Any]:
    compact = re.sub(r"[ \t]+", " ", text)
    fields: Dict[str, Any] = {}
    patterns = {
        "invoice_no": r"(?:invoice\s*(?:no|number|#)|inv\.?\s*no\.?)[:\s-]*([A-Z0-9][A-Z0-9_\-./]{2,})",
        "bl_no": r"(?:b/l|bill\s*of\s*lading|bl\s*no|awb|mawb|hawb)[:\s#]*([A-Z0-9][A-Z0-9_\-./]{2,})",
        "declaration_no": r"(?:to\s*khai|tờ\s*khai|declaration\s*(?:no|number)?)[:\s#]*([A-Z0-9][A-Z0-9_\-./]{4,})",
        "tax_code": r"\b(\d{10}(?:\d{3})?)\b",
        "incoterm": r"\b(EXW|FCA|FAS|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP|DDU|C&F)\b",
        "currency": r"\b(USD|VND|EUR|JPY|CNY|GBP|AUD|SGD|CHF|HKD|KRW|THB)\b",
    }
    for key, pattern in patterns.items():
        match = re.search(pattern, compact, flags=re.IGNORECASE | re.UNICODE)
        if match:
            fields[key] = match.group(1).strip()
    hs_codes = sorted(set(re.findall(r"\b\d{8,10}\b", compact)))
    if hs_codes:
        fields["hs_codes"] = hs_codes[:50]
    containers = sorted(set(re.findall(r"\b[A-Z]{4}\d{7}\b", compact.upper())))
    if containers:
        fields["containers"] = containers[:50]
    amounts = re.findall(r"\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b\d+\.\d{2}\b", compact)
    if amounts:
        fields["amount_candidates"] = amounts[:30]
    return fields


def process_file(file_path: Path, args: argparse.Namespace) -> Dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="vvmv-ocr-") as tmp:
        work_dir = Path(tmp)
        pages = image_pages(file_path, work_dir, args.dpi)
        page_results = []
        all_text_parts = []
        for page_no, page_image in enumerate(pages, 1):
            result = ocr_page(page_image, args.lang, args.psm)
            result["page"] = page_no
            page_results.append(result)
            all_text_parts.append(result["text"])
        text = normalize_text("\n\n".join(all_text_parts))
        confidences = [p["confidence"] for p in page_results if p.get("confidence") is not None]
        avg_conf = round(sum(confidences) / len(confidences), 2) if confidences else None
        doc = {
            "document_id": args.document_id_prefix + file_path.stem if args.document_id_prefix else file_path.stem,
            "source_file": str(file_path),
            "file_name": file_path.name,
            "file_ext": file_path.suffix.lower(),
            "ocr_engine": "tesseract",
            "ocr_lang": args.lang,
            "page_count": len(page_results),
            "avg_confidence": avg_conf,
            "word_count": sum(int(p.get("word_count") or 0) for p in page_results),
            "document_type": classify_document(text),
            "extracted_fields": extract_fields(text),
            "text": text,
            "pages": page_results,
            "processed_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }
    return doc


def main() -> None:
    parser = argparse.ArgumentParser(description="OCR documents to JSONL")
    parser.add_argument("--input", type=Path, required=True, help="Input file or directory")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--recursive", action="store_true")
    parser.add_argument("--lang", default="eng", help="Tesseract language, e.g. eng or vie+eng")
    parser.add_argument("--dpi", type=int, default=220)
    parser.add_argument("--psm", type=int, default=6)
    parser.add_argument("--document-id-prefix", default="")
    parser.add_argument("--fail-fast", action="store_true")
    parser.add_argument("--check", action="store_true", help="Print environment check and exit")
    args = parser.parse_args()

    require_binary("tesseract")
    require_binary("magick")
    langs = list_tesseract_languages()
    if args.check:
        print(json.dumps({"tesseract_languages": langs, "has_vie": "vie" in langs}, ensure_ascii=False, indent=2))
        return
    requested_langs = [part for part in args.lang.split("+") if part]
    missing = [lang for lang in requested_langs if lang not in langs]
    if missing:
        raise SystemExit(f"Missing Tesseract languages: {missing}. Available: {langs}")
    if not args.input.exists():
        raise SystemExit(f"Input not found: {args.input}")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    files = list(iter_input_files(args.input, args.recursive))
    if not files:
        raise SystemExit(f"No supported OCR files found under {args.input}")

    ok = 0
    errors = 0
    with args.output.open("w", encoding="utf-8") as out:
        for file_path in files:
            try:
                doc = process_file(file_path, args)
                out.write(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n")
                ok += 1
                print(f"ocr_ok file={file_path} pages={doc['page_count']} words={doc['word_count']} conf={doc['avg_confidence']}")
            except Exception as exc:
                errors += 1
                error_doc = {
                    "source_file": str(file_path),
                    "file_name": file_path.name,
                    "error": str(exc),
                    "processed_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                }
                out.write(json.dumps(error_doc, ensure_ascii=False, separators=(",", ":")) + "\n")
                print(f"ocr_error file={file_path} error={exc}")
                if args.fail_fast:
                    raise
    print(json.dumps({"output": str(args.output), "ok": ok, "errors": errors}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
