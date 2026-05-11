import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import type { Site } from "@/prisma/client";

// GET /api/admin/departments/by-site?site=SGN
// Returns departments for a specific site (used in team creation/edit dropdowns)
export async function GET(req: NextRequest) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	const isAdmin = session?.user?.role === "ADMIN";
	const isSuperAdmin = session?.user?.role === "SUPERADMIN";
	const isManager = session?.user?.role === "MANAGER";
	const isStaff = session?.user?.role === "STAFF";

	if (!session?.user || (!isAdmin && !isSuperAdmin && !isManager && !isStaff)) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	try {
		const { searchParams } = new URL(req.url);
		const site = searchParams.get("site");

		if (!site) {
			return NextResponse.json(
				{ message: "Site parameter is required" },
				{ status: 400 },
			);
		}

		// Validate site is valid enum value
		if (!["SGN", "DAD", "HAN"].includes(site)) {
			return NextResponse.json(
				{ message: "Invalid site value" },
				{ status: 400 },
			);
		}

		// Managers can only see departments from their site
		if (
			isManager &&
			(session.user as any).site &&
			site !== (session.user as any).site
		) {
			return NextResponse.json(
				{ message: "Managers can only view departments from their own site" },
				{ status: 403 },
			);
		}

		const whereClause: any = { site: site as Site };

		// Managers can only see departments they are specifically assigned to
		if (isManager) {
			whereClause.managers = {
				some: {
					userId: session.user.id,
				},
			};
		}

		const departments = await prismaRPA.department.findMany({
			where: whereClause,
			orderBy: { name: "asc" },
		});

		return NextResponse.json({ departments });
	} catch (error) {
		console.error("Failed to fetch departments by site:", error);
		return NextResponse.json(
			{ message: "Failed to fetch departments" },
			{ status: 500 },
		);
	}
}
