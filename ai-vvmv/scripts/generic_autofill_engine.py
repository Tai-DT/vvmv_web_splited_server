#!/usr/bin/env python3
"""Generic autofill engine backed by mined VVMV dependency rules."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Tuple


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_REPORT_DIR = ROOT / "llm-dataset" / "ai-assets" / "reports"

DECLARATION_FIELDS = [
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
CARGO_FIELDS = ["hs_code", "description", "origin", "unit", "quantity", "unit_price", "value", "tax_code"]
ASK_PRIORITY = [
    "operation_code",
    "tax_code",
    "hs_code",
    "description",
    "quantity",
    "unit_price",
    "origin",
    "delivery_term",
    "port_code",
    "customs_code",
    "bill_of_lading",
    "transport_name",
]
EXTERNAL_FIELDS = {"bill_of_lading", "transport_name", "description", "quantity", "unit_price"}


@dataclass
class Rule:
    dataset: str
    conditions: Dict[str, str]
    then_field: str
    then_value: str
    confidence: float
    support: int
    arity: int


def present(value: Any) -> bool:
    return value is not None and str(value).strip() != ""


def action_for(confidence: float, support: int) -> str:
    if confidence >= 0.995 and support >= 1000:
        return "AUTOFILL"
    if confidence >= 0.95 and support >= 500:
        return "SUGGEST"
    if confidence >= 0.8 and support >= 200:
        return "HINT"
    return "ASK"


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def normalize_rule(dataset: str, raw: Dict[str, Any]) -> Rule:
    if "if_field" in raw:
        conditions = {str(raw["if_field"]): str(raw["if_value"])}
    else:
        conditions = {str(item["field"]): str(item["value"]) for item in raw.get("conditions", [])}
    return Rule(
        dataset=dataset,
        conditions=conditions,
        then_field=str(raw["then_field"]),
        then_value=str(raw["then_value"]),
        confidence=float(raw.get("confidence", 0)),
        support=int(raw.get("support", 0)),
        arity=len(conditions),
    )


def load_rules(report_dir: Path) -> List[Rule]:
    all_deps = load_json(report_dir / "all_field_dependencies.json")
    multifield = load_json(report_dir / "multifield_rules.json")
    rules: List[Rule] = []
    rules.extend(normalize_rule("declaration", raw) for raw in all_deps.get("declaration_pair_rules", []))
    rules.extend(normalize_rule("cargo", raw) for raw in all_deps.get("cargo_pair_rules", []))
    rules.extend(normalize_rule("declaration", raw) for raw in multifield.get("declaration_rules", []))
    rules.extend(normalize_rule("cargo", raw) for raw in multifield.get("cargo_rules", []))
    rules = [rule for rule in rules if rule.confidence >= 0.8 and rule.support >= 200]
    rules.sort(key=lambda r: (r.arity, r.confidence, r.support), reverse=True)
    return rules


def enrich_values(values: Dict[str, Any]) -> Dict[str, str]:
    out = {key: str(value).strip() for key, value in values.items() if present(value)}
    hs = out.get("hs_code", "")
    if len(hs) >= 2:
        out["hs2"] = hs[:2]
    if len(hs) >= 4:
        out["hs4"] = hs[:4]
    if len(hs) >= 6:
        out["hs6"] = hs[:6]
    if len(hs) >= 8:
        out["hs8"] = hs[:8]
    return out


def rule_matches(rule: Rule, values: Dict[str, str]) -> bool:
    return all(values.get(field) == value for field, value in rule.conditions.items())


def apply_rules(dataset: str, values: Dict[str, Any], rules: List[Rule]) -> Tuple[Dict[str, Any], List[Dict[str, Any]], List[Dict[str, Any]]]:
    known = enrich_values(values)
    inferred: Dict[str, Any] = {}
    suggestions: List[Dict[str, Any]] = []
    conflicts: List[Dict[str, Any]] = []

    changed = True
    while changed:
        changed = False
        for rule in rules:
            if rule.dataset != dataset or not rule_matches(rule, known):
                continue
            existing = known.get(rule.then_field)
            item = {
                "field": rule.then_field,
                "value": rule.then_value,
                "confidence": round(rule.confidence, 4),
                "support": rule.support,
                "action": action_for(rule.confidence, rule.support),
                "conditions": rule.conditions,
            }
            if existing:
                if existing != rule.then_value and rule.confidence >= 0.95:
                    conflicts.append({**item, "existing": existing})
                continue
            if item["action"] == "AUTOFILL":
                known[rule.then_field] = rule.then_value
                inferred[rule.then_field] = item
                changed = True
            else:
                suggestions.append(item)

    if dataset == "cargo" and "value" not in known and present(values.get("quantity")) and present(values.get("unit_price")):
        try:
            value = float(values["quantity"]) * float(values["unit_price"])
            inferred["value"] = {
                "field": "value",
                "value": round(value, 6),
                "confidence": 0.9997,
                "support": 2009973,
                "action": "COMPUTE",
                "conditions": {"quantity": values["quantity"], "unit_price": values["unit_price"]},
            }
        except (TypeError, ValueError):
            pass
    return inferred, suggestions, conflicts


def next_questions(values: Dict[str, Any], missing_fields: List[str], rules: List[Rule], dataset: str) -> List[Dict[str, Any]]:
    known = enrich_values(values)
    questions = []
    for field in missing_fields:
        if field in known:
            continue
        impact = 0
        examples = []
        for rule in rules:
            if rule.dataset != dataset or field not in rule.conditions:
                continue
            if any(cond_field != field and known.get(cond_field) != cond_value for cond_field, cond_value in rule.conditions.items()):
                continue
            impact += 1
            if len(examples) < 5:
                examples.append({"can_infer": rule.then_field, "if_value": rule.conditions[field], "confidence": rule.confidence, "support": rule.support})
        priority = ASK_PRIORITY.index(field) if field in ASK_PRIORITY else len(ASK_PRIORITY)
        questions.append({"field": field, "impact": impact, "priority": priority, "source": "external" if field in EXTERNAL_FIELDS else "user", "examples": examples})
    questions.sort(key=lambda item: (-item["impact"], item["priority"]))
    return questions


def autofill(payload: Dict[str, Any], report_dir: Path) -> Dict[str, Any]:
    rules = load_rules(report_dir)
    declaration = payload.get("declaration") if isinstance(payload.get("declaration"), dict) else {k: v for k, v in payload.items() if k != "cargo"}
    decl_inferred, decl_suggestions, decl_conflicts = apply_rules("declaration", declaration, rules)
    memory = payload.get("memory") if isinstance(payload.get("memory"), dict) else {}
    memory_preferences = memory.get("preferences", []) if isinstance(memory.get("preferences"), list) else []
    for pref in memory_preferences:
        field = pref.get("field")
        confidence = float(pref.get("confidence", 0))
        if field and field not in declaration and field not in decl_inferred and confidence >= 0.8:
            memory_action = "MEMORY_AUTOFILL" if confidence >= 0.95 and int(pref.get("positive_count", 0)) >= 5 else "MEMORY_SUGGEST"
            decl_suggestions.insert(
                0,
                {
                    "field": field,
                    "value": pref.get("value"),
                    "confidence": confidence,
                    "support": pref.get("positive_count", 0),
                    "action": memory_action,
                    "conditions": pref.get("scope", {}),
                },
            )

    cargo_outputs = []
    for line in payload.get("cargo", []) or []:
        if not isinstance(line, dict):
            continue
        line_values = {**line}
        if "direction" not in line_values and "direction" in decl_inferred:
            line_values["direction"] = decl_inferred["direction"]["value"]
        if "operation_code" not in line_values and present(declaration.get("operation_code")):
            line_values["operation_code"] = declaration["operation_code"]
        inferred, suggestions, conflicts = apply_rules("cargo", line_values, rules)
        cargo_outputs.append(
            {
                "line": line.get("line"),
                "inferred": inferred,
                "suggestions": suggestions[:20],
                "conflicts": conflicts[:20],
                "next_questions": next_questions(line_values, CARGO_FIELDS, rules, "cargo")[:5],
            }
        )

    return {
        "declaration": {
            "inferred": decl_inferred,
            "suggestions": decl_suggestions[:30],
            "conflicts": decl_conflicts[:30],
            "next_questions": next_questions(declaration, DECLARATION_FIELDS, rules, "declaration")[:8],
        },
        "cargo": cargo_outputs,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Generic VVMV autofill engine")
    parser.add_argument("--report-dir", type=Path, default=DEFAULT_REPORT_DIR)
    parser.add_argument("--input-json")
    parser.add_argument("--input-file", type=Path)
    args = parser.parse_args()
    raw = args.input_json
    if args.input_file:
        raw = args.input_file.read_text(encoding="utf-8")
    payload = json.loads(raw or "{}")
    print(json.dumps(autofill(payload, args.report_dir), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
