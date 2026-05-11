import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { tryDelegateToStandaloneApi } from "@/lib/proxy-backend";

export async function GET(request: NextRequest) {
	const delegated = await tryDelegateToStandaloneApi(
		request,
		"table-preferences",
	);
	if (delegated) return delegated;

	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	const tableKey = request.nextUrl.searchParams.get("tableKey");
	if (!tableKey) {
		return NextResponse.json(
			{ message: "tableKey is required" },
			{ status: 400 },
		);
	}

	try {
		const pref = await prismaRPA.tablePreference.findUnique({
			where: {
				userId_tableKey: {
					userId: session.user.id,
					tableKey,
				},
			},
		});

		return NextResponse.json({ preferences: pref?.preferences ?? null });
	} catch (error) {
		console.error("Failed to fetch table preference:", error);
		return NextResponse.json(
			{ message: "Failed to fetch table preference" },
			{ status: 500 },
		);
	}
}

export async function PUT(request: NextRequest) {
	const delegated = await tryDelegateToStandaloneApi(
		request,
		"table-preferences",
	);
	if (delegated) return delegated;

	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	try {
		const { tableKey, preferences } = await request.json();

		if (!tableKey || preferences === undefined) {
			return NextResponse.json(
				{ message: "tableKey and preferences are required" },
				{ status: 400 },
			);
		}

		const pref = await prismaRPA.tablePreference.upsert({
			where: {
				userId_tableKey: {
					userId: session.user.id,
					tableKey,
				},
			},
			update: { preferences },
			create: {
				userId: session.user.id,
				tableKey,
				preferences,
			},
		});

		return NextResponse.json(pref);
	} catch (error) {
		console.error("Failed to save table preference:", error);
		return NextResponse.json(
			{ message: "Failed to save table preference" },
			{ status: 500 },
		);
	}
}
