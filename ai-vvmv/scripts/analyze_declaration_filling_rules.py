#!/usr/bin/env python3
"""Infer autofill rules for customs declarations from VVMV analytics data."""

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


DECL_FIELDS = [
    "tax_code",
    "customs_code",
    "operation_code",
    "company_name",
    "company_address",
    "export_country",
    "import_country",
    "delivery_term",
    "currency",
    "total_declared_value",
    "bill_of_lading",
    "port_code",
    "declared_goods_count",
    "cargo_count",
]

CARGO_FIELDS = [
    "hs_code",
    "description",
    "origin",
    "unit",
    "quantity",
    "unit_price",
    "value",
    "tax_code",
]


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


def present(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (int, float)):
        return math.isfinite(float(value))
    return True


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


def top(counter: Counter, n: int = 5) -> List[Tuple[str, int]]:
    return [(str(k), int(v)) for k, v in counter.most_common(n) if str(k)]


def init_decl_group() -> Dict[str, Any]:
    return {
        "total": 0,
        "presence": Counter(),
        "customs_code": Counter(),
        "delivery_term": Counter(),
        "currency": Counter(),
        "export_country": Counter(),
        "import_country": Counter(),
        "country_pair": Counter(),
        "port_code": Counter(),
        "risk_flags": Counter(),
        "declared_goods_count_present": 0,
        "cargo_count_present": 0,
    }


def init_cargo_group() -> Dict[str, Any]:
    return {
        "total": 0,
        "presence": Counter(),
        "hs2": Counter(),
        "hs4": Counter(),
        "hs8": Counter(),
        "origin": Counter(),
        "unit": Counter(),
        "tax_code": Counter(),
        "formula_checked": 0,
        "formula_match": 0,
        "quantity_positive": 0,
        "value_non_negative": 0,
    }


def group_keys(direction: str, operation: str) -> List[str]:
    return [f"direction:{direction or 'blank'}", f"direction:{direction or 'blank'}|operation:{operation or 'blank'}"]


def analyze(decl_path: Path, cargo_path: Path, min_support: int, strong_threshold: float) -> Dict[str, Any]:
    started = time.time()
    decl_groups = defaultdict(init_decl_group)
    cargo_groups = defaultdict(init_cargo_group)
    direction_totals = Counter()
    operation_totals = Counter()

    for rec in iter_jsonl(decl_path):
        direction = text(rec.get("direction"))
        operation = text(rec.get("operation_code"))
        direction_totals[direction] += 1
        operation_totals[(direction, operation)] += 1
        for key in group_keys(direction, operation):
            group = decl_groups[key]
            group["total"] += 1
            for field in DECL_FIELDS:
                if present(rec.get(field)):
                    group["presence"][field] += 1
            customs = text(rec.get("customs_code")) or "(blank)"
            term = text(rec.get("delivery_term")) or "(blank)"
            currency = text(rec.get("currency")) or "(blank)"
            export_country = text(rec.get("export_country")) or "(blank)"
            import_country = text(rec.get("import_country")) or "(blank)"
            pair = f"{export_country}->{import_country}"
            port = text(rec.get("port_code")) or "(blank)"
            group["customs_code"][customs] += 1
            group["delivery_term"][term] += 1
            group["currency"][currency] += 1
            group["export_country"][export_country] += 1
            group["import_country"][import_country] += 1
            group["country_pair"][pair] += 1
            group["port_code"][port] += 1
            for risk in rec.get("risk_flags") or []:
                group["risk_flags"][text(risk)] += 1

    for rec in iter_jsonl(cargo_path):
        direction = text(rec.get("direction"))
        operation = text(rec.get("operation_code"))
        for key in group_keys(direction, operation):
            group = cargo_groups[key]
            group["total"] += 1
            for field in CARGO_FIELDS:
                if present(rec.get(field)):
                    group["presence"][field] += 1
            hs = text(rec.get("hs_code"))
            if hs:
                group["hs2"][hs[:2]] += 1
                group["hs4"][hs[:4]] += 1
                group["hs8"][hs[:8]] += 1
            group["origin"][text(rec.get("origin")) or "(blank)"] += 1
            group["unit"][text(rec.get("unit")) or "(blank)"] += 1
            group["tax_code"][text(rec.get("tax_code")) or "(blank)"] += 1
            qty = to_float(rec.get("quantity"))
            unit_price = to_float(rec.get("unit_price"))
            value = to_float(rec.get("value"))
            if qty is not None and qty > 0:
                group["quantity_positive"] += 1
            if value is not None and value >= 0:
                group["value_non_negative"] += 1
            if qty is not None and unit_price is not None and value is not None:
                group["formula_checked"] += 1
                expected = qty * unit_price
                if abs(expected - value) <= max(0.1, abs(value) * 0.01):
                    group["formula_match"] += 1

    rules = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "elapsed_seconds": round(time.time() - started, 2),
        "inputs": {"declarations": str(decl_path), "cargo": str(cargo_path)},
        "direction_totals": dict(direction_totals),
        "declaration_groups": {},
        "cargo_groups": {},
        "strong_autofill_rules": [],
        "operation_profiles": {},
    }

    for key, group in decl_groups.items():
        serialized = serialize_decl_group(group)
        rules["declaration_groups"][key] = serialized
        for field in ["customs_code", "delivery_term", "currency", "export_country", "import_country", "country_pair", "port_code"]:
            add_strong_rule(rules["strong_autofill_rules"], key, field, group[field], group["total"], min_support, strong_threshold)

    for key, group in cargo_groups.items():
        rules["cargo_groups"][key] = serialize_cargo_group(group)
        for field in ["unit", "origin", "tax_code", "hs2", "hs4"]:
            add_strong_rule(rules["strong_autofill_rules"], key, f"cargo.{field}", group[field], group["total"], min_support, strong_threshold)

    for (direction, operation), count in operation_totals.most_common(60):
        key = f"direction:{direction or 'blank'}|operation:{operation or 'blank'}"
        if count < min_support:
            continue
        rules["operation_profiles"][key] = {
            "direction": direction,
            "operation_code": operation,
            "declarations": count,
            "declaration": rules["declaration_groups"].get(key, {}),
            "cargo": rules["cargo_groups"].get(key, {}),
        }
    return rules


