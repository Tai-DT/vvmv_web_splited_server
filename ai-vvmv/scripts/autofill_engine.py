"""
Autofill Engine — Tờ khai hải quan VVMV
Dựa trên mô hình tương quan đa node từ 563,919 tờ khai + 2,012,434 dòng hàng.

Version 2.0 — thêm 3-way rules, HS4-level unit override, HS6-level tax override,
anomaly detection theo ngưỡng giá thực tế.

Nguyên tắc:
  confidence >= 0.99  → AUTOFILL  (truyền thẳng, không hỏi)
  confidence 0.80-0.98 → SUGGEST  (gợi ý có confidence, user confirm)
  confidence 0.70-0.79 → HINT     (gợi ý nhẹ)
  confidence < 0.70   → ASK       (bắt buộc hỏi user)
"""

from __future__ import annotations
import argparse
from dataclasses import dataclass, field
from typing import Optional, Any
import json

# ─── Constants ────────────────────────────────────────────────────────────────

AUTOFILL_THRESHOLD = 0.99
SUGGEST_THRESHOLD  = 0.80
HINT_THRESHOLD     = 0.70

# ─── Data model ───────────────────────────────────────────────────────────────

@dataclass
class FieldResult:
    value: Any
    confidence: float
    source: str          # e.g. "operation_code→import_country"
    action: str          # "AUTOFILL" | "SUGGEST" | "HINT" | "ASK"
    alternatives: list = field(default_factory=list)  # [(value, pct), ...]

    def __repr__(self):
        return f"[{self.action}] {self.value} ({self.confidence*100:.1f}%) ← {self.source}"

def _classify(confidence: float) -> str:
    if confidence >= AUTOFILL_THRESHOLD: return "AUTOFILL"
    if confidence >= SUGGEST_THRESHOLD:  return "SUGGEST"
    if confidence >= HINT_THRESHOLD:     return "HINT"
    return "ASK"

# ─── Declaration-level rules ──────────────────────────────────────────────────

# operation_code → direction  (100% for all major ops)
OP_TO_DIRECTION = {
    "E11":"N","E13":"N","E15":"N","E21":"N","E31":"N",
    "A11":"N","A12":"N","A41":"N","A42":"N","A43":"N",
    "A31":"N","G12":"N","G13":"N","G51":"N","H11":"N",
    "E42":"X","B11":"X","B13":"X","E52":"X","E62":"X",
    "G22":"X","G23":"X","G61":"X","H21":"X",
}

# operation_code → import_country (100%)
OP_TO_IMPORT_COUNTRY = {op: "VN" for op in
    ["E11","E13","E15","E21","E31","A11","A12","A41","A42","A43","A31","G12","G13","G51","H11"]}

# operation_code → export_country (100%)
OP_TO_EXPORT_COUNTRY = {op: "VN" for op in
    ["E42","B11","B13","E52","E62","G22","G23","G61","H21"]}
OP_TO_EXPORT_COUNTRY["E15"] = "VN"   # 93.9%

# operation_code → currency
OP_TO_CURRENCY = {
    # AUTOFILL (>=99%)
    # none at op level alone, but combined with country → see below
    # SUGGEST (80-99%)
    "E42": ("USD", 0.954), "E62": ("USD", 0.917), "G23": ("USD", 0.924),
    "A43": ("USD", 0.970), "G13": ("USD", 0.907), "E52": ("USD", 0.950),
    "A41": ("USD", 0.861), "E11": ("USD", 0.851), "H11": ("USD", 0.815),
    "A12": ("USD", 0.800), "E31": ("USD", 0.741), "B13": ("USD", 0.840),
    "H21": ("USD", 0.846),
    # VND-leaning
    "E13": ("VND", 0.518), "B11": ("USD", 0.650),
    "E15": ("USD", 0.638),
    # JPY-leaning
    "E21": ("JPY", 0.579),
}

