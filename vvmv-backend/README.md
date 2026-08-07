# vvmv-backend (NestJS)

HTTP API for **VVMV**, tách khỏi [`vvmv-frontend`](../vvmv-frontend/) (Next.js chỉ làm **frontend** / BFF tùy cấu hình).

- Stack: **NestJS** + **Prisma** (schema + migrations nằm trong `./prisma`; client sinh ra ở `./prisma/client` và **không commit** — xem [Prisma client](#prisma-client)).
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

## Prisma client

`prisma/client/` là code Prisma sinh ra (~20 MB mỗi app) nên được gitignore thay vì commit. Sau khi clone:

```bash
pnpm install                      # postinstall tự chạy prisma generate nếu đã có DATABASE_URL
DATABASE_URL="postgresql://..." pnpm db:generate   # chạy tay khi postinstall bị bỏ qua
```

`prisma.config.ts` đọc `DATABASE_URL` khi load config, nên `prisma generate` cần biến này (giá trị hợp lệ về cú pháp là đủ — bước generate không kết nối DB). Vì vậy `postinstall` được viết dạng không chặn: thiếu env thì chỉ in cảnh báo chứ không làm hỏng `pnpm install`. `pnpm build` luôn generate trước khi biên dịch.

## Build / prod

```bash
DATABASE_URL=... pnpm build && DATABASE_URL=... node dist/main.js
```

`HOST` / `PORT` (mặc định `0.0.0.0` / `3001`), `CORS_ORIGIN` (optional, danh sách origin phân tách dấu phẩy khi gọi API trực tiếp từ browser khác origin).
