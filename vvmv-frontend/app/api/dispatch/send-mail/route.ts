import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendGroupedDispatchMails } from "@/lib/trucking/dispatch-mail";

/**
 * POST /api/dispatch/send-mail
 * Body: { truckingNumberId: string, date: string, tripNumber?: number }
 */
export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { truckingNumberId, date, tripNumber, items, columnsOrder } =
			await request.json();

		const tokenResult = await auth.api.getAccessToken({
			headers: request.headers,
			body: {
				providerId: "google",
			},
		});

		const accessToken = tokenResult?.accessToken;

		if (!accessToken) {
			return NextResponse.json(
				{
					message:
						"No Google access token available. Please sign in with Google again.",
				},
				{ status: 401 },
			);
		}

		const inputItems = Array.isArray(items)
			? items
			: [{ truckingNumberId, date, tripNumber }];

		// Filter out invalid inputs
		const validItems = inputItems.filter((i) => i.truckingNumberId && i.date);
		if (validItems.length === 0) {
			return NextResponse.json(
				{ message: "No valid items to send" },
				{ status: 400 },
			);
		}

		const results = await sendGroupedDispatchMails({
			items: validItems,
			accessToken,
			userEmail: session.user.email,
			columnsOrder,
		});

		if (Array.isArray(items)) {
			return NextResponse.json({ results });
		} else {
			const result = results[0];
			if (!result?.success) {
				return NextResponse.json(
					{ message: result?.message || "Failed" },
					{ status: 422 },
				);
			}
			return NextResponse.json(result);
		}
	} catch (error) {
		console.error("Send mail API error:", error);
		return NextResponse.json(
			{
				message: "Server error",
				error: error instanceof Error ? error.message : "Unknown",
			},
			{ status: 500 },
		);
	}
}
