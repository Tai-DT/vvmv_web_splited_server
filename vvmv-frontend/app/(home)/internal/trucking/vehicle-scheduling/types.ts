export type FCRBoardItem = {
	id: string;
	fcrNumber: string | null;
	grossWeight: number | null;
	pickupAt: string | null;
	deliveryAt: string | null;
	shipper: string | null;
	notes: string | null;
	vendor: string | null;
	cbm: number | null;
	quantity: number | null;
	truckingNumberId: string | null;
	tripNumber: number;
	implementationDate: string | null;
	plateNumber: string | null;
	driver: string | null;
	truckType: string | null;
	containerNo: string | null;
	truckingFollowUp: {
		id: string;
		jobNumber: string | null;
		companyName: string | null;
		billOrBooking: string | null;
		note: string | null;
		serviceMode: string | null;
		warehouse: string | null;
		routineDetail: string | null;
		operationType: "XUAT" | "NHAP" | null;
		implementationDate: string | null;
		createdBy: string | null;
		pickUpTime: string | null;
	};
	hasAllMvUrls: boolean;
};

export type TripSlot = {
	tripNumber: number;
	fcrs: FCRBoardItem[];
};

export type TruckSlot = {
	truckingNumberId: string;
	plateNumber: string;
	driverName: string | null;
	vehicleType: string | null;
	payloadTonnes: number | null;
	isVendor: boolean;
	vendorName: string | null;
	trips: TripSlot[];
};

export type DayData = {
	date: string;
	trucks: TruckSlot[];
};

export type BoardData = {
	unscheduledFcrs: FCRBoardItem[];
	days: DayData[];
	allTrucks: {
		id: string;
		plateNumber: string;
		driverName: string | null;
		vehicleType: string | null;
		payloadTonnes: number | null;
		isVendor: boolean;
		vendorName: string | null;
	}[];
	allVendors: {
		id: string;
		name: string;
	}[];
	stats: {
		totalFcrs: number;
		totalTrucks: number;
		unscheduledCount: number;
	};
};
