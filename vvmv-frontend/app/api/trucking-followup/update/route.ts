import { type NextRequest, NextResponse } from "next/server";
import { logTruckingActivity } from "@/lib/activity-logger";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { sendAutoOpsMail } from "@/lib/trucking/ops-auto-mail";
import { cleanPlateNumber } from "@/lib/trucking/plate-utils";
import { Site, type TruckingFollowUp } from "@/prisma/client";

// Updatable fields derived from TruckingFollowUp type
type UpdatableTruckingField =
	| Exclude<
			keyof TruckingFollowUp,
			"id" | "createdAt" | "updatedAt" | "createdBy"
	  >
	| "tTypeC";

// Fields that should not be updated via this endpoint
const NON_UPDATABLE_FIELDS = new Set([
	"id",
	"createdAt",
	"updatedAt",
	"createdBy",
]);

// Field type mapping for coercion
const FIELD_TYPES: Record<
	UpdatableTruckingField,
	"string" | "datetime" | "float" | "int" | "boolean" | "stringArray"
> = {
	botMessage: "string",
	handler: "string",
	requestNumber: "string",
	jobNumber: "string",
	serviceMode: "string",
	operationType: "string",
	cbm: "float",
	grossWeight: "float",
	quantity: "int",
	companyName: "string",
	taxCode: "string",
	vendor: "string",
	billOrBooking: "string",
	closingTime: "datetime",
	cutOffTime: "datetime",
	vesselName: "string",
	veselNumber: "string",
	carrierName: "string",
	routineDetail: "string",
	note: "string",
	note2: "string",
	note3: "string",
	note4: "string",
	note5: "string",
	fromLocation: "string",
	toLocation: "string",
	truckType: "string",
	pickOrLiftPlace: "string",
	commodityName: "string",
	warehouse: "string",
	pickUpTime: "string",
	ccgh: "stringArray",
	driveUrl: "string",
	localPath: "string",
	authority: "string",
	maLo: "string",
	transitPort: "string",
	destinationPort: "string",
	deliveryContactDetail: "string",
	eportService: "string",
	eportBooking: "string",
	maNhanConmt: "string",
	soLenh: "string",
	ngatDienDate: "datetime",
	implementationDate: "datetime",
	isDeleted: "boolean",
	domain: "string",
	isFinished: "boolean",
	parentJobNumber: "string",
	transactionCode: "string",
	amount: "float",
	invoiceTaxCode: "string",
	ops: "string",
	hsCode: "string",
	donViKhuTrung: "string",
	temperature: "float",
	payDate: "datetime",
	bbbt: "string",
	clientName: "string",
	pvst: "boolean",
	bienBanBT: "boolean",
	checkNhapKho: "string",
	tTypeC: "string",
};

// Validate field is updatable
function isUpdatableField(field: string): field is UpdatableTruckingField {
	return !NON_UPDATABLE_FIELDS.has(field) && field in FIELD_TYPES;
}

// Type coercion helpers
function toStringValue(value: unknown): string | null {
	if (value === null || value === undefined || value === "") return null;
	return String(value);
}

function toDateValue(value: unknown): Date | null {
	if (value === null || value === undefined || value === "") return null;
	const date = new Date(String(value));
	return Number.isNaN(date.getTime()) ? null : date;
}

function toFloatValue(value: unknown): number | null {
	if (value === null || value === undefined || value === "") return null;
	const num = Number.parseFloat(String(value));
	return Number.isNaN(num) ? null : num;
}

function toIntValue(value: unknown): number | null {
	if (value === null || value === undefined || value === "") return null;
	const num = Number.parseInt(String(value), 10);
	return Number.isNaN(num) ? null : num;
}

function toStringArrayValue(value: unknown): string[] {
	if (value === null || value === undefined) return [];
	if (Array.isArray(value)) {
		return value
			.filter((v) => v !== null && v !== undefined && v !== "")
			.map((v) => String(v));
	}
	// If it's a single string, wrap it in an array
	if (typeof value === "string" && value !== "") {
		return [value];
	}
	return [];
}

// Coerce value based on field type
function coerceValue(field: UpdatableTruckingField, value: unknown): unknown {
	const fieldType = FIELD_TYPES[field];

	switch (fieldType) {
		case "string":
			return toStringValue(value);
		case "datetime":
			return toDateValue(value);
		case "float":
			return toFloatValue(value);
		case "int":
			return toIntValue(value);
		case "boolean":
			return value === true || value === "true";
		case "stringArray":
			return toStringArrayValue(value);
		default:
			return value;
	}
}

/**
 * PATCH /api/trucking-followup/update
 * Update a single field of a TruckingFollowUp record
 */
