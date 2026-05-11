import { type NextRequest, NextResponse } from "next/server";
import { prismaRPA } from "@/lib/db";
import { getVendorPortalContext } from "@/lib/vendor-portal-auth";
import { VendorFeeMode } from "@/prisma/client";

function normalizeServiceMode(value: string | null): VendorFeeMode | null {
	const normalized = String(value || "")
		.trim()
		.toUpperCase();
	if (normalized.startsWith("FCL")) return VendorFeeMode.FCL;
	if (normalized.startsWith("LCL")) return VendorFeeMode.LCL;
	return null;
}

export async function GET(request: NextRequest) {
	try {
		const context = await getVendorPortalContext(request);
		if (!context) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const serviceModeFilter = normalizeServiceMode(
			searchParams.get("mode")?.trim() || searchParams.get("serviceMode"),
		);

		const feeTypes = await prismaRPA.vendorFeeType.findMany({
			where: {
				isActive: true,
				site: context.vendor.site,
				AND: [
					{
						OR: [{ vendorId: null }, { vendorId: context.vendor.id }],
					},
					...(serviceModeFilter
						? [
								{
									mode: {
										in: [VendorFeeMode.ALL, serviceModeFilter],
									},
								},
							]
						: []),
				],
			},
			orderBy: [{ mode: "asc" }, { feeCode: "asc" }, { name: "asc" }],
			select: {
				id: true,
				name: true,
				feeCode: true,
				mode: true,
			},
		});

		return NextResponse.json({
			feeTypes: feeTypes.map((item) => ({
				...item,
				// Backward compatibility for older clients
				serviceMode: item.feeCode,
			})),
		});
	} catch (error) {
		console.error("Failed to fetch vendor fee types:", error);
		return NextResponse.json(
			{ message: "Failed to fetch fee types" },
			{ status: 500 },
		);
	}
}
