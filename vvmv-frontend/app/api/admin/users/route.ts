import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

// GET /api/admin/users - Get all users (or site-specific for managers)
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
		let whereClause: any = { id: { not: session.user.id } };

		if (isManager) {
			// Managers can see all users in their site
			// This allows them to add any site user to their teams
			if (userSite) {
				whereClause = {
					OR: [{ site: userSite }, { site: null }],
					id: { not: session.user.id },
				};
			} else {
				// No site assigned to manager - return empty
				return NextResponse.json({ users: [] });
			}
		} else if (isAdmin && userSite) {
			// Site-specific admin sees only users with matching site
			whereClause = {
				site: userSite,
				id: { not: session.user.id },
			};
		} else if (isSuperAdmin) {
			// SUPERADMIN sees all users (use default whereClause)
			whereClause = { id: { not: session.user.id } };
		}

		const users = await prismaRPA.user.findMany({
			where: whereClause,
			select: {
				id: true,
				name: true,
				email: true,
				username: true,
				role: true,
				site: true,
				createdAt: true,
				erpAccount: true,
				image: true,
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		return NextResponse.json({ users });
	} catch (error) {
		console.error("Failed to fetch users:", error);
		return NextResponse.json(
			{ message: "Failed to fetch users" },
			{ status: 500 },
		);
	}
}

// POST /api/admin/users - Create a new user
export async function POST(req: NextRequest) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (
		!session?.user ||
		(session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN")
	) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await req.json();
		const { email, password, name, role, site, erpAccount } = body;

		if (!email || !password || !name || !role) {
			return NextResponse.json(
				{ message: "Missing required fields" },
				{ status: 400 },
			);
		}

		// Check if user already exists
		const existingUser = await prismaRPA.user.findFirst({
			where: {
				OR: [{ email }, { username: email.split("@")[0] }],
			},
		});

		if (existingUser) {
			return NextResponse.json(
				{ message: "User already exists" },
				{ status: 400 },
			);
		}

		// Create user using Better Auth
		const username = email.split("@")[0];

		const result = await auth.api.signUpEmail({
			body: {
				email,
				password,
				name,
			},
		});

		if (!result || !result.user) {
			throw new Error("Failed to create user with Better Auth");
		}

		// Update user with role, site, and auto-verify email
		const updatedUser = await prismaRPA.user.update({
			where: { id: result.user.id },
			data: {
				username,
				role,
				site: site || null,
				erpAccount: erpAccount || null,
				emailVerified: true, // Auto-verify users created by admin
			},
		});

		return NextResponse.json({
			message: "User created successfully",
			user: {
				id: updatedUser.id,
				email: updatedUser.email,
				name: updatedUser.name,
				username: updatedUser.username,
				role: updatedUser.role,
				site: updatedUser.site,
				erpAccount: updatedUser.erpAccount,
			},
		});
	} catch (error) {
		console.error("Failed to create user:", error);
		return NextResponse.json(
			{
				message:
					error instanceof Error ? error.message : "Failed to create user",
			},
			{ status: 500 },
		);
	}
}

// PUT /api/admin/users - Update a user
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
		const { id, name, username, email, role, site, erpAccount } = body;

		if (!id) {
			return NextResponse.json(
				{ message: "User ID is required" },
				{ status: 400 },
			);
		}

		// Get the user to check permissions
		const existingUser = await prismaRPA.user.findUnique({
			where: { id },
			select: {
				site: true,
				teamMemberships: {
					select: { team: { select: { departmentId: true } } },
				},
				teamLeaderships: {
					select: { team: { select: { departmentId: true } } },
				},
			},
		});

		if (!existingUser) {
			return NextResponse.json({ message: "User not found" }, { status: 404 });
		}

		// Managers can only update users in their assigned departments
		if (isManager) {
			// Get manager's assigned departments
			const managerDepts = await prismaRPA.userDepartment.findMany({
				where: { userId: session.user.id },
				select: { departmentId: true },
			});

			if (managerDepts.length === 0) {
				return NextResponse.json(
					{
						message:
							"You are not assigned to any departments and cannot update users",
					},
					{ status: 403 },
				);
			}

			const managerDeptIds = new Set(managerDepts.map((d) => d.departmentId));

			// Get user's departments
			const userDeptIds = new Set<string>();
			existingUser.teamMemberships.forEach((m) => {
				if (m.team.departmentId) {
					userDeptIds.add(m.team.departmentId);
				}
			});
			existingUser.teamLeaderships.forEach((l) => {
				if (l.team.departmentId) {
					userDeptIds.add(l.team.departmentId);
				}
			});

			// Check if manager has access to at least one of the user's departments
			const hasAccess = Array.from(userDeptIds).some((deptId) =>
				managerDeptIds.has(deptId),
			);

			if (!hasAccess) {
				return NextResponse.json(
					{ message: "You can only update users in your assigned departments" },
					{ status: 403 },
				);
			}
		}

		// Prepare update data
		const updateData: any = {};
		if (name !== undefined) updateData.name = name;
		if (username !== undefined) updateData.username = username;
		if (email !== undefined) updateData.email = email;
		if (role !== undefined) updateData.role = role;
		if (site !== undefined) updateData.site = site || null;
		if (erpAccount !== undefined) updateData.erpAccount = erpAccount || null;

		// Update user
		const updatedUser = await prismaRPA.user.update({
			where: { id },
			data: updateData,
		});

		return NextResponse.json({
			message: "User updated successfully",
			user: {
				id: updatedUser.id,
				email: updatedUser.email,
				name: updatedUser.name,
				username: updatedUser.username,
				role: updatedUser.role,
				site: updatedUser.site,
				erpAccount: updatedUser.erpAccount,
			},
		});
	} catch (error) {
		console.error("Failed to update user:", error);
		return NextResponse.json(
			{
				message:
					error instanceof Error ? error.message : "Failed to update user",
			},
			{ status: 500 },
		);
	}
}

// DELETE /api/admin/users?id=xxx - Delete a user
export async function DELETE(req: NextRequest) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (
		!session?.user ||
		(session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN")
	) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	try {
		const { searchParams } = new URL(req.url);
		const userId = searchParams.get("id");

		if (!userId) {
			return NextResponse.json(
				{ message: "User ID is required" },
				{ status: 400 },
			);
		}

		// Don't allow deleting yourself
		if (userId === session.user.id) {
			return NextResponse.json(
				{ message: "Cannot delete your own account" },
				{ status: 400 },
			);
		}

		await prismaRPA.user.delete({
			where: { id: userId },
		});

		return NextResponse.json({ message: "User deleted successfully" });
	} catch (error) {
		console.error("Failed to delete user:", error);
		return NextResponse.json(
			{ message: "Failed to delete user" },
			{ status: 500 },
		);
	}
}
