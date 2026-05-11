import { google } from "googleapis";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDriveClient } from "@/lib/google-sheets/client";

export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const fileId = searchParams.get("fileId");

		if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
			return NextResponse.json(
				{ message: "Missing or invalid fileId" },
				{ status: 400 },
			);
		}

		const drive = getDriveClient();

		// Get file metadata including thumbnailLink
		const fileMeta = await drive.files.get({
			fileId,
			fields: "thumbnailLink,mimeType",
			supportsAllDrives: true,
		});

		const { thumbnailLink, mimeType } = fileMeta.data;

		// If it's an image type, serve scaled version directly via Drive API
		if (mimeType?.startsWith("image/")) {
			const response = await drive.files.get(
				{ fileId, alt: "media", supportsAllDrives: true },
				{ responseType: "arraybuffer" },
			);
			const buffer = Buffer.from(response.data as ArrayBuffer);
			return new NextResponse(buffer, {
				headers: {
					"Content-Type": mimeType,
					"Cache-Control": "private, max-age=3600",
				},
			});
		}

		// For non-image files, proxy the thumbnailLink
		if (thumbnailLink) {
			const driveAuth = new google.auth.GoogleAuth({
				credentials: {
					client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
					private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
				},
				scopes: ["https://www.googleapis.com/auth/drive"],
			});
			const token = await driveAuth.getAccessToken();

			const thumbRes = await fetch(thumbnailLink, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (thumbRes.ok) {
				const arrayBuf = await thumbRes.arrayBuffer();
				return new NextResponse(Buffer.from(arrayBuf), {
					headers: {
						"Content-Type": thumbRes.headers.get("content-type") || "image/png",
						"Cache-Control": "private, max-age=3600",
					},
				});
			}
		}

		// No thumbnail available
		return NextResponse.json(
			{ message: "No thumbnail available" },
			{ status: 404 },
		);
	} catch (error: any) {
		console.error("Error fetching thumbnail:", error);
		return NextResponse.json({ message: error.message }, { status: 500 });
	}
}
