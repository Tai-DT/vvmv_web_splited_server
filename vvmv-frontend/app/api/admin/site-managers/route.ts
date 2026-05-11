import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import type { Site } from "@/prisma/client";

// GET /api/admin/site-managers - Get all site managers
export async function GET(_req: NextRequest) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	const isAdmin = session?.user?.role === "ADMIN";
	const isSuperAdmin = session?.user?.role === "SUPERADMIN";
	if (!session?.user || (!isAdmin && !isSuperAdmin)) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	try {
		// Get all users with MANAGER role and their assigned sites
		const managers = await prismaRPA.user.findMany({
			where: {
				role: "MANAGER",
				site: {
					not: null,
				},
			},
			select: {
				id: true,
				site: true,
			},
		});

		const siteManagers = managers.map((m) => ({
			site: m.site as "SGN" | "HAN" | "DAD",
			managerId: m.id,
		}));

		return NextResponse.json({ siteManagers });
	} catch (error) {
		console.error("Failed to fetch site managers:", error);
		return NextResponse.json(
			{ message: "Failed to fetch site managers" },
			{ status: 500 },
		);
	}
}

// POST /api/admin/site-managers - Assign a site manager
export async function POST(req: NextRequest) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	const isAdmin = session?.user?.role === "ADMIN";
	const isSuperAdmin = session?.user?.role === "SUPERADMIN";
	if (!session?.user || (!isAdmin && !isSuperAdmin)) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await req.json();
		const { site, managerId } = body;

		if (!site || !managerId) {
			return NextResponse.json(
				{ message: "Missing required fields: site and managerId are required" },
				{ status: 400 },
			);
		}

		// Validate site
		if (!["SGN", "HAN", "DAD"].includes(site)) {
			return NextResponse.json(
				{ message: "Invalid site. Must be SGN, HAN, or DAD" },
				{ status: 400 },
			);
		}

		// Check if user exists
		const user = await prismaRPA.user.findUnique({
			where: { id: managerId },
		});

		if (!user) {
			return NextResponse.json({ message: "User not found" }, { status: 404 });
		}

		// Assign manager (allow multiple managers per site)
		const updatedUser = await prismaRPA.user.update({
			where: { id: managerId },
			data: {
				role: "MANAGER",
				site: site as Site,
			},
		});

		return NextResponse.json({
			message: "Site manager assigned successfully",
			siteManager: {
				site,
				managerId: updatedUser.id,
			},
		});
	} catch (error) {
		console.error("Failed to assign site manager:", error);
		return NextResponse.json(
			{
				message:
					error instanceof Error
						? error.message
						: "Failed to assign site manager",
			},
			{ status: 500 },
		);
	}
}

// DELETE /api/admin/site-managers?managerId=xxx - Remove a site manager
export async function DELETE(req: NextRequest) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	const isAdmin = session?.user?.role === "ADMIN";
	const isSuperAdmin = session?.user?.role === "SUPERADMIN";
	if (!session?.user || (!isAdmin && !isSuperAdmin)) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	try {
		const { searchParams } = new URL(req.url);
		const managerId = searchParams.get("managerId");

		if (!managerId) {
			return NextResponse.json(
				{ message: "Manager ID parameter is required" },
				{ status: 400 },
			);
		}

		// Remove site assignment from this specific manager
		await prismaRPA.user.update({
			where: { id: managerId },
			data: {
				site: null,
			},
		});

		return NextResponse.json({ message: "Site manager removed successfully" });
	} catch (error) {
		console.error("Failed to remove site manager:", error);
		return NextResponse.json(
			{ message: "Failed to remove site manager" },
			{ status: 500 },
		);
	}
}
