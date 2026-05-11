import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA, queryERPHAN, queryERPHCM } from "@/lib/db";

const UNITS_QUERY = `
WITH Data AS (
    SELECT CAST(ControlCaption AS NVARCHAR(MAX)) AS Caption
    FROM dbo.FormControlList
    WHERE FormId = 'frmLogistics'
      AND ControlId = 'cmbAirfreightBook'
      AND ControlIndex = 3
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

type UnitResult = {
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

		let recordset: UnitResult[] = [];

		// Query appropriate ERP database based on user role
		if (user.role === "SUPERADMIN") {
			const [hcmResult, hanResult] = await Promise.all([
				queryERPHCM<UnitResult>(UNITS_QUERY),
				queryERPHAN<UnitResult>(UNITS_QUERY),
			]);
			recordset = [...hcmResult.recordset, ...hanResult.recordset];
		} else {
			let result;
			switch (user.site) {
				case "SGN":
					result = await queryERPHCM<UnitResult>(UNITS_QUERY);
					break;
				case "HAN":
				case "DAD":
					result = await queryERPHAN<UnitResult>(UNITS_QUERY);
					break;
				default:
					return NextResponse.json(
						{ message: "Invalid user site" },
						{ status: 400 },
					);
			}
			recordset = result.recordset;
		}

		const units = recordset
			.map((row) => row.Item)
			.filter((item) => item && item.trim() !== "");

		return NextResponse.json({ units });
	} catch (error) {
		console.error("Error fetching units:", error);
		return NextResponse.json(
			{ error: "Failed to fetch units" },
			{ status: 500 },
		);
	}
}
