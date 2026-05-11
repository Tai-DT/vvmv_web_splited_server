import { type NextRequest, NextResponse } from "next/server";
import { checkJobInvoice } from "@/lib/erp/check-invoice";

/**
 * GET /api/erp/check-invoice?job=HANLOGE260303520
 *
 * Checks whether a job_number already has customer invoices issued in ERP.
 *
 * Response:
 *   200 { jobNumber, hasInvoice, totalCount }
 *   400 { error: "..." }   — job parameter missing
 *   500 { error: "..." }   — ERP query failed
 *
 * Usage example (validate before FAST Input / Trucking Input actions):
 *   const { hasInvoice } = await fetch(`/api/erp/check-invoice?job=${jobNumber}`).then(r => r.json());
 *   if (hasInvoice) { showError("Không thể thao tác vì đã xuất hóa đơn thu khách!"); return; }
 */
export async function GET(request: NextRequest) {
	const { searchParams } = request.nextUrl;
	const job = searchParams.get("job")?.trim();

	if (!job) {
		return NextResponse.json(
			{ error: "Thiếu tham số bắt buộc: job" },
			{ status: 400 },
		);
	}

	try {
		const result = await checkJobInvoice(job);
		return NextResponse.json(result);
	} catch (error: any) {
		console.error(`[check-invoice] ERP query failed for job ${job}:`, error);
		return NextResponse.json(
			{ error: error?.message ?? "Lỗi kết nối ERP" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/erp/check-invoice
 * Body: { job: "HANLOGE260303520" }
 *
 * Same logic as GET but accepts JSON body — useful for batch-style callers
 * or when job number may contain characters awkward in query strings.
 */
export async function POST(request: NextRequest) {
	let body: { job?: string };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{ error: "Request body không hợp lệ (cần JSON)" },
			{ status: 400 },
		);
	}

	const job = body.job?.trim();
	if (!job) {
		return NextResponse.json(
			{ error: "Thiếu trường bắt buộc: job" },
			{ status: 400 },
		);
	}

	try {
		const result = await checkJobInvoice(job);
		return NextResponse.json(result);
	} catch (error: any) {
		console.error(`[check-invoice] ERP query failed for job ${job}:`, error);
		return NextResponse.json(
			{ error: error?.message ?? "Lỗi kết nối ERP" },
			{ status: 500 },
		);
	}
}
