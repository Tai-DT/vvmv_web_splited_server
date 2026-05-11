import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA, queryERPHAN, queryERPHCM } from "@/lib/db";

const TRUCK_TYPES_QUERY = `
  SELECT UNITID as Item
  FROM UnitContents
  WHERE (UNITID like '0%' OR UNITID like '1%' OR UNITID like '2%' OR UNITID like '3%' 
         OR UNITID like '4%' OR UNITID like '5%' OR UNITID like '6%' OR UNITID like '7%' 
         OR UNITID like '8%' OR UNITID like 'DONGKIEN%' OR UNITID like 'GRAB%' OR UNITID like 'XECAU%' OR UNITID like 'XENANG%') 
  ORDER BY UNITID
`;

type TruckTypeResult = {
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

		let recordset: TruckTypeResult[] = [];

		// Query appropriate ERP database based on user role/site
		if (user.role === "SUPERADMIN") {
			const [hcmResult, hanResult] = await Promise.all([
				queryERPHCM<TruckTypeResult>(TRUCK_TYPES_QUERY),
				queryERPHAN<TruckTypeResult>(TRUCK_TYPES_QUERY),
			]);
			recordset = [...hcmResult.recordset, ...hanResult.recordset];
		} else {
			let result;
			switch (user.site) {
				case "SGN":
					result = await queryERPHCM<TruckTypeResult>(TRUCK_TYPES_QUERY);
					break;
				case "HAN":
				case "DAD":
					result = await queryERPHAN<TruckTypeResult>(TRUCK_TYPES_QUERY);
					break;
				default:
					return NextResponse.json(
						{ message: "Invalid user site" },
						{ status: 400 },
					);
			}
			recordset = result.recordset;
		}

		// Map to simple array and remove duplicates
		const truckTypes = Array.from(
			new Set(
				recordset
					.map((row) => row.Item)
					.filter((item) => item && item.trim() !== ""),
			),
		);

		return NextResponse.json({ truckTypes });
	} catch (error) {
		console.error("Error fetching truck types:", error);
		return NextResponse.json(
			{ error: "Failed to fetch truck types" },
			{ status: 500 },
		);
	}
}
