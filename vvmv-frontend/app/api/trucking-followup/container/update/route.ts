import { type NextRequest, NextResponse } from "next/server";
import {
	logFollowUpActivity,
	logTruckingActivity,
} from "@/lib/activity-logger";
import { auth } from "@/lib/auth";
import { prismaRPA, queryERPHAN, queryERPHCM } from "@/lib/db";
import { blockIfAccounting } from "@/lib/guards/accounting-guard";
import {
	findRelatedTruckingIds,
	syncTruckingGrossWeight,
} from "@/lib/trucking/gross-weight-sync";
import { Site } from "@/prisma/client";

// Updatable fields derived from Container type
type UpdatableContainerField =
	| "containerNo"
	| "sealNo"
	| "grossWeight"
	| "packageQty"
	| "masGross"
	| "tareWeight"
	| "containerType"
	| "kc"
	| "closingTime"
	| "cutOffTime"
	| "cutOffAtPort"
	| "vesselName"
	| "veselNumber"
	| "pickOrLiftPlace"
	| "blockCode"
	| "maLo"
	| "soDangKy"
	| "vatTaxCode"
	| "containerSize"
	| "noEport"
	| "vendor"
	| "implementationDate"
	| "emptyReturnDeadline"
	| "plateNumber"
	| "warehouse"
	| "portLocation"
	| "podUrl";

// Field type mapping for coercion
const FIELD_TYPES: Record<
	UpdatableContainerField,
	"string" | "float" | "date" | "boolean"
