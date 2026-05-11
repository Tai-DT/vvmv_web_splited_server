// cds-sets.ts – Set constants used across the CDS Info Panel

import type { FollowUpCdsInfoRow } from "../../../types";

export const APP_FIELD_OPTION_FIELD_NAMES = [
	"businessTypeGroup",
	"cargoClassificationCode",
	"customsCode",
	"customsWarehouseCode",
	"declarationProcessingDeptCode",
	"exportCountryCode",
	"finalDestinationCode",
	"guaranteeBankCode",
	"insuranceFeeClassificationCode",
	"insuranceFeeCurrencyCode",
	"inspectionResultCode",
	"invoiceClassificationCode",
	"invoiceCurrency",
	"invoiceFormClassificationCode",
	"invoicePriceCondition",
	"loadingLocationCode",
	"packageType",
	"paymentMethod",
	"unloadingLocationCode",
	"warehouseLocationCode",
	"personOrganizationClassification",
	"releaseBeforePermitCode",
	"taxableValueCurrencyCode",
	"taxDestinationLocation",
	"taxPayer",
	"taxPaymentDeadlineCode",
	"taxSubstituteBankCode",
	"transportFeeClassificationCode",
	"transportFeeCurrencyCode",
	"transportMethodCode",
	"transportVehicleCode",
	"valuationDeclarationTypeCode",
	"weightUnit",
] as const satisfies readonly (keyof FollowUpCdsInfoRow)[];

export const APP_FIELD_OPTION_FIELDS = new Set<keyof FollowUpCdsInfoRow>(
	APP_FIELD_OPTION_FIELD_NAMES,
);

export const CDS_HARDCODED_FIELD_OPTION_FIELD_NAMES = [
	"businessTypeGroup",
	"cargoClassificationCode",
	"customsCode",
	"exportCountryCode",
	"inspectionResultCode",
	"insuranceFeeClassificationCode",
	"insuranceFeeCurrencyCode",
	"invoiceClassificationCode",
	"invoiceCurrency",
	"invoiceFormClassificationCode",
	"invoicePriceCondition",
	"packageType",
	"paymentMethod",
	"personOrganizationClassification",
	"releaseBeforePermitCode",
	"taxableValueCurrencyCode",
	"taxPayer",
	"taxPaymentDeadlineCode",
	"transportFeeClassificationCode",
	"transportFeeCurrencyCode",
	"transportMethodCode",
	"valuationDeclarationTypeCode",
	"weightUnit",
] as const satisfies readonly (keyof FollowUpCdsInfoRow)[];

export const CDS_HARDCODED_FIELD_OPTION_FIELDS = new Set<
	keyof FollowUpCdsInfoRow
>(CDS_HARDCODED_FIELD_OPTION_FIELD_NAMES);

export const BILL_ITEMS_SECTION_TITLES = new Set([
	"Vận đơn",
	"Thông tin Logistics",
	"Thông tin container",
]);

export const VALUATION_SECTION_TITLES = new Set(["Khai trị giá"]);

export const ATTACHMENT_SECTION_TITLES = new Set([
	"Thông tin thuế",
	"Điều vận container",
	"Thông tin đính kèm",
]);

export const TRANSPORT_SECTION_TITLES = new Set([
	"Thông tin thuế",
	"Điều vận container",
	"Thông tin vận chuyển",
]);

export const LICENSE_SECTION_TITLES = new Set([
	"Khác",
	"Chứng từ giấy phép xuất khẩu",
]);

export const LEGAL_DOCUMENT_SECTION_TITLES = new Set(["Khác"]);

export const CATALOG_TEXT_FIELD_KEYS = new Set<keyof FollowUpCdsInfoRow>([
	"importLicense",
	"paymentMethod",
	"invoicePriceCondition",
	"invoiceCurrency",
	"taxableValueCurrencyCode",
	"valuationDeclarationTypeCode",
	"taxPayer",
	"releaseBeforePermitCode",
	"taxPaymentDeadlineCode",
	"invoiceFormClassificationCode",
	"invoiceClassificationCode",
	"transportFeeClassificationCode",
	"transportFeeCurrencyCode",
	"insuranceFeeClassificationCode",
	"insuranceFeeCurrencyCode",
	"packageType",
	"weightUnit",
]);
