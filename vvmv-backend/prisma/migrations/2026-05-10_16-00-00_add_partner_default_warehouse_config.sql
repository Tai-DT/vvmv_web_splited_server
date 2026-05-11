ALTER TABLE partners_master_data
  ADD COLUMN IF NOT EXISTS default_warehouse_config_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'partners_master_data_default_warehouse_config_id_fkey'
  ) THEN
    ALTER TABLE partners_master_data
      ADD CONSTRAINT partners_master_data_default_warehouse_config_id_fkey
      FOREIGN KEY (default_warehouse_config_id)
      REFERENCES warehouse_config(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS partners_master_data_default_warehouse_config_id_idx
  ON partners_master_data(default_warehouse_config_id);

UPDATE partners_master_data p
SET default_warehouse_config_id = wc.id
FROM warehouse_config wc
WHERE p.default_warehouse_config_id IS NULL
  AND wc.partners_master_data_id = p.id
  AND NULLIF(trim(p.warehouse), '') IS NOT NULL
  AND lower(trim(wc.warehouse_name)) = lower(trim(p.warehouse));

UPDATE partners_master_data p
SET default_warehouse_config_id = picked.id
FROM LATERAL (
  SELECT wc.id
  FROM warehouse_config wc
  WHERE wc.partners_master_data_id = p.id
  ORDER BY wc.updated_at DESC, wc.created_at DESC
  LIMIT 1
) picked
WHERE p.default_warehouse_config_id IS NULL
  AND NULLIF(trim(p.warehouse), '') IS NULL;
