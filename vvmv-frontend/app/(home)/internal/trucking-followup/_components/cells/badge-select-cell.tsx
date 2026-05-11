"use client";

import type { Table } from "@tanstack/react-table";
import { memo, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { stringToColorVariant } from "@/lib/utils/color-utils";
import {
	VirtualizedCombobox,
	type VirtualizedComboboxItem,
} from "../../../followup/_components/shared/virtualized-combobox";
import type { TruckingFollowUpRow } from "../../types";

interface BadgeSelectCellProps {
	getValue: () => unknown;
	row: { original: TruckingFollowUpRow };
	column: { id: string };
	table: Table<TruckingFollowUpRow>;
	items?: VirtualizedComboboxItem[];
	useDependency?: string;
	filterFn?: (
		item: Record<string, any>,
		rowOriginal: TruckingFollowUpRow,
	) => boolean;
	placeholder?: string;
	readOnly?: boolean;
	editable?: boolean;
	showBothIdAndName?: boolean;
	saveAsName?: boolean;
	selectedNameOnly?: boolean;
}

function BadgeSelectCellComponent({
	getValue,
	row: { original },
	column: { id },
	table,
	items: directItems,
	useDependency,
	filterFn,
	placeholder = "Select...",
	readOnly = false,
	editable = true,
	showBothIdAndName = false,
	saveAsName = false,
	selectedNameOnly = false,
}: BadgeSelectCellProps) {
	const initialValue = (getValue() as string | null | undefined) ?? "";
	const [isEditing, setIsEditing] = useState(false);
	const cellRef = useRef<HTMLDivElement>(null);

	const values = useMemo(() => {
		if (!initialValue) return [];
		return initialValue.split("\n").filter(Boolean);
	}, [initialValue]);

	const items = useMemo(() => {
		let resolved: Record<string, any>[] = [];
		if (directItems) {
			resolved = directItems;
		} else if (useDependency && (table.options.meta as any)?.dependencies) {
			resolved = (table.options.meta as any).dependencies[useDependency] || [];
		}
		if (filterFn) {
			resolved = resolved.filter((item) => filterFn(item, original));
		}
		// Ensure items conform to VirtualizedComboboxItem shape
		return resolved.map((item) => ({
			id: item.id ?? item.name,
			name: item.name,
		})) as VirtualizedComboboxItem[];
	}, [directItems, useDependency, filterFn, original, table.options.meta]);

	// Resolve display label: if items have a name different from id, show name
	const getDisplayLabel = (value: string) => {
		const match =
			items.find((item) => item.id === value) ||
			items.find((item) => item.name === value);
		if (match) {
			if (selectedNameOnly) {
				return match.name;
			}
			if (showBothIdAndName && match.id !== match.name) {
				return `${match.id} - ${match.name}`;
			}
			return match?.name && match.name !== match.id ? match.name : value;
		}
		return value;
	};

	const selectedValue = useMemo(() => {
		if (!initialValue) return "";
		const byId = items.find((item) => item.id === initialValue);
		if (byId) return byId.id;
		const byName = items.find((item) => item.name === initialValue);
		return byName?.id ?? "";
	}, [initialValue, items]);

	const handleChange = (newValue: string) => {
		const selectedItem = items.find((item) => item.id === newValue);
		const valueToSave =
			saveAsName && selectedItem ? selectedItem.name : newValue;

		(table.options.meta as any)?.updateData?.(original.id, id, valueToSave);
		setIsEditing(false);
	};

	const canEdit = editable && !readOnly;

	// View mode: show badges only (or if not editable, always show view mode)
	if (!isEditing || !canEdit) {
		return (
			<div
				ref={cellRef}
				className={cn(
					"w-full h-full flex items-center px-1 py-1 rounded transition-colors",
					canEdit && "cursor-pointer hover:bg-muted/30",
				)}
				onClick={() => canEdit && setIsEditing(true)}
			>
				{values.length > 1 ? (
					<div className="flex flex-wrap gap-1 w-full min-w-0">
						{values.map((v, i) => (
							<Badge
								key={i}
								variant={stringToColorVariant(v)}
								className="px-2.5 py-0.5 text-xs font-medium max-w-full truncate block"
							>
								{getDisplayLabel(v)}
							</Badge>
						))}
					</div>
				) : values.length === 1 ? (
					<Badge
						variant={stringToColorVariant(values[0])}
						className="px-3 py-1 text-xs font-semibold tracking-tight shadow-sm max-w-full truncate block"
					>
						{getDisplayLabel(values[0])}
					</Badge>
				) : (
					<span className="text-muted-foreground text-xs opacity-50">
						{readOnly ? "—" : placeholder}
					</span>
				)}
			</div>
		);
	}

	// Edit mode: show combobox
	return (
		<div className="w-full h-full flex items-center px-1 py-1">
			<VirtualizedCombobox
				items={items}
				value={selectedValue}
				onChange={handleChange}
				placeholder={placeholder}
				triggerClassName={cn(
					"border-none bg-transparent hover:bg-muted/30 focus:ring-1 focus:ring-ring h-auto min-h-[2rem] text-xs px-1 w-full transition-all",
					initialValue ? "opacity-100" : "opacity-50",
				)}
				displayValue="name"
				hideId={!showBothIdAndName}
				showClearOption={true}
				autoFocus={true}
				defaultOpen={true}
				onBlur={() => setIsEditing(false)}
			/>
		</div>
	);
}

function arePropsEqual(
	prevProps: BadgeSelectCellProps,
	nextProps: BadgeSelectCellProps,
) {
	const depKey = nextProps.useDependency;
	const prevDeps = (prevProps.table.options.meta as any)?.dependencies;
	const nextDeps = (nextProps.table.options.meta as any)?.dependencies;
	const prevDepData = depKey ? prevDeps?.[depKey] : undefined;
	const nextDepData = depKey ? nextDeps?.[depKey] : undefined;

	return (
		prevProps.getValue() === nextProps.getValue() &&
		prevProps.row.original.id === nextProps.row.original.id &&
		prevProps.row.original.operationType ===
			nextProps.row.original.operationType &&
		prevProps.column.id === nextProps.column.id &&
		prevProps.readOnly === nextProps.readOnly &&
		prevProps.editable === nextProps.editable &&
		prevProps.showBothIdAndName === nextProps.showBothIdAndName &&
		prevProps.saveAsName === nextProps.saveAsName &&
		prevProps.selectedNameOnly === nextProps.selectedNameOnly &&
		prevProps.items === nextProps.items &&
		prevProps.filterFn === nextProps.filterFn &&
		prevDepData === nextDepData
	);
}

export const BadgeSelectCell = memo(BadgeSelectCellComponent, arePropsEqual);
