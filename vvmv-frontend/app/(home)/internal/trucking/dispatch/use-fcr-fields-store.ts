import { create } from "zustand";
import { persist } from "zustand/middleware";

export type OptionalFCRField =
	| "jobNumber"
	| "billOrBooking"
	| "companyName"
	| "warehouse"
	| "route"
	| "shipper"
	| "vendor"
	| "plateNumber"
	| "driver"
	| "truckType"
	| "notes";

export const ALL_OPTIONAL_FIELDS: { key: OptionalFCRField; label: string }[] = [
	{ key: "jobNumber", label: "Job #" },
	{ key: "billOrBooking", label: "Bill / Booking" },
	{ key: "companyName", label: "Khách hàng" },
	{ key: "warehouse", label: "Kho" },
	{ key: "route", label: "Tuyến đường" },
	{ key: "shipper", label: "Shipper" },
	{ key: "vendor", label: "Nhà cung cấp" },
	{ key: "plateNumber", label: "Biển số" },
	{ key: "driver", label: "Tài xế" },
	{ key: "truckType", label: "Loại xe" },
	{ key: "notes", label: "Ghi chú" },
];

interface FCRFieldsState {
	visibleFields: OptionalFCRField[];
	toggle: (field: OptionalFCRField) => void;
	selectAll: () => void;
	clearAll: () => void;
	isVisible: (field: OptionalFCRField) => boolean;
}

export const useFCRFieldsStore = create<FCRFieldsState>()(
	persist(
		(set, get) => ({
			visibleFields: [],
			toggle: (field) =>
				set((s) =>
					s.visibleFields.includes(field)
						? { visibleFields: s.visibleFields.filter((f) => f !== field) }
						: { visibleFields: [...s.visibleFields, field] },
				),
			selectAll: () =>
				set({ visibleFields: ALL_OPTIONAL_FIELDS.map((f) => f.key) }),
			clearAll: () => set({ visibleFields: [] }),
			isVisible: (field) => get().visibleFields.includes(field),
		}),
		{ name: "dispatch-fcr-fields" },
	),
);
