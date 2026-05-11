import type {
	CargoListRow,
	FollowUpCdsInfoRow,
} from "@/app/(home)/internal/followup/types";
import { normalizeLooseNumber } from "@/lib/followup/number-utils";
import type { FollowUpOperationType } from "@/lib/followup/operation-type";

export const ECUS_TEMPLATE_SHEET_NAMES = {
	import: "TEM NHẬP",
	export: "TEM XUẤT",
	flat: "IMPORT_TOKHAI",
	guide: "HUONG_DAN",
} as const;

export const ECUS_TEMPLATE_CDS_CELL_MAP = {
	customsCode: "E9",
	operationCode: "F9",
	partnerName: "G9",
	personOrganizationClassification: "I9",
	declarationProcessingDeptCode: "J9",
	transportMethodCode: "K9",
	billOfLading: "L9",
	packageQuantity: "M9",
	grossWeightTotal: "N9",
	warehouseLocationCode: "O9",
	warehouseLocationName: "P9",
	transportVehicleCode: "Q9",
	transportVehicleName: "R9",
	departureArrivalDate: "S9",
	loadingLocationCode: "T9",
	loadingLocationName: "U9",
	unloadingLocationCode: "V9",
	unloadingLocationName: "W9",
	containerQuantity: "X9",
	licenseNumber: "Y9",
	commercialInvoice: "Z9",
	commercialInvoiceDate: "AA9",
	totalInvoiceValue: "AB9",
	paymentMethod: "AC9",
	invoicePriceCondition: "AD9",
	invoiceCurrency: "AE9",
	insuranceFee: "AG9",
	transportFee: "AH9",
	taxPayer: "AI9",
	declaredValue: "AJ9",
	totalTaxableValue: "AK9",
	taxPaymentDeadlineCode: "AR9",
	guaranteeBankCode: "AS9",
	contractNumber: "AW9",
	contractDate: "AX9",
	contractGoodsDate: "AY9",
	importExportUnitName: "BC9",
	importExportBusinessAddress: "BE9",
	exportCountryCode: "BF9",
	packageType: "BG9",
	weightUnit: "BH9",
	invoiceClassificationCode: "BJ9",
	transportFeeClassificationCode: "BK9",
	insuranceFeeClassificationCode: "BL9",
	transportFeeCurrencyCode: "BM9",
	insuranceFeeCurrencyCode: "BN9",
	partnerAddress1: "BO9",
	note: "BP9",
	invoiceFormClassificationCode: "BQ9",
	taxDestinationLocation: "BR9",
	estimatedArrivalAtDestinationDate: "BS9",
	transportDepartureDate: "BT9",
	valuationDeclarationTypeCode: "BU9",
	partnerAddress2: "BV9",
	partnerAddress3: "BW9",
	partnerAddress4: "BX9",
	taxableValueCurrencyCode: "BY9",
	/** ECUS TEM row 9 — verify against shipped template if import misaligns. */
	internalBusinessManagementNumber: "BZ9",
} as const satisfies Partial<Record<keyof FollowUpCdsInfoRow, string>>;

export const ECUS_TEMPLATE_CARGO_COLUMN_MAP = {
	vietnameseName: "B",
	customCode: "C",
	hsCode: "D",
	originalCountry: "E",
	unit: "F",
	qty: "G",
	unitPrice: "H",
	totalPrice: "I",
	imExDutyExemptionCode: "L",
	importTaxCode: "V",
	vatTaxCode: "W",
	dutyReductionCode: "Y",
	unit2: "Z",
	qty2: "AA",
} as const satisfies Partial<Record<keyof CargoListRow, string>>;

export const ECUS_TEMPLATE_CARGO_CELL_MAP = ECUS_TEMPLATE_CARGO_COLUMN_MAP;

export const ECUS_TEMPLATE_CARGO_START_ROW = 16;

