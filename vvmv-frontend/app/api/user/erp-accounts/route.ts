import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryERPHAN, queryERPHCM } from "@/lib/db";

const CONTACTS_LIST_QUERY = `
  SELECT Username
  FROM ContactsList
  WHERE Username IS NOT NULL AND Username <> ''
  ORDER BY Username
`;

type ContactsListResult = {
	Username: string;
};

export async function GET(request: NextRequest) {
	try {
		// Get the authenticated session
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		// Get site from query parameter (not from user record, since we're in onboarding)
		const { searchParams } = new URL(request.url);
		const site = searchParams.get("site");

		// Validate site value
		const validSites = ["SGN", "DAD", "HAN"];
		if (!site || !validSites.includes(site)) {
			return NextResponse.json(
				{ message: "Invalid or missing site parameter" },
				{ status: 400 },
			);
		}

		let result;

		// Query appropriate ERP database based on site
		switch (site) {
			case "SGN":
				result = await queryERPHCM<ContactsListResult>(CONTACTS_LIST_QUERY);
				break;
			case "HAN":
			case "DAD":
				result = await queryERPHAN<ContactsListResult>(CONTACTS_LIST_QUERY);
				break;
			default:
				return NextResponse.json(
					{ message: "Invalid site value" },
					{ status: 400 },
				);
		}

		// Extract and clean usernames
		const accounts = result.recordset
			.map((row) => row.Username?.trim())
			.filter((username): username is string => !!username && username !== "");

		// Remove duplicates and sort
		const uniqueAccounts = Array.from(new Set(accounts)).sort();

		return NextResponse.json({
			accounts: uniqueAccounts,
			site,
		});
	} catch (error) {
		console.error("Error fetching ERP accounts:", error);
		return NextResponse.json(
			{
				error: "Failed to fetch ERP accounts",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
