"use client";

import { Building2, Check, Search, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { BoardData, TruckSlot } from "../types";

interface AddTruckDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	date: string;
	allTrucks: BoardData["allTrucks"];
	allVendors: BoardData["allVendors"];
	existingSlots?: TruckSlot[];
	onConfirm?: (truckId: string, date: string, tripNumber: number) => void;
	onConfirmVendor?: (vendorId: string, date: string) => Promise<void> | void;
	// Shared props for Change mode
	mode?: "add" | "change";
	onConfirmChange?: (
		targetId: string,
		type: "truck" | "vendor",
	) => Promise<void> | void;
	excludeVendorName?: string;
	loading?: boolean;
}

export function AddTruckDialog({
	open,
	onOpenChange,
	date,
	allTrucks,
	allVendors,
	existingSlots = [],
	onConfirm,
	onConfirmVendor,
	mode = "add",
	onConfirmChange,
	excludeVendorName,
	loading = false,
}: AddTruckDialogProps) {
	const [tab, setTab] = useState<"vehicle" | "vendor">("vehicle");
	const [search, setSearch] = useState("");
	const [selectedTruckIds, setSelectedTruckIds] = useState<string[]>([]);
	const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
	const [submitting, setSubmitting] = useState(false);

	const totalSelected = selectedTruckIds.length + selectedVendorIds.length;

	function handleClose() {
		setSelectedTruckIds([]);
		setSelectedVendorIds([]);
		setSearch("");
		setSubmitting(false);
		onOpenChange(false);
	}

	async function handleConfirm() {
		if (totalSelected === 0 || submitting || loading) return;
		setSubmitting(true);
		try {
			if (mode === "change") {
				const id = selectedTruckIds[0] || selectedVendorIds[0];
				const type = selectedTruckIds.length > 0 ? "truck" : "vendor";
				await onConfirmChange?.(id, type);
			} else {
				for (const truckId of selectedTruckIds) {
					const existing = existingSlots.find(
						(s) => s.truckingNumberId === truckId,
					);
					const maxTrip = existing
						? Math.max(...existing.trips.map((t) => t.tripNumber), 0)
						: 0;
					onConfirm?.(truckId, date, maxTrip + 1);
				}

				await Promise.allSettled(
					selectedVendorIds.map((vendorId) =>
						onConfirmVendor?.(vendorId, date),
					),
				);
			}
		} finally {
			handleClose();
		}
	}

	function switchTab(next: "vehicle" | "vendor") {
		setTab(next);
		setSearch("");
	}

	function toggleTruck(truckId: string) {
		if (mode === "change") {
			setSelectedTruckIds([truckId]);
			setSelectedVendorIds([]);
			return;
		}
		setSelectedTruckIds((prev) =>
			prev.includes(truckId)
				? prev.filter((id) => id !== truckId)
				: [...prev, truckId],
		);
	}

	function toggleVendor(vendorId: string) {
		if (mode === "change") {
			setSelectedVendorIds([vendorId]);
			setSelectedTruckIds([]);
			return;
		}
		setSelectedVendorIds((prev) =>
			prev.includes(vendorId)
				? prev.filter((id) => id !== vendorId)
				: [...prev, vendorId],
		);
	}

	const filteredTrucks = useMemo(
		() =>
			allTrucks
				.filter((t) => !!t.plateNumber)
				.filter(
					(t) =>
						t.plateNumber.toLowerCase().includes(search.toLowerCase()) ||
						(t.driverName ?? "").toLowerCase().includes(search.toLowerCase()) ||
						(t.vendorName ?? "").toLowerCase().includes(search.toLowerCase()),
				),
		[allTrucks, search],
	);

	const filteredVendors = useMemo(
		() =>
			allVendors
				.filter((v) => !excludeVendorName || v.name !== excludeVendorName)
				.filter((v) => v.name.toLowerCase().includes(search.toLowerCase())),
		[allVendors, search, excludeVendorName],
	);

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						{mode === "add" ? "Thêm xe / nhà thầu" : "Đổi xe / nhà thầu"} —{" "}
						{date}
					</DialogTitle>
					<DialogDescription>
						{mode === "add"
							? "Có thể chọn nhiều xe và nhiều nhà thầu trong một lần thêm"
							: "Chọn một xe hoặc nhà thầu để chuyển các lô hàng sang"}
					</DialogDescription>
				</DialogHeader>

				{/* Tabs */}
				<div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
					<button
						type="button"
						onClick={() => switchTab("vehicle")}
						className={cn(
							"flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all",
							tab === "vehicle"
								? "bg-white shadow-sm text-slate-800"
								: "text-slate-500 hover:text-slate-700",
						)}
					>
						<Truck className="w-3.5 h-3.5" />
						Xe
					</button>
					<button
						type="button"
						onClick={() => switchTab("vendor")}
						className={cn(
							"flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all",
							tab === "vendor"
								? "bg-white shadow-sm text-slate-800"
								: "text-slate-500 hover:text-slate-700",
						)}
					>
						<Building2 className="w-3.5 h-3.5" />
						Nhà thầu
					</button>
				</div>

				<div className="relative">
					<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
					<Input
						className="pl-8 h-8 text-sm"
						placeholder={
							tab === "vehicle"
								? "Tìm biển số, tài xế hoặc nhà thầu..."
								: "Tìm nhà thầu..."
						}
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</div>

				<div className="space-y-1 max-h-60 overflow-y-auto">
					{tab === "vehicle" ? (
						<>
							{filteredTrucks.map((truck) => (
								<button
									key={truck.id}
									type="button"
									onClick={() => toggleTruck(truck.id)}
									className={cn(
										"w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all",
										selectedTruckIds.includes(truck.id)
											? "bg-blue-50 border-blue-300 ring-2 ring-blue-200"
											: "hover:bg-slate-50 border-transparent",
									)}
								>
									<span
										className={cn(
											"h-4 w-4 shrink-0 rounded-sm border flex items-center justify-center",
											selectedTruckIds.includes(truck.id)
												? "border-blue-500 bg-blue-500 text-white"
												: "border-slate-300 bg-white",
										)}
									>
										{selectedTruckIds.includes(truck.id) && (
											<Check className="w-3 h-3" />
										)}
									</span>
									<Truck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
									<span className="text-sm font-bold text-slate-800">
										{truck.plateNumber}
									</span>
									{(truck.driverName || truck.vendorName) && (
										<span className="text-xs text-slate-500 truncate">
											— {truck.driverName}
											{truck.vendorName && (
												<span className="text-slate-400 italic ml-1">
													({truck.vendorName})
												</span>
											)}
										</span>
									)}
									{truck.vehicleType && (
										<span className="ml-auto text-xs text-slate-400 shrink-0">
											{truck.vehicleType}
										</span>
									)}
								</button>
							))}
							{filteredTrucks.length === 0 && (
								<p className="text-xs text-slate-400 text-center py-4">
									Không tìm thấy xe
								</p>
							)}
						</>
					) : (
						<>
							{filteredVendors.map((vendor) => (
								<button
									key={vendor.id}
									type="button"
									onClick={() => toggleVendor(vendor.id)}
									className={cn(
										"w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all",
										selectedVendorIds.includes(vendor.id)
											? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200"
											: "hover:bg-slate-50 border-transparent",
									)}
								>
									<span
										className={cn(
											"h-4 w-4 shrink-0 rounded-sm border flex items-center justify-center",
											selectedVendorIds.includes(vendor.id)
												? "border-indigo-500 bg-indigo-500 text-white"
												: "border-slate-300 bg-white",
										)}
									>
										{selectedVendorIds.includes(vendor.id) && (
											<Check className="w-3 h-3" />
										)}
									</span>
									<Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
									<span className="text-sm font-medium text-slate-800">
										{vendor.name}
									</span>
								</button>
							))}
							{filteredVendors.length === 0 && (
								<p className="text-xs text-slate-400 text-center py-4">
									Không tìm thấy nhà thầu
								</p>
							)}
						</>
					)}
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						size="sm"
						onClick={handleClose}
						disabled={submitting}
					>
						Hủy
					</Button>
					<Button
						size="sm"
						disabled={totalSelected === 0 || submitting || loading}
						onClick={handleConfirm}
					>
						{submitting || loading
							? "Đang xử lý..."
							: mode === "add"
								? `Thêm đã chọn (${totalSelected})`
								: "Xác nhận đổi"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