export const ECUS_FLAT_HEADER_COLUMN_MAP = {
	expectedDeclarationDate: "A",
	declarationNumber: "F",
	operationMarker: "G",
	operationCode: "I",
	declarationYear: "J",
	customsCode: "L",
	partnerName: "Q",
	exportCountryCode: "S",
	billOfLading: "W",
	packageQuantity: "X",
	packageType: "Y",
	grossWeightTotal: "Z",
	weightUnit: "AA",
	warehouseLocationName: "AB",
	loadingLocationName: "AC",
	unloadingLocationName: "AD",
	transportVehicleName: "AE",
	departureArrivalDate: "AF",
	note: "AI",
	commercialInvoice: "AP",
	commercialInvoiceDate: "AQ",
	paymentMethod: "AR",
	totalInvoiceValue: "AS",
	invoiceCurrency: "AW",
} as const;

export const ECUS_FLAT_CARGO_COLUMN_MAP = {
	customCode: "B",
	originalCargoName: "E",
	originalCountry: "AV",
	unit: "BG",
	qty: "BB",
	unitPrice: "BD",
	totalPriceDeclared: "AZ",
	totalPriceInvoice: "BA",
} as const;

const DATE_FIELD_SET = new Set<keyof FollowUpCdsInfoRow>([
	"departureArrivalDate",
	"commercialInvoiceDate",
	"contractDate",
	"contractGoodsDate",
	"estimatedArrivalAtDestinationDate",
	"expectedDeclarationDate",
	"transportDepartureDate",
]);

const NUMBER_FIELD_SET = new Set<keyof FollowUpCdsInfoRow>([
	"containerQuantity",
	"declaredValue",
	"grossWeightTotal",
	"insuranceFee",
	"packageQuantity",
	"totalInvoiceValue",
	"totalTaxableValue",
	"transportFee",
]);

type ParsedEcusWorkbookPayload = {
	cdsInfo: Partial<FollowUpCdsInfoRow>;
	cargoList: Partial<CargoListRow>[];
};

function formatDatePart(value: number) {
	return String(value).padStart(2, "0");
}

export function getEcusTemplateSheetName(
	operationType: FollowUpOperationType | null | undefined,
) {
	return operationType === "XUAT"
		? ECUS_TEMPLATE_SHEET_NAMES.export
		: ECUS_TEMPLATE_SHEET_NAMES.import;
}

export function columnLetterToIndex(column: string) {
	let result = 0;

	for (const char of column.trim().toUpperCase()) {
		result = result * 26 + (char.charCodeAt(0) - 64);
	}

	return Math.max(result - 1, 0);
}

export function isEmptyWorkbookValue(value: unknown) {
	if (value === null || value === undefined) {
		return true;
	}

	if (typeof value === "string") {
		return value.trim() === "";
	}

	return false;
}

export function normalizeWorkbookDateValue(value: unknown): string | null {
	if (value === null || value === undefined || value === "") {
		return null;
	}

	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return [
			value.getFullYear(),
			formatDatePart(value.getMonth() + 1),
			formatDatePart(value.getDate()),
		].join("-");
	}

	if (typeof value === "number" && Number.isFinite(value)) {
		const wholeDays = Math.floor(value);
		if (wholeDays >= 1) {
			const utcDays = wholeDays - 25569;
			const millis = utcDays * 86400 * 1000;
			const parsed = new Date(millis);

			if (!Number.isNaN(parsed.getTime())) {
				return [
					parsed.getUTCFullYear(),
					formatDatePart(parsed.getUTCMonth() + 1),
					formatDatePart(parsed.getUTCDate()),
				].join("-");
			}
		}
	}

	const text = String(value).trim();
	if (!text) {
		return null;
	}

	if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
		return text;
	}

	const ddmmyyyy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (ddmmyyyy) {
		return `${ddmmyyyy[3]}-${formatDatePart(Number(ddmmyyyy[2]))}-${formatDatePart(Number(ddmmyyyy[1]))}`;
	}

	const parsed = new Date(text);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	return [
		parsed.getFullYear(),
		formatDatePart(parsed.getMonth() + 1),
		formatDatePart(parsed.getDate()),
	].join("-");
}

export function normalizeWorkbookNumberValue(value: unknown): number | null {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}

	if (typeof value !== "string") {
		return null;
	}

	return normalizeLooseNumber(value);
}

