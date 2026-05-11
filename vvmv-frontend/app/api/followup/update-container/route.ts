import { type NextRequest, NextResponse } from "next/server";
import { logFollowUpActivity } from "@/lib/activity-logger";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { blockIfAccounting } from "@/lib/guards/accounting-guard";

/**
 * PATCH /api/followup/update-container
 * Update an existing container record
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

		const blocked = await blockIfAccounting(
			session.user.id,
			session.user.role,
			"Accounting department has view-only access to follow-ups",
		);
		if (blocked) return blocked;

		// 2. Parse request body
		const body = await request.json();
		const {
			containerId,
			containerNo,
			sealNo,
			containerSize,
			quantity,
			grossWeight,
			packageQty,
			tareWeight,
		} = body;

		// 3. Validate required fields
		if (!containerId) {
			return NextResponse.json(
				{ message: "Missing required field: containerId" },
				{ status: 400 },
			);
		}

		// 4. Verify the container exists and user has permission
		const containerWithFollowUp = await prismaRPA.container.findUnique({
			where: { id: containerId },
			include: {
				followUp: {
					select: { createdBy: true },
				},
			},
		});

		if (!containerWithFollowUp) {
			return NextResponse.json(
				{ message: "Container not found" },
				{ status: 404 },
			);
		}

		// --- Permission Check ---
		const followUpCreatorId = containerWithFollowUp.followUp?.createdBy;
		if (!followUpCreatorId) {
			return NextResponse.json(
				{ message: "Container is not associated with a follow-up" },
				{ status: 400 },
			);
		}
		const isOwner = followUpCreatorId === session.user.id;
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

		const isAuthorizedManager =
			currentUser.role === "MANAGER" &&
			(userDeptNames.has("Logistics") || userDeptNames.has("Document"));

		// Team Leader check
		let isTeamLeaderOfOwner = false;
		if (currentUser.teamLeaderships.length > 0) {
			const ledMemberIds = new Set<string>();
			currentUser.teamLeaderships.forEach((tl: any) => {
				tl.team.members.forEach((m: any) => ledMemberIds.add(m.userId));
			});
			if (ledMemberIds.has(followUpCreatorId)) {
				isTeamLeaderOfOwner = true;
			}
		}

		const canEdit =
			isOwner || isAdmin || isAuthorizedManager || isTeamLeaderOfOwner;

		if (!canEdit) {
			return NextResponse.json(
				{
					message:
						"Access denied: You do not have permission to modify this container",
				},
				{ status: 403 },
			);
		}

		// --- Duplicate Check ---
		if (containerNo && containerNo !== containerWithFollowUp.containerNo) {
			const existingContainerNo = await prismaRPA.container.findFirst({
				where: {
					followUpId: containerWithFollowUp.followUpId,
					containerNo: {
						equals: containerNo,
						mode: "insensitive",
					},
					id: { not: containerId }, // Exclude current record
				},
			});

			if (existingContainerNo) {
				return NextResponse.json(
					{ message: `Số container ${containerNo} đã tồn tại trong job này.` },
					{ status: 400 },
				);
			}
		}

		const existingContainer = containerWithFollowUp;

		// 5. Update container record
		const container = await prismaRPA.container.update({
			where: { id: containerId },
			data: {
				containerNo: containerNo ?? existingContainer.containerNo,
				sealNo: sealNo ?? existingContainer.sealNo,
				containerSize: containerSize ?? existingContainer.containerSize,
				quantity:
					quantity != null
						? Number(quantity)
						: (existingContainer.quantity ?? 1),
				grossWeight:
					grossWeight != null
						? Number.parseFloat(grossWeight)
						: existingContainer.grossWeight,
				packageQty:
					packageQty != null
						? Number.parseFloat(packageQty)
						: existingContainer.packageQty,
				tareWeight:
					tareWeight != null
						? Number.parseFloat(tareWeight)
						: existingContainer.tareWeight,
			},
		});

		// --- Sync with FCRs ---
		// If containerNo or grossWeight changed, sync to FCR
		if (
			(containerNo !== undefined &&
				containerNo !== existingContainer.containerNo) ||
			(grossWeight !== undefined &&
				Number.parseFloat(grossWeight) !== existingContainer.grossWeight) ||
			(packageQty !== undefined &&
				Number.parseFloat(packageQty) !== existingContainer.packageQty)
		) {
			await prismaRPA.fCR.updateMany({
				where: { containerId: containerId },
				data: {
					containerNo: container.containerNo,
					grossWeight: container.grossWeight,
					quantity: container.packageQty,
				},
			});
		}

		// If containerSize changed, sync to FCR tTypeC and truckType
		if (
			containerSize !== undefined &&
			containerSize !== existingContainer.containerSize
		) {
			await prismaRPA.fCR.updateMany({
				where: { containerId: containerId },
				data: {
					tTypeC: container.containerSize,
					truckType: container.containerSize,
				},
			});
		}

		// 5.5 Log activity (fire-and-forget)
		if (containerWithFollowUp.followUpId) {
			logFollowUpActivity(containerWithFollowUp.followUpId, {
				userId: session.user.id,
				userName: session.user.name,
				action: "UPDATE_CONTAINER",
				subResource: "container",
				subResourceId: containerId,
				newValue: {
					containerNo: container.containerNo,
					sealNo: container.sealNo,
					containerSize: container.containerSize,
					quantity: container.quantity,
					grossWeight: container.grossWeight,
					packageQty: container.packageQty,
					tareWeight: container.tareWeight,
				},
				oldValue: {
					containerNo: existingContainer.containerNo,
					sealNo: existingContainer.sealNo,
					containerSize: existingContainer.containerSize,
					quantity: existingContainer.quantity,
					grossWeight: existingContainer.grossWeight,
					packageQty: existingContainer.packageQty,
					tareWeight: existingContainer.tareWeight,
				},
			});
		}

		// 6. Return updated record
		return NextResponse.json(container, { status: 200 });
	} catch (error) {
		console.error("Error updating container:", error);
		return NextResponse.json(
			{
				message: "Failed to update container",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
