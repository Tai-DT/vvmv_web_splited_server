import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA, queryERPHAN, queryERPHCM } from "@/lib/db";

/**
 * Result interface for the ERP delivered status query
 */
interface DeliveredResult {
	delivered: number | boolean;
}

/**
 * Map job number prefix to ERP site code
 */
function mapJobNumberToERPSite(jobNumber: string | null): string {
	if (!jobNumber) return "HCM";
	const prefix = jobNumber.slice(0, 3).toUpperCase();
	const siteMap: Record<string, string> = {
		HCM: "HCM",
		SGN: "HCM",
		DAD: "HAN",
		HAN: "HAN",
	};
	return siteMap[prefix] || "HCM";
}

/**
 * POST /api/followup/check-delivered
 * Check if a job is finished (delivered) in the ERP system
 * and update the local isFinished flag
 */
export async function POST(request: NextRequest) {
	try {
		// 1. Authenticate user
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		// 2. Parse request body
		const body = await request.json();
		const { followUpId, truckingFollowUpId, jobNumber } = body;

		// 3. Validate required fields
		if ((!followUpId && !truckingFollowUpId) || !jobNumber) {
			return NextResponse.json(
				{
					message:
						"Missing required fields: (followUpId or truckingFollowUpId) and jobNumber",
				},
				{ status: 400 },
			);
		}

		// 4. Determine ERP site from job number
		const erpSite = mapJobNumberToERPSite(jobNumber);

		// 5. Query ERP to check delivered status
		const sqlQuery = `
      SELECT ISNULL(delivered, 0) as delivered
      FROM Transactions
      WHERE TransID = @pTransID
    `;

		let isDelivered = false;

		try {
			const queryFn = erpSite === "HCM" ? queryERPHCM : queryERPHAN;
			const erpResult = await queryFn<DeliveredResult>(sqlQuery, {
				pTransID: jobNumber,
			});

			if (erpResult.recordset && erpResult.recordset.length > 0) {
				// Handle both boolean (true/false) and number (1/0) from ERP
				isDelivered = Boolean(erpResult.recordset[0].delivered);
			}
		} catch (erpError) {
			console.error("ERP query error:", erpError);
			return NextResponse.json(
				{
					message: "Failed to query ERP system",
					error: erpError instanceof Error ? erpError.message : "Unknown error",
				},
				{ status: 502 },
			);
		}

		// 6. Update local database with the result
		if (truckingFollowUpId) {
			await prismaRPA.truckingFollowUp.update({
				where: { id: truckingFollowUpId },
				data: { isFinished: isDelivered },
			});
		} else if (followUpId) {
			await prismaRPA.followUp.update({
				where: { id: followUpId },
				data: { isFinished: isDelivered },
			});
		}

		// 7. Return the result
		return NextResponse.json(
			{
				success: true,
				id: truckingFollowUpId || followUpId,
				jobNumber,
				isFinished: isDelivered,
				type: truckingFollowUpId ? "trucking" : "logistics",
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error("Check delivered error:", error);
		return NextResponse.json(
			{
				message: "Internal server error",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
