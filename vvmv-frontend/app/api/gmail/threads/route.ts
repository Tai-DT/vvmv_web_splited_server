import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGmailClient } from "@/lib/gmail/client";

/**
 * GET /api/gmail/threads
 * Lists recent Gmail threads for thread-picker (to reply into)
 * Query params:
 *   - maxResults: number (default 15)
 *   - q: string (optional search)
 *   - pageToken: string (optional)
 */
export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const tokenResult = await auth.api.getAccessToken({
			headers: request.headers,
			body: { providerId: "google" },
		});

		if (!tokenResult?.accessToken) {
			return NextResponse.json(
				{
					message: "No Google access token. Please sign in with Google again.",
				},
				{ status: 401 },
			);
		}

		const { searchParams } = new URL(request.url);
		const maxResults = parseInt(searchParams.get("maxResults") || "15", 10);
		const q = searchParams.get("q") || "label:INBOX OR label:SENT";
		const pageToken = searchParams.get("pageToken") || undefined;

		const gmail = getGmailClient(tokenResult.accessToken);

		// List threads
		const listResp = await gmail.users.threads.list({
			userId: "me",
			maxResults,
			q,
			pageToken,
		});

		const threads = listResp.data.threads || [];

		// Fetch basic details for each thread (just first message headers)
		const detailed = await Promise.all(
			threads.map(async (t) => {
				if (!t.id) return null;
				try {
					const threadDetail = await gmail.users.threads.get({
						userId: "me",
						id: t.id,
						format: "metadata",
						metadataHeaders: [
							"Subject",
							"From",
							"To",
							"Cc",
							"Date",
							"Message-ID",
						],
					});

					const messages = threadDetail.data.messages || [];
					if (messages.length === 0) return null;

					// Use the first message for subject/from/date
					const firstMsg = messages[0];
					const lastMsg = messages[messages.length - 1];
					const headers = (msg: typeof firstMsg) =>
						(msg?.payload?.headers || []).reduce(
							(acc, h) => {
								if (h.name && h.value) acc[h.name.toLowerCase()] = h.value;
								return acc;
							},
							{} as Record<string, string>,
						);

					const firstHeaders = headers(firstMsg);
					const lastHeaders = headers(lastMsg);

					const references = messages
						.map(
							(m) =>
								(m?.payload?.headers || []).find(
									(h) => h.name?.toLowerCase() === "message-id",
								)?.value,
						)
						.filter(Boolean)
						.join(" ");

					const mappedMessages = messages.map((msg) => {
						const msgHeaders = headers(msg);
						return {
							id: t.id,
							threadId: t.id,
							lastMessageId: msg.id || "",
							subject:
								msgHeaders.subject || firstHeaders.subject || "(No Subject)",
							from: msgHeaders.from || "",
							to: msgHeaders.to || "",
							cc: msgHeaders.cc || "",
							date: msgHeaders.date || "",
							snippet: msg.snippet || threadDetail.data.snippet || "",
							messageCount: 1,
							lastMessageGmailId: msg.id || "",
							inReplyTo: msgHeaders["message-id"] || "",
							references: references,
						};
					});

					// For reply: need the last message's Message-ID and thread-id
					return {
						id: t.id,
						threadId: t.id,
						lastMessageId: lastMsg.id || "",
						subject: firstHeaders.subject || "(No Subject)",
						from: firstHeaders.from || "",
						to: lastHeaders.to || "",
						cc: lastHeaders.cc || firstHeaders.cc || "",
						date: lastHeaders.date || firstHeaders.date || "",
						snippet: threadDetail.data.snippet || "",
						messageCount: messages.length,
						// For constructing In-Reply-To and References headers
						lastMessageGmailId: lastMsg.id || "",
						inReplyTo: lastHeaders["message-id"] || "",
						references: references,
						messages: mappedMessages,
					};
				} catch {
					return null;
				}
			}),
		);

		return NextResponse.json({
			threads: detailed.filter(Boolean),
			nextPageToken: listResp.data.nextPageToken || undefined,
		});
	} catch (error: unknown) {
		console.error("Error fetching Gmail threads:", error);
		const msg = error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json(
			{ error: "Failed to fetch Gmail threads", details: msg },
			{ status: 500 },
		);
	}
}
