import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { getSiteFromJobNumber } from "@/lib/utils/job-utils";
import type { OperationType, Site } from "@/prisma/client";

// Helper to convert domain/site display value to enum key
function toSiteEnum(value: string | null | undefined): Site | null {
	if (!value || value === "") return null;
	return value as Site;
}

// Helper to convert operation type to enum key
function toOperationTypeEnum(
	value: string | null | undefined,
): OperationType | null {
	if (!value) return null;
	return value as OperationType;
}

// Helper to safely parse date values (handles empty strings)
function toDate(value: string | null | undefined): Date | null {
	if (!value || value === "") return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

// Helper to safely parse float values (allows 0)
function toFloat(value: any): number | null {
	if (value === null || value === undefined || value === "") return null;
	const num = Number.parseFloat(value);
	return Number.isNaN(num) ? null : num;
}

// Helper to safely parse int values (allows 0)
function toInt(value: any): number | null {
	if (value === null || value === undefined || value === "") return null;
	const num = Number.parseInt(value, 10);
	return Number.isNaN(num) ? null : num;
}

/**
 * POST /api/followup/create
 * Create a new followup record in the RPA database
 * Note: Declarations and Containers are read-only (managed by external system)
 */
export async function POST(request: NextRequest) {
	try {
		// 1. Authenticate user with Better Auth
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		// 2. Parse request body
		const body = await request.json();

		// 3. Extract fields from request (FollowUp fields + containers)
		const {
			operationType,
			taxCode,
			driveUrl,
			localPath,
			jobNumber,
			serviceMode,
			companyName,
			notes,
			cargoType,
			cbm,
			pickUpTime,
			deliveryDate,
			truckNumber,
			location,
			supervisionGate,
			handler,
			startTime,
			endTime,
			poNumber,
			note2,
			note3,
			shmtDate,
			domain,
			arNumber,
			// New fields
			pickupLocation,
			loadingLocation,
			transportMethod,
			transportDate,
			taxService,
			coNumber,
			unit,
			workType,
			pol,
			pod,
			warehouse,
			authority,
			billOrBooking,
			quantity,
			supplier,
			grossWeight,
			invoice,
			requestTruckingNo,
			etaEtd,
			// Containers array
			containers,
		} = body;

		// 4. Validate required fields
		if (!operationType || !taxCode) {
			return NextResponse.json(
				{ message: "Missing required fields: operationType and taxCode" },
				{ status: 400 },
			);
		}

		// 4.5 Get user's site for auto-setting domain if not provided
		const user = await prismaRPA.user.findUnique({
			where: { id: session.user.id },
			select: { site: true },
		});
		const userSite = user?.site || null;

		// 4.6 Special check for billOrBooking duplicate
		let siteToCheck = toSiteEnum(domain) || userSite;

		// Override site based on job number prefix if job number exists
		if (jobNumber) {
			siteToCheck = getSiteFromJobNumber(jobNumber);
		}

		if (billOrBooking) {
			const existing = await prismaRPA.followUp.findFirst({
				where: {
					billOrBooking: billOrBooking.toString().trim(),
					isDeleted: false,
					...(siteToCheck ? { domain: siteToCheck } : {}),
				},
				select: { jobNumber: true },
			});

			if (existing) {
				return NextResponse.json(
					{
						message: `Bill/Booking already exists in job ${existing.jobNumber || "unknown"}${siteToCheck ? ` for site ${siteToCheck}` : ""}`,
					},
					{ status: 400 },
				);
			}
		}

		// 5. Resolve warehouse: use provided value, else match companyName, else 1st configured kho for taxCode, else companyName
		let resolvedWarehouse: string | null = warehouse || null;
		if (!resolvedWarehouse && taxCode) {
			const partnerData = await prismaRPA.partnersMasterData.findFirst({
				where: { taxCode },
				select: {
					warehouseConfigs: {
						select: { warehouseName: true },
					},
				},
			});

			if (
				partnerData?.warehouseConfigs &&
				partnerData.warehouseConfigs.length > 0
			) {
				const exactMatch = companyName
					? partnerData.warehouseConfigs.find(
							(w) =>
								w.warehouseName.toLowerCase() === companyName.toLowerCase(),
						)
					: null;

				if (exactMatch) {
					resolvedWarehouse = exactMatch.warehouseName;
				} else {
					const sorted = [...partnerData.warehouseConfigs].sort((a, b) =>
						a.warehouseName.localeCompare(b.warehouseName),
					);
					resolvedWarehouse = sorted[0].warehouseName;
				}
			} else {
				resolvedWarehouse = companyName || null;
			}
		}

		// 6. Pre-compute derived fields
		const parsedEtaEtd = toDate(etaEtd);
		let finalDeliveryDate = toDate(deliveryDate);
		const resolvedDomain = siteToCheck || "SGN";
		if (parsedEtaEtd && !finalDeliveryDate && resolvedDomain === "SGN") {
			const computedDate = new Date(parsedEtaEtd);
			computedDate.setDate(computedDate.getDate() + 2);
			finalDeliveryDate = computedDate;
		}

		// 7. Create followup record with containers
		const followUp = await prismaRPA.followUp.create({
			data: {
				operationType: toOperationTypeEnum(operationType),
				taxCode,
				driveUrl: driveUrl || null,
				localPath: localPath || null,
				jobNumber: jobNumber || null,
				serviceMode: serviceMode || null,
				companyName: companyName || null,
				notes: notes || null,
				cargoType: cargoType || null,
				cbm: toFloat(cbm),
				pickUpTime: pickUpTime || null,
				deliveryDate: finalDeliveryDate,
				truckNumber: truckNumber || null,
				location: location || null,
				supervisionGate: supervisionGate || null,
				handler: handler || session.user.id || null,
				startTime: toDate(startTime),
				endTime: toDate(endTime),
				poNumber: poNumber || null,
				note2: note2 || null,
				note3: note3 || null,
				shmtDate: toDate(shmtDate),
				domain: jobNumber
					? getSiteFromJobNumber(jobNumber)
					: toSiteEnum(domain) || userSite || "SGN",
				arNumber: arNumber || null,
				// New fields
				pickupLocation: pickupLocation || null,
				loadingLocation: loadingLocation || null,
				transportMethod: transportMethod || null,
				transportDate: toDate(transportDate),
				taxService: taxService || null,
				coNumber: coNumber || null,
				unit: unit || null,
				workType: workType || null,
				pol: pol || null,
				pod: pod || null,
				warehouse: resolvedWarehouse,
				authority: authority || null,
				billOrBooking: billOrBooking || null,
				quantity: toInt(quantity),
				supplier: supplier || null,
				invoice: invoice || null,
				requestTruckingNo: requestTruckingNo || null,
				etaEtd: parsedEtaEtd,
				grossWeight: toFloat(grossWeight),
				botMessage: "",
				createdBy: session.user.id,
				// Create containers if provided
				containers:
					containers && containers.length > 0
						? {
								create: (() => {
									const seenNos = new Set<string>();
									const uniqueContainers = [];

									for (const c of containers) {
										const cNo = c.containerNo?.trim().toUpperCase();
										if (cNo) {
											if (seenNos.has(cNo)) {
												throw new Error(
													`Số container ${c.containerNo} bị trùng trong danh sách.`,
												);
											}
											seenNos.add(cNo);
										}
										uniqueContainers.push({
											containerNo: c.containerNo || null,
											sealNo: c.sealNo || null,
											containerSize: c.containerSize || null,
											quantity: toInt(c.quantity) ?? 1,
											grossWeight: toFloat(c.grossWeight),
											warehouse: c.warehouse || resolvedWarehouse || null,
											implementationDate: finalDeliveryDate,
										});
									}
									return uniqueContainers;
								})(),
							}
						: undefined,
			},
			include: {
				declarations: true,
				containers: true,
			},
		});

		// 6. Return created record
		return NextResponse.json(followUp, { status: 201 });
	} catch (error) {
		console.error("Error creating follow-up:", error);
		return NextResponse.json(
			{
				message: "Failed to create follow-up record",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
