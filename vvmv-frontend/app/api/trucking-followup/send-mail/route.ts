import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGmailClient } from "@/lib/gmail/client";

export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user?.email) {
			return NextResponse.json(
				{ message: "Unauthorized or no email" },
				{ status: 401 },
			);
		}

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
						"No Google access token available. Please sign in with Google again.",
				},
				{ status: 401 },
			);
		}

		const {
			to,
			cc,
			subject,
			body,
			driveFileIds,
			localFiles,
			isHtml,
			threadId,
			inReplyTo,
			references,
		} = await request.json();

		if (!to || !subject || !body) {
			return NextResponse.json(
				{ message: "Missing to, subject, or body" },
				{ status: 400 },
			);
		}

		// If body is already HTML, use it as-is; otherwise convert plain-text newlines
		const htmlBody = isHtml ? body : body.replace(/\n/g, "<br/>");
		// MIME body part uses standard base64 (NOT URL-safe)
		const htmlBodyB64 = Buffer.from(htmlBody, "utf-8").toString("base64");
		const gmail = getGmailClient(tokenResult.accessToken);
		const fromUserEmail = session.user.email;

		const utf8Subject = `=?utf-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`;
		const boundary = `vvmv_boundary_${Date.now().toString(16)}`;

		const emailContent = [
			`To: ${to}`,
			...(cc ? [`Cc: ${cc}`] : []),
			`Subject: ${utf8Subject}`,
			`From: ${fromUserEmail}`,
			...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : []),
			...(references ? [`References: ${references}`] : []),
			`Content-Type: multipart/mixed; boundary="${boundary}"`,
			"MIME-Version: 1.0",
			"",
			`--${boundary}`,
			"Content-Type: text/html; charset=utf-8",
			"Content-Transfer-Encoding: base64",
			"",
			// Split base64 into 76-char lines per MIME spec
			...(htmlBodyB64.match(/.{1,76}/g) ?? [htmlBodyB64]),
		];

		// Tham khảo AI lấy booking để lấy list chứng từ từ Drive
		if (
			driveFileIds &&
			Array.isArray(driveFileIds) &&
			driveFileIds.length > 0
		) {
			const { getFileContent } = await import("@/lib/google-drive/upload");
			for (const fileId of driveFileIds) {
				try {
					const {
						buffer,
						mimeType,
						name: fetchedName,
					} = await getFileContent(fileId);
					const fname = fetchedName || fileId;
					const encodedName = `=?utf-8?B?${Buffer.from(fname).toString("base64")}?=`;

					emailContent.push(`--${boundary}`);
					emailContent.push(`Content-Type: ${mimeType}; name="${encodedName}"`);
					emailContent.push(
						`Content-Disposition: attachment; filename="${encodedName}"`,
					);
					emailContent.push(`Content-Transfer-Encoding: base64`);
					emailContent.push("");

					// Split base64 into chunks of 76 characters as per MIME standard
					const b64 = buffer.toString("base64");
					const chunks = b64.match(/.{1,76}/g) || [];
					emailContent.push(chunks.join("\r\n"));
				} catch (e: any) {
					console.error(
						`Failed to fetch and attach file ${fileId}:`,
						e.message,
					);
				}
			}
		}

		// Attach local files mapped from frontend FileReader
		if (localFiles && Array.isArray(localFiles) && localFiles.length > 0) {
			for (const file of localFiles) {
				try {
					const fname = file.name || "attachment";
					const encodedName = `=?utf-8?B?${Buffer.from(fname).toString("base64")}?=`;

					emailContent.push(`--${boundary}`);
					emailContent.push(
						`Content-Type: ${file.mimeType}; name="${encodedName}"`,
					);
					emailContent.push(
						`Content-Disposition: attachment; filename="${encodedName}"`,
					);
					emailContent.push(`Content-Transfer-Encoding: base64`);
					emailContent.push("");

					const chunks = file.data.match(/.{1,76}/g) || [];
					emailContent.push(chunks.join("\r\n"));
				} catch (e: any) {
					console.error(`Failed to attach local file ${file.name}:`, e.message);
				}
			}
		}

		emailContent.push(`--${boundary}--`);

		const base64EncodedEmail = Buffer.from(emailContent.join("\r\n"))
			.toString("base64")
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");

		await gmail.users.messages.send({
			userId: "me",
			requestBody: {
				raw: base64EncodedEmail,
				...(threadId ? { threadId } : {}),
			},
		});

		return NextResponse.json({
			success: true,
			message: "Email sent successfully",
		});
	} catch (error: any) {
		console.error("Direct Send Mail Error:", error);

		if (
			error.message?.includes("invalid_grant") ||
			error.message?.includes("Token has been expired or revoked")
		) {
			return NextResponse.json(
				{ message: "Gmail access expired. Please log out and log in again." },
				{ status: 401 },
			);
		}

		if (
			error.message?.includes(
				"Request had insufficient authentication scopes",
			) ||
			error.message?.includes("Insufficient Permission")
		) {
			return NextResponse.json(
				{
					message:
						"Please log out and log in again to grant Gmail Send permissions.",
				},
				{ status: 403 },
			);
		}

		return NextResponse.json(
			{ message: error.message || "Failed to send email" },
			{ status: 500 },
		);
	}
}
