import { type NextRequest, NextResponse } from "next/server";
import { logFollowUpActivity } from "@/lib/activity-logger";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { getSiteFromJobNumber } from "@/lib/utils/job-utils";
import type { FollowUp, OperationType, Site } from "@/prisma/client";

// Updatable fields derived from FollowUp type (excluding id, relations, and system fields)
type UpdatableFollowUpField = Exclude<
	keyof FollowUp,
	"id" | "createdAt" | "updatedAt" | "createdBy"
>;

// Fields that should not be updated via this endpoint
const NON_UPDATABLE_FIELDS = new Set([
	"id",
	"createdAt",
	"updatedAt",
	"createdBy",
]);

// Field type mapping for coercion
const FIELD_TYPES: Record<
	UpdatableFollowUpField,
	"string" | "datetime" | "float" | "int" | "operationType" | "site" | "boolean"
> = {
	botMessage: "string",
	operationType: "operationType",
	serviceMode: "string",
	taxCode: "string",
	companyName: "string",
	jobNumber: "string",
	driveUrl: "string",
	localPath: "string",
	notes: "string",
	cargoType: "string",
	cbm: "float",
	pickUpTime: "string",
	commodityName: "string",
	deliveryDate: "datetime",
	truckNumber: "string",
	location: "string",
	supervisionGate: "string",
	handler: "string",
	startTime: "datetime",
	endTime: "datetime",
	poNumber: "string",
	note2: "string",
	note3: "string",
	shmtDate: "datetime",
	domain: "site",
	arNumber: "string",
	pickupLocation: "string",
	loadingLocation: "string",
	transportMethod: "string",
	transportDate: "datetime",
	taxService: "string",
	coNumber: "string",
	unit: "string",
	workType: "string",
	pol: "string",
	pod: "string",
	warehouse: "string",
	authority: "string",
	quantity: "int",
	billOrBooking: "string",
	supplier: "string",
	invoice: "string",
	requestTruckingNo: "string",
	grossWeight: "float",
	etaEtd: "datetime",
	isDeleted: "boolean",
	jobPriority: "int",
	isFinished: "boolean",
};

// Validate field is updatable
function isUpdatableField(field: string): field is UpdatableFollowUpField {
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

function toOperationTypeEnum(value: unknown): OperationType | null {
	if (value === null || value === undefined || value === "") return null;
	const strValue = String(value);
	if (strValue === "XUAT" || strValue === "NHAP") {
		return strValue as OperationType;
	}
	return null;
}

function toSiteEnum(value: unknown): Site | null {
	if (value === null || value === undefined || value === "") return null;
	const strValue = String(value);
	if (strValue === "SGN" || strValue === "DAD" || strValue === "HAN") {
		return strValue as Site;
	}
	return null;
}

// Coerce value based on field type
function coerceValue(field: UpdatableFollowUpField, value: unknown): unknown {
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
		case "operationType":
			return toOperationTypeEnum(value);
		case "site":
			return toSiteEnum(value);
		case "boolean":
			return value === true || value === "true";
		default:
			return value;
	}
}

/**
 * PATCH /api/followup/update
 * Update a single field of a FollowUp record
 */
