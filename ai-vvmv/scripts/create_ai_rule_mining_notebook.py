from pathlib import Path
import nbformat as nbf

root = Path(__file__).resolve().parents[1]
nb_path = root / "notebooks" / "01_ai_rule_mining_discovery.ipynb"

nb = nbf.v4.new_notebook()
nb.metadata["kernelspec"] = {"display_name": "Python 3", "language": "python", "name": "python3"}
nb.metadata["language_info"] = {"name": "python", "pygments_lexer": "ipython3"}

cells = []

def md(text):
    cells.append(nbf.v4.new_markdown_cell(text.strip()))

def code(text):
    cells.append(nbf.v4.new_code_cell(text.strip()))

md("""
# AI Rule Mining Discovery — VVMV

Mục tiêu notebook này là **khám phá quy luật mới phục vụ AI/autofill** từ dữ liệu declaration + cargo.

Notebook tập trung vào:
- Rule 2 chiều: `A -> B` như `operation_code -> direction`, `country -> currency`
- Rule 3 chiều: `A + B -> C` như `operation_code + export_country -> currency`
- HS hierarchy: `hs2/hs4/hs6 -> unit/tax_code/origin`
- Candidate rules theo ngưỡng AI: AUTOFILL / SUGGEST / HINT / ASK
- Xuất kết quả ra `notebooks/outputs/*.csv|json` để review hoặc đưa vào engine
""")

code("""
from pathlib import Path
import sys
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

PROJECT_ROOT = Path.cwd().parent if Path.cwd().name == 'notebooks' else Path.cwd()
sys.path.insert(0, str(PROJECT_ROOT / 'notebooks' / 'lib'))

from ai_rule_mining import connect, register_views, q, dominant_rules, save, OUTPUT_DIR

pd.set_option('display.max_columns', 80)
pd.set_option('display.max_colwidth', 120)
sns.set_theme(style='whitegrid')
print(PROJECT_ROOT)
print(OUTPUT_DIR)
""")

md("""## 1. Load dữ liệu bằng DuckDB
DuckDB đọc trực tiếp JSONL nên không cần load toàn bộ vào RAM Pandas.""")
code("""
con = connect(memory_limit='8GB', threads=8)
register_views(con)

summary = q(con, '''
SELECT 'declarations' AS table_name, COUNT(*) AS rows FROM declarations
UNION ALL
SELECT 'cargo' AS table_name, COUNT(*) AS rows FROM cargo
''')
summary
""")

md("""## 2. Schema và độ phủ field
Trước khi mining rule, cần biết field nào đủ dữ liệu để tin cậy.""")
code("""
field_coverage = q(con, '''
WITH d AS (
  SELECT 'declarations' AS table_name, COUNT(*) AS n,
         SUM(direction IS NOT NULL AND direction <> '') AS direction,
         SUM(operation_code IS NOT NULL AND operation_code <> '') AS operation_code,
         SUM(export_country IS NOT NULL AND export_country <> '') AS export_country,
         SUM(import_country IS NOT NULL AND import_country <> '') AS import_country,
         SUM(delivery_term IS NOT NULL AND delivery_term <> '') AS delivery_term,
         SUM(currency IS NOT NULL AND currency <> '') AS currency,
         SUM(port_code IS NOT NULL AND port_code <> '') AS port_code,
         SUM(customs_code IS NOT NULL AND customs_code <> '') AS customs_code
  FROM declarations
), c AS (
  SELECT 'cargo' AS table_name, COUNT(*) AS n,
         SUM(direction IS NOT NULL AND direction <> '') AS direction,
         SUM(operation_code IS NOT NULL AND operation_code <> '') AS operation_code,
         SUM(origin IS NOT NULL AND origin <> '') AS origin,
         SUM(hs_code IS NOT NULL AND hs_code <> '') AS hs_code,
         SUM(unit IS NOT NULL AND unit <> '') AS unit,
         SUM(tax_code IS NOT NULL) AS tax_code,
         SUM(quantity IS NOT NULL) AS quantity,
         SUM(unit_price IS NOT NULL) AS unit_price,
         SUM(value IS NOT NULL) AS value
  FROM cargo
)
SELECT * FROM d
UNION ALL BY NAME
SELECT * FROM c
''')
field_coverage
""")

