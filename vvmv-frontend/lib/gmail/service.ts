import type { gmail_v1 } from "googleapis";
import { getGmailClient } from "./client";

/**
 * Gmail API Service Functions
 * Functions for listing emails, getting attachments, and downloading files
 */

export interface GmailMessage {
	id: string;
	threadId: string;
	subject: string;
	from: string;
	date: string;
	snippet: string;
	attachments: GmailAttachment[];
}

export interface GmailAttachment {
	id: string;
	filename: string;
	mimeType: string;
	size: number;
}

/**
 * Response type for listEmailsWithAttachments
 */
export interface ListEmailsResponse {
	messages: GmailMessage[];
	nextPageToken?: string;
}

/**
 * List recent emails that have attachments
 * @param accessToken - User's OAuth2 access token
 * @param maxResults - Maximum number of emails to return (default: 10)
 * @param query - Optional search query (e.g., "label:INBOX has:attachment")
 * @param pageToken - Optional page token for pagination
 * @returns Object with messages array and nextPageToken
 */
export async function listEmailsWithAttachments(
	accessToken: string,
	maxResults: number = 10,
	query: string = "label:INBOX has:attachment",
	pageToken?: string,
): Promise<ListEmailsResponse> {
	const gmail = getGmailClient(accessToken);

	// List messages matching the query
	const listResponse = await gmail.users.messages.list({
		userId: "me",
		maxResults,
		q: query,
		pageToken,
	});

	const messages = listResponse.data.messages || [];

	// Fetch details for each message concurrently using Promise.all
	const detailPromises = messages.map(async (msg) => {
		if (!msg.id) return null;

		try {
			const detail = await gmail.users.messages.get({
				userId: "me",
				id: msg.id,
				format: "full",
			});

			const headers = detail.data.payload?.headers || [];
			const subject =
				headers.find((h) => h.name === "Subject")?.value || "(No Subject)";
			const from = headers.find((h) => h.name === "From")?.value || "Unknown";
			const date = headers.find((h) => h.name === "Date")?.value || "";

			// Get attachments from the message
			const attachments = extractAttachments(detail.data.payload);

			// Only return if it has attachments
			if (attachments.length > 0) {
				return {
					id: msg.id,
					threadId: msg.threadId || "",
					subject,
					from,
					date,
					snippet: detail.data.snippet || "",
					attachments,
				};
			}
		} catch (error) {
			console.error(`Error fetching details for message ${msg.id}:`, error);
		}
		return null;
	});

	const results = await Promise.all(detailPromises);

	// Filter out nulls and return with pagination info
	return {
		messages: results.filter((r): r is GmailMessage => r !== null),
		nextPageToken: listResponse.data.nextPageToken || undefined,
	};
}

/**
 * Extract attachment info from a Gmail message payload
 * @param payload - Gmail message payload
 * @returns Array of attachment metadata
 */
function extractAttachments(
	payload: gmail_v1.Schema$MessagePart | undefined,
): GmailAttachment[] {
	const attachments: GmailAttachment[] = [];

	if (!payload) return attachments;

	// Check if this part is an attachment
	if (payload.filename && payload.body?.attachmentId) {
		attachments.push({
			id: payload.body.attachmentId,
			filename: payload.filename,
			mimeType: payload.mimeType || "application/octet-stream",
			size: payload.body.size || 0,
		});
	}

	// Recursively check parts
	if (payload.parts) {
		for (const part of payload.parts) {
			attachments.push(...extractAttachments(part));
		}
	}

	return attachments;
}

/**
 * Get attachments for a specific email message
 * @param accessToken - User's OAuth2 access token
 * @param messageId - Gmail message ID
 * @returns Array of attachment metadata
 */
export async function getMessageAttachments(
	accessToken: string,
	messageId: string,
): Promise<GmailAttachment[]> {
	const gmail = getGmailClient(accessToken);

	const detail = await gmail.users.messages.get({
		userId: "me",
		id: messageId,
		format: "full",
	});

	return extractAttachments(detail.data.payload);
}

/**
 * Download an attachment and return it as a Buffer
 * @param accessToken - User's OAuth2 access token
 * @param messageId - Gmail message ID
 * @param attachmentId - Attachment ID
 * @returns Object with filename and buffer
 */
export async function downloadAttachment(
	accessToken: string,
	messageId: string,
	attachmentId: string,
): Promise<{ data: Buffer; size: number }> {
	const gmail = getGmailClient(accessToken);

	const attachment = await gmail.users.messages.attachments.get({
		userId: "me",
		messageId,
		id: attachmentId,
	});

	// Gmail returns base64url encoded data
	const data = attachment.data.data || "";
	const buffer = Buffer.from(data, "base64url");

	return {
		data: buffer,
		size: attachment.data.size || buffer.length,
	};
}
