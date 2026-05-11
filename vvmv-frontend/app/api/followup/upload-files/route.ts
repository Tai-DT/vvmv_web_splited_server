import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadFilesToDrive } from "@/lib/google-drive/upload";

/**
 * POST /api/followup/upload-files
 * Upload files to Google Drive with organized folder structure
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

		// 2. Parse multipart form data
		const formData = await request.formData();

		const customerCode = formData.get("customerCode") as string;
		const operationType = formData.get("operationType") as string;
		const transID = formData.get("transID") as string;
		const shmtDateStr = formData.get("shmtDate") as string | null;

		let shmtDate: Date | null = null;
		if (shmtDateStr) {
			const date = new Date(shmtDateStr);
			if (!Number.isNaN(date.getTime())) {
				shmtDate = date;
			}
		}

		// 3. Validate required fields
		if (!customerCode || !operationType || !transID) {
			return NextResponse.json(
				{
					message:
						"Missing required fields: customerCode, operationType, transID",
				},
				{ status: 400 },
			);
		}

		// 4. Extract files from form data
		const files: Array<{ buffer: Buffer; filename: string; mimetype: string }> =
			[];

		for (const [key, value] of formData.entries()) {
			if (key.startsWith("file") && value instanceof File) {
				const arrayBuffer = await value.arrayBuffer();
				const buffer = Buffer.from(arrayBuffer);

				files.push({
					buffer,
					filename: value.name,
					mimetype: value.type || "application/octet-stream",
				});
			}
		}

		// 5. Validate at least one file
		// if (files.length === 0) {
		// 	return NextResponse.json(
		// 		{ message: "No files provided for upload" },
		// 		{ status: 400 }
		// 	);
		// }

		// 6. Upload files to Drive
		const result = await uploadFilesToDrive(
			files,
			customerCode,
			operationType,
			transID,
			shmtDate,
		);

		// 7. Return success response
		return NextResponse.json(
			{
				success: true,
				driveUrl: result.driveUrl,
				localPath: result.localPath,
				fileCount: result.fileCount,
				folderPath: result.folderPath,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("File upload error:", error);

		// Check if it's a customer folder not found error
		if (error instanceof Error && error.message.includes("Customer folder")) {
			return NextResponse.json(
				{
					success: false,
					error: "Customer folder not found",
					message: error.message,
				},
				{ status: 404 },
			);
		}

		// Generic error
		return NextResponse.json(
			{
				success: false,
				error: "Upload failed",
				message: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
