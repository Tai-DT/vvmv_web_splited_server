import { type NextRequest, NextResponse } from "next/server";
import { prismaRPA as prisma } from "@/lib/db";
import { sendContactEmail } from "@/lib/gmail/service-account-mailer";

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { name, email, subject, message } = body;

		if (!name || !email || !subject || !message) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 },
			);
		}

		// 1. Save to Database
		let dbStatus = { success: false, error: null as string | null };
		try {
			const _result = await prisma.contactInquiry.create({
				data: { name, email, subject, message },
			});
			dbStatus = { success: true, error: null };
		} catch (dbError: any) {
			console.error("Database saving failed:", dbError.message);
			dbStatus = { success: false, error: dbError.message };
		}

		// 2. Send Email Notification
		let emailStatus = { success: false, id: null, error: null };
		try {
			const emailResponse = await sendContactEmail({
				name,
				email,
				subject,
				message,
				to: "tienpb@vvmv.com.vn, headoffice@vvmv.com.vn, cshan@vvmv.com.vn, haiphong@vvmv.com.vn",
			});
			emailStatus = { success: true, id: emailResponse.id as any, error: null };
		} catch (emailError: any) {
			console.error(
				"Email notification failed. Error details:",
				emailError.message,
			);
			emailStatus = {
				success: false,
				id: null,
				error: emailError.message,
			};
			if (emailError.response) {
				console.error("Error response data:", emailError.response.data);
			}
		}

		return NextResponse.json({
			success: true,
			message: "Message processed",
			dbStatus,
			emailStatus,
		});
	} catch (error: any) {
		console.error("Contact API Error:", error);
		return NextResponse.json(
			{ error: "Internal server error", details: error.message },
			{ status: 500 },
		);
	}
}
