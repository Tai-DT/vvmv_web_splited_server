"use client";

import { AlertTriangle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { CdsAiDocumentExtractionResult } from "@/lib/followup/cds-ai-document";
import { cn } from "@/lib/utils";
import { QUICK_CHAT_PROMPTS } from "./cds-ai-constants";
import type { CdsAiChatProps, CdsAiUsageMetrics } from "./cds-ai-types";
import { getDocumentWarningCount, getFilledFieldCount } from "./cds-ai-utils";

function formatUsageNumber(value: number | null) {
	return typeof value === "number" ? value.toLocaleString("vi-VN") : null;
}

function formatDuration(value: number | null) {
	if (typeof value !== "number") {
		return null;
	}

	if (value >= 1000) {
		return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}s`;
	}

	return `${value}ms`;
}

function getUsageParts(usage?: CdsAiUsageMetrics | null) {
	if (!usage) {
		return [];
	}

	return [
		["Prompt", formatUsageNumber(usage.promptTokens)],
		["Trả lời", formatUsageNumber(usage.candidatesTokens)],
		["Tổng", formatUsageNumber(usage.totalTokens)],
		["Thời gian", formatDuration(usage.durationMs)],
	].flatMap(([label, value]) => (value ? [`${label}: ${value}`] : []));
}

function getResultWarningCount(result: CdsAiDocumentExtractionResult | null) {
	if (!result) {
		return 0;
	}

	return result.warnings.length + getDocumentWarningCount(result);
}

function getResultSummary(result: CdsAiDocumentExtractionResult | null) {
	if (!result) {
		return null;
	}

	return {
		fieldCount: getFilledFieldCount(result),
		warningCount: getResultWarningCount(result),
		documentCount: result.documents.length,
	};
}

/**
 * AI chat transcript — ECUS-consistent styling.
 */
export function CdsAiChat({
	messages,
	latestResult,
	activeResultMessageId,
	isAnalyzing,
	isLoadingHistory,
	sessionId,
	sessionFileNames,
	activeSessionLabel,
	transcriptEndRef,
	onSetPrompt,
}: CdsAiChatProps) {
	const latestSummary = getResultSummary(latestResult);

	return (
		<section className="flex min-h-0 flex-1 flex-col overflow-hidden">
			{/* ── ECUS-style Section Header ── */}
			<div className="shrink-0 border-b border-[#999] bg-[#f7f7f7] px-2 py-0.5">
				<div className="flex items-center justify-between gap-1.5">
					<div className="flex items-center gap-1.5">
						<Sparkles className="size-3 text-[#4466cc]" />
						<span className="text-[11px] font-bold italic text-black">
							Trò chuyện với AI
						</span>
					</div>
					{(sessionId || sessionFileNames.length > 0) && (
						<span className="max-w-[140px] truncate text-[10px] text-slate-500">
							{activeSessionLabel ?? sessionId ?? sessionFileNames.join(", ")}
						</span>
					)}
				</div>
			</div>

			{/* ── Chat Body ── */}
			<div className="cds-ai-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-white px-2 py-2">
				{/* Loading history state */}
				{isLoadingHistory ? (
					<StatusCard tone="neutral">
						<Loader2 className="size-3 animate-spin" />
						Đang tải lịch sử...
					</StatusCard>
				) : null}

				{/* Latest result summary */}
				{!isAnalyzing && latestSummary ? (
					<div className="cds-ai-message-in mb-2 border border-emerald-300 bg-emerald-50 px-2 py-1.5">
						<div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800">
							<CheckCircle2 className="size-3 shrink-0" />
							AI tìm thấy {latestSummary.fieldCount} field
						</div>
						<div className="mt-1 flex flex-wrap gap-1">
							<ResultBadge tone="emerald">
								{latestSummary.documentCount} chứng từ
							</ResultBadge>
							{latestSummary.warningCount > 0 ? (
								<ResultBadge tone="amber">
									<AlertTriangle className="size-2.5" />
									{latestSummary.warningCount} cảnh báo
								</ResultBadge>
							) : (
								<ResultBadge tone="emerald">Không cảnh báo</ResultBadge>
							)}
						</div>
					</div>
				) : null}

				{!isAnalyzing && messages.length === 0 ? (
					/* Empty state — ECUS-consistent */
					<div className="cds-ai-fade-in flex flex-col items-center justify-center gap-2 px-3 py-6 text-center">
						<Sparkles className="size-8 text-[#4466cc]" />
						<div>
							<div className="text-[12px] font-bold text-black">
								CDS AI sẵn sàng
							</div>
							<div className="mt-0.5 text-[10.5px] text-slate-500">
								Hãy tải chứng từ lên hoặc chọn gợi ý bên dưới
							</div>
						</div>
						<div className="flex max-w-full flex-wrap justify-center gap-1 pt-0.5">
							{QUICK_CHAT_PROMPTS.slice(0, 2).map((quickPrompt) => (
								<button
									key={quickPrompt}
									type="button"
									onClick={() => onSetPrompt(quickPrompt)}
									className="border border-[#b9b9b9] bg-[#f7f7f7] px-2 py-0.5 text-[10px] text-black hover:bg-[#ececec]"
								>
									{quickPrompt}
								</button>
							))}
						</div>
					</div>
				) : null}

				{/* ── Messages ── */}
				{messages.length > 0 ? (
					<div className="space-y-2">
						{messages.map((message) => {
							const isUser = message.role === "user";
							const messageResult =
								message.role === "assistant"
									? message.id === activeResultMessageId
										? (latestResult ?? message.result ?? null)
										: (message.result ?? null)
									: null;
							const messageSummary = getResultSummary(messageResult);
							const usageParts = getUsageParts(message.usage);

							return (
								<div
									key={message.id}
									className={cn(
										"cds-ai-message-in flex min-w-0 gap-1.5",
										isUser ? "flex-row-reverse" : "flex-row",
									)}
								>
									{/* Avatar */}
									<MessageAvatar
										role={
											isUser
												? "user"
												: message.tone === "error"
													? "error"
													: "ai"
										}
									/>

									{/* Bubble */}
									<div
										className={cn(
											"min-w-0 max-w-[85%] border px-2 py-1.5 text-[11px] leading-relaxed",
											isUser
												? "border-[#4466cc] bg-[#e8edf8] text-black"
												: message.tone === "error"
													? "border-red-300 bg-red-50 text-red-800"
													: "border-[#b9b9b9] bg-white text-black",
										)}
									>
										<div
											className={cn(
												"mb-0.5 text-[9px] font-bold",
												isUser
													? "text-[#4466cc]"
													: message.tone === "error"
														? "text-red-600"
														: "text-slate-400",
											)}
										>
											{isUser ? "Bạn" : "CDS AI"}
										</div>
										<div className="whitespace-pre-wrap break-words">
											{message.text}
										</div>

										{/* Field result summary */}
										{messageSummary ? (
											<div className="mt-1 flex flex-wrap gap-1">
												<ResultBadge tone="slate">
													{messageSummary.fieldCount} field
												</ResultBadge>
												{messageSummary.warningCount > 0 ? (
													<ResultBadge tone="amber">
														{messageSummary.warningCount} cảnh báo
													</ResultBadge>
												) : null}
											</div>
										) : null}

										{/* Usage metrics */}
										{!isUser && usageParts.length > 0 ? (
											<div className="mt-1 flex flex-wrap gap-0.5">
												{usageParts.map((part) => (
													<span
														key={part}
														className="bg-[#f0f0f0] px-1 py-px text-[8px] text-slate-500"
													>
														{part}
													</span>
												))}
											</div>
										) : null}
									</div>
								</div>
							);
						})}
					</div>
				) : null}

				{isAnalyzing ? (
					<StatusCard tone="blue">
						<div className="flex items-center gap-1.5">
							<Loader2 className="size-3 animate-spin" />
							<span>AI đang phân tích chứng từ...</span>
						</div>
						<TypingIndicator />
					</StatusCard>
				) : null}

				<div ref={transcriptEndRef} />
			</div>
		</section>
	);
}

/* ── Sub-components ── */

function StatusCard({
	children,
	tone,
}: {
	children: ReactNode;
	tone: "neutral" | "blue";
}) {
	return (
		<div
			className={cn(
				"cds-ai-message-in mb-2 flex flex-col gap-1.5 border p-2 text-[11px] font-medium",
				tone === "blue"
					? "border-sky-300 bg-sky-50 text-sky-800"
					: "border-[#b9b9b9] bg-[#f7f7f7] text-slate-600",
			)}
		>
			{children}
		</div>
	);
}

function TypingIndicator() {
	return (
		<div className="flex items-center gap-1 pl-5">
			{[0, 1, 2].map((i) => (
				<span
					key={i}
					className="cds-ai-typing-dot inline-block size-1 rounded-full bg-[#4466cc]"
					style={{ animationDelay: `${i * 0.15}s` }}
				/>
			))}
		</div>
	);
}

function MessageAvatar({ role }: { role: "ai" | "user" | "error" }) {
	return (
		<span
			className={cn(
				"mt-0.5 inline-flex size-5 shrink-0 items-center justify-center text-[8px] font-bold",
				role === "user"
					? "border border-[#4466cc] bg-[#e8edf8] text-[#4466cc]"
					: role === "error"
						? "border border-red-300 bg-red-50 text-red-600"
						: "bg-[#4466cc] text-white",
			)}
		>
			{role === "user" ? "B" : "AI"}
		</span>
	);
}

function ResultBadge({
	children,
	tone,
}: {
	children: ReactNode;
	tone: "emerald" | "amber" | "slate";
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-0.5 px-1.5 py-px text-[9px] font-medium",
				tone === "emerald" &&
					"border border-emerald-200 bg-emerald-50 text-emerald-700",
				tone === "amber" &&
					"border border-amber-200 bg-amber-50 text-amber-700",
				tone === "slate" && "border border-[#ccc] bg-[#f7f7f7] text-slate-600",
			)}
		>
			{children}
		</span>
	);
}
