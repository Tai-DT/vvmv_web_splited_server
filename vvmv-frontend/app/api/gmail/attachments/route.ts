import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { downloadAttachment, getMessageAttachments } from "@/lib/gmail";

/**
 * GET /api/gmail/attachments
 * Get attachments for a specific message or download specific attachments
 * Query params:
 * - messageId: string (required) - Gmail message ID
 * - attachmentId: string (optional) - If provided, downloads the attachment
 * - filename: string (optional) - Used when downloading to set Content-Disposition
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
				{ message: "No Google access token available" },
				{ status: 401 },
			);
		}

		const accessToken = tokenResult.accessToken;

		const { searchParams } = new URL(request.url);
		const messageId = searchParams.get("messageId");
		const attachmentId = searchParams.get("attachmentId");
		const filename = searchParams.get("filename");

		if (!messageId) {
			return NextResponse.json(
				{ message: "messageId is required" },
				{ status: 400 },
			);
		}

		// If attachmentId is provided, download the attachment
		if (attachmentId) {
			const { data, size } = await downloadAttachment(
				accessToken,
				messageId,
				attachmentId,
			);

			return new NextResponse(new Uint8Array(data), {
				headers: {
					"Content-Type": "application/octet-stream",
					"Content-Disposition": `attachment; filename="${filename || "attachment"}"`,
					"Content-Length": size.toString(),
				},
			});
		}

		// Otherwise, list attachments for the message
		const attachments = await getMessageAttachments(accessToken, messageId);
		return NextResponse.json({ attachments });
	} catch (error: unknown) {
		console.error("Error with Gmail attachments:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";

		return NextResponse.json(
			{ error: "Failed to process attachments", details: errorMessage },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/gmail/attachments
 * Download multiple attachments and return them as base64
 * Body: { messageId: string, attachments: Array<{ id: string, filename: string, mimeType: string }> }
 */
export async function POST(request: NextRequest) {
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
				{ message: "No Google access token available" },
				{ status: 401 },
			);
		}

		const accessToken = tokenResult.accessToken;

		const body = await request.json();
		const { messageId, attachments } = body as {
			messageId: string;
			attachments: Array<{ id: string; filename: string; mimeType: string }>;
		};

		if (!messageId || !attachments || !Array.isArray(attachments)) {
			return NextResponse.json(
				{ message: "messageId and attachments array are required" },
				{ status: 400 },
			);
		}

		// Download each attachment and return as base64
		const files = await Promise.all(
			attachments.map(async (att) => {
				const { data } = await downloadAttachment(
					accessToken,
					messageId,
					att.id,
				);
				return {
					filename: att.filename,
					mimeType: att.mimeType,
					data: data.toString("base64"),
					size: data.length,
				};
			}),
		);

		return NextResponse.json({ files });
	} catch (error: unknown) {
		console.error("Error downloading Gmail attachments:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";

		return NextResponse.json(
			{ error: "Failed to download attachments", details: errorMessage },
			{ status: 500 },
		);
	}
}
