CREATE TABLE IF NOT EXISTS cds_lookup_snapshot (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS cds_lookup_snapshot_is_active_generated_at_idx ON cds_lookup_snapshot(is_active, generated_at);

CREATE TABLE IF NOT EXISTS cds_operation_code_lookup (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'unknown'
);
CREATE INDEX IF NOT EXISTS cds_operation_code_lookup_direction_idx ON cds_operation_code_lookup(direction);

CREATE TABLE IF NOT EXISTS cds_permit_lookup (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  permit_type_code TEXT,
  permit_type_name TEXT,
  permit_no TEXT NOT NULL,
  permit_issue_date TEXT,
  permit_expiry_date TEXT,
  declaration_count INTEGER,
  first_declaration_date TEXT,
  last_declaration_date TEXT,
  sample_declaration_no TEXT,
  sample_customs_code TEXT,
  is_explicit_import_license BOOLEAN NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS cds_permit_lookup_kind_permit_type_code_permit_no_key ON cds_permit_lookup(kind, permit_type_code, permit_no);
CREATE INDEX IF NOT EXISTS cds_permit_lookup_kind_idx ON cds_permit_lookup(kind);
CREATE INDEX IF NOT EXISTS cds_permit_lookup_permit_type_code_idx ON cds_permit_lookup(permit_type_code);
CREATE INDEX IF NOT EXISTS cds_permit_lookup_permit_no_idx ON cds_permit_lookup(permit_no);

CREATE TABLE IF NOT EXISTS cds_permit_type_lookup (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cds_processing_department_lookup (
  code TEXT NOT NULL,
  customs_code TEXT NOT NULL,
  name TEXT NOT NULL,
  operation_codes JSONB,
  allow_import BOOLEAN NOT NULL DEFAULT false,
  allow_export BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (code, customs_code)
);
CREATE INDEX IF NOT EXISTS cds_processing_department_lookup_customs_code_idx ON cds_processing_department_lookup(customs_code);

CREATE TABLE IF NOT EXISTS cds_field_option_lookup (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  field TEXT NOT NULL,
  value TEXT NOT NULL,
  label TEXT,
  address TEXT,
  count INTEGER NOT NULL DEFAULT 0,
  direction TEXT NOT NULL DEFAULT 'unknown',
  source TEXT NOT NULL DEFAULT 'snapshot'
);
CREATE UNIQUE INDEX IF NOT EXISTS cds_field_option_lookup_field_value_direction_source_key ON cds_field_option_lookup(field, value, direction, source);
CREATE INDEX IF NOT EXISTS cds_field_option_lookup_field_count_idx ON cds_field_option_lookup(field, count DESC);
CREATE INDEX IF NOT EXISTS cds_field_option_lookup_field_value_idx ON cds_field_option_lookup(field, value);

CREATE TABLE IF NOT EXISTS cds_electronic_attachment_lookup (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  attachment_type_code TEXT NOT NULL,
  attachment_number TEXT,
  attachment_description TEXT,
  count INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS cds_electronic_attachment_lookup_type_number_key ON cds_electronic_attachment_lookup(attachment_type_code, attachment_number);
CREATE INDEX IF NOT EXISTS cds_electronic_attachment_lookup_type_idx ON cds_electronic_attachment_lookup(attachment_type_code);
