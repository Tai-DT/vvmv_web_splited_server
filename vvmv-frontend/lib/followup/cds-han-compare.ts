import type { FollowUpCdsInfoRow } from "@/app/(home)/internal/followup/types";
import { normalizeLooseNumber } from "@/lib/followup/number-utils";

export type CdsHanFieldDiff = {
	field: string;
	label: string;
	currentValue: string | null;
	candidateValue: string | null;
};

export type CdsHanFieldComparisonSummary = {
	totalDifferentFields: number;
	diffs: CdsHanFieldDiff[];
	previewDiffs: CdsHanFieldDiff[];
};

export type CdsHanCargoDiff = {
	rowIndex: number;
	field: string;
	label: string;
	currentValue: string | null;
	candidateValue: string | null;
};

export type CdsHanCargoComparisonSummary = {
	totalDifferentFields: number;
	rowCountMismatch: boolean;
	currentRowCount: number;
	candidateRowCount: number;
	diffs: CdsHanCargoDiff[];
	previewDiffs: CdsHanCargoDiff[];
};

export type CdsHanVerificationSummary = {
	passed: boolean;
	header: CdsHanFieldComparisonSummary;
	cargo: CdsHanCargoComparisonSummary;
	warnings: string[];
};

type ComparableRecord = Partial<
	Record<keyof FollowUpCdsInfoRow | string, unknown>
>;

const CDS_HAN_COMPARE_FIELDS = [
	{ field: "declarationNumber", label: "Số tờ khai" },
	{ field: "firstDeclarationNumber", label: "Số tờ khai đầu tiên" },
	{ field: "importerCode", label: "Mã đơn vị xuất nhập khẩu" },
	{ field: "importExportUnitName", label: "Tên đơn vị xuất nhập khẩu" },
	{ field: "partnerName", label: "Tên đối tác" },
	{ field: "customsDeclarantCode", label: "Mã người khai Hải quan" },
	{ field: "customsCode", label: "Cơ quan Hải quan" },
	{ field: "declarationProcessingDeptCode", label: "Mã bộ phận xử lý" },
	{ field: "cargoClassificationCode", label: "Mã phân loại hàng hóa" },
	{ field: "expectedDeclarationDate", label: "Ngày khai báo" },
	{ field: "billOfLading", label: "Số vận đơn" },
	{ field: "packageQuantity", label: "Số lượng kiện" },
	{ field: "packageType", label: "Loại kiện" },
	{ field: "grossWeightTotal", label: "Tổng trọng lượng gross" },
	{ field: "warehouseLocationCode", label: "Mã địa điểm lưu kho" },
	{ field: "loadingLocationCode", label: "Mã địa điểm xếp hàng" },
	{ field: "unloadingLocationCode", label: "Mã địa điểm dỡ hàng" },
	{ field: "transportMethodCode", label: "Mã hiệu phương thức vận chuyển" },
	{ field: "transportVehicleCode", label: "Mã phương tiện vận chuyển" },
	{ field: "transportVehicleName", label: "Tên phương tiện vận chuyển" },
	{ field: "departureArrivalDate", label: "Ngày hàng đi / đến" },
	{ field: "commercialInvoice", label: "Số hóa đơn" },
	{ field: "commercialInvoiceDate", label: "Ngày phát hành hóa đơn" },
	{ field: "paymentMethod", label: "Phương thức thanh toán" },
	{ field: "invoicePriceCondition", label: "Điều kiện giá hóa đơn" },
	{ field: "invoiceClassificationCode", label: "Mã phân loại giá hóa đơn" },
	{ field: "totalInvoiceValue", label: "Tổng trị giá hóa đơn" },
	{ field: "totalTaxableValue", label: "Trị giá tính thuế" },
	{ field: "declaredValue", label: "Trị giá khai báo" },
	{ field: "invoiceCurrency", label: "Mã đồng tiền hóa đơn" },
	{ field: "taxableValueCurrencyCode", label: "Mã tiền trị giá tính thuế" },
	{ field: "valuationDeclarationTypeCode", label: "Mã phân loại khai trị giá" },
	{ field: "transportFeeClassificationCode", label: "Mã loại phí vận chuyển" },
	{ field: "transportFeeCurrencyCode", label: "Mã tiền phí vận chuyển" },
	{ field: "transportFee", label: "Phí vận chuyển" },
	{ field: "insuranceFeeClassificationCode", label: "Mã loại phí bảo hiểm" },
	{ field: "insuranceFeeCurrencyCode", label: "Mã tiền phí bảo hiểm" },
	{ field: "insuranceFee", label: "Phí bảo hiểm" },
	{ field: "insuranceRegistrationNumber", label: "Số đăng ký bảo hiểm" },
	{ field: "contractNumber", label: "Số hợp đồng" },
	{ field: "contractDate", label: "Ngày hợp đồng" },
	{ field: "contractGoodsDate", label: "Ngày hết hạn hợp đồng" },
	{ field: "taxPayer", label: "Người nộp thuế" },
	{ field: "releaseBeforePermitCode", label: "Mã lý do đề nghị BP" },
	{ field: "taxPaymentDeadlineCode", label: "Mã xác định thời hạn nộp thuế" },
	{ field: "taxSubstituteBankCode", label: "Mã ngân hàng trả thuế thay" },
	{ field: "guaranteeBankCode", label: "Mã ngân hàng bảo lãnh" },
	{ field: "creditLimitIssueYear", label: "Năm phát hành hạn mức" },
	{ field: "guaranteeIssueYear", label: "Năm phát hành bảo lãnh" },
	{ field: "guaranteeDocumentSymbol", label: "Ký hiệu chứng từ bảo lãnh" },
	{ field: "guaranteeDocumentNumber", label: "Số chứng từ bảo lãnh" },
	{ field: "creditLimitDocumentSymbol", label: "Ký hiệu chứng từ hạn mức" },
	{ field: "creditLimitDocumentNumber", label: "Số chứng từ hạn mức" },
	{ field: "transportDepartureDate", label: "Ngày khởi hành vận chuyển" },
	{ field: "taxDestinationLocation", label: "Địa điểm đích bảo thuế" },
	{
		field: "estimatedArrivalAtDestinationDate",
		label: "Ngày đến địa điểm đích",
	},
	{ field: "truckLoadingLocationCode", label: "Mã địa điểm xếp hàng lên xe" },
	{ field: "truckLoadingLocationName", label: "Tên địa điểm xếp hàng lên xe" },
	{
		field: "truckLoadingLocationAddress",
		label: "Địa chỉ địa điểm xếp hàng lên xe",
	},
	{ field: "packageMarks", label: "Ký hiệu và số hiệu" },
	{ field: "inspectionResultCode", label: "Mã kết quả kiểm tra nội dung" },
] as const;

