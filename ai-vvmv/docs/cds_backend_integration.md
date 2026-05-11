# CDS Backend Integration Contract

VVMV CDS storage now uses normalized backend tables instead of JSON repeat-group columns.
Use `contracts/cds_backend_contract.json` as the stable contract for vvmv-ai.

## AI Output

- Emit canonical camelCase CDS fields.
- Emit repeat groups using the same API shape as the web form:
  - `billItems[]`
  - `valuationAdjustments[]`
  - `transportSchedules[]`
  - `importLicenses[]`
  - `otherLegalDocumentCodes[]`
  - `electronicAttachments[]`
- Backend sanitizes this payload and persists repeat groups into child tables.

## Database Normalization

- `follow_up_cds_info` stores one CDS header/form per follow-up.
- Repeating sections are stored in child tables with `cds_info_id` and `sort_order`.
- Shared reference data should come from lookup/master tables, not duplicated in AI output.

## Populating CDS lookup tables (Postgres)

Ops sync uses the same merged catalogs as the web fallback (`getCdsDatabaseLookups`): committed JSON under `vvmv-frontend/database/exports/` (for example `app_cds_lookups_latest/cds_database_lookups.json`, `cds_bank_codes.json`, `cds_truck_loading_codes.json`) plus optional exports next to that tree. From `vvmv-frontend`, with `DATABASE_URL` pointing at the RPA Postgres instance:

```bash
pnpm cds:import-lookups -- --dry-run   # counts only, no DB
pnpm cds:import-lookups                # idempotent upsert into cds_* lookup tables
```

Admin-managed codes in `field_options` can be copied into `cds_field_option_lookup` as `source = 'app'` (same normalization as the CDS follow-up UI) via `pnpm cds:sync-app-lookups` from `vvmv-frontend` with `DATABASE_URL` set; use `--dry-run` to preview counts. This complements CSV/snapshot imports and does not replace runtime merges (warehouses, ERP vehicles, saved history).

Apply migration `2026-05-10_12-00-00_add_cds_lookup_tables.sql` before the first import.

## Reusable Reference Sources

Prefer these sources for AI grounding and validation:

- `cds_operation_code_lookup`
- `cds_permit_lookup`
- `cds_permit_type_lookup`
- `cds_processing_department_lookup`
- `cds_field_option_lookup`
- `cds_electronic_attachment_lookup`
- partner/customs/port/shipping master data from the app database

## Compatibility

The web API still accepts and returns the old frontend payload shape, but storage is normalized.
Do not train vvmv-ai to depend on old JSON DB columns such as `bill_items` or `electronic_attachments`.
