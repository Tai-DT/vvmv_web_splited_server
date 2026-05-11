import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

/**
 * GET /api/followup/declaration-report
 * Returns declarations joined with their parent FollowUp, for the Manager report.
 * Supports filters: dateFrom, dateTo, taxCode, companyName, declarationNumber,
 *   operationType, warehouse, jobNumber, workType
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
		const declarationNumber = searchParams.get("declarationNumber");
		const operationType = searchParams.get("operationType");
		const warehouse = searchParams.get("warehouse");
		const jobNumber = searchParams.get("jobNumber");
		const workType = searchParams.get("workType");
		const domain = searchParams.get("domain");
		const search = searchParams.get("search"); // global free-text search

		// Build where clause for Declaration
		const where: any = {
			followUpId: { not: null },
			followUp: { isDeleted: false },
		};

		if (declarationNumber) {
			where.declarationNumber = {
				contains: declarationNumber,
				mode: "insensitive",
			};
		}
		if (workType) {
			where.workType = { contains: workType, mode: "insensitive" };
		}
		if (warehouse) {
			where.warehouse = { contains: warehouse, mode: "insensitive" };
		}
		if (dateFrom || dateTo) {
			where.declarationDate = {};
			if (dateFrom) where.declarationDate.gte = new Date(dateFrom);
			if (dateTo) {
				const end = new Date(dateTo);
				end.setHours(23, 59, 59, 999);
				where.declarationDate.lte = end;
			}
		}

		// Global free-text search: OR across key declaration + followUp fields
		if (search) {
			const terms = search
				.split(/[,\n\t; ]+/)
				.map((t) => t.trim())
				.filter(Boolean);

			if (terms.length > 0) {
				where.OR = terms.map((term) => ({
					OR: [
						{ declarationNumber: { contains: term, mode: "insensitive" } },
						{ workType: { contains: term, mode: "insensitive" } },
						{ authority: { contains: term, mode: "insensitive" } },
						{ batch: { contains: term, mode: "insensitive" } },
						{ billBooking: { contains: term, mode: "insensitive" } },
						{ containers: { contains: term, mode: "insensitive" } },
						{ partner: { contains: term, mode: "insensitive" } },
						{ clientName: { contains: term, mode: "insensitive" } },
						{ mstClient: { contains: term, mode: "insensitive" } },
						{ invoice: { contains: term, mode: "insensitive" } },
						{ pol: { contains: term, mode: "insensitive" } },
						{ pod: { contains: term, mode: "insensitive" } },
						{ warehouse: { contains: term, mode: "insensitive" } },
						{
							followUp: {
								OR: [
									{ jobNumber: { contains: term, mode: "insensitive" } },
									{ companyName: { contains: term, mode: "insensitive" } },
									{ taxCode: { contains: term, mode: "insensitive" } },
									{ billOrBooking: { contains: term, mode: "insensitive" } },
									{ commodityName: { contains: term, mode: "insensitive" } },
									{ invoice: { contains: term, mode: "insensitive" } },
								],
							},
						},
					],
				}));
			}
		}

		// FollowUp-level filters via nested where
		const followUpWhere: any = { isDeleted: false };
		if (taxCode) {
			followUpWhere.taxCode = { contains: taxCode, mode: "insensitive" };
		}
		if (companyName) {
			followUpWhere.companyName = {
				contains: companyName,
				mode: "insensitive",
			};
		}
		if (jobNumber) {
			followUpWhere.jobNumber = { contains: jobNumber, mode: "insensitive" };
		}
		if (operationType) {
			followUpWhere.operationType = operationType;
		}
		const currentUser = await prismaRPA.user.findUnique({
			where: { id: session.user.id },
			select: {
				role: true,
				teamLeaderships: {
					include: {
						team: {
							include: {
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
			},
		});

		if (domain) {
			followUpWhere.domain = domain;
		}

		if (currentUser?.role === "STAFF") {
			const leaderTeamUserIds = new Set<string>([session.user.id]);
			currentUser.teamLeaderships?.forEach((leadership) => {
				leadership.team.members.forEach((member) => {
					leaderTeamUserIds.add(member.userId);
				});
				leadership.team.leaders.forEach((leader) => {
					leaderTeamUserIds.add(leader.userId);
				});
			});

			if ((currentUser.teamLeaderships?.length ?? 0) > 0) {
				// Team leaders can see declarations created/handled by users in teams they lead.
				const scopedUserIds = Array.from(leaderTeamUserIds);
				followUpWhere.OR = [
					{ createdBy: { in: scopedUserIds } },
					{ handler: { in: scopedUserIds } },
				];
			} else {
				// Non-leader STAFF keep self-only visibility.
				followUpWhere.OR = [
					{ handler: session.user.id },
					{ createdBy: session.user.id },
				];
			}
		}

		where.followUp = followUpWhere;

		const declarations = await prismaRPA.declaration.findMany({
			where,
			include: {
				containerLinks: {
					select: {
						container: {
							select: { containerNo: true, containerSize: true },
						},
					},
				},
				truckingFollowUp: {
					select: {
						containers: {
							select: { containerNo: true, containerSize: true },
						},
					},
				},
				followUp: {
					select: {
						id: true,
						jobNumber: true,
						taxCode: true,
						companyName: true,
						operationType: true,
						serviceMode: true,
						warehouse: true,
						authority: true,
						billOrBooking: true,
						etaEtd: true,
						quantity: true,
						grossWeight: true,
						unit: true,
						commodityName: true,
						supplier: true,
						invoice: true,
						pol: true,
						pod: true,
						workType: true,
						note2: true,
						note3: true,
						notes: true,
						handler: true,
						createdAt: true,
						domain: true,
						isFinished: true,
						containers: {
							select: { containerNo: true, containerSize: true },
						},
					},
				},
			},
			orderBy: [{ declarationDate: "desc" }, { createdAt: "desc" }],
			take: 20000,
		});

		// Flatten: one row per declaration
		const rows = declarations.map((d) => {
			let resolvedContainers: {
				containerNo?: string | null;
				containerSize?: string | null;
			}[] = [];
			if (d.containerLinks && d.containerLinks.length > 0) {
				resolvedContainers = d.containerLinks.map((c) => c.container);
			} else if (d.followUp?.containers && d.followUp.containers.length > 0) {
				resolvedContainers = d.followUp.containers;
			} else if (
				d.truckingFollowUp?.containers &&
				d.truckingFollowUp.containers.length > 0
			) {
				resolvedContainers = d.truckingFollowUp.containers;
			}

			const containerDetailsMap = new Map<string, string>();
			resolvedContainers.forEach((c) => {
				if (c.containerNo) {
					containerDetailsMap.set(c.containerNo, c.containerSize || "");
				}
			});
			const containerNos = Array.from(containerDetailsMap.keys()).join("\n");
			const containerSizes = Array.from(containerDetailsMap.values()).join(
				"\n",
			);

			return {
				// Declaration fields
				declarationId: d.id,
				declarationType: null as string | null,
				declarationNumber: d.declarationNumber,
				batch: d.batch,
				authority: d.authority,
				workType: d.workType,
				declarationDate: d.declarationDate,
				grossWeight: d.grossWeight,
				quantity: d.quantity,
				unit: d.unit,
				etaEtd: d.etaEtd,
				billBooking: d.billBooking,
				invoice: d.invoice,
				pol: d.pol,
				pod: d.pod,
				warehouse: d.warehouse,
				mstClient: d.mstClient,
				clientName: d.clientName,
				partner: d.partner,
				totalTaxAmount: d.totalTaxAmount,
				vatTax: d.vatTax,
				ieTax: d.ieTax,
				taxRemark: d.taxRemark,
				tqDate: d.tqDate,
				kvgsDate: d.kvgsDate,
				firstCds: d.firstCds,
				diaDiemLuuKho: d.diaDiemLuuKho,
				diaDiemBaoThue: d.diaDiemBaoThue,
				containers: d.containers,
				attachDocuments: d.attachDocuments,
				driveUrl: d.driveUrl,
				mvUrl: d.mvUrl,
				customsCode: d.customsCode,
				// FollowUp fields
				followUpId: d.followUpId,
				jobNumber: d.followUp?.jobNumber,
				taxCode: d.followUp?.taxCode,
				companyName: d.followUp?.companyName,
				operationType: d.followUp?.operationType,
				serviceMode: d.followUp?.serviceMode,
				followUpWarehouse: d.followUp?.warehouse,
				followUpAuthority: d.followUp?.authority,
				billOrBooking: d.followUp?.billOrBooking,
				supplier: d.followUp?.supplier,
				commodityName: d.followUp?.commodityName,
				followUpNote2: d.followUp?.note2,
				followUpNote3: d.followUp?.note3,
				followUpNotes: d.followUp?.notes,
				handler: d.followUp?.handler,
				isFinished: d.followUp?.isFinished,
				domain: d.followUp?.domain,
				followUpCreatedAt: d.followUp?.createdAt,
				declarationCreatedAt: d.createdAt,
				containerNos,
				containerSizes,
			};
		});

		// Calculate declaration type (TK2) for multiple declarations in same shipment
		const groupedRows = new Map<string, (typeof rows)[0][]>();
		for (const row of rows) {
			const parentId = row.jobNumber || row.followUpId;
			if (!parentId) continue;
			if (!groupedRows.has(parentId)) {
				groupedRows.set(parentId, []);
			}
			groupedRows.get(parentId)?.push(row);
		}

		for (const jobRows of groupedRows.values()) {
			const allDeclarationNumbers = new Set(
				jobRows.map((r) => r.declarationNumber).filter(Boolean),
			);
			// Non-branch declarations
			const nonBranchRows = jobRows.filter((r) => {
				if (!r.firstCds) return true;
				if (r.firstCds === r.declarationNumber) return true;
				if (allDeclarationNumbers.has(r.firstCds)) return false;
				return true;
			});

			// Sort chronologically (earliest first)
			nonBranchRows.sort((a, b) => {
				const dateA = a.declarationDate
					? new Date(a.declarationDate).getTime()
					: 0;
				const dateB = b.declarationDate
					? new Date(b.declarationDate).getTime()
					: 0;
				if (dateA !== dateB) return dateA - dateB;

				const createdA = a.declarationCreatedAt
					? new Date(a.declarationCreatedAt).getTime()
					: 0;
				const createdB = b.declarationCreatedAt
					? new Date(b.declarationCreatedAt).getTime()
					: 0;
				return createdA - createdB;
			});

			// Assign TK1, TK2, TK3... sequentially to main declarations
			const typeMapping = new Map<string, string>();
			nonBranchRows.forEach((row, i) => {
				const typeStr = `TK${i + 1}`;
				row.declarationType = typeStr;
				if (row.declarationNumber) {
					typeMapping.set(row.declarationNumber, typeStr);
				}
			});

			// Branch declarations inherit their parent's sequence number
			const branchRows = jobRows.filter(
				(r) =>
					r.firstCds &&
					allDeclarationNumbers.has(r.firstCds) &&
					r.firstCds !== r.declarationNumber,
			);
			branchRows.forEach((row) => {
				if (row.firstCds && typeMapping.has(row.firstCds)) {
					row.declarationType = typeMapping.get(row.firstCds)!;
				}
			});
		}

		// Group related declarations: Sort by Date, then Job, then Family (First CDS)
		rows.sort((a, b) => {
			// 1. Date DESC (latest day first)
			const dateA = a.declarationDate
				? new Date(a.declarationDate).getTime()
				: 0;
			const dateB = b.declarationDate
				? new Date(b.declarationDate).getTime()
				: 0;
			if (dateB !== dateA) return dateB - dateA;

			// 2. Job Number (Shipment grouping)
			const jobA = a.jobNumber || "";
			const jobB = b.jobNumber || "";
			if (jobA !== jobB) return jobA.localeCompare(jobB);

			// 3. First CDS Family grouping
			// If firstCds is null, we treat the declaration itself as the potential root
			const cdsA = a.firstCds || a.declarationNumber || "";
			const cdsB = b.firstCds || b.declarationNumber || "";
			if (cdsA !== cdsB) return cdsA.localeCompare(cdsB);

			// 4. Stable sort by declaration number
			const decA = a.declarationNumber || "";
			const decB = b.declarationNumber || "";
			return decA.localeCompare(decB);
		});

		return NextResponse.json({ data: rows, total: rows.length });
	} catch (error) {
		console.error("Declaration report error:", error);
		return NextResponse.json(
			{ message: "Failed to fetch declaration report" },
			{ status: 500 },
		);
	}
}