md("""## 3. Rule mining 2 chiều — declaration level
Các rule thống trị `A -> B`: chỉ lấy consequent phổ biến nhất cho mỗi antecedent.""")
code("""
declaration_pairs = [
    (['operation_code'], 'direction'),
    (['operation_code'], 'import_country'),
    (['operation_code'], 'export_country'),
    (['operation_code'], 'currency'),
    (['operation_code'], 'delivery_term'),
    (['operation_code'], 'port_code'),
    (['export_country'], 'currency'),
    (['import_country'], 'currency'),
    (['port_code'], 'customs_code'),
    (['customs_code'], 'port_code'),
]

all_decl_rules = []
for ants, target in declaration_pairs:
    df = dominant_rules(con, 'declarations', ants, target, min_support=100, min_confidence=0.70, limit=500)
    df.insert(0, 'rule_family', f"{'+'.join(ants)}->{target}")
    all_decl_rules.append(df)

decl_rules = pd.concat(all_decl_rules, ignore_index=True)
save(decl_rules, 'declaration_2way_rules.csv')
save(decl_rules, 'declaration_2way_rules.json')
decl_rules.head(30)
""")

code("""
# Candidate AUTOFILL/SUGGEST distribution
rule_counts = decl_rules.groupby(['rule_family', 'action']).size().reset_index(name='rules')
rule_counts.pivot(index='rule_family', columns='action', values='rules').fillna(0).astype(int)
""")

md("""## 4. Rule mining 3 chiều — declaration level
Tìm rule `A+B -> C`, rất hữu ích cho AI vì giảm nhập tay khi một field đơn lẻ chưa đủ tin cậy.""")
code("""
declaration_3way = [
    (['operation_code', 'export_country'], 'currency'),
    (['operation_code', 'import_country'], 'currency'),
    (['operation_code', 'delivery_term'], 'port_code'),
    (['operation_code', 'port_code'], 'customs_code'),
    (['direction', 'export_country'], 'currency'),
    (['direction', 'port_code'], 'customs_code'),
]

all_3way = []
for ants, target in declaration_3way:
    df = dominant_rules(con, 'declarations', ants, target, min_support=50, min_confidence=0.80, limit=1000)
    df.insert(0, 'rule_family', f"{'+'.join(ants)}->{target}")
    all_3way.append(df)

decl_3way_rules = pd.concat(all_3way, ignore_index=True)
save(decl_3way_rules, 'declaration_3way_rules.csv')
save(decl_3way_rules, 'declaration_3way_rules.json')
decl_3way_rules.head(40)
""")

md("""## 5. HS hierarchy mining — cargo level
Phân tích theo HS2/HS4/HS6 để tìm unit/tax_code/origin có thể autofill hoặc suggest.""")
code("""
hs_rule_specs = [
    (['hs2'], 'unit', 500, 0.70),
    (['hs4'], 'unit', 100, 0.80),
    (['hs6'], 'unit', 50, 0.85),
    (['direction', 'hs2'], 'tax_code', 500, 0.70),
    (['direction', 'hs4'], 'tax_code', 100, 0.80),
    (['direction', 'hs6'], 'tax_code', 50, 0.85),
    (['operation_code', 'hs2'], 'tax_code', 500, 0.70),
    (['operation_code', 'hs4'], 'tax_code', 100, 0.80),
    (['operation_code', 'hs6'], 'tax_code', 50, 0.85),
    (['operation_code'], 'origin', 500, 0.70),
    (['operation_code', 'hs2'], 'origin', 200, 0.75),
]

all_hs_rules = []
for ants, target, support, conf in hs_rule_specs:
    df = dominant_rules(con, 'cargo', ants, target, min_support=support, min_confidence=conf, limit=1500)
    df.insert(0, 'rule_family', f"{'+'.join(ants)}->{target}")
    all_hs_rules.append(df)

hs_rules = pd.concat(all_hs_rules, ignore_index=True)
save(hs_rules, 'cargo_hs_rules.csv')
save(hs_rules, 'cargo_hs_rules.json')
hs_rules.head(50)
""")