const COMPARE_FIELD_ALIASES: Record<string, string[]> = {
	warehouseLocationCode: ["customsWarehouseCode"],
	warehouseLocationName: ["customsWarehouseName"],
	declaredValue: ["totalInvoiceValue"],
	departureArrivalDate: ["transportDepartureDate", "departureDate"],
	packageMarks: ["marksAndNumbers"],
};

const UNVERIFIED_HAN_MAPPING_FIELDS = [
	"seaportSupervisionEnabled",
	"airportSupervisionEnabled",
] as const;

const CARGO_COMPARE_FIELDS = [
	{ field: "customCode", label: "Mã hàng" },
	{ field: "hsCode", label: "Mã HS" },
	{ field: "originalCountry", label: "Nước xuất xứ" },
	{ field: "originalCargoName", label: "Tên hàng gốc" },
	{ field: "vietnameseName", label: "Tên hàng tiếng Việt" },
	{ field: "qty", label: "Số lượng" },
	{ field: "unit", label: "Đơn vị tính" },
	{ field: "unitPrice", label: "Đơn giá" },
	{ field: "totalPrice", label: "Thành tiền" },
	{ field: "lineTaxableValue", label: "Trị giá tính thuế (dòng)" },
	{ field: "exportTaxRatePercent", label: "TS XK (%)" },
	{ field: "exportTaxAmount", label: "Tiền thuế XK" },
	{ field: "taxableUnitPrice", label: "Đơn giá tính thuế" },
	{ field: "importTaxCode", label: "Mã biểu thuế NK" },
	{ field: "importTaxRate", label: "Thuế suất NK" },
	{ field: "importTaxAmount", label: "Tiền thuế NK" },
	{ field: "vatTaxCode", label: "Mã biểu thuế VAT" },
	{ field: "vatTaxRate", label: "Thuế suất VAT" },
	{ field: "vatTaxAmount", label: "Tiền thuế VAT" },
	{ field: "imExDutyExemptionCondition", label: "ĐK miễn giảm XNK" },
	{ field: "imExDutyExemptionAmount", label: "Tiền miễn giảm XNK" },
] as const;

type ComparableCargoField = (typeof CARGO_COMPARE_FIELDS)[number]["field"];
type ComparableCargoRow = Partial<Record<ComparableCargoField, unknown>>;

function normalizeComparisonValue(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}

	if (typeof value === "number") {
		return Number.isFinite(value) ? String(value) : "";
	}

	if (value instanceof Date) {
		return Number.isNaN(value.getTime())
			? ""
			: value.toISOString().slice(0, 10);
	}

	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) {
			return "";
		}

		const isoDateMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/);
		if (isoDateMatch) {
			return isoDateMatch[1];
		}

		const numericValue = normalizeLooseNumber(trimmed);
		if (numericValue !== null) {
			return String(numericValue);
		}

		return trimmed;
	}

	if (Array.isArray(value)) {
		return value.map((item) => normalizeComparisonValue(item)).join("|");
	}

	if (typeof value === "object") {
		return JSON.stringify(value);
	}

	return String(value).trim();
}

function pickComparableValue(source: ComparableRecord, field: string): unknown {
	const candidateKeys = [field, ...(COMPARE_FIELD_ALIASES[field] ?? [])];

	for (const key of candidateKeys) {
		const nextValue = source[key];
		const normalized = normalizeComparisonValue(nextValue);
		if (normalized !== "") {
			return nextValue;
		}
	}

	return source[field];
}

