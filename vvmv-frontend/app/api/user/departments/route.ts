import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { tryDelegateToStandaloneApi } from "@/lib/proxy-backend";

// GET /api/user/departments
// Returns department names for current user via:
// 1. Team memberships (leaders/members)
// 2. Direct department assignments (for managers)
export async function GET(request: NextRequest) {
	const delegated = await tryDelegateToStandaloneApi(
		request,
		"user/departments",
	);
	if (delegated) return delegated;

	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (!session?.user) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	try {
		const departmentNames = new Set<string>();

		// 1. Get user's teams and their departments (leaders/members)
		const teams = await prismaRPA.team.findMany({
			where: {
				OR: [
					{ leaders: { some: { userId: session.user.id } } },
					{ members: { some: { userId: session.user.id } } },
				],
			},
			include: { department: true },
		});

		// Add department names from teams
		teams.forEach((team) => {
			if (team.department) {
				departmentNames.add(team.department.name);
			}
		});

		// 2. Get user's directly assigned departments (for managers)
		const directAssignments = await prismaRPA.userDepartment.findMany({
			where: { userId: session.user.id },
			include: { department: true },
		});

		// Add department names from direct assignments
		directAssignments.forEach((assignment) => {
			departmentNames.add(assignment.department.name);
		});

		const departments = Array.from(departmentNames);

		return NextResponse.json({ departments });
	} catch (error) {
		console.error("Failed to fetch user departments:", error);
		return NextResponse.json(
			{ message: "Failed to fetch user departments" },
			{ status: 500 },
		);
	}
}
