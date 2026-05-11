import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDriveClient } from "@/lib/google-sheets/client";

/**
 * POST /api/google-drive/rename-file
 * Body: { fileId: string; newName: string }
 * Renames a Drive file while preserving its extension.
 * If newName already has an extension, uses as-is; otherwise appends original extension.
 */
export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { fileId, newName } = await request.json();
		if (!fileId || !newName) {
			return NextResponse.json(
				{ message: "Missing fileId or newName" },
				{ status: 400 },
			);
		}

		const drive = getDriveClient();

		// Get current file to preserve extension
		const current = await drive.files.get({
			fileId,
			fields: "name",
			supportsAllDrives: true,
		});
		const currentName = current.data.name || "";
		const ext = path.extname(currentName); // e.g. ".jpg"

		// Build final name: if newName already has an extension, use it; otherwise append
		const finalName = path.extname(newName) ? newName : `${newName}${ext}`;

		await drive.files.update({
			fileId,
			supportsAllDrives: true,
			requestBody: { name: finalName },
		});

		return NextResponse.json({ success: true, name: finalName });
	} catch (error: any) {
		console.error("Rename file error:", error);
		return NextResponse.json({ message: error.message }, { status: 500 });
	}
}
