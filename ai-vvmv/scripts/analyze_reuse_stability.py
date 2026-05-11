#!/usr/bin/env python3
"""Analyze fields that are repeatedly reused and stable by company/context."""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DECL = ROOT / "llm-dataset" / "ai-assets" / "analytics" / "declarations_compact.jsonl"
DEFAULT_CARGO = ROOT / "llm-dataset" / "ai-assets" / "analytics" / "cargo_facts.jsonl"
DEFAULT_OUT = ROOT / "llm-dataset" / "ai-assets" / "reports"

DECL_REUSE_FIELDS = [
    "company_name",
    "company_address",
    "customs_code",
    "operation_code",
    "export_country",
    "import_country",
    "delivery_term",
    "currency",
    "port_code",
]
CARGO_REUSE_FIELDS = ["origin", "unit", "tax_code", "hs_code"]


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


def text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def top(counter: Counter, n: int = 10) -> List[List[Any]]:
    return [[str(k), int(v)] for k, v in counter.most_common(n) if str(k)]


def dominance(counter: Counter) -> Tuple[str, int, int, float]:
    total = sum(counter.values())
    if not total:
        return "", 0, 0, 0.0
    value, count = counter.most_common(1)[0]
    return str(value), int(count), int(total), round(count / total, 4)


def init_group(fields: List[str]) -> Dict[str, Any]:
    return {"total": 0, "fields": {field: Counter() for field in fields}}


def add_group(group: Dict[str, Any], rec: Dict[str, Any], fields: List[str]) -> None:
    group["total"] += 1
    for field in fields:
        value = text(rec.get(field))
        if value:
            group["fields"][field][value] += 1


def serialize_groups(groups: Dict[str, Dict[str, Any]], min_support: int, threshold: float, limit: int) -> List[Dict[str, Any]]:
    rows = []
    for key, group in groups.items():
        if group["total"] < min_support:
            continue
        stable_fields = []
        for field, counter in group["fields"].items():
            value, count, total, conf = dominance(counter)
            if count >= min_support and conf >= threshold:
                stable_fields.append(
                    {
                        "field": field,
                        "value": value,
                        "support": count,
                        "total_present": total,
                        "group_total": group["total"],
                        "reuse_rate": conf,
                        "top_values": top(counter, 5),
                    }
                )
        if stable_fields:
            stable_fields.sort(key=lambda item: (item["reuse_rate"], item["support"]), reverse=True)
            rows.append({"group": key, "total": group["total"], "stable_fields": stable_fields})
    rows.sort(key=lambda item: item["total"], reverse=True)
    return rows[:limit]


def analyze(decl_path: Path, cargo_path: Path, min_support: int, threshold: float, limit: int) -> Dict[str, Any]:
    company_groups = defaultdict(lambda: init_group(DECL_REUSE_FIELDS))
    company_operation_groups = defaultdict(lambda: init_group(DECL_REUSE_FIELDS))
    direction_operation_groups = defaultdict(lambda: init_group(DECL_REUSE_FIELDS))
    cargo_company_hs4 = defaultdict(lambda: init_group(CARGO_REUSE_FIELDS))
    cargo_operation_hs4 = defaultdict(lambda: init_group(CARGO_REUSE_FIELDS))

    decl_company_by_id: Dict[str, str] = {}
    decl_tax_by_id: Dict[str, str] = {}
    for rec in iter_jsonl(decl_path):
        declaration_id = text(rec.get("declaration_id"))
        tax_code = text(rec.get("tax_code")) or "(blank)"
        company = text(rec.get("company_name")) or "(blank)"
        operation = text(rec.get("operation_code")) or "(blank)"
        direction = text(rec.get("direction")) or "(blank)"
        if declaration_id:
            decl_company_by_id[declaration_id] = tax_code or company
            decl_tax_by_id[declaration_id] = tax_code
        add_group(company_groups[f"tax_code:{tax_code}"], rec, DECL_REUSE_FIELDS)
        add_group(company_operation_groups[f"tax_code:{tax_code}|operation:{operation}"], rec, DECL_REUSE_FIELDS)
        add_group(direction_operation_groups[f"direction:{direction}|operation:{operation}"], rec, DECL_REUSE_FIELDS)

    for rec in iter_jsonl(cargo_path):
        declaration_id = text(rec.get("declaration_id"))
        company_key = decl_company_by_id.get(declaration_id, "(unknown)")
        operation = text(rec.get("operation_code")) or "(blank)"
        hs = text(rec.get("hs_code"))
        hs4 = hs[:4] if len(hs) >= 4 else "(blank)"
        add_group(cargo_company_hs4[f"tax_code:{company_key}|hs4:{hs4}"], rec, CARGO_REUSE_FIELDS)
        add_group(cargo_operation_hs4[f"operation:{operation}|hs4:{hs4}"], rec, CARGO_REUSE_FIELDS)

    return {
        "params": {"min_support": min_support, "reuse_threshold": threshold},
        "declaration_reuse": {
            "by_company": serialize_groups(company_groups, min_support, threshold, limit),
            "by_company_operation": serialize_groups(company_operation_groups, min_support, threshold, limit),
            "by_direction_operation": serialize_groups(direction_operation_groups, min_support, threshold, limit),
        },
        "cargo_reuse": {
            "by_company_hs4": serialize_groups(cargo_company_hs4, min_support, threshold, limit),
            "by_operation_hs4": serialize_groups(cargo_operation_hs4, min_support, threshold, limit),
        },
    }


def build_markdown(result: Dict[str, Any]) -> str:
    lines = [
        "# Reuse/Stability Report",
        "",
        f"- Min support: `{result['params']['min_support']}`",
        f"- Reuse threshold: `{result['params']['reuse_threshold']}`",
        "",
    ]
    sections = [
        ("declaration_reuse", "by_company", "Declaration by company"),
        ("declaration_reuse", "by_company_operation", "Declaration by company + operation"),
        ("declaration_reuse", "by_direction_operation", "Declaration by direction + operation"),
        ("cargo_reuse", "by_company_hs4", "Cargo by company + HS4"),
        ("cargo_reuse", "by_operation_hs4", "Cargo by operation + HS4"),
    ]
    for root, key, title in sections:
        lines.extend([f"## {title}", "", "| Group | Total | Stable fields |", "|---|---:|---|"])
        for row in result[root][key][:50]:
            fields = "<br/>".join(
                f"`{item['field']}={item['value']}` {item['reuse_rate']:.2%} ({item['support']:,}/{item['total_present']:,})"
                for item in row["stable_fields"][:8]
            )
            lines.append(f"| `{row['group']}` | {row['total']:,} | {fields} |")
        lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze stable/reused fields")
    parser.add_argument("--declarations", type=Path, default=DEFAULT_DECL)
    parser.add_argument("--cargo", type=Path, default=DEFAULT_CARGO)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--min-support", type=int, default=50)
    parser.add_argument("--threshold", type=float, default=0.9)
    parser.add_argument("--limit", type=int, default=200)
    args = parser.parse_args()
    result = analyze(args.declarations, args.cargo, args.min_support, args.threshold, args.limit)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    json_path = args.output_dir / "reuse_stability_report.json"
    md_path = args.output_dir / "reuse_stability_report.md"
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(build_markdown(result), encoding="utf-8")
    print(json.dumps({"json": str(json_path), "markdown": str(md_path)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