function isCargoRowEffectivelyEmpty(
	row: ComparableCargoRow | null | undefined,
) {
	if (!row) {
		return true;
	}

	return !CARGO_COMPARE_FIELDS.some(({ field }) => {
		const value = row[field];
		return normalizeComparisonValue(value) !== "";
	});
}

function normalizeCargoRows(
	rows: Array<ComparableCargoRow> | null | undefined,
) {
	return Array.isArray(rows)
		? rows.filter((row) => !isCargoRowEffectivelyEmpty(row))
		: [];
}

export function getUnverifiedHanMappingWarnings(
	cdsInfo: Partial<FollowUpCdsInfoRow> | null | undefined,
) {
	const source = cdsInfo ?? {};
	const warnings: string[] = [];

	for (const field of UNVERIFIED_HAN_MAPPING_FIELDS) {
		const rawValue = source[field];
		const hasValue =
			typeof rawValue === "boolean"
				? rawValue === true
				: normalizeComparisonValue(rawValue) !== "";

		if (!hasValue) {
			continue;
		}

		if (field === "seaportSupervisionEnabled") {
			warnings.push(
				"Cờ giám sát cảng biển đã bật. Mã HQ giám sát DDS đã được xử lý theo địa điểm đích, nhưng app chưa tự tạo hồ sơ giám sát cảng biển riêng trong HAN_2024.",
			);
			continue;
		}

		warnings.push(
			"Cờ giám sát sân bay đã bật. Mã HQ giám sát DDS đã được xử lý theo địa điểm đích, nhưng app chưa tự tạo hồ sơ giám sát sân bay riêng trong HAN_2024.",
		);
	}

	return warnings;
}

export function buildCdsHanFieldComparisonSummary(
	current: Partial<FollowUpCdsInfoRow> | null | undefined,
	candidate: Partial<FollowUpCdsInfoRow> | null | undefined,
) {
	const currentRecord = (current ?? {}) as ComparableRecord;
	const candidateRecord = (candidate ?? {}) as ComparableRecord;

	const diffs = CDS_HAN_COMPARE_FIELDS.map(({ field, label }) => {
		const currentValue = normalizeComparisonValue(
			pickComparableValue(currentRecord, field),
		);
		const candidateValue = normalizeComparisonValue(
			pickComparableValue(candidateRecord, field),
		);

		if (currentValue === candidateValue) {
			return null;
		}

		return {
			field,
			label,
			currentValue: currentValue || null,
			candidateValue: candidateValue || null,
		} satisfies CdsHanFieldDiff;
	}).filter((item) => item !== null) as CdsHanFieldDiff[];

	return {
		totalDifferentFields: diffs.length,
		diffs,
		previewDiffs: diffs.slice(0, 12),
	} satisfies CdsHanFieldComparisonSummary;
}

export function buildCdsHanCargoComparisonSummary(
	currentRows: Array<ComparableCargoRow> | null | undefined,
	candidateRows: Array<ComparableCargoRow> | null | undefined,
) {
	const current = normalizeCargoRows(currentRows);
	const candidate = normalizeCargoRows(candidateRows);
	const diffs: CdsHanCargoDiff[] = [];
	const maxRowCount = Math.max(current.length, candidate.length);

	for (let rowIndex = 0; rowIndex < maxRowCount; rowIndex += 1) {
		const currentRow = current[rowIndex] ?? {};
		const candidateRow = candidate[rowIndex] ?? {};

		for (const { field, label } of CARGO_COMPARE_FIELDS) {
			const currentValue = normalizeComparisonValue(currentRow[field]);
			const candidateValue = normalizeComparisonValue(candidateRow[field]);

			if (currentValue === candidateValue) {
				continue;
			}

			diffs.push({
				rowIndex,
				field,
				label,
				currentValue: currentValue || null,
				candidateValue: candidateValue || null,
			});
		}
	}

	return {
		totalDifferentFields: diffs.length,
		rowCountMismatch: current.length !== candidate.length,
		currentRowCount: current.length,
		candidateRowCount: candidate.length,
		diffs,
		previewDiffs: diffs.slice(0, 16),
	} satisfies CdsHanCargoComparisonSummary;
}

export function buildCdsHanVerificationSummary(args: {
	current: Partial<FollowUpCdsInfoRow> | null | undefined;
	candidate: Partial<FollowUpCdsInfoRow> | null | undefined;
	currentCargoList?: Array<ComparableCargoRow> | null | undefined;
	candidateCargoList?: Array<ComparableCargoRow> | null | undefined;
	warnings?: string[] | null | undefined;
}) {
	const header = buildCdsHanFieldComparisonSummary(
		args.current,
		args.candidate,
	);
	const cargo = buildCdsHanCargoComparisonSummary(
		args.currentCargoList,
		args.candidateCargoList,
	);
	const warnings = Array.from(new Set(args.warnings ?? []));

	return {
		passed:
			header.totalDifferentFields === 0 && cargo.totalDifferentFields === 0,
		header,
		cargo,
		warnings,
	} satisfies CdsHanVerificationSummary;
}
