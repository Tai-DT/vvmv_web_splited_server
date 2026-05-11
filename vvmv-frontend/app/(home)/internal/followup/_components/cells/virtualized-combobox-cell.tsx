"use client";

import type { Table } from "@tanstack/react-table";
import { memo, useMemo } from "react";
import type { FollowUpRow } from "../../types";
import {
	VirtualizedCombobox,
	type VirtualizedComboboxItem,
} from "../shared/virtualized-combobox";
import { useCellTabIndex } from "./use-cell-tab-index";

interface VirtualizedComboboxCellProps {
	getValue: () => unknown;
	row: { original: FollowUpRow };
	column: { id: string };
	table: Table<FollowUpRow>;
	items?: VirtualizedComboboxItem[];
	useDependency?: string;
	placeholder?: string;
	readOnly?: boolean;
}

/**
 * VirtualizedComboboxCell Component
 *
 * A cell component that uses VirtualizedCombobox for editing.
 * Especially useful for long lists of options like Vendors or Partners.
 */
function VirtualizedComboboxCellComponent({
	getValue,
	row: { original },
	column: { id },
	table,
	items: directItems,
	useDependency,
	placeholder = "Select...",
	readOnly = false,
}: VirtualizedComboboxCellProps) {
	const initialValue = (getValue() as string | null | undefined) ?? "";

	// Calculate tabIndex based on visual column order
	const _tabIndex = useCellTabIndex(table, original.id, id);

	// Resolve items from props or table meta dependencies
	const items = useMemo(() => {
		if (directItems) return directItems;
		if (useDependency && (table.options.meta as any)?.dependencies) {
			return (table.options.meta as any).dependencies[useDependency] || [];
		}
		return [];
	}, [directItems, useDependency, table.options.meta]);

	const handleChange = (newValue: string) => {
		(table.options.meta as any)?.updateData?.(original.id, id, newValue);
	};

	return (
		<div className="w-full h-full flex items-center px-1">
			<VirtualizedCombobox
				items={items}
				value={initialValue}
				onChange={handleChange}
				disabled={(original as any).canEdit === false || readOnly}
				placeholder={placeholder}
				triggerClassName="border-none bg-transparent hover:bg-muted/50 focus:ring-1 focus:ring-ring h-auto min-h-[1.75rem] text-xs px-1 w-full"
				displayValue="name"
				hideId={true}
				showClearOption={true}
			/>
		</div>
	);
}

// Custom comparison function for memo
function arePropsEqual(
	prevProps: VirtualizedComboboxCellProps,
	nextProps: VirtualizedComboboxCellProps,
) {
	return (
		prevProps.getValue() === nextProps.getValue() &&
		prevProps.row.original.id === nextProps.row.original.id &&
		prevProps.column.id === nextProps.column.id &&
		prevProps.readOnly === nextProps.readOnly &&
		prevProps.items === nextProps.items
	);
}

export const VirtualizedComboboxCell = memo(
	VirtualizedComboboxCellComponent,
	arePropsEqual,
);
