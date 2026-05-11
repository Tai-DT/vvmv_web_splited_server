import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

export async function GET(request: NextRequest) {
	try {
		// 0. Extract pagination parameters
		const { searchParams } = new URL(request.url);
		const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
		const pageSize = Math.max(
			1,
			Math.min(100000, parseInt(searchParams.get("pageSize") || "10", 10)),
		);
		const skip = (page - 1) * pageSize;
		const search = searchParams.get("search")?.trim();
		const status = searchParams.get("status"); // active, finished, done
		const hideOthers = searchParams.get("hideOthers") === "true";
		const from = searchParams.get("from");
		const to = searchParams.get("to");
		const filtersRaw = searchParams.get("filters");
		const sortingRaw = searchParams.get("sorting");
		let searchTerms: string[] = [];

		let advancedFilters: any[] = [];
		let sorting: any[] = [];

		if (filtersRaw) {
			try {
				advancedFilters = JSON.parse(filtersRaw);
			} catch (_e) {}
		}
		if (sortingRaw) {
			try {
				sorting = JSON.parse(sortingRaw);
			} catch (_e) {}
		}

		// 1. Authenticate user with Better Auth
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		// 2. Get user role and team info
		const currentUser = await prismaRPA.user.findUnique({
			where: { id: session.user.id },
			select: {
				role: true,
				site: true,
				departmentAssignments: {
					select: {
						departmentId: true,
						department: { select: { name: true, site: true } },
					},
				},
				teamLeaderships: {
					include: {
						team: {
							include: {
								department: { select: { name: true, site: true } },
								members: {
									select: { userId: true },
								},
								leaders: {
									select: { userId: true },
								},
							},
						},
					},
				},
				teamMemberships: {
					include: {
						team: {
							include: {
								department: { select: { name: true, site: true } },
								members: {
									select: { userId: true },
								},
							},
						},
					},
				},
			},
		});

		if (!currentUser) {
			return NextResponse.json({ message: "User not found" }, { status: 404 });
		}

		// 3. Build where clause based on role and filters
		const baseConditions: any[] = [{ isDeleted: false }];

		// --- Role-based Access Control (Base) ---
		const roleBasedConditions: any[] = [];

		// Get all teammates (users in the same teams)
		const teammateIds = new Set<string>();
		teammateIds.add(session.user.id);
		currentUser.teamLeaderships?.forEach((l) => {
			l.team.members.forEach((m) => teammateIds.add(m.userId));
			l.team.leaders.forEach((ld) => teammateIds.add(ld.userId));
		});
		currentUser.teamMemberships?.forEach((ms) => {
			ms.team.members.forEach((m) => teammateIds.add(m.userId));
		});
		const teammateIdsArray = Array.from(teammateIds);

		// Get all department names the user belongs to (via assignments, team leaderships, or memberships)
		const userDeptNames = new Set<string>();
		currentUser.departmentAssignments.forEach((da: any) => {
			if (da.department?.name) userDeptNames.add(da.department.name);
		});
		currentUser.teamLeaderships?.forEach((tl: any) => {
			if (tl.team?.department?.name) userDeptNames.add(tl.team.department.name);
		});
		currentUser.teamMemberships?.forEach((tm: any) => {
			if (tm.team?.department?.name) userDeptNames.add(tm.team.department.name);
		});

		// Check if user is in special departments that can view all site jobs
		const isInSpecialDepartment =
			userDeptNames.has("Trucking") ||
			userDeptNames.has("Document") ||
			userDeptNames.has("Accounting");

		// Get user's site from department assignments or direct site field
		const userSites = new Set<string>();
		if (currentUser.site) userSites.add(currentUser.site);
		currentUser.departmentAssignments.forEach((da: any) => {
			if (da.department?.site) userSites.add(da.department.site);
		});
		currentUser.teamLeaderships?.forEach((tl: any) => {
			if (tl.team?.department?.site) userSites.add(tl.team.department.site);
		});
		currentUser.teamMemberships?.forEach((tm: any) => {
			if (tm.team?.department?.site) userSites.add(tm.team.department.site);
		});

		if (isInSpecialDepartment && userSites.size > 0) {
			// Users in Trucking/Document/Logistics departments can see all jobs for their site(s)
			roleBasedConditions.push({
				domain: { in: Array.from(userSites) as any },
			});
		} else if (currentUser.role === "ADMIN") {
			// Site-specific ADMIN restricted to their assigned site
			if (currentUser.site) {
				roleBasedConditions.push({ domain: currentUser.site });
			}
		} else if (currentUser.role === "SUPERADMIN") {
			// SUPERADMIN sees all sites - no filter
		} else if (currentUser.role === "MANAGER") {
			// MANAGER: See all records for sites they have department assignments in
			const assignedSites = new Set<string>();
			currentUser.departmentAssignments.forEach((da: any) => {
				if (da.department?.site) assignedSites.add(da.department.site);
			});

			if (assignedSites.size > 0) {
				roleBasedConditions.push({
					domain: { in: Array.from(assignedSites) as any },
				});
			} else {
				// Fallback: only records they created or handle
				roleBasedConditions.push({
					OR: [{ createdBy: session.user.id }, { handler: session.user.id }],
				});
			}
		} else if (
			currentUser.teamLeaderships &&
			currentUser.teamLeaderships.length > 0
		) {
			// Team leaders see all records from teams they lead or belong to
			roleBasedConditions.push({
				OR: [
					{ createdBy: { in: teammateIdsArray } },
					{ handler: { in: teammateIdsArray } },
				],
			});
		} else {
			// STAFF sees records they created, handle, OR unassigned records from teammates
			roleBasedConditions.push({
				OR: [
					{ createdBy: session.user.id },
					{ handler: session.user.id },
					{
						AND: [
							{ createdBy: { in: teammateIdsArray } },
							{ OR: [{ handler: null }, { handler: "" }] },
						],
					},
				],
			});
		}

		if (roleBasedConditions.length > 0) {
			baseConditions.push({ AND: roleBasedConditions });
		}

		// --- Apply 'hideOthers' narrow down if requested ---
		// User sees their own jobs OR unassigned jobs from their team
		if (hideOthers) {
			baseConditions.push({
				OR: [
					{ createdBy: session.user.id },
					{ handler: session.user.id },
					{
						AND: [
							{ createdBy: { in: teammateIdsArray } },
							{ OR: [{ handler: null }, { handler: "" }] },
						],
					},
				],
			});
		}

		// --- Apply Date Range Filter ---
		if (from || to) {
			const dateFilter: any = {};
			if (from) {
				// Parse as local midnight by appending T00:00:00 (no Z) to avoid UTC interpretation
				dateFilter.gte = new Date(`${from}T00:00:00`);
			}
			if (to) {
				dateFilter.lte = new Date(`${to}T23:59:59.999`);
			}
			baseConditions.push({ createdAt: dateFilter });
		}

		// --- Apply Search Filter ---
		if (search) {
			// Find users whose name or email matches search to enable handler searching by name/email
			const matchingUsers = await prismaRPA.user.findMany({
				where: {
					OR: [
						{ name: { contains: search, mode: "insensitive" } },
						{ email: { contains: search, mode: "insensitive" } },
						{ username: { contains: search, mode: "insensitive" } },
					],
				},
				select: { id: true },
			});
			const matchingUserIds = matchingUsers.map((u) => u.id);

			searchTerms = Array.from(
				new Set(
					search
						.split(/[\s,;|\n\r\t]+/)
						.map((s) => s.trim())
						.filter(Boolean),
				),
			);

			const multiJobSearchConditions =
				searchTerms.length > 1
					? [
							{
								OR: searchTerms.map((term) => ({
									jobNumber: { contains: term, mode: "insensitive" as const },
								})),
							},
							{
								OR: searchTerms.map((term) => ({
									requestTruckingNo: {
										contains: term,
										mode: "insensitive" as const,
									},
								})),
							},
							{
								OR: searchTerms.map((term) => ({
									billOrBooking: {
										contains: term,
										mode: "insensitive" as const,
									},
								})),
							},
							{
								OR: searchTerms.map((term) => ({
									arNumber: {
										contains: term,
										mode: "insensitive" as const,
									},
								})),
							},
						]
					: [];

			baseConditions.push({
				OR: [
					...multiJobSearchConditions,
					{ handler: { in: matchingUserIds } },
					{ handler: { contains: search, mode: "insensitive" } }, // In case it's a name string directly
					{ jobNumber: { contains: search, mode: "insensitive" } },
					{ taxCode: { contains: search, mode: "insensitive" } },
					{ companyName: { contains: search, mode: "insensitive" } },
					{ billOrBooking: { contains: search, mode: "insensitive" } },
					{ invoice: { contains: search, mode: "insensitive" } },
					{ notes: { contains: search, mode: "insensitive" } },
					{ note2: { contains: search, mode: "insensitive" } },
					{ note3: { contains: search, mode: "insensitive" } },
					{ arNumber: { contains: search, mode: "insensitive" } },
					{ poNumber: { contains: search, mode: "insensitive" } },
					{ pickupLocation: { contains: search, mode: "insensitive" } },
					{ loadingLocation: { contains: search, mode: "insensitive" } },
					{ transportMethod: { contains: search, mode: "insensitive" } },
					{ pol: { contains: search, mode: "insensitive" } },
					{ pod: { contains: search, mode: "insensitive" } },
					{ warehouse: { contains: search, mode: "insensitive" } },
					{ supplier: { contains: search, mode: "insensitive" } },
					{ requestTruckingNo: { contains: search, mode: "insensitive" } },
					{ workType: { contains: search, mode: "insensitive" } },
					{ authority: { contains: search, mode: "insensitive" } },
					{ coNumber: { contains: search, mode: "insensitive" } },
					{ serviceMode: { contains: search, mode: "insensitive" } },
					{ cargoType: { contains: search, mode: "insensitive" } },
					{ truckNumber: { contains: search, mode: "insensitive" } },
					{ location: { contains: search, mode: "insensitive" } },
					{ supervisionGate: { contains: search, mode: "insensitive" } },
					{ taxService: { contains: search, mode: "insensitive" } },
					{ unit: { contains: search, mode: "insensitive" } },
					{ pickUpTime: { contains: search, mode: "insensitive" } },
					{ commodityName: { contains: search, mode: "insensitive" } },
					{
						user: {
							OR: [
								{ name: { contains: search, mode: "insensitive" } },
								{ email: { contains: search, mode: "insensitive" } },
							],
						},
					},
					{
						declarations: {
							some: {
								OR: [
									{
										declarationNumber: {
											contains: search,
											mode: "insensitive",
										},
									},
									{ clientName: { contains: search, mode: "insensitive" } },
									{ billBooking: { contains: search, mode: "insensitive" } },
									{ workType: { contains: search, mode: "insensitive" } },
									{ authority: { contains: search, mode: "insensitive" } },
								],
							},
						},
					},
					...(searchTerms.length > 1
						? [
								{
									declarations: {
										some: {
											OR: searchTerms.map((term) => ({
												declarationNumber: {
													contains: term,
													mode: "insensitive" as const,
												},
											})),
										},
									},
								},
							]
						: []),
					{
						cerOfOrigins: {
							some: {
								coNo: { contains: search, mode: "insensitive" },
							},
						},
					},
					...(["SGN", "DAD", "HAN"].includes(search.toUpperCase())
						? [{ domain: { equals: search.toUpperCase() as any } }]
						: []),
				],
			});
		}

		// --- Define 'Done' criteria ---
		// Fetch partners with disabled flags to exclude them from mandatory checks
		const disabledPartners = await prismaRPA.partnersMasterData.findMany({
			where: {
				OR: [{ enableKVGS: false }, { enableCDS: false }],
			},
			select: { taxCode: true, site: true, enableKVGS: true, enableCDS: true },
		});

		const kvgsDisabledTaxCodes = disabledPartners
			.filter((p) => p.enableKVGS === false && p.taxCode)
			.map((p) => p.taxCode?.trim());
		const cdsDisabledTaxCodes = disabledPartners
			.filter((p) => p.enableCDS === false && p.taxCode)
			.map((p) => p.taxCode?.trim());

		const DONE_WHERE = {
			isFinished: true,
			OR: [
				{ cerOfOrigins: { some: {} } },
				{ declarations: { none: {} } },
				{
					AND: [
						{ declarations: { some: {} } },
						{
							AND: [
								// KVGS check: Done if partner disabled OR main declaration has KVGS date OR all declarations have it (legacy)
								{
									OR: [
										{ taxCode: { in: kvgsDisabledTaxCodes } },
										// Case 1: Main declaration found (has firstCds) and has KVGS date
										{
											declarations: {
												some: {
													AND: [
														{ firstCds: { not: null } },
														{ firstCds: { not: "" } },
														{ kvgsDate: { not: null } },
													],
												},
											},
										},
										// Case 2: Legacy/No firstCds - all declarations must have KVGS
										{
											AND: [
												{
													declarations: {
														every: {
															OR: [{ firstCds: null }, { firstCds: "" }],
														},
													},
												},
												{
													declarations: {
														every: { kvgsDate: { not: null } },
													},
												},
											],
										},
									],
								},
								// TQ (Thông quan) check: All declarations must have tqDate OR be in disabled list
								{
									OR: [
										{ taxCode: { in: kvgsDisabledTaxCodes } },
										{
											declarations: {
												every: {
													OR: [
														{ tqDate: { not: null } },
														{ mstClient: { in: kvgsDisabledTaxCodes } },
													],
												},
											},
										},
									],
								},
								// CDS check: Done if partner disabled OR any declaration found in CDS OR all declarations have docs
								{
									OR: [
										{ taxCode: { in: cdsDisabledTaxCodes } },
										{
											declarations: {
												some: {
													AND: [
														{ firstCds: { not: null } },
														{ firstCds: { not: "" } },
													],
												},
											},
										},
										{
											declarations: {
												every: {
													OR: [
														{
															AND: [
																{ attachDocuments: { not: null } },
																{ attachDocuments: { not: "" } },
															],
														},
														{ mstClient: { in: cdsDisabledTaxCodes } },
													],
												},
											},
										},
									],
								},
							],
						},
					],
				},
			],
		};

		// --- Apply Status Filter (for data query only) ---
		const statusConditions: any[] = [];
		if (status === "active") {
			statusConditions.push({ isFinished: false });
		} else if (status === "activeNoTrucking") {
			statusConditions.push({
				isFinished: false,
				OR: [{ requestTruckingNo: null }, { requestTruckingNo: "" }],
			});
		} else if (status === "activeWithTrucking") {
			statusConditions.push({
				isFinished: false,
				NOT: { OR: [{ requestTruckingNo: null }, { requestTruckingNo: "" }] },
			});
		} else if (status === "finished") {
			statusConditions.push({
				isFinished: true,
				NOT: DONE_WHERE,
			});
		} else if (status === "done") {
			statusConditions.push(DONE_WHERE);
		}

		// --- Apply Advanced Filters ---
		const advancedConditions: any[] = [];

		const buildConditionAsync = async (filter: any) => {
			const { column, operator, value, startDate, endDate } = filter;

			// Special handling for date_range
			if (operator === "date_range") {
				const cond: any = {};
				if (startDate) cond.gte = new Date(startDate);
				if (endDate) cond.lte = new Date(endDate);
				return { [column]: cond };
			}

			// Special handling for nested columns
			if (column === "declarations") {
				if (operator === "is_empty") return { declarations: { none: {} } };
				if (operator === "is_not_empty") return { declarations: { some: {} } };
				return {
					declarations: {
						some: {
							declarationNumber: { contains: value, mode: "insensitive" },
						},
					},
				};
			}

			if (column === "cerOfOrigin" || column === "cerOfOrigins") {
				if (operator === "is_empty") return { cerOfOrigins: { none: {} } };
				if (operator === "is_not_empty") return { cerOfOrigins: { some: {} } };
				return {
					cerOfOrigins: {
						some: { coNo: { contains: value, mode: "insensitive" } },
					},
				};
			}

			if (column === "status" || column === "botMessage") {
				if (operator === "is_empty") {
					const jobsWithTasks = await prismaRPA.invoker.findMany({
						select: { jobNo: true },
					});
					const jobNos = [...new Set(jobsWithTasks.map((j) => j.jobNo))].filter(
						Boolean,
					) as string[];
					return { NOT: { jobNumber: { in: jobNos } } };
				}
				if (operator === "is_not_empty") {
					const jobsWithTasks = await prismaRPA.invoker.findMany({
						select: { jobNo: true },
					});
					const jobNos = [...new Set(jobsWithTasks.map((j) => j.jobNo))].filter(
						Boolean,
					) as string[];
					return { jobNumber: { in: jobNos } };
				}

				const prismaOp: any = {};
				switch (operator) {
					case "contains":
						prismaOp.contains = value;
						prismaOp.mode = "insensitive";
						break;
					case "equals":
						prismaOp.equals = value;
						prismaOp.mode = "insensitive";
						break;
					case "starts_with":
						prismaOp.startsWith = value;
						prismaOp.mode = "insensitive";
						break;
					case "ends_with":
						prismaOp.endsWith = value;
						prismaOp.mode = "insensitive";
						break;
					default:
						prismaOp.contains = value;
						prismaOp.mode = "insensitive";
						break;
				}

				const isNegation =
					operator === "does_not_contain" || operator === "does_not_equal";
				const targetValue = String(value || "");

				const searchConditions: any[] = [
					{ status: prismaOp },
					{ message: prismaOp },
					{ taskName: prismaOp },
				];
				if (targetValue.toUpperCase() === "FAIL") {
					searchConditions.push({
						status: { equals: "Completed" },
						message: { contains: "FAIL - ", mode: "insensitive" },
					});
				} else if (targetValue.toUpperCase() === "SUCCESS") {
					searchConditions.push({
						status: { equals: "Completed" },
						message: { contains: "SUCCESS", mode: "insensitive" },
					});
				}

				const matchingTasks = await prismaRPA.invoker.findMany({
					where: { OR: searchConditions },
					select: { jobNo: true },
				});
				const jobNos = [...new Set(matchingTasks.map((t) => t.jobNo))].filter(
					Boolean,
				) as string[];

				if (isNegation) {
					if (jobNos.length > 0) {
						return { NOT: { jobNumber: { in: jobNos } } };
					}
					return {};
				} else {
					if (jobNos.length > 0) {
						return { jobNumber: { in: jobNos } };
					}
					return { id: "no-match-found" };
				}
			}

			// Map operators to Prisma
			const prismaOp: any = {};
			if (operator === "is_empty") {
				return { OR: [{ [column]: null }, { [column]: "" }] };
			}
			if (operator === "is_not_empty") {
				return { NOT: { OR: [{ [column]: null }, { [column]: "" }] } };
			}

			switch (operator) {
				case "contains":
					prismaOp.contains = value;
					prismaOp.mode = "insensitive";
					break;
				case "does_not_contain":
					return {
						NOT: { [column]: { contains: value, mode: "insensitive" } },
					};
				case "equals":
					prismaOp.equals = value;
					break;
				case "does_not_equal":
					return { NOT: { [column]: { equals: value } } };
				case "starts_with":
					prismaOp.startsWith = value;
					prismaOp.mode = "insensitive";
					break;
				case "ends_with":
					prismaOp.endsWith = value;
					prismaOp.mode = "insensitive";
					break;
				default:
					prismaOp.equals = value;
			}

			return { [column]: prismaOp };
		};

		if (advancedFilters.length > 0) {
			// Logic: (A and B) or C or (D and E)
			// We'll build this as { OR: [ { AND: [A, B] }, { AND: [C] }, ... ] }
			let currentAndGroup: any[] = [
				await buildConditionAsync(advancedFilters[0]),
			];
			const orGroups: any[] = [];

			for (let i = 1; i < advancedFilters.length; i++) {
				const f = advancedFilters[i];
				const cond = await buildConditionAsync(f);
				if (f.logicalOperator === "or") {
					orGroups.push({ AND: currentAndGroup });
					currentAndGroup = [cond];
				} else {
					currentAndGroup.push(cond);
				}
			}
			orGroups.push({ AND: currentAndGroup });
			advancedConditions.push({ OR: orGroups });
		}

		const whereClause = {
			AND: [...baseConditions, ...statusConditions, ...advancedConditions],
		};
		const _statsBaseClause = {
			AND: [...baseConditions, ...advancedConditions],
		};

		// --- Build Sorting ---
		const orderBy: any[] = sorting
			.map((s: any) => {
				// Skip virtual columns that can't be sorted by Prisma easily
				if (["status", "declarations", "documents"].includes(s.id)) return null;
				return { [s.id]: s.desc ? "desc" : "asc" };
			})
			.filter(Boolean);

		if (orderBy.length === 0) {
			orderBy.push({ createdAt: "desc" });
		}

		// 4. Fetch follow-ups, total count, and statistics based on role and filters
		const [
			followUps,
			total,
			activeNoTruckingCount,
			activeWithTruckingCount,
			finishedCount,
			doneCount,
		] = await Promise.all([
			prismaRPA.followUp.findMany({
				where: whereClause,
				include: {
					declarations: {
						orderBy: {
							createdAt: "asc",
						},
					},
					containers: {
						orderBy: {
							createdAt: "asc",
						},
					},
					cerOfOrigins: {
						orderBy: {
							createdAt: "asc",
						},
					},
					user: {
						select: {
							id: true,
							name: true,
							email: true,
							username: true,
							image: true,
						},
					},
					_count: {
						select: {
							cargoLists: true,
							activityLogs: true,
							paymentRequests: true,
						},
					},
				},
				orderBy: orderBy,
				skip,
				take: pageSize,
			}),
			prismaRPA.followUp.count({
				where: whereClause,
			}),
			// Active jobs WITHOUT requestTruckingNo
			prismaRPA.followUp.count({
				where: {
					AND: [
						...baseConditions,
						...advancedConditions,
						{ isFinished: false },
						{ OR: [{ requestTruckingNo: null }, { requestTruckingNo: "" }] },
					],
				},
			}),
			// Active jobs WITH requestTruckingNo
			prismaRPA.followUp.count({
				where: {
					AND: [
						...baseConditions,
						...advancedConditions,
						{ isFinished: false },
						{
							NOT: {
								OR: [{ requestTruckingNo: null }, { requestTruckingNo: "" }],
							},
						},
					],
				},
			}),
			prismaRPA.followUp.count({
				where: {
					AND: [
						...baseConditions,
						...advancedConditions,
						{ isFinished: true },
						{ NOT: DONE_WHERE },
					],
				},
			}),
			prismaRPA.followUp.count({
				where: {
					AND: [...baseConditions, ...advancedConditions, DONE_WHERE],
				},
			}),
		]);

		// Fetch user details for handlers with fallback for ID, Email, or Username
		const rawHandlerIds = followUps
			.map((f) => f.handler)
			.filter((id): id is string => !!id);
		const handlerIds = [...new Set(rawHandlerIds.map((id) => id.trim()))];

		const handlerUsers =
			handlerIds.length > 0
				? await prismaRPA.user.findMany({
						where: {
							OR: [
								{ id: { in: handlerIds } },
								{ email: { in: handlerIds } },
								{ username: { in: handlerIds } },
							],
						},
						select: {
							id: true,
							name: true,
							email: true,
							username: true,
							image: true,
						},
					})
				: [];

		const handlerUserById = new Map<string, any>();
		const handlerUserByEmail = new Map<string, any>();
		const handlerUserByUsername = new Map<string, any>();

		for (const u of handlerUsers) {
			if (u.id) handlerUserById.set(u.id, u);
			if (u.email) handlerUserByEmail.set(u.email, u);
			if (u.username) handlerUserByUsername.set(u.username, u);
		}

		// 5. Get all job numbers to fetch invoker statuses
		const jobNumbers = followUps
			.map((f) => f.jobNumber)
			.filter((j): j is string => Boolean(j));

		// Fetch related Trucking records to include their tasks
		const requestTruckingNos = followUps
			.map((f) => f.requestTruckingNo)
			.filter((n): n is string => Boolean(n));

		const truckingRecords =
			requestTruckingNos.length > 0 || jobNumbers.length > 0
				? await prismaRPA.truckingFollowUp.findMany({
						where: {
							OR: [
								{ requestNumber: { in: requestTruckingNos } },
								{ jobNumber: { in: jobNumbers } },
							],
							isDeleted: false,
						},
						select: { jobNumber: true, requestNumber: true },
					})
				: [];

		const truckingParentJobNumbers = truckingRecords
			.map((t) => t.jobNumber)
			.filter((n): n is string => Boolean(n));

		const truckingSubJobs =
			truckingParentJobNumbers.length > 0
				? await prismaRPA.truckingFollowUp.findMany({
						where: {
							parentJobNumber: { in: truckingParentJobNumbers },
							isDeleted: false,
						},
						select: { jobNumber: true, parentJobNumber: true },
					})
				: [];

		const allTruckingJobNumbers = [
			...truckingRecords.map((t) => t.jobNumber),
			...truckingSubJobs.map((t) => t.jobNumber),
		].filter((n): n is string => Boolean(n));

		const allJobNumbersToFetch = [
			...new Set([...jobNumbers, ...allTruckingJobNumbers]),
		];

		// 4. Fetch invoker records for all jobs using Prisma
		type InvokerTaskUser = {
			id: string;
			name: string | null;
			username: string | null;
			email: string;
			image: string | null;
		};
		type InvokerTask = {
			task_name: string;
			status: string | null;
			message: string | null;
			created_time: Date | null;
			started_time: Date | null;
			completed_time: Date | null;
			machine_name: string | null;
			user_account: string | null;
			triggered_by_user: InvokerTaskUser | null;
		};
		const invokerMap: Record<string, InvokerTask[]> = {};

		if (allJobNumbersToFetch.length > 0) {
			try {
				const invokerRecords = await prismaRPA.invoker.findMany({
					where: {
						jobNo: { in: allJobNumbersToFetch },
					},
					select: {
						jobNo: true,
						taskName: true,
						status: true,
						message: true,
						createdTime: true,
						startedTime: true,
						completedTime: true,
						machineName: true,
						userAccount: true,
					},
					orderBy: {
						id: "desc",
					},
				});

				// Collect unique email addresses from invoker records
				const uniqueEmails = [
					...new Set(
						invokerRecords
							.map((r) => r.userAccount)
							.filter((email): email is string => Boolean(email)),
					),
				];

				// Fetch user info for all emails in one query
				const users = await prismaRPA.user.findMany({
					where: {
						email: { in: uniqueEmails },
					},
					select: {
						id: true,
						name: true,
						username: true,
						email: true,
						image: true,
					},
				});

				// Create a map of email -> user data
				const userMap = new Map<string, InvokerTaskUser>();
				for (const user of users) {
					userMap.set(user.email, user);
				}

				// Group by jobNo and map to expected format with user data
				for (const record of invokerRecords) {
					if (!record.jobNo) continue;
					if (!invokerMap[record.jobNo]) {
						invokerMap[record.jobNo] = [];
					}
					invokerMap[record.jobNo].push({
						task_name: record.taskName,
						status: record.status,
						message: record.message,
						created_time: record.createdTime,
						started_time: record.startedTime,
						completed_time: record.completedTime,
						machine_name: record.machineName,
						user_account: record.userAccount,
						triggered_by_user: record.userAccount
							? userMap.get(record.userAccount) || null
							: null,
					});
				}
			} catch (error) {
				console.error("Error fetching invoker records:", error);
			}
		}

		// 5. Merge invoker data and set canEdit permission
		const memberIdsLead = new Set<string>();
		if (currentUser.teamLeaderships) {
			for (const leadership of currentUser.teamLeaderships) {
				if (leadership.team.members) {
					for (const member of leadership.team.members) {
						memberIdsLead.add(member.userId);
					}
				}
				if (leadership.team.leaders) {
					for (const leader of leadership.team.leaders) {
						memberIdsLead.add(leader.userId);
					}
				}
			}
		}

		const isAuthorizedManager =
			currentUser.role === "MANAGER" &&
			(userDeptNames.has("Logistics") || userDeptNames.has("Document"));

		const result = followUps.map((f) => {
			const isOwner = f.createdBy === session.user.id;
			const isAdmin =
				currentUser.role === "ADMIN" || currentUser.role === "SUPERADMIN";
			const isMemberOfLedTeam = memberIdsLead.has(f.createdBy || "");
			const isTeamLeaderWithAccess =
				memberIdsLead.size > 0 && isMemberOfLedTeam;

			const canEdit =
				isOwner || isAdmin || isAuthorizedManager || isTeamLeaderWithAccess;

			const partnerFlags = disabledPartners.find(
				(p) => p.taxCode === f.taxCode && p.site === f.domain,
			);

			// Aggregate tasks from Logistics job number and all related Trucking job numbers
			const relatedJobNumbers = new Set<string>();
			if (f.jobNumber) relatedJobNumbers.add(f.jobNumber);

			const linkedTrucking = truckingRecords.filter(
				(tr) =>
					tr.requestNumber === f.requestTruckingNo ||
					(f.jobNumber && tr.jobNumber === f.jobNumber),
			);

			linkedTrucking.forEach((tr) => {
				if (tr.jobNumber) {
					relatedJobNumbers.add(tr.jobNumber);
					// Also add its sub-jobs
					truckingSubJobs
						.filter((sj) => sj.parentJobNumber === tr.jobNumber)
						.forEach((sj) => {
							if (sj.jobNumber) relatedJobNumbers.add(sj.jobNumber);
						});
				}
			});

			const combinedTasks: InvokerTask[] = [];
			Array.from(relatedJobNumbers).forEach((jn) => {
				if (invokerMap[jn]) {
					combinedTasks.push(...invokerMap[jn]);
				}
			});

			// Sort combined tasks by created time descending
			combinedTasks.sort((a, b) => {
				const timeA = a.created_time ? new Date(a.created_time).getTime() : 0;
				const timeB = b.created_time ? new Date(b.created_time).getTime() : 0;
				return timeB - timeA;
			});

			return {
				...f,
				canEdit,
				enableKVGS: partnerFlags ? partnerFlags.enableKVGS : true,
				enableCDS: partnerFlags ? partnerFlags.enableCDS : true,
				invokerTasks: combinedTasks,
				handlerUser: f.handler
					? handlerUserById.get(f.handler.trim()) ||
						handlerUserByEmail.get(f.handler.trim()) ||
						handlerUserByUsername.get(f.handler.trim())
					: null,
			};
		});

		// If there is a multi-term search, re-sort the final data to match the order of terms
		if (searchTerms.length > 1) {
			result.sort((a: any, b: any) => {
				const findMinIndex = (record: any) => {
					let minIndex = searchTerms.length;
					searchTerms.forEach((term, index) => {
						const lowerTerm = term.toLowerCase();
						const matches =
							record.jobNumber?.toLowerCase().includes(lowerTerm) ||
							record.requestTruckingNo?.toLowerCase().includes(lowerTerm) ||
							record.billOrBooking?.toLowerCase().includes(lowerTerm) ||
							record.arNumber?.toLowerCase().includes(lowerTerm) ||
							record.declarations?.some((d: any) =>
								d.declarationNumber?.toLowerCase().includes(lowerTerm),
							) ||
							record.containers?.some((c: any) =>
								c.containerNo?.toLowerCase().includes(lowerTerm),
							);

						if (matches && index < minIndex) {
							minIndex = index;
						}
					});
					return minIndex;
				};

				return findMinIndex(a) - findMinIndex(b);
			});
		}

		const totalPages = Math.ceil(total / pageSize);

		return NextResponse.json({
			data: result,
			pagination: {
				page,
				pageSize,
				total,
				totalPages,
				hasNextPage: page < totalPages,
				hasPreviousPage: page > 1,
			},
			stats: {
				active: activeNoTruckingCount + activeWithTruckingCount,
				activeNoTrucking: activeNoTruckingCount,
				activeWithTrucking: activeWithTruckingCount,
				finished: finishedCount,
				done: doneCount,
			},
		});
	} catch (error) {
		console.error("Error fetching follow-ups:", error);
		return NextResponse.json(
			{ error: "Failed to fetch follow-ups" },
			{ status: 500 },
		);
	}
}
