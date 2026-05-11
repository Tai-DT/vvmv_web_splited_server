import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

type Site = "SGN" | "HAN" | "DAD";

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
		const pageSize = Math.max(
			1,
			Math.min(1000, parseInt(searchParams.get("pageSize") || "50", 10)),
		);
		const search = searchParams.get("search")?.trim();
		const partnersMasterDataId = searchParams
			.get("partnersMasterDataId")
			?.trim();
		const skip = (page - 1) * pageSize;

		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user)
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

		const userSite = (session.user as any).site as Site | undefined;
		const isSuperAdmin = session.user.role === "SUPERADMIN";

		const whereClause: any = {};
		if (partnersMasterDataId)
			whereClause.partnersMasterDataId = partnersMasterDataId;
		if (!isSuperAdmin && userSite) whereClause.partner = { site: userSite };
		if (search) {
			whereClause.OR = [
				{ warehouseName: { contains: search, mode: "insensitive" } },
				{ deliveryAddress: { contains: search, mode: "insensitive" } },
				{ contactInfo: { contains: search, mode: "insensitive" } },
				{ partner: { taxCode: { contains: search, mode: "insensitive" } } },
			];
		}

		const [items, total] = await Promise.all([
			prismaRPA.warehouseConfig.findMany({
				where: whereClause,
				include: {
					partner: {
						select: { id: true, taxCode: true, cccd: true, site: true },
					},
					user: { select: { id: true, name: true, email: true } },
				},
				orderBy: [{ partner: { taxCode: "asc" } }, { warehouseName: "asc" }],
				skip,
				take: pageSize,
			}),
			prismaRPA.warehouseConfig.count({ where: whereClause }),
		]);

		return NextResponse.json({
			items,
			pagination: {
				total,
				page,
				pageSize,
				totalPages: Math.ceil(total / pageSize),
			},
		});
	} catch (error: any) {
		console.error("GET /api/admin/warehouse-configs Error:", error);
		return NextResponse.json(
			{ error: "Internal Server Error", message: error.message },
			{ status: 500 },
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user)
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

		const userSite = (session.user as any).site as Site | undefined;
		const body = await request.json();

		// ── Batch import (array) ──────────────────────────────────────────────────
		if (Array.isArray(body)) {
			if (body.length === 0)
				return NextResponse.json({ error: "Danh sách rỗng" }, { status: 400 });

			// Group rows by taxCode to resolve partnersMasterDataId
			const taxCodes = [
				...new Set(body.map((r: any) => r.taxCode?.trim()).filter(Boolean)),
			];
			const partnerIds = [
				...new Set(
					body.map((r: any) => r.partnersMasterDataId).filter(Boolean),
				),
			];

			// Build a map: taxCode → partnersMasterDataId
			const taxCodeMap = new Map<string, string>();
			const partnerIdMap = new Map<string, boolean>();

			if (taxCodes.length > 0) {
				const siteCond = !userSite
					? {}
					: session.user.role === "SUPERADMIN"
						? {}
						: { site: userSite };

				const partners = await prismaRPA.partnersMasterData.findMany({
					where: { taxCode: { in: taxCodes }, ...siteCond },
					select: { id: true, taxCode: true },
				});
				for (const p of partners) {
					if (p.taxCode) taxCodeMap.set(p.taxCode.trim(), p.id);
				}
			}

			if (partnerIds.length > 0) {
				const partners = await prismaRPA.partnersMasterData.findMany({
					where: { id: { in: partnerIds } },
					select: { id: true },
				});
				for (const p of partners) partnerIdMap.set(p.id, true);
			}

			const errors: string[] = [];
			const rows: any[] = [];

			for (const r of body) {
				const taxCode = r.taxCode?.trim();
				const pid = r.partnersMasterDataId;

				let resolvedId: string | undefined;
				if (pid && partnerIdMap.has(pid)) {
					resolvedId = pid;
				} else if (taxCode && taxCodeMap.has(taxCode)) {
					resolvedId = taxCodeMap.get(taxCode);
				}

				if (!resolvedId) {
					errors.push(`MST "${taxCode || pid}" không tìm thấy trong hệ thống`);
					continue;
				}
				if (!r.warehouseName?.trim()) continue;

				rows.push({
					partnersMasterDataId: resolvedId,
					warehouseName: r.warehouseName.trim(),
					deliveryAddress: r.deliveryAddress?.trim() || null,
					contactInfo: r.contactInfo?.trim() || null,
					invoiceInfo: r.invoiceInfo?.trim() || null,
					notes: r.notes?.trim() || null,
					mapPosition: (r.mapPosition || r.map_position)?.trim() || null,
					createdBy: session.user.id,
				});
			}

			if (rows.length === 0) {
				return NextResponse.json(
					{
						error: "Không có dòng hợp lệ",
						details: errors.join("; "),
					},
					{ status: 400 },
				);
			}

			await prismaRPA.warehouseConfig.createMany({
				data: rows,
				skipDuplicates: true,
			});
			return NextResponse.json({
				success: true,
				count: rows.length,
				skipped: body.length - rows.length,
				errors,
			});
		}

		// ── Single create ─────────────────────────────────────────────────────────
		const {
			partnersMasterDataId,
			warehouseName,
			deliveryAddress,
			contactInfo,
			invoiceInfo,
			notes,
			mapPosition,
		} = body;

		if (!partnersMasterDataId || !warehouseName?.trim())
			return NextResponse.json(
				{ error: "partnersMasterDataId và warehouseName là bắt buộc" },
				{ status: 400 },
			);

		const partner = await prismaRPA.partnersMasterData.findUnique({
			where: { id: partnersMasterDataId },
		});
		if (!partner)
			return NextResponse.json(
				{ error: "Không tìm thấy thông tin đối tác" },
				{ status: 404 },
			);

		const result = await prismaRPA.warehouseConfig.create({
			data: {
				partnersMasterDataId,
				warehouseName: warehouseName.trim(),
				deliveryAddress: deliveryAddress?.trim() || null,
				contactInfo: contactInfo?.trim() || null,
				invoiceInfo: invoiceInfo?.trim() || null,
				notes: notes?.trim() || null,
				mapPosition: mapPosition?.trim() || null,
				createdBy: session.user.id,
			},
			include: {
				partner: {
					select: { id: true, taxCode: true, cccd: true, site: true },
				},
			},
		});

		return NextResponse.json(result);
	} catch (error: any) {
		console.error("POST /api/admin/warehouse-configs Error:", error);
		return NextResponse.json(
			{ error: "Internal Server Error", details: error.message },
			{ status: 500 },
		);
	}
}

