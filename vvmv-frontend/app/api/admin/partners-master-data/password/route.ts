import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

type Site = "SGN" | "HAN" | "DAD";

// GET password for a specific partner (admin/manager only)
export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const userRole = session.user.role;
		const isAdmin = userRole === "ADMIN";
		const isSuperAdmin = userRole === "SUPERADMIN";
		const isManager = userRole === "MANAGER";

		// Only admin, superadmin, or manager can access password
		if (!isAdmin && !isSuperAdmin && !isManager) {
			return NextResponse.json(
				{ error: "You don't have permission to view passwords" },
				{ status: 403 },
			);
		}

		const { searchParams } = new URL(request.url);
		const id = searchParams.get("id");

		if (!id) {
			return NextResponse.json(
				{ error: "Partner ID is required" },
				{ status: 400 },
			);
		}

		const userSite = (session.user as any).site as Site | undefined;

		// Get the partner record
		const partner = await prismaRPA.partnersMasterData.findUnique({
			where: { id },
			select: {
				id: true,
				site: true,
				ddInfo: true,
			},
		});

		if (!partner) {
			return NextResponse.json({ error: "Partner not found" }, { status: 404 });
		}

		// Site permission check (non-superadmin can only access their site)
		if (!isSuperAdmin && partner.site !== userSite) {
			return NextResponse.json(
				{ error: "You can only view passwords for partners in your site" },
				{ status: 403 },
			);
		}

		// Extract password from ddInfo
		if (!partner.ddInfo) {
			return NextResponse.json({ password: "" });
		}

		const passwordMatch = partner.ddInfo.match(/Password=([^;]*)/i);
		const password = passwordMatch ? passwordMatch[1] : "";

		return NextResponse.json({ password });
	} catch (error: any) {
		console.error("API GET Password Error:", error);
		return NextResponse.json(
			{
				error: "Internal Server Error",
				message: error.message,
			},
			{ status: 500 },
		);
	}
}
