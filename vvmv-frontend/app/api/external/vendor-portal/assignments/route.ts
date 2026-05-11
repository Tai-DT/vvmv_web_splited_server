import { type NextRequest, NextResponse } from "next/server";
import { prismaRPA } from "@/lib/db";
import { getVendorPortalContext } from "@/lib/vendor-portal-auth";

export async function GET(request: NextRequest) {
	try {
		const context = await getVendorPortalContext(request);
		if (!context) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const vendorName = context.vendor.name;

		const fcrs = await prismaRPA.fCR.findMany({
			where: {
				vendor: { equals: vendorName, mode: "insensitive" },
				truckingFollowUp: {
					isDeleted: false,
				},
			},
			include: {
				truckingFollowUp: {
					select: {
						id: true,
						jobNumber: true,
						serviceMode: true,
						requestNumber: true,
						billOrBooking: true,
						pickUpTime: true,
						vendor: true,
						companyName: true,
						isFinished: true,
						// Fallback declarations (used when requestNumber is null)
						declarations: {
							select: {
								id: true,
								declarationNumber: true,
							},
						},
					},
				},
				// Container with its declaration links
				container: {
					select: {
						id: true,
						declarationLinks: {
							select: {
								declaration: {
									select: {
										id: true,
										declarationNumber: true,
									},
								},
							},
						},
					},
				},
				vendorCosts: {
					where: {
						OR: [{ vendorId: null }, { vendorId: context.vendor.id }],
						isSelling: false,
					},
					orderBy: [{ rowOrder: "asc" }, { createdAt: "asc" }],
					select: {
						id: true,
						feeTypeId: true,
						feeName: true,
						isDisbursement: true,
						vatPercent: true,
						totalVat: true,
						totalFee: true,
						sellerTaxCode: true,
						invoiceNumber: true,
						invoiceLink: true,
						trackingCode: true,
						invoiceSentDate: true,
						note: true,
						rowOrder: true,
						entryMode: true,
						createdAt: true,
						updatedAt: true,
						// Status workflow
						status: true,
						rejectionReason: true,
						reviewedById: true,
						reviewedAt: true,
						reviewer: {
							select: { name: true, email: true },
						},
					},
				},
			},
			orderBy: [{ implementationDate: "desc" }, { fcrNumber: "asc" }],
		});

		// Collect all requestNumbers that need FollowUp lookup
		// (FCRs whose container has no declarationLinks AND truckingFollowUp has requestNumber)
		const requestNumbers = [
			...new Set(
				fcrs
					.filter((fcr) => {
						const containerDeclarations = fcr.container?.declarationLinks ?? [];
						return (
							containerDeclarations.length === 0 &&
							fcr.truckingFollowUp?.requestNumber
						);
					})
					.map((fcr) => fcr.truckingFollowUp?.requestNumber!),
			),
		];

		// Batch-fetch FollowUps by requestTruckingNo
		const followUpsMap = new Map<string, string[]>(); // requestNumber → declarationNumbers[]
		if (requestNumbers.length > 0) {
			const followUps = await prismaRPA.followUp.findMany({
				where: {
					requestTruckingNo: { in: requestNumbers },
					isDeleted: false,
				},
				select: {
					requestTruckingNo: true,
					declarations: {
						select: {
							declarationNumber: true,
						},
					},
				},
			});

			for (const fu of followUps) {
				if (!fu.requestTruckingNo) continue;
				const nums = fu.declarations
					.map((d) => d.declarationNumber)
					.filter((n): n is string => Boolean(n));
				// Merge if multiple FollowUps share the same requestTruckingNo
				const existing = followUpsMap.get(fu.requestTruckingNo) ?? [];
				followUpsMap.set(fu.requestTruckingNo, [...existing, ...nums]);
			}
		}

		const data = fcrs.map((fcr) => {
			// Resolve declaration numbers for this FCR
			let declarationNumbers: string[] = [];

			const containerDeclarations = fcr.container?.declarationLinks ?? [];

			if (containerDeclarations.length > 0) {
				// Case 1: Container is explicitly linked to specific declarations
				declarationNumbers = containerDeclarations
					.map((link) => link.declaration.declarationNumber)
					.filter((n): n is string => Boolean(n));
			} else if (fcr.truckingFollowUp?.requestNumber) {
				// Case 2: No container link, but has requestNumber
				// → Get declarations from FollowUp where requestTruckingNo = requestNumber
				declarationNumbers =
					followUpsMap.get(fcr.truckingFollowUp.requestNumber) ?? [];
			} else {
				// Case 3: No container link, no requestNumber
				// → Fallback: declarations directly on TruckingFollowUp
				declarationNumbers = (fcr.truckingFollowUp?.declarations ?? [])
					.map((d) => d.declarationNumber)
					.filter((n): n is string => Boolean(n));
			}

			// Deduplicate
			declarationNumbers = [...new Set(declarationNumbers)];

			return {
				id: fcr.id,
				truckingFollowUpId: fcr.truckingFollowUpId,
				jobNumber: fcr.truckingFollowUp?.jobNumber || null,
				serviceMode: fcr.truckingFollowUp?.serviceMode || null,
				requestNumber: fcr.truckingFollowUp?.requestNumber || null,
				billOrBooking: fcr.truckingFollowUp?.billOrBooking || null,
				fcrNumber: fcr.fcrNumber,
				implementationDate: fcr.implementationDate,
				cbm: fcr.cbm,
				grossWeight: fcr.grossWeight,
				quantity: fcr.quantity,
				containerNo: fcr.containerNo,
				truckType: fcr.truckType,
				plateNumber: fcr.plateNumber,
				shipper: fcr.shipper,
				shipperName: fcr.truckingFollowUp?.companyName || null,
				pickUpTime: fcr.truckingFollowUp?.pickUpTime || null,
				pickupAt: fcr.pickupAt,
				deliveryAt: fcr.deliveryAt,
				vehicleInfo: fcr.vehicleInfo || null,
				isFinished: fcr.truckingFollowUp?.isFinished ?? false,
				declarationNumbers, // Array of declaration numbers for disbursement tab
				costs: fcr.vendorCosts,
			};
		});

		return NextResponse.json({
			vendor: {
				id: context.vendor.id,
				name: context.vendor.name,
				site: context.vendor.site,
			},
			data,
		});
	} catch (error) {
		console.error("Failed to fetch vendor assignments:", error);
		return NextResponse.json(
			{ message: "Failed to fetch vendor assignments" },
			{ status: 500 },
		);
	}
}
