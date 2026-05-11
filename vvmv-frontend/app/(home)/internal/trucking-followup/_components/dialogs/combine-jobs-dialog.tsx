"use client";

import { AlertTriangle, Crown, Merge } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { TruckingFollowUpRow } from "../../types";

interface CombineJobsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** All selected rows — user picks which one to keep inside this dialog */
	allRows: TruckingFollowUpRow[];
	isLoading: boolean;
	onConfirm: (keeperJobId: string, deleteJobIds: string[]) => void;
}

export function CombineJobsDialog({
	open,
	onOpenChange,
	allRows,
	isLoading,
	onConfirm,
}: CombineJobsDialogProps) {
	const [keeperId, setKeeperId] = useState<string>(allRows[0]?.id ?? "");

	// Reset to first row whenever dialog opens with new rows
	useEffect(() => {
		if (open && allRows.length > 0) {
			setKeeperId(allRows[0].id);
		}
	}, [open, allRows]);

	const keeperRow = allRows.find((r) => r.id === keeperId);
	const deleteRows = allRows.filter((r) => r.id !== keeperId);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Merge className="w-5 h-5 text-blue-600" />
						Gộp Job
					</DialogTitle>
					<DialogDescription>
						Chọn job muốn giữ lại. {allRows.length - 1} job còn lại sẽ bị xóa và
						FCR sẽ được chuyển sang job giữ lại.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-2 py-2">
					<p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
						Chọn job giữ lại
					</p>

					<div className="space-y-1.5">
						{allRows.map((row) => {
							const isKeeper = row.id === keeperId;
							return (
								<button
									key={row.id}
									type="button"
									onClick={() => setKeeperId(row.id)}
									className={cn(
										"w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-all",
										isKeeper
											? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200"
											: "bg-red-50 border-red-200 hover:border-slate-300 hover:bg-slate-50",
									)}
								>
									{isKeeper ? (
										<Crown className="w-4 h-4 text-emerald-600 shrink-0" />
									) : (
										<AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
									)}
									<span
										className={cn(
											"text-sm font-bold",
											isKeeper ? "text-emerald-800" : "text-red-700",
										)}
									>
										{row.jobNumber || row.id}
									</span>
									{row.companyName && (
										<span
											className={cn(
												"text-xs truncate",
												isKeeper ? "text-emerald-600" : "text-red-500",
											)}
										>
											— {row.companyName}
										</span>
									)}
									<div className="ml-auto flex items-center gap-1.5 shrink-0">
										{(row.fcrs?.length ?? 0) > 0 && (
											<span
												className={cn(
													"text-[10px] font-bold px-1.5 py-0.5 rounded",
													isKeeper
														? "bg-emerald-100 text-emerald-700"
														: "bg-red-100 text-red-600",
												)}
											>
												{row.fcrs?.length} FCR
											</span>
										)}
										{isKeeper && (
											<span className="text-[10px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded">
												GIỮ LẠI
											</span>
										)}
									</div>
								</button>
							);
						})}
					</div>

					{keeperRow && deleteRows.length > 0 && (
						<div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
							<strong>Lưu ý:</strong> Dữ liệu ERP (TransactionDetails) của{" "}
							<strong>{deleteRows.map((r) => r.jobNumber).join(", ")}</strong>{" "}
							sẽ được chuyển vào <strong>{keeperRow.jobNumber}</strong> và đánh
							số lại lotno tự động.
						</div>
					)}
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isLoading}
					>
						Hủy
					</Button>
					<Button
						onClick={() =>
							onConfirm(
								keeperId,
								deleteRows.map((r) => r.id),
							)
						}
						disabled={isLoading || !keeperRow}
						className={cn(
							"bg-blue-600 hover:bg-blue-700 text-white gap-2",
							isLoading && "opacity-70",
						)}
					>
						<Merge className="w-4 h-4" />
						{isLoading ? "Đang gộp..." : "Xác nhận gộp"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
