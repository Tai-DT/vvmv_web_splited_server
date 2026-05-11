-- Convert empty_return_deadline from DATE to TEXT to support date or symbolic values.
ALTER TABLE "container"
ALTER COLUMN "empty_return_deadline" TYPE TEXT
USING CASE
  WHEN "empty_return_deadline" IS NULL THEN NULL
  ELSE to_char("empty_return_deadline", 'YYYY-MM-DD')
END;
