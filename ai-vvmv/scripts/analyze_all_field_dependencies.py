#!/usr/bin/env python3
"""Profile every analytics field and mine high-confidence field dependencies."""

from __future__ import annotations

import argparse
import json
import math
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DECL = ROOT / "llm-dataset" / "ai-assets" / "analytics" / "declarations_compact.jsonl"
DEFAULT_CARGO = ROOT / "llm-dataset" / "ai-assets" / "analytics" / "cargo_facts.jsonl"
DEFAULT_OUT = ROOT / "llm-dataset" / "ai-assets" / "reports"

HIGH_CARDINALITY_FIELDS = {
    "declaration_id",
    "declaration_number",
    "declaration_date",
    "company_name",
    "company_address",
    "transport_name",
    "bill_of_lading",
    "source_file",
    "description",
}
NUMERIC_FIELDS = {
    "total_declared_value",
    "declared_goods_count",
    "cargo_count",
    "cargo_total_value",
    "line",
    "quantity",
    "unit_price",
    "value",
}


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


def norm(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return "|".join(str(item).strip() for item in value if str(item).strip())
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    return str(value).strip()


def to_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def pct(count: int, total: int) -> float:
    return round(count / total * 100, 4) if total else 0.0


def profile_dataset(path: Path, max_distinct: int) -> Dict[str, Any]:
    total = 0
    presence = Counter()
    distinct: Dict[str, set] = defaultdict(set)
    top_values: Dict[str, Counter] = defaultdict(Counter)
    numeric_stats: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"count": 0, "sum": 0.0, "min": None, "max": None})
    fields = set()

    for rec in iter_jsonl(path):
        total += 1
        fields.update(rec.keys())
        for field, value in rec.items():
            value_text = norm(value)
            if value_text == "":
                continue
            presence[field] += 1
            if len(distinct[field]) <= max_distinct:
                distinct[field].add(value_text)
            if field not in HIGH_CARDINALITY_FIELDS:
                top_values[field][value_text] += 1
            number = to_float(value)
            if number is not None:
                stats = numeric_stats[field]
                stats["count"] += 1
                stats["sum"] += number
                stats["min"] = number if stats["min"] is None else min(stats["min"], number)
                stats["max"] = number if stats["max"] is None else max(stats["max"], number)

    profiles = {}
    for field in sorted(fields):
        stats = numeric_stats.get(field, {})
        numeric_count = stats.get("count", 0)
        profiles[field] = {
            "presence": int(presence[field]),
            "presence_pct": pct(presence[field], total),
            "distinct_count": f">{max_distinct}" if len(distinct[field]) > max_distinct else len(distinct[field]),
            "is_numeric_like": bool(numeric_count and numeric_count / max(presence[field], 1) >= 0.95),
            "numeric_min": stats.get("min"),
            "numeric_max": stats.get("max"),
            "numeric_avg": round(stats["sum"] / numeric_count, 6) if numeric_count else None,
            "top_values": top_values[field].most_common(10),
        }
    return {"total": total, "fields": profiles}


def categorical_fields(profile: Dict[str, Any], max_distinct_for_rules: int) -> List[str]:
    out = []
    for field, meta in profile["fields"].items():
        distinct_count = meta["distinct_count"]
        if isinstance(distinct_count, str):
            continue
        if field in NUMERIC_FIELDS or field in HIGH_CARDINALITY_FIELDS:
            continue
        if 1 < distinct_count <= max_distinct_for_rules:
            out.append(field)
    return out


def mine_pair_rules(path: Path, fields: List[str], min_support: int, threshold: float) -> List[Dict[str, Any]]:
    counts: Dict[Tuple[str, str, str], Counter] = defaultdict(Counter)
    for rec in iter_jsonl(path):
        values = {field: norm(rec.get(field)) for field in fields}
        values = {field: value for field, value in values.items() if value}
        for src, src_value in values.items():
            for dst, dst_value in values.items():
                if src == dst:
                    continue
                counts[(src, src_value, dst)][dst_value] += 1

    rules = []
    for (src, src_value, dst), counter in counts.items():
        total = sum(counter.values())
        if total < min_support:
            continue
        value, support = counter.most_common(1)[0]
        confidence = support / total
        if support >= min_support and confidence >= threshold:
            rules.append(
                {
                    "if_field": src,
                    "if_value": src_value,
                    "then_field": dst,
                    "then_value": value,
                    "support": int(support),
                    "total": int(total),
                    "confidence": round(confidence, 4),
                    "alternatives": [[k, int(v)] for k, v in counter.most_common(5)],
                }
            )
    rules.sort(key=lambda r: (r["confidence"], r["support"]), reverse=True)
    return rules


