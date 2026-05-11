#!/usr/bin/env python3
"""Analyze field/option logic for import and export declarations.

Outputs a JSON summary and a Markdown report with Mermaid diagrams.
"""

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


def safe_text(value: Any) -> str:
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


def direction_name(direction: str) -> str:
    return {"N": "Nhập khẩu", "X": "Xuất khẩu", "": "Không rõ"}.get(direction, direction or "Không rõ")


def pct(value: int, total: int) -> str:
    return f"{(value / total * 100):.2f}%" if total else "0.00%"


def top(counter: Counter, n: int = 15) -> List[Tuple[str, int]]:
    return [(str(k), int(v)) for k, v in counter.most_common(n) if str(k)]


def init_dir_stats() -> Dict[str, Any]:
    return {
        "declarations": 0,
        "cargo_lines_declared_from_compact": 0,
        "value_count": 0,
        "value_sum": 0.0,
        "value_min": None,
        "value_max": None,
        "operation_codes": Counter(),
        "customs_codes": Counter(),
        "delivery_terms": Counter(),
        "currencies": Counter(),
        "export_countries": Counter(),
        "import_countries": Counter(),
        "country_pairs": Counter(),
        "ports": Counter(),
        "risk_flags": Counter(),
        "operation_to_customs": defaultdict(Counter),
        "operation_to_terms": defaultdict(Counter),
        "operation_to_currency": defaultdict(Counter),
        "operation_to_country_pair": defaultdict(Counter),
        "hs2": Counter(),
        "hs4": Counter(),
        "hs8": Counter(),
        "origins": Counter(),
        "units": Counter(),
        "cargo_tax_codes": Counter(),
        "hs2_to_operations": defaultdict(Counter),
    }


def add_value(stats: Dict[str, Any], value: Any) -> None:
    number = to_float(value)
    if number is None:
        return
    stats["value_count"] += 1
    stats["value_sum"] += number
    stats["value_min"] = number if stats["value_min"] is None else min(stats["value_min"], number)
    stats["value_max"] = number if stats["value_max"] is None else max(stats["value_max"], number)


def analyze(decl_path: Path, cargo_path: Path) -> Dict[str, Any]:
    started = time.time()
    overall = {
        "declarations": 0,
        "directions": Counter(),
        "risks": Counter(),
    }
    by_direction = defaultdict(init_dir_stats)

    for rec in iter_jsonl(decl_path):
        direction = safe_text(rec.get("direction"))
        stats = by_direction[direction]
        overall["declarations"] += 1
        overall["directions"][direction] += 1
        stats["declarations"] += 1
        stats["cargo_lines_declared_from_compact"] += int(to_float(rec.get("cargo_count")) or 0)
        add_value(stats, rec.get("total_declared_value"))

        operation = safe_text(rec.get("operation_code")) or "(blank)"
        customs = safe_text(rec.get("customs_code")) or "(blank)"
        term = safe_text(rec.get("delivery_term")) or "(blank)"
        currency = safe_text(rec.get("currency")) or "(blank)"
        export_country = safe_text(rec.get("export_country")) or "(blank)"
        import_country = safe_text(rec.get("import_country")) or "(blank)"
        country_pair = f"{export_country}->{import_country}"
        port = safe_text(rec.get("port_code") or rec.get("port_name")) or "(blank)"

        stats["operation_codes"][operation] += 1
        stats["customs_codes"][customs] += 1
        stats["delivery_terms"][term] += 1
        stats["currencies"][currency] += 1
        stats["export_countries"][export_country] += 1
        stats["import_countries"][import_country] += 1
        stats["country_pairs"][country_pair] += 1
        stats["ports"][port] += 1
        stats["operation_to_customs"][operation][customs] += 1
        stats["operation_to_terms"][operation][term] += 1
        stats["operation_to_currency"][operation][currency] += 1
        stats["operation_to_country_pair"][operation][country_pair] += 1

        for risk in rec.get("risk_flags") or []:
            risk = safe_text(risk)
            if risk:
                stats["risk_flags"][risk] += 1
                overall["risks"][risk] += 1

    for rec in iter_jsonl(cargo_path):
        direction = safe_text(rec.get("direction"))
        stats = by_direction[direction]
        hs = safe_text(rec.get("hs_code"))
        op = safe_text(rec.get("operation_code")) or "(blank)"
        if hs:
            stats["hs8"][hs[:8]] += 1
            stats["hs4"][hs[:4]] += 1
            stats["hs2"][hs[:2]] += 1
            stats["hs2_to_operations"][hs[:2]][op] += 1
        origin = safe_text(rec.get("origin")) or "(blank)"
        unit = safe_text(rec.get("unit")) or "(blank)"
        tax_code = safe_text(rec.get("tax_code")) or "(blank)"
        stats["origins"][origin] += 1
        stats["units"][unit] += 1
        stats["cargo_tax_codes"][tax_code] += 1

    return {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "elapsed_seconds": round(time.time() - started, 2),
        "inputs": {"declarations": str(decl_path), "cargo": str(cargo_path)},
        "overall": {
            "declarations": overall["declarations"],
            "directions": dict(overall["directions"]),
            "risk_flags": dict(overall["risks"]),
        },
        "by_direction": {direction: serialize_stats(stats) for direction, stats in by_direction.items()},
    }


