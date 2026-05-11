import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

type Site = "SGN" | "HAN" | "DAD";

// GET – list all configs (optionally filtered by site)
export async function GET(req: NextRequest) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	const { searchParams } = new URL(req.url);
	const site = searchParams.get("site") as Site | null;
	const search = searchParams.get("search") || "";
	const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
	const pageSize = Math.min(
		200,
		parseInt(searchParams.get("pageSize") || "100", 10),
	);

	const where: any = {};
	if (site) where.site = site;
	if (search) {
		where.OR = [
			{ containerSize: { contains: search, mode: "insensitive" } },
			{ isoType: { contains: search, mode: "insensitive" } },
			{ kc: { contains: search, mode: "insensitive" } },
		];
	}

	const [total, items] = await Promise.all([
		prismaRPA.containerSizeConfig.count({ where }),
		prismaRPA.containerSizeConfig.findMany({
			where,
			orderBy: [{ site: "asc" }, { containerSize: "asc" }],
			skip: (page - 1) * pageSize,
			take: pageSize,
		}),
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
}

// POST – create one or many configs (bulk import)
export async function POST(req: NextRequest) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	const body = await req.json();
	const isBulk = Array.isArray(body);
	const items: any[] = isBulk ? body : [body];

	if (items.length === 0) {
		return NextResponse.json({ message: "Không có dữ liệu" }, { status: 400 });
	}

	const invalid = items.filter((it) => !it.containerSize);
	if (invalid.length > 0) {
		return NextResponse.json(
			{ message: `${invalid.length} dòng thiếu containerSize` },
			{ status: 400 },
		);
	}

	try {
		const mapped = items.map((it) => ({
			containerSize: String(it.containerSize).trim(),
			isoType: it.isoType ? String(it.isoType).trim() : null,
			kc: it.kc ? String(it.kc).trim() : null,
			port: it.port ? String(it.port).trim() : null,
			site: (it.site as Site) || "SGN",
			createdBy: session.user.id,
		}));

		if (isBulk) {
			// Pre-check each row for duplicates (unique on isoType + port)
			const duplicates: string[] = [];
			const toInsert: typeof mapped = [];

			for (const row of mapped) {
				const exists = await prismaRPA.containerSizeConfig.findFirst({
					where: { isoType: row.isoType, port: row.port },
				});
				if (exists) {
					duplicates.push(
						`${row.containerSize}${row.isoType ? ` / ${row.isoType}` : ""}${row.port ? ` / ${row.port}` : ""}`,
					);
				} else {
					toInsert.push(row);
				}
			}

			let insertedCount = 0;
			if (toInsert.length > 0) {
				const result = await prismaRPA.containerSizeConfig.createMany({
					data: toInsert,
					skipDuplicates: true,
				});
				insertedCount = result.count;
			}

			return NextResponse.json(
				{
					success: true,
					count: insertedCount,
					skipped: duplicates.length,
					duplicates,
				},
				{ status: 201 },
			);
		} else {
			// Single create – check duplicate first
			const row = mapped[0];
			const exists = await prismaRPA.containerSizeConfig.findFirst({
				where: { isoType: row.isoType, port: row.port },
			});
			if (exists) {
				return NextResponse.json(
					{
						message: `Đã tồn tại bản ghi với ISO Type "${row.isoType || "(trống)"}" và Cảng "${row.port || "(trống)"}"`,
					},
					{ status: 409 },
				);
			}
			const record = await prismaRPA.containerSizeConfig.create({ data: row });
			return NextResponse.json(record, { status: 201 });
		}
	} catch (err: any) {
		if (err.code === "P2002") {
			return NextResponse.json(
				{ message: "Bản ghi với ISO Type và Cảng này đã tồn tại" },
				{ status: 409 },
			);
		}
		return NextResponse.json({ message: err.message }, { status: 500 });
	}
}

// PUT – update a config
export async function PUT(req: NextRequest) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	const body = await req.json();
	const { id, containerSize, isoType, kc, port, site } = body;

	if (!id) {
		return NextResponse.json({ message: "id là bắt buộc" }, { status: 400 });
	}

	try {
		const record = await prismaRPA.containerSizeConfig.update({
			where: { id },
			data: {
				containerSize: containerSize ? String(containerSize).trim() : undefined,
				isoType:
					isoType !== undefined
						? isoType
							? String(isoType).trim()
							: null
						: undefined,
				kc: kc !== undefined ? (kc ? String(kc).trim() : null) : undefined,
				port:
					port !== undefined ? (port ? String(port).trim() : null) : undefined,
				site: site ? (site as Site) : undefined,
			},
		});
		return NextResponse.json(record);
	} catch (err: any) {
		if (err.code === "P2002") {
			return NextResponse.json(
				{ message: "Container size này đã tồn tại cho site đã chọn" },
				{ status: 409 },
			);
		}
		return NextResponse.json({ message: err.message }, { status: 500 });
	}
}

// DELETE – remove a config
export async function DELETE(req: NextRequest) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	const { searchParams } = new URL(req.url);
	const id = searchParams.get("id");

	if (!id) {
		return NextResponse.json({ message: "id là bắt buộc" }, { status: 400 });
	}

	await prismaRPA.containerSizeConfig.delete({ where: { id } });
	return NextResponse.json({ success: true });
}
