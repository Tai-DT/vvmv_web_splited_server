import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFileContent } from "@/lib/google-drive/upload";

export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const fileId = searchParams.get("fileId");

		if (!fileId) {
			return NextResponse.json({ message: "Missing fileId" }, { status: 400 });
		}

		const { buffer, mimeType } = await getFileContent(fileId);

		// Return the file content as base64 or just binary
		// Since we need to send it to Gemini, let's wrap it in a JSON with base64
		const base64 = buffer.toString("base64");

		return NextResponse.json({ data: base64, mimeType }, { status: 200 });
	} catch (error: any) {
		console.error("Error downloading Drive file:", error);
		return NextResponse.json({ message: error.message }, { status: 500 });
	}
}