def add_strong_rule(out: List[Dict[str, Any]], scope: str, field: str, counter: Counter, total: int, min_support: int, threshold: float) -> None:
    if total < min_support or not counter:
        return
    value, count = counter.most_common(1)[0]
    confidence = count / total if total else 0.0
    if count >= min_support and confidence >= threshold:
        out.append(
            {
                "scope": scope,
                "field": field,
                "suggested_value": str(value),
                "support": int(count),
                "total": int(total),
                "confidence": round(confidence, 4),
            }
        )


def presence_table(group: Dict[str, Any], fields: List[str]) -> List[Dict[str, Any]]:
    total = group["total"]
    return [
        {
            "field": field,
            "present": int(group["presence"].get(field, 0)),
            "presence_pct": pct(group["presence"].get(field, 0), total),
            "required_level": required_level(group["presence"].get(field, 0), total),
        }
        for field in fields
    ]


def required_level(count: int, total: int) -> str:
    ratio = count / total if total else 0
    if ratio >= 0.99:
        return "required"
    if ratio >= 0.95:
        return "near_required"
    if ratio >= 0.8:
        return "usually_required"
    if ratio >= 0.5:
        return "conditional"
    return "optional_or_sparse"


def serialize_decl_group(group: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "total": group["total"],
        "field_presence": presence_table(group, DECL_FIELDS),
        "top_customs_code": top(group["customs_code"], 10),
        "top_delivery_term": top(group["delivery_term"], 10),
        "top_currency": top(group["currency"], 10),
        "top_export_country": top(group["export_country"], 10),
        "top_import_country": top(group["import_country"], 10),
        "top_country_pair": top(group["country_pair"], 10),
        "top_port_code": top(group["port_code"], 10),
        "top_risk_flags": top(group["risk_flags"], 10),
    }


def serialize_cargo_group(group: Dict[str, Any]) -> Dict[str, Any]:
    total = group["total"]
    return {
        "total": total,
        "field_presence": presence_table(group, CARGO_FIELDS),
        "top_hs2": top(group["hs2"], 10),
        "top_hs4": top(group["hs4"], 10),
        "top_hs8": top(group["hs8"], 10),
        "top_origin": top(group["origin"], 10),
        "top_unit": top(group["unit"], 10),
        "top_tax_code": top(group["tax_code"], 10),
        "quantity_positive_pct": pct(group["quantity_positive"], total),
        "value_non_negative_pct": pct(group["value_non_negative"], total),
        "line_value_formula_match_pct": pct(group["formula_match"], group["formula_checked"]),
        "line_value_formula_checked": group["formula_checked"],
    }


