import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listFiles } from "@/lib/google-drive/upload";
import { getDriveClient } from "@/lib/google-sheets/client";

function getErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : "Error listing Drive files";
}

export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const folderId = searchParams.get("folderId");
		const includeFolders = searchParams.get("includeFolders") === "true";

		if (!folderId) {
			return NextResponse.json(
				{ message: "Missing folderId" },
				{ status: 400 },
			);
		}

		if (!includeFolders) {
			// Original behavior: files only
			const files = await listFiles(folderId);
			return NextResponse.json({ files }, { status: 200 });
		}

		// Extended behavior: list both folders and files
		const drive = getDriveClient();

		const [foldersRes, filesRes] = await Promise.all([
			drive.files.list({
				q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
				fields: "files(id, name, mimeType)",
				includeItemsFromAllDrives: true,
				supportsAllDrives: true,
				orderBy: "name",
			}),
			drive.files.list({
				q: `'${folderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
				fields: "files(id, name, mimeType, thumbnailLink, size)",
				includeItemsFromAllDrives: true,
				supportsAllDrives: true,
				orderBy: "name",
			}),
		]);

		const folders = (foldersRes.data.files || []).flatMap((file) => {
			if (!file.id || !file.name || !file.mimeType) {
				return [];
			}

			return [
				{
					id: file.id,
					name: file.name,
					mimeType: file.mimeType,
					isFolder: true,
				},
			];
		});

		const files = (filesRes.data.files || []).flatMap((file) => {
			if (!file.id || !file.name || !file.mimeType) {
				return [];
			}

			return [
				{
					id: file.id,
					name: file.name,
					mimeType: file.mimeType,
					isFolder: false,
					thumbnailLink: file.thumbnailLink || null,
					size: file.size ?? null,
				},
			];
		});

		return NextResponse.json({ folders, files }, { status: 200 });
	} catch (error) {
		console.error("Error listing Drive files:", error);
		return NextResponse.json(
			{ message: getErrorMessage(error) },
			{ status: 500 },
		);
	}
}
