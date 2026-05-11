import { queryERPHAN, queryERPHCM } from "@/lib/db";
import type { Site } from "@/prisma/client";

export interface FeeDescription {
	feeCode: string;
	feeDescEn: string;
}

const QUERY = `
  SELECT FeeCode as feeCode, FeeDescEn as feeDescEn
  FROM NameFeeDescription
  WHERE FeeCode IS NOT NULL AND LTRIM(RTRIM(FeeCode)) <> ''
  ORDER BY FeeCode
`;

export async function getFeeDescriptions(
	site: Site,
): Promise<FeeDescription[]> {
	const erpQuery = site === "SGN" ? queryERPHCM : queryERPHAN;
	const result = await erpQuery<FeeDescription>(QUERY);
	return result.recordset || [];
}
