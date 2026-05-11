import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkDeclarationFolderFiles } from "@/lib/google-drive/check-declaration-files";

/**
 * POST /api/followup/check-declaration-files
 * Check if "TO KHAI THONG QUAN" folder contains Excel/PDF files
 */
export async function POST(request: NextRequest) {
	try {
		// 1. Authenticate user
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		// 2. Parse request body
		const body = await request.json();
		const { driveUrl } = body;

		if (!driveUrl) {
			return NextResponse.json(
				{ message: "Missing required field: driveUrl" },
				{ status: 400 },
			);
		}

		// 3. Check declaration files
		const result = await checkDeclarationFolderFiles(driveUrl);

		return NextResponse.json(result, { status: 200 });
	} catch (error) {
		console.error("Error checking declaration files:", error);
		return NextResponse.json(
			{
				message: "Failed to check declaration files",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
