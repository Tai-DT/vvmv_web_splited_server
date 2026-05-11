"use client";

import type { Column, ColumnDef } from "@tanstack/react-table";
import { BulkSelectionHeader } from "@/components/shared/data-table";
import type { FollowUpRow } from "../../types";
import { FOLLOWUP_HEADERS } from "./column-headers";
import { SortableHeader } from "./sortable-header";

/** Numeric sort for quantity / jobPriority (null jobPriority sorts as default P7). */
function compareFollowUpNumeric(
	rowA: { original: FollowUpRow },
	rowB: { original: FollowUpRow },
	columnId: string,
): number {
	const rawA = rowA.original[columnId as keyof FollowUpRow];
	const rawB = rowB.original[columnId as keyof FollowUpRow];

	const toNum = (raw: unknown): number => {
		if (raw === null || raw === undefined) {
			return columnId === "jobPriority" ? 7 : Number.NaN;
		}
		const n = Number(raw);
		return Number.isFinite(n) ? n : Number.NaN;
	};

	const na = toNum(rawA);
	const nb = toNum(rawB);

	if (Number.isNaN(na) && Number.isNaN(nb)) return 0;
	if (Number.isNaN(na)) return 1;
	if (Number.isNaN(nb)) return -1;
	return na === nb ? 0 : na < nb ? -1 : 1;
}

// Column Definitions
export const getColumns = (): ColumnDef<FollowUpRow>[] => {
	return Object.keys(FOLLOWUP_HEADERS).reduce<ColumnDef<FollowUpRow>[]>(
		(acc, key) => {
			const config = FOLLOWUP_HEADERS[key as keyof typeof FOLLOWUP_HEADERS];

			// Skip hidden columns
			if (!config || config.hidden) return acc;

			const columnDef: any = {
				id: key as string,
				header:
					key === "actions"
						? ({ table }: { table: any }) => (
								<BulkSelectionHeader table={table} />
							)
						: ({ column }: { column: Column<FollowUpRow, any> }) => (
								<SortableHeader column={column}>{config.header}</SortableHeader>
							),
				size: config.size,
				minSize: config.minSize,
				maxSize: config.maxSize,
				enableResizing: config.enableResizing ?? true,
				enableSorting: config.enableSorting ?? true,
				enableHiding: config.enableHiding ?? true,
				enablePinning: config.enablePinning ?? true,
				filterFn: (config.filterFn as any) || "includesString",
				sortingFn: (config.sortingFn as any) || "text",
			};

			// Special accessor/logic for 'documents'
			if (key === "documents") {
				columnDef.accessorFn = (row: FollowUpRow) => ({
					driveUrl: row.driveUrl,
					localPath: row.localPath,
				});
				columnDef.filterFn = (
					row: { original: FollowUpRow },
					_columnId: string,
					filterValue: any,
				) => {
					const driveUrl = row.original.driveUrl || "";
					const localPath = row.original.localPath || "";
					const searchValue = String(filterValue).toLowerCase();
					return (
						driveUrl.toLowerCase().includes(searchValue) ||
						localPath.toLowerCase().includes(searchValue)
					);
				};
				columnDef.sortingFn = (
					rowA: { original: FollowUpRow },
					rowB: { original: FollowUpRow },
				) => {
					const a = rowA.original.driveUrl || rowA.original.localPath || "";
					const b = rowB.original.driveUrl || rowB.original.localPath || "";
					return a.localeCompare(b);
				};
			} else if (key === "createdAt") {
				columnDef.accessorKey = "createdAt";
				columnDef.filterFn = (
					row: { original: FollowUpRow },
					_columnId: string,
					filterValue: any,
				) => {
					const date = row.original.createdAt || "";
					return date.toLowerCase().includes(String(filterValue).toLowerCase());
				};
			} else if (key !== "actions") {
				columnDef.accessorKey = key as string;
			}

			if (key === "quantity" || key === "jobPriority") {
				columnDef.sortingFn = compareFollowUpNumeric;
			}

			// Assign specialized cells based on config
			if (config.cell) {
				const CellComponent = config.cell;
				const cellProps = config.cellProps || {};

				// Separate actions from other cells as it needs special handling
				if (key === "actions") {
					columnDef.meta = { isPermanentlyPinned: true };
					columnDef.cell = ({ row, table }: any) => (
						<CellComponent row={row} table={table} {...cellProps} />
					);
				} else {
					columnDef.cell = (props: any) => (
						<CellComponent {...props} {...cellProps} />
					);
				}
			} else {
				// For non-typed columns like 'id', 'botMessage', etc.
				columnDef.cell = (props: any) => <span>{props.getValue()}</span>;
			}

			acc.push(columnDef as ColumnDef<FollowUpRow>);
			return acc;
		},
		[],
	);
};
