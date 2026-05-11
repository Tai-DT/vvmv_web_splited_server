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

		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user)
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

		const userSite = (session.user as any).site as Site | undefined;
		const isSuperAdmin = session.user.role === "SUPERADMIN";

		const baseWhere: any = isSuperAdmin
			? siteParam
				? { site: siteParam }
				: {}
			: { site: userSite || "SGN" };
		if (search) baseWhere.name = { contains: search, mode: "insensitive" };

		const [items, total] = await Promise.all([
			prismaRPA.pickOrLiftPlace.findMany({
				where: baseWhere,
				orderBy: { name: "asc" },
				skip,
				take: pageSize,
				include: { user: { select: { name: true, email: true } } },
			}),
			prismaRPA.pickOrLiftPlace.count({ where: baseWhere }),
		]);

		return NextResponse.json({
			items,
			pagination: { total, totalPages: Math.ceil(total / pageSize) },
		});
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user)
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

		const body = await request.json();
		const isBulk = Array.isArray(body);
		const items = isBulk ? body : [body];
		const userSite = (session.user as any).site as Site | undefined;
		const isSuperAdmin = session.user.role === "SUPERADMIN";

		const errorReports: string[] = [];
		const validData: any[] = [];

		for (const [index, item] of items.entries()) {
			const { name, site: targetSite } = item;
			const rowSuffix = isBulk ? ` (Dòng ${index + 1})` : "";
			if (!name) {
				errorReports.push(`Thiếu tên${rowSuffix}`);
				continue;
			}

			const site: Site = isSuperAdmin
				? targetSite || userSite || "SGN"
				: userSite!;

			const existing = await prismaRPA.pickOrLiftPlace.findFirst({
				where: { name: { equals: name, mode: "insensitive" }, site },
			});
			if (existing) {
				errorReports.push(
					`"${name}" đã tồn tại trong site ${site}${rowSuffix}`,
				);
				continue;
			}

			validData.push({ name, site, createdBy: session.user.id });
		}

		if (errorReports.length > 0) {
			return NextResponse.json(
				{ error: "Dữ liệu không hợp lệ", details: errorReports.join("\n") },
				{ status: 400 },
			);
		}

		if (isBulk) {
			await prismaRPA.$transaction(
				validData.map((data) => prismaRPA.pickOrLiftPlace.create({ data })),
			);
			return NextResponse.json({ success: true, count: validData.length });
		} else {
			const result = await prismaRPA.pickOrLiftPlace.create({
				data: validData[0],
			});
			return NextResponse.json(result);
		}
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

export async function PUT(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user)
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

		const { id, name } = await request.json();
		if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

		const result = await prismaRPA.pickOrLiftPlace.update({
			where: { id },
			data: { name },
		});
		return NextResponse.json(result);
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

export async function DELETE(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user)
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

		const id = new URL(request.url).searchParams.get("id");
		if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

		await prismaRPA.pickOrLiftPlace.delete({ where: { id } });
		return NextResponse.json({ success: true });
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
