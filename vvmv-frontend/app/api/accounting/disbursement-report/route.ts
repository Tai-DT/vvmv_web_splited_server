import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const from = searchParams.get("from");
		const to = searchParams.get("to");
		const approvalStatus = searchParams.get("approvalStatus"); // "ALL" | "APPROVED" | "PENDING"
		const clientType = searchParams.get("clientType"); // "ALL" | "VVMV" | "CLIENT"
		const clientSearch = searchParams.get("clientSearch"); // free-text search on companyName / taxCode

		// ----- Build FCR date filter -----
		const fcrDateFilter: any = {};
		if (from) fcrDateFilter.gte = new Date(`${from}T00:00:00`);
		if (to) fcrDateFilter.lte = new Date(`${to}T23:59:59.999`);

		// ----- Build VendorCost status filter -----
		const costStatusFilter: any = { isDisbursement: true };
		if (approvalStatus === "APPROVED") {
			costStatusFilter.status = "APPROVED";
		} else if (approvalStatus === "PENDING") {
			costStatusFilter.status = "PENDING";
		}
		// ALL → no status filter

		// ----- clientType: filter by vatPercent on VendorCost -----
		// VVMV: vatPercent = 8 | 5 | null (N = không chịu thuế)
		// CLIENT: any other vatPercent value (e.g. 0)
		if (clientType === "VVMV") {
			costStatusFilter.OR = [{ vatPercent: 8 }, { vatPercent: 5 }];
		} else if (clientType === "CLIENT") {
			costStatusFilter.AND = [{ NOT: { vatPercent: { in: [8, 5] } } }];
		}

		// ----- Build TruckingFollowUp filter -----
		const truckingWhere: any = { isDeleted: false };

		// Client text search
		if (clientSearch?.trim()) {
			const s = clientSearch.trim();
			truckingWhere.AND = [
				...(truckingWhere.AND || []),
				{
					OR: [
						{ companyName: { contains: s, mode: "insensitive" } },
						{ taxCode: { contains: s, mode: "insensitive" } },
						{ invoiceTaxCode: { contains: s, mode: "insensitive" } },
						{ jobNumber: { contains: s, mode: "insensitive" } },
						{ requestNumber: { contains: s, mode: "insensitive" } },
					],
				},
			];
		}

		// ----- FCR where -----
		const fcrWhere: any = {};
		if (Object.keys(fcrDateFilter).length > 0) {
			fcrWhere.implementationDate = fcrDateFilter;
		}

		// ----- Fetch data -----
		// We query VendorCost joining FCR → TruckingFollowUp
		const costs = await prismaRPA.vendorCost.findMany({
			where: {
				...costStatusFilter,
				fcr: {
					...fcrWhere,
					truckingFollowUp: truckingWhere,
				},
			},
			include: {
				fcr: {
					select: {
						id: true,
						fcrNumber: true,
						implementationDate: true,
						plateNumber: true,
						vendor: true,
						truckingFollowUpId: true,
						truckingFollowUp: {
							select: {
								id: true,
								jobNumber: true,
								requestNumber: true,
								companyName: true,
								taxCode: true,
								invoiceTaxCode: true,
								serviceMode: true,
								operationType: true,
								billOrBooking: true,
							},
						},
					},
				},
				vendor: { select: { name: true } },
				feeType: { select: { name: true } },
				reviewer: { select: { name: true, email: true } },
			},
			orderBy: [
				{ fcr: { implementationDate: "asc" } },
				{ rowOrder: "asc" },
				{ createdAt: "asc" },
			],
		});

		// ----- Aggregate summary by TruckingFollowUp -----
		type Summary = {
			truckingFollowUpId: string;
			jobNumber: string | null;
			requestNumber: string | null;
			companyName: string | null;
			taxCode: string | null;
			invoiceTaxCode: string | null;
			serviceMode: string | null;
			totalFee: number;
			totalVat: number;
			totalAmount: number;
			approvedAmount: number;
			pendingAmount: number;
		};

		const summaryMap = new Map<string, Summary>();
		for (const cost of costs) {
			const key = cost.fcr.truckingFollowUpId;
			if (!key) continue; // skip orphaned FCR rows with no parent job
			if (!summaryMap.has(key)) {
				summaryMap.set(key, {
					truckingFollowUpId: key,
					jobNumber: cost.fcr.truckingFollowUp?.jobNumber ?? null,
					requestNumber: cost.fcr.truckingFollowUp?.requestNumber ?? null,
					companyName: cost.fcr.truckingFollowUp?.companyName ?? null,
					taxCode: cost.fcr.truckingFollowUp?.taxCode ?? null,
					invoiceTaxCode: cost.fcr.truckingFollowUp?.invoiceTaxCode ?? null,
					serviceMode: cost.fcr.truckingFollowUp?.serviceMode ?? null,
					totalFee: 0,
					totalVat: 0,
					totalAmount: 0,
					approvedAmount: 0,
					pendingAmount: 0,
				});
			}
			const s = summaryMap.get(key)!;
			const fee = cost.totalFee ?? 0;
			const vat = cost.totalVat ?? 0;
			s.totalFee += fee;
			s.totalVat += vat;
			s.totalAmount += fee;
			if (cost.status === "APPROVED") s.approvedAmount += fee;
			else if (cost.status === "PENDING") s.pendingAmount += fee;
		}

		const summary = Array.from(summaryMap.values());

		// Grand totals
		const grandTotal = {
			totalFee: costs.reduce((a, c) => a + (c.totalFee ?? 0), 0),
			totalVat: costs.reduce((a, c) => a + (c.totalVat ?? 0), 0),
			totalAmount: costs.reduce((a, c) => a + (c.totalFee ?? 0), 0),
			approvedAmount: costs
				.filter((c) => c.status === "APPROVED")
				.reduce((a, c) => a + (c.totalFee ?? 0), 0),
			pendingAmount: costs
				.filter((c) => c.status === "PENDING")
				.reduce((a, c) => a + (c.totalFee ?? 0), 0),
			count: costs.length,
		};

		return NextResponse.json({
			costs,
			summary,
			grandTotal,
		});
	} catch (error) {
		console.error("Disbursement report error:", error);
		return NextResponse.json(
			{ message: "Internal server error" },
			{ status: 500 },
		);
	}
}