# export_country (source of goods / destination) → currency  (AUTOFILL >=99%)
COUNTRY_TO_CURRENCY_AUTOFILL = {
    "PH": "USD", "KH": "USD", "US": "USD", "NZ": "USD",
    "TW": "USD", "MY": "USD",
}
COUNTRY_TO_CURRENCY_SUGGEST = {
    "ID": ("USD",0.986), "FI": ("USD",0.985), "HK": ("USD",0.979),
    "SE": ("USD",0.977), "CN": ("USD",0.969), "TH": ("USD",0.955),
    "SG": ("USD",0.920), "KR": ("USD",0.917), "MO": ("USD",0.913),
    "FR": ("EUR",0.910), "DE": ("USD",0.967), "GB": ("USD",0.960),
    "AU": ("USD",0.960), "CA": ("USD",0.960), "BE": ("USD",0.960),
    "NL": ("USD",0.960), "JP": ("JPY",0.579),
}

# operation_code → delivery_term
OP_TO_DELIVERY = {
    "A43": ("FCA", 1.000),  # AUTOFILL
    "E15": ("DAP", 0.824),  # SUGGEST
    "E21": ("CIF", 0.625),  # HINT
    "G51": ("CIF", 0.566),  # HINT
    "E13": ("DAP", 0.490),  # ASK
    "A41": ("EXW", 0.610),  # HINT
    "E11": ("EXW", 0.381),  # ASK
    "A12": ("EXW", 0.490),  # ASK
    "E31": ("EXW", 0.458),  # ASK
    "E42": ("FOB", 0.477),  # ASK
    "B11": ("DAP", 0.483),  # ASK
    "G61": ("DAP", 0.593),  # HINT
    "E62": ("EXW", 0.407),  # ASK
    "B13": ("FCA", 0.554),  # HINT
}

# operation_code → port_code
OP_TO_PORT = {
    "A42": ("VNZZZ", 0.994),  # AUTOFILL
    "E15": ("VNZZZ", 0.885),  # SUGGEST
    "B11": ("VNZZZ", 0.747),  # HINT
    "E21": ("VNHAN", 0.532),  # HINT
    "A41": ("VNSGN", 0.561),  # HINT
    "E11": ("VNSGN", 0.582),  # HINT
    "B13": ("VNSGN", 0.496),  # ASK
    "E62": ("VNZZZ", 0.415),  # ASK
    "G51": ("VNZZZ", 0.512),  # HINT
}

# port_code → customs_code (AUTOFILL = border crossings)
PORT_TO_CUSTOMS_AUTOFILL = {
    "VNXQL": "01NV", "VNXBX": "03PL", "VNXCR": "03PL",
    "VNXCV": "03PL", "VNXPD": "01NV", "VNXQR": "01NV",
    "VNNLV": "03PJ", "VNXAV": "03PJ", "VNXQZ": "01NV",
}
PORT_TO_CUSTOMS_SUGGEST = {
    "VNFBB": ("61PA", 0.668), "VNSGN": ("43NF", 0.675),
    "VNCLI": ("43NF", 0.554), "VNHAN": ("18ID", 0.327),
    "VNHPH": ("01NV", 0.399), "VNZZZ": ("43NF", 0.180),
}

# customs_code → port_code (AUTOFILL)
CUSTOMS_TO_PORT_AUTOFILL = {
    "02B1": "VNSGN", "01DD": "VNHAN", "02DS": "VNSGN", "01B1": "VNHAN",
}

# delivery_term → currency (SUGGEST)
DELIVERY_TO_CURRENCY = {
    "DDU": ("USD", 0.978), "CIF": ("USD", 0.877),
    "DAP": ("USD", 0.857), "EXW": ("USD", 0.793),
}

# delivery_term → port_code (SUGGEST)
DELIVERY_TO_PORT = {
    "DDU": ("VNZZZ", 0.856), "CPT": ("VNZZZ", 0.804),
    "DAP": ("VNZZZ", 0.723),
}

# ─── Cargo-level rules ────────────────────────────────────────────────────────