md("""## 6. Rule novelty: ưu tiên rule mới có impact cao
Danh sách này giúp review: nhiều dòng + confidence cao + chưa chắc đã có trong engine hiện tại.""")
code("""
impact_rules = pd.concat([
    decl_rules.assign(level='declaration_2way'),
    decl_3way_rules.assign(level='declaration_3way'),
    hs_rules.assign(level='cargo_hs'),
], ignore_index=True, sort=False)

impact_rules['impact_score'] = impact_rules['antecedent_count'] * impact_rules['confidence']
impact_rules = impact_rules.sort_values(['action', 'impact_score'], ascending=[True, False])

autofill_candidates = impact_rules.query("action == 'AUTOFILL'").sort_values('impact_score', ascending=False)
suggest_candidates = impact_rules.query("action == 'SUGGEST'").sort_values('impact_score', ascending=False)

save(autofill_candidates.head(500), 'candidate_autofill_rules.csv')
save(suggest_candidates.head(500), 'candidate_suggest_rules.csv')
autofill_candidates.head(50)
""")

md("""## 7. Price anomaly baseline theo HS6
Không phải rule autofill, nhưng rất hữu ích cho AI guardrail: cảnh báo unit_price lạ theo HS6 + unit.""")
code("""
price_baseline = q(con, '''
WITH clean AS (
  SELECT hs6, unit, unit_price, value, quantity
  FROM cargo
  WHERE hs6 IS NOT NULL AND hs6 <> ''
    AND unit IS NOT NULL AND unit <> ''
    AND unit_price IS NOT NULL AND unit_price > 0
), stats AS (
  SELECT hs6, unit,
         COUNT(*) AS n,
         quantile_cont(unit_price, 0.10) AS p10,
         quantile_cont(unit_price, 0.25) AS p25,
         quantile_cont(unit_price, 0.50) AS median,
         quantile_cont(unit_price, 0.75) AS p75,
         quantile_cont(unit_price, 0.90) AS p90,
         quantile_cont(unit_price, 0.99) AS p99,
         AVG(unit_price) AS avg_price
  FROM clean
  GROUP BY hs6, unit
)
SELECT *, p75 - p25 AS iqr,
       GREATEST(p10 / NULLIF(median, 0), 0) AS low_ratio,
       p90 / NULLIF(median, 0) AS high_ratio
FROM stats
WHERE n >= 50
ORDER BY n DESC
''')
save(price_baseline, 'hs6_unit_price_baseline.csv')
price_baseline.head(30)
""")

md("""## 8. Export manifest cho engine
JSON gọn để kỹ sư có thể review rồi đưa một phần vào `scripts/autofill_engine.py`.""")
code("""
manifest = {
    'thresholds': {'AUTOFILL': 0.99, 'SUGGEST': 0.80, 'HINT': 0.70},
    'outputs': {
        'declaration_2way_rules': str(OUTPUT_DIR / 'declaration_2way_rules.csv'),
        'declaration_3way_rules': str(OUTPUT_DIR / 'declaration_3way_rules.csv'),
        'cargo_hs_rules': str(OUTPUT_DIR / 'cargo_hs_rules.csv'),
        'candidate_autofill_rules': str(OUTPUT_DIR / 'candidate_autofill_rules.csv'),
        'candidate_suggest_rules': str(OUTPUT_DIR / 'candidate_suggest_rules.csv'),
        'hs6_unit_price_baseline': str(OUTPUT_DIR / 'hs6_unit_price_baseline.csv'),
    },
    'counts': {
        'declaration_2way_rules': int(len(decl_rules)),
        'declaration_3way_rules': int(len(decl_3way_rules)),
        'cargo_hs_rules': int(len(hs_rules)),
        'autofill_candidates': int(len(autofill_candidates)),
        'suggest_candidates': int(len(suggest_candidates)),
    }
}
import json
with open(OUTPUT_DIR / 'rule_mining_manifest.json', 'w', encoding='utf-8') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
manifest
""")

nb.cells = cells
nbf.write(nb, nb_path)
print(nb_path)