def md_table(rows: List[List[Any]], headers: List[str]) -> str:
    lines = ["| " + " | ".join(headers) + " |", "|" + "|".join("---" for _ in headers) + "|"]
    for row in rows:
        lines.append("| " + " | ".join(str(item) for item in row) + " |")
    return "\n".join(lines)


def top_str(rows: List[Tuple[str, int]], total: int, n: int = 3) -> str:
    parts = []
    for value, count in rows[:n]:
        parts.append(f"`{value}` {count:,} ({pct(count, total):.1f}%)")
    return ", ".join(parts)


def group_required_fields(group: Dict[str, Any]) -> str:
    fields = [r["field"] for r in group.get("field_presence", []) if r["required_level"] in {"required", "near_required"}]
    return ", ".join(f"`{field}`" for field in fields) or "-"


def build_report(rules: Dict[str, Any]) -> str:
    lines = [
        "# Quy luật điền tờ khai từ dữ liệu VVMV",
        "",
        f"- Generated: `{rules['generated_at']}`",
        f"- Declarations input: `{rules['inputs']['declarations']}`",
        f"- Cargo input: `{rules['inputs']['cargo']}`",
        "",
        "## 1. Luồng điền tờ khai đề xuất",
        "",
        "```mermaid",
        "flowchart TD",
        '  START["Bắt đầu"] --> DIRECTION["1. Chọn direction<br/>N=Nhập, X=Xuất"]',
        '  DIRECTION --> OP["2. Chọn loại hình<br/>operation_code / MA_LH"]',
        '  OP --> PARTY["3. Điền doanh nghiệp<br/>MST, tên, địa chỉ"]',
        '  OP --> ROUTE["4. Điền luồng quốc gia<br/>NUOC_XK -> NUOC_NK"]',
        '  OP --> HQ["5. Gợi ý chi cục HQ<br/>MA_HQ theo loại hình"]',
        '  OP --> TRADE["6. Gợi ý Incoterm + tiền tệ<br/>MA_GH, MA_NT"]',
        '  TRADE --> DOCS["7. Điền vận đơn/cảng/phương tiện"]',
        '  ROUTE --> CARGO["8. Điền hàng hóa"]',
        '  CARGO --> HS["9. Gợi ý HS từ mô tả/xuất xứ/đơn vị"]',
        '  HS --> TAX["10. Gợi ý mã thuế/ưu đãi"]',
        '  CARGO --> VALUE["11. Tính LUONG x DGIA_KB = TRIGIA_KB"]',
        '  VALUE --> CHECK["12. Đối chiếu SOHANG/TONGTGKB/risk"]',
        '  CHECK --> SUBMIT["13. Human review rồi khai chính thức"]',
        "```",
        "",
        "## 2. Trường bắt buộc/điền thường xuyên theo nhập và xuất",
        "",
    ]
    for direction in ("N", "X"):
        key = f"direction:{direction}"
        group = rules["declaration_groups"][key]
        cargo = rules["cargo_groups"].get(key, {})
        title = "Nhập khẩu" if direction == "N" else "Xuất khẩu"
        lines.extend(
            [
                f"### {title} (`direction={direction}`)",
                "",
                f"- Số tờ khai: `{group['total']:,}`",
                f"- Trường tờ khai gần như bắt buộc: {group_required_fields(group)}",
                f"- Trường cargo gần như bắt buộc: {group_required_fields(cargo)}",
                "",
                md_table(
                    [
                        [r["field"], f"{r['presence_pct']:.2f}%", r["required_level"]]
                        for r in group["field_presence"]
                    ],
                    ["Field", "Presence", "Mức độ"],
                ),
                "",
            ]
        )

    lines.extend(
        [
            "## 3. Quy luật option theo loại hình",
            "",
            "Các bảng dưới đây cho AI autofill: sau khi người dùng chọn `direction` + `operation_code`, hệ thống gợi ý top option có xác suất cao nhất.",
            "",
        ]
    )
    for direction in ("N", "X"):
        title = "Nhập khẩu" if direction == "N" else "Xuất khẩu"
        lines.append(f"### {title}")
        rows = []
        profiles = [
            p
            for k, p in rules["operation_profiles"].items()
            if p["direction"] == direction
        ]
        profiles.sort(key=lambda p: p["declarations"], reverse=True)
        for profile in profiles[:12]:
            decl = profile["declaration"]
            cargo = profile.get("cargo", {})
            total = decl.get("total", 0)
            cargo_total = cargo.get("total", 0)
            rows.append(
                [
                    f"`{profile['operation_code']}`",
                    f"{profile['declarations']:,}",
                    top_str(decl.get("top_customs_code", []), total),
                    top_str(decl.get("top_country_pair", []), total),
                    top_str(decl.get("top_delivery_term", []), total),
                    top_str(decl.get("top_currency", []), total),
                    top_str(cargo.get("top_hs2", []), cargo_total),
                ]
            )
        lines.append(md_table(rows, ["Loại hình", "Tờ khai", "HQ gợi ý", "Luồng quốc gia", "Incoterm", "Tiền tệ", "HS chương"]))
        lines.append("")

    lines.extend(
        [
            "## 4. Strong autofill rules",
            "",
            "Rule mạnh = option top có confidence cao và support đủ lớn. Có thể dùng làm default tự động, nhưng vẫn cần hiển thị confidence cho người dùng.",
            "",
        ]
    )
    strong = sorted(rules["strong_autofill_rules"], key=lambda r: (r["scope"], -r["confidence"], -r["support"]))
    rows = [
        [
            f"`{r['scope']}`",
            f"`{r['field']}`",
            f"`{r['suggested_value']}`",
            f"{r['support']:,}/{r['total']:,}",
            f"{r['confidence']*100:.2f}%",
        ]
        for r in strong[:80]
    ]
    lines.append(md_table(rows, ["Scope", "Field", "Giá trị gợi ý", "Support", "Confidence"]))

    lines.extend(
        [
            "",
            "## 5. Validation rules nên cài vào AI autofill",
            "",
            "| Rule | Điều kiện | Hành động |",
            "|---|---|---|",
            "| Direction-country | `N` thường `import_country=VN`, `X` thường `export_country=VN` | Nếu lệch, hỏi lại người dùng hoặc flag ngoại lệ |",
            "| Required fields | Field presence >= 95% trong cùng direction/operation | Bắt buộc điền trước khi submit |",
            "| Option confidence | Top option confidence >= threshold | Autofill kèm nhãn confidence |",
            "| Cargo HS | `hs_code` phải 6-10 chữ số | Nếu thiếu/sai, yêu cầu mô tả hàng hoặc gợi ý từ lịch sử |",
            "| Cargo value | `quantity * unit_price ≈ value` | Tự tính hoặc cảnh báo lệch |",
            "| Total value | `sum(TRIGIA_KB) ≈ TONGTGKB` | Cảnh báo nếu lệch vượt threshold |",
            "| Goods count | `SOHANG ≈ cargo_count` | Cảnh báo mismatch, phân biệt dữ liệu compact vs dữ liệu gốc |",
            "| OCR confidence | OCR < 70 | Bắt buộc human review trước khi autofill |",
            "",
            "## 6. Gợi ý triển khai AI autofill",
            "",
            "1. Người dùng upload chứng từ -> OCR -> trích invoice/BL/HS/container.",
            "2. Hệ thống hỏi `Nhập` hay `Xuất`, hoặc suy đoán từ quốc gia/loại chứng từ.",
            "3. Chọn `operation_code`, sau đó dùng bảng option để gợi ý HQ, Incoterm, tiền tệ, quốc gia.",
            "4. Với từng dòng hàng, dùng mô tả + xuất xứ + đơn vị để truy vấn RAG lịch sử HS.",
            "5. Chạy validation rules; các field confidence thấp phải để người dùng xác nhận.",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Infer declaration autofill rules")
    parser.add_argument("--declarations", type=Path, default=DEFAULT_DECL)
    parser.add_argument("--cargo", type=Path, default=DEFAULT_CARGO)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--min-support", type=int, default=500)
    parser.add_argument("--strong-threshold", type=float, default=0.8)
    args = parser.parse_args()

    if not args.declarations.exists():
        raise SystemExit(f"Declarations file not found: {args.declarations}")
    if not args.cargo.exists():
        raise SystemExit(f"Cargo file not found: {args.cargo}")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    rules = analyze(args.declarations, args.cargo, args.min_support, args.strong_threshold)
    json_path = args.output_dir / "declaration_filling_rules.json"
    md_path = args.output_dir / "declaration_filling_rules.md"
    json_path.write_text(json.dumps(rules, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(build_report(rules), encoding="utf-8")
    print(json.dumps({"rules": str(json_path), "report": str(md_path), "elapsed_seconds": rules["elapsed_seconds"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
