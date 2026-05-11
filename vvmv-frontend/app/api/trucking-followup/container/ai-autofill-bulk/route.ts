import mammoth from "mammoth";
import { type NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { getFileContent } from "@/lib/google-drive/upload";

export const maxDuration = 180;

/**
 * GET /api/trucking-followup/container/ai-autofill-bulk?jobNumber=VT-001
 * Returns the last successful bulk autofill result for a given job.
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
				goal: "container-bulk-autofill",
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

		let parsed: any = {};
		try {
			parsed = JSON.parse(last.response);
		} catch {}

		// Support old format (plain array) and new format ({ results, detectedBillOrBooking })
		const results = Array.isArray(parsed) ? parsed : parsed.results || [];
		const detectedBillOrBooking = Array.isArray(parsed)
			? null
			: (parsed.detectedBillOrBooking ?? null);

		return NextResponse.json({
			history: {
				results,
				fileIds: last.fileIds || [],
				fileNames: last.fileNames || [],
				sessionId: last.sessionId,
				createdAt: last.createdAt,
				workingFolderId: (last.requestBody as any)?.workingFolderId ?? null,
				detectedBillOrBooking,
			},
		});
	} catch (error: any) {
		return NextResponse.json({ message: error.message }, { status: 500 });
	}
}

/**
 * POST /api/trucking-followup/container/ai-autofill-bulk
 */
export async function POST(request: NextRequest) {
	const startTime = Date.now();

	let session: any;
	let jobNumber: string | undefined;
	let sessionId: string | undefined;
	let workingFolderId: string | undefined;
	let fileIds: string[] | undefined;
	const fileNames: string[] = [];
	let _billOrBooking: string | undefined;
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
			billOrBooking: bBillOrBooking,
			model: bModel,
			rows = [],
		} = body;

		fileIds = bodyFileIds;
		jobNumber = bJobNumber;
		sessionId = bSessionId;
		workingFolderId = bWorkingFolderId;
		_billOrBooking = bBillOrBooking;
		chosenModel = bModel;
		const _operationType: string | undefined = body.operationType;
		// portName is the resolved airport name (already converted from code on frontend)
		const portName: string | undefined = body.portName;

		const hasImages = images && Array.isArray(images) && images.length > 0;
		const hasFileIds = fileIds && Array.isArray(fileIds) && fileIds.length > 0;

		if (!hasImages && !hasFileIds) {
			return NextResponse.json(
				{ message: "Vui lòng cung cấp ít nhất 1 file để phân tích" },
				{ status: 400 },
			);
		}
		if (!rows || rows.length === 0) {
			return NextResponse.json(
				{ message: "Không có dòng container nào để điền" },
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
			process.env.NEXT_PUBLIC_GEMINI_AUTOFILL_CONTAINER_MODEL ||
			"gemini-1.5-pro-002";
		const availableModels = envModelsStr
			.split(",")
			.map((m) => m.trim())
			.filter(Boolean);
		const model = chosenModel || availableModels[0];

		const rowsDesc = rows
			.map(
				(r: any, i: number) =>
					`Row ${i + 1} (id: ${r.id})${r.containerSize ? `, size: ${r.containerSize}` : ""}${r.containerNo ? `, existing containerNo: ${r.containerNo}` : ""}`,
			)
			.join("\n");

		const systemInstruction = `Bạn là chuyên gia phân tích thông tin container vận tải.
Nhiệm vụ: Đọc TẤT CẢ tài liệu/ảnh được cung cấp và trích xuất thông tin cho TỪNG container.

DANH SÁCH DÒNG CONTAINER CẦN ĐIỀN:
${rowsDesc}

QUY TẮC QUAN TRỌNG:
1. Mỗi file/ảnh có thể chứa thông tin của 1 hoặc nhiều container.
2. Phân tích và ghép thông tin container với đúng dòng dựa trên:
   - Container size (20ft, 40ft, 40HC): ưu tiên ghép với dòng có cùng size
   - Số container (MSCU1234567): 4 chữ cái (đôi khi sẽ có các kí tự như - ở giữa hoặc phía sau)  + 7 số
   - Thứ tự xuất hiện trong tài liệu
3. Mỗi dòng container CHỈ nhận 1 set thông tin (containerNo, sealNo, tareWeight, masGross, containerType).
4. Trường fileIndices: danh sách index (0-based) của các file liên quan đến container này.
5. Trường fileRoles: với mỗi file được gán cho container này, xác định nội dung chính:
   - "container": ảnh/file chủ yếu chứa số container (BIC code trên thân container)
   - "seal": ảnh/file chủ yếu chứa hình chì niêm phong / seal
   - "other": file khác
   Đối với mỗi file có role "container" hoặc "seal", BẮT BUỘC trả thêm "cropRegion" — bounding box CHÍNH XÁC bao quanh dòng text số container/seal.
   Tọa độ chuẩn hóa 0-1 so với kích thước ảnh gốc: { "top": 0.0-1.0, "left": 0.0-1.0, "bottom": 0.0-1.0, "right": 0.0-1.0, "rotation": độ }.
   Trường "rotation" (số độ, -45 đến 45): góc nghiêng của dòng text trong ảnh. Dương = nghiêng theo chiều kim đồng hồ, âm = ngược. Nếu text nằm ngang (không nghiêng), rotation = 0. Luôn trả trường này.
   HƯỚNG DẪN CHI TIẾT về cropRegion (RẤT QUAN TRỌNG — ảnh hưởng hiển thị cho user):
   - top = mép trên của ký tự đầu tiên, left = mép trái của ký tự đầu tiên.
   - bottom = mép dưới của ký tự cuối cùng, right = mép phải của ký tự cuối cùng.
   - Chỉ thêm padding 3-5% mỗi bên (KHÔNG quá 5%).
   - Crop phải CỰC KỲ CHẶT — chỉ bao đúng dòng text, KHÔNG bao cả mặt container, nền trời, hay phần ảnh không liên quan.
   - Với container number (vd: MSCU1234567): crop phải bao ĐỦ cả 4 chữ cái + 7 số, bao gồm số cuối cùng bên phải.
   - Với seal number: crop chặt quanh dãy số/chữ trên seal, KHÔNG bao cả thân seal hay dây thít.
   - Crop KHÔNG ĐƯỢC rộng quá 60% chiều ngang ảnh trừ khi text thật sự dài.
   - Ví dụ chuẩn: số container nằm giữa-trên ảnh → { "top": 0.20, "left": 0.25, "bottom": 0.30, "right": 0.72 }.
6. Nếu không tìm thấy thông tin cho một dòng, để null.
7. Tare Weight và Max Gross thường ghi trên container/tally sheet với "TARE", "MAX GROSS", "GR MASS".
8. Kiểm tra bill/booking: trong hình/tài liệu có thể xuất hiện số bill, vận đơn hoặc số booking.
   Nếu tìm thấy và KHAI KHÔNG khớp với giá trị cần kiểm tra, trả về trường "billMismatch" (gồm "detected" và "reason"). Nếu khớp hoặc không tìm thấy, "billMismatch" là null.
9. Trường "detectedBillOrBooking": luôn điền giá trị số bill/booking nếu tìm thấy (dù khớp hay không). Nếu không thấy, để null.
10. Trường "containerType": mã loại container theo chuẩn ISO 6346, gồm đúng 4 ký tự (2 chữ số kích thước + 1 chữ cái loại + 1 ký tự biến thể), ví dụ: "22G1" (20ft General Purpose), "42G0" (40ft GP), "45G1" (40ft High Cube), "22R1" (20ft Reefer), "42R1" (40ft Reefer), "45R1" (40ft HC Reefer), "22U1" (20ft Open Top), "42U1" (40ft Open Top), "22P1" (20ft Flat Rack), "42P1" (40ft Flat Rack). Mã này thường in trên tấm CSC plate hoặc nhãn container. Trả về đúng 4 ký tự nếu tìm thấy, nếu không để null.
11. CHỈ trả về JSON object, không có giải thích thêm.
Lưu ý: Số seal/chì niêm phong (có thể là số hoặc chuỗi ký tự, có thể có dấu gạch ngang, hoặc 1-2 khoảng trắng dạng AB  A123456 nhưng kết quả bỏ khoảng trắng, nếu xuất hiện trên chứng từ sẽ có label ghi "SEAL" hoặc "SEAL NO", nhưng ưu tiên lấy thông tin ở hình cái seal vì trên chứng từ có thể thiếu kí tự đầu và bị bỏ kí tự trước khoảng trắng). Số container và Số seal không được trùng vì nó là duy nhất.
CẤU TRÚC JSON BẮT BUỘC:
{
  "detectedBillOrBooking": "SNLGHMCL001285",
  "billMismatch": null,
  "results": [
    {
      "rowId": "id của dòng container",
      "containerNo": "MSCU1234567 hoặc null",
      "sealNo": "VN123456 hoặc null",
      "tareWeight": 2200,
      "masGross": 30480,
      "containerType": "45G1",
      "fileIndices": [0, 1],
      "fileRoles": [
        { "fileIndex": 0, "role": "container", "cropRegion": { "top": 0.20, "left": 0.25, "bottom": 0.30, "right": 0.72, "rotation": -3 } },
        { "fileIndex": 1, "role": "seal", "cropRegion": { "top": 0.40, "left": 0.30, "bottom": 0.52, "right": 0.70, "rotation": 0 } }
      ]
    }
  ]
}`;

		const parts: any[] = [
			{
				text: `Phân tích ${hasFileIds ? fileIds?.length : images.length} file và điền thông tin cho ${rows.length} dòng container:\n${rowsDesc}`,
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
		// Support both { results: [], billMismatch: ... } and plain array
		const rawResults: any[] = Array.isArray(parsed)
			? parsed
			: parsed.results || [];
		const billMismatch = Array.isArray(parsed)
			? null
			: (parsed.billMismatch ?? null);

		const rowIds = rows.map((r: any) => r.id);
		const resultMap = new Map(rawResults.map((r: any) => [r.rowId, r]));

		// Port name for kc lookup (already resolved from code to name on frontend)
		const portName2Use: string | undefined = portName;

		const results = await Promise.all(
			rowIds.map(async (id: string) => {
				const r = resultMap.get(id) || {};
				const aiContainerType: string | null = r.containerType ?? null;

				// Lookup kc + containerSize from ContainerSizeConfig using resolved airport name
				let kc: string | null = null;
				let mappedContainerSize: string | null = null;
				if (aiContainerType) {
					if (portName2Use) {
						const config = await prismaRPA.containerSizeConfig.findFirst({
							where: { isoType: aiContainerType, port: portName2Use },
							select: { kc: true, containerSize: true },
						});
						if (config?.kc) kc = config.kc;
						if (config?.containerSize)
							mappedContainerSize = config.containerSize;
					}
					// Fallback: isoType only, no port restriction
					if (!kc && !mappedContainerSize) {
						const config = await prismaRPA.containerSizeConfig.findFirst({
							where: { isoType: aiContainerType, port: null },
							select: { kc: true, containerSize: true },
						});
						if (config?.kc) kc = config.kc;
						if (config?.containerSize)
							mappedContainerSize = config.containerSize;
					}
				}

				const result = {
					rowId: id,
					containerNo: r.containerNo ?? null,
					sealNo: r.sealNo ?? null,
					tareWeight:
						r.tareWeight != null ? Number(r.tareWeight) || null : null,
					masGross: r.masGross != null ? Number(r.masGross) || null : null,
					containerType: aiContainerType,
					kc,
					mappedContainerSize,
					matchedFileIds: (r.fileIndices || [])
						.map((i: number) => fileIds?.[i] ?? null)
						.filter(Boolean),
					matchedFileNames: (r.fileIndices || [])
						.map((i: number) => fileNames[i] ?? null)
						.filter(Boolean),
					fileRoles: (r.fileRoles || []) as Array<{
						fileIndex: number;
						role: "container" | "seal" | "other";
						cropRegion?: {
							top: number;
							left: number;
							bottom: number;
							right: number;
							rotation?: number;
						};
					}>,
				};
				return result;
			}),
		);

		// Save top-level object (preserves detectedBillOrBooking for future re-validation)
		const responsePayload = {
			results,
			detectedBillOrBooking: parsed.detectedBillOrBooking ?? null,
			billMismatch,
		};
		await logHistory({
			session,
			jobNumber,
			sessionId,
			workingFolderId,
			model,
			fileIds,
			fileNames,
			status: 200,
			responseText: JSON.stringify(responsePayload),
			durationMs,
			usageMetadata: data.usageMetadata,
		});
		return NextResponse.json({ results, billMismatch, model });
	} catch (error: any) {
		const durationMs = Date.now() - startTime;
		console.error("Bulk container AI autofill error:", error);
		await logHistory({
			session,
			jobNumber,
			sessionId,
			model:
				chosenModel ||
				process.env.NEXT_PUBLIC_GEMINI_AUTOFILL_CONTAINER_MODEL?.split(
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
			{ message: error.message || "Lỗi phân tích bulk container" },
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
				userCustomPrompt: "container-bulk-autofill",
				response: opts.responseText ?? null,
				errorMessage: opts.errorMessage ?? null,
				goal: "container-bulk-autofill",
				sessionId: opts.sessionId || null,
				status: opts.status,
				fileIds: opts.fileIds || [],
				fileNames: opts.fileNames || [],
				totalFileSizeMb: 0,
				requestBody: {
					goal: "container-bulk-autofill",
					workingFolderId: opts.workingFolderId || null,
				},
				promptTokens: opts.usageMetadata?.promptTokenCount ?? null,
				candidatesTokens: opts.usageMetadata?.candidatesTokenCount ?? null,
				totalTokens: opts.usageMetadata?.totalTokenCount ?? null,
				durationMs: opts.durationMs ?? null,
			},
		});
	} catch (dbErr) {
		console.error("Failed to log bulk-autofill history:", dbErr);
	}
}
