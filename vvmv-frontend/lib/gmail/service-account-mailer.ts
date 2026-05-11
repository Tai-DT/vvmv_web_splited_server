import { google } from "googleapis";

/**
 * Gmail Service Account Mailer
 * Uses service account credentials to send emails
 */

export async function sendContactEmail({
	name,
	email,
	subject,
	message,
	to = "tienpb@vvmv.com.vn, headoffice@vvmv.com.vn, cshan@vvmv.com.vn, haiphong@vvmv.com.vn",
}: {
	name: string;
	email: string;
	subject: string;
	message: string;
	to?: string;
}) {
	const impersonatedEmail = "robot@vvmv.com.vn";

	const auth = new google.auth.JWT({
		email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
		key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
		scopes: ["https://www.googleapis.com/auth/gmail.send"],
		subject: impersonatedEmail, // This is the key for Domain-wide Delegation
	});

	const gmail = google.gmail({ version: "v1", auth });

	// Create the email content (RFC 5322 format)
	const utf8Subject = `=?utf-8?B?${Buffer.from(`[Contact] ${subject}`).toString("base64")}?=`;
	const emailContent = [
		`To: ${to}`,
		`Subject: ${utf8Subject}`,
		`From: VVMV Robot <${impersonatedEmail}>`,
		"Content-Type: text/html; charset=utf-8",
		"MIME-Version: 1.0",
		"",
		`<h3>New Contact Inquiry from ${name}</h3>`,
		`<p><strong>Sender:</strong> ${name} (&lt;${email}&gt;)</p>`,
		`<p><strong>Subject:</strong> ${subject}</p>`,
		"<p><strong>Message:</strong></p>",
		`<div style="padding: 15px; background: #f5f5f5; border-radius: 5px; white-space: pre-wrap;">${message}</div>`,
		"<hr />",
		"<p><small>This email was sent automatically from the VVMV Web Contact Form via robot@vvmv.com.vn</small></p>",
	].join("\r\n");

	const base64EncodedEmail = Buffer.from(emailContent)
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");

	try {
		const response = await gmail.users.messages.send({
			userId: "me", // "me" refers to the impersonated user (robot@vvmv.com.vn)
			requestBody: {
				raw: base64EncodedEmail,
			},
		});
		return response.data;
	} catch (error) {
		console.error("Gmail Delegation Send Error:", error);
		throw error;
	}
}
export async function sendEmailAsUser({
	fromUserEmail,
	to,
	subject,
	htmlBody,
}: {
	fromUserEmail: string;
	to: string;
	subject: string;
	htmlBody: string;
}) {
	const auth = new google.auth.JWT({
		email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
		key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
		scopes: ["https://www.googleapis.com/auth/gmail.send"],
		subject: fromUserEmail, // Impersonate the actual user sending it
	});

	const gmail = google.gmail({ version: "v1", auth });

	const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
	const emailContent = [
		`To: ${to}`,
		`Subject: ${utf8Subject}`,
		`From: ${fromUserEmail}`,
		"Content-Type: text/html; charset=utf-8",
		"MIME-Version: 1.0",
		"",
		htmlBody,
	].join("\r\n");

	const base64EncodedEmail = Buffer.from(emailContent)
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");

	try {
		const response = await gmail.users.messages.send({
			userId: "me", // "me" resolves to the impersonated user
			requestBody: {
				raw: base64EncodedEmail,
			},
		});
		return response.data;
	} catch (error) {
		console.error("Gmail Delegation Send Error:", error);
		throw error;
	}
}
