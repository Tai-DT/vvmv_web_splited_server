import { type NextRequest, NextResponse } from "next/server";
import type {
	BoardData,
	DayData,
	FCRBoardItem,
	TripSlot,
	TruckSlot,
} from "@/app/(home)/internal/trucking/dispatch/types";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

/**
 * GET /api/dispatch/board?from=yyyy-MM-dd&to=yyyy-MM-dd&site=SGN
 * Returns the dispatch board data: unscheduled FCRs + scheduled grouped by day/truck/trip
 */
export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const from = searchParams.get("from");
		const to = searchParams.get("to");
		const site =
			searchParams.get("site") ?? (session.user as any).site ?? "SGN";

		if (!from || !to) {
			return NextResponse.json(
				{ message: "Missing required params: from, to" },
				{ status: 400 },
			);
		}

		const fromDate = new Date(`${from}T00:00:00.000Z`);
		const toDate = new Date(`${to}T23:59:59.999Z`);

		// Fetch all TruckingFollowUp for this site with their FCRs
		const followUps = await prismaRPA.truckingFollowUp.findMany({
			where: {
				domain: site,
				isDeleted: false,
			},
			select: {
				id: true,
				jobNumber: true,
				companyName: true,
				billOrBooking: true,
				note: true,
				serviceMode: true,
				warehouse: true,
				routineDetail: true,
				operationType: true,
				implementationDate: true,
				createdBy: true,
				pickUpTime: true,
				requestNumber: true,
				fcrs: {
					select: {
						id: true,
						fcrNumber: true,
						grossWeight: true,
						pickupAt: true,
						deliveryAt: true,
						shipper: true,
						notes: true,
						vendor: true,
						cbm: true,
						quantity: true,
						truckingNumberId: true,
						tripNumber: true,
						implementationDate: true,
						plateNumber: true,
						driver: true,
						truckType: true,
						containerNo: true,
						truckingNumber: {
							select: {
								id: true,
								plateNumber: true,
								driverName: true,
								vehicleType: true,
								payload: true,
								isVendor: true,
								vendorName: true,
							},
						},
					},
				},
			},
		});

		// Fetch all trucks for this site (for the "add truck" picker) — exclude vendor slots
		const allTrucksRaw = await prismaRPA.truckingNumber.findMany({
			where: { site: site as any },
			select: {
				id: true,
				plateNumber: true,
				driverName: true,
				vehicleType: true,
				payload: true,
				isVendor: true,
				vendorName: true,
			},
			orderBy: { plateNumber: "asc" },
		});

		const allTrucks = allTrucksRaw.map((t) => ({
			id: t.id,
			plateNumber: t.plateNumber,
			driverName: t.driverName,
			vehicleType: t.vehicleType,
			payloadTonnes: t.payload,
			isVendor: t.isVendor,
			vendorName: t.vendorName,
		}));

		// Fetch vendors for "add vendor" picker
		const allVendorsRaw = await prismaRPA.vendor.findMany({
			where: { site: site as any },
			select: { id: true, name: true },
			orderBy: { name: "asc" },
		});
		const allVendors = allVendorsRaw.map((v) => ({ id: v.id, name: v.name }));

		// Fetch vendor TruckingNumbers to resolve their info
		const vendorTruckingNumbers = await prismaRPA.truckingNumber.findMany({
			where: { site: site as any, isVendor: true },
			select: { id: true, vendorName: true },
		});
		const _vendorTruckInfoMap = new Map(
			vendorTruckingNumbers.map((v) => [v.id, v]),
		);

		// Collect all unique requestNumbers to fetch their related FollowUp declarations
		const requestNumbers = Array.from(
			new Set(followUps.map((fu) => fu.requestNumber).filter(Boolean)),
		) as string[];

		const relatedFollowUps = await prismaRPA.followUp.findMany({
			where: {
				requestTruckingNo: { in: requestNumbers },
				isDeleted: false,
			},
			select: {
				requestTruckingNo: true,
				declarations: {
					select: {
						mvUrl: true,
					},
				},
			},
		});

		const declarationsMap = new Map<string, { mvUrl: string | null }[]>();
		for (const rfu of relatedFollowUps) {
			if (rfu.requestTruckingNo) {
				const existing = declarationsMap.get(rfu.requestTruckingNo) ?? [];
				declarationsMap.set(rfu.requestTruckingNo, [
					...existing,
					...rfu.declarations,
				]);
			}
		}

		// Flatten all FCRs
		const allFcrs: FCRBoardItem[] = [];
		for (const fu of followUps) {
			const declarations = fu.requestNumber
				? declarationsMap.get(fu.requestNumber) || []
				: [];

			for (const fcr of fu.fcrs) {
				allFcrs.push({
					id: fcr.id,
					fcrNumber: fcr.fcrNumber,
					grossWeight: fcr.grossWeight,
					pickupAt: fcr.pickupAt,
					deliveryAt: fcr.deliveryAt,
					shipper: fcr.shipper,
					notes: fcr.notes,
					vendor: fcr.vendor,
					cbm: fcr.cbm,
					quantity: fcr.quantity ?? null,
					truckingNumberId: fcr.truckingNumberId,
					tripNumber: fcr.tripNumber,
					implementationDate: fcr.implementationDate
						? fcr.implementationDate.toISOString().slice(0, 10)
						: null,
					plateNumber: fcr.plateNumber,
					driver: fcr.driver,
					truckType: fcr.truckType,
					containerNo: fcr.containerNo,
					truckingFollowUp: {
						id: fu.id,
						jobNumber: fu.jobNumber,
						companyName: fu.companyName,
						billOrBooking: fu.billOrBooking,
						note: fu.note,
						serviceMode: fu.serviceMode,
						warehouse: fu.warehouse,
						routineDetail: fu.routineDetail,
						operationType: fu.operationType ?? null,
						implementationDate: fu.implementationDate
							? fu.implementationDate.toISOString().slice(0, 10)
							: null,
						createdBy: fu.createdBy ?? null,
						pickUpTime: fu.pickUpTime ?? null,
					},
					hasAllMvUrls:
						declarations.length > 0 &&
						declarations.every((d: any) => d.mvUrl && d.mvUrl.trim() !== ""),
				});
			}
		}

		// Unscheduled = no truck assigned yet (may still have a planned date)
		// Scheduled = assigned to a truck AND has an implementationDate within the board range
		const unscheduledFcrs = allFcrs.filter((f) => !f.truckingNumberId);
		const scheduledFcrs = allFcrs.filter((f) => {
			if (!f.truckingNumberId || !f.implementationDate) return false;
			const d = new Date(`${f.implementationDate}T00:00:00.000Z`);
			return d >= fromDate && d <= toDate;
		});

		// Group scheduled FCRs by date → truckingNumberId → tripNumber
		// dayMap: date → Map<truckingNumberId, Map<tripNumber, FCRBoardItem[]>>
		const dayMap = new Map<string, Map<string, Map<number, FCRBoardItem[]>>>();

		for (const fcr of scheduledFcrs) {
			const date = fcr.implementationDate!;
			const truckId = fcr.truckingNumberId!;

			if (!dayMap.has(date)) dayMap.set(date, new Map());
			const truckMap = dayMap.get(date)!;

			if (!truckMap.has(truckId)) truckMap.set(truckId, new Map());
			const tripMap = truckMap.get(truckId)!;

			const tripNum = fcr.tripNumber ?? 1;
			if (!tripMap.has(tripNum)) tripMap.set(tripNum, []);
			tripMap.get(tripNum)?.push(fcr);
		}

		// Build a lookup for truck info from allTrucksRaw
		const truckInfoMap = new Map(allTrucksRaw.map((t) => [t.id, t]));

		// Build days array
		const days: DayData[] = [];
		// Generate all dates in range
		const current = new Date(fromDate);
		while (current <= toDate) {
			const dateStr = current.toISOString().slice(0, 10);
			const truckMap = dayMap.get(dateStr);
			const trucks: TruckSlot[] = [];

			if (truckMap) {
				for (const [truckId, tripMap] of truckMap.entries()) {
					if (truckId === "__unknown__") continue;
					const truckInfo = truckInfoMap.get(truckId);

					// Prioritize data from FCRs in the truck for display consistency
					const allFcrsInTruck = Array.from(tripMap.values()).flat();
					const fcrPlate = allFcrsInTruck.find(
						(f) => f.plateNumber,
					)?.plateNumber;
					const fcrDriver = allFcrsInTruck.find((f) => f.driver)?.driver;
					const fcrType = allFcrsInTruck.find((f) => f.truckType)?.truckType;
					const fcrVendor = allFcrsInTruck.find((f) => f.vendor)?.vendor;

					const trips: TripSlot[] = [];
					for (const [tripNumber, fcrs] of tripMap.entries()) {
						trips.push({ tripNumber, fcrs });
					}
					trips.sort((a, b) => b.tripNumber - a.tripNumber);
					trucks.push({
						truckingNumberId: truckId,
						plateNumber: fcrPlate || truckInfo?.plateNumber || "",
						driverName: fcrDriver || truckInfo?.driverName || null,
						vehicleType: fcrType || truckInfo?.vehicleType || null,
						payloadTonnes: truckInfo?.payload ?? null,
						isVendor: truckInfo?.isVendor ?? false,
						vendorName: fcrVendor || truckInfo?.vendorName || null,
						trips,
					});
				}
			}

			days.push({ date: dateStr, trucks });
			current.setUTCDate(current.getUTCDate() + 1);
		}

		const boardData: BoardData = {
			unscheduledFcrs,
			days,
			allTrucks,
			allVendors,
			stats: {
				totalFcrs: allFcrs.length,
				totalTrucks: allTrucks.length,
				unscheduledCount: unscheduledFcrs.length,
			},
		};

		return NextResponse.json(boardData, { status: 200 });
	} catch (error) {
		console.error("Dispatch board error:", error);
		return NextResponse.json(
			{
				message: "Failed to fetch dispatch board",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