def serialize_nested(counter_map: Dict[str, Counter], n_outer: int = 12, n_inner: int = 8) -> Dict[str, List[Tuple[str, int]]]:
    outer_totals = Counter({key: sum(counter.values()) for key, counter in counter_map.items()})
    return {key: top(counter_map[key], n_inner) for key, _ in outer_totals.most_common(n_outer)}


def serialize_stats(stats: Dict[str, Any]) -> Dict[str, Any]:
    avg_value = stats["value_sum"] / stats["value_count"] if stats["value_count"] else None
    return {
        "declarations": stats["declarations"],
        "cargo_lines_declared_from_compact": stats["cargo_lines_declared_from_compact"],
        "avg_declared_value": round(avg_value, 4) if avg_value is not None else None,
        "min_declared_value": stats["value_min"],
        "max_declared_value": stats["value_max"],
        "operation_codes": top(stats["operation_codes"], 20),
        "customs_codes": top(stats["customs_codes"], 20),
        "delivery_terms": top(stats["delivery_terms"], 20),
        "currencies": top(stats["currencies"], 20),
        "export_countries": top(stats["export_countries"], 20),
        "import_countries": top(stats["import_countries"], 20),
        "country_pairs": top(stats["country_pairs"], 20),
        "ports": top(stats["ports"], 20),
        "risk_flags": top(stats["risk_flags"], 20),
        "hs2": top(stats["hs2"], 20),
        "hs4": top(stats["hs4"], 20),
        "hs8": top(stats["hs8"], 20),
        "origins": top(stats["origins"], 20),
        "units": top(stats["units"], 20),
        "cargo_tax_codes": top(stats["cargo_tax_codes"], 20),
        "operation_to_customs": serialize_nested(stats["operation_to_customs"]),
        "operation_to_terms": serialize_nested(stats["operation_to_terms"]),
        "operation_to_currency": serialize_nested(stats["operation_to_currency"]),
        "operation_to_country_pair": serialize_nested(stats["operation_to_country_pair"]),
        "hs2_to_operations": serialize_nested(stats["hs2_to_operations"]),
    }


def markdown_table(rows: List[Tuple[str, int]], total: int, headers: Tuple[str, str] = ("Option", "Count")) -> str:
    lines = [f"| {headers[0]} | {headers[1]} | Tỷ lệ |", "|---|---:|---:|"]
    for key, count in rows:
        lines.append(f"| `{key}` | {count:,} | {pct(count, total)} |")
    return "\n".join(lines)


