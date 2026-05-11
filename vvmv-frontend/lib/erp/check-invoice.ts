import { queryERPHAN, queryERPHCM } from "@/lib/db";

/**
 * Checks whether a job number has already had customer invoices issued.
 *
 * The check counts:
 * 1. ProfitShares rows linked to the job's HWBNOs where:
 *    - obh = 0, DPT = 1, KBck = 0, and Docs IS NOT NULL (thu khách)
 * 2. SellingRate rows linked to the job's HWBNOs where:
 *    - docno IS NOT NULL (đã xuất hóa đơn bán)
 *
 * Returns `true` when the total count > 0 (đã xuất hóa đơn).
 */
const QUERY = `
SELECT
  (
    SELECT COUNT(*)
    FROM ProfitShares
    WHERE HAWBNO IN (
      SELECT HWBNO FROM TransactionDetails WHERE Transid = @job
    )
    AND obh = 0
    AND DPT = 1
    AND KBck = 0
    AND Docs IS NOT NULL AND LTRIM(RTRIM(Docs)) <> ''
  )
  +
  (
    SELECT COUNT(*)
    FROM SellingRate
    WHERE HAWBNO IN (
      SELECT HWBNO FROM TransactionDetails WHERE Transid = @job
    )
    AND docno IS NOT NULL AND LTRIM(RTRIM(docno)) <> ''
  ) AS TotalCount
`;

export interface CheckInvoiceResult {
	jobNumber: string;
	hasInvoice: boolean;
	totalCount: number;
}

/**
 * Determines ERP site from job number prefix.
 * Jobs starting with "HCM" or "SGN" route to HCM ERP,
 * everything else routes to HAN ERP.
 */
function getErpSite(jobNumber: string): "HCM" | "HAN" {
	const upper = jobNumber.toUpperCase();
	return upper.startsWith("HCM") || upper.startsWith("SGN") ? "HCM" : "HAN";
}

export async function checkJobInvoice(
	jobNumber: string,
): Promise<CheckInvoiceResult> {
	const params = { job: jobNumber };
	const erpSite = getErpSite(jobNumber);

	const erpQuery = erpSite === "HCM" ? queryERPHCM : queryERPHAN;
	const result = await erpQuery<{ TotalCount: number }>(QUERY, params);

	const totalCount = result.recordset?.[0]?.TotalCount ?? 0;

	return {
		jobNumber,
		hasInvoice: totalCount > 0,
		totalCount,
	};
}
