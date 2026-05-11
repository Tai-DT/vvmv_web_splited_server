import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

type EportShipItem = {
	SITE_ID?: string;
	VESSELNAME?: string;
	IN_OUT_VOYAGE?: string;
	CLOSING_TIME?: string;
	CLOSING_TIME_ICD?: string;
};

type EportResponse = {
	type?: string;
	content?: string;
	model?: EportShipItem[];
};

type VesselContainerLite = {
	id: string;
	vesselName: string | null;
	veselNumber: string | null;
};

function normalizeText(input: string): string {
	return input
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toUpperCase()
		.trim();
}

function detectSiteId(
	deliveryValue?: string | null,
): "CTL" | "GNL" | "THP" | "TOT" {
	const normalized = normalizeText(deliveryValue ?? "");
	if (normalized.includes("GIANG NAM")) {
		return "GNL";
	} else if (
		normalized.includes("CANG CAT LAI") ||
		normalized.includes("CAT LAI")
	) {
		return "CTL";
	} else if (
		normalized.includes("HPHUOC") ||
		normalized.includes("HIEP PHUOC")
	) {
		return "THP";
	} else if (normalized.includes("VNTTT") || normalized.includes("TAN THIEN")) {
		return "TOT";
	}
	return "GNL";
}

function parseVnDateTimeToIso(value?: string | null): string | null {
	if (!value) return null;

	// Accept strings like:
	// "05:30 20/03/2026"
	// "EST (dự kiến): 07:59 30/03/2026"
	const match = value.match(
		/(\d{1,2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/,
	);
	if (!match) return null;

	const hour = Number(match[1]);
	const minute = Number(match[2]);
	const day = Number(match[3]);
	const month = Number(match[4]);
	const year = Number(match[5]);

	if (
		Number.isNaN(hour) ||
		Number.isNaN(minute) ||
		Number.isNaN(day) ||
		Number.isNaN(month) ||
		Number.isNaN(year)
	) {
		return null;
	}

	// Preserve exact clock time from source without timezone shifting.
	// (Same strategy used by parseDateTimeVN in UI)
	const d = String(day).padStart(2, "0");
	const m = String(month).padStart(2, "0");
	const h = String(hour).padStart(2, "0");
	const min = String(minute).padStart(2, "0");
	return `${year}-${m}-${d}T${h}:${min}:00.000Z`;
}

function splitCandidates(value?: string | null): string[] {
	if (!value) return [];
	return value
		.split(/[\n,;]+/)
		.map((v) => v.trim())
		.filter(Boolean);
}

/**
 * POST /api/trucking-followup/tra-tau
 *
 * 1) siteId from first FCR.deliveryAt containing "CẢNG CÁT LÁI" => CTL, otherwise GNL
 * 2) vesselName from first Container with value
 * 3) call ePort Searcher API
 * 4) match item by Container.veselNumber contained in IN_OUT_VOYAGE
 * 5) return CLOSING_TIME (CTL) or CLOSING_TIME_ICD (non-CTL)
 */
export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const {
			jobNumber,
			vesselName: inputVesselName,
			veselNumber: inputVeselNumber,
		} = body;

		if (!jobNumber || typeof jobNumber !== "string") {
			return NextResponse.json(
				{ success: false, message: "Missing required field: jobNumber" },
				{ status: 400 },
			);
		}

		const trucking = await prismaRPA.truckingFollowUp.findFirst({
			where: { jobNumber, isDeleted: false },
			include: {
				fcrs: {
					orderBy: { id: "asc" },
					select: { deliveryAt: true },
				},
				containers: {
					orderBy: { createdAt: "asc" },
					select: { id: true, vesselName: true, veselNumber: true },
				},
			},
		});

		if (!trucking) {
			return NextResponse.json(
				{
					success: false,
					message: `Không tìm thấy Trucking Follow-up cho job ${jobNumber}`,
				},
				{ status: 404 },
			);
		}

		if ((trucking.operationType || "").toUpperCase() !== "XUAT") {
			return NextResponse.json(
				{
					success: false,
					message: "Action Tra tàu chỉ áp dụng cho hàng xuất (XUAT).",
				},
				{ status: 200 },
			);
		}

		const firstFcrWithDelivery = trucking.fcrs.find((f) =>
			Boolean(f.deliveryAt?.trim()),
		);
		const siteId = detectSiteId(firstFcrWithDelivery?.deliveryAt ?? null);

		// Merge containers from trucking + related logistics follow-ups
		const mergedContainers: VesselContainerLite[] = [...trucking.containers];
		const orConditions: Array<{
			requestTruckingNo?: string;
			jobNumber?: string;
		}> = [];
		if (trucking.requestNumber) {
			orConditions.push({ requestTruckingNo: trucking.requestNumber });
		}
		if (trucking.jobNumber) {
			orConditions.push({ jobNumber: trucking.jobNumber });
		}

		if (orConditions.length > 0) {
			const relatedFollowUps = await prismaRPA.followUp.findMany({
				where: { OR: orConditions, isDeleted: false },
				include: {
					containers: {
						orderBy: { createdAt: "asc" },
						select: { id: true, vesselName: true, veselNumber: true },
					},
				},
			});

			for (const followUp of relatedFollowUps) {
				for (const container of followUp.containers) {
					if (!mergedContainers.some((c) => c.id === container.id)) {
						mergedContainers.push(container);
					}
				}
			}
		}

		const firstContainerWithVesselName = mergedContainers.find((c) =>
			Boolean(c.vesselName?.trim()),
		);
		const firstContainerWithVesselNumber = mergedContainers.find((c) =>
			Boolean(c.veselNumber?.trim()),
		);

		const vesselName =
			(typeof inputVesselName === "string" && inputVesselName.trim()
				? inputVesselName.trim()
				: null) ||
			firstContainerWithVesselName?.vesselName?.trim() ||
			splitCandidates(trucking.vesselName)[0] ||
			null;
		const hasInputVesselNumber =
			typeof inputVeselNumber === "string" && Boolean(inputVeselNumber.trim());
		const vesselNumberCandidates = hasInputVesselNumber
			? splitCandidates(inputVeselNumber)
			: [
					...(firstContainerWithVesselNumber?.veselNumber
						? splitCandidates(firstContainerWithVesselNumber.veselNumber)
						: []),
					...splitCandidates(trucking.veselNumber),
				];
		const vesselNumber = vesselNumberCandidates[0] || null;

		if (!vesselName) {
			return NextResponse.json(
				{
					success: false,
					message: "Không tìm thấy Tên tàu (vesselName) trong Container.",
					data: {
						siteId,
						mergedContainerCount: mergedContainers.length,
					},
				},
				{ status: 200 },
			);
		}

		const eportResponse = await fetch(
			"https://eport.saigonnewport.com.vn/ships/Searcher",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: JSON.stringify({
					siteId,
					vesselName,
				}),
			},
		);

		if (!eportResponse.ok) {
			return NextResponse.json(
				{
					success: false,
					message: `Tra tàu thất bại: API ePort trả về ${eportResponse.status}`,
					data: { siteId, vesselName, vesselNumber },
				},
				{ status: 200 },
			);
		}

		const result = (await eportResponse.json()) as EportResponse;
		const model = Array.isArray(result.model) ? result.model : [];

		if (result.type !== "success" || model.length === 0) {
			return NextResponse.json(
				{
					success: false,
					message: "Không có dữ liệu tàu từ ePort.",
					data: { siteId, vesselName, vesselNumber },
				},
				{ status: 200 },
			);
		}

		const normalizedVesselNos = vesselNumberCandidates
			.map((v) => normalizeText(v))
			.filter(Boolean);

		// Tách số chuyến theo loại hàng xuất/nhập
		function extractVoyagePart(
			voyage: string | undefined | null,
			type: "XUAT" | "NHAP",
		) {
			if (!voyage) return "";
			const parts = voyage.split("-").map((p) => p.trim());
			if (parts.length === 2) {
				return type === "XUAT" ? parts[1] : parts[0];
			}
			return voyage.trim();
		}

		const opType = (trucking.operationType || "").toUpperCase();
		const matchedItem = normalizedVesselNos.length
			? model.find((item) => {
					const voyageRaw = item.IN_OUT_VOYAGE ?? "";
					const voyagePart = normalizeText(
						extractVoyagePart(voyageRaw, opType === "XUAT" ? "XUAT" : "NHAP"),
					);
					return normalizedVesselNos.some((v) => voyagePart.includes(v));
				})
			: undefined;

		if (!matchedItem) {
			return NextResponse.json(
				{
					success: false,
					message: vesselNumber
						? `Không tìm thấy chuyến phù hợp: ${vesselNumber}`
						: "Không có Số chuyến (veselNumber) trong Container để đối chiếu.",
					data: { siteId, vesselName, vesselNumber },
				},
				{ status: 200 },
			);
		}

		const closingField = siteId === "CTL" ? "CLOSING_TIME" : "CLOSING_TIME_ICD";
		const closingTimeRaw =
			closingField === "CLOSING_TIME"
				? matchedItem.CLOSING_TIME
				: matchedItem.CLOSING_TIME_ICD;
		const closingTimeIso = parseVnDateTimeToIso(closingTimeRaw);

		if (!closingTimeIso) {
			return NextResponse.json(
				{
					success: false,
					message: `Không đọc được ${closingField} từ kết quả ePort.`,
					data: {
						siteId,
						vesselName,
						vesselNumber,
						matchedVoyage: matchedItem.IN_OUT_VOYAGE?.trim() ?? null,
						closingField,
						closingTimeRaw: closingTimeRaw?.trim() ?? null,
					},
				},
				{ status: 200 },
			);
		}

		return NextResponse.json(
			{
				success: true,
				message: "Tra tàu thành công",
				data: {
					siteId,
					vesselName,
					vesselNumber,
					matchedVoyage: matchedItem.IN_OUT_VOYAGE?.trim() ?? null,
					closingField,
					closingTimeRaw: closingTimeRaw?.trim() ?? null,
					closingTimeIso,
				},
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error("Error in tra-tau endpoint:", error);
		return NextResponse.json(
			{
				success: false,
				message:
					error instanceof Error ? error.message : "Có lỗi xảy ra khi tra tàu",
			},
			{ status: 500 },
		);
	}
}
