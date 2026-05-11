// cds-lookup-dialog-meta.ts – lookup dialog metadata extracted from cds-info-panel.tsx (Phase 1)

import type { FollowUpCdsInfoRow } from "../../../types";
import type { LookupDialogMeta } from "./cds-lookup-types";

export const LOOKUP_DIALOG_META: Partial<
	Record<keyof FollowUpCdsInfoRow, LookupDialogMeta>
> = {
	correspondingDeclarationNumber: {
		title: "Chọn số tờ khai tương ứng",
		description:
			"Tra cứu số tờ khai tạm nhập tái xuất tương ứng từ dữ liệu live HAN_2024.",
		emptyMessage: "Chưa có dữ liệu số tờ khai tương ứng trong HAN_2024.",
		successMessage: "Đã nạp số tờ khai tương ứng.",
	},
	paymentMethod: {
		title: "Chọn phương thức thanh toán",
		description:
			"Tra cứu phương thức thanh toán theo mirror ECUS và danh mục chung.",
		emptyMessage: "Chưa có danh mục phương thức thanh toán.",
		successMessage: "Đã nạp phương thức thanh toán.",
	},
	invoicePriceCondition: {
		title: "Chọn điều kiện giá",
		description:
			"Tra cứu điều kiện giá hóa đơn theo Incoterms và dữ liệu ECUS.",
		emptyMessage: "Chưa có danh mục điều kiện giá.",
		successMessage: "Đã nạp điều kiện giá hóa đơn.",
	},
	invoiceCurrency: {
		title: "Chọn mã tiền tệ",
		description: "Tra cứu mã tiền tệ cho hóa đơn thương mại.",
		emptyMessage: "Chưa có danh mục mã tiền tệ.",
		successMessage: "Đã nạp mã tiền tệ hóa đơn.",
	},
	taxableValueCurrencyCode: {
		title: "Chọn mã tiền trị giá tính thuế",
		description: "Tra cứu mã tiền dùng cho trị giá tính thuế.",
		emptyMessage: "Chưa có danh mục mã tiền trị giá tính thuế.",
		successMessage: "Đã nạp mã tiền trị giá tính thuế.",
	},
	valuationDeclarationTypeCode: {
		title: "Chọn mã phân loại khai trị giá",
		description: "Tra cứu mã phân loại khai trị giá từ dữ liệu ECUS mirror.",
		emptyMessage: "Chưa có danh mục mã phân loại khai trị giá.",
		successMessage: "Đã nạp mã phân loại khai trị giá.",
	},
	taxPayer: {
		title: "Chọn mã người nộp thuế",
		description: "Tra cứu mã người nộp thuế từ dữ liệu ECUS mirror.",
		emptyMessage: "Chưa có danh mục mã người nộp thuế.",
		successMessage: "Đã nạp mã người nộp thuế.",
	},
	releaseBeforePermitCode: {
		title: "Chọn mã lý do đề nghị BP",
		description:
			"Tra cứu mã lý do đề nghị giải phóng hàng trên cơ sở bảo lãnh.",
		emptyMessage: "Chưa có danh mục mã lý do đề nghị BP.",
		successMessage: "Đã nạp mã lý do đề nghị BP.",
	},
	taxPaymentDeadlineCode: {
		title: "Chọn mã thời hạn nộp thuế",
		description:
			"Tra cứu mã xác định thời hạn nộp thuế từ dữ liệu ECUS mirror.",
		emptyMessage: "Chưa có danh mục mã thời hạn nộp thuế.",
		successMessage: "Đã nạp mã thời hạn nộp thuế.",
	},
	invoiceFormClassificationCode: {
		title: "Chọn mã hình thức hóa đơn",
		description:
			"Tra cứu mã phân loại hình thức hóa đơn từ dữ liệu ECUS mirror.",
		emptyMessage: "Chưa có danh mục mã hình thức hóa đơn.",
		successMessage: "Đã nạp mã hình thức hóa đơn.",
	},
	invoiceClassificationCode: {
		title: "Chọn mã phân loại giá hóa đơn",
		description: "Tra cứu mã phân loại giá hóa đơn từ dữ liệu ECUS mirror.",
		emptyMessage: "Chưa có danh mục mã phân loại giá hóa đơn.",
		successMessage: "Đã nạp mã phân loại giá hóa đơn.",
	},
	transportFeeClassificationCode: {
		title: "Chọn mã phân loại phí vận chuyển",
		description: "Tra cứu mã phân loại phí vận chuyển từ dữ liệu ECUS mirror.",
		emptyMessage: "Chưa có danh mục mã phân loại phí vận chuyển.",
		successMessage: "Đã nạp mã phân loại phí vận chuyển.",
	},
	transportFeeCurrencyCode: {
		title: "Chọn mã tiền phí vận chuyển",
		description: "Tra cứu mã tiền áp dụng cho phí vận chuyển.",
		emptyMessage: "Chưa có danh mục mã tiền phí vận chuyển.",
		successMessage: "Đã nạp mã tiền phí vận chuyển.",
	},
	insuranceFeeClassificationCode: {
		title: "Chọn mã phân loại phí bảo hiểm",
		description: "Tra cứu mã phân loại phí bảo hiểm từ dữ liệu ECUS mirror.",
		emptyMessage: "Chưa có danh mục mã phân loại phí bảo hiểm.",
		successMessage: "Đã nạp mã phân loại phí bảo hiểm.",
	},
	insuranceFeeCurrencyCode: {
		title: "Chọn mã tiền phí bảo hiểm",
		description: "Tra cứu mã tiền áp dụng cho phí bảo hiểm.",
		emptyMessage: "Chưa có danh mục mã tiền phí bảo hiểm.",
		successMessage: "Đã nạp mã tiền phí bảo hiểm.",
	},
	taxSubstituteBankCode: {
		title: "Chọn mã ngân hàng trả thuế thay",
		description:
			"Tra cứu mã ngân hàng trả thuế thay từ dữ liệu ECUS mirror (kèm mã bảo lãnh đã khai khi danh mục BL_THUE thưa).",
		emptyMessage: "Chưa có danh mục mã ngân hàng trả thuế thay.",
		successMessage: "Đã nạp mã ngân hàng trả thuế thay.",
	},
	guaranteeBankCode: {
		title: "Chọn mã ngân hàng bảo lãnh",
		description: "Tra cứu mã ngân hàng bảo lãnh từ dữ liệu ECUS mirror.",
		emptyMessage: "Chưa có danh mục mã ngân hàng bảo lãnh.",
		successMessage: "Đã nạp mã ngân hàng bảo lãnh.",
	},
	packageType: {
		title: "Chọn loại kiện",
		description: "Tra cứu loại kiện theo danh mục đã khai trong mirror ECUS.",
		emptyMessage: "Chưa có danh mục loại kiện.",
		successMessage: "Đã nạp loại kiện.",
	},
	weightUnit: {
		title: "Chọn đơn vị trọng lượng",
		description:
			"Tra cứu đơn vị trọng lượng theo danh mục ECUS và dữ liệu mirror.",
		emptyMessage: "Chưa có danh mục đơn vị trọng lượng.",
		successMessage: "Đã nạp đơn vị trọng lượng.",
	},
};

