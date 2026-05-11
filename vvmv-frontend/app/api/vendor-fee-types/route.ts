import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { tryDelegateToStandaloneApi } from "@/lib/proxy-backend";
import { Site, VendorFeeMode } from "@/prisma/client";

function normalizeVendorFeeMode(value: unknown): VendorFeeMode {
	const raw = String(value || "ALL")
		.trim()
		.toUpperCase();
	if (raw === "FCL") return VendorFeeMode.FCL;
	if (raw === "LCL") return VendorFeeMode.LCL;
	return VendorFeeMode.ALL;
}

export async function GET(request: NextRequest) {
	const delegated = await tryDelegateToStandaloneApi(
		request,
		"vendor-fee-types",
	);
	if (delegated) return delegated;

	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const user = await prismaRPA.user.findUnique({
			where: { id: session.user.id },
			select: {
				site: true,
				role: true,
				departmentAssignments: {
					include: { department: { select: { name: true } } },
				},
				teamLeaderships: {
					include: {
						team: {
							include: { department: { select: { name: true } } },
						},
					},
				},
			},
		});

		const site = user?.site as Site | null;
		if (!site && user?.role !== "SUPERADMIN") {
			return NextResponse.json(
				{ message: "User site not configured" },
				{ status: 400 },
			);
		}

		const isTruckingManager =
			user?.role === "MANAGER" &&
			user.departmentAssignments?.some(
				(da) => da.department?.name === "Trucking",
			);
		const isTruckingTeamLeader = user?.teamLeaderships?.some(
			(tl) => tl.team?.department?.name === "Trucking",
		);
		const canEdit =
			user?.role === "ADMIN" ||
			user?.role === "SUPERADMIN" ||
			!!isTruckingManager ||
			!!isTruckingTeamLeader;

		const { searchParams } = new URL(request.url);
		const feeCode = searchParams.get("feeCode")?.trim();
		const mode = searchParams.get("mode")?.trim();

		const feeTypes = await prismaRPA.vendorFeeType.findMany({
			where: {
				...(user?.role === "SUPERADMIN" ? {} : { site: site as Site }),
				...(feeCode
					? { feeCode: { equals: feeCode, mode: "insensitive" } }
					: {}),
				...(mode ? { mode: normalizeVendorFeeMode(mode) } : {}),
			},
			orderBy: [
				{ site: "asc" },
				{ mode: "asc" },
				{ feeCode: "asc" },
				{ name: "asc" },
			],
			include: {
				vendor: {
					select: {
						id: true,
						name: true,
					},
				},
			},
		});

		return NextResponse.json({
			canEdit,
			feeTypes: feeTypes.map((item) => ({
				...item,
				// Backward compatibility for older clients
				serviceMode: item.feeCode,
			})),
		});
	} catch (error) {
		console.error("Failed to fetch vendor fee types:", error);
		return NextResponse.json(
			{ message: "Failed to fetch vendor fee types" },
			{ status: 500 },
		);
	}
}

export async function POST(request: NextRequest) {
	const delegated = await tryDelegateToStandaloneApi(
		request,
		"vendor-fee-types",
	);
	if (delegated) return delegated;

	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const user = await prismaRPA.user.findUnique({
			where: { id: session.user.id },
			select: {
				site: true,
				role: true,
				departmentAssignments: {
					include: { department: { select: { name: true } } },
				},
				teamLeaderships: {
					include: {
						team: {
							include: { department: { select: { name: true } } },
						},
					},
				},
			},
		});

		const isTruckingManager =
			user?.role === "MANAGER" &&
			user.departmentAssignments?.some(
				(da) => da.department?.name === "Trucking",
			);

		const isTruckingTeamLeader = user?.teamLeaderships?.some(
			(tl) => tl.team?.department?.name === "Trucking",
		);

		if (
			!user ||
			(user.role !== "ADMIN" &&
				user.role !== "SUPERADMIN" &&
				!isTruckingManager &&
				!isTruckingTeamLeader)
		) {
			return NextResponse.json({ message: "Forbidden" }, { status: 403 });
		}

		const body = await request.json();
		const items = Array.isArray(body) ? body : [body];

		if (!items.length) {
			return NextResponse.json(
				{ message: "No fee types provided" },
				{ status: 400 },
			);
		}

		const payload = items.map((item, index) => {
			const name = String(item?.name || "").trim();
			const feeCode =
				String(item?.feeCode || item?.serviceMode || "").trim() || null;
			const vendorId = String(item?.vendorId || "").trim() || null;
			const mode = normalizeVendorFeeMode(item?.mode);
			const isActive =
				typeof item?.isActive === "boolean" ? item.isActive : true;
			const isNotDefault =
				typeof item?.isNotDefault === "boolean" ? item.isNotDefault : false;

			if (!name) {
				throw new Error(`Fee name is required at row ${index + 1}`);
			}

			const effectiveSite =
				user.role === "SUPERADMIN"
					? (item?.site as Site) || Site.SGN
					: (user.site as Site) || Site.SGN;

			return {
				name,
				feeCode,
				feeDescription: String(item?.feeDescription || "").trim() || null,
				vendorId,
				mode,
				isActive,
				isNotDefault,
				site: effectiveSite,
			};
		});

		const created = await prismaRPA.$transaction(
			payload.map((data) => prismaRPA.vendorFeeType.create({ data })),
		);

		if (Array.isArray(body)) {
			return NextResponse.json({ success: true, count: created.length });
		}

		return NextResponse.json({ success: true, feeType: created[0] });
	} catch (error) {
		console.error("Failed to create vendor fee type:", error);
		const message =
			error instanceof Error
				? error.message
				: "Failed to create vendor fee type";
		return NextResponse.json({ message }, { status: 500 });
	}
}

