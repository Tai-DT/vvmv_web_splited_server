import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryERPHAN, queryERPHCM } from "@/lib/db";

/**
 * GET /api/admin/partners-master-data/erp-lookup?taxCode=xxx
 * Lookup partner full name from ERP by taxCode
 * Priority: PartnerName3 > PartnerName2 > PartnerName
 */
export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const taxCode = request.nextUrl.searchParams.get("taxCode")?.trim();
		if (!taxCode) {
			return NextResponse.json(
				{ error: "taxCode is required" },
				{ status: 400 },
			);
		}

		const QUERY = `
      SELECT TOP 1
        LTRIM(RTRIM(Taxcode)) AS Taxcode,
        LTRIM(RTRIM(
          COALESCE(
            NULLIF(LTRIM(RTRIM(PartnerName3)), ''),
            NULLIF(LTRIM(RTRIM(PartnerName2)), ''),
            PartnerName
          )
        )) AS FullName
      FROM Partners
      WHERE LTRIM(RTRIM(Taxcode)) = @taxCode
        AND Taxcode IS NOT NULL AND Taxcode <> ''
    `;

		const [hcmResult, hanResult] = await Promise.all([
			queryERPHCM<{ Taxcode: string; FullName: string }>(QUERY, {
				taxCode,
			}).catch(() => ({ recordset: [] })),
			queryERPHAN<{ Taxcode: string; FullName: string }>(QUERY, {
				taxCode,
			}).catch(() => ({ recordset: [] })),
		]);

		// Prefer HCM result
		const hcmRow = (hcmResult.recordset || [])[0];
		const hanRow = (hanResult.recordset || [])[0];
		const row = hcmRow || hanRow;

		if (!row || !row.FullName) {
			return NextResponse.json({ found: false, fullName: null });
		}

		return NextResponse.json({ found: true, fullName: row.FullName.trim() });
	} catch (error: any) {
		console.error("ERP Lookup Error:", error);
		return NextResponse.json(
			{ error: "Internal Server Error", details: error.message },
			{ status: 500 },
		);
	}
}
