"use client";

import { Info } from "lucide-react";
import {
	Popover,
	PopoverContent,
	PopoverPositioner,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { FCRBoardItem } from "../types";

interface FCRDetailPopoverProps {
	fcr: FCRBoardItem;
	/** Custom trigger element. If omitted, renders the default ⓘ icon. */
	trigger?: React.ReactNode;
}

function DetailRow({
	label,
	value,
}: {
	label: string;
	value: React.ReactNode;
}) {
	if (!value && value !== 0) return null;
	return (
		<div className="flex gap-2">
			<span className="text-xs text-slate-500 w-28 shrink-0">{label}</span>
			<span className="text-xs text-slate-800 font-medium">{value}</span>
		</div>
	);
}

function getShipperDisplayName(fcr: FCRBoardItem): string | null {
	const companyName = fcr.truckingFollowUp.companyName?.trim();
	if (companyName) return companyName;
	const shipper = fcr.shipper?.trim();
	return shipper || null;
}

export function FCRDetailPopover({ fcr, trigger }: FCRDetailPopoverProps) {
	const shipperDisplayName = getShipperDisplayName(fcr);
	const fcrNote = fcr.notes?.trim();
	const jobNote = fcr.truckingFollowUp.note?.trim();

	return (
		<Popover>
			<PopoverTrigger
				className={
					trigger
						? "hover:opacity-70 transition-opacity"
						: "p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
				}
			>
				{trigger ?? <Info className="w-3.5 h-3.5" />}
			</PopoverTrigger>
			<PopoverPositioner side="right" sideOffset={6}>
				<PopoverContent className="w-72 p-3 space-y-1.5">
					<p className="text-xs font-bold text-slate-700 border-b pb-1.5 mb-2">
						{fcr.fcrNumber ?? "FCR"} — {fcr.truckingFollowUp.jobNumber}
					</p>
					<DetailRow label="Công ty" value={fcr.truckingFollowUp.companyName} />
					<DetailRow
						label="Xuất/Nhập"
						value={
							fcr.truckingFollowUp.operationType === "NHAP"
								? "Nhập"
								: fcr.truckingFollowUp.operationType === "XUAT"
									? "Xuất"
									: null
						}
					/>
					<DetailRow
						label="Bill/Booking"
						value={fcr.truckingFollowUp.billOrBooking}
					/>
					<DetailRow
						label="Service Mode"
						value={fcr.truckingFollowUp.serviceMode}
					/>
					<DetailRow label="Kho" value={fcr.truckingFollowUp.warehouse} />
					<DetailRow label="Shipper" value={shipperDisplayName} />
					<DetailRow label="Vendor" value={fcr.vendor} />
					<DetailRow label="Pickup" value={fcr.pickupAt} />
					<DetailRow label="Delivery" value={fcr.deliveryAt} />
					<DetailRow
						label="Gross weight"
						value={
							fcr.grossWeight != null
								? `${fcr.grossWeight.toLocaleString()} kg`
								: null
						}
					/>
					<DetailRow label="CBM" value={fcr.cbm} />
					<DetailRow label="Số lượng" value={fcr.quantity} />
					<DetailRow label="Ngày thực hiện" value={fcr.implementationDate} />
					<DetailRow label="Ghi chú job" value={jobNote} />
					{fcrNote && (
						<div className="pt-1 border-t">
							<p className="text-[11px] text-slate-500 italic">
								Ghi chú FCR: {fcrNote}
							</p>
						</div>
					)}
				</PopoverContent>
			</PopoverPositioner>
		</Popover>
	);
}
