"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { FollowUpOperationType } from "@/lib/followup/operation-type";
import type { FollowUpCdsInfoRow } from "../../../../types";
import {
	collectApplicableCdsInfoEntries,
	getFilledFieldCount,
} from "./cds-ai-utils";
import type { CdsAiPersistGate } from "./use-cds-ai-session";

function formatRejectedLists(result: {
	sanitizationNotes: {
		rejectedCdsInfoKeys: string[];
		rejectedTopLevelKeys: string[];
	};
}) {
	const cds = result.sanitizationNotes.rejectedCdsInfoKeys;
	const root = result.sanitizationNotes.rejectedTopLevelKeys;
	return { cds, root };
}

export function CdsAiApplyPreviewDialog({
	gate,
	currentData,
	operationType,
	currentCargoRowCount,
	onConfirm,
	onCancel,
	isWorking,
}: {
	gate: CdsAiPersistGate | null;
	currentData: Partial<FollowUpCdsInfoRow>;
	operationType: FollowUpOperationType | null;
	currentCargoRowCount: number;
	onConfirm: () => void;
	onCancel: () => void;
	isWorking: boolean;
}) {
	const [showRejected, setShowRejected] = useState(false);

	// Reset rejected-details panel whenever a new confirmation gate opens.
	useEffect(() => {
		setShowRejected(false);
	}, [gate]);

	const preview = useMemo(() => {
		if (!gate) {
			return null;
		}

		if (gate.kind === "analyze") {
			const entries = collectApplicableCdsInfoEntries(
				gate.result,
				currentData,
				operationType,
				gate.cdsOptions,
			);
			const { cds, root } = formatRejectedLists(gate.result);

			const cargoSummary =
				gate.shouldApplyCargoChanges && gate.cargoOutcomeShouldApply
					? gate.cargoOutcomeRows === 0
						? "Cập nhật danh sách hàng (có thể xóa/ghi rỗng tùy prompt)"
						: `Lưu khoảng ${gate.cargoOutcomeRows} dòng hàng sau ghép với hiện có`
					: "Không ghi danh sách hàng từ lượt này";

			return {
				title: "Xác nhận lưu CDS từ AI",
				subtitle:
					"Kiểm tra tóm tắt trước khi ghi dữ liệu lên máy chủ (form chỉ cập nhật sau khi bạn đồng ý).",
				cdsApplyCount: entries.length,
				cdsKeys: entries.map(([key]) => String(key)),
				aiFilledFields: getFilledFieldCount(gate.result),
				aiCargoLines: gate.result.cargoList.length,
				currentCargoRowCount,
				cargoSummary,
				rejectedCds: cds,
				rejectedRoot: root,
			};
		}

		const entries = collectApplicableCdsInfoEntries(
			gate.result,
			currentData,
			operationType,
			gate.overwriteAllFromAi ? { overwrite: true } : undefined,
		);
		const { cds, root } = formatRejectedLists(gate.result);

		const cargoSummary = gate.cargoWillPersist
			? `Ghi ${gate.cargoRowsCount} dòng hàng từ AI lên máy chủ`
			: gate.result.cargoList.length > 0
				? "Giữ nguyên danh sách hàng hiện có trên máy chủ"
				: "Không có dòng hàng trong kết quả AI";

		return {
			title: "Xác nhận áp dụng CDS AI",
			subtitle:
				"So khớp nhanh trước khi Nạp — có thể Hủy và chỉnh sửa nháp trong khung chat.",
			cdsApplyCount: entries.length,
			cdsKeys: entries.map(([key]) => String(key)),
			aiFilledFields: getFilledFieldCount(gate.result),
			aiCargoLines: gate.result.cargoList.length,
			currentCargoRowCount,
			cargoSummary,
			rejectedCds: cds,
			rejectedRoot: root,
		};
	}, [currentCargoRowCount, currentData, gate, operationType]);

	const rejectedTotal =
		(preview?.rejectedCds.length ?? 0) + (preview?.rejectedRoot.length ?? 0);

	return (
		<Dialog
			open={gate != null}
			onOpenChange={(open) => {
				if (!open) {
					setShowRejected(false);
					onCancel();
				}
			}}
		>
			<DialogContent className="max-h-[90vh] gap-3 rounded-none border-[#a8a8a8] bg-[#f7f7f7] p-3 text-[11px] text-[#1f2937] sm:max-w-lg">
				<DialogHeader className="gap-1 text-left">
					<DialogTitle className="text-[13px] font-bold text-[#14314b]">
						{preview?.title ?? "Xác nhận"}
					</DialogTitle>
					<DialogDescription className="text-[10.5px] text-slate-600">
						{preview?.subtitle}
					</DialogDescription>
				</DialogHeader>

				{preview ? (
					<div className="space-y-2 border border-[#c5c5c5] bg-white p-2">
						<div className="grid grid-cols-2 gap-2 text-[10px]">
							<div className="border border-[#dedede] bg-[#fafafa] px-2 py-1">
								<div className="font-semibold text-[#14314b]">Trường CDS</div>
								<div className="mt-0.5 text-slate-700">
									AI có {preview.aiFilledFields} trường có dữ liệu →{" "}
									<span className="font-semibold text-[#14314b]">
										{preview.cdsApplyCount} trường sẽ lưu máy chủ
									</span>
								</div>
							</div>
							<div className="border border-[#dedede] bg-[#fafafa] px-2 py-1">
								<div className="font-semibold text-[#14314b]">Hàng</div>
								<div className="mt-0.5 text-slate-700">
									Hiện {preview.currentCargoRowCount} dòng · AI{" "}
									{preview.aiCargoLines} dòng
								</div>
								<div className="mt-0.5 font-medium text-[#14314b]">
									{preview.cargoSummary}
								</div>
							</div>
						</div>

						<div>
							<div className="font-semibold text-[#14314b]">
								Trường CDS dự kiến ghi ({preview.cdsKeys.length})
							</div>
							<div className="mt-1 max-h-[120px] overflow-y-auto border border-[#e5e5e5] bg-[#fcfcfc] px-2 py-1 font-mono text-[9.5px] leading-snug text-slate-800">
								{preview.cdsKeys.length > 0 ? (
									preview.cdsKeys.join(", ")
								) : (
									<span className="text-slate-500">(không có)</span>
								)}
							</div>
						</div>

						{rejectedTotal > 0 ? (
							<div className="border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] text-amber-950">
								<button
									type="button"
									className="flex w-full items-center justify-between gap-2 text-left font-semibold"
									onClick={() => setShowRejected((current) => !current)}
								>
									<span>
										Các trường / khóa không được nhận ({rejectedTotal})
									</span>
									<span className="shrink-0 text-[9px] font-normal">
										{showRejected ? "Thu gọn" : "Mở rộng"}
									</span>
								</button>
								{showRejected ? (
									<div className="mt-1 space-y-1 border-t border-amber-200 pt-1">
										{preview.rejectedCds.length > 0 ? (
											<div>
												<div className="text-[9px] font-semibold uppercase text-amber-900">
													Trong cdsInfo
												</div>
												<div className="font-mono text-[9.5px]">
													{preview.rejectedCds.join(", ")}
												</div>
											</div>
										) : null}
										{preview.rejectedRoot.length > 0 ? (
											<div>
												<div className="text-[9px] font-semibold uppercase text-amber-900">
													Cấp cao JSON
												</div>
												<div className="font-mono text-[9.5px]">
													{preview.rejectedRoot.join(", ")}
												</div>
											</div>
										) : null}
									</div>
								) : null}
							</div>
						) : null}
					</div>
				) : null}

				<DialogFooter className="gap-2 sm:justify-end">
					<Button
						type="button"
						variant="outline"
						disabled={isWorking}
						className="h-8 rounded-none border-[#9f9f9f] bg-[#ececec] text-[11px]"
						onClick={() => {
							setShowRejected(false);
							onCancel();
						}}
					>
						Hủy
					</Button>
					<Button
						type="button"
						disabled={isWorking || !gate}
						className="h-8 rounded-none bg-[#14314b] text-[11px] text-white hover:bg-[#0f2638]"
						onClick={onConfirm}
					>
						{isWorking ? "Đang lưu…" : "Đồng ý và lưu"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
