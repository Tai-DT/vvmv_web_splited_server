import { type NextRequest, NextResponse } from "next/server";
import { logTruckingActivity } from "@/lib/activity-logger";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

/**
 * PATCH /api/dispatch/assign
 * Body: { fcrId, truckingNumberId, implementationDate: "yyyy-MM-dd", tripNumber }
 * Assigns an FCR to a truck trip.
 */
export async function PATCH(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { fcrId, fcrIds, truckingNumberId, implementationDate, tripNumber } =
			body;
		const targetFcrIds = fcrIds || (fcrId ? [fcrId] : []);

		if (
			targetFcrIds.length === 0 ||
			!truckingNumberId ||
			!implementationDate ||
			tripNumber == null
		) {
			return NextResponse.json(
				{
					message:
						"Missing required fields: fcrIds, truckingNumberId, implementationDate, tripNumber",
				},
				{ status: 400 },
			);
		}

		const truck = await prismaRPA.truckingNumber.findUnique({
			where: { id: truckingNumberId },
			select: {
				plateNumber: true,
				driverName: true,
				vehicleType: true,
				isVendor: true,
				vendorName: true,
			},
		});

		if (!truck) {
			return NextResponse.json({ message: "Truck not found" }, { status: 404 });
		}

		const updateData: any = {
			truckingNumberId,
			tripNumber: Number(tripNumber),
			vendor: truck.vendorName ?? null,
			implementationDate: new Date(`${implementationDate}T00:00:00.000Z`),
		};

		if (!truck.isVendor) {
			updateData.plateNumber = truck.plateNumber;
			updateData.driver = truck.driverName;
			if (truck.vehicleType?.trim()) {
				updateData.truckType = truck.vehicleType;
				updateData.tTypeC = truck.vehicleType;
			}
		} else {
			// For vendor slots, we explicitly clear plate and driver to indicate it's not a specific internal truck
			updateData.plateNumber = null;
			//updateData.driver = null;
			// Note: truckType and tTypeC are LEFT ALONE to preserve manual tonnage settings
		}

		await prismaRPA.fCR.updateMany({
			where: { id: { in: targetFcrIds } },
			data: updateData,
		});

		// Logging for all affected FCRs
		const updatedFcrs = await prismaRPA.fCR.findMany({
			where: { id: { in: targetFcrIds } },
			select: { id: true, truckingFollowUpId: true, fcrNumber: true },
		});

		for (const fcr of updatedFcrs) {
			if (fcr.truckingFollowUpId) {
				logTruckingActivity(fcr.truckingFollowUpId, {
					userId: session.user.id,
					userName: session.user.name,
					action: "DISPATCH_ASSIGN",
					subResource: "fcr",
					subResourceId: fcr.fcrNumber ?? fcr.id,
					newValue: {
						truckingNumberId,
						implementationDate,
						tripNumber,
						plateNumber: truck.plateNumber,
					},
				});
			}
		}

		return NextResponse.json({ success: true }, { status: 200 });
	} catch (error) {
		console.error("Dispatch assign error:", error);
		return NextResponse.json(
			{
				message: "Failed to assign FCR",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