def mermaid_pie(title: str, rows: List[Tuple[str, int]], max_rows: int = 8) -> str:
    lines = ["```mermaid", f"pie showData title {title}"]
    for key, value in rows[:max_rows]:
        escaped = key.replace('"', "'")
        lines.append(f'  "{escaped}" : {value}')
    lines.append("```")
    return "\n".join(lines)


def mermaid_flow(direction: str, stats: Dict[str, Any]) -> str:
    title = direction_name(direction)
    ops = stats["operation_codes"][:6]
    terms = stats["delivery_terms"][:5]
    currencies = stats["currencies"][:4]
    countries = stats["country_pairs"][:5]
    hs2 = stats["hs2"][:6]
    risks = stats["risk_flags"][:5]
    lines = [
        "```mermaid",
        "flowchart LR",
        f'  D["direction={direction}<br/>{title}"] --> OP["Loại hình / MA_LH"]',
        '  D --> COUNTRY["Luồng quốc gia<br/>NUOC_XK -> NUOC_NK"]',
        '  D --> TERM["Điều kiện giao hàng<br/>MA_GH"]',
        '  D --> MONEY["Tiền tệ<br/>MA_NT"]',
        '  D --> HQ["Chi cục hải quan<br/>MA_HQ"]',
        '  OP --> CARGO["Dòng hàng"]',
        '  CARGO --> HS["Mã HS<br/>MA_HANGKB"]',
        '  HS --> TAX["Mã thuế/thuế suất<br/>TS_*"]',
        '  CARGO --> VALUE["SL x đơn giá = trị giá dòng"]',
        '  VALUE --> TOTAL["Đối chiếu tổng trị giá header"]',
        '  CARGO --> RISK["Rule/risk flags"]',
    ]
    for key, count in ops:
        lines.append(f'  OP --> OP_{safe_node(key)}["{key}<br/>{count:,}"]')
    for key, count in countries:
        lines.append(f'  COUNTRY --> CP_{safe_node(key)}["{key}<br/>{count:,}"]')
    for key, count in terms:
        lines.append(f'  TERM --> TERM_{safe_node(key)}["{key}<br/>{count:,}"]')
    for key, count in currencies:
        lines.append(f'  MONEY --> CUR_{safe_node(key)}["{key}<br/>{count:,}"]')
    for key, count in hs2:
        lines.append(f'  HS --> HS_{safe_node(key)}["HS {key}<br/>{count:,} dòng"]')
    for key, count in risks:
        lines.append(f'  RISK --> RISK_{safe_node(key)}["{key}<br/>{count:,}"]')
    lines.append("```")
    return "\n".join(lines)


def safe_node(value: str) -> str:
    safe = "".join(ch if ch.isalnum() else "_" for ch in value)
    return safe[:30] or "blank"


