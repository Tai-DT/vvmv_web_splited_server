import { type NextRequest, NextResponse } from "next/server";
import { logFollowUpActivity } from "@/lib/activity-logger";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { blockIfAccounting } from "@/lib/guards/accounting-guard";
import {
	findRelatedTruckingIds,
	syncTruckingGrossWeight,
} from "@/lib/trucking/gross-weight-sync";

/**
 * POST /api/followup/create-container
 * Create a new container record for a follow-up
 */
export async function POST(request: NextRequest) {
	try {
		// 1. Authenticate user with Better Auth
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const blocked = await blockIfAccounting(
			session.user.id,
			session.user.role,
			"Accounting department has view-only access to follow-ups",
		);
		if (blocked) return blocked;

		// 2. Parse request body
		const body = await request.json();
		const {
			followUpId,
			containerNo,
			sealNo,
			containerSize,
			quantity,
			grossWeight,
			packageQty,
			tareWeight,
		} = body;

		// 3. Validate required fields
		if (!followUpId) {
			return NextResponse.json(
				{ message: "Missing required field: followUpId" },
				{ status: 400 },
			);
		}

		// 4. Verify the follow-up exists and user has permission
		const followUpRecord = await prismaRPA.followUp.findUnique({
			where: { id: followUpId },
			select: { createdBy: true, warehouse: true, deliveryDate: true },
		});

		if (!followUpRecord) {
			return NextResponse.json(
				{ message: "Follow-up not found" },
				{ status: 404 },
			);
		}

		// --- Permission Check ---
		const isOwner = followUpRecord.createdBy === session.user.id;
		const isAdmin = session.user.role === "ADMIN";

		// Get user's departments for Manager/Leader check
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

		if (!currentUser) {
			return NextResponse.json({ message: "User not found" }, { status: 404 });
		}

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

		const isLogisticsManager =
			currentUser.role === "MANAGER" && userDeptNames.has("Logistics");

		// Team Leader check
		let isTeamLeaderOfOwner = false;
		if (currentUser.teamLeaderships.length > 0) {
			const ledMemberIds = new Set<string>();
			currentUser.teamLeaderships.forEach((tl: any) => {
				tl.team.members.forEach((m: any) => ledMemberIds.add(m.userId));
			});
			if (ledMemberIds.has(followUpRecord.createdBy)) {
				isTeamLeaderOfOwner = true;
			}
		}

		const canEdit =
			isOwner || isAdmin || isLogisticsManager || isTeamLeaderOfOwner;

		if (!canEdit) {
			return NextResponse.json(
				{
					message:
						"Access denied: You do not have permission to modify this follow-up",
				},
				{ status: 403 },
			);
		}

		// --- Duplicate Check (only when containerNo is provided) ---
		if (containerNo) {
			const existingContainerNo = await prismaRPA.container.findFirst({
				where: {
					followUpId,
					containerNo: {
						equals: containerNo,
						mode: "insensitive",
					},
				},
			});

			if (existingContainerNo) {
				return NextResponse.json(
					{ message: `Số container ${containerNo} đã tồn tại trong job này.` },
					{ status: 400 },
				);
			}
		}

		console.log("-------------------followUpRecord", followUpRecord);
		// 5. Create container record
		const container = await prismaRPA.container.create({
			data: {
				followUpId,
				containerNo: containerNo || null,
				sealNo: sealNo || null,
				containerSize: containerSize || null,
				quantity: quantity != null ? Number(quantity) : 1,
				grossWeight:
					grossWeight != null ? Number.parseFloat(grossWeight) : null,
				packageQty: packageQty != null ? Number.parseFloat(packageQty) : null,
				tareWeight: tareWeight != null ? Number.parseFloat(tareWeight) : null,
				warehouse: followUpRecord.warehouse || null,
				// New containers have no requestTruckingNo yet, so prefill implementationDate
				// from the follow-up's transportDate (same rule as the update sync)
				implementationDate: followUpRecord.deliveryDate ?? null,
			},
		});

		// 6. Sync Gross Weight back to related TruckingFollowUp records
		const truckingIds = await findRelatedTruckingIds(container.id);
		for (const tfId of truckingIds) {
			await syncTruckingGrossWeight(tfId).catch(console.error);
		}

		// 6.5 Log activity (fire-and-forget)
		logFollowUpActivity(followUpId, {
			userId: session.user.id,
			userName: session.user.name,
			action: "CREATE_CONTAINER",
			subResource: "container",
			subResourceId: container.id,
			newValue: { containerNo: container.containerNo },
		});

		// 7. Return created record
		return NextResponse.json(container, { status: 201 });
	} catch (error) {
		console.error("Error creating container:", error);
		return NextResponse.json(
			{
				message: "Failed to create container",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
