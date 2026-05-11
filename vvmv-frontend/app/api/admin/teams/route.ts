import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

// GET /api/admin/teams - Get all teams (or site-specific for managers)
export async function GET(_req: NextRequest) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	const isAdmin = session.user.role === "ADMIN";
	const isSuperAdmin = session.user.role === "SUPERADMIN";
	const isManager = session.user.role === "MANAGER";
	const userSite = (session.user as any).site as string | undefined;

	// Check if user is a team leader
	const user = await prismaRPA.user.findUnique({
		where: { id: session.user.id },
		select: {
			teamLeaderships: { select: { teamId: true } },
		},
	});
	const isTeamLeader = (user?.teamLeaderships?.length || 0) > 0;

	if (!isAdmin && !isSuperAdmin && !isManager && !isTeamLeader) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	try {
		// Build where clause based on role
		let whereClause: any = {};

		if (isSuperAdmin) {
			// SUPERADMIN sees all teams
			whereClause = {};
		} else if (isAdmin) {
			// Site-specific admin sees teams in departments matching their site
			if (userSite) {
				whereClause = {
					department: {
						site: userSite,
					},
				};
			} else {
				// Admin with no site sees all teams
				whereClause = {};
			}
		} else if (isManager) {
			// Get manager's assigned departments
			const managerDepts = await prismaRPA.userDepartment.findMany({
				where: { userId: session.user.id },
				select: { departmentId: true },
			});

			// NO departments = NO access
			if (managerDepts.length === 0) {
				whereClause = { id: "none" };
			} else {
				// Managers see only teams in assigned departments
				whereClause = {
					departmentId: { in: managerDepts.map((d) => d.departmentId) },
				};
			}
		} else if (isTeamLeader) {
			// Team leaders only see teams they lead
			whereClause = {
				leaders: {
					some: {
						userId: session.user.id,
					},
				},
			};
		} else {
			// Fallback: no teams
			whereClause = { id: "none" };
		}

		const teams = await prismaRPA.team.findMany({
			where: whereClause,
			include: {
				department: true,
				leaders: {
					include: {
						user: {
							select: {
								id: true,
								name: true,
								email: true,
								role: true,
								image: true,
							},
						},
					},
				},
				members: {
					include: {
						user: {
							select: {
								id: true,
								name: true,
								email: true,
								role: true,
								image: true,
							},
						},
					},
				},
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		// Transform leaders and members to flat arrays
		const teamsWithData = teams.map((team) => ({
			...team,
			leaders: team.leaders.map((tl) => tl.user),
			members: team.members.map((tm) => tm.user),
		}));

		return NextResponse.json({ teams: teamsWithData });
	} catch (error) {
		console.error("Failed to fetch teams:", error);
		return NextResponse.json(
			{ message: "Failed to fetch teams" },
			{ status: 500 },
		);
	}
}

// POST /api/admin/teams - Create a new team
export async function POST(req: NextRequest) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	const isAdmin = session?.user?.role === "ADMIN";
	const isSuperAdmin = session?.user?.role === "SUPERADMIN";
	const isManager = session?.user?.role === "MANAGER";

	if (!session?.user || (!isAdmin && !isSuperAdmin && !isManager)) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await req.json();
		const {
			name,
			site,
			departmentId,
			siteManagerId,
			leaderIds,
			memberIds,
			updateRoles,
		} = body;

		if (
			!name ||
			!site ||
			!leaderIds ||
			!Array.isArray(leaderIds) ||
			leaderIds.length === 0
		) {
			return NextResponse.json(
				{
					message:
						"Missing required fields: name, site, and leaderIds array are required",
				},
				{ status: 400 },
			);
		}

		// Managers must assign teams to departments and validate access
		if (isManager) {
			// Managers must provide a departmentId
			if (!departmentId) {
				return NextResponse.json(
					{ message: "Managers must assign teams to departments" },
					{ status: 400 },
				);
			}

			// Get manager's assigned departments
			const managerDepts = await prismaRPA.userDepartment.findMany({
				where: { userId: session.user.id },
				select: { departmentId: true },
			});

			if (managerDepts.length === 0) {
				return NextResponse.json(
					{ message: "You are not assigned to any departments" },
					{ status: 403 },
				);
			}

			// Check if manager has access to the department
			const hasAccess = managerDepts.some(
				(d) => d.departmentId === departmentId,
			);
			if (!hasAccess) {
				return NextResponse.json(
					{ message: "You can only create teams in departments you manage" },
					{ status: 403 },
				);
			}
		}

		// Validate department if provided
		if (departmentId) {
			const department = await prismaRPA.department.findUnique({
				where: { id: departmentId },
			});

			if (!department) {
				return NextResponse.json(
					{ message: "Department not found" },
					{ status: 404 },
				);
			}

			// Validate department belongs to selected site
			if (department.site !== site) {
				return NextResponse.json(
					{ message: "Department must belong to the selected site" },
					{ status: 400 },
				);
			}
		}

		// Validate site manager if provided
		if (siteManagerId) {
			const siteManager = await prismaRPA.user.findUnique({
				where: { id: siteManagerId },
			});

			if (!siteManager) {
				return NextResponse.json(
					{ message: "Site manager not found" },
					{ status: 404 },
				);
			}

			if (!["MANAGER", "ADMIN"].includes(siteManager.role)) {
				return NextResponse.json(
					{ message: "Site manager must have MANAGER or ADMIN role" },
					{ status: 400 },
				);
			}
		}

		// Validate all leaders exist
		const leaders = await prismaRPA.user.findMany({
			where: { id: { in: leaderIds } },
		});

		if (leaders.length !== leaderIds.length) {
			return NextResponse.json(
				{ message: "One or more leaders not found" },
				{ status: 404 },
			);
		}

		// Create team with leaders and members
		const team = await prismaRPA.team.create({
			data: {
				name,
				site,
				departmentId: departmentId || null,
				leaders: {
					create: leaderIds.map((userId) => ({ userId })),
				},
				members: {
					create:
						memberIds && Array.isArray(memberIds)
							? memberIds.map((userId) => ({ userId }))
							: [],
				},
			},
		});

		// Update member/leader roles and sites
		const allInvolvedUserIds = [
			...new Set([...leaderIds, ...(memberIds || [])]),
		];

		// 1. Ensure all users have the correct site (if they don't have one)
		await prismaRPA.user.updateMany({
			where: {
				id: { in: allInvolvedUserIds },
				site: null,
			},
			data: { site: site as any },
		});

		// 2. Update member roles to STAFF if updateRoles is true
		if (
			updateRoles &&
			memberIds &&
			Array.isArray(memberIds) &&
			memberIds.length > 0
		) {
			await prismaRPA.user.updateMany({
				where: {
					id: { in: memberIds },
					role: { not: "STAFF" },
				},
				data: { role: "STAFF" },
			});
		}

		// Fetch the created team with relations
		const createdTeam = await prismaRPA.team.findUnique({
			where: { id: team.id },
			include: {
				department: true,
				leaders: {
					include: {
						user: {
							select: {
								id: true,
								name: true,
								email: true,
								role: true,
								image: true,
							},
						},
					},
				},
				members: {
					include: {
						user: {
							select: {
								id: true,
								name: true,
								email: true,
								role: true,
								image: true,
							},
						},
					},
				},
			},
		});

		// Transform leaders and members to flat arrays
		const teamWithData = createdTeam
			? {
					...createdTeam,
					leaders: createdTeam.leaders.map((tl) => tl.user),
					members: createdTeam.members.map((tm) => tm.user),
				}
			: null;

		return NextResponse.json({
			message: "Team created successfully",
			team: teamWithData,
		});
	} catch (error) {
		console.error("Failed to create team:", error);
		return NextResponse.json(
			{
				message:
					error instanceof Error ? error.message : "Failed to create team",
			},
			{ status: 500 },
		);
	}
}

