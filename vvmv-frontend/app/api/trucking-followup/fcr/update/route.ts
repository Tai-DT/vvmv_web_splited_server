import { type NextRequest, NextResponse } from "next/server";
import { logTruckingActivity } from "@/lib/activity-logger";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { blockIfAccounting } from "@/lib/guards/accounting-guard";
import { syncTruckingGrossWeight } from "@/lib/trucking/gross-weight-sync";
import type { FCR } from "@/prisma/client";
import { Site } from "@/prisma/client";

// Updatable fields derived from FCR type
type UpdatableFCRField = Exclude<
	keyof FCR,
	"id" | "truckingFollowUpId" | "fcrNumber" | "container"
>;

// Field type mapping for coercion
const FIELD_TYPES: Record<
	UpdatableFCRField,
	"string" | "float" | "int" | "boolean" | "datetime"
> = {
	tType: "string",
	tTypeC: "string",
	plateNumber: "string",
	truckType: "string",
	shipper: "string",
	cbm: "float",
	grossWeight: "float",
	quantity: "float", // In schema it's Float?
	pickupAt: "string",
	deliveryAt: "string",
	notes: "string",
	isCombined: "boolean",
	containerNo: "string",
	containerId: "string",
	vehicleInfo: "string",
	driver: "string",
	vendor: "string",
	warehouse: "string",
	implementationDate: "datetime",
	service: "string",
	ops: "string",
	bienBanBT: "boolean",
	truckingNumberId: "string",
	tripNumber: "int",
};

// Type coercion helpers
function toStringValue(value: unknown): string | null {
	if (value === null || value === undefined || value === "") return null;
	return String(value);
}

function toFloatValue(value: unknown): number | null {
	if (value === null || value === undefined || value === "") return null;
	const num = Number.parseFloat(String(value));
	return Number.isNaN(num) ? null : num;
}

function toBooleanValue(value: unknown): boolean | null {
	if (value === null || value === undefined) return null;
	if (typeof value === "boolean") return value;
	if (value === "true" || value === "1") return true;
	if (value === "false" || value === "0") return false;
	return Boolean(value);
}

function toDateTimeValue(value: unknown): Date | null {
	if (value === null || value === undefined || value === "") return null;
	const date = new Date(String(value));
	return Number.isNaN(date.getTime()) ? null : date;
}

// Coerce value based on field type
function coerceValue(field: UpdatableFCRField, value: unknown): unknown {
	const fieldType = FIELD_TYPES[field];

	switch (fieldType) {
		case "string":
			return toStringValue(value);
		case "float":
			return toFloatValue(value);
		case "int":
			// Schema uses Float for quantity in FCR but let's be safe
			return toFloatValue(value);
		case "boolean":
			return toBooleanValue(value);
		case "datetime":
			return toDateTimeValue(value);
		default:
			return value;
	}
}

/**
 * PATCH /api/trucking-followup/fcr/update
 * Update a single field of an FCR record
 * When containerId is updated, also sync containerNo and grossWeight from the container
 */
