# VVMV AI Data Analysis Notebooks

Hệ thống notebook này dùng để khám phá quy luật mới phục vụ AI/autofill trên dữ liệu VVMV.

## Notebook chính

- `01_ai_rule_mining_discovery.ipynb`: rule mining cho declaration + cargo
  - Rule 2 chiều: `A -> B`
  - Rule 3 chiều: `A + B -> C`
  - HS hierarchy: `hs2/hs4/hs6 -> unit/tax_code/origin`
  - Price baseline theo `hs6 + unit`
  - Xuất candidate rules cho `AUTOFILL` và `SUGGEST`

## Ngưỡng hành động

- `AUTOFILL`: confidence >= 99%
- `SUGGEST`: confidence >= 80%
- `HINT`: confidence >= 70%
- `ASK`: thấp hơn 70%, không nên tự điền

## Dữ liệu đầu vào

Notebook đọc trực tiếp JSONL bằng DuckDB:

- `llm-dataset/ai-assets/analytics/declarations_compact.jsonl`
- `llm-dataset/ai-assets/analytics/cargo_facts.jsonl`

## Chạy notebook

```bash
cd /Volumes/FastVault-Apps/Projects/ai-vvmv
./notebooks/run_notebook.sh
```

Kết quả được ghi vào:

- `notebooks/outputs/declaration_2way_rules.csv`
- `notebooks/outputs/declaration_3way_rules.csv`
- `notebooks/outputs/cargo_hs_rules.csv`
- `notebooks/outputs/candidate_autofill_rules.csv`
- `notebooks/outputs/candidate_suggest_rules.csv`
- `notebooks/outputs/hs6_unit_price_baseline.csv`
- `notebooks/outputs/rule_mining_manifest.json`

## Quy trình review để đưa vào engine

1. Mở `candidate_autofill_rules.csv`, ưu tiên rule có `antecedent_count` lớn và `confidence >= 0.99`.
2. Kiểm tra rule có hợp lý nghiệp vụ không, tránh rule do bias dữ liệu.
3. Với rule cargo, ưu tiên HS6 > HS4 > HS2 nếu có conflict.
4. Đưa rule đã duyệt vào `scripts/autofill_engine.py` hoặc graph JSON.
5. Chạy lại notebook sau khi có batch dữ liệu mới để phát hiện drift.
