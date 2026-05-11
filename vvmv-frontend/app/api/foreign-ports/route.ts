import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { tryDelegateToStandaloneApi } from "@/lib/proxy-backend";
import type { PortType, Site } from "@/prisma/client";

export async function GET(request: NextRequest) {
	const delegated = await tryDelegateToStandaloneApi(request, "foreign-ports");
	if (delegated) return delegated;

	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const portTypeParam = searchParams.get("portType") as PortType | null;

		const user = await prismaRPA.user.findUnique({
			where: { id: session.user.id },
			select: { site: true, role: true },
		});

		const isSuperAdmin = user?.role === "SUPERADMIN";
		const siteFilter = isSuperAdmin
			? {}
			: { site: (user?.site || "SGN") as Site };

		// Filter by portType: if requesting DESTINATION, return All + DESTINATION; if TRANSIT, return All + TRANSIT
		let portTypeFilter: any = {};
		if (portTypeParam === "DESTINATION") {
			portTypeFilter = {
				OR: [{ portType: "DESTINATION" }, { portType: null }],
			};
		} else if (portTypeParam === "TRANSIT") {
			portTypeFilter = { OR: [{ portType: "TRANSIT" }, { portType: null }] };
		}

		const ports = await prismaRPA.foreignPort.findMany({
			where: { ...siteFilter, ...portTypeFilter },
			orderBy: { name: "asc" },
			select: { id: true, name: true, portType: true },
		});

		return NextResponse.json({ ports });
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