# HS4-level unit override — checked BEFORE hs2 (more specific, from deep analysis)
HS4_TO_UNIT_OVERRIDE = {
    # Da thuộc → FTK (sqft) — 99%+
    "4104": ("FTK", 0.997), "4107": ("FTK", 0.990),
    # Vải đặc biệt → MTK — 95%+
    "5512": ("MTK", 0.993), "6001": ("MTK", 0.992),
    "6004": ("MTK", 0.954), "5208": ("MTK", 0.956),
    "5407": ("MTK", 0.874),
    # Hóa chất/nhựa nguyên liệu → KGM — 95%+
    "7107": ("KGM", 1.000), "3302": ("KGM", 1.000),
    "5509": ("KGM", 0.998), "7223": ("KGM", 0.997),
    "3903": ("KGM", 0.996), "3404": ("KGM", 0.996),
    "7215": ("KGM", 0.996), "4005": ("KGM", 0.992),
    "3908": ("KGM", 0.977), "5402": ("KGM", 0.974),
    "3907": ("KGM", 0.973), "3909": ("KGM", 0.967),
    "3902": ("KGM", 0.961), "7220": ("KGM", 0.959),
    "3906": ("KGM", 0.955), "7212": ("KGM", 0.989),
    "3824": ("KGM", 0.913), "3215": ("KGM", 0.983),
    "7204": ("KGM", 0.996), "7408": ("KGM", 0.967),
    "8003": ("KGM", 0.991),
    # Bộ/set — SET — 99%+
    "9019": ("SET", 1.000), "6112": ("SET", 0.997),
    # Giày/mũ giày → PR — 100%
    "6406": ("PR",  1.000),
}

# hs2 → unit (AUTOFILL >=99%)
HS2_TO_UNIT_AUTOFILL = {
    "41": "FTK",   # Da thuộc — sqft
    "87": "PCE",   # Xe cộ
}
# hs2 → unit (SUGGEST 80-99%)
HS2_TO_UNIT_SUGGEST = {
    "61": ("PCE", 0.967), "62": ("PCE", 0.996), "90": ("PCE", 0.993),
    "85": ("PCE", 0.918), "73": ("PCE", 0.905), "84": ("PCE", 0.848),
    "49": ("PCE", 0.961), "96": ("PCE", 0.838), "58": ("PCE", 0.969),
    "39": ("PCE", 0.682), "48": ("PCE", 0.723),
    "60": ("MTK",  0.944),  # Vải dệt kim — bắt buộc MTK
    "64": ("PR",   0.999),  # Giày dép — bắt buộc đôi
}

# HS6-level tax code override (import only) — overrides HS2 default
HS6_TO_TAX_OVERRIDE_N = {
    "580710": ("B01", 0.98),  # Nhãn vải dệt thoi → miễn thuế
    "580890": ("B01", 0.96),  # Dây dệt nhãn
    "600410": ("B01", 0.95),  # Vải lưới dệt kim gia công
    "732690": ("B04", 0.92),  # Gá/jig kiểm tra → thuế tự vệ
    "902140": ("B01", 0.98),  # Máy trợ thính
    "902190": ("B01", 0.97),  # Phụ kiện máy trợ thính
    "391910": ("B30", 0.95),  # Nhãn film
}

# Unit price anomaly thresholds per HS4 (p90 × 3 = max_ok)
# If unit_price > max_ok → HIGH anomaly; if < p10 / 10 → LOW anomaly
HS4_PRICE_BOUNDS = {
    #  hs4    p10     p90     max_ok
    "3926": (0.037,  24.57,  73.71),
    "8542": (0.042,  40.82, 122.46),
    "5807": (0.009,   2.00,   6.00),
    "4821": (0.004,   0.83,   2.49),
    "8544": (0.043, 193.0,  579.0),
    "8523": (0.022,   0.057,  0.17),
    "9607": (0.128,   1.084,  3.25),
    "4908": (0.031,   0.95,   2.85),
    "6006": (0.829,   4.386, 13.16),
    "8518": (2.150,   9.720, 29.16),
    "9021": (6.000,  46.73, 140.19),
    "4107": (2.050,   4.40,  13.20),
    "4805": (0.735,   1.405,  4.21),
    "5402": (5.030,  20.30,  60.90),
    "6004": (1.884,   7.873, 23.62),
    "5401": (0.490,  39.29, 117.86),
    "4819": (0.498, 22290.0, 66870.0),
}

# operation_code → cargo tax_code (AUTOFILL >=99.9%)
OP_TO_CARGO_TAX_AUTOFILL = {
    "E11": "B30", "E13": "B30", "E15": "B30",  # 99.9-99.97%
    "A43": "B01",                                # 100%
}
# operation_code → cargo tax_code (SUGGEST 90-99%)
OP_TO_CARGO_TAX_SUGGEST = {
    "A12": ("B01", 0.95), "E31": ("B01", 0.978),
    "H11": ("B01", 0.966), "A42": ("B01", 0.932),
    "E21": ("B30", 0.894), "G51": ("B30", 0.90),
}

