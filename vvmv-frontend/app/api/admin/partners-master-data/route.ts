import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA, queryERPHAN, queryERPHCM } from "@/lib/db";
import { parsePartnerInvoiceData } from "@/lib/followup/partners-master-cds-defaults";

type Site = "SGN" | "HAN" | "DAD";

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
		const pageSize = Math.max(
			1,
			Math.min(1000000, parseInt(searchParams.get("pageSize") || "10", 10)),
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
		const isAdmin = session.user.role === "ADMIN";
		const isSuperAdmin = session.user.role === "SUPERADMIN";

		// Determine base visibility
		const baseWhere: any = {};
		if (isSuperAdmin) {
			// SUPERADMIN can see any site
			if (siteParam) {
				baseWhere.site = siteParam;
			}
		} else {
			// Site-specific admin or regular user
			const siteToFilter = userSite || "SGN"; // Default to SGN if not set
			baseWhere.site = siteToFilter;
		}

		// Merge baseWhere with search if present
		let whereClause: any = baseWhere;

		if (search) {
			// 1. Get Taxcodes matching the search term from ERP database (for name search)
			const PARTNERS_SEARCH_QUERY = `
        SELECT DISTINCT Taxcode
        FROM Partners
        WHERE Taxcode IS NOT NULL AND Taxcode <> ''
        AND (PartnerName LIKE @search OR PartnerName2 LIKE @search OR PartnerName3 LIKE @search)
      `;

			const searchParam = `%${search}%`;
			const [hcmResults, hanResults] = await Promise.all([
				queryERPHCM<{ Taxcode: string }>(PARTNERS_SEARCH_QUERY, {
					search: searchParam,
				}).catch(() => ({ recordset: [] })),
				queryERPHAN<{ Taxcode: string }>(PARTNERS_SEARCH_QUERY, {
					search: searchParam,
				}).catch(() => ({ recordset: [] })),
			]);

			const matchingTaxCodes = new Set<string>();
			(hcmResults.recordset || []).forEach((r: any) =>
				matchingTaxCodes.add(r.Taxcode.trim()),
			);
			(hanResults.recordset || []).forEach((r: any) =>
				matchingTaxCodes.add(r.Taxcode.trim()),
			);

			whereClause = {
				AND: [
					baseWhere,
					{
						OR: [
							{ taxCode: { contains: search, mode: "insensitive" } },
							{ cccd: { contains: search, mode: "insensitive" } },
							{ ddInfo: { contains: search, mode: "insensitive" } },
							{ taxCode: { in: Array.from(matchingTaxCodes) } },
						],
					},
				],
			};
		}

		const [partners, total] = await Promise.all([
			prismaRPA.partnersMasterData.findMany({
				where: whereClause,
				include: {
					user: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
				},
				orderBy: [{ site: "asc" }, { taxCode: "asc" }],
				skip,
				take: pageSize,
			}),
			prismaRPA.partnersMasterData.count({ where: whereClause }),
		]);

		// Note: creditOnlyFeeCodes is already included via findMany (no explicit select needed)

		// Fetch fullName from ERP for partners with taxCode
		const taxCodes = partners
			.map((p) => p.taxCode)
			.filter((t): t is string => !!t);

		const erpNameMap = new Map<string, string>();
		if (taxCodes.length > 0) {
			const ERP_NAME_QUERY = `
        SELECT Taxcode,
          COALESCE(NULLIF(LTRIM(RTRIM(PartnerName3)), ''), NULLIF(LTRIM(RTRIM(PartnerName2)), ''), LTRIM(RTRIM(PartnerName))) AS FullName
        FROM Partners
        WHERE Taxcode IN (${taxCodes.map((_, i) => `@tc${i}`).join(", ")})
          AND Taxcode IS NOT NULL AND Taxcode <> ''
      `;
			const params = Object.fromEntries(
				taxCodes.map((tc, i) => [`tc${i}`, tc]),
			);

			const [hcmNames, hanNames] = await Promise.all([
				queryERPHCM<{ Taxcode: string; FullName: string }>(
					ERP_NAME_QUERY,
					params,
				).catch(() => ({ recordset: [] })),
				queryERPHAN<{ Taxcode: string; FullName: string }>(
					ERP_NAME_QUERY,
					params,
				).catch(() => ({ recordset: [] })),
			]);

			// Prefer HCM, then HAN
			for (const row of [
				...(hcmNames.recordset || []),
				...(hanNames.recordset || []),
			]) {
				if (
					row.Taxcode &&
					row.FullName &&
					!erpNameMap.has(row.Taxcode.trim())
				) {
					erpNameMap.set(row.Taxcode.trim(), row.FullName.trim());
				}
			}
		}

		const sanitizeDDInfo = (ddInfo: string | null) => {
			if (!ddInfo) return ddInfo;
			return ddInfo.replace(/Password=[^;]*/i, "Password=********");
		};

		return NextResponse.json({
			partners: partners.map((p) => ({
				...p,
				ddInfo: sanitizeDDInfo(p.ddInfo),
				enableKVGS: p.enableKVGS,
				enableCDS: p.enableCDS,
				creditOnlyFeeCodes: p.creditOnlyFeeCodes ?? [],
				fullName:
					p.fullName || (p.taxCode ? erpNameMap.get(p.taxCode) || null : null),
			})),
			pagination: {
				total,
				page,
				pageSize,
				totalPages: Math.ceil(total / pageSize),
			},
			userSite: isAdmin ? null : userSite,
			isAdmin,
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

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const {
			taxCode,
			fullName,
			cccd,
			ddInfo,
			warehouse,
			invoiceData,
			ewmsPass,
			maHQ,
			site: targetSite,
			enableKVGS,
			enableCDS,
			vatType,
			creditOnlyFeeCodes,
		} = body;
		const userSite = (session.user as any).site as Site | undefined;
		const isAdmin = session.user.role === "ADMIN";
		const isSuperAdmin = session.user.role === "SUPERADMIN";

		// Determine which site to operate on
		let operationSite: Site;

		if (isSuperAdmin) {
			// SUPERADMIN can create for any site (must specify)
			if (!targetSite || !["SGN", "DAD", "HAN"].includes(targetSite)) {
				return NextResponse.json(
					{
						error:
							"SUPERADMIN must specify a valid target site (SGN, DAD, or HAN)",
					},
					{ status: 400 },
				);
			}
			operationSite = targetSite;
		} else if (isAdmin && userSite) {
			// Site-specific admin can only create for their site
			operationSite = userSite;
		} else if (userSite) {
			// Non-admin uses their own site
			operationSite = userSite;
		} else {
			// Fallback
			operationSite = "SGN";
		}

		// Validate non-admin can't specify different site
		if (!isAdmin && targetSite && targetSite !== userSite) {
			return NextResponse.json(
				{ error: "You can only create partners for your own site" },
				{ status: 403 },
			);
		}

		// Prevent duplicate entries for the same taxCode and site
		if (taxCode) {
			const existing = await prismaRPA.partnersMasterData.findFirst({
				where: {
					taxCode: taxCode,
					site: operationSite,
				},
			});

			if (existing) {
				return NextResponse.json(
					{
						error: "Partner already exists at this site",
						details: `Mã số thuế ${taxCode} đã có bản ghi trong danh mục cho site ${operationSite}.`,
					},
					{ status: 400 },
				);
			}
		}

		const invoiceProfile = parsePartnerInvoiceData({
			invoiceData,
			companyName: fullName,
			taxCode,
		});

		const result = await prismaRPA.partnersMasterData.create({
			data: {
				taxCode: taxCode || null,
				fullName: fullName || null,
				cccd: cccd || null,
				ddInfo: ddInfo || null,
				warehouse: warehouse || null,
				invoiceData: invoiceData || null,
				...invoiceProfile,
				ewmsPass: ewmsPass || null,
				maHQ: maHQ || null,
				site: operationSite,
				enableKVGS: enableKVGS ?? true,
				enableCDS: enableCDS ?? true,
				vatType: vatType || null,
				creditOnlyFeeCodes: Array.isArray(creditOnlyFeeCodes)
					? creditOnlyFeeCodes.filter(Boolean)
					: [],
				createdBy: session.user.id,
			},
		});

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
			taxCode,
			fullName,
			cccd,
			ddInfo,
			warehouse,
			invoiceData,
			ewmsPass,
			maHQ,
			site: targetSite,
			enableKVGS,
			enableCDS,
			vatType,
			creditOnlyFeeCodes,
		} = body;
		const userSite = (session.user as any).site as Site | undefined;
		const isAdmin = session.user.role === "ADMIN";
		const isSuperAdmin = session.user.role === "SUPERADMIN";

		if (!id) {
			return NextResponse.json({ error: "ID is required" }, { status: 400 });
		}

		// Get existing record to check permissions
		const existing = await prismaRPA.partnersMasterData.findUnique({
			where: { id },
		});

		if (!existing) {
			return NextResponse.json({ error: "Partner not found" }, { status: 404 });
		}

		// Permission check based on admin type
		if (isSuperAdmin) {
			// SUPERADMIN can edit any site - no restriction
		} else if (isAdmin && userSite) {
			// Site-specific admin can only edit their site
			if (existing.site !== userSite) {
				return NextResponse.json(
					{ error: "You can only edit partners from your own site" },
					{ status: 403 },
				);
			}
		} else {
			// Non-admin can only edit their site
			if (existing.site !== userSite) {
				return NextResponse.json(
					{ error: "You can only edit partners from your own site" },
					{ status: 403 },
				);
			}
		}

		// Build update data
		const updateData: any = {};
		if (taxCode !== undefined) updateData.taxCode = taxCode || null;
		if (fullName !== undefined) updateData.fullName = fullName || null;
		if (cccd !== undefined) updateData.cccd = cccd || null;
		if (warehouse !== undefined) updateData.warehouse = warehouse || null;

		if (ddInfo !== undefined) {
			if (ddInfo?.includes("Password=********")) {
				// Restore old password from existing record if it wasn't actually changed
				const oldPassMatch = existing.ddInfo?.match(/Password=([^;]*)/i);
				const oldPass = oldPassMatch ? oldPassMatch[1] : "";
				updateData.ddInfo = ddInfo.replace(
					"Password=********",
					`Password=${oldPass}`,
				);
			} else {
				updateData.ddInfo = ddInfo || null;
			}
		}

		if (invoiceData !== undefined) {
			updateData.invoiceData = invoiceData || null;
			Object.assign(
				updateData,
				parsePartnerInvoiceData({
					invoiceData,
					companyName: fullName ?? existing.fullName,
					taxCode: taxCode ?? existing.taxCode,
				}),
			);
		}
		if (ewmsPass !== undefined) updateData.ewmsPass = ewmsPass || null;
		if (maHQ !== undefined) updateData.maHQ = maHQ || null;
		if (enableKVGS !== undefined) updateData.enableKVGS = enableKVGS;
		if (enableCDS !== undefined) updateData.enableCDS = enableCDS;
		if (vatType !== undefined) updateData.vatType = vatType || null;
		if (creditOnlyFeeCodes !== undefined)
			updateData.creditOnlyFeeCodes = Array.isArray(creditOnlyFeeCodes)
				? creditOnlyFeeCodes.filter(Boolean)
				: [];

		// Only SUPERADMIN can change site
		if (isSuperAdmin && targetSite !== undefined) {
			updateData.site = targetSite;
		}

		const result = await prismaRPA.partnersMasterData.update({
			where: { id },
			data: updateData,
		});

		return NextResponse.json(result);
	} catch (error: any) {
		console.error("API PUT Error:", error);
		return NextResponse.json(
			{
				error: "Internal Server Error",
				details: error.message,
			},
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
		const userSite = (session.user as any).site as Site | undefined;
		const isAdmin = session.user.role === "ADMIN";
		const isSuperAdmin = session.user.role === "SUPERADMIN";

		if (!id) {
			return NextResponse.json({ error: "ID is required" }, { status: 400 });
		}

		// Get existing record to check permissions
		const existing = await prismaRPA.partnersMasterData.findUnique({
			where: { id },
		});

		if (!existing) {
			return NextResponse.json({ error: "Partner not found" }, { status: 404 });
		}

		// Permission check based on admin type
		if (isSuperAdmin) {
			// SUPERADMIN can delete any site - no restriction
		} else if (isAdmin && userSite) {
			// Site-specific admin can only delete their site
			if (existing.site !== userSite) {
				return NextResponse.json(
					{ error: "You can only delete partners from your own site" },
					{ status: 403 },
				);
			}
		} else {
			// Non-admin can only delete their site
			if (existing.site !== userSite) {
				return NextResponse.json(
					{ error: "You can only delete partners from your own site" },
					{ status: 403 },
				);
			}
		}

		await prismaRPA.partnersMasterData.delete({
			where: { id },
		});

		return NextResponse.json({ success: true, message: "Partner deleted" });
	} catch (error: any) {
		console.error("API DELETE Error:", error);
		return NextResponse.json(
			{
				error: "Internal Server Error",
				details: error.message,
			},
			{ status: 500 },
		);
	}
}
