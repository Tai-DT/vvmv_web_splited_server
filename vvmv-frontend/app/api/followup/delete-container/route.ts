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
 * DELETE /api/followup/delete-container
 * Delete a container record
 */
export async function DELETE(request: NextRequest) {
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
		const { containerId } = body;

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
						"Access denied: You do not have permission to delete this container",
				},
				{ status: 403 },
			);
		}

		// 4.5 Get related trucking IDs before deletion
		const truckingIds = await findRelatedTruckingIds(containerId);
		const deletedFollowUpId = containerWithFollowUp.followUpId;
		const deletedContainerNo = containerWithFollowUp.containerNo;

		// 5. Delete container record
		await prismaRPA.container.delete({
			where: {
				id: containerId,
			},
		});

		// 5.5 Sync Gross Weight back to related TruckingFollowUp records after deletion
		for (const tfId of truckingIds) {
			await syncTruckingGrossWeight(tfId).catch(console.error);
		}

		// 5.6 Log activity (fire-and-forget)
		if (deletedFollowUpId) {
			logFollowUpActivity(deletedFollowUpId, {
				userId: session.user.id,
				userName: session.user.name,
				action: "DELETE_CONTAINER",
				subResource: "container",
				subResourceId: containerId,
				oldValue: { containerNo: deletedContainerNo },
			});
		}

		// 6. Return success
		return NextResponse.json({ success: true }, { status: 200 });
	} catch (error) {
		console.error("Error deleting container:", error);
		return NextResponse.json(
			{
				message: "Failed to delete container",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
