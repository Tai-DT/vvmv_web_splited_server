# Backend migration pending (`app/api` → `vvmv-backend`)

Inventory date: **May 2026** (refreshed). Total Next route modules: **155**
`route.ts` files under `vvmv-frontend/app/api/`. Currently **34** of those
paths are also implemented in `vvmv-backend` (NestJS).

## Delegation architecture

This session unified the delegation story so Nest can authoritatively own
any path it implements without per-route boilerplate:

1. **Next side — `next.config.ts` `rewrites()`**
   When `BACKEND_URL` (or legacy `API_URL`) is set, every entry from
   [`lib/backend-registry.ts`](../lib/backend-registry.ts) is rewritten
   under `beforeFiles` so the request reaches Nest *before* Next's local
   `route.ts` is consulted. Adding a route to Nest = implement controller
   + add path to the registry. Unregistered paths fall through to the
   local Next handler (or to Better Auth on `/api/auth/[...all]`).
2. **Next side — `lib/proxy-backend.ts` (`tryDelegateToStandaloneApi`)**
   Per-route opt-in helper used inside the `route.ts` files migrated
   before this session. Auto-derives the path from `request.url`, clones
   the request body before consuming it (so the Next handler can still
   read body if we fall through), and returns `null` (Next handles
   locally) when:
     • `BACKEND_URL` / `API_URL` is unset;
     • Nest is unreachable (network error);
     • Nest replies 404 with `x-backend-not-implemented: 1`.
3. **Nest side — `NotImplementedFilter` (global)**
   Every NestJS routing 404 is converted to a 404 carrying the
   `x-backend-not-implemented: 1` marker. Explicit `throw new
   NotFoundException(...)` from inside controllers passes through
   untouched (no marker) so business "not found" semantics remain
   visible to callers.

### Operational summary

- Set **`BACKEND_URL=http://host:port`** on `vvmv-frontend` (no `/api`
  prefix on Nest — Next strips it during the rewrite).
- Leave `BACKEND_URL` unset to short-circuit delegation entirely (useful
  in solo dev against a local Postgres).
- The rewrite pattern means **methods don't need to be enumerated** —
  Next forwards method, query, body, cookies as-is.

## Done in Nest (delegated from Next when `BACKEND_URL` is set)

### Batch 1 (pre-existing, with explicit `tryDelegateToStandaloneApi` calls)

| Next path (`route.ts`)         | Nest path                                    | Auth     |
| ------------------------------ | -------------------------------------------- | -------- |
| `shipping-lines`               | `GET /shipping-lines`                        | Session  |
| `foreign-ports`                | `GET /foreign-ports`                         | Session  |
| `ops`                          | `GET /ops`                                   | Session  |
| `pick-or-lift-place`           | `GET /pick-or-lift-place`                    | Session  |
| `table-preferences`            | `GET` / `PUT /table-preferences`             | Session  |
| `field-options`                | `GET /field-options`                         | Session  |
| `tracking`                     | `GET` / `POST` / `DELETE /tracking`          | Session  |
| `vendor-fee-types`             | `GET` / `POST` / `PUT` / `DELETE /vendor-fee-types` | Session |
| `container-size-configs`       | `GET /container-size-configs`                | **None** |
| `vendors`                      | `GET /vendors`                               | Session  |
| `users/by-site`                | `GET /users/by-site`                         | Session  |
| `user/teams`                   | `GET /user/teams`                            | Session  |
| `user/departments`             | `GET /user/departments`                      | Session  |

### Batch 2 (added this session — registry-driven, no `route.ts` edits)

| Next path                                         | Nest path                                     | Auth                                  |
| ------------------------------------------------- | --------------------------------------------- | ------------------------------------- |
| `admin/shipping-lines`                            | `GET` / `POST` / `PUT` / `DELETE /admin/shipping-lines` | Session                       |
| `admin/foreign-ports`                             | `GET` / `POST` / `PUT` / `DELETE /admin/foreign-ports`  | Session                       |
| `admin/ops`                                       | `GET` / `POST` / `PUT` / `DELETE /admin/ops`            | Session                       |
| `admin/vendors`                                   | `GET` / `POST` / `PUT` / `DELETE /admin/vendors`        | Session                       |
| `admin/pick-or-lift-places`                       | `GET` / `POST` / `PUT` / `DELETE /admin/pick-or-lift-places` | Session                  |
| `admin/customs-warehouses`                        | `GET` / `POST` / `PUT` / `DELETE /admin/customs-warehouses` | Session                   |
| `admin/teams`                                     | `GET /admin/teams` *(read-only — POST/PUT/DELETE remain on Next)* | Session             |
| `admin/departments`                               | `GET /admin/departments` *(read-only)*        | Session                               |
| `admin/departments/by-site`                       | `GET /admin/departments/by-site`              | Session                               |
| `admin/site-managers`                             | `GET` / `POST` / `DELETE /admin/site-managers` | Session (ADMIN/SUPERADMIN)            |
| `admin/department-managers`                       | `GET` / `POST` / `DELETE /admin/department-managers` | Session (ADMIN/SUPERADMIN)       |
| `admin/company-colors`                            | `GET` / `POST /admin/company-colors`          | Session                               |
| `admin/field-options`                             | `GET` / `POST /admin/field-options`           | Session (ADMIN/SUPERADMIN)            |
| `admin/field-options/[id]`                        | `PATCH` / `DELETE /admin/field-options/:id`   | Session (ADMIN/SUPERADMIN)            |

