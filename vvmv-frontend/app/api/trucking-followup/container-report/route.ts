import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

/**
 * GET /api/trucking-followup/container-report
 * Returns containers joined with their parent TruckingFollowUp/FollowUp and corresponding FCRs.
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
		const jobNumber = searchParams.get("jobNumber");
		const containerNo = searchParams.get("containerNo");
		const containerSize = searchParams.get("containerSize");
		const plateNumber = searchParams.get("plateNumber");
		const vendor = searchParams.get("vendor");
		const operationType = searchParams.get("operationType");
		const domain = searchParams.get("domain");
		const status = searchParams.get("status"); // FINISHED | PENDING
		const ccgh = searchParams.get("ccgh"); // Yes | No
		const search = searchParams.get("search");

		// Build sub-wheres for the two parent modules
		const tfWhere: any = { isDeleted: false };
		const flWhere: any = { isDeleted: false };

		if (status) {
			const isFinished = status === "FINISHED";
			tfWhere.isFinished = isFinished;
			flWhere.isFinished = isFinished;
		}

		if (taxCode) {
			tfWhere.taxCode = { contains: taxCode, mode: "insensitive" };
			flWhere.taxCode = { contains: taxCode, mode: "insensitive" };
		}
		if (companyName) {
			tfWhere.companyName = { contains: companyName, mode: "insensitive" };
			flWhere.companyName = { contains: companyName, mode: "insensitive" };
		}
		if (jobNumber) {
			tfWhere.jobNumber = { contains: jobNumber, mode: "insensitive" };
			flWhere.jobNumber = { contains: jobNumber, mode: "insensitive" };
		}
		if (operationType) {
			tfWhere.operationType = operationType;
			flWhere.operationType = operationType;
		}
		if (domain) {
			tfWhere.domain = domain;
			flWhere.domain = domain;
		}

		// Role-based and Department-based filtering
		// Lấy phòng ban từ cả direct, teamMemberships, teamLeaderships
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

		// Site filtering block
		const isSuperAdmin = userWithDepts?.role === "SUPERADMIN";
		if (!isSuperAdmin) {
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
			if (allowedSites.length > 0) {
				if (domain) {
					// If domain param provided, must be in allowed sites
					const finalDomain = allowedSites.includes(domain)
						? domain
						: allowedSites[0];
					tfWhere.domain = finalDomain;
					flWhere.domain = finalDomain;
				} else {
					// Default to user's assigned sites
					tfWhere.domain = { in: allowedSites };
					flWhere.domain = { in: allowedSites };
				}
			} else if (domain) {
				// Fallback for domain param if no user site defined
				tfWhere.domain = domain;
				flWhere.domain = domain;
			}
		} else if (domain) {
			// Superadmin can filter as they wish
			tfWhere.domain = domain;
			flWhere.domain = domain;
		}

		// Nếu là STAFF và KHÔNG thuộc phòng Trucking thì chỉ thấy lô hàng của mình
		// Nếu là STAFF thuộc Trucking thì được xem toàn bộ lô hàng của site (không lọc theo user)
		if (isStaff && !isTruckingDept) {
			tfWhere.OR = [
				{ handler: session.user.id },
				{ createdBy: session.user.id },
			];
			flWhere.OR = [
				{ handler: session.user.id },
				{ createdBy: session.user.id },
			];
		}

		// Build main where clause for Container
		const where: any = {
			OR: [
				{ truckingFollowUpId: { not: null }, truckingFollowUp: tfWhere },
				{ followUpId: { not: null }, followUp: flWhere },
			],
		};

		if (containerNo) {
			where.containerNo = { contains: containerNo, mode: "insensitive" };
		}
		if (containerSize) {
			where.containerSize = { contains: containerSize, mode: "insensitive" };
		}
		if (plateNumber) {
			where.plateNumber = { contains: plateNumber, mode: "insensitive" };
		}

		if (ccgh) {
			if (ccgh === "Yes") {
				where.podUrl = { notIn: [null, ""] };
			} else {
				where.OR = [...(where.OR || []), { podUrl: null }, { podUrl: "" }];
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

		// Global search
		if (search) {
			const terms = search
				.split(/[,\n\t; ]+/)
				.map((t) => t.trim())
				.filter(Boolean);

			if (terms.length > 0) {
				const linkedTruckingRequestNumbers = await prismaRPA.truckingFollowUp
					.findMany({
						where: {
							isDeleted: false,
							requestNumber: { not: null },
							OR: terms.map((term) => ({
								jobNumber: { contains: term, mode: "insensitive" },
							})),
						},
						select: { requestNumber: true },
					})
					.then((rows) =>
						rows
							.map((row) => row.requestNumber)
							.filter(
								(requestNumber): requestNumber is string => !!requestNumber,
							),
					);

				where.AND = [
					...(where.AND || []),
					{
						OR: [
							...terms.map((term) => ({
								OR: [
									{ containerNo: { contains: term, mode: "insensitive" } },
									{ sealNo: { contains: term, mode: "insensitive" } },
									{ plateNumber: { contains: term, mode: "insensitive" } },
									{ vendor: { contains: term, mode: "insensitive" } },
									{ warehouse: { contains: term, mode: "insensitive" } },
									{
										truckingFollowUp: {
											OR: [
												{ jobNumber: { contains: term, mode: "insensitive" } },
												{
													companyName: { contains: term, mode: "insensitive" },
												},
											],
										},
									},
									{
										followUp: {
											OR: [
												{ jobNumber: { contains: term, mode: "insensitive" } },
												{
													companyName: { contains: term, mode: "insensitive" },
												},
											],
										},
									},
									{
										fcrs: {
											some: {
												OR: [
													{
														fcrNumber: { contains: term, mode: "insensitive" },
													},
													{ driver: { contains: term, mode: "insensitive" } },
												],
											},
										},
									},
								],
							})),
							...(linkedTruckingRequestNumbers.length > 0
								? [
										{
											followUp: {
												requestTruckingNo: {
													in: linkedTruckingRequestNumbers,
												},
											},
										},
									]
								: []),
						],
					},
				];
			}
		}

		if (vendor) {
			where.AND = [
				...(where.AND || []),
				{
					OR: [
						{ vendor: { contains: vendor, mode: "insensitive" } },
						{
							truckingFollowUp: {
								vendor: { contains: vendor, mode: "insensitive" },
							},
						},
					],
				},
			];
		}

		const containers = await prismaRPA.container.findMany({
			where,
			include: {
				truckingFollowUp: {
					include: { handlerUser: true },
				},
				followUp: true,
				fcrs: {
					orderBy: { tripNumber: "asc" },
				},
			},
			orderBy: [{ implementationDate: "desc" }, { createdAt: "desc" }],
			take: 20000,
		});

		// Resolve the linked logistics and trucking jobs by request number.
		const truckingRequestNumbers = containers
			.map((c) => c.truckingFollowUp?.requestNumber)
			.filter((n): n is string => !!n);
		const truckingJobNumbers = containers
			.map((c) => c.truckingFollowUp?.jobNumber)
			.filter((n): n is string => !!n);
		const logisticsRequestNumbers = containers
			.map((c) => c.followUp?.requestTruckingNo)
			.filter((n): n is string => !!n);
		const logisticsJobNumbers = containers
			.map((c) => c.followUp?.jobNumber)
			.filter((n): n is string => !!n);

		let linkedLogistics: any[] = [];
		if (truckingRequestNumbers.length > 0 || truckingJobNumbers.length > 0) {
			linkedLogistics = await prismaRPA.followUp.findMany({
				where: {
					OR: [
						{ requestTruckingNo: { in: truckingRequestNumbers } },
						{ jobNumber: { in: truckingJobNumbers } },
					],
					isDeleted: false,
				},
				select: {
					jobNumber: true,
					requestTruckingNo: true,
				},
			});
		}

		const linkedTruckingByRequestNumber = new Map<
			string,
			{ jobNumber: string | null; note: string | null; handler?: string | null }
		>();
		const linkedTruckingByJobNumber = new Map<
			string,
			{ jobNumber: string | null; note: string | null; handler?: string | null }
		>();
		if (logisticsRequestNumbers.length > 0 || logisticsJobNumbers.length > 0) {
			const linkedTruckings = await prismaRPA.truckingFollowUp.findMany({
				where: {
					OR: [
						{ requestNumber: { in: logisticsRequestNumbers } },
						{ jobNumber: { in: logisticsJobNumbers } },
					],
					isDeleted: false,
				},
				select: {
					requestNumber: true,
					jobNumber: true,
					note: true,
					handler: true,
					handlerUser: { select: { email: true, name: true } },
				},
			});

			linkedTruckings.forEach((trucking) => {
				if (trucking.requestNumber) {
					linkedTruckingByRequestNumber.set(trucking.requestNumber, {
						jobNumber: trucking.jobNumber,
						note: trucking.note,
						handler:
							(trucking as any).handlerUser?.email ||
							(trucking as any).handlerUser?.name ||
							trucking.handler,
					});
				}
				if (trucking.jobNumber) {
					linkedTruckingByJobNumber.set(trucking.jobNumber, {
						jobNumber: trucking.jobNumber,
						note: trucking.note,
						handler:
							(trucking as any).handlerUser?.email ||
							(trucking as any).handlerUser?.name ||
							trucking.handler,
					});
				}
			});
		}

		const rows = containers.map((c) => {
			const isTrucking = !!c.truckingFollowUp;
			const parent = c.truckingFollowUp || c.followUp;
			const fcr = c.fcrs[0];
			const linkedTrucking = c.followUp?.requestTruckingNo
				? linkedTruckingByRequestNumber.get(c.followUp.requestTruckingNo)
				: c.followUp?.jobNumber
					? linkedTruckingByJobNumber.get(c.followUp.jobNumber)
					: undefined;
			const linkedTruckingJobNumber = linkedTrucking?.jobNumber || "";

			// Determine Job Log (Logistics Job Number)
			let jobLog = "";
			if (isTrucking) {
				const linked = linkedLogistics.find(
					(l) =>
						(c.truckingFollowUp?.requestNumber &&
							l.requestTruckingNo === c.truckingFollowUp.requestNumber) ||
						(c.truckingFollowUp?.jobNumber &&
							l.jobNumber === c.truckingFollowUp.jobNumber),
				);
				jobLog = linked?.jobNumber || "";
			} else {
				// If it's already a logistics container, jobLog IS the jobNumber of the parent
				// Actually, usually users want to see the link. If it's a logistics row, it might not need a "link"
				// but let's follow the user's specific request.
				jobLog = c.followUp?.jobNumber || "";
			}

			return {
				id: c.id,
				containerNo: c.containerNo,
				sealNo: c.sealNo,
				containerSize: c.containerSize,
				containerType: c.containerType,
				grossWeight: c.grossWeight,
				tareWeight: c.tareWeight,
				implementationDate: c.implementationDate,
				warehouse: c.warehouse,
				plateNumber: c.plateNumber || fcr?.plateNumber,
				vendor:
					c.vendor ||
					fcr?.vendor ||
					(isTrucking ? c.truckingFollowUp?.vendor : c.followUp?.supplier),

				// Parent fields
				truckingFollowUpId: c.truckingFollowUpId || c.followUpId,
				jobNumber: isTrucking
					? parent?.jobNumber
					: linkedTruckingJobNumber || "",
				taxCode: parent?.taxCode,
				companyName: parent?.companyName,
				billOrBooking: parent?.billOrBooking,
				serviceMode: parent?.serviceMode,
				operationType: parent?.operationType,
				pickOrLiftPlace:
					c.pickOrLiftPlace ||
					(isTrucking
						? c.truckingFollowUp?.pickOrLiftPlace
						: c.followUp?.pickupLocation),
				routineDetail: isTrucking ? c.truckingFollowUp?.routineDetail : "",
				note: isTrucking ? c.truckingFollowUp?.note : linkedTrucking?.note,
				jobLog,

				// FCR fields
				fcrNumber: c.fcrs
					.map((f) => f.fcrNumber)
					.filter(Boolean)
					.join(", "),
				driver: c.fcrs
					.map((f) => f.driver)
					.filter(Boolean)
					.join(", "),
				fcrPlateNumber: c.fcrs
					.map((f) => f.plateNumber)
					.filter(Boolean)
					.join(", "),
				fcrVendor: c.fcrs
					.map((f) => f.vendor)
					.filter(Boolean)
					.join(", "),
				fromLocation: c.fcrs
					.map((f) => f.pickupAt)
					.filter(Boolean)
					.join(" -> "),
				toLocation: c.fcrs
					.map((f) => f.deliveryAt)
					.filter(Boolean)
					.join(" -> "),
				ops: c.fcrs
					.map((f) => f.ops)
					.filter(Boolean)
					.join(", "),
				handler: isTrucking
					? (c.truckingFollowUp as any)?.handlerUser?.email ||
						(c.truckingFollowUp as any)?.handlerUser?.name ||
						c.truckingFollowUp?.handler
					: (linkedTrucking as any)?.handler || "",
				status: parent?.isFinished ? "FINISHED" : "PENDING",
				ccgh: c.podUrl ? "Yes" : "No",
			};
		});

		return NextResponse.json({ data: rows, total: rows.length });
	} catch (error) {
		console.error("Container report error:", error);
		return NextResponse.json(
			{ message: "Failed to fetch container report" },
			{ status: 500 },
		);
	}
}
