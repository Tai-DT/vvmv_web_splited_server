#!/usr/bin/env python3
"""Build a practical report about field selection behavior and dependencies."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_REPORT_DIR = ROOT / "llm-dataset" / "ai-assets" / "reports"

FIELD_GROUPS = {
    "1_direction_operation": ["direction", "operation_code"],
    "2_party": ["tax_code", "company_name", "company_address"],
    "3_route_country": ["export_country", "import_country"],
    "4_trade_terms": ["delivery_term", "currency"],
    "5_customs_port": ["customs_code", "customs_name", "port_code", "port_name"],
    "6_document_transport": ["bill_of_lading", "transport_name"],
    "7_cargo_identity": ["hs_code", "hs2", "hs4", "hs6", "description", "origin"],
    "8_cargo_measure_value": ["unit", "quantity", "unit_price", "value"],
    "9_tax_risk": ["tax_code", "risk_flags"],
}

FIELD_ROLE = {
    "direction": "root_selector",
    "operation_code": "root_selector",
    "export_country": "route_selector",
    "import_country": "route_selector",
    "delivery_term": "trade_selector",
    "currency": "trade_selector",
    "customs_code": "customs_selector",
    "port_code": "logistics_selector",
    "hs2": "cargo_classifier",
    "hs4": "cargo_classifier",
    "hs6": "cargo_classifier",
    "hs8": "cargo_classifier",
    "origin": "cargo_attribute",
    "unit": "cargo_attribute",
    "tax_code": "tax_selector",
}


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def field_presence_rows(profile: Dict[str, Any]) -> List[Dict[str, Any]]:
    rows = []
    for field, meta in profile.get("fields", {}).items():
        rows.append(
            {
                "field": field,
                "presence_pct": meta.get("presence_pct", 0),
                "distinct_count": meta.get("distinct_count"),
                "is_numeric_like": meta.get("is_numeric_like", False),
                "top_values": meta.get("top_values", [])[:5],
            }
        )
    rows.sort(key=lambda item: item["presence_pct"], reverse=True)
    return rows


def classify_action(confidence: float, support: int) -> str:
    if confidence >= 0.995 and support >= 1000:
        return "AUTOFILL"
    if confidence >= 0.95 and support >= 500:
        return "SUGGEST"
    if confidence >= 0.8 and support >= 200:
        return "HINT"
    return "ASK"


def normalize_pair_rule(rule: Dict[str, Any], arity: int) -> Dict[str, Any]:
    if "if_field" in rule:
        conditions = [{"field": rule["if_field"], "value": rule["if_value"]}]
        then_field = rule["then_field"]
        then_value = rule["then_value"]
    else:
        conditions = rule.get("conditions", [])
        then_field = rule["then_field"]
        then_value = rule["then_value"]
    confidence = float(rule.get("confidence", 0))
    support = int(rule.get("support", 0))
    return {
        "arity": arity,
        "conditions": conditions,
        "then_field": then_field,
        "then_value": then_value,
        "support": support,
        "total": int(rule.get("total", support)),
        "confidence": confidence,
        "action": classify_action(confidence, support),
        "confidence_lift": rule.get("confidence_lift"),
        "alternatives": rule.get("alternatives", [])[:5],
    }


def top_rules_by_target(*rule_sets: List[Dict[str, Any]], limit_per_target: int = 20) -> Dict[str, List[Dict[str, Any]]]:
    grouped = defaultdict(list)
    for rules in rule_sets:
        for rule in rules:
            grouped[rule["then_field"]].append(rule)
    out = {}
    for target, rules in grouped.items():
        rules.sort(key=lambda r: (r["arity"], r["confidence"], r["support"]), reverse=True)
        out[target] = rules[:limit_per_target]
    return dict(sorted(out.items()))


def dependency_edges(rules: List[Dict[str, Any]], min_confidence: float) -> List[Dict[str, Any]]:
    edges = {}
    for rule in rules:
        if rule["confidence"] < min_confidence:
            continue
        for cond in rule["conditions"]:
            key = (cond["field"], rule["then_field"])
            current = edges.get(key)
            if current is None or (rule["confidence"], rule["support"]) > (current["confidence"], current["support"]):
                edges[key] = {
                    "from": cond["field"],
                    "to": rule["then_field"],
                    "confidence": rule["confidence"],
                    "support": rule["support"],
                    "example": {
                        "if": cond,
                        "then": {"field": rule["then_field"], "value": rule["then_value"]},
                    },
                }
    return sorted(edges.values(), key=lambda e: (e["confidence"], e["support"]), reverse=True)


def build_mermaid(edges: List[Dict[str, Any]], max_edges: int = 35) -> str:
    lines = ["flowchart LR"]
    for edge in edges[:max_edges]:
        label = f"{edge['confidence']:.0%}/{edge['support']}"
        lines.append(f"  {edge['from']} -->|{label}| {edge['to']}")
    return "\n".join(lines)


def build_report(report_dir: Path) -> Dict[str, Any]:
    all_deps = load_json(report_dir / "all_field_dependencies.json")
    behavior = load_json(report_dir / "import_export_behavior.json")
    multifield = load_json(report_dir / "multifield_rules.json")

    declaration_single = [
        normalize_pair_rule(rule, 1)
        for rule in all_deps.get("declaration_pair_rules", [])
        if rule.get("confidence", 0) >= 0.8
    ]
    cargo_single = [
        normalize_pair_rule(rule, 1)
        for rule in all_deps.get("cargo_pair_rules", [])
        if rule.get("confidence", 0) >= 0.8
    ]
    declaration_multi = [normalize_pair_rule(rule, len(rule.get("conditions", []))) for rule in multifield.get("declaration_rules", [])]
    cargo_multi = [normalize_pair_rule(rule, len(rule.get("conditions", []))) for rule in multifield.get("cargo_rules", [])]

    return {
        "field_groups": FIELD_GROUPS,
        "field_roles": FIELD_ROLE,
        "selection_flow": [
            "direction",
            "operation_code",
            "tax_code/company",
            "export_country/import_country",
            "delivery_term/currency",
            "port_code/customs_code",
            "hs_code/origin",
            "unit/quantity/unit_price/value",
            "tax_code/risk_flags",
        ],
        "presence": {
            "declaration": field_presence_rows(all_deps["declarations"]),
            "cargo": field_presence_rows(all_deps["cargo"]),
        },
        "behavior_summary": {
            "direction_counts": behavior["direction_counts"],
            "import_top_operations": behavior["import_behavior"]["declaration"]["top_operation_codes"][:10],
            "export_top_operations": behavior["export_behavior"]["declaration"]["top_operation_codes"][:10],
            "import_top_cargo_hs2": behavior["import_behavior"]["cargo"]["top_hs2"][:10],
            "export_top_cargo_hs2": behavior["export_behavior"]["cargo"]["top_hs2"][:10],
        },
        "declaration_rules_by_target": top_rules_by_target(declaration_single, declaration_multi),
        "cargo_rules_by_target": top_rules_by_target(cargo_single, cargo_multi),
        "declaration_dependency_edges": dependency_edges(declaration_single + declaration_multi, 0.95),
        "cargo_dependency_edges": dependency_edges(cargo_single + cargo_multi, 0.95),
    }


def md_rule(rule: Dict[str, Any]) -> str:
    cond = " + ".join(f"`{c['field']}={c['value']}`" for c in rule["conditions"])
    return (
        f"{cond} -> `{rule['then_field']}={rule['then_value']}` "
        f"({rule['confidence']:.2%}, support {rule['support']:,}, {rule['action']})"
    )


def build_markdown(report: Dict[str, Any]) -> str:
    lines = [
        "# Hành vi chọn trường và mối liên quan giữa các trường",
        "",
        "## Luồng chọn trường đề xuất",
        "",
    ]
    for idx, field in enumerate(report["selection_flow"], 1):
        lines.append(f"{idx}. `{field}`")
    lines.extend(["", "## Field presence", ""])
    for dataset in ["declaration", "cargo"]:
        lines.extend([f"### {dataset}", "", "| Field | Presence | Distinct | Numeric | Top values |", "|---|---:|---:|---:|---|"])
        for row in report["presence"][dataset]:
            top_values = ", ".join(f"`{v}`:{c}" for v, c in row["top_values"][:3])
            lines.append(
                f"| `{row['field']}` | {row['presence_pct']:.2f}% | {row['distinct_count']} | "
                f"{row['is_numeric_like']} | {top_values} |"
            )
        lines.append("")
    lines.extend(["## Dependency graph declaration", "", "```mermaid", build_mermaid(report["declaration_dependency_edges"]), "```", ""])
    lines.extend(["## Dependency graph cargo", "", "```mermaid", build_mermaid(report["cargo_dependency_edges"]), "```", ""])
    for section, title in [("declaration_rules_by_target", "Declaration rules by target"), ("cargo_rules_by_target", "Cargo rules by target")]:
        lines.extend([f"## {title}", ""])
        for target, rules in report[section].items():
            lines.append(f"### `{target}`")
            for rule in rules[:8]:
                lines.append(f"- {md_rule(rule)}")
            lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build field behavior/dependency report")
    parser.add_argument("--report-dir", type=Path, default=DEFAULT_REPORT_DIR)
    args = parser.parse_args()

    report = build_report(args.report_dir)
    json_path = args.report_dir / "field_behavior_dependencies.json"
    md_path = args.report_dir / "field_behavior_dependencies.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(build_markdown(report), encoding="utf-8")
    print(json.dumps({"json": str(json_path), "markdown": str(md_path)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
