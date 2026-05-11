import { SPREADSHEET_ID, sheets, validateGoogleSheetsConfig } from "./client";
import type {
	OrderInfo,
	OrderTrackingData,
	SheetColumnMapping,
	SheetRow,
} from "./types";
import { GoogleSheetsError } from "./types";

/**
 * Fetch raw data from a Google Sheet range
 * @param range - Sheet range in A1 notation (e.g., 'FINAL!A:R')
 * @returns Array of rows, where each row is an array of cell values
 */
export async function fetchSheetData(range: string): Promise<SheetRow[]> {
	try {
		validateGoogleSheetsConfig();

		const response = await sheets.spreadsheets.values.get({
			spreadsheetId: SPREADSHEET_ID,
			range,
		});

		const rows = response.data.values;

		if (!rows || rows.length === 0) {
			throw new GoogleSheetsError("No data found in the specified range");
		}

		return rows as SheetRow[];
	} catch (error) {
		if (error instanceof GoogleSheetsError) {
			throw error;
		}
		throw new GoogleSheetsError(
			`Failed to fetch data from Google Sheets: ${error instanceof Error ? error.message : "Unknown error"}`,
			"FETCH_ERROR",
		);
	}
}

const DEFAULT_COLUMN_MAPPING: SheetColumnMapping = {
	deliveryNumber: 1, // Column B
	image: 2, // Column C
	time: 3, // Column D
	file: 5, // Column F
	status: 10, // Column K
	from: 13, // Column N
	to: 14, // Column O
	dateSend: 15, // Column P
	totalBox: 16, // Column Q
	weight: 17, // Column R
	description: 11, // Column L
	reciever: 12, // Column M
};

/**
 * Map a sheet row to OrderInfo object
 * @param row - Raw sheet row data
 * @param mapping - Column mapping configuration (optional, uses default if not provided)
 * @returns OrderInfo object
 */
function mapRowToOrderInfo(
	row: SheetRow,
	mapping: SheetColumnMapping = DEFAULT_COLUMN_MAPPING,
): OrderInfo {
	const getValue = (index: number, defaultValue: string = "") => {
		const value = row[index];
		return value !== null && value !== undefined ? String(value) : defaultValue;
	};

	return {
		deliveryNumber: getValue(mapping.deliveryNumber),
		image: getValue(mapping.image),
		time: getValue(mapping.time),
		file: getValue(mapping.file),
		status: getValue(mapping.status),
		from: getValue(mapping.from),
		to: getValue(mapping.to),
		dateSend: getValue(mapping.dateSend),
		totalBox: getValue(mapping.totalBox),
		weight: getValue(mapping.weight),
		description: getValue(mapping.description),
		reciever: getValue(mapping.reciever),
	};
}

/**
 * Fetch order tracking data by delivery number
 * @param deliveryNumber - The delivery number to search for
 * @param range - Sheet range for data (default: 'FINAL!A:R')
 * @param columnMapping - Custom column mapping (optional)
 * @returns Order tracking data including order info (first row) and history (all rows)
 */
