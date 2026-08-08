import fs from "node:fs";
import path from "node:path";

/**
 * Các test đối chiếu nội dung danh mục tra cứu chỉ chạy được khi máy có dữ liệu
 * xuất thật từ HAN_2024 trong database/exports (thư mục này bị gitignore).
 * Trên máy vừa clone, scripts/ensure-database-exports.mjs chỉ tạo file rỗng để
 * import phân giải được, nên các test đó phải skip thay vì báo fail sai.
 */

const EXPORTS_DIR = path.join(process.cwd(), "database", "exports");

function readExport(relativePath: string): unknown {
	const filePath = path.join(EXPORTS_DIR, relativePath);
	if (!fs.existsSync(filePath)) {
		return null;
	}

	try {
		return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
	} catch {
		return null;
	}
}

function hasRows(relativePath: string) {
	const parsed = readExport(relativePath);
	return Array.isArray(parsed) && parsed.length > 0;
}

export const hasCargoUnitExport = hasRows("cds_cargo_unit_codes.json");
export const hasPackageUnitExport = hasRows("BAN_DON_VI_KIEN_HANG.json");
export const hasBankCodesExport = hasRows("cds_bank_codes.json");
export const hasTruckLoadingExport = hasRows("cds_truck_loading_codes.json");

export const hasLookupSnapshotExport = (() => {
	const parsed = readExport(
		"app_cds_lookups_latest/cds_database_lookups.json",
	) as { data?: unknown; fieldOptions?: unknown } | null;
	if (!parsed || typeof parsed !== "object") {
		return false;
	}

	const payload = (
		parsed.data && typeof parsed.data === "object" ? parsed.data : parsed
	) as { fieldOptions?: unknown };

	return (
		!!payload.fieldOptions &&
		typeof payload.fieldOptions === "object" &&
		Object.keys(payload.fieldOptions).length > 0
	);
})();
