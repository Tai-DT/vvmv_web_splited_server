import { type NextRequest, NextResponse } from "next/server";
import { logFollowUpActivity } from "@/lib/activity-logger";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { checkFollowUpPermission } from "@/lib/followup/check-permission";

function normalizeOptionalString(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}

	const normalized = value.trim();
	return normalized === "" ? null : normalized;
}

function normalizeOptionalNumber(value: unknown): number | null {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}

	if (typeof value !== "string") {
		return null;
	}

	const normalized = value.trim();
	if (normalized === "") {
		return null;
	}

	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : null;
}

function createStableUtcDate(
	year: number,
	monthIndex: number,
	day: number,
): Date | null {
	const date = new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
	return Number.isNaN(date.getTime()) ? null : date;
}

// Helper function to safely parse date strings
function parseDate(dateValue: unknown): Date | null {
	const dateString = normalizeOptionalString(dateValue);
	if (!dateString || dateString.trim() === "") {
		return null;
	}

	// Try to parse as is first
	const date = new Date(dateString);
	if (!Number.isNaN(date.getTime())) {
		return date;
	}

	// Try DD/MM/YYYY format (common in Vietnam)
	const ddmmyyyyMatch = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (ddmmyyyyMatch) {
		const [, day, month, year] = ddmmyyyyMatch;
		return createStableUtcDate(Number(year), Number(month) - 1, Number(day));
	}

	// Try DD-MM-YYYY format
	const ddmmyyyyDashMatch = dateString.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
	if (ddmmyyyyDashMatch) {
		const [, day, month, year] = ddmmyyyyDashMatch;
		return createStableUtcDate(Number(year), Number(month) - 1, Number(day));
	}

	return null;
}

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await auth.api.getSession({ headers: req.headers });
		if (!session?.user)
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

		const { id } = await params;
		const body = await req.json();
		const items = Array.isArray(body?.items)
			? (body.items as Array<Record<string, unknown>>)
			: null;

		if (!items) {
			return NextResponse.json(
				{ error: "Invalid items format" },
				{ status: 400 },
			);
		}

		const permission = await checkFollowUpPermission(
			id,
			session.user.id,
			session.user.role ?? "",
		);

		if (!permission.ok) {
			return NextResponse.json(
				{ error: permission.error },
				{ status: permission.status },
			);
		}

		// Use transaction to ensure all or nothing
		await prismaRPA.$transaction(async (tx) => {
			// 1. Delete existing items for this follow-up
			await tx.cargoList.deleteMany({
				where: { followUpId: id },
			});

			// 2. Create new items
			if (items.length > 0) {
				await tx.cargoList.createMany({
					data: items.map((item) => ({
						followUpId: id,
						customCode: normalizeOptionalString(item.customCode),
						hsCode: normalizeOptionalString(item.hsCode),
						originalCountry: normalizeOptionalString(item.originalCountry),
						originalCargoName: normalizeOptionalString(item.originalCargoName),
						dutyReductionCode: normalizeOptionalString(item.dutyReductionCode),
						imExDutyExemptionCode: normalizeOptionalString(
							item.imExDutyExemptionCode,
						),
						qty: normalizeOptionalNumber(item.qty),
						unit: normalizeOptionalString(item.unit),
						unitPrice: normalizeOptionalNumber(item.unitPrice),
						totalPrice: normalizeOptionalNumber(item.totalPrice),
						lineTaxableValue: normalizeOptionalNumber(item.lineTaxableValue),
						exportTaxRatePercent: normalizeOptionalNumber(
							item.exportTaxRatePercent,
						),
						exportTaxAmount: normalizeOptionalNumber(item.exportTaxAmount),
						taxableUnitPrice: normalizeOptionalNumber(item.taxableUnitPrice),
						qty2: normalizeOptionalNumber(item.qty2),
						unit2: normalizeOptionalString(item.unit2),
						vietnameseName: normalizeOptionalString(item.vietnameseName),
						importTaxCode: normalizeOptionalString(item.importTaxCode),
						importTaxRate: normalizeOptionalNumber(item.importTaxRate),
						importTaxAmount: normalizeOptionalNumber(item.importTaxAmount),
						vatTaxCode: normalizeOptionalString(item.vatTaxCode),
						vatTaxRate: normalizeOptionalNumber(item.vatTaxRate),
						vatTaxAmount: normalizeOptionalNumber(item.vatTaxAmount),
						imExDutyExemptionCondition: normalizeOptionalString(
							item.imExDutyExemptionCondition,
						),
						imExDutyExemptionAmount: normalizeOptionalNumber(
							item.imExDutyExemptionAmount,
						),
						importer: normalizeOptionalString(item.importer),
						packageQty: normalizeOptionalNumber(item.packageQty),
						packageType: normalizeOptionalString(item.packageType),
						grossWeight: normalizeOptionalNumber(item.grossWeight),
						invoiceNo: normalizeOptionalString(item.invoiceNo),
						invoiceDate: parseDate(item.invoiceDate),
						term: normalizeOptionalString(item.term),
					})),
				});
			}
		});

		// Log activity (fire-and-forget)
		logFollowUpActivity(id, {
			userId: session.user.id,
			userName: session.user.name,
			action: "UPDATE_CARGO_LIST",
			newValue: { itemCount: items.length },
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error saving cargo list:", error);
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : "Internal Server Error",
			},
			{ status: 500 },
		);
	}
}

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;
		const items = await prismaRPA.cargoList.findMany({
			where: { followUpId: id },
			orderBy: { createdAt: "asc" },
		});

		return NextResponse.json(items);
	} catch (error) {
		console.error("Error fetching cargo list:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 },
		);
	}
}
