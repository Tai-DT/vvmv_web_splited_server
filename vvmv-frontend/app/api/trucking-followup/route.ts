import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { createErpFcr } from "@/lib/erp/transaction-service";

export async function GET(request: NextRequest) {
	try {
		console.log("API: Fetching trucking follow-ups...");
		if (!prismaRPA.truckingFollowUp) {
			console.error(
				"CRITICAL: prismaRPA.truckingFollowUp is UNDEFINED. Available models:",
				Object.keys(prismaRPA).filter((k) => !k.startsWith("$")),
			);
			throw new Error("prismaRPA.truckingFollowUp is undefined");
		}
		const { searchParams } = new URL(request.url);
		const search = searchParams.get("search")?.trim();
		const from = searchParams.get("from");
		const to = searchParams.get("to");
		const status = searchParams.get("status"); // all, active, finished
		const hideOthers = searchParams.get("hideOthers") === "true";
		const filtersRaw = searchParams.get("filters");
		const serviceModeTypes = searchParams.get("serviceModeTypes"); // e.g. "fcl,air,lcl"

		let advancedFilters: any[] = [];
		if (filtersRaw) {
			try {
				advancedFilters = JSON.parse(filtersRaw);
			} catch (_e) {}
		}

		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const conditions: any[] = [{ isDeleted: false }];

		// Role-based filtering
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
								members: {
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
								members: {
									select: { userId: true },
								},
							},
						},
					},
				},
			},
		});

		if (currentUser) {
			if (currentUser.role === "ADMIN") {
				if (currentUser.site) {
					conditions.push({ domain: currentUser.site });
				}
			} else if (currentUser.role === "SUPERADMIN") {
				// No site filter for SUPERADMIN
			} else {
				// For STAFF/MANAGER, filter by site(s)
				const userSites = new Set<string>();
				if (currentUser.site) userSites.add(currentUser.site);
				currentUser.departmentAssignments.forEach((da: any) => {
					if (da.department?.site) userSites.add(da.department.site);
				});

				if (userSites.size > 0) {
					conditions.push({ domain: { in: Array.from(userSites) as any } });
				}
			}

			// Calculate teammate IDs for 'hideOthers' narrow down
			const teammateIds = new Set<string>();
			teammateIds.add(session.user.id);
			currentUser.teamLeaderships?.forEach((l) => {
				l.team.members.forEach((m) => teammateIds.add(m.userId));
			});
			currentUser.teamMemberships?.forEach((ms) => {
				ms.team.members.forEach((m) => teammateIds.add(m.userId));
			});
			const _teammateIdsArray = Array.from(teammateIds);

			if (hideOthers) {
				conditions.push({
					OR: [
						{ createdBy: session.user.id },
						{ handler: session.user.id },
						{ OR: [{ handler: null }, { handler: "" }] },
					],
				});
			}
		}

		// Service mode type filtering (FCL / AIR / LCL)
		if (serviceModeTypes && serviceModeTypes !== "fcl,air,lcl") {
			const types = serviceModeTypes.split(",").map((t) => t.trim());
			const hasFcl = types.includes("fcl");
			const hasAir = types.includes("air");
			const hasLcl = types.includes("lcl");

			if (!hasFcl || !hasAir || !hasLcl) {
				const orConditions: any[] = [];

				let reqNosWithContainers: string[] = [];
				if (hasFcl || hasLcl) {
					const logisticsWithContainers = await prismaRPA.followUp.findMany({
						where: {
							containers: { some: {} },
							requestTruckingNo: { not: null },
							isDeleted: false,
						},
						select: { requestTruckingNo: true },
					});
					reqNosWithContainers = [
						...new Set(
							logisticsWithContainers
								.map((f) => f.requestTruckingNo)
								.filter(Boolean) as string[],
						),
					];
				}

				const isFCLCondition: any = {
					OR: [
						{ containers: { some: {} } },
						...(reqNosWithContainers.length > 0
							? [{ requestNumber: { in: reqNosWithContainers } }]
							: []),
					],
				};

				if (hasFcl) {
					orConditions.push(isFCLCondition);
				}
				if (hasAir) {
					orConditions.push({
						serviceMode: { contains: "AIR", mode: "insensitive" },
					});
					orConditions.push({
						serviceMode: { contains: "CPN", mode: "insensitive" },
					});
				}
				if (hasLcl) {
					// LCL = everything that is not FCL and not AIR/CPN
					orConditions.push({
						AND: [
							{ NOT: isFCLCondition },
							{
								NOT: { serviceMode: { contains: "AIR", mode: "insensitive" } },
							},
							{
								NOT: { serviceMode: { contains: "CPN", mode: "insensitive" } },
							},
						],
					});
				}

				if (orConditions.length > 0) {
					conditions.push({ OR: orConditions });
				} else {
					// Nothing selected — return no results (isDeleted is always false per condition above,
					// so this AND contradiction guarantees zero matches)
					conditions.push({ isDeleted: true });
				}
			}
		}

		let searchTerms: string[] = [];
		if (search) {
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
									parentJobNumber: {
										contains: term,
										mode: "insensitive" as const,
									},
								})),
							},
							{
								OR: searchTerms.map((term) => ({
									requestNumber: {
										contains: term,
										mode: "insensitive" as const,
									},
								})),
							},
						]
					: [];

			// 1. Find all matching Trucking records (parents and sub-jobs)
			const matchingTrucking = await prismaRPA.truckingFollowUp.findMany({
				where: {
					AND: [
						...conditions,
						{
							OR: [
								{ requestNumber: { contains: search, mode: "insensitive" } },
								{ jobNumber: { contains: search, mode: "insensitive" } },
								{ companyName: { contains: search, mode: "insensitive" } },
								{ vendor: { contains: search, mode: "insensitive" } },
								{ ops: { contains: search, mode: "insensitive" } },
								{ billOrBooking: { contains: search, mode: "insensitive" } },
								{ eportBooking: { contains: search, mode: "insensitive" } },
								{ vesselName: { contains: search, mode: "insensitive" } },
								{ veselNumber: { contains: search, mode: "insensitive" } },
								{ carrierName: { contains: search, mode: "insensitive" } },
								{ fromLocation: { contains: search, mode: "insensitive" } },
								{ toLocation: { contains: search, mode: "insensitive" } },
								{ warehouse: { contains: search, mode: "insensitive" } },
								{ commodityName: { contains: search, mode: "insensitive" } },
								{ handler: { contains: search, mode: "insensitive" } },
								{ note: { contains: search, mode: "insensitive" } },
								{ note2: { contains: search, mode: "insensitive" } },
								{ note3: { contains: search, mode: "insensitive" } },
								{ note4: { contains: search, mode: "insensitive" } },
								{ note5: { contains: search, mode: "insensitive" } },
								{ transactionCode: { contains: search, mode: "insensitive" } },
								{ invoiceTaxCode: { contains: search, mode: "insensitive" } },
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
												{
													clientName: { contains: search, mode: "insensitive" },
												},
												{
													billBooking: {
														contains: search,
														mode: "insensitive",
													},
												},
											],
										},
									},
								},
								{
									containers: {
										some: {
											containerNo: { contains: search, mode: "insensitive" },
										},
									},
								},
								{
									fcrs: {
										some: {
											OR: [
												{
													fcrNumber: { contains: search, mode: "insensitive" },
												},
												{
													plateNumber: {
														contains: search,
														mode: "insensitive",
													},
												},
											],
										},
									},
								},
								{
									paymentRequests: {
										some: {
											OR: [
												{
													declarationNumber: {
														contains: search,
														mode: "insensitive",
													},
												},
												{
													taxCode: { contains: search, mode: "insensitive" },
												},
												{
													authority: { contains: search, mode: "insensitive" },
												},
												{
													arNumber: { contains: search, mode: "insensitive" },
												},
												{
													notifyNumber: {
														contains: search,
														mode: "insensitive",
													},
												},
											],
										},
									},
								},
								{
									vendorCosts: {
										some: {
											OR: [
												{
													feeName: { contains: search, mode: "insensitive" },
												},
												{
													sellerTaxCode: {
														contains: search,
														mode: "insensitive",
													},
												},
												{
													invoiceNumber: {
														contains: search,
														mode: "insensitive",
													},
												},
												{
													trackingCode: {
														contains: search,
														mode: "insensitive",
													},
												},
												{
													createdByVendor: {
														contains: search,
														mode: "insensitive",
													},
												},
											],
										},
									},
								},
								...multiJobSearchConditions,
							],
						},
					],
				},
				select: {
					jobNumber: true,
					parentJobNumber: true,
					requestNumber: true,
				},
			});

			// 2. Identify linked Logistics (FollowUp) records that match the search
			const multiLogisticsSearchOr: any[] =
				searchTerms.length > 1
					? [
							{
								OR: searchTerms.map((term) => ({
									jobNumber: {
										contains: term,
										mode: "insensitive",
									},
								})),
							},
							{
								OR: searchTerms.map((term) => ({
									requestTruckingNo: {
										contains: term,
										mode: "insensitive",
									},
								})),
							},
						]
					: [];

			const matchingLogistics = await prismaRPA.followUp.findMany({
				where: {
					isDeleted: false,
					OR: [
						{ jobNumber: { contains: search, mode: "insensitive" } },
						{ companyName: { contains: search, mode: "insensitive" } },
						{ billOrBooking: { contains: search, mode: "insensitive" } },
						{ requestTruckingNo: { contains: search, mode: "insensitive" } },
						...multiLogisticsSearchOr,
						{
							declarations: {
								some: {
									declarationNumber: { contains: search, mode: "insensitive" },
								},
							},
						},
						{
							containers: {
								some: {
									containerNo: { contains: search, mode: "insensitive" },
								},
							},
						},
					],
				},
				select: {
					requestTruckingNo: true,
				},
			});

			// 3. Aggregate all relevant identifiers
			const rootJobNumbers = new Set<string>();
			const rootRequestNumbers = new Set<string>();

			matchingTrucking.forEach((r) => {
				if (r.parentJobNumber) {
					rootJobNumbers.add(r.parentJobNumber);
				} else if (r.jobNumber) {
					rootJobNumbers.add(r.jobNumber);
				} else if (r.requestNumber) {
					rootRequestNumbers.add(r.requestNumber);
				}
			});

			matchingLogistics.forEach((f) => {
				if (f.requestTruckingNo) {
					rootRequestNumbers.add(f.requestTruckingNo);
				}
			});

			// 4. Final filter condition for the main query
			conditions.push({
				OR: [
					{ jobNumber: { in: Array.from(rootJobNumbers) } },
					{ requestNumber: { in: Array.from(rootRequestNumbers) } },
				],
			});
		}

		if (from || to) {
			const dateFilter: any = {};
			if (from) {
				dateFilter.gte = new Date(`${from}T00:00:00`);
			}
			if (to) {
				dateFilter.lte = new Date(`${to}T23:59:59.999`);
			}
			conditions.push({
				fcrs: { some: { implementationDate: dateFilter } },
			});
		}

		// Advanced Filters Implementation
		if (advancedFilters.length > 0) {
			const NUMERIC_FIELDS = ["cbm", "grossWeight", "quantity", "amount"];
			const ENUM_FILTER_VALUES: Record<string, string[]> = {
				operationType: ["XUAT", "NHAP"],
			};

			// Pre-process logJobs filters - need async lookup in FollowUp table
			const logJobsFilters = advancedFilters.filter(
				(f: any) => f.column === "logJobs",
			);
			const otherFilters = advancedFilters.filter(
				(f: any) => f.column !== "logJobs",
			);

			// Handle logJobs filters by querying FollowUp table
			for (const filter of logJobsFilters) {
				const { operator, value } = filter;

				if (operator === "is_empty") {
					// Records with no requestNumber won't have linked followUps
					conditions.push({ requestNumber: null });
				} else if (operator === "is_not_empty") {
					conditions.push({ NOT: { requestNumber: null } });
				} else if (value) {
					// Find FollowUp records with matching jobNumber
					const matchingFollowUps = await prismaRPA.followUp.findMany({
						where: {
							jobNumber: { contains: value, mode: "insensitive" },
							isDeleted: false,
						},
						select: { requestTruckingNo: true, jobNumber: true },
					});

					const matchingRequestNumbers = matchingFollowUps
						.map((f) => f.requestTruckingNo)
						.filter((rn): rn is string => !!rn);

					const matchingJobNumbers = matchingFollowUps
						.map((f) => f.jobNumber)
						.filter((jn): jn is string => !!jn);

					const orConditions: any[] = [];
					if (matchingRequestNumbers.length > 0) {
						orConditions.push({
							requestNumber: { in: matchingRequestNumbers },
						});
					}
					if (matchingJobNumbers.length > 0) {
						orConditions.push({ jobNumber: { in: matchingJobNumbers } });
					}

					if (orConditions.length > 0) {
						conditions.push({ OR: orConditions });
					} else {
						// No matches found - add impossible condition to return no results
						conditions.push({ id: "no-match-found" });
					}
				}
			}

			// Continue with other filters
			advancedFilters = otherFilters;

			const buildConditionAsync = async (filter: any) => {
				const { column, operator, value, startDate, endDate } = filter;

				const isNestedFcr = column.startsWith("fcr.");
				const actualColumn = isNestedFcr ? column.split(".")[1] : column;

				if (operator === "date_range") {
					const cond: any = {};
					if (startDate) {
						cond.gte = new Date(`${startDate}T00:00:00`);
					}
					if (endDate) {
						cond.lte = new Date(`${endDate}T23:59:59.999`);
					}

					if (isNestedFcr) {
						return { fcrs: { some: { [actualColumn]: cond } } };
					}
					if (column === "implementationDate") {
						return {
							OR: [
								{ fcrs: { some: { implementationDate: cond } } },
								{
									AND: [
										{ fcrs: { none: { implementationDate: { not: null } } } },
										{ implementationDate: cond },
									],
								},
							],
						};
					}
					return { [column]: cond };
				}

				if (column === "status" || column === "botMessage") {
					if (operator === "is_empty") {
						const jobsWithTasks = await prismaRPA.invoker.findMany({
							select: { jobNo: true },
						});
						const jobNos = [
							...new Set(jobsWithTasks.map((j) => j.jobNo)),
						].filter(Boolean) as string[];
						return { NOT: { jobNumber: { in: jobNos } } };
					}
					if (operator === "is_not_empty") {
						const jobsWithTasks = await prismaRPA.invoker.findMany({
							select: { jobNo: true },
						});
						const jobNos = [
							...new Set(jobsWithTasks.map((j) => j.jobNo)),
						].filter(Boolean) as string[];
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

				if (operator === "is_empty") {
					if (actualColumn === "ccgh") {
						return { [column]: { equals: [] } };
					}
					const cond = {
						OR: [{ [actualColumn]: null }, { [actualColumn]: "" }],
					};
					if (isNestedFcr) return { fcrs: { some: cond } };
					// ops is stored on FCRs (source of truth), not on trucking_follow_up
					if (actualColumn === "ops") {
						return { NOT: { fcrs: { some: { ops: { not: null } } } } };
					}
					if (column === "implementationDate") {
						return {
							AND: [
								{ fcrs: { none: { implementationDate: { not: null } } } },
								{ implementationDate: null },
							],
						};
					}
					return cond;
				}
				if (operator === "is_not_empty") {
					if (actualColumn === "ccgh") {
						return { NOT: { [column]: { equals: [] } } };
					}
					const cond = {
						NOT: { OR: [{ [actualColumn]: null }, { [actualColumn]: "" }] },
					};
					if (isNestedFcr) return { fcrs: { some: cond } };
					// ops is stored on FCRs (source of truth), not on trucking_follow_up
					if (actualColumn === "ops") {
						return { fcrs: { some: { ops: { not: null } } } };
					}
					if (column === "implementationDate") {
						return {
							OR: [
								{ fcrs: { some: { implementationDate: { not: null } } } },
								{ implementationDate: { not: null } },
							],
						};
					}
					return cond;
				}

				let parsedValue: any = value;
				if (NUMERIC_FIELDS.includes(actualColumn)) {
					parsedValue = parseFloat(value);
					if (Number.isNaN(parsedValue)) return {};
				}

				// Boolean fields: convert "true"/"false" string → boolean
				const BOOLEAN_FILTER_FIELDS = ["pvst", "bienBanBT"];
				if (BOOLEAN_FILTER_FIELDS.includes(actualColumn)) {
					parsedValue = value === "true";
					// bienBanBT is stored on FCRs (source of truth), not on trucking_follow_up
					if (actualColumn === "bienBanBT") {
						return { fcrs: { some: { bienBanBT: parsedValue } } };
					}
					return { [actualColumn]: parsedValue };
				}

				const enumValues = ENUM_FILTER_VALUES[actualColumn];
				if (enumValues) {
					const normalizedValue = String(parsedValue || "")
						.trim()
						.toUpperCase();
					const matchedEnumValues = normalizedValue
						? enumValues.filter((enumValue) => {
								switch (operator) {
									case "contains":
									case "starts_with":
										return enumValue.startsWith(normalizedValue);
									case "ends_with":
										return enumValue.endsWith(normalizedValue);
									default:
										return enumValue === normalizedValue;
								}
							})
						: [];

					switch (operator) {
						case "contains":
						case "starts_with":
						case "ends_with":
						case "equals":
							return matchedEnumValues.length > 0
								? { [column]: { in: matchedEnumValues } }
								: { id: "no-match-found" };
						case "does_not_contain":
						case "does_not_equal":
							return matchedEnumValues.length > 0
								? { [column]: { notIn: matchedEnumValues } }
								: {};
						default:
							return normalizedValue ? { [column]: normalizedValue } : {};
					}
				}

				const prismaOp: any = {};

				if (actualColumn === "ccgh") {
					switch (operator) {
						case "contains":
						case "equals":
						case "starts_with":
						case "ends_with":
							return { [column]: { has: parsedValue } };
						case "does_not_contain":
						case "does_not_equal":
							return { NOT: { [column]: { has: parsedValue } } };
						default:
							return { [column]: { has: parsedValue } };
					}
				}

				switch (operator) {
					case "contains":
						prismaOp.contains = parsedValue;
						prismaOp.mode = "insensitive";
						break;
					case "does_not_contain":
						prismaOp.not = { contains: parsedValue, mode: "insensitive" };
						break;
					case "equals":
						prismaOp.equals = parsedValue;
						if (typeof parsedValue === "string") prismaOp.mode = "insensitive";
						break;
					case "does_not_equal":
						prismaOp.not = { equals: parsedValue };
						if (typeof parsedValue === "string")
							prismaOp.not.mode = "insensitive";
						break;
					case "starts_with":
						prismaOp.startsWith = parsedValue;
						prismaOp.mode = "insensitive";
						break;
					case "ends_with":
						prismaOp.endsWith = parsedValue;
						prismaOp.mode = "insensitive";
						break;
					default:
						prismaOp.equals = parsedValue;
				}

				if (isNestedFcr) {
					return { fcrs: { some: { [actualColumn]: prismaOp } } };
				}
				// ops is stored on FCRs (source of truth), not on trucking_follow_up
				if (actualColumn === "ops") {
					return { fcrs: { some: { ops: prismaOp } } };
				}
				return { [column]: prismaOp };
			};

			// Only process remaining filters if there are any
			if (advancedFilters.length > 0) {
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
				conditions.push({ OR: orGroups });
			}
		}

		// 4. Pagination
		const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
		const pageSize = Math.max(
			1,
			Math.min(100000, parseInt(searchParams.get("pageSize") || "100", 10)),
		);
		const skip = (page - 1) * pageSize;

		// Status Filtering
		const statusConditions: any[] = [];
		if (status === "active") {
			statusConditions.push({ isFinished: false });
		} else if (status === "pending") {
			// Chưa xếp xe: active + (không có FCR nào) hoặc (có FCR chưa có biển số)
			// = active AND NOT (tất cả FCR đã có biển số AND có ít nhất 1 FCR)
			statusConditions.push({
				isFinished: false,
				NOT: {
					fcrs: {
						every: {
							AND: [
								{ NOT: { plateNumber: null } },
								{ NOT: { plateNumber: "" } },
							],
						},
						some: {},
					},
				},
			});
		} else if (status === "loaded") {
			// Đã xếp: active + tất cả FCR đã có biển số xe (và phải có ít nhất 1 FCR)
			statusConditions.push({
				isFinished: false,
				fcrs: {
					every: {
						AND: [{ NOT: { plateNumber: null } }, { NOT: { plateNumber: "" } }],
					},
					some: {},
				},
			});
		} else if (status === "finished") {
			statusConditions.push({ isFinished: true });
		} else if (status === "done") {
			statusConditions.push({
				isFinished: true,
				NOT: { ccgh: { equals: [] } },
				containers: {
					every: {
						AND: [{ podUrl: { not: null } }, { podUrl: { not: "" } }],
					},
				},
			});
		} else if (status === "pending-trucking-approval") {
			// Jobs có phí cước (isDisbursement=false) chưa duyệt — dành cho Trucking
			statusConditions.push({
				fcrs: {
					some: {
						vendorCosts: {
							some: {
								isDisbursement: false,
								NOT: { status: { in: ["APPROVED", "REJECTED"] } },
							},
						},
					},
				},
			});
		} else if (status === "pending-disbursement-approval") {
			// Jobs có chi hộ (isDisbursement=true) chưa duyệt — dành cho Accounting
			statusConditions.push({
				fcrs: {
					some: {
						vendorCosts: {
							some: {
								isDisbursement: true,
								isSelling: true,
								NOT: { status: { in: ["APPROVED", "REJECTED"] } },
							},
						},
					},
				},
			});
		}

		// Only show parent jobs in the main list
		const mainConditions = [
			...conditions,
			...statusConditions,
			{ parentJobNumber: null },
		];

		const statsBaseConditions = [...conditions, { parentJobNumber: null }];

		const [
			truckingFollowUps,
			total,
			activeCount,
			pendingCount,
			loadedCount,
			finishedCount,
			doneCount,
			pendingTruckingApprovalCount,
			pendingDisbursementApprovalCount,
		] = await Promise.all([
			prismaRPA.truckingFollowUp.findMany({
				where: { AND: mainConditions },
				include: {
					fcrs: {
						orderBy: {
							fcrNumber: "asc",
						},
						include: {
							vendorCosts: {
								orderBy: [{ rowOrder: "asc" }, { createdAt: "asc" }],
								select: {
									id: true,
									truckingFollowUpId: true,
									fcrId: true,
									vendorId: true,
									feeTypeId: true,
									feeName: true,
									isDisbursement: true,
									isSelling: true,
									vatPercent: true,
									totalVat: true,
									totalFee: true,
									sellerTaxCode: true,
									invoiceNumber: true,
									invoiceLink: true,
									trackingCode: true,
									note: true,
									rowOrder: true,
									entryMode: true,
									createdByVendor: true,
									createdAt: true,
									updatedAt: true,
									// Status workflow
									status: true,
									rejectionReason: true,
									reviewedById: true,
									reviewedAt: true,
									reviewMessage: true,
									reviewer: {
										select: { name: true, email: true },
									},
									vendor: {
										select: {
											name: true,
										},
									},
									feeType: {
										select: {
											name: true,
											isNotDefault: true,
										},
									},
								},
							},
							truckingNumber: {
								select: {
									driverName: true,
									plateNumber: true,
									driverPhone: true,
									driverCCCD: true,
									driverLicense: true,
								},
							},
						},
					},
					declarations: true,
					containers: {
						orderBy: [{ createdAt: "asc" }, { id: "asc" }],
						include: {
							declarationLinks: {
								select: {
									declarationId: true,
									declaration: {
										select: { id: true, declarationNumber: true },
									},
								},
							},
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
					handlerUser: {
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
							activityLogs: true,
							paymentRequests: true,
						},
					},
				},
				orderBy: {
					createdAt: "desc",
				},
				skip,
				take: pageSize,
			}),
			prismaRPA.truckingFollowUp.count({
				where: { AND: mainConditions },
			}),
			// Active count (all unfinished)
			prismaRPA.truckingFollowUp.count({
				where: { AND: [...statsBaseConditions, { isFinished: false }] },
			}),
			// Pending count: active + (không có FCR nào) OR (có FCR chưa có biển số)
			prismaRPA.truckingFollowUp.count({
				where: {
					AND: [
						...statsBaseConditions,
						{ isFinished: false },
						{
							NOT: {
								fcrs: {
									every: {
										AND: [
											{ NOT: { plateNumber: null } },
											{ NOT: { plateNumber: "" } },
										],
									},
									some: {},
								},
							},
						},
					],
				},
			}),
			// Loaded count: active + có FCR + tất cả FCR đã có biển số
			prismaRPA.truckingFollowUp.count({
				where: {
					AND: [
						...statsBaseConditions,
						{ isFinished: false },
						{
							fcrs: {
								every: {
									AND: [
										{ NOT: { plateNumber: null } },
										{ NOT: { plateNumber: "" } },
									],
								},
								some: {},
							},
						},
					],
				},
			}),
			prismaRPA.truckingFollowUp.count({
				where: { AND: [...statsBaseConditions, { isFinished: true }] },
			}),
			prismaRPA.truckingFollowUp.count({
				where: {
					AND: [
						...statsBaseConditions,
						{ isFinished: true },
						{ NOT: { ccgh: { equals: [] } } },
						{
							containers: {
								every: {
									AND: [{ podUrl: { not: null } }, { podUrl: { not: "" } }],
								},
							},
						},
					],
				},
			}),
			// Pending trucking vendor costs approval (isDisbursement=false) — for Trucking team
			prismaRPA.truckingFollowUp.count({
				where: {
					AND: [
						...statsBaseConditions,
						{
							fcrs: {
								some: {
									vendorCosts: {
										some: {
											isDisbursement: false,
											NOT: { status: { in: ["APPROVED", "REJECTED"] } },
										},
									},
								},
							},
						},
					],
				},
			}),
			// Pending disbursement vendor costs approval (isDisbursement=true) — for Accounting team
			prismaRPA.truckingFollowUp.count({
				where: {
					AND: [
						...statsBaseConditions,
						{
							fcrs: {
								some: {
									vendorCosts: {
										some: {
											isDisbursement: true,
											isSelling: true,
											NOT: { status: { in: ["APPROVED", "REJECTED"] } },
										},
									},
								},
							},
						},
					],
				},
			}),
		]);

		// Fetch related sub-jobs for the current page
		const parentJobNumbers = truckingFollowUps
			.map((t) => t.jobNumber)
			.filter((n): n is string => !!n);

		let subJobs: any[] = [];
		if (parentJobNumbers.length > 0) {
			// Lấy cả sub-jobs đã bị xóa mềm (isDeleted = true) để merge ccgh
			subJobs = await prismaRPA.truckingFollowUp.findMany({
				where: {
					parentJobNumber: { in: parentJobNumbers },
					// KHÔNG filter isDeleted, lấy cả true/false
				},
				include: {
					fcrs: {
						orderBy: {
							fcrNumber: "asc",
						},
						include: {
							vendorCosts: {
								orderBy: [{ rowOrder: "asc" }, { createdAt: "asc" }],
								select: {
									id: true,
									truckingFollowUpId: true,
									fcrId: true,
									vendorId: true,
									feeTypeId: true,
									feeName: true,
									isDisbursement: true,
									isSelling: true,
									vatPercent: true,
									totalVat: true,
									totalFee: true,
									sellerTaxCode: true,
									invoiceNumber: true,
									invoiceLink: true,
									trackingCode: true,
									note: true,
									rowOrder: true,
									entryMode: true,
									createdByVendor: true,
									createdAt: true,
									updatedAt: true,
									vendor: {
										select: {
											name: true,
										},
									},
									feeType: {
										select: {
											name: true,
										},
									},
								},
							},
						},
					},
					declarations: true,
					containers: {
						orderBy: [{ createdAt: "asc" }, { id: "asc" }],
						include: {
							declarationLinks: {
								select: {
									declarationId: true,
									declaration: {
										select: { id: true, declarationNumber: true },
									},
								},
							},
						},
					},
				},
			});
		}

		// Collect all request numbers from both parents and sub-jobs
		const allTruckingJobs = [...truckingFollowUps, ...subJobs];
		const requestNumbers = allTruckingJobs
			.map((t) => t.requestNumber)
			.filter((n): n is string => !!n);
		const jobNumbers = allTruckingJobs
			.map((t) => t.jobNumber)
			.filter((n): n is string => !!n);

		let relatedFollowUps: any[] = [];
		if (requestNumbers.length > 0 || jobNumbers.length > 0) {
			relatedFollowUps = await prismaRPA.followUp.findMany({
				where: {
					OR: [
						{ requestTruckingNo: { in: requestNumbers } },
						{ jobNumber: { in: jobNumbers } },
					],
					isDeleted: false,
				},
				include: {
					declarations: true,
					containers: {
						orderBy: [{ createdAt: "asc" }, { id: "asc" }],
						include: {
							declarationLinks: {
								select: {
									declarationId: true,
									declaration: {
										select: { id: true, declarationNumber: true },
									},
								},
							},
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
				},
			});

			// Fetch handler user info for all followUps
			const handlerIds = relatedFollowUps
				.map((f) => f.handler)
				.filter((h): h is string => !!h && h.length > 0);

			if (handlerIds.length > 0) {
				const handlerUsers = await prismaRPA.user.findMany({
					where: { id: { in: handlerIds } },
					select: {
						id: true,
						name: true,
						email: true,
						username: true,
						image: true,
					},
				});

				const handlerUserMap = new Map(handlerUsers.map((u) => [u.id, u]));

				// Attach handlerUser to each followUp
				relatedFollowUps = relatedFollowUps.map((f) => ({
					...f,
					handlerUser: f.handler ? handlerUserMap.get(f.handler) || null : null,
				}));
			}
		}

		const totalPages = Math.ceil(total / pageSize);

		const normalize = (value: unknown) =>
			String(value ?? "")
				.trim()
				.toLowerCase();

		const getHighestPriorityBatch = (
			declarations: any[],
		): "red" | "yellow" | "green" | null => {
			let highest: "yellow" | "green" | null = null;
			for (const d of declarations) {
				const batch = normalize(d?.batch);
				if (batch === "đỏ") return "red";
				if (batch === "vàng") highest = "yellow";
				if (batch === "xanh" && highest == null) highest = "green";
			}
			return highest;
		};

		const _hasRedDeclarationInJob = (declarations: any[]): boolean => {
			return getHighestPriorityBatch(declarations) === "red";
		};

		const hasTqDateForAllDeclarations = (declarations: any[]): boolean => {
			if (!declarations.length) return false;

			return declarations.every((declaration) => {
				const tqDate = declaration?.tqDate;
				return (
					tqDate !== null &&
					tqDate !== undefined &&
					String(tqDate).trim() !== ""
				);
			});
		};

		// Transform and Merge Data
		const transformedData = truckingFollowUps.map((tf) => {
			const followUpsMap = new Map<string, any>();
			const currentSubJobs = subJobs.filter(
				(sj) => sj.parentJobNumber === tf.jobNumber,
			);

			const mergedCcgh = Array.from(
				new Set([
					...(tf.ccgh ?? []),
					...currentSubJobs.flatMap((sj) => sj.ccgh ?? []),
				]),
			);

			const linkedDeclarations = [...tf.declarations];
			const linkedContainers = [...tf.containers];
			const linkedFcrs = [...tf.fcrs];

			// Merge data from sub-jobs
			currentSubJobs.forEach((sj) => {
				sj.declarations?.forEach((d: any) => {
					if (!linkedDeclarations.some((existing) => existing.id === d.id)) {
						linkedDeclarations.push(d);
					}
				});
				sj.containers?.forEach((c: any) => {
					if (!linkedContainers.some((existing) => existing.id === c.id)) {
						linkedContainers.push(c);
					}
				});
				sj.fcrs?.forEach((f: any) => {
					if (!linkedFcrs.some((existing) => existing.id === f.id)) {
						linkedFcrs.push(f);
					}
				});
			});

			// Find logistics matches for parent and all its sub-jobs
			const relevantRequestNumbers = [
				tf.requestNumber,
				...currentSubJobs.map((sj) => sj.requestNumber),
			].filter(Boolean);

			relevantRequestNumbers.forEach((reqNum) => {
				const matches = relatedFollowUps.filter(
					(f) =>
						f.requestTruckingNo === reqNum ||
						(tf.jobNumber && f.jobNumber === tf.jobNumber) ||
						currentSubJobs.some(
							(sj) => sj.jobNumber && f.jobNumber === sj.jobNumber,
						),
				);
				matches.forEach((f) => {
					followUpsMap.set(f.id, f);
					// Add declarations/containers from the linked FollowUp if not already present
					if (f.declarations) {
						f.declarations.forEach((d: any) => {
							if (
								!linkedDeclarations.some((existing) => existing.id === d.id)
							) {
								linkedDeclarations.push(d);
							}
						});
					}
					if (f.containers) {
						f.containers.forEach((c: any) => {
							if (!linkedContainers.some((existing) => existing.id === c.id)) {
								linkedContainers.push(c);
							}
						});
					}
				});
			});

			// Aggregate fields from FCRs into main row
			const vendors = [
				...new Set(linkedFcrs.map((f) => f.vendor).filter(Boolean)),
			] as string[];
			const opsValues = [
				...new Set(linkedFcrs.map((f) => f.ops).filter(Boolean)),
			] as string[];
			const bienBanBTValues = linkedFcrs
				.map((f) => f.bienBanBT)
				.filter((v) => v === true);
			const implementationDates = [
				...new Set(
					linkedFcrs
						.map((f) => {
							if (!f.implementationDate) return null;
							const date = new Date(f.implementationDate);
							if (Number.isNaN(date.getTime())) return null;
							return date.toLocaleDateString("vi-VN");
						})
						.filter(Boolean),
				),
			] as string[];
			const pickupAts = [
				...new Set(linkedFcrs.map((f) => f.pickupAt).filter(Boolean)),
			] as string[];
			const deliveryAts = [
				...new Set(linkedFcrs.map((f) => f.deliveryAt).filter(Boolean)),
			] as string[];
			const truckTypes = [
				...new Set(linkedFcrs.map((f) => f.truckType).filter(Boolean)),
			] as string[];

			// Aggregate container fields into main row
			const containerCutOffTimes = [
				...new Set(
					linkedContainers
						.map((c) => {
							if (!c.cutOffTime) return null;
							const date = new Date(c.cutOffTime);
							if (Number.isNaN(date.getTime())) return null;
							return (
								date.toLocaleDateString("vi-VN") +
								" " +
								date.toLocaleTimeString("vi-VN", {
									hour: "2-digit",
									minute: "2-digit",
								})
							);
						})
						.filter(Boolean),
				),
			] as string[];
			const containerClosingTimes = [
				...new Set(
					linkedContainers
						.map((c) => {
							if (!c.closingTime) return null;
							const date = new Date(c.closingTime);
							if (Number.isNaN(date.getTime())) return null;
							return date.toLocaleDateString("vi-VN");
						})
						.filter(Boolean),
				),
			] as string[];
			const containerVesselNames = [
				...new Set(linkedContainers.map((c) => c.vesselName).filter(Boolean)),
			] as string[];
			const containerVeselNumbers = [
				...new Set(linkedContainers.map((c) => c.veselNumber).filter(Boolean)),
			] as string[];
			const containerPickOrLiftPlaces = [
				...new Set(
					linkedContainers.map((c) => c.pickOrLiftPlace).filter(Boolean),
				),
			] as string[];
			const containerMaLos = [
				...new Set(linkedContainers.map((c) => c.maLo).filter(Boolean)),
			] as string[];
			const containerVatTaxCodes = [
				...new Set(linkedContainers.map((c) => c.vatTaxCode).filter(Boolean)),
			] as string[];

			const highestPriorityBatch = getHighestPriorityBatch(linkedDeclarations);
			const hasRedDeclaration = highestPriorityBatch === "red";
			const hasTqDateComplete = hasTqDateForAllDeclarations(linkedDeclarations);

			return {
				...tf,
				ccgh: mergedCcgh,
				hasRedDeclaration,
				hasTqDateComplete,
				highestPriorityBatch,
				vendor: vendors.length > 0 ? vendors.join("\n") : (tf.vendor ?? ""),
				ops: opsValues.length > 0 ? opsValues.join("\n") : (tf.ops ?? ""),
				bienBanBT: bienBanBTValues.length > 0 ? true : (tf.bienBanBT ?? false),
				implementationDate:
					implementationDates.length > 0
						? implementationDates.join("\n")
						: (tf.implementationDate ?? ""),
				fromLocation:
					pickupAts.length > 0 ? pickupAts.join("\n") : (tf.fromLocation ?? ""),
				toLocation:
					deliveryAts.length > 0
						? deliveryAts.join("\n")
						: (tf.toLocation ?? ""),
				truckType:
					truckTypes.length > 0 ? truckTypes.join("\n") : (tf.truckType ?? ""),
				...(linkedContainers.length > 0 && {
					cutOffTime: containerCutOffTimes.join("\n"),
					closingTime: containerClosingTimes.join("\n"),
					vesselName: containerVesselNames.join("\n"),
					veselNumber: containerVeselNumbers.join("\n"),
					pickOrLiftPlace: containerPickOrLiftPlaces.join("\n"),
					maLo: containerMaLos.join("\n"),
					invoiceTaxCode: containerVatTaxCodes.join("\n"),
				}),
				followUps: Array.from(followUpsMap.values()),
				declarations: linkedDeclarations,
				// Map declarationLinks (Prisma relation name) → linkedDeclarations (UI type name)
				containers: linkedContainers.map((c: any) => ({
					...c,
					linkedDeclarations: (c.declarationLinks ?? []).map((link: any) => ({
						id: link.declaration?.id ?? link.declarationId,
						declarationNumber: link.declaration?.declarationNumber ?? null,
					})),
				})),
				fcrs: linkedFcrs,
				subJobsCount: currentSubJobs.length,
			};
		});

		// Collect all job numbers to fetch invoker tasks for all trucking follow-ups
		const truckingJobNumbers = allTruckingJobs
			.map((t) => t.jobNumber)
			.filter((j): j is string => Boolean(j));

		const logisticsJobNumbers = relatedFollowUps
			.map((f) => f.jobNumber)
			.filter((j): j is string => Boolean(j));

		const allJobNumbers = [
			...new Set([...truckingJobNumbers, ...logisticsJobNumbers]),
		];

		type InvokerTaskUser = {
			id: string;
			name: string | null;
			username: string | null;
			email: string;
			image: string | null;
		};
		type InvokerTaskItem = {
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
		const invokerMap: Record<string, InvokerTaskItem[]> = {};

		if (allJobNumbers.length > 0) {
			try {
				const invokerRecords = await prismaRPA.invoker.findMany({
					where: {
						jobNo: { in: allJobNumbers },
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
				const users =
					uniqueEmails.length > 0
						? await prismaRPA.user.findMany({
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
							})
						: [];

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

		// Merge invoker tasks into transformed data, combining tasks from all related jobs
		const finalData = transformedData.map((t) => {
			const currentSubJobs = subJobs.filter(
				(sj) => sj.parentJobNumber === t.jobNumber,
			);

			const relatedJobNumbers = new Set<string>();
			if (t.jobNumber) relatedJobNumbers.add(t.jobNumber);
			currentSubJobs.forEach((sj) => {
				if (sj.jobNumber) relatedJobNumbers.add(sj.jobNumber);
			});
			t.followUps?.forEach((f: any) => {
				if (f.jobNumber) relatedJobNumbers.add(f.jobNumber);
			});

			const combinedTasks: InvokerTaskItem[] = [];
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
				...t,
				logJobs:
					t.followUps
						?.map((f: any) => f.jobNumber)
						.filter(Boolean)
						.join(", ") || "",
				invokerTasks: combinedTasks,
			};
		});

		// If there is a multi-term search, re-sort the final data to match the order of terms
		if (searchTerms.length > 1) {
			finalData.sort((a, b) => {
				const findMinIndex = (record: any) => {
					let minIndex = searchTerms.length;
					searchTerms.forEach((term, index) => {
						const lowerTerm = term.toLowerCase();
						const matches =
							record.jobNumber?.toLowerCase().includes(lowerTerm) ||
							record.requestNumber?.toLowerCase().includes(lowerTerm) ||
							record.billOrBooking?.toLowerCase().includes(lowerTerm) ||
							record.declarations?.some((d: any) =>
								d.declarationNumber?.toLowerCase().includes(lowerTerm),
							) ||
							record.containers?.some((c: any) =>
								c.containerNo?.toLowerCase().includes(lowerTerm),
							) ||
							record.fcrs?.some((f: any) =>
								f.fcrNumber?.toLowerCase().includes(lowerTerm),
							) ||
							record.logJobs?.toLowerCase().includes(lowerTerm) ||
							record.note5?.toLowerCase().includes(lowerTerm);

						if (matches && index < minIndex) {
							minIndex = index;
						}
					});
					return minIndex;
				};

				return findMinIndex(a) - findMinIndex(b);
			});
		}

		return NextResponse.json({
			data: finalData,
			pagination: {
				total,
				page,
				pageSize,
				totalPages,
				hasNextPage: page < totalPages,
				hasPreviousPage: page > 1,
			},
			stats: {
				active: activeCount,
				pending: pendingCount,
				loaded: loadedCount,
				finished: finishedCount,
				done: doneCount,
				total: activeCount + finishedCount + doneCount,
				pendingTruckingApproval: pendingTruckingApprovalCount,
				pendingDisbursementApproval: pendingDisbursementApprovalCount,
			},
		});
	} catch (error) {
		console.error("Error fetching trucking follow-ups:", error);
		return NextResponse.json(
			{
				message: "Failed to fetch trucking follow-up records",
				error: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 },
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		// Block Accounting department users — view-only access
		const actingUserPost = await prismaRPA.user.findUnique({
			where: { id: session.user.id },
			select: {
				role: true,
				site: true,
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
		if (actingUserPost) {
			const isAdmin =
				actingUserPost.role === "ADMIN" || actingUserPost.role === "SUPERADMIN";
			if (!isAdmin) {
				const deptNames = new Set<string>();
				actingUserPost.departmentAssignments.forEach((da: any) => {
					if (da.department?.name) deptNames.add(da.department.name);
				});
				actingUserPost.teamLeaderships?.forEach((tl: any) => {
					if (tl.team?.department?.name) deptNames.add(tl.team.department.name);
				});
				actingUserPost.teamMemberships?.forEach((tm: any) => {
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

		const body = await request.json();

		const parseDate = (val: any) => {
			if (!val) return null;
			const d = new Date(val);
			return Number.isNaN(d.getTime()) ? null : d;
		};

		// Get user info for site/creator attribution
		const dbUser = await prismaRPA.user.findUnique({
			where: { id: session.user.id },
			select: { site: true },
		});

		const {
			containers,
			fromLocation,
			toLocation,
			vendor,
			truckType,
			tTypeC,
			implementationDate,
			...restOfBody
		} = body;

		// Resolve warehouse: use provided value, else match partner name, else 1st configured kho for taxCode, else null
		let warehouseValue: string | null =
			typeof body.warehouse === "string" && body.warehouse.trim() !== ""
				? body.warehouse.trim()
				: null;

		if (!warehouseValue && body.taxCode) {
			const partnerData = await prismaRPA.partnersMasterData.findFirst({
				where: { taxCode: body.taxCode },
				select: {
					fullName: true,
					warehouseConfigs: {
						select: { warehouseName: true },
					},
				},
			});

			if (
				partnerData?.warehouseConfigs &&
				partnerData.warehouseConfigs.length > 0
			) {
				const exactMatch = partnerData.fullName
					? partnerData.warehouseConfigs.find(
							(w) =>
								w.warehouseName.toLowerCase() ===
								partnerData.fullName?.toLowerCase(),
						)
					: null;

				if (exactMatch) {
					warehouseValue = exactMatch.warehouseName;
				} else {
					const sorted = [...partnerData.warehouseConfigs].sort((a, b) =>
						a.warehouseName.localeCompare(b.warehouseName),
					);
					warehouseValue = sorted[0].warehouseName;
				}
			} else {
				warehouseValue = null;
			}
		}

		const shouldSeedFcr =
			body.requestNumber && String(body.requestNumber).startsWith("FCR");

		const requestedContainerCount =
			Array.isArray(containers) && containers.length > 0
				? containers.length
				: 0;
		const extraErpFcrCount =
			shouldSeedFcr && requestedContainerCount > 1
				? requestedContainerCount - 1
				: 0;

		const extraErpFcrNumbers: string[] = [];
		if (extraErpFcrCount > 0) {
			const jobNumber =
				typeof body.jobNumber === "string" ? body.jobNumber.trim() : "";
			const site = body.domain || dbUser?.site || "SGN";

			if (!jobNumber) {
				throw new Error(
					"Missing jobNumber when creating additional FCR records",
				);
			}

			for (let i = 0; i < extraErpFcrCount; i += 1) {
				const erpFcr = await createErpFcr({
					jobNumber,
					site,
				});
				extraErpFcrNumbers.push(erpFcr.HWBNO);
			}
		}

		const truckingFollowUp = await prismaRPA.$transaction(async (tx) => {
			const createdFollowUp = await tx.truckingFollowUp.create({
				data: {
					...restOfBody,
					createdBy: session.user.id,
					handler: session.user.id,
					domain: body.domain || dbUser?.site || "SGN",
					cbm: body.cbm ? parseFloat(body.cbm) : null,
					grossWeight: body.grossWeight ? parseFloat(body.grossWeight) : null,
					quantity: body.quantity ? parseInt(body.quantity, 10) : null,
					amount: body.amount ? parseFloat(body.amount) : null,
					closingTime: parseDate(body.closingTime),
					cutOffTime: parseDate(body.cutOffTime),
					pickUpTime: body.pickUpTime,
					ngatDienDate: parseDate(body.ngatDienDate),
					implementationDate: parseDate(body.implementationDate),
					// Create containers if present
					containers:
						containers && containers.length > 0
							? {
									create: containers.map((c: any) => ({
										containerNo: c.containerNo || null,
										sealNo: c.sealNo || null,
										containerSize: c.containerSize || null,
										plateNumber: c.plateNumber || null,
										quantity: c.quantity ? parseInt(c.quantity, 10) : 1,
										grossWeight: c.grossWeight
											? parseFloat(c.grossWeight)
											: null,
										tareWeight: c.tareWeight ? parseFloat(c.tareWeight) : null,
										warehouse: warehouseValue || c.warehouse || null,
									})),
								}
							: undefined,
				},
				include: {
					containers: {
						orderBy: [{ createdAt: "asc" }, { id: "asc" }],
					},
				},
			});

			if (shouldSeedFcr) {
				const baseFcrData: any = {
					shipper: body.taxCode || null,
					vendor: body.vendor || null,
					grossWeight: body.grossWeight ? parseFloat(body.grossWeight) : null,
					quantity: body.quantity ? parseFloat(body.quantity) : null,
					cbm: body.cbm ? parseFloat(body.cbm) : null,
					implementationDate: parseDate(body.implementationDate),
					notes: body.note || null,
					pickupAt: body.fromLocation || null,
					deliveryAt: body.toLocation || null,
					warehouse: warehouseValue,
					truckType: body.truckType || null,
					tType: body.truckType || null,
					tTypeC: body.truckType || null,
					plateNumber: null,
				};

				// Extract plate from note5 for FCR if no containers provide it
				if (body.note5) {
					const plateMatch = String(body.note5).match(
						/\b([0-9]{2}[A-Z]{1,2}[\s\-.]?[0-9]{3,5}(?:[.\s]?[0-9]{1,2})?)\b/i,
					);
					if (plateMatch) {
						baseFcrData.plateNumber = plateMatch[1]
							.replace(/[\s\-.]/g, "")
							.toUpperCase();
					}
				}

				const createdContainers = createdFollowUp.containers ?? [];

				if (createdContainers.length > 0) {
					await tx.fCR.createMany({
						data: createdContainers.map((container, index) => ({
							truckingFollowUpId: createdFollowUp.id,
							containerId: container.id,
							containerNo: container.containerNo || null,
							plateNumber: container.plateNumber || baseFcrData.plateNumber,
							fcrNumber:
								index === 0
									? String(body.requestNumber)
									: (extraErpFcrNumbers[index - 1] ?? null),
							...baseFcrData,
							truckType: container.containerSize || baseFcrData.truckType,
							tTypeC: container.containerSize || baseFcrData.tTypeC,
						})),
					});
				} else {
					await tx.fCR.create({
						data: {
							truckingFollowUpId: createdFollowUp.id,
							fcrNumber: String(body.requestNumber),
							...baseFcrData,
						},
					});
				}
			}

			const fullRecord = await tx.truckingFollowUp.findUnique({
				where: { id: createdFollowUp.id },
				include: {
					containers: {
						orderBy: [{ createdAt: "asc" }, { id: "asc" }],
					},
					fcrs: true,
				},
			});

			if (!fullRecord) {
				throw new Error("Failed to fetch created trucking follow-up record");
			}

			return fullRecord;
		});

		return NextResponse.json(truckingFollowUp, { status: 201 });
	} catch (error) {
		console.error("Error creating trucking follow-up:", error);
		return NextResponse.json(
			{
				message: "Failed to create trucking follow-up record",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
