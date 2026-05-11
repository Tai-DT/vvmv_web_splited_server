import mammoth from "mammoth";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import {
	extractGeminiUsageMetrics,
	type GeminiUsageMetadataLike,
} from "@/lib/gemini-usage-metadata";
import { getFileContent } from "@/lib/google-drive/upload";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Increased to 5 minutes
const GEMINI_HISTORY_RESPONSE_MAX_LENGTH = 50_000;

function toSafeHistoryResponse(value: string | null | undefined) {
	const text = String(value ?? "");
	if (!text) {
		return null;
	}
	if (text.length <= GEMINI_HISTORY_RESPONSE_MAX_LENGTH) {
		return text;
	}
	return `${text.slice(0, GEMINI_HISTORY_RESPONSE_MAX_LENGTH)}...[truncated]`;
}

export async function POST(req: Request) {
	const startTime = Date.now();
	const fileNames: string[] = [];
	let totalSize = 0;

	let session: any;
	let model: string | undefined;
	let fileIds: string[] | undefined;
	let jobNumber: string | undefined;
	let taxCode: string | undefined;
	let operationType: string | undefined;
	let serviceMode: string | undefined;
	let userCustomPrompt: string | undefined;
	let goal: string | undefined;
	let history: any[] | undefined;
	let sessionId: string | undefined;

	try {
		session = await auth.api.getSession({ headers: req.headers });
		const body_ = await req.json();
		({
			model,
			fileIds,
			jobNumber,
			taxCode,
			operationType,
			serviceMode,
			userCustomPrompt,
			goal,
			history,
			sessionId,
		} = body_);
		const {
			contents,
			prompt: legacyPrompt,
			systemInstruction,
			responseType,
		} = body_;
		const apiKey = process.env.GEMINI_API_KEY;

		// Resolve the effective user message:
		// - Prefer `userCustomPrompt` (from dialog UI) if provided
		// - Fall back to legacy `prompt` field (for backward compatibility / other callers)
		// - Final fallback: generic message
		const effectiveUserMessage =
			userCustomPrompt?.trim() ||
			legacyPrompt?.trim() ||
			"Phân tích tài liệu và trích xuất thông tin theo cấu trúc đã yêu cầu.";

		if (!apiKey) {
			return NextResponse.json(
				{ error: "API Key không tồn tại trong hệ thống" },
				{ status: 500 },
			);
		}

		let finalContents = contents;

		// Build contents from effectiveUserMessage and files if contents is not directly provided
		if (!finalContents) {
			const parts: any[] = [{ text: effectiveUserMessage }];

			if (fileIds && Array.isArray(fileIds)) {
				for (const fileId of fileIds) {
					try {
						const {
							buffer,
							mimeType,
							name: fetchedName,
						} = await getFileContent(fileId);
						fileNames.push(fetchedName || fileId);
						totalSize += buffer.length;

						const isExcel =
							mimeType ===
								"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
							mimeType === "application/vnd.ms-excel";

						if (isExcel) {
							const workbook = XLSX.read(buffer, { type: "buffer" });
							let excelText = `[Nội dung file Excel]\n`;
							workbook.SheetNames.forEach((name) => {
								excelText += `${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}\n`;
							});
							parts.push({ text: excelText });
						} else if (
							mimeType ===
							"application/vnd.openxmlformats-officedocument.wordprocessingml.document"
						) {
							const docxResult = await mammoth.extractRawText({ buffer });
							parts.push({
								text: `[Nội dung file .docx: ${fileId}]\n${docxResult.value}`,
							});
						} else if (
							mimeType === "application/pdf" ||
							mimeType.startsWith("image/")
						) {
							parts.push({
								inline_data: {
									mime_type: mimeType,
									data: buffer.toString("base64"),
								},
							});
						}
						// Note: .doc (old format) is still unsupported here by Gemini and mammoth directly
					} catch (fileError) {
						console.error(`Error processing file ${fileId}:`, fileError);
					}
				}
			}

			finalContents =
				history && history.length > 0
					? [...history, { role: "user", parts }]
					: [{ parts }];
		}

		if (!finalContents || finalContents.length === 0) {
			return NextResponse.json(
				{ error: "Nội dung yêu cầu (contents) không được để trống." },
				{ status: 400 },
			);
		}

		const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes

		const requestBody: any = {
			contents: finalContents,
			generationConfig: {
				// maxOutputTokens: 81920,
				temperature: 0.1,
				topP: 0.95,
			},
		};

		if (systemInstruction) {
			requestBody.system_instruction = {
				parts: [{ text: systemInstruction }],
			};
		}

		if (responseType === "json") {
			requestBody.generationConfig.response_mime_type = "application/json";
		}

		const response = await fetch(apiUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
			signal: controller.signal,
		});

		clearTimeout(timeoutId);
		const data = await response.json();

		// Helper to log to DB (always wrapped in try/catch to not break main flow)
		const logHistory = async (opts: {
			status: number;
			responseText?: string | null;
			errorMessage?: string | null;
			usageMetadata?: GeminiUsageMetadataLike;
		}) => {
			try {
				const usageMetrics = extractGeminiUsageMetrics(opts.usageMetadata);

				await prismaRPA.geminiHistory.create({
					data: {
						jobNumber,
						userId: session?.user?.id,
						userName: session?.user?.name,
						model,
						userCustomPrompt: userCustomPrompt || null,
						response: toSafeHistoryResponse(opts.responseText),
						errorMessage: opts.errorMessage ?? null,
						taxCode: taxCode || null,
						operationType: operationType || null,
						serviceMode: serviceMode || null,
						goal: goal || null,
						sessionId: sessionId || null,
						status: opts.status,
						fileIds: fileIds || [],
						fileNames,
						totalFileSizeMb: parseFloat((totalSize / (1024 * 1024)).toFixed(2)),
						requestBody: { model, fileIds, jobNumber },
						promptTokens: usageMetrics.promptTokens,
						candidatesTokens: usageMetrics.candidatesTokens,
						totalTokens: usageMetrics.totalTokens,
						durationMs: Date.now() - startTime,
					},
				});
			} catch (dbErr) {
				console.error("Failed to log Gemini history:", dbErr);
			}
		};

		if (!response.ok) {
			console.error("Gemini API Error:", data);
			const errMsg = data.error?.message || `API Error: ${response.status}`;
			await logHistory({
				status: response.status,
				errorMessage: errMsg,
				usageMetadata: data,
			});
			return NextResponse.json(
				{
					error: errMsg,
					details: data.error,
				},
				{ status: response.status },
			);
		}

		// Comprehensive extraction logic
		const candidate = data.candidates?.[0];

		if (candidate?.finishReason && candidate.finishReason !== "STOP") {
			const errMsg = `AI dừng xử lý vì lý do: ${candidate.finishReason}`;
			await logHistory({
				status: 200,
				errorMessage: errMsg,
				usageMetadata: data,
			});
			return NextResponse.json(
				{
					error: errMsg,
					details: candidate,
				},
				{ status: 200 },
			);
		}

		const text = candidate?.content?.parts?.[0]?.text;

		if (!text) {
			console.error("Empty response from Gemini:", data);
			await logHistory({
				status: 200,
				errorMessage: "Empty response from Gemini",
				usageMetadata: data,
			});
			return NextResponse.json(
				{
					error:
						"AI không trả về nội dung. Có thể do file không chứa văn bản hoặc nội dung bị từ chối.",
					raw: data,
				},
				{ status: 200 },
			);
		}

		// Log success
		await logHistory({
			status: response.status,
			responseText: text,
			usageMetadata: data,
		});

		return NextResponse.json({ text });
	} catch (error: any) {
		const durationMs = Date.now() - startTime;
		const isTimeout = error.name === "AbortError";

		if (isTimeout) {
			console.error("Gemini API Request Timed Out (300s)");
		} else {
			console.error("Internal Server Error:", error);
		}

		// Log error to DB
		try {
			await prismaRPA.geminiHistory.create({
				data: {
					jobNumber,
					userId: session?.user?.id,
					userName: session?.user?.name,
					model,
					userCustomPrompt: userCustomPrompt || null,
					errorMessage: isTimeout ? "Timeout after 300s" : error.message,
					status: isTimeout ? 504 : 500,
					taxCode: taxCode || null,
					operationType: operationType || null,
					serviceMode: serviceMode || null,
					goal: goal || null,
					sessionId: sessionId || null,
					fileIds: fileIds || [],
					fileNames,
					totalFileSizeMb: parseFloat((totalSize / (1024 * 1024)).toFixed(2)),
					requestBody: { model, fileIds, jobNumber },
					durationMs,
				},
			});
		} catch (dbErr) {
			console.error("Failed to log error history:", dbErr);
		}

		if (isTimeout) {
			return NextResponse.json(
				{
					error:
						"Yêu cầu quá thời gian xử lý (Timeout) 5 phút. Gemini có thể đang xử lý quá nhiều dữ liệu hoặc file quá lớn. Vui lòng thử lại với ít file hơn.",
				},
				{ status: 504 },
			);
		}
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
