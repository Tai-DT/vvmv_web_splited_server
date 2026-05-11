ALTER TABLE follow_up_cds_info
  DROP COLUMN IF EXISTS bill_items,
  DROP COLUMN IF EXISTS electronic_attachments,
  DROP COLUMN IF EXISTS import_licenses,
  DROP COLUMN IF EXISTS other_legal_document_codes,
  DROP COLUMN IF EXISTS transport_schedules,
  DROP COLUMN IF EXISTS valuation_adjustments;
