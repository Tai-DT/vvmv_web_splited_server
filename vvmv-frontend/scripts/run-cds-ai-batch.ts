/**
 * Batch runner: chạy CDS AI (Gemini) cho N follow-up job mới nhất của một site, rồi
 * (tuỳ chọn) ghi kết quả vào bảng CDS (`follow_up_cds_info`).
 *
 * Mặc định: 10 job HCM (site = SGN) mới nhất, có ghi vào cds-info.
 *
 * Script này KHÔNG gọi trực tiếp DB/Gemini/Drive. Nó điều phối đúng các HTTP endpoint
 * mà giao diện web đang dùng, nên hành vi khớp production:
 *   1) GET  /api/followup?pageSize=..&search=<site>      -> lấy job mới nhất (createdAt desc)
 *   2) GET  /api/google-drive/files?folderId=..          -> liệt kê chứng từ trong thư mục Drive của job
 *   3) POST /api/followup/:id/cds-ai-document            -> Gemini OCR + trích xuất cdsInfo/cargoList
 *   4) POST /api/followup/:id/cds-info  { data: cdsInfo } -> upsert form CDS (khi --apply, mặc định bật)
 *
 * YÊU CẦU MÔI TRƯỜNG (chạy ở nơi có hạ tầng thật, không chạy được trong sandbox rỗng):
 *   - Backend/Next app đang chạy và truy cập được qua CDS_AI_BASE_URL.
 *   - Postgres RPA + GEMINI_API_KEY đã cấu hình cho app đó.
 *   - Một session cookie hợp lệ (better-auth) của user có quyền đọc job của site
 *     (SUPERADMIN để lọc được site tuỳ ý). Lấy từ DevTools > Application > Cookies.
 *
 * Cách dùng (từ thư mục vvmv-frontend):
 *   CDS_AI_BASE_URL="https://app.noi-bo" \
 *   CDS_AI_AUTH_COOKIE="better-auth.session_token=...; ..." \
 *   pnpm cds:ai-batch                       # 10 job SGN mới nhất, chạy AI + ghi cds-info
 *   pnpm cds:ai-batch -- --dry-run          # chỉ liệt kê job + chứng từ, KHÔNG gọi Gemini/ghi DB
 *   pnpm cds:ai-batch -- --no-apply         # chạy AI nhưng KHÔNG ghi cds-info (chỉ xuất báo cáo)
 *   pnpm cds:ai-batch -- --site HAN --limit 5
 *   pnpm cds:ai-batch -- --model gemini-2.5-pro
 *
 * Báo cáo JSON được ghi ra scripts/out/cds-ai-batch-<timestamp>.json.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Cấu hình / đối số dòng lệnh
// ---------------------------------------------------------------------------

interface Options {
	baseUrl: string;
	cookie: string;
	site: string;
	limit: number;
	status: string | null;
	model: string | null;
	prompt: string;
	dryRun: boolean;
	apply: boolean;
	maxFiles: number;
	maxTotalMb: number;
	outPath: string | null;
	timeoutMs: number;
}

function parseArgs(argv: string[]): Options {
	const flags = new Map<string, string | boolean>();
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (!arg.startsWith("--")) continue;
		const key = arg.slice(2);
		const next = argv[i + 1];
		if (next === undefined || next.startsWith("--")) {
			flags.set(key, true);
		} else {
			flags.set(key, next);
			i += 1;
		}
	}

	const str = (key: string, fallback: string): string => {
		const v = flags.get(key);
		return typeof v === "string" ? v : fallback;
	};
	const num = (key: string, fallback: number): number => {
		const v = flags.get(key);
		const n = typeof v === "string" ? Number(v) : NaN;
		return Number.isFinite(n) ? n : fallback;
	};
	const bool = (key: string): boolean => flags.get(key) === true;

	const site = str("site", process.env.CDS_AI_SITE || "SGN").toUpperCase();

	return {
		baseUrl: str(
			"base-url",
			process.env.CDS_AI_BASE_URL || "http://localhost:3000",
		).replace(/\/+$/, ""),
		cookie: str("cookie", process.env.CDS_AI_AUTH_COOKIE || ""),
		site,
		limit: Math.max(1, Math.floor(num("limit", 10))),
		// Không lọc trạng thái mặc định: "10 job mới nhất" đúng nghĩa đen.
		// Truyền --status active|finished|done để giới hạn nếu cần.
		status: (flags.get("status") as string) || null,
		model: (flags.get("model") as string) || process.env.CDS_AI_MODEL || null,
		prompt: str(
			"prompt",
			"Hãy OCR toàn bộ chứng từ đã nạp và trích xuất dữ liệu cần điền vào CDS.",
		),
		dryRun: bool("dry-run"),
		// Ghi vào cds-info là mặc định; --no-apply để tắt.
		apply: !bool("no-apply"),
		maxFiles: Math.max(1, Math.floor(num("max-files", 12))),
		maxTotalMb: Math.max(1, num("max-total-mb", 40)),
		outPath: (flags.get("out") as string) || null,
		timeoutMs: Math.max(10_000, Math.floor(num("timeout-ms", 180_000))),
	};
}

// ---------------------------------------------------------------------------
// Kiểu dữ liệu HTTP
// ---------------------------------------------------------------------------

interface FollowUpRow {
	id: string;
	jobNumber: string | null;
	domain: string | null;
	driveUrl: string | null;
	operationType: "NHAP" | "XUAT" | null;
	createdAt: string | null;
}

interface DriveFile {
	id: string;
	name: string;
	mimeType: string;
	size?: string | number | null;
}

interface JobReport {
	followUpId: string;
	jobNumber: string | null;
	domain: string | null;
	createdAt: string | null;
	operationType: "NHAP" | "XUAT" | null;
	driveUrl: string | null;
	folderId: string | null;
	selectedFiles: Array<{ id: string; name: string; mimeType: string }>;
	skippedFiles: Array<{ name: string; reason: string }>;
	status:
		| "ok"
		| "applied"
		| "ai-only"
		| "dry-run"
		| "skipped"
		| "error";
	message?: string;
	warnings?: string[];
	cdsInfoFieldCount?: number;
	cargoItemCount?: number;
	appliedToDb?: boolean;
}

// ---------------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------------

const log = (...args: unknown[]) => console.log(...args);
const warn = (...args: unknown[]) => console.warn(...args);

function extractFolderIdFromDriveUrl(driveUrl: string | null): string | null {
	if (!driveUrl) return null;
	// Hỗ trợ cả .../folders/<id> lẫn ...?id=<id>
	const match = driveUrl.match(/(?:\/folders\/|[?&]id=)([a-zA-Z0-9_-]+)/);
	return match ? match[1] : null;
}

// Định dạng chứng từ nguồn hợp lệ để OCR (đồng bộ với inferDocumentMimeType phía route).
const SOURCE_EXTENSIONS = new Set([
	"pdf",
	"png",
	"jpg",
	"jpeg",
	"webp",
	"gif",
	"tif",
	"tiff",
	"bmp",
	"heic",
	"xls",
	"xlsx",
	"xlsm",
	"csv",
	"doc",
	"docx",
	"txt",
	"zip",
	"rar",
	"7z",
]);

function isSourceDocument(file: DriveFile): boolean {
	const mime = (file.mimeType || "").toLowerCase();
	if (mime.startsWith("application/vnd.google-apps")) return false; // thư mục / Google Docs native
	if (mime.startsWith("image/")) return true;
	if (mime === "application/pdf") return true;
	const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
	return SOURCE_EXTENSIONS.has(ext);
}

function fileSizeMb(file: DriveFile): number {
	const n = Number(file.size ?? 0);
	return Number.isFinite(n) ? n / (1024 * 1024) : 0;
}

async function httpJson<T>(
	opts: Options,
	url: string,
	init?: RequestInit,
): Promise<{ ok: boolean; status: number; body: T | null; raw: string }> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
	try {
		const res = await fetch(url, {
			...init,
			headers: {
				cookie: opts.cookie,
				...(init?.headers ?? {}),
			},
			signal: controller.signal,
		});
		const raw = await res.text();
		let body: T | null = null;
		try {
			body = raw ? (JSON.parse(raw) as T) : null;
		} catch {
			body = null;
		}
		return { ok: res.ok, status: res.status, body, raw };
	} finally {
		clearTimeout(timer);
	}
}

// ---------------------------------------------------------------------------
// Các bước
// ---------------------------------------------------------------------------

async function fetchLatestJobs(opts: Options): Promise<FollowUpRow[]> {
	// Lấy dư một chút rồi lọc theo domain phía client để chắc chắn đúng site.
	const pageSize = Math.min(100_000, Math.max(opts.limit * 4, 40));
	const statusParam = opts.status ? `&status=${encodeURIComponent(opts.status)}` : "";
	const url = `${opts.baseUrl}/api/followup?page=1&pageSize=${pageSize}&search=${encodeURIComponent(
		opts.site,
	)}${statusParam}`;
	const { ok, status, body, raw } = await httpJson<{ data: FollowUpRow[] }>(
		opts,
		url,
	);
	if (!ok || !body?.data) {
		throw new Error(
			`Không lấy được danh sách job (HTTP ${status}). Kiểm tra CDS_AI_BASE_URL và cookie. Phản hồi: ${raw.slice(
				0,
				300,
			)}`,
		);
	}
	const rows = body.data
		.filter((r) => (r.domain ?? "").toUpperCase() === opts.site)
		.sort((a, b) => {
			const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
			const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
			return tb - ta;
		})
		.slice(0, opts.limit);
	return rows;
}

async function listSourceFiles(
	opts: Options,
	folderId: string,
): Promise<{ selected: DriveFile[]; skipped: Array<{ name: string; reason: string }> }> {
	const url = `${opts.baseUrl}/api/google-drive/files?folderId=${encodeURIComponent(
		folderId,
	)}`;
	const { ok, status, body } = await httpJson<{ files: DriveFile[] }>(opts, url);
	if (!ok || !body?.files) {
		throw new Error(`Không liệt kê được file Drive (HTTP ${status}).`);
	}
	const skipped: Array<{ name: string; reason: string }> = [];
	const source: DriveFile[] = [];
	for (const f of body.files) {
		if (!isSourceDocument(f)) {
			skipped.push({ name: f.name, reason: `mimeType không phải chứng từ nguồn (${f.mimeType})` });
			continue;
		}
		source.push(f);
	}
	// Giới hạn số file + tổng dung lượng.
	const selected: DriveFile[] = [];
	let totalMb = 0;
	for (const f of source) {
		if (selected.length >= opts.maxFiles) {
			skipped.push({ name: f.name, reason: `vượt max-files (${opts.maxFiles})` });
			continue;
		}
		const mb = fileSizeMb(f);
		if (totalMb + mb > opts.maxTotalMb) {
			skipped.push({ name: f.name, reason: `vượt max-total-mb (${opts.maxTotalMb})` });
			continue;
		}
		selected.push(f);
		totalMb += mb;
	}
	return { selected, skipped };
}

async function runCdsAi(
	opts: Options,
	job: FollowUpRow,
	files: DriveFile[],
): Promise<{ cdsInfo: Record<string, unknown>; cargoList: unknown[]; warnings: string[] }> {
	const form = new FormData();
	form.append("prompt", opts.prompt);
	form.append("operationType", job.operationType ?? "");
	form.append("jobNumber", job.jobNumber ?? "");
	if (opts.model) form.append("model", opts.model);
	for (const f of files) {
		form.append("driveFileIds", f.id);
		form.append("driveFileNames", f.name);
	}

	const url = `${opts.baseUrl}/api/followup/${job.id}/cds-ai-document`;
	const { ok, status, body, raw } = await httpJson<{
		success?: boolean;
		data?: { cdsInfo?: Record<string, unknown>; cargoList?: unknown[]; warnings?: string[] };
		error?: string;
	}>(opts, url, { method: "POST", body: form });

	if (!ok || !body?.data?.cdsInfo) {
		throw new Error(
			`CDS AI thất bại (HTTP ${status}): ${body?.error ?? raw.slice(0, 300)}`,
		);
	}
	return {
		cdsInfo: body.data.cdsInfo ?? {},
		cargoList: body.data.cargoList ?? [],
		warnings: body.data.warnings ?? [],
	};
}

async function applyCdsInfo(
	opts: Options,
	jobId: string,
	cdsInfo: Record<string, unknown>,
): Promise<void> {
	const url = `${opts.baseUrl}/api/followup/${jobId}/cds-info`;
	const { ok, status, body, raw } = await httpJson<{ error?: string }>(opts, url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ data: cdsInfo }),
	});
	if (!ok) {
		throw new Error(
			`Ghi cds-info thất bại (HTTP ${status}): ${body?.error ?? raw.slice(0, 300)}`,
		);
	}
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	const opts = parseArgs(process.argv.slice(2));

	if (!opts.cookie) {
		warn(
			"✗ Thiếu session cookie. Đặt CDS_AI_AUTH_COOKIE (hoặc --cookie). Lấy cookie từ DevTools của phiên đăng nhập SUPERADMIN.",
		);
		process.exitCode = 1;
		return;
	}

	log("─".repeat(72));
	log(`CDS AI batch runner`);
	log(`  base-url : ${opts.baseUrl}`);
	log(`  site     : ${opts.site}  (SGN = Hồ Chí Minh)`);
	log(`  limit    : ${opts.limit} job mới nhất`);
	log(`  model    : ${opts.model ?? "(mặc định của app)"}`);
	log(`  mode     : ${opts.dryRun ? "DRY-RUN (không gọi AI/ghi DB)" : opts.apply ? "AI + ghi cds-info" : "AI (không ghi DB)"}`);
	log("─".repeat(72));

	let jobs: FollowUpRow[];
	try {
		jobs = await fetchLatestJobs(opts);
	} catch (err) {
		warn(`✗ ${(err as Error).message}`);
		process.exitCode = 1;
		return;
	}

	if (jobs.length === 0) {
		warn(`Không tìm thấy job nào cho site ${opts.site}.`);
		return;
	}
	log(`Tìm thấy ${jobs.length} job ${opts.site} mới nhất.\n`);

	const reports: JobReport[] = [];

	for (const [i, job] of jobs.entries()) {
		const tag = `[${i + 1}/${jobs.length}] job=${job.jobNumber ?? job.id}`;
		const report: JobReport = {
			followUpId: job.id,
			jobNumber: job.jobNumber,
			domain: job.domain,
			createdAt: job.createdAt,
			operationType: job.operationType,
			driveUrl: job.driveUrl,
			folderId: null,
			selectedFiles: [],
			skippedFiles: [],
			status: "skipped",
		};

		const folderId = extractFolderIdFromDriveUrl(job.driveUrl);
		report.folderId = folderId;
		if (!folderId) {
			report.status = "skipped";
			report.message = "Job không có driveUrl/folderId hợp lệ.";
			warn(`${tag} → BỎ QUA: ${report.message}`);
			reports.push(report);
			continue;
		}

		try {
			const { selected, skipped } = await listSourceFiles(opts, folderId);
			report.selectedFiles = selected.map((f) => ({
				id: f.id,
				name: f.name,
				mimeType: f.mimeType,
			}));
			report.skippedFiles = skipped;

			if (selected.length === 0) {
				report.status = "skipped";
				report.message = "Không có chứng từ nguồn nào trong thư mục Drive.";
				warn(`${tag} → BỎ QUA: ${report.message}`);
				reports.push(report);
				continue;
			}

			log(`${tag} → ${selected.length} chứng từ nguồn: ${selected.map((f) => f.name).join(", ")}`);

			if (opts.dryRun) {
				report.status = "dry-run";
				reports.push(report);
				continue;
			}

			const ai = await runCdsAi(opts, job, selected);
			report.cdsInfoFieldCount = Object.keys(ai.cdsInfo).length;
			report.cargoItemCount = Array.isArray(ai.cargoList) ? ai.cargoList.length : 0;
			report.warnings = ai.warnings;
			log(
				`${tag} → AI xong: ${report.cdsInfoFieldCount} trường cdsInfo, ${report.cargoItemCount} dòng hàng` +
					(ai.warnings.length ? `, ${ai.warnings.length} cảnh báo` : ""),
			);

			if (opts.apply) {
				await applyCdsInfo(opts, job.id, ai.cdsInfo);
				report.appliedToDb = true;
				report.status = "applied";
				log(`${tag} → ✓ đã ghi cds-info vào DB`);
			} else {
				report.appliedToDb = false;
				report.status = "ai-only";
			}
		} catch (err) {
			report.status = "error";
			report.message = (err as Error).message;
			warn(`${tag} → LỖI: ${report.message}`);
		}
		reports.push(report);
	}

	// Ghi báo cáo
	const outDir = path.join(root, "scripts", "out");
	fs.mkdirSync(outDir, { recursive: true });
	// timestamp lấy từ job mới nhất để tránh phụ thuộc Date.now() trong log; dùng ISO an toàn.
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	const outPath = opts.outPath
		? path.resolve(opts.outPath)
		: path.join(outDir, `cds-ai-batch-${stamp}.json`);
	fs.writeFileSync(
		outPath,
		JSON.stringify(
			{
				generatedAt: stamp,
				options: { ...opts, cookie: "<redacted>" },
				summary: {
					total: reports.length,
					applied: reports.filter((r) => r.status === "applied").length,
					aiOnly: reports.filter((r) => r.status === "ai-only").length,
					dryRun: reports.filter((r) => r.status === "dry-run").length,
					skipped: reports.filter((r) => r.status === "skipped").length,
					error: reports.filter((r) => r.status === "error").length,
				},
				jobs: reports,
			},
			null,
			2,
		),
		"utf8",
	);

	log("\n" + "─".repeat(72));
	log("Kết quả:");
	log(`  applied : ${reports.filter((r) => r.status === "applied").length}`);
	log(`  ai-only : ${reports.filter((r) => r.status === "ai-only").length}`);
	log(`  dry-run : ${reports.filter((r) => r.status === "dry-run").length}`);
	log(`  skipped : ${reports.filter((r) => r.status === "skipped").length}`);
	log(`  error   : ${reports.filter((r) => r.status === "error").length}`);
	log(`Báo cáo: ${outPath}`);
	log("─".repeat(72));

	if (reports.some((r) => r.status === "error")) {
		process.exitCode = 1;
	}
}

main().catch((err) => {
	warn(err);
	process.exitCode = 1;
});
