import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { tryDelegateToStandaloneApi } from "@/lib/proxy-backend";
import type { OperationType, Site } from "@/prisma/client";

export async function GET(request: NextRequest) {
	const delegated = await tryDelegateToStandaloneApi(request, "shipping-lines");
	if (delegated) return delegated;

	try {
		const { searchParams } = new URL(request.url);
		const site = searchParams.get("site") as Site | null;
		const operationType = searchParams.get(
			"operationType",
		) as OperationType | null;

		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const userSite = (session.user as any).site as Site | undefined;

		const items = await prismaRPA.shippingLine.findMany({
			where: {
				site: site || userSite || "SGN",
				...(operationType
					? {
							OR: [
								{ operationType },
								{ operationType: null }, // Allow general shipping lines
							],
						}
					: {}),
			},
			orderBy: { name: "asc" },
			select: {
				id: true,
				name: true,
				operationType: true,
			},
		});

		return NextResponse.json({ shippingLines: items });
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
