import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * Chạy một lần trước toàn bộ test: đảm bảo các file JSON trong database/exports
 * tồn tại để những module import tĩnh chúng có thể phân giải được. Nếu thiếu,
 * script tạo file rỗng và các test kiểm tra dữ liệu thật sẽ tự skip.
 */
export default function setup() {
	execFileSync(
		process.execPath,
		[path.resolve(__dirname, "scripts/ensure-database-exports.mjs")],
		{ cwd: __dirname, stdio: "inherit" },
	);
}
