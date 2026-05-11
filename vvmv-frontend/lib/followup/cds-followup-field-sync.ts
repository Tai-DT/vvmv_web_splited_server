import type {
	FollowUpCdsInfoRow,
	FollowUpRow,
} from "@/app/(home)/internal/followup/types";

const VALID_TRANSPORT_METHOD_CODES = new Set([
	"1",
	"2",
	"3",
	"4",
	"5",
	"6",
	"9",
]);

export const CDS_FOLLOWUP_SYNC_FIELDS = [
	"authority",
	"workType",
	"etaEtd",
	"quantity",
	"unit",
	"grossWeight",
	"invoice",
	"poNumber",
	"billOrBooking",
	"pol",
	"pod",
	"transportDate",
	"transportMethod",
	"taxService",
] as const satisfies ReadonlyArray<keyof FollowUpRow>;

export type CdsFollowUpSyncField = (typeof CDS_FOLLOWUP_SYNC_FIELDS)[number];

export type CdsFollowUpSyncPatch = Partial<
	Record<CdsFollowUpSyncField, string | number | null>
>;

function normalizeText(value: unknown): string | null {
	const text = String(value ?? "").trim();
	return text || null;
}

function normalizeNumber(value: unknown): number | null {
	if (value === null || value === undefined || value === "") {
		return null;
	}

	const number =
		typeof value === "number" ? value : Number.parseFloat(String(value));
	return Number.isFinite(number) ? number : null;
}

function normalizeInt(value: unknown): number | null {
	const number = normalizeNumber(value);
	return number === null ? null : Math.trunc(number);
}

function normalizeDateString(value: unknown): string | null {
	const text = normalizeText(value);
	if (!text) {
		return null;
	}

	if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
		return text;
	}

	const date = new Date(text);
	if (Number.isNaN(date.getTime())) {
		return null;
	}

	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function normalizeTransportMethodCode(value: unknown): string | null {
	const normalized = String(value ?? "")
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.replace(/đ/g, "d")
		.replace(/Đ/g, "D")
		.trim()
		.toUpperCase();

	if (!normalized) {
		return null;
	}

	if (
		normalized.includes("NHAP KHAU TAI CHO") ||
		normalized.includes("TAI CHO") ||
		normalized.includes("KHO NGOAI QUAN") ||
		normalized.includes("BONDED WAREHOUSE") ||
		normalized.includes("BONDED")
	) {
		return "9";
	}

	if (
		normalized.includes("PIPE") ||
		normalized.includes("PIPELINE") ||
		normalized.includes("CABLE") ||
		normalized.includes("DAY CAP") ||
		normalized.includes("DUONG ONG")
	) {
		return "9";
	}

	if (normalized.includes("MANG THEO NGUOI")) {
		if (
			normalized.includes("AIR") ||
			normalized.includes("HANG KHONG") ||
			normalized.includes("DUONG KHONG") ||
			normalized.includes("AWB")
		) {
			return "1";
		}

		if (
			normalized.includes("SEA") ||
			normalized.includes("DUONG BIEN") ||
			normalized.includes("OCEAN") ||
			normalized.includes("VESSEL")
		) {
			return "3";
		}
	}

	if (
		normalized.includes("AWB") ||
		normalized.includes("AIR WAYBILL") ||
		normalized.includes("AIR")
	) {
		return "1";
	}

	if (normalized.includes("CY/CY")) {
		return "2";
	}

	if (normalized.includes("CFS")) {
		return "3";
	}

	if (VALID_TRANSPORT_METHOD_CODES.has(normalized)) {
		return normalized;
	}

	if (
		normalized.includes("AIR") ||
		normalized.includes("CPN") ||
		normalized.includes("HANG KHONG") ||
		normalized.includes("DUONG KHONG")
	) {
		return "1";
	}

	if (
		normalized.includes("SEA") ||
		normalized.includes("OCEAN") ||
		normalized.includes("VESSEL") ||
		normalized.includes("FCL") ||
		normalized.includes("LCL") ||
		normalized.includes("CONTAINER") ||
		normalized.includes("DUONG BIEN")
	) {
		return "2";
	}

	if (
		normalized.includes("TRUCK") ||
		normalized.includes("ROAD") ||
		normalized.includes("XE") ||
		normalized.includes("DUONG BO")
	) {
		return "4";
	}

	if (
		normalized.includes("RAIL") ||
		normalized.includes("TRAIN") ||
		normalized.includes("DUONG SAT")
	) {
		return "5";
	}

	if (
		normalized.includes("RIVER") ||
		normalized.includes("BARGE") ||
		normalized.includes("DUONG SONG")
	) {
		return "6";
	}

	if (normalized.includes("OTHER") || normalized.includes("KHAC")) {
		return "9";
	}

	return null;
}