# hs2 → tax_code import (SUGGEST)
HS2_TO_TAX_SUGGEST = {
    "60": ("B30", 0.973), "48": ("B30", 0.827), "39": ("B30", 0.779),
    "85": ("B30", 0.777), "84": ("B30", 0.659), "73": ("B30", 0.667),
    "49": ("B01", 0.571),   # B01 > B30 cho sách
    "58": ("B30", 0.665),
}

# ─── Engine ───────────────────────────────────────────────────────────────────

class DeclarationAutofill:
    """
    Stateful autofill engine.
    Call set_field() to add known values; call infer() to get recommendations.
    """

    def __init__(self):
        self.known: dict[str, Any] = {}

    def set_field(self, field: str, value: Any):
        """Set a known field value."""
        self.known[field] = value

    def infer(self) -> dict[str, FieldResult]:
        """Run all rules and return inferences for unknown fields."""
        results: dict[str, FieldResult] = {}

        def _set(fname, val, conf, source, alts=None):
            if fname in self.known: return  # already set
            action = _classify(conf)
            results[fname] = FieldResult(val, conf, source, action, alts or [])

        op  = self.known.get("operation_code")
        dir = self.known.get("direction")
        exp = self.known.get("export_country")
        imp = self.known.get("import_country")
        port = self.known.get("port_code")
        cus  = self.known.get("customs_code")
        dt   = self.known.get("delivery_term")
        cur  = self.known.get("currency")

        # ── 1. operation_code → direction ─────────────────────────────────────
        if op and op in OP_TO_DIRECTION and "direction" not in self.known:
            _set("direction", OP_TO_DIRECTION[op], 1.00, f"operation_code={op}→direction")

        # infer direction from known
        if "direction" not in self.known and op:
            inferred_dir = OP_TO_DIRECTION.get(op)
            if inferred_dir:
                dir = inferred_dir  # use locally

        # ── 2. operation_code → import/export country ─────────────────────────
        if op:
            if op in OP_TO_IMPORT_COUNTRY:
                _set("import_country", OP_TO_IMPORT_COUNTRY[op], 1.00, f"operation_code={op}→import_country")
            if op in OP_TO_EXPORT_COUNTRY:
                conf = 0.939 if op == "E15" else 1.00
                _set("export_country", OP_TO_EXPORT_COUNTRY[op], conf, f"operation_code={op}→export_country")

        # ── 3. export_country/import_country → currency ───────────────────────
        # Use export_country (for N=import: this is origin country)
        country_ref = exp or imp
        if country_ref:
            if country_ref in COUNTRY_TO_CURRENCY_AUTOFILL:
                _set("currency", COUNTRY_TO_CURRENCY_AUTOFILL[country_ref], 0.995,
                     f"export_country={country_ref}→currency")
            elif country_ref in COUNTRY_TO_CURRENCY_SUGGEST:
                val, conf = COUNTRY_TO_CURRENCY_SUGGEST[country_ref]
                _set("currency", val, conf, f"export_country={country_ref}→currency")

        # ── 4. operation_code → currency (fallback) ───────────────────────────
        if op and op in OP_TO_CURRENCY and "currency" not in results and "currency" not in self.known:
            val, conf = OP_TO_CURRENCY[op]
            _set("currency", val, conf, f"operation_code={op}→currency")

        # ── 5. delivery_term → currency (lower priority) ──────────────────────
        if dt and dt in DELIVERY_TO_CURRENCY and "currency" not in results and "currency" not in self.known:
            val, conf = DELIVERY_TO_CURRENCY[dt]
            _set("currency", val, conf, f"delivery_term={dt}→currency")

        # ── 6. operation_code → delivery_term ────────────────────────────────
        if op and op in OP_TO_DELIVERY:
            val, conf = OP_TO_DELIVERY[op]
            _set("delivery_term", val, conf, f"operation_code={op}→delivery_term")

        # ── 7. operation_code → port_code ─────────────────────────────────────
        if op and op in OP_TO_PORT:
            val, conf = OP_TO_PORT[op]
            _set("port_code", val, conf, f"operation_code={op}→port_code")

        # ── 8. delivery_term → port_code ──────────────────────────────────────
        if dt and dt in DELIVERY_TO_PORT and "port_code" not in results and "port_code" not in self.known:
            val, conf = DELIVERY_TO_PORT[dt]
            _set("port_code", val, conf, f"delivery_term={dt}→port_code")

        # ── 9. port_code → customs_code ───────────────────────────────────────
        effective_port = port or (results.get("port_code") and results["port_code"].value)
        if effective_port:
            if effective_port in PORT_TO_CUSTOMS_AUTOFILL:
                _set("customs_code", PORT_TO_CUSTOMS_AUTOFILL[effective_port], 1.00,
                     f"port_code={effective_port}→customs_code")
            elif effective_port in PORT_TO_CUSTOMS_SUGGEST:
                val, conf = PORT_TO_CUSTOMS_SUGGEST[effective_port]
                _set("customs_code", val, conf, f"port_code={effective_port}→customs_code")

        # ── 10. customs_code → port_code ──────────────────────────────────────
        if cus and cus in CUSTOMS_TO_PORT_AUTOFILL and "port_code" not in results and "port_code" not in self.known:
            _set("port_code", CUSTOMS_TO_PORT_AUTOFILL[cus], 0.999,
                 f"customs_code={cus}→port_code")

        return results


