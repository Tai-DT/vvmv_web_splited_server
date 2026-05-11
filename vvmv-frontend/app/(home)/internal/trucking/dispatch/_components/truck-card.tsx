"use client";

import { useDroppable } from "@dnd-kit/core";
import { Truck, User, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TruckSlot } from "../types";
import { ChangeSlotDialog, type SlotTarget } from "./change-slot-dialog";
import { FCRCard } from "./fcr-card";

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
		<div className="mt-2 space-y-1">
			<div className="flex justify-between text-[9px] font-semibold text-slate-400">
				<span>{loadKg.toLocaleString()} kg</span>
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
	compact = false,
	children,
	onClick,
}: {
	truckingNumberId: string;
	date: string;
	tripNumber: number;
	compact?: boolean;
	children: React.ReactNode;
	onClick: () => void;
}) {
	const { setNodeRef, isOver } = useDroppable({
		id: `truck-${truckingNumberId}-${date}-${tripNumber}`,
		data: { type: "truck-slot", truckingNumberId, date, tripNumber },
	});

	return (
		<div
			ref={setNodeRef}
			onClick={onClick}
			className={cn(
				"border border-slate-200 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 text-slate-900 shadow-sm cursor-pointer w-44 overflow-x-auto p-2.5",
				compact ? "min-h-20 h-auto" : "min-h-28 h-auto",
				"hover:shadow-md hover:border-slate-300 transition-all select-none",
				isOver && "ring-2 ring-blue-400 bg-blue-50 border-blue-300",
			)}
		>
			{children}
		</div>
	);
}

function TruckFcrPopup({
	slot,
	date,
	activeTripNumber,
	targets,
	onMoveAll,
	onRemoveAll,
	onCombineJobs,
	onClose,
}: {
	slot: TruckSlot;
	date: string;
	activeTripNumber: number | null;
	targets: SlotTarget[];
	onMoveAll: (
		fcrIds: string[],
		targetTruckingNumberId: string,
		date: string,
	) => Promise<void>;
	onRemoveAll: (fcrIds: string[], date: string) => Promise<void>;
	onCombineJobs: (
		fcrs: TruckSlot["trips"][number]["fcrs"],
		truckingNumberId: string,
	) => Promise<void>;
	onClose: () => void;
}) {
	const [changeOpen, setChangeOpen] = useState(false);
	const [processing, setProcessing] = useState(false);
	const displayedTrips =
		activeTripNumber == null
			? slot.trips
			: slot.trips.filter((t) => t.tripNumber === activeTripNumber);
	const allFcrs = displayedTrips.flatMap((t) => t.fcrs);

	async function handleRemoveAll() {
		if (allFcrs.length === 0) return;
		if (!window.confirm("Bỏ tất cả FCR khỏi xe này?")) return;
		setProcessing(true);
		try {
			await onRemoveAll(
				allFcrs.map((f) => f.id),
				date,
			);
			onClose();
		} finally {
			setProcessing(false);
		}
	}

	async function handleChangeTarget(targetTruckingNumberId: string) {
		if (allFcrs.length === 0) return;
		setProcessing(true);
		try {
			await onMoveAll(
				allFcrs.map((f) => f.id),
				targetTruckingNumberId,
				date,
			);
			setChangeOpen(false);
			onClose();
		} finally {
			setProcessing(false);
		}
	}

	async function handleCombineJobs() {
		if (allFcrs.length < 2) return;
		setProcessing(true);
		try {
			await onCombineJobs(allFcrs, slot.truckingNumberId);
			onClose();
		} finally {
			setProcessing(false);
		}
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
			onClick={() => {
				if (!changeOpen) onClose();
			}}
		>
			<div
				className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-2xl">
					<div className="flex items-center gap-2 flex-1">
						<div className="inline-flex items-center gap-1 rounded-full bg-blue-100 border border-blue-200 px-2.5 py-1.5 shadow-sm">
							<Truck className="w-4.5 h-4.5 text-blue-600 shrink-0" />
							<span className="w-2 h-2 rounded-sm bg-blue-300 border border-blue-400" />
						</div>
						<div className="flex flex-col">
							<span className="font-bold text-lg text-slate-900">
								{slot.plateNumber}
							</span>
							{slot.driverName && (
								<div className="flex items-center gap-1.5 text-sm text-slate-600">
									<User className="w-3.5 h-3.5 text-slate-500" />
									<span>{slot.driverName}</span>
								</div>
							)}
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => setChangeOpen(true)}
							disabled={
								processing || allFcrs.length === 0 || targets.length === 0
							}
							className="h-8 text-xs"
						>
							Đổi xe/vendor
						</Button>
						<Button
							type="button"
							size="sm"
							variant="destructive"
							onClick={handleRemoveAll}
							disabled={processing || allFcrs.length === 0}
							className="h-8 text-xs"
						>
							Remove all FCR
						</Button>
						<Button
							type="button"
							size="sm"
							variant="default"
							onClick={handleCombineJobs}
							disabled={processing || allFcrs.length < 2}
							className="h-8 text-xs"
						>
							Combine Job File
						</Button>
						<span className="inline-block text-sm font-bold bg-blue-500 text-white px-3 py-1 rounded-full">
							{allFcrs.length} FCR
						</span>
						<button
							type="button"
							onClick={onClose}
							className="ml-2 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
						>
							<X className="w-5 h-5" />
						</button>
					</div>
				</div>

				{/* Content */}
				<div className="overflow-y-auto p-6 flex flex-col gap-6">
					{allFcrs.length === 0 ? (
						<p className="text-sm text-slate-400 italic text-center py-12">
							Chưa có FCR được gán
						</p>
					) : (
						displayedTrips.map((trip) => (
							<div key={trip.tripNumber} className="space-y-3">
								{displayedTrips.length > 1 && (
									<div className="flex items-center gap-2 mb-3">
										<div className="flex-1 h-0.5 bg-slate-200" />
										<span className="text-xs font-bold text-slate-500 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">
											Chuyến {trip.tripNumber}
										</span>
										<div className="flex-1 h-0.5 bg-slate-200" />
									</div>
								)}
								<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
									{trip.fcrs.map((fcr) => (
										<FCRCard key={fcr.id} fcr={fcr} className="w-full" />
									))}
								</div>
							</div>
						))
					)}
				</div>
			</div>

			<ChangeSlotDialog
				open={changeOpen}
				onOpenChange={setChangeOpen}
				targets={targets}
				loading={processing}
				onConfirm={handleChangeTarget}
			/>
		</div>
	);
}

