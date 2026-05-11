import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA, queryERPHAN, queryERPHCM } from "@/lib/db";

const CONTAINER_SIZES_QUERY = `
SELECT UnitId
FROM UnitContents
WHERE LocalUnitVAT LIKE 'CONT %'
   OR Notes = 'CONTAINER'
   OR [Description] = ''
   OR UnitId LIKE '20´%'
   OR UnitId LIKE '40´%'
`;

type ContainerSizeResult = {
	UnitId: string;
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

		let recordset: ContainerSizeResult[] = [];

		// Query appropriate ERP database based on user role
		if (user.role === "SUPERADMIN") {
			const [hcmResult, hanResult] = await Promise.all([
				queryERPHCM<ContainerSizeResult>(CONTAINER_SIZES_QUERY),
				queryERPHAN<ContainerSizeResult>(CONTAINER_SIZES_QUERY),
			]);
			recordset = [...hcmResult.recordset, ...hanResult.recordset];
		} else {
			let result;
			switch (user.site) {
				case "SGN":
					result = await queryERPHCM<ContainerSizeResult>(
						CONTAINER_SIZES_QUERY,
					);
					break;
				case "HAN":
				case "DAD":
					result = await queryERPHAN<ContainerSizeResult>(
						CONTAINER_SIZES_QUERY,
					);
					break;
				default:
					return NextResponse.json(
						{ message: "Invalid user site" },
						{ status: 400 },
					);
			}
			recordset = result.recordset;
		}

		// Deduplicate by UnitId (keep first occurrence)
		const seen = new Set<string>();
		const containerSizes = recordset
			.filter((row) => {
				if (!row.UnitId || row.UnitId.trim() === "") return false;
				const id = row.UnitId.trim();
				if (seen.has(id)) return false;
				seen.add(id);
				return true;
			})
			.map((row) => row.UnitId.trim());

		return NextResponse.json({ containerSizes });
	} catch (error) {
		console.error("Error fetching container sizes:", error);
		return NextResponse.json(
			{ error: "Failed to fetch container sizes" },
			{ status: 500 },
		);
	}
}
