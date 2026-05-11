"use client";

import { useDroppable } from "@dnd-kit/core";
import {
	CalendarDays,
	ChevronDown,
	ChevronRight,
	Mail,
	Plus,
	Route,
	Search,
	Send,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import type { BoardData, DayData, FCRBoardItem, TruckSlot } from "../types";
import { useFCRFieldsStore } from "../use-fcr-fields-store";
import { AddTruckDialog } from "./add-truck-dialog";
import { FcrTable } from "./fcr-table";
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
	onRemoveLocalSlot: (id: string, date: string) => void;
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

	const columnsOrder = useFCRFieldsStore((s) => s.columnsOrder);

	const groups = useMemo(() => {
		const groupsMap = new Map<string, FCRBoardItem[]>();
		for (const fcr of fcrs) {
			const v = fcr.vendor || "Chưa có Vendor";
			if (!groupsMap.has(v)) groupsMap.set(v, []);
			groupsMap.get(v)?.push(fcr);
		}
		return Array.from(groupsMap.entries()).sort((a, b) =>
			a[0].localeCompare(b[0], "vi"),
		);
	}, [fcrs]);

	return (
		<div
			ref={setNodeRef}
			style={isDailyView ? undefined : { minHeight: Math.max(height, 300) }}
			className={cn(
				"w-full rounded-lg p-3 bg-white border border-slate-200 shadow-sm overflow-y-auto overflow-x-hidden flex flex-col gap-4 transition-all max-w-full",
				isDailyView && "h-full min-h-0",
				isOver && "bg-blue-50 border-blue-400 shadow-md",
			)}
		>
			{groups.length === 0 ? (
				<div className="flex flex-col items-center justify-center h-full text-slate-400 italic py-12">
					<Search className="w-8 h-8 mb-2 opacity-20" />
					<p className="text-sm">Không có FCR chưa xếp</p>
				</div>
			) : (
				groups.map(([vendorName, groupFcrs]) => (
					<div key={vendorName} className="flex flex-col gap-2">
						<div className="flex items-center gap-2 px-1">
							<div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
							<span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
								{vendorName}
							</span>
							<span className="text-[10px] text-slate-400 font-medium">
								({groupFcrs.length} FCR)
							</span>
						</div>
						<FcrTable
							fcrs={groupFcrs}
							columnsOrder={columnsOrder}
							selectedFcrIds={selectedFcrIds}
							onToggleSelection={onToggleFcrSelection}
							onSelectAll={(checked, visibleIds) => {
								visibleIds.forEach((id) => onToggleFcrSelection(id, checked));
							}}
							allSelected={
								groupFcrs.length > 0 &&
								groupFcrs.every((f) => selectedFcrIds.has(f.id))
							}
							columnDate={date}
						/>
					</div>
				))
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
	onRemoveLocalSlot,
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
	const [isSendingAll, setIsSendingAll] = useState(false);
	const [globalExpandKey, setGlobalExpandKey] = useState<string>();
	const [slotServiceModes, setSlotServiceModes] = useState<string[]>([]);
	const [slotSearch, setSlotSearch] = useState("");
	const [leftHeight, setLeftHeight] = useState(300);
	const [collapsedGroups, setCollapsedGroups] = useState<
		Record<string, boolean>
	>({});
	const [isSendingGroup, setIsSendingGroup] = useState<Record<string, boolean>>(
		{},
	);
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

	const handleSendAllEmails = async () => {
		const truckIds = allSlots
			.filter((s) => s.trips.some((t) => t.fcrs.length > 0))
			.map((s) => s.truckingNumberId);
		if (truckIds.length === 0) {
			toast.info("Không có xe/vendor nào đã xếp hàng để gửi mail.");
			return;
		}

		if (
			!window.confirm(
				`Gửi mail danh sách lô hàng cho tất cả ${truckIds.length} xe/vendor?`,
			)
		)
			return;

		setIsSendingAll(true);
		try {
			const items = truckIds.map((tid) => ({
				truckingNumberId: tid,
				date: day.date,
			}));
			const res = await fetch("/api/dispatch/send-mail", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ items }),
			});

			const result = await res.json();
			if (!res.ok)
				throw new Error(result.message || "Không thể gửi mail hàng loạt");

			const successCount = result.results.filter((r: any) => r.success).length;
			const failCount = result.results.length - successCount;

			if (failCount > 0) {
				toast.warning(
					`Đã gửi thành công ${successCount} mail. Thất bại ${failCount}.`,
				);
			} else {
				toast.success(`Đã gửi thành công ${successCount} mail.`);
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Giao điểm lỗi");
		} finally {
			setIsSendingAll(false);
		}
	};

	const handleSendGroupEmails = async (
		groupName: string,
		groupSlots: TruckSlot[],
	) => {
		const truckIds = groupSlots
			.filter((s) => s.trips.some((t) => t.fcrs.length > 0))
			.map((s) => s.truckingNumberId);

		if (truckIds.length === 0) {
			toast.info(`Nhà thầu ${groupName} chưa có hàng xếp để gửi mail.`);
			return;
		}

		if (
			!window.confirm(
				`Gửi mail danh sách lô hàng cho tất cả ${truckIds.length} xe của ${groupName}?`,
			)
		)
			return;

		setIsSendingGroup((prev) => ({ ...prev, [groupName]: true }));
		try {
			const items = truckIds.map((tid) => ({
				truckingNumberId: tid,
				date: day.date,
			}));
			const res = await fetch("/api/dispatch/send-mail", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ items }),
			});

			const result = await res.json();
			if (!res.ok)
				throw new Error(result.message || "Không thể gửi mail hàng loạt");

			const successCount = result.results.filter((r: any) => r.success).length;
			const failCount = result.results.length - successCount;

			if (failCount > 0) {
				toast.warning(
					`[${groupName}] Đã gửi thành công ${successCount} mail. Thất bại ${failCount}.`,
				);
			} else {
				toast.success(`[${groupName}] Đã gửi thành công ${successCount} mail.`);
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Giao điểm lỗi");
		} finally {
			setIsSendingGroup((prev) => ({ ...prev, [groupName]: false }));
		}
	};

	const allSlots: TruckSlot[] = [];
	const processedIds = new Set<string>();

	// 1. Process localSlots first (keeps manually added items at the top stably)
	for (const local of localSlots) {
		const boardSlot = day.trucks.find(
			(t) => t.truckingNumberId === local.truckingNumberId,
		);
		if (!boardSlot) {
			allSlots.push(local);
		} else {
			const mergedTrips = [...boardSlot.trips];
			for (const trip of local.trips) {
				if (!mergedTrips.some((t) => t.tripNumber === trip.tripNumber)) {
					mergedTrips.push(trip);
				}
			}
			mergedTrips.sort((a, b) => b.tripNumber - a.tripNumber);
			allSlots.push({
				...boardSlot,
				trips: mergedTrips,
			});
		}
		processedIds.add(local.truckingNumberId);
	}

	// 2. Add remaining board slots (items already in DB that weren't manually added this session)
	for (const boardSlot of day.trucks) {
		if (!processedIds.has(boardSlot.truckingNumberId)) {
			allSlots.push(boardSlot);
		}
	}

	const localIds = new Set(localSlots.map((s) => s.truckingNumberId));
	const localVendors = new Set(
		localSlots.map((s) => s.vendorName).filter(Boolean) as string[],
	);

	allSlots.sort((a, b) => {
		// 1. Group Priority: Move entire groups containing new items to the top
		const groupIsNewA =
			localIds.has(a.truckingNumberId) ||
			(!!a.vendorName && localVendors.has(a.vendorName));
		const groupIsNewB =
			localIds.has(b.truckingNumberId) ||
			(!!b.vendorName && localVendors.has(b.vendorName));

		if (groupIsNewA && !groupIsNewB) return -1;
		if (!groupIsNewA && groupIsNewB) return 1;

		// 2. Intra-group Priority: Move the specific new truck to the top of its group
		const itemIsNewA = localIds.has(a.truckingNumberId);
		const itemIsNewB = localIds.has(b.truckingNumberId);
		if (itemIsNewA && !itemIsNewB) return -1;
		if (!itemIsNewA && itemIsNewB) return 1;

		// 3. For "New" items, maintain the order they were added (insertion order)
		// For "Old" items, use standard categorization and alphabetical sort
		if (!groupIsNewA) {
			// Category Priority: Internal trucks above vendor trucks
			const isVendorA = !!a.vendorName;
			const isVendorB = !!b.vendorName;
			if (isVendorA && !isVendorB) return 1;
			if (!isVendorA && isVendorB) return -1;

			// Alphabetical Priority: Sort vendors by name
			if (isVendorA && isVendorB) {
				return (a.vendorName ?? "").localeCompare(b.vendorName ?? "");
			}
		}

		return 0;
	});
	const visibleSlots = allSlots.filter((slot) => {
		// Mode filter
		if (slotServiceModes.length > 0) {
			const fcrModes = slot.trips
				.flatMap((trip) => trip.fcrs)
				.map((fcr) => fcr.truckingFollowUp.serviceMode)
				.filter(Boolean) as string[];

			// Keep newly-added/empty slots visible even when mode filters are active.
			if (fcrModes.length > 0) {
				const categories = new Set(fcrModes.map(classifyServiceMode));
				if (
					!slotServiceModes.some((mode) =>
						categories.has(mode as "FCL" | "LCL" | "AIR"),
					)
				)
					return false;
			}
		}

		// Search filter
		if (slotSearch) {
			const s = slotSearch.toLowerCase();
			const matchesPlate = slot.plateNumber?.toLowerCase().includes(s);
			const matchesVendor = slot.vendorName?.toLowerCase().includes(s);
			const matchesDriver = slot.driverName?.toLowerCase().includes(s);

			const matchesFcr = slot.trips.some((t) =>
				t.fcrs.some(
					(f) =>
						f.fcrNumber?.toLowerCase().includes(s) ||
						f.truckingFollowUp.jobNumber?.toLowerCase().includes(s) ||
						f.truckingFollowUp.billOrBooking?.toLowerCase().includes(s) ||
						f.containerNo?.toLowerCase().includes(s),
				),
			);

			if (!matchesPlate && !matchesVendor && !matchesDriver && !matchesFcr)
				return false;
		}

		return true;
	});

	const groups = useMemo(() => {
		const internal: TruckSlot[] = [];
		const vendors = new Map<string, TruckSlot[]>();

		for (const slot of visibleSlots) {
			// Determine group name: prioritize vendor from FCRs, then fall back to truck's vendor name
			const fcrVendors = slot.trips
				.flatMap((t) => t.fcrs)
				.map((f) => f.vendor)
				.filter(Boolean);
			const effectiveVendor =
				fcrVendors.length > 0 ? fcrVendors[0] : slot.vendorName;

			if (effectiveVendor) {
				const list = vendors.get(effectiveVendor) ?? [];
				list.push(slot);
				vendors.set(effectiveVendor, list);
			} else {
				internal.push(slot);
			}
		}

		const result: (
			| { type: "internal"; slots: TruckSlot[] }
			| { type: "vendor"; name: string; slots: TruckSlot[] }
		)[] = [];

		if (internal.length > 0) {
			result.push({ type: "internal", slots: internal });
		}

		for (const [name, slots] of vendors.entries()) {
			result.push({ type: "vendor", name, slots });
		}

		// Sort groups themselves: if any slot in the group is "new", move the group up
		result.sort((a, b) => {
			const isNewA = a.slots.some(
				(s) =>
					localIds.has(s.truckingNumberId) ||
					(s.vendorName && localVendors.has(s.vendorName)),
			);
			const isNewB = b.slots.some(
				(s) =>
					localIds.has(s.truckingNumberId) ||
					(s.vendorName && localVendors.has(s.vendorName)),
			);

			if (isNewA && !isNewB) return -1;
			if (!isNewA && isNewB) return 1;
			return 0; // Maintain existing relative order
		});

		return result;
	}, [visibleSlots, localIds, localVendors]);

	const visibleUnscheduled = unscheduledFcrs
		.filter((fcr) => !filterFcr || filterFcr(fcr))
		.filter((fcr) => {
			if (!unscheduledDateFilter) return true;
			const d =
				fcr.implementationDate ?? fcr.truckingFollowUp.implementationDate;
			return d === unscheduledDateFilter;
		});

	const _unscheduledGroups = useMemo(() => {
		const groupsMap = new Map<string, FCRBoardItem[]>();
		for (const fcr of visibleUnscheduled) {
			const v = fcr.vendor || "Chưa có Vendor";
			if (!groupsMap.has(v)) groupsMap.set(v, []);
			groupsMap.get(v)?.push(fcr);
		}
		return Array.from(groupsMap.entries()).sort((a, b) =>
			a[0].localeCompare(b[0], "vi"),
		);
	}, [visibleUnscheduled]);

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
					defaultSize={50}
					minSize={25}
					className={cn(isDailyView && "min-h-0")}
				>
					<div
						ref={leftPanelRef}
						className={cn(
							"bg-white rounded-lg p-2.5 border border-slate-200 flex flex-col gap-2",
							isDailyView && "h-full overflow-y-auto content-start",
						)}
					>
						<div className="flex flex-wrap items-center gap-1">
							{/* Search input for Trucks/Vendors */}
							<div className="relative flex-1 min-w-[100px]">
								<Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
								<input
									type="text"
									value={slotSearch}
									onChange={(e) => setSlotSearch(e.target.value)}
									placeholder="Tìm biển số, nhà thầu, FCR, Job..."
									className="w-full pl-7 pr-2 h-7 text-[10px] rounded border border-slate-300 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
								/>
								{slotSearch && (
									<button
										onClick={() => setSlotSearch("")}
										className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
									>
										×
									</button>
								)}
							</div>

							<Button
								variant="outline"
								size="sm"
								className="h-7 text-[11px] font-semibold px-2 border-slate-300 text-slate-700 hover:bg-white flex-1 min-w-[60px]"
								onClick={() => setDialogOpen(true)}
								title="Thêm xe / Vendor"
							>
								<Plus className="w-3.5 h-3.5 mr-1" />
								Thêm
							</Button>

							<Button
								variant="outline"
								size="sm"
								className={cn(
									"h-7 text-[11px] font-semibold px-2 flex-1 min-w-[80px]",
									showRoutes
										? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
										: "border-slate-300 text-slate-700 hover:bg-white",
								)}
								onClick={() => setShowRoutes((v) => !v)}
							>
								<Route className="w-3.5 h-3.5 mr-1" />
								{showRoutes ? "Ẩn tuyến" : "Hiện tuyến"}
							</Button>

							<div className="h-6 w-px bg-slate-200 mx-0.5" />

							<div className="flex items-center gap-1">
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

							<div className="h-6 w-px bg-slate-200 mx-0.5" />

							<Button
								variant="outline"
								size="sm"
								className="h-7 px-1.5 text-[10px] font-semibold border-slate-300 text-slate-700 hover:bg-slate-100"
								onClick={() => {
									setGlobalExpandKey(`${Date.now().toString()}_expand`);
									setCollapsedGroups({});
								}}
								title="Mở tất cả xe"
							>
								Mở hết
							</Button>
							<Button
								variant="outline"
								size="sm"
								className="h-7 px-1.5 text-[10px] font-semibold border-slate-300 text-slate-700 hover:bg-slate-100"
								onClick={() => {
									setGlobalExpandKey(`${Date.now().toString()}_collapse`);
									const allCollapsed: Record<string, boolean> = {};
									groups.forEach((g) => {
										if (g.type === "vendor") allCollapsed[g.name] = true;
									});
									setCollapsedGroups(allCollapsed);
								}}
								title="Gập tất cả xe"
							>
								Gập hết
							</Button>

							<div className="h-6 w-px bg-slate-200 mx-0.5" />

							<Button
								variant="default"
								size="sm"
								className={cn(
									"h-7 px-2 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm",
									isSendingAll && "animate-pulse",
								)}
								onClick={handleSendAllEmails}
								disabled={isSendingAll || allSlots.length === 0}
								title="Gửi mail cho tất cả xe/vendor đã xếp trong ngày"
							>
								<Send className="w-3 h-3 mr-1.5" />
								Gửi Mail Hết
							</Button>
						</div>

						<div className="flex flex-col gap-6">
							{groups.map((group, _idx) => {
								if (group.type === "internal") {
									return (
										<div key="internal" className="flex flex-col gap-3">
											{group.slots.map((slot) => {
												return (
													<TruckCard
														key={slot.truckingNumberId}
														slot={slot}
														date={day.date}
														showRoutes={showRoutes}
														allTrucks={allTrucks}
														allVendors={allVendors}
														onMoveAll={onMoveAllInSlot}
														onRemoveAll={onRemoveAllInSlot}
														onCombineJobs={onCombineJobsInSlot}
														onRemoveSlot={() =>
															onRemoveLocalSlot(slot.truckingNumberId, day.date)
														}
														forceExpandKey={globalExpandKey}
													/>
												);
											})}
										</div>
									);
								}

								// Vendor Group
								const isCollapsed = collapsedGroups[group.name] ?? false;

								return (
									<div
										key={group.name}
										className="flex flex-col gap-3 p-3 rounded-xl border border-indigo-100 bg-indigo-50/30"
									>
										<div className="flex items-center gap-2 px-1">
											<button
												type="button"
												onClick={() =>
													setCollapsedGroups((prev) => ({
														...prev,
														[group.name]: !isCollapsed,
													}))
												}
												className="p-1 hover:bg-indigo-100 rounded text-indigo-500 mr-[-4px]"
											>
												{isCollapsed ? (
													<ChevronRight className="w-3.5 h-3.5" />
												) : (
													<ChevronDown className="w-3.5 h-3.5" />
												)}
											</button>
											<div className="h-2 w-2 rounded-full bg-indigo-500" />
											<span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
												{group.name}
											</span>
											<span className="text-[10px] text-indigo-400 font-medium">
												({group.slots.length} xe)
											</span>

											<Button
												type="button"
												size="sm"
												variant="outline"
												disabled={isSendingGroup[group.name]}
												onClick={() =>
													handleSendGroupEmails(group.name, group.slots)
												}
												className={cn(
													"ml-auto h-6 px-2 text-[10px] font-bold border-indigo-200 text-indigo-600 hover:bg-indigo-100 bg-white/50",
													isSendingGroup[group.name] && "animate-pulse",
												)}
												title={`Gửi mail danh sách lô hàng cho toàn bộ xe của ${group.name}`}
											>
												<Mail className="w-3 h-3 mr-1" />
												Gửi mail nhóm
											</Button>
										</div>
										{!isCollapsed && (
											<div className="flex flex-col gap-3">
												{group.slots.map((slot) => {
													const showAsVendor =
														!slot.plateNumber || slot.isVendor;

													return showAsVendor ? (
														<VendorCard
															key={slot.truckingNumberId}
															slot={slot}
															date={day.date}
															showRoutes={showRoutes}
															allTrucks={allTrucks}
															allVendors={allVendors}
															onMoveAll={onMoveAllInSlot}
															onRemoveAll={onRemoveAllInSlot}
															onCombineJobs={onCombineJobsInSlot}
															onRemoveSlot={() =>
																onRemoveLocalSlot(
																	slot.truckingNumberId,
																	day.date,
																)
															}
															forceExpandKey={globalExpandKey}
														/>
													) : (
														<TruckCard
															key={slot.truckingNumberId}
															slot={slot}
															date={day.date}
															showRoutes={showRoutes}
															allTrucks={allTrucks}
															allVendors={allVendors}
															onMoveAll={onMoveAllInSlot}
															onRemoveAll={onRemoveAllInSlot}
															onCombineJobs={onCombineJobsInSlot}
															onRemoveSlot={() =>
																onRemoveLocalSlot(
																	slot.truckingNumberId,
																	day.date,
																)
															}
															forceExpandKey={globalExpandKey}
														/>
													);
												})}
											</div>
										)}
									</div>
								);
							})}

							{visibleSlots.length === 0 && (
								<p className="text-xs text-slate-400 italic px-2 py-3 w-full text-center">
									Không có xe/vendor theo bộ lọc
								</p>
							)}
						</div>
					</div>
				</ResizablePanel>

				<ResizableHandle withHandle className="bg-slate-300" />

				<ResizablePanel
					defaultSize={50}
					minSize={10}
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
