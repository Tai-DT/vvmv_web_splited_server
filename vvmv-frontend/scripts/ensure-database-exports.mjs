#!/usr/bin/env node
/**
 * `database/` chứa dữ liệu xuất từ HAN_2024 và bị gitignore, nhưng một số
 * module trong lib/followup import tĩnh các file JSON đó để bundler serverless
 * luôn đóng gói kèm (không phụ thuộc process.cwd()). Trên máy vừa clone, các
 * file này không tồn tại nên tsc, next build và vitest đều hỏng ngay ở bước
 * phân giải import.
 *
 * Script này chỉ tạo file rỗng cho những đường dẫn còn thiếu để import phân
 * giải được. Nó không bao giờ ghi đè dữ liệu thật đã có sẵn trên máy.
 *
 * Muốn có dữ liệu thật, hãy chạy lại quy trình xuất dữ liệu từ HAN_2024.
 */

import fs from "node:fs";
import path from "node:path";

const EXPORTS_DIR = path.join(process.cwd(), "database", "exports");

/** Đường dẫn tương đối trong database/exports -> nội dung rỗng hợp lệ. */
const REQUIRED_EXPORTS = [
	["cds_cargo_unit_codes.json", "[]"],
	["BAN_DON_VI_KIEN_HANG.json", "[]"],
	["cds_bank_codes.json", "[]"],
	["cds_truck_loading_codes.json", "[]"],
	["app_cds_lookups_latest/cds_database_lookups.json", '{"fieldOptions":{}}'],
];

const created = [];

for (const [relativePath, emptyContent] of REQUIRED_EXPORTS) {
	const filePath = path.join(EXPORTS_DIR, relativePath);
	if (fs.existsSync(filePath)) {
		continue;
	}

	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, `${emptyContent}\n`, "utf8");
	created.push(relativePath);
}

if (created.length > 0) {
	console.warn(
		[
			"",
			"[database-exports] Thiếu dữ liệu xuất từ HAN_2024, đã tạo file rỗng để build được:",
			...created.map((relativePath) => `  - database/exports/${relativePath}`),
			"",
			"  Các danh mục tra cứu (đơn vị tính, mã ngân hàng, địa điểm xếp hàng...)",
			"  sẽ RỖNG cho tới khi bạn chạy lại quy trình xuất dữ liệu.",
			"  Đừng deploy bằng dữ liệu rỗng này.",
			"",
		].join("\n"),
	);
}
