import mammoth from "mammoth";
import { type NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { getFileContent } from "@/lib/google-drive/upload";

export const maxDuration = 180;

function normalizeDateOnly(value: unknown): string | null {
	if (value === null || value === undefined || value === "") return null;
	const v = String(value).trim();
	if (!v) return null;

	// dd/MM/yyyy
	let m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (m) {
		const [, day, month, year] = m;
		const d = String(Number(day)).padStart(2, "0");
		const mo = String(Number(month)).padStart(2, "0");
		return `${year}-${mo}-${d}T00:00:00.000Z`;
	}

	// dd/MM/yyyy HH:mm
	m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+\d{1,2}:\d{2}$/);
	if (m) {
		const [, day, month, year] = m;
		const d = String(Number(day)).padStart(2, "0");
		const mo = String(Number(month)).padStart(2, "0");
		return `${year}-${mo}-${d}T00:00:00.000Z`;
	}

	// HH:mm dd/MM/yyyy
	m = v.match(/^\d{1,2}:\d{2}\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (m) {
		const [, day, month, year] = m;
		const d = String(Number(day)).padStart(2, "0");
		const mo = String(Number(month)).padStart(2, "0");
		return `${year}-${mo}-${d}T00:00:00.000Z`;
	}

	// ISO-like date/datetime
	m = v.match(
		/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?(?:Z|[+-]\d{2}:?\d{2})?$/,
	);
	if (m) {
		const [, year, month, day] = m;
		return `${year}-${month}-${day}T00:00:00.000Z`;
	}

	const d = new Date(v);
	if (Number.isNaN(d.getTime())) return null;
	const year = d.getUTCFullYear();
	const month = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}T00:00:00.000Z`;
}

function normalizeNullableText(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	const v = String(value).trim();
	return v ? v : null;
}

/**
 * GET /api/trucking-followup/container/ai-autofill-edo?jobNumber=VT-001
 * Returns the last successful EDO autofill result for a given job.
 */
export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user)
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

		const { searchParams } = new URL(request.url);
		const jobNumber = searchParams.get("jobNumber");

		if (!jobNumber) return NextResponse.json({ history: null });

		const last = await prismaRPA.geminiHistory.findFirst({
			where: {
				jobNumber,
				goal: "edo-bulk-autofill",
				status: 200,
				response: { not: null },
				errorMessage: null,
			},
			orderBy: { createdAt: "desc" },
			select: {
				response: true,
				fileIds: true,
				fileNames: true,
				sessionId: true,
				createdAt: true,
				requestBody: true,
			},
		});

		if (!last?.response) return NextResponse.json({ history: null });

		const latestContainer = await prismaRPA.container.findFirst({
			where: {
				truckingFollowUp: { jobNumber },
				OR: [
					{ closingTime: { not: null } },
					{ vesselName: { not: null } },
					{ veselNumber: { not: null } },
					{ pickOrLiftPlace: { not: null } },
					{ emptyReturnDeadline: { not: null } },
				],
			},
			orderBy: { updatedAt: "desc" },
			select: {
				closingTime: true,
				vesselName: true,
				veselNumber: true,
				pickOrLiftPlace: true,
				emptyReturnDeadline: true,
			},
		});

		let parsed: any = {};
		try {
			parsed = JSON.parse(last.response);
		} catch {
			parsed = {};
		}

		return NextResponse.json({
			history: {
				...parsed,
				closingTime:
					latestContainer?.closingTime?.toISOString() ??
					parsed.closingTime ??
					null,
				vesselName: latestContainer?.vesselName ?? parsed.vesselName ?? null,
				veselNumber: latestContainer?.veselNumber ?? parsed.veselNumber ?? null,
				pickOrLiftPlace:
					latestContainer?.pickOrLiftPlace ?? parsed.pickOrLiftPlace ?? null,
				emptyReturnDeadline:
					latestContainer?.emptyReturnDeadline ??
					parsed.emptyReturnDeadline ??
					null,
				fileIds: last.fileIds || [],
				fileNames: last.fileNames || [],
				sessionId: last.sessionId,
				createdAt: last.createdAt,
				workingFolderId: (last.requestBody as any)?.workingFolderId ?? null,
			},
			pickupAt:
				(
					await prismaRPA.fCR.findFirst({
						where: { truckingFollowUp: { jobNumber } },
						orderBy: { fcrNumber: "asc" },
						select: { pickupAt: true },
					})
				)?.pickupAt ?? null,
		});
	} catch (error: any) {
		return NextResponse.json({ message: error.message }, { status: 500 });
	}
}

/**
 * POST /api/trucking-followup/container/ai-autofill-edo
 * Extracts EDO information from documents for:
 * - TruckingFollowUp: carrierName, eportBooking, clientName, maNhanConmt, soLenh
 * - Container: vesselName, veselNumber, closingTime, pickOrLiftPlace, emptyReturnDeadline
 */
export async function POST(request: NextRequest) {
	const startTime = Date.now();

	let session: any;
	let jobNumber: string | undefined;
	let sessionId: string | undefined;
	let workingFolderId: string | undefined;
	let fileIds: string[] | undefined;
	const fileNames: string[] = [];
	const failedFileIds: string[] = [];
	let chosenModel: string | undefined;

	try {
		session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user)
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

		const body = await request.json();
		const {
			images,
			fileIds: bodyFileIds,
			jobNumber: bJobNumber,
			sessionId: bSessionId,
			workingFolderId: bWorkingFolderId,
			existingContainers = [],
			validContainerSizes = [],
			model: bModel,
		} = body;

		chosenModel = bModel;

		fileIds = bodyFileIds;
		jobNumber = bJobNumber;
		sessionId = bSessionId;
		workingFolderId = bWorkingFolderId;

		const hasImages = images && Array.isArray(images) && images.length > 0;
		const hasFileIds = fileIds && Array.isArray(fileIds) && fileIds.length > 0;

		if (!hasImages && !hasFileIds) {
			return NextResponse.json(
				{ message: "Vui lòng cung cấp ít nhất 1 file để phân tích" },
				{ status: 400 },
			);
		}

		const apiKey = process.env.GEMINI_API_KEY;
		if (!apiKey)
			return NextResponse.json(
				{ message: "Gemini API key chưa được cấu hình" },
				{ status: 500 },
			);

		const envModelsStr =
			process.env.NEXT_PUBLIC_GEMINI_AUTOFILL_EDO_MODEL || "gemini-1.5-pro-002";
		const availableModels = envModelsStr
			.split(",")
			.map((m) => m.trim())
			.filter(Boolean);
		const model = chosenModel || availableModels[0];

		// Fetch shipping lines to use for exact match mapping
		const shippingLines = await prismaRPA.shippingLine.findMany({
			where: {
				OR: [{ operationType: "NHAP" }, { operationType: null }],
			},
			select: { name: true },
			distinct: ["name"],
		});
		const shippingLineNames = shippingLines.map((s: any) => s.name).join(" | ");

		// Fetch PickOrLiftPlace to use for exact match mapping
		const pickOrLiftPlaces = await prismaRPA.pickOrLiftPlace.findMany({
			select: { name: true },
			distinct: ["name"],
		});
		const pickOrLiftPlaceNames = pickOrLiftPlaces
			.map((p: any) => p.name)
			.join(" | ");

		// Get first FCR's deliveryAt to filter ports
		const firstFcrWithDelivery = await prismaRPA.fCR.findFirst({
			where: {
				truckingFollowUp: { jobNumber },
				AND: [{ pickupAt: { not: null } }, { pickupAt: { not: "" } }],
			},
			select: { pickupAt: true },
			orderBy: { implementationDate: "asc" },
		});
		const pickupAt = firstFcrWithDelivery?.pickupAt;

		// Build container context: fixed row order + valid sizes
		const validSizesDesc =
			validContainerSizes.length > 0
				? `\nDANH SÁCH LOẠI CONTAINER HỢP LỆ TRONG HỆ THỐNG (BẮT BUỘC dùng chính xác tên từ danh sách này cho containerSize):\n${validContainerSizes.join(" | ")}`
				: "";

		const containerDesc =
			existingContainers.length > 0
				? `\nDANH SÁCH CONTAINER HIỆN CÓ TRONG HỆ THỐNG (THỨ TỰ CỐ ĐỊNH — KHÔNG được thay đổi vị trí các dòng này):\n${existingContainers
						.map(
							(c: any, i: number) =>
								`  Dòng ${i + 1}: containerNo="${c.containerNo || "(trống)"}" | size=${c.containerSize || "chưa có"} | sealNo=${c.sealNo || "(trống)"}`,
						)
						.join(
							"\n",
						)}\nTổng số container hiện tại: ${existingContainers.length}\n\nQUY TẮC ĐỐI CHIẾU: Với mỗi dòng trên, hãy tìm trong tài liệu container có containerNo khớp (nếu có). Nếu không tìm thấy containerNo khớp, điền theo vị trí (dòng 1→phần tử 0, ...). NẾU TÀI LIỆU CÓ NHIỀU CONTAINER HƠN, hãy BẮT BUỘC THÊM CÁC CONTAINER MỚI ĐÓ vào cuối mảng containers[]. Số phần tử tối thiểu phải bằng ${existingContainers.length}.${validSizesDesc}`
				: `\nKhông có container nào trong hệ thống để so sánh. Vui lòng trích xuất TẤT CẢ các container tìm thấy vào mảng containers[].${validSizesDesc}`;

		const systemInstruction = `Bạn là chuyên gia phân tích chứng từ EDO (Electronic Delivery Order).
Nhiệm vụ: Đọc TẤT CẢ tài liệu/ảnh được cung cấp và trích xuất thông tin EDO.

THÔNG TIN CẦN TRÍCH XUẤT:
1. carrierName: Tên hãng tàu (carrier/shipping line). BẠN PHẢI TÌM VÀ TRẢ VỀ TÊN CHÍNH XÁC CỦA HÃNG TÀU TỪ "DANH SÁCH HÃNG TÀU TRONG HỆ THỐNG" BÊN DƯỚI. Nếu có nhiều lựa chọn hãng tàu phù hợp do tên gần giống nhau, vui lòng trả về null cho 'carrierName' VÀ BẮT BUỘC liệt kê các lựa chọn đó vào mảng 'carrierNameSuggestions' để người dùng tự chọn. Nếu không có tên nào phù hợp, hãy trả về tên gốc trên EDO.
2. eportBooking: Số Bill of Lading hoặc số booking. ưu tiên lấy số House Bill of Lading. Nếu tìm thấy nhiều số khác nhau, hãy liệt kê vào 'eportBookingSuggestions'.
3. clientName: Tên khách hàng hoặc Release To, ưu tiên lấy ở DELIVERY ORDER hoặc House Bill of Lading . VỚI HÃNG TÀU OOCL, cần sao chép chính xác toàn bộ thông tin từ phần "CONSIGNEE" trên file EDO PDF. Yêu cầu độ dài tối thiểu 35 ký tự (bao gồm khoảng trắng), thường nằm trong khoảng 35-40 ký tự; nếu thiếu có thể sao chép thêm địa chỉ hoặc MST. Với hãng tàu khác, Tên khách hàng lấy chính xác tên trên EDO hoặc nếu có mail hướng dẫn khác thì lấy ở mail. Nếu có nhiều lựa chọn tên, liệt kê vào 'clientNameSuggestions'.
4. maNhanConmt: Mã nhận container,mã bảo mật , DELIVERY ORDER (PIN) hoặc tương đương. 
5. soLenh: Là mã lệnh, nếu không thấy thì lấy như maNhanConmt. Nếu có nhiều mã, liệt kê vào 'soLenhSuggestions'.
6. vesselName: Tên tàu. Nếu có nhiều tên tàu phù hợp, liệt kê vào 'vesselNameSuggestions'.
7. veselNumber: Số chuyến tàu. Nếu có nhiều số chuyến, liệt kê vào 'veselNumberSuggestions'.
8. closingTime: Hạn lệnh (ngày), định dạng ISO 8601 hoặc null. Nếu tìm thấy nhiều ngày/hạn lệnh khác nhau, liệt kê vào 'closingTimeSuggestions'.
9. pickOrLiftPlace: Nơi trả rỗng hoặc empty place hoặc retrun place hoặc empty location hoặc empty depot. BẠN PHẢI TÌM VÀ TRẢ VỀ TÊN CHÍNH XÁC TỪ "DANH SÁCH NƠI TRẢ RỖNG TRONG HỆ THỐNG" BÊN DƯỚI. Nếu có nhiều lựa chọn phù hợp do tên gần giống nhau, vui lòng trả về null cho 'pickOrLiftPlace' VÀ BẮT BUỘC liệt kê vào mảng 'pickOrLiftPlaceSuggestions' để người dùng tự chọn. Nếu không tìm thấy tên nào phù hợp, hãy BẮT BUỘC thêm cảnh báo vào warnings (ví dụ: "Không tìm thấy Nơi trả rỗng khớp với hệ thống, vui lòng kiểm tra lại.") và trả về tên gốc hoặc null.
10. emptyReturnDeadline: Ngày/ký hiệu phải trả container rỗng, dạng text hoặc null. ví dụ 5 DET. Nếu có nhiều lựa chọn, liệt kê vào 'emptyReturnDeadlineSuggestions'.
11. containerQuantity: Số lượng container được đề cập trong EDO
12. containerSizes: Danh sách loại/kích thước container trong EDO (ví dụ: ["20GP", "40HC", "40GP"])

QUY TẮC:
- Nếu không tìm thấy thông tin cho trường nào thì trả về null.
- closingTime phải trả về ngày ở dạng ISO 8601 (ví dụ: "2026-03-25T00:00:00.000Z").
- emptyReturnDeadline cho phép text tự do (ví dụ: "28/03", "D+3", "THEO EDO", "5 DET").
- CHỈ trả về JSON object, không giải thích thêm.
- ưu tiên lấy mã bảo mật là maNhanConmt nếu không có Mã nhận container.đối vs hãng tàu maersk thì maNhanConmt = soLenh và chỉ lấy những số trước dấu gạch /
- clientName không cắt khúc đầu dù nó có là gì đi nữa. có khả năng có mã số thuế ở đầu.
- Đối với Hãng tàu Yang Minh eportBooking bỏ chính xác 4 chữ cái đầu tiên.
- Có khả năng sẽ đính kèm mail, cần chú trọng hướng dẫn trong mail
- containerQuantity là số nguyên (tổng số container)
- containerSizes là mảng chuỗi, mỗi phần tử là loại container (20GP, 40HC, 40GP, 45HC, 20RF, etc.)
- containers[]: Trả về theo ĐÚNG THỨ TỰ của danh sách hệ thống (nếu có). NẾU TRONG TÀI LIỆU CÓ THÊM CONTAINER MỚI CHƯA CÓ TRONG HỆ THỐNG, BẮT BUỘC PHẢI THÊM TẤT CẢ CHÚNG VÀO CUỐI MẢNG NÀY. Mỗi phần tử: containerNo (số hiệu container), sealNo (số chì), containerSize (loại cont — BẮT BUỘC dùng tên chính xác từ DANH SÁCH LOẠI CONTAINER HỢP LỆ nếu có), grossWeight (Trọng lượng thô/Gross Weight - số thực), packageQty (Số lượng kiện/hàng - số thực. Thường là số lượng Pallets, số lượng Box hoặc số lượng Package).
- GIẢI TRÌNH TRÍCH XUẤT (QUAN TRỌNG NHẤT): 
TUYỆT ĐỐI KHÔNG ĐƯA CÁC CÂU GIẢI TRÌNH, NGUỒN LẤY HAY LÝ DO CHỌN VÀO MẢNG 'warnings'. Mảng 'warnings' CHỈ DÙNG cho lỗi số lượng/size container hoặc khi không tìm thấy kết quả khớp.
Thay vào đó, Với MỖI một trường dữ liệu (hãng tàu, booking, trả rỗng, v.v), BẠN PHẢI tạo 1 thuộc tính (key) bằng tên trường (chữ cái tiếng Anh, ví dụ "carrierName", "eportBooking") trong OBJECT 'extractionDetails' của JSON. Chuỗi mô tả bắt buộc xuống dòng bằng \\n:
"- Lựa chọn: [Liệt kê cực kỳ chi tiết các giá trị đã thấy]\\n- Nguồn lấy: [Ghi rõ trang/file]\\n- Lý do chọn/Kết quả map: [Giải thích lý do hoặc thông báo kết quả map tên hệ thống]"
*Lưu ý: 
- NẾU trường đó có TỪ 2 giá trị khác nhau trở lên trên chứng từ, BẮT BUỘC thêm "⚠️ CẢNH BÁO " vào đầu.
- vesselName, veselNumber có thể có nhiều hãy ưu tiên tàu cập bến ở ${pickupAt}
${containerDesc}

DANH SÁCH HÃNG TÀU TRONG HỆ THỐNG (ưu tiên sử dụng tên chính xác từ danh sách này):
${shippingLineNames}

DANH SÁCH NƠI TRẢ RỖNG TRONG HỆ THỐNG (ưu tiên sử dụng tên chính xác từ danh sách này):
${pickOrLiftPlaceNames}

SO SÁNH QUANTITY & SIZE:
- Nếu tìm thấy containerQuantity hoặc containerSizes trong tài liệu, so sánh với dữ liệu hệ thống hiện có.
- Nếu containerQuantity không khớp với số container hiện có (của danh sách hệ thống) → đưa thông báo vào warnings.
- Nếu containerSizes không khớp chủng loại với danh sách hệ thống → đưa thông báo vào warnings.
- Mảng 'containers' BẮT BUỘC theo đúng thứ tự cố định đã chỉ định ở trên. Dùng containerNo làm khóa tra cứu trong tài liệu; nếu không tìm thấy containerNo khớp thì điền null cho các trường không rõ.

CẤU TRÚC JSON BẮT BUỘC:
{
  "carrierName": "ONE",
  "originalCarrierName": "ONE Shipping Line Group",
  "carrierNameSuggestions": [],
  "eportBooking": "SEA123456",
  "eportBookingSuggestions": [],
  "clientName": "ABC LOGISTICS",
  "originalClientName": null,
  "clientNameSuggestions": [],
  "maNhanConmt": "MNCONT001",
  "soLenh": "SL123456",
  "soLenhSuggestions": [],
  "vesselName": "ONE MINATO",
  "vesselNameSuggestions": [],
  "veselNumber": "123E",
  "veselNumberSuggestions": [],
  "closingTime": "2026-03-25T00:00:00.000Z",
  "closingTimeSuggestions": [],
  "pickOrLiftPlace": null,
  "originalPickOrLiftPlace": "TICD Transimex HCM",
  "pickOrLiftPlaceSuggestions": ["ICD TRANSIMEX", "ICD TRANSIMEX (HCM)"],
  "emptyReturnDeadline": "D+3",
  "emptyReturnDeadlineSuggestions": [],
  "containerQuantity": 2,
  "containerSizes": ["20GP", "40HC"],
  "containers": [
    { "containerNo": "MSCU1234567", "sealNo": "VN123456", "containerSize": "20GP", "grossWeight": 25000.5, "packageQty": 100 },
    { "containerNo": "TCKU7654321", "sealNo": "VN654321", "containerSize": "40HC", "grossWeight": 24000, "packageQty": 80 }
  ],
  "warnings": [],
  "extractionDetails": {
    "carrierName": "- Lựa chọn: ONE\\n- Nguồn: Góc trái tờ 1\\n- Lý do chọn: Duy nhất",
    "pickOrLiftPlace": "⚠️ CẢNH BÁO\\n- Lựa chọn: Nơi A, Nơi B\\n- Nguồn: File đính kèm email và trang 2\\n- Lý do chọn Nơi A: Do email hướng dẫn"
  }
}`;

		const parts: any[] = [
			{
				text: `Phân tích ${hasFileIds ? fileIds?.length : images.length} file và trích xuất thông tin EDO.`,
			},
		];

		if (hasImages) {
			for (const img of images) {
				if (!img.data || !img.mimeType) continue;
				const buf = Buffer.from(img.data, "base64");
				if (
					img.mimeType.startsWith("image/") ||
					img.mimeType === "application/pdf"
				) {
					parts.push({
						inline_data: { mime_type: img.mimeType, data: img.data },
					});
				} else if (
					img.mimeType.includes("spreadsheetml") ||
					img.mimeType.includes("ms-excel")
				) {
					const wb = XLSX.read(buf, { type: "buffer" });
					let txt = `[Excel: ${img.name}]\n`;
					wb.SheetNames.forEach((sn) => {
						txt += `${XLSX.utils.sheet_to_csv(wb.Sheets[sn])}\n`;
					});
					parts.push({ text: txt });
				} else if (img.mimeType.includes("wordprocessingml")) {
					const { value } = await mammoth.extractRawText({ buffer: buf });
					parts.push({ text: `[Word: ${img.name}]\n${value}` });
				} else {
					parts.push({
						inline_data: { mime_type: img.mimeType, data: img.data },
					});
				}
				fileNames.push(img.name || "local-file");
			}
		}

		if (hasFileIds && fileIds) {
			for (const fileId of fileIds) {
				try {
					const {
						buffer,
						mimeType,
						name: fetchedName,
					} = await getFileContent(fileId);
					const fname = fetchedName || fileId;
					if (mimeType.startsWith("image/") || mimeType === "application/pdf") {
						parts.push({
							inline_data: {
								mime_type: mimeType,
								data: buffer.toString("base64"),
							},
						});
					} else if (mimeType.startsWith("text/") || mimeType.includes("csv")) {
						const txt = buffer.toString("utf8");
						parts.push({ text: `[Text: ${fname}]\n${txt}` });
					} else if (
						mimeType.includes("spreadsheetml") ||
						mimeType.includes("ms-excel")
					) {
						const wb = XLSX.read(buffer, { type: "buffer" });
						let txt = `[Excel: ${fname}]\n`;
						wb.SheetNames.forEach((sn) => {
							txt += `${XLSX.utils.sheet_to_csv(wb.Sheets[sn])}\n`;
						});
						parts.push({ text: txt });
					} else if (mimeType.includes("wordprocessingml")) {
						const { value } = await mammoth.extractRawText({ buffer });
						parts.push({ text: `[Word: ${fname}]\n${value}` });
					} else {
						parts.push({
							inline_data: {
								mime_type: mimeType,
								data: buffer.toString("base64"),
							},
						});
					}
					fileNames.push(fname);
				} catch (err) {
					console.error(`Failed to fetch file ${fileId}:`, err);
					failedFileIds.push(fileId);
				}
			}
		}

		if (parts.length <= 1)
			return NextResponse.json(
				{ message: "Không thể tải file để phân tích" },
				{ status: 400 },
			);

		const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
		const geminiBody = {
			system_instruction: { parts: [{ text: systemInstruction }] },
			contents: [{ parts }],
			generationConfig: {
				temperature: 0.1,
				topP: 0.95,
				response_mime_type: "application/json",
			},
		};

		const response = await fetch(apiUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(geminiBody),
		});
		const data = await response.json();
		const durationMs = Date.now() - startTime;

		if (!response.ok) {
			const errMsg =
				data.error?.message || `Gemini API error: ${response.status}`;
			await logHistory({
				session,
				jobNumber,
				sessionId,
				workingFolderId,
				model,
				fileIds,
				fileNames,
				status: response.status,
				errorMessage: errMsg,
				durationMs,
			});
			return NextResponse.json({ message: errMsg }, { status: 500 });
		}

		const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
		if (!text) {
			const errMsg = "AI không trả về kết quả. Vui lòng thử lại.";
			await logHistory({
				session,
				jobNumber,
				sessionId,
				workingFolderId,
				model,
				fileIds,
				fileNames,
				status: 200,
				errorMessage: errMsg,
				durationMs,
				usageMetadata: data.usageMetadata,
			});
			return NextResponse.json({ message: errMsg }, { status: 500 });
		}

		const jsonStr = text.replace(/```json|```/g, "").trim();
		const parsed = JSON.parse(jsonStr);

		const result = {
			carrierName: parsed.carrierName ?? null,
			originalCarrierName: parsed.originalCarrierName ?? null,
			carrierNameSuggestions: parsed.carrierNameSuggestions ?? [],
			eportBooking: parsed.eportBooking ?? null,
			eportBookingSuggestions: parsed.eportBookingSuggestions ?? [],
			clientName: parsed.clientName ?? null,
			originalClientName: parsed.originalClientName ?? null,
			clientNameSuggestions: parsed.clientNameSuggestions ?? [],
			maNhanConmt: parsed.maNhanConmt ?? null,
			soLenh: parsed.soLenh ?? null,
			soLenhSuggestions: parsed.soLenhSuggestions ?? [],
			vesselName: parsed.vesselName ?? null,
			vesselNameSuggestions: parsed.vesselNameSuggestions ?? [],
			veselNumber: parsed.veselNumber ?? null,
			veselNumberSuggestions: parsed.veselNumberSuggestions ?? [],
			closingTime: normalizeDateOnly(parsed.closingTime),
			closingTimeSuggestions: Array.isArray(parsed.closingTimeSuggestions)
				? parsed.closingTimeSuggestions
						.map((t: any) => normalizeDateOnly(t))
						.filter(Boolean)
				: [],
			pickOrLiftPlace: parsed.pickOrLiftPlace ?? null,
			originalPickOrLiftPlace: parsed.originalPickOrLiftPlace ?? null,
			pickOrLiftPlaceSuggestions: parsed.pickOrLiftPlaceSuggestions ?? [],
			emptyReturnDeadline: normalizeNullableText(parsed.emptyReturnDeadline),
			emptyReturnDeadlineSuggestions:
				parsed.emptyReturnDeadlineSuggestions ?? [],
			containerQuantity: parsed.containerQuantity ?? null,
			containerSizes: Array.isArray(parsed.containerSizes)
				? parsed.containerSizes
				: [],
			containers: Array.isArray(parsed.containers)
				? parsed.containers.map((c: any) => ({
						containerNo: c.containerNo ?? null,
						sealNo: c.sealNo ?? null,
						containerSize: c.containerSize ?? null,
						grossWeight:
							typeof c.grossWeight === "number" ? c.grossWeight : null,
						packageQty: typeof c.packageQty === "number" ? c.packageQty : null,
					}))
				: [],
			warnings: parsed.warnings ?? [],
			extractionDetails:
				parsed.extractionDetails &&
				typeof parsed.extractionDetails === "object" &&
				!Array.isArray(parsed.extractionDetails)
					? parsed.extractionDetails
					: Array.isArray(parsed.extractionDetails)
						? { _legacy: parsed.extractionDetails.join("\\n") }
						: {},
			pickupAt:
				(
					await prismaRPA.fCR.findFirst({
						where: { truckingFollowUp: { jobNumber } },
						orderBy: { fcrNumber: "asc" },
						select: { pickupAt: true },
					})
				)?.pickupAt ?? null,
		};

		const allMainFieldsNull =
			!result.carrierName &&
			!result.eportBooking &&
			!result.clientName &&
			!result.maNhanConmt &&
			!result.soLenh &&
			!result.vesselName &&
			!result.veselNumber &&
			!result.closingTime &&
			!result.pickOrLiftPlace &&
			!result.emptyReturnDeadline;

		if (allMainFieldsNull) {
			result.warnings = [
				...result.warnings,
				"AI không nhận diện được dữ liệu EDO từ file đã chọn. Vui lòng kiểm tra file có đúng chứng từ EDO và nội dung rõ ràng.",
			];
		}

		if (failedFileIds.length > 0) {
			result.warnings = [
				...result.warnings,
				`Không đọc được ${failedFileIds.length} file từ Drive (có thể do quyền truy cập hoặc định dạng không hỗ trợ).`,
			];
		}

		await logHistory({
			session,
			jobNumber,
			sessionId,
			workingFolderId,
			model,
			fileIds,
			fileNames,
			status: 200,
			responseText: JSON.stringify(result),
			durationMs,
			usageMetadata: data.usageMetadata,
		});

		return NextResponse.json({ ...result, model });
	} catch (error: any) {
		const durationMs = Date.now() - startTime;
		console.error("EDO AI autofill error:", error);
		await logHistory({
			session,
			jobNumber,
			sessionId,
			model:
				chosenModel ||
				process.env.NEXT_PUBLIC_GEMINI_AUTOFILL_EDO_MODEL?.split(
					",",
				)[0].trim() ||
				"gemini-1.5-pro-002",
			fileIds,
			fileNames,
			status: 500,
			errorMessage: error.message,
			durationMs,
		}).catch(() => {});
		return NextResponse.json(
			{ message: error.message || "Lỗi phân tích EDO" },
			{ status: 500 },
		);
	}
}

async function logHistory(opts: {
	session: any;
	jobNumber?: string;
	sessionId?: string;
	workingFolderId?: string;
	model?: string;
	fileIds?: string[];
	fileNames?: string[];
	status: number;
	responseText?: string;
	errorMessage?: string;
	durationMs?: number;
	usageMetadata?: any;
}) {
	try {
		await prismaRPA.geminiHistory.create({
			data: {
				jobNumber: opts.jobNumber || null,
				userId: opts.session?.user?.id || null,
				userName: opts.session?.user?.name || null,
				model: opts.model || null,
				userCustomPrompt: "edo-bulk-autofill",
				response: opts.responseText ?? null,
				errorMessage: opts.errorMessage ?? null,
				goal: "edo-bulk-autofill",
				sessionId: opts.sessionId || null,
				status: opts.status,
				fileIds: opts.fileIds || [],
				fileNames: opts.fileNames || [],
				totalFileSizeMb: 0,
				requestBody: {
					goal: "edo-bulk-autofill",
					workingFolderId: opts.workingFolderId || null,
				},
				promptTokens: opts.usageMetadata?.promptTokenCount ?? null,
				candidatesTokens: opts.usageMetadata?.candidatesTokenCount ?? null,
				totalTokens: opts.usageMetadata?.totalTokenCount ?? null,
				durationMs: opts.durationMs ?? null,
			},
		});
	} catch (dbErr) {
		console.error("Failed to log edo-autofill history:", dbErr);
	}
}
