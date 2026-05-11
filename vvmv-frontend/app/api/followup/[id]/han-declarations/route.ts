import { type NextRequest, NextResponse } from "next/server";
import type { FollowUpCdsInfoRow } from "@/app/(home)/internal/followup/types";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { buildCdsHanFieldComparisonSummary } from "@/lib/followup/cds-han-compare";
import { checkFollowUpPermission } from "@/lib/followup/check-permission";
import {
	getHanConnectionPublicInfo,
	resolveHanConnectionForTaxCode,
} from "@/lib/followup/han-connection";
import { loadHanNewImportCandidates } from "@/lib/followup/han-declaration-loader";

export const runtime = "nodejs";

export async function GET(
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
			{ mode: "read" },
		);

		if (!permission.ok) {
			return NextResponse.json(
				{ error: permission.error },
				{ status: permission.status },
			);
		}

		const followUp = await prismaRPA.followUp.findUnique({
			where: { id },
			select: {
				taxCode: true,
				companyName: true,
				operationType: true,
				domain: true,
			},
		});

		if (!followUp) {
			return NextResponse.json(
				{ error: "Follow-up not found" },
				{ status: 404 },
			);
		}

		const current = await prismaRPA.followUpCdsInfo.findUnique({
			where: { followUpId: id },
		});
		const currentCdsInfo =
			current as unknown as Partial<FollowUpCdsInfoRow> | null;
		const companyTaxCode = currentCdsInfo?.importerCode ?? followUp.taxCode;

		const hanConnection = await resolveHanConnectionForTaxCode({
			taxCode: companyTaxCode,
			taxCodeCandidates: [followUp.taxCode],
			site: followUp.domain,
		});
		const hanConnectionInfo = getHanConnectionPublicInfo(hanConnection);
		const candidates = await loadHanNewImportCandidates({
			connectionString: hanConnection.connectionString,
			limit: 8,
			taxCode: companyTaxCode,
			operationType: followUp.operationType,
		});

		const candidateWithDiffs = candidates.map((candidate) => ({
			...candidate,
			comparison: buildCdsHanFieldComparisonSummary(
				currentCdsInfo ?? {},
				candidate.prefill,
			),
		}));

		return NextResponse.json({
			success: true,
			data: {
				followUp: {
					taxCode: followUp.taxCode,
					companyName: followUp.companyName,
					operationType: followUp.operationType,
				},
				hanConnection: hanConnectionInfo,
				candidates: candidateWithDiffs,
			},
		});
	} catch (error) {
		console.error("Error loading HAN declaration candidates:", error);
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : "Internal Server Error",
			},
			{ status: 500 },
		);
	}
}
