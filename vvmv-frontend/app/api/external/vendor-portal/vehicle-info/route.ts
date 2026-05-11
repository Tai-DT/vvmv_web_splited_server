import { type NextRequest, NextResponse } from "next/server";
import { prismaRPA } from "@/lib/db";
import {
	cleanPlateNumber,
	PLATE_URL_REGEX,
	formatPlateNumber as standardFormatPlate,
} from "@/lib/trucking/plate-utils";
import { getVendorPortalContext } from "@/lib/vendor-portal-auth";

const PLATE_NUMBER_HINT =
	"Biển số phải đúng định dạng, ví dụ: 50E-146.80, 51LD-123.45 hoặc 51C-1234";
const CONTAINER_NUMBER_PATTERN = /^[A-Z]{4}\d{7}$/;
const CONTAINER_NUMBER_HINT = "Số container phải đúng định dạng YMMU6948968";

function isValidPlateNumber(value: string | null | undefined): boolean {
	if (!value) return false;
	return PLATE_URL_REGEX.test(cleanPlateNumber(value));
}

function normalizeContainerNo(value: string): string {
	return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function isValidContainerNo(value: string): boolean {
	return CONTAINER_NUMBER_PATTERN.test(normalizeContainerNo(value));
}

export async function PATCH(request: NextRequest) {
	try {
		const context = await getVendorPortalContext(request);
		if (!context) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { fcrId, vehicleInfo, plateNumber, containerNo } = body as {
			fcrId: string;
			vehicleInfo: string | null;
			plateNumber?: string | null;
			containerNo?: string | null;
		};

		if (!fcrId || typeof fcrId !== "string") {
			return NextResponse.json({ message: "Invalid fcrId" }, { status: 400 });
		}

		// Verify FCR belongs to this vendor
		const fcr = await prismaRPA.fCR.findFirst({
			where: {
				id: fcrId,
				vendor: { equals: context.vendor.name, mode: "insensitive" },
			},
			select: {
				id: true,
				containerId: true,
				plateNumber: true,
				containerNo: true,
				truckingFollowUp: {
					select: {
						isFinished: true,
					},
				},
			},
		});

		if (!fcr) {
			return NextResponse.json(
				{ message: "FCR not found or access denied" },
				{ status: 403 },
			);
		}

		const updateData: {
			vehicleInfo?: string | null;
			plateNumber?: string | null;
			containerNo?: string | null;
		} = {};

		if (vehicleInfo !== undefined) {
			updateData.vehicleInfo = vehicleInfo?.trim() || null;
		}

		const isFinished = Boolean(fcr.truckingFollowUp?.isFinished);

		if (plateNumber !== undefined) {
			if (isFinished) {
				return NextResponse.json(
					{ message: "Job đã finished, không thể sửa số xe" },
					{ status: 400 },
				);
			}

			const currentPlate = fcr.plateNumber?.trim() || "";
			if (currentPlate.length > 0) {
				return NextResponse.json(
					{
						message: "Chỉ được sửa số xe khi giá trị hiện tại đang rỗng",
					},
					{ status: 400 },
				);
			}

			const formattedPlate = standardFormatPlate(plateNumber?.trim() || "");
			if (formattedPlate && !isValidPlateNumber(formattedPlate)) {
				return NextResponse.json(
					{ message: PLATE_NUMBER_HINT },
					{ status: 400 },
				);
			}

			updateData.plateNumber = formattedPlate || null;
		}

		if (containerNo !== undefined) {
			if (isFinished) {
				return NextResponse.json(
					{ message: "Job đã finished, không thể sửa số container" },
					{ status: 400 },
				);
			}

			const currentContainer = fcr.containerNo?.trim() || "";
			if (currentContainer.length >= 6) {
				return NextResponse.json(
					{
						message:
							"Chỉ được sửa số container khi giá trị hiện tại rỗng hoặc dưới 6 ký tự",
					},
					{ status: 400 },
				);
			}

			const normalizedContainer = normalizeContainerNo(
				containerNo?.trim() || "",
			);
			if (normalizedContainer && !isValidContainerNo(normalizedContainer)) {
				return NextResponse.json(
					{ message: CONTAINER_NUMBER_HINT },
					{ status: 400 },
				);
			}

			updateData.containerNo = normalizedContainer || null;
		}

		if (Object.keys(updateData).length === 0) {
			return NextResponse.json(
				{ message: "No fields to update" },
				{ status: 400 },
			);
		}

		await prismaRPA.fCR.update({
			where: { id: fcrId },
			data: updateData,
		});

		// Keep container plate number in sync with FCR when linked.
		if (updateData.plateNumber !== undefined && fcr.containerId) {
			await prismaRPA.container.update({
				where: { id: fcr.containerId },
				data: { plateNumber: updateData.plateNumber },
			});
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Failed to update vehicle info:", error);
		return NextResponse.json(
			{ message: "Failed to update vehicle info" },
			{ status: 500 },
		);
	}
}
