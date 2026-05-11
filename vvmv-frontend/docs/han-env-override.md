# HAN Connection Env Override

Use this fallback when a tax code does not have a valid `partners_master_data.dd_info`.

## Priority Order

1. `partners_master_data.dd_info` (if present and parseable)
2. Environment override (this document)

If both sources are missing, CDS register returns `422`.

## Supported Environment Variables

### Option A: Full connection string

```env
HAN_CONNECTION_OVERRIDE="Server=vpq7.vvmv.com.vn,1433;Database=ECUSSVNACCS_ECCO;User ID=ecus;Password=***;Encrypt=True;TrustServerCertificate=True"
```

### Option B: Split fields

```env
HAN_DB_SERVER=vpq7.vvmv.com.vn,1433
HAN_DB_NAME=ECUSSVNACCS_ECCO
HAN_DB_USER=ecus
HAN_DB_PASSWORD=***
HAN_DB_ENCRYPT=true
HAN_DB_TRUST_SERVER_CERTIFICATE=true
```

Notes:

- `HAN_CONNECTION_OVERRIDE` has higher priority than split fields.
- Keep secrets out of git.
- Use `Encrypt=True` and `TrustServerCertificate=True` for SQL Server environments that require encrypted transport with self-signed certs.
