import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryERPHAN, queryERPHCM } from "@/lib/db";

/**
 * Result interface for the SQL query
 */
interface TransactionResult {
	TRANS_COUNT: number;
}

/**
 * Map user site to database site code
 */
function mapSiteToERPCode(userSite: string | null): string {
	if (!userSite) return "HCM";
	const siteMap: Record<string, string> = {
		SGN: "HCM",
		DAD: "HAN", // Da Nang uses HAN database
		HAN: "HAN",
	};
	return siteMap[userSite] || "HCM";
}

/**
 * GET /api/followup/check-transid
 * Checks if a transaction ID exists in the ERP system
 */
export async function GET(request: NextRequest) {
	try {
		// 0. Authenticate user with Better Auth
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		// 1. Get folderName from query parameters (GET requests use URL, not body)
		const url = new URL(request.url);
		const transid = url.searchParams.get("transid");

		// 4. Validate required fields
		if (!transid) {
			return NextResponse.json(
				{ message: "Missing required fields: transid" },
				{ status: 400 },
			);
		}
		const erpSite = mapSiteToERPCode(transid.slice(0, 3));
		// 6. Build SQL query parameters (use ERP account instead of email)
		const sqlParams = {
			TRANSID: transid,
		};

		// 7. Execute SQL query based on site
		let result: TransactionResult | null = null;

		// Read the SQL file content and execute
		const sqlQuery = `
                      SELECT count(*) as TRANS_COUNT
                      FROM TRANSACTIONS
                      WHERE TRANSID = @pTRANSID;
                      `;

		// Execute based on site
		if (erpSite === "HCM") {
			const erpResult = await queryERPHCM<TransactionResult>(sqlQuery, {
				pTRANSID: sqlParams.TRANSID,
			});

			if (erpResult.recordset && erpResult.recordset.length > 0) {
				result = erpResult.recordset[0];
			}
		} else if (erpSite === "HAN") {
			const erpResult = await queryERPHAN<TransactionResult>(sqlQuery, {
				pTRANSID: sqlParams.TRANSID,
			});

			if (erpResult.recordset && erpResult.recordset.length > 0) {
				result = erpResult.recordset[0];
			}
		}

		if (!result) {
			return NextResponse.json(
				{ message: "Failed to check transaction in ERP system" },
				{ status: 500 },
			);
		}

		// 8. Return the generated TransID and other info
		return NextResponse.json(
			{
				success: true,
				transCount: result.TRANS_COUNT,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("Transaction check error:", error);
		return NextResponse.json(
			{
				message: "Internal server error",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
