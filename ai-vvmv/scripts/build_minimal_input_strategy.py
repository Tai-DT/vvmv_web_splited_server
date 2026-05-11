#!/usr/bin/env python3
"""Build a strategy to minimize user input using learned VVMV rules."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_REPORT_DIR = ROOT / "llm-dataset" / "ai-assets" / "reports"

DECLARATION_TARGETS = [
    "direction",
    "operation_code",
    "tax_code",
    "company_name",
    "company_address",
    "export_country",
    "import_country",
    "delivery_term",
    "currency",
    "customs_code",
    "port_code",
    "bill_of_lading",
    "transport_name",
]
CARGO_TARGETS = ["hs_code", "description", "origin", "unit", "quantity", "unit_price", "value", "tax_code"]
USER_INPUT_ROOTS = {"operation_code", "tax_code", "company_name", "description", "hs_code", "quantity", "unit_price"}
ALWAYS_USER_OR_EXTERNAL = {"bill_of_lading", "transport_name", "description", "quantity", "unit_price"}
COMPUTED_FIELDS = {"value"}


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def action(confidence: float, support: int) -> str:
    if confidence >= 0.995 and support >= 1000:
        return "AUTOFILL"
    if confidence >= 0.95 and support >= 500:
        return "SUGGEST"
    if confidence >= 0.8 and support >= 200:
        return "HINT"
    return "ASK"


def normalize_rule(rule: Dict[str, Any], arity: int) -> Dict[str, Any]:
    if "if_field" in rule:
        conditions = [{"field": rule["if_field"], "value": rule["if_value"]}]
    else:
        conditions = rule.get("conditions", [])
    confidence = float(rule.get("confidence", 0))
    support = int(rule.get("support", 0))
    return {
        "conditions": conditions,
        "then_field": rule["then_field"],
        "then_value": rule["then_value"],
        "confidence": confidence,
        "support": support,
        "total": int(rule.get("total", support)),
        "arity": arity,
        "action": action(confidence, support),
    }


def gather_rules(report_dir: Path) -> Dict[str, List[Dict[str, Any]]]:
    all_deps = load_json(report_dir / "all_field_dependencies.json")
    multifield = load_json(report_dir / "multifield_rules.json")
    rules = {
        "declaration": [],
        "cargo": [],
    }
    rules["declaration"].extend(
        normalize_rule(rule, 1)
        for rule in all_deps.get("declaration_pair_rules", [])
        if rule.get("confidence", 0) >= 0.8
    )
    rules["cargo"].extend(
        normalize_rule(rule, 1)
        for rule in all_deps.get("cargo_pair_rules", [])
        if rule.get("confidence", 0) >= 0.8
    )
    rules["declaration"].extend(
        normalize_rule(rule, len(rule.get("conditions", [])))
        for rule in multifield.get("declaration_rules", [])
    )
    rules["cargo"].extend(
        normalize_rule(rule, len(rule.get("conditions", [])))
        for rule in multifield.get("cargo_rules", [])
    )
    for key in rules:
        rules[key].sort(key=lambda r: (r["arity"], r["confidence"], r["support"]), reverse=True)
    return rules


def best_rules_by_target(rules: List[Dict[str, Any]], target_fields: List[str]) -> Dict[str, List[Dict[str, Any]]]:
    grouped = defaultdict(list)
    for rule in rules:
        if rule["then_field"] in target_fields:
            grouped[rule["then_field"]].append(rule)
    return {field: grouped.get(field, [])[:10] for field in target_fields}


def plan_field(field: str, rules: List[Dict[str, Any]]) -> Dict[str, Any]:
    if field in COMPUTED_FIELDS:
        return {
            "field": field,
            "mode": "COMPUTE",
            "reason": "Tính trực tiếp từ quantity * unit_price rồi validate với tổng trị giá.",
            "best_rules": rules[:3],
        }
    if field in ALWAYS_USER_OR_EXTERNAL:
        return {
            "field": field,
            "mode": "USER_OR_EXTERNAL",
            "reason": "Giá trị thường đến từ chứng từ/người dùng hoặc là số lượng/đơn giá thực tế.",
            "best_rules": rules[:3],
        }
    autofill = [rule for rule in rules if rule["action"] == "AUTOFILL"]
    suggest = [rule for rule in rules if rule["action"] == "SUGGEST"]
    hint = [rule for rule in rules if rule["action"] == "HINT"]
    if autofill:
        return {"field": field, "mode": "AUTOFILL", "reason": "Có rule confidence rất cao.", "best_rules": autofill[:5]}
    if suggest:
        return {"field": field, "mode": "SUGGEST_CONFIRM", "reason": "Có rule tốt nhưng nên cho user xác nhận.", "best_rules": suggest[:5]}
    if hint:
        return {"field": field, "mode": "HINT_OR_ASK", "reason": "Có tín hiệu nhưng chưa đủ chắc.", "best_rules": hint[:5]}
    if field in USER_INPUT_ROOTS:
        return {"field": field, "mode": "ASK_MINIMAL", "reason": "Field gốc để suy luận các field khác.", "best_rules": []}
    return {"field": field, "mode": "ASK", "reason": "Chưa có rule đủ tin cậy.", "best_rules": rules[:3]}


def compact_rule(rule: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "if": {c["field"]: c["value"] for c in rule["conditions"]},
        "then": {rule["then_field"]: rule["then_value"]},
        "confidence": round(rule["confidence"], 4),
        "support": rule["support"],
        "action": rule["action"],
    }


def build_strategy(report_dir: Path) -> Dict[str, Any]:
    rules = gather_rules(report_dir)
    decl_by_target = best_rules_by_target(rules["declaration"], DECLARATION_TARGETS)
    cargo_by_target = best_rules_by_target(rules["cargo"], CARGO_TARGETS)
    decl_plan = [plan_field(field, decl_by_target.get(field, [])) for field in DECLARATION_TARGETS]
    cargo_plan = [plan_field(field, cargo_by_target.get(field, [])) for field in CARGO_TARGETS]
    for item in decl_plan + cargo_plan:
        item["best_rules"] = [compact_rule(rule) for rule in item["best_rules"]]

    return {
        "minimal_user_inputs": {
            "declaration": [
                "operation_code",
                "tax_code or company lookup key",
                "export_country/import_country only if not implied by direction/operation",
                "bill_of_lading/transport_name from document OCR if available",
            ],
            "cargo_line": [
                "hs_code or goods description",
                "quantity",
                "unit_price",
                "origin only if not implied by export behavior or HS/company pattern",
            ],
        },
        "recommended_ui_flow": [
            "1. User chọn/nhập operation_code trước; tự suy direction và nước VN theo chiều.",
            "2. User nhập MST; hệ thống lookup tên/địa chỉ doanh nghiệp từ lịch sử.",
            "3. Hệ thống gợi ý country/currency/delivery_term/port/customs bằng rule confidence cao.",
            "4. User nhập hoặc OCR mô tả hàng; hệ thống gợi ý HS nếu có model semantic, sau đó suy unit/tax_code.",
            "5. User nhập quantity và unit_price; hệ thống tự tính value và tổng trị giá.",
            "6. Chỉ hỏi lại các field có action SUGGEST/HINT/ASK hoặc conflict với chứng từ.",
        ],
        "declaration_field_plan": decl_plan,
        "cargo_field_plan": cargo_plan,
        "automation_priority": {
            "safe_autofill_first": [
                "direction",
                "import_country/export_country=VN theo direction",
                "cargo.value = quantity * unit_price",
                "cargo.tax_code theo operation/direction khi confidence >= 99.5%",
                "cargo.origin=VN cho nhiều luồng xuất E42/E62/E52",
            ],
            "suggest_confirm": [
                "currency",
                "delivery_term",
                "port_code",
                "customs_code",
                "unit",
                "tax_code override theo hs6",
            ],
            "must_ask_or_extract": [
                "quantity",
                "unit_price",
                "bill_of_lading",
                "transport_name",
                "goods description",
            ],
        },
    }


def rule_md(rule: Dict[str, Any]) -> str:
    cond = " + ".join(f"`{k}={v}`" for k, v in rule["if"].items())
    then = ", ".join(f"`{k}={v}`" for k, v in rule["then"].items())
    return f"{cond} -> {then} ({rule['confidence']:.2%}, support {rule['support']:,}, {rule['action']})"


def build_markdown(strategy: Dict[str, Any]) -> str:
    lines = [
        "# Chiến lược giảm tối đa thao tác người dùng",
        "",
        "## Input tối thiểu nên yêu cầu",
        "",
        "### Declaration",
    ]
    lines.extend(f"- `{item}`" for item in strategy["minimal_user_inputs"]["declaration"])
    lines.extend(["", "### Cargo line"])
    lines.extend(f"- `{item}`" for item in strategy["minimal_user_inputs"]["cargo_line"])
    lines.extend(["", "## UI flow đề xuất"])
    lines.extend(f"- {item}" for item in strategy["recommended_ui_flow"])
    for section, title in [("declaration_field_plan", "Declaration field plan"), ("cargo_field_plan", "Cargo field plan")]:
        lines.extend(["", f"## {title}", "", "| Field | Mode | Reason | Best rules |", "|---|---|---|---|"])
        for item in strategy[section]:
            rules = "<br/>".join(rule_md(rule) for rule in item["best_rules"][:3]) or "-"
            lines.append(f"| `{item['field']}` | `{item['mode']}` | {item['reason']} | {rules} |")
    lines.extend(["", "## Automation priority"])
    for key, values in strategy["automation_priority"].items():
        lines.extend(["", f"### {key}"])
        lines.extend(f"- `{value}`" for value in values)
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build minimal input strategy")
    parser.add_argument("--report-dir", type=Path, default=DEFAULT_REPORT_DIR)
    args = parser.parse_args()
    strategy = build_strategy(args.report_dir)
    json_path = args.report_dir / "minimal_input_strategy.json"
    md_path = args.report_dir / "minimal_input_strategy.md"
    json_path.write_text(json.dumps(strategy, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(build_markdown(strategy), encoding="utf-8")
    print(json.dumps({"json": str(json_path), "markdown": str(md_path)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
