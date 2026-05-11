import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

export async function GET() {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		// Allow any authenticated user to read colors (for badge display)
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const userSite = (session.user as any).site;
		const isSuperAdmin = session.user.role === "SUPERADMIN";

		// SUPERADMIN sees all colors, site-specific admins see only their domain, others see only their domain
		const whereClause = isSuperAdmin
			? {}
			: userSite
				? { domain: userSite }
				: {};

		const [colors, followUpCompanies] = await Promise.all([
			prismaRPA.companyColor.findMany({
				where: whereClause,
			}),
			prismaRPA.followUp.groupBy({
				by: ["companyName", "taxCode"],
				where: {
					isDeleted: false,
					AND: [{ taxCode: { not: null } }, { taxCode: { not: "" } }],
				},
			}),
		]);

		// Fetch user info for each color config
		const userIds = [
			...new Set(colors.map((c: any) => c.createdBy).filter(Boolean)),
		];
		const users =
			userIds.length > 0
				? await prismaRPA.user.findMany({
						where: { id: { in: userIds } },
						select: { id: true, name: true, email: true },
					})
				: [];
		const userMap = new Map(users.map((u) => [u.id, u]));

		const colorsWithUser = colors.map((c: any) => ({
			...c,
			user: userMap.get(c.createdBy) || null,
		}));

		return NextResponse.json({
			colors: colorsWithUser,
			companies: followUpCompanies.map((c) => ({
				name: c.companyName,
				taxCode: c.taxCode,
			})),
		});
	} catch (error: any) {
		console.error("API GET Error:", error);
		return NextResponse.json(
			{
				error: "Internal Server Error",
				message: error.message,
				stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
			},
			{ status: 500 },
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});
		// Allow any authenticated user to modify colors
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { taxCode, color, domain: targetDomain } = body;
		const userSite = (session.user as any).site || "SGN";
		const isSuperAdmin = session.user.role === "SUPERADMIN";

		if (!taxCode) {
			return NextResponse.json(
				{ error: "Tax code is required" },
				{ status: 400 },
			);
		}

		// Determine which domain to operate on
		// SUPERADMIN can specify domain, site-specific admins and non-admins use their site
		let operationDomain: any;
		if (isSuperAdmin) {
			// SUPERADMIN can operate on any domain (must specify)
			if (!targetDomain || !["SGN", "DAD", "HAN"].includes(targetDomain)) {
				return NextResponse.json(
					{
						error:
							"SUPERADMIN must specify a valid target domain (SGN, DAD, or HAN)",
					},
					{ status: 400 },
				);
			}
			operationDomain = targetDomain;
		} else {
			// Site-specific admin and non-admin use their site
			operationDomain = userSite;
		}

		// If color is empty string or null, delete the override
		if (!color) {
			// For SUPERADMIN without targetDomain, delete from all domains
			if (isSuperAdmin && !targetDomain) {
				await prismaRPA.companyColor.deleteMany({
					where: { taxCode },
				});
			} else {
				await prismaRPA.companyColor.deleteMany({
					where: { taxCode, domain: operationDomain },
				});
			}
			return NextResponse.json({ success: true, message: "Color reset" });
		}

		// Upsert with unique constraint on [taxCode, domain]
		const existing = await prismaRPA.companyColor.findFirst({
			where: { taxCode, domain: operationDomain },
		});

		let result;
		if (existing) {
			result = await prismaRPA.companyColor.update({
				where: { id: existing.id },
				data: { color },
			});
		} else {
			result = await prismaRPA.companyColor.create({
				data: {
					taxCode,
					color,
					domain: operationDomain,
					createdBy: session.user.id,
				},
			});
		}

		return NextResponse.json(result);
	} catch (error: any) {
		console.error("API POST Error:", error);
		return NextResponse.json(
			{
				error: "Internal Server Error",
				details: error.message,
			},
			{ status: 500 },
		);
	}
}
