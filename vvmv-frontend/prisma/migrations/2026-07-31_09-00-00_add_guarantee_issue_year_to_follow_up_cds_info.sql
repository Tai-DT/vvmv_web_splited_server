ALTER TABLE "follow_up_cds_info"
  ADD COLUMN IF NOT EXISTS "guarantee_issue_year" TEXT;

-- Backfill: rows saved while the guarantee year shared the credit-limit column.
UPDATE "follow_up_cds_info"
SET "guarantee_issue_year" = "credit_limit_issue_year"
WHERE "guarantee_issue_year" IS NULL
  AND "credit_limit_issue_year" IS NOT NULL
  AND (
    "guarantee_bank_code" IS NOT NULL
    OR "guarantee_document_symbol" IS NOT NULL
    OR "guarantee_document_number" IS NOT NULL
  );
