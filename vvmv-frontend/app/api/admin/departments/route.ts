import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

// GET /api/admin/departments - Get all departments (or site-specific for managers)
export async function GET(_req: NextRequest) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	const isAdmin = session?.user?.role === "ADMIN";
	const isSuperAdmin = session?.user?.role === "SUPERADMIN";
	const isManager = session?.user?.role === "MANAGER";
	const userSite = (session?.user as any)?.site as string | undefined;

	if (!session?.user || (!isAdmin && !isSuperAdmin && !isManager)) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	try {
		let whereClause: any = {};

		if (isManager) {
			// Get manager's assigned departments only (not all in site)
			const managerDepts = await prismaRPA.userDepartment.findMany({
				where: { userId: session.user.id },
				select: { departmentId: true },
			});

			if (managerDepts.length === 0) {
				return NextResponse.json({ departments: [] });
			}

			whereClause = { id: { in: managerDepts.map((d) => d.departmentId) } };
		} else if (isAdmin && userSite) {
			// Site-specific admin sees only departments matching their site
			whereClause = { site: userSite };
		}
		// SUPERADMIN or admin with no site sees all departments (default whereClause = {})

		const departments = await prismaRPA.department.findMany({
			where: whereClause,
			include: {
				_count: {
					select: { teams: true },
				},
				teams: {
					include: {
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
				},
			},
			orderBy: [{ site: "asc" }, { name: "asc" }],
		});

		return NextResponse.json({ departments });
	} catch (error) {
		console.error("Failed to fetch departments:", error);
		return NextResponse.json(
			{ message: "Failed to fetch departments" },
			{ status: 500 },
		);
	}
}

// POST /api/admin/departments - Create a new department (ADMIN or SUPERADMIN only)
export async function POST(req: NextRequest) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	// Only ADMIN or SUPERADMIN can create departments
	const isAdmin = session?.user?.role === "ADMIN";
	const isSuperAdmin = session?.user?.role === "SUPERADMIN";
	if (!session?.user || (!isAdmin && !isSuperAdmin)) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await req.json();
		const { name, description, site } = body;

		if (!name || !site) {
			return NextResponse.json(
				{ message: "Missing required fields" },
				{ status: 400 },
			);
		}

		// Check if department already exists for this site
		const existingDept = await prismaRPA.department.findUnique({
			where: {
				name_site: {
					name,
					site,
				},
			},
		});

		if (existingDept) {
			return NextResponse.json(
				{ message: "Department already exists for this site" },
				{ status: 400 },
			);
		}

		const department = await prismaRPA.department.create({
			data: {
				name,
				description: description || null,
				site,
			},
		});

		return NextResponse.json({
			message: "Department created successfully",
			department,
		});
	} catch (error) {
		console.error("Failed to create department:", error);
		return NextResponse.json(
			{
				message:
					error instanceof Error
						? error.message
						: "Failed to create department",
			},
			{ status: 500 },
		);
	}
}

// PUT /api/admin/departments - Update a department
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
		const { id, name, description } = body;

		if (!id) {
			return NextResponse.json(
				{ message: "Department ID is required" },
				{ status: 400 },
			);
		}

		// Get the department to check permissions
		const existingDept = await prismaRPA.department.findUnique({
			where: { id },
			select: { site: true, name: true },
		});

		if (!existingDept) {
			return NextResponse.json(
				{ message: "Department not found" },
				{ status: 404 },
			);
		}

		// Managers can only update departments they are assigned to
		if (isManager) {
			const assignment = await prismaRPA.userDepartment.findUnique({
				where: {
					userId_departmentId: {
						userId: session.user.id,
						departmentId: id,
					},
				},
			});

			if (!assignment) {
				return NextResponse.json(
					{ message: "You can only manage departments you are assigned to" },
					{ status: 403 },
				);
			}
		}

		// Check if new name conflicts with existing department in same site
		if (name && name !== existingDept.name) {
			const conflictDept = await prismaRPA.department.findUnique({
				where: {
					name_site: {
						name,
						site: existingDept.site,
					},
				},
			});

			if (conflictDept) {
				return NextResponse.json(
					{ message: "Department name already exists for this site" },
					{ status: 400 },
				);
			}
		}

		// Prepare update data (only name and description - site cannot be changed)
		const updateData: any = {};
		if (name !== undefined) updateData.name = name;
		if (description !== undefined) updateData.description = description || null;

		const updatedDept = await prismaRPA.department.update({
			where: { id },
			data: updateData,
		});

		return NextResponse.json({
			message: "Department updated successfully",
			department: updatedDept,
		});
	} catch (error) {
		console.error("Failed to update department:", error);
		return NextResponse.json(
			{
				message:
					error instanceof Error
						? error.message
						: "Failed to update department",
			},
			{ status: 500 },
		);
	}
}

// DELETE /api/admin/departments?id=xxx - Delete a department
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
		const deptId = searchParams.get("id");

		if (!deptId) {
			return NextResponse.json(
				{ message: "Department ID is required" },
				{ status: 400 },
			);
		}

		// Check if department has teams
		const department = await prismaRPA.department.findUnique({
			where: { id: deptId },
			include: {
				_count: {
					select: { teams: true },
				},
			},
		});

		if (!department) {
			return NextResponse.json(
				{ message: "Department not found" },
				{ status: 404 },
			);
		}

		if (department._count.teams > 0) {
			return NextResponse.json(
				{
					message: `Cannot delete department with ${department._count.teams} team(s). Please reassign or delete teams first.`,
				},
				{ status: 400 },
			);
		}

		await prismaRPA.department.delete({
			where: { id: deptId },
		});

		return NextResponse.json({ message: "Department deleted successfully" });
	} catch (error) {
		console.error("Failed to delete department:", error);
		return NextResponse.json(
			{ message: "Failed to delete department" },
			{ status: 500 },
		);
	}
}
