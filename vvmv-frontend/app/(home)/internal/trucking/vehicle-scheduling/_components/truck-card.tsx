"use client";

import { useDroppable } from "@dnd-kit/core";
import {
	ChevronDown,
	ChevronRight,
	Mail,
	Route,
	Truck,
	User,
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

function WeightBar({
	loadKg,
	payloadKg,
}: {
	loadKg: number;
	payloadKg: number;
}) {
	if (!payloadKg) return null;
	const pct = Math.min((loadKg / payloadKg) * 100, 100);
	const barColor =
		pct >= 90
			? "bg-red-500"
			: pct >= 70
				? "bg-amber-400"
				: pct >= 50
					? "bg-emerald-500"
					: "bg-slate-400";

	return (
		<div className="mt-1 space-y-1 w-48">
			<div className="flex justify-between text-[9px] font-semibold text-slate-400">
				<span>
					{loadKg.toLocaleString()} / {payloadKg.toLocaleString()} kg
				</span>
				<span>{pct.toFixed(0)}%</span>
			</div>
			<div className="h-1.5 bg-slate-200 rounded-full overflow-hidden shadow-sm">
				<div
					className={cn("h-full rounded-full transition-all", barColor)}
					style={{ width: `${pct}%` }}
				/>
			</div>
		</div>
	);
}

function TruckDropZone({
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
				"border border-slate-200 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 text-slate-900 shadow-sm w-full p-3 transition-all",
				isOver && "ring-2 ring-blue-400 bg-blue-50 border-blue-300",
			)}
		>
			{children}
		</div>
	);
}

export function TruckCard({
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
	const payloadKg = (slot.payloadTonnes ?? 0) * 1000;

	async function handleRemoveAll() {
		if (allFcrs.length === 0) return;
		if (!window.confirm("Bỏ tất cả FCR khỏi xe này?")) return;
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
				const loadKg = tripFcrs.reduce(
					(sum, f) => sum + (f.grossWeight ?? 0),
					0,
				);
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
					<TruckDropZone
						key={`${slot.truckingNumberId}-${trip.tripNumber}`}
						truckingNumberId={slot.truckingNumberId}
						date={date}
						tripNumber={trip.tripNumber}
					>
						{/* Header: plate row + meta content */}
						<div className="flex flex-col xl:flex-row xl:items-start gap-4 mb-3">
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
											title="Xoá slot xe này"
										>
											<X className="w-4 h-4" />
										</Button>
									)}
									<span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 border border-blue-200 px-2 py-0.5 shadow-sm shrink-0">
										<Truck className="w-4 h-4 text-blue-600" />
										<span className="w-1.5 h-1.5 rounded-sm bg-blue-300 border border-blue-400" />
									</span>
									<span className="text-sm font-bold bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-md">
										Chuyến {trip.tripNumber}
									</span>
									<span className="text-base font-bold tracking-wider text-slate-900 break-all">
										{slot.plateNumber}
									</span>
									{quickModes.length > 0 && (
										<div className="flex items-center gap-1 ml-1">
											{quickModes.map((mode) => (
												<span
													key={mode}
													className="text-[10px] font-bold uppercase rounded px-1.5 py-0.5 bg-cyan-100 text-cyan-700 border border-cyan-200"
												>
													{mode}
												</span>
											))}
										</div>
									)}
									{tripFcrs.length > 0 && (
										<span className="text-[10px] font-bold rounded px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 ml-1">
											{tripFcrs.length} FCR
										</span>
									)}
								</div>

								<div className="flex flex-wrap items-center gap-3 text-xs">
									{slot.driverName && (
										<span className="flex items-center gap-1.5 text-slate-600">
											<User className="w-3.5 h-3.5 text-slate-400" />
											<span className="font-medium">{slot.driverName}</span>
										</span>
									)}
									{slot.vehicleType && (
										<span className="font-medium bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md">
											{slot.vehicleType}
										</span>
									)}
								</div>
								{payloadKg > 0 && (
									<WeightBar loadKg={loadKg} payloadKg={payloadKg} />
								)}
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
									className="h-7 text-[11px] px-2"
								>
									Đổi xe
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
									className="h-7 text-[11px] px-2"
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
										"h-7 w-7 text-blue-600 border-blue-200 hover:bg-blue-50",
										mailingTrip === trip.tripNumber && "animate-pulse",
									)}
									title="Gửi mail lịch vận chuyển cho chuyến này"
								>
									<Mail className="w-3.5 h-3.5" />
								</Button>
							</div>
						</div>

						{/* Routes */}
						{showRoutes && stops.length > 0 && (
							<div className="mb-3 px-1 py-2 bg-slate-100 border border-slate-200 rounded flex flex-wrap items-center gap-1">
								<Route className="w-3 h-3 text-slate-400 mr-1" />
								{stops.map((stop, i) => (
									<span key={stop} className="flex items-center gap-0.5">
										{i > 0 && (
											<span className="text-slate-300 text-[10px] mx-0.5">
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
														: "bg-white border border-slate-200 text-slate-600",
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
							<div className="w-full bg-white rounded-lg border border-slate-200 overflow-hidden min-h-24">
								{tripFcrs.length === 0 ? (
									<div className="h-24 flex items-center justify-center text-xs text-slate-400 italic">
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
					</TruckDropZone>
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
			/>
		</div>
	);
}
