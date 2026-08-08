"use client";

import type { Table } from "@tanstack/react-table";
import { Check, ChevronsUpDown } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverPositioner,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { FollowUpRow } from "../../types";
import { useCellTabIndex } from "./use-cell-tab-index";

export type ComboboxOption = {
	id: string;
	name: string;
};

interface ComboboxCellProps {
	getValue: () => unknown;
	row: { original: FollowUpRow };
	column: { id: string };
	table: Table<FollowUpRow>;
	options?: ComboboxOption[];
	useDependency?: string;
	placeholder?: string;
	includeEmpty?: boolean;
	readOnly?: boolean;
}

/**
 * ComboboxCell Component
 *
 * A cell component with view/edit mode for searchable dropdown selection.
 * - View mode: displays plain text (resolved name from ID), clickable to enter edit mode
 * - Edit mode: shows searchable combobox with options
 *
 * Features:
 * - Stores ID but displays Name
 * - Search/filter through options
 * - Click outside to close
 * - Keyboard navigation support via cmdk
 * - Memoized to prevent unnecessary re-renders
 * - Supports readOnly mode
 */
function ComboboxCellComponent({
	getValue,
	row: { original },
	column: { id },
	table,
	options: directOptions,
	useDependency,
	placeholder = "Select...",
	includeEmpty = false,
	readOnly = false,
}: ComboboxCellProps) {
	const initialValue = (getValue() as string | null | undefined) ?? "";
	const [open, setOpen] = useState(false);

	// Calculate tabIndex based on visual column order
	const tabIndex = useCellTabIndex(table, original.id, id);

	// Resolve options from props or table meta dependencies
	const options = useMemo(() => {
		let baseOptions: ComboboxOption[] = [];
		if (directOptions) {
			baseOptions = [...directOptions];
		} else if (useDependency && (table.options.meta as any)?.dependencies) {
			baseOptions =
				(table.options.meta as any).dependencies[useDependency] || [];
		}

		if (includeEmpty) {
			return [{ id: "", name: "Empty" }, ...baseOptions];
		}
		return baseOptions;
	}, [directOptions, useDependency, includeEmpty, table.options.meta]);

	const displayLabel = useMemo(() => {
		if (!initialValue) return "";
		const match = options.find((o) => o.id === initialValue);
		return match?.name ?? initialValue;
	}, [initialValue, options]);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<Button
						variant="ghost"
						role="combobox"
						aria-expanded={open}
						tabIndex={
							original.canEdit !== false && !readOnly ? tabIndex : undefined
						}
						disabled={original.canEdit === false || readOnly}
						className={cn(
							"w-full justify-between h-auto min-h-[32px] px-2 py-1 font-normal",
							(original.canEdit === false || readOnly) &&
								"opacity-100 cursor-default hover:bg-transparent",
						)}
					/>
				}
			>
				{displayLabel ? (
					<span className="truncate">{displayLabel}</span>
				) : (
					<span className="text-muted-foreground">{placeholder}</span>
				)}
				<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
			</PopoverTrigger>
			<PopoverPositioner>
				<PopoverContent className="w-[300px] p-0">
					<Command>
						<CommandInput placeholder="Search..." className="h-9" />
						<CommandList>
							<CommandEmpty>No results found.</CommandEmpty>
							<CommandGroup>
								{options.map((option, index) => (
									<CommandItem
										key={`${option.id}-${index}`}
										value={`${option.id} ${option.name}`}
										onSelect={() => {
											(table.options.meta as any)?.updateData?.(
												original.id,
												id,
												option.id,
											);
											setOpen(false);
										}}
										className="flex items-center justify-between"
									>
										<div className="flex items-center gap-3">
											<span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
												{option.id}
											</span>
											<span className="truncate text-muted-foreground">
												{option.name}
											</span>
										</div>
										<Check
											className={cn(
												"h-4 w-4 shrink-0",
												initialValue === option.id
													? "opacity-100"
													: "opacity-0",
											)}
										/>
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

// Custom comparison function for memo - only re-render if value or identity changes
function areComboboxCellPropsEqual(
	prevProps: ComboboxCellProps,
	nextProps: ComboboxCellProps,
) {
	if (prevProps.getValue() !== nextProps.getValue()) return false;
	if (prevProps.row.original.id !== nextProps.row.original.id) return false;
	if (prevProps.column.id !== nextProps.column.id) return false;
	if (prevProps.options !== nextProps.options) return false;
	if (prevProps.placeholder !== nextProps.placeholder) return false;
	if (prevProps.readOnly !== nextProps.readOnly) return false;
	if (prevProps.useDependency !== nextProps.useDependency) return false;
	if (prevProps.includeEmpty !== nextProps.includeEmpty) return false;

	const depKey = prevProps.useDependency;
	if (depKey) {
		const d1 = (
			prevProps.table.options.meta as { dependencies?: Record<string, unknown> }
		)?.dependencies?.[depKey];
		const d2 = (
			nextProps.table.options.meta as { dependencies?: Record<string, unknown> }
		)?.dependencies?.[depKey];
		if (d1 !== d2) return false;
	}
	return true;
}

export const ComboboxCell = memo(
	ComboboxCellComponent,
	areComboboxCellPropsEqual,
);
