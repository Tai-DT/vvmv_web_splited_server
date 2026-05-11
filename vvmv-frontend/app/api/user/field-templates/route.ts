import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

export async function GET(request: NextRequest) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	try {
		const fieldTemplates = await prismaRPA.fieldTemplate.findMany({
			where: { userId: session.user.id },
			orderBy: { createdAt: "desc" },
		});

		return NextResponse.json(fieldTemplates);
	} catch (error) {
		console.error("Failed to fetch field templates:", error);
		return NextResponse.json(
			{ message: "Failed to fetch field templates" },
			{ status: 500 },
		);
	}
}

export async function POST(request: NextRequest) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { name, selectedFields, fieldData, description } = body;

		if (!name || !selectedFields || !Array.isArray(selectedFields)) {
			return NextResponse.json(
				{ message: "Name and selectedFields are required" },
				{ status: 400 },
			);
		}

		const fieldTemplate = await prismaRPA.fieldTemplate.create({
			data: {
				name: name.trim(),
				selectedFields,
				fieldData: fieldData || null,
				description: description?.trim() || null,
				userId: session.user.id,
			},
		});

		return NextResponse.json(fieldTemplate, { status: 201 });
	} catch (error: any) {
		console.error("Failed to create field template:", error);

		if (error.code === "P2002") {
			return NextResponse.json(
				{ message: "A template with this name already exists" },
				{ status: 409 },
			);
		}

		return NextResponse.json(
			{ message: "Failed to create field template" },
			{ status: 500 },
		);
	}
}
