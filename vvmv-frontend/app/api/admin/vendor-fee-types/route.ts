import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import type { Site } from "@/prisma/client";

/**
 * GET /api/admin/vendor-fee-types
 * Returns distinct, active VendorFeeType entries with fee_code.
 * Used by partners-management to populate the creditOnlyFeeCodes multiselect.
 */
export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const siteParam = searchParams.get("site") as Site | null;
		const userSite = (session.user as any).site as Site | undefined;
		const isSuperAdmin = session.user.role === "SUPERADMIN";

		const site = siteParam || userSite || "SGN";

		// For non-superadmin, restrict to their site; superadmin can query any site.
		const whereClause: any = {
			isActive: true,
			feeCode: { not: null },
		};

		if (isSuperAdmin && siteParam) {
			whereClause.site = siteParam;
		} else if (!isSuperAdmin) {
			whereClause.site = site;
		}

		const feeTypes = await prismaRPA.vendorFeeType.findMany({
			where: whereClause,
			select: {
				id: true,
				feeCode: true,
				name: true,
				site: true,
				mode: true,
			},
			orderBy: [{ site: "asc" }, { name: "asc" }],
		});

		// Deduplicate by feeCode (keep first occurrence per code)
		const seen = new Set<string>();
		const unique = feeTypes.filter((ft) => {
			if (!ft.feeCode) return false;
			if (seen.has(ft.feeCode)) return false;
			seen.add(ft.feeCode);
			return true;
		});

		return NextResponse.json({ feeTypes: unique });
	} catch (error: any) {
		console.error("GET /api/admin/vendor-fee-types error:", error);
		return NextResponse.json(
			{ error: "Internal Server Error", details: error.message },
			{ status: 500 },
		);
	}
}
