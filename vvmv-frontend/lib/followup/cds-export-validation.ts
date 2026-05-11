import type {
	CargoListRow,
	DeclarationRow,
	FollowUpCdsInfoRow,
	FollowUpRow,
} from "@/app/(home)/internal/followup/types";
import { isCargoCustomCodeRequiredForOperationCode } from "@/lib/followup/cargo-custom-code-rules";
import { isCargoRowEffectivelyEmpty } from "@/lib/followup/cargo-list-validation";
import { normalizeCdsBusinessTypeGroup } from "@/lib/followup/cds-business-type-groups";
import {
	buildCdsCompanyPartyDefaultsFromCompanyProfile,
	buildCdsCompanyPartyDefaultWarnings,
} from "@/lib/followup/cds-company-party-defaults";
import {
	getCdsStaticFieldOptions,
	isAllowedCdsStaticFieldValue,
} from "@/lib/followup/cds-static-field-options";
import { getCdsVnaccsFieldLabel } from "@/lib/followup/cds-vnaccs-field-labels";
import {
	getVnaccsStandardFieldOptions,
	isAllowedVnaccsStandardFieldValue,
} from "@/lib/followup/cds-vnaccs-standard-rules";
import { normalizeCdsWeightUnit } from "@/lib/followup/cds-weight-units";
import type { CompanyProfileDefaults } from "@/lib/followup/company-profile-defaults";
import { normalizeLooseNumber } from "@/lib/followup/number-utils";
import {
	deriveOperationType,
	type FollowUpOperationType,
} from "@/lib/followup/operation-type";
import { isPersonOrganizationClassificationRequiredForOperationCode } from "./cds-person-organization-classification";

export type CdsExportValidationSeverity = "error" | "warning";

export type CdsExportValidationIssue = {
	path: string;
	label: string;
	message: string;
	severity: CdsExportValidationSeverity;
};

export type CdsExportValidationInput = {
	cdsInfo?: Partial<FollowUpCdsInfoRow> | null;
	cargoList?: Partial<CargoListRow>[] | null;
	declarations?: DeclarationRow[] | null;
	followUpSummary?: Partial<
		Pick<
			FollowUpRow,
			| "operationType"
			| "companyName"
			| "supplier"
			| "billOrBooking"
			| "quantity"
			| "unit"
			| "grossWeight"
			| "invoice"
			| "location"
			| "loadingLocation"
			| "pickupLocation"
			| "transportMethod"
			| "notes"
		>
	> | null;
	companyProfile?: Partial<CompanyProfileDefaults> | null;
	operationType?: string | null;
};

export type CdsExportValidationResult = {
	issues: CdsExportValidationIssue[];
	resolvedOperationType: FollowUpOperationType | null;
};

export class CdsExportValidationError extends Error {
	issues: CdsExportValidationIssue[];

	constructor(issues: CdsExportValidationIssue[]) {
		super("Thiếu dữ liệu bắt buộc trước khi xuất Excel ECUS");
		this.name = "CdsExportValidationError";
		this.issues = issues;
	}
}

function normalizeText(value: unknown) {
	if (typeof value === "string") {
		return value.trim();
	}

	if (value instanceof Date) {
		return Number.isNaN(value.getTime())
			? ""
			: value.toISOString().slice(0, 10);
	}

	if (typeof value === "number") {
		return Number.isFinite(value) ? String(value) : "";
	}

	return "";
}

function hasText(value: unknown) {
	return normalizeText(value).length > 0;
}

type StandardFieldKey = Extract<keyof FollowUpCdsInfoRow, string>;

// Keep export blocking rules aligned with the red-star fields in the classic UI.
const EXPORT_BLOCKING_CDS_INFO_FIELDS = new Set<StandardFieldKey>([
	"operationCode",
	"customsCode",
	"transportMethodCode",
	"partnerName",
	"packageQuantity",
	"packageType",
	"invoicePriceCondition",
	"totalInvoiceValue",
	"invoiceCurrency",
]);

function hasAnyValue(values: unknown[]) {
	return values.some((value) => {
		if (typeof value === "string") {
			return value.trim() !== "";
		}

		if (typeof value === "number") {
			return Number.isFinite(value);
		}

		return value !== null && value !== undefined;
	});
}

function normalizeCode(value: unknown) {
	const normalized = normalizeText(value).toUpperCase();
	return normalized || "";
}

function isAirTransportVehicleNameFormat(value: unknown) {
	const normalized = normalizeText(value).toUpperCase();
	if (!normalized) {
		return false;
	}

	// Airline(2) + flight(4) + "/" + day(2) + month(3), e.g. AB0001/01JAN
	return /^[A-Z0-9]{2}[A-Z0-9]{4}\/\d{2}[A-Z]{3}$/.test(normalized);
}

function getCdsInfoRequirementSeverity(
	operationType: FollowUpOperationType | null,
	fieldKey: StandardFieldKey,
): CdsExportValidationSeverity {
	if (operationType !== "XUAT") {
		return "error";
	}

	return EXPORT_BLOCKING_CDS_INFO_FIELDS.has(fieldKey) ? "error" : "warning";
}

function buildAllowedCodeMessage(fieldKey: StandardFieldKey, label: string) {
	const allowedCodes = getVnaccsStandardFieldOptions(fieldKey).map(
		(option) => option.value,
	);

	if (allowedCodes.length === 0) {
		return `${label} không hợp lệ theo chuẩn VNACCS.`;
	}

	return `${label} chỉ chấp nhận một trong các mã "${allowedCodes.join('", "')}" theo chuẩn VNACCS.`;
}

function validateVnaccsStandardCode(args: {
	issues: CdsExportValidationIssue[];
	fieldKey: StandardFieldKey;
	path: string;
	label: string;
	value: unknown;
	message?: string;
}) {
	const normalizedValue = normalizeCode(args.value);
	if (!normalizedValue) {
		return;
	}

	if (isAllowedVnaccsStandardFieldValue(args.fieldKey, normalizedValue)) {
		return;
	}

	addIssue(args.issues, {
		path: args.path,
		label: args.label,
		severity: "error",
		message: args.message ?? buildAllowedCodeMessage(args.fieldKey, args.label),
	});
}

function buildAllowedStaticCodeMessage(
	fieldKey: StandardFieldKey,
	label: string,
) {
	const allowedCodes = getCdsStaticFieldOptions(fieldKey).map(
		(option) => option.value,
	);

	if (allowedCodes.length === 0) {
		return `${label} không hợp lệ theo danh mục hardcode của web.`;
	}

	return `${label} chỉ chấp nhận một trong các mã "${allowedCodes.join('", "')}" theo danh mục hardcode của web.`;
}

