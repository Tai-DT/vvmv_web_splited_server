import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import {
	type TruckingBotActionType,
	validateTruckingFollowUpForBotAction,
} from "@/lib/validation/trucking-followup-validation";

/**
 * POST /api/trucking-followup/create-invoker-job
 * Create an Invoker job record for the bot to process TruckingFollowUp actions
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

		// 4. Get TruckingFollowUp record with relations for validation
		const truckingFollowUp = await prismaRPA.truckingFollowUp.findFirst({
			where: {
				jobNumber: jobNumber,
				isDeleted: false,
			},
			include: {
				containers: true,
				fcrs: true,
				declarations: true,
			},
		});

		if (!truckingFollowUp) {
			return NextResponse.json(
				{
					message: `Trucking Follow-up with job number ${jobNumber} not found`,
				},
				{ status: 404 },
			);
		}

		// 4.1 Merge containers and declarations from related FollowUps
		// This matches the merge logic in the main GET API
		const linkedContainers = [...truckingFollowUp.containers];
		const linkedFcrs = [...truckingFollowUp.fcrs];
		const linkedDeclarations = [...truckingFollowUp.declarations];

		// Find FollowUps linked by requestTruckingNo or jobNumber
		if (truckingFollowUp.requestNumber || truckingFollowUp.jobNumber) {
			const relatedFollowUps = await prismaRPA.followUp.findMany({
				where: {
					OR: [
						...(truckingFollowUp.requestNumber
							? [{ requestTruckingNo: truckingFollowUp.requestNumber }]
							: []),
						...(truckingFollowUp.jobNumber
							? [{ jobNumber: truckingFollowUp.jobNumber }]
							: []),
					],
					isDeleted: false,
				},
				include: {
					containers: true,
					declarations: true,
				},
			});

			// Merge containers from related FollowUps
			for (const followUp of relatedFollowUps) {
				for (const container of followUp.containers || []) {
					if (!linkedContainers.some((c) => c.id === container.id)) {
						linkedContainers.push(container);
					}
				}
				for (const declaration of followUp.declarations || []) {
					if (!linkedDeclarations.some((d) => d.id === declaration.id)) {
						linkedDeclarations.push(declaration);
					}
				}
			}
		}

		// Create a merged object for validation
		const mergedTruckingData = {
			...truckingFollowUp,
			containers: linkedContainers,
			fcrs: linkedFcrs,
			declarations: linkedDeclarations,
		};

		// 5. Validate TruckingFollowUp data based on action type
		const validationErrors = validateTruckingFollowUpForBotAction(
			mergedTruckingData as any,
			taskName as TruckingBotActionType,
		);

		if (validationErrors.length > 0) {
			return NextResponse.json(
				{
					message: "Trucking Follow-up data incomplete",
					errors: validationErrors,
					details: validationErrors.map((e) => e.message).join("; "),
				},
				{ status: 400 },
			);
		}

		// 6. Get user's ERP account (priority: erpAccount > username > email)
		const user = await prismaRPA.user.findUnique({
			where: { id: session.user.id },
			select: { erpAccount: true, username: true, email: true },
		});

		if (!user) {
			return NextResponse.json({ message: "User not found" }, { status: 404 });
		}

		// 7. Use user's email for Invoker
		const userAccount = user.email || user.username;

		if (!userAccount) {
			return NextResponse.json(
				{
					message: "User does not have an email configured",
				},
				{ status: 400 },
			);
		}

		// 8. Create Invoker record using Prisma
		await prismaRPA.invoker.create({
			data: {
				taskName,
				creator: "TruckingFollowUp",
				status: "Pending",
				source: "TruckingFollowUp",
				userAccount: userAccount,
				jobNo: jobNumber,
			},
		});

		return NextResponse.json(
			{ success: true, taskName, jobNumber },
			{ status: 201 },
		);
	} catch (error) {
		console.error("Error creating trucking invoker job:", error);
		return NextResponse.json(
			{
				message: "Failed to create invoker job",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