export async function PATCH(request: NextRequest) {
	try {
		// 1. Authenticate user
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		// 2. Parse request body
		const body = await request.json();
		const { id, field, value, matchedPlateNumber } = body;

		// 3. Validate required fields
		if (!id) {
			return NextResponse.json(
				{ message: "Missing required field: id" },
				{ status: 400 },
			);
		}

		if (!field) {
			return NextResponse.json(
				{ message: "Missing required field: field" },
				{ status: 400 },
			);
		}

		// 4. Validate field is updatable
		if (!isUpdatableField(field)) {
			return NextResponse.json(
				{ message: `Field '${field}' is not updatable` },
				{ status: 400 },
			);
		}

		// 5. Verify the record exists and check for containers if updating grossWeight
		const existingRecord = await prismaRPA.truckingFollowUp.findUnique({
			where: { id },
			include: {
				containers: { select: { id: true } },
			},
		});

		if (!existingRecord) {
			return NextResponse.json(
				{ message: "TruckingFollowUp record not found" },
				{ status: 404 },
			);
		}

		// Block Accounting department users — view-only access
		const actingUser = await prismaRPA.user.findUnique({
			where: { id: session.user.id },
			select: {
				role: true,
				departmentAssignments: {
					select: { department: { select: { name: true } } },
				},
				teamLeaderships: {
					include: {
						team: { include: { department: { select: { name: true } } } },
					},
				},
				teamMemberships: {
					include: {
						team: { include: { department: { select: { name: true } } } },
					},
				},
			},
		});
		if (actingUser) {
			const isAdmin =
				actingUser.role === "ADMIN" || actingUser.role === "SUPERADMIN";
			if (!isAdmin) {
				const deptNames = new Set<string>();
				actingUser.departmentAssignments.forEach((da: any) => {
					if (da.department?.name) deptNames.add(da.department.name);
				});
				actingUser.teamLeaderships?.forEach((tl: any) => {
					if (tl.team?.department?.name) deptNames.add(tl.team.department.name);
				});
				actingUser.teamMemberships?.forEach((tm: any) => {
					if (tm.team?.department?.name) deptNames.add(tm.team.department.name);
				});
				if (deptNames.has("Accounting")) {
					return NextResponse.json(
						{
							message:
								"Accounting department has view-only access to trucking follow-ups",
						},
						{ status: 403 },
					);
				}
			}
		}

		// Check for linked containers or FCRs
		if (field === "grossWeight") {
			const linkedContainersCount = await prismaRPA.container.count({
				where: {
					followUp: {
						OR: [
							{
								requestTruckingNo: existingRecord.requestNumber || "undefined",
							},
							{ jobNumber: existingRecord.jobNumber || "undefined" },
						],
					},
				},
			});

			const fcrCount = await prismaRPA.fCR.count({
				where: { truckingFollowUpId: id },
			});

			// Allow editing if no containers and AT MOST 1 FCR
			if (
				existingRecord.containers.length > 0 ||
				linkedContainersCount > 0 ||
				fcrCount > 1
			) {
				return NextResponse.json(
					{
						message:
							"Cannot edit Gross Weight manually when containers or multiple FCRs are present. GW is automatically calculated.",
					},
					{ status: 400 },
				);
			}
		}

		// 6. Special handling for implementationDate:
		// Push implementationDate down to all FCRs AND Containers.
		// We do NOT persist it on TruckingFollowUp itself (FCR/Container is the source of truth).
		// 6. Unified Synchronization Handler
		// Maps fields where FCR or Container (or both) are the source of truth.
		// These fields are NOT persisted on the main TruckingFollowUp record.
		const SYNC_CONFIG: Record<
			string,
			{ fcr?: string; container?: string; type: "date" | "string" | "boolean" }
		> = {
			implementationDate: {
				fcr: "implementationDate",
				container: "implementationDate",
				type: "date",
			},
			vendor: { fcr: "vendor", container: "vendor", type: "string" },
			truckType: { fcr: "truckType", type: "string" },
			tTypeC: { fcr: "tTypeC", type: "string" },
			fromLocation: { fcr: "pickupAt", type: "string" },
			toLocation: { fcr: "deliveryAt", type: "string" },
			cutOffTime: { container: "cutOffTime", type: "date" },
			closingTime: { container: "closingTime", type: "date" },
			vesselName: { container: "vesselName", type: "string" },
			veselNumber: { container: "veselNumber", type: "string" },
			pickOrLiftPlace: { container: "pickOrLiftPlace", type: "string" },
			maLo: { container: "maLo", type: "string" },
			invoiceTaxCode: { container: "vatTaxCode", type: "string" },
			warehouse: { fcr: "warehouse", container: "warehouse", type: "string" },
			ops: { fcr: "ops", type: "string" },
			bienBanBT: { fcr: "bienBanBT", type: "boolean" },
		};

		if (field in SYNC_CONFIG) {
			const config = SYNC_CONFIG[field];
			const coercedValue =
				config.type === "date"
					? toDateValue(value)
					: config.type === "boolean"
						? value === true || value === "true"
						: toStringValue(value);

			// A. Sync to FCRs
			if (config.fcr) {
				if (field === "vendor") {
					const fcrs = await prismaRPA.fCR.findMany({
						where: { truckingFollowUpId: id },
						select: {
							id: true,
							truckingNumberId: true,
							plateNumber: true,
						},
					});

					const slotIds = [
						...new Set(fcrs.map((f) => f.truckingNumberId).filter(Boolean)),
					] as string[];
					const slots = slotIds.length
						? await prismaRPA.truckingNumber.findMany({
								where: { id: { in: slotIds } },
								select: { id: true, isVendor: true },
							})
						: [];
					const slotTypeMap = new Map(slots.map((s) => [s.id, s.isVendor]));

					const vendorName =
						typeof coercedValue === "string" ? coercedValue.trim() : null;

					let vendorSlotId: string | null = null;
					if (vendorName) {
						const site =
							existingRecord.domain &&
							Object.values(Site).includes(existingRecord.domain as Site)
								? (existingRecord.domain as Site)
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

						vendorSlotId = vendorSlot?.id ?? null;
					}

					await Promise.all(
						fcrs.map((fcr) => {
							const isTruckAssignment =
								!!fcr.plateNumber ||
								(!!fcr.truckingNumberId &&
									slotTypeMap.get(fcr.truckingNumberId) !== true);

							if (vendorName) {
								if (isTruckAssignment) {
									return prismaRPA.fCR.update({
										where: { id: fcr.id },
										data: { vendor: vendorName },
									});
								}
								return prismaRPA.fCR.update({
									where: { id: fcr.id },
									data: {
										vendor: vendorName,
										truckingNumberId: vendorSlotId,
										tripNumber: vendorSlotId ? 0 : 1,
										plateNumber: null,
									},
								});
							}

							// Clearing vendor
							if (isTruckAssignment) {
								return prismaRPA.fCR.update({
									where: { id: fcr.id },
									data: { vendor: null },
								});
							}

							return prismaRPA.fCR.update({
								where: { id: fcr.id },
								data: {
									vendor: null,
									truckingNumberId: null,
									tripNumber: 1,
									plateNumber: null,
								},
							});
						}),
					);
				} else if (field === "truckType" || field === "tTypeC") {
					const fcrs = await prismaRPA.fCR.findMany({
						where: { truckingFollowUpId: id },
						select: {
							id: true,
							truckType: true,
							tTypeC: true,
						},
					});

					await Promise.all(
						fcrs.map((fcr) => {
							const fcrUpdateData: Record<string, unknown> = {
								[config.fcr!]: coercedValue,
							};

							if (coercedValue && field === "truckType" && !fcr.tTypeC) {
								fcrUpdateData.tTypeC = coercedValue;
							}

							if (coercedValue && field === "tTypeC" && !fcr.truckType) {
								fcrUpdateData.truckType = coercedValue;
							}

							return prismaRPA.fCR.update({
								where: { id: fcr.id },
								data: fcrUpdateData,
							});
						}),
					);
				} else {
					await prismaRPA.fCR.updateMany({
						where: { truckingFollowUpId: id },
						data: { [config.fcr]: coercedValue },
					});
				}
			}

			// B. Sync to Containers (Direct + Logistics)
			if (config.container) {
				const containerField = config.container;

				// 1. Update containers directly linked via truckingFollowUpId
				await prismaRPA.container.updateMany({
					where: { truckingFollowUpId: id },
					data: { [containerField]: coercedValue },
				});

				// 2. Also update containers linked via logistics FollowUp (requestTruckingNo / jobNumber)
				const orConditions: any[] = [];
				if (existingRecord.requestNumber) {
					orConditions.push({
						requestTruckingNo: existingRecord.requestNumber,
					});
				}
				if (existingRecord.jobNumber) {
					orConditions.push({ jobNumber: existingRecord.jobNumber });
				}

				if (orConditions.length > 0) {
					const linkedFollowUps = await prismaRPA.followUp.findMany({
						where: { OR: orConditions, isDeleted: false },
						select: { id: true },
					});

					if (linkedFollowUps.length > 0) {
						const followUpIds = linkedFollowUps.map((f) => f.id);
						await prismaRPA.container.updateMany({
							where: { followUpId: { in: followUpIds } },
							data: { [containerField]: coercedValue },
						});
					}
				}
			}

			// C. Sync back to FollowUp (logistics) if no containers
			if (
				field === "implementationDate" &&
				existingRecord.containers.length === 0
			) {
				const orConditions: any[] = [];
				if (existingRecord.requestNumber) {
					orConditions.push({
						requestTruckingNo: existingRecord.requestNumber,
					});
				}
				if (existingRecord.jobNumber) {
					orConditions.push({ jobNumber: existingRecord.jobNumber });
				}

				if (orConditions.length > 0) {
					await prismaRPA.followUp.updateMany({
						where: {
							OR: orConditions,
							isDeleted: false,
						},
						data: { deliveryDate: coercedValue as Date | null },
					});
				}
			}

			logTruckingActivity(id, {
				userId: session.user.id,
				userName: session.user.name,
				action: "UPDATE_FIELD",
				field,
				oldValue: null,
				newValue: coercedValue,
			});

			if (
				field === "ops" &&
				typeof coercedValue === "string" &&
				coercedValue.trim().length > 0
			) {
				try {
					const tokenResult = await auth.api.getAccessToken({
						headers: request.headers,
						body: {
							providerId: "google",
						},
					});
					if (tokenResult?.accessToken && session.user.email) {
						// Fire-and-forget
						sendAutoOpsMail(
							id,
							coercedValue,
							tokenResult.accessToken,
							session.user.email,
						).catch((err) => {
							console.error(
								"[Auto OPS Mail] Failed to send auto email for OPS:",
								err,
							);
						});
					}
				} catch (e: any) {
					console.error("Failed to get token for OPS auto mail:", e.message);
				}
			}

			return NextResponse.json({ success: true }, { status: 200 });
		}

		// 6.9. Coerce value to correct type
		const coercedValue = coerceValue(field, value);

		// 6.6 Capture old value for logging
		const oldValue = (existingRecord as any)[field];

		// 7. Update the field
		const updatedRecord = await prismaRPA.truckingFollowUp.update({
			where: { id },
			data: { [field]: coercedValue },
			include: {
				user: {
					select: {
						id: true,
						name: true,
						email: true,
						username: true,
						image: true,
					},
				},
				handlerUser: {
					select: {
						id: true,
						name: true,
						email: true,
						username: true,
						image: true,
					},
				},
			},
		});

		// 7.5 Log activity (fire-and-forget)
		logTruckingActivity(id, {
			userId: session.user.id,
			userName: session.user.name,
			action: "UPDATE_FIELD",
			field,
			oldValue,
			newValue: coercedValue,
		});

		// 10. Sync Gross Weight, CBM, Quantity to FCR if there's only one FCR
		if (field === "grossWeight" || field === "cbm" || field === "quantity") {
			const fcrs = await prismaRPA.fCR.findMany({
				where: { truckingFollowUpId: id },
			});

			if (fcrs.length === 1) {
				await prismaRPA.fCR.update({
					where: { id: fcrs[0].id },
					data: { [field]: coercedValue as number | null },
				});
			}
		}

		// 11. When note5 ("Thông tin xe") is updated and frontend matched a plate,
		//     sync plateNumber to FCRs + Containers
		if (field === "note5" && matchedPlateNumber) {
			const plateNumber = String(matchedPlateNumber).trim();
			const rawPlate = cleanPlateNumber(plateNumber);

			// Check trucking_numbers for driver + vehicle type info
			const truckingCandidates = await prismaRPA.truckingNumber.findMany({
				where: {
					plateNumber: {
						contains: rawPlate.substring(0, 3),
						mode: "insensitive",
					},
					site:
						existingRecord.domain &&
						Object.values(Site).includes(existingRecord.domain as Site)
							? (existingRecord.domain as Site)
							: undefined,
				},
				select: {
					id: true,
					plateNumber: true,
					driverName: true,
					vehicleType: true,
				},
			});
			const truckingRecord = truckingCandidates.find(
				(c) => cleanPlateNumber(c.plateNumber) === rawPlate,
			);

			// Sync to FCRs
			const fcrUpdateData: Record<string, any> = { plateNumber };
			if (truckingRecord) {
				fcrUpdateData.truckingNumberId = truckingRecord.id;
				if (truckingRecord.driverName?.trim())
					fcrUpdateData.driver = truckingRecord.driverName;
				if (truckingRecord.vehicleType?.trim())
					fcrUpdateData.truckType = truckingRecord.vehicleType;
			}

			await prismaRPA.fCR.updateMany({
				where: { truckingFollowUpId: id },
				data: fcrUpdateData,
			});

			// Sync to Containers
			await prismaRPA.container.updateMany({
				where: { truckingFollowUpId: id },
				data: { plateNumber },
			});

			console.log(
				`[note5 sync] Job ${id}: plate "${plateNumber}"${
					truckingRecord
						? ` + driver: ${truckingRecord.driverName}, type: ${truckingRecord.vehicleType}`
						: ""
				}`,
			);
		}

		return NextResponse.json(updatedRecord, { status: 200 });
	} catch (error) {
		console.error("Error updating trucking follow-up field:", error);
		return NextResponse.json(
			{
				message: "Failed to update trucking follow-up field",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
