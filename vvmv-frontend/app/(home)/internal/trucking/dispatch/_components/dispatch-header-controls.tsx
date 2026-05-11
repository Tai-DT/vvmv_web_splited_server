"use client";

import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import {
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	Funnel,
	RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FCRFieldsPopover } from "./fcr-fields-popover";
import { useDispatchToolbarStore } from "./use-dispatch-toolbar-store";

function addDays(dateStr: string, n: number) {
	const d = new Date(`${dateStr}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
}

export function DispatchHeaderControls() {
	const queryClient = useQueryClient();
	const isFetching = useIsFetching({ queryKey: ["dispatch-board"] }) > 0;

	const viewMode = useDispatchToolbarStore((s) => s.viewMode);
	const focusDate = useDispatchToolbarStore((s) => s.focusDate);
	const showFilters = useDispatchToolbarStore((s) => s.showFilters);
	const setViewMode = useDispatchToolbarStore((s) => s.setViewMode);
	const setFocusDate = useDispatchToolbarStore((s) => s.setFocusDate);
	const setShowFilters = useDispatchToolbarStore((s) => s.setShowFilters);

	const to = viewMode === "week" ? addDays(focusDate, 6) : focusDate;
	const rangeLabel = viewMode === "day" ? focusDate : `${focusDate} → ${to}`;

	function shiftRange(dir: 1 | -1) {
		const step = viewMode === "week" ? 7 : 1;
		setFocusDate(addDays(focusDate, dir * step));
	}

	return (
		<div className="hidden md:flex items-center gap-2 ml-auto">
			<div className="flex items-center gap-1 rounded-md border border-slate-300 bg-white p-0.5">
				<button
					type="button"
					onClick={() => setViewMode("day")}
					className={
						viewMode === "day"
							? "px-2 py-1 text-[11px] font-semibold rounded bg-blue-500 text-white"
							: "px-2 py-1 text-[11px] font-semibold rounded text-slate-600 hover:bg-slate-100"
					}
				>
					Daily
				</button>
				<button
					type="button"
					onClick={() => setViewMode("week")}
					className={
						viewMode === "week"
							? "px-2 py-1 text-[11px] font-semibold rounded bg-blue-500 text-white"
							: "px-2 py-1 text-[11px] font-semibold rounded text-slate-600 hover:bg-slate-100"
					}
				>
					Weekly
				</button>
			</div>

			<button
				type="button"
				onClick={() => shiftRange(-1)}
				className="p-1 rounded hover:bg-slate-100 text-slate-600"
			>
				<ChevronLeft className="w-4 h-4" />
			</button>

			<span className="text-xs text-slate-500 min-w-[120px] text-center">
				{rangeLabel}
			</span>

			<button
				type="button"
				onClick={() => shiftRange(1)}
				className="p-1 rounded hover:bg-slate-100 text-slate-600"
			>
				<ChevronRight className="w-4 h-4" />
			</button>

			<button
				type="button"
				onClick={() =>
					queryClient.invalidateQueries({ queryKey: ["dispatch-board"] })
				}
				className="p-1 rounded hover:bg-slate-100 text-slate-600"
				title="Refresh dispatch"
			>
				<RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
			</button>

			<button
				type="button"
				onClick={() => setShowFilters(!showFilters)}
				className={cn(
					"h-7 px-2 rounded border text-[11px] font-semibold flex items-center gap-1.5",
					showFilters
						? "border-blue-300 bg-blue-50 text-blue-700"
						: "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
				)}
				title={showFilters ? "Ẩn bộ lọc" : "Hiện bộ lọc"}
			>
				<Funnel className="w-3.5 h-3.5" />
				Bộ lọc
				{showFilters ? (
					<ChevronUp className="w-3.5 h-3.5" />
				) : (
					<ChevronDown className="w-3.5 h-3.5" />
				)}
			</button>

			<FCRFieldsPopover />
		</div>
	);
}
