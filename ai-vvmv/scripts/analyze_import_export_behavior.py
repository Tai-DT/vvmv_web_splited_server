#!/usr/bin/env python3
"""Analyze import/export behavior across all VVMV analytics data."""

from __future__ import annotations

import argparse
import json
import math
import statistics
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DECL = ROOT / "llm-dataset" / "ai-assets" / "analytics" / "declarations_compact.jsonl"
DEFAULT_CARGO = ROOT / "llm-dataset" / "ai-assets" / "analytics" / "cargo_facts.jsonl"
DEFAULT_OUT = ROOT / "llm-dataset" / "ai-assets" / "reports"


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


def top(counter: Counter, n: int = 20) -> List[List[Any]]:
    return [[str(k), int(v)] for k, v in counter.most_common(n) if str(k)]


def add_value(stats: Dict[str, Any], value: Any) -> None:
    number = to_float(value)
    if number is None:
        return
    stats["value_count"] += 1
    stats["value_sum"] += number
    stats["values_sample"].append(number)
    stats["value_min"] = number if stats["value_min"] is None else min(stats["value_min"], number)
    stats["value_max"] = number if stats["value_max"] is None else max(stats["value_max"], number)


def init_direction_stats() -> Dict[str, Any]:
    return {
        "declarations": 0,
        "value_count": 0,
        "value_sum": 0.0,
        "value_min": None,
        "value_max": None,
        "values_sample": [],
        "cargo_count_sum": 0,
        "cargo_count_known": 0,
        "companies": Counter(),
        "tax_codes": Counter(),
        "operation_codes": Counter(),
        "customs_codes": Counter(),
        "customs_names": Counter(),
        "delivery_terms": Counter(),
        "currencies": Counter(),
        "export_countries": Counter(),
        "import_countries": Counter(),
        "country_pairs": Counter(),
        "ports": Counter(),
        "risk_flags": Counter(),
        "operation_to_currency": defaultdict(Counter),
        "operation_to_delivery": defaultdict(Counter),
        "operation_to_customs": defaultdict(Counter),
        "operation_to_country_pair": defaultdict(Counter),
        "customs_to_ports": defaultdict(Counter),
        "currency_value_sum": Counter(),
        "operation_value_sum": Counter(),
    }


def init_cargo_stats() -> Dict[str, Any]:
    return {
        "lines": 0,
        "value_count": 0,
        "value_sum": 0.0,
        "hs2": Counter(),
        "hs4": Counter(),
        "hs6": Counter(),
        "hs8": Counter(),
        "origin": Counter(),
        "unit": Counter(),
        "tax_code": Counter(),
        "operation_to_hs2": defaultdict(Counter),
        "operation_to_origin": defaultdict(Counter),
        "operation_to_unit": defaultdict(Counter),
        "hs4_to_unit": defaultdict(Counter),
        "hs6_to_tax_code": defaultdict(Counter),
        "hs4_value_sum": Counter(),
        "formula_checked": 0,
        "formula_match": 0,
    }


def serialize_nested(counter_map: Dict[str, Counter], outer_n: int = 12, inner_n: int = 8) -> Dict[str, List[List[Any]]]:
    totals = Counter({key: sum(counter.values()) for key, counter in counter_map.items()})
    return {key: top(counter_map[key], inner_n) for key, _ in totals.most_common(outer_n)}


def serialize_direction(stats: Dict[str, Any]) -> Dict[str, Any]:
    values = stats["values_sample"]
    avg_value = stats["value_sum"] / stats["value_count"] if stats["value_count"] else None
    avg_cargo_count = stats["cargo_count_sum"] / stats["cargo_count_known"] if stats["cargo_count_known"] else None
    return {
        "declarations": stats["declarations"],
        "avg_declared_value": round(avg_value, 4) if avg_value is not None else None,
        "median_declared_value": round(statistics.median(values), 4) if values else None,
        "min_declared_value": stats["value_min"],
        "max_declared_value": stats["value_max"],
        "avg_cargo_lines_per_declaration": round(avg_cargo_count, 4) if avg_cargo_count is not None else None,
        "top_companies": top(stats["companies"], 15),
        "top_tax_codes": top(stats["tax_codes"], 15),
        "top_operation_codes": top(stats["operation_codes"], 20),
        "top_customs_codes": top(stats["customs_codes"], 20),
        "top_delivery_terms": top(stats["delivery_terms"], 20),
        "top_currencies": top(stats["currencies"], 20),
        "top_export_countries": top(stats["export_countries"], 20),
        "top_import_countries": top(stats["import_countries"], 20),
        "top_country_pairs": top(stats["country_pairs"], 20),
        "top_ports": top(stats["ports"], 20),
        "top_risk_flags": top(stats["risk_flags"], 20),
        "operation_to_currency": serialize_nested(stats["operation_to_currency"]),
        "operation_to_delivery": serialize_nested(stats["operation_to_delivery"]),
        "operation_to_customs": serialize_nested(stats["operation_to_customs"]),
        "operation_to_country_pair": serialize_nested(stats["operation_to_country_pair"]),
        "customs_to_ports": serialize_nested(stats["customs_to_ports"]),
        "top_currency_by_value": top(stats["currency_value_sum"], 10),
        "top_operation_by_value": top(stats["operation_value_sum"], 15),
    }


