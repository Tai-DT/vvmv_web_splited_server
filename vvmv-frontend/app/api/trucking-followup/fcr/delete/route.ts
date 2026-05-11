import { type NextRequest, NextResponse } from "next/server";
import { logTruckingActivity } from "@/lib/activity-logger";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import {
	checkErpJobDelivered,
	deleteErpFcr,
} from "@/lib/erp/transaction-service";
import { blockIfAccounting } from "@/lib/guards/accounting-guard";

/**
 * DELETE /api/trucking-followup/fcr/delete?id=<fcrId>
 * Deletes an FCR record from both ERP (TransactionDetails + HAWB) and local database.
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
				{ message: "Missing required query param: id" },
				{ status: 400 },
			);
		}

		// Read FCR + parent TruckingFollowUp before deleting
		const existingFcr = await prismaRPA.fCR.findUnique({
			where: { id },
			select: {
				fcrNumber: true,
				truckingFollowUpId: true,
				truckingFollowUp: {
					select: { jobNumber: true, domain: true, isFinished: true },
				},
			},
		});

		if (!existingFcr) {
			return NextResponse.json({ message: "FCR not found" }, { status: 404 });
		}

		const { fcrNumber, truckingFollowUpId, truckingFollowUp } = existingFcr;

		if (truckingFollowUp?.isFinished) {
			return NextResponse.json(
				{ message: "Không thể xóa FCR: Job đã được đánh dấu hoàn thành." },
				{ status: 403 },
			);
		}

		const jobNumber = truckingFollowUp?.jobNumber;
		const site = truckingFollowUp?.domain || "SGN";

		// Check ERP: block if job is already delivered (Delivered=1 in Transactions)
		if (jobNumber) {
			const isDeliveredInErp = await checkErpJobDelivered({ jobNumber, site });
			if (isDeliveredInErp) {
				return NextResponse.json(
					{
						message:
							"Không thể xóa FCR: Job đã hoàn thành trên FAST (Delivered=1).",
					},
					{ status: 403 },
				);
			}
		}

		// 1. Delete from ERP (TransactionDetails + HAWB)
		if (jobNumber && fcrNumber) {
			await deleteErpFcr({ jobNumber, fcrNumber, site });
		}

		// 2. Delete from local database
		await prismaRPA.fCR.delete({ where: { id } });

		// 3. Log activity (fire-and-forget)
		if (truckingFollowUpId) {
			logTruckingActivity(truckingFollowUpId, {
				userId: session.user.id,
				userName: session.user.name,
				action: "DELETE_FCR",
				subResource: "fcr",
				subResourceId: fcrNumber ?? id, // use fcrNumber as readable ID in log
				oldValue: { id, fcrNumber },
			});
		}

		return NextResponse.json({ success: true, id }, { status: 200 });
	} catch (error) {
		console.error("FCR deletion error:", error);
		return NextResponse.json(
			{
				message: "Failed to delete FCR",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
