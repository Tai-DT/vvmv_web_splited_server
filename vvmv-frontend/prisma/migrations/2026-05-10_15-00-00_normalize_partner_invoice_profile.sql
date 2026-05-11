ALTER TABLE partners_master_data
  ADD COLUMN IF NOT EXISTS invoice_company_name TEXT,
  ADD COLUMN IF NOT EXISTS invoice_address TEXT,
  ADD COLUMN IF NOT EXISTS invoice_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS invoice_phone TEXT;

CREATE INDEX IF NOT EXISTS partners_master_data_tax_code_site_idx ON partners_master_data(tax_code, site);
