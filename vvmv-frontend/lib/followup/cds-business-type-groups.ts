export const CDS_BUSINESS_TYPE_GROUP_OPTIONS = [
	{ value: "00", label: "00 - Kinh doanh, đầu tư" },
	{ value: "01", label: "01 - Sản xuất xuất khẩu" },
	{ value: "02", label: "02 - Gia công" },
	{ value: "04", label: "04 - Chế xuất" },
	{ value: "05", label: "05 - Khác" },
] as const;

const BUSINESS_TYPE_GROUP_LABEL_ALIASES: Array<{
	code: string;
	patterns: string[];
}> = [
	{
		code: "00",
		patterns: ["kinh doanh dau tu", "kinh doanh va dau tu"],
	},
	{
		code: "01",
		patterns: ["san xuat xuat khau", "sx xuat khau", "sxxk"],
	},
	{
		code: "02",
		patterns: ["gia cong"],
	},
	{
		code: "04",
		patterns: ["che xuat", "doanh nghiep che xuat", "dncx"],
	},
	{
		code: "05",
		patterns: ["khac"],
	},
];

function normalizeLabelText(value: string) {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/đ/g, "d")
		.replace(/Đ/g, "D")
		.replace(/[^a-zA-Z0-9]+/g, " ")
		.trim()
		.toLowerCase()
		.replace(/\s+/g, " ");
}

export function normalizeCdsBusinessTypeGroup(value: unknown): string | null {
	const text = String(value ?? "").trim();

	if (!text) {
		return null;
	}

	const codePart = text.includes(" - ") ? text.split(" - ")[0]?.trim() : text;
	const upperCode = codePart.toUpperCase();

	if (/^\d{1,2}$/.test(upperCode)) {
		return upperCode.padStart(2, "0");
	}

	if (/^[A-Z0-9]{1,8}$/.test(upperCode)) {
		return upperCode;
	}

	const normalizedLabel = normalizeLabelText(text);
	for (const alias of BUSINESS_TYPE_GROUP_LABEL_ALIASES) {
		if (alias.patterns.some((pattern) => normalizedLabel.includes(pattern))) {
			return alias.code;
		}
	}

	return upperCode.length <= 8 ? upperCode : null;
}

function normalizeOperationCode(value: unknown): string | null {
	const code = String(value ?? "")
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, "");
	return code || null;
}

const BUSINESS_TYPE_GROUP_BY_OPERATION_CODE: Record<string, string> = {
	E11: "04",
	E13: "04",
	E15: "04",
	E42: "04",
	E21: "02",
	E23: "02",
	E41: "02",
	E52: "02",
	E54: "02",
	E82: "02",
	E31: "01",
	E33: "01",
	E62: "01",
};

export function deriveBusinessTypeGroupFromOperationCode(
	operationCode: unknown,
): string | null {
	const normalizedOperationCode = normalizeOperationCode(operationCode);
	if (!normalizedOperationCode) {
		return null;
	}

	return BUSINESS_TYPE_GROUP_BY_OPERATION_CODE[normalizedOperationCode] ?? "00";
}

/**
 * Effective business type group: same rules as `normalizeBusinessTypeGroup` in
 * `han-declaration-writer.ts` — stored value wins when parsable; else derive from
 * `operationCode` (fallback `00` when code is present but unmapped).
 */
export function resolveCdsBusinessTypeGroup(
	businessTypeGroup: unknown,
	operationCode: unknown,
): string | null {
	const fromField = normalizeCdsBusinessTypeGroup(businessTypeGroup);
	if (fromField) {
		return fromField;
	}

	return deriveBusinessTypeGroupFromOperationCode(operationCode);
}
