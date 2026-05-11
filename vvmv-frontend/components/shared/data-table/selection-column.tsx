"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Creates a standard selection checkbox column for TanStack Table
 * This column should be added first (leftmost) in the table
 *
 * @template T - The row data type
 * @returns ColumnDef with selection checkbox functionality
 */
export function createSelectionColumn<T>(): ColumnDef<T> {
	return {
		id: "select",
		header: ({ table }) => {
			const allSelected = table.getIsAllPageRowsSelected();
			const someSelected = table.getIsSomePageRowsSelected();

			return (
				<Checkbox
					checked={allSelected}
					indeterminate={!allSelected && someSelected}
					onCheckedChange={(value: boolean) =>
						table.toggleAllPageRowsSelected(!!value)
					}
					aria-label="Select all"
				/>
			);
		},
		cell: ({ row }) => (
			<Checkbox
				checked={row.getIsSelected()}
				onCheckedChange={(value: boolean) => row.toggleSelected(!!value)}
				aria-label="Select row"
			/>
		),
		enableSorting: false,
		enableHiding: false,
		size: 40,
		minSize: 40,
		maxSize: 40,
	};
}
