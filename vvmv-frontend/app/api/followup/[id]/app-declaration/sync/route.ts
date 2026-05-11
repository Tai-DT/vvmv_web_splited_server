import { type NextRequest, NextResponse } from "next/server";
import { logFollowUpActivity } from "@/lib/activity-logger";
import { auth } from "@/lib/auth";
import { syncFollowUpDeclarationFromApp } from "@/lib/followup/app-declaration-sync";
import { checkFollowUpPermission } from "@/lib/followup/check-permission";

export const runtime = "nodejs";

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await auth.api.getSession({ headers: req.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { id } = await params;
		const permission = await checkFollowUpPermission(
			id,
			session.user.id,
			session.user.role ?? "",
		);

		if (!permission.ok) {
			return NextResponse.json(
				{ error: permission.error },
				{ status: permission.status },
			);
		}

		const { saved, cargoList, declaration, sourceInfo } =
			await syncFollowUpDeclarationFromApp(id);
		const declarationNumber =
			declaration.declarationNumber ?? saved.declarationNumber ?? null;

		logFollowUpActivity(id, {
			userId: session.user.id,
			userName: session.user.name,
			action: "SYNC_CDS_FROM_APP",
			subResource: "cds_info",
			field: "declarationNumber",
			oldValue: declarationNumber,
			newValue: {
				declarationNumber,
				declarationId: declaration.declarationId,
				sourceInfo,
			},
		});

		return NextResponse.json({
			success: true,
			data: saved,
			cargoList,
			appDeclaration: declaration,
			sourceInfo,
		});
	} catch (error) {
		console.error("Error syncing declaration from app:", error);
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : "Internal Server Error",
			},
			{ status: 500 },
		);
	}
}
