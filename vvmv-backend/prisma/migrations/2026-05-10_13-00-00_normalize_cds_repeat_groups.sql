CREATE TABLE IF NOT EXISTS cds_bill_item (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  cds_info_id TEXT NOT NULL REFERENCES follow_up_cds_info(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  bill_number TEXT,
  bill_date TEXT,
  hawb_number TEXT,
  mawb_year TEXT
);
CREATE INDEX IF NOT EXISTS cds_bill_item_cds_info_id_sort_order_idx ON cds_bill_item(cds_info_id, sort_order);

CREATE TABLE IF NOT EXISTS cds_valuation_adjustment (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  cds_info_id TEXT NOT NULL REFERENCES follow_up_cds_info(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  name_code TEXT,
  classification_code TEXT,
  currency_code TEXT,
  adjustment_value DOUBLE PRECISION,
  allocation_ratio DOUBLE PRECISION
);
CREATE INDEX IF NOT EXISTS cds_valuation_adjustment_cds_info_id_sort_order_idx ON cds_valuation_adjustment(cds_info_id, sort_order);

CREATE TABLE IF NOT EXISTS cds_transport_schedule (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  cds_info_id TEXT NOT NULL REFERENCES follow_up_cds_info(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  location_code TEXT,
  location_name TEXT,
  arrival_date TEXT,
  departure_date TEXT
);
CREATE INDEX IF NOT EXISTS cds_transport_schedule_cds_info_id_sort_order_idx ON cds_transport_schedule(cds_info_id, sort_order);

CREATE TABLE IF NOT EXISTS cds_import_license (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  cds_info_id TEXT NOT NULL REFERENCES follow_up_cds_info(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  license_number TEXT
);
CREATE INDEX IF NOT EXISTS cds_import_license_cds_info_id_sort_order_idx ON cds_import_license(cds_info_id, sort_order);

CREATE TABLE IF NOT EXISTS cds_other_legal_document (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  cds_info_id TEXT NOT NULL REFERENCES follow_up_cds_info(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  document_code TEXT
);
CREATE INDEX IF NOT EXISTS cds_other_legal_document_cds_info_id_sort_order_idx ON cds_other_legal_document(cds_info_id, sort_order);

CREATE TABLE IF NOT EXISTS cds_electronic_attachment (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  cds_info_id TEXT NOT NULL REFERENCES follow_up_cds_info(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  attachment_number TEXT,
  attachment_description TEXT
);
CREATE INDEX IF NOT EXISTS cds_electronic_attachment_cds_info_id_sort_order_idx ON cds_electronic_attachment(cds_info_id, sort_order);

INSERT INTO cds_bill_item (cds_info_id, sort_order, bill_number, bill_date, hawb_number, mawb_year)
SELECT c.id, item.ordinality - 1, item.value->>'billNumber', item.value->>'billDate', item.value->>'hawbNumber', item.value->>'mawbYear'
FROM follow_up_cds_info c, jsonb_array_elements(c.bill_items::jsonb) WITH ORDINALITY AS item(value, ordinality)
WHERE jsonb_typeof(c.bill_items::jsonb) = 'array'
ON CONFLICT DO NOTHING;

INSERT INTO cds_valuation_adjustment (cds_info_id, sort_order, name_code, classification_code, currency_code, adjustment_value, allocation_ratio)
SELECT c.id, item.ordinality - 1, item.value->>'nameCode', item.value->>'classificationCode', item.value->>'currencyCode', NULLIF(item.value->>'adjustmentValue','')::double precision, NULLIF(item.value->>'allocationRatio','')::double precision
FROM follow_up_cds_info c, jsonb_array_elements(c.valuation_adjustments::jsonb) WITH ORDINALITY AS item(value, ordinality)
WHERE jsonb_typeof(c.valuation_adjustments::jsonb) = 'array'
ON CONFLICT DO NOTHING;

INSERT INTO cds_transport_schedule (cds_info_id, sort_order, location_code, location_name, arrival_date, departure_date)
SELECT c.id, item.ordinality - 1, item.value->>'locationCode', item.value->>'locationName', item.value->>'arrivalDate', item.value->>'departureDate'
FROM follow_up_cds_info c, jsonb_array_elements(c.transport_schedules::jsonb) WITH ORDINALITY AS item(value, ordinality)
WHERE jsonb_typeof(c.transport_schedules::jsonb) = 'array'
ON CONFLICT DO NOTHING;

INSERT INTO cds_import_license (cds_info_id, sort_order, license_number)
SELECT c.id, item.ordinality - 1, item.value #>> '{}'
FROM follow_up_cds_info c, jsonb_array_elements(c.import_licenses::jsonb) WITH ORDINALITY AS item(value, ordinality)
WHERE jsonb_typeof(c.import_licenses::jsonb) = 'array'
ON CONFLICT DO NOTHING;

INSERT INTO cds_other_legal_document (cds_info_id, sort_order, document_code)
SELECT c.id, item.ordinality - 1, item.value #>> '{}'
FROM follow_up_cds_info c, jsonb_array_elements(c.other_legal_document_codes::jsonb) WITH ORDINALITY AS item(value, ordinality)
WHERE jsonb_typeof(c.other_legal_document_codes::jsonb) = 'array'
ON CONFLICT DO NOTHING;

INSERT INTO cds_electronic_attachment (cds_info_id, sort_order, attachment_number, attachment_description)
SELECT c.id, item.ordinality - 1, item.value->>'attachmentNumber', item.value->>'attachmentDescription'
FROM follow_up_cds_info c, jsonb_array_elements(c.electronic_attachments::jsonb) WITH ORDINALITY AS item(value, ordinality)
WHERE jsonb_typeof(c.electronic_attachments::jsonb) = 'array'
ON CONFLICT DO NOTHING;
