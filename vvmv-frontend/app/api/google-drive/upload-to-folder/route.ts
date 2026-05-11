import { Readable } from "node:stream";
import type { drive_v3 } from "googleapis";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDriveClient } from "@/lib/google-sheets/client";

const DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

function escapeDriveQueryValue(value: string) {
	return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function normalizeDriveFileName(fileName: string) {
	return fileName.trim().normalize("NFC").toLowerCase();
}

function getCanonicalDriveFileName(fileName: string) {
	const normalizedName = fileName.trim().normalize("NFC");
	return normalizedName.replace(/ \(\d+\)(?=(\.[^./\\]+)?$)/, "");
}

function getDriveFileNameCandidates(fileName: string) {
	return Array.from(
		new Set([fileName.trim(), getCanonicalDriveFileName(fileName)]),
	).filter((name) => name.length > 0);
}

function getFileSignature(fileName: string, fileSize: number) {
	return `${normalizeDriveFileName(getCanonicalDriveFileName(fileName))}:${fileSize}`;
}

function getErrorMessage(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback;
}

async function findReusableDriveFile({
	drive,
	folderId,
	fileName,
	fileSize,
}: {
	drive: drive_v3.Drive;
	folderId: string;
	fileName: string;
	fileSize: number;
}): Promise<{ id: string; name: string } | null> {
	const folderQuery = `'${escapeDriveQueryValue(folderId)}' in parents`;
	const nameCandidates = getDriveFileNameCandidates(fileName);

	for (const candidateName of nameCandidates) {
		const response = await drive.files.list({
			q: [
				folderQuery,
				`name='${escapeDriveQueryValue(candidateName)}'`,
				"trashed=false",
				`mimeType!='${DRIVE_FOLDER_MIME_TYPE}'`,
			].join(" and "),
			fields: "files(id, name, size)",
			includeItemsFromAllDrives: true,
			supportsAllDrives: true,
			pageSize: 10,
		});

		const reusableFile = (response.data.files || []).find(
			(file) => file.id && file.name && file.size === String(fileSize),
		);

		if (reusableFile?.id && reusableFile.name) {
			return { id: reusableFile.id, name: reusableFile.name };
		}
	}

	return null;
}

/**
 * POST /api/google-drive/upload-to-folder
 * Upload multiple files (multipart/form-data) to a specific Drive folder.
 *
 * FormData fields:
 *   folderId: string         - Drive folder ID to upload into
 *   files: File[]            - image files to upload
 *
 * Returns: { fileIds: string[], fileNames: string[], uploadedCount: number, reusedCount: number }
 */
export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const formData = await request.formData();
		const folderId = formData.get("folderId") as string | null;

		if (!folderId) {
			return NextResponse.json({ message: "Thiếu folderId" }, { status: 400 });
		}

		const files = formData.getAll("files") as File[];
		if (files.length === 0) {
			return NextResponse.json(
				{ message: "Không có file nào" },
				{ status: 400 },
			);
		}

		const drive = getDriveClient();
		const fileIds: string[] = [];
		const fileNames: string[] = [];
		const uploadedFileIds: string[] = [];
		const reusedFileIds: string[] = [];
		const processedFiles = new Map<string, { id: string; name: string }>();

		const appendFileResult = (fileId: string, fileName: string) => {
			if (fileIds.includes(fileId)) {
				return;
			}

			fileIds.push(fileId);
			fileNames.push(fileName);
		};

		for (const file of files) {
			const fileSignature = getFileSignature(file.name, file.size);
			const alreadyProcessed = processedFiles.get(fileSignature);

			if (alreadyProcessed) {
				appendFileResult(alreadyProcessed.id, alreadyProcessed.name);
				continue;
			}

			const reusableFile = await findReusableDriveFile({
				drive,
				folderId,
				fileName: file.name,
				fileSize: file.size,
			});

			if (reusableFile) {
				processedFiles.set(fileSignature, reusableFile);
				appendFileResult(reusableFile.id, reusableFile.name);
				reusedFileIds.push(reusableFile.id);
				continue;
			}

			const buffer = Buffer.from(await file.arrayBuffer());
			const stream = Readable.from(buffer);

			const res = await drive.files.create({
				requestBody: {
					name: file.name,
					parents: [folderId],
				},
				media: {
					mimeType: file.type || "application/octet-stream",
					body: stream,
				},
				fields: "id, name",
				supportsAllDrives: true,
			});

			if (res.data.id) {
				const uploadedName = res.data.name || file.name;
				processedFiles.set(fileSignature, {
					id: res.data.id,
					name: uploadedName,
				});
				appendFileResult(res.data.id, uploadedName);
				uploadedFileIds.push(res.data.id);
			}
		}

		return NextResponse.json({
			fileIds,
			fileNames,
			uploadedFileIds,
			reusedFileIds,
			uploadedCount: uploadedFileIds.length,
			reusedCount: reusedFileIds.length,
		});
	} catch (error) {
		console.error("Error uploading files to Drive folder:", error);
		return NextResponse.json(
			{ message: getErrorMessage(error, "Lỗi upload file lên Drive") },
			{ status: 500 },
		);
	}
}
