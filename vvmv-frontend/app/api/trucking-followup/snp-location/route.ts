import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { formatPlateNumber } from "@/lib/trucking/plate-utils";

const SNP_API_URL =
	"https://eport.saigonnewport.com.vn/ContainerInformation/FindContInfo";

// Mapping from our internal location names to SNP SITE_ID
const LOCATION_TO_SITE_ID: Record<string, string> = {
	CATLAI: "CTL",
	"CAT LAI GIANG NAM": "GNL",
	HPHUOC: "THP",
	VNTTT: "TOT",
};

function _resolveSiteId(
	locationName: string | null | undefined,
): string | null {
	if (!locationName) return null;
	const upper = locationName.trim().toUpperCase();
	for (const [key, siteId] of Object.entries(LOCATION_TO_SITE_ID)) {
		if (upper.includes(key)) return siteId;
	}
	return null;
}

export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { containerNos, siteId, isExport } = body as {
			containerNos: string[];
			siteId: string;
			isExport?: boolean;
		};

		if (
			!containerNos ||
			!Array.isArray(containerNos) ||
			containerNos.length === 0
		) {
			return NextResponse.json(
				{ message: "Thiếu danh sách container" },
				{ status: 400 },
			);
		}

		if (!siteId) {
			return NextResponse.json({ results: [] });
		}

		// Filter out empty strings
		const validNos = containerNos.filter((n) => n?.trim());
		if (validNos.length === 0) {
			return NextResponse.json({ results: [] });
		}

		// Call SNP API
		const formData = new FormData();
		formData.append("IsSearchByBatch", "false");
		formData.append("IsSearchByInYard", "false");
		formData.append("SITE_ID", siteId);
		formData.append("SearchContainerNos", validNos.join(","));

		const snpCookie = process.env.SNP_SESSION_COOKIE || "";

		const snpRes = await fetch(SNP_API_URL, {
			method: "POST",
			headers: snpCookie ? { Cookie: snpCookie } : {},
			body: formData,
		});

		if (!snpRes.ok) {
			return NextResponse.json(
				{ message: `SNP API error: ${snpRes.status}` },
				{ status: 502 },
			);
		}

		const snpData = await snpRes.json();

		if (snpData.ContentType !== "success" || !Array.isArray(snpData.Data)) {
			return NextResponse.json({ results: [] });
		}

		// Build a map keyed by container no.
		// Export: use INGATE event, truckVessel from LOAD_TO_VESSEL
		// Import: use UNLOAD event, truckVessel from TRUCK_VESSEL, plate number from OUTGATE's TRUCK_VESSEL

		const resultMap: Record<
			string,
			{
				location: string | null;
				customClearanceStatus: string | null;
				truckVessel: string | null;
				plateNumber: string | null;
			}
		> = {};

		for (const item of snpData.Data as any[]) {
			const contNo = (item.CONTAINERNO as string)?.trim();
			if (!contNo) continue;

			const eventType = (item.EVENT_TYPE as string)?.trim()?.toUpperCase();
			const imExp = (item.IM_EXP as string)?.trim()?.toUpperCase();
			const targetImExp = isExport ? "EXPORT" : "IMPORT";
			const targetEventTypes = isExport ? ["INGATE"] : ["UNLOAD", "INGATE"];
			if (imExp !== targetImExp) continue;
			// Extract plate number before the IM_EXP/eventType filter
			// Export: plate from INGATE EXPORT's TRUCK_VESSEL
			// Import: plate from OUTGATE's TRUCK_VESSEL (different event, not filtered by targetEventTypes)
			if (isExport && eventType === "INGATE" && imExp === "EXPORT") {
				const plate = formatPlateNumber(item.TRUCK_VESSEL as string);
				if (plate && (!resultMap[contNo] || !resultMap[contNo].plateNumber)) {
					if (!resultMap[contNo]) {
						resultMap[contNo] = {
							location: null,
							customClearanceStatus: null,
							truckVessel: null,
							plateNumber: plate,
						};
					} else {
						resultMap[contNo].plateNumber = plate;
					}
				}
			}
			if (!isExport && eventType === "OUTGATE") {
				const plate = formatPlateNumber(item.TRUCK_VESSEL as string);
				if (plate && (!resultMap[contNo] || !resultMap[contNo].plateNumber)) {
					if (!resultMap[contNo]) {
						resultMap[contNo] = {
							location: null,
							customClearanceStatus: null,
							truckVessel: null,
							plateNumber: plate,
						};
					} else {
						resultMap[contNo].plateNumber = plate;
					}
				}
			}

			// Location/vessel/customs data: must match IM_EXP and target event types
			if (imExp !== targetImExp || !targetEventTypes.includes(eventType))
				continue;

			if (!resultMap[contNo] || !resultMap[contNo].location) {
				const location = (item.LOCATION as string)?.trim();
				const customClearanceStatus = (item.CUST as string)?.trim() || null;
				const truckVessel = isExport
					? (item.LOAD_TO_VESSEL as string)?.trim() || null
					: (item.TRUCK_VESSEL as string)?.trim() || null;
				const existingPlate = resultMap[contNo]?.plateNumber ?? null;
				resultMap[contNo] = {
					location: location || null,
					customClearanceStatus,
					truckVessel,
					plateNumber: existingPlate,
				};
			}
		}

		// Return results in same order as input
		const results = validNos.map((no) => ({
			containerNo: no.trim(),
			location: resultMap[no.trim()]?.location ?? null,
			customClearanceStatus:
				resultMap[no.trim()]?.customClearanceStatus ?? null,
			truckVessel: resultMap[no.trim()]?.truckVessel ?? null,
			plateNumber: resultMap[no.trim()]?.plateNumber ?? null,
		}));

		return NextResponse.json({ results });
	} catch (error) {
		console.error("SNP location error:", error);
		return NextResponse.json(
			{ message: "Lỗi khi tra vị trí cảng" },
			{ status: 500 },
		);
	}
}