export const LOOKUP_PAIRED_NAME_FIELDS: Partial<
	Record<keyof FollowUpCdsInfoRow, keyof FollowUpCdsInfoRow>
> = {
	customsWarehouseCode: "customsWarehouseName",
	finalDestinationCode: "finalDestinationName",
	loadingLocationCode: "loadingLocationName",
	transportVehicleCode: "transportVehicleName",
	unloadingLocationCode: "unloadingLocationName",
	warehouseLocationCode: "warehouseLocationName",
};

/** Field keys displayed in the universal review panel */
export const UNIVERSAL_REVIEW_FIELD_KEYS: Array<keyof FollowUpCdsInfoRow> = [
	"operationCode",
	"customsCode",
	"personOrganizationClassification",
	"declarationProcessingDeptCode",
	"transportMethodCode",
	"importExportUnitName",
	"partnerName",
	"exportCountryCode",
	"billOfLading",
	"packageQuantity",
	"packageType",
	"grossWeightTotal",
	"weightUnit",
	"commercialInvoice",
	"commercialInvoiceDate",
	"paymentMethod",
	"invoicePriceCondition",
	"invoiceCurrency",
	"valuationDeclarationTypeCode",
	"taxableValueCurrencyCode",
	"taxPayer",
	"releaseBeforePermitCode",
	"taxPaymentDeadlineCode",
	"taxDestinationLocation",
	"taxSubstituteBankCode",
	"guaranteeBankCode",
	"creditLimitIssueYear",
	"creditLimitDocumentSymbol",
	"creditLimitDocumentNumber",
	"guaranteeDocumentSymbol",
	"guaranteeDocumentNumber",
	"transportFeeClassificationCode",
	"transportFeeCurrencyCode",
	"insuranceFeeClassificationCode",
	"insuranceFeeCurrencyCode",
	"insuranceRegistrationNumber",
	"valuationSummaryReceiptNumber",
	"billItems",
	"valuationAdjustments",
	"electronicAttachments",
	"transportSchedules",
];