export function TruckCard({
	slot,
	date,
	showRoutes = false,
	targets,
	onMoveAll,
	onRemoveAll,
	onCombineJobs,
}: {
	slot: TruckSlot;
	date: string;
	showRoutes?: boolean;
	targets: SlotTarget[];
	onMoveAll: (
		fcrIds: string[],
		targetTruckingNumberId: string,
		date: string,
	) => Promise<void>;
	onRemoveAll: (fcrIds: string[], date: string) => Promise<void>;
	onCombineJobs: (
		fcrs: TruckSlot["trips"][number]["fcrs"],
		truckingNumberId: string,
	) => Promise<void>;
}) {
	const [popupOpen, setPopupOpen] = useState(false);
	const [activeTripNumber, setActiveTripNumber] = useState<number | null>(null);
	const sortedTrips = [...slot.trips].sort(
		(a, b) => a.tripNumber - b.tripNumber,
	);
	const _allFcrs = sortedTrips.flatMap((t) => t.fcrs);
	const payloadKg = (slot.payloadTonnes ?? 0) * 1000;

	return (
		<>
			{sortedTrips.map((trip) => {
				const tripFcrs = trip.fcrs;
				const loadKg = tripFcrs.reduce(
					(sum, f) => sum + (f.grossWeight ?? 0),
					0,
				);
				const quickModes = getQuickServiceModes(tripFcrs);
				const compact = !showRoutes;
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
						compact={compact}
						onClick={() => {
							setActiveTripNumber(trip.tripNumber);
							setPopupOpen(true);
						}}
					>
						{/* Header: meta row + plate row */}
						<div className="mb-2 space-y-1">
							<div className="flex items-center gap-1">
								<span className="inline-flex items-center gap-1 rounded-full bg-blue-100 border border-blue-200 px-1.5 py-0.5 shadow-sm shrink-0">
									<Truck className="w-3.5 h-3.5 text-blue-600" />
									<span className="w-1.5 h-1.5 rounded-sm bg-blue-300 border border-blue-400" />
								</span>
								<span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md">
									Chuyến {trip.tripNumber}
								</span>
								{tripFcrs.length > 0 && (
									<span className="text-[11px] font-bold bg-blue-500 text-white px-2.5 py-0.5 rounded-full ml-auto">
										{tripFcrs.length}
									</span>
								)}
							</div>
							{quickModes.length > 0 && (
								<div className="flex items-center gap-1 flex-wrap">
									{quickModes.map((mode) => (
										<span
											key={mode}
											className="text-[9px] font-bold uppercase rounded px-1.5 py-0.5 bg-cyan-100 text-cyan-700 border border-cyan-200"
										>
											{mode}
										</span>
									))}
								</div>
							)}
							<div className="text-sm font-bold tracking-wider text-slate-900 break-all whitespace-normal leading-tight">
								{slot.plateNumber}
							</div>
						</div>

						{/* Driver + vehicle */}
						<div className="flex items-center gap-1.5 mb-1.5 text-sm">
							{slot.driverName && (
								<>
									<User className="w-3.5 h-3.5 text-slate-400" />
									<span className="text-slate-600 truncate text-xs">
										{slot.driverName}
									</span>
								</>
							)}
							{slot.vehicleType && (
								<span className="ml-auto text-[10px] font-medium bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md">
									{slot.vehicleType}
								</span>
							)}
						</div>

						{/* Weight bar */}
						{payloadKg > 0 && (
							<WeightBar loadKg={loadKg} payloadKg={payloadKg} />
						)}

						{/* Stops */}
						{showRoutes && stops.length > 0 && (
							<div className="flex flex-wrap items-center gap-1 mt-2">
								{stops.map((stop, i) => (
									<span key={stop} className="flex items-center gap-0.5">
										{i > 0 && (
											<span className="text-slate-300 text-[9px]">→</span>
										)}
										<span
											className={cn(
												"text-[9px] px-1.5 py-0.5 rounded font-semibold",
												i === 0
													? "bg-emerald-100 text-emerald-700"
													: i === stops.length - 1
														? "bg-rose-100 text-rose-700"
														: "bg-slate-100 text-slate-600",
											)}
										>
											{stop}
										</span>
									</span>
								))}
							</div>
						)}
					</TruckDropZone>
				);
			})}

			{popupOpen && (
				<TruckFcrPopup
					slot={slot}
					date={date}
					activeTripNumber={activeTripNumber}
					targets={targets}
					onMoveAll={onMoveAll}
					onRemoveAll={onRemoveAll}
					onCombineJobs={onCombineJobs}
					onClose={() => {
						setPopupOpen(false);
						setActiveTripNumber(null);
					}}
				/>
			)}
		</>
	);
}
