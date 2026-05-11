"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { CdsAiMetricCard } from "./cds-ai-metric-card";
import type { CdsAiResultPreviewProps } from "./cds-ai-types";
import { getDocumentWarningCount, getFilledFieldCount } from "./cds-ai-utils";

export function CdsAiResultPreview({
	result,
	isActive,
	onActivate,
}: CdsAiResultPreviewProps) {
	const [showRejected, setShowRejected] = useState(false);
	const checklistFoundCount = result.checklist.filter(
		(item) => item.status === "found",
	).length;
	const warningCount = result.warnings.length + getDocumentWarningCount(result);
	const rejectedCds = result.sanitizationNotes.rejectedCdsInfoKeys;
	const rejectedRoot = result.sanitizationNotes.rejectedTopLevelKeys;
	const rejectedTotal = rejectedCds.length + rejectedRoot.length;

	return (
		<div className="mt-1.5 min-w-0 w-full overflow-hidden border border-[#a8a8a8] bg-[#efefef] p-1.5 text-[10px] text-[#2f2f2f]">
			<div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5 border-b border-[#a8a8a8] pb-1.5 font-bold text-[#14314b]">
				<div className="flex flex-wrap items-center gap-1.5">
					<span>Kết quả bóc tách</span>
					{isActive ? (
						<span className="bg-[#f7c866] px-1 text-[9px] font-bold text-[#1b3248]">
							Bản nháp hiện tại
						</span>
					) : null}
				</div>

				{!isActive && onActivate ? (
					<button
						type="button"
						onClick={onActivate}
						className="inline-flex h-[20px] items-center gap-1 rounded border border-[#7f7f7f] bg-white px-1.5 text-[9px] font-semibold text-[#14314b] hover:bg-[#eef4fb]"
						title="Đưa kết quả này thành bản nháp đang áp vào CDS"
					>
						<CheckCircle2 className="size-3" />
						Dùng bản này
					</button>
				) : null}
			</div>

			<div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
				<CdsAiMetricCard
					tone="sky"
					label="Chứng từ"
					value={result.documents.length}
					description=""
				/>
				<CdsAiMetricCard
					tone="emerald"
					label="Trường CDS"
					value={getFilledFieldCount(result)}
					description=""
				/>
				<CdsAiMetricCard
					tone="slate"
					label="Dòng hàng"
					value={result.cargoList.length}
					description=""
				/>
				<CdsAiMetricCard
					tone={warningCount > 0 ? "amber" : "emerald"}
					label="Rà soát"
					value={`${checklistFoundCount}/${result.checklist.length}`}
					description=""
				/>
			</div>

			{rejectedTotal > 0 ? (
				<div className="mt-1.5 border border-amber-400 bg-amber-50 px-1.5 py-1 text-[9px] text-amber-950">
					<button
						type="button"
						className="flex w-full items-center justify-between gap-2 text-left font-semibold"
						onClick={() => setShowRejected((current) => !current)}
					>
						<span>Các trường không được nhận ({rejectedTotal})</span>
						<span className="shrink-0 font-normal">
							{showRejected ? "Thu gọn" : "Mở rộng"}
						</span>
					</button>
					{showRejected ? (
						<div className="mt-1 space-y-1 border-t border-amber-200 pt-1 font-normal">
							{rejectedCds.length > 0 ? (
								<div>
									<div className="text-[8px] font-semibold uppercase text-amber-900">
										Trong cdsInfo
									</div>
									<div className="font-mono text-[9px] leading-snug">
										{rejectedCds.join(", ")}
									</div>
								</div>
							) : null}
							{rejectedRoot.length > 0 ? (
								<div>
									<div className="text-[8px] font-semibold uppercase text-amber-900">
										Cấp cao JSON
									</div>
									<div className="font-mono text-[9px] leading-snug">
										{rejectedRoot.join(", ")}
									</div>
								</div>
							) : null}
						</div>
					) : null}
				</div>
			) : null}

			{result.documents.length > 0 && (
				<div className="mt-1.5 border-t border-[#a8a8a8] pt-1.5">
					<div className="font-semibold text-[#14314b]">
						Chứng từ ({result.documents.length})
					</div>
					<div className="mt-1 flex flex-wrap gap-1">
						{result.documents.map((document) => (
							<span
								key={document.fileName}
								className="border border-[#a8a8a8] bg-white px-1.5 py-0.5 text-[9px]"
							>
								{document.fileName}
							</span>
						))}
					</div>
				</div>
			)}

			{warningCount > 0 && (
				<div className="mt-1.5 border border-red-300 bg-red-50 px-1.5 py-1 text-[9px] text-red-800">
					⚠ Có {warningCount} cảnh báo cần kiểm tra lại.
				</div>
			)}
		</div>
	);
}
