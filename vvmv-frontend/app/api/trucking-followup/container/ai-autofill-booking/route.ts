import mammoth from "mammoth";
import { type NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { getFileContent } from "@/lib/google-drive/upload";

export const maxDuration = 180;

function normalizeCutOffTime(value: unknown): string | null {
	if (value === null || value === undefined || value === "") return null;
	const v = String(value).trim();
	if (!v) return null;

	// dd/MM/yyyy HH:mm
	let m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
	if (m) {
		const [, day, month, year, hh, mm] = m;
		const d = String(Number(day)).padStart(2, "0");
		const mo = String(Number(month)).padStart(2, "0");
		const h = String(Number(hh)).padStart(2, "0");
		const min = String(Number(mm)).padStart(2, "0");
		return `${year}-${mo}-${d}T${h}:${min}:00.000Z`;
	}

	// HH:mm dd/MM/yyyy
	m = v.match(/^(\d{1,2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (m) {
		const [, hh, mm, day, month, year] = m;
		const d = String(Number(day)).padStart(2, "0");
		const mo = String(Number(month)).padStart(2, "0");
		const h = String(Number(hh)).padStart(2, "0");
		const min = String(Number(mm)).padStart(2, "0");
		return `${year}-${mo}-${d}T${h}:${min}:00.000Z`;
	}

	// ISO-like datetime/date: keep the same clock time, ignore timezone offset
	m = v.match(
		/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?(?:Z|[+-]\d{2}:?\d{2})?$/,
	);
	if (m) {
		const [, year, month, day, hh = "00", mm = "00"] = m;
		return `${year}-${month}-${day}T${hh}:${mm}:00.000Z`;
	}

	// Last fallback for odd formats
	const d = new Date(v);
	if (Number.isNaN(d.getTime())) return null;
	const year = d.getUTCFullYear();
	const month = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	const hh = String(d.getUTCHours()).padStart(2, "0");
	const mm = String(d.getUTCMinutes()).padStart(2, "0");
	return `${year}-${month}-${day}T${hh}:${mm}:00.000Z`;
}

/**
 * GET /api/trucking-followup/container/ai-autofill-booking?jobNumber=VT-001
 * Returns the last successful booking autofill result for a given job.
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
				goal: "booking-bulk-autofill",
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

		if (!last || !last.response) return NextResponse.json({ history: null });

		// Read latest saved cutOffAtPort from container DB so popup reflects user-confirmed value,
		// even when Gemini history is older/stale.
		const latestCutOffAtPort = await prismaRPA.container.findFirst({
			where: {
				cutOffAtPort: { not: null },
				truckingFollowUp: {
					jobNumber,
				},
			},
			orderBy: { updatedAt: "desc" },
			select: { cutOffAtPort: true },
		});

		const latestBlockCode = await prismaRPA.container.findFirst({
			where: {
				blockCode: { not: null },
				truckingFollowUp: {
					jobNumber,
				},
			},
			orderBy: { updatedAt: "desc" },
			select: { blockCode: true },
		});

		const firstFcrWithDelivery = await prismaRPA.fCR.findFirst({
			where: {
				truckingFollowUp: { jobNumber },
				AND: [{ deliveryAt: { not: null } }, { deliveryAt: { not: "" } }],
			},
			select: { deliveryAt: true },
			orderBy: { implementationDate: "asc" },
		});
		const deliveryAt = firstFcrWithDelivery?.deliveryAt;

		let parsed: any = {};
		try {
			parsed = JSON.parse(last.response);
		} catch {}

		return NextResponse.json({
			history: {
				...parsed,
				cutOffAtPort:
					latestCutOffAtPort?.cutOffAtPort?.toISOString() ??
					parsed.cutOffAtPort ??
					null,
				blockCode: latestBlockCode?.blockCode ?? parsed.blockCode ?? null,
				deliveryAt: deliveryAt ?? parsed.deliveryAt ?? null,
				fileIds: last.fileIds || [],
				fileNames: last.fileNames || [],
				sessionId: last.sessionId,
				createdAt: last.createdAt,
				workingFolderId: (last.requestBody as any)?.workingFolderId ?? null,
			},
		});
	} catch (error: any) {
		return NextResponse.json({ message: error.message }, { status: 500 });
	}
}

/**
 * POST /api/trucking-followup/container/ai-autofill-booking
 * Extracts booking information from documents:
 * - TruckingFollowUp fields: eportBooking, transitPort, destinationPort
 * - Container fields: vesselName, veselNumber, cutOffTime, pickOrLiftPlace, blockCode
 * - Also detects container quantity & sizes for mismatch warnings
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
			process.env.NEXT_PUBLIC_GEMINI_AUTOFILL_BOOKING_MODEL ||
			"gemini-1.5-pro-002";
		const availableModels = envModelsStr
			.split(",")
			.map((m) => m.trim())
			.filter(Boolean);
		const model = chosenModel || availableModels[0];

		// Fetch shipping lines to use for exact match mapping
		const shippingLines = await prismaRPA.shippingLine.findMany({
			where: {
				OR: [{ operationType: "XUAT" }, { operationType: null }],
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
				AND: [{ deliveryAt: { not: null } }, { deliveryAt: { not: "" } }],
			},
			select: { deliveryAt: true },
			orderBy: { implementationDate: "asc" },
		});
		const deliveryAt = firstFcrWithDelivery?.deliveryAt;

		// Fetch Foreign Ports
		const transitPorts = await prismaRPA.foreignPort.findMany({
			where: {
				OR: [{ portType: "TRANSIT" }, { portType: null }],
				...(deliveryAt ? { domesticPort: deliveryAt } : {}),
			},
			select: { name: true },
			distinct: ["name"],
		});
		const transitPortNames = transitPorts.map((p: any) => p.name).join(" | ");

		const destinationPorts = await prismaRPA.foreignPort.findMany({
			where: {
				OR: [{ portType: "DESTINATION" }, { portType: null }],
				...(deliveryAt ? { domesticPort: deliveryAt } : {}),
			},
			select: { name: true },
			distinct: ["name"],
		});
		const destinationPortNames = destinationPorts
			.map((p: any) => p.name)
			.join(" | ");

		// Build container context: fixed row order + valid sizes
		const validSizesDesc =
			validContainerSizes.length > 0
				? `\nDANH SÁCH LOẠI CONTAINER HỢP LỆ TRONG HỆ THỐNG (BẮT BUỘC dùng chính xác tên từ danh sách này cho containerSize):\n${validContainerSizes.join(" | ")}`
				: "";

		const containerDesc =
			existingContainers.length > 0
				? `\nDANH SÁCH CONTAINER HIỆN CÓ TRONG HỆ THỐNG (THỨ TỰ CỐ ĐỊNH — BẮT BUỘC trả về mảng containers[] ĐÚNG THỨ TỰ NÀY, không được đảo dòng):\n${existingContainers
						.map(
							(c: any, i: number) =>
								`  Dòng ${i + 1}: containerNo="${c.containerNo || "(trống)"}" | size=${c.containerSize || "chưa có"} | sealNo=${c.sealNo || "(trống)"}`,
						)
						.join(
							"\n",
						)}\nTổng số container hiện tại: ${existingContainers.length}\n\nQUY TẮC ĐỐI CHIẾU: Với mỗi dòng trên, hãy tìm trong tài liệu container có containerNo khớp (nếu có). Nếu không tìm thấy containerNo khớp, điền theo vị trí (dòng 1→phần tử 0, ...). Mảng containers[] phải có ĐÚNG ${existingContainers.length} phần tử, đúng thứ tự như danh sách trên.${validSizesDesc}`
				: `\nKhông có container nào trong hệ thống để so sánh.${validSizesDesc}`;

		const systemInstruction = `Bạn là chuyên gia phân tích thông tin booking vận tải biển.
Nhiệm vụ: Đọc TẤT CẢ tài liệu/ảnh được cung cấp và trích xuất thông tin BOOKING vận tải.

THÔNG TIN CẦN TRÍCH XUẤT:
1. eportBooking: Số booking (booking number) — thường là chuỗi ký tự/số, ví dụ "SEA123456", "HLCUSGN12345". ưu tiên lấy số Reference nếu chứng từ không ghi rõ số Booking sau đó ưu tiên lấy số House Bill of Lading. Nếu tìm thấy nhiều số booking khác nhau, hãy liệt kê vào 'eportBookingSuggestions'.
2. carrierName: Tên hãng tàu (carrier/shipping line), ví dụ "ONE", "MAERSK", "COSCO". BẠN PHẢI TÌM VÀ TRẢ VỀ TÊN CHÍNH XÁC CỦA HÃNG TÀU TỪ "DANH SÁCH HÃNG TÀU TRONG HỆ THỐNG" BÊN DƯỚI. Nếu có nhiều lựa chọn hãng tàu phù hợp do tên gần giống nhau, vui lòng trả về null cho 'carrierName' VÀ BẮT BUỘC liệt kê các lựa chọn đó vào mảng 'carrierNameSuggestions' để người dùng tự chọn. Nếu không có tên nào phù hợp, hãy trả về tên gốc trên booking.
3. transitPort: Cảng chuyển tải (transshipment port / transit port). Có trường hợp cảng chuyển tải là sau ngày dỡ hàng thì không được xem là có chuyển tải vì khi đó hàng đã xuống tàu. QUY TẮC MẶC ĐỊNH: nếu booking có cảng chuyển tải thì lấy cảng chuyển tải; nếu KHÔNG có cảng chuyển tải thì lấy DISCHARGE PORT (POD). BẠN PHẢI TÌM VÀ TRẢ VỀ TÊN CHÍNH XÁC TỪ "DANH SÁCH CẢNG CHUYỂN TẢI TRONG HỆ THỐNG" BÊN DƯỚI. (Gợi ý MẸO AI: Khi có nhiều lựa chọn cảng giống nhau, bạn HÃY THAM CHIẾU VÀO GIÁ TRỊ CỦA BẠN CHO 'blockCode' để thu hẹp và map ra kết quả đúng duy nhất). Nếu vẫn bị nhiều lựa chọn, vui lòng trả về null cho 'transitPort' VÀ BẮT BUỘC liệt kê các lựa chọn đó vào mảng 'transitPortSuggestions' để người dùng tự chọn. Nếu không tìm thấy tên nào phù hợp, hãy trả về tên gốc.
4. destinationPort: Cảng đích (port of discharge / destination port) — tên cảng, ví dụ "FELIXSTOWE", "HAMBURG". BẠN PHẢI TÌM VÀ TRẢ VỀ TÊN CHÍNH XÁC TỪ "DANH SÁCH CẢNG ĐÍCH TRONG HỆ THỐNG" BÊN DƯỚI. (Gợi ý MẸO AI: Khi có nhiều lựa chọn cảng giống nhau, bạn HÃY THAM CHIẾU VÀO GIÁ TRỊ CỦA BẠN CHO 'blockCode' để thu hẹp và map ra kết quả đúng duy nhất). Nếu vẫn bị nhiều lựa chọn, vui lòng trả về null cho 'destinationPort' VÀ BẮT BUỘC liệt kê vào mảng 'destinationPortSuggestions'. Nếu không tìm thấy tên nào phù hợp, hãy trả về tên gốc.
5. vesselName: Tên tàu (vessel name) — ví dụ "ONE MINATO", "EVER GIVEN". Nếu có nhiều tên tàu phù hợp trong các file chứng từ, hãy chọn 1 cái hợp lý nhất VÀ liệt kê tất cả vào 'vesselNameSuggestions'.
6. veselNumber: Số chuyến tàu (voyage number) — ví dụ "123E", "0054W". Nếu có nhiều số chuyến tàu, liệt kê vào 'veselNumberSuggestions'.
7. cutOffTime: Ngày/giờ cut-off chuyến tàu ở cảng (closing time / cut-off deadline) — định dạng ISO 8601, ví dụ "2026-03-25T14:00:00.000Z". Nếu có nhiều thời gian khác nhau, hãy chọn cái hợp lý nhất (ví dụ trên email hoặc file PDF mới nhất) VÀ liệt kê vào 'cutOffTimeSuggestions'.
8. containerQuantity: Số lượng container được đề cập trong booking
9. containerSizes: Danh sách loại/kích thước container trong booking (ví dụ: ["20GP", "40HC", "40GP"])
10. pickOrLiftPlace: Nơi lấy container rỗng về để đóng hàng xuất đi. BẠN PHẢI TÌM VÀ TRẢ VỀ TÊN CHÍNH XÁC TỪ "DANH SÁCH NƠI LẤY/HẠ CONTAINER TRONG HỆ THỐNG" BÊN DƯỚI. Nếu có nhiều lựa chọn phù hợp do tên gần giống nhau, vui lòng trả về null cho 'pickOrLiftPlace' VÀ BẮT BUỘC liệt kê vào mảng 'pickOrLiftPlaceSuggestions' để người dùng tự chọn. Nếu không tìm thấy tên nào phù hợp, hãy BẮT BUỘC thêm cảnh báo vào warnings (ví dụ: "Không tìm thấy Nơi lấy/hạ khớp với hệ thống, vui lòng kiểm tra lại.") và trả về tên gốc hoặc null.
11. blockCode: Mã bãi/block trên booking (ví dụ: "B12", "C3", "YARD-A"), nếu có. Nếu có nhiều block code, liệt kê vào 'blockCodeSuggestions'.

QUY TẮC:
- Nếu không tìm thấy thông tin cho một trường, trả về null.
- Với transitPort: ưu tiên cảng chuyển tải. Nếu không có cảng chuyển tải thì dùng DISCHARGE PORT (POD).
- cutOffTime phải ở định dạng ISO 8601 (ví dụ: "2026-03-25T14:00:00.000Z")
- QUAN TRỌNG: giữ nguyên giờ/phút đúng như trên booking, KHÔNG tự quy đổi múi giờ. Ví dụ booking ghi 14:00 thì trả về 14:00.
- containerQuantity là số nguyên (tổng số container)
- containerSizes là mảng chuỗi, mỗi phần tử là loại container (20GP, 40HC, 40GP, 45HC, 20RF, etc.)
- containers[]: PHẢI trả về ĐÚNG số phần tử bằng số container trong hệ thống (nếu có), ĐÚNG THỨ TỰ đã chỉ định. Mỗi phần tử: containerNo (số hiệu container, ví dụ MSCU1234567), sealNo (số chì niêm phong), containerSize (loại cont — BẮT BUỘC dùng tên chính xác từ DANH SÁCH LOẠI CONTAINER HỢP LỆ nếu có), grossWeight (Trọng lượng thô/Gross Weight - số thực), packageQty (Số lượng kiện/hàng - số thực. Thường là số lượng Pallets, số lượng Box hoặc số lượng Pcakage).
- GIẢI TRÌNH TRÍCH XUẤT (QUAN TRỌNG NHẤT): 
TUYỆT ĐỐI KHÔNG ĐƯA CÁC CÂU GIẢI TRÌNH, NGUỒN LẤY HAY LÝ DO CHỌN VÀO MẢNG 'warnings'. Mảng 'warnings' CHỈ DÙNG cho lỗi số lượng/size container hoặc khi không tìm thấy kết quả khớp.
Thay vào đó, Với MỖI một trường dữ liệu (hãng tàu, booking, cảng, v.v), BẠN PHẢI tạo 1 thuộc tính (key) bằng tên trường (chữ cái tiếng Anh, ví dụ "carrierName", "cutOffTime") trong OBJECT 'extractionDetails' của JSON. Chuỗi mô tả bắt buộc xuống dòng bằng \\n:
"- Lựa chọn: [Liệt kê cực kỳ chi tiết các giá trị đã thấy]\\n- Nguồn lấy: [Ghi rõ trang/file]\\n- Lý do chọn/Kết quả map: [Giải thích lý do hoặc thông báo kết quả map tên hệ thống]"
*Lưu ý: NẾU trường đó có TỪ 2 giá trị khác nhau trở lên trên chứng từ, BẮT BUỘC thêm "⚠️ CẢNH BÁO " vào đầu.
- CHỈ trả về JSON object, không có giải thích thêm.
- vesselName, veselNumber có thể có nhiều hãy ưu tiên tàu xuất phát từ ${deliveryAt}
${containerDesc}

DANH SÁCH HÃNG TÀU TRONG HỆ THỐNG (ưu tiên sử dụng tên chính xác từ danh sách này):
${shippingLineNames}

DANH SÁCH NƠI LẤY/HẠ CONTAINER TRONG HỆ THỐNG (ưu tiên sử dụng tên chính xác từ danh sách này):
${pickOrLiftPlaceNames}

DANH SÁCH CẢNG CHUYỂN TẢI TRONG HỆ THỐNG (ưu tiên sử dụng tên chính xác từ danh sách này):
${transitPortNames}

DANH SÁCH CẢNG ĐÍCH TRONG HỆ THỐNG (ưu tiên sử dụng tên chính xác từ danh sách này):
${destinationPortNames}

SO SÁNH QUANTITY & SIZE:
- Nếu tìm thấy containerQuantity hoặc containerSizes trong tài liệu, so sánh với dữ liệu hiện có.
- Nếu containerQuantity không khớp với số container hiện có → trả về warning.
- Nếu containerSizes không khớp (ví dụ booking ghi 2x40HC nhưng hệ thống có 1x20GP + 1x40HC) → trả về warning.
- Mảng 'containers' BẮT BUỘC theo đúng thứ tự cố định đã chỉ định ở trên. Dùng containerNo làm khóa tra cứu trong tài liệu; nếu không tìm thấy containerNo khớp thì điền null cho các trường không rõ.


CẤU TRÚC JSON BẮT BUỘC:
{
  "eportBooking": "SEA123456",
  "eportBookingSuggestions": [],
  "carrierName": "ONE",
  "originalCarrierName": "ONE Shipping Line Group",
  "carrierNameSuggestions": [],
  "transitPort": "SINGAPORE",
  "originalTransitPort": "SIN PORT",
  "transitPortSuggestions": [],
  "destinationPort": null,
  "originalDestinationPort": "FLX",
  "destinationPortSuggestions": ["FELIXSTOWE", "FELIXTOWE UK"],
  "vesselName": "ONE MINATO",
  "vesselNameSuggestions": [],
  "veselNumber": "123E",
  "veselNumberSuggestions": [],
  "pickOrLiftPlace": "ICD TRANSIMEX",
  "originalPickOrLiftPlace": "TICD Transimex HCM",
  "pickOrLiftPlaceSuggestions": [],
  "blockCode": "B12",
  "blockCodeSuggestions": [],
  "cutOffTime": "2026-03-25T14:00:00.000Z",
  "cutOffTimeSuggestions": [],
  "containerQuantity": 2,
  "containerSizes": ["40HC", "40HC"],
  "containers": [
    { "containerNo": "MSCU1234567", "sealNo": "VN123456", "containerSize": "40HC", "grossWeight": 25000.5, "packageQty": 100 },
    { "containerNo": "TCKU7654321", "sealNo": "VN654321", "containerSize": "40HC", "grossWeight": 24000, "packageQty": 80 }
  ],
  "warnings": [
    "Số lượng container trong booking (2) không khớp với hệ thống (3)",
    "Container Size trong booking: 2x40HC, trong hệ thống: 1x20GP + 1x40HC + 1x40HC"
  ],
  "extractionDetails": {
    "carrierName": "- Lựa chọn: ONE\\n- Nguồn: Góc trái tờ 1\\n- Lý do chọn: Duy nhất",
    "cutOffTime": "⚠️ CẢNH BÁO\\n- Lựa chọn: 14:00 25/03, 10:00 25/03\\n- Nguồn: File PDF Trang 1 và Email\\n- Lý do chọn: Ưu tiên email"
  }
}`;

		const parts: any[] = [
			{
				text: `Phân tích ${hasFileIds ? fileIds?.length : images.length} file và trích xuất thông tin booking vận tải.`,
			},
		];

		// Process local files
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

		// Process Drive files
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
			eportBooking: parsed.eportBooking ?? null,
			eportBookingSuggestions: parsed.eportBookingSuggestions ?? [],
			carrierName: parsed.carrierName ?? null,
			originalCarrierName: parsed.originalCarrierName ?? null,
			carrierNameSuggestions: parsed.carrierNameSuggestions ?? [],
			transitPort: parsed.transitPort ?? null,
			originalTransitPort: parsed.originalTransitPort ?? null,
			transitPortSuggestions: parsed.transitPortSuggestions ?? [],
			destinationPort: parsed.destinationPort ?? null,
			originalDestinationPort: parsed.originalDestinationPort ?? null,
			destinationPortSuggestions: parsed.destinationPortSuggestions ?? [],
			vesselName: parsed.vesselName ?? null,
			vesselNameSuggestions: parsed.vesselNameSuggestions ?? [],
			veselNumber: parsed.veselNumber ?? null,
			veselNumberSuggestions: parsed.veselNumberSuggestions ?? [],
			pickOrLiftPlace: parsed.pickOrLiftPlace ?? null,
			originalPickOrLiftPlace: parsed.originalPickOrLiftPlace ?? null,
			pickOrLiftPlaceSuggestions: parsed.pickOrLiftPlaceSuggestions ?? [],
			blockCode: parsed.blockCode ?? null,
			blockCodeSuggestions: parsed.blockCodeSuggestions ?? [],
			cutOffTime: normalizeCutOffTime(parsed.cutOffTime),
			cutOffTimeSuggestions: Array.isArray(parsed.cutOffTimeSuggestions)
				? parsed.cutOffTimeSuggestions
						.map((t: any) => normalizeCutOffTime(t))
						.filter(Boolean)
				: [],
			containerQuantity: parsed.containerQuantity ?? null,
			containerSizes: parsed.containerSizes ?? [],
			deliveryAt: deliveryAt ?? null,
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
		};

		const allMainFieldsNull =
			!result.eportBooking &&
			!result.carrierName &&
			!result.transitPort &&
			!result.destinationPort &&
			!result.vesselName &&
			!result.veselNumber &&
			!result.pickOrLiftPlace &&
			!result.blockCode &&
			!result.cutOffTime;

		if (allMainFieldsNull) {
			result.warnings = [
				...result.warnings,
				"AI không nhận diện được dữ liệu booking từ file đã chọn. Vui lòng kiểm tra file có đúng chứng từ booking, rõ nội dung, hoặc thử file PDF/ảnh chất lượng cao hơn.",
			];
		}

		if (failedFileIds.length > 0) {
			result.warnings = [
				...result.warnings,
				`Không đọc được ${failedFileIds.length} file từ Drive (có thể do quyền truy cập hoặc định dạng không hỗ trợ).`,
			];
		}

		// Save history
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
		console.error("Booking AI autofill error:", error);
		await logHistory({
			session,
			jobNumber,
			sessionId,
			model:
				chosenModel ||
				process.env.NEXT_PUBLIC_GEMINI_AUTOFILL_BOOKING_MODEL?.split(
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
			{ message: error.message || "Lỗi phân tích booking" },
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
				userCustomPrompt: "booking-bulk-autofill",
				response: opts.responseText ?? null,
				errorMessage: opts.errorMessage ?? null,
				goal: "booking-bulk-autofill",
				sessionId: opts.sessionId || null,
				status: opts.status,
				fileIds: opts.fileIds || [],
				fileNames: opts.fileNames || [],
				totalFileSizeMb: 0,
				requestBody: {
					goal: "booking-bulk-autofill",
					workingFolderId: opts.workingFolderId || null,
				},
				promptTokens: opts.usageMetadata?.promptTokenCount ?? null,
				candidatesTokens: opts.usageMetadata?.candidatesTokenCount ?? null,
				totalTokens: opts.usageMetadata?.totalTokenCount ?? null,
				durationMs: opts.durationMs ?? null,
			},
		});
	} catch (dbErr) {
		console.error("Failed to log booking-autofill history:", dbErr);
	}
}
