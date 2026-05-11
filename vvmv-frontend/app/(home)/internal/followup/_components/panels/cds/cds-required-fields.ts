// cds-required-fields.ts – field sets extracted from cds-info-panel.tsx (Phase 1)

import type { FollowUpCdsInfoRow } from "../../../types";

export const CDS_NUMBER_FIELD_KEYS = new Set<keyof FollowUpCdsInfoRow>([
	"packageQuantity",
	"grossWeightTotal",
	"containerQuantity",
	"declaredValue",
	"totalInvoiceValue",
	"totalTaxableValue",
	"transportFee",
	"insuranceFee",
	"exchangeRate",
	"netWeight",
]);

export const REQUIRED_CDS_FIELDS = new Set<string>([
	"operationCode",
	"customsCode",
	"cargoClassificationCode",
	"transportMethodCode",
	"importExportUnitName",
	"partnerName",
	"importExportBusinessAddress",
	"packageQuantity",
	"grossWeightTotal",
	"loadingLocationCode",
	"invoiceFormClassificationCode",
	"invoicePriceCondition",
	"invoiceClassificationCode",
	"totalInvoiceValue",
	"invoiceCurrency",
]);
