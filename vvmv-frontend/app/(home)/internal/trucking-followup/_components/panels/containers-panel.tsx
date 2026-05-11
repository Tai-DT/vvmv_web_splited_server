"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
	ArrowDownToLine,
	Box,
	CalendarIcon,
	Check,
	ChevronsUpDown,
	Download,
	Eye,
	FileText,
	Link2,
	Loader2,
	MapPin,
	Plus,
	Save,
	Ship,
	Sparkles,
	Trash2,
	Truck,
	Undo2,
	X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { WarehouseInlineCell } from "@/components/shared/warehouse-inline-cell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPositioner,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverPositioner,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useContainerSizes } from "@/hooks/use-container-sizes";
import { usePartners } from "@/hooks/use-partners";
import { usePickOrLiftPlaces } from "@/hooks/use-pick-or-lift-place";
import { useVehicles } from "@/hooks/use-vehicles";
import { useVendors } from "@/hooks/use-vendor";
import { cn } from "@/lib/utils";
import { PartnerCombobox } from "../../../followup/_components/shared/partner-combobox";
import { VirtualizedCombobox } from "../../../followup/_components/shared/virtualized-combobox";
import { CONTAINER_HEADERS } from "../../../followup/_components/table/column-headers";
import type { ContainerRow, DeclarationRow } from "../../../followup/types";
import type { FCRRow } from "../../types";
import { BookingBulkAiDialog } from "../dialogs/booking-bulk-ai-dialog";
import { ContainerAiAutofillDialog } from "../dialogs/container-ai-autofill-dialog";
import { ContainerBulkAiDialog } from "../dialogs/container-bulk-ai-dialog";
import { EdoBulkAiDialog } from "../dialogs/edo-bulk-ai-dialog";

// ─── Column config ────────────────────────────────────────────────────────────
type ContainerColumn = {
	key: string;
	label: string;
	type:
		| "text"
		| "number"
		| "date"
		| "date-vn"
		| "datetime-local"
		| "datetime-vn"
		| "combobox"
		| "checkbox"
		| "link";
	width?: string;
	minWidth?: string;
	/** For combobox: which list to use */
	comboboxSource?:
		| "containerSize"
		| "pickOrLiftPlace"
		| "vatTaxCode"
		| "kc"
		| "vendor"
		| "plateNumber"
		| "warehouse";
	/** Enable fill-down button in header */
	fillDown?: boolean;
};

type SnpTruckVesselDraft = {
	rowId: string;
	containerNo: string;
	location: string;
	customClearanceStatus: string;
	vesselName: string;
	veselNumber: string;
	truckVessel: string;
	plateNumber: string;
};

const CONTAINER_COLUMNS: ContainerColumn[] = [
	{
		key: "containerSize",
		label: CONTAINER_HEADERS.containerSize,
		type: "combobox",
		width: "100px",
		comboboxSource: "containerSize",
		fillDown: true,
	},
	{
		key: "containerNo",
		label: CONTAINER_HEADERS.containerNo,
		type: "text",
		width: "120px",
	},
	{
		key: "sealNo",
		label: CONTAINER_HEADERS.sealNo,
		type: "text",
		width: "100px",
	},
	{
		key: "containerType",
		label: CONTAINER_HEADERS.containerType,
		type: "text",
		width: "50px",
		fillDown: true,
	},
	{
		key: "kc",
		label: CONTAINER_HEADERS.kc,
		type: "combobox",
		width: "100px",
		comboboxSource: "kc",
		fillDown: true,
	},
	{
		key: "tareWeight",
		label: CONTAINER_HEADERS.tareWeight,
		type: "number",
		width: "50px",
		fillDown: true,
	},
	{
		key: "grossWeight",
		label: CONTAINER_HEADERS.grossWeight,
		type: "number",
		width: "50px",
		fillDown: true,
	},
	{
		key: "packageQty",
		label: CONTAINER_HEADERS.packageQty,
		type: "number",
		width: "50px",
		fillDown: true,
	},
	{
		key: "masGross",
		label: CONTAINER_HEADERS.masGross,
		type: "number",
		width: "50px",
		fillDown: true,
	},
	{
		key: "vendor",
		label: CONTAINER_HEADERS.vendor,
		type: "combobox",
		comboboxSource: "vendor",
		width: "130px",
		fillDown: true,
	},
	{
		key: "implementationDate",
		label: CONTAINER_HEADERS.implementationDate,
		type: "date-vn",
		width: "130px",
		fillDown: true,
	},
	{
		key: "plateNumber",
		label: CONTAINER_HEADERS.plateNumber,
		type: "combobox",
		comboboxSource: "plateNumber",
		width: "130px",
		fillDown: true,
	},
	{
		key: "warehouse",
		label: CONTAINER_HEADERS.warehouse,
		type: "combobox",
		comboboxSource: "warehouse",
		width: "150px",
		fillDown: true,
	},
	{
		key: "portLocation",
		label: "Vị trí container",
		type: "text",
		width: "130px",
		fillDown: true,
	},
	{
		key: "closingTime",
		label: CONTAINER_HEADERS.closingTime,
		type: "date-vn",
		width: "120px",
		fillDown: true,
	},
	{
		key: "cutOffTime",
		label: CONTAINER_HEADERS.cutOffTime,
		type: "datetime-vn",
		width: "150px",
		fillDown: true,
	},
	{
		key: "cutOffAtPort",
		label: "Cut Off tại cảng",
		type: "datetime-vn",
		width: "150px",
		fillDown: true,
	},
	{
		key: "vesselName",
		label: CONTAINER_HEADERS.vesselName,
		type: "text",
		width: "80px",
		fillDown: true,
	},
	{
		key: "veselNumber",
		label: CONTAINER_HEADERS.veselNumber,
		type: "text",
		width: "50px",
		fillDown: true,
	},
	{
		key: "pickOrLiftPlace",
		label: CONTAINER_HEADERS.pickOrLiftPlace,
		type: "combobox",
		width: "150px",
		comboboxSource: "pickOrLiftPlace",
		fillDown: true,
	},
	{
		key: "emptyReturnDeadline",
		label: CONTAINER_HEADERS.emptyReturnDeadline,
		type: "text",
		width: "130px",
		fillDown: true,
	},
	{
		key: "blockCode",
		label: "Block Code",
		type: "text",
		width: "120px",
		fillDown: true,
	},
	{
		key: "vatTaxCode",
		label: CONTAINER_HEADERS.vatTaxCode,
		type: "combobox",
		width: "120px",
		comboboxSource: "vatTaxCode",
		fillDown: true,
	},

	{
		key: "maLo",
		label: CONTAINER_HEADERS.maLo,
		type: "text",
		width: "60px",
		fillDown: true,
	},
	{
		key: "soDangKy",
		label: CONTAINER_HEADERS.soDangKy,
		type: "text",
		width: "100px",
		fillDown: false,
	},
	{
		key: "noEport",
		label: CONTAINER_HEADERS.noEport,
		type: "checkbox",
		width: "80px",
		fillDown: true,
	},
	{
		key: "linkedDeclarations",
		label: "Tờ khai",
		type: "text", // handled separately via custom render
		width: "200px",
		minWidth: "160px",
	},
	{
		key: "podUrl",
		label: "CCGH",
		type: "link",
		width: "80px",
	},
];

// ─── Date helpers ─────────────────────────────────────────────────────────────
function toDateInputValue(value: string | null | undefined): string {
	if (!value) return "";
	try {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return "";
		return date.toISOString().split("T")[0];
	} catch {
		return "";
	}
}

/** Convert ISO date string → dd/MM/yyyy for display (reads UTC to avoid timezone shift) */
function toDateVN(value: string | null | undefined): string {
	if (!value) return "";
	try {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return "";
		const d = String(date.getUTCDate()).padStart(2, "0");
		const m = String(date.getUTCMonth() + 1).padStart(2, "0");
		const y = date.getUTCFullYear();
		return `${d}/${m}/${y}`;
	} catch {
		return "";
	}
}

/** Parse dd/MM/yyyy → ISO string for API (stores as UTC to preserve the user's exact date) */
function parseDateVN(value: string): string | null {
	if (!value) return null;
	// First try to extract date from the value
	const extracted = extractDateVN(value);
	if (!extracted) return null;
	const match = extracted.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (!match) return null;
	const [, day, month, year] = match;
	const d = String(Number(day)).padStart(2, "0");
	const m = String(Number(month)).padStart(2, "0");
	// Construct as UTC directly so no timezone shift occurs
	return `${year}-${m}-${d}T00:00:00.000Z`;
}

/**
 * Extract dd/MM/yyyy from various datetime formats.
 * Handles:
 *   - "07/03/2026"           → "07/03/2026"
 *   - "07/03/2026 15:00"     → "07/03/2026"
 *   - "15:00 07/03/2026"     → "07/03/2026"
 */
function extractDateVN(value: string): string | null {
	if (!value) return null;
	const v = value.trim();
	// Look for dd/MM/yyyy anywhere in the string
	const match = v.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
	if (match) {
		const [, day, month, year] = match;
		const d = String(Number(day)).padStart(2, "0");
		const m = String(Number(month)).padStart(2, "0");
		return `${d}/${m}/${year}`;
	}
	return null;
}

/** Convert ISO datetime string → dd/MM/yyyy HH:mm for display (reads UTC to avoid timezone shift) */
function toDateTimeVN(value: string | null | undefined): string {
	if (!value) return "";
	try {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return "";
		const d = String(date.getUTCDate()).padStart(2, "0");
		const m = String(date.getUTCMonth() + 1).padStart(2, "0");
		const y = date.getUTCFullYear();
		const h = String(date.getUTCHours()).padStart(2, "0");
		const min = String(date.getUTCMinutes()).padStart(2, "0");
		return `${d}/${m}/${y} ${h}:${min}`;
	} catch {
		return "";
	}
}

/**
 * Parse Vietnamese datetime string → ISO string for API.
 * Accepts:
 *   - "dd/MM/yyyy HH:mm"  (e.g. "07/03/2026 15:00")
 *   - "HH:mm dd/MM/yyyy"  (e.g. "15:00 07/03/2026")
 */
/**
 * Parse Vietnamese datetime string → ISO string for API.
 * Stores as UTC directly to preserve the user's exact datetime without timezone shift.
 */
