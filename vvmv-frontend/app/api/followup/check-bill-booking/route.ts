import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

/**
 * GET /api/followup/check-bill-booking
 * Checks if a bill_or_booking value already exists in the FollowUp table
 */
export async function GET(request: NextRequest) {
	try {
		// 1. Authenticate user
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		// 2. Get value from query parameters
		const { searchParams } = new URL(request.url);
		const value = searchParams.get("value")?.trim();
		const excludeId = searchParams.get("excludeId");
		const site = searchParams.get("site");

		if (!value) {
			return NextResponse.json(
				{ message: "Missing required field: value" },
				{ status: 400 },
			);
		}

		// 3. Determine site to check against
		// Priority: 1. site param, 2. user's assigned site
		let siteToCheck = site;
		if (!siteToCheck && session.user.site && session.user.site !== "ALL") {
			siteToCheck = session.user.site;
		}

		// 4. Check for existence in database
		// We check records that are NOT deleted
		const existing = await prismaRPA.followUp.findFirst({
			where: {
				billOrBooking: value,
				isDeleted: false,
				...(siteToCheck ? { domain: siteToCheck as any } : {}),
				...(excludeId ? { id: { not: excludeId } } : {}),
			},
			select: {
				id: true,
				jobNumber: true,
			},
		});

		return NextResponse.json({
			exists: !!existing,
			jobNumber: existing?.jobNumber || null,
		});
	} catch (error) {
		console.error("Check bill_or_booking error:", error);
		return NextResponse.json(
			{
				message: "Internal server error",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
