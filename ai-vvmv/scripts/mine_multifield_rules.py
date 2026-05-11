#!/usr/bin/env python3
"""Mine multi-field rules such as A+B -> C from VVMV analytics data."""

from __future__ import annotations

import argparse
import itertools
import json
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DECL = ROOT / "llm-dataset" / "ai-assets" / "analytics" / "declarations_compact.jsonl"
DEFAULT_CARGO = ROOT / "llm-dataset" / "ai-assets" / "analytics" / "cargo_facts.jsonl"
DEFAULT_OUT = ROOT / "llm-dataset" / "ai-assets" / "reports"

DECL_RULE_FIELDS = [
    "direction",
    "operation_code",
    "customs_code",
    "export_country",
    "import_country",
    "delivery_term",
    "currency",
    "port_code",
]
DECL_TARGETS = [
    "direction",
    "customs_code",
    "export_country",
    "import_country",
    "delivery_term",
    "currency",
    "port_code",
]
CARGO_RULE_FIELDS = [
    "direction",
    "operation_code",
    "customs_code",
    "hs2",
    "hs4",
    "hs6",
    "origin",
    "unit",
    "tax_code",
]
CARGO_TARGETS = ["direction", "customs_code", "origin", "unit", "tax_code", "hs2", "hs4"]


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
    return str(value).strip()


def enrich_cargo(rec: Dict[str, Any]) -> Dict[str, str]:
    out = {field: norm(rec.get(field)) for field in CARGO_RULE_FIELDS}
    hs = norm(rec.get("hs_code"))
    out["hs2"] = hs[:2] if len(hs) >= 2 else ""
    out["hs4"] = hs[:4] if len(hs) >= 4 else ""
    out["hs6"] = hs[:6] if len(hs) >= 6 else ""
    return out


def condition_key(values: Dict[str, str], fields: Tuple[str, ...]) -> Tuple[Tuple[str, str], ...] | None:
    pairs = []
    for field in fields:
        value = values.get(field, "")
        if not value:
            return None
        pairs.append((field, value))
    return tuple(pairs)


def specificity_score(rule: Dict[str, Any]) -> Tuple[int, float, int]:
    return (len(rule["conditions"]), rule["confidence"], rule["support"])


def mine_rules(
    path: Path,
    condition_fields: List[str],
    targets: List[str],
    dataset: str,
    min_support: int,
    threshold: float,
    max_arity: int,
    max_rows: int = 0,
) -> List[Dict[str, Any]]:
    condition_combos = []
    for arity in range(2, max_arity + 1):
        condition_combos.extend(itertools.combinations(condition_fields, arity))

    condition_counts: Counter = Counter()
    for row_no, rec in enumerate(iter_jsonl(path), 1):
        if max_rows and row_no > max_rows:
            break
        values = enrich_cargo(rec) if dataset == "cargo" else {field: norm(rec.get(field)) for field in condition_fields}
        for combo in condition_combos:
            cond = condition_key(values, combo)
            if not cond:
                continue
            condition_counts[cond] += 1

    eligible_conditions = {cond for cond, count in condition_counts.items() if count >= min_support}
    counts: Dict[Tuple[Tuple[Tuple[str, str], ...], str], Counter] = defaultdict(Counter)
    for row_no, rec in enumerate(iter_jsonl(path), 1):
        if max_rows and row_no > max_rows:
            break
        values = enrich_cargo(rec) if dataset == "cargo" else {field: norm(rec.get(field)) for field in condition_fields}
        for combo in condition_combos:
            cond = condition_key(values, combo)
            if not cond or cond not in eligible_conditions:
                continue
            cond_fields = {field for field, _ in cond}
            for target in targets:
                if target in cond_fields:
                    continue
                target_value = values.get(target) if dataset == "cargo" else norm(rec.get(target))
                if target_value:
                    counts[(cond, target)][target_value] += 1

    rules = []
    for (cond, target), counter in counts.items():
        total = sum(counter.values())
        if total < min_support:
            continue
        value, support = counter.most_common(1)[0]
        confidence = support / total
        if support < min_support or confidence < threshold:
            continue
        rules.append(
            {
                "dataset": dataset,
                "conditions": [{"field": field, "value": value} for field, value in cond],
                "then_field": target,
                "then_value": value,
                "support": int(support),
                "total": int(total),
                "confidence": round(confidence, 4),
                "alternatives": [[k, int(v)] for k, v in counter.most_common(5)],
            }
        )
    rules.sort(key=specificity_score, reverse=True)
    return rules