function parseDateTimeVN(value: string): string | null {
	if (!value) return null;
	const v = value.trim();

	// Format 1: dd/MM/yyyy HH:mm
	let match = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
	if (match) {
		const [, day, month, year, hours, minutes] = match;
		const d = String(Number(day)).padStart(2, "0");
		const m = String(Number(month)).padStart(2, "0");
		const h = String(Number(hours)).padStart(2, "0");
		const min = String(Number(minutes)).padStart(2, "0");
		return `${year}-${m}-${d}T${h}:${min}:00.000Z`;
	}

	// Format 2: HH:mm dd/MM/yyyy
	match = v.match(/^(\d{1,2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (match) {
		const [, hours, minutes, day, month, year] = match;
		const d = String(Number(day)).padStart(2, "0");
		const m = String(Number(month)).padStart(2, "0");
		const h = String(Number(hours)).padStart(2, "0");
		const min = String(Number(minutes)).padStart(2, "0");
		return `${year}-${m}-${d}T${h}:${min}:00.000Z`;
	}

	// Format 3: dd/MM/yyyy only (no time → default 00:00)
	match = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (match) {
		const [, day, month, year] = match;
		const d = String(Number(day)).padStart(2, "0");
		const m = String(Number(month)).padStart(2, "0");
		return `${year}-${m}-${d}T00:00:00.000Z`;
	}

	return null;
}

function toDateTimeInputValue(value: string | null | undefined): string {
	if (!value) return "";
	try {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return "";
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		const hours = String(date.getHours()).padStart(2, "0");
		const minutes = String(date.getMinutes()).padStart(2, "0");
		return `${year}-${month}-${day}T${hours}:${minutes}`;
	} catch {
		return "";
	}
}

function formatDateDisplay(value: string | null | undefined): string {
	if (!value) return "";
	try {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return "";
		const d = String(date.getDate()).padStart(2, "0");
		const m = String(date.getMonth() + 1).padStart(2, "0");
		const y = date.getFullYear();
		return `${d}/${m}/${y}`;
	} catch {
		return "";
	}
}

// ─── KC Options ────────────────────────────────────────────────────────────────
const KC_OPTIONS = [
	"2200",
	"2230",
	"2250",
	"2260",
	"2270",
	"4200",
	"4230",
	"4250",
	"4260",
	"4270",
	"4500",
	"4530",
	"4550",
	"4560",
	"4570",
	"9500",
	"9530",
	"9550",
	"9560",
	"9570",
];

function getFilteredKcOptions(containerSize?: string | null): string[] {
	let prefix = "";
	if (containerSize?.startsWith("20")) prefix = "2";
	else if (containerSize?.startsWith("40")) prefix = "4";
	else if (containerSize?.startsWith("45")) prefix = "9";
	if (!prefix) return KC_OPTIONS;
	return KC_OPTIONS.filter((opt) => opt.startsWith(prefix));
}

// ─── Link Declarations Cell ───────────────────────────────────────────────────
function LinkDeclarationsCell({
	containerId,
	linkedDeclarations,
	allDeclarations,
	onLinked,
	onUnlinked,
}: {
	containerId: string;
	linkedDeclarations: { id: string; declarationNumber?: string | null }[];
	allDeclarations: Pick<DeclarationRow, "id" | "declarationNumber">[];
	onLinked: (
		declarationId: string,
		declarationNumber: string | null | undefined,
	) => void;
	onUnlinked: (declarationId: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState<string | null>(null);

	const linkedIds = useMemo(
		() =>
			new Set(
				(Array.isArray(linkedDeclarations) ? linkedDeclarations : []).map(
					(d) => d.id,
				),
			),
		[linkedDeclarations],
	);

	const availableToLink = useMemo(
		() => allDeclarations.filter((d) => !linkedIds.has(d.id)),
		[allDeclarations, linkedIds],
	);

	const handleLink = async (declarationId: string) => {
		setLoading(declarationId);
		try {
			const res = await fetch(
				"/api/trucking-followup/container/link-declaration",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ containerId, declarationId }),
				},
			);
			if (!res.ok) throw new Error("Failed");
			const decl = allDeclarations.find((d) => d.id === declarationId);
			onLinked(declarationId, decl?.declarationNumber);
			toast.success(`Đã link tờ khai ${decl?.declarationNumber || ""}`);
		} catch {
			toast.error("Không thể link tờ khai");
		} finally {
			setLoading(null);
			setOpen(false);
		}
	};

	const handleUnlink = async (
		declarationId: string,
		declarationNumber?: string | null,
	) => {
		setLoading(declarationId);
		try {
			const res = await fetch(
				"/api/trucking-followup/container/link-declaration",
				{
					method: "DELETE",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ containerId, declarationId }),
				},
			);
			if (!res.ok) throw new Error("Failed");
			onUnlinked(declarationId);
			toast.success(`Đã xóa link tờ khai ${declarationNumber || ""}`);
		} catch {
			toast.error("Không thể xóa link tờ khai");
		} finally {
			setLoading(null);
		}
	};

	return (
		<div className="flex flex-wrap items-center gap-1 py-0.5 min-w-[140px]">
			{(Array.isArray(linkedDeclarations) ? linkedDeclarations : []).map(
				(decl) => (
					<Badge
						key={decl.id}
						variant="secondary"
						className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700"
					>
						<span
							className="truncate max-w-[120px]"
							title={decl.declarationNumber || decl.id}
						>
							{decl.declarationNumber || decl.id.slice(0, 8)}
						</span>
						{loading === decl.id ? (
							<Loader2 className="h-2.5 w-2.5 animate-spin shrink-0" />
						) : (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									handleUnlink(decl.id, decl.declarationNumber);
								}}
								className="shrink-0 rounded-full hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors"
								title="Xóa liên kết"
							>
								<X className="h-2.5 w-2.5" />
							</button>
						)}
					</Badge>
				),
			)}

			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger
					className="flex items-center gap-0.5 rounded border border-dashed border-slate-300 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-blue-400 hover:text-blue-600 transition-colors shrink-0"
					title="Link tờ khai"
				>
					<Plus className="h-2.5 w-2.5" />
					Link
				</PopoverTrigger>
				<PopoverPositioner>
					<PopoverContent className="w-[320px] p-0">
						<Command>
							<CommandInput
								placeholder="Tìm tờ khai..."
								className="h-8 text-xs"
							/>
							<CommandList>
								<CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
									{availableToLink.length === 0
										? "Tất cả tờ khai đã được link"
										: "Không tìm thấy tờ khai"}
								</CommandEmpty>
								<CommandGroup heading="Chọn tờ khai để link">
									{availableToLink.map((decl) => (
										<CommandItem
											key={decl.id}
											value={`${decl.declarationNumber || ""} ${decl.id}`}
											onSelect={() => handleLink(decl.id)}
											className="text-xs flex items-center gap-2"
											disabled={loading === decl.id}
										>
											{loading === decl.id ? (
												<Loader2 className="h-3 w-3 animate-spin" />
											) : (
												<Link2 className="h-3 w-3 text-blue-500 shrink-0" />
											)}
											<span className="truncate">
												{decl.declarationNumber || `ID: ${decl.id.slice(0, 8)}`}
											</span>
										</CommandItem>
									))}
								</CommandGroup>
							</CommandList>
						</Command>
					</PopoverContent>
				</PopoverPositioner>
			</Popover>
		</div>
	);
}

