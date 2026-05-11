import { type NextRequest, NextResponse } from "next/server";
import { logTruckingActivity } from "@/lib/activity-logger";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { blockIfAccounting } from "@/lib/guards/accounting-guard";

/**
 * POST /api/trucking-followup/container/create
 * Creates a new empty Container row for a TruckingFollowUp.
 */
export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const blocked = await blockIfAccounting(
			session.user.id,
			session.user.role,
			"Accounting department has view-only access to trucking follow-ups",
		);
		if (blocked) return blocked;

		const body = await request.json();
		const { truckingFollowUpId, containerNo, isFromAi } = body;

		if (!truckingFollowUpId) {
			return NextResponse.json(
				{ message: "Missing required field: truckingFollowUpId" },
				{ status: 400 },
			);
		}

		// Verify the trucking follow-up exists and was created by trucking
		const truckingRecord = await prismaRPA.truckingFollowUp.findUnique({
			where: { id: truckingFollowUpId },
			select: { id: true, createdBy: true, isFinished: true },
		});

		if (!truckingRecord) {
			return NextResponse.json(
				{ message: "Trucking follow-up record not found" },
				{ status: 404 },
			);
		}

		// If it's not created by trucking (e.g. synced from Logistics),
		// historically we blocked adding containers. We now allow it to bypass
		// this check ONLY if it's generated via AI autofill EDO process.
		// Historically, we blocked adding containers if createdBy was null (synced jobs).
		// Now we allow it as long as it's a trucking follow-up and not finished.

		if (truckingRecord.isFinished) {
			return NextResponse.json(
				{
					message: "Không thể thêm container: Job đã được đánh dấu hoàn thành.",
				},
				{ status: 403 },
			);
		}

		// Create a new container row (containerNo provided from UI on Save)
		const newContainer = await prismaRPA.container.create({
			data: {
				truckingFollowUpId,
				containerNo: containerNo || null,
			},
		});

		// Log activity
		logTruckingActivity(truckingFollowUpId, {
			userId: session.user.id,
			userName: session.user.name,
			action: "CREATE_CONTAINER",
			subResource: "container",
			subResourceId: newContainer.id,
			newValue: {
				containerId: newContainer.id,
				containerNo: newContainer.containerNo,
			},
		});

		// Return the container directly so frontend can get its real ID
		return NextResponse.json(newContainer, { status: 201 });
	} catch (error) {
		console.error("Container creation error:", error);
		return NextResponse.json(
			{
				message: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