export function parseEcusTemplateSheet(args: {
	getCellValue: (address: string) => unknown;
	maxCargoRows?: number;
}): ParsedEcusWorkbookPayload {
	const cdsInfo: Record<string, unknown> = {};

	for (const [field, address] of Object.entries(ECUS_TEMPLATE_CDS_CELL_MAP)) {
		const value = args.getCellValue(address);

		if (DATE_FIELD_SET.has(field as keyof FollowUpCdsInfoRow)) {
			const normalized = normalizeWorkbookDateValue(value);
			if (normalized) {
				cdsInfo[field] = normalized;
			}
			continue;
		}

		if (NUMBER_FIELD_SET.has(field as keyof FollowUpCdsInfoRow)) {
			const normalized = normalizeWorkbookNumberValue(value);
			if (normalized !== null) {
				cdsInfo[field] = normalized;
			}
			continue;
		}

		const normalized = String(value ?? "").trim();
		if (normalized) {
			cdsInfo[field] = normalized;
		}
	}

	const cargoList: Partial<CargoListRow>[] = [];
	const maxCargoRows = args.maxCargoRows ?? 500;
	const cargoColumns = Object.values(ECUS_TEMPLATE_CARGO_COLUMN_MAP);

	for (
		let rowNumber = ECUS_TEMPLATE_CARGO_START_ROW;
		rowNumber < ECUS_TEMPLATE_CARGO_START_ROW + maxCargoRows;
		rowNumber += 1
	) {
		const hasAnyData = cargoColumns.some((column) => {
			const value = args.getCellValue(`${column}${rowNumber}`);
			return !isEmptyWorkbookValue(value);
		});

		if (!hasAnyData) {
			if (cargoList.length > 0) {
				break;
			}
			continue;
		}

		const row: Record<string, unknown> = {};

		for (const [field, column] of Object.entries(
			ECUS_TEMPLATE_CARGO_COLUMN_MAP,
		)) {
			const value = args.getCellValue(`${column}${rowNumber}`);

			if (
				field === "qty" ||
				field === "qty2" ||
				field === "unitPrice" ||
				field === "totalPrice"
			) {
				const normalized = normalizeWorkbookNumberValue(value);
				if (normalized !== null) {
					row[field] = normalized;
				}
				continue;
			}

			const normalized = String(value ?? "").trim();
			if (normalized) {
				row[field] = normalized;
			}
		}

		cargoList.push(row as Partial<CargoListRow>);
	}

	return { cdsInfo: cdsInfo as Partial<FollowUpCdsInfoRow>, cargoList };
}

