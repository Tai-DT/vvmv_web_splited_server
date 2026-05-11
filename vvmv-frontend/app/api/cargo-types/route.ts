import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA, queryERPHAN } from "@/lib/db";

const CARGO_TYPES_QUERY = `
WITH Data AS (
    SELECT CAST(ControlCaption AS NVARCHAR(MAX)) AS Caption
    FROM dbo.FormControlList
    WHERE FormId = 'frmLogistics'
      AND ControlId = 'cmbAirfreightBook'
      AND ControlIndex = 5
),
Tally AS (
    SELECT TOP (LEN((SELECT Caption FROM Data)))
           ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS N
    FROM master..spt_values
)
SELECT LTRIM(RTRIM(
         SUBSTRING(Caption,
                   N,
                   CHARINDEX(';', Caption + ';', N) - N)
       )) AS Item
FROM Data
CROSS JOIN Tally
WHERE N = 1
   OR SUBSTRING(Caption, N - 1, 1) = ';'
ORDER BY N;
`;

type CargoTypeResult = {
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

		const SGN_HARDCODED = [
			" ",
			"NPL",
			"SP",
			"MMTB",
			"CCDC",
			"PTTT",
			"KBHC",
			"TC",
			"GPTC",
			"TIỀN CHẤT",
			"KDTV",
			"KDDV",
			"ATTP",
			"PHYTO XK",
			"THÉP",
			"KHÁC",
		];

		let recordset: CargoTypeResult[] = [];

		// Query appropriate ERP database based on user role
		if (user.role === "SUPERADMIN") {
			const hanResult = await queryERPHAN<CargoTypeResult>(CARGO_TYPES_QUERY);
			const hanTypes = hanResult.recordset.map((r) => r.Item);
			const combined = Array.from(new Set([...SGN_HARDCODED, ...hanTypes]));
			return NextResponse.json({ cargoTypes: combined });
		} else {
			let result;
			switch (user.site) {
				case "SGN":
					return NextResponse.json({ cargoTypes: SGN_HARDCODED });
				case "HAN":
				case "DAD":
					result = await queryERPHAN<CargoTypeResult>(CARGO_TYPES_QUERY);
					break;
				default:
					return NextResponse.json(
						{ message: "Invalid user site" },
						{ status: 400 },
					);
			}
			recordset = result.recordset;
		}

		const cargoTypes = recordset
			.map((row) => row.Item)
			.filter((item) => item && item.trim() !== "");

		return NextResponse.json({ cargoTypes });
	} catch (error) {
		console.error("Error fetching cargo types:", error);
		return NextResponse.json(
			{ error: "Failed to fetch cargo types" },
			{ status: 500 },
		);
	}
}
