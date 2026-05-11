"use client";

import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import {
	Popover,
	PopoverContent,
	PopoverPositioner,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	type CdsAiFieldReview,
	formatCdsAiReviewValue,
	normalizeCdsAiComparableValue,
	shouldShowCdsAiFieldInfo,
	shouldShowCdsAiFieldReview,
} from "@/lib/followup/cds-ai-review";
import type { FollowUpOperationType } from "@/lib/followup/operation-type";
import { cn } from "@/lib/utils";
import type { FollowUpCdsInfoRow } from "../../../../types";
import { getCdsAiFieldLabel } from "./cds-ai-constants";

export function CdsAiConflictPicker({
	children,
	fieldKey,
	operationType,
	review,
	isReviewed = false,
	onSelect,
}: {
	children: ReactNode;
	fieldKey: keyof FollowUpCdsInfoRow;
	operationType: FollowUpOperationType | null;
	review?: CdsAiFieldReview | null;
	isReviewed?: boolean;
	onSelect: (fieldKey: keyof FollowUpCdsInfoRow, value: unknown) => void;
}) {
	const [open, setOpen] = useState(false);

	const hasWarning = shouldShowCdsAiFieldReview(review);
	const hasInfo = shouldShowCdsAiFieldInfo(review);

	if (!hasWarning && !hasInfo) {
		return <>{children}</>;
	}

	const activeReview = review as CdsAiFieldReview;
	const showReviewed = hasWarning && isReviewed;
	const fieldLabel = getCdsAiFieldLabel(fieldKey, operationType);
	const currentComparable = normalizeCdsAiComparableValue(
		activeReview.currentValue,
	);

	return (
		<div className="flex w-full min-w-0 items-center gap-1">
			<div className="min-w-0 flex-1">{children}</div>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger
					type="button"
					aria-label={
						showReviewed
							? `Đã rà soát dữ liệu AI cho ${fieldLabel}`
							: hasWarning
								? `Cảnh báo dữ liệu AI cho ${fieldLabel}`
								: `AI đã điền dữ liệu cho ${fieldLabel}`
					}
					title={
						showReviewed
							? "Đã rà soát dữ liệu AI, bấm để chọn lại"
							: hasWarning
								? "Dữ liệu AI khác CDS hoặc khác giữa chứng từ"
								: "AI đã điền ô trống từ chứng từ"
					}
					data-testid={`cds-ai-conflict-trigger-${String(fieldKey)}`}
					className={cn(
						"inline-flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-none border shadow-[inset_1px_1px_0_rgba(255,255,255,0.65)]",
						showReviewed
							? "border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
							: hasWarning
								? "border-amber-400 bg-amber-100 text-amber-700 hover:bg-amber-200"
								: "border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100",
					)}
				>
					{showReviewed ? (
						<CheckCircle2 className="size-3.5" />
					) : hasWarning ? (
						<AlertTriangle className="size-3.5" />
					) : (
						<Sparkles className="size-3.5" />
					)}
				</PopoverTrigger>
				<PopoverPositioner side="bottom" sideOffset={4}>
					<PopoverContent
						className={cn(
							"w-[360px] rounded-none border-[#a8a8a8] p-0 text-[11px] text-[#2f2f2f]",
							showReviewed
								? "bg-[#f4fff8]"
								: hasWarning
									? "bg-[#fffdf2]"
									: "bg-[#f5fbff]",
						)}
					>
						<div
							className={cn(
								"border-b px-2 py-1 font-semibold",
								showReviewed
									? "border-emerald-200 bg-emerald-50 text-emerald-800"
									: hasWarning
										? "border-[#d7c779] bg-amber-100 text-amber-900"
										: "border-sky-200 bg-sky-50 text-sky-800",
							)}
						>
							<div className="flex items-center justify-between gap-2">
								<span>{fieldLabel}</span>
								{showReviewed ? (
									<span className="inline-flex items-center gap-1 text-[9px] font-semibold">
										<CheckCircle2 className="size-3" />
										Đã rà soát
									</span>
								) : hasInfo ? (
									<span className="inline-flex items-center gap-1 text-[9px] font-semibold">
										<Sparkles className="size-3" />
										AI đã điền
									</span>
								) : null}
							</div>
						</div>
						<div className="space-y-2 p-2">
							<div className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-2 gap-y-1">
								<span className="text-slate-600">CDS cũ</span>
								<span className="min-w-0 break-words font-medium">
									{formatCdsAiReviewValue(activeReview.oldValue)}
								</span>
								<span className="text-slate-600">Đang chọn</span>
								<span className="min-w-0 break-words font-medium text-[#14314b]">
									{formatCdsAiReviewValue(activeReview.currentValue)}
								</span>
								<span className="text-slate-600">AI đề xuất</span>
								<span className="min-w-0 break-words font-medium text-[#8a5a00]">
									{formatCdsAiReviewValue(activeReview.aiValue)}
								</span>
							</div>

							<div className="flex flex-wrap gap-1">
								{activeReview.hasOldMismatch ? (
									<span className="border border-amber-300 bg-white px-1.5 py-0.5 text-amber-800">
										Khác dữ liệu CDS cũ
									</span>
								) : null}
								{activeReview.hasSourceConflict ? (
									<span className="border border-amber-300 bg-white px-1.5 py-0.5 text-amber-800">
										Chứng từ không khớp nhau
									</span>
								) : null}
								{hasInfo ? (
									<span className="border border-sky-200 bg-white px-1.5 py-0.5 text-sky-700">
										AI đã điền ô trống
									</span>
								) : null}
							</div>

							<div className="max-h-56 space-y-1 overflow-y-auto pr-1">
								{activeReview.choices.map((choice) => {
									const isCurrent =
										normalizeCdsAiComparableValue(choice.value) ===
										currentComparable;

									return (
										<button
											key={choice.id}
											type="button"
											onClick={() => {
												onSelect(fieldKey, choice.value);
												setOpen(false);
											}}
											className={cn(
												"grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 border px-2 py-1 text-left",
												isCurrent
													? "border-[#315d8f] bg-[#eef6ff]"
													: hasWarning
														? "border-[#d7c779] bg-white hover:bg-amber-50"
														: "border-sky-200 bg-white hover:bg-sky-50",
											)}
										>
											<span className="min-w-0">
												<span className="block truncate font-semibold text-[#14314b]">
													{choice.label}
												</span>
												{choice.detail ? (
													<span className="block truncate text-[9px] text-slate-500">
														{choice.detail}
													</span>
												) : null}
												<span className="block break-words text-[10px] text-slate-800">
													{formatCdsAiReviewValue(choice.value)}
												</span>
											</span>
											<span
												className={cn(
													"self-center border px-1.5 py-0.5 text-[9px] font-semibold",
													isCurrent
														? "border-[#315d8f] bg-[#315d8f] text-white"
														: "border-[#b8b8b8] bg-[#f3f3f3] text-slate-600",
												)}
											>
												{isCurrent ? "Đang dùng" : "Chọn"}
											</span>
										</button>
									);
								})}
							</div>
						</div>
					</PopoverContent>
				</PopoverPositioner>
			</Popover>
		</div>
	);
}
