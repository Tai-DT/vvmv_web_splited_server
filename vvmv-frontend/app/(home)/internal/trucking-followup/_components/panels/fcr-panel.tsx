"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
	ArrowDownToLine,
	ArrowLeftRight,
	FileText,
	Plus,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { WarehouseInlineCell } from "@/components/shared/warehouse-inline-cell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAirports } from "@/hooks/use-airports";
import { useOps } from "@/hooks/use-ops";
import { usePartners } from "@/hooks/use-partners";
import { useTruckTypes } from "@/hooks/use-truck-types";
import { useVehicles } from "@/hooks/use-vehicles";
import { useVendors } from "@/hooks/use-vendor";
import { cn } from "@/lib/utils";
import { CompanyBadge } from "../../../followup/_components/shared/company-badge";
import { PartnerCombobox } from "../../../followup/_components/shared/partner-combobox";
import { VirtualizedCombobox } from "../../../followup/_components/shared/virtualized-combobox";
import type { ContainerRow } from "../../../followup/types";
import type { FCRRow } from "../../types";
import { FCR_LABELS } from "../table/column-labels";

interface FCRPanelProps {
	truckingId: string;
	fcrs: FCRRow[];
	containers?: ContainerRow[];
	isFinished?: boolean;
	truckingRow?: import("../../types").TruckingFollowUpRow;
}

interface EditableFCRCellProps {
	fcrId: string;
	field: string;
	initialValue: string | number | null | undefined;
	type?: "text" | "number" | "integer" | "date";
	multiline?: boolean;
	containerOptions?: { id: string; name: string }[];
	readOnly?: boolean;
	onPlateChange?: (plateNumber: string) => void;
	taxCode?: string | null;
	opsOptions?: string[];
}

