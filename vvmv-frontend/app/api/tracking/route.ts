import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { tryDelegateToStandaloneApi } from "@/lib/proxy-backend";

export async function GET(request: NextRequest) {
	const delegated = await tryDelegateToStandaloneApi(request, "tracking");
	if (delegated) return delegated;

	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { searchParams } = new URL(request.url);
	const deliveryNumber = searchParams.get("deliveryNumber");
	const limit = parseInt(searchParams.get("limit") || "100", 10);
	const offset = parseInt(searchParams.get("offset") || "0", 10);

	try {
		const where = deliveryNumber
			? { deliveryNumber: { contains: deliveryNumber } }
			: {};

		const [items, total] = await Promise.all([
			prismaRPA.tracking.findMany({
				where,
				orderBy: { updatedAt: "desc" },
				take: limit,
				skip: offset,
			}),
			prismaRPA.tracking.count({ where }),
		]);

		return NextResponse.json({ items, total });
	} catch (error) {
		console.error("Fetch tracking error:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 },
		);
	}
}

export async function POST(request: NextRequest) {
	const delegated = await tryDelegateToStandaloneApi(request, "tracking");
	if (delegated) return delegated;

	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const { items } = await request.json();

		if (!Array.isArray(items)) {
			return NextResponse.json(
				{ error: "Invalid data format" },
				{ status: 400 },
			);
		}

		// Process items in a transaction or bulk create
		// Since we don't have a unique key other than ID (and deliveryNumber is not unique now),
		// we might want to distinguish between new items and updates if IDs are provided.

		const operations = items.map((item: any) => {
			const { id, createdAt, updatedAt, ...data } = item;

			// Parse dates and numbers correctly
			if (data.time) data.time = new Date(data.time);
			if (data.dateSend) data.dateSend = new Date(data.dateSend);
			if (data.totalBox) data.totalBox = parseFloat(data.totalBox);
			if (data.weight) data.weight = parseFloat(data.weight);

			if (id && id.length > 10) {
				// Simple check for UUID
				return prismaRPA.tracking.update({
					where: { id },
					data,
				});
			} else {
				return prismaRPA.tracking.create({
					data: {
						...data,
						createdBy: session.user.id,
					},
				});
			}
		});

		// Run in chunks to avoid transaction limits if needed
		await prismaRPA.$transaction(operations);

		return NextResponse.json({ success: true, count: items.length });
	} catch (error) {
		console.error("Update tracking error:", error);
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : "Internal Server Error",
			},
			{ status: 500 },
		);
	}
}

export async function DELETE(request: NextRequest) {
	const delegated = await tryDelegateToStandaloneApi(request, "tracking");
	if (delegated) return delegated;

	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const { ids } = await request.json();

		if (!Array.isArray(ids)) {
			return NextResponse.json(
				{ error: "Invalid data format" },
				{ status: 400 },
			);
		}

		await prismaRPA.tracking.deleteMany({
			where: {
				id: { in: ids },
			},
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Delete tracking error:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 },
		);
	}
}