function validateStaticCode(args: {
	issues: CdsExportValidationIssue[];
	fieldKey: StandardFieldKey;
	path: string;
	label: string;
	value: unknown;
	message?: string;
}) {
	const normalizedValue = normalizeCode(args.value);
	if (!normalizedValue) {
		return;
	}

	if (isAllowedCdsStaticFieldValue(args.fieldKey, normalizedValue)) {
		return;
	}

	addIssue(args.issues, {
		path: args.path,
		label: args.label,
		severity: "error",
		message:
			args.message ?? buildAllowedStaticCodeMessage(args.fieldKey, args.label),
	});
}

function toFiniteNumber(value: unknown) {
	return normalizeLooseNumber(value);
}

function getPrimaryDeclaration(
	declarations: DeclarationRow[] | null | undefined,
): DeclarationRow | null {
	if (!Array.isArray(declarations) || declarations.length === 0) {
		return null;
	}

	return (
		[...declarations].sort((left, right) => {
			const leftTime = left.declarationDate
				? new Date(left.declarationDate).getTime()
				: 0;
			const rightTime = right.declarationDate
				? new Date(right.declarationDate).getTime()
				: 0;

			return rightTime - leftTime;
		})[0] ?? null
	);
}

function addIssue(
	issues: CdsExportValidationIssue[],
	issue: CdsExportValidationIssue,
) {
	issues.push(issue);
}

function requireText(
	issues: CdsExportValidationIssue[],
	path: string,
	label: string,
	value: unknown,
	severity: CdsExportValidationSeverity = "error",
) {
	if (hasText(value)) {
		return;
	}

	addIssue(issues, {
		path,
		label,
		severity,
		message: `${label} đang trống.`,
	});
}

function requirePositiveNumber(
	issues: CdsExportValidationIssue[],
	path: string,
	label: string,
	value: unknown,
	severity: CdsExportValidationSeverity = "error",
) {
	const numericValue = toFiniteNumber(value);
	if (numericValue !== null && numericValue > 0) {
		return;
	}

	addIssue(issues, {
		path,
		label,
		severity,
		message: `${label} chưa có giá trị hợp lệ lớn hơn 0.`,
	});
}

function validateIntegerTextField(
	issues: CdsExportValidationIssue[],
	path: string,
	label: string,
	value: unknown,
	options?: {
		exactLength?: number;
	},
) {
	const normalizedValue = normalizeText(value).replace(/,/g, "");
	if (!normalizedValue) {
		return;
	}

	if (!/^\d+$/.test(normalizedValue)) {
		addIssue(issues, {
			path,
			label,
			severity: "error",
			message: `${label} chỉ được nhập số để ghi sang HAN_2024.`,
		});
		return;
	}

	if (
		options?.exactLength !== undefined &&
		normalizedValue.length !== options.exactLength
	) {
		addIssue(issues, {
			path,
			label,
			severity: "error",
			message: `${label} phải có đúng ${options.exactLength} chữ số.`,
		});
	}
}

function warnIfTextExceedsMaxLength(
	issues: CdsExportValidationIssue[],
	path: string,
	label: string,
	value: unknown,
	maxLength: number,
	message: string,
) {
	const normalizedValue = normalizeText(value);
	if (!normalizedValue || normalizedValue.length <= maxLength) {
		return;
	}

	addIssue(issues, {
		path,
		label,
		severity: "warning",
		message,
	});
}

function warnIfCompanionValueMissing(args: {
	issues: CdsExportValidationIssue[];
	path: string;
	label: string;
	condition: boolean;
	value: unknown;
	message: string;
}) {
	if (!args.condition || hasText(args.value)) {
		return;
	}

	addIssue(args.issues, {
		path: args.path,
		label: args.label,
		severity: "warning",
		message: args.message,
	});
}

function warnIfCondition(
	issues: CdsExportValidationIssue[],
	args: {
		path: string;
		label: string;
		condition: boolean;
		message: string;
	},
) {
	if (!args.condition) {
		return;
	}

	addIssue(issues, {
		path: args.path,
		label: args.label,
		severity: "warning",
		message: args.message,
	});
}

function resolveCargoUnitPrice(row: Partial<CargoListRow>) {
	const qty = toFiniteNumber(row.qty);
	const unitPrice = toFiniteNumber(row.unitPrice);
	const totalPrice = toFiniteNumber(row.totalPrice);

	if (unitPrice !== null && unitPrice > 0) {
		return unitPrice;
	}

	if (qty !== null && qty > 0 && totalPrice !== null && totalPrice > 0) {
		return totalPrice / qty;
	}

	return null;
}

function resolveCargoTotalPrice(row: Partial<CargoListRow>) {
	const qty = toFiniteNumber(row.qty);
	const unitPrice = toFiniteNumber(row.unitPrice);
	const totalPrice = toFiniteNumber(row.totalPrice);

	if (totalPrice !== null && totalPrice > 0) {
		return totalPrice;
	}

	if (qty !== null && qty > 0 && unitPrice !== null && unitPrice > 0) {
		return qty * unitPrice;
	}

	return null;
}

export function getBlockingCdsExportIssues(issues: CdsExportValidationIssue[]) {
	return issues.filter((issue) => issue.severity === "error");
}

export function formatCdsExportValidationIssues(
	issues: CdsExportValidationIssue[],
	options?: { maxItems?: number },
) {
	const maxItems = options?.maxItems ?? 8;
	const selectedIssues = issues.slice(0, maxItems);
	const lines = selectedIssues.map((issue) => `• ${issue.message}`);

	if (issues.length > maxItems) {
		lines.push(`• ... và ${issues.length - maxItems} mục khác.`);
	}

	return lines.join("\n");
}

