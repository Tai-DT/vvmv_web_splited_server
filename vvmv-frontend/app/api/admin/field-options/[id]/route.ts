import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import type { Site } from "@/prisma/client";

// PATCH /api/admin/field-options/[id]
export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const role = session.user.role;
		if (role !== "ADMIN" && role !== "SUPERADMIN") {
			return NextResponse.json({ message: "Forbidden" }, { status: 403 });
		}

		const { id } = await params;
		const body = await request.json();
		const { fieldName, code, name, color, conditions, order, site, isActive } =
			body;

		const existing = await prismaRPA.fieldOption.findUnique({ where: { id } });
		if (!existing) {
			return NextResponse.json(
				{ error: "Option không tồn tại" },
				{ status: 404 },
			);
		}

		const updateData: any = {};
		if (fieldName !== undefined) updateData.fieldName = fieldName;
		if (name !== undefined) updateData.name = name;
		if (code !== undefined) updateData.code = code || null;
		if (color !== undefined) updateData.color = color || null;
		if (conditions !== undefined) {
			if (typeof conditions === "string") {
				updateData.conditions = conditions.trim()
					? JSON.parse(conditions)
					: null;
			} else {
				updateData.conditions = conditions || null;
			}
		}
		if (order !== undefined) updateData.order = order;
		if (site !== undefined) updateData.site = (site as Site) || null;
		if (isActive !== undefined) updateData.isActive = isActive;

		const item = await prismaRPA.fieldOption.update({
			where: { id },
			data: updateData,
		});

		return NextResponse.json({ item });
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

// DELETE /api/admin/field-options/[id]
export async function DELETE(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const role = session.user.role;
		if (role !== "ADMIN" && role !== "SUPERADMIN") {
			return NextResponse.json({ message: "Forbidden" }, { status: 403 });
		}

		const { id } = await params;

		const existing = await prismaRPA.fieldOption.findUnique({ where: { id } });
		if (!existing) {
			return NextResponse.json(
				{ error: "Option không tồn tại" },
				{ status: 404 },
			);
		}

		await prismaRPA.fieldOption.delete({ where: { id } });

		return NextResponse.json({ success: true });
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