**Total mirrored:** **34** Next path entries (out of 155).

## Migration parity scorecard (after this session)

Counts are **migrated / total** `route.ts` files in that folder.

| Folder                  | Migrated | Total | Notes                                                              |
| ----------------------- | -------- | ----- | ------------------------------------------------------------------ |
| shipping-lines          | 1        | 1     | Done                                                               |
| foreign-ports           | 1        | 1     | Done                                                               |
| ops                     | 1        | 1     | Done                                                               |
| pick-or-lift-place      | 1        | 1     | Done                                                               |
| table-preferences       | 1        | 1     | Done                                                               |
| field-options           | 1        | 1     | Done                                                               |
| tracking                | 1        | 1     | Done                                                               |
| vendor-fee-types        | 1        | 1     | Done                                                               |
| container-size-configs  | 1        | 1     | Done                                                               |
| vendors                 | 1        | 1     | Done                                                               |
| users                   | 1        | 1     | Only `by-site`                                                     |
| user                    | 2        | 6     | `teams`, `departments` migrated; `erp-accounts`, `update-site`, `field-templates*` pending |
| admin                   | 14       | 23    | Reference-data CRUDs done; `users`, `partners-master-data`, `trucking-numbers`, `warehouse-configs`, `vendor-fee-types`, `api-keys` pending |
| accounting              | 0        | 1     | `disbursement-report`                                              |
| airports                | 0        | 1     | **MSSQL ERP**                                                      |
| auth                    | 0        | 1     | **Better Auth catch-all — keep on Next**                           |
| cargo-types             | 0        | 1     | **MSSQL ERP**                                                      |
| contact                 | 0        | 1     | Google service-account mailer                                      |
| container-sizes         | 0        | 1     | **MSSQL ERP**                                                      |
| debug                   | 0        | 1     | Raw `mssql` schema introspection                                   |
| dispatch                | 0        | 7     |                                                                    |
| erp                     | 0        | 2     |                                                                    |
| erp-import-fee          | 0        | 1     |                                                                    |
| external                | 0        | 13    | Mixed (Prisma + ERP + tracking)                                    |
| followup                | 0        | 34    | Large; many Google/Gemini/MSSQL                                    |
| gemini                  | 0        | 3     | Gemini API                                                         |
| gmail                   | 0        | 3     | Google OAuth/API                                                   |
| google-drive            | 0        | 7     | Google APIs                                                        |
| internal                | 0        | 1     |                                                                    |
| partners                | 0        | 1     | **MSSQL ERP**                                                      |
| service-modes           | 0        | 1     | **MSSQL ERP**                                                      |
| transaction             | 0        | 1     |                                                                    |
| truck-types             | 0        | 1     | **MSSQL ERP**                                                      |
| trucking-followup       | 0        | 28    | Many AI/mail/ERP                                                   |
| trucking-numbers        | 0        | 1     |                                                                    |
| units                   | 0        | 1     | **MSSQL ERP**                                                      |
| vehicles                | 0        | 1     | **MSSQL ERP**                                                      |
| warehouse-by-taxcode    | 0        | 1     |                                                                    |
| work-types              | 0        | 1     | **MSSQL ERP**                                                      |

## Top blockers (unchanged — bring these into Nest before resuming the long tail)

### MSSQL ERP (`queryERPHCM` / `queryERPHAN`)

These files call ERP SQL helpers from `@/lib/db`. Moving them requires
**`mssql` (or equivalent) + connection config** in `vvmv-backend`, plus
shared query builders extracted out of `vvmv-frontend/lib`.

Representative endpoints (overlaps exist):

- `followup/cds-lookups`, `user/erp-accounts`, `trucking-followup/combine-jobs`
- `external/vendor-portal/costs/review`, `external/erp/create-ar`
- `admin/trucking-numbers`, `admin/partners-master-data*`
- `work-types`, `vehicles`, `units`, `truck-types`, `service-modes`,
  `partners`, `container-sizes`, `cargo-types`, `airports`
- `dispatch/check-plate`, `followup/check-transid`, `followup/check-delivered`
- `followup/fast-finish-logistic`, `trucking-followup/fast-unfinish`,
  `trucking-followup/delete-job`, `trucking-followup/container/update`
- `internal/backfill-fee-descriptions`

### Raw `mssql` / connection-string helpers

- `debug/route.ts` — schema introspection via `mssql` + `resolveHanConnectionForTaxCode`
- `followup/check-cds-attachment/route.ts` — direct pool usage

