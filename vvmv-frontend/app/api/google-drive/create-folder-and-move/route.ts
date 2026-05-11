import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDriveClient } from "@/lib/google-sheets/client";

/**
 * POST /api/google-drive/create-folder-and-move
 * Create a subfolder with `folderName` inside `parentFolderId` (extracted from parentFolderUrl),
 * then move the given `fileIds` into the new folder.
 *
 * Body:
 *   parentFolderUrl: string   - Google Drive URL of the parent folder (e.g. from driveUrl)
 *   folderName: string        - Name of the new subfolder (e.g. Container No)
 *   fileIds: string[]         - Drive file IDs to move into the new folder
 *
 * Returns:
 *   { newFolderUrl: string, newFolderId: string }
 */
export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { parentFolderUrl, folderName, fileIds } = body;

		if (!parentFolderUrl || !folderName) {
			return NextResponse.json(
				{
					message: "Thiếu thông tin: parentFolderUrl và folderName là bắt buộc",
				},
				{ status: 400 },
			);
		}

		// Extract folder ID from drive URL
		const match = parentFolderUrl.match(/folders\/([a-zA-Z0-9_-]+)/);
		if (!match) {
			return NextResponse.json(
				{ message: "Không thể xác định folder ID từ URL Drive" },
				{ status: 400 },
			);
		}
		const parentFolderId = match[1];

		const drive = getDriveClient();

		// Step 1: Check if subfolder already exists
		const searchResponse = await drive.files.list({
			q: `name='${folderName.replace(/'/g, "\\'")}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
			fields: "files(id, name)",
			includeItemsFromAllDrives: true,
			supportsAllDrives: true,
		});

		let newFolderId: string;

		if (searchResponse.data.files && searchResponse.data.files.length > 0) {
			// Folder already exists, reuse it
			newFolderId = searchResponse.data.files[0].id!;
		} else {
			// Step 2: Create new subfolder
			const createResponse = await drive.files.create({
				requestBody: {
					name: folderName,
					mimeType: "application/vnd.google-apps.folder",
					parents: [parentFolderId],
				},
				fields: "id",
				supportsAllDrives: true,
			});

			if (!createResponse.data.id) {
				throw new Error(`Không thể tạo folder "${folderName}"`);
			}
			newFolderId = createResponse.data.id;
		}

		// Step 3: Move files to new folder
		const moveResults: { id: string; success: boolean; error?: string }[] = [];

		if (fileIds && Array.isArray(fileIds) && fileIds.length > 0) {
			await Promise.all(
				fileIds.map(async (fileId: string) => {
					try {
						// Get current parent(s) of the file
						const fileInfo = await drive.files.get({
							fileId,
							fields: "parents",
							supportsAllDrives: true,
						});

						const previousParents = fileInfo.data.parents?.join(",") || "";

						// Move file by updating parents
						await drive.files.update({
							fileId,
							addParents: newFolderId,
							removeParents: previousParents,
							supportsAllDrives: true,
							fields: "id, parents",
						});

						moveResults.push({ id: fileId, success: true });
					} catch (err: any) {
						console.error(`Error moving file ${fileId}:`, err);
						moveResults.push({
							id: fileId,
							success: false,
							error: err.message,
						});
					}
				}),
			);
		}

		const newFolderUrl = `https://drive.google.com/drive/folders/${newFolderId}`;

		return NextResponse.json({
			newFolderUrl,
			newFolderId,
			movedFiles: moveResults,
		});
	} catch (error: any) {
		console.error("Error creating folder and moving files:", error);
		return NextResponse.json(
			{
				message:
					error.message || "Đã xảy ra lỗi khi tạo folder và di chuyển file",
			},
			{ status: 500 },
		);
	}
}
