"use client";

import { ChevronDown, ChevronUp, Send, SlidersHorizontal } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { QUICK_CHAT_PROMPTS } from "./cds-ai-constants";
import type { CdsAiComposerProps } from "./cds-ai-types";

/** Bottom composer — ECUS-consistent styling. */
export function CdsAiComposer({
	prompt,
	attachedSourceCount,
	fillMissingOnly,
	files,
	selectedDriveFileIds,
	sessionFileNames,
	latestResult,
	hasCurrentSnapshot,
	isAnalyzing,
	isUploadingToDrive,
	canAnalyze,
	geminiModelOptions,
	selectedGeminiModel,
	onSelectGeminiModel,
	onSetPrompt,
	onAnalyze,
}: CdsAiComposerProps) {
	const [showQuickPrompts, setShowQuickPrompts] = useState(false);
	const [showContext, setShowContext] = useState(false);

	const handlePromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (
			event.key !== "Enter" ||
			event.shiftKey ||
			event.nativeEvent.isComposing
		) {
			return;
		}

		if (!canAnalyze || isAnalyzing || isUploadingToDrive) {
			return;
		}

		event.preventDefault();
		onAnalyze();
	};

	const contextLabel =
		attachedSourceCount > 0
			? `${attachedSourceCount} nguồn`
			: latestResult
				? "Ngữ cảnh phiên"
				: hasCurrentSnapshot
					? "Dữ liệu hiện tại"
					: "Chưa gắn nguồn";

	return (
		<div className="shrink-0 border-t border-[#999] bg-[#f7f7f7] px-2 py-1.5">
			{/* ── Toolbar ── */}
			<div className="mb-1 flex items-center justify-between gap-1">
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={() => setShowQuickPrompts((current) => !current)}
						className="inline-flex h-[20px] items-center gap-0.5 border border-[#9f9f9f] bg-[#ececec] px-1.5 text-[9px] text-black hover:bg-[#e4e4e4]"
					>
						{showQuickPrompts ? (
							<ChevronUp className="size-2.5" />
						) : (
							<ChevronDown className="size-2.5" />
						)}
						Gợi ý
					</button>
					<button
						type="button"
						onClick={() => setShowContext((current) => !current)}
						className="inline-flex h-[20px] items-center gap-0.5 border border-[#9f9f9f] bg-[#ececec] px-1.5 text-[9px] text-black hover:bg-[#e4e4e4]"
					>
						<SlidersHorizontal className="size-2.5" />
						Ngữ cảnh
					</button>
					{geminiModelOptions.length > 1 ? (
						<label className="inline-flex max-w-[min(100%,11rem)] items-center gap-0.5 text-[9px] text-slate-700">
							<span className="sr-only sm:not-sr-only sm:inline">Model</span>
							<select
								value={selectedGeminiModel}
								onChange={(event) => onSelectGeminiModel(event.target.value)}
								disabled={isAnalyzing || isUploadingToDrive}
								title="Model Gemini cho lượt phân tích"
								aria-label="Chọn model Gemini"
								className="max-w-[10rem] truncate rounded-none border border-[#9f9f9f] bg-white px-1 py-px text-[9px] text-black"
							>
								{geminiModelOptions.map((id) => (
									<option key={id} value={id}>
										{id}
									</option>
								))}
							</select>
						</label>
					) : null}
				</div>
				<span className="text-[9px] text-slate-500">{contextLabel}</span>
			</div>

			{/* ── Quick Prompts ── */}
			{showQuickPrompts ? (
				<div className="cds-ai-fade-in mb-1.5 flex flex-wrap gap-1">
					{QUICK_CHAT_PROMPTS.map((quickPrompt) => (
						<button
							key={quickPrompt}
							type="button"
							onClick={() => onSetPrompt(quickPrompt)}
							className="border border-[#b9b9b9] bg-white px-2 py-0.5 text-[9px] text-black hover:bg-[#f0f0f0]"
						>
							{quickPrompt}
						</button>
					))}
				</div>
			) : null}

			{/* ── Context Chips ── */}
			{showContext ? (
				<div className="cds-ai-fade-in mb-1.5 flex flex-wrap gap-1">
					<ContextChip>{contextLabel}</ContextChip>
					<ContextChip>
						{fillMissingOnly ? "Chỉ ô trống" : "Ghi đè"}
					</ContextChip>
					{files.length > 0 ? (
						<ContextChip>{files.length} local</ContextChip>
					) : null}
					{selectedDriveFileIds.length > 0 ? (
						<ContextChip>{selectedDriveFileIds.length} Drive</ContextChip>
					) : null}
					{sessionFileNames.length > 0 ? (
						<ContextChip>{sessionFileNames.length} phiên</ContextChip>
					) : null}
				</div>
			) : null}

			{/* ── Input ── */}
			<div className="border border-[#999] bg-white">
				<Textarea
					value={prompt}
					onChange={(event) => onSetPrompt(event.target.value)}
					onKeyDown={handlePromptKeyDown}
					placeholder="Ví dụ: giữ nguyên kết quả nhưng đổi invoice thành INV-002, bỏ dòng hàng số 2..."
					className="max-h-[80px] min-h-[32px] resize-none rounded-none border-0 bg-white px-2 py-1 text-[11px] leading-relaxed text-black shadow-none placeholder:text-slate-400 focus-visible:ring-0"
				/>

				<div className="flex items-center justify-between gap-1 border-t border-[#ddd] px-2 py-0.5">
					<span className="text-[8px] text-slate-400">
						Enter gửi · Shift+Enter xuống dòng
					</span>
					<button
						type="button"
						onClick={onAnalyze}
						disabled={isAnalyzing || isUploadingToDrive || !canAnalyze}
						aria-label="Gửi cho AI"
						title={
							isUploadingToDrive
								? "Đang lưu Drive..."
								: isAnalyzing
									? "Đang gửi AI..."
									: "Gửi cho AI"
						}
						className="inline-flex h-[22px] items-center gap-1 bg-[#4466cc] px-2 text-[10px] font-bold text-white hover:bg-[#3355bb] disabled:bg-[#b9b9b9] disabled:text-[#777]"
					>
						<Send className="size-2.5" />
						<span>
							{isUploadingToDrive
								? "Lưu..."
								: isAnalyzing
									? "Gửi..."
									: "Gửi AI"}
						</span>
					</button>
				</div>
			</div>
		</div>
	);
}

function ContextChip({ children }: { children: ReactNode }) {
	return (
		<span className="border border-sky-300 bg-sky-50 px-1.5 py-px text-[8px] font-medium text-sky-700">
			{children}
		</span>
	);
}