function EditableFCRCell({
	fcrId,
	field,
	initialValue,
	type = "text",
	multiline = false,
	containerOptions = [],
	readOnly = false,
	onPlateChange,
	taxCode,
	opsOptions = [],
}: EditableFCRCellProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [value, setValue] = useState<string>(
		initialValue !== null && initialValue !== undefined
			? String(initialValue)
			: "",
	);
	const [isUpdating, setIsUpdating] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const queryClient = useQueryClient();
	const { partners } = usePartners();
	const { vehicles, isLoading: isLoadingVehicles } = useVehicles();
	const { truckTypes, isLoading: isLoadingTruckTypes } = useTruckTypes();
	const { vendors, isLoading: isLoadingVendors } = useVendors();
	const { airports, isLoading: isLoadingAirports } = useAirports();

	// Date formatting helpers
	const toInputFormat = (val: string | null | undefined): string => {
		if (!val) return "";
		try {
			const date = new Date(val);
			if (Number.isNaN(date.getTime())) return "";
			return date.toISOString().split("T")[0];
		} catch {
			return "";
		}
	};

	const toDisplayFormat = (val: string | null | undefined): string => {
		if (!val) return "";
		try {
			const date = new Date(val);
			if (Number.isNaN(date.getTime())) return "";
			return date.toLocaleDateString("vi-VN");
		} catch {
			return "";
		}
	};

	const displayVal =
		type === "date" ? toInputFormat(initialValue as string) : initialValue;

	useEffect(() => {
		setValue(
			displayVal !== null && displayVal !== undefined ? String(displayVal) : "",
		);
	}, [displayVal]);

	const handleSave = async (overrideValue?: string) => {
		const valueToSave = overrideValue !== undefined ? overrideValue : value;
		const currentInitial =
			initialValue !== null && initialValue !== undefined
				? String(initialValue)
				: "";

		if (valueToSave === currentInitial || isUpdating) {
			setIsEditing(false);
			return;
		}

		setIsUpdating(true);
		try {
			const formattedValue =
				type === "number"
					? parseFloat(valueToSave)
					: type === "integer"
						? parseInt(valueToSave, 10)
						: type === "date" && valueToSave
							? new Date(valueToSave).toISOString()
							: valueToSave;

			const sendValue =
				type === "number" || type === "integer"
					? Number.isNaN(formattedValue as number)
						? null
						: formattedValue
					: valueToSave || null;

			const response = await fetch("/api/trucking-followup/fcr/update", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: fcrId,
					field,
					value: sendValue,
				}),
			});

			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.message || "Failed to update");
			}

			toast.success("Updated FCR successfully");
			queryClient.invalidateQueries({ queryKey: ["trucking-followups"] });
			queryClient.invalidateQueries({ queryKey: ["dispatch-board"] });
			setIsEditing(false);
		} catch (error) {
			console.error("FCR update error:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to update FCR",
			);
			setValue(currentInitial);
		} finally {
			setIsUpdating(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (multiline) {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				handleSave();
			} else if (e.key === "Escape") {
				setValue(
					initialValue !== null && initialValue !== undefined
						? String(initialValue)
						: "",
				);
				setIsEditing(false);
			}
		} else {
			if (e.key === "Enter") {
				handleSave();
			} else if (e.key === "Escape") {
				setValue(
					initialValue !== null && initialValue !== undefined
						? String(initialValue)
						: "",
				);
				setIsEditing(false);
			}
		}
	};

	const handleChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
	) => {
		const newValue = e.target.value;
		if (type === "number") {
			if (newValue === "" || /^\d*\.?\d*$/.test(newValue)) {
				setValue(newValue);
			}
		} else if (type === "integer") {
			if (newValue === "" || /^\d*$/.test(newValue)) {
				setValue(newValue);
			}
		} else {
			setValue(newValue);
		}
	};

	if (isEditing) {
		if (multiline) {
			return (
				<Textarea
					ref={textareaRef}
					autoFocus
					value={value}
					onChange={handleChange}
					onBlur={() => handleSave()}
					onKeyDown={handleKeyDown}
					className="text-xs px-1 w-full -mx-1 min-h-[60px]"
					disabled={isUpdating}
					placeholder="Ctrl+Enter to save"
				/>
			);
		}

		if (field === "plateNumber") {
			const vehicleItems = vehicles.map((v) => ({ id: v, name: v }));
			return (
				<div className="w-full">
					<VirtualizedCombobox
						items={vehicleItems}
						value={value}
						onChange={(val) => {
							setValue(val);
							handleSave(val);
							if (val && onPlateChange) onPlateChange(val);
						}}
						onBlur={() => !isUpdating && setIsEditing(false)}
						autoFocus
						className="w-full"
						triggerClassName="h-7 text-xs px-1"
						placeholder={isLoadingVehicles ? "Loading..." : "Plate..."}
						searchPlaceholder="Search plate..."
						showClearOption={true}
					/>
				</div>
			);
		}

		if (field === "tType" || field === "tTypeC" || field === "truckType") {
			const typeItems = truckTypes.map((t) => ({ id: t, name: t }));
			return (
				<div className="w-full">
					<VirtualizedCombobox
						items={typeItems}
						value={value}
						onChange={(val) => {
							setValue(val);
							handleSave(val);
						}}
						onBlur={() => !isUpdating && setIsEditing(false)}
						autoFocus
						className="w-full"
						triggerClassName="h-7 text-xs px-1"
						placeholder={isLoadingTruckTypes ? "Loading..." : "Type..."}
						searchPlaceholder="Search type..."
						showClearOption={true}
					/>
				</div>
			);
		}

		if (field === "shipper") {
			return (
				<div className="w-full max-w-full min-w-0">
					<PartnerCombobox
						value={value}
						onChange={(val) => {
							setValue(val);
							handleSave(val);
						}}
						onBlur={() => !isUpdating && setIsEditing(false)}
						autoFocus
						displayValue="name"
						className="w-full max-w-full"
						triggerClassName="h-7 text-xs px-1 w-full max-w-full truncate"
					/>
				</div>
			);
		}

		if (field === "vendor") {
			const vendorItems = vendors.map((v) => ({ id: v, name: v }));
			return (
				<div className="w-full">
					<VirtualizedCombobox
						items={vendorItems}
						value={value}
						onChange={(val) => {
							setValue(val);
							handleSave(val);
						}}
						onBlur={() => !isUpdating && setIsEditing(false)}
						autoFocus
						className="w-full"
						triggerClassName="h-7 text-xs px-1"
						placeholder={isLoadingVendors ? "Loading..." : "Vendor..."}
						searchPlaceholder="Search vendor..."
						showClearOption={true}
					/>
				</div>
			);
		}

		if (field === "pickupAt" || field === "deliveryAt") {
			const airportItems = airports.filter((a) => a.id !== "");
			const selectedAirport = airportItems.find(
				(a) => a.id === value || a.name === value,
			);
			return (
				<div className="w-full">
					<VirtualizedCombobox
						items={airportItems}
						value={selectedAirport?.id ?? ""}
						onChange={(val) => {
							const airport = airportItems.find((a) => a.id === val);
							const saveValue = airport?.name ?? val;
							setValue(saveValue);
							handleSave(saveValue);
						}}
						onBlur={() => !isUpdating && setIsEditing(false)}
						autoFocus
						className="w-full max-w-full"
						triggerClassName="h-7 text-xs px-1 w-full max-w-full truncate"
						placeholder={
							isLoadingAirports
								? "Loading..."
								: field === "pickupAt"
									? "Pickup..."
									: "Delivery..."
						}
						searchPlaceholder="Search..."
						showClearOption={true}
					/>
				</div>
			);
		}

		if (field === "ops") {
			const opsItems = opsOptions.map((v) => ({ id: v, name: v }));
			return (
				<div className="w-full">
					<VirtualizedCombobox
						items={opsItems}
						value={value}
						onChange={(val) => {
							setValue(val);
							handleSave(val);
						}}
						onBlur={() => !isUpdating && setIsEditing(false)}
						autoFocus
						className="w-full"
						triggerClassName="h-7 text-xs px-1"
						placeholder="OPS..."
						searchPlaceholder="Search OPS..."
						showClearOption={true}
					/>
				</div>
			);
		}

		if (field === "warehouse") {
			return (
				<WarehouseInlineCell
					taxCode={taxCode}
					value={value}
					onChange={(val) => {
						setValue(val);
						handleSave(val);
					}}
				/>
			);
		}

		if (type === "date") {
			return (
				<Input
					ref={inputRef}
					type="date"
					autoFocus
					value={value}
					onChange={handleChange}
					onBlur={() => handleSave()}
					onKeyDown={handleKeyDown}
					className="h-7 text-xs px-1 w-full"
					disabled={isUpdating}
				/>
			);
		}

		// This case is handled by containerId field now
		if (field === "containerNo" && containerOptions.length > 0) {
			return (
				<div className="w-full">
					<Input
						ref={inputRef}
						autoFocus
						value={value}
						onChange={handleChange}
						onBlur={() => handleSave()}
						onKeyDown={handleKeyDown}
						className="h-7 text-xs px-1 w-full"
						disabled={isUpdating}
						placeholder="Container number..."
					/>
				</div>
			);
		}

		if (field === "containerId" && containerOptions.length > 0) {
			return (
				<div className="w-full">
					<VirtualizedCombobox
						items={containerOptions}
						value={value}
						onChange={(val) => {
							setValue(val);
							handleSave(val);
						}}
						onBlur={() => !isUpdating && setIsEditing(false)}
						autoFocus
						className="w-full"
						triggerClassName="h-7 text-xs px-1"
						placeholder="Select container..."
						searchPlaceholder="Search container..."
						showClearOption={true}
						displayValue="name"
						hideId={true}
					/>
				</div>
			);
		}

		return (
			<Input
				ref={inputRef}
				autoFocus
				value={value}
				onChange={handleChange}
				onBlur={() => handleSave()}
				onKeyDown={handleKeyDown}
				className="h-7 text-xs px-1 w-full"
				disabled={isUpdating}
				inputMode={
					type === "number"
						? "decimal"
						: type === "integer"
							? "numeric"
							: "text"
				}
			/>
		);
	}

	// Check if containerId field should be disabled (no containers available)
	const isContainerFieldDisabled =
		field === "containerId" && containerOptions.length === 0;

	// Get display value for containerId - show containerNo instead of ID
	const getDisplayValue = () => {
		if (field === "containerId" && value) {
			const container = containerOptions.find((c) => c.id === value);
			return container?.name || value;
		}
		return value;
	};

	return (
		<div
			onClick={() =>
				!isContainerFieldDisabled && !readOnly && setIsEditing(true)
			}
			className={cn(
				"rounded px-1 h-7 flex items-center transition-colors w-full",
				multiline
					? "whitespace-pre-wrap py-1 h-auto min-h-[1.75rem]"
					: "truncate",
				isContainerFieldDisabled || readOnly
					? "cursor-not-allowed opacity-70"
					: "cursor-pointer hover:bg-muted/50",
				readOnly && "text-indigo-600 dark:text-indigo-400 font-semibold",
			)}
			title={
				readOnly
					? "Synced from container"
					: isContainerFieldDisabled
						? "No containers available"
						: undefined
			}
		>
			{field === "shipper" && value ? (
				<CompanyBadge
					taxCode={value}
					companyName={partners.find((p) => p.id === value)?.name || value}
					className="text-[10px] px-2 py-0"
				/>
			) : field === "vendor" && value ? (
				<div className="truncate text-blue-600 font-medium">{value}</div>
			) : field === "ops" && value ? (
				<div className="truncate text-purple-600 dark:text-purple-400 font-medium">
					{value}
				</div>
			) : field === "warehouse" && value ? (
				<div className="truncate text-emerald-600 font-medium">{value}</div>
			) : field === "containerId" && value ? (
				<div className="truncate font-medium">{getDisplayValue()}</div>
			) : type === "date" ? (
				toDisplayFormat(value) || (
					<span className="text-muted-foreground/50">—</span>
				)
			) : (
				value || <span className="text-muted-foreground/50">—</span>
			)}
		</div>
	);
}

