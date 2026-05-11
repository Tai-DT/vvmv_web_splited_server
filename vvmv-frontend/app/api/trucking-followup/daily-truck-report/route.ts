import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const date = searchParams.get("date"); // YYYY-MM-DD
		const vendor = searchParams.get("vendor");

		if (!date) {
			return NextResponse.json(
				{ message: "Date is required" },
				{ status: 400 },
			);
		}

		const start = new Date(date);
		start.setHours(0, 0, 0, 0);
		const end = new Date(date);
		end.setHours(23, 59, 59, 999);

		const where: any = {
			implementationDate: {
				gte: start,
				lte: end,
			},
		};

		if (vendor) {
			where.vendor = { contains: vendor, mode: "insensitive" };
		}

		const fcrs = await prismaRPA.fCR.findMany({
			where,
			include: {
				truckingFollowUp: {
					select: {
						jobNumber: true,
						companyName: true,
						operationType: true,
						note: true,
						routineDetail: true,
					},
				},
			},
			orderBy: [{ plateNumber: "asc" }, { pickupAt: "asc" }],
		});

		const rows = fcrs.map((f) => ({
			id: f.id,
			jobNumber: f.truckingFollowUp?.jobNumber || "N/A",
			fcrNumber: f.fcrNumber || "N/A",
			plateNumber: f.plateNumber || "CHƯA CÓ XE",
			shipper: f.shipper || "N/A",
			warehouse: f.warehouse || "N/A",
			grossWeight: f.grossWeight || 0,
			cbm: f.cbm || 0,
			quantity: f.quantity || 0,
			pickupAt: f.pickupAt || "—",
			deliveryAt: f.deliveryAt || "—",
			companyName: f.truckingFollowUp?.companyName || "",
			operationType: f.truckingFollowUp?.operationType || "",
			note: f.truckingFollowUp?.note || "",
			routineDetail: f.truckingFollowUp?.routineDetail || "",
		}));

		return NextResponse.json({ data: rows });
	} catch (error: any) {
		console.error("Daily truck report error:", error);
		return NextResponse.json(
			{ message: "Failed to fetch daily truck report", error: error.message },
			{ status: 500 },
		);
	}
}
