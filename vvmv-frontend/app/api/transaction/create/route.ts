import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { createErpTransaction } from "@/lib/erp/transaction-service";

/**
 * POST /api/followup/create-transaction
 * Creates a transaction in the ERP system based on operation type
 */
export async function POST(request: NextRequest) {
	try {
		// 1. Get user session
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		// 2. Get user info from database
		const dbUser = await prismaRPA.user.findUnique({
			where: { id: session.user.id },
			select: { site: true, erpAccount: true, username: true },
		});

		if (!dbUser) {
			return NextResponse.json({ message: "User not found" }, { status: 404 });
		}

		const userAccount = dbUser.erpAccount || dbUser.username;
		if (!userAccount) {
			return NextResponse.json(
				{ message: "User does not have an ERP account or username configured" },
				{ status: 400 },
			);
		}

		if (!dbUser.site) {
			return NextResponse.json(
				{ message: "User site not configured" },
				{ status: 400 },
			);
		}

		// 3. Parse request body
		const body = await request.json();
		const { operationType, taxCode, hwbno } = body;

		// 4. Validate required fields
		if (!operationType || !taxCode) {
			return NextResponse.json(
				{ message: "Missing required fields: operationType, taxCode" },
				{ status: 400 },
			);
		}

		// 5. Create transaction using shared service
		const result = await createErpTransaction({
			operationType,
			taxCode,
			hwbno,
			site: dbUser.site,
			erpAccount: userAccount,
		});

		// 6. Return response
		return NextResponse.json(
			{
				success: true,
				transID: result.NEW_FILE_NO,
				hwbno: result.HWBNO,
				customerCode: result.CUSTOMER_CODE,
				customerName: result.CUSTOMER_NAME,
				site: result.erpSite,
				serviceType: result.serviceType,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("Internal Transaction creation error:", error);

		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";

		return NextResponse.json(
			{
				message: errorMessage,
				error: errorMessage,
			},
			{ status: 500 },
		);
	}
}
