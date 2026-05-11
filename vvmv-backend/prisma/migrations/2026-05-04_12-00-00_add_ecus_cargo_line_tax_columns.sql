-- ECUS_2025-aligned per-line values (Danh sách hàng) for web ↔ copy/paste.
ALTER TABLE "cargo_list"
  ADD COLUMN IF NOT EXISTS "line_taxable_value" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "export_tax_rate_percent" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "export_tax_amount" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "taxable_unit_price" DOUBLE PRECISION;
