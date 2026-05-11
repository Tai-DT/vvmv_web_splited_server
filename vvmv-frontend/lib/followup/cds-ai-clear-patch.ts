import type { FollowUpCdsInfoRow } from "@/app/(home)/internal/followup/types";

function normalizePromptSearchText(value: string) {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/đ/g, "d")
		.replace(/Đ/g, "D")
		.toLowerCase();
}

const DELETE_VERB_SNIPPET =
	"(?:\\b(?:xoa|xoa het|xoa bo|lam trong|clear|empty|dung|bo)\\b)";

const TRANSPORT_VEHICLE_CLEAR_SNIPPET =
	"(?:ten\\s+ptvt|ma\\s+ptvt|ten\\s+phuong\\s+tien|ten\\s+xe|xe\\s+tai|phuong\\s+tien\\s+van\\s+chuyen|phuong\\s+tien\\s+vc|bien\\s+so|so\\s+xe|transport\\s+vehicle|vehicle\\s+name|phuong\\s+tien\\s+vc|ptvt\\b)";

const TAX_DESTINATION_CLEAR_SNIPPET =
	"(?:dia\\s+diem\\s+dich|dich\\s+bao\\s+thue|tax\\s+destination|ma\\s+dia\\s+diem\\s+dich)";

const TRUCK_LOADING_CLEAR_SNIPPET =
	"(?:dia\\s+diem\\s+xep\\s+hang|xep\\s+hang\\s+len\\s+xe|truck\\s+loading|ma\\s+diem\\s+xep\\s+hang)";

/**
 * Detects user intent to clear ECUS-style header fields from a chat prompt
 * (Vietnamese + ASCII, accents stripped). Used with snapshot + explicit update flow.
 */
export function extractCdsClearPatchFromPrompt(
	promptText: string,
): Partial<FollowUpCdsInfoRow> {
	const normalized = normalizePromptSearchText(promptText);
	const patch: Partial<FollowUpCdsInfoRow> = {};

	const transportClear = new RegExp(
		`${DELETE_VERB_SNIPPET}[\\s\\S]{0,140}${TRANSPORT_VEHICLE_CLEAR_SNIPPET}|${TRANSPORT_VEHICLE_CLEAR_SNIPPET}[\\s\\S]{0,140}${DELETE_VERB_SNIPPET}`,
		"i",
	);
	if (transportClear.test(normalized)) {
		patch.transportVehicleCode = null;
		patch.transportVehicleName = null;
	}

	const taxDestClear = new RegExp(
		`${DELETE_VERB_SNIPPET}[\\s\\S]{0,140}${TAX_DESTINATION_CLEAR_SNIPPET}|${TAX_DESTINATION_CLEAR_SNIPPET}[\\s\\S]{0,140}${DELETE_VERB_SNIPPET}`,
		"i",
	);
	if (taxDestClear.test(normalized)) {
		patch.taxDestinationLocation = null;
	}

	const truckLoadClear = new RegExp(
		`${DELETE_VERB_SNIPPET}[\\s\\S]{0,140}${TRUCK_LOADING_CLEAR_SNIPPET}|${TRUCK_LOADING_CLEAR_SNIPPET}[\\s\\S]{0,140}${DELETE_VERB_SNIPPET}`,
		"i",
	);
	if (truckLoadClear.test(normalized)) {
		patch.truckLoadingLocationCode = null;
		patch.truckLoadingLocationName = null;
		patch.truckLoadingLocationAddress = null;
	}

	const loadingUnloadingClear = new RegExp(
		`${DELETE_VERB_SNIPPET}[\\s\\S]{0,160}(?:dia\\s+diem\\s+nhan\\s+hang|dia\\s+diem\\s+xep\\s+hang|dia\\s+diem\\s+do\\s+hang|noi\\s+nhan\\s+hang|noi\\s+xep\\s+hang|loading\\s+location|unloading\\s+location)|(?:dia\\s+diem\\s+nhan\\s+hang|dia\\s+diem\\s+xep\\s+hang|dia\\s+diem\\s+do\\s+hang)[\\s\\S]{0,160}${DELETE_VERB_SNIPPET}`,
		"i",
	);
	if (loadingUnloadingClear.test(normalized)) {
		patch.loadingLocationCode = null;
		patch.loadingLocationName = null;
		patch.unloadingLocationCode = null;
		patch.unloadingLocationName = null;
	}

	return patch;
}

/** When overwrite mode applies AI result, these keys may be set to null to clear the form. */
export const CDS_INFO_FIELDS_APPLY_NULL_ON_OVERWRITE = new Set<
	keyof FollowUpCdsInfoRow
>([
	"transportVehicleCode",
	"transportVehicleName",
	"taxDestinationLocation",
	"loadingLocationCode",
	"loadingLocationName",
	"unloadingLocationCode",
	"unloadingLocationName",
	"truckLoadingLocationCode",
	"truckLoadingLocationName",
	"truckLoadingLocationAddress",
]);
