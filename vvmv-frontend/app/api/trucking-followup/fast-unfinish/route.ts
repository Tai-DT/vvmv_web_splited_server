import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA, queryERPHAN, queryERPHCM } from "@/lib/db";

interface ERPTransactionStatus {
	delivered: number | boolean;
	TransLock: number | boolean | null;
	TransLockLog: number | boolean | null;
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

/**
 * POST /api/trucking-followup/fast-unfinish
 *
 * Un-Finish a Trucking job by resetting ERP delivered flag:
 * 1. Creates an Invoker record with status "Processing"
 * 2. PRE-FLIGHT: Checks job exists in ERP
 * 3. Runs: UPDATE Transactions SET delivered = 1 WHERE TransID = @pTransID
 * 4. Updates isFinished = false in local DB (trucking + logistics)
 * 5. Updates the Invoker record to "Completed" / "FAIL - <error>"
 */
export async function POST(request: NextRequest) {
	let invokerId: bigint | null = null;

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
		const { jobNumber } = body as { jobNumber?: string };

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

		// 4. PRE-FLIGHT: Check ERP — job must exist AND TransLock = TransLockLog = 0
		const erpSite = mapJobNumberToERPSite(jobNumber);
		const queryFn = erpSite === "HCM" ? queryERPHCM : queryERPHAN;

		const checkSql = `
      SELECT
        ISNULL(delivered, 0)    AS delivered,
        ISNULL(TransLock, 0)    AS TransLock,
        ISNULL(TransLockLog, 0) AS TransLockLog
      FROM Transactions
      WHERE TransID = @pTransID
    `;

		try {
			const checkResult = await queryFn<ERPTransactionStatus>(checkSql, {
				pTransID: jobNumber,
			});

			if (!checkResult.recordset || checkResult.recordset.length === 0) {
				return NextResponse.json(
					{
						success: false,
						message: `Job ${jobNumber} không tìm thấy trong ERP.`,
					},
					{ status: 404 },
				);
			}

			const erpRow = checkResult.recordset[0];
			const transLock = Number(erpRow.TransLock ?? 0);
			const transLockLog = Number(erpRow.TransLockLog ?? 0);

			if (transLock !== 0 || transLockLog !== 0) {
				const lockedFields: string[] = [];
				if (transLock !== 0) lockedFields.push(`TransLock = ${transLock}`);
				if (transLockLog !== 0)
					lockedFields.push(`TransLockLog = ${transLockLog}`);

				return NextResponse.json(
					{
						success: false,
						message:
							`Job ${jobNumber} đã bị khóa trên ERP, không thể Un-Finish. ` +
							`(${lockedFields.join(", ")})`,
					},
					{ status: 409 },
				);
			}
		} catch (erpCheckError) {
			console.error(
				"[fast-unfinish] ERP pre-flight check error:",
				erpCheckError,
			);
			return NextResponse.json(
				{
					success: false,
					message: "Không thể kiểm tra trạng thái ERP. Vui lòng thử lại.",
					error:
						erpCheckError instanceof Error
							? erpCheckError.message
							: "Unknown error",
				},
				{ status: 502 },
			);
		}

		// 5. Create Invoker record with status "Processing"
		const invokerRecord = await prismaRPA.invoker.create({
			data: {
				taskName: "FAST Un-Finish",
				creator: "TruckingFollowUp",
				status: "Processing",
				source: "TruckingFollowUp",
				userAccount,
				jobNo: jobNumber,
				startedTime: new Date(),
			},
		});

		invokerId = invokerRecord.id;

		// 6. Execute ERP Un-Finish: UPDATE Transactions SET delivered = 1
		const unfinishSql = `
      UPDATE Transactions
      SET delivered = 0
      WHERE TransID = @pTransID
    `;

		let erpRowsAffected = 0;
		try {
			const updateResult = await queryFn<never>(unfinishSql, {
				pTransID: jobNumber,
			});
			erpRowsAffected = updateResult.rowsAffected?.[0] ?? 0;
		} catch (erpUpdateError) {
			const errMsg =
				erpUpdateError instanceof Error
					? erpUpdateError.message
					: "ERP update error";

			// Update Invoker to FAIL
			await prismaRPA.invoker.update({
				where: { id: invokerId },
				data: {
					status: "Completed",
					completedTime: new Date(),
					message: `FAIL - ${errMsg}`.substring(0, 500),
				},
			});

			return NextResponse.json(
				{ success: false, message: errMsg },
				{ status: 502 },
			);
		}

		// 7. Update local DB: isFinished = false
		await prismaRPA.truckingFollowUp.updateMany({
			where: { jobNumber, isDeleted: false },
			data: { isFinished: false },
		});

		// Also reset linked logistics follow-up
		await prismaRPA.followUp.updateMany({
			where: { jobNumber, isDeleted: false },
			data: { isFinished: false },
		});

		// 8. Update Invoker to Completed / SUCCESS
		await prismaRPA.invoker.update({
			where: { id: invokerId },
			data: {
				status: "Completed",
				completedTime: new Date(),
				message: `SUCCESS`,
			},
		});

		return NextResponse.json(
			{
				success: true,
				message: `Job ${jobNumber} đã được Un-Finish thành công`,
				erpRowsAffected,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error("[fast-unfinish] Unexpected error:", error);

		const errMsg =
			error instanceof Error ? error.message : "Internal server error";

		// If Invoker was already created, mark it as failed
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
				console.error(
					"[fast-unfinish] Failed to update invoker on error:",
					updateError,
				);
			}
		}

		return NextResponse.json(
			{ success: false, message: errMsg },
			{ status: 500 },
		);
	}
}
