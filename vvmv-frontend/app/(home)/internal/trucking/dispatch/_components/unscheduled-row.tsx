"use client";

import { useDroppable } from "@dnd-kit/core";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FCRBoardItem } from "../types";
import { FCRCard } from "./fcr-card";

interface UnscheduledRowProps {
	fcrs: FCRBoardItem[];
	dates: string[];
}

export function UnscheduledRow({ fcrs, dates }: UnscheduledRowProps) {
	const { setNodeRef, isOver } = useDroppable({
		id: "unscheduled",
		data: { type: "unscheduled" },
	});

	// Group FCRs by effectiveDate
	const byDate = new Map<string, FCRBoardItem[]>();
	const noDate: FCRBoardItem[] = [];
	for (const fcr of fcrs) {
		const d = fcr.implementationDate ?? fcr.truckingFollowUp.implementationDate;
		if (!d) {
			noDate.push(fcr);
		} else {
			if (!byDate.has(d)) byDate.set(d, []);
			byDate.get(d)?.push(fcr);
		}
	}

	// Dates in range that have unscheduled FCRs, in order; then dates outside range; then no-date
	const inRange = dates.filter((d) => byDate.has(d));
	const outsideRange = [...byDate.keys()]
		.filter((d) => !dates.includes(d))
		.sort((a, b) => a.localeCompare(b));

	const orderedDates = [...inRange, ...outsideRange];

	const formatDate = (d: string) => {
		const [y, m, day] = d.split("-");
		return `${day}/${m}/${y}`;
	};

	return (
		<div className="w-72 h-full flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white shrink-0 shadow-sm hover:shadow-md transition-shadow">
			{/* Header */}
			<div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 shrink-0">
				<div className="p-1.5 rounded-lg bg-blue-100">
					<Inbox className="w-4 h-4 text-blue-600 shrink-0" />
				</div>
				<div className="flex flex-col flex-1">
					<span className="text-sm font-bold text-slate-900">
						Chưa lên lịch
					</span>
					<span className="text-[10px] text-slate-500">Chờ gán xe</span>
				</div>
				<span className="ml-auto text-sm font-bold px-2.5 py-1 rounded-full bg-blue-500 text-white">
					{fcrs.length}
				</span>
			</div>

			{/* Drop zone with FCRs */}
			<div
				ref={setNodeRef}
				className={cn(
					"p-3 flex flex-col gap-2 overflow-y-auto flex-1 transition-colors",
					isOver ? "bg-blue-50 border-l-4 border-blue-400" : "bg-white",
				)}
			>
				{fcrs.length === 0 ? (
					<p className="text-xs text-slate-400 italic text-center mt-6">
						Tất cả FCR đã được lên lịch ✓
					</p>
				) : (
					<>
						{orderedDates.map((date) => (
							<div key={date} className="flex flex-col gap-1.5">
								<span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-1 rounded-md bg-slate-100">
									{formatDate(date)}
								</span>
								{byDate.get(date)?.map((fcr) => (
									<FCRCard key={fcr.id} fcr={fcr} className="w-full" />
								))}
							</div>
						))}
						{noDate.length > 0 && (
							<div className="flex flex-col gap-1.5">
								<span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 rounded-md bg-slate-50">
									Chưa có ngày
								</span>
								{noDate.map((fcr) => (
									<FCRCard key={fcr.id} fcr={fcr} className="w-full" />
								))}
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}
