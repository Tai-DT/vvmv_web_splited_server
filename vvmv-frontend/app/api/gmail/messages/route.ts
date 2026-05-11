import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listEmailsWithAttachments } from "@/lib/gmail";

/**
 * GET /api/gmail/messages
 * Lists recent emails with attachments
 * Query params:
 * - maxResults: number (default: 20)
 * - q: string (optional search query)
 */
export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		// Get access token using better-auth's getAccessToken method
		const tokenResult = await auth.api.getAccessToken({
			headers: request.headers,
			body: {
				providerId: "google",
			},
		});

		if (!tokenResult?.accessToken) {
			return NextResponse.json(
				{
					message:
						"No Google access token available. Please sign in with Google.",
				},
				{ status: 401 },
			);
		}

		const accessToken = tokenResult.accessToken;

		// Parse query params
		const { searchParams } = new URL(request.url);
		const maxResults = parseInt(searchParams.get("maxResults") || "10", 10);
		const query = searchParams.get("q") || "label:INBOX has:attachment";
		const pageToken = searchParams.get("pageToken") || undefined;

		// List emails with attachments
		const result = await listEmailsWithAttachments(
			accessToken,
			maxResults,
			query,
			pageToken,
		);

		return NextResponse.json({
			messages: result.messages,
			nextPageToken: result.nextPageToken,
		});
	} catch (error: unknown) {
		console.error("Error fetching Gmail messages:", error);

		// Check for Gmail API specific errors
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";

		if (
			errorMessage.includes("invalid_grant") ||
			errorMessage.includes("Token has been expired or revoked")
		) {
			return NextResponse.json(
				{ message: "Gmail access expired. Please sign in again." },
				{ status: 401 },
			);
		}

		if (
			errorMessage.includes("Request had insufficient authentication scopes") ||
			errorMessage.includes("Insufficient Permission") ||
			errorMessage.includes("accessNotConfigured")
		) {
			return NextResponse.json(
				{
					message:
						"Gmail read access not granted. Please sign out and sign in again to grant Gmail access.",
				},
				{ status: 403 },
			);
		}

		// Log the full error for debugging
		console.error("Full Gmail error details:", JSON.stringify(error, null, 2));

		return NextResponse.json(
			{ error: "Failed to fetch Gmail messages", details: errorMessage },
			{ status: 500 },
		);
	}
}
