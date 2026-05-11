import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

/**
 * POST /api/trucking-followup/container/link-declaration
 * Tạo liên kết Container ↔ Declaration
 * Body: { containerId: string; declarationId: string }
 */
export async function POST(req: NextRequest) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await req.json();
		const { containerId, declarationId } = body as {
			containerId?: string;
			declarationId?: string;
		};

		if (!containerId || !declarationId) {
			return NextResponse.json(
				{ error: "containerId and declarationId are required" },
				{ status: 400 },
			);
		}

		// Verify container exists
		const container = await prismaRPA.container.findUnique({
			where: { id: containerId },
			select: { id: true, containerNo: true },
		});
		if (!container) {
			return NextResponse.json(
				{ error: "Container not found" },
				{ status: 404 },
			);
		}

		// Verify declaration exists
		const declaration = await prismaRPA.declaration.findUnique({
			where: { id: declarationId },
			select: { id: true, declarationNumber: true },
		});
		if (!declaration) {
			return NextResponse.json(
				{ error: "Declaration not found" },
				{ status: 404 },
			);
		}

		// Upsert to avoid duplicate error
		const link = await prismaRPA.containerDeclaration.upsert({
			where: {
				containerId_declarationId: { containerId, declarationId },
			},
			create: { containerId, declarationId },
			update: {}, // already exists — no-op
		});

		return NextResponse.json({ success: true, link });
	} catch (error) {
		console.error("Link declaration error:", error);
		return NextResponse.json(
			{ error: "Failed to link declaration" },
			{ status: 500 },
		);
	}
}

/**
 * DELETE /api/trucking-followup/container/link-declaration
 * Xóa liên kết Container ↔ Declaration
 * Body: { containerId: string; declarationId: string }
 */
export async function DELETE(req: NextRequest) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await req.json();
		const { containerId, declarationId } = body as {
			containerId?: string;
			declarationId?: string;
		};

		if (!containerId || !declarationId) {
			return NextResponse.json(
				{ error: "containerId and declarationId are required" },
				{ status: 400 },
			);
		}

		await prismaRPA.containerDeclaration.delete({
			where: {
				containerId_declarationId: { containerId, declarationId },
			},
		});

		return NextResponse.json({ success: true });
	} catch (error: any) {
		// P2025 = record not found
		if (error?.code === "P2025") {
			return NextResponse.json({ error: "Link not found" }, { status: 404 });
		}
		console.error("Unlink declaration error:", error);
		return NextResponse.json(
			{ error: "Failed to unlink declaration" },
			{ status: 500 },
		);
	}
}