class CargoAutofill:
    """Autofill engine for a single cargo line."""

    def __init__(self, direction: str, operation_code: str, hs_code: str = "", origin: str = ""):
        self.direction = direction
        self.operation_code = operation_code
        self.hs_code = str(hs_code)
        self.hs2 = self.hs_code[:2] if len(self.hs_code) >= 2 else ""
        self.origin = origin

    def infer(self) -> dict[str, FieldResult]:
        results = {}

        def _set(fname, val, conf, source):
            action = _classify(conf)
            results[fname] = FieldResult(val, conf, source, action)

        op, hs2, dir, origin = self.operation_code, self.hs2, self.direction, self.origin

        hs4 = str(self.hs_code)[:4] if len(str(self.hs_code)) >= 4 else ""
        hs6 = str(self.hs_code)[:6] if len(str(self.hs_code)) >= 6 else ""

        # ── unit ─────────────────────────────────────────────────────────────
        # Priority: HS4 override > HS2 rule > operation rule
        if hs4 in HS4_TO_UNIT_OVERRIDE:
            val, conf = HS4_TO_UNIT_OVERRIDE[hs4]
            _set("unit", val, conf, f"hs4={hs4}→unit (override)")
        elif hs2 in HS2_TO_UNIT_AUTOFILL:
            _set("unit", HS2_TO_UNIT_AUTOFILL[hs2], 0.995, f"hs2={hs2}→unit")
        elif hs2 in HS2_TO_UNIT_SUGGEST:
            val, conf = HS2_TO_UNIT_SUGGEST[hs2]
            _set("unit", val, conf, f"hs2={hs2}→unit")
        elif op == "A43":
            _set("unit", "PCE", 1.00, f"operation_code={op}→unit")

        # ── tax_code ─────────────────────────────────────────────────────────
        # Priority for import: HS6 override > operation rule > HS2 rule > default
        if dir == "X":
            _set("tax_code", "", 0.984, f"direction=X→tax_code=blank")
        elif dir == "N":
            if hs6 in HS6_TO_TAX_OVERRIDE_N:
                val, conf = HS6_TO_TAX_OVERRIDE_N[hs6]
                _set("tax_code", val, conf, f"hs6={hs6}→tax_code (override)")
            elif op in OP_TO_CARGO_TAX_AUTOFILL:
                _set("tax_code", OP_TO_CARGO_TAX_AUTOFILL[op], 0.999, f"operation_code={op}→tax_code")
            elif op in OP_TO_CARGO_TAX_SUGGEST:
                val, conf = OP_TO_CARGO_TAX_SUGGEST[op]
                _set("tax_code", val, conf, f"operation_code={op}→tax_code")
            elif hs2 in HS2_TO_TAX_SUGGEST:
                val, conf = HS2_TO_TAX_SUGGEST[hs2]
                _set("tax_code", val, conf, f"hs2={hs2}→tax_code")
            else:
                _set("tax_code", "B30", 0.75, "default→B30")

        # ── origin ───────────────────────────────────────────────────────────
        if dir == "X":
            if op in ("E42", "E62", "E52"):
                _set("origin", "VN", 0.999, f"operation_code={op}→cargo.origin=VN")
            else:
                _set("origin", "VN", 0.856, f"direction=X→cargo.origin=VN")

        return results

    def check_price_anomaly(self, unit_price: float) -> tuple[str, str]:
        """
        Check if unit_price is anomalous for this HS code.
        Returns (status, message): status = "OK" | "HIGH" | "LOW"
        """
        hs4 = str(self.hs_code)[:4] if len(str(self.hs_code)) >= 4 else ""
        if hs4 not in HS4_PRICE_BOUNDS:
            return "UNKNOWN", "No price data for this HS4"
        p10, p90, max_ok = HS4_PRICE_BOUNDS[hs4]
        if unit_price > max_ok:
            return "HIGH", f"HS{hs4}: giá {unit_price:.2f} vượt ngưỡng {max_ok:.2f} (p90×3). Kiểm tra lại."
        if unit_price < p10 / 10:
            return "LOW", f"HS{hs4}: giá {unit_price:.4f} thấp bất thường (p10={p10}). Kiểm tra đơn vị tính."
        return "OK", f"HS{hs4}: giá nằm trong khoảng bình thường [{p10:.3f} - {max_ok:.2f}]"


