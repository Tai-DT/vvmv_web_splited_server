// cds-checklist-configs.ts – checklist configurations extracted from cds-info-panel.tsx

import type { TabChecklistItemConfig } from "./cds-types";

export const IMPORT_TAB_CHECKLIST_CONFIGS: Record<
	string,
	TabChecklistItemConfig[]
> = {
	"import-general-1": [
		{
			id: "precheck",
			label: "Đủ MA_DV / MA_HQ / DV_DT / MA_LH",
			kind: "precheck",
		},
		{
			id: "op",
			label: "Mã loại hình (operationCode)",
			fieldKey: "operationCode",
		},
		{ id: "hq", label: "Mã hải quan (customsCode)", fieldKey: "customsCode" },
		{
			id: "transport",
			label: "Mã phương thức VC (transportMethodCode)",
			fieldKey: "transportMethodCode",
		},
		{
			id: "unit",
			label: "Đơn vị XNK (importExportUnitName)",
			fieldKey: "importExportUnitName",
		},
		{ id: "partner", label: "Đối tác (partnerName)", fieldKey: "partnerName" },
		{ id: "bill", label: "Vận đơn (billOfLading)", fieldKey: "billOfLading" },
		{
			id: "pkgQty",
			label: "Số lượng kiện",
			fieldKey: "packageQuantity",
			requirePositiveNumber: true,
		},
		{ id: "pkgType", label: "Loại kiện", fieldKey: "packageType" },
		{
			id: "gross",
			label: "Tổng trọng lượng gross",
			fieldKey: "grossWeightTotal",
			requirePositiveNumber: true,
		},
		{ id: "weightUnit", label: "Đơn vị trọng lượng", fieldKey: "weightUnit" },
	],
	"import-general-2": [
		{
			id: "invoiceNo",
			label: "Số hóa đơn thương mại",
			fieldKey: "commercialInvoice",
		},
		{
			id: "invoiceDate",
			label: "Ngày hóa đơn",
			fieldKey: "commercialInvoiceDate",
		},
		{
			id: "invoiceTotal",
			label: "Tổng trị giá hóa đơn",
			fieldKey: "totalInvoiceValue",
			requirePositiveNumber: true,
		},
		{
			id: "invoiceCurrency",
			label: "Mã đồng tiền hóa đơn",
			fieldKey: "invoiceCurrency",
		},
		{
			id: "priceTerm",
			label: "Điều kiện giá hóa đơn",
			fieldKey: "invoicePriceCondition",
		},
		{
			id: "payment",
			label: "Phương thức thanh toán",
			fieldKey: "paymentMethod",
		},
		{
			id: "exportCountry",
			label: "Mã nước",
			fieldKey: "exportCountryCode",
		},
		{
			id: "valuationType",
			label: "Mã phân loại khai trị giá",
			fieldKey: "valuationDeclarationTypeCode",
		},
		{
			id: "taxCurrency",
			label: "Mã tiền trị giá tính thuế",
			fieldKey: "taxableValueCurrencyCode",
		},
	],
	"cargo-list": [
		{
			id: "cargo",
			label: "Có ít nhất 1 dòng Cargo List hợp lệ",
			kind: "cargo",
		},
	],
};

export const EXPORT_TAB_CHECKLIST_CONFIGS: Record<
	string,
	TabChecklistItemConfig[]
> = {
	"export-general": [
		{
			id: "precheck",
			label: "Đủ MA_DV / MA_HQ / DV_DT / MA_LH",
			kind: "precheck",
		},
		{
			id: "op",
			label: "Mã loại hình (operationCode)",
			fieldKey: "operationCode",
		},
		{ id: "hq", label: "Mã hải quan (customsCode)", fieldKey: "customsCode" },
		{
			id: "transport",
			label: "Mã phương thức VC (transportMethodCode)",
			fieldKey: "transportMethodCode",
		},
		{
			id: "unit",
			label: "Đơn vị XNK (importExportUnitName)",
			fieldKey: "importExportUnitName",
		},
		{ id: "partner", label: "Đối tác (partnerName)", fieldKey: "partnerName" },
		{ id: "bill", label: "Vận đơn (billOfLading)", fieldKey: "billOfLading" },
		{
			id: "pkgQty",
			label: "Số lượng kiện",
			fieldKey: "packageQuantity",
			requirePositiveNumber: true,
		},
		{ id: "pkgType", label: "Loại kiện", fieldKey: "packageType" },
		{
			id: "gross",
			label: "Tổng trọng lượng gross",
			fieldKey: "grossWeightTotal",
			requirePositiveNumber: true,
		},
		{ id: "weightUnit", label: "Đơn vị trọng lượng", fieldKey: "weightUnit" },
	],
};
