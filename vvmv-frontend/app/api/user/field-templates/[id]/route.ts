import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	try {
		const { id } = await params;
		const body = await request.json();
		const { name, selectedFields, fieldData, description } = body;

		const template = await prismaRPA.fieldTemplate.findFirst({
			where: { id, userId: session.user.id },
		});

		if (!template) {
			return NextResponse.json(
				{ message: "Template not found or access denied" },
				{ status: 404 },
			);
		}

		const updatedTemplate = await prismaRPA.fieldTemplate.update({
			where: { id },
			data: {
				...(name && { name: name.trim() }),
				...(selectedFields && { selectedFields }),
				...(fieldData !== undefined && { fieldData }),
				...(description !== undefined && {
					description: description?.trim() || null,
				}),
			},
		});

		return NextResponse.json(updatedTemplate);
	} catch (error: any) {
		console.error("Failed to update field template:", error);

		if (error.code === "P2002") {
			return NextResponse.json(
				{ message: "A template with this name already exists" },
				{ status: 409 },
			);
		}

		return NextResponse.json(
			{ message: "Failed to update field template" },
			{ status: 500 },
		);
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	try {
		const { id } = await params;

		const template = await prismaRPA.fieldTemplate.findFirst({
			where: { id, userId: session.user.id },
		});

		if (!template) {
			return NextResponse.json(
				{ message: "Template not found or access denied" },
				{ status: 404 },
			);
		}

		await prismaRPA.fieldTemplate.delete({
			where: { id },
		});

		return NextResponse.json({ message: "Template deleted successfully" });
	} catch (error) {
		console.error("Failed to delete field template:", error);
		return NextResponse.json(
			{ message: "Failed to delete field template" },
			{ status: 500 },
		);
	}
}