def serialize_cargo(stats: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "lines": stats["lines"],
        "total_value": round(stats["value_sum"], 4),
        "top_hs2": top(stats["hs2"], 20),
        "top_hs4": top(stats["hs4"], 20),
        "top_hs6": top(stats["hs6"], 20),
        "top_hs8": top(stats["hs8"], 20),
        "top_origin": top(stats["origin"], 20),
        "top_unit": top(stats["unit"], 20),
        "top_tax_code": top(stats["tax_code"], 20),
        "operation_to_hs2": serialize_nested(stats["operation_to_hs2"]),
        "operation_to_origin": serialize_nested(stats["operation_to_origin"]),
        "operation_to_unit": serialize_nested(stats["operation_to_unit"]),
        "hs4_to_unit": serialize_nested(stats["hs4_to_unit"], 20, 5),
        "hs6_to_tax_code": serialize_nested(stats["hs6_to_tax_code"], 20, 5),
        "top_hs4_by_value": top(stats["hs4_value_sum"], 20),
        "line_value_formula_match_pct": pct(stats["formula_match"], stats["formula_checked"]),
        "line_value_formula_checked": stats["formula_checked"],
    }


def analyze(decl_path: Path, cargo_path: Path) -> Dict[str, Any]:
    started = time.time()
    by_direction = defaultdict(init_direction_stats)
    cargo_by_direction = defaultdict(init_cargo_stats)
    overall_direction = Counter()

    for rec in iter_jsonl(decl_path):
        direction = text(rec.get("direction")) or "blank"
        stats = by_direction[direction]
        overall_direction[direction] += 1
        stats["declarations"] += 1
        add_value(stats, rec.get("total_declared_value"))
        cargo_count = to_float(rec.get("cargo_count"))
        if cargo_count is not None:
            stats["cargo_count_sum"] += cargo_count
            stats["cargo_count_known"] += 1

        company = text(rec.get("company_name")) or "(blank)"
        tax_code = text(rec.get("tax_code")) or "(blank)"
        operation = text(rec.get("operation_code")) or "(blank)"
        customs = text(rec.get("customs_code")) or "(blank)"
        customs_name = text(rec.get("customs_name")) or "(blank)"
        delivery = text(rec.get("delivery_term")) or "(blank)"
        currency = text(rec.get("currency")) or "(blank)"
        export_country = text(rec.get("export_country")) or "(blank)"
        import_country = text(rec.get("import_country")) or "(blank)"
        pair = f"{export_country}->{import_country}"
        port = text(rec.get("port_code") or rec.get("port_name")) or "(blank)"
        value = to_float(rec.get("total_declared_value")) or 0.0

        stats["companies"][company] += 1
        stats["tax_codes"][tax_code] += 1
        stats["operation_codes"][operation] += 1
        stats["customs_codes"][customs] += 1
        stats["customs_names"][customs_name] += 1
        stats["delivery_terms"][delivery] += 1
        stats["currencies"][currency] += 1
        stats["export_countries"][export_country] += 1
        stats["import_countries"][import_country] += 1
        stats["country_pairs"][pair] += 1
        stats["ports"][port] += 1
        stats["operation_to_currency"][operation][currency] += 1
        stats["operation_to_delivery"][operation][delivery] += 1
        stats["operation_to_customs"][operation][customs] += 1
        stats["operation_to_country_pair"][operation][pair] += 1
        stats["customs_to_ports"][customs][port] += 1
        stats["currency_value_sum"][currency] += value
        stats["operation_value_sum"][operation] += value
        for risk in rec.get("risk_flags") or []:
            risk_text = text(risk)
            if risk_text:
                stats["risk_flags"][risk_text] += 1

    for rec in iter_jsonl(cargo_path):
        direction = text(rec.get("direction")) or "blank"
        stats = cargo_by_direction[direction]
        stats["lines"] += 1
        value = to_float(rec.get("value"))
        if value is not None:
            stats["value_count"] += 1
            stats["value_sum"] += value
        operation = text(rec.get("operation_code")) or "(blank)"
        hs = text(rec.get("hs_code"))
        hs2 = hs[:2] if len(hs) >= 2 else "(blank)"
        hs4 = hs[:4] if len(hs) >= 4 else "(blank)"
        hs6 = hs[:6] if len(hs) >= 6 else "(blank)"
        hs8 = hs[:8] if len(hs) >= 8 else "(blank)"
        origin = text(rec.get("origin")) or "(blank)"
        unit = text(rec.get("unit")) or "(blank)"
        tax_code = text(rec.get("tax_code")) or "(blank)"
        stats["hs2"][hs2] += 1
        stats["hs4"][hs4] += 1
        stats["hs6"][hs6] += 1
        stats["hs8"][hs8] += 1
        stats["origin"][origin] += 1
        stats["unit"][unit] += 1
        stats["tax_code"][tax_code] += 1
        stats["operation_to_hs2"][operation][hs2] += 1
        stats["operation_to_origin"][operation][origin] += 1
        stats["operation_to_unit"][operation][unit] += 1
        stats["hs4_to_unit"][hs4][unit] += 1
        stats["hs6_to_tax_code"][hs6][tax_code] += 1
        stats["hs4_value_sum"][hs4] += value or 0.0
        qty = to_float(rec.get("quantity"))
        unit_price = to_float(rec.get("unit_price"))
        if qty is not None and unit_price is not None and value is not None:
            stats["formula_checked"] += 1
            if abs(qty * unit_price - value) <= max(0.1, abs(value) * 0.01):
                stats["formula_match"] += 1

    return {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "elapsed_seconds": round(time.time() - started, 2),
        "inputs": {"declarations": str(decl_path), "cargo": str(cargo_path)},
        "direction_counts": dict(overall_direction),
        "import_behavior": {
            "declaration": serialize_direction(by_direction["N"]),
            "cargo": serialize_cargo(cargo_by_direction["N"]),
        },
        "export_behavior": {
            "declaration": serialize_direction(by_direction["X"]),
            "cargo": serialize_cargo(cargo_by_direction["X"]),
        },
        "blank_or_unknown": {
            "declaration": serialize_direction(by_direction["blank"]),
            "cargo": serialize_cargo(cargo_by_direction["blank"]),
        },
    }


