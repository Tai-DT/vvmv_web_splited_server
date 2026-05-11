import type {
	Cell,
	Column,
	Header,
	HeaderGroup,
	Row,
	Table,
} from "@tanstack/react-table";

export type PinnedTriple<T> = { left: T[]; center: T[]; right: T[] };

function splitByPin<T>(
	items: T[],
	getPin: (item: T) => false | "left" | "right",
): PinnedTriple<T> {
	const left: T[] = [];
	const center: T[] = [];
	const right: T[] = [];
	for (const item of items) {
		const p = getPin(item);
		if (p === "left") left.push(item);
		else if (p === "right") right.push(item);
		else center.push(item);
	}
	return { left, center, right };
}

/** Same order as `row.getVisibleCells()` — matches TanStack leaf column order + pinning. */
export function splitVisibleCellsByPin<TData>(
	row: Row<TData>,
): PinnedTriple<Cell<TData, unknown>> {
	return splitByPin(row.getVisibleCells(), (cell) => cell.column.getIsPinned());
}

/** Leaf columns in table order; use for skeleton rows / width walks. */
export function splitVisibleLeafColumnsByPin<TData>(
	table: Table<TData>,
): PinnedTriple<Column<TData, unknown>> {
	return splitByPin(table.getVisibleLeafColumns(), (col) => col.getIsPinned());
}

/**
 * Headers for one header row, ordered exactly like `getVisibleLeafColumns()` so thead
 * stays byte-aligned with tbody. Skips placeholder headers from grouped layouts.
 */
export function getOrderedLeafHeaders<TData>(
	table: Table<TData>,
	headerGroup: HeaderGroup<TData>,
): Header<TData, unknown>[] {
	const leafColumns = table.getVisibleLeafColumns();
	const headerByColId = new Map<string, Header<TData, unknown>>();
	for (const h of headerGroup.headers) {
		if (!h.isPlaceholder) {
			headerByColId.set(h.column.id, h as Header<TData, unknown>);
		}
	}
	return leafColumns
		.map((col) => headerByColId.get(col.id))
		.filter((h): h is Header<TData, unknown> => h !== undefined);
}

export function splitOrderedLeafHeadersByPin<TData>(
	table: Table<TData>,
	headerGroup: HeaderGroup<TData>,
): PinnedTriple<Header<TData, unknown>> {
	const ordered = getOrderedLeafHeaders(table, headerGroup);
	return splitByPin(ordered, (h) => h.column.getIsPinned());
}
