import type {
	ColumnOrderState,
	ColumnPinningState,
	ColumnSizingState,
	Updater,
	VisibilityState,
} from "@tanstack/react-table";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createTableUserPersistStorage } from "@/lib/table-persist";

type OnChangeFn<T> = (updaterOrValue: Updater<T>) => void;

export interface DateRange {
	from: string;
	to: string;
}

export interface SubPanelVisibility {
	declarations: boolean;
	containers: boolean;
	tasks: boolean;
	cerOfOrigins: boolean;
}

interface TableState {
	// Base state (same as shared)
	columnOrder: ColumnOrderState;
	columnVisibility: VisibilityState;
	columnPinning: ColumnPinningState;
	columnSizing: ColumnSizingState;
	hideOthersTasks: boolean | null;
	dateRange: DateRange | null;
	pageSize: number;
	activeRowTabs: Record<string, string>;
	_hasHydrated: boolean;

	// Logistics-specific state
	subPanelVisibility: SubPanelVisibility;
	statusFilter:
		| "all"
		| "active"
		| "activeNoTrucking"
		| "activeWithTrucking"
		| "finished"
		| "done";

	// Base actions
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

	// Logistics-specific actions
	setSubPanelVisibility: (
		panel: keyof SubPanelVisibility,
		visible: boolean,
	) => void;
	setStatusFilter: (
		filter:
			| "all"
			| "active"
			| "activeNoTrucking"
			| "activeWithTrucking"
			| "finished"
			| "done",
	) => void;
}

const getDefaultState = () => ({
	columnOrder: [] as ColumnOrderState,
	columnVisibility: {} as VisibilityState,
	columnPinning: {
		left: ["actions", "jobNumber"],
		right: [],
	} as ColumnPinningState,
	columnSizing: {} as ColumnSizingState,
	hideOthersTasks: null,
	dateRange: null,
	pageSize: 10,
	activeRowTabs: {} as Record<string, string>,
	_hasHydrated: false,
	subPanelVisibility: {
		declarations: true,
		containers: true,
		tasks: true,
		cerOfOrigins: true,
	} as SubPanelVisibility,
	statusFilter: "all" as
		| "all"
		| "active"
		| "activeNoTrucking"
		| "activeWithTrucking"
		| "finished"
		| "done",
});

const storeCache = new Map<string, ReturnType<typeof createStore>>();

function createStore(userId: string) {
	return create<TableState>()(
		persist(
			(set, get) => ({
				...getDefaultState(),
				setColumnOrder: (updaterOrValue) => {
					const newValue =
						typeof updaterOrValue === "function"
							? updaterOrValue(get().columnOrder)
							: updaterOrValue;

					const uniqueNewValue = Array.from(new Set(newValue));
					const orderWithoutActions = uniqueNewValue.filter(
						(id: string) => id !== "actions",
					);
					const hasActions = uniqueNewValue.includes("actions");

					set({
						columnOrder: hasActions
							? ["actions", ...orderWithoutActions]
							: uniqueNewValue,
					});
				},
				setColumnVisibility: (updaterOrValue) =>
					set({
						columnVisibility:
							typeof updaterOrValue === "function"
								? updaterOrValue(get().columnVisibility)
								: updaterOrValue,
					}),
				setColumnPinning: (updaterOrValue) => {
					const newValue =
						typeof updaterOrValue === "function"
							? updaterOrValue(get().columnPinning)
							: updaterOrValue;

					const leftWithoutActions = (newValue.left || []).filter(
						(id: string) => id !== "actions",
					);
					const rightWithoutActions = (newValue.right || []).filter(
						(id: string) => id !== "actions",
					);

					set({
						columnPinning: {
							left: ["actions", ...leftWithoutActions],
							right: rightWithoutActions,
						},
					});
				},
				setColumnSizing: (updaterOrValue) =>
					set({
						columnSizing:
							typeof updaterOrValue === "function"
								? updaterOrValue(get().columnSizing)
								: updaterOrValue,
					}),
				setHideOthersTasks: (value) => set({ hideOthersTasks: value }),
				setDateRange: (range) => set({ dateRange: range }),
				setPageSize: (updaterOrValue) =>
					set({
						pageSize:
							typeof updaterOrValue === "function"
								? updaterOrValue(get().pageSize)
								: updaterOrValue,
					}),
				setActiveRowTab: (rowId, tab) =>
					set((state) => ({
						activeRowTabs: {
							...state.activeRowTabs,
							[rowId]: tab,
						},
					})),
				setHasHydrated: (state) => set({ _hasHydrated: state }),
				resetState: () => set(getDefaultState()),
				setSubPanelVisibility: (panel, visible) =>
					set({
						subPanelVisibility: {
							...get().subPanelVisibility,
							[panel]: visible,
						},
					}),
				setStatusFilter: (filter) => set({ statusFilter: filter }),
			}),
			{
				name: `main-table-state-${userId || "anonymous"}`,
				storage: createJSONStorage(() =>
					createTableUserPersistStorage(
						userId,
						`main-table-state-${userId || "anonymous"}`,
					),
				),
				partialize: (state) => ({
					columnOrder: state.columnOrder,
					columnVisibility: state.columnVisibility,
					columnPinning: state.columnPinning,
					columnSizing: state.columnSizing,
					pageSize: state.pageSize,
					hideOthersTasks: state.hideOthersTasks,
					dateRange: state.dateRange,
					subPanelVisibility: state.subPanelVisibility,
					statusFilter: state.statusFilter,
				}),
				onRehydrateStorage: () => (state, error) => {
					if (error) {
						console.error(
							"[MainTableStore] Hydration failed, keeping defaults without marking as hydrated:",
							error,
						);
						return;
					}
					state?.setHasHydrated(true);
				},
			},
		),
	);
}

export const createTableStore = (userId: string) => {
	if (!storeCache.has(userId)) {
		storeCache.set(userId, createStore(userId));
	}

	const store = storeCache.get(userId);
	if (!store) {
		throw new Error(
			`Failed to initialize main table store for user "${userId}"`,
		);
	}

	return store;
};
