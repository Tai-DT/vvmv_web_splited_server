import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { tryDelegateToStandaloneApi } from "@/lib/proxy-backend";
import type { Site } from "@/prisma/client";

export async function GET(request: NextRequest) {
	const delegated = await tryDelegateToStandaloneApi(
		request,
		"pick-or-lift-place",
	);
	if (delegated) return delegated;

	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const user = await prismaRPA.user.findUnique({
			where: { id: session.user.id },
			select: { site: true, role: true },
		});

		const isSuperAdmin = user?.role === "SUPERADMIN";
		const siteFilter = isSuperAdmin
			? {}
			: { site: (user?.site || "SGN") as Site };

		const places = await prismaRPA.pickOrLiftPlace.findMany({
			where: siteFilter,
			orderBy: { name: "asc" },
			select: { name: true },
		});

		return NextResponse.json({ pickOrLiftPlaces: places.map((p) => p.name) });
	} catch (error) {
		console.error("Error fetching pick-or-lift-places:", error);
		return NextResponse.json(
			{ error: "Failed to fetch pick-or-lift-places" },
			{ status: 500 },
		);
	}
}
