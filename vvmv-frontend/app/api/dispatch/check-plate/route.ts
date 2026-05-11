import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA, queryERPHAN, queryERPHCM } from "@/lib/db";
import {
	cleanPlateNumber,
	PLATE_URL_REGEX,
	formatPlateNumber as standardFormatPlate,
} from "@/lib/trucking/plate-utils";

type Site = "SGN" | "HAN" | "DAD";

/**
 * POST /api/dispatch/check-plate
 * Validate plate format, auto-register in ERP + trucking_numbers if needed,
 * and update FCR records to use the normalized (formatted) plate so there is
 * no mismatch between what the user typed and what is stored.
 *
 * Body: { plateNumber: string; fcrIds?: string[] }
 * Returns: { ok: boolean; created: boolean; normalized: string; fcrUpdated?: number; message?: string }
 */
export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const body = (await request.json()) as {
			plateNumber: string;
			fcrIds?: string[];
		};
		const { plateNumber, fcrIds = [] } = body;

		if (!plateNumber || typeof plateNumber !== "string") {
			return NextResponse.json(
				{ ok: false, message: "Thiếu biển số xe" },
				{ status: 400 },
			);
		}

		// 1. Auto-format
		const normalized = standardFormatPlate(plateNumber.trim()) || "";

		// 2. Validate format
		if (!PLATE_URL_REGEX.test(cleanPlateNumber(normalized))) {
			return NextResponse.json(
				{
					ok: false,
					normalized,
					message: `Biển số "${plateNumber.trim().toUpperCase()}" không hợp lệ (sau định dạng: "${normalized}"). Ví dụ: 50E-146.80, 51C-1234`,
				},
				{ status: 422 },
			);
		}

		const userSite = (session.user as any).site as Site | undefined;
		const site: Site = userSite || "SGN";
		const erpQuery = site === "HAN" ? queryERPHAN : queryERPHCM;

		// 3. Check in local trucking_numbers
		const existingLocal = await prismaRPA.truckingNumber.findFirst({
			where: { plateNumber: normalized, isVendor: false },
			select: { id: true },
		});

		let created = false;

		if (!existingLocal) {
			// 4. Upsert into ERP
			if (site !== "DAD") {
				const deptId = site === "SGN" ? "SGDP006" : "DP003";
				const userInput =
					site === "SGN" ? "adminsgn@vvmv.com.vn" : "hoattq@vvmv.com.vn";
				try {
					await erpQuery(
						`IF NOT EXISTS (SELECT 1 FROM dbo.VehicleList WHERE VHUnitNo = @plateNumber)
             BEGIN
               INSERT INTO dbo.VehicleList
                 (VHUnitNo, VHFuelConsumption, VHDeptID, VHCost, Inuse, UserInput, DateInput, DateModify, Remooc, MaximumCapacity, MaximumCBM)
               VALUES
                 (@plateNumber, 0, @deptId, 0, 1, @userInput, GETDATE(), GETDATE(), 0, 0, 0)
             END`,
						{ plateNumber: normalized, deptId, userInput },
					);
				} catch (erpErr: any) {
					console.warn(
						`[check-plate] ERP insert failed for ${normalized}:`,
						erpErr.message,
					);
				}
			}

			// 5. Create in local trucking_numbers
			await prismaRPA.truckingNumber.create({
				data: {
					plateNumber: normalized,
					isVendor: false,
					site,
					createdBy: session.user.id,
				},
			});
			created = true;
		}

		// 6. Normalize FCR records — update plateNumber to formatted version to avoid mismatch
		let fcrUpdated = 0;
		if (fcrIds.length > 0) {
			// Only update FCRs whose plateNumber doesn't already match the normalized form
			const result = await prismaRPA.fCR.updateMany({
				where: {
					id: { in: fcrIds },
					NOT: { plateNumber: normalized },
				},
				data: { plateNumber: normalized },
			});
			fcrUpdated = result.count;
		}

		return NextResponse.json({
			ok: true,
			created,
			normalized,
			fcrUpdated,
			message: created
				? `Đã đăng ký biển số ${normalized} vào hệ thống${fcrUpdated > 0 ? ` và cập nhật ${fcrUpdated} FCR` : ""}`
				: `Biển số ${normalized} đã có trong hệ thống${fcrUpdated > 0 ? `, cập nhật ${fcrUpdated} FCR` : ""}`,
		});
	} catch (error: any) {
		console.error("[check-plate] Error:", error);
		return NextResponse.json(
			{ ok: false, message: error.message || "Lỗi hệ thống" },
			{ status: 500 },
		);
	}
}