export async function PUT(request: NextRequest) {
	const delegated = await tryDelegateToStandaloneApi(
		request,
		"vendor-fee-types",
	);
	if (delegated) return delegated;

	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const user = await prismaRPA.user.findUnique({
			where: { id: session.user.id },
			select: {
				site: true,
				role: true,
				departmentAssignments: {
					include: { department: { select: { name: true } } },
				},
				teamLeaderships: {
					include: {
						team: {
							include: { department: { select: { name: true } } },
						},
					},
				},
			},
		});

		const isTruckingManager =
			user?.role === "MANAGER" &&
			user.departmentAssignments?.some(
				(da) => da.department?.name === "Trucking",
			);

		const isTruckingTeamLeader = user?.teamLeaderships?.some(
			(tl) => tl.team?.department?.name === "Trucking",
		);

		if (
			!user ||
			(user.role !== "ADMIN" &&
				user.role !== "SUPERADMIN" &&
				!isTruckingManager &&
				!isTruckingTeamLeader)
		) {
			return NextResponse.json({ message: "Forbidden" }, { status: 403 });
		}

		const body = await request.json();
		const id = String(body?.id || "").trim();
		const name = String(body?.name || "").trim();
		const feeCode =
			String(body?.feeCode || body?.serviceMode || "").trim() || null;
		const feeDescription = String(body?.feeDescription || "").trim() || null;
		const vendorId = String(body?.vendorId || "").trim() || null;
		const mode = body?.mode;
		const isActive =
			typeof body?.isActive === "boolean" ? body.isActive : undefined;
		const isNotDefault =
			typeof body?.isNotDefault === "boolean" ? body.isNotDefault : undefined;

		if (!id) {
			return NextResponse.json({ message: "ID is required" }, { status: 400 });
		}

		if (!name) {
			return NextResponse.json(
				{ message: "Fee name is required" },
				{ status: 400 },
			);
		}

		const existing = await prismaRPA.vendorFeeType.findUnique({
			where: { id },
			select: { id: true, site: true },
		});

		if (!existing) {
			return NextResponse.json({ message: "Not found" }, { status: 404 });
		}

		if (user.role !== "SUPERADMIN" && user.site !== existing.site) {
			return NextResponse.json({ message: "Forbidden" }, { status: 403 });
		}

		const updated = await prismaRPA.vendorFeeType.update({
			where: { id },
			data: {
				name,
				feeCode,
				feeDescription,
				vendorId,
				...(typeof mode !== "undefined"
					? { mode: normalizeVendorFeeMode(mode) }
					: {}),
				...(typeof isActive === "boolean" ? { isActive } : {}),
				...(typeof isNotDefault === "boolean" ? { isNotDefault } : {}),
			},
		});

		return NextResponse.json({ success: true, feeType: updated });
	} catch (error) {
		console.error("Failed to update vendor fee type:", error);
		return NextResponse.json(
			{ message: "Failed to update vendor fee type" },
			{ status: 500 },
		);
	}
}

export async function DELETE(request: NextRequest) {
	const delegated = await tryDelegateToStandaloneApi(
		request,
		"vendor-fee-types",
	);
	if (delegated) return delegated;

	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const user = await prismaRPA.user.findUnique({
			where: { id: session.user.id },
			select: {
				site: true,
				role: true,
				departmentAssignments: {
					include: { department: { select: { name: true } } },
				},
				teamLeaderships: {
					include: {
						team: {
							include: { department: { select: { name: true } } },
						},
					},
				},
			},
		});

		const isTruckingManager =
			user?.role === "MANAGER" &&
			user.departmentAssignments?.some(
				(da) => da.department?.name === "Trucking",
			);

		const isTruckingTeamLeader = user?.teamLeaderships?.some(
			(tl) => tl.team?.department?.name === "Trucking",
		);

		if (
			!user ||
			(user.role !== "ADMIN" &&
				user.role !== "SUPERADMIN" &&
				!isTruckingManager &&
				!isTruckingTeamLeader)
		) {
			return NextResponse.json({ message: "Forbidden" }, { status: 403 });
		}

		const { searchParams } = new URL(request.url);
		const id = searchParams.get("id")?.trim();

		if (!id) {
			return NextResponse.json({ message: "ID is required" }, { status: 400 });
		}

		const existing = await prismaRPA.vendorFeeType.findUnique({
			where: { id },
			select: { id: true, site: true },
		});

		if (!existing) {
			return NextResponse.json({ message: "Not found" }, { status: 404 });
		}

		if (user.role !== "SUPERADMIN" && user.site !== existing.site) {
			return NextResponse.json({ message: "Forbidden" }, { status: 403 });
		}

		await prismaRPA.vendorFeeType.delete({ where: { id } });

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Failed to delete vendor fee type:", error);
		return NextResponse.json(
			{ message: "Failed to delete vendor fee type" },
			{ status: 500 },
		);
	}
}
