"use client";

import {
	Check,
	ChevronsUpDown,
	Package,
	Pencil,
	Settings2,
	Truck,
	X,
} from "lucide-react";
import Link from "next/link";
import React from "react";
import { UserDisplay } from "@/app/(home)/internal/followup/_components/cells/user-display";
import { PartnerCombobox } from "@/app/(home)/internal/followup/_components/shared/partner-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverPositioner,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useAirports } from "@/hooks/use-airports";
import { useForeignPorts } from "@/hooks/use-foreign-ports";
import { useOps } from "@/hooks/use-ops";
import { usePickOrLiftPlaces } from "@/hooks/use-pick-or-lift-place";
import { useShippingLines } from "@/hooks/use-shipping-lines";
import { useSiteUsers } from "@/hooks/use-site-users";
import { useTruckTypes } from "@/hooks/use-truck-types";
import { useVendors } from "@/hooks/use-vendor";
import { cn } from "@/lib/utils";
import type { TruckingFollowUpRow } from "../../types";
import { CHECK_NHAP_KHO_OPTIONS } from "../cells/check-nhap-kho-cell";
import { DON_VI_KHU_TRUNG_OPTIONS } from "../table/column-headers";
import { TRUCKING_FOLLOWUP_LABELS as L } from "../table/column-labels";

interface FieldSharedProps {
	formData: any;
	onFieldChange: (field: string, value: any) => void;
}

