"use client";

import { useDroppable } from "@dnd-kit/core";
import { Package, Truck, X } from "lucide-react";
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

function VendorDropZone({
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
				"border border-indigo-200 rounded-lg bg-gradient-to-br from-indigo-100 via-violet-100 to-indigo-200 text-indigo-900 shadow-sm cursor-pointer w-44 overflow-x-auto p-2",
				compact ? "min-h-20 h-auto" : "min-h-28 h-auto",
				"hover:from-indigo-50 hover:via-violet-50 hover:to-indigo-100 transition-all duration-150 select-none",
				isOver &&
					"ring-2 ring-violet-300 border-violet-300 from-indigo-50 via-violet-50 to-indigo-100",
			)}
		>
			{children}
		</div>
	);
}

function VendorFcrPopup({
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
		if (!window.confirm("Bỏ tất cả FCR khỏi nhà thầu này?")) return;
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
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
			onClick={() => {
				if (!changeOpen) onClose();
			}}
		>
			<div
				className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center gap-2 px-4 py-3 border-b bg-indigo-900 text-white rounded-t-xl">
					<span className="inline-flex items-center gap-1 rounded-full bg-white/15 border border-white/25 px-2 py-1 shrink-0">
						<Truck className="w-3.5 h-3.5" />
						<span className="w-1.5 h-1.5 rounded-sm bg-indigo-200/90" />
					</span>
					<span className="font-bold text-sm">{slot.vendorName}</span>
					<Button
						type="button"
						size="sm"
						variant="secondary"
						onClick={() => setChangeOpen(true)}
						disabled={
							processing || allFcrs.length === 0 || targets.length === 0
						}
						className="ml-auto h-7 text-[11px]"
					>
						Đổi xe/vendor
					</Button>
					<Button
						type="button"
						size="sm"
						variant="destructive"
						onClick={handleRemoveAll}
						disabled={processing || allFcrs.length === 0}
						className="h-7 text-[11px]"
					>
						Remove all FCR
					</Button>
					<Button
						type="button"
						size="sm"
						variant="default"
						onClick={handleCombineJobs}
						disabled={processing || allFcrs.length < 2}
						className="h-7 text-[11px]"
					>
						Combine Job File
					</Button>
					<span className="text-xs bg-indigo-700 px-2 py-0.5 rounded-full font-semibold">
						{allFcrs.length} FCR
					</span>
					<button
						type="button"
						onClick={onClose}
						className="ml-2 text-indigo-300 hover:text-white transition-colors"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				<div className="overflow-y-auto p-4 flex flex-col gap-4">
					{allFcrs.length === 0 ? (
						<p className="text-sm text-slate-400 italic text-center py-8">
							Chưa có FCR
						</p>
					) : (
						displayedTrips.map((trip) => (
							<div key={trip.tripNumber}>
								{displayedTrips.length > 1 && (
									<div className="flex items-center gap-1 mb-2">
										<Package className="w-3.5 h-3.5 text-slate-400" />
										<span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
											Lô {trip.tripNumber}
										</span>
									</div>
								)}
								<div className="flex flex-row flex-wrap gap-2">
									{trip.fcrs.map((fcr) => (
										<FCRCard key={fcr.id} fcr={fcr} />
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

export function VendorCard({
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

	return (
		<>
			{sortedTrips.map((trip) => {
				const tripFcrs = trip.fcrs;
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
					<VendorDropZone
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
						<div className="space-y-1">
							<div className="flex items-center gap-1.5">
								<span className="inline-flex items-center gap-1 rounded-full bg-white/80 border border-indigo-200 px-1.5 py-0.5 shrink-0 shadow-sm">
									<Truck className="w-3 h-3 text-indigo-600" />
									<span className="w-1.5 h-1.5 rounded-sm bg-indigo-300 border border-indigo-400" />
								</span>
								<span className="text-[10px] font-bold bg-white/70 border border-indigo-200 px-1.5 py-0.5 rounded shrink-0 text-indigo-700">
									Chuyến {trip.tripNumber}
								</span>
								{tripFcrs.length > 0 && (
									<span className="ml-auto text-[10px] font-bold bg-violet-200 text-violet-800 px-1.5 py-0.5 rounded-full shrink-0">
										{tripFcrs.length}
									</span>
								)}
							</div>
							{quickModes.length > 0 && (
								<div className="flex items-center gap-1 flex-wrap">
									{quickModes.map((mode) => (
										<span
											key={mode}
											className="text-[9px] font-bold uppercase rounded px-1.5 py-0.5 bg-indigo-100 text-indigo-700 border border-indigo-200"
										>
											{mode}
										</span>
									))}
								</div>
							)}
							<div className="text-sm font-bold tracking-wide break-all whitespace-normal leading-tight">
								{slot.vendorName}
							</div>
						</div>

						{showRoutes && stops.length > 0 && (
							<div className="flex flex-wrap items-center gap-1 mt-2">
								{stops.map((stop, i) => (
									<span key={stop} className="flex items-center gap-0.5">
										{i > 0 && (
											<span className="text-indigo-500 text-[9px]">→</span>
										)}
										<span
											className={`text-[10px] px-1 py-0.5 rounded ${
												i === 0
													? "bg-emerald-100 text-emerald-700 font-semibold"
													: i === stops.length - 1
														? "bg-rose-100 text-rose-700 font-semibold"
														: "text-indigo-500"
											}`}
										>
											{stop}
										</span>
									</span>
								))}
							</div>
						)}
					</VendorDropZone>
				);
			})}

			{popupOpen && (
				<VendorFcrPopup
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
