import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { tryDelegateToStandaloneApi } from "@/lib/proxy-backend";
import type { Site } from "@/prisma/client";

export async function GET(request: NextRequest) {
	const delegated = await tryDelegateToStandaloneApi(request, "vendors");
	if (delegated) return delegated;

	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const user = await prismaRPA.user.findUnique({
			where: { id: session.user.id },
			select: { site: true, role: true },
		});

		if (!user?.site && user?.role !== "SUPERADMIN") {
			return NextResponse.json(
				{ message: "User site not configured" },
				{ status: 400 },
			);
		}

		const isSuperAdmin = user.role === "SUPERADMIN";

		// Fetch from DB
		const dbVendors = await prismaRPA.vendor.findMany({
			where: isSuperAdmin ? {} : { site: user.site as Site },
			orderBy: { name: "asc" },
			select: { name: true },
		});

		const vendors = dbVendors.map((v) => v.name);

		return NextResponse.json({ vendors });
	} catch (error) {
		console.error("Error fetching vendors:", error);
		return NextResponse.json(
			{ error: "Failed to fetch vendors" },
			{ status: 500 },
		);
	}
}
