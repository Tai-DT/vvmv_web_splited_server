import type { Table } from "@tanstack/react-table";

/**
 * Hook to calculate tabIndex for editable cells based on visual column order
 *
 * This ensures keyboard tab navigation follows the visual column order
 * (after user reordering) instead of the DOM order.
 *
 * Optimized: Uses only column order (O(1) lookup via indexOf) instead of
 * also doing rows.findIndex() per cell. DOM row order already ensures
 * correct top-to-bottom tab flow within each column position.
 *
 * @param table - TanStack Table instance
 * @param _rowId - ID of the current row (kept for API compat, unused)
 * @param columnId - ID of the current column
 * @returns tabIndex value for the cell
 */
export function useCellTabIndex(
	table: Table<any>,
	_rowId: string,
	columnId: string,
): number {
	const columnOrder = table.getState().columnOrder;
	const visualColumnIndex = columnOrder.indexOf(columnId);

	return visualColumnIndex >= 0 ? visualColumnIndex + 1 : 0;
}
