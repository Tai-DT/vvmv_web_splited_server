import type { CargoListRow } from "@/app/(home)/internal/followup/types";

/** Fields compared for “did the model change line items meaningfully?”. */
const CARGO_DIFF_KEYS: (keyof CargoListRow)[] = [
	"customCode",
	"hsCode",
	"vietnameseName",
	"originalCargoName",
	"originalCountry",
	"qty",
	"unit",
	"unitPrice",
	"totalPrice",
];

function normalizeScalar(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}
	if (typeof value === "number") {
		return Number.isFinite(value) ? String(value) : "";
	}
	return String(value).trim();
}

function cargoRowSignature(row: Partial<CargoListRow>): string {
	const parts: string[] = [];
	for (const key of CARGO_DIFF_KEYS) {
		parts.push(`${String(key)}=${normalizeScalar(row[key])}`);
	}
	return parts.join("|");
}

/**
 * Returns true when row counts differ or any aligned row (by index) differs on tracked fields.
 * Used only when the user already passed explicit chat-update gates — avoids relying solely on keyword regex.
 */
export function cargoListsMeaningfullyDiffer(
	currentRows: readonly Partial<CargoListRow>[],
	aiRows: readonly Partial<CargoListRow>[],
): boolean {
	if (currentRows.length !== aiRows.length) {
		return true;
	}

	for (let i = 0; i < aiRows.length; i++) {
		if (
			cargoRowSignature(currentRows[i] ?? {}) !==
			cargoRowSignature(aiRows[i] ?? {})
		) {
			return true;
		}
	}

	return false;
}