// PUT /api/admin/teams - Update a team
export async function PUT(req: NextRequest) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	const isAdmin = session?.user?.role === "ADMIN";
	const isSuperAdmin = session?.user?.role === "SUPERADMIN";
	const isManager = session?.user?.role === "MANAGER";

	if (!session?.user || (!isAdmin && !isSuperAdmin && !isManager)) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await req.json();
		const { id, name, site, departmentId, leaderIds, memberIds } = body;

		if (!id) {
			return NextResponse.json(
				{ message: "Team ID is required" },
				{ status: 400 },
			);
		}

		// Get the existing team to check permissions
		const existingTeam = await prismaRPA.team.findUnique({
			where: { id },
			select: { site: true },
		});

		if (!existingTeam) {
			return NextResponse.json({ message: "Team not found" }, { status: 404 });
		}

		// Managers can only update teams from their site
		if (
			isManager &&
			(session.user as any).site &&
			existingTeam.site !== (session.user as any).site
		) {
			return NextResponse.json(
				{ message: "Managers can only update teams from their own site" },
				{ status: 403 },
			);
		}

		// Validate department if provided
		if (departmentId !== undefined && departmentId !== null) {
			const department = await prismaRPA.department.findUnique({
				where: { id: departmentId },
			});

			if (!department) {
				return NextResponse.json(
					{ message: "Department not found" },
					{ status: 404 },
				);
			}

			// Department must belong to the team's site (cannot move team to different site's department)
			const targetSite = site || existingTeam.site;
			if (department.site !== targetSite) {
				return NextResponse.json(
					{ message: "Cannot assign team to department from different site" },
					{ status: 400 },
				);
			}
		}

		// Validate leaders if provided
		if (leaderIds && Array.isArray(leaderIds) && leaderIds.length > 0) {
			const leaders = await prismaRPA.user.findMany({
				where: { id: { in: leaderIds } },
			});

			if (leaders.length !== leaderIds.length) {
				return NextResponse.json(
					{ message: "One or more leaders not found" },
					{ status: 404 },
				);
			}
		}

		// Update team with new leaders and members
		await prismaRPA.team.update({
			where: { id },
			data: {
				...(name && { name }),
				...(site && { site }),
				...(departmentId !== undefined && {
					departmentId: departmentId || null,
				}),
				...(leaderIds && {
					leaders: {
						deleteMany: {},
						create: leaderIds.map((userId: string) => ({ userId })),
					},
				}),
				...(memberIds !== undefined && {
					members: {
						deleteMany: {},
						create: Array.isArray(memberIds)
							? memberIds.map((userId: string) => ({ userId }))
							: [],
					},
				}),
			},
		});

		// Update member/leader roles and sites
		const allInvolvedUserIds = [
			...new Set([
				...(leaderIds || []),
				...(Array.isArray(memberIds) ? memberIds : []),
			]),
		];

		if (allInvolvedUserIds.length > 0) {
			// Ensure all users have the correct site (if they don't have one)
			const targetSite = site || existingTeam.site;
			await prismaRPA.user.updateMany({
				where: {
					id: { in: allInvolvedUserIds },
					site: null,
				},
				data: { site: targetSite as any },
			});
		}

		// Fetch the updated team with relations
		const updatedTeam = await prismaRPA.team.findUnique({
			where: { id },
			include: {
				department: true,
				leaders: {
					include: {
						user: {
							select: {
								id: true,
								name: true,
								email: true,
								role: true,
								image: true,
							},
						},
					},
				},
				members: {
					include: {
						user: {
							select: {
								id: true,
								name: true,
								email: true,
								role: true,
								image: true,
							},
						},
					},
				},
			},
		});

		// Transform leaders and members to flat arrays
		const teamWithData = updatedTeam
			? {
					...updatedTeam,
					leaders: updatedTeam.leaders.map((tl) => tl.user),
					members: updatedTeam.members.map((tm) => tm.user),
				}
			: null;

		return NextResponse.json({
			message: "Team updated successfully",
			team: teamWithData,
		});
	} catch (error) {
		console.error("Failed to update team:", error);
		return NextResponse.json(
			{
				message:
					error instanceof Error ? error.message : "Failed to update team",
			},
			{ status: 500 },
		);
	}
}

