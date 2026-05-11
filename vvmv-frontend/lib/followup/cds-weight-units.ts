export const DEFAULT_CDS_WEIGHT_UNIT = "KGM";

export const CDS_GROSS_WEIGHT_UNIT_LABELS = {
	KGM: "KILO-GRAMMES",
	GRM: "GRAMMES",
	TNE: "METRIC-TONS",
	LBR: "POUNDS",
	LBS: "POUNDS",
	ONZ: "OUNCE",
	STN: "SHORT TON",
	LTN: "LONG TON",
	HKGM: "TA (100 KG)",
	HGRM: "100 GRAMME",
	MGRM: "MILIGAM",
	KDW: "KILO-GRAMMES BY DRY WEIGHT",
	MDW: "METRIC-TONS BY DRY WEIGHT",
	GDW: "GRAMMES BY DRY WEIGHT",
	LDW: "POUNDS BY DRY WEIGHT",
	ODW: "OUNCE BY DRY WEIGHT",
	KIC: "KILO-GRAMMES INCLUDING CONTAINERS",
	MIC: "METRIC-TONS INCLUDING CONTAINERS",
	GIC: "GRAMMES INCLUDING CONTAINERS",
	LIC: "POUNDS INCLUDING CONTAINERS",
	OIC: "OUNCE INCLUDING CONTAINERS",
	KII: "KILO-GRAMMES INCLUDING INNER PACKINGS",
	MII: "METRIC-TONS INCLUDING INNER PACKINGS",
	GII: "GRAMMES INCLUDING INNER PACKINGS",
	LII: "POUNDS INCLUDING INNER PACKINGS",
	OII: "OUNCE INCLUDING INNER PACKINGS",
	KMC: "KILO-GRAMMES BY METAL CONTENT",
	MMC: "METRIC-TONS BY METAL CONTENT",
	GMC: "GRAMMES BY METAL CONTENT",
	LMC: "POUNDS BY METAL CONTENT",
	OMC: "OUNCE BY METAL CONTENT",
	ADMT: "AIR DRY METRIC TON",
} as const;

const CDS_WEIGHT_UNIT_ALIASES: Record<string, string> = {
	G: "GRM",
	GR: "GRM",
	GRAM: "GRM",
	GRAMS: "GRM",
	KG: "KGM",
	KGS: "KGM",
	KILOGRAM: "KGM",
	KILOGRAMS: "KGM",
	LB: "LBR",
	LBS: "LBS",
	MT: "TNE",
	TON: "TNE",
	TONS: "TNE",
};

function normalizeText(value: unknown): string | null {
	if (value === null || value === undefined) {
		return null;
	}

	const text = String(value).trim();
	return text === "" ? null : text;
}

function stripLookupDisplayLabel(value: unknown): string | null {
	const text = normalizeText(value);
	if (!text) {
		return null;
	}

	const separatorIndex = text.indexOf(" - ");
	if (separatorIndex <= 0) {
		return text;
	}

	const code = text.slice(0, separatorIndex).trim();
	return code || text;
}

export function normalizeOptionalCdsWeightUnit(value: unknown): string | null {
	const code = stripLookupDisplayLabel(value)?.trim().toUpperCase();
	if (!code) {
		return null;
	}

	const normalizedCode = CDS_WEIGHT_UNIT_ALIASES[code] ?? code;
	return normalizedCode in CDS_GROSS_WEIGHT_UNIT_LABELS ? normalizedCode : null;
}

export function normalizeCdsWeightUnit(
	value: unknown,
	fallback = DEFAULT_CDS_WEIGHT_UNIT,
) {
	return normalizeOptionalCdsWeightUnit(value) ?? fallback;
}

export function isAllowedCdsWeightUnit(value: unknown) {
	return normalizeOptionalCdsWeightUnit(value) !== null;
}

export function getCdsWeightUnitOptions() {
	return Object.entries(CDS_GROSS_WEIGHT_UNIT_LABELS).map(([value, label]) => ({
		value,
		label: `${value} - ${label}`,
	}));
}
