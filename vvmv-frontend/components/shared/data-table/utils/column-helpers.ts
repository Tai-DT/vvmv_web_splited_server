import type { ColumnDef } from "@tanstack/react-table";

/**
 * Initialize column order by merging existing order with column definitions
 */
export function initializeColumnOrder<TData>(
	existingOrder: string[],
	columnDefs: ColumnDef<TData>[],
): string[] {
	// Extract all column IDs from definitions
	const allColumnIds = columnDefs
		.map((col) => {
			if ("accessorKey" in col && typeof col.accessorKey === "string") {
				return col.accessorKey;
			}
			if ("id" in col && typeof col.id === "string") {
				return col.id;
			}
			return null;
		})
		.filter((id): id is string => id !== null);

	// If no existing order, return all column IDs
	if (!existingOrder || existingOrder.length === 0) {
		return allColumnIds;
	}

	// Merge: keep existing order + add new columns at end
	const existingSet = new Set(existingOrder);
	const newColumns = allColumnIds.filter((id) => !existingSet.has(id));

	return [
		...existingOrder.filter((id) => allColumnIds.includes(id)),
		...newColumns,
	];
}

/**
 * Ensure system columns (like "actions") are always first
 */
export function enforceSystemColumns(
	columnOrder: string[],
	systemColumns: string[],
): string[] {
	const systemSet = new Set(systemColumns);
	const existingSystemCols = columnOrder.filter((id) => systemSet.has(id));
	const otherCols = columnOrder.filter((id) => !systemSet.has(id));

	// Maintain original system column order
	const orderedSystemCols = systemColumns.filter((id) =>
		existingSystemCols.includes(id),
	);

	return [...orderedSystemCols, ...otherCols];
}

/**
 * Calculate pinned column offsets for sticky positioning
 */
export function calculatePinnedOffset(
	columns: Array<{
		getIsPinned: () => false | "left" | "right";
		getSize: () => number;
	}>,
	currentIndex: number,
	pinType: "left" | "right",
): number {
	if (pinType === "left") {
		return columns
			.slice(0, currentIndex)
			.filter((c) => c.getIsPinned() === "left")
			.reduce((acc, c) => acc + c.getSize(), 0);
	}

	// Right offset (from right edge)
	return columns
		.slice(currentIndex + 1)
		.filter((c) => c.getIsPinned() === "right")
		.reduce((acc, c) => acc + c.getSize(), 0);
}
