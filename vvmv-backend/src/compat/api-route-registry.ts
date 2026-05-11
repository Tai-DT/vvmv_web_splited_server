// Generated from vvmv-frontend/app/api/**/route.ts. Keep route contract inventory in one place.
export interface ApiRouteDefinition {
  key: string;
  source: string;
  nestPath: string;
  methods: readonly string[];
}

export const FRONTEND_API_ROUTES = [
  {
    "key": "accounting/disbursement-report",
    "source": "/api/accounting/disbursement-report",
    "nestPath": "accounting/disbursement-report",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "admin/api-keys",
    "source": "/api/admin/api-keys",
    "nestPath": "admin/api-keys",
    "methods": [
      "GET",
      "POST",
      "PUT",
      "DELETE"
    ]
  },
  {
    "key": "admin/company-colors",
    "source": "/api/admin/company-colors",
    "nestPath": "admin/company-colors",
    "methods": [
      "GET",
      "POST"
    ]
  },
  {
    "key": "admin/container-size-configs",
    "source": "/api/admin/container-size-configs",
    "nestPath": "admin/container-size-configs",
    "methods": [
      "GET",
      "POST",
      "PUT",
      "DELETE"
    ]
  },
  {
    "key": "admin/customs-warehouses",
    "source": "/api/admin/customs-warehouses",
    "nestPath": "admin/customs-warehouses",
    "methods": [
      "GET",
      "POST",
      "PUT",
      "DELETE"
    ]
  },
  {
    "key": "admin/department-managers",
    "source": "/api/admin/department-managers",
    "nestPath": "admin/department-managers",
    "methods": [
      "GET",
      "POST",
      "DELETE"
    ]
  },
  {
    "key": "admin/departments/by-site",
    "source": "/api/admin/departments/by-site",
    "nestPath": "admin/departments/by-site",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "admin/departments",
    "source": "/api/admin/departments",
    "nestPath": "admin/departments",
    "methods": [
      "GET",
      "POST",
      "PUT",
      "DELETE"
    ]
  },
  {
    "key": "admin/field-options/[id]",
    "source": "/api/admin/field-options/:id",
    "nestPath": "admin/field-options/:id",
    "methods": [
      "PATCH",
      "DELETE"
    ]
  },
  {
    "key": "admin/field-options",
    "source": "/api/admin/field-options",
    "nestPath": "admin/field-options",
    "methods": [
      "GET",
      "POST"
    ]
  },
  {
    "key": "admin/foreign-ports",
    "source": "/api/admin/foreign-ports",
    "nestPath": "admin/foreign-ports",
    "methods": [
      "GET",
      "POST",
      "PUT",
      "DELETE"
    ]
  },
  {
    "key": "admin/ops",
    "source": "/api/admin/ops",
    "nestPath": "admin/ops",
    "methods": [
      "GET",
      "POST",
      "PUT",
      "DELETE"
    ]
  },
  {
    "key": "admin/partners-master-data/erp-lookup",
    "source": "/api/admin/partners-master-data/erp-lookup",
    "nestPath": "admin/partners-master-data/erp-lookup",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "admin/partners-master-data/password",
    "source": "/api/admin/partners-master-data/password",
    "nestPath": "admin/partners-master-data/password",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "admin/partners-master-data",
    "source": "/api/admin/partners-master-data",
    "nestPath": "admin/partners-master-data",
    "methods": [
      "GET",
      "POST",
      "PUT",
      "DELETE"
    ]
  },
  {
    "key": "admin/pick-or-lift-places",
    "source": "/api/admin/pick-or-lift-places",
    "nestPath": "admin/pick-or-lift-places",
    "methods": [
      "GET",
      "POST",
      "PUT",
      "DELETE"
    ]
  },
  {
    "key": "admin/shipping-lines",
    "source": "/api/admin/shipping-lines",
    "nestPath": "admin/shipping-lines",
    "methods": [
      "GET",
      "POST",
      "PUT",
      "DELETE"
    ]
  },
  {
    "key": "admin/site-managers",
    "source": "/api/admin/site-managers",
    "nestPath": "admin/site-managers",
    "methods": [
      "GET",
      "POST",
      "DELETE"
    ]
  },
  {
    "key": "admin/teams",
    "source": "/api/admin/teams",
    "nestPath": "admin/teams",
    "methods": [
      "GET",
      "POST",
      "PUT",
      "DELETE"
    ]
  },
  {
    "key": "admin/trucking-numbers",
    "source": "/api/admin/trucking-numbers",
    "nestPath": "admin/trucking-numbers",
    "methods": [
      "GET",
      "POST",
      "PUT",
      "DELETE"
    ]
  },
  {
    "key": "admin/users",
    "source": "/api/admin/users",
    "nestPath": "admin/users",
    "methods": [
      "GET",
      "POST",
      "PUT",
      "DELETE"
    ]
  },
  {
    "key": "admin/vendor-fee-types",
    "source": "/api/admin/vendor-fee-types",
    "nestPath": "admin/vendor-fee-types",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "admin/vendors",
    "source": "/api/admin/vendors",
    "nestPath": "admin/vendors",
    "methods": [
      "GET",
      "POST",
      "PUT",
      "DELETE"
    ]
  },
  {
    "key": "admin/warehouse-configs",
    "source": "/api/admin/warehouse-configs",
    "nestPath": "admin/warehouse-configs",
    "methods": [
      "GET",
      "POST",
      "PUT",
      "DELETE"
    ]
  },
  {
    "key": "airports",
    "source": "/api/airports",
    "nestPath": "airports",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "auth/[...all]",
    "source": "/api/auth/:all*",
    "nestPath": "auth/*all",
    "methods": [
      "GET",
      "POST"
    ]
  },
  {
    "key": "cargo-types",
    "source": "/api/cargo-types",
    "nestPath": "cargo-types",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "contact",
    "source": "/api/contact",
    "nestPath": "contact",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "container-size-configs",
    "source": "/api/container-size-configs",
    "nestPath": "container-size-configs",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "container-sizes",
    "source": "/api/container-sizes",
    "nestPath": "container-sizes",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "debug",
    "source": "/api/debug",
    "nestPath": "debug",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "dispatch/add-vendor",
    "source": "/api/dispatch/add-vendor",
    "nestPath": "dispatch/add-vendor",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "dispatch/assign",
    "source": "/api/dispatch/assign",
    "nestPath": "dispatch/assign",
    "methods": [
      "PATCH"
    ]
  },
  {
    "key": "dispatch/auto-sync",
    "source": "/api/dispatch/auto-sync",
    "nestPath": "dispatch/auto-sync",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "dispatch/board",
    "source": "/api/dispatch/board",
    "nestPath": "dispatch/board",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "dispatch/check-plate",
    "source": "/api/dispatch/check-plate",
    "nestPath": "dispatch/check-plate",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "dispatch/send-mail",
    "source": "/api/dispatch/send-mail",
    "nestPath": "dispatch/send-mail",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "dispatch/unassign",
    "source": "/api/dispatch/unassign",
    "nestPath": "dispatch/unassign",
    "methods": [
      "PATCH"
    ]
  },
  {
    "key": "erp-import-fee",
    "source": "/api/erp-import-fee",
    "nestPath": "erp-import-fee",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "erp/check-invoice",
    "source": "/api/erp/check-invoice",
    "nestPath": "erp/check-invoice",
    "methods": [
      "GET",
      "POST"
    ]
  },
  {
    "key": "erp/fee-descriptions",
    "source": "/api/erp/fee-descriptions",
    "nestPath": "erp/fee-descriptions",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "external/container-declarations",
    "source": "/api/external/container-declarations",
    "nestPath": "external/container-declarations",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "external/create-transaction",
    "source": "/api/external/create-transaction",
    "nestPath": "external/create-transaction",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "external/erp/create-ar",
    "source": "/api/external/erp/create-ar",
    "nestPath": "external/erp/create-ar",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "external/tracking/[deliveryNumber]",
    "source": "/api/external/tracking/:deliveryNumber",
    "nestPath": "external/tracking/:deliveryNumber",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "external/tracking",
    "source": "/api/external/tracking",
    "nestPath": "external/tracking",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "external/vendor-portal/assignments",
    "source": "/api/external/vendor-portal/assignments",
    "nestPath": "external/vendor-portal/assignments",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "external/vendor-portal/costs/review",
    "source": "/api/external/vendor-portal/costs/review",
    "nestPath": "external/vendor-portal/costs/review",
    "methods": [
      "PATCH"
    ]
  },
  {
    "key": "external/vendor-portal/costs",
    "source": "/api/external/vendor-portal/costs",
    "nestPath": "external/vendor-portal/costs",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "external/vendor-portal/fee-types",
    "source": "/api/external/vendor-portal/fee-types",
    "nestPath": "external/vendor-portal/fee-types",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "external/vendor-portal/login",
    "source": "/api/external/vendor-portal/login",
    "nestPath": "external/vendor-portal/login",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "external/vendor-portal/logout",
    "source": "/api/external/vendor-portal/logout",
    "nestPath": "external/vendor-portal/logout",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "external/vendor-portal/session",
    "source": "/api/external/vendor-portal/session",
    "nestPath": "external/vendor-portal/session",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "external/vendor-portal/vehicle-info",
    "source": "/api/external/vendor-portal/vehicle-info",
    "nestPath": "external/vendor-portal/vehicle-info",
    "methods": [
      "PATCH"
    ]
  },
  {
    "key": "field-options",
    "source": "/api/field-options",
    "nestPath": "field-options",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "followup/[id]/app-declaration/sync",
    "source": "/api/followup/:id/app-declaration/sync",
    "nestPath": "followup/:id/app-declaration/sync",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "followup/[id]/cargo",
    "source": "/api/followup/:id/cargo",
    "nestPath": "followup/:id/cargo",
    "methods": [
      "POST",
      "GET"
    ]
  },
  {
    "key": "followup/[id]/cds-ai-document/history",
    "source": "/api/followup/:id/cds-ai-document/history",
    "nestPath": "followup/:id/cds-ai-document/history",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "followup/[id]/cds-ai-document",
    "source": "/api/followup/:id/cds-ai-document",
    "nestPath": "followup/:id/cds-ai-document",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "followup/[id]/cds-info",
    "source": "/api/followup/:id/cds-info",
    "nestPath": "followup/:id/cds-info",
    "methods": [
      "GET",
      "POST"
    ]
  },
  {
    "key": "followup/[id]/export",
    "source": "/api/followup/:id/export",
    "nestPath": "followup/:id/export",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "followup/[id]/han-declarations/by-number",
    "source": "/api/followup/:id/han-declarations/by-number",
    "nestPath": "followup/:id/han-declarations/by-number",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "followup/[id]/han-declarations",
    "source": "/api/followup/:id/han-declarations",
    "nestPath": "followup/:id/han-declarations",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "followup/[id]/register",
    "source": "/api/followup/:id/register",
    "nestPath": "followup/:id/register",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "followup/activity-log",
    "source": "/api/followup/activity-log",
    "nestPath": "followup/activity-log",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "followup/bulk-update",
    "source": "/api/followup/bulk-update",
    "nestPath": "followup/bulk-update",
    "methods": [
      "PATCH"
    ]
  },
  {
    "key": "followup/cargo-unit-codes",
    "source": "/api/followup/cargo-unit-codes",
    "nestPath": "followup/cargo-unit-codes",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "followup/cds-lookups",
    "source": "/api/followup/cds-lookups",
    "nestPath": "followup/cds-lookups",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "followup/check-bill-booking",
    "source": "/api/followup/check-bill-booking",
    "nestPath": "followup/check-bill-booking",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "followup/check-cds-attachment",
    "source": "/api/followup/check-cds-attachment",
    "nestPath": "followup/check-cds-attachment",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "followup/check-csht-files",
    "source": "/api/followup/check-csht-files",
    "nestPath": "followup/check-csht-files",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "followup/check-declaration-files",
    "source": "/api/followup/check-declaration-files",
    "nestPath": "followup/check-declaration-files",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "followup/check-delivered",
    "source": "/api/followup/check-delivered",
    "nestPath": "followup/check-delivered",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "followup/check-folder",
    "source": "/api/followup/check-folder",
    "nestPath": "followup/check-folder",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "followup/check-lphq-files",
    "source": "/api/followup/check-lphq-files",
    "nestPath": "followup/check-lphq-files",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "followup/check-quan-kvgs",
    "source": "/api/followup/check-quan-kvgs",
    "nestPath": "followup/check-quan-kvgs",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "followup/check-tax-files",
    "source": "/api/followup/check-tax-files",
    "nestPath": "followup/check-tax-files",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "followup/check-transid",
    "source": "/api/followup/check-transid",
    "nestPath": "followup/check-transid",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "followup/create-container",
    "source": "/api/followup/create-container",
    "nestPath": "followup/create-container",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "followup/create-invoker-job",
    "source": "/api/followup/create-invoker-job",
    "nestPath": "followup/create-invoker-job",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "followup/create",
    "source": "/api/followup/create",
    "nestPath": "followup/create",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "followup/declaration-report",
    "source": "/api/followup/declaration-report",
    "nestPath": "followup/declaration-report",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "followup/delete-container",
    "source": "/api/followup/delete-container",
    "nestPath": "followup/delete-container",
    "methods": [
      "DELETE"
    ]
  },
  {
    "key": "followup/fast-finish-logistic",
    "source": "/api/followup/fast-finish-logistic",
    "nestPath": "followup/fast-finish-logistic",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "followup/payment-request",
    "source": "/api/followup/payment-request",
    "nestPath": "followup/payment-request",
    "methods": [
      "GET",
      "POST",
      "PATCH",
      "DELETE"
    ]
  },
  {
    "key": "followup",
    "source": "/api/followup",
    "nestPath": "followup",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "followup/update-container",
    "source": "/api/followup/update-container",
    "nestPath": "followup/update-container",
    "methods": [
      "PATCH"
    ]
  },
  {
    "key": "followup/update",
    "source": "/api/followup/update",
    "nestPath": "followup/update",
    "methods": [
      "PATCH"
    ]
  },
  {
    "key": "followup/upload-files",
    "source": "/api/followup/upload-files",
    "nestPath": "followup/upload-files",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "foreign-ports",
    "source": "/api/foreign-ports",
    "nestPath": "foreign-ports",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "gemini/history",
    "source": "/api/gemini/history",
    "nestPath": "gemini/history",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "gemini/prompts",
    "source": "/api/gemini/prompts",
    "nestPath": "gemini/prompts",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "gemini",
    "source": "/api/gemini",
    "nestPath": "gemini",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "gmail/attachments",
    "source": "/api/gmail/attachments",
    "nestPath": "gmail/attachments",
    "methods": [
      "GET",
      "POST"
    ]
  },
  {
    "key": "gmail/messages",
    "source": "/api/gmail/messages",
    "nestPath": "gmail/messages",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "gmail/threads",
    "source": "/api/gmail/threads",
    "nestPath": "gmail/threads",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "google-drive/create-folder-and-move",
    "source": "/api/google-drive/create-folder-and-move",
    "nestPath": "google-drive/create-folder-and-move",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "google-drive/download",
    "source": "/api/google-drive/download",
    "nestPath": "google-drive/download",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "google-drive/files",
    "source": "/api/google-drive/files",
    "nestPath": "google-drive/files",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "google-drive/rename-file",
    "source": "/api/google-drive/rename-file",
    "nestPath": "google-drive/rename-file",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "google-drive/rename-folder",
    "source": "/api/google-drive/rename-folder",
    "nestPath": "google-drive/rename-folder",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "google-drive/thumbnail",
    "source": "/api/google-drive/thumbnail",
    "nestPath": "google-drive/thumbnail",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "google-drive/upload-to-folder",
    "source": "/api/google-drive/upload-to-folder",
    "nestPath": "google-drive/upload-to-folder",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "internal/backfill-fee-descriptions",
    "source": "/api/internal/backfill-fee-descriptions",
    "nestPath": "internal/backfill-fee-descriptions",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "ops",
    "source": "/api/ops",
    "nestPath": "ops",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "partners",
    "source": "/api/partners",
    "nestPath": "partners",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "pick-or-lift-place",
    "source": "/api/pick-or-lift-place",
    "nestPath": "pick-or-lift-place",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "service-modes",
    "source": "/api/service-modes",
    "nestPath": "service-modes",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "shipping-lines",
    "source": "/api/shipping-lines",
    "nestPath": "shipping-lines",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "table-preferences",
    "source": "/api/table-preferences",
    "nestPath": "table-preferences",
    "methods": [
      "GET",
      "PUT"
    ]
  },
  {
    "key": "tracking",
    "source": "/api/tracking",
    "nestPath": "tracking",
    "methods": [
      "GET",
      "POST",
      "DELETE"
    ]
  },
  {
    "key": "transaction/create",
    "source": "/api/transaction/create",
    "nestPath": "transaction/create",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "truck-types",
    "source": "/api/truck-types",
    "nestPath": "truck-types",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "trucking-followup/activity-log",
    "source": "/api/trucking-followup/activity-log",
    "nestPath": "trucking-followup/activity-log",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "trucking-followup/ccgh/upload",
    "source": "/api/trucking-followup/ccgh/upload",
    "nestPath": "trucking-followup/ccgh/upload",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "trucking-followup/combine-jobs",
    "source": "/api/trucking-followup/combine-jobs",
    "nestPath": "trucking-followup/combine-jobs",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "trucking-followup/compose-mail",
    "source": "/api/trucking-followup/compose-mail",
    "nestPath": "trucking-followup/compose-mail",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "trucking-followup/container-report",
    "source": "/api/trucking-followup/container-report",
    "nestPath": "trucking-followup/container-report",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "trucking-followup/container/ai-autofill-booking",
    "source": "/api/trucking-followup/container/ai-autofill-booking",
    "nestPath": "trucking-followup/container/ai-autofill-booking",
    "methods": [
      "GET",
      "POST"
    ]
  },
  {
    "key": "trucking-followup/container/ai-autofill-bulk",
    "source": "/api/trucking-followup/container/ai-autofill-bulk",
    "nestPath": "trucking-followup/container/ai-autofill-bulk",
    "methods": [
      "GET",
      "POST"
    ]
  },
  {
    "key": "trucking-followup/container/ai-autofill-edo",
    "source": "/api/trucking-followup/container/ai-autofill-edo",
    "nestPath": "trucking-followup/container/ai-autofill-edo",
    "methods": [
      "GET",
      "POST"
    ]
  },
  {
    "key": "trucking-followup/container/ai-autofill",
    "source": "/api/trucking-followup/container/ai-autofill",
    "nestPath": "trucking-followup/container/ai-autofill",
    "methods": [
      "GET",
      "POST"
    ]
  },
  {
    "key": "trucking-followup/container/create",
    "source": "/api/trucking-followup/container/create",
    "nestPath": "trucking-followup/container/create",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "trucking-followup/container/delete",
    "source": "/api/trucking-followup/container/delete",
    "nestPath": "trucking-followup/container/delete",
    "methods": [
      "DELETE"
    ]
  },
  {
    "key": "trucking-followup/container/link-declaration",
    "source": "/api/trucking-followup/container/link-declaration",
    "nestPath": "trucking-followup/container/link-declaration",
    "methods": [
      "POST",
      "DELETE"
    ]
  },
  {
    "key": "trucking-followup/container/update",
    "source": "/api/trucking-followup/container/update",
    "nestPath": "trucking-followup/container/update",
    "methods": [
      "PATCH"
    ]
  },
  {
    "key": "trucking-followup/create-invoker-job",
    "source": "/api/trucking-followup/create-invoker-job",
    "nestPath": "trucking-followup/create-invoker-job",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "trucking-followup/daily-truck-report",
    "source": "/api/trucking-followup/daily-truck-report",
    "nestPath": "trucking-followup/daily-truck-report",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "trucking-followup/delete-job",
    "source": "/api/trucking-followup/delete-job",
    "nestPath": "trucking-followup/delete-job",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "trucking-followup/drive-url",
    "source": "/api/trucking-followup/drive-url",
    "nestPath": "trucking-followup/drive-url",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "trucking-followup/fast-unfinish",
    "source": "/api/trucking-followup/fast-unfinish",
    "nestPath": "trucking-followup/fast-unfinish",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "trucking-followup/fcr/create",
    "source": "/api/trucking-followup/fcr/create",
    "nestPath": "trucking-followup/fcr/create",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "trucking-followup/fcr/delete",
    "source": "/api/trucking-followup/fcr/delete",
    "nestPath": "trucking-followup/fcr/delete",
    "methods": [
      "DELETE"
    ]
  },
  {
    "key": "trucking-followup/fcr/update",
    "source": "/api/trucking-followup/fcr/update",
    "nestPath": "trucking-followup/fcr/update",
    "methods": [
      "PATCH"
    ]
  },
  {
    "key": "trucking-followup/payment-request",
    "source": "/api/trucking-followup/payment-request",
    "nestPath": "trucking-followup/payment-request",
    "methods": [
      "GET",
      "POST",
      "PATCH",
      "DELETE"
    ]
  },
  {
    "key": "trucking-followup",
    "source": "/api/trucking-followup",
    "nestPath": "trucking-followup",
    "methods": [
      "GET",
      "POST"
    ]
  },
  {
    "key": "trucking-followup/send-mail",
    "source": "/api/trucking-followup/send-mail",
    "nestPath": "trucking-followup/send-mail",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "trucking-followup/snp-location",
    "source": "/api/trucking-followup/snp-location",
    "nestPath": "trucking-followup/snp-location",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "trucking-followup/tra-tau",
    "source": "/api/trucking-followup/tra-tau",
    "nestPath": "trucking-followup/tra-tau",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "trucking-followup/truck-report",
    "source": "/api/trucking-followup/truck-report",
    "nestPath": "trucking-followup/truck-report",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "trucking-followup/update",
    "source": "/api/trucking-followup/update",
    "nestPath": "trucking-followup/update",
    "methods": [
      "PATCH"
    ]
  },
  {
    "key": "trucking-numbers",
    "source": "/api/trucking-numbers",
    "nestPath": "trucking-numbers",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "units",
    "source": "/api/units",
    "nestPath": "units",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "user/departments",
    "source": "/api/user/departments",
    "nestPath": "user/departments",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "user/erp-accounts",
    "source": "/api/user/erp-accounts",
    "nestPath": "user/erp-accounts",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "user/field-templates/[id]",
    "source": "/api/user/field-templates/:id",
    "nestPath": "user/field-templates/:id",
    "methods": [
      "PATCH",
      "DELETE"
    ]
  },
  {
    "key": "user/field-templates",
    "source": "/api/user/field-templates",
    "nestPath": "user/field-templates",
    "methods": [
      "GET",
      "POST"
    ]
  },
  {
    "key": "user/teams",
    "source": "/api/user/teams",
    "nestPath": "user/teams",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "user/update-site",
    "source": "/api/user/update-site",
    "nestPath": "user/update-site",
    "methods": [
      "POST"
    ]
  },
  {
    "key": "users/by-site",
    "source": "/api/users/by-site",
    "nestPath": "users/by-site",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "vehicles",
    "source": "/api/vehicles",
    "nestPath": "vehicles",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "vendor-fee-types",
    "source": "/api/vendor-fee-types",
    "nestPath": "vendor-fee-types",
    "methods": [
      "GET",
      "POST",
      "PUT",
      "DELETE"
    ]
  },
  {
    "key": "vendors",
    "source": "/api/vendors",
    "nestPath": "vendors",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "warehouse-by-taxcode",
    "source": "/api/warehouse-by-taxcode",
    "nestPath": "warehouse-by-taxcode",
    "methods": [
      "GET"
    ]
  },
  {
    "key": "work-types",
    "source": "/api/work-types",
    "nestPath": "work-types",
    "methods": [
      "GET"
    ]
  }
] as const satisfies readonly ApiRouteDefinition[];

export const FRONTEND_API_NEST_PATHS = FRONTEND_API_ROUTES.map((route) => route.nestPath);