export async function PUT(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user)
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

		const body = await request.json();
		const {
			id,
			warehouseName,
			deliveryAddress,
			contactInfo,
			invoiceInfo,
			notes,
			mapPosition,
		} = body;

		if (!id)
			return NextResponse.json({ error: "ID là bắt buộc" }, { status: 400 });

		const existing = await prismaRPA.warehouseConfig.findUnique({
			where: { id },
		});
		if (!existing)
			return NextResponse.json(
				{ error: "Không tìm thấy bản ghi" },
				{ status: 404 },
			);

		const updateData: any = {};
		if (warehouseName !== undefined)
			updateData.warehouseName = warehouseName?.trim() || null;
		if (deliveryAddress !== undefined)
			updateData.deliveryAddress = deliveryAddress?.trim() || null;
		if (contactInfo !== undefined)
			updateData.contactInfo = contactInfo?.trim() || null;
		if (invoiceInfo !== undefined)
			updateData.invoiceInfo = invoiceInfo?.trim() || null;
		if (notes !== undefined) updateData.notes = notes?.trim() || null;
		if (mapPosition !== undefined)
			updateData.mapPosition = mapPosition?.trim() || null;

		const result = await prismaRPA.warehouseConfig.update({
			where: { id },
			data: updateData,
			include: {
				partner: {
					select: { id: true, taxCode: true, cccd: true, site: true },
				},
			},
		});

		return NextResponse.json(result);
	} catch (error: any) {
		console.error("PUT /api/admin/warehouse-configs Error:", error);
		return NextResponse.json(
			{ error: "Internal Server Error", details: error.message },
			{ status: 500 },
		);
	}
}

export async function DELETE(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user)
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

		const { searchParams } = new URL(request.url);
		const id = searchParams.get("id");
		if (!id)
			return NextResponse.json({ error: "ID là bắt buộc" }, { status: 400 });

		const existing = await prismaRPA.warehouseConfig.findUnique({
			where: { id },
		});
		if (!existing)
			return NextResponse.json(
				{ error: "Không tìm thấy bản ghi" },
				{ status: 404 },
			);

		await prismaRPA.warehouseConfig.delete({ where: { id } });
		return NextResponse.json({ success: true });
	} catch (error: any) {
		console.error("DELETE /api/admin/warehouse-configs Error:", error);
		return NextResponse.json(
			{ error: "Internal Server Error", details: error.message },
			{ status: 500 },
		);
	}
}
