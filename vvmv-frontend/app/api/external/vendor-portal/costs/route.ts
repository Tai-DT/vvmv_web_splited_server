import { type NextRequest, NextResponse } from "next/server";
import { prismaRPA } from "@/lib/db";
import { getVendorPortalContext } from "@/lib/vendor-portal-auth";
import { VendorCostEntryMode } from "@/prisma/client";

type CostPayload = {
	id?: string;
	truckingFollowUpId: string;
	fcrId: string;
	feeTypeId?: string | null;
	feeName: string;
	isDisbursement?: boolean;
	vatPercent?: number | null;
	totalVat?: number | null;
	totalFee?: number | null;
	sellerTaxCode?: string | null;
	invoiceNumber?: string | null;
	invoiceLink?: string | null;
	trackingCode?: string | null;
	invoiceSentDate?: string | null;
	note?: string | null;
	rowOrder?: number | null;
};

function normalizeNumber(value: unknown): number | null {
	if (value === null || value === undefined || value === "") return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: NextRequest) {
	try {
		const context = await getVendorPortalContext(request);
		if (!context) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const rows = Array.isArray(body?.rows) ? (body.rows as CostPayload[]) : [];
		const mode: VendorCostEntryMode =
			body?.mode === "EXCEL_IMPORT"
				? VendorCostEntryMode.EXCEL_IMPORT
				: VendorCostEntryMode.MANUAL;

		// replaceForFcrId = specific FCR id → replace that FCR's rows
		// replaceForFcrIds = array of FCR ids → replace multiple FCRs' rows (bulk all)
		// Both null → upsert without deleting first
		const replaceForFcrId =
			typeof body?.replaceForFcrId === "string" ? body.replaceForFcrId : null;
		const replaceForFcrIds: string[] = Array.isArray(body?.replaceForFcrIds)
			? body.replaceForFcrIds
			: replaceForFcrId
				? [replaceForFcrId]
				: [];

		// isDisbursementMode: when true, only replace disbursement rows;
		// when false, only replace non-disbursement rows
		const isDisbursementMode: boolean | null =
			typeof body?.isDisbursementMode === "boolean"
				? body.isDisbursementMode
				: null;

		if (!rows.length) {
			return NextResponse.json({ message: "No rows to save" }, { status: 400 });
		}

		const fcrIds = [...new Set(rows.map((row) => row.fcrId).filter(Boolean))];

		const vendorFcrs = await prismaRPA.fCR.findMany({
			where: {
				id: { in: fcrIds },
				vendor: { equals: context.vendor.name, mode: "insensitive" },
			},
			select: { id: true, truckingFollowUpId: true },
		});

		const allowedFcrMap = new Map(vendorFcrs.map((fcr) => [fcr.id, fcr]));
		const hasForbiddenRow = rows.some((row) => !allowedFcrMap.has(row.fcrId));

		if (hasForbiddenRow) {
			return NextResponse.json(
				{ message: "Some rows do not belong to your assigned FCR" },
				{ status: 403 },
			);
		}

		// Validate all replace targets are allowed
		for (const fcrId of replaceForFcrIds) {
			if (!allowedFcrMap.has(fcrId) && !fcrIds.includes(fcrId)) {
				// need to verify the FCR belongs to this vendor
				const extraFcr = await prismaRPA.fCR.findFirst({
					where: {
						id: fcrId,
						vendor: { equals: context.vendor.name, mode: "insensitive" },
					},
					select: { id: true },
				});
				if (!extraFcr) {
					return NextResponse.json(
						{ message: "You cannot replace costs for this FCR" },
						{ status: 403 },
					);
				}
			}
		}

		// Pre-fetch fee types to check for isNotDefault
		const feeTypeIds = [
			...new Set(rows.map((r) => r.feeTypeId).filter(Boolean)),
		];
		const feeTypes = await prismaRPA.vendorFeeType.findMany({
			where: { id: { in: feeTypeIds as string[] } },
			select: { id: true, isNotDefault: true },
		});
		const feeTypeMap = new Map(
			feeTypes.map((ft) => [ft.id, ft.isNotDefault === true]),
		);

		await prismaRPA.$transaction(async (tx) => {
			// Delete existing PENDING rows for the targeted FCRs
			// REJECTED rows are kept as history, APPROVED rows are never touched
			if (replaceForFcrIds.length > 0) {
				await tx.vendorCost.deleteMany({
					where: {
						fcrId: { in: replaceForFcrIds },
						OR: [{ vendorId: null }, { vendorId: context.vendor.id }],
						status: "PENDING",
						isSelling: false,
						...(isDisbursementMode !== null
							? { isDisbursement: isDisbursementMode }
							: {}),
					},
				});
			}

			// Upsert / create rows
			for (const row of rows) {
				const fcr = allowedFcrMap.get(row.fcrId);
				if (!fcr || !fcr.truckingFollowUpId) continue;

				const isNotDefault = row.feeTypeId
					? !!feeTypeMap.get(row.feeTypeId)
					: false;

				const payload = {
					truckingFollowUpId: fcr.truckingFollowUpId,
					fcrId: row.fcrId,
					vendorId: context.vendor.id,
					feeTypeId: row.feeTypeId || null,
					feeName: row.feeName || "",
					// Phí ngoài default luôn được coi là disbursement (tách khỏi cước vận chuyển)
					isDisbursement: isNotDefault ? true : Boolean(row.isDisbursement),
					vatPercent: normalizeNumber(row.vatPercent),
					totalVat: normalizeNumber(row.totalVat),
					totalFee: normalizeNumber(row.totalFee),
					sellerTaxCode: row.sellerTaxCode || null,
					invoiceNumber: row.invoiceNumber || null,
					invoiceLink: row.invoiceLink || null,
					trackingCode: row.trackingCode || null,
					invoiceSentDate: row.invoiceSentDate || null,
					note: row.note || null,
					rowOrder: row.rowOrder && row.rowOrder > 0 ? row.rowOrder : 1,
					entryMode: mode,
					createdByVendor: context.vendor.name,
				};

				if (row.id && replaceForFcrIds.length === 0) {
					// Only try to update existing row if we did NOT do a delete-replace
					const existing = await tx.vendorCost.findUnique({
						where: { id: row.id },
						select: { id: true, fcrId: true, status: true },
					});

					if (!existing || existing.fcrId !== row.fcrId) {
						throw new Error("FORBIDDEN_COST_ROW");
					}

					// Block editing APPROVED rows
					if (existing.status === "APPROVED") {
						throw new Error("COST_ALREADY_APPROVED");
					}

					await tx.vendorCost.update({
						where: { id: row.id },
						data: {
							...payload,
							// Reset status to PENDING and clear review info on vendor update
							status: "PENDING",
							rejectionReason: null,
							reviewedById: null,
							reviewedAt: null,
						},
					});
				} else {
					await tx.vendorCost.create({ data: payload });
				}
			}
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		if (error instanceof Error && error.message === "COST_ALREADY_APPROVED") {
			return NextResponse.json(
				{ message: "Phí này đã được duyệt, không thể chỉnh sửa." },
				{ status: 403 },
			);
		}

		if (error instanceof Error && error.message === "FORBIDDEN_REPLACE_FCR") {
			return NextResponse.json(
				{ message: "You cannot replace costs for this FCR" },
				{ status: 403 },
			);
		}

		if (error instanceof Error && error.message === "FORBIDDEN_COST_ROW") {
			return NextResponse.json(
				{ message: "You cannot update this cost row" },
				{ status: 403 },
			);
		}

		console.error("Failed to save vendor costs:", error);
		return NextResponse.json(
			{ message: "Failed to save vendor costs" },
			{ status: 500 },
		);
	}
}
