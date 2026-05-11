import { NextResponse } from "next/server";
import { clearVendorPortalCookie } from "@/lib/vendor-portal-auth";

export async function POST() {
	await clearVendorPortalCookie();
	return NextResponse.json({ success: true });
}
