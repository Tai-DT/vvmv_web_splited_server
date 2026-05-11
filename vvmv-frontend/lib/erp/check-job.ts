import { queryERPHAN, queryERPHCM } from "@/lib/db";

/**
 * Checks if a job (TransID) exists in the ERP system.
 */
export async function checkJobExists(jobNumber: string): Promise<boolean> {
	const erpSite = jobNumber.toUpperCase().startsWith("HCM") ? "HCM" : "HAN";
	const query = "SELECT 1 FROM Transactions WHERE TransID = @pJobNumber";
	const params = { pJobNumber: jobNumber };

	try {
		if (erpSite === "HCM") {
			const result = await queryERPHCM(query, params);
			return result.recordset && result.recordset.length > 0;
		} else {
			const result = await queryERPHAN(query, params);
			return result.recordset && result.recordset.length > 0;
		}
	} catch (error) {
		console.error(`Error checking job existence for ${jobNumber}:`, error);
		// In case of error, we might want to return false to trigger recreation,
		// or throw. Returning false is safer for the "don't fail" approach.
		return false;
	}
}
