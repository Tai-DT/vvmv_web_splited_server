# API route modules (`app/api`)

Quick map of **immediate** folders under `app/api/` → HTTP path prefix `/api/<domain>/…`. Route counts are `route.ts` files under each subtree (including nested routes).

| Domain | Path prefix | Routes | Purpose |
|--------|---------------|--------|---------|
| accounting | `/api/accounting` | 1 | Accounting exports (e.g. disbursement report). |
| admin | `/api/admin` | 23 | Admin-only CRUD: users, teams, departments, configs, master data, API keys, shipping lines, etc. |
| airports | `/api/airports` | 1 | Airport reference data for forms and lookups. |
| auth | `/api/auth` | 1 | **Better Auth** catch-all (`[...all]`): sign-in, session, OAuth callbacks (handled by library routes under `/api/auth/*`). |
| cargo-types | `/api/cargo-types` | 1 | Cargo type catalog. |
| contact | `/api/contact` | 1 | Contact-related API. |
| container-size-configs | `/api/container-size-configs` | 1 | Configurable container size rules. |
| container-sizes | `/api/container-sizes` | 1 | Container size master list. |
| debug | `/api/debug` | 1 | Debugging/diagnostic endpoints (non-production use). |
| dispatch | `/api/dispatch` | 7 | Dispatch board data, plate checks, assign/unassign, mail send. |
| erp | `/api/erp` | 2 | ERP integration (fee descriptions, invoice checks). |
| erp-import-fee | `/api/erp-import-fee` | 1 | Import fee handling from ERP flows. |
| external | `/api/external` | 13 | External integrations: vendor portal auth/session/costs, ERP AR, container declarations, tracking, transactions. |
| field-options | `/api/field-options` | 1 | Shared configurable field options. |
| followup | `/api/followup` | 34 | Core **customs/follow-up** domain: job lists, container ops, CDS/AI docs, checks, payments, activity logs, bulk updates. |
| foreign-ports | `/api/foreign-ports` | 1 | Foreign port reference data. |
| gemini | `/api/gemini` | 3 | Google Gemini: prompts, chat/history (AI-assisted workflows). |
| gmail | `/api/gmail` | 3 | Gmail integration: messages, threads, attachments. |
| google-drive | `/api/google-drive` | 7 | Google Drive: files, upload, rename, thumbnails, folder create/move. |
| internal | `/api/internal` | 1 | Internal/maintenance jobs (e.g. backfills). |
| ops | `/api/ops` | 1 | Ops reference data for internal tools. |
| partners | `/api/partners` | 1 | Partner records API. |
| pick-or-lift-place | `/api/pick-or-lift-place` | 1 | Pickup/lift place locations. |
| service-modes | `/api/service-modes` | 1 | Service mode catalog. |
| shipping-lines | `/api/shipping-lines` | 1 | Shipping line master for follow-up/shipping UIs. |
| table-preferences | `/api/table-preferences` | 1 | Per-user table column/filter preferences. |
| tracking | `/api/tracking` | 1 | Shipment tracking queries. |
| transaction | `/api/transaction` | 1 | Creating transactions (business operations). |
| trucking-followup | `/api/trucking-followup` | 28 | **Trucking operations**: jobs, containers, FCR, mail, reports, AI autofill, payments, activity logs. |
| trucking-numbers | `/api/trucking-numbers` | 1 | Trucking number reference. |
| truck-types | `/api/truck-types` | 1 | Truck type catalog. |
| units | `/api/units` | 1 | Unit-of-measure reference. |
| user | `/api/user` | 6 | Authenticated **current user**: site, teams, departments, field templates, ERP accounts. |
| users | `/api/users` | 1 | User listings (e.g. by site) for admin/coordination UIs. |
| vehicles | `/api/vehicles` | 1 | Vehicle master data. |
| vendor-fee-types | `/api/vendor-fee-types` | 1 | Vendor fee type catalog. |
| vendors | `/api/vendors` | 1 | Vendor master. |
| warehouse-by-taxcode | `/api/warehouse-by-taxcode` | 1 | Resolve warehouse by tax code. |
| work-types | `/api/work-types` | 1 | Work type catalog. |

**Notes**

- **Total:** 155 `route.ts` files under `app/api/**` (same as glob `app/api/**/route.ts`). Per-domain counts are `find app/api/<domain> -name route.ts` for each of the 39 top-level folders; dynamic segments like `[id]` are inside those subtrees.
- Heavy domains for onboarding: **`followup`**, **`trucking-followup`**, **`admin`**, **`external`** (vendor portal + ERP), **`dispatch`**, **`google-drive` / `gmail`**.

See [auth-flow.md](./auth-flow.md) for how `/api/auth` and session checks relate to these routes.
