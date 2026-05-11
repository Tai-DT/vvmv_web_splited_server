import type { VisibilityState } from "@tanstack/react-table";
import { FOLLOWUP_MAIN_TABLE_COLUMN_IDS } from "./column-headers";

/**
 * Columns left visible on narrow viewports unless the user overrides via Column manager.
 * Keeps horizontal scroll usable (~8 columns vs ~40+).
 */
export const FOLLOWUP_MOBILE_PRIORITY_COLUMN_IDS = new Set([
	"actions",
	"jobNumber",
	"status",
	"declarations",
	"companyName",
	"taxCode",
	"billOrBooking",
	"updatedAt",
]);

/** TanStack: false = hidden */
export function getFollowupMobileColumnVisibility(): VisibilityState {
	const visibility: VisibilityState = {};
	for (const id of FOLLOWUP_MAIN_TABLE_COLUMN_IDS) {
		if (id === "actions") continue;
		if (!FOLLOWUP_MOBILE_PRIORITY_COLUMN_IDS.has(id)) {
			visibility[id] = false;
		}
	}
	return visibility;
}

/**
 * Returns sparse columnVisibility overrides relative to the mobile preset.
 *
 * TanStack convention: false = hidden, true/undefined = visible.
 * Preset implies hidden when preset[id] === false; otherwise visible.
 */
export function visibilityDiffFromMobilePreset(
	effective: VisibilityState,
	preset: VisibilityState,
): VisibilityState {
	const diff: VisibilityState = {};

	for (const id of FOLLOWUP_MAIN_TABLE_COLUMN_IDS) {
		if (id === "actions") continue;

		const presetHidden = preset[id] === false;
		const effectiveHidden = effective[id] === false;

		if (presetHidden !== effectiveHidden) {
			diff[id] = !effectiveHidden;
		}
	}

	return diff;
}
