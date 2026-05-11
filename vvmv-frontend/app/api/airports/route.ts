import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA, queryERPHAN, queryERPHCM } from "@/lib/db";

const AIRPORTS_QUERY = `SELECT AirPortID, AirPortName FROM Airports`;

type AirportResult = {
	AirPortID: string;
	AirPortName: string;
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

		let recordset: AirportResult[] = [];

		// Query appropriate ERP database based on user role
		if (user.role === "SUPERADMIN") {
			const [hcmResult, hanResult] = await Promise.all([
				queryERPHCM<AirportResult>(AIRPORTS_QUERY),
				queryERPHAN<AirportResult>(AIRPORTS_QUERY),
			]);
			recordset = [...hcmResult.recordset, ...hanResult.recordset];
		} else {
			let result;
			switch (user.site) {
				case "SGN":
					result = await queryERPHCM<AirportResult>(AIRPORTS_QUERY);
					break;
				case "HAN":
				case "DAD":
					result = await queryERPHAN<AirportResult>(AIRPORTS_QUERY);
					break;
				default:
					return NextResponse.json(
						{ message: "Invalid user site" },
						{ status: 400 },
					);
			}
			recordset = result.recordset;
		}

		// Deduplicate by AirPortID (keep first occurrence)
		const seen = new Set<string>();
		const airports = recordset
			.filter((row) => {
				if (!row.AirPortID || row.AirPortID.trim() === "") return false;
				const id = row.AirPortID.trim();
				if (seen.has(id)) return false;
				seen.add(id);
				return true;
			})
			.map((row) => ({
				id: row.AirPortID.trim(),
				name: row.AirPortName?.trim() || row.AirPortID.trim(),
			}));

		return NextResponse.json({ airports });
	} catch (error) {
		console.error("Error fetching airports:", error);
		return NextResponse.json(
			{ error: "Failed to fetch airports" },
			{ status: 500 },
		);
	}
}
