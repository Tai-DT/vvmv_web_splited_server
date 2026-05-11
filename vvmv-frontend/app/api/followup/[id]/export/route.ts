import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { CdsExportValidationError } from "@/lib/followup/cds-export-validation";
import { checkFollowUpPermission } from "@/lib/followup/check-permission";
import { exportCustomsDeclaration } from "@/lib/followup/export-excel";

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await auth.api.getSession({
			headers: req.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { id } = await params;
		const permission = await checkFollowUpPermission(
			id,
			session.user.id,
			session.user.role ?? "",
			{ mode: "read" },
		);

		if (!permission.ok) {
			return NextResponse.json(
				{ error: permission.error },
				{ status: permission.status },
			);
		}

		const exported = await exportCustomsDeclaration(id);
		const { buffer, extension, fileName } = exported;

		// Using new Response with body buffer for ArrayBuffer output in Next.js
		const response = new NextResponse(new Uint8Array(buffer));
		response.headers.set(
			"Content-Type",
			extension === "xls"
				? "application/vnd.ms-excel"
				: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		);
		response.headers.set(
			"Content-Disposition",
			`attachment; filename="${fileName}"`,
		);

		return response;
	} catch (error) {
		console.error("[EXPORT_EXCEL_ERROR]", error);

		if (error instanceof CdsExportValidationError) {
			return NextResponse.json(
				{
					error: error.message,
					issues: error.issues,
				},
				{ status: 422 },
			);
		}

		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : "Internal Server Error",
			},
			{ status: 500 },
		);
	}
}
