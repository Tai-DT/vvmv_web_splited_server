import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA, queryERPHAN, queryERPHCM } from "@/lib/db";
import { cleanPlateNumber, PLATE_URL_REGEX } from "@/lib/trucking/plate-utils";

type Site = "SGN" | "HAN" | "DAD";

/**
 * Insert @plateNumber into ERP VehicleList if it doesn’t already exist.
 * DAD has no ERP connection — silently skipped.
 */
async function upsertVehicleInERP(
	plateNumber: string,
	site: Site,
): Promise<void> {
	if (site === "DAD") return;
	const erpQuery = site === "SGN" ? queryERPHCM : queryERPHAN;
	const deptId = site === "SGN" ? "SGDP006" : "DP003";
	const userInput =
		site === "SGN" ? "adminsgn@vvmv.com.vn" : "hoattq@vvmv.com.vn";
	await erpQuery(
		`IF NOT EXISTS (SELECT 1 FROM dbo.VehicleList WHERE VHUnitNo = @plateNumber)
     BEGIN
       INSERT INTO dbo.VehicleList
         (VHUnitNo, VHFuelConsumption, VHDeptID, VHCost, Inuse, UserInput, DateInput, DateModify, Remooc, MaximumCapacity, MaximumCBM)
       VALUES
         (@plateNumber, 0, @deptId, 0, 1, @userInput, GETDATE(), GETDATE(), 0, 0, 0)
     END`,
		{ plateNumber, deptId, userInput },
	);
}

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
		const pageSize = Math.max(
			1,
			parseInt(searchParams.get("pageSize") || "10", 10),
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
		const _isAdmin = session.user.role === "ADMIN";
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
				{ plateNumber: { contains: search, mode: "insensitive" } },
				{ driverName: { contains: search, mode: "insensitive" } },
				{ vehicleType: { contains: search, mode: "insensitive" } },
				{ vendorName: { contains: search, mode: "insensitive" } },
			];
		}

		const [items, total] = await Promise.all([
			prismaRPA.truckingNumber.findMany({
				where: whereClause,
				orderBy: { createdAt: "desc" },
				skip,
				take: pageSize,
				include: {
					user: {
						select: { name: true, email: true },
					},
				},
			}),
			prismaRPA.truckingNumber.count({ where: whereClause }),
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

		// Pre-check all items
		for (const [index, item] of items.entries()) {
			const {
				plateNumber,
				driverName,
				driverEmail,
				driverPhone,
				driverCCCD,
				driverLicense,
				vehicleType,
				vendorName,
				payload,
				site: targetSite,
			} = item;
			const rowSuffix = isBulk ? ` (Dòng ${index + 1})` : "";

			let site: Site;
			if (isSuperAdmin) {
				site = targetSite || userSite || "SGN";
			} else {
				site = userSite!; // Strictly use user's assigned site
			}

			// Check for valid site enum value
			if (!["SGN", "HAN", "DAD"].includes(site)) {
				errorReports.push(`Site ${site || "(Trống)"} không hợp lệ${rowSuffix}`);
				continue;
			}

			// ERP Validation
			const erpQuery = site === "SGN" ? queryERPHCM : queryERPHAN;

			if (!plateNumber) {
				errorReports.push(`Thiếu Biển số xe${rowSuffix}`);
				continue;
			}

			if (!PLATE_URL_REGEX.test(cleanPlateNumber(plateNumber))) {
				errorReports.push(
					`Biển số xe ${plateNumber} không đúng định dạng${rowSuffix}`,
				);
				continue;
			}

			if (vehicleType) {
				const typeCheck = await erpQuery(
					`SELECT TOP 1 UNITID FROM UnitContents WHERE UNITID = @vehicleType`,
					{ vehicleType },
				);
				if (!typeCheck.recordset || typeCheck.recordset.length === 0) {
					errorReports.push(
						`Loại xe ${vehicleType} không tồn tại trong ERP ${site}${rowSuffix}`,
					);
				}
			}

			const normalizedVendorName =
				typeof vendorName === "string" ? vendorName.trim() : "";

			if (normalizedVendorName) {
				const existingVendor = await prismaRPA.vendor.findFirst({
					where: {
						name: { equals: normalizedVendorName, mode: "insensitive" },
						site,
					},
					select: { id: true },
				});

				if (!existingVendor) {
					errorReports.push(
						`Vendor ${normalizedVendorName} không tồn tại trong site ${site}${rowSuffix}`,
					);
				}
			}

			// Duplicate Check in local DB
			if (plateNumber) {
				const existing = await prismaRPA.truckingNumber.findFirst({
					where: { plateNumber, site },
				});
				if (existing) {
					errorReports.push(
						`Biển số ${plateNumber} đã tồn tại trong hệ thống${rowSuffix}`,
					);
				}
			}

			validData.push({
				plateNumber,
				driverName: driverName || null,
				driverEmail: driverEmail || null,
				driverPhone: driverPhone || null,
				driverCCCD: driverCCCD || null,
				driverLicense: driverLicense || null,
				vehicleType: vehicleType || null,
				vendorName: normalizedVendorName || null,
				isVendor: false,
				payload: payload ? parseFloat(payload) : null,
				site,
				createdBy: session.user.id,
			});
		}

		if (errorReports.length > 0) {
			return NextResponse.json(
				{
					error: "Dữ liệu không hợp lệ",
					details: errorReports.join("\n"),
				},
				{ status: 400 },
			);
		}

		// Process implementation
		if (isBulk) {
			// ERP upsert for all items, then bulk insert into local DB
			for (const data of validData) {
				try {
					await upsertVehicleInERP(data.plateNumber, data.site);
				} catch (erpErr: any) {
					console.warn(
						`[ERP upsert] ${data.plateNumber} (${data.site}):`,
						erpErr.message,
					);
				}
			}
			await prismaRPA.$transaction(
				validData.map((data) => prismaRPA.truckingNumber.create({ data })),
			);
			return NextResponse.json({ success: true, count: validData.length });
		} else {
			// ERP upsert, then insert into local DB
			try {
				await upsertVehicleInERP(validData[0].plateNumber, validData[0].site);
			} catch (erpErr: any) {
				console.warn(
					`[ERP upsert] ${validData[0].plateNumber} (${validData[0].site}):`,
					erpErr.message,
				);
			}
			const result = await prismaRPA.truckingNumber.create({
				data: validData[0],
			});
			return NextResponse.json(result);
		}
	} catch (error: any) {
		console.error("POST /api/admin/trucking-numbers Error:", error);
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
		const body = await request.json();
		const {
			id,
			driverName,
			driverEmail,
			driverPhone,
			driverCCCD,
			driverLicense,
			vehicleType,
			vendorName,
			payload,
			plateNumber,
		} = body;

		if (!id) {
			return NextResponse.json({ error: "Missing ID" }, { status: 400 });
		}

		if (plateNumber && !PLATE_URL_REGEX.test(cleanPlateNumber(plateNumber))) {
			return NextResponse.json(
				{ error: `Biển số xe ${plateNumber} không đúng định dạng` },
				{ status: 400 },
			);
		}

		// Find the existing record first
		const existing = await prismaRPA.truckingNumber.findUnique({
			where: { id },
		});

		if (!existing) {
			return NextResponse.json(
				{ error: "Không tìm thấy bản ghi" },
				{ status: 404 },
			);
		}

		const userSite = (session.user as any).site as Site | undefined;
		const isSuperAdmin = session.user.role === "SUPERADMIN";

		// Site access control: non-superadmins can only edit their own site's data
		if (!isSuperAdmin && existing.site !== userSite) {
			return NextResponse.json(
				{ error: "Bạn không có quyền chỉnh sửa dữ liệu của site khác" },
				{ status: 403 },
			);
		}

		// ERP Validate vehicleType if provided
		if (vehicleType) {
			const erpQuery = existing.site === "SGN" ? queryERPHCM : queryERPHAN;
			const typeCheck = await erpQuery(
				`SELECT TOP 1 UNITID FROM UnitContents WHERE UNITID = @vehicleType`,
				{ vehicleType },
			);
			if (!typeCheck.recordset || typeCheck.recordset.length === 0) {
				return NextResponse.json(
					{
						error: `Loại xe "${vehicleType}" không tồn tại trong ERP ${existing.site}`,
					},
					{ status: 400 },
				);
			}
		}

		const normalizedVendorName =
			typeof vendorName === "string" ? vendorName.trim() : "";

		if (normalizedVendorName) {
			const existingVendor = await prismaRPA.vendor.findFirst({
				where: {
					name: { equals: normalizedVendorName, mode: "insensitive" },
					site: existing.site,
				},
				select: { id: true },
			});

			if (!existingVendor) {
				return NextResponse.json(
					{
						error: `Vendor "${normalizedVendorName}" không tồn tại trong site ${existing.site}`,
					},
					{ status: 400 },
				);
			}
		}

		const updated = await prismaRPA.truckingNumber.update({
			where: { id },
			data: {
				driverName: driverName !== undefined ? driverName || null : undefined,
				driverEmail:
					driverEmail !== undefined ? driverEmail || null : undefined,
				driverPhone:
					driverPhone !== undefined ? driverPhone || null : undefined,
				driverCCCD: driverCCCD !== undefined ? driverCCCD || null : undefined,
				driverLicense:
					driverLicense !== undefined ? driverLicense || null : undefined,
				vehicleType:
					vehicleType !== undefined ? vehicleType || null : undefined,
				vendorName:
					vendorName !== undefined ? normalizedVendorName || null : undefined,
				payload:
					payload !== undefined
						? payload === "" || payload === null
							? null
							: parseFloat(payload)
						: undefined,
			},
		});

		// ERP upsert — ensure the plate is registered in ERP (no-op if already exists)
		try {
			await upsertVehicleInERP(existing.plateNumber, existing.site as Site);
		} catch (erpErr: any) {
			console.warn(
				`[ERP upsert PUT] ${existing.plateNumber} (${existing.site}):`,
				erpErr.message,
			);
		}

		return NextResponse.json(updated);
	} catch (error: any) {
		console.error("PUT /api/admin/trucking-numbers Error:", error);
		return NextResponse.json(
			{ error: error.message || "Internal Server Error" },
			{ status: 500 },
		);
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

		await prismaRPA.truckingNumber.delete({ where: { id } });

		return NextResponse.json({ success: true });
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
