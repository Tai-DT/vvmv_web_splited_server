import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

export async function POST(request: NextRequest) {
	try {
		// Get the authenticated session
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { site, erpAccount } = await request.json();

		// Validate site value
		const validSites = ["SGN", "DAD", "HAN"];
		if (!site || !validSites.includes(site)) {
			return NextResponse.json(
				{ message: "Invalid site value" },
				{ status: 400 },
			);
		}

		// Validate erpAccount (required for non-CUSTOMER users)
		if (
			!erpAccount ||
			typeof erpAccount !== "string" ||
			erpAccount.trim() === ""
		) {
			return NextResponse.json(
				{ message: "Invalid or missing ERP account" },
				{ status: 400 },
			);
		}

		// Check if user already has a site selected (prevent changes)
		const user = await prismaRPA.user.findUnique({
			where: { id: session.user.id },
		});

		if (user?.site && user?.erpAccount) {
			return NextResponse.json(
				{
					message:
						"Site and ERP account have already been selected and cannot be changed",
				},
				{ status: 400 },
			);
		}

		// Update user's site and erpAccount
		const updatedUser = await prismaRPA.user.update({
			where: { id: session.user.id },
			data: {
				site,
				erpAccount: erpAccount.trim(),
			},
		});

		return NextResponse.json(
			{
				message: "Site and ERP account updated successfully",
				user: updatedUser,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error("Error updating site and ERP account:", error);
		return NextResponse.json(
			{ message: "Failed to update site and ERP account" },
			{ status: 500 },
		);
	}
}
