import mammoth from "mammoth";
import { type NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { getFileContent } from "@/lib/google-drive/upload";

export const maxDuration = 120;

/**
 * GET /api/trucking-followup/container/ai-autofill?jobNumber=VT-001
 * Returns the most recent successful container-autofill result for the given job.
 */
export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const jobNumber = searchParams.get("jobNumber");
		const containerId = searchParams.get("containerId");

		// Need at least containerId to look up per-row history
		if (!containerId && !jobNumber) {
			return NextResponse.json({ history: null });
		}

		const last = await prismaRPA.geminiHistory.findFirst({
			where: {
				...(jobNumber ? { jobNumber } : {}),
				goal: "container-autofill",
				status: 200,
				response: { not: null },
				errorMessage: null,
				// Filter by containerId stored in requestBody JSON
				...(containerId
					? {
							requestBody: {
								path: ["containerId"],
								equals: containerId,
							},
						}
					: {}),
			},
			orderBy: { createdAt: "desc" },
			select: {
				response: true,
				fileNames: true,
				fileIds: true,
				sessionId: true,
				createdAt: true,
				requestBody: true,
			},
		});

		if (!last?.response) {
			return NextResponse.json({ history: null });
		}

		let parsed: any = null;
		try {
			parsed = JSON.parse(last.response);
		} catch {
			return NextResponse.json({ history: null });
		}

		return NextResponse.json({
			history: {
				containerNo: parsed.containerNo ?? null,
				sealNo: parsed.sealNo ?? null,
				tareWeight: parsed.tareWeight ?? null,
				masGross: parsed.masGross ?? null,
				containerType: parsed.containerType ?? null,
				kc: parsed.kc ?? null,
				fileNames: last.fileNames || [],
				fileIds: last.fileIds || [],
				sessionId: last.sessionId,
				createdAt: last.createdAt,
				workingFolderId: (last.requestBody as any)?.workingFolderId ?? null,
				// Restore AI-identified roles and detected bill for dynamic re-validation
				fileRoles: parsed.fileRoles || [],
				detectedBillOrBooking: parsed.detectedBillOrBooking ?? null,
				// billMismatch is NOT restored from history — recomputed dynamically in dialog
			},
		});
	} catch (error: any) {
		console.error("Container AI autofill history GET error:", error);
		return NextResponse.json({ history: null });
	}
}

/**
 * POST /api/trucking-followup/container/ai-autofill
 * Analyze container images using Gemini AI to extract:
 * - containerNo, sealNo, tareWeight, masGross (Max Weight)
 *
 * Body (one of):
 *   { images: Array<{ data: string (base64), mimeType: string, name: string }>, jobNumber?: string }
 *   { fileIds: string[], jobNumber?: string }
 */