function ComboboxSelect({
	fieldKey,
	label,
	options,
	readOnly = false,
	formData,
	onFieldChange,
}: FieldSharedProps & {
	fieldKey: string;
	label: string;
	options: Array<{ id: string; name: string }>;
	readOnly?: boolean;
}) {
	const [open, setOpen] = React.useState(false);
	const selectedOption = options.find((opt) => opt.id === formData[fieldKey]);

	return (
		<div>
			<label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
				{label}
			</label>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger
					render={
						<Button
							variant="outline"
							role="combobox"
							aria-expanded={open}
							disabled={readOnly}
							className={cn(
								"w-full justify-between font-normal h-10 text-sm",
								readOnly &&
									"bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed",
							)}
						/>
					}
				>
					{selectedOption ? (
						<span>{selectedOption.name}</span>
					) : (
						<span className="text-muted-foreground">Select {label}...</span>
					)}
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</PopoverTrigger>
				{!readOnly && (
					<PopoverPositioner className="z-[110]" sideOffset={4}>
						<PopoverContent className="w-full p-0">
							<Command>
								<CommandInput placeholder={`Search ${label}...`} />
								<CommandList>
									<CommandEmpty>No {label} found.</CommandEmpty>
									<CommandGroup>
										<CommandItem
											onSelect={() => {
												onFieldChange(fieldKey, "");
												setOpen(false);
											}}
										>
											<Check
												className={cn(
													"mr-2 h-4 w-4",
													!formData[fieldKey] ? "opacity-100" : "opacity-0",
												)}
											/>
											<span className="text-muted-foreground italic">
												Clear selection
											</span>
										</CommandItem>
										{options.map((option) => (
											<CommandItem
												key={option.id}
												onSelect={() => {
													onFieldChange(fieldKey, option.id);
													setOpen(false);
												}}
											>
												<Check
													className={cn(
														"mr-2 h-4 w-4",
														formData[fieldKey] === option.id
															? "opacity-100"
															: "opacity-0",
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
				)}
			</Popover>
		</div>
	);
}

function toDateInputValue(raw: unknown): string {
	if (!raw) return "";
	try {
		const d = new Date(String(raw));
		return Number.isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
	} catch {
		return "";
	}
}

function toDatetimeInputValue(raw: unknown): string {
	if (!raw) return "";
	try {
		const d = new Date(String(raw));
		if (Number.isNaN(d.getTime())) return "";
		// datetime-local input requires "YYYY-MM-DDTHH:mm" in UTC
		const y = d.getUTCFullYear();
		const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
		const day = String(d.getUTCDate()).padStart(2, "0");
		const hh = String(d.getUTCHours()).padStart(2, "0");
		const mm = String(d.getUTCMinutes()).padStart(2, "0");
		return `${y}-${mo}-${day}T${hh}:${mm}`;
	} catch {
		return "";
	}
}

function formatDateBadge(v: string): string {
	try {
		const d = new Date(v);
		if (Number.isNaN(d.getTime())) return v;
		return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
	} catch {
		return v;
	}
}

function formatDatetimeBadge(v: string): string {
	try {
		const d = new Date(v);
		if (Number.isNaN(d.getTime())) return v;
		return (
			d.toLocaleDateString("vi-VN") +
			" " +
			d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
		);
	} catch {
		return v;
	}
}

function ContainerField({
	fieldKey,
	label,
	vals,
	hasContainers,
	isDatetime = false,
	isDate = false,
	combobox,
	partnerCombobox = false,
	readOnly = false,
	formData,
	onFieldChange,
}: FieldSharedProps & {
	fieldKey: string;
	label: string;
	vals: string[];
	hasContainers: boolean;
	isDatetime?: boolean;
	isDate?: boolean;
	combobox?: Array<{ id: string; name: string }>;
	partnerCombobox?: boolean;
	readOnly?: boolean;
}) {
	const [overriding, setOverriding] = React.useState(false);
	const containerLabel = hasContainers ? `${label} (from containers)` : label;

	const formatBadge = (v: string) => {
		if (isDatetime) return formatDatetimeBadge(v);
		if (isDate) return formatDateBadge(v);
		return v;
	};

	const sharedProps = { formData, onFieldChange };

	const readOnlyBadge = (value: string) => (
		<div className="text-xs font-medium text-slate-700 dark:text-slate-300 py-1.5 px-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/40 rounded-md cursor-not-allowed">
			{value || "—"}
		</div>
	);

	const renderPartnerCombobox = (fieldLabel: string) => (
		<div>
			{fieldLabel && (
				<label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
					{fieldLabel}
				</label>
			)}
			<PartnerCombobox
				value={(formData as any)?.[fieldKey] || ""}
				onChange={(value) => onFieldChange(fieldKey, value)}
				placeholder="Select MST..."
				searchPlaceholder="Search by tax code or name..."
			/>
		</div>
	);

	if (readOnly) {
		const displayVal =
			vals.length > 0
				? vals.map(formatBadge)
				: [(formData as any)?.[fieldKey] || ""];
		return (
			<div>
				<label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
					{containerLabel}
				</label>
				<div className="flex flex-col gap-1.5">
					{displayVal.map((v, i) => (
						<React.Fragment key={i}>{readOnlyBadge(v)}</React.Fragment>
					))}
				</div>
			</div>
		);
	}

	if (!hasContainers) {
		if (partnerCombobox) return renderPartnerCombobox(label);
		if (combobox)
			return (
				<ComboboxSelect
					fieldKey={fieldKey}
					label={label}
					options={combobox}
					{...sharedProps}
				/>
			);
		if (isDate)
			return <DateField fieldKey={fieldKey} label={label} {...sharedProps} />;
		return (
			<TextField
				fieldKey={fieldKey}
				label={label}
				type={isDatetime ? "datetime-local" : "text"}
				{...sharedProps}
			/>
		);
	}

	if (vals.length <= 1) {
		if (partnerCombobox) return renderPartnerCombobox(containerLabel);
		if (combobox)
			return (
				<ComboboxSelect
					fieldKey={fieldKey}
					label={containerLabel}
					options={combobox}
					{...sharedProps}
				/>
			);
		if (isDate)
			return (
				<DateField
					fieldKey={fieldKey}
					label={containerLabel}
					{...sharedProps}
				/>
			);
		return (
			<TextField
				fieldKey={fieldKey}
				label={containerLabel}
				type={isDatetime ? "datetime-local" : "text"}
				{...sharedProps}
			/>
		);
	}

	return (
		<div>
			<div className="flex items-center justify-between mb-2">
				<label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
					{containerLabel}
				</label>
				<button
					type="button"
					onClick={() => setOverriding((v) => !v)}
					className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-indigo-500 hover:text-indigo-700 transition-colors"
				>
					{overriding ? (
						<>
							<X className="size-3" /> Cancel
						</>
					) : (
						<>
							<Pencil className="size-3" /> Override all
						</>
					)}
				</button>
			</div>
			{overriding ? (
				<div className="space-y-1.5">
					<p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
						Saving will apply this value to all containers
					</p>
					{partnerCombobox ? (
						renderPartnerCombobox("")
					) : combobox ? (
						<ComboboxSelect
							fieldKey={fieldKey}
							label=""
							options={combobox}
							{...sharedProps}
						/>
					) : isDate ? (
						<DateField fieldKey={fieldKey} label="" {...sharedProps} />
					) : (
						<TextField
							fieldKey={fieldKey}
							label=""
							type={isDatetime ? "datetime-local" : "text"}
							{...sharedProps}
						/>
					)}
				</div>
			) : (
				<div className="flex flex-col gap-1.5">
					{vals.map((v, i) => (
						<div
							key={i}
							className="text-xs font-medium text-slate-700 dark:text-slate-300 py-1.5 px-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-md"
						>
							{formatBadge(v)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function FCRField({
	fieldKey,
	label,
	vals,
	hasFCRs,
	isDate = false,
	combobox,
	readOnly = false,
	formData,
	onFieldChange,
}: FieldSharedProps & {
	fieldKey: string;
	label: string;
	vals: string[];
	hasFCRs: boolean;
	isDate?: boolean;
	combobox?: Array<{ id: string; name: string }>;
	readOnly?: boolean;
}) {
	const [overriding, setOverriding] = React.useState(false);
	const fcrLabel = hasFCRs ? `${label} (from FCR)` : label;
	const sharedProps = { formData, onFieldChange, readOnly };

	if (!hasFCRs) {
		if (combobox)
			return (
				<ComboboxSelect
					fieldKey={fieldKey}
					label={label}
					options={combobox}
					{...sharedProps}
				/>
			);
		if (isDate)
			return <DateField fieldKey={fieldKey} label={label} {...sharedProps} />;
		return <TextField fieldKey={fieldKey} label={label} {...sharedProps} />;
	}

	if (vals.length <= 1) {
		if (combobox)
			return (
				<ComboboxSelect
					fieldKey={fieldKey}
					label={fcrLabel}
					options={combobox}
					{...sharedProps}
				/>
			);
		if (isDate)
			return (
				<DateField fieldKey={fieldKey} label={fcrLabel} {...sharedProps} />
			);
		return <TextField fieldKey={fieldKey} label={fcrLabel} {...sharedProps} />;
	}

	return (
		<div>
			<div className="flex items-center justify-between mb-2">
				<label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
					{fcrLabel}
				</label>
				{!readOnly && (
					<button
						type="button"
						onClick={() => setOverriding((v) => !v)}
						className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-indigo-500 hover:text-indigo-700 transition-colors"
					>
						{overriding ? (
							<>
								<X className="size-3" /> Cancel
							</>
						) : (
							<>
								<Pencil className="size-3" /> Override all
							</>
						)}
					</button>
				)}
			</div>
			{overriding && !readOnly ? (
				<div className="space-y-1.5">
					<p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
						Saving will apply this value to all FCRs
					</p>
					{combobox ? (
						<ComboboxSelect
							fieldKey={fieldKey}
							label=""
							options={combobox}
							{...sharedProps}
						/>
					) : isDate ? (
						<DateField fieldKey={fieldKey} label="" {...sharedProps} />
					) : (
						<TextField fieldKey={fieldKey} label="" {...sharedProps} />
					)}
				</div>
			) : (
				<div className="flex flex-col gap-1.5">
					{vals.map((v, i) => (
						<div
							key={i}
							className={cn(
								"text-xs font-medium py-1.5 px-3 border rounded-md",
								readOnly
									? "text-slate-400 bg-slate-50 border-slate-200 cursor-not-allowed"
									: "text-slate-700 dark:text-slate-300 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/40",
							)}
						>
							{isDate ? formatDateBadge(v) : v}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

// Simple stateless field helpers (no hooks, safe to use anywhere)
function TextField({
	fieldKey,
	label,
	type = "text",
	readOnly = false,
	customValue,
	formData,
	onFieldChange,
}: FieldSharedProps & {
	fieldKey: string;
	label: string;
	type?: "text" | "number" | "datetime-local";
	readOnly?: boolean;
	customValue?: string | number;
}) {
	return (
		<div>
			<label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
				{label}
			</label>
			<Input
				type={type}
				value={
					customValue !== undefined ? customValue : (formData[fieldKey] ?? "")
				}
				onChange={(e) => onFieldChange(fieldKey, e.target.value)}
				disabled={readOnly}
				className={cn(
					"text-sm",
					readOnly &&
						"bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed",
				)}
			/>
		</div>
	);
}

function DateField({
	fieldKey,
	label,
	readOnly = false,
	formData,
	onFieldChange,
}: FieldSharedProps & {
	fieldKey: string;
	label: string;
	readOnly?: boolean;
}) {
	return (
		<div>
			<label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
				{label}
			</label>
			<Input
				type="date"
				value={toDateInputValue(formData[fieldKey])}
				onChange={(e) => onFieldChange(fieldKey, e.target.value)}
				disabled={readOnly}
				className={cn(
					"text-sm",
					readOnly &&
						"bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed",
				)}
			/>
		</div>
	);
}

function DateTimeField({
	fieldKey,
	label,
	readOnly = false,
	formData,
	onFieldChange,
}: FieldSharedProps & {
	fieldKey: string;
	label: string;
	readOnly?: boolean;
}) {
	return (
		<div>
			<label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
				{label}
			</label>
			<Input
				type="datetime-local"
				value={toDatetimeInputValue(formData[fieldKey])}
				onChange={(e) => onFieldChange(fieldKey, e.target.value || null)}
				disabled={readOnly}
				className={cn(
					"text-sm",
					readOnly &&
						"bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed",
				)}
			/>
		</div>
	);
}

function BooleanToggleField({
	fieldKey,
	label,
	formData,
	onFieldChange,
}: FieldSharedProps & { fieldKey: string; label: string }) {
	const value = formData[fieldKey] === true;
	return (
		<div>
			<label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
				{label}
			</label>
			<button
				type="button"
				onClick={() => onFieldChange(fieldKey, !value)}
				className={cn(
					"flex items-center gap-2 h-10 px-3 w-full border rounded-md text-sm font-medium transition-colors text-left",
					value
						? "bg-green-50 border-green-300 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400"
						: "bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-500",
				)}
			>
				<span
					className={cn(
						"inline-flex size-5 rounded-full border-2 items-center justify-center transition-colors shrink-0",
						value
							? "bg-green-500 border-green-500"
							: "bg-white border-slate-300 dark:bg-slate-700 dark:border-slate-600",
					)}
				>
					{value && <span className="text-white text-[10px] font-bold">✓</span>}
				</span>
				{value ? "Có" : "Không"}
			</button>
		</div>
	);
}

function SelectField({
	fieldKey,
	label,
	options,
	formData,
	onFieldChange,
}: FieldSharedProps & {
	fieldKey: string;
	label: string;
	options: Array<{ id: string; name: string; color?: string }>;
}) {
	const [open, setOpen] = React.useState(false);
	const selected = options.find((o) => o.id === formData[fieldKey]);
	return (
		<div>
			<label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
				{label}
			</label>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger
					render={
						<Button
							variant="outline"
							role="combobox"
							aria-expanded={open}
							className="w-full justify-between font-normal h-10 text-sm"
						/>
					}
				>
					{selected ? (
						<span className="truncate">{selected.name}</span>
					) : (
						<span className="text-muted-foreground italic opacity-60">
							Chọn...
						</span>
					)}
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</PopoverTrigger>
				<PopoverPositioner className="z-[110]" sideOffset={4}>
					<PopoverContent className="w-full p-0">
						<Command>
							<CommandList>
								<CommandGroup>
									<CommandItem
										onSelect={() => {
											onFieldChange(fieldKey, null);
											setOpen(false);
										}}
									>
										<Check
											className={cn(
												"mr-2 h-4 w-4",
												!formData[fieldKey] ? "opacity-100" : "opacity-0",
											)}
										/>
										<span className="text-muted-foreground italic">Clear</span>
									</CommandItem>
									{options.map((opt) => (
										<CommandItem
											key={opt.id}
											onSelect={() => {
												onFieldChange(fieldKey, opt.id);
												setOpen(false);
											}}
										>
											<Check
												className={cn(
													"mr-2 h-4 w-4",
													formData[fieldKey] === opt.id
														? "opacity-100"
														: "opacity-0",
												)}
											/>
											{opt.name}
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

interface InformationPanelEditableProps {
	row: TruckingFollowUpRow;
	formData: any;
	onFieldChange: (field: string, value: any) => void;
	handlerOpen: boolean;
	setHandlerOpen: (open: boolean) => void;
}

export function InformationPanelEditable({
	row,
	formData,
	onFieldChange,
	handlerOpen,
	setHandlerOpen,
}: InformationPanelEditableProps) {
	const { users: siteUsers } = useSiteUsers("Trucking");
	const { vendors } = useVendors();
	const { ops } = useOps();
	const { airports } = useAirports();
	const airportOptions = airports
		.filter((a) => a.id !== "")
		.map((a) => ({ id: a.name, name: a.name }));
	const { shippingLines } = useShippingLines(
		row.domain || undefined,
		row.operationType,
	);
	const { ports: destinationPorts } = useForeignPorts("DESTINATION");
	const { ports: transitPorts } = useForeignPorts("TRANSIT");
	const { pickOrLiftPlaces } = usePickOrLiftPlaces();
	const { truckTypes } = useTruckTypes();

	const hasContainers = (row.containers?.length ?? 0) > 0;

	// For each container-sourced field: compute unique values to know if multi-value display is needed
	const containerFieldValues = React.useMemo(() => {
		const containers = row.containers || [];
		const uniqueVals = (
			getter: (c: (typeof containers)[0]) => string | null | undefined,
		) => [...new Set(containers.map(getter).filter(Boolean))] as string[];

		const fmt = (val: string) => {
			const d = new Date(val);
			if (Number.isNaN(d.getTime())) return val;
			return (
				d.toLocaleDateString("vi-VN") +
				" " +
				d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
			);
		};

		return {
			cutOffTime: uniqueVals((c) => c.cutOffTime),
			closingTime: uniqueVals((c) => c.closingTime),
			vesselName: uniqueVals((c) => c.vesselName),
			veselNumber: uniqueVals((c) => c.veselNumber),
			pickOrLiftPlace: uniqueVals((c) => c.pickOrLiftPlace),
			maLo: uniqueVals((c) => c.maLo),
			invoiceTaxCode: uniqueVals((c) => c.vatTaxCode),
			warehouse: uniqueVals((c) => c.warehouse),
			fmt,
		};
	}, [row.containers]);

	// Aggregate values from FCRs for location/truck/vendor fields
	const fcrAggregates = React.useMemo(() => {
		const fcrs = row.fcrs || [];
		const hasFCRs = fcrs.length > 0;

		const unique = <T,>(arr: (T | null | undefined)[]): T[] => [
			...new Set(arr.filter((v): v is T => !!v)),
		];

		const uniqueVals = (
			getter: (f: (typeof fcrs)[0]) => string | null | undefined,
		): string[] => unique(fcrs.map(getter));

		if (!hasFCRs)
			return {
				fromLocation: [],
				toLocation: [],
				truckType: [],
				tTypeC: [],
				vendor: [],
				warehouse: [],
				implementationDate: [],
			};

		return {
			fromLocation: uniqueVals((f) => f.pickupAt),
			toLocation: uniqueVals((f) => f.deliveryAt),
			truckType: uniqueVals((f) => f.truckType),
			tTypeC: uniqueVals((f) => f.tTypeC),
			vendor: uniqueVals((f) => f.vendor),
			warehouse: uniqueVals((f) => f.warehouse),
			implementationDate: uniqueVals((f) => f.implementationDate),
		};
	}, [row.fcrs]);

	// Calculate gross weight display (same logic as table cell)
	const grossWeightDisplay = React.useMemo(() => {
		// 1. Check containers first
		if (row.containers && row.containers.length > 0) {
			const total = row.containers.reduce(
				(sum, c) => sum + (Number(c.grossWeight) || 0),
				0,
			);
			return { value: total, readOnly: true, source: "containers" };
		}

		// 2. Fallback to FCRs if no containers
		if (row.fcrs && row.fcrs.length > 0) {
			const total = row.fcrs.reduce(
				(sum, f) => sum + (Number(f.grossWeight) || 0),
				0,
			);
			// If more than 1 FCR, it must be read-only aggregate
			return {
				value: total,
				readOnly: row.fcrs.length > 1,
				source: row.fcrs.length > 1 ? "fcrs" : null,
			};
		}

		// 3. No containers/FCRs: use direct field value
		return { value: formData.grossWeight ?? "", readOnly: false, source: null };
	}, [row.containers, row.fcrs, formData.grossWeight]);

	// Don Vi Khu Trung options

	// Eport Service options
	const EPORT_SERVICE_OPTIONS = [
		"KHÔNG KIỂM HÓA",
		"KIỂM HÓA",
		"KIỂM HÓA 100%",
		"KHỬ TRÙNG",
	];

	// Thin render helpers — no hooks, safe to call conditionally
	const renderInput = (
		key: string,
		label: string,
		type: "text" | "number" | "datetime-local" = "text",
		readOnly = false,
		customValue?: string | number,
	) => (
		<TextField
			fieldKey={key}
			label={label}
			type={type}
			readOnly={readOnly}
			customValue={customValue}
			formData={formData}
			onFieldChange={onFieldChange}
		/>
	);

	const renderTextarea = (key: string, label: string, readOnly = false) => (
		<div>
			<label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
				{label}
			</label>
			<Textarea
				value={formData[key] ?? ""}
				onChange={(e) => onFieldChange(key, e.target.value)}
				disabled={readOnly}
				rows={3}
				className={cn(
					"text-sm resize-none",
					readOnly &&
						"bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed",
				)}
			/>
		</div>
	);

	const renderReadOnlyField = (label: string, value: React.ReactNode) => (
		<div>
			<label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
				{label}
			</label>
			<div className="text-sm font-medium text-slate-900 dark:text-slate-100 py-2 px-3 bg-slate-100 dark:bg-slate-800 rounded-md">
				{value || <span className="text-slate-400 dark:text-slate-600">—</span>}
			</div>
		</div>
	);

	const renderCombobox = (
		key: string,
		label: string,
		options: Array<{ id: string; name: string }>,
		readOnly = false,
	) => (
		<ComboboxSelect
			fieldKey={key}
			label={label}
			options={options}
			readOnly={readOnly}
			formData={formData}
			onFieldChange={onFieldChange}
		/>
	);

	const renderDateInput = (key: string, label: string, readOnly = false) => (
		<DateField
			fieldKey={key}
			label={label}
			readOnly={readOnly}
			formData={formData}
			onFieldChange={onFieldChange}
		/>
	);

	const renderDatetimeInput = (
		key: string,
		label: string,
		readOnly = false,
	) => (
		<DateTimeField
			fieldKey={key}
			label={label}
			readOnly={readOnly}
			formData={formData}
			onFieldChange={onFieldChange}
		/>
	);

	const renderHandlerSelect = () => {
		const selectedUser = siteUsers.find((u) => u.id === formData.handler);

		return (
			<div>
				<label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
					{L.handler}
				</label>
				<Popover open={handlerOpen} onOpenChange={setHandlerOpen}>
					<PopoverTrigger
						render={
							<Button
								variant="outline"
								role="combobox"
								aria-expanded={handlerOpen}
								className="w-full justify-between font-normal h-10"
							/>
						}
					>
						{selectedUser ? (
							<UserDisplay user={selectedUser} size="sm" />
						) : (
							<span className="text-muted-foreground">Select handler...</span>
						)}
						<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</PopoverTrigger>
					<PopoverPositioner className="z-[110]" sideOffset={4}>
						<PopoverContent className="w-full p-0">
							<Command>
								<CommandInput placeholder="Search handlers..." />
								<CommandList>
									<CommandEmpty>No handler found.</CommandEmpty>
									<CommandGroup>
										<CommandItem
											onSelect={() => {
												onFieldChange("handler", "");
												setHandlerOpen(false);
											}}
										>
											<Check
												className={cn(
													"mr-2 h-4 w-4",
													!formData.handler ? "opacity-100" : "opacity-0",
												)}
											/>
											<span className="text-muted-foreground italic">
												Clear selection
											</span>
										</CommandItem>
										{siteUsers.map((user) => (
											<CommandItem
												key={user.id}
												onSelect={() => {
													onFieldChange("handler", user.id);
													setHandlerOpen(false);
												}}
											>
												<Check
													className={cn(
														"mr-2 h-4 w-4",
														formData.handler === user.id
															? "opacity-100"
															: "opacity-0",
													)}
												/>
												<UserDisplay user={user} size="sm" />
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
	};

	const fp = { formData, onFieldChange };
	const hasFCRs = (row.fcrs?.length ?? 0) > 0;

	return (
		<div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 pb-10">
			{/* SECTION 1: BASIC INFORMATION */}
			<div className="space-y-6">
				<div className="flex items-center gap-3 border-b pb-3 border-slate-200 dark:border-slate-800">
					<div className="size-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
						<Settings2 className="size-5" />
					</div>
					<h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">
						Basic Information
					</h3>
				</div>
				<div className="grid gap-4 sm:gap-6 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
					{renderReadOnlyField("Tax Code", row.taxCode)}
					{renderReadOnlyField(
						L.operationType,
						row.operationType ? (
							<Badge
								variant={row.operationType === "XUAT" ? "orange" : "cyan"}
								className="text-xs font-semibold"
							>
								{row.operationType}
							</Badge>
						) : null,
					)}
					{renderReadOnlyField(L.requestNumber, row.requestNumber)}
					{renderReadOnlyField(
						L.logJobs,
						row.followUps && row.followUps.length > 0 ? (
							<div className="flex flex-wrap gap-1.5">
								{row.followUps.map((f: any) => (
									<Link
										key={f.id}
										href={`/internal/followup?search=${f.jobNumber}`}
										className="inline-flex items-center"
									>
										<Badge
											variant="outline"
											className="bg-indigo-50/50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800 hover:bg-indigo-100 transition-colors cursor-pointer font-medium py-1"
										>
											{f.jobNumber}
										</Badge>
									</Link>
								))}
							</div>
						) : (
							<span className="text-slate-400 italic text-sm">—</span>
						),
					)}
					{renderHandlerSelect()}
				</div>
			</div>

			{/* SECTION 2: LOGISTICS & TRANSPORTATION */}
			<div className="space-y-6">
				<div className="flex items-center gap-3 border-b pb-3 border-slate-200 dark:border-slate-800">
					<div className="size-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
						<Truck className="size-5" />
					</div>
					<h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">
						Logistics & Transportation
					</h3>
				</div>
				<div className="grid gap-4 sm:gap-6 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
					{renderReadOnlyField(
						L.serviceMode,
						row.serviceMode ? (
							<Badge variant="purple" className="text-xs font-semibold">
								{row.serviceMode}
							</Badge>
						) : null,
					)}
					<FCRField
						fieldKey="vendor"
						label={L.vendor}
						vals={fcrAggregates.vendor}
						hasFCRs={hasFCRs}
						combobox={vendors.map((v) => ({ id: v, name: v }))}
						{...fp}
					/>
					<FCRField
						fieldKey="truckType"
						label={L.truckType}
						vals={fcrAggregates.truckType}
						hasFCRs={hasFCRs}
						combobox={truckTypes.map((t) => ({ id: t, name: t }))}
						readOnly={hasContainers}
						{...fp}
					/>
					<FCRField
						fieldKey="tTypeC"
						label={L.tTypeC}
						vals={fcrAggregates.tTypeC}
						hasFCRs={hasFCRs}
						combobox={truckTypes.map((t) => ({ id: t, name: t }))}
						readOnly={hasContainers}
						{...fp}
					/>
					{renderCombobox(
						"ops",
						L.ops,
						ops.map((o) => ({ id: o, name: o })),
					)}
					{renderInput("billOrBooking", L.billOrBooking)}
					{renderInput("commodityName", L.commodityName)}
					<FCRField
						fieldKey="fromLocation"
						label={L.fromLocation}
						vals={fcrAggregates.fromLocation}
						hasFCRs={hasFCRs}
						combobox={airportOptions}
						{...fp}
					/>
					<FCRField
						fieldKey="toLocation"
						label={L.toLocation}
						vals={fcrAggregates.toLocation}
						hasFCRs={hasFCRs}
						combobox={airportOptions}
						{...fp}
					/>
					<ContainerField
						fieldKey="pickOrLiftPlace"
						label={L.pickOrLiftPlace}
						vals={containerFieldValues.pickOrLiftPlace}
						hasContainers={hasContainers}
						combobox={pickOrLiftPlaces.map((p: string) => ({ id: p, name: p }))}
						{...fp}
					/>
					{renderCombobox(
						"carrierName",
						L.carrierName,
						shippingLines.map((s) => ({ id: s.name, name: s.name })),
					)}
					<FCRField
						fieldKey="warehouse"
						label={L.warehouse}
						vals={fcrAggregates.warehouse}
						hasFCRs={hasFCRs}
						{...fp}
					/>
					<ContainerField
						fieldKey="vesselName"
						label={L.vesselName}
						vals={containerFieldValues.vesselName}
						hasContainers={hasContainers}
						{...fp}
					/>
					<ContainerField
						fieldKey="veselNumber"
						label={L.veselNumber}
						vals={containerFieldValues.veselNumber}
						hasContainers={hasContainers}
						{...fp}
					/>
					<ContainerField
						fieldKey="closingTime"
						label={L.closingTime}
						vals={containerFieldValues.closingTime}
						hasContainers={hasContainers}
						isDate
						{...fp}
					/>
					<ContainerField
						fieldKey="cutOffTime"
						label={L.cutOffTime}
						vals={containerFieldValues.cutOffTime}
						hasContainers={hasContainers}
						isDatetime
						{...fp}
					/>
					{renderInput("pickUpTime", L.pickUpTime)}
					{renderTextarea("routineDetail", L.routineDetail)}
				</div>
			</div>

			{/* SECTION 3: CARGO & WEIGHT */}
			<div className="space-y-6">
				<div className="flex items-center gap-3 border-b pb-3 border-slate-200 dark:border-slate-800">
					<div className="size-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
						<Package className="size-5" />
					</div>
					<h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">
						Cargo & Weight
					</h3>
				</div>
				<div className="grid gap-4 sm:gap-6 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
					{renderInput("cbm", L.cbm, "number")}
					{renderInput(
						"grossWeight",
						grossWeightDisplay.source === "containers"
							? `${L.grossWeight} (from containers)`
							: grossWeightDisplay.source === "fcrs"
								? `${L.grossWeight} (from FCRs)`
								: L.grossWeight,
						"number",
						grossWeightDisplay.readOnly,
						grossWeightDisplay.value,
					)}
					{renderInput("quantity", L.quantity, "number")}
					{renderInput("hsCode", L.hsCode)}
					{renderInput("temperature", L.temperature, "number")}
				</div>
			</div>

			{/* SECTION 4: CUSTOMS & INSPECTION */}
			<div className="space-y-6">
				<div className="flex items-center gap-3 border-b pb-3 border-slate-200 dark:border-slate-800">
					<div className="size-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
						<Settings2 className="size-5" />
					</div>
					<h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">
						Customs & Inspection
					</h3>
				</div>
				<div className="grid gap-4 sm:gap-6 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
					{renderInput("authority", L.authority)}
					{renderCombobox(
						"donViKhuTrung",
						L.donViKhuTrung,
						DON_VI_KHU_TRUNG_OPTIONS,
					)}
					{renderCombobox(
						"eportService",
						L.eportService,
						EPORT_SERVICE_OPTIONS.map((v) => ({ id: v, name: v })),
					)}
					{renderInput("eportBooking", L.eportBooking)}
					<ContainerField
						fieldKey="invoiceTaxCode"
						label={L.invoiceTaxCode}
						vals={containerFieldValues.invoiceTaxCode}
						hasContainers={hasContainers}
						partnerCombobox
						{...fp}
					/>
					<ContainerField
						fieldKey="maLo"
						label={L.maLo}
						vals={containerFieldValues.maLo}
						hasContainers={hasContainers}
						readOnly
						{...fp}
					/>
					{renderInput("maNhanConmt", L.maNhanConmt)}
					{renderInput("soLenh", L.soLenh)}
				</div>
			</div>

			{/* SECTION 5: LOCATIONS & CONTACT */}
			<div className="space-y-6">
				<div className="flex items-center gap-3 border-b pb-3 border-slate-200 dark:border-slate-800">
					<div className="size-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
						<Settings2 className="size-5" />
					</div>
					<h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">
						Locations & Contact
					</h3>
				</div>
				<div className="grid gap-4 sm:gap-6 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
					{renderCombobox(
						"transitPort",
						L.transitPort,
						transitPorts.map((p) => ({ id: p.name, name: p.name })),
					)}
					{renderCombobox(
						"destinationPort",
						L.destinationPort,
						destinationPorts.map((p) => ({ id: p.name, name: p.name })),
					)}
					{renderTextarea("deliveryContactDetail", L.deliveryContactDetail)}
				</div>
			</div>

			{/* SECTION 6: DATES & PAYMENT */}
			<div className="space-y-6">
				<div className="flex items-center gap-3 border-b pb-3 border-slate-200 dark:border-slate-800">
					<div className="size-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
						<Settings2 className="size-5" />
					</div>
					<h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">
						Dates & Payment
					</h3>
				</div>
				<div className="grid gap-4 sm:gap-6 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
					{renderDatetimeInput("ngatDienDate", L.ngatDienDate)}
					<FCRField
						fieldKey="implementationDate"
						label={L.implementationDate}
						vals={fcrAggregates.implementationDate}
						hasFCRs={hasFCRs}
						isDate
						{...fp}
					/>
					{renderDateInput("payDate", L.payDate)}

					{renderInput("clientName", L.clientName)}
					<BooleanToggleField fieldKey="pvst" label={L.pvst} {...fp} />
					<BooleanToggleField
						fieldKey="bienBanBT"
						label={L.bienBanBT}
						{...fp}
					/>
					<SelectField
						fieldKey="checkNhapKho"
						label={L.checkNhapKho}
						options={CHECK_NHAP_KHO_OPTIONS.map((o) => ({
							id: o.id,
							name: o.name,
						}))}
						{...fp}
					/>
				</div>
			</div>

			{/* SECTION 7: NOTES */}
			<div className="space-y-6">
				<div className="flex items-center gap-3 border-b pb-3 border-slate-200 dark:border-slate-800">
					<div className="size-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
						<Settings2 className="size-5" />
					</div>
					<h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">
						Notes
					</h3>
				</div>
				<div className="grid gap-4 sm:gap-6 lg:gap-6 grid-cols-1">
					{renderTextarea("note", L.note)}
					{renderTextarea("note2", L.note2)}
					{renderTextarea("note3", L.note3)}
					{renderTextarea("note4", L.note4)}
					{renderTextarea("note5", L.note5)}
				</div>
			</div>
		</div>
	);
}
