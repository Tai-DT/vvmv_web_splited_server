import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import type { Site } from "@/prisma/client";

// Lookup plateNumber → truckingNumber fields from TruckingNumber table
export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const plateNumber = request.nextUrl.searchParams.get("plateNumber")?.trim();
		if (!plateNumber) {
			return NextResponse.json(
				{ message: "plateNumber is required" },
				{ status: 400 },
			);
		}

		const user = await prismaRPA.user.findUnique({
			where: { id: session.user.id },
			select: { site: true },
		});

		const record = await prismaRPA.truckingNumber.findFirst({
			where: {
				plateNumber: { equals: plateNumber, mode: "insensitive" },
				site: user?.site ? (user.site as Site) : undefined,
			},
			select: {
				id: true,
				driverName: true,
				vehicleType: true,
				vendorName: true,
			},
		});

		return NextResponse.json({ record: record ?? null });
	} catch (error) {
		console.error("Trucking number lookup error:", error);
		return NextResponse.json(
			{ message: "Internal server error" },
			{ status: 500 },
		);
	}
}
