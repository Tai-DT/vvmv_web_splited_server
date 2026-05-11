import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCdsCargoUnitCodes } from "@/lib/followup/cds-cargo-unit-codes";

export async function GET(request: Request) {
	try {
		const session = await auth.api.getSession({
			headers: new Headers(request.headers),
		});

		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		return NextResponse.json({ units: getCdsCargoUnitCodes() });
	} catch (error) {
		console.error("Failed to load CDS cargo unit codes:", error);
		return NextResponse.json(
			{ error: "Không thể tải danh mục đơn vị tính hàng hóa CDS" },
			{ status: 500 },
		);
	}
}
