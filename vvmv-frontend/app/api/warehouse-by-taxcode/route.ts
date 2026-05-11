import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

/**
 * GET /api/warehouse-by-taxcode?taxCode=XXXXXX
 *
 * Returns the list of warehouseNames configured under PartnersMasterData
 * that matches the provided taxCode.
 *
 * Used by the shared WarehouseCombobox component so that any page
 * can let users pick a warehouse name that is relevant to the customer.
 */
export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const taxCode = searchParams.get("taxCode")?.trim();

		if (!taxCode) {
			return NextResponse.json({ warehouses: [] });
		}

		// Find the PartnersMasterData record(s) with matching taxCode,
		// then include their WarehouseConfig entries.
		const partners = await prismaRPA.partnersMasterData.findMany({
			where: {
				taxCode: taxCode,
			},
			select: {
				warehouseConfigs: {
					select: {
						id: true,
						warehouseName: true,
						deliveryAddress: true,
						contactInfo: true,
						invoiceInfo: true,
						notes: true,
						mapPosition: true,
					},
					orderBy: {
						warehouseName: "asc",
					},
				},
			},
		});

		// Flatten all warehouseConfigs across all matching partner records
		const warehouses = partners.flatMap((p) => p.warehouseConfigs);

		// Deduplicate by warehouseName (in case two partner records have the same name)
		const seen = new Set<string>();
		const unique = warehouses.filter((w) => {
			if (seen.has(w.warehouseName)) return false;
			seen.add(w.warehouseName);
			return true;
		});

		return NextResponse.json({ warehouses: unique });
	} catch (error) {
		console.error("Error fetching warehouses by taxCode:", error);
		return NextResponse.json(
			{ error: "Failed to fetch warehouses" },
			{ status: 500 },
		);
	}
}
