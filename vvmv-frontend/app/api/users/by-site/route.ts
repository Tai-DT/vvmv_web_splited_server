import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { tryDelegateToStandaloneApi } from "@/lib/proxy-backend";

// GET /api/users/by-site - Get all users for the current user's site (or all for ADMIN)
export async function GET(req: NextRequest) {
	const delegated = await tryDelegateToStandaloneApi(req, "users/by-site");
	if (delegated) return delegated;

	try {
		// Authenticate user
		const session = await auth.api.getSession({
			headers: req.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		// Get current user's site
		const currentUser = await prismaRPA.user.findUnique({
			where: { id: session.user.id },
			select: { role: true, site: true },
		});

		if (!currentUser) {
			return NextResponse.json({ message: "User not found" }, { status: 404 });
		}

		// Build where clause based on role
		const department = req.nextUrl.searchParams.get("department");
		let whereClause: any = {};

		if (currentUser.role === "ADMIN" || currentUser.role === "SUPERADMIN") {
			// ADMIN and SUPERADMIN can see all users
			whereClause = {};
		} else if (currentUser.site) {
			// Other users can see users from their site + all SUPERADMINs
			whereClause = {
				OR: [{ site: currentUser.site }, { role: "SUPERADMIN" as any }],
			};
		} else {
			// If no site, only see SUPERADMINs
			whereClause = { role: "SUPERADMIN" as any };
		}

		// Add department filter if provided
		if (department) {
			whereClause = {
				AND: [
					whereClause,
					{
						OR: [
							{
								departmentAssignments: {
									some: {
										department: {
											name: {
												contains: department,
												mode: "insensitive",
											},
										},
									},
								},
							},
							{
								teamMemberships: {
									some: {
										team: {
											department: {
												name: {
													contains: department,
													mode: "insensitive",
												},
											},
										},
									},
								},
							},
							{
								teamLeaderships: {
									some: {
										team: {
											department: {
												name: {
													contains: department,
													mode: "insensitive",
												},
											},
										},
									},
								},
							},
						],
					},
				],
			};
		}

		// Fetch users
		const users = await prismaRPA.user.findMany({
			where: whereClause,
			select: {
				id: true,
				name: true,
				email: true,
				username: true,
				image: true,
				site: true,
			},
			orderBy: { name: "asc" },
		});

		return NextResponse.json({ users });
	} catch (error) {
		console.error("Failed to fetch users by site:", error);
		return NextResponse.json(
			{ message: "Failed to fetch users" },
			{ status: 500 },
		);
	}
}
