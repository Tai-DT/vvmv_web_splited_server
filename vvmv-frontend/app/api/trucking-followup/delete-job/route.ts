import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA, queryERPHAN, queryERPHCM } from "@/lib/db";

/**
 * Maps job number prefix to ERP site
 */
function mapJobNumberToERPSite(jobNumber: string): string {
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
 * DELETE /api/trucking-followup/delete-job
 *
 * Deletes a trucking job:
 * 1. Deletes from ERP database (transactiondetails + transactions)
 * 2. Soft-deletes from RPA database (isDeleted = true)
 */
export async function POST(request: NextRequest) {
	try {
		// 1. Authenticate
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		// 2. Parse body
		const body = await request.json();
		const { id, jobNumber } = body;

		if (!id || !jobNumber) {
			return NextResponse.json(
				{ message: "Missing required fields: id, jobNumber" },
				{ status: 400 },
			);
		}

		// 3. Delete from ERP database (transactiondetails + transactions)
		const erpSite = mapJobNumberToERPSite(jobNumber);
		const queryFn = erpSite === "HCM" ? queryERPHCM : queryERPHAN;

		const deleteSQL = `
      BEGIN TRANSACTION;

      BEGIN TRY
          -- First delete from transactiondetails
          DELETE FROM transactiondetails 
          WHERE transid = @pTransID;
          
          -- Then delete from transactions
          DELETE FROM transactions 
          WHERE transid = @pTransID;
          
          -- If both deletes successful, commit the transaction
          COMMIT TRANSACTION;
      END TRY
      BEGIN CATCH
          -- If error occurs, rollback all changes
          ROLLBACK TRANSACTION;
          
          THROW;
      END CATCH;
    `;

		try {
			await queryFn(deleteSQL, { pTransID: jobNumber });
		} catch (erpError) {
			console.error("ERP delete error:", erpError);
			return NextResponse.json(
				{
					success: false,
					message: `Failed to delete from ERP: ${erpError instanceof Error ? erpError.message : "Unknown ERP error"}`,
				},
				{ status: 502 },
			);
		}

		// 4. Soft-delete from RPA database
		try {
			await prismaRPA.truckingFollowUp.update({
				where: { id },
				data: { isDeleted: true },
			});
		} catch (rpaError) {
			console.error("RPA soft-delete error:", rpaError);
			return NextResponse.json(
				{
					success: false,
					message: `ERP deleted but failed to update RPA: ${rpaError instanceof Error ? rpaError.message : "Unknown error"}`,
				},
				{ status: 500 },
			);
		}

		return NextResponse.json(
			{
				success: true,
				message: `Job ${jobNumber} deleted successfully from ERP and RPA`,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error("Error in delete-job:", error);
		return NextResponse.json(
			{
				success: false,
				message:
					error instanceof Error ? error.message : "Internal server error",
			},
			{ status: 500 },
		);
	}
}
