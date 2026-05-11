import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

/**
 * POST /api/dispatch/add-vendor
 * Find-or-create a vendor TruckingNumber slot.
 * Vendor slots reuse the TruckingNumber model with isVendor=true so FCR
 * assignment works identically to trucks.
 *
 * Body: { vendorId: string }
 * Returns: { id: string; vendorName: string }
 */
export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { vendorId } = body as { vendorId: string };

		if (!vendorId) {
			return NextResponse.json(
				{ message: "Missing vendorId" },
				{ status: 400 },
			);
		}

		const vendor = await prismaRPA.vendor.findUnique({
			where: { id: vendorId },
			select: { id: true, name: true, site: true },
		});

		if (!vendor) {
			return NextResponse.json(
				{ message: "Vendor not found" },
				{ status: 404 },
			);
		}

		// Find existing vendor TruckingNumber for this vendor+site, or create one
		const existing = await prismaRPA.truckingNumber.findFirst({
			where: { isVendor: true, vendorName: vendor.name, site: vendor.site },
			select: { id: true, vendorName: true },
		});

		if (existing) {
			return NextResponse.json({
				id: existing.id,
				vendorName: existing.vendorName,
			});
		}

		const created = await prismaRPA.truckingNumber.create({
			data: {
				plateNumber: "",
				isVendor: true,
				vendorName: vendor.name,
				site: vendor.site,
				createdBy: session.user.id,
			},
			select: { id: true, vendorName: true },
		});

		return NextResponse.json({
			id: created.id,
			vendorName: created.vendorName,
		});
	} catch (error) {
		console.error("Add vendor error:", error);
		return NextResponse.json(
			{
				message: "Failed to add vendor",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
