// app/api/followup/check-folder/route.ts

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { searchFolderInAllSharedDrives } from "@/lib/google-drive/upload";

/**
 * GET /api/followup/check-folder?folderName={name}
 * Check if a folder exists in Google Drive
 */
export async function GET(request: NextRequest) {
	try {
		// 0. Authenticate user with Better Auth
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const dbUser = await prismaRPA.user.findUnique({
			where: { id: session.user.id },
			select: { site: true, email: true },
		});

		if (!dbUser?.site) {
			return NextResponse.json(
				{ message: "User site not configured" },
				{ status: 400 },
			);
		}
		const transId = dbUser.site;

		// 1. Get folderName and shmtDate from query parameters
		const url = new URL(request.url);
		const folderName = url.searchParams.get("folderName") || "na";
		const shmtDateStr = url.searchParams.get("shmtDate");

		let shmtDate: Date | null = null;
		if (shmtDateStr) {
			const date = new Date(shmtDateStr);
			if (!Number.isNaN(date.getTime())) {
				shmtDate = date;
			}
		}

		if (!folderName || folderName === "na") {
			return NextResponse.json(
				{
					success: false,
					error: "Folder name is required",
				},
				{ status: 400 },
			);
		}

		// 2. Search for the folder
		const searchResult = await searchFolderInAllSharedDrives(
			folderName,
			transId,
			shmtDate,
		);

		// 3. Return response
		return NextResponse.json(
			{
				success: true,
				result: searchResult,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error("Search folder error:", error);

		// Check if it's a customer folder not found error
		if (error instanceof Error && error.message.includes("Customer folder")) {
			return NextResponse.json(
				{
					success: false,
					error: "Customer folder not found",
					message: error instanceof Error ? error.message : "Unknown error",
				},
				{ status: 404 }, // Changed from 405 to 404
			);
		}

		// Generic error
		return NextResponse.json(
			{
				success: false,
				error: "Search failed",
				message: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
