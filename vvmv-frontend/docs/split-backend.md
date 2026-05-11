# Split backend (Next.js → vvmv-backend)

Phased extraction of `vvmv-frontend` route handlers into a dedicated Node server (**vvmv-backend**) so API traffic can run separately from the Next.js app (scaling, deploy boundaries, or future mobile/clients).

## Survey: patterns in `app/api` (May 2026)

| Pattern | Usage |
|--------|--------|
| **Auth** | Most handlers call `auth.api.getSession({ headers })` from `@/lib/auth` (Better Auth). Some routes use `headers()` from `next/headers` instead of the request object. |
| **Prisma** | Shared DB access via `prismaRPA` (and related helpers) from `@/lib/db`; enums and models from `@/prisma/client` (generated output under `prisma/client`). |
| **Aliases** | `@/` maps to the app root (see Next/tsconfig); `@/lib/*`, `@/prisma/client` are the dominant imports. |
| **Other** | Many routes combine Prisma with MSSQL ERP helpers (`queryERPHCM`, `queryERPHAN`); those are heavier to move and should follow **after** Prisma-only routes. |

## Layout

- **`vvmv-backend/`** — **NestJS** (Express adapter), listens on `PORT` (default `3001`). Kiến trúc tổng thể: [`frontend-backend.md`](./frontend-backend.md).
- **Prisma** — Single schema remains in `vvmv-frontend/prisma/schema.prisma`. Run `pnpm db:generate` (from `vvmv-frontend`) before starting the backend so `vvmv-frontend/prisma/client` exists.
- **Path convention** — Nest exposes routes **without** an `/api` prefix (same segment Next uses after `/api/`). Example: Next `GET /api/shipping-lines` delegates to `GET {BACKEND_URL}/shipping-lines`. No global `api` prefix on Nest; changing that would require updating every delegation URL in `vvmv-frontend`.
- **Delegation helper** — `vvmv-frontend/lib/proxy-backend.ts` exports `tryDelegateToStandaloneApi(request, "<path>")` so migrated routes share one forwarding implementation (method, querystring, body, cookies).
- **Migrated routes (Prisma + session, plus one public read)** — See [`backend-migration-pending.md`](./backend-migration-pending.md) for the canonical table. Includes e.g. `shipping-lines`, `foreign-ports`, `ops`, `field-options`, `tracking`, `vendor-fee-types`, `container-size-configs`, `users/by-site`, `user/teams`, `user/departments`, `vendors`, etc.

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `DATABASE_URL` | `vvmv-backend` (required) | Same Postgres URL as Next / Prisma. |
| `PORT` | `vvmv-backend` | HTTP port (default `3001`). |
| `HOST` | `vvmv-backend` | Bind address (default `0.0.0.0`). |
| `CORS_ORIGIN` | `vvmv-backend` (optional) | Origins cho CORS (phân tách bằng dấu phẩy), ví dụ URL của `vvmv-frontend` khi gọi Nest **trực tiếp** từ browser (không qua Next proxy). |
| `BACKEND_URL` | `vvmv-frontend` (optional) | Base URL of **vvmv-backend**, e.g. `http://127.0.0.1:3001`. When set, `app/api/shipping-lines` **delegates** to the standalone server via `fetch` (forwards `Cookie`). |
| `API_URL` | `vvmv-frontend` (optional) | **Legacy alias** for `BACKEND_URL` — used only if `BACKEND_URL` is unset. |

## Auth caveat (split deploy)

- **Same-origin Next**: Session cookies are sent to `/api/*` automatically; delegation to **vvmv-backend** on localhost works if `fetch` forwards the `Cookie` header (implemented for shipping-lines).
- **Split origins** (e.g. Next on `app.example.com`, API on `api.example.com`): browsers **will not** send auth cookies cross-site unless you configure **shared parent domain**, `SameSite`, and CORS credentialed requests—or move to **Bearer tokens** / session APIs callable from the BFF.

**Recommendation:** Keep authenticated browser traffic on a **single origin** (Next as BFF proxying to **vvmv-backend**), or introduce explicit API tokens for non-browser clients; avoid relying on cookies across unrelated domains without coordinated cookie/CORS policy.

## Running locally

From repo root:

```bash
cd vvmv-frontend && pnpm install && pnpm db:generate
cd ../vvmv-backend && pnpm install && pnpm dev
```

- Health: `GET http://127.0.0.1:3001/health`
- POC route: `GET http://127.0.0.1:3001/shipping-lines` (requires valid Better Auth session cookie).

Optional delegation from Next:

```bash
cd vvmv-frontend && BACKEND_URL=http://127.0.0.1:3001 pnpm dev
```

Then `GET /api/shipping-lines` is served via **vvmv-backend** (same JSON as before).

## Next migration steps

1. Move additional **Prisma-first** GET routes; keep ERP/MSSQL-heavy routes on Next until drivers/config are shared.
2. Extract shared types/helpers (`lib/db`, auth) into a small internal package **or** stable relative imports from `vvmv-frontend` until a workspace exists.
3. Add CI `pnpm typecheck` for `vvmv-backend`; align deploy (container/process manager) with `DATABASE_URL` and internal URL for Next delegation if using BFF mode.
