import { type NextRequest, NextResponse } from "next/server";
import { logFollowUpActivity } from "@/lib/activity-logger";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

export async function PATCH(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { id, type, data } = body;

		if (!id || !data) {
			return NextResponse.json(
				{ message: "Missing id or data" },
				{ status: 400 },
			);
		}

		let updatedRecord;

		if (type === "trucking") {
			updatedRecord = await prismaRPA.truckingFollowUp.update({
				where: { id },
				data: data,
			});
			// Log activity for trucking
			await prismaRPA.truckingActivityLog.create({
				data: {
					truckingFollowUpId: id,
					userId: session.user.id,
					userName: session.user.name,
					action: "GEMINI_AUTO_FILL",
					field: "multiple",
					newValue: data,
				},
			});
		} else {
			// Separate cargoList from general data if present
			const { cargoList, ...restData } = data;

			await prismaRPA.$transaction(async (tx) => {
				// 1. Update general FollowUp fields
				updatedRecord = await tx.followUp.update({
					where: { id },
					data: restData,
				});

				// 2. Sync Cargo List if provided
				if (Array.isArray(cargoList)) {
					// Delete existing
					await tx.cargoList.deleteMany({
						where: { followUpId: id },
					});

					// Create new ones
					if (cargoList.length > 0) {
						await tx.cargoList.createMany({
							data: cargoList.map((item: any) => ({
								followUpId: id,
								customCode: item.customCode || null,
								vietnameseName: item.vietnameseName || null,
								hsCode: item.hsCode || null,
								originalCountry: item.originalCountry || null,
								originalCargoName: item.originalCargoName || null,
								dutyReductionCode: item.dutyReductionCode || null,
								imExDutyExemptionCode: item.imExDutyExemptionCode || null,
								qty: typeof item.qty === "number" ? item.qty : null,
								unit: item.unit || null,
								qty2: typeof item.qty2 === "number" ? item.qty2 : null,
								unit2: item.unit2 || null,
								unitPrice:
									typeof item.unitPrice === "number" ? item.unitPrice : null,
								totalPrice:
									typeof item.totalPrice === "number" ? item.totalPrice : null,
								lineTaxableValue:
									typeof item.lineTaxableValue === "number"
										? item.lineTaxableValue
										: null,
								exportTaxRatePercent:
									typeof item.exportTaxRatePercent === "number"
										? item.exportTaxRatePercent
										: null,
								exportTaxAmount:
									typeof item.exportTaxAmount === "number"
										? item.exportTaxAmount
										: null,
								taxableUnitPrice:
									typeof item.taxableUnitPrice === "number"
										? item.taxableUnitPrice
										: null,
								importTaxCode: item.importTaxCode || null,
								importTaxRate:
									typeof item.importTaxRate === "number"
										? item.importTaxRate
										: null,
								importTaxAmount:
									typeof item.importTaxAmount === "number"
										? item.importTaxAmount
										: null,
								vatTaxCode: item.vatTaxCode || null,
								vatTaxRate:
									typeof item.vatTaxRate === "number" ? item.vatTaxRate : null,
								vatTaxAmount:
									typeof item.vatTaxAmount === "number"
										? item.vatTaxAmount
										: null,
								imExDutyExemptionCondition:
									item.imExDutyExemptionCondition || null,
								imExDutyExemptionAmount:
									typeof item.imExDutyExemptionAmount === "number"
										? item.imExDutyExemptionAmount
										: null,
								importer: item.importer || null,
								packageQty:
									typeof item.packageQty === "number" ? item.packageQty : null,
								packageType: item.packageType || null,
								grossWeight:
									typeof item.grossWeight === "number"
										? item.grossWeight
										: null,
								invoiceNo: item.invoiceNo || null,
								invoiceDate: item.invoiceDate
									? new Date(item.invoiceDate)
									: null,
								term: item.term || null,
							})),
						});
					}
				}
			});

			// Log activity for followup
			logFollowUpActivity(id, {
				userId: session.user.id,
				userName: session.user.name,
				action: "GEMINI_AUTO_FILL",
				field: "multiple",
				newValue: JSON.stringify(data),
			});
		}

		return NextResponse.json(updatedRecord, { status: 200 });
	} catch (error: any) {
		console.error("Bulk update error:", error);
		return NextResponse.json({ message: error.message }, { status: 500 });
	}
}
