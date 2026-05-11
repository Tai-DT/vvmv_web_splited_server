import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA, queryERPHAN, queryERPHCM } from "@/lib/db";
import { BOT_ACTIONS } from "@/lib/validation/followup-validation";

interface DeliveredResult {
	delivered: number | boolean;
}

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

const FAST_PRO_API_URL =
	"https://fastpro-api.softek.com.vn/api/v1/finishShipment";
const FAST_PRO_USERNAME = "FLUP";

/**
 * POST /api/followup/fast-finish-logistic
 *
 * Executes the FAST Finish action for Logistic jobs:
 * 1. Creates an Invoker record with status "Processing"
 * 2. Calls the external FastPro finishShipment API
 * 3. Updates the Invoker status to "SUCCESS" or "FAIL - <error>"
 */
export async function POST(request: NextRequest) {
	let invokerId: bigint | null = null;

	try {
		// 0. Validate env config
		const FAST_PRO_API_KEY = process.env.FASTPRO_API_KEY;
		if (!FAST_PRO_API_KEY) {
			console.error(
				"FASTPRO_API_KEY is not configured in environment variables",
			);
			return NextResponse.json(
				{ success: false, message: "FastPro API key is not configured" },
				{ status: 500 },
			);
		}

		// 1. Authenticate
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		// 2. Parse body
		const body = await request.json();
		const { jobNumber } = body;

		if (!jobNumber) {
			return NextResponse.json(
				{ message: "Missing required field: jobNumber" },
				{ status: 400 },
			);
		}

		// 3. Get user account
		const user = await prismaRPA.user.findUnique({
			where: { id: session.user.id },
			select: { erpAccount: true, username: true, email: true },
		});

		if (!user) {
			return NextResponse.json({ message: "User not found" }, { status: 404 });
		}

		const userAccount = user.email || user.username;

		if (!userAccount) {
			return NextResponse.json(
				{
					message:
						"User does not have an ERP account, username, or email configured",
				},
				{ status: 400 },
			);
		}

		// 3.5. PRE-FLIGHT: Check ERP to ensure job is NOT already finished
		const erpSite = mapJobNumberToERPSite(jobNumber);
		const sqlQuery = `
      SELECT ISNULL(delivered, 0) as delivered
      FROM Transactions
      WHERE TransID = @pTransID
    `;

		try {
			const queryFn = erpSite === "HCM" ? queryERPHCM : queryERPHAN;
			const erpResult = await queryFn<DeliveredResult>(sqlQuery, {
				pTransID: jobNumber,
			});

			if (erpResult.recordset && erpResult.recordset.length > 0) {
				const isAlreadyDelivered = Boolean(erpResult.recordset[0].delivered);
				if (isAlreadyDelivered) {
					return NextResponse.json(
						{
							success: false,
							message: `Job ${jobNumber} đã được Finish trước đó. Không thể chạy lại.`,
						},
						{ status: 409 },
					);
				}
			}
		} catch (erpError) {
			console.error("ERP pre-flight check error:", erpError);
			return NextResponse.json(
				{
					success: false,
					message: "Không thể kiểm tra trạng thái ERP. Vui lòng thử lại.",
					error: erpError instanceof Error ? erpError.message : "Unknown error",
				},
				{ status: 502 },
			);
		}

		// 4. Create Invoker record with status "Processing"
		const invokerRecord = await prismaRPA.invoker.create({
			data: {
				taskName: BOT_ACTIONS.FAST_FINISH,
				creator: "FollowUp",
				status: "Processing",
				source: "FollowUp",
				userAccount: userAccount,
				jobNo: jobNumber,
				startedTime: new Date(),
			},
		});

		invokerId = invokerRecord.id;

		// 5. Call external FastPro finishShipment API
		let apiResponse: Response;
		try {
			apiResponse = await fetch(FAST_PRO_API_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": FAST_PRO_API_KEY,
				},
				body: JSON.stringify({
					transIds: [jobNumber],
					username: FAST_PRO_USERNAME,
				}),
			});
		} catch (networkError) {
			// Network failure - update invoker to FAIL
			const errMsg =
				networkError instanceof Error
					? networkError.message
					: "Network error calling FastPro API";

			await prismaRPA.invoker.update({
				where: { id: invokerId },
				data: {
					status: "Completed",
					message: `FAIL - ${errMsg}`,
					completedTime: new Date(),
				},
			});

			return NextResponse.json(
				{ success: false, message: errMsg },
				{ status: 502 },
			);
		}

		const apiResult = await apiResponse.json();

		// 6. Evaluate result
		// Top-level success flag, and each shipment result
		const topLevelSuccess: boolean = apiResult?.success === true;

		// Check individual shipment result
		const shipmentResult = apiResult?.data?.results?.[0];
		const shipmentSuccess: boolean = shipmentResult?.success === true;

		const overallSuccess = topLevelSuccess && shipmentSuccess;

		if (overallSuccess) {
			// Update invoker to Completed/SUCCESS
			await prismaRPA.invoker.update({
				where: { id: invokerId },
				data: {
					status: "Completed",
					completedTime: new Date(),
					message: "SUCCESS",
				},
			});

			// Update follow_up.isFinished = true
			await prismaRPA.followUp.updateMany({
				where: { jobNumber, isDeleted: false },
				data: { isFinished: true },
			});

			// Update trucking_follow_up.isFinished = true (shared API for both logistics & trucking)
			await prismaRPA.truckingFollowUp.updateMany({
				where: { jobNumber, isDeleted: false },
				data: { isFinished: true },
			});

			return NextResponse.json(
				{
					success: true,
					message:
						shipmentResult?.message ||
						apiResult?.message ||
						"Finished successfully",
					data: apiResult,
				},
				{ status: 200 },
			);
		} else {
			// Collect error message
			const errorMessages: string[] = [];

			if (apiResult?.message && !topLevelSuccess) {
				errorMessages.push(apiResult.message);
			}

			if (shipmentResult?.message && !shipmentSuccess) {
				errorMessages.push(shipmentResult.message);
			}

			if (shipmentResult?.errors?.length > 0) {
				errorMessages.push(...shipmentResult.errors);
			}

			if (apiResult?.data?.errors?.length > 0) {
				errorMessages.push(...apiResult.data.errors);
			}

			const errorSummary =
				errorMessages.length > 0
					? errorMessages.join("; ")
					: "Unknown error from FastPro API";

			const failStatus = `FAIL - ${errorSummary}`.substring(0, 500); // guard against long messages

			await prismaRPA.invoker.update({
				where: { id: invokerId },
				data: {
					status: "Completed",
					completedTime: new Date(),
					message: failStatus,
				},
			});

			return NextResponse.json(
				{
					success: false,
					message: errorSummary,
					data: apiResult,
				},
				{ status: 422 },
			);
		}
	} catch (error) {
		console.error("Error in fast-finish-logistic:", error);

		const errMsg =
			error instanceof Error ? error.message : "Internal server error";

		// If we already created an invoker record, mark it as failed
		if (invokerId !== null) {
			try {
				await prismaRPA.invoker.update({
					where: { id: invokerId },
					data: {
						status: "Completed",
						completedTime: new Date(),
						message: `FAIL - ${errMsg}`.substring(0, 500),
					},
				});
			} catch (updateError) {
				console.error("Failed to update invoker status on error:", updateError);
			}
		}

		return NextResponse.json(
			{ success: false, message: errMsg },
			{ status: 500 },
		);
	}
}
