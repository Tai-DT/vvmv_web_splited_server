import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

const SOAP_URL = "http://103.248.160.15:8088/TraCuuNopThue/TraCuuTTGNT.asmx";
const SOAP_ACTION = "http://tempuri.org/WSProcess";

/**
 * POST /api/followup/check-quan-kvgs
 * Checks port clearance (KVGS) status via SOAP API and updates declaration records
 */
export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { jobNumber } = body;

		if (!jobNumber) {
			return NextResponse.json(
				{ message: "Job Number is required" },
				{ status: 400 },
			);
		}

		// 1. Get follow-up with its declarations
		const followUp = await prismaRPA.followUp.findFirst({
			where: { jobNumber, isDeleted: false },
			include: {
				declarations: true,
			},
		});

		if (!followUp || !followUp.declarations.length) {
			return NextResponse.json(
				{
					message: "No declarations found for this job",
					success: false,
				},
				{ status: 404 },
			);
		}

		const results = [];
		let updatedCount = 0;
		const pendingReasonDecIds = new Set<string>(); // IDs of declarations that should trigger Pending status

		// 2. Process each declaration
		for (const dec of followUp.declarations) {
			const cleanMstClient = dec.mstClient?.replaceAll("-", "").trim();

			if (!dec.declarationNumber || !cleanMstClient) {
				pendingReasonDecIds.add(dec.id);
				results.push({
					declarationNumber: dec.declarationNumber || "N/A",
					status: "Skipped",
					message: "Missing Declaration Number or MST Client",
				});
				continue;
			}

			// 3. Find partner CCCD - check both original and clean MST to be safe
			const partner = await prismaRPA.partnersMasterData.findFirst({
				where: {
					OR: [{ taxCode: dec.mstClient || "" }, { taxCode: cleanMstClient }],
				},
				select: { cccd: true, enableKVGS: true },
			});

			if (!partner || !partner.cccd || partner.enableKVGS === false) {
				pendingReasonDecIds.add(dec.id);
				const message =
					!partner || !partner.cccd
						? `CCCD not found for MST: ${cleanMstClient}`
						: `TQ/KVGS check disabled for partner: ${cleanMstClient}`;

				results.push({
					declarationNumber: dec.declarationNumber,
					status: partner?.enableKVGS === false ? "Info" : "Error",
					message,
				});
				continue;
			}

			// 4. Call SOAP API
			try {
				const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
    <soap:Body>
        <WSProcess xmlns="http://tempuri.org/">
            <msg>&lt;CUSTOMS&gt;&lt;FUNTION&gt;5&lt;/FUNTION&gt;&lt;DATA&gt;&lt;SO_TK&gt;${dec.declarationNumber}&lt;/SO_TK&gt;&lt;MA_DV&gt;${cleanMstClient}&lt;/MA_DV&gt;&lt;SO_CMT&gt;${partner.cccd}&lt;/SO_CMT&gt;&lt;/DATA&gt;&lt;/CUSTOMS&gt;</msg>
        </WSProcess>
    </soap:Body>
</soap:Envelope>`;

				const response = await fetch(SOAP_URL, {
					method: "POST",
					headers: {
						"Content-Type": "text/xml; charset=utf-8",
						SOAPAction: SOAP_ACTION,
					},
					body: xmlBody,
				});

				if (!response.ok) {
					throw new Error(`HTTP Error: ${response.status}`);
				}

				const text = await response.text();

				// 5. Parse response for NGAY_QUA_KVGS and NGAY_TQ
				// Format in response: &lt;NGAY_QUA_KVGS&gt;09-01-2026 15:44:26&lt;/NGAY_QUA_KVGS&gt;
				// Format in response: &lt;NGAY_TQ&gt;09-01-2026 15:44:26&lt;/NGAY_TQ&gt;
				const kvgsMatch = text.match(
					/&lt;NGAY_QUA_KVGS&gt;(.*?)&lt;\/NGAY_QUA_KVGS&gt;/,
				);
				const tqMatch = text.match(/&lt;NGAY_TQ&gt;(.*?)&lt;\/NGAY_TQ&gt;/);
				const errorMatch = text.match(
					/&lt;ERROR_MESSAGE&gt;(.*?)&lt;\/ERROR_MESSAGE&gt;/,
				);
				const errorMessage = errorMatch ? errorMatch[1] : "Unknown error";

				// Helper function to parse date string "dd-mm-yyyy hh:mm:ss"
				const parseDate = (dateStr: string): Date | null => {
					if (!dateStr) return null;
					const [datePart, timePart] = dateStr.split(" ");
					if (!datePart) return null;
					const [day, month, year] = datePart.split("-").map(Number);
					const [hour, min, sec] = (timePart || "0:0:0").split(":").map(Number);
					const date = new Date(
						year,
						month - 1,
						day,
						hour || 0,
						min || 0,
						sec || 0,
					);
					return Number.isNaN(date.getTime()) ? null : date;
				};

				const kvgsDate = kvgsMatch?.[1] ? parseDate(kvgsMatch[1]) : null;
				const tqDate = tqMatch?.[1] ? parseDate(tqMatch[1]) : null;

				if (kvgsDate || tqDate) {
					const updateData: any = {};
					if (kvgsDate) updateData.kvgsDate = kvgsDate;
					if (tqDate) updateData.tqDate = tqDate;

					// Update database
					await prismaRPA.declaration.update({
						where: { id: dec.id },
						data: updateData,
					});

					updatedCount++;
					results.push({
						declarationNumber: dec.declarationNumber,
						status: "Success",
						message: "Updated KVGS/TQ Date",
						kvgsDate: kvgsMatch?.[1] || null,
						tqDate: tqMatch?.[1] || null,
					});
				} else {
					results.push({
						declarationNumber: dec.declarationNumber,
						status: "Info",
						message: `No date found. API says: ${errorMessage}`,
					});
				}
			} catch (err: any) {
				pendingReasonDecIds.add(dec.id);
				results.push({
					declarationNumber: dec.declarationNumber,
					status: "Error",
					message: `API Call failed: ${err.message}`,
				});
			}
		}

		// 6. Check for MV_URL and tqDate to queue Invoker task "Downloading MV"
		const updatedFollowUp = await prismaRPA.followUp.findFirst({
			where: { jobNumber, isDeleted: false },
			include: {
				declarations: true,
			},
		});

		if (updatedFollowUp && updatedFollowUp.declarations.length > 0) {
			let allHaveMvUrl = true;
			let hasTqDateButNoMvUrl = false;
			let hasNoMvUrlAndNoTqDate = false;

			for (const dec of updatedFollowUp.declarations) {
				if (!dec.mvUrl) {
					allHaveMvUrl = false;
					const isRedBatch =
						dec.batch?.toLowerCase().includes("đỏ") ||
						dec.batch?.toLowerCase().includes("do");
					const hasPendingReason = pendingReasonDecIds.has(dec.id);

					if (dec.tqDate || isRedBatch || hasPendingReason) {
						hasTqDateButNoMvUrl = true;
					} else {
						hasNoMvUrlAndNoTqDate = true;
					}
				}
			}

			let invokerStatus = "";
			let invokerMessage = "";
			let shouldCreateInvoker = false;

			if (allHaveMvUrl) {
				invokerStatus = "Completed";
				invokerMessage = "FAIL - Đã có đủ mã vạch";
				shouldCreateInvoker = true;
			} else if (hasTqDateButNoMvUrl) {
				invokerStatus = "Pending";
				invokerMessage = "";
				shouldCreateInvoker = true;
			} else if (hasNoMvUrlAndNoTqDate) {
				invokerStatus = "Completed";
				invokerMessage = "FAIL - Tờ khai chưa thông quan";
				shouldCreateInvoker = true;
			}

			if (shouldCreateInvoker) {
				const userAccount = session.user.email || session.user.name || "System";
				await prismaRPA.invoker.create({
					data: {
						taskName: "Downloading MV",
						creator: "FollowUp",
						source: "FollowUp",
						userAccount: userAccount,
						jobNo: jobNumber,
						status: invokerStatus,
						message: invokerMessage,
					},
				});
			}
		}

		return NextResponse.json({
			success: true,
			updatedCount,
			results,
			message: `Processed ${followUp.declarations.length} declarations. Updated ${updatedCount}.`,
		});
	} catch (error: any) {
		console.error("API Error (Check Quan KVGS):", error);
		return NextResponse.json(
			{
				message: "Internal Server Error",
				error: error.message,
			},
			{ status: 500 },
		);
	}
}