function setIfPresent<T extends object>(
	target: T,
	key: keyof T,
	value: unknown,
) {
	if (value === null || value === undefined || value === "") {
		return;
	}

	(target as Record<string, unknown>)[String(key)] = value;
}

export function buildFollowUpPreferredCdsInfoPayload(
	followUp?: Partial<FollowUpRow> | null,
) {
	const payload: Partial<FollowUpCdsInfoRow> = {};

	if (!followUp) {
		return payload;
	}

	setIfPresent(payload, "importerCode", normalizeText(followUp.taxCode));
	setIfPresent(payload, "customsCode", normalizeText(followUp.authority));
	setIfPresent(payload, "operationCode", normalizeText(followUp.workType));
	setIfPresent(
		payload,
		"departureArrivalDate",
		normalizeDateString(followUp.etaEtd),
	);
	setIfPresent(payload, "packageQuantity", normalizeInt(followUp.quantity));
	setIfPresent(payload, "packageType", normalizeText(followUp.unit));
	setIfPresent(
		payload,
		"grossWeightTotal",
		normalizeNumber(followUp.grossWeight),
	);
	setIfPresent(payload, "commercialInvoice", normalizeText(followUp.invoice));
	setIfPresent(payload, "contractNumber", normalizeText(followUp.poNumber));
	setIfPresent(payload, "billOfLading", normalizeText(followUp.billOrBooking));
	setIfPresent(payload, "loadingLocationCode", normalizeText(followUp.pol));
	setIfPresent(payload, "unloadingLocationCode", normalizeText(followUp.pod));
	setIfPresent(
		payload,
		"transportDepartureDate",
		normalizeDateString(followUp.transportDate),
	);
	setIfPresent(
		payload,
		"transportMethodCode",
		normalizeTransportMethodCode(followUp.transportMethod),
	);
	setIfPresent(
		payload,
		"taxDestinationLocation",
		normalizeText(followUp.taxService),
	);

	return payload;
}

export function buildFollowUpSyncPatchFromCdsInfo(
	cdsInfo: Partial<FollowUpCdsInfoRow>,
) {
	const patch: CdsFollowUpSyncPatch = {};

	setIfPresent(patch, "authority", normalizeText(cdsInfo.customsCode));
	setIfPresent(patch, "workType", normalizeText(cdsInfo.operationCode));
	setIfPresent(
		patch,
		"etaEtd",
		normalizeDateString(cdsInfo.departureArrivalDate ?? cdsInfo.departureDate),
	);
	setIfPresent(patch, "quantity", normalizeInt(cdsInfo.packageQuantity));
	setIfPresent(patch, "unit", normalizeText(cdsInfo.packageType));
	setIfPresent(patch, "grossWeight", normalizeNumber(cdsInfo.grossWeightTotal));
	setIfPresent(patch, "invoice", normalizeText(cdsInfo.commercialInvoice));
	setIfPresent(patch, "poNumber", normalizeText(cdsInfo.contractNumber));
	setIfPresent(patch, "billOrBooking", normalizeText(cdsInfo.billOfLading));
	setIfPresent(patch, "pol", normalizeText(cdsInfo.loadingLocationCode));
	setIfPresent(patch, "pod", normalizeText(cdsInfo.unloadingLocationCode));
	setIfPresent(
		patch,
		"transportDate",
		normalizeDateString(cdsInfo.transportDepartureDate),
	);
	setIfPresent(
		patch,
		"transportMethod",
		normalizeText(cdsInfo.transportMethodCode),
	);
	setIfPresent(
		patch,
		"taxService",
		normalizeText(cdsInfo.taxDestinationLocation),
	);

	return patch;
}
