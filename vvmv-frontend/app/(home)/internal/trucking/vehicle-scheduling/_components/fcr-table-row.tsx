"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo } from "react";
import { cn } from "@/lib/utils";
import type { FCRBoardItem } from "../types";
import { useFCRFieldsStore } from "../use-fcr-fields-store";
import { FCRDetailPopover } from "./fcr-detail-popover";

// Helper functions (could be extracted)
function fmtDate(raw: string | Date | null | undefined): string | null {
	if (!raw) return null;
	const s = typeof raw === "string" ? raw : raw.toISOString();
	const parts = s.split("-");
	if (parts.length !== 3) return null;
	return `${parts[2].substring(0, 2)}/${parts[1]}`;
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

export const FcrTableRow = memo(function FcrTableRow({
	fcr,
	columnsOrder,
	isSelected,
	onToggleSelection,
	index,
	columnDate,
}: {
	fcr: FCRBoardItem;
	columnsOrder: string[];
	isSelected: boolean;
	onToggleSelection: (id: string, selected: boolean) => void;
	index?: number;
	columnDate?: string;
}) {
	const columnWidths = useFCRFieldsStore((s) => s.columnWidths);

	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: `fcr-${fcr.id}`,
		data: { fcrId: fcr.id, type: "fcr", columnDate },
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	const isNhap = fcr.truckingFollowUp.operationType === "NHAP";
	const date = fmtDate(
		fcr.implementationDate ?? fcr.truckingFollowUp.implementationDate,
	);
	const shipperDisplayName = getShipperDisplayName(fcr);
	const fcrNote = fcr.notes?.trim();
	const jobNote = fcr.truckingFollowUp.note?.trim();

	// Cell Renderer based on column key
	const renderCell = (colKey: string) => {
		const width = columnWidths[colKey] || 150;
		const cellStyle = { width: `${width}px`, maxWidth: `${width}px` };

		switch (colKey) {
			case "type":
				return (
					<span
						className={cn(
							"text-[10px] font-extrabold px-1.5 py-0.5 rounded-sm leading-none",
							isNhap ? "bg-blue-500 text-white" : "bg-orange-500 text-white",
						)}
					>
						{isNhap ? "N" : "X"}
					</span>
				);
			case "serviceMode":
				return fcr.truckingFollowUp.serviceMode ? (
					<span className="text-[10px] bg-violet-100 text-violet-800 px-1 py-px rounded-sm font-semibold leading-none border border-violet-200">
						{fcr.truckingFollowUp.serviceMode}
					</span>
				) : null;
			case "fcrNumber":
				return (
					<div
						onPointerDown={(e) => e.stopPropagation()}
						className="truncate"
						style={cellStyle}
					>
						<FCRDetailPopover
							fcr={fcr}
							trigger={
								<span className="text-xs text-blue-700 hover:text-blue-900 font-semibold cursor-pointer">
									{fcr.fcrNumber ?? "—"}
								</span>
							}
						/>
					</div>
				);
			case "date":
				return (
					<span className="text-xs text-rose-600 font-medium whitespace-nowrap">
						{date}
					</span>
				);
			case "weight":
				return fcr.grossWeight != null ? (
					<span className="text-xs font-semibold text-blue-700">
						{fmtWeight(fcr.grossWeight)}
					</span>
				) : null;
			case "cbm":
				return fcr.cbm != null ? (
					<span className="text-xs text-indigo-600 font-medium">
						{fcr.cbm}cbm
					</span>
				) : null;
			case "qty":
				return fcr.quantity != null ? (
					<span className="text-xs font-medium">×{fcr.quantity}</span>
				) : null;
			case "jobNumber":
				return (
					<span
						className="text-xs font-mono text-slate-600 truncate block"
						style={cellStyle}
					>
						{fcr.truckingFollowUp.jobNumber}
					</span>
				);
			case "billOrBooking":
				return (
					<span
						className="text-xs font-mono text-amber-700 truncate block"
						style={cellStyle}
					>
						{fcr.truckingFollowUp.billOrBooking}
					</span>
				);
			case "companyName":
				return (
					<span
						className="text-xs text-emerald-700 font-bold truncate block"
						style={cellStyle}
						title={fcr.truckingFollowUp.companyName ?? ""}
					>
						{fcr.truckingFollowUp.companyName}
					</span>
				);
			case "warehouse":
				return fcr.truckingFollowUp.warehouse ? (
					<span
						className="text-[10px] text-teal-700 font-semibold truncate block"
						style={cellStyle}
					>
						🏭 {fcr.truckingFollowUp.warehouse}
					</span>
				) : null;
			case "route":
				if (!fcr.pickupAt && !fcr.deliveryAt) return null;
				return (
					<div className="flex flex-col gap-0.5 text-[10px]" style={cellStyle}>
						{fcr.pickupAt && (
							<span className="text-emerald-700 truncate" title={fcr.pickupAt}>
								Đi: {fcr.pickupAt}
							</span>
						)}
						{fcr.deliveryAt && (
							<span className="text-orange-600 truncate" title={fcr.deliveryAt}>
								Đến: {fcr.deliveryAt}
							</span>
						)}
					</div>
				);
			case "shipper":
				return (
					<span
						className="text-[10px] text-sky-700 truncate block"
						style={cellStyle}
					>
						{shipperDisplayName}
					</span>
				);
			case "vendor":
				return (
					<span
						className="text-[10px] text-purple-700 font-semibold truncate block"
						style={cellStyle}
					>
						{fcr.vendor}
					</span>
				);
			case "plateNumber":
				return (
					<span
						className="text-xs font-mono text-slate-600 truncate block"
						style={cellStyle}
					>
						{fcr.plateNumber}
					</span>
				);
			case "driver":
				return (
					<span
						className="text-xs text-slate-600 truncate block"
						style={cellStyle}
					>
						{fcr.driver}
					</span>
				);
			case "truckType":
				return (
					<span
						className="text-[10px] text-slate-600 truncate block"
						style={cellStyle}
					>
						{fcr.truckType}
					</span>
				);
			case "containerNumber":
				return (
					<span
						className="text-xs font-mono text-indigo-700 truncate block"
						style={cellStyle}
					>
						{fcr.containerNo}
					</span>
				);
			case "routineDetail":
				return (
					<span
						className="text-[10px] text-slate-600 italic whitespace-pre-wrap line-clamp-2"
						style={cellStyle}
						title={fcr.truckingFollowUp.routineDetail ?? ""}
					>
						{fcr.truckingFollowUp.routineDetail}
					</span>
				);
			case "pickUpTime":
				return fcr.truckingFollowUp.pickUpTime ? (
					<span className="text-xs text-blue-800 font-bold" style={cellStyle}>
						⏰ {fcr.truckingFollowUp.pickUpTime}
					</span>
				) : null;
			case "pickupAt":
				return fcr.pickupAt ? (
					<span
						className="text-[10px] text-emerald-700 font-medium truncate block"
						style={cellStyle}
						title={fcr.pickupAt}
					>
						📍 {fcr.pickupAt}
					</span>
				) : null;
			case "deliveryAt":
				return fcr.deliveryAt ? (
					<span
						className="text-[10px] text-orange-600 font-medium truncate block"
						style={cellStyle}
						title={fcr.deliveryAt}
					>
						🏁 {fcr.deliveryAt}
					</span>
				) : null;
			case "notes":
				return (
					<div className="flex flex-col gap-0.5" style={cellStyle}>
						{fcrNote && (
							<span
								className="text-[10px] italic text-sky-800 bg-sky-50 px-1 rounded truncate"
								title={fcrNote}
							>
								FCR: {fcrNote}
							</span>
						)}
						{jobNote && (
							<span
								className="text-[10px] italic text-emerald-800 bg-emerald-50 px-1 rounded truncate"
								title={jobNote}
							>
								Job: {jobNote}
							</span>
						)}
					</div>
				);
			default:
				return null;
		}
	};

	return (
		<tr
			ref={setNodeRef}
			style={style}
			className={cn(
				"group border-b border-slate-100 hover:bg-slate-50 transition-colors",
				isDragging && "opacity-50 bg-slate-100 z-10 box-shadow-md",
				isSelected && "bg-blue-50/50 hover:bg-blue-50",
			)}
		>
			<td className="p-2 w-8 align-middle text-center overflow-hidden border-r border-slate-100">
				<input
					type="checkbox"
					checked={isSelected}
					onChange={(e) => onToggleSelection(fcr.id, e.target.checked)}
					className="cursor-pointer"
				/>
			</td>
			<td
				{...attributes}
				{...listeners}
				className={cn(
					"p-2 w-8 cursor-grab active:cursor-grabbing align-middle overflow-hidden border-r border-slate-100",
					fcr.hasAllMvUrls
						? "bg-orange-500 text-white"
						: "text-slate-300 hover:text-slate-500",
				)}
			>
				<div className="flex flex-col gap-0.5 justify-center mt-1">
					<span className="w-4 h-0.5 bg-current rounded-full" />
					<span className="w-4 h-0.5 bg-current rounded-full" />
					<span className="w-4 h-0.5 bg-current rounded-full" />
				</div>
			</td>
			{columnsOrder.map((colKey) => (
				<td
					key={colKey}
					className="p-2 align-middle overflow-hidden border-r border-slate-100"
					style={{
						width: `${columnWidths[colKey] || 150}px`,
						minWidth: `${columnWidths[colKey] || 150}px`,
					}}
				>
					{renderCell(colKey)}
				</td>
			))}
			<td className="w-auto" />
		</tr>
	);
});
