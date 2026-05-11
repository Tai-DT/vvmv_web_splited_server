"use client";

import { useDraggable } from "@dnd-kit/core";
import { memo } from "react";
import { cn } from "@/lib/utils";
import type { FCRBoardItem } from "../types";
import type { OptionalFCRField } from "../use-fcr-fields-store";
import { useFCRFieldsStore } from "../use-fcr-fields-store";
import { FCRDetailPopover } from "./fcr-detail-popover";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const parts = raw.split("-");
	if (parts.length !== 3) return null;
	return `${parts[2]}/${parts[1]}`;
}

function fmtWeight(kg: number): string {
	return kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${kg}kg`;
}

function getShipperDisplayName(fcr: FCRBoardItem): string | null {
	const companyName = fcr.truckingFollowUp.companyName?.trim();
	if (companyName) return companyName;
	const shipper = fcr.shipper?.trim();
	return shipper || null;
}

// ── Card body ─────────────────────────────────────────────────────────────────

function CardBody({
	fcr,
	visibleFields,
}: {
	fcr: FCRBoardItem;
	visibleFields: OptionalFCRField[];
}) {
	const v = (f: OptionalFCRField) => visibleFields.includes(f);
	const isNhap = fcr.truckingFollowUp.operationType === "NHAP";
	const shipperDisplayName = getShipperDisplayName(fcr);
	const date = fmtDate(
		fcr.implementationDate ?? fcr.truckingFollowUp.implementationDate,
	);
	const fcrNote = fcr.notes?.trim();
	const jobNote = fcr.truckingFollowUp.note?.trim();

	return (
		<>
			{/* Row 1: N/X · service mode · FCR number (always visible) */}
			<div className="flex items-baseline gap-1">
				<span
					className={cn(
						"shrink-0 text-[10px] font-extrabold px-1 py-px rounded-sm leading-none",
						isNhap ? "bg-blue-500 text-white" : "bg-orange-500 text-white",
					)}
				>
					{isNhap ? "N" : "X"}
				</span>

				{fcr.truckingFollowUp.serviceMode && (
					<span className="shrink-0 text-[10px] bg-violet-100 text-violet-800 px-1 py-px rounded-sm font-semibold leading-none border border-violet-200">
						{fcr.truckingFollowUp.serviceMode}
					</span>
				)}

				{/* FCR number = trigger cho detail popover */}
				<span
					className="flex-1 min-w-max"
					onPointerDown={(e) => e.stopPropagation()}
				>
					<FCRDetailPopover
						fcr={fcr}
						trigger={
							<span className="block text-[11px]  text-blue-700 hover:text-blue-900 whitespace-nowrap leading-none cursor-pointer">
								{fcr.fcrNumber ?? "—"}
							</span>
						}
					/>
				</span>
			</div>

			{/* Row 2: date · weight · cbm · qty */}
			{(date ||
				fcr.grossWeight != null ||
				fcr.cbm != null ||
				fcr.quantity != null) && (
				<div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
					{date && (
						<span className="text-[10px] font-semibold text-rose-600 leading-none">
							{date}
						</span>
					)}
					{fcr.grossWeight != null && (
						<span className="text-[10px] font-semibold text-blue-700">
							{fmtWeight(fcr.grossWeight)}
						</span>
					)}
					{fcr.cbm != null && (
						<span className="text-[10px] font-semibold text-indigo-600">
							{fcr.cbm}cbm
						</span>
					)}
					{fcr.quantity != null && (
						<span className="text-[10px] font-semibold text-indigo-600">
							×{fcr.quantity}
						</span>
					)}
				</div>
			)}

			{/* Optional fields */}
			{v("jobNumber") && fcr.truckingFollowUp.jobNumber && (
				<p className="text-[10px] font-semibold text-slate-600 font-mono truncate leading-tight mt-0.5">
					{fcr.truckingFollowUp.jobNumber}
				</p>
			)}
			{v("billOrBooking") && fcr.truckingFollowUp.billOrBooking && (
				<p className="text-[10px] font-semibold text-amber-700 font-mono truncate leading-tight mt-0.5">
					{fcr.truckingFollowUp.billOrBooking}
				</p>
			)}
			{v("companyName") && fcr.truckingFollowUp.companyName && (
				<p className="text-[10px] text-emerald-700 font-bold truncate leading-tight mt-0.5">
					{fcr.truckingFollowUp.companyName}
				</p>
			)}
			{v("warehouse") && fcr.truckingFollowUp.warehouse && (
				<p className="text-[10px] font-semibold text-teal-700 truncate leading-tight mt-0.5">
					🏭 {fcr.truckingFollowUp.warehouse}
				</p>
			)}
			{v("route") && (fcr.pickupAt || fcr.deliveryAt) && (
				<div className="mt-0.5 rounded-sm border border-slate-200 bg-slate-50 px-1 py-0.5 space-y-0.5">
					<div className="flex items-center gap-1 min-w-0">
						<span className="shrink-0 text-[10px] font-bold text-emerald-700">
							Đi:
						</span>
						<span className="text-[10px] font-bold  text-slate-700 leading-tight truncate">
							{fcr.pickupAt ?? "?"}
						</span>
					</div>
					<div className="flex items-center gap-1 min-w-0">
						<span className="shrink-0 text-[10px] font-bold text-orange-600">
							Đến:
						</span>
						<span className="text-[10px] font-bold text-slate-700 leading-tight truncate">
							{fcr.deliveryAt ?? "?"}
						</span>
					</div>
				</div>
			)}
			{v("shipper") && shipperDisplayName && (
				<p className="text-[10px] font-semibold text-sky-700 truncate leading-tight mt-0.5">
					{shipperDisplayName}
				</p>
			)}
			{v("vendor") && fcr.vendor && (
				<p className="text-[10px] font-semibold text-purple-700 truncate leading-tight mt-0.5">
					{fcr.vendor}
				</p>
			)}
			{v("plateNumber") && fcr.plateNumber && (
				<p className="text-[10px] font-semibold text-slate-600 font-mono truncate leading-tight mt-0.5">
					{fcr.plateNumber}
				</p>
			)}
			{v("driver") && fcr.driver && (
				<p className="text-[10px] font-semibold text-slate-600 truncate leading-tight mt-0.5">
					{fcr.driver}
				</p>
			)}
			{v("notes") && (fcrNote || jobNote) && (
				<div className="mt-0.5 flex flex-wrap gap-1">
					{fcrNote && (
						<span className="max-w-full rounded-sm border border-sky-200 bg-sky-50 px-1 py-px text-[10px] font-medium italic leading-tight text-sky-800 truncate">
							FCR: {fcrNote}
						</span>
					)}
					{jobNote && (
						<span className="max-w-full rounded-sm border border-emerald-200 bg-emerald-50 px-1 py-px text-[10px] font-medium italic leading-tight text-emerald-800 truncate">
							Job: {jobNote}
						</span>
					)}
				</div>
			)}
		</>
	);
}

// ── FCRCard — draggable ───────────────────────────────────────────────────────

export const FCRCard = memo(function FCRCard({
	fcr,
	className,
}: {
	fcr: FCRBoardItem;
	className?: string;
}) {
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id: `fcr-${fcr.id}`,
		data: { fcrId: fcr.id },
	});
	const visibleFields = useFCRFieldsStore((s) => s.visibleFields);
	const isNhap = fcr.truckingFollowUp.operationType === "NHAP";

	return (
		<div
			ref={setNodeRef}
			{...listeners}
			{...attributes}
			className={cn(
				"relative flex flex-col rounded-md bg-white select-none shrink-0",
				"border-l-2 border border-slate-200/80 shadow-sm",
				"cursor-grab active:cursor-grabbing",
				"hover:border-slate-300 hover:shadow transition-all duration-100",
				isDragging && "opacity-25 ring-1 ring-blue-400",
				isNhap ? "border-l-blue-400" : "border-l-orange-400",
				className ?? "min-w-36 w-fit",
			)}
		>
			<div className="px-1.5 pt-0.5 pb-1">
				<CardBody fcr={fcr} visibleFields={visibleFields} />
			</div>
		</div>
	);
});

// ── FCRCardOverlay — for <DragOverlay> ───────────────────────────────────────

export function FCRCardOverlay({
	fcr,
	className,
}: {
	fcr: FCRBoardItem;
	className?: string;
}) {
	const visibleFields = useFCRFieldsStore((s) => s.visibleFields);
	const isNhap = fcr.truckingFollowUp.operationType === "NHAP";
	return (
		<div
			className={cn(
				"relative flex flex-col rounded-md bg-white select-none shrink-0",
				"border-l-2 border border-slate-300 shadow-2xl rotate-1 opacity-95",
				isNhap ? "border-l-blue-400" : "border-l-orange-400",
				className ?? "min-w-36 w-fit",
			)}
			style={{ willChange: "transform" }}
		>
			<div className="px-1.5 pt-0.5 pb-1">
				<CardBody fcr={fcr} visibleFields={visibleFields} />
			</div>
		</div>
	);
}
