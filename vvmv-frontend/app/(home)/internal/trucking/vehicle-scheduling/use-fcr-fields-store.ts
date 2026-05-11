import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
	ALL_OPTIONAL_FIELDS,
	type OptionalFCRField,
} from "@/lib/trucking/fcr-fields";

interface FCRFieldsState {
	visibleFields: OptionalFCRField[];
	columnsOrder: string[];
	columnWidths: Record<string, number>;
	toggle: (field: OptionalFCRField) => void;
	selectAll: () => void;
	clearAll: () => void;
	isVisible: (field: OptionalFCRField) => boolean;
	setColumnsOrder: (order: string[]) => void;
	setColumnWidth: (key: string, width: number) => void;
}

const DEFAULT_COLUMNS = ["type", "serviceMode"];
const DEFAULT_OPTIONAL: OptionalFCRField[] = [
	"fcrNumber",
	"jobNumber",
	"pickupAt",
	"deliveryAt",
	"weight",
	"notes",
];

export const useFCRFieldsStore = create<FCRFieldsState>()(
	persist(
		(set, get) => ({
			visibleFields: DEFAULT_OPTIONAL,
			columnsOrder: [...DEFAULT_COLUMNS, ...DEFAULT_OPTIONAL],
			columnWidths: {},
			toggle: (field) =>
				set((s) => {
					const isRemoving = s.visibleFields.includes(field);
					const newVisible = isRemoving
						? s.visibleFields.filter((f) => f !== field)
						: [...s.visibleFields, field];

					const newOrder = s.columnsOrder.filter(
						(c) =>
							DEFAULT_COLUMNS.includes(c) ||
							newVisible.includes(c as OptionalFCRField),
					);

					// Ensure newly added field is at the end if it wasn't there
					if (!isRemoving && !newOrder.includes(field)) {
						newOrder.push(field);
					}

					return { visibleFields: newVisible, columnsOrder: newOrder };
				}),
			selectAll: () => {
				const fields = ALL_OPTIONAL_FIELDS.map((f) => f.key);
				set((s) => {
					const newOrder = [
						...s.columnsOrder.filter((c) => DEFAULT_COLUMNS.includes(c)),
						...fields,
					];
					return { visibleFields: fields, columnsOrder: newOrder };
				});
			},
			clearAll: () =>
				set((s) => ({
					visibleFields: [],
					columnsOrder: s.columnsOrder.filter((c) =>
						DEFAULT_COLUMNS.includes(c),
					),
				})),
			isVisible: (field) => get().visibleFields.includes(field),
			setColumnsOrder: (order) => set({ columnsOrder: order }),
			setColumnWidth: (key, width) =>
				set((s) => ({
					columnWidths: { ...s.columnWidths, [key]: width },
				})),
		}),
		{
			name: "vehicle-scheduling-fcr-fields",
			onRehydrateStorage: () => (state) => {
				if (!state) return;
				const validOptionalKeys = new Set<string>(
					ALL_OPTIONAL_FIELDS.map((f) => f.key),
				);

				// If visibleFields is empty but columnsOrder has optional fields,
				// recover them (legacy inconsistent state from old code).
				if (state.visibleFields.length === 0) {
					const legacyOptionals = state.columnsOrder.filter((c) =>
						validOptionalKeys.has(c),
					) as OptionalFCRField[];
					if (legacyOptionals.length > 0) {
						state.visibleFields = legacyOptionals;
					}
				}

				// Remove invalid keys (e.g. "tripNumber" is not a UI column).
				// Keep only DEFAULT_COLUMNS + visible optional fields, DEFAULT_COLUMNS always first.
				const keepOptionals = state.columnsOrder.filter((c) =>
					state.visibleFields.includes(c as OptionalFCRField),
				);
				const missingDefaults = DEFAULT_COLUMNS.filter(
					(c) => !state.columnsOrder.includes(c),
				);
				state.columnsOrder = [
					...missingDefaults,
					...DEFAULT_COLUMNS.filter((c) => state.columnsOrder.includes(c)),
					...keepOptionals,
				];
			},
		},
	),
);
