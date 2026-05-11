import { type gmail_v1, google } from "googleapis";

/**
 * Gmail API Client
 * Uses OAuth2 access token for user-context access to Gmail
 */

/**
 * Create a Gmail API client using the user's OAuth2 access token
 * @param accessToken - User's OAuth2 access token from better-auth
 * @returns Gmail API client instance
 */
export function getGmailClient(accessToken: string): gmail_v1.Gmail {
	const oauth2Client = new google.auth.OAuth2();
	oauth2Client.setCredentials({ access_token: accessToken });

	return google.gmail({ version: "v1", auth: oauth2Client });
}

/**
 * Verify Gmail API access by checking user's profile
 * @param accessToken - User's OAuth2 access token
 * @returns User's email address if access is valid
 */
export async function verifyGmailAccess(
	accessToken: string,
): Promise<string | null> {
	try {
		const gmail = getGmailClient(accessToken);
		const profile = await gmail.users.getProfile({ userId: "me" });
		return profile.data.emailAddress || null;
	} catch (error) {
		console.error("Gmail access verification failed:", error);
		return null;
	}
}
