import { type NextRequest, NextResponse } from "next/server";
import type { CdsAiUsageMetrics } from "@/app/(home)/internal/followup/_components/panels/cds/ai/cds-ai-types";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { sanitizeCdsAiDocumentResult } from "@/lib/followup/cds-ai-document";
import { checkFollowUpPermission } from "@/lib/followup/check-permission";
import type { FollowUpOperationType } from "@/lib/followup/operation-type";

type HistoryMessage = {
	id: string;
	role: "user" | "assistant";
	text: string;
	tone?: "default" | "error";
	result?: ReturnType<typeof sanitizeCdsAiDocumentResult> | null;
	usage?: CdsAiUsageMetrics | null;
};

type HistorySession = {
	id: string;
	firstAt: Date;
	lastAt: Date;
	messages: HistoryMessage[];
	latestResult: ReturnType<typeof sanitizeCdsAiDocumentResult> | null;
	activeResultMessageId: string | null;
	fileNames: string[];
	fileIds: string[];
};

function buildSessionLabel(value: Date) {
	return `Phiên ${new Intl.DateTimeFormat("vi-VN", {
		hour: "2-digit",
		minute: "2-digit",
		day: "2-digit",
		month: "2-digit",
	}).format(value)}`;
}

function getRequestBodyObject(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}

	return value as Record<string, unknown>;
}

function getFallbackUserPrompt(isDraftRevision: boolean) {
	return isDraftRevision
		? "Yêu cầu chỉnh lại kết quả bóc CDS."
		: "Phân tích chứng từ để điền CDS.";
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await auth.api.getSession({ headers: req.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { id } = await params;
		const permission = await checkFollowUpPermission(
			id,
			session.user.id,
			session.user.role ?? "",
			{ mode: "read" },
		);

		if (!permission.ok) {
			return NextResponse.json(
				{ error: permission.error },
				{ status: permission.status },
			);
		}

		const followUp = await prismaRPA.followUp.findUnique({
			where: { id },
			select: {
				jobNumber: true,
				operationType: true,
			},
		});

		if (!followUp?.jobNumber) {
			return NextResponse.json({
				sessions: [],
				history: [],
				latestResult: null,
				currentSessionId: null,
				fileNames: [],
				fileIds: [],
				activeResultMessageId: null,
			});
		}

		const { searchParams } = new URL(req.url);
		const requestedSessionId = searchParams.get("sessionId");

		const entries = await prismaRPA.geminiHistory.findMany({
			where: {
				jobNumber: followUp.jobNumber,
				goal: "cds-ai-document",
			},
			orderBy: { createdAt: "asc" },
			select: {
				id: true,
				sessionId: true,
				createdAt: true,
				status: true,
				userCustomPrompt: true,
				response: true,
				errorMessage: true,
				fileIds: true,
				fileNames: true,
				requestBody: true,
				promptTokens: true,
				candidatesTokens: true,
				totalTokens: true,
				durationMs: true,
			},
		});

		const sessionMap = new Map<string, HistorySession>();

		for (const entry of entries) {
			const requestBody = getRequestBodyObject(entry.requestBody);
			const loggedFollowUpId =
				typeof requestBody.followUpId === "string"
					? requestBody.followUpId.trim()
					: "";

			if (loggedFollowUpId && loggedFollowUpId !== id) {
				continue;
			}

			const sid = entry.sessionId || "default";
			const state = sessionMap.get(sid) ?? {
				id: sid,
				firstAt: entry.createdAt,
				lastAt: entry.createdAt,
				messages: [],
				latestResult: null,
				activeResultMessageId: null,
				fileNames: [],
				fileIds: [],
			};

			state.lastAt = entry.createdAt;

			const isDraftRevision = requestBody.isDraftRevision === true;
			const userText =
				entry.userCustomPrompt || getFallbackUserPrompt(isDraftRevision);

			state.messages.push({
				id: `${entry.id}-user`,
				role: "user",
				text: userText,
			});

			let assistantText =
				entry.errorMessage || "AI chưa trả về nội dung cho yêu cầu này.";
			let tone: "default" | "error" =
				entry.errorMessage || entry.status !== 200 ? "error" : "default";

			if (entry.response) {
				try {
					const parsed = JSON.parse(entry.response);
					const result = sanitizeCdsAiDocumentResult(
						parsed,
						followUp.operationType as FollowUpOperationType | null,
					);
					state.latestResult = result;
					state.activeResultMessageId = `${entry.id}-assistant`;
					assistantText = result.assistantMessage || assistantText;
					tone = "default";
				} catch {
					assistantText = entry.response;
				}
			}

			state.messages.push({
				id: `${entry.id}-assistant`,
				role: "assistant",
				text: assistantText,
				tone,
				usage: {
					promptTokens: entry.promptTokens,
					candidatesTokens: entry.candidatesTokens,
					totalTokens: entry.totalTokens,
					durationMs: entry.durationMs,
				},
				result:
					state.activeResultMessageId === `${entry.id}-assistant`
						? state.latestResult
						: null,
			});

			if (entry.fileNames.length > 0) {
				state.fileNames = entry.fileNames;
				state.fileIds = entry.fileIds;
			}

			sessionMap.set(sid, state);
		}

		const orderedSessions = Array.from(sessionMap.values()).sort(
			(left, right) => right.lastAt.getTime() - left.lastAt.getTime(),
		);

		const sessions = orderedSessions.map((entry) => ({
			id: entry.id,
			date: entry.lastAt.toISOString(),
			label: buildSessionLabel(entry.lastAt),
			fileNames: entry.fileNames,
		}));

		const resolvedSessionId =
			requestedSessionId && sessionMap.has(requestedSessionId)
				? requestedSessionId
				: (orderedSessions[0]?.id ?? null);
		const targetSession = resolvedSessionId
			? (sessionMap.get(resolvedSessionId) ?? null)
			: null;

		return NextResponse.json({
			sessions,
			history: targetSession?.messages ?? [],
			latestResult: targetSession?.latestResult ?? null,
			currentSessionId: resolvedSessionId,
			fileNames: targetSession?.fileNames ?? [],
			fileIds: targetSession?.fileIds ?? [],
			activeResultMessageId: targetSession?.activeResultMessageId ?? null,
		});
	} catch (error) {
		console.error("Error fetching CDS AI history:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Unable to fetch CDS AI history",
			},
			{ status: 500 },
		);
	}
}