export function parseEcusFlatSheetRows(
	rows: unknown[][],
): ParsedEcusWorkbookPayload {
	const cdsInfo: Record<string, unknown> = {};
	const cargoList: Partial<CargoListRow>[] = [];

	for (const row of rows) {
		if (
			!Array.isArray(row) ||
			row.every((value) => isEmptyWorkbookValue(value))
		) {
			continue;
		}

		if (
			row.every(
				(value) =>
					typeof value === "string" &&
					value.trim() !== "" &&
					value.trim().toUpperCase() === value.trim(),
			)
		) {
			continue;
		}

		const rowRecord = (column: string) => row[columnLetterToIndex(column)];

		const cargoCode = String(
			rowRecord(ECUS_FLAT_CARGO_COLUMN_MAP.customCode) ?? "",
		).trim();
		const cargoName = String(
			rowRecord(ECUS_FLAT_CARGO_COLUMN_MAP.originalCargoName) ?? "",
		).trim();

		const headerValues = {
			expectedDeclarationDate: normalizeWorkbookDateValue(
				rowRecord(ECUS_FLAT_HEADER_COLUMN_MAP.expectedDeclarationDate),
			),
			declarationNumber: String(
				rowRecord(ECUS_FLAT_HEADER_COLUMN_MAP.declarationNumber) ?? "",
			).trim(),
			operationCode: String(
				rowRecord(ECUS_FLAT_HEADER_COLUMN_MAP.operationCode) ?? "",
			).trim(),
			customsCode: String(
				rowRecord(ECUS_FLAT_HEADER_COLUMN_MAP.customsCode) ?? "",
			).trim(),
			partnerName: String(
				rowRecord(ECUS_FLAT_HEADER_COLUMN_MAP.partnerName) ?? "",
			).trim(),
			exportCountryCode: String(
				rowRecord(ECUS_FLAT_HEADER_COLUMN_MAP.exportCountryCode) ?? "",
			).trim(),
			billOfLading: String(
				rowRecord(ECUS_FLAT_HEADER_COLUMN_MAP.billOfLading) ?? "",
			).trim(),
			packageQuantity: normalizeWorkbookNumberValue(
				rowRecord(ECUS_FLAT_HEADER_COLUMN_MAP.packageQuantity),
			),
			packageType: String(
				rowRecord(ECUS_FLAT_HEADER_COLUMN_MAP.packageType) ?? "",
			).trim(),
			grossWeightTotal: normalizeWorkbookNumberValue(
				rowRecord(ECUS_FLAT_HEADER_COLUMN_MAP.grossWeightTotal),
			),
			weightUnit: String(
				rowRecord(ECUS_FLAT_HEADER_COLUMN_MAP.weightUnit) ?? "",
			).trim(),
			warehouseLocationName: String(
				rowRecord(ECUS_FLAT_HEADER_COLUMN_MAP.warehouseLocationName) ?? "",
			).trim(),
			loadingLocationName: String(
				rowRecord(ECUS_FLAT_HEADER_COLUMN_MAP.loadingLocationName) ?? "",
			).trim(),
			unloadingLocationName: String(
				rowRecord(ECUS_FLAT_HEADER_COLUMN_MAP.unloadingLocationName) ?? "",
			).trim(),
			transportVehicleName: String(
				rowRecord(ECUS_FLAT_HEADER_COLUMN_MAP.transportVehicleName) ?? "",
			).trim(),
			departureArrivalDate: normalizeWorkbookDateValue(
				rowRecord(ECUS_FLAT_HEADER_COLUMN_MAP.departureArrivalDate),
			),
			note: String(rowRecord(ECUS_FLAT_HEADER_COLUMN_MAP.note) ?? "").trim(),
			commercialInvoice: String(
				rowRecord(ECUS_FLAT_HEADER_COLUMN_MAP.commercialInvoice) ?? "",
			).trim(),
			commercialInvoiceDate: normalizeWorkbookDateValue(
				rowRecord(ECUS_FLAT_HEADER_COLUMN_MAP.commercialInvoiceDate),
			),
			paymentMethod: String(
				rowRecord(ECUS_FLAT_HEADER_COLUMN_MAP.paymentMethod) ?? "",
			).trim(),
			totalInvoiceValue: normalizeWorkbookNumberValue(
				rowRecord(ECUS_FLAT_HEADER_COLUMN_MAP.totalInvoiceValue),
			),
			invoiceCurrency: String(
				rowRecord(ECUS_FLAT_HEADER_COLUMN_MAP.invoiceCurrency) ?? "",
			).trim(),
		} satisfies Partial<FollowUpCdsInfoRow> & {
			declarationNumber?: string | null;
		};

		for (const [field, value] of Object.entries(headerValues)) {
			if (field === "declarationNumber") {
				continue;
			}

			if (
				value !== null &&
				value !== undefined &&
				value !== "" &&
				cdsInfo[field] === undefined
			) {
				cdsInfo[field] = value;
			}
		}

		if (!cargoCode && !cargoName) {
			continue;
		}

		cargoList.push({
			customCode: cargoCode || null,
			originalCargoName: cargoName || null,
			originalCountry: String(
				rowRecord(ECUS_FLAT_CARGO_COLUMN_MAP.originalCountry) ?? "",
			).trim(),
			unit: String(rowRecord(ECUS_FLAT_CARGO_COLUMN_MAP.unit) ?? "").trim(),
			qty: normalizeWorkbookNumberValue(
				rowRecord(ECUS_FLAT_CARGO_COLUMN_MAP.qty),
			),
			unitPrice: normalizeWorkbookNumberValue(
				rowRecord(ECUS_FLAT_CARGO_COLUMN_MAP.unitPrice),
			),
			totalPrice:
				normalizeWorkbookNumberValue(
					rowRecord(ECUS_FLAT_CARGO_COLUMN_MAP.totalPriceInvoice),
				) ??
				normalizeWorkbookNumberValue(
					rowRecord(ECUS_FLAT_CARGO_COLUMN_MAP.totalPriceDeclared),
				),
			vietnameseName: cargoName || null,
		});
	}

	return { cdsInfo: cdsInfo as Partial<FollowUpCdsInfoRow>, cargoList };
}
