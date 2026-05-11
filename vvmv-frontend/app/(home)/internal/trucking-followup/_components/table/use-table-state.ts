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

export interface ServiceModeFilter {
	fcl: boolean;
	air: boolean;
	lcl: boolean;
}

interface TableState {
	// Base state
	columnOrder: ColumnOrderState;
	columnVisibility: VisibilityState;
	columnPinning: ColumnPinningState;
	columnSizing: ColumnSizingState;
	pageSize: number;
	statusFilter:
		| "all"
		| "active"
		| "pending"
		| "loaded"
		| "finished"
		| "done"
		| "pending-approval"
		| "pending-trucking-approval"
		| "pending-disbursement-approval";
	dateRange: DateRange | null;
	hideOthersTasks: boolean | null;
	serviceModeFilter: ServiceModeFilter;
	_hasHydrated: boolean;
	activeRowTabs: Record<string, string>;

	// Actions
	setColumnOrder: OnChangeFn<ColumnOrderState>;
	setColumnVisibility: OnChangeFn<VisibilityState>;
	setColumnPinning: OnChangeFn<ColumnPinningState>;
	setColumnSizing: OnChangeFn<ColumnSizingState>;
	setPageSize: OnChangeFn<number>;
	setHideOthersTasks: (value: boolean) => void;
	setDateRange: (range: DateRange | null) => void;
	setServiceModeFilter: (filter: ServiceModeFilter) => void;
	setActiveRowTab: (rowId: string, tab: string) => void;
	setStatusFilter: (
		filter:
			| "all"
			| "active"
			| "pending"
			| "loaded"
			| "finished"
			| "done"
			| "pending-approval"
			| "pending-trucking-approval"
			| "pending-disbursement-approval",
	) => void;
	setHasHydrated: (state: boolean) => void;
	resetState: () => void;
}

const getDefaultState = () => ({
	columnOrder: [] as ColumnOrderState,
	columnVisibility: {} as VisibilityState,
	columnPinning: {
		left: ["actions", "jobNumber"],
		right: [],
	} as ColumnPinningState,
	columnSizing: {} as ColumnSizingState,
	pageSize: 10,
	statusFilter: "all" as const,
	dateRange: { from: "", to: "" } as DateRange,
	hideOthersTasks: null,
	serviceModeFilter: { fcl: true, air: true, lcl: true } as ServiceModeFilter,
	activeRowTabs: {} as Record<string, string>,
	_hasHydrated: false,
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

					// Ensure actions and jobNumber are at the start
					const others = uniqueNewValue.filter(
						(id) => id !== "actions" && id !== "jobNumber",
					);
					const hasActions = uniqueNewValue.includes("actions");
					const hasJobNumber = uniqueNewValue.includes("jobNumber");

					const finalOrder = [
						...(hasActions ? ["actions"] : []),
						...(hasJobNumber ? ["jobNumber"] : []),
						...others,
					];

					set({ columnOrder: finalOrder });
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

					// Always ensure 'actions' and 'jobNumber' are pinned to left
					// Also EXPLICITLY unpin requestNumber and other columns that cause misalignment
					const leftOthers = (newValue.left || []).filter(
						(id: string) =>
							id !== "actions" &&
							id !== "jobNumber" &&
							id !== "requestNumber" &&
							id !== "requestTruckingNo",
					);
					const rightOthers = (newValue.right || []).filter(
						(id: string) => id !== "actions" && id !== "jobNumber",
					);

					set({
						columnPinning: {
							left: ["actions", "jobNumber", ...leftOthers],
							right: rightOthers,
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
				setPageSize: (updaterOrValue) =>
					set({
						pageSize:
							typeof updaterOrValue === "function"
								? updaterOrValue(get().pageSize)
								: updaterOrValue,
					}),
				setHideOthersTasks: (value) => set({ hideOthersTasks: value }),
				setDateRange: (range) => set({ dateRange: range }),
				setServiceModeFilter: (filter) => set({ serviceModeFilter: filter }),
				setActiveRowTab: (rowId, tab) =>
					set((state) => ({
						activeRowTabs: {
							...state.activeRowTabs,
							[rowId]: tab,
						},
					})),
				setStatusFilter: (filter) => set({ statusFilter: filter }),
				setHasHydrated: (state) => set({ _hasHydrated: state }),
				resetState: () => set(getDefaultState()),
			}),
			{
				name: `trucking-table-state-${userId || "anonymous"}`,
				storage: createJSONStorage(() =>
					createTableUserPersistStorage(
						userId,
						`trucking-table-state-${userId || "anonymous"}`,
					),
				),
				partialize: (state) => ({
					columnOrder: state.columnOrder,
					columnVisibility: state.columnVisibility,
					columnPinning: state.columnPinning,
					columnSizing: state.columnSizing,
					pageSize: state.pageSize,
					statusFilter: state.statusFilter,
					dateRange: state.dateRange,
					hideOthersTasks: state.hideOthersTasks,
					serviceModeFilter: state.serviceModeFilter,
				}),
				onRehydrateStorage: () => (state, error) => {
					if (error) {
						console.error(
							"[TruckingTableStore] Hydration failed, keeping defaults without marking as hydrated:",
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

export const createTruckingTableStore = (userId: string) => {
	if (!storeCache.has(userId)) {
		storeCache.set(userId, createStore(userId));
	}

	const store = storeCache.get(userId);
	if (!store) {
		throw new Error(
			`Failed to initialize trucking table store for user "${userId}"`,
		);
	}

	return store;
};