def keep_rules_with_lift(multirules: List[Dict[str, Any]], pair_rules: List[Dict[str, Any]], min_lift: float) -> List[Dict[str, Any]]:
    best_pair = {}
    for rule in pair_rules:
        for cond in rule["conditions"]:
            key = (cond["field"], cond["value"], rule["then_field"], rule["then_value"])
            best_pair[key] = max(best_pair.get(key, 0.0), rule["confidence"])

    kept = []
    for rule in multirules:
        base = 0.0
        for cond in rule["conditions"]:
            key = (cond["field"], cond["value"], rule["then_field"], rule["then_value"])
            base = max(base, best_pair.get(key, 0.0))
        rule["best_single_condition_confidence"] = round(base, 4)
        rule["confidence_lift"] = round(rule["confidence"] - base, 4)
        if len(rule["conditions"]) == 2 or rule["confidence_lift"] >= min_lift:
            kept.append(rule)
    return kept


def build_markdown(result: Dict[str, Any]) -> str:
    lines = [
        "# Multi-field Logic Rules",
        "",
        f"- Generated: `{result['generated_at']}`",
        f"- Min support: `{result['params']['min_support']}`",
        f"- Confidence: `{result['params']['confidence']}`",
        "",
    ]
    for key, title in [("declaration_rules", "Declaration"), ("cargo_rules", "Cargo")]:
        lines.extend([f"## {title}", "", "| Conditions | Then | Support | Confidence | Lift |", "|---|---|---:|---:|---:|"])
        for rule in result[key][:100]:
            cond = " + ".join(f"`{c['field']}={c['value']}`" for c in rule["conditions"])
            then = f"`{rule['then_field']}={rule['then_value']}`"
            lines.append(
                f"| {cond} | {then} | {rule['support']:,}/{rule['total']:,} | "
                f"{rule['confidence']:.2%} | {rule.get('confidence_lift', 0):.2%} |"
            )
        lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Mine multi-field VVMV rules")
    parser.add_argument("--declarations", type=Path, default=DEFAULT_DECL)
    parser.add_argument("--cargo", type=Path, default=DEFAULT_CARGO)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--min-support", type=int, default=500)
    parser.add_argument("--confidence", type=float, default=0.98)
    parser.add_argument("--max-arity", type=int, default=3)
    parser.add_argument("--min-lift", type=float, default=0.02)
    parser.add_argument("--decl-max-rows", type=int, default=0)
    parser.add_argument("--cargo-max-rows", type=int, default=0)
    args = parser.parse_args()

    started = time.time()
    decl_rules = mine_rules(
        args.declarations,
        DECL_RULE_FIELDS,
        DECL_TARGETS,
        "declaration",
        args.min_support,
        args.confidence,
        args.max_arity,
        args.decl_max_rows,
    )
    cargo_rules = mine_rules(
        args.cargo,
        CARGO_RULE_FIELDS,
        CARGO_TARGETS,
        "cargo",
        args.min_support,
        args.confidence,
        args.max_arity,
        args.cargo_max_rows,
    )
    decl_pairs = [rule for rule in decl_rules if len(rule["conditions"]) == 2]
    cargo_pairs = [rule for rule in cargo_rules if len(rule["conditions"]) == 2]
    result = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "elapsed_seconds": round(time.time() - started, 2),
        "params": {
            "min_support": args.min_support,
            "confidence": args.confidence,
            "max_arity": args.max_arity,
            "min_lift": args.min_lift,
            "decl_max_rows": args.decl_max_rows,
            "cargo_max_rows": args.cargo_max_rows,
        },
        "declaration_rules": keep_rules_with_lift(decl_rules, decl_pairs, args.min_lift),
        "cargo_rules": keep_rules_with_lift(cargo_rules, cargo_pairs, args.min_lift),
    }
    args.output_dir.mkdir(parents=True, exist_ok=True)
    json_path = args.output_dir / "multifield_rules.json"
    md_path = args.output_dir / "multifield_rules.md"
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(build_markdown(result), encoding="utf-8")
    print(json.dumps({"json": str(json_path), "markdown": str(md_path), "elapsed_seconds": result["elapsed_seconds"], "declaration_rules": len(result["declaration_rules"]), "cargo_rules": len(result["cargo_rules"])}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