export async function PATCH(request: NextRequest) {
	try {
		// 1. Authenticate user with Better Auth
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		// 2. Parse request body
		const body = await request.json();
		const { id, field, value } = body;

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

		// 5. Verify the record exists and check permissions
		const existingRecord = await prismaRPA.followUp.findUnique({
			where: { id },
			select: {
				createdBy: true,
				domain: true,
				taxCode: true,
				jobNumber: true,
				cbm: true,
				createdAt: true,
				deliveryDate: true,
				requestTruckingNo: true,
			},
		});

		if (!existingRecord) {
			return NextResponse.json(
				{ message: "FollowUp record not found" },
				{ status: 404 },
			);
		}

		const isAdmin = session.user.role === "ADMIN";
		const isSuperAdmin = session.user.role === "SUPERADMIN";

		// Check if site-specific ADMIN is restricted by site (SUPERADMIN bypasses)
		if (isAdmin && !isSuperAdmin) {
			const adminUser = await prismaRPA.user.findUnique({
				where: { id: session.user.id },
				select: { site: true },
			});
			if (adminUser?.site && adminUser.site !== existingRecord.domain) {
				return NextResponse.json(
					{ message: "Access denied: Site mismatch" },
					{ status: 403 },
				);
			}
		}

		const currentUser = await prismaRPA.user.findUnique({
			where: { id: session.user.id },
			include: {
				departmentAssignments: {
					include: { department: { select: { name: true } } },
				},
				teamLeaderships: {
					include: {
						team: {
							include: {
								department: { select: { name: true } },
								members: { select: { userId: true } },
								leaders: { select: { userId: true } },
							},
						},
					},
				},
				teamMemberships: {
					include: {
						team: { include: { department: { select: { name: true } } } },
					},
				},
			},
		});

		if (!currentUser)
			return NextResponse.json({ message: "User not found" }, { status: 404 });

		const userDeptNames = new Set<string>();
		currentUser.departmentAssignments.forEach((da: any) =>
			userDeptNames.add(da.department.name),
		);
		currentUser.teamLeaderships.forEach((tl: any) => {
			if (tl.team?.department?.name) userDeptNames.add(tl.team.department.name);
		});
		currentUser.teamMemberships.forEach((tm: any) => {
			if (tm.team?.department?.name) userDeptNames.add(tm.team.department.name);
		});

		// Block Accounting department users — view-only access
		if (userDeptNames.has("Accounting") && !isAdmin && !isSuperAdmin) {
			return NextResponse.json(
				{ message: "Accounting department has view-only access to follow-ups" },
				{ status: 403 },
			);
		}

		const isAuthorizedManager =
			currentUser.role === "MANAGER" &&
			(userDeptNames.has("Logistics") || userDeptNames.has("Document"));
		const isOwner = existingRecord.createdBy === session.user.id;

		let isTeamLeaderOfOwner = false;
		currentUser.teamLeaderships.forEach((tl: any) => {
			if (
				tl.team.members.some(
					(m: any) => m.userId === existingRecord.createdBy,
				) ||
				tl.team.leaders.some((l: any) => l.userId === existingRecord.createdBy)
			)
				isTeamLeaderOfOwner = true;
		});

		if (
			!isOwner &&
			!isAdmin &&
			!isSuperAdmin &&
			!isAuthorizedManager &&
			!isTeamLeaderOfOwner
		) {
			return NextResponse.json(
				{ message: "You do not have permission to update this record" },
				{ status: 403 },
			);
		}

		// 5.5 Fetch old value for logging
		const oldValueRecord = await prismaRPA.followUp.findUnique({
			where: { id },
		});
		const oldValue = oldValueRecord
			? (oldValueRecord as any)[field]
			: undefined;

		// 6. Coerce value to correct type
		const coercedValue = coerceValue(field, value);

		// 6.5 Special check for billOrBooking duplicate
		if (field === "billOrBooking" && coercedValue) {
			const existing = await prismaRPA.followUp.findFirst({
				where: {
					billOrBooking: coercedValue as string,
					isDeleted: false,
					id: { not: id },
					domain: existingRecord.domain, // Check within the same site
				},
				select: { jobNumber: true },
			});

			if (existing) {
				return NextResponse.json(
					{
						message: `Bill/Booking already exists in job ${existing.jobNumber || "unknown"}${existingRecord.domain ? ` for site ${existingRecord.domain}` : ""}`,
					},
					{ status: 400 },
				);
			}
		}

		// 7. Update the field (with special logic for jobNumber)
		const updateData: any = { [field]: coercedValue };

		// New rule for etaEtd -> deliveryDate sync
		if (field === "etaEtd" && coercedValue) {
			if (!existingRecord.deliveryDate && existingRecord.domain === "SGN") {
				const computedDate = new Date(coercedValue as Date);
				computedDate.setDate(computedDate.getDate() + 2);
				updateData.deliveryDate = computedDate;
			}
		}

		// If jobNumber is being updated, also update domain based on prefix
		if (field === "jobNumber" && coercedValue) {
			updateData.domain = getSiteFromJobNumber(coercedValue as string);
		}

		// Special logic for tax_code 3702608267 and HCM jobs
		// When updating serviceMode to 'TC EXPORT' and CBM is null/empty
		if (
			field === "serviceMode" &&
			coercedValue === "TC EXPORT" &&
			existingRecord.taxCode === "3702608267" &&
			existingRecord.jobNumber?.startsWith("HCM") &&
			(existingRecord.cbm === null || existingRecord.cbm === undefined)
		) {
			const year = existingRecord.createdAt.getFullYear();
			const month = existingRecord.createdAt.getMonth();
			const startOfMonth = new Date(year, month, 1);
			const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

			const maxCbmRecord = await prismaRPA.followUp.findFirst({
				where: {
					taxCode: "3702608267",
					serviceMode: "TC EXPORT",
					jobNumber: {
						startsWith: "HCM",
					},
					cbm: {
						not: null,
					},
					isDeleted: false,
					createdAt: {
						gte: startOfMonth,
						lte: endOfMonth,
					},
				},
				orderBy: {
					cbm: "desc",
				},
				select: {
					cbm: true,
				},
			});

			const nextCbm = (maxCbmRecord?.cbm ?? 0) + 1;
			updateData.cbm = nextCbm;
		}

		const updatedRecord = await prismaRPA.followUp.update({
			where: { id },
			data: updateData,
		});

		// ── Sync warehouse from FollowUp → Containers (bidirectional) ─────────────
		const CONTAINER_SYNC_MAP: Record<string, string> = {
			warehouse: "warehouse",
		};

		if (field in CONTAINER_SYNC_MAP) {
			await prismaRPA.container.updateMany({
				where: { followUpId: id },
				data: { [CONTAINER_SYNC_MAP[field]]: coercedValue },
			});
		}

		// transportDate: sync to implementationDate, but only for containers
		// that have no truckingFollowUpId (i.e. not yet assigned to a trucking job)
		if (field === "deliveryDate" || updateData.deliveryDate !== undefined) {
			const newDeliveryDate =
				field === "deliveryDate"
					? (coercedValue as Date | null)
					: updateData.deliveryDate;
			await prismaRPA.container.updateMany({
				where: {
					followUpId: id,
					truckingFollowUpId: null,
				},
				data: { implementationDate: newDeliveryDate },
			});

			// Special Sync: FollowUp.deliveryDate <-> TruckingFollowUp.implementationDate
			// Only for shipments without containers
			const truckingJobs = await prismaRPA.truckingFollowUp.findMany({
				where: {
					OR: [
						{ requestNumber: existingRecord.requestTruckingNo || "undefined" },
						...(existingRecord.jobNumber
							? [{ jobNumber: existingRecord.jobNumber }]
							: []),
					],
					isDeleted: false,
				},
				include: {
					containers: { select: { id: true } },
				},
			});

			for (const job of truckingJobs) {
				if (job.containers.length === 0) {
					await prismaRPA.truckingFollowUp.update({
						where: { id: job.id },
						data: { implementationDate: newDeliveryDate },
					});

					await prismaRPA.fCR.updateMany({
						where: { truckingFollowUpId: job.id },
						data: { implementationDate: newDeliveryDate },
					});
				}
			}
		}

		// Log activity (fire-and-forget)
		logFollowUpActivity(id, {
			userId: session.user.id,
			userName: session.user.name,
			action: "UPDATE_FIELD",
			field,
			oldValue,
			newValue: coercedValue,
		});

		return NextResponse.json(updatedRecord, { status: 200 });
	} catch (error) {
		console.error("Error updating follow-up field:", error);
		return NextResponse.json(
			{
				message: "Failed to update follow-up field",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