// ─── Combobox cell (always visible) ───────────────────────────────────────────
function InlineCombobox({
	value,
	onChange,
	options,
	placeholder,
	searchPlaceholder,
	className,
	displayFn,
}: {
	value: string;
	onChange: (val: string) => void;
	options: { id: string; name: string }[];
	placeholder?: string;
	searchPlaceholder?: string;
	className?: string;
	displayFn?: (val: string) => React.ReactNode;
}) {
	const [open, setOpen] = useState(false);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				className={cn(
					"flex h-6 w-full items-center justify-between rounded px-1 py-0 text-[11px] border-0 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30",
					!value && "text-muted-foreground italic",
					className,
				)}
				role="combobox"
				aria-expanded={open}
			>
				<span className="truncate">
					{displayFn && value ? displayFn(value) : value || placeholder || "—"}
				</span>
				<ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
			</PopoverTrigger>
			<PopoverPositioner>
				<PopoverContent className="w-[280px] p-0">
					<Command>
						<CommandInput
							placeholder={searchPlaceholder || "Search..."}
							className="h-8 text-xs"
						/>
						<CommandList>
							<CommandEmpty>No results.</CommandEmpty>
							<CommandGroup>
								<CommandItem
									value="clear"
									onSelect={() => {
										onChange("");
										setOpen(false);
									}}
									className="text-xs text-muted-foreground italic"
								>
									<Check
										className={cn(
											"mr-2 h-3 w-3",
											!value ? "opacity-100" : "opacity-0",
										)}
									/>
									Clear
								</CommandItem>
								{options.map((option) => (
									<CommandItem
										key={option.id}
										value={option.id}
										onSelect={(currentValue) => {
											onChange(currentValue === value ? "" : currentValue);
											setOpen(false);
										}}
										className="text-xs"
									>
										<Check
											className={cn(
												"mr-2 h-3 w-3",
												value === option.id ? "opacity-100" : "opacity-0",
											)}
										/>
										{option.name}
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</PopoverPositioner>
		</Popover>
	);
}

// ─── Hybrid Date Picker (text input + calendar) ──────────────────────────────
function InlineDatePicker({
	value,
	onChange,
	includeTime = false,
	isDirty,
	width,
}: {
	value: string;
	onChange: (val: string) => void;
	includeTime?: boolean;
	isDirty?: boolean;
	width?: string;
}) {
	const [open, setOpen] = useState(false);
	const [pickerHour, setPickerHour] = useState("00");
	const [pickerMinute, setPickerMinute] = useState("00");

	// Parse the current text value to a Date for the calendar
	const selectedDate = useMemo(() => {
		if (!value) return undefined;
		const matchDate = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
		if (matchDate) {
			const [, day, month, year] = matchDate;
			const d = new Date(Number(year), Number(month) - 1, Number(day));
			if (!Number.isNaN(d.getTime())) return d;
		}
		return undefined;
	}, [value]);

	// Sync picker time from current value when popover opens
	useEffect(() => {
		if (open && includeTime) {
			const timeMatch = value.match(/(\d{1,2}):(\d{2})/);
			if (timeMatch) {
				setPickerHour(timeMatch[1].padStart(2, "0"));
				setPickerMinute(timeMatch[2]);
			} else {
				setPickerHour("00");
				setPickerMinute("00");
			}
		}
	}, [open, value, includeTime]);

	// When a date is picked from the calendar
	const handleCalendarSelect = (date: Date | undefined) => {
		if (!date) return;
		const d = String(date.getDate()).padStart(2, "0");
		const m = String(date.getMonth() + 1).padStart(2, "0");
		const y = date.getFullYear();

		if (includeTime) {
			onChange(`${d}/${m}/${y} ${pickerHour}:${pickerMinute}`);
			// Don't close — let user adjust time
		} else {
			onChange(`${d}/${m}/${y}`);
			setOpen(false);
		}
	};

	// When time inputs change, update the value if a date is already selected
	const handleTimeChange = (hour: string, minute: string) => {
		setPickerHour(hour);
		setPickerMinute(minute);
		if (selectedDate) {
			const d = String(selectedDate.getDate()).padStart(2, "0");
			const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
			const y = selectedDate.getFullYear();
			onChange(`${d}/${m}/${y} ${hour}:${minute}`);
		}
	};

	return (
		<div
			className={cn(
				"flex items-center gap-0",
				isDirty && "bg-amber-50 dark:bg-amber-950/30 rounded",
			)}
			style={{ width }}
		>
			<Input
				type="text"
				placeholder={includeTime ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy"}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onBlur={() => {
					if (!includeTime && value) {
						const extracted = extractDateVN(value);
						if (extracted && extracted !== value) {
							onChange(extracted);
						}
					}
				}}
				className="h-6 text-[11px] px-1 py-0 border-0 bg-transparent focus:bg-white focus:border focus:border-primary rounded-none tabular-nums flex-1 min-w-0"
			/>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger
					className="h-6 w-5 flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground transition-colors rounded-sm hover:bg-slate-100 dark:hover:bg-slate-800"
					title="Pick date"
				>
					<CalendarIcon className="h-3 w-3" />
				</PopoverTrigger>
				<PopoverPositioner>
					<PopoverContent className="w-auto p-0">
						<Calendar
							mode="single"
							selected={selectedDate}
							onSelect={handleCalendarSelect}
							defaultMonth={selectedDate}
						/>
						{includeTime && (
							<div className="border-t px-3 py-2 flex items-center justify-center gap-1">
								<span className="text-xs text-muted-foreground mr-1">Giờ:</span>
								<Input
									type="number"
									min={0}
									max={23}
									value={pickerHour}
									onChange={(e) => {
										const h = Math.min(
											23,
											Math.max(0, parseInt(e.target.value, 10) || 0),
										);
										handleTimeChange(String(h).padStart(2, "0"), pickerMinute);
									}}
									className="w-12 h-7 text-center text-sm px-1 tabular-nums"
								/>
								<span className="text-sm font-bold">:</span>
								<Input
									type="number"
									min={0}
									max={59}
									value={pickerMinute}
									onChange={(e) => {
										const m = Math.min(
											59,
											Math.max(0, parseInt(e.target.value, 10) || 0),
										);
										handleTimeChange(pickerHour, String(m).padStart(2, "0"));
									}}
									className="w-12 h-7 text-center text-sm px-1 tabular-nums"
								/>
								<Button
									size="sm"
									variant="outline"
									className="ml-2 h-7 text-xs"
									onClick={() => setOpen(false)}
								>
									OK
								</Button>
							</div>
						)}
					</PopoverContent>
				</PopoverPositioner>
			</Popover>
		</div>
	);
}

interface ContainersPanelProps {
	containers: ContainerRow[];
	fcrs?: FCRRow[];
	declarations?: DeclarationRow[];
	createdBy?: string | null;
	truckingFollowUpId?: string;
	isFinished?: boolean;
	/** "logistics" mode: ẩn noEport, plateNumber read-only */
	mode?: "trucking" | "logistics";
	/** Logistics follow-up ID dùng để add/remove container phía logistics */
	logisticsFollowUpId?: string;
	/** Warehouse from parent logistics follow-up, used as default for new rows */
	followUpWarehouse?: string | null;
	/** Tax code from parent (FollowUp.taxCode for logistics mode, TruckingFollowUp.taxCode for trucking mode)
	 * Used to filter the warehouse combobox options */
	taxCode?: string | null;
	/** Drive URL of the parent job folder for AI autofill container subfolder creation */
	driveUrl?: string | null;
	/** Job number for gemini_history logging */
	jobNumber?: string | null;
	/** Bill/Booking number for AI cross-check validation */
	billOrBooking?: string | null;
	/** Operation type for AI KC lookup (XUAT / NHAP) */
	operationType?: string | null;
	/** From location (airport/port) for NHAP KC lookup */
	fromLocation?: string | null;
	/** To location (airport/port) for XUAT KC lookup */
	toLocation?: string | null;
	/** Delivery date from parent follow-up for default implementationDate */
	followUpDeliveryDate?: string | null;
}

export function ContainersPanel({
	containers,
	fcrs = [],
	declarations = [],
	createdBy,
	truckingFollowUpId,
	isFinished = false,
	mode = "trucking",
	logisticsFollowUpId,
	followUpWarehouse,
	taxCode,
	driveUrl,
	jobNumber,
	billOrBooking,
	operationType,
	fromLocation,
	toLocation,
	followUpDeliveryDate,
}: ContainersPanelProps) {
	const queryClient = useQueryClient();
	const { partners } = usePartners();
	const { pickOrLiftPlaces } = usePickOrLiftPlaces();
	const { containerSizes } = useContainerSizes();
	const { vehicles } = useVehicles();
	const { vendors } = useVendors();
	const [isSaving, setIsSaving] = useState(false);
	const [isApplying, setIsApplying] = useState(false);
	const [_isAddingRow, _setIsAddingRow] = useState(false);
	const [deletingContainerId, setDeletingContainerId] = useState<string | null>(
		null,
	);
	const [containerToDelete, setContainerToDelete] = useState<LocalRow | null>(
		null,
	);
	// AI Autofill state (per-row)
	const [aiAutofillRow, setAiAutofillRow] = useState<LocalRow | null>(null);
	// Bulk AI Autofill state
	const [bulkAiOpen, setBulkAiOpen] = useState(false);
	// Booking AI Autofill state
	const [bookingAiOpen, setBookingAiOpen] = useState(false);
	// EDO AI Autofill state
	const [edoAiOpen, setEdoAiOpen] = useState(false);
	const [lookingUpTraTau, setLookingUpTraTau] = useState(false);
	const [fetchingLocation, setFetchingLocation] = useState(false);
	const [snpVesselConfirmOpen, setSnpVesselConfirmOpen] = useState(false);
	const [snpVesselDrafts, setSnpVesselDrafts] = useState<SnpTruckVesselDraft[]>(
		[],
	);

	// Whether user can add/delete rows
	const canManageRows =
		mode === "logistics"
			? !!logisticsFollowUpId && !isFinished
			: !!truckingFollowUpId && !isFinished;

	/** Temp rows added locally but not yet saved to DB */
	const TEMP_PREFIX = "NEW_";
	const isTempRow = (id: string) => id.startsWith(TEMP_PREFIX);

	const isExportOperation = (operationType || "").toUpperCase() === "XUAT";

	// Derive SNP SITE_ID from FCR location fields
	// Strip Vietnamese diacritics + spaces so "CẢNG CÁT LÁI" → "CANGCATLAI" matches key "CATLAI"
	const normalizeLocStr = (s: string) =>
		s
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.toUpperCase()
			.replace(/\s+/g, "");

	const LOCATION_PATTERNS: { pattern: string; siteId: string }[] = [
		{ pattern: "GIANGNAM", siteId: "GNL" }, // check GNL before CTL (both contain "CATLAI")
		{ pattern: "CATLAI", siteId: "CTL" },
		{ pattern: "HPHUOC", siteId: "THP" },
		{ pattern: "HIEPPHUOC", siteId: "THP" },
		{ pattern: "VNTTT", siteId: "TOT" },
		{ pattern: "TANKTHUANTHUAN", siteId: "TOT" },
	];

	const resolveSiteId = (
		locationName: string | null | undefined,
	): string | null => {
		if (!locationName) return null;
		const norm = normalizeLocStr(locationName);
		for (const { pattern, siteId } of LOCATION_PATTERNS) {
			if (norm.includes(pattern)) return siteId;
		}
		return null;
	};
	const bookingSiteId = useMemo(() => {
		const first = fcrs.find((f) => f.deliveryAt);
		return resolveSiteId(first?.deliveryAt ?? null);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fcrs, resolveSiteId]);
	const edoSiteId = useMemo(() => {
		const first = fcrs.find((f) => f.pickupAt);
		return resolveSiteId(first?.pickupAt ?? null);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fcrs, resolveSiteId]);

	const parseTruckVessel = (truckVessel: string | null | undefined) => {
		const raw = truckVessel?.trim();
		if (!raw) {
			return { vesselName: null, veselNumber: null };
		}

		const separatorIndex = raw.lastIndexOf(" - ");
		if (separatorIndex === -1) {
			return { vesselName: raw, veselNumber: null };
		}

		const vesselName = raw.slice(0, separatorIndex).trim() || null;
		const veselNumber = raw.slice(separatorIndex + 3).trim() || null;
		return { vesselName, veselNumber };
	};

	const applySnpTruckVesselDrafts = async () => {
		if (snpVesselDrafts.length === 0) {
			setSnpVesselConfirmOpen(false);
			return;
		}

		setIsApplying(true);
		const toastId = toast.loading("Đang cập nhật dữ liệu SNP...");
		let savedCount = 0;
		let tempCount = 0;
		let errorCount = 0;
		const localUpdateMap = new Map<
			string,
			{
				portLocation?: string;
				vesselName?: string;
				veselNumber?: string;
				plateNumber?: string;
			}
		>();
		const dirtyFieldMap = new Map<string, Set<string>>();

		try {
			for (const draft of snpVesselDrafts) {
				const localFields = {
					...(draft.location ? { portLocation: draft.location } : {}),
					...(draft.vesselName.trim()
						? { vesselName: draft.vesselName.trim() }
						: {}),
					...(draft.veselNumber.trim()
						? { veselNumber: draft.veselNumber.trim() }
						: {}),
					...(draft.plateNumber.trim()
						? { plateNumber: draft.plateNumber.trim() }
						: {}),
				};

				if (isTempRow(draft.rowId)) {
					tempCount++;
					localUpdateMap.set(draft.rowId, localFields);
					dirtyFieldMap.set(draft.rowId, new Set(Object.keys(localFields)));
					continue;
				}

				const fieldUpdates: Array<{ field: string; value: string | null }> = [
					{ field: "portLocation", value: draft.location.trim() || null },
					{ field: "vesselName", value: draft.vesselName.trim() || null },
					{ field: "veselNumber", value: draft.veselNumber.trim() || null },
					...(draft.plateNumber.trim()
						? [{ field: "plateNumber", value: draft.plateNumber.trim() }]
						: []),
				];

				const results = await Promise.allSettled(
					fieldUpdates.map(async ({ field, value }) => {
						const res = await fetch("/api/trucking-followup/container/update", {
							method: "PATCH",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ id: draft.rowId, field, value }),
						});
						if (!res.ok) {
							const err = await res.json().catch(() => ({}));
							throw new Error(err.message || `Failed to update ${field}`);
						}
						return { field, value };
					}),
				);

				const successfulFields = new Set<string>();
				const successfulLocalFields: {
					portLocation?: string;
					vesselName?: string;
					veselNumber?: string;
					plateNumber?: string;
				} = {};

				for (const result of results) {
					if (result.status === "fulfilled") {
						successfulFields.add(result.value.field);
						if (result.value.field === "portLocation") {
							successfulLocalFields.portLocation = draft.location.trim();
						}
						if (result.value.field === "vesselName") {
							successfulLocalFields.vesselName = draft.vesselName.trim();
						}
						if (result.value.field === "veselNumber") {
							successfulLocalFields.veselNumber = draft.veselNumber.trim();
						}
						if (result.value.field === "plateNumber") {
							successfulLocalFields.plateNumber = draft.plateNumber.trim();
						}
					} else {
						errorCount++;
					}
				}

				if (successfulFields.size > 0) {
					savedCount++;
					localUpdateMap.set(draft.rowId, successfulLocalFields);
					dirtyFieldMap.set(draft.rowId, successfulFields);
				}
			}

			if (localUpdateMap.size > 0) {
				setLocalData((prev) =>
					prev.map((row) => {
						const updates = localUpdateMap.get(row.id);
						return updates ? { ...row, ...updates } : row;
					}),
				);
			}

			setDirtyCells((prev) => {
				const next = new Map(prev);
				for (const draft of snpVesselDrafts) {
					const existing = next.get(draft.rowId) || new Set<string>();
					const handledFields =
						dirtyFieldMap.get(draft.rowId) || new Set<string>();

					if (isTempRow(draft.rowId)) {
						handledFields.forEach((field) => existing.add(field));
						next.set(draft.rowId, existing);
						continue;
					}

					["portLocation", "vesselName", "veselNumber", "plateNumber"].forEach(
						(field) => {
							if (handledFields.has(field)) {
								existing.delete(field);
							}
						},
					);

					if (existing.size > 0) {
						next.set(draft.rowId, existing);
					} else {
						next.delete(draft.rowId);
					}
				}
				return next;
			});

			if (mode === "logistics") {
				queryClient.invalidateQueries({ queryKey: ["followups"] });
			} else {
				queryClient.invalidateQueries({ queryKey: ["trucking-followups"] });
			}

			setSnpVesselConfirmOpen(false);
			setSnpVesselDrafts([]);

			if (errorCount > 0) {
				toast.warning(
					`SNP: ${savedCount} container đã lưu, ${errorCount} lỗi${tempCount > 0 ? `, ${tempCount} dòng tạm chưa có trong DB` : ""}`,
					{ id: toastId },
				);
			} else {
				toast.success(
					`Đã lưu trực tiếp dữ liệu SNP cho ${savedCount} container${tempCount > 0 ? `, ${tempCount} dòng tạm vẫn chờ Save` : ""}`,
					{ id: toastId },
				);
			}
		} catch (error) {
			console.error("Apply SNP drafts error:", error);
			toast.error("Không thể lưu dữ liệu SNP", { id: toastId });
		} finally {
			setIsApplying(false);
		}
	};

	// Columns visible in this context
	const visibleColumns =
		mode === "logistics"
			? CONTAINER_COLUMNS.filter(
					(col) =>
						col.key !== "noEport" &&
						(isExportOperation || col.key !== "cutOffAtPort"),
				)
			: CONTAINER_COLUMNS.filter(
					(col) => isExportOperation || col.key !== "cutOffAtPort",
				);

	// Sort containers by FCR
	const sortedContainerIds = useMemo(() => {
		if (fcrs.length === 0) return containers.map((c) => c.id);
		const fcrIndexMap = new Map<string, string>();
		for (const fcr of fcrs) {
			if (!fcr.containerId || !fcr.fcrNumber) continue;
			const existing = fcrIndexMap.get(fcr.containerId);
			if (!existing || fcr.fcrNumber < existing) {
				fcrIndexMap.set(fcr.containerId, fcr.fcrNumber);
			}
		}
		const getFcrSortKey = (c: ContainerRow): string =>
			fcrIndexMap.get(c.id) ?? "\uFFFF";
		return [...containers]
			.sort((a, b) =>
				getFcrSortKey(a).localeCompare(getFcrSortKey(b), undefined, {
					numeric: true,
					sensitivity: "base",
				}),
			)
			.map((c) => c.id);
	}, [containers, fcrs]);

	const sortedContainers = useMemo(() => {
		const idMap = new Map(containers.map((c) => [c.id, c]));
		return sortedContainerIds.map((id) => idMap.get(id)!).filter(Boolean);
	}, [containers, sortedContainerIds]);

	// ─── Local editable state ──────────────────────────────────────────────────
	// Store all container data in local state for Excel-like editing
	type LocalRow = Record<string, any> & { id: string };
	const [localData, setLocalData] = useState<LocalRow[]>([]);
	// Track dirty cells: Map<containerId, Set<fieldName>>
	const [dirtyCells, setDirtyCells] = useState<Map<string, Set<string>>>(
		new Map(),
	);

	/** hasDirtyChanges also includes unsaved temp rows */
	const hasTempRows = localData.some((r) => isTempRow(r.id));

	// Stable key: prevents the useEffect from firing when parent re-renders with
	// a new array reference but identical data (e.g. "|| []" pattern in JSX).
	const _sortedContainersKey = sortedContainers
		.map((c) => `${c.id}:${(c as any).updatedAt ?? ""}`)
		.join(",");

	// Sync from props whenever containers actually change
	useEffect(() => {
		const newData: LocalRow[] = sortedContainers.map((c) => {
			const row: LocalRow = { id: c.id };
			for (const col of CONTAINER_COLUMNS) {
				if (col.key === "linkedDeclarations") {
					// Initialise from declarationLinks returned by API
					row[col.key] = (c.linkedDeclarations ?? []) as {
						id: string;
						declarationNumber?: string | null;
					}[];
					continue;
				}
				const val = (c as any)[col.key];
				if (col.type === "date-vn") {
					row[col.key] = toDateVN(val);
				} else if (col.type === "date") {
					row[col.key] = toDateInputValue(val);
				} else if (col.type === "datetime-vn") {
					row[col.key] = toDateTimeVN(val);
				} else if (col.type === "datetime-local") {
					row[col.key] = toDateTimeInputValue(val);
				} else if (col.type === "checkbox") {
					row[col.key] = val ?? false;
				} else if (col.type === "number") {
					row[col.key] = val !== null && val !== undefined ? String(val) : "";
				} else {
					row[col.key] = val ?? "";
				}
			}
			return row;
		});
		setLocalData(newData);
		setDirtyCells(new Map());
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sortedContainers.map]);

	// ─── Optimistic link/unlink handlers ─────────────────────────────────────────
	const handleDeclarationLinked = useCallback(
		(
			containerId: string,
			declarationId: string,
			declarationNumber: string | null | undefined,
		) => {
			setLocalData((prev) =>
				prev.map((row) => {
					if (row.id !== containerId) return row;
					const existing: { id: string; declarationNumber?: string | null }[] =
						row.linkedDeclarations ?? [];
					if (existing.some((d: any) => d.id === declarationId)) return row;
					return {
						...row,
						linkedDeclarations: [
							...existing,
							{ id: declarationId, declarationNumber },
						],
					};
				}),
			);
		},
		[],
	);

	const handleDeclarationUnlinked = useCallback(
		(containerId: string, declarationId: string) => {
			setLocalData((prev) =>
				prev.map((row) => {
					if (row.id !== containerId) return row;
					const existing: { id: string; declarationNumber?: string | null }[] =
						row.linkedDeclarations ?? [];
					return {
						...row,
						linkedDeclarations: existing.filter(
							(d: any) => d.id !== declarationId,
						),
					};
				}),
			);
		},
		[],
	);

	// Options for comboboxes
	const placeOptions = useMemo(
		() => pickOrLiftPlaces.map((p) => ({ id: p, name: p })),
		[pickOrLiftPlaces],
	);
	const sizeOptions = useMemo(
		() => containerSizes.map((s) => ({ id: s, name: s })),
		[containerSizes],
	);
	const _partnerOptions = useMemo(
		() => partners.map((p) => ({ id: p.id, name: p.name || p.id })),
		[partners],
	);
	const vehicleOptions = useMemo(
		() => vehicles.map((v) => ({ id: v, name: v })),
		[vehicles],
	);
	const vendorOptions = useMemo(
		() => vendors.map((v) => ({ id: v, name: v })),
		[vendors],
	);

	const hasDirtyChanges = dirtyCells.size > 0;

	// ─── Cell change handler ───────────────────────────────────────────────────
	const handleCellChange = useCallback(
		(rowIndex: number, columnKey: string, value: any) => {
			setLocalData((prev) => {
				const newData = [...prev];
				newData[rowIndex] = { ...newData[rowIndex], [columnKey]: value };
				return newData;
			});
			setDirtyCells((prev) => {
				const next = new Map(prev);
				const containerId = localData[rowIndex]?.id;
				if (!containerId) return prev;
				const set = next.get(containerId) || new Set();
				set.add(columnKey);
				next.set(containerId, set);
				return next;
			});
		},
		[localData],
	);

	// ─── Fill Down ─────────────────────────────────────────────────────────────
	const handleFillDown = useCallback(
		(columnKey: string) => {
			if (localData.length < 2) return;
			const firstValue = localData[0][columnKey];
			setLocalData((prev) => {
				const newData = [...prev];
				for (let i = 1; i < newData.length; i++) {
					newData[i] = { ...newData[i], [columnKey]: firstValue };
				}
				return newData;
			});
			setDirtyCells((prev) => {
				const next = new Map(prev);
				for (let i = 1; i < localData.length; i++) {
					const containerId = localData[i]?.id;
					if (!containerId) continue;
					const set = next.get(containerId) || new Set();
					set.add(columnKey);
					next.set(containerId, set);
				}
				return next;
			});
			toast.success(`Filled "${columnKey}" from first row`);
		},
		[localData],
	);

	// ─── Paste handler (Excel-like) ────────────────────────────────────────────
	const handlePaste = useCallback(
		(e: React.ClipboardEvent) => {
			const target = e.target as HTMLElement;
			const clipboardData = e.clipboardData.getData("text");
			const rows = clipboardData
				.split(/\r?\n/)
				.filter((row) => row.trim() !== "");

			if (target.tagName === "INPUT") {
				const input = target as HTMLInputElement;
				const hasMultipleRows = rows.length > 1;
				const hasMultipleColumns = rows.some((row) => row.includes("\t"));

				if (hasMultipleRows || hasMultipleColumns) {
					e.preventDefault();

					const cell = input.closest("td");
					const tableRow = cell?.closest("tr");
					const tbody = tableRow?.closest("tbody");

					if (cell && tableRow && tbody) {
						const allCells = Array.from(tableRow.querySelectorAll("td"));
						const cellIndex = allCells.indexOf(cell);
						// Fixed prefix columns: always has "#" (row number) + AI button + delete button when canManageRows
						const fixedPrefixCols = canManageRows ? 3 : 2;
						const startColumnIndex = cellIndex - fixedPrefixCols;

						const allRows = Array.from(tbody.querySelectorAll("tr"));
						const startRowIndex = allRows.indexOf(tableRow);

						if (
							startColumnIndex >= 0 &&
							startColumnIndex < visibleColumns.length
						) {
							setLocalData((prev) => {
								const newData = [...prev];

								rows.forEach((rowText, rowOffset) => {
									const rowIndex = startRowIndex + rowOffset;
									if (rowIndex >= newData.length) return; // can't add rows - containers come from parent
									const cellValues = rowText.split("\t");

									cellValues.forEach((value, colOffset) => {
										const columnIndex = startColumnIndex + colOffset;
										if (columnIndex >= visibleColumns.length) return;

										const column = visibleColumns[columnIndex];
										let parsedValue: any = value.trim();

										if (column.type === "number") {
											parsedValue = value.replace(/,/g, "").trim();
										} else if (column.type === "checkbox") {
											parsedValue =
												parsedValue === "1" ||
												parsedValue.toLowerCase() === "true" ||
												parsedValue.toLowerCase() === "yes";
										}

										newData[rowIndex] = {
											...newData[rowIndex],
											[column.key]: parsedValue,
										};
									});
								});

								return newData;
							});

							// Mark pasted cells as dirty
							setDirtyCells((prev) => {
								const next = new Map(prev);
								rows.forEach((rowText, rowOffset) => {
									const rowIndex = startRowIndex + rowOffset;
									if (rowIndex >= localData.length) return;
									const containerId = localData[rowIndex]?.id;
									if (!containerId) return;
									const set = next.get(containerId) || new Set();
									const cellValues = rowText.split("\t");
									cellValues.forEach((_, colOffset) => {
										const columnIndex = startColumnIndex + colOffset;
										if (columnIndex >= visibleColumns.length) return;
										set.add(visibleColumns[columnIndex].key);
									});
									next.set(containerId, set);
								});
								return next;
							});

							const colCount = Math.max(
								...rows.map((r) => r.split("\t").length),
							);
							const affectedCols = Math.min(
								colCount,
								visibleColumns.length - startColumnIndex,
							);
							toast.success(
								`Pasted ${rows.length} rows × ${affectedCols} columns`,
							);
						}
					}
				}
			}
		},
		[localData, canManageRows, visibleColumns],
	);

	// ─── Batch Save ────────────────────────────────────────────────────────────
	const handleSave = useCallback(async () => {
		if (!hasDirtyChanges && !hasTempRows) {
			toast.info("No changes to save");
			return;
		}

		// ── Validation: containerNo is mandatory ─────────────────────────────────
		const missingContainerNo = localData.filter(
			(row) => !row.containerNo || String(row.containerNo).trim() === "",
		);
		if (missingContainerNo.length > 0) {
			toast.error(
				`${missingContainerNo.length} container đang thiếu số container (Container No). Vui lòng điền đầy đủ trước khi lưu.`,
			);
			return;
		}

		setIsSaving(true);
		const toastId = toast.loading("Saving container changes...");
		let successCount = 0;
		let failCount = 0;
		const errorMessages: string[] = [];
		const failedIds = new Set<string>();

		try {
			// ── Step 1: Create new (temp) rows in DB ────────────────────────────────
			const tempToRealId = new Map<string, string>();

			for (const localRow of localData) {
				if (!isTempRow(localRow.id)) continue;
				const containerNo = String(localRow.containerNo || "").trim();

				try {
					let response: Response;
					if (mode === "logistics") {
						response = await fetch("/api/followup/create-container", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								followUpId: logisticsFollowUpId,
								containerNo,
							}),
						});
					} else {
						response = await fetch("/api/trucking-followup/container/create", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ truckingFollowUpId, containerNo }),
						});
					}

					if (!response.ok) {
						const err = await response.json().catch(() => ({}));
						throw new Error(err.message || "Failed to create container");
					}

					const created = await response.json();
					tempToRealId.set(localRow.id, created.id);
					successCount++;
				} catch (err) {
					failCount++;
					failedIds.add(localRow.id);
					errorMessages.push(
						err instanceof Error ? err.message : "Failed to create container",
					);
				}
			}

			// Apply temp→real ID mapping in local state
			if (tempToRealId.size > 0) {
				setLocalData((prev) =>
					prev
						.filter((r) => !failedIds.has(r.id)) // remove failed temp rows
						.map((r) => {
							const realId = tempToRealId.get(r.id);
							return realId ? { ...r, id: realId } : r;
						}),
				);
			}

			// ── Step 2: Update dirty fields for existing rows ───────────────────────
			const updates: { id: string; field: string; value: any }[] = [];

			for (const [tempOrRealId, fields] of dirtyCells.entries()) {
				if (failedIds.has(tempOrRealId)) continue; // skip failed creations
				const realId = tempToRealId.get(tempOrRealId) ?? tempOrRealId;
				if (isTempRow(realId)) continue; // still temp = create failed, skip

				const localRow = localData.find(
					(r) => r.id === tempOrRealId || r.id === realId,
				);
				if (!localRow) continue;

				for (const field of fields) {
					if (field === "linkedDeclarations") continue;
					// containerNo already set via create API for new rows
					if (field === "containerNo" && tempToRealId.has(tempOrRealId))
						continue;
					const col = CONTAINER_COLUMNS.find((c) => c.key === field);
					if (!col) continue;

					let sendValue: any = localRow[field];
					if (col.type === "number") {
						const num = parseFloat(String(sendValue).replace(/,/g, ""));
						sendValue = Number.isNaN(num) ? null : num;
					} else if (col.type === "date-vn") {
						sendValue = parseDateVN(sendValue);
					} else if (col.type === "datetime-vn") {
						sendValue = parseDateTimeVN(sendValue);
					} else if (col.type === "date") {
						sendValue = sendValue ? new Date(sendValue).toISOString() : null;
					} else if (col.type === "datetime-local") {
						sendValue = sendValue ? new Date(sendValue).toISOString() : null;
					} else if (col.type === "checkbox") {
						sendValue = Boolean(sendValue);
					} else {
						sendValue = sendValue || null;
					}
					updates.push({ id: realId, field, value: sendValue });
				}
			}

			// Send updates in batches of 5
			const batchSize = 5;
			for (let i = 0; i < updates.length; i += batchSize) {
				const batch = updates.slice(i, i + batchSize);
				const results = await Promise.allSettled(
					batch.map((update) =>
						fetch("/api/trucking-followup/container/update", {
							method: "PATCH",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify(update),
						}).then(async (res) => {
							if (!res.ok) {
								const err = await res.json().catch(() => ({}));
								throw new Error(
									err?.message || `Failed to update ${update.field}`,
								);
							}
							return update;
						}),
					),
				);
				for (let j = 0; j < results.length; j++) {
					const result = results[j];
					if (result.status === "fulfilled") {
						successCount++;
					} else {
						failCount++;
						errorMessages.push(result.reason?.message || "Unknown error");
						failedIds.add(batch[j].id);
					}
				}
			}

			// ── Finish ──────────────────────────────────────────────────────────────
			if (failCount > 0) {
				const uniqueErrors = [...new Set(errorMessages)];
				uniqueErrors.forEach((msg) => toast.error(msg));
				if (successCount > 0) {
					toast.success(`Đã lưu ${successCount} thay đổi thành công`, {
						id: toastId,
					});
				} else {
					toast.dismiss(toastId);
				}
				setDirtyCells((prev) => {
					const next = new Map(prev);
					for (const [id] of prev) {
						if (!failedIds.has(id)) next.delete(id);
					}
					return next;
				});
			} else {
				toast.success(`Saved ${successCount} changes successfully`, {
					id: toastId,
				});
				setDirtyCells(new Map());
			}

			if (mode === "logistics") {
				queryClient.invalidateQueries({ queryKey: ["followups"] });
			} else {
				queryClient.invalidateQueries({ queryKey: ["trucking-followups"] });
			}
		} catch (error) {
			console.error("Container batch save error:", error);
			toast.error("Failed to save container changes", { id: toastId });
		} finally {
			setIsSaving(false);
		}
	}, [
		hasDirtyChanges,
		hasTempRows,
		dirtyCells,
		localData,
		queryClient,
		mode,
		logisticsFollowUpId,
		truckingFollowUpId,
		isTempRow,
	]);

	// ─── Export Excel ──────────────────────────────────────────────────────────
	const handleExportExcel = useCallback(() => {
		if (localData.length === 0) {
			toast.error("No containers to export");
			return;
		}

		const headers = CONTAINER_COLUMNS.map((col) => col.label);
		const rows = localData.map((item) =>
			CONTAINER_COLUMNS.map((col) => {
				const val = item[col.key];
				if (col.type === "date") return formatDateDisplay(val);
				if (col.type === "checkbox") return val ? "Yes" : "No";
				return val ?? "";
			}),
		);

		const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
		worksheet["!cols"] = headers.map((h, i) => {
			const maxLen = Math.max(
				h.length,
				...rows.map((r) => String(r[i] ?? "").length),
			);
			return { wch: Math.min(maxLen + 2, 50) };
		});

		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, worksheet, "Containers");
		XLSX.writeFile(workbook, `containers-export.xlsx`);
		toast.success("Exported to Excel!");
	}, [localData]);

	// ─── Total Gross Weight ────────────────────────────────────────────────────
	const totalGW = useMemo(
		() =>
			localData.reduce(
				(acc, r) =>
					acc + (parseFloat(String(r.grossWeight).replace(/,/g, "")) || 0),
				0,
			),
		[localData],
	);

	// ─── Render cell ───────────────────────────────────────────────────────────
	/** Fields that are read-only in logistics mode (synced from trucking) */
	const LOGISTICS_READONLY_FIELDS = new Set(["plateNumber", "maLo"]);

	const renderCell = (
		row: LocalRow,
		rowIndex: number,
		col: ContainerColumn,
	) => {
		const value = row[col.key];
		const isDirty = dirtyCells.get(row.id)?.has(col.key);

		// ── Read-only in logistics mode ─────────────────────────────────────────
		if (mode === "logistics" && LOGISTICS_READONLY_FIELDS.has(col.key)) {
			return (
				<span className="px-1 text-[11px] text-muted-foreground tabular-nums">
					{String(value ?? "") || "—"}
				</span>
			);
		}

		// ── Tờ khai linked ─────────────────────────────────────────────────────
		if (col.key === "linkedDeclarations") {
			const linked: { id: string; declarationNumber?: string | null }[] =
				value ?? [];
			return (
				<LinkDeclarationsCell
					containerId={row.id}
					linkedDeclarations={linked}
					allDeclarations={declarations}
					onLinked={(declarationId, declarationNumber) =>
						handleDeclarationLinked(row.id, declarationId, declarationNumber)
					}
					onUnlinked={(declarationId) =>
						handleDeclarationUnlinked(row.id, declarationId)
					}
				/>
			);
		}

		if (col.type === "checkbox") {
			return (
				<div className="flex justify-center">
					<button
						type="button"
						onClick={() => handleCellChange(rowIndex, col.key, !value)}
						className={cn(
							"relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
							value
								? "border-red-500 bg-red-500"
								: "border-slate-300 bg-slate-200 dark:border-slate-600 dark:bg-slate-700",
							isDirty && "ring-2 ring-amber-400/50",
						)}
						title={value ? "No Eport: ON" : "No Eport: OFF"}
					>
						<span
							className={cn(
								"pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200",
								value ? "translate-x-4" : "translate-x-0.5",
							)}
						/>
					</button>
				</div>
			);
		}

		if (col.type === "link" && col.key === "podUrl") {
			const href = value || "";
			return (
				<div className="flex justify-center items-center h-full w-full">
					<Button
						variant="ghost"
						size="icon"
						className={cn(
							"h-5 w-5",
							!href
								? "text-slate-300 dark:text-slate-600"
								: "text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30",
						)}
						onClick={() => {
							if (href) {
								window.open(href, "_blank");
							}
						}}
						disabled={!href}
						title={href ? "Mở POD" : "Chưa có POD"}
					>
						<Eye className="h-4 w-4" />
					</Button>
				</div>
			);
		}

		if (col.type === "combobox") {
			let options: { id: string; name: string }[] = [];
			let placeholder = "Select...";
			let searchPlaceholder = "Search...";
			let displayFn: ((val: string) => React.ReactNode) | undefined;

			if (col.comboboxSource === "containerSize") {
				options = sizeOptions;
				placeholder = "Size...";
				searchPlaceholder = "Search size...";
			} else if (col.comboboxSource === "pickOrLiftPlace") {
				options = placeOptions;
				placeholder = "Place...";
				searchPlaceholder = "Search place...";
			} else if (col.comboboxSource === "kc") {
				const containerSizeVal = row.containerSize;
				const kcList = getFilteredKcOptions(containerSizeVal);
				options = kcList.map((k) => ({ id: k, name: k }));
				placeholder = "KC...";
				searchPlaceholder = "Search KC...";
			}

			if (col.comboboxSource === "vatTaxCode") {
				return (
					<div
						className={cn(
							isDirty && "ring-2 ring-amber-400/50 rounded",
							"truncate",
						)}
					>
						<PartnerCombobox
							value={String(value ?? "")}
							onChange={(val) => handleCellChange(rowIndex, col.key, val)}
							placeholder="MST..."
							searchPlaceholder="Search MST..."
							className="w-full max-w-full truncate"
							triggerClassName="flex h-6 w-full items-center justify-between rounded px-1 py-0 text-[11px] border-0 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 truncate"
							contentClassName="!w-[400px]"
						/>
					</div>
				);
			}

			if (col.comboboxSource === "warehouse") {
				return (
					<WarehouseInlineCell
						key={`wh-${row.id}`}
						taxCode={taxCode}
						value={String(value ?? "")}
						onChange={(val) => handleCellChange(rowIndex, col.key, val)}
						isDirty={!!isDirty}
					/>
				);
			}

			if (col.comboboxSource === "plateNumber") {
				const currentPlateValue = String(value ?? "").trim();
				const plateOptions =
					currentPlateValue &&
					!vehicleOptions.some((option) => option.id === currentPlateValue)
						? [
								{ id: currentPlateValue, name: currentPlateValue },
								...vehicleOptions,
							]
						: vehicleOptions;

				return (
					<div className={cn(isDirty && "ring-2 ring-amber-400/50 rounded")}>
						<VirtualizedCombobox
							items={plateOptions}
							value={String(value ?? "")}
							onChange={(val) => handleCellChange(rowIndex, col.key, val)}
							placeholder="Số xe..."
							searchPlaceholder="Tìm số xe..."
							showClearOption={true}
							triggerClassName="flex h-6 w-full items-center justify-between rounded px-1 py-0 text-[11px] border-0 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30"
						/>
					</div>
				);
			}

			if (col.comboboxSource === "vendor") {
				return (
					<div className={cn(isDirty && "ring-2 ring-amber-400/50 rounded")}>
						<VirtualizedCombobox
							items={vendorOptions}
							value={String(value ?? "")}
							onChange={(val) => handleCellChange(rowIndex, col.key, val)}
							placeholder="Vendor..."
							searchPlaceholder="Tìm vendor..."
							showClearOption={true}
							triggerClassName="flex h-6 w-full items-center justify-between rounded px-1 py-0 text-[11px] border-0 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30"
						/>
					</div>
				);
			}

			return (
				<div className={cn(isDirty && "ring-2 ring-amber-400/50 rounded")}>
					<InlineCombobox
						value={String(value ?? "")}
						onChange={(val) => handleCellChange(rowIndex, col.key, val)}
						options={options}
						placeholder={placeholder}
						searchPlaceholder={searchPlaceholder}
						displayFn={displayFn}
					/>
				</div>
			);
		}

		// date-vn / datetime-vn: hybrid text input + calendar picker
		if (col.type === "date-vn" || col.type === "datetime-vn") {
			return (
				<InlineDatePicker
					value={String(value ?? "")}
					onChange={(val) => handleCellChange(rowIndex, col.key, val)}
					includeTime={col.type === "datetime-vn"}
					isDirty={isDirty}
					width={col.width}
				/>
			);
		}

		// Text, number, date, datetime-local — always-visible Input
		return (
			<Input
				type={
					col.type === "date"
						? "date"
						: col.type === "datetime-local"
							? "datetime-local"
							: "text"
				}
				value={value ?? ""}
				onChange={(e) => handleCellChange(rowIndex, col.key, e.target.value)}
				className={cn(
					"h-6 text-[11px] px-1 py-0 border-0 bg-transparent focus:bg-white focus:border focus:border-primary rounded-none tabular-nums",
					isDirty && "bg-amber-50 dark:bg-amber-950/30",
					(col.type === "date" || col.type === "datetime-local") &&
						"h-7 py-0 px-1",
				)}
				style={{ width: col.width, minWidth: col.minWidth }}
			/>
		);
	};

	// ─── AI Autofill handler ───────────────────────────────────────────────────
	const handleAiConfirm = useCallback(
		async (data: {
			containerNo: string | null;
			sealNo: string | null;
			tareWeight: number | null;
			masGross: number | null;
			containerType: string | null;
			kc?: string | null;
			containerSize?: string | null;
			newFolderUrl?: string | null;
		}) => {
			if (!aiAutofillRow) return;

			const rowIndex = localData.findIndex((r) => r.id === aiAutofillRow.id);
			if (rowIndex === -1) return;

			const isTempRow_ = isTempRow(aiAutofillRow.id);

			// Update local state
			const updatedFields: Record<string, any> = {};
			if (data.containerNo !== null)
				updatedFields.containerNo = data.containerNo;
			if (data.sealNo !== null) updatedFields.sealNo = data.sealNo;
			if (data.tareWeight !== null)
				updatedFields.tareWeight = String(data.tareWeight);
			if (data.masGross !== null)
				updatedFields.masGross = String(data.masGross);
			if (data.containerType !== null)
				updatedFields.containerType = data.containerType;
			// Auto-fill kc from ContainerSizeConfig lookup
			if (data.kc != null && data.kc !== "") updatedFields.kc = data.kc;
			// Auto-fill containerSize from mapping (only if a match was found, otherwise keep user value)
			if (data.containerSize != null && data.containerSize !== "")
				updatedFields.containerSize = data.containerSize;

			setLocalData((prev) => {
				const newData = [...prev];
				newData[rowIndex] = { ...newData[rowIndex], ...updatedFields };
				return newData;
			});

			if (!isTempRow_) {
				// Save directly to DB for each field
				const saves: { field: string; value: any }[] = [];
				if (data.containerNo !== null)
					saves.push({ field: "containerNo", value: data.containerNo });
				if (data.sealNo !== null)
					saves.push({ field: "sealNo", value: data.sealNo });
				if (data.tareWeight !== null)
					saves.push({ field: "tareWeight", value: data.tareWeight });
				if (data.masGross !== null)
					saves.push({ field: "masGross", value: data.masGross });
				if (data.containerType !== null)
					saves.push({ field: "containerType", value: data.containerType });
				if (data.kc != null && data.kc !== "")
					saves.push({ field: "kc", value: data.kc });
				if (data.containerSize != null && data.containerSize !== "")
					saves.push({ field: "containerSize", value: data.containerSize });

				let saveErrors = 0;
				await Promise.all(
					saves.map(async ({ field, value }) => {
						try {
							const res = await fetch(
								"/api/trucking-followup/container/update",
								{
									method: "PATCH",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({ id: aiAutofillRow.id, field, value }),
								},
							);
							if (!res.ok) {
								const err = await res.json().catch(() => ({}));
								throw new Error(err.message || `Failed to update ${field}`);
							}
						} catch (err) {
							saveErrors++;
							console.error(`AI autofill save error for ${field}:`, err);
						}
					}),
				);

				if (saveErrors > 0) {
					toast.warning(
						`Lưu thành công một phần (${saves.length - saveErrors}/${saves.length} trường)`,
					);
				} else {
					toast.success("Đã lưu thông tin container từ AI");
				}

				if (mode === "logistics") {
					queryClient.invalidateQueries({ queryKey: ["followups"] });
				} else {
					queryClient.invalidateQueries({ queryKey: ["trucking-followups"] });
				}
			} else {
				// For temp rows: mark as dirty so Save picks up changes
				setDirtyCells((prev) => {
					const next = new Map(prev);
					const set = next.get(aiAutofillRow.id) || new Set();
					Object.keys(updatedFields).forEach((k) => set.add(k));
					next.set(aiAutofillRow.id, set);
					return next;
				});
				toast.success("Đã điền thông tin từ AI (chưa lưu, bấm Save để lưu)");
			}

			setAiAutofillRow(null);
		},
		[aiAutofillRow, localData, mode, queryClient, isTempRow],
	);

	// ─── Bulk AI Autofill handler ──────────────────────────────────────────────
	const handleBulkAiConfirm = useCallback(
		async (
			results: Array<{
				rowId: string;
				containerNo: string | null;
				sealNo: string | null;
				tareWeight: number | null;
				masGross: number | null;
				containerType?: string | null;
				kc?: string | null;
				mappedContainerSize?: string | null;
				newFolderUrl?: string | null;
			}>,
		) => {
			let saved = 0;
			let errors = 0;

			for (const result of results) {
				const rowIndex = localData.findIndex((r) => r.id === result.rowId);
				if (rowIndex === -1) continue;

				const isTempRow_ = isTempRow(result.rowId);

				const updatedFields: Record<string, any> = {};
				if (result.containerNo !== null)
					updatedFields.containerNo = result.containerNo;
				if (result.sealNo !== null) updatedFields.sealNo = result.sealNo;
				if (result.tareWeight !== null)
					updatedFields.tareWeight = String(result.tareWeight);
				if (result.masGross !== null)
					updatedFields.masGross = String(result.masGross);
				if (result.containerType != null)
					updatedFields.containerType = result.containerType;
				// Auto-fill kc from ContainerSizeConfig lookup
				if (result.kc != null && result.kc !== "") updatedFields.kc = result.kc;
				// Auto-fill containerSize from mapping (only if a match was found)
				if (
					result.mappedContainerSize != null &&
					result.mappedContainerSize !== ""
				)
					updatedFields.containerSize = result.mappedContainerSize;

				setLocalData((prev) => {
					const newData = [...prev];
					newData[rowIndex] = { ...newData[rowIndex], ...updatedFields };
					return newData;
				});

				if (isTempRow_) {
					setDirtyCells((prev) => {
						const next = new Map(prev);
						const set = next.get(result.rowId) || new Set();
						Object.keys(updatedFields).forEach((k) => set.add(k));
						next.set(result.rowId, set);
						return next;
					});
				} else {
					const saves: { field: string; value: any }[] = [
						...(result.containerNo !== null
							? [{ field: "containerNo", value: result.containerNo }]
							: []),
						...(result.sealNo !== null
							? [{ field: "sealNo", value: result.sealNo }]
							: []),
						...(result.tareWeight !== null
							? [{ field: "tareWeight", value: result.tareWeight }]
							: []),
						...(result.masGross !== null
							? [{ field: "masGross", value: result.masGross }]
							: []),
						...(result.containerType != null
							? [{ field: "containerType", value: result.containerType }]
							: []),
						...(result.kc != null && result.kc !== ""
							? [{ field: "kc", value: result.kc }]
							: []),
						...(result.mappedContainerSize != null &&
						result.mappedContainerSize !== ""
							? [{ field: "containerSize", value: result.mappedContainerSize }]
							: []),
					];
					await Promise.all(
						saves.map(async ({ field, value }) => {
							try {
								const res = await fetch(
									"/api/trucking-followup/container/update",
									{
										method: "PATCH",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({ id: result.rowId, field, value }),
									},
								);
								if (!res.ok) throw new Error();
								saved++;
							} catch {
								errors++;
							}
						}),
					);
				}
			}

			if (errors > 0) {
				toast.warning(`Lưu bulk AI: ${saved} thành công, ${errors} lỗi`);
			}

			if (mode === "logistics") {
				queryClient.invalidateQueries({ queryKey: ["followups"] });
			} else {
				queryClient.invalidateQueries({ queryKey: ["trucking-followups"] });
			}
		},
		[localData, mode, queryClient, isTempRow],
	);

	// ─── Booking AI Autofill handler ────────────────────────────────────────────
	const handleBookingAiConfirm = useCallback(
		async (result: {
			eportBooking: string | null;
			carrierName: string | null;
			transitPort: string | null;
			destinationPort: string | null;
			vesselName: string | null;
			veselNumber: string | null;
			pickOrLiftPlace: string | null;
			blockCode: string | null;
			cutOffTime: string | null;
			cutOffAtPort: string | null;
			containerRows: Array<{
				id: string;
				containerSize: string | null;
				containerNo: string | null;
				sealNo: string | null;
				portLocation: string | null;
				plateNumber: string | null;
				grossWeight: number | null;
				packageQty: number | null;
			}>;
		}) => {
			let saved = 0;
			let errors = 0;

			// 1. Update TruckingFollowUp fields: eportBooking, carrierName, transitPort, destinationPort
			if (truckingFollowUpId) {
				const truckingFields: { field: string; value: any }[] = [];
				if (result.eportBooking !== null)
					truckingFields.push({
						field: "eportBooking",
						value: result.eportBooking,
					});
				if (result.carrierName !== null)
					truckingFields.push({
						field: "carrierName",
						value: result.carrierName,
					});
				if (result.transitPort !== null)
					truckingFields.push({
						field: "transitPort",
						value: result.transitPort,
					});
				if (result.destinationPort !== null)
					truckingFields.push({
						field: "destinationPort",
						value: result.destinationPort,
					});

				await Promise.all(
					truckingFields.map(async ({ field, value }) => {
						try {
							const res = await fetch("/api/trucking-followup/update", {
								method: "PATCH",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({ id: truckingFollowUpId, field, value }),
							});
							if (!res.ok) throw new Error();
							saved++;
						} catch {
							errors++;
						}
					}),
				);
			}

			// 2. Update Container fields: vesselName, veselNumber, cutOffTime
			//    These are synced via TruckingFollowUp's SYNC_CONFIG (vesselName, veselNumber, cutOffTime)
			//    So we can update via the trucking-followup/update endpoint which syncs to all containers
			if (truckingFollowUpId) {
				const containerSyncFields: { field: string; value: any }[] = [];
				if (result.vesselName !== null)
					containerSyncFields.push({
						field: "vesselName",
						value: result.vesselName,
					});
				if (result.veselNumber !== null)
					containerSyncFields.push({
						field: "veselNumber",
						value: result.veselNumber,
					});
				if (result.pickOrLiftPlace !== null)
					containerSyncFields.push({
						field: "pickOrLiftPlace",
						value: result.pickOrLiftPlace,
					});
				if (result.cutOffTime !== null)
					containerSyncFields.push({
						field: "cutOffTime",
						value: result.cutOffTime,
					});

				await Promise.all(
					containerSyncFields.map(async ({ field, value }) => {
						try {
							const res = await fetch("/api/trucking-followup/update", {
								method: "PATCH",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({ id: truckingFollowUpId, field, value }),
							});
							if (!res.ok) throw new Error();
							saved++;
						} catch {
							errors++;
						}
					}),
				);
			}

			// 3. Update independent container fields: cutOffAtPort + blockCode
			const independentContainerFields: {
				field: "cutOffAtPort" | "blockCode";
				value: string;
			}[] = [];
			if (result.cutOffAtPort !== null) {
				independentContainerFields.push({
					field: "cutOffAtPort",
					value: result.cutOffAtPort,
				});
			}
			if (result.blockCode !== null) {
				independentContainerFields.push({
					field: "blockCode",
					value: result.blockCode,
				});
			}

			if (independentContainerFields.length > 0) {
				const containerRows = localData.filter((r) => !!r.id);
				await Promise.all(
					containerRows.flatMap((row) =>
						independentContainerFields.map(async ({ field, value }) => {
							try {
								const res = await fetch(
									"/api/trucking-followup/container/update",
									{
										method: "PATCH",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({
											id: row.id,
											field,
											value,
										}),
									},
								);
								if (!res.ok) throw new Error();
								saved++;
							} catch {
								errors++;
							}
						}),
					),
				);
			}

			// Update local data for container fields
			if (
				result.vesselName !== null ||
				result.veselNumber !== null ||
				result.cutOffTime !== null ||
				result.cutOffAtPort !== null ||
				result.blockCode !== null ||
				result.pickOrLiftPlace !== null
			) {
				setLocalData((prev) =>
					prev.map((row) => ({
						...row,
						...(result.vesselName !== null
							? { vesselName: result.vesselName }
							: {}),
						...(result.veselNumber !== null
							? { veselNumber: result.veselNumber }
							: {}),
						...(result.pickOrLiftPlace !== null
							? { pickOrLiftPlace: result.pickOrLiftPlace }
							: {}),
						...(result.cutOffTime !== null
							? { cutOffTime: result.cutOffTime }
							: {}),
						...(result.cutOffAtPort !== null
							? { cutOffAtPort: result.cutOffAtPort }
							: {}),
						...(result.blockCode !== null
							? { blockCode: result.blockCode }
							: {}),
					})),
				);
			}

			// 4. Update individual container rows (containerSize, containerNo, sealNo)
			if (result.containerRows && result.containerRows.length > 0) {
				await Promise.all(
					result.containerRows.flatMap((cr) => {
						const updates: { field: string; value: any }[] = [];
						if (cr.containerSize !== null)
							updates.push({ field: "containerSize", value: cr.containerSize });
						if (cr.containerNo !== null)
							updates.push({ field: "containerNo", value: cr.containerNo });
						if (cr.sealNo !== null)
							updates.push({ field: "sealNo", value: cr.sealNo });
						if (cr.portLocation !== null)
							updates.push({ field: "portLocation", value: cr.portLocation });
						if (cr.plateNumber !== null)
							updates.push({ field: "plateNumber", value: cr.plateNumber });
						if (cr.grossWeight !== null)
							updates.push({ field: "grossWeight", value: cr.grossWeight });
						if (cr.packageQty !== null)
							updates.push({ field: "packageQty", value: cr.packageQty });
						return updates.map(async ({ field, value }) => {
							try {
								const res = await fetch(
									"/api/trucking-followup/container/update",
									{
										method: "PATCH",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({ id: cr.id, field, value }),
									},
								);
								if (!res.ok) throw new Error();
								saved++;
							} catch {
								errors++;
							}
						});
					}),
				);
				// Update local state immediately
				setLocalData((prev) =>
					prev.map((row) => {
						const cr = result.containerRows.find((r) => r.id === row.id);
						if (!cr) return row;
						return {
							...row,
							...(cr.containerSize !== null
								? { containerSize: cr.containerSize }
								: {}),
							...(cr.containerNo !== null
								? { containerNo: cr.containerNo }
								: {}),
							...(cr.sealNo !== null ? { sealNo: cr.sealNo } : {}),
							...(cr.portLocation !== null
								? { portLocation: cr.portLocation }
								: {}),
							...(cr.plateNumber !== null
								? { plateNumber: cr.plateNumber }
								: {}),
							...(cr.grossWeight !== null
								? { grossWeight: cr.grossWeight }
								: {}),
							...(cr.packageQty !== null ? { packageQty: cr.packageQty } : {}),
						};
					}),
				);
			}

			if (errors > 0) {
				toast.warning(`Lưu booking: ${saved} thành công, ${errors} lỗi`);
			} else if (saved > 0) {
				toast.success(`Đã lưu thông tin booking (${saved} trường)`);
			}

			if (mode === "logistics") {
				queryClient.invalidateQueries({ queryKey: ["followups"] });
			} else {
				queryClient.invalidateQueries({ queryKey: ["trucking-followups"] });
			}
		},
		[truckingFollowUpId, mode, queryClient, localData],
	);

	// ─── EDO AI Autofill handler ────────────────────────────────────────────────
	const handleEdoAiConfirm = useCallback(
		async (result: {
			carrierName: string | null;
			eportBooking: string | null;
			clientName: string | null;
			maNhanConmt: string | null;
			soLenh: string | null;
			vesselName: string | null;
			veselNumber: string | null;
			closingTime: string | null;
			pickOrLiftPlace: string | null;
			emptyReturnDeadline: string | null;
			containerRows: Array<{
				id: string;
				containerSize: string | null;
				containerNo: string | null;
				sealNo: string | null;
				portLocation: string | null;
				plateNumber: string | null;
				grossWeight: number | null;
				packageQty: number | null;
			}>;
			newContainerRows: Array<{
				containerSize: string | null;
				containerNo: string | null;
				sealNo: string | null;
				portLocation: string | null;
				plateNumber: string | null;
				grossWeight: number | null;
				packageQty: number | null;
			}>;
		}) => {
			let saved = 0;
			let errors = 0;

			if (truckingFollowUpId) {
				const truckingFields: { field: string; value: any }[] = [];
				if (result.carrierName !== null)
					truckingFields.push({
						field: "carrierName",
						value: result.carrierName,
					});
				if (result.eportBooking !== null)
					truckingFields.push({
						field: "eportBooking",
						value: result.eportBooking,
					});
				if (result.clientName !== null)
					truckingFields.push({
						field: "clientName",
						value: result.clientName,
					});
				if (result.maNhanConmt !== null)
					truckingFields.push({
						field: "maNhanConmt",
						value: result.maNhanConmt,
					});
				if (result.soLenh !== null)
					truckingFields.push({ field: "soLenh", value: result.soLenh });
				if (result.vesselName !== null)
					truckingFields.push({
						field: "vesselName",
						value: result.vesselName,
					});
				if (result.veselNumber !== null)
					truckingFields.push({
						field: "veselNumber",
						value: result.veselNumber,
					});
				if (result.closingTime !== null)
					truckingFields.push({
						field: "closingTime",
						value: result.closingTime,
					});
				if (result.pickOrLiftPlace !== null)
					truckingFields.push({
						field: "pickOrLiftPlace",
						value: result.pickOrLiftPlace,
					});

				await Promise.all(
					truckingFields.map(async ({ field, value }) => {
						try {
							const res = await fetch("/api/trucking-followup/update", {
								method: "PATCH",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({ id: truckingFollowUpId, field, value }),
							});
							if (!res.ok) throw new Error();
							saved++;
						} catch {
							errors++;
						}
					}),
				);
			}

			if (result.emptyReturnDeadline !== null) {
				const containerRows = localData.filter((r) => !!r.id);
				await Promise.all(
					containerRows.map(async (row) => {
						try {
							const res = await fetch(
								"/api/trucking-followup/container/update",
								{
									method: "PATCH",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({
										id: row.id,
										field: "emptyReturnDeadline",
										value: result.emptyReturnDeadline,
									}),
								},
							);
							if (!res.ok) throw new Error();
							saved++;
						} catch {
							errors++;
						}
					}),
				);
			}

			if (
				result.vesselName !== null ||
				result.veselNumber !== null ||
				result.closingTime !== null ||
				result.pickOrLiftPlace !== null ||
				result.emptyReturnDeadline !== null
			) {
				setLocalData((prev) =>
					prev.map((row) => ({
						...row,
						...(result.vesselName !== null
							? { vesselName: result.vesselName }
							: {}),
						...(result.veselNumber !== null
							? { veselNumber: result.veselNumber }
							: {}),
						...(result.closingTime !== null
							? { closingTime: result.closingTime }
							: {}),
						...(result.pickOrLiftPlace !== null
							? { pickOrLiftPlace: result.pickOrLiftPlace }
							: {}),
						...(result.emptyReturnDeadline !== null
							? { emptyReturnDeadline: result.emptyReturnDeadline }
							: {}),
					})),
				);
			}

			// Update individual container rows (containerSize, containerNo, sealNo from EDO)
			if (result.containerRows && result.containerRows.length > 0) {
				await Promise.all(
					result.containerRows.flatMap((cr) => {
						const updates: { field: string; value: any }[] = [];
						if (cr.containerSize !== null)
							updates.push({ field: "containerSize", value: cr.containerSize });
						if (cr.containerNo !== null)
							updates.push({ field: "containerNo", value: cr.containerNo });
						if (cr.sealNo !== null)
							updates.push({ field: "sealNo", value: cr.sealNo });
						if (cr.portLocation !== null)
							updates.push({ field: "portLocation", value: cr.portLocation });
						if (cr.plateNumber !== null)
							updates.push({ field: "plateNumber", value: cr.plateNumber });
						if (cr.grossWeight !== null)
							updates.push({ field: "grossWeight", value: cr.grossWeight });
						if (cr.packageQty !== null)
							updates.push({ field: "packageQty", value: cr.packageQty });
						return updates.map(async ({ field, value }) => {
							try {
								const res = await fetch(
									"/api/trucking-followup/container/update",
									{
										method: "PATCH",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({ id: cr.id, field, value }),
									},
								);
								if (!res.ok) throw new Error();
								saved++;
							} catch {
								errors++;
							}
						});
					}),
				);
				// Update local state immediately
				setLocalData((prev) =>
					prev.map((row) => {
						const cr = result.containerRows.find((r) => r.id === row.id);
						if (!cr) return row;
						return {
							...row,
							...(cr.containerSize !== null
								? { containerSize: cr.containerSize }
								: {}),
							...(cr.containerNo !== null
								? { containerNo: cr.containerNo }
								: {}),
							...(cr.sealNo !== null ? { sealNo: cr.sealNo } : {}),
							...(cr.portLocation !== null
								? { portLocation: cr.portLocation }
								: {}),
							...(cr.plateNumber !== null
								? { plateNumber: cr.plateNumber }
								: {}),
							...(cr.grossWeight !== null
								? { grossWeight: cr.grossWeight }
								: {}),
							...(cr.packageQty !== null ? { packageQty: cr.packageQty } : {}),
						};
					}),
				);
			}

			if (errors > 0) {
				toast.warning(`Lưu EDO: ${saved} thành công, ${errors} lỗi`);
			} else if (saved > 0) {
				toast.success(`Đã lưu thông tin EDO (${saved} trường)`);
			}

			// ── Create new containers detected from EDO ─────────────────────────
			if (
				result.newContainerRows &&
				result.newContainerRows.length > 0 &&
				truckingFollowUpId
			) {
				let createdCount = 0;
				let createErrors = 0;
				for (const newRow of result.newContainerRows) {
					try {
						// 1. Create the container record
						const createRes = await fetch(
							"/api/trucking-followup/container/create",
							{
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({
									truckingFollowUpId,
									containerNo: newRow.containerNo || null,
									isFromAi: true,
								}),
							},
						);
						if (!createRes.ok) {
							const err = await createRes.json();
							throw new Error(err.message || "Failed to create container");
						}
						const created = await createRes.json();
						const createdId = created.id;

						// 2. PATCH additional fields (containerSize, sealNo, etc.)
						const fieldPatches: { field: string; value: any }[] = [];
						if (newRow.containerSize)
							fieldPatches.push({
								field: "containerSize",
								value: newRow.containerSize,
							});
						if (newRow.sealNo)
							fieldPatches.push({ field: "sealNo", value: newRow.sealNo });
						if (newRow.portLocation)
							fieldPatches.push({
								field: "portLocation",
								value: newRow.portLocation,
							});
						if (newRow.plateNumber)
							fieldPatches.push({
								field: "plateNumber",
								value: newRow.plateNumber,
							});
						if (newRow.grossWeight)
							fieldPatches.push({
								field: "grossWeight",
								value: newRow.grossWeight,
							});
						if (newRow.packageQty)
							fieldPatches.push({
								field: "packageQty",
								value: newRow.packageQty,
							});

						// Apply the global fields that map to each container
						if (result.vesselName !== null)
							fieldPatches.push({
								field: "vesselName",
								value: result.vesselName,
							});
						if (result.veselNumber !== null)
							fieldPatches.push({
								field: "veselNumber",
								value: result.veselNumber,
							});
						if (result.closingTime !== null)
							fieldPatches.push({
								field: "closingTime",
								value: result.closingTime,
							});
						if (result.pickOrLiftPlace !== null)
							fieldPatches.push({
								field: "pickOrLiftPlace",
								value: result.pickOrLiftPlace,
							});
						if (result.emptyReturnDeadline !== null)
							fieldPatches.push({
								field: "emptyReturnDeadline",
								value: result.emptyReturnDeadline,
							});

						await Promise.all(
							fieldPatches.map(async ({ field, value }) => {
								const patchRes = await fetch(
									"/api/trucking-followup/container/update",
									{
										method: "PATCH",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({ id: createdId, field, value }),
									},
								);
								if (!patchRes.ok) throw new Error();
							}),
						);

						createdCount++;
					} catch (err: any) {
						createErrors++;
						console.error("EDO new container create error:", err);
					}
				}

				if (createErrors > 0) {
					toast.warning(
						`Tạo container mới: ${createdCount} thành công, ${createErrors} lỗi`,
					);
				} else if (createdCount > 0) {
					toast.success(`Đã thêm ${createdCount} container mới từ EDO`);
				}
			}

			if (mode === "logistics") {
				queryClient.invalidateQueries({ queryKey: ["followups"] });
			} else {
				queryClient.invalidateQueries({ queryKey: ["trucking-followups"] });
			}
		},
		[truckingFollowUpId, mode, queryClient, localData],
	);

	const handleLookupTraTauPanel = async () => {
		const firstCont = localData.find(
			(c) => c.vesselName?.trim() && c.veselNumber?.trim(),
		);
		const vesselName = firstCont?.vesselName?.trim();
		const veselNumber = firstCont?.veselNumber?.trim();

		if (!jobNumber) {
			toast.error("Không có job number để tra tàu");
			return;
		}

		if (!vesselName || !veselNumber) {
			toast.error(
				"Cần nhập Tên tàu và Số chuyến ở ít nhất 1 container chưa trống để tra",
			);
			return;
		}

		setLookingUpTraTau(true);
		try {
			const res = await fetch("/api/trucking-followup/tra-tau", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ jobNumber, vesselName, veselNumber }),
			});

			const data = await res.json();
			if (!res.ok || !data?.success) {
				throw new Error(data?.message || "Tra tàu thất bại");
			}

			const iso = data?.data?.closingTimeIso;
			if (!iso) {
				throw new Error("Không có dữ liệu Cut Off tại cảng");
			}

			const vnTime = toDateTimeVN(iso);

			setLocalData((prev) =>
				prev.map((row) => ({ ...row, cutOffAtPort: vnTime })),
			);

			setDirtyCells((prev) => {
				const next = new Map(prev);
				for (let i = 0; i < localData.length; i++) {
					const rowId = localData[i].id;
					if (!rowId) continue;
					const set = next.get(rowId) || new Set();
					set.add("cutOffAtPort");
					next.set(rowId, set);
				}
				return next;
			});

			toast.success(
				"Tra tàu thành công và đã điền Cut Off tại cảng cho tất cả các row",
			);
		} catch (error: any) {
			toast.error(error.message || "Lỗi khi tra tàu");
		} finally {
			setLookingUpTraTau(false);
		}
	};

	const fetchSnpLocationsPanel = async () => {
		const siteId = bookingSiteId || edoSiteId;
		if (!siteId) {
			toast.error("Không xác định được cảng (SITE_ID) từ FCR");
			return;
		}

		const nos = localData
			.map((r) => (r.containerNo || "").trim())
			.filter(Boolean);

		if (nos.length === 0) {
			toast.error("Không có số container nào để tra cứu");
			return;
		}

		setFetchingLocation(true);
		try {
			const res = await fetch("/api/trucking-followup/snp-location", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					containerNos: nos,
					siteId,
					isExport: isExportOperation,
				}),
			});
			if (!res.ok) throw new Error("Tra cứu thất bại");
			const data = await res.json();
			const results: {
				containerNo: string;
				location: string | null;
				customClearanceStatus: string | null;
				truckVessel: string | null;
				plateNumber: string | null;
			}[] = data.results ?? [];
			const resultMap = Object.fromEntries(
				results.map((r) => [r.containerNo.toUpperCase(), r]),
			);

			const draftRows = localData
				.map((row) => {
					const containerNo = (row.containerNo || "").trim();
					const result = resultMap[containerNo.toUpperCase()];
					if (!row.id || !containerNo || !result) return null;

					const parsed = parseTruckVessel(result.truckVessel);
					const hasSnpData = !!(
						result.location ||
						result.customClearanceStatus ||
						result.truckVessel ||
						result.plateNumber
					);
					if (!hasSnpData) return null;

					return {
						rowId: row.id,
						containerNo,
						location: result.location ?? "",
						customClearanceStatus: result.customClearanceStatus ?? "",
						truckVessel: result.truckVessel ?? "",
						vesselName: parsed.vesselName ?? String(row.vesselName || ""),
						veselNumber: parsed.veselNumber ?? String(row.veselNumber || ""),
						plateNumber: result.plateNumber || String(row.plateNumber || ""),
					};
				})
				.filter((row): row is SnpTruckVesselDraft => !!row);

			const _foundCount = draftRows.filter((draft) => !!draft.location).length;

			if (draftRows.length > 0) {
				setSnpVesselDrafts(draftRows);
				setSnpVesselConfirmOpen(true);
			}

			if (draftRows.length === 0) {
				toast.info("Không có dữ liệu SNP mới để xác nhận");
				return;
			}

			toast.success(
				`Đã tra cứu SNP cho ${draftRows.length}/${nos.length} container. Kiểm tra popup để xác nhận lưu vào DB.`,
			);
		} catch (error: any) {
			toast.error(error.message || "Lỗi khi lấy vị trí container");
		} finally {
			setFetchingLocation(false);
		}
	};

	const handleAddContainerRow = () => {
		if (!canManageRows) return;
		// Add a temp row to UI only — will be created in DB on Save
		const tempId = `${TEMP_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
		const firstFcrWarehouse =
			fcrs
				.find((f) => typeof f.warehouse === "string" && f.warehouse.trim())
				?.warehouse?.trim() ?? "";
		const defaultWarehouse =
			mode === "logistics"
				? (followUpWarehouse?.trim() ?? "")
				: firstFcrWarehouse;
		const emptyRow: LocalRow = { id: tempId };
		for (const col of CONTAINER_COLUMNS) {
			if (col.key === "linkedDeclarations") {
				emptyRow[col.key] = [];
			} else if (col.type === "checkbox") {
				emptyRow[col.key] = false;
			} else {
				emptyRow[col.key] = "";
			}
		}
		emptyRow.warehouse = defaultWarehouse;

		if (mode === "logistics" && followUpDeliveryDate) {
			emptyRow.implementationDate = toDateVN(followUpDeliveryDate);
		}

		setLocalData((prev) => [...prev, emptyRow]);
		// Mark all fields dirty so Save picks up the new row
		setDirtyCells((prev) => {
			const next = new Map(prev);
			next.set(tempId, new Set(CONTAINER_COLUMNS.map((c) => c.key)));
			return next;
		});
	};

	const handleDeleteContainer = (row: LocalRow) => {
		// Temp rows haven't been saved to DB — remove directly from UI
		if (isTempRow(row.id)) {
			setLocalData((prev) => prev.filter((r) => r.id !== row.id));
			setDirtyCells((prev) => {
				const next = new Map(prev);
				next.delete(row.id);
				return next;
			});
			return;
		}
		setContainerToDelete(row);
	};

	const confirmDeleteContainer = async () => {
		const row = containerToDelete;
		if (!row || deletingContainerId) return;
		setContainerToDelete(null);
		setDeletingContainerId(row.id);
		const toastId = toast.loading(
			`Đang xóa container ${row.containerNo || "(trống)"}...`,
		);

		try {
			if (mode === "logistics") {
				const response = await fetch("/api/followup/delete-container", {
					method: "DELETE",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ containerId: row.id }),
				});
				if (!response.ok) {
					const err = await response.json();
					throw new Error(err.message || "Failed to delete container");
				}
				toast.success(`Đã xóa container ${row.containerNo || "(trống)"}`, {
					id: toastId,
				});
				queryClient.invalidateQueries({ queryKey: ["followups"] });
			} else {
				const response = await fetch(
					`/api/trucking-followup/container/delete?id=${row.id}`,
					{ method: "DELETE" },
				);
				if (!response.ok) {
					const err = await response.json();
					throw new Error(err.message || "Failed to delete container");
				}
				toast.success(`Đã xóa container ${row.containerNo || "(trống)"}`, {
					id: toastId,
				});
				queryClient.invalidateQueries({ queryKey: ["trucking-followups"] });
			}
		} catch (error) {
			console.error("Delete container error:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to delete container",
				{ id: toastId },
			);
		} finally {
			setDeletingContainerId(null);
		}
	};

	// ─── Render ────────────────────────────────────────────────────────────────
	return (
		<div className="flex flex-col gap-3 p-4">
			{/* Toolbar */}
			<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
				<div className="flex flex-col gap-0.5">
					<h3 className="text-sm font-medium flex items-center gap-2">
						<FileText className="size-4" />
						Containers ({sortedContainers.length})
					</h3>
					<p className="text-xs text-muted-foreground">
						Edit cells directly. Copy from Excel and{" "}
						<kbd className="bg-muted px-1 rounded text-[10px]">Ctrl+V</kbd> to
						paste.
						{hasDirtyChanges && (
							<span className="ml-2 text-amber-600 font-medium">
								• Unsaved changes
							</span>
						)}
					</p>
				</div>
				<div className="flex flex-row items-center gap-2">
					{canManageRows && (
						<Button
							variant="outline"
							size="sm"
							onClick={handleAddContainerRow}
							className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
						>
							<Plus className="size-4" />
							<span className="text-xs">Thêm dòng</span>
						</Button>
					)}
					<Button
						variant="outline"
						size="sm"
						onClick={handleExportExcel}
						className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
					>
						<Download className="size-4" />
						<span className="text-xs">Excel</span>
					</Button>
					<Button
						size="sm"
						onClick={handleSave}
						disabled={isSaving || (!hasDirtyChanges && !hasTempRows)}
						className={cn(
							(hasDirtyChanges || hasTempRows) &&
								"bg-amber-500 hover:bg-amber-600 text-white",
						)}
					>
						{isSaving ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Save className="size-4" />
						)}
						<span className="text-xs">{isSaving ? "Saving..." : "Save"}</span>
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							// Reset local data from original container props
							const newData = sortedContainers.map((c) => {
								const row: Record<string, any> & { id: string } = { id: c.id };
								for (const col of CONTAINER_COLUMNS) {
									if (col.key === "linkedDeclarations") {
										row[col.key] = (c.linkedDeclarations ?? []) as {
											id: string;
											declarationNumber?: string | null;
										}[];
										continue;
									}
									const val = (c as any)[col.key];
									if (col.type === "date-vn") {
										row[col.key] = toDateVN(val);
									} else if (col.type === "date") {
										row[col.key] = toDateInputValue(val);
									} else if (col.type === "datetime-vn") {
										row[col.key] = toDateTimeVN(val);
									} else if (col.type === "datetime-local") {
										row[col.key] = toDateTimeInputValue(val);
									} else if (col.type === "checkbox") {
										row[col.key] = val ?? false;
									} else if (col.type === "number") {
										row[col.key] =
											val !== null && val !== undefined ? String(val) : "";
									} else {
										row[col.key] = val ?? "";
									}
								}
								return row;
							});
							setLocalData(newData);
							setDirtyCells(new Map());
							toast.info("Đã hoàn tác thay đổi");
						}}
						disabled={!hasDirtyChanges || isSaving}
						className={cn(
							hasDirtyChanges &&
								"text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700",
						)}
					>
						<Undo2 className="size-4" />
						<span className="text-xs">Reset</span>
					</Button>
				</div>
			</div>

			{/* Table */}
			<div
				className="border rounded-lg overflow-x-auto bg-slate-50/50 dark:bg-slate-900/30 focus:outline-none focus:ring-1 focus:ring-primary/20 max-w-max"
				onPaste={handlePaste}
			>
				<Table className="text-xs">
					<TableHeader className="bg-slate-100/80 dark:bg-slate-800">
						<TableRow>
							<TableHead className="text-[10px] h-8 whitespace-nowrap w-8 text-center font-semibold">
								#
							</TableHead>
							{canManageRows && (
								<TableHead className="text-[10px] h-8 whitespace-nowrap w-8 text-center font-semibold"></TableHead>
							)}
							{/* AI autofill column header — dropdown with Container + Booking options */}
							<TableHead className="text-[10px] h-8 whitespace-nowrap w-7 text-center font-semibold">
								<DropdownMenu>
									<DropdownMenuTrigger
										title="AI Autofill"
										className="flex items-center justify-center w-full h-full hover:text-red-700 transition-colors cursor-pointer"
									>
										<Sparkles className="h-3 w-3 text-red-500 hover:text-red-700 outline-none" />
									</DropdownMenuTrigger>
									<DropdownMenuPositioner
										side="bottom"
										align="start"
										sideOffset={6}
									>
										<DropdownMenuContent className="min-w-[200px]">
											<DropdownMenuItem
												onClick={() => setBulkAiOpen(true)}
												className="flex items-center gap-2 text-xs cursor-pointer"
											>
												<Box className="h-3.5 w-3.5 text-red-500" />
												<span>Auto fill Container</span>
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => setBookingAiOpen(true)}
												className="flex items-center gap-2 text-xs cursor-pointer"
											>
												<Ship className="h-3.5 w-3.5 text-blue-500" />
												<span>Auto fill Booking</span>
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => setEdoAiOpen(true)}
												className="flex items-center gap-2 text-xs cursor-pointer"
											>
												<Truck className="h-3.5 w-3.5 text-emerald-500" />
												<span>Auto fill EDO</span>
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem
												onClick={handleLookupTraTauPanel}
												disabled={lookingUpTraTau}
												className="flex items-center gap-2 text-xs cursor-pointer"
											>
												{lookingUpTraTau ? (
													<Loader2 className="h-3.5 w-3.5 text-indigo-500 animate-spin" />
												) : (
													<Ship className="h-3.5 w-3.5 text-indigo-500" />
												)}
												<span>Tra tàu hàng loạt</span>
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={fetchSnpLocationsPanel}
												disabled={
													fetchingLocation || (!bookingSiteId && !edoSiteId)
												}
												className="flex items-center gap-2 text-xs cursor-pointer"
												title={
													!bookingSiteId && !edoSiteId
														? "Không xác định được Cảng từ FCR"
														: ""
												}
											>
												{fetchingLocation ? (
													<Loader2 className="h-3.5 w-3.5 text-emerald-500 animate-spin" />
												) : (
													<MapPin className="h-3.5 w-3.5 text-emerald-500" />
												)}
												<span>Lấy vị trí container</span>
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenuPositioner>
								</DropdownMenu>
							</TableHead>
							{visibleColumns.map((col) => (
								<TableHead
									key={col.key}
									className="text-[10px] h-8 whitespace-nowrap font-semibold"
									style={{ width: col.width }}
								>
									{col.fillDown && localData.length >= 2 ? (
										<div className="flex items-center justify-between group">
											<span>{col.label}</span>
											<Button
												variant="ghost"
												size="icon"
												className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
												onClick={() => handleFillDown(col.key)}
												disabled={isApplying}
												title="Fill down from first row"
											>
												<ArrowDownToLine className="h-3 w-3" />
											</Button>
										</div>
									) : (
										col.label
									)}
								</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{localData.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={visibleColumns.length + (canManageRows ? 3 : 2)}
									className="h-20 text-center text-muted-foreground italic"
								>
									No containers found
								</TableCell>
							</TableRow>
						) : (
							localData.map((row, index) => (
								<TableRow
									key={row.id}
									className="hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
								>
									<TableCell className="py-0.5 px-2 text-[10px] text-muted-foreground w-8 text-center">
										{index + 1}
									</TableCell>
									{canManageRows && (
										<TableCell className="py-0.5 px-1 w-8">
											<Button
												variant="ghost"
												size="icon"
												className="h-5 w-5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
												onClick={() => handleDeleteContainer(row)}
												disabled={deletingContainerId === row.id}
												title="Xóa dòng"
											>
												{deletingContainerId === row.id ? (
													<Loader2 className="h-3 w-3 animate-spin" />
												) : (
													<Trash2 className="h-3 w-3" />
												)}
											</Button>
										</TableCell>
									)}
									{/* AI Autofill button per row */}
									<TableCell className="py-0.5 px-1 w-7">
										<Button
											variant="ghost"
											size="icon"
											className="h-5 w-5 text-violet-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30"
											onClick={() => setAiAutofillRow(row)}
											title="AI đọc ảnh container"
										>
											<Sparkles className="h-3 w-3" />
										</Button>
									</TableCell>
									{visibleColumns.map((col) => {
										const isMissingRequired =
											col.key === "containerNo" &&
											(!row.containerNo ||
												String(row.containerNo).trim() === "");
										return (
											<TableCell
												key={col.key}
												className={cn(
													"py-0.5 px-1",
													isMissingRequired &&
														"bg-red-50 dark:bg-red-950/30 ring-1 ring-inset ring-red-300 dark:ring-red-700",
												)}
												style={{ width: col.width }}
												title={
													isMissingRequired
														? "Container No là bắt buộc"
														: undefined
												}
											>
												{renderCell(row, index, col)}
											</TableCell>
										);
									})}
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			{/* Summary footer */}
			<div className="flex items-center justify-between px-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
				<div className="flex items-center gap-4">
					<span>
						<FileText className="w-3.5 h-3.5 inline mr-1" />
						{sortedContainers.length} Containers
					</span>
					<span>Total G.W: {totalGW.toLocaleString()} kg</span>
				</div>
			</div>

			{/* Confirm Delete Dialog */}
			<Dialog
				open={!!containerToDelete}
				onOpenChange={(open) => !open && setContainerToDelete(null)}
			>
				<DialogContent className="sm:max-w-[400px]">
					<DialogHeader>
						<DialogTitle>Xác nhận xóa container</DialogTitle>
						<DialogDescription>
							Bạn có chắc muốn xóa container{" "}
							<strong>{containerToDelete?.containerNo || "(trống)"}</strong>?
							Hành động này không thể hoàn tác.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button
							variant="outline"
							onClick={() => setContainerToDelete(null)}
						>
							Hủy
						</Button>
						<Button
							variant="destructive"
							onClick={confirmDeleteContainer}
							disabled={!!deletingContainerId}
						>
							{deletingContainerId ? (
								<Loader2 className="h-4 w-4 animate-spin mr-1" />
							) : null}
							Xóa
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={snpVesselConfirmOpen}
				onOpenChange={(open) => {
					setSnpVesselConfirmOpen(open);
					if (!open) {
						setSnpVesselDrafts([]);
					}
				}}
			>
				<DialogContent className="max-w-[96vw] sm:max-w-[1200px] xl:max-w-[1400px]">
					<DialogHeader>
						<DialogTitle>Xác nhận cập nhật dữ liệu SNP</DialogTitle>
						<DialogDescription>
							SNP đã trả về vị trí, tình trạng thông quan, tên tàu và số chuyến.
							Kiểm tra lại rồi xác nhận để lưu trực tiếp vào DB.
						</DialogDescription>
					</DialogHeader>
					<div className="max-h-[65vh] space-y-3 overflow-auto rounded-md border p-3">
						{snpVesselDrafts.map((draft, index) => (
							<div
								key={draft.containerNo}
								className="rounded-lg border bg-background p-4 shadow-sm"
							>
								<div className="mb-3">
									<div className="text-xs text-muted-foreground">Container</div>
									<div className="font-mono text-sm font-semibold">
										{draft.containerNo}
									</div>
								</div>

								<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
									<div className="space-y-1">
										<div className="text-xs font-medium text-muted-foreground">
											Location
										</div>
										<Input
											value={draft.location}
											onChange={(e) => {
												const value = e.target.value;
												setSnpVesselDrafts((prev) =>
													prev.map((item, itemIndex) =>
														itemIndex === index
															? { ...item, location: value }
															: item,
													),
												);
											}}
											placeholder="Location"
											className="h-9"
										/>
									</div>

									<div className="space-y-1">
										<div className="text-xs font-medium text-muted-foreground">
											Tình trạng thông quan
										</div>
										<div className="flex min-h-9 items-center rounded-md border px-3">
											<Badge
												variant="outline"
												className={cn(
													"max-w-full truncate border px-2 py-0.5 text-[11px] font-semibold",
													!draft.customClearanceStatus &&
														"border-slate-200 text-slate-500",
													/thong quan|da thong quan|completed|done/i.test(
														draft.customClearanceStatus,
													) &&
														"border-emerald-300 bg-emerald-50 text-emerald-700",
													/cho|pending|processing|dang/i.test(
														draft.customClearanceStatus,
													) && "border-amber-300 bg-amber-50 text-amber-700",
													/hold|treo|fail|error|block/i.test(
														draft.customClearanceStatus,
													) && "border-red-300 bg-red-50 text-red-700",
												)}
											>
												{draft.customClearanceStatus || "-"}
											</Badge>
										</div>
									</div>

									<div className="grid gap-3 md:col-span-2 md:grid-cols-[minmax(0,1fr)_220px]">
										<div className="space-y-1">
											<div className="text-xs font-medium text-muted-foreground">
												Tên tàu
											</div>
											<Input
												value={draft.vesselName}
												onChange={(e) => {
													const value = e.target.value;
													setSnpVesselDrafts((prev) =>
														prev.map((item, itemIndex) =>
															itemIndex === index
																? { ...item, vesselName: value }
																: item,
														),
													);
												}}
												placeholder="Tên tàu"
												className="h-9"
											/>
										</div>

										<div className="space-y-1">
											<div className="text-xs font-medium text-muted-foreground">
												Số chuyến
											</div>
											<Input
												value={draft.veselNumber}
												onChange={(e) => {
													const value = e.target.value;
													setSnpVesselDrafts((prev) =>
														prev.map((item, itemIndex) =>
															itemIndex === index
																? { ...item, veselNumber: value }
																: item,
														),
													);
												}}
												placeholder="Số chuyến"
												className="h-9"
											/>
										</div>

										{draft.plateNumber && (
											<div className="space-y-1">
												<div className="text-xs font-medium text-muted-foreground">
													Biển số xe
												</div>
												<Input
													value={draft.plateNumber}
													onChange={(e) => {
														const value = e.target.value;
														setSnpVesselDrafts((prev) =>
															prev.map((item, itemIndex) =>
																itemIndex === index
																	? { ...item, plateNumber: value }
																	: item,
															),
														);
													}}
													placeholder="Biển số xe"
													className="h-9"
												/>
											</div>
										)}
									</div>
								</div>
							</div>
						))}
					</div>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button
							variant="outline"
							onClick={() => {
								setSnpVesselConfirmOpen(false);
								setSnpVesselDrafts([]);
							}}
							disabled={isApplying}
						>
							Bỏ qua
						</Button>
						<Button onClick={applySnpTruckVesselDrafts} disabled={isApplying}>
							{isApplying ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Đang lưu...
								</>
							) : (
								"Xác nhận và lưu ngay"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* AI Per-row Autofill Dialog */}
			{aiAutofillRow && (
				<ContainerAiAutofillDialog
					open={!!aiAutofillRow}
					onOpenChange={(open) => {
						if (!open) setAiAutofillRow(null);
					}}
					containerId={aiAutofillRow.id}
					currentContainerNo={aiAutofillRow.containerNo || undefined}
					currentContainerSize={aiAutofillRow.containerSize || undefined}
					jobNumber={jobNumber}
					driveUrl={driveUrl}
					billOrBooking={billOrBooking}
					operationType={operationType}
					fromLocation={fromLocation}
					toLocation={toLocation}
					onConfirm={handleAiConfirm}
				/>
			)}

			{/* Bulk AI Autofill Dialog */}
			<ContainerBulkAiDialog
				open={bulkAiOpen}
				onOpenChange={setBulkAiOpen}
				rows={localData.map((r) => ({
					id: r.id,
					containerNo: r.containerNo || null,
					sealNo: r.sealNo || null,
					containerSize: r.containerSize || null,
					tareWeight: r.tareWeight ? Number(r.tareWeight) : null,
					masGross: r.masGross ? Number(r.masGross) : null,
				}))}
				jobNumber={jobNumber}
				driveUrl={driveUrl}
				billOrBooking={billOrBooking}
				operationType={operationType}
				fromLocation={fromLocation}
				toLocation={toLocation}
				onConfirm={handleBulkAiConfirm}
			/>

			{/* Booking AI Autofill Dialog */}
			<BookingBulkAiDialog
				open={bookingAiOpen}
				onOpenChange={setBookingAiOpen}
				containers={localData.map((r) => ({
					id: r.id,
					containerNo: r.containerNo || null,
					sealNo: r.sealNo || null,
					containerSize: r.containerSize || null,
					portLocation: r.portLocation || null,
					plateNumber: r.plateNumber || null,
					grossWeight: r.grossWeight ?? null,
					packageQty: r.packageQty ?? null,
				}))}
				jobNumber={jobNumber}
				truckingFollowUpId={truckingFollowUpId}
				driveUrl={driveUrl}
				siteId={bookingSiteId}
				isExport={isExportOperation}
				onConfirm={handleBookingAiConfirm}
			/>

			{/* EDO AI Autofill Dialog */}
			<EdoBulkAiDialog
				open={edoAiOpen}
				onOpenChange={setEdoAiOpen}
				containers={localData.map((r) => ({
					id: r.id,
					containerNo: r.containerNo || null,
					sealNo: r.sealNo || null,
					containerSize: r.containerSize || null,
					portLocation: r.portLocation || null,
					plateNumber: r.plateNumber || null,
					grossWeight: r.grossWeight ?? null,
					packageQty: r.packageQty ?? null,
				}))}
				jobNumber={jobNumber}
				truckingFollowUpId={truckingFollowUpId}
				driveUrl={driveUrl}
				siteId={edoSiteId}
				isExport={isExportOperation}
				onConfirm={handleEdoAiConfirm}
			/>
		</div>
	);
}
