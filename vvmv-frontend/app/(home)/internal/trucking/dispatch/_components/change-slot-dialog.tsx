"use client";

import { Building2, Search, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SlotTarget = {
	id: string;
	label: string;
	type: "truck" | "vendor";
};

interface ChangeSlotDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	targets: SlotTarget[];
	loading?: boolean;
	onConfirm: (targetId: string) => Promise<void> | void;
}

export function ChangeSlotDialog({
	open,
	onOpenChange,
	targets,
	loading = false,
	onConfirm,
}: ChangeSlotDialogProps) {
	const [search, setSearch] = useState("");
	const [tab, setTab] = useState<"all" | "truck" | "vendor">("all");
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const filteredTargets = useMemo(() => {
		const q = search.trim().toLowerCase();
		return targets.filter((t) => {
			if (tab !== "all" && t.type !== tab) return false;
			if (!q) return true;
			return t.label.toLowerCase().includes(q);
		});
	}, [search, tab, targets]);

	async function handleConfirm() {
		if (!selectedId || loading) return;
		await onConfirm(selectedId);
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) {
					setSearch("");
					setTab("all");
					setSelectedId(null);
				}
				onOpenChange(next);
			}}
		>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>Đổi xe / nhà thầu</DialogTitle>
				</DialogHeader>

				<div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
					<button
						type="button"
						onClick={() => setTab("all")}
						className={cn(
							"flex-1 py-1.5 rounded-md text-xs font-medium transition-all",
							tab === "all"
								? "bg-white shadow-sm text-slate-800"
								: "text-slate-500 hover:text-slate-700",
						)}
					>
						Tất cả
					</button>
					<button
						type="button"
						onClick={() => setTab("truck")}
						className={cn(
							"flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-all",
							tab === "truck"
								? "bg-white shadow-sm text-slate-800"
								: "text-slate-500 hover:text-slate-700",
						)}
					>
						<Truck className="w-3.5 h-3.5" />
						Xe
					</button>
					<button
						type="button"
						onClick={() => setTab("vendor")}
						className={cn(
							"flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-all",
							tab === "vendor"
								? "bg-white shadow-sm text-slate-800"
								: "text-slate-500 hover:text-slate-700",
						)}
					>
						<Building2 className="w-3.5 h-3.5" />
						Vendor
					</button>
				</div>

				<div className="relative">
					<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
					<Input
						className="pl-8 h-8 text-sm"
						placeholder={
							tab === "truck"
								? "Tìm xe..."
								: tab === "vendor"
									? "Tìm vendor..."
									: "Tìm xe hoặc vendor..."
						}
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</div>

				<div className="space-y-1 max-h-64 overflow-y-auto">
					{filteredTargets.map((target) => (
						<button
							key={target.id}
							type="button"
							onClick={() => setSelectedId(target.id)}
							className={cn(
								"w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all",
								selectedId === target.id
									? "bg-blue-50 border-blue-300 ring-2 ring-blue-200"
									: "hover:bg-slate-50 border-transparent",
							)}
						>
							{target.type === "vendor" ? (
								<Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
							) : (
								<Truck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
							)}
							<span className="text-sm font-medium text-slate-800 truncate">
								{target.label}
							</span>
						</button>
					))}
					{filteredTargets.length === 0 && (
						<p className="text-xs text-slate-400 text-center py-4">
							Không có xe / nhà thầu khả dụng
						</p>
					)}
				</div>

				<div className="flex justify-end gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => onOpenChange(false)}
						disabled={loading}
					>
						Hủy
					</Button>
					<Button
						size="sm"
						onClick={handleConfirm}
						disabled={!selectedId || loading}
					>
						{loading ? "Đang xử lý..." : "Xác nhận"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
