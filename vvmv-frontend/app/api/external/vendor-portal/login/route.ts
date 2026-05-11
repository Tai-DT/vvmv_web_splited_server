import { type NextRequest, NextResponse } from "next/server";
import { prismaRPA } from "@/lib/db";
import {
	createVendorToken,
	setVendorPortalCookie,
	verifyVendorPassword,
} from "@/lib/vendor-portal-auth";

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const username = String(body?.username || "").trim();
		const password = String(body?.password || "");

		if (!username || !password) {
			return NextResponse.json(
				{ message: "Username and password are required" },
				{ status: 400 },
			);
		}

		const account = await prismaRPA.vendorPortalAccount.findUnique({
			where: { username },
			include: {
				vendor: {
					select: {
						id: true,
						name: true,
						site: true,
					},
				},
			},
		});

		if (!account || !account.isActive) {
			return NextResponse.json(
				{ message: "Invalid username or password" },
				{ status: 401 },
			);
		}

		const passwordOk = verifyVendorPassword(password, account.passwordHash);
		if (!passwordOk) {
			return NextResponse.json(
				{ message: "Invalid username or password" },
				{ status: 401 },
			);
		}

		const token = createVendorToken({
			accountId: account.id,
			vendorId: account.vendor.id,
			vendorName: account.vendor.name,
			site: account.vendor.site,
		});

		await setVendorPortalCookie(token);

		return NextResponse.json({
			success: true,
			vendor: {
				id: account.vendor.id,
				name: account.vendor.name,
				site: account.vendor.site,
			},
		});
	} catch (error) {
		console.error("Vendor login error:", error);
		return NextResponse.json(
			{ message: "Failed to login vendor account" },
			{ status: 500 },
		);
	}
}
