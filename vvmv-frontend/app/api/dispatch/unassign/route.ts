import { type NextRequest, NextResponse } from "next/server";
import { logTruckingActivity } from "@/lib/activity-logger";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

/**
 * PATCH /api/dispatch/unassign
 * Body: { fcrId, implementationDate?: "yyyy-MM-dd" }
 * Removes an FCR from its assigned truck trip.
 */
export async function PATCH(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { fcrId, fcrIds, implementationDate } = body;
		const targetFcrIds = fcrIds || (fcrId ? [fcrId] : []);

		if (targetFcrIds.length === 0) {
			return NextResponse.json(
				{ message: "Missing required field: fcrIds" },
				{ status: 400 },
			);
		}

		await prismaRPA.fCR.updateMany({
			where: { id: { in: targetFcrIds } },
			data: {
				truckingNumberId: null,
				tripNumber: 1,
				plateNumber: null,
				driver: null,
				truckType: null,
				tTypeC: null,
				vendor: null,
				implementationDate: implementationDate
					? new Date(`${implementationDate}T00:00:00.000Z`)
					: null,
			},
		});

		const updatedFcrs = await prismaRPA.fCR.findMany({
			where: { id: { in: targetFcrIds } },
			select: { id: true, truckingFollowUpId: true, fcrNumber: true },
		});

		for (const fcr of updatedFcrs) {
			if (fcr.truckingFollowUpId) {
				logTruckingActivity(fcr.truckingFollowUpId, {
					userId: session.user.id,
					userName: session.user.name,
					action: "DISPATCH_UNASSIGN",
					subResource: "fcr",
					subResourceId: fcr.fcrNumber ?? fcr.id,
					newValue: {
						truckingNumberId: null,
						implementationDate: implementationDate ?? null,
						tripNumber: null,
						plateNumber: null,
					},
				});
			}
		}

		return NextResponse.json({ success: true }, { status: 200 });
	} catch (error) {
		console.error("Dispatch unassign error:", error);
		return NextResponse.json(
			{
				message: "Failed to unassign FCR",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
