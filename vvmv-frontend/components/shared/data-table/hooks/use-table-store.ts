import type {
	ColumnOrderState,
	ColumnPinningState,
	ColumnSizingState,
	Updater,
	VisibilityState,
} from "@tanstack/react-table";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// Helper type for TanStack Table's OnChangeFn pattern
type OnChangeFn<T> = (updaterOrValue: Updater<T>) => void;

export interface DateRange {
	from: string;
	to: string;
}

// Base state shared by all tables
export interface BaseTableState {
	columnOrder: ColumnOrderState;
	columnVisibility: VisibilityState;
	columnPinning: ColumnPinningState;
	columnSizing: ColumnSizingState;
	hideOthersTasks: boolean | null;
	dateRange: DateRange | null;
	pageSize: number;
	_hasHydrated: boolean;
	activeRowTabs: Record<string, string>;

	setColumnOrder: OnChangeFn<ColumnOrderState>;
	setColumnVisibility: OnChangeFn<VisibilityState>;
	setColumnPinning: OnChangeFn<ColumnPinningState>;
	setColumnSizing: OnChangeFn<ColumnSizingState>;
	setHideOthersTasks: (value: boolean) => void;
	setDateRange: (range: DateRange | null) => void;
	setPageSize: OnChangeFn<number>;
	setActiveRowTab: (rowId: string, tab: string) => void;
	setHasHydrated: (state: boolean) => void;
	resetState: () => void;
}

export interface TableStoreConfig<TExtraState = {}> {
	storageKey: string;
	defaultPinnedLeft?: string[];
	defaultPinnedRight?: string[];
	defaultPageSize?: number;
	defaultDateRange?: DateRange | null;
	extraState?: TExtraState;
	extraActions?: Record<string, any>;
}

/**
 * Factory function to create table stores with shared persistence logic
 */
export function createTableStore<TExtraState extends Record<string, any> = {}>(
	userId: string,
	config: TableStoreConfig<TExtraState>,
) {
	const {
		storageKey,
		defaultPinnedLeft = ["actions", "jobNumber"],
		defaultPinnedRight = [],
		defaultPageSize = 10,
		defaultDateRange = null,
		extraState = {} as TExtraState,
		extraActions = {},
	} = config;

	type FullState = BaseTableState & TExtraState;

	const getDefaultState = () => ({
		columnOrder: [] as ColumnOrderState,
		columnVisibility: {} as VisibilityState,
		columnPinning: {
			left: defaultPinnedLeft,
			right: defaultPinnedRight,
		} as ColumnPinningState,
		columnSizing: {} as ColumnSizingState,
		hideOthersTasks: null,
		dateRange: defaultDateRange,
		pageSize: defaultPageSize,
		activeRowTabs: {} as Record<string, string>,
		_hasHydrated: false,
		...extraState,
	});

	return create<FullState>()(
		persist(
			(set, get) => ({
				...getDefaultState(),
				setColumnOrder: (updaterOrValue) => {
					const newValue =
						typeof updaterOrValue === "function"
							? updaterOrValue(get().columnOrder)
							: updaterOrValue;

					// Dedup and ensure system columns are always first
					const uniqueNewValue = Array.from(new Set(newValue));
					const systemColumns = defaultPinnedLeft.filter((col) =>
						uniqueNewValue.includes(col),
					);
					const otherColumns = uniqueNewValue.filter(
						(id: string) => !defaultPinnedLeft.includes(id),
					);

					set({
						columnOrder: [...systemColumns, ...otherColumns],
					} as Partial<FullState>);
				},
				setColumnVisibility: (updaterOrValue) =>
					set({
						columnVisibility:
							typeof updaterOrValue === "function"
								? updaterOrValue(get().columnVisibility)
								: updaterOrValue,
					} as Partial<FullState>),
				setColumnPinning: (updaterOrValue) => {
					const newValue =
						typeof updaterOrValue === "function"
							? updaterOrValue(get().columnPinning)
							: updaterOrValue;

					// Always ensure system columns are pinned to left
					const leftOthers = (newValue.left || []).filter(
						(id: string) => !defaultPinnedLeft.includes(id),
					);
					const rightOthers = (newValue.right || []).filter(
						(id: string) => !defaultPinnedLeft.includes(id),
					);

					set({
						columnPinning: {
							left: [...defaultPinnedLeft, ...leftOthers],
							right: rightOthers,
						},
					} as Partial<FullState>);
				},
				setColumnSizing: (updaterOrValue) =>
					set({
						columnSizing:
							typeof updaterOrValue === "function"
								? updaterOrValue(get().columnSizing)
								: updaterOrValue,
					} as Partial<FullState>),
				setHideOthersTasks: (value) =>
					set({ hideOthersTasks: value } as Partial<FullState>),
				setDateRange: (range) =>
					set({ dateRange: range } as Partial<FullState>),
				setPageSize: (updaterOrValue) =>
					set({
						pageSize:
							typeof updaterOrValue === "function"
								? updaterOrValue(get().pageSize)
								: updaterOrValue,
					} as Partial<FullState>),
				setActiveRowTab: (rowId, tab) =>
					set(
						(state) =>
							({
								activeRowTabs: {
									...state.activeRowTabs,
									[rowId]: tab,
								},
							}) as Partial<FullState>,
					),
				setHasHydrated: (state) =>
					set({ _hasHydrated: state } as Partial<FullState>),
				resetState: () =>
					set(getDefaultState() as unknown as Partial<FullState>),
				...extraActions,
			}),
			{
				name: `${storageKey}-${userId}`,
				partialize: (state) => {
					const baseFields = {
						columnOrder: state.columnOrder,
						columnVisibility: state.columnVisibility,
						columnPinning: state.columnPinning,
						columnSizing: state.columnSizing,
						hideOthersTasks: state.hideOthersTasks,
						dateRange: state.dateRange,
						pageSize: state.pageSize,
					};

					// Include extra state fields in persistence
					const extraFields = Object.keys(extraState).reduce(
						(acc, key) => {
							acc[key] = state[key as keyof FullState];
							return acc;
						},
						{} as Record<string, any>,
					);

					return { ...baseFields, ...extraFields };
				},
				onRehydrateStorage: () => (state) => {
					state?.setHasHydrated(true);
				},
			},
		),
	);
}

// Cache store instances by userId to prevent creating new stores on each render
const storeCache = new Map<string, any>();

export const getCachedStore = <_T>(
	userId: string,
	storageKey: string,
	createFn: () => any,
): any => {
	const cacheKey = `${storageKey}-${userId}`;
	if (!storeCache.has(cacheKey)) {
		storeCache.set(cacheKey, createFn());
	}
	return storeCache.get(cacheKey);
};