# ─── Demo / CLI ───────────────────────────────────────────────────────────────

def demo():
    print("=" * 60)
    print("DEMO 1: Nhập khẩu E11 từ Mỹ")
    print("=" * 60)
    eng = DeclarationAutofill()
    eng.set_field("operation_code", "E11")
    eng.set_field("export_country", "US")   # nguồn hàng
    for fname, res in eng.infer().items():
        print(f"  {fname:20} → {res}")

    print()
    print("=" * 60)
    print("DEMO 2: Xuất khẩu E42 sang Mỹ")
    print("=" * 60)
    eng2 = DeclarationAutofill()
    eng2.set_field("operation_code", "E42")
    eng2.set_field("import_country", "US")   # nước đến
    for fname, res in eng2.infer().items():
        print(f"  {fname:20} → {res}")

    print()
    print("=" * 60)
    print("DEMO 3: Nhập nội địa E15 (KCX → nội địa)")
    print("=" * 60)
    eng3 = DeclarationAutofill()
    eng3.set_field("operation_code", "E15")
    for fname, res in eng3.infer().items():
        print(f"  {fname:20} → {res}")

    print()
    print("=" * 60)
    print("DEMO 4: Cargo E42 xuất, HS 610910 (áo thun dệt kim)")
    print("=" * 60)
    cargo = CargoAutofill(direction="X", operation_code="E42", hs_code="610910")
    for fname, res in cargo.infer().items():
        print(f"  {fname:20} → {res}")

    print()
    print("=" * 60)
    print("DEMO 5: Cargo E11 nhập, HS 600610 (vải dệt kim)")
    print("=" * 60)
    cargo2 = CargoAutofill(direction="N", operation_code="E11", hs_code="600610")
    for fname, res in cargo2.infer().items():
        print(f"  {fname:20} → {res}")

    print()
    print("=" * 60)
    print("DEMO 6: Xuất qua cửa khẩu biên giới Cầu Treo (VNXCR)")
    print("=" * 60)
    eng4 = DeclarationAutofill()
    eng4.set_field("operation_code", "E42")
    eng4.set_field("port_code", "VNXCR")
    for fname, res in eng4.infer().items():
        print(f"  {fname:20} → {res}")


