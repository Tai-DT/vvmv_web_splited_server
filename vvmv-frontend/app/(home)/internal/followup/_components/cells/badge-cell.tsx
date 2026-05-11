"use client";

import type { Table } from "@tanstack/react-table";
import type { VariantProps } from "class-variance-authority";
import { Check, ChevronDown, X } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverPositioner,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useCellTabIndex } from "./use-cell-tab-index";

type BadgeCellMode = "view" | "single" | "multiple";
type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];
type ColorVariantType =
	| "status"
	| "operation"
	| "service"
	| "eport"
	| "default";

import "../table/table-types"; // Ensure TableMeta augmentation is loaded

interface BadgeCellProps {
	getValue: () => unknown;
	row: { original: any };
	column: { id: string };
	table: Table<any>;
	mode?: BadgeCellMode;
	colorVariant?: ColorVariantType;
	options?: readonly string[];
	useDependency?: string;
}

// ============================================
// Color Mapping Functions
// ============================================

// Status colors (for Invoker tasks)
const STATUS_COLOR_MAP: Record<string, BadgeVariant> = {
	Processing: "info", // Blue
	Completed: "success", // Green
	Pending: "secondary", // Gray
	Error: "destructive", // Red
	Done: "indigo",
	Finished: "success",
	FAIL: "destructive", // Red
};

// Operation type colors
const OPERATION_COLOR_MAP: Record<string, BadgeVariant> = {
	XUAT: "orange",
	NHAP: "cyan",
};

// Service mode colors
const SERVICE_COLOR_MAP: Record<string, BadgeVariant> = {
	"LCL IMPORT": "info",
	"LCL EXPORT": "info",
	"FCL EXPORT": "purple",
	"FCL IMPORT": "purple",
	"CPN EXPORT": "violet",
	"CPN IMPORT": "violet",
	"AIR EXPORT": "sky",
	"AIR IMPORT": "sky",
	"TC EXPORT": "emerald",
	"TC IMPORT": "emerald",
	"DBO EXPORT": "fuchsia",
	"DBO IMPORT": "fuchsia",
	"CFS DONG NAI": "lime",
	"CFS VSIP1": "lime",
	"KNQ EXPORT": "indigo",
	"KNQ IMPORT": "indigo",
};

// Eport service colors (customs inspection types)
const EPORT_SERVICE_COLOR_MAP: Record<string, BadgeVariant> = {
	"KHÔNG KIỂM HÓA": "cyan", // Light blue - no inspection
	"KIỂM HÓA": "destructive", // Red - customs inspection
	"KIỂM HÓA 100%": "violet", // Purple - 100% inspection
	"KHỬ TRÙNG": "success", // Green - fumigation
};

/**
 * Get badge variant based on value and color variant type
 */
function getBadgeVariant(
	value: string,
	colorVariant: ColorVariantType = "default",
): BadgeVariant {
	switch (colorVariant) {
		case "status":
			return STATUS_COLOR_MAP[value] || "secondary";
		case "operation":
			return OPERATION_COLOR_MAP[value] || "secondary";
		case "service":
			return SERVICE_COLOR_MAP[value] || "secondary";
		case "eport":
			return EPORT_SERVICE_COLOR_MAP[value] || "secondary";
		default:
			// Legacy behavior - check all maps
			return (
				STATUS_COLOR_MAP[value] ||
				OPERATION_COLOR_MAP[value] ||
				SERVICE_COLOR_MAP[value] ||
				EPORT_SERVICE_COLOR_MAP[value] ||
				"secondary"
			);
	}
}

// ============================================
// StatusBadge Component (for Invoker status)
// ============================================

interface StatusBadgeProps {
	value: string;
	message: string;
	className?: string;
}

/**
 * StatusBadge - A simple badge component for displaying status
 * Uses the unified pill style with color mapping
 */
