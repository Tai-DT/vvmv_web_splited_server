#!/usr/bin/env python3
"""Build compact AI assets for import/export assistants.

The script streams JSONL records and writes:
- private_rag/trade_knowledge_corpus.jsonl
- training/instruction_tuning.jsonl
- analytics/declarations_compact.jsonl
- analytics/cargo_facts.jsonl (optional)
- reports/ai_assets_summary.json
"""

from __future__ import annotations

import argparse
import json
import math
import re
import time
from collections import Counter
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List, Optional


ROOT = Path("/Volumes/FastVault-Apps/Projects/ai-vvmv")
DEFAULT_INPUT = ROOT / "llm-dataset" / "cleaned" / "vvmv_cleaned.jsonl"
DEFAULT_SOURCE_DIR = ROOT / "vvmv-dumps"
DEFAULT_OUTPUT = ROOT / "llm-dataset" / "ai-assets"


def clean_text(value: Any, max_len: Optional[int] = None) -> str:
    if value is None:
        return ""
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text[:max_len].rstrip() if max_len else text


def to_float(value: Any) -> Optional[float]:
    if value in (None, ""):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def mask_tax_code(value: Any) -> str:
    text = clean_text(value)
    if len(text) < 6:
        return "[TAX_CODE]"
    return f"{text[:3]}***{text[-2:]}"


def mask_sensitive(text: str) -> str:
    text = re.sub(r"\b\d{10,14}\b", "[TAX_CODE]", text)
    text = re.sub(r"\b\d{8,16}\b", "[NUMBER]", text)
    return text


def iter_jsonl_files(source_dir: Path, *, declaration_only: bool = True) -> Iterator[Path]:
    ignored_dirs = {"llm-dataset", "venv", ".git", "test-output", "sample-data"}
    for path in sorted(source_dir.rglob("*.jsonl")):
        if any(part in ignored_dirs for part in path.parts):
            continue
        if declaration_only and "declarations" not in path.parts:
            continue
        yield path


