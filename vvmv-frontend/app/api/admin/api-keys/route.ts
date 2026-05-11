import { createHash, randomBytes } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

/**
 * Generate a secure random API key
 */
function generateApiKey(): string {
	return `vvmv_${randomBytes(32).toString("hex")}`;
}

/**
 * Hash API key for storage
 */
function hashApiKey(key: string): string {
	return createHash("sha256").update(key).digest("hex");
}

/**
 * GET /api/admin/api-keys - List all API keys
 */
export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Only ADMIN and SUPERADMIN can manage API keys
		if (!["ADMIN", "SUPERADMIN"].includes(session.user.role as string)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const { searchParams } = new URL(request.url);
		const page = parseInt(searchParams.get("page") || "1", 10);
		const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
		const skip = (page - 1) * pageSize;

		// Get user's site for filtering (non-superadmin can only see their site's keys)
		const dbUser = await prismaRPA.user.findUnique({
			where: { id: session.user.id },
			select: { site: true, role: true },
		});

		const whereClause: { site?: "SGN" | "HAN" | "DAD" } =
			dbUser?.role === "SUPERADMIN"
				? {}
				: dbUser?.site
					? { site: dbUser.site }
					: { site: "SGN" };

		const [apiKeys, total] = await Promise.all([
			prismaRPA.apiKey.findMany({
				where: whereClause,
				skip,
				take: pageSize,
				orderBy: { createdAt: "desc" },
				include: {
					user: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
				},
			}),
			prismaRPA.apiKey.count({ where: whereClause }),
		]);

		// Map response: don't return the full key hash
		const safeApiKeys = apiKeys.map((key) => ({
			id: key.id,
			name: key.name,
			keyPrefix: key.keyPrefix,
			site: key.site,
			permissions: key.permissions,
			isActive: key.isActive,
			expiresAt: key.expiresAt,
			lastUsedAt: key.lastUsedAt,
			createdAt: key.createdAt,
			user: key.user,
		}));

		return NextResponse.json({
			apiKeys: safeApiKeys,
			pagination: {
				total,
				page,
				pageSize,
				totalPages: Math.ceil(total / pageSize),
			},
		});
	} catch (error) {
		console.error("Error fetching API keys:", error);
		return NextResponse.json(
			{ error: "Failed to fetch API keys" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/admin/api-keys - Create a new API key
 */
export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		if (!["ADMIN", "SUPERADMIN"].includes(session.user.role as string)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const body = await request.json();
		const { name, userId, site, permissions, expiresAt } = body;

		if (!name || !userId || !site) {
			return NextResponse.json(
				{ error: "Missing required fields: name, userId, site" },
				{ status: 400 },
			);
		}

		// Verify user exists and get their info
		const targetUser = await prismaRPA.user.findUnique({
			where: { id: userId },
			select: { id: true, name: true, email: true, site: true },
		});

		if (!targetUser) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		// Generate the API key (plain text - will be shown once to user)
		const plainKey = generateApiKey();
		const hashedKey = hashApiKey(plainKey);
		const keyPrefix = plainKey.slice(0, 12); // "vvmv_" + first 7 chars

		const apiKey = await prismaRPA.apiKey.create({
			data: {
				name,
				key: hashedKey,
				keyPrefix,
				userId,
				site,
				permissions: permissions || ["create-transaction"],
				expiresAt: expiresAt ? new Date(expiresAt) : null,
			},
			include: {
				user: {
					select: {
						id: true,
						name: true,
						email: true,
					},
				},
			},
		});

		// Return with the plain key (only time it's visible!)
		return NextResponse.json({
			apiKey: {
				id: apiKey.id,
				name: apiKey.name,
				key: plainKey, // <-- IMPORTANT: Only shown once!
				keyPrefix: apiKey.keyPrefix,
				site: apiKey.site,
				permissions: apiKey.permissions,
				isActive: apiKey.isActive,
				expiresAt: apiKey.expiresAt,
				createdAt: apiKey.createdAt,
				user: apiKey.user,
			},
			message:
				"API key created successfully. Please save it now - it won't be shown again!",
		});
	} catch (error) {
		console.error("Error creating API key:", error);
		return NextResponse.json(
			{ error: "Failed to create API key" },
			{ status: 500 },
		);
	}
}

/**
 * PUT /api/admin/api-keys - Update API key (revoke, update name, permissions)
 */
export async function PUT(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		if (!["ADMIN", "SUPERADMIN"].includes(session.user.role as string)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const body = await request.json();
		const { id, name, isActive, permissions, expiresAt } = body;

		if (!id) {
			return NextResponse.json(
				{ error: "Missing required field: id" },
				{ status: 400 },
			);
		}

		const apiKey = await prismaRPA.apiKey.update({
			where: { id },
			data: {
				...(name !== undefined && { name }),
				...(isActive !== undefined && { isActive }),
				...(permissions !== undefined && { permissions }),
				...(expiresAt !== undefined && {
					expiresAt: expiresAt ? new Date(expiresAt) : null,
				}),
			},
			include: {
				user: {
					select: {
						id: true,
						name: true,
						email: true,
					},
				},
			},
		});

		return NextResponse.json({
			apiKey: {
				id: apiKey.id,
				name: apiKey.name,
				keyPrefix: apiKey.keyPrefix,
				site: apiKey.site,
				permissions: apiKey.permissions,
				isActive: apiKey.isActive,
				expiresAt: apiKey.expiresAt,
				lastUsedAt: apiKey.lastUsedAt,
				createdAt: apiKey.createdAt,
				user: apiKey.user,
			},
		});
	} catch (error) {
		console.error("Error updating API key:", error);
		return NextResponse.json(
			{ error: "Failed to update API key" },
			{ status: 500 },
		);
	}
}

/**
 * DELETE /api/admin/api-keys?id=xxx - Delete an API key
 */
export async function DELETE(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		if (!["ADMIN", "SUPERADMIN"].includes(session.user.role as string)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const { searchParams } = new URL(request.url);
		const id = searchParams.get("id");

		if (!id) {
			return NextResponse.json(
				{ error: "Missing required parameter: id" },
				{ status: 400 },
			);
		}

		await prismaRPA.apiKey.delete({ where: { id } });

		return NextResponse.json({ success: true, message: "API key deleted" });
	} catch (error) {
		console.error("Error deleting API key:", error);
		return NextResponse.json(
			{ error: "Failed to delete API key" },
			{ status: 500 },
		);
	}
}
