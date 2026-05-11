import type { Row } from "@tanstack/react-table";

export interface PaginationMeta {
	total: number;
	totalPages: number;
}

export interface DateRange {
	from: string;
	to: string;
}

// Generic filter condition - feature-specific filters should extend this
export interface FilterCondition {
	[key: string]: any;
}

export interface BaseTableMeta<TData> {
	updateData?: (rowId: string, columnId: string, value: unknown) => void;
	refreshData?: () => void;
	onSubTabClick?: (rowId: string, tab: string) => void;
	onViewDetails?: (rowData: TData) => void;
	dependencies?: Record<string, any>;
}

export interface DataTablePaginationProps<TData> {
	table: import("@tanstack/react-table").Table<TData>;
	pagination: import("@tanstack/react-table").PaginationState;
	paginationMeta: PaginationMeta;
	pageSizeOptions?: number[];
}

export interface DataTableContentProps<TData> {
	table: import("@tanstack/react-table").Table<TData>;
	isLoading?: boolean;
	isFetching?: boolean;
	activeRowTabs?: Record<string, string>;
	renderExpandedRow?: (row: Row<TData>) => React.ReactNode;
	emptyState?: React.ReactNode;
}
