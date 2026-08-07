import fs from "node:fs";
import path from "node:path";

export type CdsCargoUnitCode = {
	stt: number;
	code: string;
	name: string | null;
	nameVn: string | null;
	nameAlt: string | null;
	nameAltVn: string | null;
	standardCode: string | null;
	conversionRate: number | null;
	sourceTable: string | null;
	isVnaccs: boolean;
	visibleFlag: string | null;
	itemType: string | null;
	oldCode: string | null;
	oldName: string | null;
	usedCount: number;
	appUnitCount: number;
	unit2Count: number;
	allColumnCount: number;
	dvtHtsCount: number;
	maDvtCount: number;
	maDvt2Count: number;
	dvtDgiaHdtmCount: number;
	inSdvtMaster: boolean;
};

const CARGO_UNIT_CODES_PATH = path.join(
	process.cwd(),
	"database",
	"exports",
	"cds_cargo_unit_codes.json",
);

let cachedMtimeMs: number | null = null;
let cachedCargoUnitCodes: CdsCargoUnitCode[] | null = null;

function normalizeText(value: string | null | undefined) {
	const normalized = String(value ?? "").trim();
	return normalized === "" ? null : normalized;
}

function normalizeCode(value: string | null | undefined) {
	return normalizeText(value)?.toUpperCase() ?? null;
}

export function getCdsCargoUnitCodes(): CdsCargoUnitCode[] {
	const stat = fs.existsSync(CARGO_UNIT_CODES_PATH)
		? fs.statSync(CARGO_UNIT_CODES_PATH)
		: null;

	if (
		stat &&
		cachedCargoUnitCodes &&
		cachedMtimeMs !== null &&
		cachedMtimeMs === stat.mtimeMs
	) {
		return cachedCargoUnitCodes;
	}

	// `database/exports` is generated (see scripts/import-cds-lookups.ts) and not
	// committed, so an absent catalog is expected — degrade to an empty list.
	const rows = fs.existsSync(CARGO_UNIT_CODES_PATH)
		? (JSON.parse(fs.readFileSync(CARGO_UNIT_CODES_PATH, "utf8")) as unknown)
		: null;
	const sourceUnits = Array.isArray(rows)
		? rows
				.map((row) => {
					if (!row || typeof row !== "object" || Array.isArray(row)) {
						return null;
					}
					const item = row as Partial<CdsCargoUnitCode>;
					const code = normalizeCode(item.code);
					return code ? ({ ...item, code } as CdsCargoUnitCode) : null;
				})
				.filter((row): row is CdsCargoUnitCode => row !== null)
		: [];
	const deduped = new Map<string, CdsCargoUnitCode>();

	for (const unit of sourceUnits) {
		const existing = deduped.get(unit.code);
		if (!existing || unit.usedCount > existing.usedCount) {
			deduped.set(unit.code, unit);
		}
	}

	const units = [...deduped.values()].sort((left, right) => {
		if (right.usedCount !== left.usedCount) {
			return right.usedCount - left.usedCount;
		}

		return left.code.localeCompare(right.code, "en", { numeric: true });
	});

	cachedMtimeMs = stat?.mtimeMs ?? null;
	cachedCargoUnitCodes = units;
	return units;
}
