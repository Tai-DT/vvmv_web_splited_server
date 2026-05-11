import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { tryDelegateToStandaloneApi } from "@/lib/proxy-backend";
import type { Site } from "@/prisma/client";

export async function GET(request: NextRequest) {
	const delegated = await tryDelegateToStandaloneApi(request, "ops");
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

		if (!user?.site) {
			return NextResponse.json(
				{ message: "User site not configured" },
				{ status: 400 },
			);
		}

		const whereClause: { site?: Site } = {};

		if (user.role !== "SUPERADMIN") {
			whereClause.site = user.site;
		}

		const opsList = await prismaRPA.ops.findMany({
			where: whereClause,
			orderBy: { name: "asc" },
			select: { name: true },
		});

		return NextResponse.json({ ops: opsList.map((op) => op.name) });
	} catch (error) {
		console.error("Error fetching ops:", error);
		return NextResponse.json({ error: "Failed to fetch ops" }, { status: 500 });
	}
}
