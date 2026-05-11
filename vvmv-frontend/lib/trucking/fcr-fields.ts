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
	| "containerNumber"
	| "fcrNumber"
	| "weight"
	| "cbm"
	| "qty"
	| "date"
	| "routineDetail"
	| "pickUpTime"
	| "pickupAt"
	| "deliveryAt"
	| "notes";

export const ALL_OPTIONAL_FIELDS: { key: OptionalFCRField; label: string }[] = [
	{ key: "jobNumber", label: "Job #" },
	{ key: "billOrBooking", label: "Booking" },
	{ key: "companyName", label: "Khách hàng" },
	{ key: "warehouse", label: "Kho" },
	{ key: "route", label: "Route" },
	{ key: "shipper", label: "Shipper" },
	{ key: "vendor", label: "Vendor" },
	{ key: "plateNumber", label: "Biển số" },
	{ key: "driver", label: "Tài xế" },
	{ key: "truckType", label: "Loại xe" },
	{ key: "containerNumber", label: "Cont No" },
	{ key: "fcrNumber", label: "FCR" },
	{ key: "weight", label: "GW" },
	{ key: "cbm", label: "CBM" },
	{ key: "qty", label: "QTY" },
	{ key: "date", label: "Date" },
	{ key: "routineDetail", label: "Route Detail" },
	{ key: "pickUpTime", label: "Hour" },
	{ key: "pickupAt", label: "From" },
	{ key: "deliveryAt", label: "To" },
	{ key: "notes", label: "Note" },
];