> = {
	containerNo: "string",
	sealNo: "string",
	grossWeight: "float",
	packageQty: "float",
	masGross: "float",
	tareWeight: "float",
	containerType: "string",
	kc: "string",
	closingTime: "date",
	cutOffTime: "date",
	cutOffAtPort: "date",
	vesselName: "string",
	veselNumber: "string",
	pickOrLiftPlace: "string",
	blockCode: "string",
	maLo: "string",
	soDangKy: "string",
	vatTaxCode: "string",
	containerSize: "string",
	noEport: "boolean",
	vendor: "string",
	implementationDate: "date",
	emptyReturnDeadline: "string",
	plateNumber: "string",
	warehouse: "string",
	portLocation: "string",
	podUrl: "string",
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

function toBooleanValue(value: unknown): boolean {
	if (typeof value === "boolean") return value;
	return value === "true" || value === 1 || value === "1";
}

function normalizePlateNumber(value: string): string {
	return value.replace(/[\s\-.]/g, "").toUpperCase();
}

// Coerce value based on field type
function coerceValue(field: UpdatableContainerField, value: unknown): unknown {
	const fieldType = FIELD_TYPES[field];

	switch (fieldType) {
		case "string":
			return toStringValue(value);
		case "float":
			return toFloatValue(value);
		case "date":
			return value ? new Date(value as string) : null;
		case "boolean":
			return toBooleanValue(value);
		default:
			return value;
	}
}

/**
 * PATCH /api/trucking-followup/container/update
 * Update a single field of a Container record
 * Also syncs data to related FCRs:
 * - containerNo        -> FCR.containerNo
 * - grossWeight        -> FCR.grossWeight
 * - vendor             -> FCR.vendor
 * - implementationDate -> FCR.implementationDate
 * - plateNumber        -> FCR.plateNumber + auto-fill FCR.driver from TruckingNumber
 * - containerSize      -> FCR.tTypeC and FCR.truckType
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

		// Verify container exists
		const container = await prismaRPA.container.findUnique({
			where: { id },
			select: {
				id: true,
				followUpId: true,
				truckingFollowUpId: true,
				vendor: true,
				plateNumber: true,
				warehouse: true,
				[field]: true,
				truckingFollowUp: {
					select: {
						domain: true,
					},
				},
			},
		});

		if (!container) {
			return NextResponse.json(
				{ message: "Container not found" },
				{ status: 404 },
			);
		}

		const coercedValue = coerceValue(field as UpdatableContainerField, value);
		const oldValue = (container as any)[field];

		// ── Duplicate containerNo check ────────────────────────────────────────
		if (field === "containerNo" && coercedValue) {
			// Build scope filter: same followUpId OR same truckingFollowUpId
			const scopeFilter: any[] = [];
			if (container.followUpId) {
				scopeFilter.push({ followUpId: container.followUpId });
			}
			if (container.truckingFollowUpId) {
				scopeFilter.push({ truckingFollowUpId: container.truckingFollowUpId });
			}

			if (scopeFilter.length > 0) {
				const duplicate = await prismaRPA.container.findFirst({
					where: {
						AND: [
							{ OR: scopeFilter },
							{
								containerNo: {
									equals: coercedValue as string,
									mode: "insensitive",
								},
							},
							{ id: { not: id } }, // exclude current container
						],
					},
					select: { id: true, containerNo: true },
				});

				if (duplicate) {
					return NextResponse.json(
						{
							message: `Số container "${coercedValue}" đã tồn tại trong job này.`,
						},
						{ status: 400 },
					);
				}
			}
		}

		const updatedContainer = await prismaRPA.container.update({
			where: { id },
			data: { [field]: coercedValue },
		});

		// Sync simple container fields to related FCRs.
		if (
			field === "containerNo" ||
			field === "grossWeight" ||
			field === "packageQty" ||
			field === "implementationDate" ||
			field === "warehouse"
		) {
			await prismaRPA.fCR.updateMany({
				where: { containerId: id },
				data:
					field === "packageQty"
						? { quantity: coercedValue as number | null }
						: { [field]: coercedValue },
			});
		}

		if (field === "vendor" || field === "plateNumber") {
			let relatedFcrs = await prismaRPA.fCR.findMany({
				where: { containerId: id },
				select: {
					id: true,
					truckingNumberId: true,
					plateNumber: true,
					truckingFollowUp: {
						select: { domain: true },
					},
				},
			});

			// Fallback: some legacy/manual rows have matching containerNo but missing containerId link.
			// In that case, include FCRs in the same trucking job by containerNo so vendor sync is not skipped.
			if (
				relatedFcrs.length === 0 &&
				container.truckingFollowUpId &&
				updatedContainer.containerNo
			) {
				const fallbackFcrs = await prismaRPA.fCR.findMany({
					where: {
						truckingFollowUpId: container.truckingFollowUpId,
						containerNo: {
							equals: updatedContainer.containerNo,
							mode: "insensitive",
						},
					},
					select: {
						id: true,
						truckingNumberId: true,
						plateNumber: true,
						truckingFollowUp: {
							select: { domain: true },
						},
					},
				});

				relatedFcrs = fallbackFcrs;
			}

			const vendorName =
				field === "vendor"
					? (coercedValue as string | null)
					: (updatedContainer.vendor ?? null);
			const plateNumber =
				field === "plateNumber"
					? (coercedValue as string | null)
					: (updatedContainer.plateNumber ?? null);
			const _containerSizeType = updatedContainer.containerSize ?? null;
			// Primary: site từ container. Fallback: lấy từ FCR's truckingFollowUp khi container không có truckingFollowUpId
			const rawDomain =
				container.truckingFollowUp?.domain ??
				relatedFcrs.find((f) => f.truckingFollowUp?.domain)?.truckingFollowUp
					?.domain ??
				null;
			const site =
				rawDomain && Object.values(Site).includes(rawDomain as Site)
					? (rawDomain as Site)
					: null;

			let vendorSlotId: string | null = null;
			if (vendorName && site) {
				let vendorSlot = await prismaRPA.truckingNumber.findFirst({
					where: {
						isVendor: true,
						vendorName,
						site,
					},
					select: { id: true },
				});

				if (!vendorSlot) {
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

				vendorSlotId = vendorSlot.id;
			}

			let matchedTruck: {
				id: string;
				driverName: string | null;
				vehicleType: string | null;
			} | null = null;

			if (plateNumber) {
				const rawPlate = normalizePlateNumber(plateNumber);
				const truckingCandidates = await prismaRPA.truckingNumber.findMany({
					where: {
						isVendor: false,
						plateNumber: {
							contains: rawPlate.substring(0, 3),
							mode: "insensitive",
						},
						...(site ? { site } : {}),
					},
					select: {
						id: true,
						plateNumber: true,
						driverName: true,
						vehicleType: true,
					},
				});

				matchedTruck =
					truckingCandidates.find(
						(candidate) =>
							normalizePlateNumber(candidate.plateNumber) === rawPlate,
					) ?? null;

				// Auto-create truckingNumber if plate not found
				if (!matchedTruck && site) {
					try {
						const newTruck = await prismaRPA.truckingNumber.create({
							data: {
								plateNumber,
								isVendor: false,
								site,
								createdBy: session.user.id,
							},
							select: { id: true, driverName: true, vehicleType: true },
						});
						matchedTruck = newTruck;

						// Upsert into ERP VehicleList (fire-and-forget, DAD skipped)
						if (site !== "DAD") {
							const erpQuery = site === "SGN" ? queryERPHCM : queryERPHAN;
							const deptId = site === "SGN" ? "SGDP006" : "DP003";
							const userInput =
								site === "SGN" ? "adminsgn@vvmv.com.vn" : "hoattq@vvmv.com.vn";
							erpQuery(
								`IF NOT EXISTS (SELECT 1 FROM dbo.VehicleList WHERE VHUnitNo = @plateNumber)
                 BEGIN
                   INSERT INTO dbo.VehicleList
                     (VHUnitNo, VHFuelConsumption, VHDeptID, VHCost, Inuse, UserInput, DateInput, DateModify, Remooc, MaximumCapacity, MaximumCBM)
                   VALUES
                     (@plateNumber, 0, @deptId, 0, 1, @userInput, GETDATE(), GETDATE(), 0, 0, 0)
                 END`,
								{ plateNumber, deptId, userInput },
							).catch((err: any) =>
								console.warn(
									`[ERP upsert] ${plateNumber} (${site}):`,
									err.message,
								),
							);
						}
					} catch (createErr: any) {
						console.warn(
							`[Auto-create truckingNumber] ${plateNumber}:`,
							createErr.message,
						);
					}
				}
			}

			await Promise.all(
				relatedFcrs.map((fcr) => {
					if (matchedTruck) {
						return prismaRPA.fCR.update({
							where: { id: fcr.id },
							data: {
								vendor: vendorName,
								plateNumber,
								truckingNumberId: matchedTruck.id,
								tripNumber: 1,
								driver: matchedTruck.driverName,
								tTypeC:
									field === "plateNumber"
										? matchedTruck.vehicleType || undefined
										: undefined,
								truckType:
									field === "plateNumber"
										? matchedTruck.vehicleType || undefined
										: undefined,
							},
						});
					}

					if (vendorName && vendorSlotId) {
						return prismaRPA.fCR.update({
							where: { id: fcr.id },
							data: {
								vendor: vendorName,
								plateNumber,
								truckingNumberId: vendorSlotId,
								tripNumber: 0,
								driver: null,
								tTypeC: undefined,
								truckType: undefined,
							},
						});
					}

					return prismaRPA.fCR.update({
						where: { id: fcr.id },
						data: {
							vendor: vendorName,
							plateNumber,
							truckingNumberId: null,
							tripNumber: 1,
							driver: null,
							tTypeC: undefined,
							truckType: undefined,
						},
					});
				}),
			);
		}

		// Sync containerSize to FCR tTypeC and truckType
		if (field === "containerSize") {
			await prismaRPA.fCR.updateMany({
				where: { containerId: id },
				data: {
					tTypeC: coercedValue as string | null,
					truckType: coercedValue as string | null,
				},
			});
		}

		// 6. Sync Gross Weight to parent TruckingFollowUp(s)
		if (field === "grossWeight") {
			const truckingIds = await findRelatedTruckingIds(id);
			for (const tfId of truckingIds) {
				await syncTruckingGrossWeight(tfId).catch(console.error);
			}
		}

		// 6.5 Sync Container.warehouse → FollowUp.warehouse (logistics bidirectional)
		if (field === "warehouse" && container.followUpId) {
			await prismaRPA.followUp
				.update({
					where: { id: container.followUpId },
					data: { warehouse: coercedValue as string | null },
				})
				.catch(console.error);
		}

		// 7. Log activity (fire-and-forget)
		if (container.truckingFollowUpId) {
			// Trucking container → log to TruckingActivityLog
			logTruckingActivity(container.truckingFollowUpId, {
				userId: session.user.id,
				userName: session.user.name,
				action: "UPDATE_CONTAINER",
				subResource: "container",
				subResourceId: id,
				field,
				oldValue,
				newValue: coercedValue,
			});
		} else if (container.followUpId) {
			// Logistics container → log to FollowUpActivityLog
			logFollowUpActivity(container.followUpId, {
				userId: session.user.id,
				userName: session.user.name,
				action: "UPDATE_CONTAINER",
				subResource: "container",
				subResourceId: id,
				field,
				oldValue,
				newValue: coercedValue,
			});
		}

		return NextResponse.json(updatedContainer, { status: 200 });
	} catch (error) {
		console.error("Error updating Container field:", error);
		return NextResponse.json(
			{
				message: "Failed to update Container field",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
