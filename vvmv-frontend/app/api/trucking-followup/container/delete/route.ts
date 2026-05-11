import { type NextRequest, NextResponse } from "next/server";
import { logTruckingActivity } from "@/lib/activity-logger";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { blockIfAccounting } from "@/lib/guards/accounting-guard";

/**
 * DELETE /api/trucking-followup/container/delete?id=xxx
 * Deletes a Container row.
 */
export async function DELETE(request: NextRequest) {
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

		const { searchParams } = new URL(request.url);
		const id = searchParams.get("id");

		if (!id) {
			return NextResponse.json(
				{ message: "Missing required parameter: id" },
				{ status: 400 },
			);
		}

		// Verify the container exists and belongs to a trucking job created by trucking
		const container = await prismaRPA.container.findUnique({
			where: { id },
			include: {
				truckingFollowUp: {
					select: { id: true, createdBy: true, isFinished: true },
				},
			},
		});

		if (!container) {
			return NextResponse.json(
				{ message: "Container not found" },
				{ status: 404 },
			);
		}

		if (!container.truckingFollowUp) {
			return NextResponse.json(
				{ message: "Container không thuộc trucking follow-up nào." },
				{ status: 400 },
			);
		}

		// Historically, we blocked deletions if createdBy was null (synced jobs).
		// Now we allow it as long as it's a trucking follow-up and not finished.

		if (container.truckingFollowUp.isFinished) {
			return NextResponse.json(
				{
					message: "Không thể xóa container: Job đã được đánh dấu hoàn thành.",
				},
				{ status: 403 },
			);
		}

		// Delete the container
		await prismaRPA.container.delete({
			where: { id },
		});

		// Log activity
		logTruckingActivity(container.truckingFollowUp.id, {
			userId: session.user.id,
			userName: session.user.name,
			action: "DELETE_CONTAINER",
			subResource: "container",
			subResourceId: id,
			oldValue: {
				containerNo: container.containerNo,
				containerSize: container.containerSize,
			},
		});

		return NextResponse.json(
			{ success: true, message: "Container deleted" },
			{ status: 200 },
		);
	} catch (error) {
		console.error("Container deletion error:", error);
		return NextResponse.json(
			{
				message: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