// DELETE /api/admin/teams?id=xxx - Delete a team
export async function DELETE(req: NextRequest) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	const isAdmin = session?.user?.role === "ADMIN";
	const isSuperAdmin = session?.user?.role === "SUPERADMIN";
	const isManager = session?.user?.role === "MANAGER";

	if (!session?.user || (!isAdmin && !isSuperAdmin && !isManager)) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	try {
		const { searchParams } = new URL(req.url);
		const teamId = searchParams.get("id");

		if (!teamId) {
			return NextResponse.json(
				{ message: "Team ID is required" },
				{ status: 400 },
			);
		}

		// For managers, verify the team belongs to their site
		if (isManager && (session.user as any).site) {
			const team = await prismaRPA.team.findUnique({
				where: { id: teamId },
				select: { site: true },
			});

			if (!team) {
				return NextResponse.json(
					{ message: "Team not found" },
					{ status: 404 },
				);
			}

			if (team.site !== (session.user as any).site) {
				return NextResponse.json(
					{ message: "Managers can only delete teams from their own site" },
					{ status: 403 },
				);
			}
		}

		// Delete the team (cascading will remove TeamLeader and TeamMember records)
		await prismaRPA.team.delete({
			where: { id: teamId },
		});

		return NextResponse.json({ message: "Team deleted successfully" });
	} catch (error) {
		console.error("Failed to delete team:", error);
		return NextResponse.json(
			{ message: "Failed to delete team" },
			{ status: 500 },
		);
	}
}
