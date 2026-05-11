import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

// GET /api/admin/department-managers - Get all department-manager assignments
export async function GET() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	const isAdmin = session?.user?.role === "ADMIN";
	const isSuperAdmin = session?.user?.role === "SUPERADMIN";
	if (!session?.user || (!isAdmin && !isSuperAdmin)) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	try {
		const assignments = await prismaRPA.userDepartment.findMany({
			include: {
				user: {
					select: {
						id: true,
						name: true,
						email: true,
						image: true,
						role: true,
						site: true,
					},
				},
				department: {
					select: {
						id: true,
						name: true,
						site: true,
						_count: {
							select: {
								teams: true,
							},
						},
					},
				},
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		return NextResponse.json({ assignments });
	} catch (error) {
		console.error("Failed to fetch department-manager assignments:", error);
		return NextResponse.json(
			{ message: "Failed to fetch assignments" },
			{ status: 500 },
		);
	}
}

// POST /api/admin/department-managers - Assign manager to department(s)
export async function POST(req: NextRequest) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	const isAdmin = session?.user?.role === "ADMIN";
	const isSuperAdmin = session?.user?.role === "SUPERADMIN";
	if (!session?.user || (!isAdmin && !isSuperAdmin)) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await req.json();
		const { userId, departmentIds } = body;

		if (!userId || !departmentIds || !Array.isArray(departmentIds)) {
			return NextResponse.json(
				{ message: "userId and departmentIds array are required" },
				{ status: 400 },
			);
		}

		if (departmentIds.length === 0) {
			return NextResponse.json(
				{ message: "At least one department is required" },
				{ status: 400 },
			);
		}

		// Get manager user
		const user = await prismaRPA.user.findUnique({
			where: { id: userId },
			select: { id: true, role: true, site: true, name: true },
		});

		if (!user) {
			return NextResponse.json({ message: "User not found" }, { status: 404 });
		}

		// Verify user has MANAGER role (or promote if needed)
		if (user.role !== "MANAGER") {
			return NextResponse.json(
				{ message: "User must have MANAGER role" },
				{ status: 400 },
			);
		}

		// Verify user has a site assigned
		if (!user.site) {
			return NextResponse.json(
				{ message: "User must have a site assigned" },
				{ status: 400 },
			);
		}

		// Get departments and verify they exist and belong to manager's site
		const departments = await prismaRPA.department.findMany({
			where: {
				id: { in: departmentIds },
			},
			select: { id: true, site: true, name: true },
		});

		if (departments.length !== departmentIds.length) {
			return NextResponse.json(
				{ message: "One or more departments not found" },
				{ status: 404 },
			);
		}

		// Verify all departments belong to manager's site
		const invalidDepts = departments.filter((d) => d.site !== user.site);
		if (invalidDepts.length > 0) {
			return NextResponse.json(
				{
					message: `Cannot assign manager to departments in different site. Departments: ${invalidDepts.map((d) => d.name).join(", ")} are in site ${invalidDepts[0].site}`,
				},
				{ status: 400 },
			);
		}

		// Create assignments (upsert - update if exists, create if not)
		const createdAssignments = await Promise.all(
			departmentIds.map((deptId) =>
				prismaRPA.userDepartment.upsert({
					where: {
						userId_departmentId: {
							userId: userId,
							departmentId: deptId,
						},
					},
					create: {
						userId: userId,
						departmentId: deptId,
					},
					update: {},
					include: {
						department: {
							select: {
								id: true,
								name: true,
								site: true,
							},
						},
					},
				}),
			),
		);

		return NextResponse.json(
			{
				message: `Manager assigned to ${createdAssignments.length} department(s)`,
				assignments: createdAssignments,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("Failed to assign manager to department:", error);
		return NextResponse.json(
			{ message: "Failed to assign manager" },
			{ status: 500 },
		);
	}
}

// DELETE /api/admin/department-managers - Remove manager from department
export async function DELETE(req: NextRequest) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	const isAdmin = session?.user?.role === "ADMIN";
	const isSuperAdmin = session?.user?.role === "SUPERADMIN";
	if (!session?.user || (!isAdmin && !isSuperAdmin)) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	try {
		const { searchParams } = new URL(req.url);
		const userId = searchParams.get("userId");
		const departmentId = searchParams.get("departmentId");

		if (!userId || !departmentId) {
			return NextResponse.json(
				{ message: "userId and departmentId query parameters are required" },
				{ status: 400 },
			);
		}

		// Find and delete the assignment
		const assignment = await prismaRPA.userDepartment.findUnique({
			where: {
				userId_departmentId: {
					userId: userId,
					departmentId: departmentId,
				},
			},
		});

		if (!assignment) {
			return NextResponse.json(
				{ message: "Manager-department assignment not found" },
				{ status: 404 },
			);
		}

		await prismaRPA.userDepartment.delete({
			where: {
				userId_departmentId: {
					userId: userId,
					departmentId: departmentId,
				},
			},
		});

		return NextResponse.json({
			message: "Manager removed from department",
		});
	} catch (error) {
		console.error("Failed to remove manager from department:", error);
		return NextResponse.json(
			{ message: "Failed to remove manager" },
			{ status: 500 },
		);
	}
}
