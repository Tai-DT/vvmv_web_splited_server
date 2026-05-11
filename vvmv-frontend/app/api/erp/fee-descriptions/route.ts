import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFeeDescriptions } from "@/lib/erp/fee-descriptions";
import type { Site } from "@/prisma/client";

export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const site = (searchParams.get("site") || "SGN") as Site;

		const descriptions = await getFeeDescriptions(site);

		return NextResponse.json({ descriptions });
	} catch (error) {
		console.error("Failed to fetch fee descriptions from ERP:", error);
		return NextResponse.json(
			{ message: "Failed to fetch fee descriptions" },
			{ status: 500 },
		);
	}
}