export function validateCdsForEcusExport(
	input: CdsExportValidationInput,
): CdsExportValidationResult {
	const cdsInfo = (input.cdsInfo ?? {}) as Partial<FollowUpCdsInfoRow>;
	const followUpSummary = input.followUpSummary ?? {};
	const declarations = input.declarations ?? [];
	const primaryDeclaration = getPrimaryDeclaration(declarations);
	const resolvedOperationType = deriveOperationType({
		operationType: input.operationType ?? followUpSummary.operationType ?? null,
		operationCode: cdsInfo.operationCode,
	});
	const issues: CdsExportValidationIssue[] = [];
	const companyPartyDefaults = buildCdsCompanyPartyDefaultsFromCompanyProfile(
		input.companyProfile,
	);

	const effectiveExpectedDeclarationDate =
		primaryDeclaration?.declarationDate ??
		cdsInfo.expectedDeclarationDate ??
		cdsInfo.commercialInvoiceDate;
	const effectiveCustomsCode =
		cdsInfo.customsCode ?? primaryDeclaration?.customsCode;
	const effectiveImportExportUnitName = hasText(cdsInfo.importExportUnitName)
		? cdsInfo.importExportUnitName
		: (companyPartyDefaults.importExportUnitName ??
			followUpSummary.companyName);
	const effectivePartnerName = cdsInfo.partnerName ?? followUpSummary.supplier;
	const effectiveBillOfLading =
		cdsInfo.billOfLading ??
		(Array.isArray(cdsInfo.billItems) && cdsInfo.billItems[0]
			? (cdsInfo.billItems[0]?.billNumber ?? null)
			: null);
	const effectivePackageQuantity =
		cdsInfo.packageQuantity ?? followUpSummary.quantity;
	const effectivePackageType = cdsInfo.packageType ?? followUpSummary.unit;
	const effectiveGrossWeight =
		cdsInfo.grossWeightTotal ??
		followUpSummary.grossWeight ??
		primaryDeclaration?.grossWeight;
	const effectiveInvoice =
		cdsInfo.commercialInvoice ??
		followUpSummary.invoice ??
		primaryDeclaration?.invoice;
	const effectiveInvoiceDate =
		cdsInfo.commercialInvoiceDate ?? effectiveExpectedDeclarationDate;
	const effectiveTotalInvoiceValue =
		cdsInfo.totalInvoiceValue ?? cdsInfo.declaredValue;
	const effectiveWeightUnit = normalizeCdsWeightUnit(cdsInfo.weightUnit);
	const effectiveWarehouseLocationCode =
		cdsInfo.warehouseLocationCode ?? cdsInfo.customsWarehouseCode;
	const effectivePackageMarks = cdsInfo.packageMarks ?? cdsInfo.marksAndNumbers;
	const normalizedTransportMethodCode = normalizeCode(
		cdsInfo.transportMethodCode,
	);
	const cargoRows = (input.cargoList ?? []).filter(
		(row) => !isCargoRowEffectivelyEmpty(row),
	);

	for (const warning of buildCdsCompanyPartyDefaultWarnings(
		cdsInfo,
		companyPartyDefaults,
	)) {
		addIssue(issues, {
			path: `cdsInfo.${warning.field}`,
			label: warning.label,
			severity: "warning",
			message: warning.message,
		});
	}

	requireText(
		issues,
		"cdsInfo.operationCode",
		"Mã loại hình",
		cdsInfo.operationCode,
		getCdsInfoRequirementSeverity(resolvedOperationType, "operationCode"),
	);
	requireText(
		issues,
		"cdsInfo.customsCode",
		"Mã hải quan",
		effectiveCustomsCode,
		getCdsInfoRequirementSeverity(resolvedOperationType, "customsCode"),
	);
	requireText(
		issues,
		"cdsInfo.importExportUnitName",
		"Đơn vị xuất/nhập khẩu",
		effectiveImportExportUnitName,
		getCdsInfoRequirementSeverity(
			resolvedOperationType,
			"importExportUnitName",
		),
	);
	requireText(
		issues,
		"cdsInfo.partnerName",
		"Đối tác",
		effectivePartnerName,
		getCdsInfoRequirementSeverity(resolvedOperationType, "partnerName"),
	);
	requireText(
		issues,
		"cdsInfo.billOfLading",
		"Vận đơn / số định danh hàng hóa",
		effectiveBillOfLading,
		getCdsInfoRequirementSeverity(resolvedOperationType, "billOfLading"),
	);
	if (resolvedOperationType !== "NHAP") {
		requireText(
			issues,
			"cdsInfo.expectedDeclarationDate",
			"Ngày khai báo",
			effectiveExpectedDeclarationDate,
			getCdsInfoRequirementSeverity(
				resolvedOperationType,
				"expectedDeclarationDate",
			),
		);
	}
	requirePositiveNumber(
		issues,
		"cdsInfo.packageQuantity",
		"Số lượng kiện",
		effectivePackageQuantity,
		getCdsInfoRequirementSeverity(resolvedOperationType, "packageQuantity"),
	);
	requireText(
		issues,
		"cdsInfo.packageType",
		"Loại kiện",
		effectivePackageType,
		getCdsInfoRequirementSeverity(resolvedOperationType, "packageType"),
	);
	requirePositiveNumber(
		issues,
		"cdsInfo.grossWeightTotal",
		"Tổng trọng lượng gross",
		effectiveGrossWeight,
		getCdsInfoRequirementSeverity(resolvedOperationType, "grossWeightTotal"),
	);
	requireText(
		issues,
		"cdsInfo.weightUnit",
		"Đơn vị trọng lượng",
		effectiveWeightUnit,
		getCdsInfoRequirementSeverity(resolvedOperationType, "weightUnit"),
	);
	requireText(
		issues,
		"cdsInfo.commercialInvoice",
		"Số hóa đơn thương mại",
		effectiveInvoice,
		getCdsInfoRequirementSeverity(resolvedOperationType, "commercialInvoice"),
	);
	requireText(
		issues,
		"cdsInfo.commercialInvoiceDate",
		"Ngày hóa đơn / ngày khai báo",
		effectiveInvoiceDate,
		getCdsInfoRequirementSeverity(
			resolvedOperationType,
			"commercialInvoiceDate",
		),
	);
	requirePositiveNumber(
		issues,
		"cdsInfo.totalInvoiceValue",
		"Tổng trị giá hóa đơn",
		effectiveTotalInvoiceValue,
		getCdsInfoRequirementSeverity(resolvedOperationType, "totalInvoiceValue"),
	);
	requireText(
		issues,
		"cdsInfo.transportMethodCode",
		"Mã phương thức vận chuyển",
		cdsInfo.transportMethodCode,
		getCdsInfoRequirementSeverity(resolvedOperationType, "transportMethodCode"),
	);
	requireText(
		issues,
		"cdsInfo.exportCountryCode",
		getCdsVnaccsFieldLabel("exportCountryCode", resolvedOperationType) ??
			"Mã nước",
		cdsInfo.exportCountryCode,
		getCdsInfoRequirementSeverity(resolvedOperationType, "exportCountryCode"),
	);
	requireText(
		issues,
		"cdsInfo.paymentMethod",
		"Phương thức thanh toán",
		cdsInfo.paymentMethod,
		getCdsInfoRequirementSeverity(resolvedOperationType, "paymentMethod"),
	);
	requireText(
		issues,
		"cdsInfo.invoicePriceCondition",
		"Điều kiện giá hóa đơn",
		cdsInfo.invoicePriceCondition,
		getCdsInfoRequirementSeverity(
			resolvedOperationType,
			"invoicePriceCondition",
		),
	);
	requireText(
		issues,
		"cdsInfo.invoiceCurrency",
		"Mã đồng tiền hóa đơn",
		cdsInfo.invoiceCurrency,
		getCdsInfoRequirementSeverity(resolvedOperationType, "invoiceCurrency"),
	);
	validateIntegerTextField(
		issues,
		"cdsInfo.electronicInvoiceReceiptNumber",
		"Số tiếp nhận hóa đơn điện tử",
		cdsInfo.electronicInvoiceReceiptNumber,
	);
	validateIntegerTextField(
		issues,
		"cdsInfo.creditLimitIssueYear",
		"Năm phát hành bảo lãnh / hạn mức",
		cdsInfo.creditLimitIssueYear,
		{ exactLength: 4 },
	);

	const warehouseLocationMaxLength = 7;
	warnIfTextExceedsMaxLength(
		issues,
		"cdsInfo.warehouseLocationCode",
		"Mã địa điểm lưu kho",
		effectiveWarehouseLocationCode,
		warehouseLocationMaxLength,
		`Mã địa điểm lưu kho đang dài hơn ${warehouseLocationMaxLength} ký tự. Chuẩn VNACCS thường dùng mã tối đa ${warehouseLocationMaxLength} ký tự, cần kiểm tra lại trước khi truyền.`,
	);
	warnIfTextExceedsMaxLength(
		issues,
		"cdsInfo.taxDestinationLocation",
		"Địa điểm đích cho vận chuyển bảo thuế",
		cdsInfo.taxDestinationLocation,
		7,
		"Địa điểm đích cho vận chuyển bảo thuế đang dài hơn 7 ký tự. HAN_2024 chỉ nhận mã ngắn cho chỉ tiêu DDS nên giá trị này sẽ không được ghi đầy đủ.",
	);
	warnIfCondition(issues, {
		path: "cdsInfo.businessTypeGroup",
		label: "Nhóm loại hình",
		condition:
			hasText(cdsInfo.businessTypeGroup) &&
			!normalizeCdsBusinessTypeGroup(cdsInfo.businessTypeGroup),
		message:
			'Nhóm loại hình không xác định được mã HAN_2024. Cần dùng mã ngắn như "00", "01", "02", "04" hoặc chọn lại từ danh sách.',
	});
	const truckLoadingLocationCodes =
		normalizeText(cdsInfo.truckLoadingLocationCode)
			?.split(/[.\-/]/)
			.map((part) => part.trim())
			.filter(Boolean) ?? [];
	truckLoadingLocationCodes.forEach((code, index) => {
		warnIfCondition(issues, {
			path: "cdsInfo.truckLoadingLocationCode",
			label: `Mã địa điểm xếp hàng lên xe (${index + 1})`,
			condition: code.length > 8,
			message:
				"Mã địa điểm xếp hàng lên xe đang dài hơn 8 ký tự. HAN_2024 chỉ nhận tối đa 8 ký tự cho từng slot MA_DIEM_XEP_HANG_LEN_XE.",
		});
	});
	warnIfTextExceedsMaxLength(
		issues,
		"cdsInfo.truckLoadingLocationName",
		"Tên địa điểm xếp hàng lên xe",
		cdsInfo.truckLoadingLocationName,
		70,
		"Tên địa điểm xếp hàng lên xe đang dài hơn 70 ký tự. HAN_2024 chỉ nhận tối đa 70 ký tự ở TEN_DIEM_XEP_HANG_LEN_XE.",
	);
	warnIfTextExceedsMaxLength(
		issues,
		"cdsInfo.truckLoadingLocationAddress",
		"Địa chỉ địa điểm xếp hàng lên xe",
		cdsInfo.truckLoadingLocationAddress,
		300,
		"Địa chỉ địa điểm xếp hàng lên xe đang dài hơn 300 ký tự. HAN_2024 chỉ nhận tối đa 300 ký tự ở DIA_CHI_DIEM_XEP_HANG_LEN_XE.",
	);

	validateVnaccsStandardCode({
		issues,
		fieldKey: "cargoClassificationCode",
		path: "cdsInfo.cargoClassificationCode",
		label: "Mã phân loại hàng hóa",
		value: cdsInfo.cargoClassificationCode,
		message:
			'Mã phân loại hàng hóa chỉ chấp nhận các mã "A" đến "K" theo chuẩn VNACCS. Để trống nếu hàng hóa không thuộc diện đặc thù.',
	});
	validateVnaccsStandardCode({
		issues,
		fieldKey: "transportMethodCode",
		path: "cdsInfo.transportMethodCode",
		label: "Mã hiệu phương thức vận chuyển",
		value: cdsInfo.transportMethodCode,
	});
	if (resolvedOperationType !== "XUAT") {
		validateVnaccsStandardCode({
			issues,
			fieldKey: "personOrganizationClassification",
			path: "cdsInfo.personOrganizationClassification",
			label: "Phân loại cá nhân/tổ chức",
			value: cdsInfo.personOrganizationClassification,
		});
	}
	validateVnaccsStandardCode({
		issues,
		fieldKey: "inspectionResultCode",
		path: "cdsInfo.inspectionResultCode",
		label: "Mã kết quả kiểm tra nội dung",
		value: cdsInfo.inspectionResultCode,
	});
	validateVnaccsStandardCode({
		issues,
		fieldKey: "invoiceFormClassificationCode",
		path: "cdsInfo.invoiceFormClassificationCode",
		label: "Phân loại hình thức hóa đơn",
		value: cdsInfo.invoiceFormClassificationCode,
	});
	validateVnaccsStandardCode({
		issues,
		fieldKey: "invoiceClassificationCode",
		path: "cdsInfo.invoiceClassificationCode",
		label: "Mã phân loại giá hóa đơn",
		value: cdsInfo.invoiceClassificationCode,
	});
	if (resolvedOperationType !== "XUAT") {
		validateVnaccsStandardCode({
			issues,
			fieldKey: "transportFeeClassificationCode",
			path: "cdsInfo.transportFeeClassificationCode",
			label: "Mã phân loại phí vận chuyển",
			value: cdsInfo.transportFeeClassificationCode,
		});
	}
	validateVnaccsStandardCode({
		issues,
		fieldKey: "insuranceFeeClassificationCode",
		path: "cdsInfo.insuranceFeeClassificationCode",
		label: "Mã phân loại phí bảo hiểm",
		value: cdsInfo.insuranceFeeClassificationCode,
	});
	validateVnaccsStandardCode({
		issues,
		fieldKey: "valuationDeclarationTypeCode",
		path: "cdsInfo.valuationDeclarationTypeCode",
		label: "Mã phân loại khai trị giá",
		value: cdsInfo.valuationDeclarationTypeCode,
	});
	validateVnaccsStandardCode({
		issues,
		fieldKey: "taxPayer",
		path: "cdsInfo.taxPayer",
		label: "Người nộp thuế",
		value: cdsInfo.taxPayer,
	});
	validateVnaccsStandardCode({
		issues,
		fieldKey: "releaseBeforePermitCode",
		path: "cdsInfo.releaseBeforePermitCode",
		label: "Mã lý do đề nghị BP",
		value: cdsInfo.releaseBeforePermitCode,
	});
	validateVnaccsStandardCode({
		issues,
		fieldKey: "taxPaymentDeadlineCode",
		path: "cdsInfo.taxPaymentDeadlineCode",
		label: "Mã xác định thời hạn nộp thuế",
		value: cdsInfo.taxPaymentDeadlineCode,
	});
	validateStaticCode({
		issues,
		fieldKey: "paymentMethod",
		path: "cdsInfo.paymentMethod",
		label: "Phương thức thanh toán",
		value: cdsInfo.paymentMethod,
	});
	validateStaticCode({
		issues,
		fieldKey: "invoicePriceCondition",
		path: "cdsInfo.invoicePriceCondition",
		label: "Điều kiện giá hóa đơn",
		value: cdsInfo.invoicePriceCondition,
	});
	validateStaticCode({
		issues,
		fieldKey: "invoiceCurrency",
		path: "cdsInfo.invoiceCurrency",
		label: "Mã đồng tiền hóa đơn",
		value: cdsInfo.invoiceCurrency,
	});
	validateStaticCode({
		issues,
		fieldKey: "packageType",
		path: "cdsInfo.packageType",
		label: "Loại kiện",
		value: effectivePackageType,
	});
	validateStaticCode({
		issues,
		fieldKey: "weightUnit",
		path: "cdsInfo.weightUnit",
		label: "Đơn vị trọng lượng",
		value: effectiveWeightUnit,
	});
	validateStaticCode({
		issues,
		fieldKey: "taxableValueCurrencyCode",
		path: "cdsInfo.taxableValueCurrencyCode",
		label: "Mã tiền tệ trị giá tính thuế",
		value: cdsInfo.taxableValueCurrencyCode,
	});
	if (resolvedOperationType !== "XUAT") {
		validateStaticCode({
			issues,
			fieldKey: "transportFeeCurrencyCode",
			path: "cdsInfo.transportFeeCurrencyCode",
			label: "Mã tiền phí vận chuyển",
			value: cdsInfo.transportFeeCurrencyCode,
		});
	}
	validateStaticCode({
		issues,
		fieldKey: "insuranceFeeCurrencyCode",
		path: "cdsInfo.insuranceFeeCurrencyCode",
		label: "Mã tiền phí bảo hiểm",
		value: cdsInfo.insuranceFeeCurrencyCode,
	});

	if (resolvedOperationType !== "XUAT") {
		const transportFee = toFiniteNumber(cdsInfo.transportFee);
		if (transportFee !== null && transportFee > 0) {
			requireText(
				issues,
				"cdsInfo.transportFeeClassificationCode",
				"Mã phân loại phí vận chuyển",
				cdsInfo.transportFeeClassificationCode,
			);
			requireText(
				issues,
				"cdsInfo.transportFeeCurrencyCode",
				"Mã tiền phí vận chuyển",
				cdsInfo.transportFeeCurrencyCode,
			);
		} else if (
			hasText(cdsInfo.transportFeeClassificationCode) ||
			hasText(cdsInfo.transportFeeCurrencyCode)
		) {
			addIssue(issues, {
				path: "cdsInfo.transportFee",
				label: "Phí vận chuyển",
				severity: "warning",
				message:
					"Đã có mã phí vận chuyển nhưng chưa có trị giá phí vận chuyển hợp lệ.",
			});
		}
	}

	const insuranceFee = toFiniteNumber(cdsInfo.insuranceFee);
	if (insuranceFee !== null && insuranceFee > 0) {
		requireText(
			issues,
			"cdsInfo.insuranceFeeClassificationCode",
			"Mã phân loại phí bảo hiểm",
			cdsInfo.insuranceFeeClassificationCode,
		);
		requireText(
			issues,
			"cdsInfo.insuranceFeeCurrencyCode",
			"Mã tiền phí bảo hiểm",
			cdsInfo.insuranceFeeCurrencyCode,
		);
		warnIfCompanionValueMissing({
			issues,
			path: "cdsInfo.insuranceRegistrationNumber",
			label: "Số đăng ký bảo hiểm",
			condition: insuranceFee > 0,
			value: cdsInfo.insuranceRegistrationNumber,
			message:
				"Đã có phí bảo hiểm nhưng chưa có số đăng ký bảo hiểm để đối chiếu lại hồ sơ.",
		});
	} else if (
		hasText(cdsInfo.insuranceFeeClassificationCode) ||
		hasText(cdsInfo.insuranceFeeCurrencyCode) ||
		hasText(cdsInfo.insuranceRegistrationNumber)
	) {
		addIssue(issues, {
			path: "cdsInfo.insuranceFee",
			label: "Phí bảo hiểm",
			severity: "warning",
			message:
				"Đã có thông tin phí bảo hiểm nhưng chưa có trị giá phí bảo hiểm hợp lệ.",
		});
	}

	if (hasText(cdsInfo.importLicense) !== hasText(cdsInfo.licenseNumber)) {
		addIssue(issues, {
			path: hasText(cdsInfo.importLicense)
				? "cdsInfo.licenseNumber"
				: "cdsInfo.importLicense",
			label: "Giấy phép nhập khẩu",
			severity: "warning",
			message:
				"Thông tin giấy phép đang nhập dở. Nên điền đủ mã loại giấy phép và số giấy phép.",
		});
	}

	if (
		resolvedOperationType !== "XUAT" &&
		isPersonOrganizationClassificationRequiredForOperationCode(
			cdsInfo.operationCode,
		)
	) {
		requireText(
			issues,
			"cdsInfo.personOrganizationClassification",
			"Phân loại cá nhân/tổ chức",
			cdsInfo.personOrganizationClassification,
		);
	}

	if (resolvedOperationType === "NHAP" || resolvedOperationType === null) {
		requireText(
			issues,
			"cdsInfo.declarationProcessingDeptCode",
			"Mã bộ phận xử lý tờ khai",
			cdsInfo.declarationProcessingDeptCode,
		);
		requireText(
			issues,
			"cdsInfo.loadingLocationCode",
			"Mã địa điểm xếp hàng",
			cdsInfo.loadingLocationCode,
		);
		requireText(
			issues,
			"cdsInfo.valuationDeclarationTypeCode",
			"Mã phân loại khai trị giá",
			cdsInfo.valuationDeclarationTypeCode,
		);
		requireText(
			issues,
			"cdsInfo.taxableValueCurrencyCode",
			"Mã tiền trị giá tính thuế",
			cdsInfo.taxableValueCurrencyCode,
			"warning",
		);

		if (!hasText(cdsInfo.taxPayer)) {
			addIssue(issues, {
				path: "cdsInfo.taxPayer",
				label: "Người nộp thuế",
				severity: "error",
				message:
					"Người nộp thuế đang trống. Hồ sơ nhập khẩu cần điền trước khi ghi sang HAN_2024/ECUS.",
			});
		}

		if (!hasText(cdsInfo.taxPaymentDeadlineCode)) {
			addIssue(issues, {
				path: "cdsInfo.taxPaymentDeadlineCode",
				label: "Mã xác định thời hạn nộp thuế",
				severity: "error",
				message:
					"Mã xác định thời hạn nộp thuế đang trống. Hồ sơ nhập khẩu cần điền trước khi ghi sang HAN_2024/ECUS.",
			});
		}
	}

	if (resolvedOperationType === "XUAT") {
		const cargoClassificationCode = normalizeCode(
			cdsInfo.cargoClassificationCode,
		);

		warnIfCondition(issues, {
			path: "cdsInfo.cargoClassificationCode",
			label: "Mã phân loại hàng hóa",
			condition: cargoClassificationCode === "J",
			message:
				'Mã "J" chỉ nên dùng khi có văn bản riêng của Chính phủ. Hàng hóa thông thường không chọn mã này.',
		});

		requireText(
			issues,
			"cdsInfo.warehouseLocationCode",
			"Mã địa điểm lưu kho",
			effectiveWarehouseLocationCode,
			getCdsInfoRequirementSeverity(
				resolvedOperationType,
				"warehouseLocationCode",
			),
		);
		requireText(
			issues,
			"cdsInfo.unloadingLocationCode",
			"Mã địa điểm nhận hàng cuối cùng",
			cdsInfo.unloadingLocationCode,
			getCdsInfoRequirementSeverity(
				resolvedOperationType,
				"unloadingLocationCode",
			),
		);
		requireText(
			issues,
			"cdsInfo.loadingLocationCode",
			"Mã địa điểm xếp hàng",
			cdsInfo.loadingLocationCode,
			"warning",
		);
		if (
			normalizedTransportMethodCode === "2" ||
			normalizedTransportMethodCode === "3"
		) {
			requireText(
				issues,
				"cdsInfo.transportVehicleCode",
				"Mã phương tiện vận chuyển",
				cdsInfo.transportVehicleCode,
				getCdsInfoRequirementSeverity(
					resolvedOperationType,
					"transportVehicleCode",
				),
			);
		}
		if (normalizedTransportMethodCode === "1") {
			requireText(
				issues,
				"cdsInfo.transportVehicleName",
				"Tên phương tiện vận tải",
				cdsInfo.transportVehicleName,
				"error",
			);

			if (
				hasText(cdsInfo.transportVehicleName) &&
				!isAirTransportVehicleNameFormat(cdsInfo.transportVehicleName)
			) {
				addIssue(issues, {
					path: "cdsInfo.transportVehicleName",
					label: "Tên phương tiện vận tải",
					severity: "error",
					message:
						"Vận chuyển hàng không yêu cầu định dạng: AA0000/DDMMM (ví dụ AB0001/01JAN).",
				});
			}
		} else if (
			normalizedTransportMethodCode === "4" ||
			normalizedTransportMethodCode === "5"
		) {
			requireText(
				issues,
				"cdsInfo.transportVehicleName",
				"Tên phương tiện vận tải",
				cdsInfo.transportVehicleName,
				"warning",
			);
		}
		requireText(
			issues,
			"cdsInfo.contractNumber",
			"Số hợp đồng",
			cdsInfo.contractNumber,
			getCdsInfoRequirementSeverity(resolvedOperationType, "contractNumber"),
		);
		requireText(
			issues,
			"cdsInfo.contractDate",
			"Ngày hợp đồng",
			cdsInfo.contractDate,
			getCdsInfoRequirementSeverity(resolvedOperationType, "contractDate"),
		);

		if (!hasText(effectivePackageMarks)) {
			addIssue(issues, {
				path: "cdsInfo.packageMarks",
				label: "Ký hiệu và số hiệu bao bì",
				severity: "warning",
				message:
					"Ký hiệu và số hiệu bao bì đang trống. Nên bổ sung để đối chiếu chứng từ xuất khẩu.",
			});
		}
	}

	const hasGuaranteeInfo = hasAnyValue([
		cdsInfo.guaranteeBankCode,
		cdsInfo.guaranteeDocumentSymbol,
		cdsInfo.guaranteeDocumentNumber,
	]);
	const hasCreditLimitInfo =
		hasAnyValue([
			cdsInfo.creditLimitDocumentSymbol,
			cdsInfo.creditLimitDocumentNumber,
		]) ||
		(hasText(cdsInfo.creditLimitIssueYear) && !hasGuaranteeInfo);
	if (hasCreditLimitInfo) {
		warnIfCompanionValueMissing({
			issues,
			path: "cdsInfo.creditLimitIssueYear",
			label: "Năm phát hành hạn mức",
			condition: true,
			value: cdsInfo.creditLimitIssueYear,
			message:
				"Thông tin hạn mức đang nhập dở. Cần đủ năm phát hành, ký hiệu và số chứng từ hạn mức.",
		});
		warnIfCompanionValueMissing({
			issues,
			path: "cdsInfo.creditLimitDocumentSymbol",
			label: "Ký hiệu chứng từ hạn mức",
			condition: true,
			value: cdsInfo.creditLimitDocumentSymbol,
			message:
				"Thông tin hạn mức đang nhập dở. Cần đủ năm phát hành, ký hiệu và số chứng từ hạn mức.",
		});
		warnIfCompanionValueMissing({
			issues,
			path: "cdsInfo.creditLimitDocumentNumber",
			label: "Số chứng từ hạn mức",
			condition: true,
			value: cdsInfo.creditLimitDocumentNumber,
			message:
				"Thông tin hạn mức đang nhập dở. Cần đủ năm phát hành, ký hiệu và số chứng từ hạn mức.",
		});
	}

	if (hasGuaranteeInfo) {
		warnIfCompanionValueMissing({
			issues,
			path: "cdsInfo.creditLimitIssueYear",
			label: "Năm phát hành bảo lãnh",
			condition: true,
			value: cdsInfo.creditLimitIssueYear,
			message:
				"Thông tin bảo lãnh đang nhập dở. Cần đủ năm phát hành, ngân hàng bảo lãnh, ký hiệu và số chứng từ bảo lãnh.",
		});
		warnIfCompanionValueMissing({
			issues,
			path: "cdsInfo.guaranteeBankCode",
			label: "Mã ngân hàng bảo lãnh",
			condition: true,
			value: cdsInfo.guaranteeBankCode,
			message:
				"Thông tin bảo lãnh đang nhập dở. Cần đủ năm phát hành, ngân hàng bảo lãnh, ký hiệu và số chứng từ bảo lãnh.",
		});
		warnIfCompanionValueMissing({
			issues,
			path: "cdsInfo.guaranteeDocumentSymbol",
			label: "Ký hiệu chứng từ bảo lãnh",
			condition: true,
			value: cdsInfo.guaranteeDocumentSymbol,
			message:
				"Thông tin bảo lãnh đang nhập dở. Cần đủ năm phát hành, ngân hàng bảo lãnh, ký hiệu và số chứng từ bảo lãnh.",
		});
		warnIfCompanionValueMissing({
			issues,
			path: "cdsInfo.guaranteeDocumentNumber",
			label: "Số chứng từ bảo lãnh",
			condition: true,
			value: cdsInfo.guaranteeDocumentNumber,
			message:
				"Thông tin bảo lãnh đang nhập dở. Cần đủ năm phát hành, ngân hàng bảo lãnh, ký hiệu và số chứng từ bảo lãnh.",
		});
	}

	const billItems = Array.isArray(cdsInfo.billItems) ? cdsInfo.billItems : [];
	billItems.forEach((item, index) => {
		const row =
			item && typeof item === "object"
				? (item as NonNullable<FollowUpCdsInfoRow["billItems"]>[number])
				: null;

		if (
			!row ||
			!hasAnyValue([row.billNumber, row.billDate, row.hawbNumber, row.mawbYear])
		) {
			return;
		}

		if (
			!hasText(row.billNumber) &&
			!(index === 0 && hasText(effectiveBillOfLading))
		) {
			addIssue(issues, {
				path: "cdsInfo.billItems",
				label: "Danh sách vận đơn",
				severity: "warning",
				message: `Dòng vận đơn ${index + 1} đang thiếu số vận đơn chính.`,
			});
		}
	});

	const valuationAdjustments = Array.isArray(cdsInfo.valuationAdjustments)
		? cdsInfo.valuationAdjustments
		: [];
	valuationAdjustments.forEach((item, index) => {
		const row =
			item && typeof item === "object"
				? (item as NonNullable<
						FollowUpCdsInfoRow["valuationAdjustments"]
					>[number])
				: null;

		if (
			!row ||
			!hasAnyValue([
				row.nameCode,
				row.classificationCode,
				row.currencyCode,
				row.adjustmentValue,
				row.allocationRatio,
			])
		) {
			return;
		}

		const missingLabels: string[] = [];
		if (!hasText(row.nameCode)) missingLabels.push("mã tên");
		if (!hasText(row.classificationCode)) missingLabels.push("mã phân loại");
		if (!hasText(row.currencyCode)) missingLabels.push("mã đồng tiền");
		if (toFiniteNumber(row.adjustmentValue) === null) {
			missingLabels.push("trị giá khoản điều chỉnh");
		}

		if (missingLabels.length > 0) {
			addIssue(issues, {
				path: "cdsInfo.valuationAdjustments",
				label: "Khoản điều chỉnh trị giá",
				severity: "warning",
				message: `Khoản điều chỉnh trị giá dòng ${index + 1} đang thiếu ${missingLabels.join(", ")}.`,
			});
		}
	});

	const electronicAttachments = Array.isArray(cdsInfo.electronicAttachments)
		? cdsInfo.electronicAttachments
		: [];
	electronicAttachments.forEach((item, index) => {
		const row =
			item && typeof item === "object"
				? (item as NonNullable<
						FollowUpCdsInfoRow["electronicAttachments"]
					>[number])
				: null;

		if (
			!row ||
			!hasAnyValue([row.attachmentNumber, row.attachmentDescription])
		) {
			return;
		}

		if (!hasText(row.attachmentNumber) || !hasText(row.attachmentDescription)) {
			addIssue(issues, {
				path: "cdsInfo.electronicAttachments",
				label: "Đính kèm điện tử",
				severity: "warning",
				message: `Đính kèm điện tử dòng ${index + 1} cần đủ số đính kèm và mô tả.`,
			});
		}

		warnIfTextExceedsMaxLength(
			issues,
			`cdsInfo.electronicAttachments[${index}].attachmentDescription`,
			`Đính kèm điện tử dòng ${index + 1}: mã loại`,
			row.attachmentDescription,
			3,
			`Đính kèm điện tử dòng ${index + 1} có mã loại dài hơn 3 ký tự. HAN_2024 sẽ bỏ qua dòng này khi ghi đính kèm điện tử.`,
		);

		const normalizedAttachmentNumber = normalizeText(
			row.attachmentNumber,
		).replace(/,/g, "");
		if (
			normalizedAttachmentNumber &&
			!/^\d+$/.test(normalizedAttachmentNumber)
		) {
			addIssue(issues, {
				path: `cdsInfo.electronicAttachments[${index}].attachmentNumber`,
				label: `Đính kèm điện tử dòng ${index + 1}: số đính kèm`,
				severity: "warning",
				message: `Đính kèm điện tử dòng ${index + 1} có số đính kèm không phải số nguyên. HAN_2024 chỉ nhận số nên dòng này sẽ không được ghi đầy đủ.`,
			});
		}
	});

	const transportSchedules = Array.isArray(cdsInfo.transportSchedules)
		? cdsInfo.transportSchedules
		: [];
	transportSchedules.forEach((item, index) => {
		const row =
			item && typeof item === "object"
				? (item as NonNullable<
						FollowUpCdsInfoRow["transportSchedules"]
					>[number])
				: null;

		if (
			!row ||
			!hasAnyValue([
				row.locationCode,
				row.locationName,
				row.arrivalDate,
				row.departureDate,
			])
		) {
			return;
		}

		const missingLabels: string[] = [];
		if (!hasText(row.locationCode) && !hasText(row.locationName)) {
			missingLabels.push("địa điểm");
		}
		if (!hasText(row.arrivalDate) && !hasText(row.departureDate)) {
			missingLabels.push("ít nhất 1 ngày đến hoặc ngày khởi hành");
		}

		if (missingLabels.length > 0) {
			addIssue(issues, {
				path: "cdsInfo.transportSchedules",
				label: "Lịch vận chuyển",
				severity: "warning",
				message: `Lịch vận chuyển dòng ${index + 1} đang thiếu ${missingLabels.join(", ")}.`,
			});
		}

		warnIfTextExceedsMaxLength(
			issues,
			`cdsInfo.transportSchedules[${index}].locationCode`,
			`Lịch vận chuyển dòng ${index + 1}: mã địa điểm`,
			row.locationCode,
			7,
			`Lịch vận chuyển dòng ${index + 1} có mã địa điểm dài hơn 7 ký tự. HAN_2024 sẽ bỏ qua mã trung chuyển này.`,
		);
	});

	const legalDocumentCodes = Array.isArray(cdsInfo.otherLegalDocumentCodes)
		? cdsInfo.otherLegalDocumentCodes
		: [];
	legalDocumentCodes.forEach((item, index) => {
		warnIfTextExceedsMaxLength(
			issues,
			`cdsInfo.otherLegalDocumentCodes[${index}]`,
			`Mã văn bản pháp quy khác ${index + 1}`,
			item,
			2,
			`Mã văn bản pháp quy khác dòng ${index + 1} đang dài hơn 2 ký tự. HAN_2024 chỉ nhận mã ngắn nên giá trị này sẽ bị bỏ qua khi register.`,
		);
	});

	warnIfCondition(issues, {
		path: "cdsInfo.seaportSupervisionEnabled",
		label: "Giám sát cảng biển",
		condition:
			cdsInfo.seaportSupervisionEnabled === true &&
			!hasText(effectiveBillOfLading),
		message:
			"Đã bật giám sát cảng biển nhưng chưa có số định danh hàng hóa (bill). Khi truyền app sẽ không có DINH_DANH_HANG_HOA.",
	});
	warnIfCondition(issues, {
		path: "cdsInfo.airportSupervisionEnabled",
		label: "Giám sát sân bay",
		condition:
			cdsInfo.airportSupervisionEnabled === true &&
			!hasText(effectiveBillOfLading),
		message:
			"Đã bật giám sát sân bay nhưng chưa có số định danh hàng hóa (bill). Khi truyền app sẽ không có DINH_DANH_HANG_HOA.",
	});

	if (cargoRows.length === 0) {
		addIssue(issues, {
			path: "cargoList",
			label: "Cargo List",
			severity: "error",
			message:
				"Cargo List đang trống. Cần ít nhất 1 dòng hàng trước khi xuất ECUS.",
		});
	}

	let totalCargoDeclaredValue = 0;

	cargoRows.forEach((row, index) => {
		const rowLabel = `Dòng hàng ${index + 1}`;
		const qty = toFiniteNumber(row.qty);
		const unitPrice = resolveCargoUnitPrice(row);
		const totalPrice = resolveCargoTotalPrice(row);

		if (isCargoCustomCodeRequiredForOperationCode(cdsInfo.operationCode)) {
			requireText(
				issues,
				`cargoList[${index}].customCode`,
				`${rowLabel}: Mã hàng`,
				row.customCode,
			);
		}
		requireText(
			issues,
			`cargoList[${index}].vietnameseName`,
			`${rowLabel}: Tên hàng`,
			row.vietnameseName ?? row.originalCargoName,
		);
		requireText(
			issues,
			`cargoList[${index}].originalCountry`,
			`${rowLabel}: Nước xuất xứ`,
			row.originalCountry,
		);
		requireText(
			issues,
			`cargoList[${index}].unit`,
			`${rowLabel}: Đơn vị tính`,
			row.unit,
		);
		requirePositiveNumber(
			issues,
			`cargoList[${index}].qty`,
			`${rowLabel}: Lượng`,
			qty,
		);

		if (unitPrice === null && totalPrice === null) {
			addIssue(issues, {
				path: `cargoList[${index}].totalPrice`,
				label: `${rowLabel}: Giá hóa đơn`,
				severity: "error",
				message: `${rowLabel} chưa có Đơn giá hóa đơn hoặc Trị giá hóa đơn để tạo dòng hàng ECUS.`,
			});
		}

		if (!hasText(row.hsCode)) {
			addIssue(issues, {
				path: `cargoList[${index}].hsCode`,
				label: `${rowLabel}: Mã HS`,
				severity: resolvedOperationType === "NHAP" ? "error" : "warning",
				message:
					resolvedOperationType === "NHAP"
						? `${rowLabel} chưa có mã HS. Hồ sơ nhập khẩu cần đủ mã HS trước khi ghi sang HAN_2024/ECUS.`
						: `${rowLabel} chưa có mã HS. Nên bổ sung trước khi nạp sang ECUS để tránh rà soát lại bên ngoài.`,
			});
		}

		if (resolvedOperationType === "NHAP") {
			if (!hasText(row.importTaxCode)) {
				addIssue(issues, {
					path: `cargoList[${index}].importTaxCode`,
					label: `${rowLabel}: Mã biểu thuế nhập khẩu`,
					severity: "error",
					message: `${rowLabel} chưa có mã biểu thuế nhập khẩu. Hồ sơ nhập khẩu cần đủ trước khi ghi sang HAN_2024/ECUS.`,
				});
			}

			if (!hasText(row.vatTaxCode)) {
				addIssue(issues, {
					path: `cargoList[${index}].vatTaxCode`,
					label: `${rowLabel}: Mã biểu thuế VAT`,
					severity: "error",
					message: `${rowLabel} chưa có mã biểu thuế VAT. Hồ sơ nhập khẩu cần đủ trước khi ghi sang HAN_2024/ECUS.`,
				});
			}
		}

		totalCargoDeclaredValue += totalPrice ?? 0;
	});

	if (
		effectiveTotalInvoiceValue !== null &&
		totalCargoDeclaredValue > 0 &&
		Math.abs(Number(effectiveTotalInvoiceValue) - totalCargoDeclaredValue) > 1
	) {
		addIssue(issues, {
			path: "cargoList.totalPrice",
			label: "Tổng trị giá hàng",
			severity: "warning",
			message:
				"Tổng trị giá hàng trong Cargo List đang lệch với Tổng trị giá hóa đơn ở CDS Info.",
		});
	}

	return {
		issues,
		resolvedOperationType,
	};
}

export function assertCdsReadyForEcusExport(input: CdsExportValidationInput) {
	const result = validateCdsForEcusExport(input);
	const blockingIssues = getBlockingCdsExportIssues(result.issues);

	if (blockingIssues.length > 0) {
		throw new CdsExportValidationError(result.issues);
	}

	return result;
}