def demo_v2():
    print("\n" + "="*60)
    print("DEMO 7: 3-way rule — E31 + nguồn HK → currency")
    print("="*60)
    eng = DeclarationAutofill()
    eng.set_field("operation_code", "E31")
    eng.set_field("export_country", "HK")
    for fname, res in eng.infer().items():
        print(f"  {fname:20} → {res}")

    print("\n" + "="*60)
    print("DEMO 8: HS4 override — da thuộc 4107 (FTK)")
    print("="*60)
    cargo = CargoAutofill(direction="N", operation_code="A12", hs_code="410799")
    for fname, res in cargo.infer().items():
        print(f"  {fname:20} → {res}")

    print("\n" + "="*60)
    print("DEMO 9: HS6 tax override — nhãn vải 580710 (B01 không phải B30)")
    print("="*60)
    cargo2 = CargoAutofill(direction="N", operation_code="E11", hs_code="580710")
    for fname, res in cargo2.infer().items():
        print(f"  {fname:20} → {res}")

    print("\n" + "="*60)
    print("DEMO 10: HS6 tax override — gá/jig 732690 (B04)")
    print("="*60)
    cargo3 = CargoAutofill(direction="N", operation_code="E11", hs_code="732690")
    for fname, res in cargo3.infer().items():
        print(f"  {fname:20} → {res}")

    print("\n" + "="*60)
    print("DEMO 11: Price anomaly check")
    print("="*60)
    # HS8542 IC — normal price $1.64
    c = CargoAutofill(direction="N", operation_code="E11", hs_code="854239")
    print(f"  IC giá $1.50: {c.check_price_anomaly(1.50)}")
    print(f"  IC giá $500:  {c.check_price_anomaly(500)}")   # too high
    print(f"  IC giá $0.001:{c.check_price_anomaly(0.001)}")  # too low

    # HS9021 Máy trợ thính — normal $30
    c2 = CargoAutofill(direction="X", operation_code="E42", hs_code="902140")
    print(f"  Trợ thính $30: {c2.check_price_anomaly(30)}")
    print(f"  Trợ thính $500:{c2.check_price_anomaly(500)}")  # very high

    print("\n" + "="*60)
    print("DEMO 12: Xuất E42 + A41 + HK → currency 3-way")
    print("="*60)
    eng2 = DeclarationAutofill()
    eng2.set_field("operation_code", "A41")
    eng2.set_field("export_country", "HK")
    for fname, res in eng2.infer().items():
        print(f"  {fname:20} → {res}")


def result_to_dict(result: FieldResult) -> dict[str, Any]:
    return {
        "value": result.value,
        "confidence": round(result.confidence, 4),
        "source": result.source,
        "action": result.action,
        "alternatives": result.alternatives,
    }


def infer_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    declaration_input = payload.get("declaration") if isinstance(payload.get("declaration"), dict) else payload
    declaration = DeclarationAutofill()
    for field, value in declaration_input.items():
        if value not in (None, "") and field != "cargo":
            declaration.set_field(field, value)

    output = {
        "declaration": {
            field: result_to_dict(result)
            for field, result in declaration.infer().items()
        },
        "cargo": [],
    }

    cargo_lines = payload.get("cargo") or declaration_input.get("cargo") or []
    if isinstance(cargo_lines, dict):
        cargo_lines = [cargo_lines]
    for line in cargo_lines:
        if not isinstance(line, dict):
            continue
        direction = line.get("direction") or declaration_input.get("direction") or output["declaration"].get("direction", {}).get("value") or ""
        operation = line.get("operation_code") or declaration_input.get("operation_code") or ""
        cargo = CargoAutofill(
            direction=str(direction),
            operation_code=str(operation),
            hs_code=str(line.get("hs_code") or ""),
            origin=str(line.get("origin") or ""),
        )
        inferred = {
            field: result_to_dict(result)
            for field, result in cargo.infer().items()
            if line.get(field) in (None, "")
        }
        if line.get("unit_price") not in (None, ""):
            level, message = cargo.check_price_anomaly(float(line["unit_price"]))
            inferred["unit_price_check"] = {"level": level, "message": message}
        output["cargo"].append({"line": line.get("line"), "inferred": inferred})
    return output


def main():
    parser = argparse.ArgumentParser(description="Infer missing customs declaration fields from learned VVMV rules")
    parser.add_argument("--input-json", help="JSON object with declaration fields and optional cargo lines")
    parser.add_argument("--input-file", help="Path to JSON file")
    parser.add_argument("--demo", action="store_true", help="Run built-in demos")
    args = parser.parse_args()

    if args.demo or (not args.input_json and not args.input_file):
        demo()
        demo_v2()
        return

    raw = args.input_json
    if args.input_file:
        with open(args.input_file, "r", encoding="utf-8") as fh:
            raw = fh.read()
    payload = json.loads(raw or "{}")
    print(json.dumps(infer_from_payload(payload), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