export function StatusBadge({ value, message, className }: StatusBadgeProps) {
	let messageStatus = value;
	if (value === "Completed" && message?.includes("FAIL - ")) {
		messageStatus = "FAIL";
	}

	const variant = STATUS_COLOR_MAP[messageStatus] || "secondary";
	return (
		<Badge variant={variant} className={className}>
			{value}
		</Badge>
	);
}

// ============================================
// BadgeCell Component
// ============================================

/**
 * BadgeCell Component
 *
 * A cell component that displays comma-separated values as multiple badges.
 * - View mode: displays badges in a flex wrap layout (read-only)
 * - Single mode: single-select dropdown with radio buttons
 * - Multiple mode: multi-select dropdown with checkboxes
 *
 * Features:
 * - Parses comma-separated NVARCHAR strings
 * - Color-codes badges based on colorVariant type
 * - Handles empty/null values gracefully
 * - Displays all badges with proper wrapping
 * - Click to edit with dropdown menu
 * - Memoized to prevent unnecessary re-renders
 */
function BadgeCellComponent({
	getValue,
	row,
	column,
	table,
	mode = "view",
	colorVariant = "default",
	options: directOptions,
	useDependency,
}: BadgeCellProps) {
	const options = useMemo(() => {
		if (directOptions) return [...directOptions];
		if (useDependency && (table.options.meta as any)?.dependencies) {
			return (table.options.meta as any).dependencies[useDependency] || [];
		}
		return [];
	}, [directOptions, useDependency, table.options.meta]);

	const rawValue = getValue() as string | null | undefined;
	const [isEditing, setIsEditing] = useState(false);

	// Calculate tabIndex based on visual column order
	const tabIndex = useCellTabIndex(table, row.original.id, column.id);

	// Parse comma-separated values into array - memoized to avoid recalculation
	const values = useMemo(
		() =>
			!rawValue || rawValue.trim() === ""
				? []
				: rawValue
						.split(",")
						.map((v) => v.trim())
						.filter((v) => v.length > 0),
		[rawValue],
	);

	// Memoize active values set
	const activeValues = useMemo(() => new Set(values), [values]);

	// Handler for multi-select (checkbox) - memoized
	const handleToggle = useCallback(
		(option: string) => {
			const newValues = new Set(activeValues);

			if (newValues.has(option)) {
				newValues.delete(option);
			} else {
				newValues.add(option);
			}

			const newValueString = Array.from(newValues).join(", ");

			// Only update if value actually changed
			if (newValueString !== rawValue) {
				(table.options.meta as any)?.updateData?.(
					row.original.id,
					column.id,
					newValueString,
				);
			}
		},
		[activeValues, table.options.meta, row.original.id, column.id, rawValue],
	);

	// Handler for single-select (radio) - memoized
	const handleSelect = useCallback(
		(option: string) => {
			// Only update if selection actually changed
			if (option !== rawValue) {
				(table.options.meta as any)?.updateData?.(
					row.original.id,
					column.id,
					option,
				);
			}
			setIsEditing(false);
		},
		[table.options.meta, row.original.id, column.id, rawValue],
	);

	// Render badges (used by all variants) - memoized to prevent recreation
	const renderBadges = useMemo(
		() => (
			<div className="flex flex-wrap gap-2">
				{values.length === 0 ? (
					<div className="py-1 px-2 text-muted-foreground text-xs italic">
						—
					</div>
				) : (
					values.map((value, idx) => (
						<Badge
							key={`${value}-${idx}`}
							className="text-xs px-1 py-0.5"
							variant={getBadgeVariant(value, colorVariant)}
						>
							{value}
						</Badge>
					))
				)}
			</div>
		),
		[values, colorVariant],
	);

	// View mode: display badges only (read-only)
	if (mode === "view") {
		return renderBadges;
	}

	// Editable variants: show searchable popover
	return (
		<Popover open={isEditing} onOpenChange={setIsEditing}>
			<PopoverTrigger
				render={
					<button
						onClick={() => {
							if (row.original.canEdit !== false) {
								setIsEditing(true);
							}
						}}
						tabIndex={row.original.canEdit !== false ? tabIndex : undefined}
						onKeyDown={(e) => {
							if (
								(e.key === "Enter" || e.key === " ") &&
								row.original.canEdit !== false
							) {
								e.preventDefault();
								setIsEditing(true);
							}
						}}
						className={cn(
							row.original.canEdit !== false
								? "cursor-pointer"
								: "cursor-default",
							"flex flex-wrap gap-2 w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[32px] items-center",
						)}
					>
						{renderBadges}
						{row.original.canEdit !== false && (
							<ChevronDown className="ml-auto h-3 w-3 opacity-50 shrink-0" />
						)}
					</button>
				}
			/>
			<PopoverPositioner align="start">
				<PopoverContent className="w-[300px] p-0">
					<Command>
						<CommandInput placeholder="Search..." className="h-9" />
						<CommandList>
							<CommandEmpty>No results found.</CommandEmpty>
							<CommandGroup>
								<CommandItem
									onSelect={() => {
										const newValue = mode === "single" ? "" : "";
										(table.options.meta as any)?.updateData?.(
											row.original.id,
											column.id,
											newValue,
										);
										if (mode === "single") setIsEditing(false);
									}}
									className="flex items-center gap-2 text-muted-foreground italic"
								>
									<X className="h-4 w-4" />
									Clear selection
								</CommandItem>
							</CommandGroup>
							<CommandSeparator />
							<CommandGroup>
								{options.map((option: any, index: number) => {
									const optValue =
										typeof option === "string" ? option : option.id;
									const optLabel =
										typeof option === "string" ? option : option.name;
									const isSelected =
										mode === "single"
											? rawValue === optValue
											: activeValues.has(optValue);

									return (
										<CommandItem
											key={`${optValue}-${index}`}
											value={`${optValue} ${optLabel}`}
											onSelect={() => {
												if (mode === "single") {
													handleSelect(optValue);
												} else {
													handleToggle(optValue);
												}
											}}
											className="flex items-center justify-between"
										>
											<div className="flex items-center gap-2 truncate">
												<span className="truncate">{optLabel}</span>
											</div>
											<Check
												className={cn(
													"h-4 w-4 shrink-0",
													isSelected ? "opacity-100" : "opacity-0",
												)}
											/>
										</CommandItem>
									);
								})}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</PopoverPositioner>
		</Popover>
	);
}

