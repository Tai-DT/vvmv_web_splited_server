export type FollowUpOperationType = "NHAP" | "XUAT";

export const IMPORT_OPERATION_CODES = [
	"A11",
	"A12",
	"A21",
	"A31",
	"A41",
	"A42",
	"A43",
	"A44",
	"A45",
	"C11",
	"C21",
	"E11",
	"E13",
	"E15",
	"E21",
	"E23",
	"E31",
	"E33",
	"E41",
	"G11",
	"G12",
	"G13",
	"G14",
	"G51",
	"H11",
] as const;

export const EXPORT_OPERATION_CODES = [
	"B11",
	"B12",
	"B13",
	"B14",
	"C12",
	"C22",
	"E42",
	"E52",
	"E54",
	"E62",
	"E82",
	"G21",
	"G22",
	"G23",
	"G24",
	"G61",
	"H21",
] as const;

const HAN_APP_NAME_BY_OPERATION_CODE: Record<string, string> = {
	B11: "ECUSK5NET",
	B13: "ECUSK5NET",
	E42: "ECUSC5NET",
	E52: "ECUSG5NET",
	E54: "ECUSG5NET",
	E62: "ECUSX5NET",
	E82: "ECUSC5NET",
	G22: "ECUSK5NET",
	G23: "ECUSK5NET",
	G61: "ECUSK5NET",
	H21: "ECUSK5NET",
};

// Live HAN shows Unigen Hanoi using a company-specific app split that differs
// from the cross-company majority mapping for some export operation codes.
const HAN_APP_NAME_BY_TAX_CODE_AND_OPERATION_CODE: Record<
	string,
	Record<string, string>
> = {
	"2300674028": {
		B11: "ECUSX5NET",
		B13: "ECUSC5NET",
		E42: "ECUSC5NET",
		G23: "ECUSC5NET",
	},
};

const IMPORT_OPERATION_CODE_SET = new Set<string>(IMPORT_OPERATION_CODES);
const EXPORT_OPERATION_CODE_SET = new Set<string>(EXPORT_OPERATION_CODES);

function normalizeCode(value: unknown) {
	return String(value ?? "")
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.replace(/\s+/g, "")
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, "");
}

function normalizeTaxCode(value: unknown) {
	const digits = String(value ?? "").replace(/\D+/g, "");
	return digits || null;
}

export function normalizeOperationTypeValue(
	value: unknown,
): FollowUpOperationType | null {
	const normalized = normalizeCode(value);
	if (!normalized) return null;

	if (
		normalized === "NHAP" ||
		normalized === "IMPORT" ||
		normalized === "IM" ||
		normalized === "NHAPKHAU"
	) {
		return "NHAP";
	}

	if (
		normalized === "XUAT" ||
		normalized === "EXPORT" ||
		normalized === "EX" ||
		normalized === "XUATKHAU"
	) {
		return "XUAT";
	}

	return null;
}

export function deriveOperationTypeFromOperationCode(
	operationCode: unknown,
): FollowUpOperationType | null {
	const code = normalizeCode(operationCode);
	if (!code) return null;

	if (IMPORT_OPERATION_CODE_SET.has(code)) return "NHAP";
	if (EXPORT_OPERATION_CODE_SET.has(code)) return "XUAT";

	if (code.startsWith("A")) return "NHAP";
	if (code.startsWith("B")) return "XUAT";

	return null;
}

export function deriveOperationTypeFromDeclarationPath(
	filePath: unknown,
): FollowUpOperationType | null {
	const normalized = normalizeCode(filePath);
	if (!normalized) return null;

	if (
		normalized.includes("TOKHAIHQ7X") ||
		normalized.includes("_XUAT_") ||
		normalized.includes("XUATKHAU")
	) {
		return "XUAT";
	}

	if (
		normalized.includes("TOKHAIHQ7N") ||
		normalized.includes("_NHAP_") ||
		normalized.includes("NHAPKHAU")
	) {
		return "NHAP";
	}

	return null;
}

export function deriveOperationTypeFromCaseName(
	caseName: unknown,
): FollowUpOperationType | null {
	const normalized = normalizeCode(caseName);
	if (!normalized) return null;

	if (normalized.includes("LOGI") || /GI\d/.test(normalized)) {
		return "NHAP";
	}

	if (normalized.includes("LOGE") || /GE\d/.test(normalized)) {
		return "XUAT";
	}

	return null;
}

export function deriveOperationType(options: {
	operationType?: unknown;
	operationCode?: unknown;
	filePath?: unknown;
	caseName?: unknown;
}): FollowUpOperationType | null {
	return (
		normalizeOperationTypeValue(options.operationType) ||
		deriveOperationTypeFromDeclarationPath(options.filePath) ||
		deriveOperationTypeFromCaseName(options.caseName) ||
		deriveOperationTypeFromOperationCode(options.operationCode)
	);
}

export function deriveHanAppName(options: {
	operationType?: unknown;
	operationCode?: unknown;
	filePath?: unknown;
	caseName?: unknown;
	taxCode?: unknown;
}) {
	const normalizedOperationCode = normalizeCode(options.operationCode);
	const normalizedTaxCode = normalizeTaxCode(options.taxCode);

	if (normalizedTaxCode && normalizedOperationCode) {
		const companyMapping =
			HAN_APP_NAME_BY_TAX_CODE_AND_OPERATION_CODE[normalizedTaxCode];

		if (companyMapping?.[normalizedOperationCode]) {
			return companyMapping[normalizedOperationCode];
		}
	}

	if (
		normalizedOperationCode &&
		HAN_APP_NAME_BY_OPERATION_CODE[normalizedOperationCode]
	) {
		return HAN_APP_NAME_BY_OPERATION_CODE[normalizedOperationCode];
	}

	return "ECUSK5NET";
}

export function isExportOperation(options: {
	operationType?: unknown;
	operationCode?: unknown;
	filePath?: unknown;
	caseName?: unknown;
}) {
	return deriveOperationType(options) === "XUAT";
}
