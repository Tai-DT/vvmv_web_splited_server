import { type NextRequest, NextResponse } from "next/server";
import { getVendorPortalContext } from "@/lib/vendor-portal-auth";

export async function GET(request: NextRequest) {
	const context = await getVendorPortalContext(request);
	if (!context) {
		return NextResponse.json({ authenticated: false }, { status: 401 });
	}

	return NextResponse.json({
		authenticated: true,
		vendor: {
			id: context.vendor.id,
			name: context.vendor.name,
			site: context.vendor.site,
		},
	});
}
