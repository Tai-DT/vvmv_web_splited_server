export function normalizeLooseNumber(value: unknown): number | null {
	if (value === null || value === undefined || value === "") return null;
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}

	const text = String(value).trim();
	if (!text) return null;

	const cleaned = text.replace(/\s+/g, "");
	const hasComma = cleaned.includes(",");
	const hasDot = cleaned.includes(".");

	let normalized = cleaned;

	if (hasComma && hasDot) {
		normalized =
			cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
				? cleaned.replace(/\./g, "").replace(",", ".")
				: cleaned.replace(/,/g, "");
	} else if (hasComma) {
		// If comma appears as thousands separators (e.g. 1,000 or 1,000,000), remove commas.
		if (/^\d{1,3}(,\d{3})+$/.test(cleaned)) {
			normalized = cleaned.replace(/,/g, "");
		} else {
			// Otherwise treat comma as decimal separator (e.g. 364,8).
			normalized = cleaned.replace(/\./g, "").replace(",", ".");
		}
	} else {
		if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
			normalized = cleaned.replace(/\./g, "");
		}
		const dotCount = (cleaned.match(/\./g) || []).length;
		if (dotCount > 1) {
			normalized = cleaned.replace(/\./g, "");
		}
	}

	const parsed = Number.parseFloat(normalized);
	return Number.isNaN(parsed) ? null : parsed;
}

export function normalizeWeightNumber(value: unknown): number | null {
	if (value === null || value === undefined || value === "") return null;
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}

	const cleaned = String(value).trim().replace(/\s+/g, "");
	if (!cleaned) return null;

	// Weight fields on transport documents often use fixed 3-decimal formatting
	// like "526.000", which should mean 526 rather than 526000.
	if (/^\d+\.\d{3}$/.test(cleaned)) {
		return Number.parseFloat(cleaned);
	}

	if (/^\d+,\d{3}$/.test(cleaned)) {
		return Number.parseFloat(cleaned.replace(",", "."));
	}

	return normalizeLooseNumber(cleaned);
}
