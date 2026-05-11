"use client";

import { useDroppable } from "@dnd-kit/core";
import { CalendarDays, Plus, Route } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import type { BoardData, DayData, FCRBoardItem, TruckSlot } from "../types";
import { AddTruckDialog } from "./add-truck-dialog";
import type { SlotTarget } from "./change-slot-dialog";
import { FCRCard } from "./fcr-card";
import { TruckCard } from "./truck-card";
import { VendorCard } from "./vendor-card";

const QUICK_SERVICE_MODES = ["FCL", "LCL", "AIR"] as const;

/** Map raw serviceMode → canonical category (FCL | LCL | AIR).
 *  - Chứa "CPN" hoặc "AIR" → "AIR"
 *  - Chứa "FCL"            → "FCL"
 *  - Còn lại               → "LCL"
 */
function classifyServiceMode(
	raw: string | null | undefined,
): "FCL" | "LCL" | "AIR" {
	if (!raw) return "LCL";
	const u = raw.toUpperCase().trim();
	if (u.includes("CPN") || u.includes("AIR")) return "AIR";
	if (u.includes("FCL")) return "FCL";
	return "LCL";
}

interface DayColumnProps {
	day: DayData;
	allTrucks: BoardData["allTrucks"];
	allVendors: BoardData["allVendors"];
	localSlots: TruckSlot[];
	onAddTruck: (truckId: string, date: string, tripNumber: number) => void;
	onAddVendor: (vendorId: string, date: string) => Promise<void> | void;
	onMoveAllInSlot: (
		fcrIds: string[],
		targetTruckingNumberId: string,
		date: string,
	) => Promise<void>;
	onRemoveAllInSlot: (fcrIds: string[], date: string) => Promise<void>;
	onCombineJobsInSlot: (
		fcrs: FCRBoardItem[],
		truckingNumberId: string,
	) => Promise<void>;
	filterFcr?: (fcr: FCRBoardItem) => boolean;
	unscheduledFcrs: FCRBoardItem[];
	selectedFcrIds: Set<string>;
	onToggleFcrSelection: (fcrId: string, selected: boolean) => void;
	unscheduledDateFilter?: string;
	isDailyView?: boolean;
}

function UnscheduledDropZone({
	date,
	fcrs,
	selectedFcrIds,
	onToggleFcrSelection,
	height,
	isDailyView,
}: {
	date: string;
	fcrs: FCRBoardItem[];
	selectedFcrIds: Set<string>;
	onToggleFcrSelection: (fcrId: string, selected: boolean) => void;
	height: number;
	isDailyView: boolean;
}) {
	const { setNodeRef, isOver } = useDroppable({
		id: `unscheduled-${date}`,
		data: { type: "unscheduled", date },
	});

	return (
		<div
			ref={setNodeRef}
			style={isDailyView ? undefined : { height: Math.max(height, 300) }}
			className={cn(
				"w-full rounded-lg p-3 overflow-y-auto transition-all border-2",
				isDailyView && "h-full min-h-0",
				isOver
					? "bg-blue-50 border-blue-400 shadow-md"
					: "bg-white border-slate-200 shadow-sm",
			)}
		>
			{fcrs.length === 0 ? (
				<p className="text-xs text-slate-400 italic text-center mt-6">
					Kéo FCR vào đây để gán xe
				</p>
			) : (
				<div
					className="grid gap-1.5"
					style={{
						gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
					}}
				>
					{fcrs.map((fcr) => (
						<div
							key={fcr.id}
							className={cn(
								"relative",
								selectedFcrIds.has(fcr.id) && "rounded-md ring-2 ring-blue-500",
							)}
						>
							<button
								type="button"
								onPointerDown={(e) => {
									e.stopPropagation();
								}}
								onClick={(e) => {
									e.stopPropagation();
									onToggleFcrSelection(fcr.id, !selectedFcrIds.has(fcr.id));
								}}
								className={cn(
									"absolute -right-1 -top-1 z-10 h-4 w-4 rounded border text-[10px] font-bold leading-none shadow-sm",
									"flex items-center justify-center transition-colors",
									selectedFcrIds.has(fcr.id)
										? "border-blue-600 bg-blue-600 text-white"
										: "border-slate-300 bg-white text-transparent hover:border-blue-400",
								)}
								aria-label={
									selectedFcrIds.has(fcr.id) ? "Bỏ chọn FCR" : "Chọn FCR"
								}
								title={selectedFcrIds.has(fcr.id) ? "Bỏ chọn FCR" : "Chọn FCR"}
							>
								✓
							</button>
							<FCRCard fcr={fcr} className="w-full" />
						</div>
					))}
				</div>
			)}
		</div>
	);
}

