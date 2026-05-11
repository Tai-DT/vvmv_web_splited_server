"use client";

import type { Table } from "@tanstack/react-table";
import { X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectPositioner,
	SelectTrigger,
} from "@/components/ui/select";
import { useCellTabIndex } from "./use-cell-tab-index";

export type SelectOption = string | { id: string; name: string };

interface SelectCellProps<T = any> {
	getValue: () => unknown;
	row: { original: T };
	column: { id: string };
	table: Table<T>;
	options?: SelectOption[];
	placeholder?: string;
	includeEmpty?: boolean;
	readOnly?: boolean;
}

/**
 * SelectCell Component
 *
 * A cell component for simple dropdown selection (no search).
 * Features:
 * - Supports string array or {id, name} object array
 * - Clear button to reset selection
 * - Memoized to prevent unnecessary re-renders
 * - Generic: works with any row type (FollowUpRow, TruckingFollowUpRow, etc.)
 */
function SelectCellComponent<T extends { id: string; canEdit?: boolean }>({
	getValue,
	row: { original },
	column: { id },
	table,
	options: directOptions = [],
	placeholder = "Select...",
	includeEmpty = false,
	readOnly = false,
}: SelectCellProps<T>) {
	const initialValue = (getValue() as string | null | undefined) ?? "";
	const [value, setValue] = useState(initialValue);

	// Calculate tabIndex based on visual column order
	const tabIndex = useCellTabIndex(table, original.id, id);

	// Sync external value changes
	useEffect(() => {
		setValue(initialValue);
	}, [initialValue]);

	// Normalize options to {id, name} format
	const options = useMemo(() => {
		const normalized = directOptions.map((opt) =>
			typeof opt === "string" ? { id: opt, name: opt } : opt,
		);

		if (includeEmpty) {
			return [{ id: "", name: "Empty" }, ...normalized];
		}
		return normalized;
	}, [directOptions, includeEmpty]);

	// Find display name for current value
	const displayValue = useMemo(() => {
		const option = options.find((opt) => opt.id === value);
		return option?.name || value;
	}, [value, options]);

	const handleValueChange = useCallback(
		(newValue: unknown) => {
			const selectedValue = Array.isArray(newValue)
				? (newValue[0] ?? "")
				: ((newValue as string) ?? "");
			setValue(selectedValue);
			(table.options.meta as any)?.updateData?.(original.id, id, selectedValue);
		},
		[table.options.meta, original.id, id],
	);

	const handleClear = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();
			setValue("");
			(table.options.meta as any)?.updateData?.(original.id, id, "");
		},
		[table.options.meta, original.id, id],
	);

	// Disabled state
	const isDisabled = original.canEdit === false || readOnly;

	return (
		<div className="flex items-center w-full min-w-0">
			<Select
				value={value ? [value] : []}
				onValueChange={handleValueChange}
				disabled={isDisabled}
			>
				<SelectTrigger
					tabIndex={!isDisabled ? tabIndex : undefined}
					className="min-w-0 flex-1 justify-between h-auto min-h-[32px] px-2 py-1 font-normal border-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 data-[disabled]:opacity-100 data-[disabled]:cursor-default hover:bg-accent/50 data-[disabled]:hover:bg-transparent"
				>
					{displayValue ? (
						<span className="truncate">{displayValue}</span>
					) : (
						<span className="text-muted-foreground">{placeholder}</span>
					)}
				</SelectTrigger>
				<SelectPositioner>
					<SelectContent className="w-[300px]">
						{options.map((option, index) => (
							<SelectItem key={`${option.id}-${index}`} value={option.id}>
								{option.name}
							</SelectItem>
						))}
					</SelectContent>
				</SelectPositioner>
			</Select>
			{value && !isDisabled && (
				<button
					type="button"
					onClick={handleClear}
					className="shrink-0 p-0.5 mr-1 rounded-sm hover:bg-red-50 text-destructive"
					title="Clear selection"
				>
					<X className="size-3.5" />
				</button>
			)}
		</div>
	);
}

// Custom comparison function for memo - only re-render if value or identity changes
function areSelectCellPropsEqual<T extends { id: string }>(
	prevProps: SelectCellProps<T>,
	nextProps: SelectCellProps<T>,
) {
	return (
		prevProps.getValue() === nextProps.getValue() &&
		prevProps.row.original.id === nextProps.row.original.id &&
		prevProps.column.id === nextProps.column.id &&
		prevProps.options === nextProps.options &&
		prevProps.placeholder === nextProps.placeholder &&
		prevProps.readOnly === nextProps.readOnly
	);
}

export const SelectCell = memo(
	SelectCellComponent,
	areSelectCellPropsEqual,
) as typeof SelectCellComponent;
