import fs from "node:fs";
import path from "node:path";

export type CdsPackageUnitCode = {
	code: string;
	name: string | null;
	nameAlt: string | null;
	nameVn: string | null;
	nameAltVn: string | null;
	legacyCode: string | null;
	legacyName: string | null;
	isVnaccs: boolean;
	visibleFlag: string | null;
	sortOrder: number;
};

type PackageUnitJsonRow = {
	MA_DON_VI?: unknown;
	TEN_DON_VI?: unknown;
	TEN_DON_VI_1?: unknown;
	TEN_DON_VI_VN?: unknown;
	TEN_DON_VI_1_VN?: unknown;
	MA_CU?: unknown;
	TEN_CU?: unknown;
	isVNACCS?: unknown;
	HienThi?: unknown;
};

const PACKAGE_UNIT_CODES_PATH = path.join(
	process.cwd(),
	"database",
	"exports",
	"BAN_DON_VI_KIEN_HANG.json",
);

let cachedMtimeMs: number | null = null;
let cachedPackageUnitCodes: CdsPackageUnitCode[] | null = null;

function normalizeText(value: unknown) {
	const normalized = String(value ?? "").trim();
	return normalized === "" ? null : normalized;
}

function normalizeCode(value: unknown) {
	return normalizeText(value)?.toUpperCase() ?? null;
}

function parseBooleanFlag(value: unknown) {
	const normalized = normalizeText(value)?.toLowerCase();
	return normalized === "1" || normalized === "true" || normalized === "-1";
}

function parsePackageUnitCodeRow(
	row: PackageUnitJsonRow,
	sortOrder: number,
): CdsPackageUnitCode | null {
	const code = normalizeCode(row.MA_DON_VI);
	if (!code) {
		return null;
	}
	const visibleFlag = normalizeText(row.HienThi);

	return {
		code,
		name: normalizeText(row.TEN_DON_VI),
		nameAlt: normalizeText(row.TEN_DON_VI_1),
		nameVn: normalizeText(row.TEN_DON_VI_VN),
		nameAltVn: normalizeText(row.TEN_DON_VI_1_VN),
		legacyCode: normalizeText(row.MA_CU),
		legacyName: normalizeText(row.TEN_CU),
		isVnaccs: parseBooleanFlag(row.isVNACCS),
		visibleFlag,
		sortOrder,
	};
}

// `database/exports` is generated (see scripts/import-cds-lookups.ts) and not
// committed, so an absent catalog is expected — degrade to an empty list.
function readPackageUnitRows(filePath: string): PackageUnitJsonRow[] {
	if (fs.existsSync(filePath)) {
		const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
		if (Array.isArray(parsed)) {
			return parsed as PackageUnitJsonRow[];
		}
	}

	return [];
}

export function getCdsPackageUnitCodes(): CdsPackageUnitCode[] {
	const stat = fs.existsSync(PACKAGE_UNIT_CODES_PATH)
		? fs.statSync(PACKAGE_UNIT_CODES_PATH)
		: null;

	if (
		stat &&
		cachedPackageUnitCodes &&
		cachedMtimeMs !== null &&
		cachedMtimeMs === stat.mtimeMs
	) {
		return cachedPackageUnitCodes;
	}

	const deduped = new Map<string, CdsPackageUnitCode>();

	readPackageUnitRows(PACKAGE_UNIT_CODES_PATH).forEach((row, index) => {
		const unit = parsePackageUnitCodeRow(row, index + 1);
		if (!unit) {
			return;
		}

		const existing = deduped.get(unit.code);
		if (!existing || unit.sortOrder < existing.sortOrder) {
			deduped.set(unit.code, unit);
		}
	});

	const units = [...deduped.values()].sort((left, right) => {
		if (left.sortOrder !== right.sortOrder) {
			return left.sortOrder - right.sortOrder;
		}

		return left.code.localeCompare(right.code, "en", { numeric: true });
	});

	cachedMtimeMs = stat?.mtimeMs ?? null;
	cachedPackageUnitCodes = units;
	return units;
}