export async function PATCH(request: NextRequest) {
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
		const { id, field, value } = body;

		if (!id || !field) {
			return NextResponse.json(
				{ message: "Missing required fields: id and field" },
				{ status: 400 },
			);
		}

		if (!(field in FIELD_TYPES)) {
			return NextResponse.json(
				{ message: `Field '${field}' is not updatable` },
				{ status: 400 },
			);
		}

		const coercedValue = coerceValue(field as UpdatableFCRField, value);

		// Read old FCR value for logging
		const existingFCR = await prismaRPA.fCR.findUnique({
			where: { id },
			select: {
				[field]: true,
				truckType: true,
				tTypeC: true,
				truckingNumberId: true,
				plateNumber: true,
				truckingFollowUpId: true,
				truckingNumber: { select: { isVendor: true } },
				truckingFollowUp: { select: { domain: true } },
			},
		});
		const oldValue = existingFCR ? (existingFCR as any)[field] : undefined;

		// If updating containerId, also sync containerNo, grossWeight, tTypeC and truckType from the container
		if (field === "containerId" && coercedValue) {
			const container = await prismaRPA.container.findUnique({
				where: { id: coercedValue as string },
				select: {
					containerNo: true,
					grossWeight: true,
					containerSize: true,
					packageQty: true,
				},
			});

			if (container) {
				const updatedFCR = await prismaRPA.fCR.update({
					where: { id },
					data: {
						containerId: coercedValue as string,
						containerNo: container.containerNo,
						grossWeight: container.grossWeight,
						// Sync tTypeC và truckType từ containerSize
						tTypeC: container.containerSize,
						truckType: container.containerSize,
						quantity: container.packageQty,
					},
				});

				// Sync Gross Weight to parent TruckingFollowUp
				if (updatedFCR.truckingFollowUpId) {
					await syncTruckingGrossWeight(updatedFCR.truckingFollowUpId).catch(
						console.error,
					);
					logTruckingActivity(updatedFCR.truckingFollowUpId, {
						userId: session.user.id,
						userName: session.user.name,
						action: "UPDATE_FCR",
						subResource: "fcr",
						subResourceId: id,
						field,
						oldValue,
						newValue: coercedValue,
					});
				}

				return NextResponse.json(updatedFCR, { status: 200 });
			}
		}

		// If clearing containerId, also clear containerNo, tTypeC and truckType
		if (field === "containerId" && !coercedValue) {
			const updatedFCR = await prismaRPA.fCR.update({
				where: { id },
				data: {
					containerId: null,
					containerNo: null,
					tTypeC: null,
					truckType: null,
				},
			});

			// Sync Gross Weight to parent TruckingFollowUp
			if (updatedFCR.truckingFollowUpId) {
				await syncTruckingGrossWeight(updatedFCR.truckingFollowUpId).catch(
					console.error,
				);
				logTruckingActivity(updatedFCR.truckingFollowUpId, {
					userId: session.user.id,
					userName: session.user.name,
					action: "UPDATE_FCR",
					subResource: "fcr",
					subResourceId: id,
					field,
					oldValue,
					newValue: null,
				});
			}

			return NextResponse.json(updatedFCR, { status: 200 });
		}

		// If clearing plateNumber, unassign from dispatch slot as well
		// so it no longer appears under assigned truck/vendor in Dispatch board.
		if (field === "plateNumber" && !coercedValue) {
			const updatedFCR = await prismaRPA.fCR.update({
				where: { id },
				data: {
					plateNumber: null,
					truckingNumberId: null,
					tripNumber: 1,
					driver: null,
					truckType: null,
					tTypeC: null,
					vendor: null,
				},
			});

			const truckingFollowUpId =
				updatedFCR.truckingFollowUpId ?? existingFCR?.truckingFollowUpId;
			if (truckingFollowUpId) {
				logTruckingActivity(truckingFollowUpId, {
					userId: session.user.id,
					userName: session.user.name,
					action: "UPDATE_FCR",
					subResource: "fcr",
					subResourceId: id,
					field,
					oldValue,
					newValue: null,
				});
			}

			return NextResponse.json(updatedFCR, { status: 200 });
		}

		// If clearing vendor and current truckingNumberId is not a truck slot,
		// also clear truckingNumberId so Dispatch no longer keeps vendor assignment.
		if (field === "vendor" && !coercedValue) {
			const isTruckAssignment =
				!!existingFCR?.truckingNumberId &&
				existingFCR.truckingNumber?.isVendor !== true;

			const updatedFCR = await prismaRPA.fCR.update({
				where: { id },
				data: isTruckAssignment
					? { vendor: null }
					: {
							vendor: null,
							truckingNumberId: null,
							tripNumber: 1,
							plateNumber: null,
							driver: null,
							truckType: null,
							tTypeC: null,
						},
			});

			const truckingFollowUpId =
				updatedFCR.truckingFollowUpId ?? existingFCR?.truckingFollowUpId;
			if (truckingFollowUpId) {
				logTruckingActivity(truckingFollowUpId, {
					userId: session.user.id,
					userName: session.user.name,
					action: "UPDATE_FCR",
					subResource: "fcr",
					subResourceId: id,
					field,
					oldValue,
					newValue: null,
				});
			}

			return NextResponse.json(updatedFCR, { status: 200 });
		}

		// If setting vendor from FCR table, sync to dispatch vendor slot
		// (bind truckingNumberId + tripNumber=0) similar to plate mapping flow.
		if (field === "vendor" && coercedValue) {
			const vendorName = String(coercedValue).trim();
			const hasTruckAssigned =
				!!existingFCR?.plateNumber ||
				(!!existingFCR?.truckingNumberId &&
					existingFCR.truckingNumber?.isVendor !== true);

			// Truck always has higher priority than vendor.
			// If FCR is already assigned to a real truck, keep truckingNumberId unchanged.
			if (hasTruckAssigned) {
				const updatedFCR = await prismaRPA.fCR.update({
					where: { id },
					data: { vendor: vendorName },
				});

				const truckingFollowUpId =
					updatedFCR.truckingFollowUpId ?? existingFCR?.truckingFollowUpId;
				if (truckingFollowUpId) {
					logTruckingActivity(truckingFollowUpId, {
						userId: session.user.id,
						userName: session.user.name,
						action: "UPDATE_FCR",
						subResource: "fcr",
						subResourceId: id,
						field,
						oldValue,
						newValue: vendorName,
					});
				}

				return NextResponse.json(updatedFCR, { status: 200 });
			}

			const followUpDomain = (existingFCR as any)?.truckingFollowUp?.domain as
				| string
				| null
				| undefined;
			const site =
				followUpDomain && Object.values(Site).includes(followUpDomain as Site)
					? (followUpDomain as Site)
					: null;

			let vendorSlot = await prismaRPA.truckingNumber.findFirst({
				where: {
					isVendor: true,
					vendorName,
					...(site ? { site } : {}),
				},
				select: { id: true },
			});

			if (!vendorSlot && site) {
				vendorSlot = await prismaRPA.truckingNumber.create({
					data: {
						plateNumber: "",
						isVendor: true,
						vendorName,
						site,
						createdBy: session.user.id,
					},
					select: { id: true },
				});
			}

			const updatedFCR = await prismaRPA.fCR.update({
				where: { id },
				data: {
					vendor: vendorName,
					truckingNumberId: vendorSlot?.id ?? null,
					tripNumber: vendorSlot ? 0 : undefined,
					plateNumber: null,
					driver: null,
					truckType: null,
					tTypeC: null,
				},
			});

			const truckingFollowUpId =
				updatedFCR.truckingFollowUpId ?? existingFCR?.truckingFollowUpId;
			if (truckingFollowUpId) {
				logTruckingActivity(truckingFollowUpId, {
					userId: session.user.id,
					userName: session.user.name,
					action: "UPDATE_FCR",
					subResource: "fcr",
					subResourceId: id,
					field,
					oldValue,
					newValue: vendorName,
				});
			}

			return NextResponse.json(updatedFCR, { status: 200 });
		}

		const updateData: Record<string, unknown> = {
			[field]: coercedValue,
		};

		if (coercedValue && field === "truckType" && !existingFCR?.tTypeC) {
			updateData.tTypeC = coercedValue;
		}

		if (coercedValue && field === "tTypeC" && !existingFCR?.truckType) {
			updateData.truckType = coercedValue;
		}

		const updatedFCR = await prismaRPA.fCR.update({
			where: { id },
			data: updateData,
			include: {
				truckingFollowUp: {
					select: {
						id: true,
						requestNumber: true,
						jobNumber: true,
						containers: { select: { id: true } },
					},
				},
			},
		});

		// Sync implementationDate to Parent TruckingFollowUp and other FCRs + FollowUp
		if (field === "implementationDate" && updatedFCR.truckingFollowUp) {
			if (updatedFCR.truckingFollowUp.containers.length === 0) {
				const newDate = coercedValue as Date | null;
				const jobId = updatedFCR.truckingFollowUp.id;

				// Sync to parent
				await prismaRPA.truckingFollowUp.update({
					where: { id: jobId },
					data: { implementationDate: newDate },
				});

				// Sync to OTHER FCRs of the same job
				await prismaRPA.fCR.updateMany({
					where: { truckingFollowUpId: jobId, id: { not: id } },
					data: { implementationDate: newDate },
				});

				// Sync to Logistics FollowUp
				const orConditions: any[] = [];
				if (updatedFCR.truckingFollowUp.requestNumber) {
					orConditions.push({
						requestTruckingNo: updatedFCR.truckingFollowUp.requestNumber,
					});
				}
				if (updatedFCR.truckingFollowUp.jobNumber) {
					orConditions.push({
						jobNumber: updatedFCR.truckingFollowUp.jobNumber,
					});
				}

				if (orConditions.length > 0) {
					await prismaRPA.followUp.updateMany({
						where: {
							OR: orConditions,
							isDeleted: false,
						},
						data: { deliveryDate: newDate },
					});
				}
			}
		}

		// Sync Gross Weight to parent TruckingFollowUp if grossWeight was updated
		if (field === "grossWeight" && updatedFCR.truckingFollowUpId) {
			await syncTruckingGrossWeight(updatedFCR.truckingFollowUpId).catch(
				console.error,
			);
		}

		// Log activity (fire-and-forget)
		const truckingFollowUpId =
			updatedFCR.truckingFollowUpId ?? existingFCR?.truckingFollowUpId;
		if (truckingFollowUpId) {
			logTruckingActivity(truckingFollowUpId, {
				userId: session.user.id,
				userName: session.user.name,
				action: "UPDATE_FCR",
				subResource: "fcr",
				subResourceId: id,
				field,
				oldValue,
				newValue: coercedValue,
			});
		}

		return NextResponse.json(updatedFCR, { status: 200 });
	} catch (error) {
		console.error("Error updating FCR field:", error);
		return NextResponse.json(
			{
				message: "Failed to update FCR field",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
