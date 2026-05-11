# vvmv-backend (NestJS)

HTTP API for **VVMV**, tách khỏi [`vvmv-frontend`](../vvmv-frontend/) (Next.js chỉ làm **frontend** / BFF tùy cấu hình).

- Stack: **NestJS** + **Prisma** (schema, migrations, generated client now live in `./prisma`).
- Auth: Better Auth-compatible cookie/session reader against Postgres, plus Nest-owned `/auth/*` session/password compatibility endpoints.
- Integrations: MSSQL ERP pools, Google Drive/Gmail/service-account mail, Gemini, FastPro, SNP.

## Dev

```bash
cd ../vvmv-backend && pnpm install && DATABASE_URL="postgresql://..." pnpm dev
```

- `GET /health`
- `GET /shipping-lines?site=&operationType=` — specific migrated controller, needs a valid session cookie.
- All 155 `vvmv-frontend/app/api/**/route.ts` paths are registered under Nest without the `/api` prefix. Unknown paths still return `x-backend-not-implemented`.

Required runtime env starts with `DATABASE_URL`, Better/Auth-compatible secret/base URL, Google OAuth/service-account vars, `GEMINI_API_KEY`, `FASTPRO_API_KEY`, `SNP_SESSION_COOKIE`, and MSSQL HCM/HAN connection vars (`MSSQL_HCM_*`, `MSSQL_HAN_*`, `HAN_CONNECTION_OVERRIDE`, or `HAN_DB_*`). Secrets stay outside git.

## Build / prod

```bash
pnpm build && DATABASE_URL=... node dist/main.js
```

`HOST` / `PORT` (mặc định `0.0.0.0` / `3001`), `CORS_ORIGIN` (optional, danh sách origin phân tách dấu phẩy khi gọi API trực tiếp từ browser khác origin).