export async function POST(request: NextRequest) {
	const startTime = Date.now();

	let session: any;
	let jobNumber: string | undefined;
	let sessionId: string | undefined;
	let containerId: string | undefined;
	let workingFolderId: string | undefined;
	let fileIds: string[] | undefined;
	const fileNames: string[] = [];
	let billOrBooking: string | undefined;

	try {
		session = await auth.api.getSession({ headers: request.headers });

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const {
			images,
			fileIds: bodyFileIds,
			jobNumber: bodyJobNumber,
			sessionId: bodySessionId,
			workingFolderId: bodyWorkingFolderId,
			containerId: bodyContainerId,
			billOrBooking: bodyBillOrBooking,
			operationType: bodyOperationType,
			portName: bodyPortName,
			model: bodyChosenModel,
		} = body;
		fileIds = bodyFileIds;
		jobNumber = bodyJobNumber;
		sessionId = bodySessionId;
		workingFolderId = bodyWorkingFolderId;
		containerId = bodyContainerId;
		billOrBooking = bodyBillOrBooking;
		const _operationType: string | undefined = bodyOperationType;
		// portName is the resolved airport name (already converted from code on frontend)
		const portName: string | undefined = bodyPortName;

		const hasImages = images && Array.isArray(images) && images.length > 0;
		const hasFileIds = fileIds && Array.isArray(fileIds) && fileIds.length > 0;

		if (!hasImages && !hasFileIds) {
			return NextResponse.json(
				{ message: "Vui lòng cung cấp ít nhất 1 ảnh để phân tích" },
				{ status: 400 },
			);
		}

		const apiKey = process.env.GEMINI_API_KEY;
		if (!apiKey) {
			return NextResponse.json(
				{ message: "Gemini API key chưa được cấu hình" },
				{ status: 500 },
			);
		}

		const envModelsStr =
			process.env.NEXT_PUBLIC_GEMINI_AUTOFILL_CONTAINER_MODEL ||
			"gemini-1.5-pro-002";
		const availableModels = envModelsStr
			.split(",")
			.map((m) => m.trim())
			.filter(Boolean);
		const model = bodyChosenModel || availableModels[0];

		const systemInstruction = `Bạn là trợ lý chuyên nghiệp phân tích thông tin container vận tải. 
Nhiệm vụ của bạn là trích xuất thông tin từ ảnh container/tem/nhãn container.

QUY TẮC QUAN TRỌNG:
1. Trả về DUY NHẤT một đối tượng JSON với các trường sau:
   - "containerNo": Số container (thường có định dạng 4 chữ cái (đôi khi sẽ có các kí tự như - ở giữa hoặc phía sau) + 7 chữ số, ví dụ: "MSCU1234567", "TCKU3456789")
   - "sealNo": Số seal/chì niêm phong (có thể là số hoặc chuỗi ký tự, có thể có dấu gạch ngang, hoặc khoảng trắng dạng AB A123456 nhưng kết quả bỏ khoảng trắng)
   - "tareWeight": Tare Weight / Trọng lượng vỏ container (đơn vị kg, chỉ trả về số, không có đơn vị)
   - "masGross": Max Gross Weight / Trọng lượng cả container tối đa cho phép (đơn vị kg, chỉ trả về số, không có đơn vị)
   - "containerType": Mã loại container theo chuẩn ISO 6346, gồm đúng 4 ký tự (2 chữ số kích thước + 1 chữ cái loại + 1 ký tự biến thể), ví dụ: "22G1" (20ft General Purpose), "42G0" (40ft General Purpose), "45G1" (40ft High Cube), "22R1" (20ft Reefer), "42R1" (40ft Reefer), "45R1" (40ft HC Reefer), "22U1" (20ft Open Top), "42U1" (40ft Open Top), "22P1" (20ft Flat Rack), "42P1" (40ft Flat Rack). Mã này thường được in trên tấm CSC plate hoặc nhãn container gần số container. Trả về đúng 4 ký tự nếu tìm thấy, nếu không để null.
2. Nếu không tìm thấy thông tin nào, để trống hoặc null.
3. Số TareWeight và MaxGross thường được ghi trên container với ký hiệu "TARE", "MAX GROSS", "MAX GR", "MAX PAYLOAD", "GR MASS".
4. Trường "fileRoles": với mỗi file (theo thứ tự 0-based), xác định nội dung chính:
   - "container": ảnh/file chủ yếu chứa số container (BIC code trên thân container)
   - "seal": ảnh/file chủ yếu chứa hình chì niêm phong / seal
   - "other": file khác không thuộc 2 loại trên
   Đối với mỗi file có role "container" hoặc "seal", BẮT BUỘC trả thêm "cropRegion" là vùng ảnh chứa số container/seal cần zoom, dùng tọa độ chuẩn hóa 0-1 (tỷ lệ % so với kích thước ảnh gốc): { "top": 0.0-1.0, "left": 0.0-1.0, "bottom": 0.0-1.0, "right": 0.0-1.0 }. Hãy xác định chính xác vùng chứa text số container/seal, thêm padding ~10-15% xung quanh để không bị cắt sát.
5. Chỉ trả về JSON, không có giải thích thêm.
6. Trường "detectedBillOrBooking": luôn điền giá trị số bill/booking/vận đơn nếu tìm thấy trong ảnh (dù khớp hay không). Nếu không thấy, để null.
7. Trường "billMismatch": nếu đã tìm thấy "detectedBillOrBooking" và giá trị kiểm tra là "${billOrBooking || ""}", hãy so sánh. Nếu KHÔNG khớp điền "billMismatch" với "detected" và "reason", nếu khớp hoặc không có giá trị kiểm tra để null.
8. Số container và Số seal không được trùng vì nó là duy nhất.
CẤU TRÚC JSON BẮT BUỘC:
{
  "containerNo": "MSCU1234567",
  "sealNo": "VN123456",
  "tareWeight": 2200,
  "masGross": 30480,
  "containerType": "45G1",
  "fileRoles": [
    { "fileIndex": 0, "role": "container", "cropRegion": { "top": 0.1, "left": 0.05, "bottom": 0.45, "right": 0.95 } },
    { "fileIndex": 1, "role": "seal", "cropRegion": { "top": 0.2, "left": 0.1, "bottom": 0.8, "right": 0.9 } },
    { "fileIndex": 2, "role": "other" }
  ],
  "detectedBillOrBooking": "SNLGHMCL001285",
  "billMismatch": null
}`;

		const parts: any[] = [
			{
				text: "Phân tích ảnh container và trích xuất thông tin Container No, Seal No, Tare Weight, và Max Gross Weight.",
			},
		];

		// Add local files (base64 for images/PDF, text extraction for Word/Excel)
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
					img.mimeType ===
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
					img.mimeType === "application/vnd.ms-excel"
				) {
					const workbook = XLSX.read(buf, { type: "buffer" });
					let txt = `[Excel: ${img.name}]\n`;
					workbook.SheetNames.forEach((sn) => {
						txt += `${XLSX.utils.sheet_to_csv(workbook.Sheets[sn])}\n`;
					});
					parts.push({ text: txt });
				} else if (
					img.mimeType ===
					"application/vnd.openxmlformats-officedocument.wordprocessingml.document"
				) {
					const { value } = await mammoth.extractRawText({ buffer: buf });
					parts.push({ text: `[Word: ${img.name}]\n${value}` });
				} else {
					// Generic: try inline_data
					parts.push({
						inline_data: { mime_type: img.mimeType, data: img.data },
					});
				}
				fileNames.push(img.name || "local-file");
			}
		}

		// Fetch files from Google Drive — support images, PDF, Word, Excel
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
						mimeType ===
							"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
						mimeType === "application/vnd.ms-excel"
					) {
						const workbook = XLSX.read(buffer, { type: "buffer" });
						let txt = `[Excel: ${fname}]\n`;
						workbook.SheetNames.forEach((sn) => {
							txt += `${XLSX.utils.sheet_to_csv(workbook.Sheets[sn])}\n`;
						});
						parts.push({ text: txt });
					} else if (
						mimeType ===
						"application/vnd.openxmlformats-officedocument.wordprocessingml.document"
					) {
						const { value } = await mammoth.extractRawText({ buffer });
						parts.push({ text: `[Word: ${fname}]\n${value}` });
					} else {
						// Generic fallback: inline
						parts.push({
							inline_data: {
								mime_type: mimeType,
								data: buffer.toString("base64"),
							},
						});
					}
					fileNames.push(fname);
				} catch (fetchErr) {
					console.error(`Failed to fetch Drive file ${fileId}:`, fetchErr);
				}
			}
		}

		if (parts.length <= 1) {
			return NextResponse.json(
				{ message: "Không thể tải ảnh để phân tích" },
				{ status: 400 },
			);
		}

		const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

		const requestBody = {
			system_instruction: {
				parts: [{ text: systemInstruction }],
			},
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
			body: JSON.stringify(requestBody),
		});

		const data = await response.json();
		const durationMs = Date.now() - startTime;

		if (!response.ok) {
			const errMsg =
				data.error?.message || `Gemini API error: ${response.status}`;
			console.error("Container AI Autofill Error:", errMsg);

			// Log failure to history
			await logHistory({
				session,
				jobNumber,
				sessionId,
				containerId,
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
				containerId,
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

		// Parse JSON response
		const jsonStr = text.replace(/```json|```/g, "").trim();
		const extracted = JSON.parse(jsonStr);

		// Lookup kc + containerSize from ContainerSizeConfig using resolved airport name
		let kc: string | null = null;
		let mappedContainerSize: string | null = null;
		const aiContainerType = extracted.containerType || null;
		if (aiContainerType) {
			// portName is already the airport name (converted from code on frontend)
			if (portName) {
				const config = await prismaRPA.containerSizeConfig.findFirst({
					where: { isoType: aiContainerType, port: portName },
					select: { kc: true, containerSize: true },
				});
				if (config?.kc) kc = config.kc;
				if (config?.containerSize) mappedContainerSize = config.containerSize;
			}
			// Fallback: match only isoType if no port-specific config found
			if (!kc && !mappedContainerSize) {
				const config = await prismaRPA.containerSizeConfig.findFirst({
					where: { isoType: aiContainerType, port: null },
					select: { kc: true, containerSize: true },
				});
				if (config?.kc) kc = config.kc;
				if (config?.containerSize) mappedContainerSize = config.containerSize;
			}
		}

		const result = {
			containerNo: extracted.containerNo || null,
			sealNo: extracted.sealNo || null,
			tareWeight:
				extracted.tareWeight != null
					? Number(extracted.tareWeight) || null
					: null,
			masGross:
				extracted.masGross != null ? Number(extracted.masGross) || null : null,
			containerType: extracted.containerType || null,
			kc,
			mappedContainerSize,
			fileRoles: (extracted.fileRoles || []) as Array<{
				fileIndex: number;
				role: "container" | "seal" | "other";
				cropRegion?: {
					top: number;
					left: number;
					bottom: number;
					right: number;
				};
			}>,
			// Always store the detected bill/booking value (even if matching) for future re-validation on dialog reopen
			detectedBillOrBooking: (extracted.detectedBillOrBooking ||
				extracted.billMismatch?.detected ||
				null) as string | null,
			// Compute mismatch live: compare detected vs current billOrBooking
			billMismatch: (() => {
				const detected =
					extracted.detectedBillOrBooking ||
					extracted.billMismatch?.detected ||
					null;
				if (!detected) return null;
				if (!billOrBooking) return null;
				const matches =
					detected.trim().toLowerCase() === billOrBooking.trim().toLowerCase();
				if (matches) return null;
				return {
					detected,
					reason:
						extracted.billMismatch?.reason ||
						`Số bill/booking phát hiện (${detected}) không khớp với giá trị hiện tại (${billOrBooking}).`,
				};
			})(),
		};

		// Log success to gemini_history
		await logHistory({
			session,
			jobNumber,
			sessionId,
			containerId,
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
		console.error("Container AI autofill error:", error);

		// Log crash to history
		await logHistory({
			session,
			jobNumber,
			sessionId,
			containerId,
			model:
				process.env.NEXT_PUBLIC_GEMINI_AUTOFILL_CONTAINER_MODEL ||
				"gemini-1.5-pro-002",
			fileIds,
			fileNames,
			status: 500,
			errorMessage: error.message,
			durationMs,
		}).catch(() => {});

		return NextResponse.json(
			{ message: error.message || "Đã xảy ra lỗi khi phân tích ảnh container" },
			{ status: 500 },
		);
	}
}

// ─── Helper: log to gemini_history ────────────────────────────────────────────
async function logHistory(opts: {
	session: any;
	jobNumber?: string;
	sessionId?: string;
	containerId?: string;
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
				userCustomPrompt: "container-autofill",
				response: opts.responseText ?? null,
				errorMessage: opts.errorMessage ?? null,
				goal: "container-autofill",
				sessionId: opts.sessionId || null,
				status: opts.status,
				fileIds: opts.fileIds || [],
				fileNames: opts.fileNames || [],
				totalFileSizeMb: 0,
				requestBody: {
					goal: "container-autofill",
					containerId: opts.containerId || null,
					fileIds: opts.fileIds,
					workingFolderId: opts.workingFolderId || null,
				},
				promptTokens: opts.usageMetadata?.promptTokenCount ?? null,
				candidatesTokens: opts.usageMetadata?.candidatesTokenCount ?? null,
				totalTokens: opts.usageMetadata?.totalTokenCount ?? null,
				durationMs: opts.durationMs ?? null,
			},
		});
	} catch (dbErr) {
		console.error("Failed to log container-autofill history:", dbErr);
	}
}
