"use client";

import { useDroppable } from "@dnd-kit/core";
import {
	Building2,
	ChevronDown,
	ChevronRight,
	Mail,
	Route,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BoardData, TruckSlot } from "../types";
import { useFCRFieldsStore } from "../use-fcr-fields-store";
import { AddTruckDialog } from "./add-truck-dialog";
import { FcrTable } from "./fcr-table";

const QUICK_SERVICE_MODES = ["FCL", "LCL", "AIR"] as const;

function classifyServiceMode(
	raw: string | null | undefined,
): "FCL" | "LCL" | "AIR" {
	if (!raw) return "LCL";
	const u = raw.toUpperCase().trim();
	if (u.includes("CPN") || u.includes("AIR")) return "AIR";
	if (u.includes("FCL")) return "FCL";
	return "LCL";
}

function getQuickServiceModes(tripFcrs: TruckSlot["trips"][number]["fcrs"]) {
	const categories = new Set(
		tripFcrs.map((fcr) =>
			classifyServiceMode(fcr.truckingFollowUp.serviceMode),
		),
	);
	return QUICK_SERVICE_MODES.filter((mode) => categories.has(mode));
}

function VendorDropZone({
	truckingNumberId,
	date,
	tripNumber,
	children,
}: {
	truckingNumberId: string;
	date: string;
	tripNumber: number;
	children: React.ReactNode;
}) {
	const { setNodeRef, isOver } = useDroppable({
		id: `truck-${truckingNumberId}-${date}-${tripNumber}`,
		data: { type: "truck-slot", truckingNumberId, date, tripNumber },
	});

	return (
		<div
			ref={setNodeRef}
			className={cn(
				"border border-indigo-200 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50/50 text-indigo-900 shadow-sm w-full p-3 transition-all",
				isOver &&
					"ring-2 ring-violet-300 border-violet-300 from-indigo-100 to-indigo-50",
			)}
		>
			{children}
		</div>
	);
}

