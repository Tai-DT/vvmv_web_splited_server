import { type NextRequest, NextResponse } from "next/server";
import { logTruckingActivity } from "@/lib/activity-logger";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import {
	checkErpJobDelivered,
	createErpFcr,
} from "@/lib/erp/transaction-service";
import { blockIfAccounting } from "@/lib/guards/accounting-guard";

/**
 * POST /api/trucking-followup/fcr/create
 * Creates an FCR in ERP and syncs it to the RPA database.
 * Optional: copyFromFcrId — copies all fields from an existing FCR (except the FCR number itself).
 */
export async function POST(request: NextRequest) {
	try {
		// 1. Get user session
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

		// 2. Parse request body
		const body = await request.json();
		const { truckingFollowUpId, copyFromFcrId, reverseTrip, prefillData } =
			body;

		if (!truckingFollowUpId) {
			return NextResponse.json(
				{ message: "Missing required field: truckingFollowUpId" },
				{ status: 400 },
			);
		}

		// 3. Get TruckingFollowUp details to get JobNumber and Domain
		const truckingRecord = await prismaRPA.truckingFollowUp.findUnique({
			where: { id: truckingFollowUpId },
			select: { jobNumber: true, domain: true, isFinished: true },
		});

		if (!truckingRecord) {
			return NextResponse.json(
				{ message: "Trucking follow-up record not found" },
				{ status: 404 },
			);
		}

		if (truckingRecord.isFinished) {
			return NextResponse.json(
				{ message: "Không thể thêm FCR: Job đã được đánh dấu hoàn thành." },
				{ status: 403 },
			);
		}

		if (!truckingRecord.jobNumber) {
			return NextResponse.json(
				{ message: "Trucking follow-up record does not have a job number" },
				{ status: 400 },
			);
		}

		// 3.5 Check ERP: block if job is already delivered (Delivered=1 in Transactions)
		const isDeliveredInErp = await checkErpJobDelivered({
			jobNumber: truckingRecord.jobNumber,
			site: truckingRecord.domain || "SGN",
		});
		if (isDeliveredInErp) {
			return NextResponse.json(
				{
					message:
						"Không thể thêm FCR: Job đã hoàn thành trên FAST (Delivered=1).",
				},
				{ status: 403 },
			);
		}

		// 3.6 Optionally fetch source FCR to copy fields from
		let sourceFcr: Record<string, any> | null = null;
		if (copyFromFcrId) {
			sourceFcr = await prismaRPA.fCR.findUnique({
				where: { id: copyFromFcrId },
			});
		}

		// 4. Create FCR in ERP system
		const result = await createErpFcr({
			jobNumber: truckingRecord.jobNumber,
			site: truckingRecord.domain || "SGN",
		});

		// 5. Create FCR record in local database — copy fields from source if provided
		const newFcr = await prismaRPA.fCR.create({
			data: {
				truckingFollowUpId,
				fcrNumber: result.HWBNO, // Always use the new ERP-generated number
				// Priority: sourceFcr (copy) > prefillData (from trucking row) > ERP default
				shipper:
					sourceFcr?.shipper ?? prefillData?.shipper ?? result.CUSTOMER_NAME,
				vendor: sourceFcr?.vendor ?? prefillData?.vendor ?? "",
				warehouse: sourceFcr?.warehouse ?? prefillData?.warehouse ?? null,
				plateNumber: sourceFcr?.plateNumber ?? null,
				driver: sourceFcr?.driver ?? null,
				tType: sourceFcr?.tType ?? null,
				tTypeC: sourceFcr?.tTypeC ?? prefillData?.tTypeC ?? null,
				truckType: sourceFcr?.truckType ?? prefillData?.truckType ?? null,
				implementationDate:
					sourceFcr?.implementationDate ??
					prefillData?.implementationDate ??
					null,
				cbm:
					sourceFcr?.cbm ?? (prefillData?.cbm ? Number(prefillData.cbm) : null),
				grossWeight:
					sourceFcr?.grossWeight ??
					(prefillData?.grossWeight ? Number(prefillData.grossWeight) : null),
				quantity:
					sourceFcr?.quantity ??
					(prefillData?.quantity ? Number(prefillData.quantity) : null),
				pickupAt: reverseTrip
					? (sourceFcr?.deliveryAt ?? null) // swap: pickup ← source delivery
					: (sourceFcr?.pickupAt ?? prefillData?.pickupAt ?? null),
				deliveryAt: reverseTrip
					? (sourceFcr?.pickupAt ?? null) // swap: delivery ← source pickup
					: (sourceFcr?.deliveryAt ?? prefillData?.deliveryAt ?? null),
				notes: sourceFcr?.notes ?? null,
				isCombined: !!reverseTrip,
				service: reverseTrip
					? `X2` // append X2 to service when reversing
					: (sourceFcr?.service ?? null),
				// containerId intentionally NOT copied
			},
		});

		// 5.5 Log activity (fire-and-forget)
		logTruckingActivity(truckingFollowUpId, {
			userId: session.user.id,
			userName: session.user.name,
			action: "CREATE_FCR",
			subResource: "fcr",
			subResourceId: newFcr.id,
			newValue: {
				fcrNumber: newFcr.fcrNumber,
				copiedFrom: copyFromFcrId ?? null,
				reverseTrip: reverseTrip ?? false,
			},
		});

		// 6. Return response
		return NextResponse.json(
			{
				success: true,
				fcr: newFcr,
				erpResult: result,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("FCR creation error:", error);

		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";

		return NextResponse.json(
			{
				message: errorMessage,
				error: errorMessage,
			},
			{ status: 500 },
		);
	}
}
