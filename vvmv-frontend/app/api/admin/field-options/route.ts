import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import type { Site } from "@/prisma/client";

// GET /api/admin/field-options?fieldName=invoiceType&site=SGN&page=1&pageSize=50
export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const role = session.user.role;
		if (role !== "ADMIN" && role !== "SUPERADMIN") {
			return NextResponse.json({ message: "Forbidden" }, { status: 403 });
		}

		const { searchParams } = new URL(request.url);
		const fieldName = searchParams.get("fieldName");
		const siteParam = searchParams.get("site") as Site | null;
		const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
		const pageSize = parseInt(searchParams.get("pageSize") || "100", 10);
		const skip = (page - 1) * pageSize;

		const whereClause: any = {};
		if (fieldName) whereClause.fieldName = fieldName;
		if (siteParam !== undefined && siteParam !== null) {
			whereClause.site = (siteParam as string) === "" ? null : siteParam;
		}

		const [items, total] = await Promise.all([
			prismaRPA.fieldOption.findMany({
				where: whereClause,
				orderBy: [
					{ fieldName: "asc" },
					{ order: "asc" },
					{ code: "asc" },
					{ name: "asc" },
				],
				skip: pageSize === 0 ? undefined : skip,
				take: pageSize === 0 ? undefined : pageSize,
				include: {
					user: { select: { name: true, email: true } },
				},
			}),
			prismaRPA.fieldOption.count({ where: whereClause }),
		]);

		// Get distinct fieldNames for sidebar
		const fieldNames = await prismaRPA.fieldOption.findMany({
			select: { fieldName: true },
			distinct: ["fieldName"],
			orderBy: { fieldName: "asc" },
		});

		return NextResponse.json({
			items,
			fieldNames: fieldNames.map((f) => f.fieldName),
			pagination: {
				total,
				totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 1,
			},
		});
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

// POST /api/admin/field-options
export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const role = session.user.role;
		if (role !== "ADMIN" && role !== "SUPERADMIN") {
			return NextResponse.json({ message: "Forbidden" }, { status: 403 });
		}

		const body = await request.json();
		const items = Array.isArray(body) ? body : [body];

		if (items.length === 0) {
			return NextResponse.json(
				{ error: "Không có dữ liệu để tạo" },
				{ status: 400 },
			);
		}

		const normalizedItems = items.map((item, index) => {
			let normalizedConditions = null;
			if (item.conditions && typeof item.conditions === "string") {
				try {
					normalizedConditions = JSON.parse(item.conditions);
				} catch {
					throw new Error(`Dòng ${index + 1}: conditions JSON không hợp lệ`);
				}
			} else if (item.conditions && typeof item.conditions === "object") {
				normalizedConditions = item.conditions;
			}

			const normalized = {
				fieldName: item.fieldName?.trim(),
				code: item.code?.trim() || null,
				name: item.name?.trim(),
				color: item.color?.trim() || null,
				conditions: normalizedConditions,
				order: Number.isFinite(Number(item.order)) ? Number(item.order) : 0,
				site: (item.site || null) as Site | null,
				isActive: item.isActive ?? true,
			};

			if (!normalized.fieldName || !normalized.name) {
				throw new Error(`Dòng ${index + 1}: fieldName và name là bắt buộc`);
			}

			return normalized;
		});

		const duplicateKeys = new Set<string>();
		for (const [index, item] of normalizedItems.entries()) {
			const duplicateKey = [
				item.fieldName,
				item.code ?? "",
				item.site ?? "",
			].join("::");
			if (duplicateKeys.has(duplicateKey)) {
				return NextResponse.json(
					{
						error: `Dòng ${index + 1}: trùng fieldName + code + site trong dữ liệu dán vào`,
					},
					{ status: 409 },
				);
			}
			duplicateKeys.add(duplicateKey);
		}

		const existingOptions = await Promise.all(
			normalizedItems.map((item) =>
				prismaRPA.fieldOption.findFirst({
					where: {
						fieldName: item.fieldName,
						code: item.code,
						site: item.site,
					},
					select: { id: true },
				}),
			),
		);

		const existingIndex = existingOptions.findIndex(Boolean);
		if (existingIndex >= 0) {
			return NextResponse.json(
				{
					error: `Dòng ${existingIndex + 1}: option với fieldName, code và site này đã tồn tại`,
				},
				{ status: 409 },
			);
		}

		const createdItems = await prismaRPA.$transaction(
			normalizedItems.map((item) =>
				prismaRPA.fieldOption.create({
					data: {
						fieldName: item.fieldName,
						code: item.code,
						name: item.name,
						color: item.color,
						conditions: item.conditions,
						order: item.order,
						site: item.site,
						isActive: item.isActive,
						createdBy: session.user.id,
					},
				}),
			),
		);

		if (Array.isArray(body)) {
			return NextResponse.json(
				{ items: createdItems, count: createdItems.length },
				{ status: 201 },
			);
		}

		return NextResponse.json({ item: createdItems[0] }, { status: 201 });
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