// Checkbox cell component for boolean fields
interface EditableFCRCheckboxProps {
	fcrId: string;
	field: string;
	initialValue: boolean | null | undefined;
}

function EditableFCRCheckbox({
	fcrId,
	field,
	initialValue,
}: EditableFCRCheckboxProps) {
	const [checked, setChecked] = useState(initialValue ?? false);
	const [isUpdating, setIsUpdating] = useState(false);
	const queryClient = useQueryClient();

	useEffect(() => {
		setChecked(initialValue ?? false);
	}, [initialValue]);

	const handleChange = async (newValue: boolean) => {
		if (isUpdating) return;

		setIsUpdating(true);
		setChecked(newValue);

		try {
			const response = await fetch("/api/trucking-followup/fcr/update", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: fcrId,
					field,
					value: newValue,
				}),
			});

			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.message || "Failed to update");
			}

			toast.success("Updated successfully");
			queryClient.invalidateQueries({ queryKey: ["trucking-followups"] });
			queryClient.invalidateQueries({ queryKey: ["dispatch-board"] });
		} catch (error) {
			console.error("FCR checkbox update error:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to update FCR",
			);
			setChecked(initialValue ?? false);
		} finally {
			setIsUpdating(false);
		}
	};

	return (
		<div className="flex items-center justify-center">
			<Checkbox
				checked={checked}
				onCheckedChange={(value) => handleChange(value === true)}
				disabled={isUpdating}
				className={cn(isUpdating && "opacity-50")}
			/>
		</div>
	);
}