def formula_checks(decl_path: Path, cargo_path: Path) -> Dict[str, Any]:
    cargo_formula_total = 0
    cargo_formula_match = 0
    for rec in iter_jsonl(cargo_path):
        qty = to_float(rec.get("quantity"))
        unit_price = to_float(rec.get("unit_price"))
        value = to_float(rec.get("value"))
        if qty is None or unit_price is None or value is None:
            continue
        cargo_formula_total += 1
        if abs(qty * unit_price - value) <= max(0.1, abs(value) * 0.01):
            cargo_formula_match += 1

    decl_cargo_count_total = 0
    decl_cargo_count_match = 0
    decl_cargo_value_total = 0
    decl_cargo_value_match = 0
    for rec in iter_jsonl(decl_path):
        declared = to_float(rec.get("declared_goods_count"))
        cargo_count = to_float(rec.get("cargo_count"))
        if declared is not None and cargo_count is not None:
            decl_cargo_count_total += 1
            if int(declared) == int(cargo_count):
                decl_cargo_count_match += 1
        total_value = to_float(rec.get("total_declared_value"))
        cargo_value = to_float(rec.get("cargo_total_value"))
        if total_value is not None and cargo_value is not None:
            decl_cargo_value_total += 1
            if abs(total_value - cargo_value) <= max(0.1, abs(total_value) * 0.01):
                decl_cargo_value_match += 1

    return {
        "cargo.value ~= quantity * unit_price": {
            "checked": cargo_formula_total,
            "matched": cargo_formula_match,
            "match_pct": pct(cargo_formula_match, cargo_formula_total),
        },
        "declaration.cargo_count == declared_goods_count": {
            "checked": decl_cargo_count_total,
            "matched": decl_cargo_count_match,
            "match_pct": pct(decl_cargo_count_match, decl_cargo_count_total),
        },
        "declaration.cargo_total_value ~= total_declared_value": {
            "checked": decl_cargo_value_total,
            "matched": decl_cargo_value_match,
            "match_pct": pct(decl_cargo_value_match, decl_cargo_value_total),
        },
    }


def build_markdown(result: Dict[str, Any]) -> str:
    lines = [
        "# Toàn bộ field dependency report",
        "",
        f"- Generated: `{result['generated_at']}`",
        f"- Declaration rows: `{result['declarations']['total']:,}`",
        f"- Cargo rows: `{result['cargo']['total']:,}`",
        "",
        "## Công thức số học",
        "",
        "| Rule | Checked | Matched | Match % |",
        "|---|---:|---:|---:|",
    ]
    for rule, meta in result["formula_checks"].items():
        lines.append(f"| `{rule}` | {meta['checked']:,} | {meta['matched']:,} | {meta['match_pct']:.2f}% |")
    lines.extend(["", "## Top dependency rules", ""])
    for section, title in [("declaration_pair_rules", "Declaration"), ("cargo_pair_rules", "Cargo")]:
        lines.extend([f"### {title}", "", "| If | Then | Support | Confidence |", "|---|---|---:|---:|"])
        for rule in result[section][:50]:
            lhs = f"`{rule['if_field']}={rule['if_value']}`"
            rhs = f"`{rule['then_field']}={rule['then_value']}`"
            lines.append(f"| {lhs} | {rhs} | {rule['support']:,}/{rule['total']:,} | {rule['confidence']:.2%} |")
        lines.append("")
    return "\n".join(lines)


def analyze(args: argparse.Namespace) -> Dict[str, Any]:
    started = time.time()
    decl_profile = profile_dataset(args.declarations, args.max_distinct)
    cargo_profile = profile_dataset(args.cargo, args.max_distinct)
    decl_fields = categorical_fields(decl_profile, args.max_distinct_for_rules)
    cargo_fields = categorical_fields(cargo_profile, args.max_distinct_for_rules)
    return {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "elapsed_seconds": round(time.time() - started, 2),
        "inputs": {"declarations": str(args.declarations), "cargo": str(args.cargo)},
        "rule_params": {
            "min_support": args.min_support,
            "confidence_threshold": args.confidence,
            "max_distinct_for_rules": args.max_distinct_for_rules,
        },
        "declarations": decl_profile,
        "cargo": cargo_profile,
        "categorical_rule_fields": {"declarations": decl_fields, "cargo": cargo_fields},
        "formula_checks": formula_checks(args.declarations, args.cargo),
        "declaration_pair_rules": mine_pair_rules(args.declarations, decl_fields, args.min_support, args.confidence),
        "cargo_pair_rules": mine_pair_rules(args.cargo, cargo_fields, args.min_support, args.confidence),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze all VVMV analytics fields and infer dependencies")
    parser.add_argument("--declarations", type=Path, default=DEFAULT_DECL)
    parser.add_argument("--cargo", type=Path, default=DEFAULT_CARGO)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--min-support", type=int, default=200)
    parser.add_argument("--confidence", type=float, default=0.95)
    parser.add_argument("--max-distinct", type=int, default=10000)
    parser.add_argument("--max-distinct-for-rules", type=int, default=300)
    args = parser.parse_args()

    result = analyze(args)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    json_path = args.output_dir / "all_field_dependencies.json"
    md_path = args.output_dir / "all_field_dependencies.md"
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(build_markdown(result), encoding="utf-8")
    print(json.dumps({"json": str(json_path), "markdown": str(md_path), "elapsed_seconds": result["elapsed_seconds"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
