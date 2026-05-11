export const CDS_ELECTRONIC_ATTACHMENT_TYPES = [
	{
		value: "INV",
		description: "Hóa đơn",
	},
	{
		value: "BOL",
		description: "B/L",
	},
	{
		value: "INS",
		description: "Chi tiết bảo hiểm",
	},
	{
		value: "CON",
		description: "Hợp đồng",
	},
	{
		value: "ALL",
		description: "Tất cả các loại hồ sơ",
	},
	{
		value: "ETC",
		description: "Loại khác",
	},
] as const;

export const CDS_ELECTRONIC_ATTACHMENT_TYPE_OPTIONS =
	CDS_ELECTRONIC_ATTACHMENT_TYPES.map((item) => ({
		value: item.value,
		label: `${item.value} - ${item.description}`,
	}));

const GENERIC_ATTACHMENT_NUMBER_PLACEHOLDERS = new Set([
	"-",
	"--",
	".",
	"..",
	"N/A",
	"NA",
	"NULL",
]);

const BOL_ATTACHMENT_NUMBER_PLACEHOLDERS = new Set([
	"DINH DANH",
	"DK MOI",
	"HANDCARRY",
	"KHONG HQ",
	"SDD",
	"SO DINH DANH",
	"TAI CHO",
	"X",
]);

function normalizeAttachmentValue(value: string | null | undefined) {
	return String(value ?? "")
		.trim()
		.toUpperCase();
}

export function getCdsElectronicAttachmentTypeDescription(
	value: string | null | undefined,
) {
	const normalized = normalizeAttachmentValue(value);

	if (!normalized) {
		return null;
	}

	return (
		CDS_ELECTRONIC_ATTACHMENT_TYPES.find((item) => item.value === normalized)
			?.description ?? null
	);
}

export function shouldMatchCdsElectronicAttachmentType(
	selectedTypeCode: string | null | undefined,
	itemTypeCode: string | null | undefined,
) {
	const normalizedSelectedTypeCode = normalizeAttachmentValue(selectedTypeCode);

	if (!normalizedSelectedTypeCode || normalizedSelectedTypeCode === "ALL") {
		return true;
	}

	return normalizedSelectedTypeCode === normalizeAttachmentValue(itemTypeCode);
}

export function isUsableCdsElectronicAttachmentNumber(
	typeCode: string | null | undefined,
	value: string | null | undefined,
) {
	const normalizedValue = normalizeAttachmentValue(value);

	if (!normalizedValue) {
		return false;
	}

	if (GENERIC_ATTACHMENT_NUMBER_PLACEHOLDERS.has(normalizedValue)) {
		return false;
	}

	if (normalizeAttachmentValue(typeCode) !== "BOL") {
		return true;
	}

	if (BOL_ATTACHMENT_NUMBER_PLACEHOLDERS.has(normalizedValue)) {
		return false;
	}

	return normalizedValue.replace(/\s+/g, "").length >= 6;
}
