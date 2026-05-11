import { google } from "googleapis";

/**
 * Google Sheets API Client
 * Configured with service account authentication for server-side access
 */

// Initialize Google Auth with service account credentials
const auth = new google.auth.GoogleAuth({
	credentials: {
		client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
		// Replace \n in the private key with actual newlines
		private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
	},
	scopes: [
		"https://www.googleapis.com/auth/spreadsheets.readonly", // Read-only access
	],
});

// Create Google Sheets API client instance
export const sheets = google.sheets({ version: "v4", auth });

// Export the spreadsheet ID from environment variables
export const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

/**
 * Get Google Drive API client with full Drive and Shared Drive access
 * Separate auth instance for Drive operations
 */
function createDriveGoogleAuth() {
	return new google.auth.GoogleAuth({
		credentials: {
			client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
			private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
		},
		scopes: [
			"https://www.googleapis.com/auth/drive", // Full Drive access (needed for Shared Drives)
		],
	});
}

export function getDriveClient() {
	return google.drive({ version: "v3", auth: createDriveGoogleAuth() });
}

/** OAuth access token for raw Drive upload endpoints (e.g. resumable `upload/drive/v3`). */
export async function getDriveAccessToken(): Promise<string> {
	const client = await createDriveGoogleAuth().getClient();
	const tokenResponse = await client.getAccessToken();
	if (!tokenResponse.token) {
		throw new Error("Failed to obtain Google Drive access token");
	}
	return tokenResponse.token;
}

/**
 * Validate that all required environment variables are set
 */
export function validateGoogleSheetsConfig() {
	const missingVars = [];

	if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
		missingVars.push("GOOGLE_SERVICE_ACCOUNT_EMAIL");
	}
	if (!process.env.GOOGLE_PRIVATE_KEY) {
		missingVars.push("GOOGLE_PRIVATE_KEY");
	}
	if (!process.env.GOOGLE_SHEET_ID) {
		missingVars.push("GOOGLE_SHEET_ID");
	}

	if (missingVars.length > 0) {
		throw new Error(
			`Missing required environment variables: ${missingVars.join(", ")}`,
		);
	}
}
