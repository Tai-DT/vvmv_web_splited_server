import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

/**
 * GET /api/trucking-followup/truck-report
 * Returns FCR records NOT linked to FCL shipments.
 */
export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const dateFrom = searchParams.get("dateFrom");
		const dateTo = searchParams.get("dateTo");
		const taxCode = searchParams.get("taxCode");
		const companyName = searchParams.get("companyName");
		const vendor = searchParams.get("vendor");
		const status = searchParams.get("status");
		const ccgh = searchParams.get("ccgh");
		const search = searchParams.get("search");

		// Role-based and Department-based filtering (đồng bộ với script check-user)
		const userWithDepts = await prismaRPA.user.findUnique({
			where: { id: session.user.id },
			select: {
				role: true,
				site: true,
				departmentAssignments: {
					select: { department: { select: { name: true, site: true } } },
				},
				teamMemberships: {
					select: {
						team: {
							select: { department: { select: { name: true, site: true } } },
						},
					},
				},
				teamLeaderships: {
					select: {
						team: {
							select: { department: { select: { name: true, site: true } } },
						},
					},
				},
			},
		});

		const isStaff = userWithDepts?.role === "STAFF";
		// Gộp tất cả các phòng ban từ 3 nguồn
		const userDeptsSet = new Set<string>();
		userWithDepts?.departmentAssignments.forEach(
			(d) =>
				d.department?.name && userDeptsSet.add(d.department.name.toUpperCase()),
		);
		userWithDepts?.teamMemberships.forEach(
			(tm) =>
				tm.team?.department?.name &&
				userDeptsSet.add(tm.team.department.name.toUpperCase()),
		);
		userWithDepts?.teamLeaderships.forEach(
			(tl) =>
				tl.team?.department?.name &&
				userDeptsSet.add(tl.team.department.name.toUpperCase()),
		);
		const userDepts = Array.from(userDeptsSet);
		const isTruckingDept = userDepts.some((d) => d.includes("TRUCKING"));

		// Calculate Allowed Sites
		const userSites = new Set<string>();
		if (userWithDepts?.site) userSites.add(userWithDepts.site);
		userWithDepts?.departmentAssignments.forEach((da) => {
			if (da.department?.site) userSites.add(da.department.site);
		});
		userWithDepts?.teamMemberships.forEach((tm) => {
			if (tm.team?.department?.site) userSites.add(tm.team.department.site);
		});
		userWithDepts?.teamLeaderships.forEach((tl) => {
			if (tl.team?.department?.site) userSites.add(tl.team.department.site);
		});
		const allowedSites = Array.from(userSites);
		const isSuperAdmin = userWithDepts?.role === "SUPERADMIN";

		// Build the query
		const tfInnerWhere: any = {
			isDeleted: false,
			OR: [
				{ serviceMode: null },
				{ serviceMode: { not: { contains: "FCL" } } },
			],
		};

		// Apply Site Restriction to Inner TruckingFollowUp
		if (!isSuperAdmin && allowedSites.length > 0) {
			tfInnerWhere.domain = { in: allowedSites };
		}

		const baseWhere: any = {
			OR: [
				{ truckingFollowUp: tfInnerWhere },
				{ truckingFollowUpId: null }, // FCR not linked to any TF
			],
		};

		const where: any = {
			AND: [baseWhere],
		};

		// If STAFF and NOT in Trucking department, restrict to own records
		if (isStaff && !isTruckingDept) {
			where.AND.push({
				OR: [
					{
						truckingFollowUp: {
							OR: [
								{ handler: session.user.id },
								{ createdBy: session.user.id },
							],
						},
					},
					{ truckingFollowUpId: null }, // FCR not linked to a job yet - might allow seeing?
				],
			});
		}

		if (taxCode || companyName || status) {
			const tfFilter: any = { isDeleted: false };
			if (taxCode)
				tfFilter.taxCode = { contains: taxCode, mode: "insensitive" };
			if (companyName)
				tfFilter.companyName = { contains: companyName, mode: "insensitive" };
			if (status) tfFilter.isFinished = status === "FINISHED";
			where.AND.push({ truckingFollowUp: tfFilter });
		}

		if (vendor) {
			where.vendor = { contains: vendor, mode: "insensitive" };
		}

		if (ccgh) {
			if (ccgh === "Yes") {
				where.AND.push({
					truckingFollowUp: {
						ccgh: { isEmpty: false },
					},
				});
			} else {
				where.AND.push({
					OR: [
						{ truckingFollowUp: { ccgh: { isEmpty: true } } },
						{ truckingFollowUp: null },
					],
				});
			}
		}

		if (dateFrom || dateTo) {
			where.implementationDate = {};
			if (dateFrom) where.implementationDate.gte = new Date(dateFrom);
			if (dateTo) {
				const end = new Date(dateTo);
				end.setHours(23, 59, 59, 999);
				where.implementationDate.lte = end;
			}
		}

		if (search) {
			const terms = search
				.split(/[,\n\t; ]+/)
				.map((t) => t.trim())
				.filter(Boolean);
			if (terms.length > 0) {
				const linkedTruckingRequestNumbers = await prismaRPA.followUp
					.findMany({
						where: {
							isDeleted: false,
							requestTruckingNo: { not: null },
							OR: terms.map((term) => ({
								jobNumber: { contains: term, mode: "insensitive" },
							})),
						},
						select: { requestTruckingNo: true },
					})
					.then((rows) =>
						rows
							.map((row) => row.requestTruckingNo)
							.filter(
								(requestNumber): requestNumber is string => !!requestNumber,
							),
					);

				where.AND.push({
					OR: [
						...terms.map((term) => ({
							OR: [
								{ fcrNumber: { contains: term, mode: "insensitive" } },
								{ plateNumber: { contains: term, mode: "insensitive" } },
								{ driver: { contains: term, mode: "insensitive" } },
								{ vendor: { contains: term, mode: "insensitive" } },
								{ warehouse: { contains: term, mode: "insensitive" } },
								{
									truckingFollowUp: {
										OR: [
											{ jobNumber: { contains: term, mode: "insensitive" } },
											{ companyName: { contains: term, mode: "insensitive" } },
											{
												billOrBooking: { contains: term, mode: "insensitive" },
											},
										],
									},
								},
							],
						})),
						...(linkedTruckingRequestNumbers.length > 0
							? [
									{
										truckingFollowUp: {
											requestNumber: { in: linkedTruckingRequestNumbers },
										},
									},
								]
							: []),
					],
				});
			}
		}

		const fcrs = await prismaRPA.fCR.findMany({
			where,
			include: {
				truckingFollowUp: {
					include: { handlerUser: true },
				},
			},
			orderBy: [{ implementationDate: "desc" }, { id: "desc" }],
			take: 20000,
		});

		const requestNumbers = fcrs
			.map((f) => f.truckingFollowUp?.requestNumber)
			.filter((requestNumber): requestNumber is string => !!requestNumber);
		const jobNumbers = fcrs
			.map((f) => f.truckingFollowUp?.jobNumber)
			.filter((jobNumber): jobNumber is string => !!jobNumber);

		let linkedLogistics: Array<{
			jobNumber: string | null;
			requestTruckingNo: string | null;
		}> = [];

		if (requestNumbers.length > 0 || jobNumbers.length > 0) {
			linkedLogistics = await prismaRPA.followUp.findMany({
				where: {
					OR: [
						{ requestTruckingNo: { in: requestNumbers } },
						{ jobNumber: { in: jobNumbers } },
					],
					isDeleted: false,
				},
				select: {
					jobNumber: true,
					requestTruckingNo: true,
				},
			});
		}

		const rows = fcrs.map((f: any) => {
			const tf = f.truckingFollowUp;
			const linked = linkedLogistics.find(
				(logistics) =>
					(tf?.requestNumber &&
						logistics.requestTruckingNo === tf.requestNumber) ||
					(tf?.jobNumber && logistics.jobNumber === tf.jobNumber),
			);

			return {
				id: f.id,
				fcrNumber: f.fcrNumber,
				plateNumber: f.plateNumber,
				truckType: f.truckType,
				shipper: f.shipper,
				cbm: f.cbm,
				grossWeight: f.grossWeight,
				quantity: f.quantity,
				pickupAt: f.pickupAt,
				deliveryAt: f.deliveryAt,
				notes: tf?.note ?? f.notes,
				driver: f.driver,
				vendor: f.vendor || tf?.vendor,
				warehouse: f.warehouse || tf?.warehouse,
				implementationDate: f.implementationDate,

				// TF parent info
				jobNumber: tf?.jobNumber,
				taxCode: tf?.taxCode,
				companyName: tf?.companyName,
				billOrBooking: tf?.billOrBooking,
				serviceMode: tf?.serviceMode,
				operationType: tf?.operationType,
				routineDetail: tf?.routineDetail,
				jobLog: linked?.jobNumber || "",
				handler: tf?.handlerUser?.email || tf?.handlerUser?.name || tf?.handler,
				ops: f.ops,
				ccgh: tf?.ccgh && tf.ccgh.length > 0 ? "Yes" : "No",
				status: tf?.isFinished ? "FINISHED" : "PENDING",
			};
		});

		return NextResponse.json({ data: rows, total: rows.length });
	} catch (error: any) {
		const modelKeys = Object.keys(prismaRPA).filter((k) => !k.startsWith("$"));
		console.error("Truck report error:", error);
		return NextResponse.json(
			{
				message: "Failed to fetch truck report V2",
				error: error.message,
				name: error.name,
				availableModels: modelKeys,
			},
			{ status: 500 },
		);
	}
}