export function FCRPanel({
	truckingId,
	fcrs,
	containers = [],
	isFinished = false,
	truckingRow,
}: FCRPanelProps) {
	const queryClient = useQueryClient();
	const { ops: opsOptions } = useOps();
	const [isApplying, setIsApplying] = useState(false);
	const [isAdding, setIsAdding] = useState(false);
	const [addingFromRowId, setAddingFromRowId] = useState<string | null>(null);
	const [reversingRowId, setReversingRowId] = useState<string | null>(null);
	const [deletingFcrId, setDeletingFcrId] = useState<string | null>(null);
	const [fcrToDelete, setFcrToDelete] = useState<FCRRow | null>(null);

	const handlePlateChange = useCallback(
		async (fcrId: string, plateNumber: string) => {
			const res = await fetch(
				`/api/trucking-numbers?plateNumber=${encodeURIComponent(plateNumber)}`,
			);
			if (!res.ok) return;
			const { record } = await res.json();
			if (!record) return;

			const updates: { field: string; value: string | number | null }[] = [];
			if (record.id) {
				updates.push({ field: "truckingNumberId", value: record.id });
				updates.push({ field: "tripNumber", value: 0 });
			}
			updates.push({ field: "vendor", value: record.vendorName ?? null });
			if (record.vehicleType?.trim())
				updates.push({ field: "truckType", value: record.vehicleType });
			if (record.driverName?.trim())
				updates.push({ field: "driver", value: record.driverName });
			if (updates.length === 0) return;

			await Promise.all(
				updates.map((u) =>
					fetch("/api/trucking-followup/fcr/update", {
						method: "PATCH",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ id: fcrId, field: u.field, value: u.value }),
					}),
				),
			);

			queryClient.invalidateQueries({ queryKey: ["trucking-followups"] });
			queryClient.invalidateQueries({ queryKey: ["dispatch-board"] });
		},
		[queryClient],
	);

	const handleAddFcr = async (withPrefill = false) => {
		if (isAdding) return;
		setIsAdding(true);
		const toastId = toast.loading("Creating new FCR in ERP...");

		try {
			// Build prefill data from truckingRow when adding the first FCR
			const prefillData =
				withPrefill && truckingRow
					? ({
							pickupAt: truckingRow.fromLocation || undefined,
							deliveryAt: truckingRow.toLocation || undefined,
							grossWeight: truckingRow.grossWeight || undefined,
							shipper: truckingRow.taxCode || undefined,
							tTypeC: truckingRow.truckType || undefined,
							truckType: truckingRow.truckType || undefined,
							implementationDate: truckingRow.implementationDate || undefined,
							vendor: truckingRow.vendor || undefined,
						} as Record<string, any>)
					: undefined;

			// Remove undefined keys so they don't override ERP defaults
			if (prefillData) {
				Object.keys(prefillData).forEach(
					(k) => prefillData[k] === undefined && delete prefillData[k],
				);
			}

			const response = await fetch("/api/trucking-followup/fcr/create", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					truckingFollowUpId: truckingId,
					...(prefillData && Object.keys(prefillData).length > 0
						? { prefillData }
						: {}),
				}),
			});

			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.message || "Failed to create FCR");
			}

			const result = await response.json();
			toast.success(`FCR ${result.fcr.fcrNumber} created successfully`, {
				id: toastId,
			});
			queryClient.invalidateQueries({ queryKey: ["trucking-followups"] });
			queryClient.invalidateQueries({ queryKey: ["dispatch-board"] });
		} catch (error) {
			console.error("Add FCR error:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to create FCR",
				{ id: toastId },
			);
		} finally {
			setIsAdding(false);
		}
	};

	const handleAddFcrFromRow = async (sourceFcr: FCRRow) => {
		if (addingFromRowId) return;
		setAddingFromRowId(sourceFcr.id);
		const toastId = toast.loading("Creating new FCR from this row...");

		try {
			const response = await fetch("/api/trucking-followup/fcr/create", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					truckingFollowUpId: truckingId,
					copyFromFcrId: sourceFcr.id,
				}),
			});

			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.message || "Failed to create FCR");
			}

			const result = await response.json();
			toast.success(
				`FCR ${result.fcr.fcrNumber} created (copied from ${sourceFcr.fcrNumber})`,
				{
					id: toastId,
				},
			);
			queryClient.invalidateQueries({ queryKey: ["trucking-followups"] });
			queryClient.invalidateQueries({ queryKey: ["dispatch-board"] });
		} catch (error) {
			console.error("Add FCR from row error:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to create FCR",
				{ id: toastId },
			);
		} finally {
			setAddingFromRowId(null);
		}
	};

	const handleReverseTrip = async (sourceFcr: FCRRow) => {
		if (reversingRowId) return;
		setReversingRowId(sourceFcr.id);
		const toastId = toast.loading(`Đảo chiều từ ${sourceFcr.fcrNumber}...`);

		try {
			const response = await fetch("/api/trucking-followup/fcr/create", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					truckingFollowUpId: truckingId,
					copyFromFcrId: sourceFcr.id,
					reverseTrip: true,
				}),
			});

			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.message || "Failed to create FCR");
			}

			const result = await response.json();
			toast.success(
				`FCR ${result.fcr.fcrNumber} đảo chiều từ ${sourceFcr.fcrNumber} (${result.fcr.service ?? ""})`,
				{ id: toastId },
			);
			queryClient.invalidateQueries({ queryKey: ["trucking-followups"] });
			queryClient.invalidateQueries({ queryKey: ["dispatch-board"] });
		} catch (error) {
			console.error("Reverse trip FCR error:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to create FCR",
				{ id: toastId },
			);
		} finally {
			setReversingRowId(null);
		}
	};

	const handleDeleteFcr = async (fcr: FCRRow) => {
		if (deletingFcrId) return;
		// Open confirm dialog instead of window.confirm
		setFcrToDelete(fcr);
	};

	const confirmDeleteFcr = async () => {
		const fcr = fcrToDelete;
		if (!fcr || deletingFcrId) return;
		setFcrToDelete(null);
		setDeletingFcrId(fcr.id);
		const toastId = toast.loading(`Đang xóa FCR ${fcr.fcrNumber}...`);

		try {
			const response = await fetch(
				`/api/trucking-followup/fcr/delete?id=${fcr.id}`,
				{ method: "DELETE" },
			);

			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.message || "Failed to delete FCR");
			}

			toast.success(`Đã xóa FCR ${fcr.fcrNumber}`, { id: toastId });
			queryClient.invalidateQueries({ queryKey: ["trucking-followups"] });
			queryClient.invalidateQueries({ queryKey: ["dispatch-board"] });
		} catch (error) {
			console.error("Delete FCR error:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to delete FCR",
				{ id: toastId },
			);
		} finally {
			setDeletingFcrId(null);
		}
	};

	const handleAutofill = async (field: keyof FCRRow) => {
		if (fcrs.length < 2) {
			toast.error("Need at least 2 FCRs to autofill");
			return;
		}

		const firstValue = fcrs[0][field];

		setIsApplying(true);
		const toastId = toast.loading(`Applying ${field} to all FCRs...`);

		try {
			const remainingFCRs = fcrs.slice(1);
			const updates = remainingFCRs
				.filter((f) => {
					// Special logic for tTypeC and truckType: only update if no container is linked
					if (field === "tTypeC" || field === "truckType") {
						return !f.containerId;
					}
					return true;
				})
				.map((f) => {
					return fetch("/api/trucking-followup/fcr/update", {
						method: "PATCH",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							id: f.id,
							field,
							value: firstValue === "" ? null : firstValue,
						}),
					});
				});

			const results = await Promise.all(updates);
			const failed = results.filter((r) => !r.ok);

			if (failed.length > 0) {
				toast.error(`Failed to update ${failed.length} FCRs`, { id: toastId });
			} else {
				toast.success(`Applied value to all ${updates.length + 1} FCRs`, {
					id: toastId,
				});
			}

			queryClient.invalidateQueries({ queryKey: ["trucking-followups"] });
			queryClient.invalidateQueries({ queryKey: ["dispatch-board"] });
		} catch (error) {
			console.error("Autofill error:", error);
			toast.error("Failed to apply values", { id: toastId });
		} finally {
			setIsApplying(false);
		}
	};

	const totalCBM = fcrs.reduce((acc, fcr) => acc + (Number(fcr.cbm) || 0), 0);
	const totalGW = fcrs.reduce(
		(acc, fcr) => acc + (Number(fcr.grossWeight) || 0),
		0,
	);
	const totalQty = fcrs.reduce(
		(acc, fcr) => acc + (Number(fcr.quantity) || 0),
		0,
	);

	// Create container options for dropdown - using container id as value
	const containerOptions = containers
		.filter((c) => c.containerNo)
		.map((c) => ({
			id: c.id,
			name: c.containerNo!,
			grossWeight: c.grossWeight,
		}));

	// Map containerId to containerNo for display
	const _containerIdToNoMap = new Map(
		containers.filter((c) => c.containerNo).map((c) => [c.id, c.containerNo!]),
	);
	const _containerIdToGrossWeightMap = new Map(
		containers
			.filter((c) => c.grossWeight != null)
			.map((c) => [c.id, c.grossWeight]),
	);

	return (
		<div className="p-4 space-y-4">
			{/* Desktop: Table view (md and above) */}
			<div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
				<Table className="text-xs table-fixed w-full min-w-[1700px]">
					<TableHeader className="bg-slate-100 dark:bg-slate-800">
						<TableRow>
							<TableHead className="px-2 py-2 w-8 text-center font-semibold text-slate-700 dark:text-slate-200">
								#
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 w-[140px]">
								{FCR_LABELS.fcrNumber}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 w-[120px]">
								<div className="flex items-center justify-between group">
									<span>{FCR_LABELS.plateNumber}</span>
									<Button
										variant="ghost"
										size="icon"
										className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
										onClick={() => handleAutofill("plateNumber")}
										disabled={isApplying}
										title="Fill down from first row"
									>
										<ArrowDownToLine className="h-3 w-3" />
									</Button>
								</div>
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 w-[90px]">
								<div className="flex items-center justify-between group">
									<span>{FCR_LABELS.tTypeC}</span>
									{containers.length === 0 && (
										<Button
											variant="ghost"
											size="icon"
											className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
											onClick={() => handleAutofill("tTypeC")}
											disabled={isApplying}
											title="Fill down from first row"
										>
											<ArrowDownToLine className="h-3 w-3" />
										</Button>
									)}
								</div>
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 w-[110px]">
								<div className="flex items-center justify-between group">
									<span>{FCR_LABELS.truckType}</span>
									{containers.length === 0 && (
										<Button
											variant="ghost"
											size="icon"
											className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
											onClick={() => handleAutofill("truckType")}
											disabled={isApplying}
											title="Fill down from first row"
										>
											<ArrowDownToLine className="h-3 w-3" />
										</Button>
									)}
								</div>
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 w-[120px]">
								<div className="flex items-center justify-between group">
									<span>{FCR_LABELS.driver}</span>
									<Button
										variant="ghost"
										size="icon"
										className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
										onClick={() => handleAutofill("driver")}
										disabled={isApplying}
										title="Fill down from first row"
									>
										<ArrowDownToLine className="h-3 w-3" />
									</Button>
								</div>
							</TableHead>
							<TableHead className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-200 w-[50px] text-center">
								Combine
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 w-[130px]">
								Container No
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 w-[250px]">
								<div className="flex items-center justify-between group">
									<span>Shipper</span>
									<Button
										variant="ghost"
										size="icon"
										className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
										onClick={() => handleAutofill("shipper")}
										disabled={isApplying}
										title="Fill down from first row"
									>
										<ArrowDownToLine className="h-3 w-3" />
									</Button>
								</div>
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 w-[200px]">
								<div className="flex items-center justify-between group">
									<span>{FCR_LABELS.vendor}</span>
									<Button
										variant="ghost"
										size="icon"
										className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
										onClick={() => handleAutofill("vendor")}
										disabled={isApplying}
										title="Fill down from first row"
									>
										<ArrowDownToLine className="h-3 w-3" />
									</Button>
								</div>
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 w-[180px]">
								<div className="flex items-center justify-between group">
									<span>{FCR_LABELS.warehouse}</span>
									<Button
										variant="ghost"
										size="icon"
										className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
										onClick={() => handleAutofill("warehouse")}
										disabled={isApplying}
										title="Fill down from first row"
									>
										<ArrowDownToLine className="h-3 w-3" />
									</Button>
								</div>
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 w-[140px]">
								<div className="flex items-center justify-between group">
									<span>{FCR_LABELS.implementationDate}</span>
									<Button
										variant="ghost"
										size="icon"
										className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
										onClick={() => handleAutofill("implementationDate")}
										disabled={isApplying}
										title="Fill down from first row"
									>
										<ArrowDownToLine className="h-3 w-3" />
									</Button>
								</div>
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 w-[80px]">
								CBM
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 w-[100px]">
								G.W
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 w-[80px]">
								Qty
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 w-[140px]">
								<div className="flex items-center justify-between group">
									<span>Pickup</span>
									<Button
										variant="ghost"
										size="icon"
										className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
										onClick={() => handleAutofill("pickupAt")}
										disabled={isApplying}
										title="Fill down from first row"
									>
										<ArrowDownToLine className="h-3 w-3" />
									</Button>
								</div>
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 w-[140px]">
								<div className="flex items-center justify-between group">
									<span>Delivery</span>
									<Button
										variant="ghost"
										size="icon"
										className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
										onClick={() => handleAutofill("deliveryAt")}
										disabled={isApplying}
										title="Fill down from first row"
									>
										<ArrowDownToLine className="h-3 w-3" />
									</Button>
								</div>
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 w-[140px]">
								<div className="flex items-center justify-between group">
									<span>Service</span>
									<Button
										variant="ghost"
										size="icon"
										className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
										onClick={() => handleAutofill("service")}
										disabled={isApplying}
										title="Fill down from first row"
									>
										<ArrowDownToLine className="h-3 w-3" />
									</Button>
								</div>
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 w-[180px]">
								<div className="flex items-center justify-between group">
									<span>{FCR_LABELS.ops}</span>
									<Button
										variant="ghost"
										size="icon"
										className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
										onClick={() => handleAutofill("ops")}
										disabled={isApplying}
										title="Fill down from first row"
									>
										<ArrowDownToLine className="h-3 w-3" />
									</Button>
								</div>
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 w-[110px]">
								{FCR_LABELS.bienBanBT}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 min-w-[200px]">
								{FCR_LABELS.notes}
							</TableHead>
							<TableHead className="w-16 sticky right-0 bg-slate-100 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700" />
						</TableRow>
					</TableHeader>
					<TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
						{fcrs.length === 0 ? (
							<TableRow>
								<TableCell colSpan={22} className="py-8 text-center">
									<div className="flex flex-col items-center gap-3">
										<p className="text-muted-foreground italic text-sm">
											No FCR records found
										</p>
										{!isFinished && (
											<Button
												variant="outline"
												size="sm"
												onClick={() => handleAddFcr(true)}
												disabled={isAdding}
												className="gap-1.5 text-emerald-600 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-900/30"
											>
												{isAdding ? (
													<span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent inline-block" />
												) : (
													<Plus className="h-3.5 w-3.5" />
												)}
												Add FCR
											</Button>
										)}
									</div>
								</TableCell>
							</TableRow>
						) : (
							fcrs.map((fcr, index) => (
								<TableRow
									key={fcr.id || index}
									className="group/row hover:bg-slate-50 dark:hover:bg-slate-800/50"
								>
									<TableCell className="px-2 py-1 text-center text-muted-foreground">
										{index + 1}
									</TableCell>
									<TableCell className="py-2 px-3 font-medium">
										{fcr.fcrNumber || "—"}
									</TableCell>
									<TableCell className="py-1 px-2 w-[120px] max-w-[120px]">
										<div className="w-full min-w-0 overflow-hidden">
											<EditableFCRCell
												fcrId={fcr.id}
												field="plateNumber"
												initialValue={fcr.plateNumber}
												readOnly={!!fcr.containerId}
												onPlateChange={(plate) =>
													handlePlateChange(fcr.id, plate)
												}
											/>
										</div>
									</TableCell>
									<TableCell className="py-1 px-2 w-[90px] max-w-[90px]">
										<div className="w-full min-w-0 overflow-hidden">
											<EditableFCRCell
												fcrId={fcr.id}
												field="tTypeC"
												initialValue={fcr.tTypeC}
												readOnly={!!fcr.containerId}
											/>
										</div>
									</TableCell>
									<TableCell className="py-1 px-2 w-[110px] max-w-[110px]">
										<div className="w-full min-w-0 overflow-hidden">
											<EditableFCRCell
												fcrId={fcr.id}
												field="truckType"
												initialValue={fcr.truckType}
												readOnly={!!fcr.containerId}
											/>
										</div>
									</TableCell>
									<TableCell className="py-1 px-2 w-[120px] max-w-[120px]">
										<div className="w-full min-w-0 overflow-hidden">
											<EditableFCRCell
												fcrId={fcr.id}
												field="driver"
												initialValue={fcr.driver}
											/>
										</div>
									</TableCell>
									<TableCell className="py-2 px-2 w-[50px]">
										<EditableFCRCheckbox
											fcrId={fcr.id}
											field="isCombined"
											initialValue={fcr.isCombined}
										/>
									</TableCell>
									<TableCell className="py-1 px-2 w-[130px] max-w-[130px]">
										<div className="w-full min-w-0 overflow-hidden">
											<EditableFCRCell
												fcrId={fcr.id}
												field="containerId"
												initialValue={fcr.containerId}
												containerOptions={containerOptions}
											/>
										</div>
									</TableCell>
									<TableCell className="py-1 px-2 w-[250px] max-w-[250px]">
										<div className="w-full min-w-0 overflow-hidden">
											<EditableFCRCell
												fcrId={fcr.id}
												field="shipper"
												initialValue={fcr.shipper}
												taxCode={truckingRow?.taxCode}
											/>
										</div>
									</TableCell>
									<TableCell className="py-1 px-2 w-[200px] max-w-[200px]">
										<div className="w-full min-w-0 overflow-hidden">
											<EditableFCRCell
												fcrId={fcr.id}
												field="vendor"
												initialValue={fcr.vendor}
												taxCode={truckingRow?.taxCode}
												readOnly={!!fcr.containerId}
											/>
										</div>
									</TableCell>
									<TableCell className="py-1 px-2 w-[180px] max-w-[180px]">
										<WarehouseInlineCell
											taxCode={fcr.shipper || null}
											value={fcr.warehouse ?? ""}
											disabled={!!fcr.containerId}
											onChange={async (val) => {
												await fetch("/api/trucking-followup/fcr/update", {
													method: "PATCH",
													headers: { "Content-Type": "application/json" },
													body: JSON.stringify({
														id: fcr.id,
														field: "warehouse",
														value: val || null,
													}),
												});
												queryClient.invalidateQueries({
													queryKey: ["trucking-followups"],
												});
											}}
										/>
									</TableCell>
									<TableCell className="py-1 px-2 w-[140px] max-w-[140px]">
										<div className="w-full min-w-0 overflow-hidden">
											<EditableFCRCell
												fcrId={fcr.id}
												field="implementationDate"
												initialValue={fcr.implementationDate}
												type="date"
												taxCode={truckingRow?.taxCode}
												readOnly={!!fcr.containerId}
											/>
										</div>
									</TableCell>
									<TableCell className="py-2 px-3 w-[80px] tabular-nums">
										<EditableFCRCell
											fcrId={fcr.id}
											field="cbm"
											type="number"
											initialValue={fcr.cbm}
										/>
									</TableCell>
									<TableCell className="py-2 px-3 w-[100px] tabular-nums">
										<EditableFCRCell
											fcrId={fcr.id}
											field="grossWeight"
											type="number"
											initialValue={fcr.grossWeight}
											readOnly={!!fcr.containerId}
										/>
									</TableCell>
									<TableCell className="py-2 px-3 w-[80px] tabular-nums">
										<EditableFCRCell
											fcrId={fcr.id}
											field="quantity"
											type="integer"
											initialValue={fcr.quantity}
											readOnly={!!fcr.containerId}
										/>
									</TableCell>
									<TableCell className="py-2 px-3 w-[140px]">
										<EditableFCRCell
											fcrId={fcr.id}
											field="pickupAt"
											initialValue={fcr.pickupAt}
										/>
									</TableCell>
									<TableCell className="py-2 px-3 w-[140px]">
										<EditableFCRCell
											fcrId={fcr.id}
											field="deliveryAt"
											initialValue={fcr.deliveryAt}
										/>
									</TableCell>
									<TableCell className="py-2 px-3 w-[140px] max-w-[140px]">
										<EditableFCRCell
											fcrId={fcr.id}
											field="service"
											initialValue={fcr.service}
										/>
									</TableCell>
									<TableCell className="py-2 px-3 w-[180px] max-w-[180px]">
										<EditableFCRCell
											fcrId={fcr.id}
											field="ops"
											initialValue={fcr.ops}
											opsOptions={opsOptions}
										/>
									</TableCell>
									<TableCell className="py-2 px-3 w-[110px]">
										<EditableFCRCheckbox
											fcrId={fcr.id}
											field="bienBanBT"
											initialValue={fcr.bienBanBT}
										/>
									</TableCell>
									<TableCell className="py-2 px-3 min-w-[200px]">
										<EditableFCRCell
											fcrId={fcr.id}
											field="notes"
											initialValue={fcr.notes}
											multiline={true}
										/>
									</TableCell>
									{/* Sticky actions column */}
									<TableCell className="py-1 px-2 sticky right-0 bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-700 group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800/50 transition-colors">
										<div className="flex items-center justify-center gap-1">
											{/* Copy row */}
											<Button
												variant="ghost"
												size="icon"
												className="h-6 w-6 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 disabled:opacity-30"
												onClick={() => handleAddFcrFromRow(fcr)}
												disabled={
													!!addingFromRowId ||
													!!deletingFcrId ||
													!!reversingRowId ||
													isFinished
												}
												title={
													isFinished
														? "Job đã hoàn thành, không thể thêm FCR"
														: `Tạo FCR mới sao chép từ ${fcr.fcrNumber}`
												}
											>
												{addingFromRowId === fcr.id ? (
													<span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent inline-block" />
												) : (
													<Plus className="h-3 w-3" />
												)}
											</Button>
											{/* Reverse trip */}
											<Button
												variant="ghost"
												size="icon"
												className="h-6 w-6 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-30"
												onClick={() => handleReverseTrip(fcr)}
												disabled={
													!!reversingRowId ||
													!!addingFromRowId ||
													!!deletingFcrId ||
													isFinished
												}
												title={
													isFinished
														? "Job đã hoàn thành"
														: `Đảo chiều từ ${fcr.fcrNumber} (Pickup⇔Delivery, Service+X2)`
												}
											>
												{reversingRowId === fcr.id ? (
													<span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent inline-block" />
												) : (
													<ArrowLeftRight className="h-3 w-3" />
												)}
											</Button>
											{/* Delete */}
											<Button
												variant="ghost"
												size="icon"
												className="h-6 w-6 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-30"
												onClick={() => handleDeleteFcr(fcr)}
												disabled={
													!!deletingFcrId ||
													!!addingFromRowId ||
													!!reversingRowId ||
													isFinished
												}
												title={
													isFinished
														? "Job đã hoàn thành, không thể xóa FCR"
														: `Xóa FCR ${fcr.fcrNumber}`
												}
											>
												{deletingFcrId === fcr.id ? (
													<span className="h-3 w-3 animate-spin rounded-full border-2 border-red-500 border-t-transparent inline-block" />
												) : (
													<Trash2 className="h-3 w-3" />
												)}
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			{/* Mobile/Tablet: Card grid (below md) */}
			<div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
				{fcrs.length === 0 ? (
					<div className="col-span-full py-6 flex flex-col items-center gap-3">
						<p className="text-muted-foreground text-sm italic">
							No FCR records found
						</p>
						{!isFinished && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => handleAddFcr(true)}
								disabled={isAdding}
								className="gap-1.5 text-emerald-600 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-900/30"
							>
								{isAdding ? (
									<span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent inline-block" />
								) : (
									<Plus className="h-3.5 w-3.5" />
								)}
								Add FCR
							</Button>
						)}
					</div>
				) : (
					fcrs.map((fcr, index) => (
						<div
							key={fcr.id || index}
							className="p-3 bg-neutral-50 rounded-md border"
						>
							<div className="flex items-center justify-between mb-2">
								<div className="flex items-center gap-2">
									<span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500">
										{index + 1}
									</span>
									<div className="font-medium text-xs truncate">
										{fcr.fcrNumber || "—"}
									</div>
								</div>
							</div>
							<div className="space-y-1 text-xs text-muted-foreground">
								<div className="flex items-center gap-1">
									<span className="font-medium shrink-0">
										{FCR_LABELS.plateNumber}:
									</span>
									<EditableFCRCell
										fcrId={fcr.id}
										field="plateNumber"
										initialValue={fcr.plateNumber}
										taxCode={truckingRow?.taxCode}
										onPlateChange={(plate) => handlePlateChange(fcr.id, plate)}
									/>
								</div>
								<div className="flex items-center gap-1">
									<span className="font-medium shrink-0">
										{FCR_LABELS.tTypeC}:
									</span>
									<EditableFCRCell
										fcrId={fcr.id}
										field="tTypeC"
										initialValue={fcr.tTypeC}
										taxCode={truckingRow?.taxCode}
										readOnly={!!fcr.containerId}
									/>
								</div>
								<div className="flex items-center gap-1">
									<span className="font-medium shrink-0">
										{FCR_LABELS.truckType}:
									</span>
									<EditableFCRCell
										fcrId={fcr.id}
										field="truckType"
										initialValue={fcr.truckType}
										taxCode={truckingRow?.taxCode}
										readOnly={!!fcr.containerId}
									/>
								</div>
								<div className="flex items-center gap-1">
									<span className="font-medium shrink-0">
										{FCR_LABELS.driver}:
									</span>
									<EditableFCRCell
										fcrId={fcr.id}
										field="driver"
										initialValue={fcr.driver}
										taxCode={truckingRow?.taxCode}
									/>
								</div>
								<div className="flex items-center gap-2">
									<span className="font-medium shrink-0">GH:</span>
									<EditableFCRCheckbox
										fcrId={fcr.id}
										field="isCombined"
										initialValue={fcr.isCombined}
									/>
								</div>
								<div className="flex items-center gap-1">
									<span className="font-medium shrink-0">Cont No:</span>
									<EditableFCRCell
										fcrId={fcr.id}
										field="containerId"
										initialValue={fcr.containerId}
										containerOptions={containerOptions}
										taxCode={truckingRow?.taxCode}
									/>
								</div>
								<div className="flex items-center gap-1">
									<span className="font-medium shrink-0">Shipper:</span>
									<EditableFCRCell
										fcrId={fcr.id}
										field="shipper"
										initialValue={fcr.shipper}
										taxCode={truckingRow?.taxCode}
									/>
								</div>
								<div className="flex items-center gap-1">
									<span className="font-medium shrink-0">
										{FCR_LABELS.vendor}:
									</span>
									<EditableFCRCell
										fcrId={fcr.id}
										field="vendor"
										initialValue={fcr.vendor}
										taxCode={truckingRow?.taxCode}
									/>
								</div>
								<div className="flex items-center gap-1">
									<span className="font-medium shrink-0">
										{FCR_LABELS.warehouse}:
									</span>
									<EditableFCRCell
										fcrId={fcr.id}
										field="warehouse"
										initialValue={fcr.warehouse}
										taxCode={truckingRow?.taxCode}
										readOnly={!!fcr.containerId}
									/>
								</div>
								<div className="flex items-center gap-1">
									<span className="font-medium shrink-0">
										{FCR_LABELS.implementationDate}:
									</span>
									<EditableFCRCell
										fcrId={fcr.id}
										field="implementationDate"
										initialValue={fcr.implementationDate}
										type="date"
										taxCode={truckingRow?.taxCode}
									/>
								</div>
								<div className="grid grid-cols-3 gap-2">
									<div className="flex flex-col">
										<span className="font-medium text-[10px]">CBM</span>
										<EditableFCRCell
											fcrId={fcr.id}
											field="cbm"
											type="number"
											initialValue={fcr.cbm}
											taxCode={truckingRow?.taxCode}
										/>
									</div>
									<div className="flex flex-col">
										<span className="font-medium text-[10px]">G.W</span>
										<EditableFCRCell
											fcrId={fcr.id}
											field="grossWeight"
											type="number"
											initialValue={fcr.grossWeight}
											taxCode={truckingRow?.taxCode}
											readOnly={!!fcr.containerId}
										/>
									</div>
									<div className="flex flex-col">
										<span className="font-medium text-[10px]">QTY</span>
										<EditableFCRCell
											fcrId={fcr.id}
											field="quantity"
											type="integer"
											initialValue={fcr.quantity}
											taxCode={truckingRow?.taxCode}
											readOnly={!!fcr.containerId}
										/>
									</div>
								</div>
								<div className="flex flex-col gap-0.5">
									<span className="font-medium">Pickup:</span>
									<EditableFCRCell
										fcrId={fcr.id}
										field="pickupAt"
										initialValue={fcr.pickupAt}
										taxCode={truckingRow?.taxCode}
									/>
								</div>
								<div className="flex flex-col gap-0.5">
									<span className="font-medium">Delivery:</span>
									<EditableFCRCell
										fcrId={fcr.id}
										field="deliveryAt"
										initialValue={fcr.deliveryAt}
										taxCode={truckingRow?.taxCode}
									/>
								</div>
								<div className="flex flex-col gap-0.5">
									<span className="font-medium">{FCR_LABELS.notes}:</span>
									<EditableFCRCell
										fcrId={fcr.id}
										field="notes"
										initialValue={fcr.notes}
										multiline={true}
										taxCode={truckingRow?.taxCode}
									/>
								</div>
								<div className="flex items-center gap-1">
									<span className="font-medium shrink-0">
										{FCR_LABELS.ops}:
									</span>
									<EditableFCRCell
										fcrId={fcr.id}
										field="ops"
										initialValue={fcr.ops}
										opsOptions={opsOptions}
										taxCode={truckingRow?.taxCode}
									/>
								</div>
								<div className="flex items-center gap-2">
									<span className="font-medium shrink-0">
										{FCR_LABELS.bienBanBT}:
									</span>
									<EditableFCRCheckbox
										fcrId={fcr.id}
										field="bienBanBT"
										initialValue={fcr.bienBanBT}
									/>
								</div>
							</div>
						</div>
					))
				)}
			</div>

			{/* Summary footer */}
			<div className="flex items-center mt-3 px-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
				<div className="flex items-center gap-4">
					<span>
						<FileText className="w-3.5 h-3.5 inline mr-1" />
						{fcrs.length} FCRs
					</span>
					<span>Total CBM: {totalCBM.toFixed(2)}</span>
					<span>Total G.W: {totalGW.toFixed(2)} kg</span>
					<span>Total Qty: {totalQty}</span>
				</div>
			</div>

			{/* Delete confirmation dialog */}
			<Dialog
				open={!!fcrToDelete}
				onOpenChange={(open) => !open && setFcrToDelete(null)}
			>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle className="text-red-600 flex items-center gap-2">
							<Trash2 className="h-5 w-5" />
							Xác nhận xóa FCR
						</DialogTitle>
						<DialogDescription className="pt-2 space-y-2">
							<span className="block">
								Bạn có chắc muốn xóa FCR{" "}
								<span className="font-mono font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
									{fcrToDelete?.fcrNumber}
								</span>
								?
							</span>
							<span className="block text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5">
								⚠️ Hành động này sẽ xóa cả trên FAST và không thể hoàn tác.
							</span>
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button
							variant="outline"
							onClick={() => setFcrToDelete(null)}
							disabled={!!deletingFcrId}
						>
							Hủy
						</Button>
						<Button
							variant="destructive"
							onClick={confirmDeleteFcr}
							disabled={!!deletingFcrId}
						>
							{deletingFcrId ? (
								<span className="flex items-center gap-2">
									<span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
									Đang xóa...
								</span>
							) : (
								<span className="flex items-center gap-2">
									<Trash2 className="h-4 w-4" />
									Xóa FCR
								</span>
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