export function VendorCard({
	slot,
	date,
	showRoutes = false,
	allTrucks,
	allVendors,
	onMoveAll,
	onRemoveAll,
	onCombineJobs,
	onRemoveSlot,
	forceExpandKey,
}: {
	slot: TruckSlot;
	date: string;
	showRoutes?: boolean;
	allTrucks: BoardData["allTrucks"];
	allVendors: BoardData["allVendors"];
	onMoveAll: (
		fcrIds: string[],
		targetId: string,
		date: string,
	) => Promise<void>;
	onRemoveAll: (fcrIds: string[], date: string) => Promise<void>;
	onCombineJobs: (
		fcrs: TruckSlot["trips"][number]["fcrs"],
		truckingNumberId: string,
	) => Promise<void>;
	onRemoveSlot?: () => void;
	forceExpandKey?: string;
}) {
	const [changeOpen, setChangeOpen] = useState(false);
	const [processing, setProcessing] = useState(false);
	const [mailingTrip, setMailingTrip] = useState<number | null>(null);
	const [expandedTrips, setExpandedTrips] = useState<Record<number, boolean>>(
		{},
	);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const columnsOrder = useFCRFieldsStore((s) => s.columnsOrder);

	const sortedTrips = [...slot.trips].sort(
		(a, b) => b.tripNumber - a.tripNumber,
	);
	const allFcrs = sortedTrips.flatMap((t) => t.fcrs);

	async function handleRemoveAll() {
		if (allFcrs.length === 0) return;
		if (!window.confirm("Bỏ tất cả FCR khỏi nhà thầu này?")) return;
		setProcessing(true);
		try {
			await onRemoveAll(
				allFcrs.map((f) => f.id),
				date,
			);
		} finally {
			setProcessing(false);
		}
	}

	async function handleChangeTarget(id: string, type: "truck" | "vendor") {
		if (allFcrs.length === 0) return;
		const targetWithPrefix = type === "truck" ? `truck:${id}` : `vendor:${id}`;

		setProcessing(true);
		try {
			await onMoveAll(
				allFcrs.map((f) => f.id),
				targetWithPrefix,
				date,
			);
			setChangeOpen(false);
		} catch (_err) {
			toast.error("Không thể đổi xe/nhà thầu");
		} finally {
			setProcessing(false);
		}
	}

	async function handleCombineJobs() {
		if (allFcrs.length < 2) return;
		setProcessing(true);
		try {
			await onCombineJobs(allFcrs, slot.truckingNumberId);
		} finally {
			setProcessing(false);
		}
	}

	async function handleSendEmail(tripNumber: number) {
		setMailingTrip(tripNumber);
		try {
			const res = await fetch("/api/dispatch/send-mail", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					truckingNumberId: slot.truckingNumberId,
					date,
					tripNumber,
					columnsOrder,
				}),
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.message || "Không thể gửi mail");
			toast.success(`Đã gửi mail đến: ${data.to}`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Lỗi hệ thống");
		} finally {
			setMailingTrip(null);
		}
	}

	useEffect(() => {
		if (!forceExpandKey) return;
		if (forceExpandKey.endsWith("_expand")) {
			setExpandedTrips({});
		} else if (forceExpandKey.endsWith("_collapse")) {
			setExpandedTrips((prev) => {
				const next: Record<number, boolean> = { ...prev };
				slot.trips.forEach((t) => {
					next[t.tripNumber] = false;
				});
				return next;
			});
		}
	}, [forceExpandKey, slot.trips]);

	return (
		<div className="flex flex-col gap-2">
			{sortedTrips.map((trip) => {
				const tripFcrs = trip.fcrs;
				const quickModes = getQuickServiceModes(tripFcrs);
				const stops: string[] = [];
				const seen = new Set<string>();
				for (const f of tripFcrs) {
					for (const loc of [f.pickupAt, f.deliveryAt]) {
						if (loc && !seen.has(loc)) {
							seen.add(loc);
							stops.push(loc);
						}
					}
				}

				return (
					<VendorDropZone
						key={`${slot.truckingNumberId}-${trip.tripNumber}`}
						truckingNumberId={slot.truckingNumberId}
						date={date}
						tripNumber={trip.tripNumber}
					>
						<div className="flex flex-col xl:flex-row xl:items-start gap-4 mb-3">
							{/* Header */}
							<div className="flex-1 space-y-1.5">
								<div className="flex items-center gap-2">
									<button
										type="button"
										onClick={() =>
											setExpandedTrips((prev) => ({
												...prev,
												[trip.tripNumber]: !(prev[trip.tripNumber] ?? true),
											}))
										}
										className="p-1 hover:bg-slate-200 rounded text-slate-500 mr-[-4px]"
									>
										{(expandedTrips[trip.tripNumber] ?? true) ? (
											<ChevronDown className="w-4 h-4" />
										) : (
											<ChevronRight className="w-4 h-4" />
										)}
									</button>
									{tripFcrs.length === 0 && onRemoveSlot && (
										<Button
											type="button"
											size="icon"
											variant="ghost"
											onClick={(e) => {
												e.stopPropagation();
												onRemoveSlot();
											}}
											className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
											title="Xoá slot nhà thầu này"
										>
											<X className="w-4 h-4" />
										</Button>
									)}
									<span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 border border-indigo-200 px-2 py-0.5 shadow-sm shrink-0">
										<Building2 className="w-4 h-4 text-indigo-600" />
										<span className="w-1.5 h-1.5 rounded-sm bg-indigo-300 border border-indigo-400" />
									</span>
									<span className="text-sm font-bold bg-white/70 text-indigo-700 px-2.5 py-0.5 rounded-md border border-indigo-200">
										Chuyến {trip.tripNumber}
									</span>
									<span className="text-base font-bold tracking-wider text-indigo-900 break-all">
										{slot.vendorName}
									</span>
									{quickModes.length > 0 && (
										<div className="flex items-center gap-1 ml-1">
											{quickModes.map((mode) => (
												<span
													key={mode}
													className="text-[10px] font-bold uppercase rounded px-1.5 py-0.5 bg-indigo-100 text-indigo-700 border border-indigo-200"
												>
													{mode}
												</span>
											))}
										</div>
									)}
									{tripFcrs.length > 0 && (
										<span className="text-[10px] font-bold rounded px-1.5 py-0.5 bg-white/70 text-indigo-700 border border-indigo-200 ml-1">
											{tripFcrs.length} FCR
										</span>
									)}
								</div>
							</div>

							{/* Actions */}
							<div className="flex flex-wrap items-center gap-2 xl:ml-auto">
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() => setChangeOpen(true)}
									disabled={
										processing ||
										tripFcrs.length === 0 ||
										(allTrucks.length === 0 && allVendors.length === 0)
									}
									className="h-7 text-[11px] px-2 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
								>
									Đổi
								</Button>
								<Button
									type="button"
									size="sm"
									variant="destructive"
									onClick={handleRemoveAll}
									disabled={processing || tripFcrs.length === 0}
									className="h-7 text-[11px] px-2"
								>
									Xoá hết
								</Button>
								<Button
									type="button"
									size="sm"
									variant="default"
									onClick={handleCombineJobs}
									disabled={processing || tripFcrs.length < 2}
									className="h-7 text-[11px] px-2 bg-indigo-600 hover:bg-indigo-700"
								>
									Combine
								</Button>
								<Button
									type="button"
									size="icon"
									variant="outline"
									onClick={() => handleSendEmail(trip.tripNumber)}
									disabled={
										processing ||
										mailingTrip === trip.tripNumber ||
										tripFcrs.length === 0
									}
									className={cn(
										"h-7 w-7 text-indigo-600 border-indigo-200 hover:bg-indigo-50",
										mailingTrip === trip.tripNumber && "animate-pulse",
									)}
									title="Gửi mail lịch vận chuyển cho nhà thầu này"
								>
									<Mail className="w-3.5 h-3.5" />
								</Button>
							</div>
						</div>

						{/* Routes */}
						{showRoutes && stops.length > 0 && (
							<div className="mb-3 px-1 py-2 bg-indigo-50/50 border border-indigo-100 rounded flex flex-wrap items-center gap-1">
								<Route className="w-3 h-3 text-indigo-400 mr-1" />
								{stops.map((stop, i) => (
									<span key={stop} className="flex items-center gap-0.5">
										{i > 0 && (
											<span className="text-indigo-300 text-[10px] mx-0.5">
												→
											</span>
										)}
										<span
											className={cn(
												"text-[10px] px-1.5 py-0.5 rounded font-semibold",
												i === 0
													? "bg-emerald-100 text-emerald-700"
													: i === stops.length - 1
														? "bg-rose-100 text-rose-700"
														: "bg-white border border-indigo-100 text-indigo-600",
											)}
										>
											{stop}
										</span>
									</span>
								))}
							</div>
						)}

						{/* FCR Table */}
						{(expandedTrips[trip.tripNumber] ?? true) && (
							<div className="w-full bg-white rounded-lg border border-indigo-100 overflow-hidden min-h-24">
								{tripFcrs.length === 0 ? (
									<div className="h-24 flex items-center justify-center text-xs text-indigo-400/70 italic">
										Chưa có FCR nào trong chuyến này
									</div>
								) : (
									<div className="overflow-x-auto w-full">
										<FcrTable
											fcrs={tripFcrs}
											columnsOrder={columnsOrder}
											selectedFcrIds={selectedIds}
											onToggleSelection={(id, selected) => {
												setSelectedIds((prev) => {
													const next = new Set(prev);
													if (selected) next.add(id);
													else next.delete(id);
													return next;
												});
											}}
											onSelectAll={(checked, visibleIds) => {
												setSelectedIds((prev) => {
													const next = new Set(prev);
													visibleIds.forEach((id) => {
														if (checked) next.add(id);
														else next.delete(id);
													});
													return next;
												});
											}}
											allSelected={
												tripFcrs.length > 0 &&
												tripFcrs.every((f) => selectedIds.has(f.id))
											}
										/>
									</div>
								)}
							</div>
						)}
					</VendorDropZone>
				);
			})}

			<AddTruckDialog
				open={changeOpen}
				onOpenChange={setChangeOpen}
				date={date}
				allTrucks={allTrucks}
				allVendors={allVendors}
				mode="change"
				onConfirmChange={handleChangeTarget}
				loading={processing}
				excludeVendorName={slot.vendorName ?? undefined}
			/>
		</div>
	);
}