// Custom comparison function for memo - only re-render if value or identity changes
function areBadgeCellPropsEqual(
	prevProps: BadgeCellProps,
	nextProps: BadgeCellProps,
) {
	return (
		prevProps.getValue() === nextProps.getValue() &&
		prevProps.row.original.id === nextProps.row.original.id &&
		prevProps.column.id === nextProps.column.id &&
		prevProps.mode === nextProps.mode &&
		prevProps.colorVariant === nextProps.colorVariant &&
		prevProps.options === nextProps.options
	);
}

export const BadgeCell = memo(BadgeCellComponent, areBadgeCellPropsEqual);

/**
 * Predefined status values for use in multi-select dropdown (future)
 */
export const PREDEFINED_STATUSES = [
	"Waiting FAST Input",
	"Waiting FAST CDS",
	"Waiting Trucking Request",
	"Waiting FAST Finish",
	"Waiting CSHT Request",
	"Waiting TAX Request",
	"Waiting FOLLOW-UP Save",
	"Waiting FOLLOW-UP Retrieve",
	"Done",
] as const;

// Export color maps for external use
export {
	STATUS_COLOR_MAP,
	OPERATION_COLOR_MAP,
	SERVICE_COLOR_MAP,
	EPORT_SERVICE_COLOR_MAP,
	getBadgeVariant,
};
