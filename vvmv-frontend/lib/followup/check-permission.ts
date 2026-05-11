import { prismaRPA } from "@/lib/db";

export type PermissionResult =
	| { ok: true }
	| { ok: false; status: number; error: string };

type FollowUpPermissionMode = "read" | "write";

type CheckFollowUpPermissionOptions = {
	mode?: FollowUpPermissionMode;
};

const SITE_READ_DEPARTMENTS = new Set(["Trucking", "Document", "Accounting"]);
const MANAGER_WRITE_DEPARTMENTS = new Set(["Logistics", "Document"]);

function normalizeIdentity(value: unknown): string | null {
	const text = String(value ?? "")
		.trim()
		.toLowerCase();
	return text || null;
}

/**
 * Checks whether a user has permission to access/modify a specific FollowUp.
 * Used by cds-info, register, and follow-up sub-routes that reuse the same rule.
 */
export async function checkFollowUpPermission(
	followUpId: string,
	userId: string,
	userRole: string,
	options: CheckFollowUpPermissionOptions = {},
): Promise<PermissionResult> {
	const mode = options.mode ?? "write";
	const followUp = await prismaRPA.followUp.findUnique({
		where: { id: followUpId },
		select: { createdBy: true, domain: true, handler: true },
	});

	if (!followUp) {
		return { ok: false, status: 404, error: "Follow-up not found" };
	}

	const currentUser = await prismaRPA.user.findUnique({
		where: { id: userId },
		include: {
			departmentAssignments: {
				include: { department: { select: { name: true, site: true } } },
			},
			teamLeaderships: {
				include: {
					team: {
						include: {
							department: { select: { name: true, site: true } },
							members: { select: { userId: true } },
							leaders: { select: { userId: true } },
						},
					},
				},
			},
			teamMemberships: {
				include: {
					team: {
						include: {
							department: { select: { name: true, site: true } },
							members: { select: { userId: true } },
						},
					},
				},
			},
		},
	});

	if (!currentUser) {
		return { ok: false, status: 404, error: "User not found" };
	}

	const effectiveRole = currentUser.role ?? userRole;
	const isAdmin = effectiveRole === "ADMIN" || effectiveRole === "SUPERADMIN";
	const isSuperAdmin = effectiveRole === "SUPERADMIN";

	if (isAdmin && !isSuperAdmin && currentUser.site) {
		if (currentUser.site !== followUp.domain) {
			return {
				ok: false,
				status: 403,
				error: "Access denied: Site mismatch",
			};
		}
	}

	if (isAdmin) {
		return { ok: true };
	}

	const userDeptNames = new Set<string>();
	const userSites = new Set<string>();
	const teammateIds = new Set<string>([userId]);

	if (currentUser.site) {
		userSites.add(currentUser.site);
	}

	currentUser.departmentAssignments.forEach((assignment) => {
		if (assignment.department?.name) {
			userDeptNames.add(assignment.department.name);
		}
		if (assignment.department?.site) {
			userSites.add(assignment.department.site);
		}
	});
	currentUser.teamLeaderships.forEach((leadership) => {
		if (leadership.team?.department?.name) {
			userDeptNames.add(leadership.team.department.name);
		}
		if (leadership.team?.department?.site) {
			userSites.add(leadership.team.department.site);
		}
		leadership.team.members.forEach((member) => {
			teammateIds.add(member.userId);
		});
		leadership.team.leaders.forEach((leader) => {
			teammateIds.add(leader.userId);
		});
	});
	currentUser.teamMemberships.forEach((membership) => {
		if (membership.team?.department?.name) {
			userDeptNames.add(membership.team.department.name);
		}
		if (membership.team?.department?.site) {
			userSites.add(membership.team.department.site);
		}
		membership.team.members.forEach((member) => {
			teammateIds.add(member.userId);
		});
	});

	const isAuthorizedManager =
		currentUser.role === "MANAGER" &&
		[...MANAGER_WRITE_DEPARTMENTS].some((department) =>
			userDeptNames.has(department),
		);
	const isOwner = followUp.createdBy === userId;
	const userIdentities = new Set(
		[currentUser.id, currentUser.email, currentUser.username]
			.map(normalizeIdentity)
			.filter((value): value is string => Boolean(value)),
	);
	const normalizedHandler = normalizeIdentity(followUp.handler);
	const isHandler = normalizedHandler
		? userIdentities.has(normalizedHandler)
		: false;

	let isTeamLeaderOfOwner = false;
	currentUser.teamLeaderships.forEach((leadership) => {
		if (
			leadership.team.members.some(
				(member) => member.userId === followUp.createdBy,
			) ||
			leadership.team.leaders.some(
				(leader) => leader.userId === followUp.createdBy,
			)
		) {
			isTeamLeaderOfOwner = true;
		}
	});

	if (mode === "read") {
		const isInSiteReadDepartment = [...SITE_READ_DEPARTMENTS].some(
			(department) => userDeptNames.has(department),
		);
		const canReadBySite =
			isInSiteReadDepartment &&
			!!followUp.domain &&
			userSites.has(followUp.domain);
		const canReadAsManager =
			currentUser.role === "MANAGER" &&
			(userSites.size > 0
				? !!followUp.domain && userSites.has(followUp.domain)
				: false);
		const canReadAsTeamLeader =
			currentUser.teamLeaderships.length > 0 &&
			(teammateIds.has(followUp.createdBy) ||
				(followUp.handler ? teammateIds.has(followUp.handler) : false));
		const canReadUnassignedTeamJob =
			teammateIds.has(followUp.createdBy) &&
			(!followUp.handler || followUp.handler.trim() === "");

		if (
			isOwner ||
			isHandler ||
			isAuthorizedManager ||
			isTeamLeaderOfOwner ||
			canReadBySite ||
			canReadAsManager ||
			canReadAsTeamLeader ||
			canReadUnassignedTeamJob
		) {
			return { ok: true };
		}

		return { ok: false, status: 403, error: "Access denied" };
	}

	if (userDeptNames.has("Accounting")) {
		return {
			ok: false,
			status: 403,
			error: "Accounting department has view-only access to follow-ups",
		};
	}

	if (!isOwner && !isHandler && !isAuthorizedManager && !isTeamLeaderOfOwner) {
		return { ok: false, status: 403, error: "Access denied" };
	}

	return { ok: true };
}
