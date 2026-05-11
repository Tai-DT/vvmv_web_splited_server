import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA, queryERPHAN, queryERPHCM } from "@/lib/db";

const VEHICLES_QUERY = `
  SELECT VHUnitNo as Item
  FROM dbo.VehicleList
  WHERE VHUnitNo IS NOT NULL AND LTRIM(RTRIM(VHUnitNo)) <> ''
  ORDER BY VHUnitNo
`;

type VehicleResult = {
	Item: string;
};

export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		// Fetch user's site from database
		const user = await prismaRPA.user.findUnique({
			where: { id: session.user.id },
			select: { site: true, role: true },
		});

		if (!user?.site) {
			return NextResponse.json(
				{ message: "User site not configured" },
				{ status: 400 },
			);
		}

		let recordset: VehicleResult[] = [];

		// Query appropriate ERP database based on user role/site
		if (user.role === "SUPERADMIN") {
			const [hcmResult, hanResult] = await Promise.all([
				queryERPHCM<VehicleResult>(VEHICLES_QUERY),
				queryERPHAN<VehicleResult>(VEHICLES_QUERY),
			]);
			recordset = [...hcmResult.recordset, ...hanResult.recordset];
		} else {
			let result;
			switch (user.site) {
				case "SGN":
					result = await queryERPHCM<VehicleResult>(VEHICLES_QUERY);
					break;
				case "HAN":
				case "DAD":
					result = await queryERPHAN<VehicleResult>(VEHICLES_QUERY);
					break;
				default:
					return NextResponse.json(
						{ message: "Invalid user site" },
						{ status: 400 },
					);
			}
			recordset = result.recordset;
		}

		// Map to simple array and remove duplicates (if any from SUPERADMIN merging)
		const vehicles = Array.from(
			new Set(
				recordset
					.map((row) => row.Item)
					.filter((item) => item && item.trim() !== ""),
			),
		);

		return NextResponse.json({ vehicles });
	} catch (error) {
		console.error("Error fetching vehicles:", error);
		return NextResponse.json(
			{ error: "Failed to fetch vehicles" },
			{ status: 500 },
		);
	}
}
