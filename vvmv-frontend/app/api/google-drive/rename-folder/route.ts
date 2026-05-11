import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDriveClient } from "@/lib/google-sheets/client";

/**
 * POST /api/google-drive/rename-folder
 * Rename a Google Drive folder.
 *
 * Body: { folderId: string, newName: string }
 * Returns: { folderId: string, name: string, url: string }
 */
export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { folderId, newName } = await request.json();

		if (!folderId || !newName) {
			return NextResponse.json(
				{ message: "Thiếu folderId hoặc newName" },
				{ status: 400 },
			);
		}

		const drive = getDriveClient();

		const res = await drive.files.update({
			fileId: folderId,
			requestBody: { name: newName.trim() },
			supportsAllDrives: true,
			fields: "id, name",
		});

		return NextResponse.json({
			folderId: res.data.id,
			name: res.data.name,
			url: `https://drive.google.com/drive/folders/${res.data.id}`,
		});
	} catch (error: any) {
		console.error("Error renaming Drive folder:", error);
		return NextResponse.json(
			{ message: error.message || "Không thể đổi tên folder" },
			{ status: 500 },
		);
	}
}
