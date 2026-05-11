import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { checkJobExists } from "@/lib/erp/check-job";
import { recreateTransaction } from "@/lib/erp/create-transaction";
import {
	checkCSHTFiles,
	checkDeclarationFolderFiles,
	checkLPHQFiles,
	checkTAXFiles,
} from "@/lib/google-drive/check-declaration-files";
import {
	BOT_ACTIONS,
	type BotActionType,
	validateFollowUpForBotAction,
} from "@/lib/validation/followup-validation";

/**
 * POST /api/followup/create-invoker-job
 * Create an Invoker job record for the bot to process
 */
export async function POST(request: NextRequest) {
	try {
		// 1. Authenticate user with Better Auth
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		// 2. Parse request body
		const body = await request.json();
		const { taskName, jobNumber } = body;

		// 3. Validate required fields
		if (!taskName || !jobNumber) {
			return NextResponse.json(
				{ message: "Missing required fields: taskName and jobNumber" },
				{ status: 400 },
			);
		}

		// 4. Get FollowUp record with containers for validation
		const followUp = await prismaRPA.followUp.findFirst({
			where: {
				jobNumber: jobNumber,
				isDeleted: false,
			},
			include: {
				containers: true, // Include containers for validation
			},
		});

		if (!followUp) {
			return NextResponse.json(
				{ message: `Follow-up with job number ${jobNumber} not found` },
				{ status: 404 },
			);
		}

		// 4.1. Fetch invoker tasks for this job to support validation
		const invokerRecords = await prismaRPA.invoker.findMany({
			where: {
				jobNo: jobNumber,
			},
			select: {
				taskName: true,
				status: true,
				message: true,
				createdTime: true,
				startedTime: true,
				completedTime: true,
				machineName: true,
				userAccount: true,
			},
			orderBy: {
				id: "desc",
			},
		});

		const invokerTasks = invokerRecords.map((r) => ({
			task_name: r.taskName,
			status: r.status || "",
			message: r.message,
			created_time: r.createdTime?.toISOString() || null,
			started_time: r.startedTime?.toISOString() || null,
			completed_time: r.completedTime?.toISOString() || null,
			machine_name: r.machineName,
			user_account: r.userAccount,
		}));

		// Attach tasks to followUp for validation
		(followUp as any).invokerTasks = invokerTasks;

		// 5. Validate FollowUp data based on action type
		const validationErrors = validateFollowUpForBotAction(
			followUp as any,
			taskName as BotActionType,
		);

		if (validationErrors.length > 0) {
			return NextResponse.json(
				{
					message: "Follow-up data incomplete",
					errors: validationErrors,
					details: validationErrors.map((e) => e.message).join("; "),
				},
				{ status: 400 },
			);
		}

		// 5.1. Handle FAST Input: Check ERP existence and recreate if missing
		if (taskName === BOT_ACTIONS.FAST_INPUT) {
			// Get user's ERP account (priority: erpAccount > username > email)
			const userData = await prismaRPA.user.findUnique({
				where: { id: session.user.id },
				select: { erpAccount: true, username: true, email: true },
			});

			const userAccount =
				userData?.erpAccount || userData?.username || userData?.email;

			if (!userAccount) {
				return NextResponse.json(
					{
						message:
							"User does not have an ERP account, username, or email configured",
					},
					{ status: 400 },
				);
			}

			const exists = await checkJobExists(jobNumber);
			if (!exists) {
				console.log(`Job ${jobNumber} not found in ERP, recreating...`);
				try {
					await recreateTransaction(jobNumber, userAccount, followUp);
					console.log(`Job ${jobNumber} recreated successfully.`);
				} catch (error) {
					console.error(`Failed to recreate job ${jobNumber}:`, error);
					return NextResponse.json(
						{
							message:
								"Job does not exist in ERP and attempt to recreate failed",
							error: error instanceof Error ? error.message : "Unknown error",
						},
						{ status: 500 },
					);
				}
			}
		}

		// 6. Additional server-side check for FAST CDS
		if (taskName === BOT_ACTIONS.FAST_CDS) {
			if (!followUp.driveUrl) {
				return NextResponse.json(
					{
						message: "Drive URL is required for FAST CDS action",
					},
					{ status: 400 },
				);
			}

			const fileCheckResult = await checkDeclarationFolderFiles(
				followUp.driveUrl,
			);

			if (!fileCheckResult.hasValidFiles) {
				return NextResponse.json(
					{
						message: "Missing required declaration files",
						details: `TO KHAI THONG QUAN folder must contain at least one Excel (.xlsx/.xls) or PDF (.pdf) file. Missing: ${fileCheckResult.missingFileTypes.join(", ")}`,
						fileCheckResult,
					},
					{ status: 400 },
				);
			}
		}

		// Additional server-side check for CSHT REQUEST
		if (taskName === BOT_ACTIONS.CSHT_REQUEST) {
			if (!followUp.driveUrl) {
				return NextResponse.json(
					{
						message: "Drive URL is required for CSHT Request action",
					},
					{ status: 400 },
				);
			}

			const fileCheckResult = await checkCSHTFiles(followUp.driveUrl);

			if (!fileCheckResult.hasValidFiles) {
				return NextResponse.json(
					{
						message: "Missing required CSHT files",
						details: `TO KHAI THONG QUAN folder must contain at least one PDF file with "CSHT" or "csht" in the name. Missing: ${fileCheckResult.missingFileTypes.join(", ")}`,
						fileCheckResult,
					},
					{ status: 400 },
				);
			}
		}

		// Additional server-side check for TAX REQUEST
		if (taskName === BOT_ACTIONS.TAX_REQUEST) {
			if (!followUp.driveUrl) {
				return NextResponse.json(
					{
						message: "Drive URL is required for TAX Request action",
					},
					{ status: 400 },
				);
			}

			const fileCheckResult = await checkTAXFiles(followUp.driveUrl);

			if (!fileCheckResult.hasValidFiles) {
				return NextResponse.json(
					{
						message: "Missing required TAX files",
						details: `TO KHAI THONG QUAN folder must contain at least one Excel file (.xls/.xlsx) with "thue" or "THUE" in the name. Missing: ${fileCheckResult.missingFileTypes.join(", ")}`,
						fileCheckResult,
					},
					{ status: 400 },
				);
			}
		}

		// Additional server-side check for LPHQ REQUEST
		if (taskName === BOT_ACTIONS.LPHQ_REQUEST) {
			if (!followUp.driveUrl) {
				return NextResponse.json(
					{
						message: "Drive URL is required for LPHQ Request action",
					},
					{ status: 400 },
				);
			}

			const fileCheckResult = await checkLPHQFiles(followUp.driveUrl);

			if (!fileCheckResult.hasValidFiles) {
				return NextResponse.json(
					{
						message: "Missing required LPHQ files",
						details: `TO KHAI THONG QUAN folder must contain at least one Excel file (.xls/.xlsx) with "lphq" or "LPHQ" in the name. Missing: ${fileCheckResult.missingFileTypes.join(", ")}`,
						fileCheckResult,
					},
					{ status: 400 },
				);
			}
		}

		// 7. Get user's ERP account (priority: erpAccount > username > email)
		const user = await prismaRPA.user.findUnique({
			where: { id: session.user.id },
			select: { erpAccount: true, username: true, email: true },
		});

		if (!user) {
			return NextResponse.json({ message: "User not found" }, { status: 404 });
		}

		// 7. Determine user account for Invoker (priority: erpAccount > username > email)
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

		// 8. Create Invoker record using Prisma
		await prismaRPA.invoker.create({
			data: {
				taskName,
				creator: "FollowUp",
				status: "Pending",
				source: "FollowUp",
				userAccount: userAccount,
				jobNo: jobNumber,
			},
		});

		return NextResponse.json(
			{ success: true, taskName, jobNumber },
			{ status: 201 },
		);
	} catch (error) {
		console.error("Error creating invoker job:", error);
		return NextResponse.json(
			{
				message: "Failed to create invoker job",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
