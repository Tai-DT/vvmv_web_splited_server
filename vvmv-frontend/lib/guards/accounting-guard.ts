import { NextResponse } from "next/server";
import { prismaRPA } from "@/lib/db";

/**
 * Checks if the user belongs to the Accounting department (and is not ADMIN/SUPERADMIN).
 * Accounting users have view-only access to Logistics and Trucking follow-up data.
 *
 * @returns NextResponse (403) if blocked, null if allowed to proceed.
 */
export async function blockIfAccounting(
	userId: string,
	userRole: string | undefined | null,
	message = "Accounting department has view-only access",
): Promise<NextResponse | null> {
	// Admins bypass the restriction
	if (userRole === "ADMIN" || userRole === "SUPERADMIN") return null;

	const user = await prismaRPA.user.findUnique({
		where: { id: userId },
		select: {
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

	if (!user) return null;

	const deptNames = new Set<string>();
	user.departmentAssignments.forEach((da) => {
		if (da.department?.name) deptNames.add(da.department.name);
	});
	user.teamLeaderships?.forEach((tl) => {
		if (tl.team?.department?.name) deptNames.add(tl.team.department.name);
	});
	user.teamMemberships?.forEach((tm) => {
		if (tm.team?.department?.name) deptNames.add(tm.team.department.name);
	});

	if (deptNames.has("Accounting")) {
		return NextResponse.json({ message }, { status: 403 });
	}

	return null;
}
