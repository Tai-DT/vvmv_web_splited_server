import { createReadStream, statSync } from "node:fs";
import { open } from "node:fs/promises";
import { Readable } from "node:stream";
import type { drive_v3 } from "googleapis";
import {
	getDriveAccessToken,
	getDriveClient,
} from "@/lib/google-sheets/client";

const MIB = 1024 * 1024;
/** Google recommends multiples of 256 KiB per chunk; we align chunk size to this. */
const CHUNK_ALIGN = 256 * 1024;
const DEFAULT_CHUNK_BYTES = 32 * MIB;
const DEFAULT_PROGRESS_EVERY_MIB = 50;

const DRIVE_RESUMABLE_INIT =
	"https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id";

function parsePositiveIntEnv(
	key: string,
	defaultValue: number,
	min?: number,
): number {
	const raw = process.env[key]?.trim();
	if (!raw) {
		return defaultValue;
	}
	const n = Number(raw);
	if (!Number.isFinite(n)) {
		return defaultValue;
	}
	const v = Math.floor(n);
	if (min !== undefined && v < min) {
		return defaultValue;
	}
	return v;
}

function parseOptionalProgressEveryBytes(): number {
	const mib = process.env.DRIVE_UPLOAD_PROGRESS_EVERY_MB?.trim();
	if (mib === "" || mib === "0") {
		return 0;
	}
	const n = mib ? Number(mib) : DEFAULT_PROGRESS_EVERY_MIB;
	if (!Number.isFinite(n) || n <= 0) {
		return 0;
	}
	return Math.floor(n * MIB);
}

function getConfiguredChunkBytes(): number {
	const fromEnv = parsePositiveIntEnv(
		"DRIVE_UPLOAD_CHUNK_BYTES",
		DEFAULT_CHUNK_BYTES,
		CHUNK_ALIGN,
	);
	const aligned = Math.floor(fromEnv / CHUNK_ALIGN) * CHUNK_ALIGN;
	return Math.max(aligned, CHUNK_ALIGN);
}

/**
 * Upload bytes to a Drive / Shared Drive folder.
 * Share the folder with `GOOGLE_SERVICE_ACCOUNT_EMAIL` (Contributor+).
 */
export async function uploadBufferToDriveFolder(options: {
	parentFolderId: string;
	fileName: string;
	mimeType: string;
	buffer: Buffer;
}): Promise<string> {
	const drive = getDriveClient();
	const stream = Readable.from(options.buffer);
	const fileMetadata: drive_v3.Schema$File = {
		name: options.fileName,
		parents: [options.parentFolderId],
	};
	const response = await drive.files.create({
		requestBody: fileMetadata,
		media: {
			mimeType: options.mimeType,
			body: stream,
		},
		fields: "id",
		supportsAllDrives: true,
	});
	if (!response.data.id) {
		throw new Error(`Drive upload failed: ${options.fileName}`);
	}
	return response.data.id;
}

/** Single-request media upload (streaming). Prefer resumable for large local files. */
export async function uploadFilePathSimpleToDriveFolder(options: {
	parentFolderId: string;
	fileName: string;
	mimeType: string;
	absolutePath: string;
}): Promise<string> {
	const drive = getDriveClient();
	const body = createReadStream(options.absolutePath);
	const fileMetadata: drive_v3.Schema$File = {
		name: options.fileName,
		parents: [options.parentFolderId],
	};
	const response = await drive.files.create({
		requestBody: fileMetadata,
		media: {
			mimeType: options.mimeType,
			body,
		},
		fields: "id",
		supportsAllDrives: true,
	});
	if (!response.data.id) {
		throw new Error(`Drive upload failed: ${options.fileName}`);
	}
	return response.data.id;
}

/**
 * Resumable session upload for large local files (Drive API v3).
 * Chunk size: `DRIVE_UPLOAD_CHUNK_BYTES` (default 32 MiB), rounded to a multiple of 256 KiB.
 * Optional progress: `DRIVE_UPLOAD_PROGRESS_EVERY_MB` (default 50; set `0` to disable).
 */
export async function uploadFilePathResumableToDriveFolder(options: {
	parentFolderId: string;
	fileName: string;
	mimeType: string;
	absolutePath: string;
}): Promise<string> {
	const size = statSync(options.absolutePath).size;
	if (size === 0) {
		return uploadFilePathSimpleToDriveFolder(options);
	}

	const token = await getDriveAccessToken();
	const chunkBytes = getConfiguredChunkBytes();
	const progressEvery = parseOptionalProgressEveryBytes();

	const initRes = await fetch(DRIVE_RESUMABLE_INIT, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json; charset=UTF-8",
			"X-Upload-Content-Type": options.mimeType,
			"X-Upload-Content-Length": String(size),
		},
		body: JSON.stringify({
			name: options.fileName,
			parents: [options.parentFolderId],
		}),
	});

	if (!initRes.ok) {
		const errBody = await initRes.text();
		throw new Error(
			`Drive resumable session failed (${initRes.status}): ${errBody}`,
		);
	}

	const sessionUrl = initRes.headers.get("Location");
	if (!sessionUrl) {
		throw new Error("Drive resumable session missing Location header");
	}

	const fh = await open(options.absolutePath, "r");
	try {
		let offset = 0;
		let lastProgressAt = 0;

		while (offset < size) {
			const chunkLen = Math.min(chunkBytes, size - offset);
			const buf = Buffer.allocUnsafe(chunkLen);
			const { bytesRead } = await fh.read(buf, 0, chunkLen, offset);
			if (bytesRead !== chunkLen) {
				throw new Error(
					`Short read at offset ${offset}: expected ${chunkLen}, got ${bytesRead}`,
				);
			}

			const end = offset + bytesRead - 1;
			const contentRange = `bytes ${offset}-${end}/${size}`;
			const body = buf.subarray(0, bytesRead);

			const putRes = await fetch(sessionUrl, {
				method: "PUT",
				headers: {
					"Content-Length": String(bytesRead),
					"Content-Range": contentRange,
				},
				body,
			});

			if (putRes.status === 308) {
				offset = end + 1;
				if (progressEvery > 0 && offset - lastProgressAt >= progressEvery) {
					const pct = ((offset / size) * 100).toFixed(1);
					console.log(
						`[drive upload] ${options.fileName}: ${offset}/${size} bytes (${pct}%)`,
					);
					lastProgressAt = offset;
				}
				continue;
			}

			if (putRes.status === 200 || putRes.status === 201) {
				const json = (await putRes.json()) as { id?: string };
				if (!json.id) {
					throw new Error("Drive upload completed but response missing id");
				}
				if (progressEvery > 0) {
					console.log(
						`[drive upload] ${options.fileName}: complete (${size} bytes)`,
					);
				}
				return json.id;
			}

			const errText = await putRes.text();
			throw new Error(
				`Drive chunk upload failed (${putRes.status}): ${errText}`,
			);
		}

		throw new Error("Drive resumable upload ended without completion");
	} finally {
		await fh.close();
	}
}

/**
 * Upload a local file to a folder. By default uses resumable upload when the file is non-empty
 * (`resumable !== false`). Empty files use a simple metadata+media create.
 */
export async function uploadFilePathToDriveFolder(options: {
	parentFolderId: string;
	fileName: string;
	mimeType: string;
	absolutePath: string;
	resumable?: boolean;
}): Promise<string> {
	const size = statSync(options.absolutePath).size;
	const useResumable = options.resumable !== false;
	if (useResumable && size > 0) {
		return uploadFilePathResumableToDriveFolder(options);
	}
	return uploadFilePathSimpleToDriveFolder(options);
}