export function DayColumn({
	day,
	allTrucks,
	allVendors,
	localSlots,
	onAddTruck,
	onAddVendor,
	onMoveAllInSlot,
	onRemoveAllInSlot,
	onCombineJobsInSlot,
	filterFcr,
	unscheduledFcrs,
	selectedFcrIds,
	onToggleFcrSelection,
	unscheduledDateFilter,
	isDailyView = false,
}: DayColumnProps) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [showRoutes, setShowRoutes] = useState(false);
	const [slotServiceModes, setSlotServiceModes] = useState<string[]>([]);
	const [leftHeight, setLeftHeight] = useState(300);
	const observerRef = useRef<ResizeObserver | null>(null);

	// Callback ref: attaches a ResizeObserver when the element mounts,
	// disconnects when it unmounts. No useEffect needed.
	const leftPanelRef = useCallback((node: HTMLDivElement | null) => {
		if (observerRef.current) {
			observerRef.current.disconnect();
			observerRef.current = null;
		}
		if (node) {
			const ro = new ResizeObserver((entries) => {
				for (const entry of entries) {
					setLeftHeight(
						entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height,
					);
				}
			});
			ro.observe(node);
			observerRef.current = ro;
			// Set initial height immediately
			setLeftHeight(node.offsetHeight);
		}
	}, []);

	const slotMap = new Map(day.trucks.map((s) => [s.truckingNumberId, s]));
	for (const local of localSlots) {
		const existing = slotMap.get(local.truckingNumberId);
		if (!existing) {
			slotMap.set(local.truckingNumberId, local);
			continue;
		}

		const mergedTrips = [...existing.trips];
		for (const trip of local.trips) {
			if (!mergedTrips.some((t) => t.tripNumber === trip.tripNumber)) {
				mergedTrips.push(trip);
			}
		}
		mergedTrips.sort((a, b) => a.tripNumber - b.tripNumber);

		slotMap.set(local.truckingNumberId, {
			...existing,
			trips: mergedTrips,
		});
	}
	const allSlots = [...slotMap.values()];

	const visibleSlots = allSlots.filter((slot) => {
		if (slotServiceModes.length === 0) return true;

		const fcrModes = slot.trips
			.flatMap((trip) => trip.fcrs)
			.map((fcr) => fcr.truckingFollowUp.serviceMode)
			.filter(Boolean) as string[];

		// Keep newly-added/empty slots visible even when mode filters are active.
		if (fcrModes.length === 0) return true;

		const categories = new Set(fcrModes.map(classifyServiceMode));
		return slotServiceModes.some((mode) =>
			categories.has(mode as "FCL" | "LCL" | "AIR"),
		);
	});

	const visibleUnscheduled = unscheduledFcrs
		.filter((fcr) => !filterFcr || filterFcr(fcr))
		.filter((fcr) => {
			if (!unscheduledDateFilter) return true;
			const d =
				fcr.implementationDate ?? fcr.truckingFollowUp.implementationDate;
			return d === unscheduledDateFilter;
		});

	const formatted = new Date(`${day.date}T00:00:00Z`).toLocaleDateString(
		"vi-VN",
		{
			weekday: "short",
			day: "2-digit",
			month: "2-digit",
			timeZone: "UTC",
		},
	);

	return (
		<div
			className={cn(
				"flex flex-col gap-3 border-b border-slate-200 pb-4 bg-slate-50/50 rounded-lg p-4",
				isDailyView && "h-full border-b-0 pb-0",
			)}
		>
			{/* Day header (compact) */}
			<div className="flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-1.5">
					<div className="p-1 rounded-md bg-blue-100 shrink-0">
						<CalendarDays className="w-3.5 h-3.5 text-blue-600" />
					</div>
					<span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
						{formatted}
					</span>
					<span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
						{visibleSlots.length}/{allSlots.length} xe
					</span>
				</div>

				<span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-px rounded whitespace-nowrap">
					{visibleUnscheduled.length} FCR chưa xếp
				</span>
			</div>

			{/* Row: trucks (resizable) + unscheduled drop zone */}
			<ResizablePanelGroup
				orientation="horizontal"
				className={cn("gap-2 !h-auto", isDailyView && "flex-1 min-h-0")}
			>
				<ResizablePanel
					defaultSize="18%"
					minSize="14%"
					className={cn(isDailyView && "min-h-0")}
				>
					<div
						ref={leftPanelRef}
						className={cn(
							"bg-white rounded-lg p-2.5 border border-slate-200 flex flex-col gap-2",
							isDailyView && "h-full overflow-y-auto content-start",
						)}
					>
						<Button
							variant="outline"
							size="sm"
							className="h-7 text-[11px] font-semibold px-2.5 border-slate-300 text-slate-700 hover:bg-white w-full"
							onClick={() => setDialogOpen(true)}
						>
							<Plus className="w-3.5 h-3.5 mr-1.5" />
							Thêm xe / Vendor
						</Button>

						<Button
							variant="outline"
							size="sm"
							className={cn(
								"h-7 text-[11px] font-semibold px-2.5 w-full",
								showRoutes
									? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
									: "border-slate-300 text-slate-700 hover:bg-white",
							)}
							onClick={() => setShowRoutes((v) => !v)}
						>
							<Route className="w-3.5 h-3.5 mr-1.5" />
							{showRoutes ? "Ẩn tuyến đường" : "Hiện tuyến đường"}
						</Button>

						<div className="flex flex-wrap items-center gap-1">
							{QUICK_SERVICE_MODES.map((mode) => {
								const checked = slotServiceModes.includes(mode);
								return (
									<button
										key={mode}
										type="button"
										onClick={() =>
											setSlotServiceModes((prev) =>
												prev.includes(mode)
													? prev.filter((m) => m !== mode)
													: [...prev, mode],
											)
										}
										className={cn(
											"h-6 px-2 rounded-md text-[10px] font-bold border transition-colors",
											checked
												? "border-cyan-400 bg-cyan-100 text-cyan-700"
												: "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
										)}
									>
										{mode}
									</button>
								);
							})}
						</div>

						<div className="flex flex-row flex-wrap gap-2">
							{visibleSlots.map((slot) => {
								const truckTargets: SlotTarget[] = allTrucks
									.filter((t) => t.id !== slot.truckingNumberId)
									.map((t) => ({
										id: `truck:${t.id}`,
										label: t.plateNumber,
										type: "truck" as const,
									}));

								const vendorTargets: SlotTarget[] = allVendors
									.filter((v) => !(slot.isVendor && slot.vendorName === v.name))
									.map((v) => ({
										id: `vendor:${v.id}`,
										label: v.name,
										type: "vendor" as const,
									}));

								const targets: SlotTarget[] = [
									...truckTargets,
									...vendorTargets,
								];

								return slot.isVendor ? (
									<VendorCard
										key={slot.truckingNumberId}
										slot={slot}
										date={day.date}
										showRoutes={showRoutes}
										targets={targets}
										onMoveAll={onMoveAllInSlot}
										onRemoveAll={onRemoveAllInSlot}
										onCombineJobs={onCombineJobsInSlot}
									/>
								) : (
									<TruckCard
										key={slot.truckingNumberId}
										slot={slot}
										date={day.date}
										showRoutes={showRoutes}
										targets={targets}
										onMoveAll={onMoveAllInSlot}
										onRemoveAll={onRemoveAllInSlot}
										onCombineJobs={onCombineJobsInSlot}
									/>
								);
							})}
							{visibleSlots.length === 0 && (
								<p className="text-xs text-slate-400 italic px-2 py-3 w-full text-center">
									Không có xe/vendor theo mode đã chọn
								</p>
							)}
						</div>
					</div>
				</ResizablePanel>

				<ResizableHandle withHandle className="bg-slate-300" />

				<ResizablePanel
					defaultSize="75%"
					minSize="10%"
					className={cn(isDailyView && "min-h-0")}
				>
					<UnscheduledDropZone
						date={day.date}
						fcrs={visibleUnscheduled}
						selectedFcrIds={selectedFcrIds}
						onToggleFcrSelection={onToggleFcrSelection}
						height={leftHeight}
						isDailyView={isDailyView}
					/>
				</ResizablePanel>
			</ResizablePanelGroup>

			<AddTruckDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				date={day.date}
				allTrucks={allTrucks}
				allVendors={allVendors}
				existingSlots={allSlots}
				onConfirm={onAddTruck}
				onConfirmVendor={onAddVendor}
			/>
		</div>
	);
}
