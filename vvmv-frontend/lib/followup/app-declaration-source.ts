import type { FollowUpCdsInfoRow } from "@/app/(home)/internal/followup/types";
import {
	getHanConnectionPublicInfo,
	resolveHanConnectionForTaxCode,
} from "@/lib/followup/han-connection";
import {
	type HanDeclarationPrefillMatch,
	loadHanDeclarationPrefillByNumber,
} from "@/lib/followup/han-declaration-loader";
import type { Site } from "@/prisma/client";

export type AppDeclarationSourceInfo = ReturnType<
	typeof getHanConnectionPublicInfo
>;

function clean(value: unknown) {
	const text = String(value ?? "").trim();
	return text || null;
}

function normalizeTaxCode(value: unknown) {
	const text = String(value ?? "").replace(/\D+/g, "");
	return text || null;
}

export async function loadAppDeclarationByNumber(options: {
	declarationNumber: string;
	cdsInfo?: Partial<FollowUpCdsInfoRow> | null;
	followUpTaxCode?: string | null;
	site?: Site | null;
}) {
	const declarationNumber = clean(options.declarationNumber);
	if (!declarationNumber) {
		throw new Error("Thiếu số tờ khai để đồng bộ từ app.");
	}

	const connection = await resolveHanConnectionForTaxCode({
		taxCode:
			normalizeTaxCode(options.cdsInfo?.importerCode) ??
			options.followUpTaxCode,
		taxCodeCandidates: [options.followUpTaxCode],
		site: options.site,
	});
	const declaration = await loadHanDeclarationPrefillByNumber({
		connectionString: connection.connectionString,
		declarationNumber,
	});

	return {
		declaration: declaration as HanDeclarationPrefillMatch | null,
		sourceInfo: getHanConnectionPublicInfo(connection),
	};
}
