import { NextResponse } from "next/server";

export async function POST(request: Request) {
	try {
		const body = await request.json();

		const apiKey = process.env.FASTPRO_API_KEY;

		if (!apiKey) {
			return NextResponse.json(
				{
					success: false,
					message: "FASTPRO_API_KEY is not configured in environment variables",
				},
				{ status: 500 },
			);
		}

		const response = await fetch(
			"https://fastpro-api.softek.com.vn/api/v1/fees/check-and-import",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": apiKey,
				},
				body: JSON.stringify(body),
			},
		);

		const data = await response.json();

		return NextResponse.json(data, { status: response.status });
	} catch (error: any) {
		console.error("Error importing fees to ERP:", error);
		return NextResponse.json(
			{
				success: false,
				message:
					error.message || "Internal server error while calling FastPro API",
			},
			{ status: 500 },
		);
	}
}
