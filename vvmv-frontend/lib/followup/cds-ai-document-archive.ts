import { execFile } from "node:child_process";
import {
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type CdsAiDocumentInputFile = {
	fileName: string;
	mimeType: string;
	buffer: Buffer;
	sourceType: "upload" | "archive-entry" | "drive";
	archiveName?: string;
	relativePath?: string;
};

function normalizePathForMatch(value: string) {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/\\/g, "/")
		.toUpperCase();
}

function getFileExtension(fileName: string) {
	return path.extname(fileName).toLowerCase();
}

export function inferDocumentMimeType(fileName: string, provided?: string) {
	if (provided) {
		return provided;
	}

	const lowerName = fileName.toLowerCase();
	if (lowerName.endsWith(".pdf")) return "application/pdf";
	if (lowerName.endsWith(".docx")) {
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
	}
	if (lowerName.endsWith(".doc")) return "application/msword";
	if (lowerName.endsWith(".xlsx")) {
		return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
	}
	if (lowerName.endsWith(".xlsm")) {
		return "application/vnd.ms-excel.sheet.macroenabled.12";
	}
	if (lowerName.endsWith(".xls")) return "application/vnd.ms-excel";
	if (lowerName.endsWith(".csv")) return "text/csv";
	if (lowerName.endsWith(".json")) return "application/json";
	if (lowerName.endsWith(".xml")) return "application/xml";
	if (lowerName.endsWith(".html") || lowerName.endsWith(".htm")) {
		return "text/html";
	}
	if (lowerName.endsWith(".txt") || lowerName.endsWith(".log")) {
		return "text/plain";
	}
	if (lowerName.endsWith(".png")) return "image/png";
	if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
		return "image/jpeg";
	}
	if (lowerName.endsWith(".webp")) return "image/webp";
	if (lowerName.endsWith(".gif")) return "image/gif";
	if (lowerName.endsWith(".bmp")) return "image/bmp";
	if (lowerName.endsWith(".tif") || lowerName.endsWith(".tiff")) {
		return "image/tiff";
	}
	if (lowerName.endsWith(".rtf")) return "application/rtf";
	if (lowerName.endsWith(".rar")) return "application/vnd.rar";
	if (lowerName.endsWith(".zip")) return "application/zip";

	return "application/octet-stream";
}

export function isArchiveUpload(fileName: string, mimeType?: string) {
	const lowerMimeType = (mimeType || "").toLowerCase();
	const lowerName = fileName.toLowerCase();

	return (
		lowerMimeType.includes("rar") ||
		lowerMimeType.includes("zip") ||
		lowerMimeType.includes("compressed") ||
		lowerName.endsWith(".rar") ||
		lowerName.endsWith(".zip")
	);
}

export function isSupportedArchiveEntry(fileName: string) {
	const extension = getFileExtension(fileName);
	return new Set([
		".pdf",
		".png",
		".jpg",
		".jpeg",
		".webp",
		".gif",
		".bmp",
		".tif",
		".tiff",
		".docx",
		".doc",
		".xlsx",
		".xlsm",
		".xls",
		".csv",
		".json",
		".xml",
		".html",
		".htm",
		".txt",
		".log",
		".rtf",
	]).has(extension);
}

export function shouldSkipArchiveEntry(filePath: string) {
	const normalizedPath = normalizePathForMatch(filePath);
	const baseName = normalizePathForMatch(path.basename(filePath));

	if (
		normalizedPath.startsWith("__MACOSX/") ||
		baseName === ".DS_STORE" ||
		baseName.startsWith("._")
	) {
		return true;
	}

	if (normalizedPath.includes("/TO KHAI THONG QUAN/")) {
		return true;
	}

	if (
		baseName.startsWith("TOKHAIHQ") ||
		baseName.includes("_QDTQ_") ||
		baseName.startsWith("DSHH") ||
		baseName.startsWith("CSHT") ||
		/^MV[\s_-]?\d{6,}/.test(baseName)
	) {
		return true;
	}

	return false;
}

async function collectFilesRecursively(
	directory: string,
): Promise<Array<{ absolutePath: string; relativePath: string }>> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files: Array<{ absolutePath: string; relativePath: string }> = [];

	for (const entry of entries) {
		const absolutePath = path.join(directory, entry.name);

		if (entry.isDirectory()) {
			const nestedFiles = await collectFilesRecursively(absolutePath);
			nestedFiles.forEach((item) => {
				files.push({
					absolutePath: item.absolutePath,
					relativePath: path
						.join(entry.name, item.relativePath)
						.split(path.sep)
						.join("/"),
				});
			});
			continue;
		}

		if (!entry.isFile()) {
			continue;
		}

		files.push({
			absolutePath,
			relativePath: entry.name,
		});
	}

	return files;
}

export async function extractSupportedDocumentsFromArchive(input: {
	archiveName: string;
	buffer: Buffer;
}): Promise<{
	files: CdsAiDocumentInputFile[];
	warnings: string[];
}> {
	const tempRoot = await mkdtemp(path.join(tmpdir(), "cds-ai-archive-"));
	const archivePath = path.join(tempRoot, input.archiveName);
	const extractDir = path.join(tempRoot, "extracted");

	try {
		await writeFile(archivePath, input.buffer);
		await mkdir(extractDir, { recursive: true });
		await execFileAsync("bsdtar", ["-xf", archivePath, "-C", extractDir]);

		const extractedFiles = await collectFilesRecursively(extractDir);
		const acceptedFiles: CdsAiDocumentInputFile[] = [];
		let skippedGeneratedCount = 0;

		for (const entry of extractedFiles) {
			if (!isSupportedArchiveEntry(entry.relativePath)) {
				continue;
			}

			if (shouldSkipArchiveEntry(entry.relativePath)) {
				skippedGeneratedCount += 1;
				continue;
			}

			const buffer = await readFile(entry.absolutePath);
			acceptedFiles.push({
				fileName: `${path.basename(input.archiveName)} :: ${entry.relativePath}`,
				mimeType: inferDocumentMimeType(entry.relativePath),
				buffer,
				sourceType: "archive-entry",
				archiveName: path.basename(input.archiveName),
				relativePath: entry.relativePath,
			});
		}

		const warnings: string[] = [];
		if (skippedGeneratedCount > 0) {
			warnings.push(
				`Archive ${path.basename(input.archiveName)}: đã bỏ qua ${skippedGeneratedCount} file kết quả hoặc file thông quan.`,
			);
		}

		if (acceptedFiles.length === 0) {
			warnings.push(
				`Archive ${path.basename(input.archiveName)} không có file nguồn hợp lệ để OCR sau khi lọc.`,
			);
		}

		return {
			files: acceptedFiles,
			warnings,
		};
	} finally {
		await rm(tempRoot, { recursive: true, force: true });
	}
}
