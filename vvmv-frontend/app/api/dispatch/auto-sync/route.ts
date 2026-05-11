import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { formatPlateNumber } from "@/lib/trucking/plate-utils";

export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const site =
			searchParams.get("site") ?? (session.user as any).site ?? "SGN";

		// 1. Fetch all unscheduled FCRs for this site
		const unscheduledFcrs = await prismaRPA.fCR.findMany({
			where: {
				truckingNumberId: null,
				truckingFollowUp: {
					domain: site,
					isDeleted: false,
				},
			},
			include: {
				truckingFollowUp: true,
			},
		});

		if (unscheduledFcrs.length === 0) {
			return NextResponse.json({
				message: "Không có FCR nào cần đồng bộ",
				updated: 0,
			});
		}

		// 2. Fetch all trucking numbers for this site to match in memory
		const allTruckingNumbers = await prismaRPA.truckingNumber.findMany({
			where: { site: site as any },
		});

		let updatedCount = 0;

		for (const fcr of unscheduledFcrs) {
			let targetTruckId: string | null = null;

			// Priority 1: Plate Number match
			if (fcr.plateNumber) {
				const normalized = formatPlateNumber(fcr.plateNumber) || "";
				const match = allTruckingNumbers.find(
					(t) => !t.isVendor && t.plateNumber === normalized,
				);
				if (match) targetTruckId = match.id;
			}

			// Priority 2: Vendor match (if no plate match)
			if (!targetTruckId && fcr.vendor) {
				const match = allTruckingNumbers.find(
					(t) => t.isVendor && t.vendorName === fcr.vendor,
				);
				if (match) targetTruckId = match.id;
			}

			if (targetTruckId) {
				// Use implementationDate from FCR or fallback to Job's date
				const date =
					fcr.implementationDate || fcr.truckingFollowUp?.implementationDate;

				if (date) {
					await prismaRPA.fCR.update({
						where: { id: fcr.id },
						data: {
							truckingNumberId: targetTruckId,
							tripNumber: 1, // Default to first trip
							implementationDate: date,
						},
					});
					updatedCount++;
				}
			}
		}

		return NextResponse.json({
			message: `Đã tự động xếp xe cho ${updatedCount} lô hàng.`,
			updated: updatedCount,
		});
	} catch (error) {
		console.error("Auto-sync error:", error);
		return NextResponse.json(
			{
				message: "Lỗi đồng bộ",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