def build_report(summary: Dict[str, Any]) -> str:
    overall = summary["overall"]
    by_dir = summary["by_direction"]
    lines: List[str] = [
        "# Phân tích logic trường và option theo nhập/xuất",
        "",
        f"- Generated: `{summary['generated_at']}`",
        f"- Tổng tờ khai: `{overall['declarations']:,}`",
        f"- Nguồn declarations: `{summary['inputs']['declarations']}`",
        f"- Nguồn cargo: `{summary['inputs']['cargo']}`",
        "",
        "## 1. Mô hình logic tổng quát",
        "",
        "```mermaid",
        "flowchart TD",
        '  RAW["Raw JSONL / ECUS / VNACCS"] --> DECL["Tờ khai"]',
        '  DECL --> TOP["Top-level keys<br/>declarationId, direction, taxCode, customsCode, operationCode"]',
        '  DECL --> HEADER["Header nghiệp vụ<br/>MA_LH, MA_HQ, MA_DV, NUOC_XK, NUOC_NK, MA_GH, MA_NT, TONGTGKB"]',
        '  DECL --> VNACCS["VNACCS/VNACCS2<br/>thông tin mở rộng, vận đơn, kho, vận chuyển"]',
        '  DECL --> CARGO["Cargo lines<br/>MA_HANGKB, TEN_HANG, NUOC_XX, MA_DVT, LUONG, DGIA_KB, TRIGIA_KB"]',
        '  DECL --> CONT["Containers / vận đơn"]',
        '  HEADER --> FLOW["Logic luồng<br/>Nhập hoặc Xuất"]',
        '  FLOW --> OPTIONS["Option nghiệp vụ<br/>loại hình, HQ, Incoterm, tiền tệ, quốc gia"]',
        '  CARGO --> HS["Phân loại HS"]',
        '  CARGO --> VAL["Tính trị giá"]',
        '  CARGO --> TAX["Thuế / miễn giảm / mã biểu thuế"]',
        '  HS --> RISK["Risk & validation"]',
        '  VAL --> RISK',
        '  OPTIONS --> RAG["RAG / LLM / Dashboard"]',
        '  RISK --> RAG',
        "```",
        "",
        "## 2. Tách luồng nhập và xuất",
        "",
        mermaid_pie("Phân bố direction", top(Counter(overall["directions"]), 5)),
        "",
    ]

    for direction in ("N", "X", ""):
        if direction not in by_dir:
            continue
        stats = by_dir[direction]
        total = stats["declarations"]
        lines.extend(
            [
                f"## {direction_name(direction)} (`direction={direction or 'blank'}`)",
                "",
                f"- Số tờ khai: `{total:,}`",
                f"- Dòng hàng toàn bộ theo `cargo_count`: `{stats['cargo_lines_declared_from_compact']:,}`",
                f"- Trị giá khai báo trung bình: `{stats['avg_declared_value']}`",
                f"- Min/max trị giá: `{stats['min_declared_value']}` / `{stats['max_declared_value']}`",
                "",
                "### Biểu đồ logic trường",
                "",
                mermaid_flow(direction, stats),
                "",
                "### Option loại hình (`operation_code` / `MA_LH`)",
                markdown_table(stats["operation_codes"][:12], total, ("Loại hình", "Tờ khai")),
                "",
                "### Option chi cục hải quan (`customs_code` / `MA_HQ`)",
                markdown_table(stats["customs_codes"][:12], total, ("Mã HQ", "Tờ khai")),
                "",
                "### Logic quốc gia (`NUOC_XK -> NUOC_NK`)",
                markdown_table(stats["country_pairs"][:12], total, ("Cặp quốc gia", "Tờ khai")),
                "",
                "### Điều kiện giao hàng và tiền tệ",
                markdown_table(stats["delivery_terms"][:10], total, ("MA_GH", "Tờ khai")),
                "",
                markdown_table(stats["currencies"][:10], total, ("MA_NT", "Tờ khai")),
                "",
                "### HS và hàng hóa",
                "_Các bảng HS bên dưới dựa trên `cargo_facts` hiện có. File này đang lưu tối đa 8 dòng hàng đại diện mỗi tờ khai; nếu cần phân bố HS tuyệt đối trên mọi dòng hàng, hãy sinh lại AI assets với `--max-cargo 0` sau khi bật chế độ xuất toàn bộ cargo._",
                "",
                markdown_table(stats["hs2"][:12], sum(v for _, v in stats["hs2"]), ("HS chương", "Dòng hàng trong cargo_facts")),
                "",
                markdown_table(stats["hs4"][:12], sum(v for _, v in stats["hs4"]), ("HS 4 số", "Dòng hàng trong cargo_facts")),
                "",
                "### Rủi ro/rule phát hiện",
                markdown_table(stats["risk_flags"][:12], max(total, 1), ("Risk flag", "Tờ khai")),
                "",
                "### Quan hệ option nổi bật",
                "",
                "#### Loại hình -> chi cục hải quan",
                nested_table(stats["operation_to_customs"]),
                "",
                "#### Loại hình -> điều kiện giao hàng",
                nested_table(stats["operation_to_terms"]),
                "",
                "#### HS chương -> loại hình",
                nested_table(stats["hs2_to_operations"]),
                "",
            ]
        )

    lines.extend(
        [
            "## 3. Logic kiểm tra chéo nên áp dụng trong hệ thống AI",
            "",
            "| Nhóm logic | Trường liên quan | Ý nghĩa | Rule gợi ý |",
            "|---|---|---|---|",
            "| Luồng | `direction`, `NUOC_XK`, `NUOC_NK` | Xác định nhập/xuất và hướng quốc gia | Nhập thường `NUOC_NK=VN`; xuất thường `NUOC_XK=VN`; ngoại lệ cần flag mềm |",
            "| Loại hình | `direction`, `operation_code/MA_LH`, `customs_code/MA_HQ` | Loại hình quyết định quy trình, chứng từ, thuế | Kiểm tra phân bố loại hình theo direction và chi cục |",
            "| Giao hàng | `MA_GH`, `MA_NT`, phí vận chuyển/bảo hiểm | Ảnh hưởng trị giá tính thuế | Incoterm + currency bất thường theo loại hình cần review |",
            "| Hàng hóa | `MA_HANGKB`, `TEN_HANG`, `NUOC_XX`, `MA_DVT` | Phân loại HS và mô tả hàng | HS thiếu/sai format, mô tả quá ngắn, thiếu model/thông số |",
            "| Trị giá | `LUONG`, `DGIA_KB`, `TRIGIA_KB`, `TONGTGKB` | Đối chiếu tổng dòng hàng với header | `abs(sum(TRIGIA_KB)-TONGTGKB) > threshold` |",
            "| Số dòng | `SOHANG`, `cargo_count` | Đối chiếu số dòng khai báo | Mismatch cần phân biệt do compact sample hoặc dữ liệu thiếu |",
            "| RAG/LLM | `declaration_id`, metadata, text corpus | Truy xuất nguồn trước khi LLM trả lời | Bắt buộc trích nguồn; không đủ nguồn thì không suy đoán |",
            "",
            "## 4. Khuyến nghị tách module nhập/xuất",
            "",
            "- Module nhập khẩu: ưu tiên HS suggestion, trị giá tính thuế, nước xuất khẩu/xuất xứ, Incoterm, phí vận chuyển/bảo hiểm.",
            "- Module xuất khẩu: ưu tiên thị trường đích, loại hình gia công/sản xuất xuất khẩu, chứng từ vận chuyển, hoàn thuế/thanh khoản.",
            "- Dùng cùng một schema compact nhưng tách prompt, rule threshold và dashboard theo `direction=N/X`.",
        ]
    )
    return "\n".join(lines)


def nested_table(data: Dict[str, List[Tuple[str, int]]]) -> str:
    lines = ["| Option cha | Option con nổi bật |", "|---|---|"]
    for parent, children in list(data.items())[:10]:
        child_text = ", ".join(f"`{k}` ({v:,})" for k, v in children[:5])
        lines.append(f"| `{parent}` | {child_text} |")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze import/export field logic")
    parser.add_argument("--declarations", type=Path, default=DEFAULT_DECL)
    parser.add_argument("--cargo", type=Path, default=DEFAULT_CARGO)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    if not args.declarations.exists():
        raise SystemExit(f"Declarations file not found: {args.declarations}")
    if not args.cargo.exists():
        raise SystemExit(f"Cargo file not found: {args.cargo}")
    args.output_dir.mkdir(parents=True, exist_ok=True)

    summary = analyze(args.declarations, args.cargo)
    summary_path = args.output_dir / "field_logic_summary.json"
    report_path = args.output_dir / "field_logic_import_export.md"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    report_path.write_text(build_report(summary), encoding="utf-8")
    print(json.dumps({"summary": str(summary_path), "report": str(report_path), "elapsed_seconds": summary["elapsed_seconds"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
