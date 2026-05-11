/**
 * Registry of `/api/...` paths implemented by `vvmv-backend` (NestJS).
 *
 * Generated from app/api route handlers; Next rewrites these paths to
 * BACKEND_URL without the `/api` prefix. Keep URL/method/body contracts in
 * the Nest backend.
 *
 * Never register `/api/auth/*` here: Better Auth must be served by Next
 * (`app/api/auth/[...all]`) so sign-in/session cookies are created by the
 * same app that runs `lib/auth.ts`. Rewriting auth to Nest breaks login.
 *
 * Do not register `/api/external/vendor-portal/*`: those routes are implemented
 * in Next (`app/api/external/vendor-portal/*`) with `lib/vendor-portal-auth`
 * (HMAC cookies). Proxied Nest uses different token/cookie semantics; rewriting
 * breaks login after `BACKEND_URL` is enabled.
 */

export interface RegisteredApiPath {
	/** Source path as Next.js sees it — must start with `/api/`. */
	source: string;
	/** Notes for humans (auth model, owning Nest module, etc.). */
	note?: string;
}

export const NEST_REGISTERED_API_PATHS: ReadonlyArray<RegisteredApiPath> = [
	{
		source: "/api/accounting/disbursement-report",
		note: "NestJS",
	},
	{
		source: "/api/admin/api-keys",
		note: "NestJS",
	},
	{
		source: "/api/admin/company-colors",
		note: "NestJS",
	},
	{
		source: "/api/admin/container-size-configs",
		note: "NestJS",
	},
	{
		source: "/api/admin/customs-warehouses",
		note: "NestJS",
	},
	{
		source: "/api/admin/department-managers",
		note: "NestJS",
	},
	{
		source: "/api/admin/departments/by-site",
		note: "NestJS",
	},
	{
		source: "/api/admin/departments",
		note: "NestJS",
	},
	{
		source: "/api/admin/field-options/:id",
		note: "NestJS",
	},
	{
		source: "/api/admin/field-options",
		note: "NestJS",
	},
	{
		source: "/api/admin/foreign-ports",
		note: "NestJS",
	},
	{
		source: "/api/admin/ops",
		note: "NestJS",
	},
	{
		source: "/api/admin/partners-master-data/erp-lookup",
		note: "NestJS",
	},
	{
		source: "/api/admin/partners-master-data/password",
		note: "NestJS",
	},
	{
		source: "/api/admin/partners-master-data",
		note: "NestJS",
	},
	{
		source: "/api/admin/pick-or-lift-places",
		note: "NestJS",
	},
	{
		source: "/api/admin/shipping-lines",
		note: "NestJS",
	},
	{
		source: "/api/admin/site-managers",
		note: "NestJS",
	},
	{
		source: "/api/admin/teams",
		note: "NestJS",
	},
	{
		source: "/api/admin/trucking-numbers",
		note: "NestJS",
	},
	// /api/admin/users — Next only (Better Auth session + prismaRPA). Do not proxy:
	// Nest compat returns a different contract / auth and breaks the Settings Users tab.
	{
		source: "/api/admin/vendor-fee-types",
		note: "NestJS",
	},
	{
		source: "/api/admin/vendors",
		note: "NestJS",
	},
	{
		source: "/api/admin/warehouse-configs",
		note: "NestJS",
	},
	{
		source: "/api/airports",
		note: "NestJS",
	},
	{
		source: "/api/cargo-types",
		note: "NestJS",
	},
	{
		source: "/api/contact",
		note: "NestJS",
	},
	{
		source: "/api/container-size-configs",
		note: "Nest (Next fallback: Prisma RPA)",
	},
	{
		source: "/api/container-sizes",
		note: "NestJS",
	},
	{
		source: "/api/debug",
		note: "NestJS",
	},
	{
		source: "/api/dispatch/add-vendor",
		note: "NestJS",
	},
	{
		source: "/api/dispatch/assign",
		note: "NestJS",
	},
	{
		source: "/api/dispatch/auto-sync",
		note: "NestJS",
	},
	{
		source: "/api/dispatch/board",
		note: "NestJS",
	},
	{
		source: "/api/dispatch/check-plate",
		note: "NestJS",
	},
	{
		source: "/api/dispatch/send-mail",
		note: "NestJS",
	},
	{
		source: "/api/dispatch/unassign",
		note: "NestJS",
	},
	{
		source: "/api/erp-import-fee",
		note: "NestJS",
	},
	{
		source: "/api/erp/check-invoice",
		note: "NestJS",
	},
	{
		source: "/api/erp/fee-descriptions",
		note: "NestJS",
	},
	{
		source: "/api/external/container-declarations",
		note: "NestJS",
	},
	{
		source: "/api/external/create-transaction",
		note: "NestJS",
	},
	{
		source: "/api/external/erp/create-ar",
		note: "NestJS",
	},
	{
		source: "/api/external/tracking/:deliveryNumber",
		note: "NestJS",
	},
	{
		source: "/api/external/tracking",
		note: "NestJS",
	},
	{
		source: "/api/field-options",
		note: "Nest (Next fallback: Prisma RPA)",
	},
	{
		source: "/api/followup/:id/app-declaration/sync",
		note: "NestJS",
	},
	{
		source: "/api/followup/:id/cargo",
		note: "NestJS",
	},
	{
		source: "/api/followup/:id/cds-ai-document/history",
		note: "NestJS",
	},
	{
		source: "/api/followup/:id/cds-ai-document",
		note: "NestJS",
	},
	// /api/followup/:id/cds-info — Next only (large GET/POST: auth, sanitize, HAN, history defaults).
	// Do not proxy: Nest compat upserts raw JSON and breaks the `{ data, preserveLifecycle }` contract → 500.
	{
		source: "/api/followup/:id/export",
		note: "NestJS",
	},
	{
		source: "/api/followup/:id/han-declarations/by-number",
		note: "NestJS",
	},
	{
		source: "/api/followup/:id/han-declarations",
		note: "NestJS",
	},
	{
		source: "/api/followup/:id/register",
		note: "NestJS",
	},
	{
		source: "/api/followup/activity-log",
		note: "NestJS",
	},
	{
		source: "/api/followup/bulk-update",
		note: "NestJS",
	},
	{
		source: "/api/followup/cargo-unit-codes",
		note: "NestJS",
	},
	{
		source: "/api/followup/cds-lookups",
		note: "NestJS",
	},
	{
		source: "/api/followup/check-bill-booking",
		note: "NestJS",
	},
	{
		source: "/api/followup/check-cds-attachment",
		note: "NestJS",
	},
	{
		source: "/api/followup/check-csht-files",
		note: "NestJS",
	},
	{
		source: "/api/followup/check-declaration-files",
		note: "NestJS",
	},
	{
		source: "/api/followup/check-delivered",
		note: "NestJS",
	},
	{
		source: "/api/followup/check-folder",
		note: "NestJS",
	},
	{
		source: "/api/followup/check-lphq-files",
		note: "NestJS",
	},
	{
		source: "/api/followup/check-quan-kvgs",
		note: "NestJS",
	},
	{
		source: "/api/followup/check-tax-files",
		note: "NestJS",
	},
	{
		source: "/api/followup/check-transid",
		note: "NestJS",
	},
	{
		source: "/api/followup/create-container",
		note: "NestJS",
	},
	{
		source: "/api/followup/create-invoker-job",
		note: "NestJS",
	},
	{
		source: "/api/followup/create",
		note: "NestJS",
	},
	{
		source: "/api/followup/declaration-report",
		note: "NestJS",
	},
	{
		source: "/api/followup/delete-container",
		note: "NestJS",
	},
	{
		source: "/api/followup/fast-finish-logistic",
		note: "NestJS",
	},
	{
		source: "/api/followup/payment-request",
		note: "NestJS",
	},
	{
		source: "/api/followup",
		note: "NestJS",
	},
	{
		source: "/api/followup/update-container",
		note: "NestJS",
	},
	// /api/followup/update — Next only (PATCH field coercion, authz, activity log).
	// Do not proxy: Nest compat passes { field, value } into Prisma and returns 500.
	{
		source: "/api/followup/upload-files",
		note: "NestJS",
	},
	{
		source: "/api/foreign-ports",
		note: "Nest (Next fallback: Prisma RPA)",
	},
	{
		source: "/api/gemini/history",
		note: "NestJS",
	},
	{
		source: "/api/gemini/prompts",
		note: "NestJS",
	},
	{
		source: "/api/gemini",
		note: "NestJS",
	},
	{
		source: "/api/gmail/attachments",
		note: "NestJS",
	},
	{
		source: "/api/gmail/messages",
		note: "NestJS",
	},
	{
		source: "/api/gmail/threads",
		note: "NestJS",
	},
	{
		source: "/api/google-drive/create-folder-and-move",
		note: "NestJS",
	},
	{
		source: "/api/google-drive/download",
		note: "NestJS",
	},
	{
		source: "/api/google-drive/files",
		note: "NestJS (user OAuth Drive; folderId + optional includeFolders)",
	},
	{
		source: "/api/google-drive/rename-file",
		note: "NestJS",
	},
	{
		source: "/api/google-drive/rename-folder",
		note: "NestJS",
	},
	{
		source: "/api/google-drive/thumbnail",
		note: "NestJS",
	},
	{
		source: "/api/google-drive/upload-to-folder",
		note: "NestJS",
	},
	{
		source: "/api/internal/backfill-fee-descriptions",
		note: "NestJS",
	},
	{
		source: "/api/ops",
		note: "Nest (Next fallback: Prisma RPA)",
	},
	{
		source: "/api/partners",
		note: "NestJS (ERP + PartnersMasterData fallback)",
	},
	{
		source: "/api/pick-or-lift-place",
		note: "Nest (Next fallback: Prisma RPA)",
	},
	{
		source: "/api/service-modes",
		note: "NestJS",
	},
	{
		source: "/api/shipping-lines",
		note: "Nest (Next fallback: Prisma RPA)",
	},
	{
		source: "/api/table-preferences",
		note: "Nest (Next fallback: Prisma RPA)",
	},
	{
		source: "/api/tracking",
		note: "Nest (Next fallback: Prisma RPA)",
	},
	{
		source: "/api/transaction/create",
		note: "NestJS",
	},
	{
		source: "/api/truck-types",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/activity-log",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/ccgh/upload",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/combine-jobs",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/compose-mail",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/container-report",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/container/ai-autofill-booking",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/container/ai-autofill-bulk",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/container/ai-autofill-edo",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/container/ai-autofill",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/container/create",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/container/delete",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/container/link-declaration",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/container/update",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/create-invoker-job",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/daily-truck-report",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/delete-job",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/drive-url",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/fast-unfinish",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/fcr/create",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/fcr/delete",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/fcr/update",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/payment-request",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/send-mail",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/snp-location",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/tra-tau",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/truck-report",
		note: "NestJS",
	},
	{
		source: "/api/trucking-followup/update",
		note: "NestJS",
	},
	{
		source: "/api/trucking-numbers",
		note: "NestJS",
	},
	{
		source: "/api/units",
		note: "NestJS",
	},
	{
		source: "/api/user/departments",
		note: "Nest (Next fallback: Prisma RPA)",
	},
	{
		source: "/api/user/erp-accounts",
		note: "NestJS",
	},
	{
		source: "/api/user/field-templates/:id",
		note: "NestJS",
	},
	{
		source: "/api/user/field-templates",
		note: "NestJS",
	},
	{
		source: "/api/user/teams",
		note: "Nest (Next fallback: Prisma RPA)",
	},
	{
		source: "/api/user/update-site",
		note: "NestJS",
	},
	{
		source: "/api/users/by-site",
		note: "Nest (Next fallback: Prisma RPA)",
	},
	{
		source: "/api/vehicles",
		note: "NestJS",
	},
	{
		source: "/api/vendor-fee-types",
		note: "Nest (Next fallback: Prisma RPA)",
	},
	{
		source: "/api/vendors",
		note: "Nest (Next fallback: Prisma RPA)",
	},
	{
		source: "/api/warehouse-by-taxcode",
		note: "NestJS ({ warehouses } from PartnersMasterData)",
	},
	{
		source: "/api/work-types",
		note: "NestJS",
	},
];
