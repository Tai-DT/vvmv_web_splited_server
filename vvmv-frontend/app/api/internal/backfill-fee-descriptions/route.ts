import { NextResponse } from "next/server";
import { prismaRPA, queryERPHAN, queryERPHCM } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
	try {
		console.log("Starting backfill for fee descriptions...");

		const feeTypes = await prismaRPA.vendorFeeType.findMany();

		console.log(`Found ${feeTypes.length} records to update.`);

		const sgnFees = feeTypes.filter((f) => f.site === "SGN");
		const hanFees = feeTypes.filter((f) => f.site !== "SGN");

		const query = `
      SELECT FeeCode, FeeDescEn
      FROM NameFeeDescription
      WHERE FeeCode IS NOT NULL
    `;

		// Fetch from SGN (HCM)
		const sgnMap = new Map<string, string>();
		if (sgnFees.length > 0) {
			console.log("Fetching descriptions from HCM ERP...");
			const res = await queryERPHCM<{ FeeCode: string; FeeDescEn: string }>(
				query,
			);
			res.recordset.forEach((r) =>
				sgnMap.set(r.FeeCode.trim(), r.FeeDescEn.trim()),
			);
		}

		// Fetch from HAN/DAD
		const hanMap = new Map<string, string>();
		if (hanFees.length > 0) {
			console.log("Fetching descriptions from HAN ERP...");
			const res = await queryERPHAN<{ FeeCode: string; FeeDescEn: string }>(
				query,
			);
			res.recordset.forEach((r) =>
				hanMap.set(r.FeeCode.trim(), r.FeeDescEn.trim()),
			);
		}

		let updatedCount = 0;
		let fallbackCount = 0;

		for (const fee of feeTypes) {
			const code = fee.feeCode?.trim();
			if (!code) continue;

			const map = fee.site === "SGN" ? sgnMap : hanMap;
			const desc = map.get(code);

			if (desc) {
				await prismaRPA.vendorFeeType.update({
					where: { id: fee.id },
					data: { feeDescription: desc },
				});
				updatedCount++;
			} else {
				fallbackCount++;
			}
		}

		return NextResponse.json({
			message: "Backfill status",
			total: feeTypes.length,
			alreadyFilled: feeTypes.filter((f) => f.feeDescription).length,
			missingDescription: feeTypes.filter((f) => !f.feeDescription).length,
			updatedThisRound: updatedCount,
			notFoundInERP: fallbackCount,
			samples: feeTypes.slice(0, 10).map((f) => ({
				code: f.feeCode,
				site: f.site,
				hasDesc: !!f.feeDescription,
			})),
		});
	} catch (error: any) {
		console.error("Backfill failed:", error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