def table(rows: List[List[Any]], headers: List[str]) -> str:
    lines = ["| " + " | ".join(headers) + " |", "|" + "|".join("---" for _ in headers) + "|"]
    for row in rows:
        lines.append("| " + " | ".join(str(item) for item in row) + " |")
    return "\n".join(lines)


def top_pct(rows: List[List[Any]], total: int, n: int = 10) -> List[List[Any]]:
    return [[value, count, f"{pct(count, total):.2f}%"] for value, count in rows[:n]]


def build_markdown(result: Dict[str, Any]) -> str:
    lines = [
        "# Hành vi nhập khẩu và xuất khẩu VVMV",
        "",
        f"- Generated: `{result['generated_at']}`",
        f"- Direction counts: `{result['direction_counts']}`",
        "",
    ]
    for key, title in [("import_behavior", "Nhập khẩu"), ("export_behavior", "Xuất khẩu")]:
        decl = result[key]["declaration"]
        cargo = result[key]["cargo"]
        lines.extend(
            [
                f"## {title}",
                "",
                f"- Tờ khai: `{decl['declarations']:,}`",
                f"- Dòng hàng: `{cargo['lines']:,}`",
                f"- Trị giá trung bình/tờ khai: `{decl['avg_declared_value']}`",
                f"- Trị giá median/tờ khai: `{decl['median_declared_value']}`",
                f"- Số dòng hàng trung bình/tờ khai: `{decl['avg_cargo_lines_per_declaration']}`",
                f"- Formula dòng hàng match: `{cargo['line_value_formula_match_pct']:.2f}%`",
                "",
                "### Loại hình",
                table(top_pct(decl["top_operation_codes"], decl["declarations"]), ["operation_code", "count", "%"]),
                "",
                "### Chi cục hải quan",
                table(top_pct(decl["top_customs_codes"], decl["declarations"]), ["customs_code", "count", "%"]),
                "",
                "### Điều kiện giao hàng và tiền tệ",
                table(top_pct(decl["top_delivery_terms"], decl["declarations"]), ["delivery_term", "count", "%"]),
                "",
                table(top_pct(decl["top_currencies"], decl["declarations"]), ["currency", "count", "%"]),
                "",
                "### Quốc gia / luồng",
                table(top_pct(decl["top_country_pairs"], decl["declarations"]), ["country_pair", "count", "%"]),
                "",
                "### Hàng hóa",
                table(top_pct(cargo["top_hs2"], cargo["lines"]), ["hs2", "lines", "%"]),
                "",
                table(top_pct(cargo["top_origin"], cargo["lines"]), ["origin", "lines", "%"]),
                "",
                table(top_pct(cargo["top_unit"], cargo["lines"]), ["unit", "lines", "%"]),
                "",
                table(top_pct(cargo["top_tax_code"], cargo["lines"]), ["tax_code", "lines", "%"]),
                "",
            ]
        )
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze import/export behavior")
    parser.add_argument("--declarations", type=Path, default=DEFAULT_DECL)
    parser.add_argument("--cargo", type=Path, default=DEFAULT_CARGO)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    result = analyze(args.declarations, args.cargo)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    json_path = args.output_dir / "import_export_behavior.json"
    md_path = args.output_dir / "import_export_behavior.md"
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(build_markdown(result), encoding="utf-8")
    print(json.dumps({"json": str(json_path), "markdown": str(md_path), "elapsed_seconds": result["elapsed_seconds"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