def iter_records(input_file: Optional[Path], source_dir: Optional[Path], *, include_all_jsonl: bool = False) -> Iterator[Dict[str, Any]]:
    if input_file:
        files: Iterable[Path] = [input_file]
    elif source_dir:
        files = iter_jsonl_files(source_dir, declaration_only=not include_all_jsonl)
    else:
        raise ValueError("Provide --input or --source-dir")

    for file_path in files:
        with file_path.open("r", encoding="utf-8") as fh:
            for line_no, line in enumerate(fh, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                except json.JSONDecodeError:
                    continue
                record.setdefault("_source_file", str(file_path))
                record.setdefault("_source_line", line_no)
                yield record


def looks_like_declaration(record: Dict[str, Any]) -> bool:
    has_nested_payload = isinstance(record.get("header"), dict) or isinstance(record.get("cargo"), list)
    has_declaration_fields = record.get("declarationId") and record.get("customsCode") and record.get("direction")
    return bool(has_nested_payload or has_declaration_fields)


def direction_label(direction: Any) -> str:
    return "nhap khau" if direction == "N" else "xuat khau" if direction == "X" else "khong ro"


def compact_record(record: Dict[str, Any], max_cargo: int) -> Dict[str, Any]:
    header = record.get("header") if isinstance(record.get("header"), dict) else {}
    vnaccs2 = record.get("vnaccs2") if isinstance(record.get("vnaccs2"), dict) else {}
    cargo = record.get("cargo") if isinstance(record.get("cargo"), list) else []

    cargo_sample: List[Dict[str, Any]] = []
    cargo_total_value = 0.0
    cargo_value_seen = 0
    for item in cargo:
        if not isinstance(item, dict):
            continue
        value = to_float(item.get("TRIGIA_KB"))
        if value is not None:
            cargo_total_value += value
            cargo_value_seen += 1
        if max_cargo <= 0 or len(cargo_sample) < max_cargo:
            cargo_sample.append(
                {
                    "line": item.get("STTHANG"),
                    "hs_code": clean_text(item.get("MA_HANGKB")),
                    "description": clean_text(item.get("TEN_HANG"), 500),
                    "origin": clean_text(item.get("NUOC_XX")),
                    "unit": clean_text(item.get("MA_DVT")),
                    "quantity": item.get("LUONG"),
                    "unit_price": item.get("DGIA_KB"),
                    "value": item.get("TRIGIA_KB"),
                    "tax_code": clean_text(item.get("TS_XNK_MA_BT") or item.get("TS_XNK")),
                }
            )

    compact = {
        "declaration_id": clean_text(record.get("declarationId")),
        "declaration_number": clean_text(record.get("declarationNumber")),
        "direction": clean_text(record.get("direction")),
        "direction_label": direction_label(record.get("direction")),
        "declaration_date": clean_text(record.get("declarationDate") or header.get("NGAY_DK")),
        "tax_code": clean_text(record.get("taxCode") or header.get("MA_DV")),
        "customs_code": clean_text(record.get("customsCode") or header.get("MA_HQ")),
        "customs_name": clean_text(header.get("TEN_HQ")),
        "operation_code": clean_text(record.get("operationCode") or header.get("MA_LH")),
        "company_name": clean_text(header.get("DV_DT") or header.get("_Ten_DV_L1")),
        "company_address": clean_text(header.get("DIA_CHI_DV")),
        "export_country": clean_text(header.get("NUOC_XK")),
        "import_country": clean_text(header.get("NUOC_NK")),
        "delivery_term": clean_text(header.get("MA_GH")),
        "currency": clean_text(header.get("MA_NT")),
        "total_declared_value": header.get("TONGTGKB") or header.get("TONGTG_HDTM"),
        "transport_name": clean_text(header.get("TEN_PTVT")),
        "bill_of_lading": clean_text(header.get("VAN_DON") or vnaccs2.get("VAN_DON_MAWB")),
        "port_code": clean_text(header.get("MA_CK") or header.get("MA_CANGNN")),
        "port_name": clean_text(header.get("TEN_CK") or header.get("CANGNN")),
        "declared_goods_count": header.get("SOHANG"),
        "cargo_count": len(cargo),
        "cargo_total_value": round(cargo_total_value, 4) if cargo_value_seen else None,
        "cargo_sample": cargo_sample,
        "source_file": clean_text(record.get("_source_file")),
    }
    compact["risk_flags"] = risk_flags(compact)
    return compact


def risk_flags(compact: Dict[str, Any]) -> List[str]:
    flags: List[str] = []
    cargo_count = compact.get("cargo_count") or 0
    if cargo_count <= 0:
        flags.append("NO_CARGO")

    declared_count = to_float(compact.get("declared_goods_count"))
    if declared_count is not None and cargo_count and int(declared_count) != cargo_count:
        flags.append("GOODS_COUNT_MISMATCH")

    sample = compact.get("cargo_sample") or []
    missing_hs = sum(1 for item in sample if not item.get("hs_code"))
    invalid_hs = sum(1 for item in sample if item.get("hs_code") and not re.match(r"^\d{6,10}$", item["hs_code"]))
    non_positive_qty = sum(1 for item in sample if (to_float(item.get("quantity")) or 0) <= 0)
    negative_value = sum(1 for item in sample if (to_float(item.get("value")) or 0) < 0)
    short_desc = sum(1 for item in sample if len(item.get("description") or "") < 20)

    if missing_hs:
        flags.append("MISSING_HS_CODE")
    if invalid_hs:
        flags.append("INVALID_HS_FORMAT")
    if non_positive_qty:
        flags.append("NON_POSITIVE_QUANTITY")
    if negative_value:
        flags.append("NEGATIVE_VALUE")
    if short_desc:
        flags.append("SHORT_CARGO_DESCRIPTION")

    header_value = to_float(compact.get("total_declared_value"))
    cargo_value = to_float(compact.get("cargo_total_value"))
    if header_value and cargo_value:
        diff = abs(header_value - cargo_value)
        if diff > max(100.0, abs(header_value) * 0.05):
            flags.append("DECLARED_VALUE_MISMATCH")
    return flags


def declaration_text(compact: Dict[str, Any], *, mask: bool = False) -> str:
    tax_code = mask_tax_code(compact["tax_code"]) if mask else compact["tax_code"]
    company = "[COMPANY]" if mask and compact.get("company_name") else compact.get("company_name", "")
    address = "[ADDRESS]" if mask and compact.get("company_address") else compact.get("company_address", "")

    lines = [
        f"To khai {compact['direction_label']} ID {compact['declaration_id']}.",
        f"Ma hai quan: {compact['customs_code']} - {compact.get('customs_name') or 'khong ro'}.",
        f"Loai hinh: {compact.get('operation_code') or 'khong ro'}. MST: {tax_code}.",
        f"Doanh nghiep: {company or 'khong ro'}. Dia chi: {address or 'khong ro'}.",
        f"Nuoc XK/NK: {compact.get('export_country') or '-'} -> {compact.get('import_country') or '-'}.",
        f"Dieu kien giao hang: {compact.get('delivery_term') or '-'}, tien te: {compact.get('currency') or '-'}.",
        f"Tong tri gia khai bao: {compact.get('total_declared_value') or '-'}; so dong hang: {compact.get('cargo_count')}.",
    ]
    if compact.get("bill_of_lading"):
        lines.append(f"Van don: {compact['bill_of_lading']}; phuong tien: {compact.get('transport_name') or '-'}.")
    lines.append("Hang hoa tieu bieu:")
    for item in compact.get("cargo_sample") or []:
        desc = mask_sensitive(item.get("description") or "") if mask else item.get("description") or ""
        lines.append(
            f"- Dong {item.get('line')}: HS {item.get('hs_code') or '-'}; {desc}; "
            f"xuat xu {item.get('origin') or '-'}; SL {item.get('quantity') or '-'} {item.get('unit') or ''}; "
            f"tri gia {item.get('value') or '-'}."
        )
    if compact.get("risk_flags"):
        lines.append("Canh bao rule: " + ", ".join(compact["risk_flags"]) + ".")
    return "\n".join(lines)


def instruction_samples(compact: Dict[str, Any]) -> List[Dict[str, Any]]:
    masked_text = declaration_text(compact, mask=True)
    risks = ", ".join(compact.get("risk_flags") or ["khong co canh bao rule"])
    system = "Ban la tro ly AI nghiep vu xuat nhap khau. Tra loi ngan gon, dua tren du lieu duoc cung cap."
    samples = [
        {
            "task": "declaration_analysis",
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": "Hay tom tat va phan tich rui ro to khai sau:\n" + masked_text},
                {
                    "role": "assistant",
                    "content": (
                        f"Day la to khai {compact['direction_label']} loai hinh {compact.get('operation_code') or 'khong ro'} "
                        f"tai ma hai quan {compact.get('customs_code') or 'khong ro'}, gom {compact.get('cargo_count')} dong hang. "
                        f"Canh bao can kiem tra: {risks}."
                    ),
                },
            ],
        }
    ]
    for item in (compact.get("cargo_sample") or [])[:2]:
        samples.append(
            {
                "task": "hs_history_lookup",
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": "Lich su khai bao cho hang hoa nay co ma HS nao?\n" + mask_sensitive(item.get("description") or "")},
                    {
                        "role": "assistant",
                        "content": (
                            f"Trong du lieu lich su, hang hoa tuong ung duoc khai voi ma HS {item.get('hs_code') or 'khong ro'}, "
                            f"xuat xu {item.get('origin') or 'khong ro'}, don vi {item.get('unit') or 'khong ro'}. "
                            "Day la goi y theo lich su, can chuyen gia xac nhan truoc khi khai chinh thuc."
                        ),
                    },
                ],
            }
        )
    return samples