export async function getOrderTrackingData(
	deliveryNumber: string,
	range = "FINAL!A:R",
	columnMapping?: SheetColumnMapping,
): Promise<OrderTrackingData | null> {
	try {
		const mapping = columnMapping ?? DEFAULT_COLUMN_MAPPING;

		// Fetch all data
		const allRows = await fetchSheetData(range);

		// Skip header row (assuming first row is header)
		const dataRows = allRows.slice(1);

		// Find all rows with matching delivery number
		const matchingRows = dataRows.filter((row) => {
			const code = String(row[mapping.deliveryNumber] ?? "");
			return code === deliveryNumber;
		});

		if (matchingRows.length === 0) {
			return null; // Order not found
		}

		// Sort matchingRows by time column from older to newer
		matchingRows.sort((a, b) => {
			const timeA = a[mapping.time];
			const timeB = b[mapping.time];

			// Handle cases where time might be missing, empty, or invalid type
			if (!timeA && !timeB) return 0;
			if (!timeA) return -1;
			if (!timeB) return 1;

			// Convert to string to ensure we have a valid type for Date constructor
			const timeAStr = String(timeA);
			const timeBStr = String(timeB);

			// Convert time strings to Date objects for comparison
			const dateA = new Date(timeAStr);
			const dateB = new Date(timeBStr);

			// Check if dates are valid
			const isValidA = !Number.isNaN(dateA.getTime());
			const isValidB = !Number.isNaN(dateB.getTime());

			if (!isValidA && !isValidB) return 0;
			if (!isValidA) return -1;
			if (!isValidB) return 1;

			// Compare dates - from older to newer
			return dateA.getTime() - dateB.getTime();
		});

		// First row = order info (latest/primary record)
		const order = mapRowToOrderInfo(matchingRows[0], mapping);

		// All rows = history (timeline of all events for this delivery number)
		const history = matchingRows.map((row) => mapRowToOrderInfo(row, mapping));

		// Get status from last row of history and assign to order
		order.status = history[history.length - 1].status;

		// Check if receiver or dateSend is empty, then find from history with status "Đã lấy hàng từ nhà máy"
		if (!order.reciever || !order.dateSend) {
			// Find the most recent history entry with status "Đã lấy hàng từ nhà máy"
			const pickupHistory = history
				.filter((item) => item.status === "Đã lấy hàng từ nhà máy")
				.sort((a, b) => {
					// Sort by time to get the most recent one
					const timeA = a.time ? new Date(a.time).getTime() : 0;
					const timeB = b.time ? new Date(b.time).getTime() : 0;
					return timeB - timeA; // Descending order (newest first)
				});

			if (pickupHistory.length > 0) {
				const recentPickup = pickupHistory[0];

				// Fill empty receiver from pickup history
				if (!order.reciever && recentPickup.reciever) {
					order.reciever = recentPickup.reciever;
				}

				// Fill empty dateSend from pickup history
				if (!order.dateSend && recentPickup.time) {
					order.dateSend = recentPickup.time;
				}
			}
		}

		return { order, history };
	} catch (error) {
		if (error instanceof GoogleSheetsError) {
			throw error;
		}
		throw new GoogleSheetsError(
			`Failed to get order tracking data: ${error instanceof Error ? error.message : "Unknown error"}`,
			"GET_ORDER_ERROR",
		);
	}
}

/**
 * Fetch all orders from the sheet (deduplicated by delivery number)
 * @param range - Sheet range for order data (default: 'FINAL!A:R')
 * @param columnMapping - Custom column mapping (optional)
 * @returns Array of OrderInfo objects (first occurrence of each delivery number)
 */
export async function getAllOrders(
	range = "FINAL!A:R",
	columnMapping?: SheetColumnMapping,
): Promise<OrderInfo[]> {
	try {
		const mapping = columnMapping ?? DEFAULT_COLUMN_MAPPING;
		const rows = await fetchSheetData(range);

		// Skip header row (assuming first row is header)
		const dataRows = rows.slice(1);

		// Deduplicate by delivery number (keep first occurrence)
		const seen = new Set<string>();
		const uniqueRows = dataRows.filter((row) => {
			const deliveryNum = String(row[mapping.deliveryNumber] ?? "");
			if (seen.has(deliveryNum)) {
				return false;
			}
			seen.add(deliveryNum);
			return true;
		});

		return uniqueRows.map((row) => mapRowToOrderInfo(row, mapping));
	} catch (error) {
		if (error instanceof GoogleSheetsError) {
			throw error;
		}
		throw new GoogleSheetsError(
			`Failed to get all orders: ${error instanceof Error ? error.message : "Unknown error"}`,
			"GET_ALL_ORDERS_ERROR",
		);
	}
}

/**
 * Test connection to Google Sheets
 * Useful for debugging authentication and configuration issues
 */
export async function testConnection(): Promise<{
	success: boolean;
	message: string;
}> {
	try {
		validateGoogleSheetsConfig();

		const response = await sheets.spreadsheets.get({
			spreadsheetId: SPREADSHEET_ID,
		});

		return {
			success: true,
			message: `Successfully connected to sheet: ${response.data.properties?.title}`,
		};
	} catch (error) {
		return {
			success: false,
			message: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}
