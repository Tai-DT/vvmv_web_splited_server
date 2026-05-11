import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import type { Site } from "@/prisma/client";

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
		const pageSize = Math.max(
			1,
			parseInt(searchParams.get("pageSize") || "50", 10),
		);
		const search = searchParams.get("search")?.trim();
		const siteParam = searchParams.get("site") as Site | null;
		const skip = (page - 1) * pageSize;

		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const userSite = (session.user as any).site as Site | undefined;
		const isSuperAdmin = session.user.role === "SUPERADMIN";

		const baseWhere: any = {};
		if (isSuperAdmin) {
			if (siteParam) baseWhere.site = siteParam;
		} else {
			baseWhere.site = userSite || "SGN";
		}

		const whereClause = { ...baseWhere };
		if (search) {
			whereClause.OR = [
				{ whCode: { contains: search, mode: "insensitive" } },
				{ whName: { contains: search, mode: "insensitive" } },
			];
		}

		const [items, total] = await Promise.all([
			prismaRPA.customsWarehouse.findMany({
				where: whereClause,
				orderBy: { whCode: "asc" },
				skip,
				take: pageSize,
				include: {
					user: { select: { name: true, email: true } },
				},
			}),
			prismaRPA.customsWarehouse.count({ where: whereClause }),
		]);

		return NextResponse.json({
			items,
			pagination: {
				total,
				totalPages: Math.ceil(total / pageSize),
			},
		});
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const isBulk = Array.isArray(body);
		const items = isBulk ? body : [body];
		const userSite = (session.user as any).site as Site | undefined;
		const isSuperAdmin = session.user.role === "SUPERADMIN";

		if (!isSuperAdmin && !userSite) {
			return NextResponse.json(
				{ error: "Tài khoản của bạn chưa được cấu hình Site (SGN/HAN/DAD)" },
				{ status: 400 },
			);
		}

		const errorReports: string[] = [];
		const validData: any[] = [];

		for (const [index, item] of items.entries()) {
			const { whCode, whName, site: targetSite } = item;
			const rowSuffix = isBulk ? ` (Dòng ${index + 1})` : "";

			if (!whCode) {
				errorReports.push(`Thiếu WH Code${rowSuffix}`);
				continue;
			}
			if (!whName) {
				errorReports.push(`Thiếu WH Name${rowSuffix}`);
				continue;
			}

			let site: Site;
			if (isSuperAdmin) {
				site = targetSite || userSite || "SGN";
			} else {
				site = userSite!;
			}

			const existing = await prismaRPA.customsWarehouse.findFirst({
				where: { whCode: { equals: whCode.trim(), mode: "insensitive" }, site },
			});
			if (existing) {
				errorReports.push(
					`WH Code "${whCode}" đã tồn tại trong site ${site}${rowSuffix}`,
				);
				continue;
			}

			validData.push({
				whCode: whCode.trim().toUpperCase(),
				whName: whName.trim(),
				site,
				createdBy: session.user.id,
			});
		}

		if (errorReports.length > 0) {
			return NextResponse.json(
				{ error: "Dữ liệu không hợp lệ", details: errorReports.join("\n") },
				{ status: 400 },
			);
		}

		if (isBulk) {
			await prismaRPA.$transaction(
				validData.map((data) => prismaRPA.customsWarehouse.create({ data })),
			);
			return NextResponse.json({ success: true, count: validData.length });
		} else {
			const result = await prismaRPA.customsWarehouse.create({
				data: validData[0],
			});
			return NextResponse.json(result);
		}
	} catch (error: any) {
		return NextResponse.json(
			{ error: error.message || "Internal Server Error" },
			{ status: 500 },
		);
	}
}

export async function PUT(request: NextRequest) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { id, whCode, whName } = await request.json();
		if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });
		if (!whCode)
			return NextResponse.json({ error: "Missing WH Code" }, { status: 400 });
		if (!whName)
			return NextResponse.json({ error: "Missing WH Name" }, { status: 400 });

		const result = await prismaRPA.customsWarehouse.update({
			where: { id },
			data: {
				whCode: whCode.trim().toUpperCase(),
				whName: whName.trim(),
			},
		});

		return NextResponse.json(result);
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

export async function DELETE(request: NextRequest) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const id = searchParams.get("id");
		if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

		await prismaRPA.customsWarehouse.delete({ where: { id } });
		return NextResponse.json({ success: true });
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
