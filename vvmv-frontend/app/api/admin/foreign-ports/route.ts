import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import type { PortType, Site } from "@/prisma/client";

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
		const portTypeParam = searchParams.get("portType") as PortType | null;
		const skip = (page - 1) * pageSize;

		const session = await auth.api.getSession({ headers: await headers() });
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
		if (portTypeParam) baseWhere.portType = portTypeParam;

		const whereClause = { ...baseWhere };
		if (search) {
			whereClause.name = { contains: search, mode: "insensitive" };
		}

		const [items, total] = await Promise.all([
			prismaRPA.foreignPort.findMany({
				where: whereClause,
				orderBy: { name: "asc" },
				skip,
				take: pageSize,
				include: { user: { select: { name: true, email: true } } },
			}),
			prismaRPA.foreignPort.count({ where: whereClause }),
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
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const isBulk = Array.isArray(body);
		const items = isBulk ? body : [body];
		const userSite = (session.user as any).site as Site | undefined;
		const isSuperAdmin = session.user.role === "SUPERADMIN";

		const skipped: { row: number; name: string; reason: string }[] = [];
		const validData: any[] = [];
		// Track names already accepted in this batch to avoid intra-batch duplicates
		const seenKeys = new Set<string>();

		for (const [index, item] of items.entries()) {
			const { name, portType, site: targetSite, domesticPort } = item;
			if (!name) {
				skipped.push({
					row: index + 1,
					name: name || "(trống)",
					reason: "Thiếu tên cảng",
				});
				continue;
			}

			const site: Site = isSuperAdmin
				? targetSite || userSite || "SGN"
				: userSite!;

			// Check intra-batch duplicate first (fast, no DB query needed)
			const batchKey = `${name.toLowerCase()}__${site}`;
			if (seenKeys.has(batchKey)) {
				skipped.push({
					row: index + 1,
					name,
					reason: "Trùng lặp trong cùng file import",
				});
				continue;
			}

			const existing = await prismaRPA.foreignPort.findFirst({
				where: {
					name: { equals: name, mode: "insensitive" },
					site,
					domesticPort:
						domesticPort !== undefined ? domesticPort || null : null,
				},
			});
			if (existing) {
				skipped.push({
					row: index + 1,
					name,
					reason: `Đã tồn tại (name + site + domesticPort) trong site ${site}`,
				});
				continue;
			}

			seenKeys.add(batchKey);
			validData.push({
				name,
				portType: portType || null,
				domesticPort:
					domesticPort !== undefined ? domesticPort || null : undefined,
				site,
				createdBy: session.user.id,
			});
		}

		// For single-item POST: keep strict behavior (fail if invalid/duplicate)
		if (!isBulk) {
			if (skipped.length > 0) {
				return NextResponse.json({ error: skipped[0].reason }, { status: 400 });
			}
			const result = await prismaRPA.foreignPort.create({ data: validData[0] });
			return NextResponse.json(result);
		}

		// Bulk: always insert valid rows, report skipped
		if (validData.length > 0) {
			await prismaRPA.$transaction(
				validData.map((data) => prismaRPA.foreignPort.create({ data })),
			);
		}

		return NextResponse.json({
			success: true,
			inserted: validData.length,
			skipped,
		});
	} catch (error: any) {
		return NextResponse.json(
			{ error: error.message || "Internal Server Error" },
			{ status: 500 },
		);
	}
}

export async function PUT(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user)
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

		const { id, name, portType, domesticPort } = await request.json();
		if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

		// Fetch current record to get its site
		const current = await prismaRPA.foreignPort.findUnique({ where: { id } });
		if (!current)
			return NextResponse.json({ error: "Record not found" }, { status: 404 });

		// Check for duplicate name + site + domesticPort (excluding itself)
		if (name) {
			const duplicate = await prismaRPA.foreignPort.findFirst({
				where: {
					name: { equals: name, mode: "insensitive" },
					site: current.site,
					domesticPort:
						domesticPort !== undefined ? domesticPort || null : null,
					NOT: { id },
				},
			});
			if (duplicate) {
				return NextResponse.json(
					{
						error: `Cảng "${name}" đã tồn tại (name + site + domesticPort) trong site ${current.site}`,
					},
					{ status: 409 },
				);
			}
		}

		const result = await prismaRPA.foreignPort.update({
			where: { id },
			data: {
				name,
				portType: portType || null,
				domesticPort:
					domesticPort !== undefined ? domesticPort || null : undefined,
			},
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

		await prismaRPA.foreignPort.delete({ where: { id } });
		return NextResponse.json({ success: true });
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