### Google / Gmail / Gemini

OAuth + `googleapis`, Generative AI SDK, or Drive/Gmail routes should
stay on Next until **service accounts / OAuth tokens** are shared or
wrapped for Nest.

- **Gemini:** `gemini/*`, `followup/[id]/cds-ai-document/**`,
  `trucking-followup/container/ai-autofill*`
- **Gmail:** `gmail/messages`, `gmail/threads`, `gmail/attachments`
- **Drive / mixed:** `google-drive/*`, `contact`,
  `trucking-followup/send-mail`, several `followup/check-*-files` and
  `upload-files`

## Frontend structural blockers (out of scope per session directive)

The frontend currently does **not build** — but for reasons unrelated to
the backend migration. A prior cleanup left these directories effectively
empty:

- `vvmv-frontend/components/` — missing entirely (every `@/components/...`
  import fails: AppSidebar, header, footer, all of `ui/*`, all of
  `shared/*`).
- `vvmv-frontend/hooks/` — missing entirely (~22 hooks: `use-airports`,
  `use-shipping-lines`, `use-foreign-ports`, `use-field-options`, …).
- `vvmv-frontend/lib/` — only `proxy-backend.ts` and the new
  `backend-registry.ts` exist. Everything else (`auth`, `auth-client`,
  `auth-session`, `db`, `db/erp-han`, `db/erp-hcm`, `db/mssql-connection-string`,
  `activity-logger`, `api-call-logger`, `constants/roles`, `gmail*`,
  `google-drive/*`, `google-sheets/*`, `erp/*`, `followup/*`,
  `guards/*`, `trucking/*`) is missing.

`pnpm build` (Turbopack) reports **1141** "Module not found" events
across **136** unique missing module specifiers (137 including the one
relative `../../components/ui/accessDeniedContent` import).

These directories need to be restored from a backup / sibling clone /
prior commit — the directive for this session is explicit that we should
not invent missing features. Once they're back, the rewrite layer added
this session means Nest immediately serves all 34 migrated routes
without any further frontend changes.

## Next steps (recommended order)

1. **Recover** `vvmv-frontend/{components,hooks,lib}` from backup so the
   frontend compiles again.
2. Add **`mssql`** + env parity to `vvmv-backend`; extract `queryERPHCM`
   / `queryERPHAN` into a `MssqlModule` (or import shared query builders
   from `vvmv-frontend/lib/db` once it returns), then migrate the ERP
   reference-data routes (`airports`, `cargo-types`, `container-sizes`,
   `partners`, `service-modes`, `truck-types`, `units`, `vehicles`,
   `work-types`) — all single-GET, identical pattern to the existing
   `/shipping-lines` controller.
3. Migrate the remaining **Prisma-only admin** routes (`admin/users`,
   `admin/warehouse-configs`, `admin/trucking-numbers`, `admin/api-keys`).
4. Add **Google/Gemini** module with shared credentials; port Drive /
   Gmail after the OAuth story is clear.
5. Keep **`auth/[...all]`** on Next unless Better Auth is mounted on Nest
   with identical routes.

## Files added / touched (this migration batch)

**Nest (`vvmv-backend/`):**

- `src/admin/admin.module.ts`
- `src/admin/site-helpers.ts`
- `src/admin/admin-shipping-lines.controller.ts`
- `src/admin/admin-foreign-ports.controller.ts`
- `src/admin/admin-ops.controller.ts`
- `src/admin/admin-vendors.controller.ts`
- `src/admin/admin-pick-or-lift-places.controller.ts`
- `src/admin/admin-customs-warehouses.controller.ts`
- `src/admin/admin-teams.controller.ts`
- `src/admin/admin-departments.controller.ts`
- `src/admin/admin-site-managers.controller.ts`
- `src/admin/admin-department-managers.controller.ts`
- `src/admin/admin-company-colors.controller.ts`
- `src/admin/admin-field-options.controller.ts`
- `src/not-implemented.filter.ts`
- `src/app.module.ts` (registers `AdminModule` and the global
  `NotImplementedFilter`)
- `src/app.controller.ts` (now just `/health`)
- `.gitignore` (adds `.DS_Store`, `.env`, log glob)

**Next (`vvmv-frontend/`):**

- `tsconfig.json` *(was missing — restored a Next 16 baseline with `@/*`
  paths)*
- `next.config.ts` *(new — registry-driven `rewrites()` to Nest)*
- `lib/backend-registry.ts` *(new — single source of truth for which
  paths Nest serves)*
- `lib/proxy-backend.ts` *(hardened: clones body before consuming,
  derives path automatically, falls through on `x-backend-not-implemented`
  marker / connection error, strips hop-by-hop response headers)*
- `.gitignore` *(adds `outputs/`, `database/`, `coverage/`, `*.log`,
  `next-env.d.ts`, plus standard macOS noise)*

**Workspace root:**

- Deleted stray `.DS_Store` (8 KB) and stale
  `vvmv-frontend/tsconfig.tsbuildinfo` (965 KB).
