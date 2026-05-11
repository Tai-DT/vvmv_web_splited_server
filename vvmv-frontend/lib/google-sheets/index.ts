/**
 * Google Sheets Integration Library
 *
 * This module provides functions to fetch data from Google Sheets
 * using service account authentication.
 *
 * @example
 * ```ts
 * import { getOrderTrackingData } from '@/lib/google-sheets';
 *
 * const data = await getOrderTrackingData('VT1827980931');
 * ```
 */

// Export client utilities (for advanced usage)
export { SPREADSHEET_ID, sheets, validateGoogleSheetsConfig } from "./client";
// Export service functions
export {
	fetchSheetData,
	getAllOrders,
	getOrderTrackingData,
	testConnection,
} from "./service";
// Export types
export type {
	OrderInfo,
	OrderTrackingData,
	SheetColumnMapping,
	SheetRow,
} from "./types";
// Export error class
export { GoogleSheetsError } from "./types";