def write_jsonl(handle, obj: Dict[str, Any]) -> None:
    handle.write(json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n")


def update_stats(stats: Dict[str, Any], compact: Dict[str, Any]) -> None:
    stats["total_declarations"] += 1
    stats["total_cargo_lines"] += compact.get("cargo_count") or 0
    stats["directions"][compact.get("direction") or ""] += 1
    stats["customs_codes"][compact.get("customs_code") or ""] += 1
    stats["operation_codes"][compact.get("operation_code") or ""] += 1
    stats["risk_flags"].update(compact.get("risk_flags") or [])
    for item in compact.get("cargo_sample") or []:
        hs = item.get("hs_code") or ""
        if hs:
            stats["hs2"][hs[:2]] += 1
            stats["hs4"][hs[:4]] += 1
        if item.get("origin"):
            stats["origins"][item["origin"]] += 1
    value = to_float(compact.get("total_declared_value"))
    if value is not None:
        stats["value_count"] += 1
        stats["value_sum"] += value
        stats["value_min"] = value if stats["value_min"] is None else min(stats["value_min"], value)
        stats["value_max"] = value if stats["value_max"] is None else max(stats["value_max"], value)


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare AI assets for import/export LLM/RAG")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="Cleaned JSONL input")
    parser.add_argument("--source-dir", type=Path, default=None, help="Read raw JSONL files instead of --input")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--max-records", type=int, default=0, help="0 means all records")
    parser.add_argument("--max-cargo", type=int, default=8, help="Max cargo lines kept per declaration; 0 means keep all")
    parser.add_argument("--progress-every", type=int, default=1000)
    parser.add_argument("--write-cargo-facts", action="store_true")
    parser.add_argument("--include-all-jsonl", action="store_true", help="When using --source-dir, include non-declaration JSONL files too")
    args = parser.parse_args()

    input_file = None if args.source_dir else args.input
    if input_file and not input_file.exists():
        raise SystemExit(f"Input not found: {input_file}")
    if args.source_dir and not args.source_dir.exists():
        raise SystemExit(f"Source dir not found: {args.source_dir}")

    private_dir = args.output / "private_rag"
    training_dir = args.output / "training"
    analytics_dir = args.output / "analytics"
    reports_dir = args.output / "reports"
    for folder in (private_dir, training_dir, analytics_dir, reports_dir):
        folder.mkdir(parents=True, exist_ok=True)

    stats: Dict[str, Any] = {
        "total_declarations": 0,
        "total_cargo_lines": 0,
        "directions": Counter(),
        "customs_codes": Counter(),
        "operation_codes": Counter(),
        "hs2": Counter(),
        "hs4": Counter(),
        "origins": Counter(),
        "risk_flags": Counter(),
        "value_count": 0,
        "value_sum": 0.0,
        "value_min": None,
        "value_max": None,
    }
    started = time.time()

    with (private_dir / "trade_knowledge_corpus.jsonl").open("w", encoding="utf-8") as corpus_fh, \
        (training_dir / "instruction_tuning.jsonl").open("w", encoding="utf-8") as train_fh, \
        (analytics_dir / "declarations_compact.jsonl").open("w", encoding="utf-8") as compact_fh:
        cargo_fh = (analytics_dir / "cargo_facts.jsonl").open("w", encoding="utf-8") if args.write_cargo_facts else None
        try:
            skipped = 0
            written = 0
            for idx, record in enumerate(iter_records(input_file, args.source_dir, include_all_jsonl=args.include_all_jsonl), 1):
                if not looks_like_declaration(record):
                    skipped += 1
                    continue
                compact = compact_record(record, args.max_cargo)
                write_jsonl(compact_fh, compact)
                write_jsonl(
                    corpus_fh,
                    {
                        "id": compact["declaration_id"] or f"record-{idx}",
                        "text": declaration_text(compact, mask=False),
                        "metadata": {
                            "direction": compact["direction"],
                            "customs_code": compact["customs_code"],
                            "operation_code": compact["operation_code"],
                            "tax_code": compact["tax_code"],
                            "risk_flags": compact["risk_flags"],
                            "source_file": compact["source_file"],
                        },
                    },
                )
                for sample in instruction_samples(compact):
                    sample["metadata"] = {
                        "declaration_id": compact["declaration_id"],
                        "direction": compact["direction"],
                        "customs_code": compact["customs_code"],
                    }
                    write_jsonl(train_fh, sample)

                if cargo_fh:
                    for item in compact.get("cargo_sample") or []:
                        write_jsonl(
                            cargo_fh,
                            {
                                "declaration_id": compact["declaration_id"],
                                "direction": compact["direction"],
                                "customs_code": compact["customs_code"],
                                "operation_code": compact["operation_code"],
                                **item,
                            },
                        )

                update_stats(stats, compact)
                if idx % args.progress_every == 0:
                    elapsed = max(time.time() - started, 1)
                    print(f"processed={idx} rate={idx / elapsed:.1f} records/s")
                if args.max_records and idx >= args.max_records:
                    break
                written += 1
        finally:
            if cargo_fh:
                cargo_fh.close()

    summary = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "elapsed_seconds": round(time.time() - started, 2),
        "input": str(input_file or args.source_dir),
        "max_records": args.max_records or None,
        "skipped_non_declaration_records": skipped,
        "total_declarations": stats["total_declarations"],
        "total_cargo_lines": stats["total_cargo_lines"],
        "avg_declared_value": round(stats["value_sum"] / stats["value_count"], 4) if stats["value_count"] else None,
        "min_declared_value": stats["value_min"],
        "max_declared_value": stats["value_max"],
        "directions": dict(stats["directions"]),
        "top_customs_codes": stats["customs_codes"].most_common(30),
        "top_operation_codes": stats["operation_codes"].most_common(30),
        "top_hs2": stats["hs2"].most_common(30),
        "top_hs4": stats["hs4"].most_common(30),
        "top_origins": stats["origins"].most_common(30),
        "risk_flags": dict(stats["risk_flags"]),
        "outputs": {
            "private_rag": str(private_dir / "trade_knowledge_corpus.jsonl"),
            "training": str(training_dir / "instruction_tuning.jsonl"),
            "analytics": str(analytics_dir / "declarations_compact.jsonl"),
        },
    }
    (reports_dir / "ai_assets_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
