/**
 * TypeScript types for Google Sheets data
 */

// Generic type for raw sheet rows (array of cell values)
export type SheetRow = (string | number | boolean | null)[];

/**
 * Order information displayed in the external tracking page
 */
export interface OrderInfo {
	deliveryNumber: string;
	image: string;
	time: string;
	file: string;
	status: string;
	from: string;
	to: string;
	dateSend: string;
	totalBox: string;
	weight: string;
	description: string;
	reciever: string;
}

/**
 * Complete order tracking data
 */
export interface OrderTrackingData {
	order: OrderInfo;
	history: OrderInfo[];
}

/**
 * Configuration for mapping sheet columns to OrderInfo fields
 * All values are column indices (0-based numbers)
 */
export interface SheetColumnMapping {
	deliveryNumber: number;
	image: number;
	time: number;
	file: number;
	status: number;
	from: number;
	to: number;
	dateSend: number;
	totalBox: number;
	weight: number;
	description: number;
	reciever: number;
}

/**
 * Error types for Google Sheets operations
 */
export class GoogleSheetsError extends Error {
	constructor(
		message: string,
		public code?: string,
	) {
		super(message);
		this.name = "GoogleSheetsError";
	}
}
