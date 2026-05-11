import type {
	ContainerRow,
	DeclarationRow,
	FollowUpRow,
	InvokerTask,
	OperationType,
	PaymentRequestRow,
} from "../followup/types";

export type FCRRow = {
	id: string;
	fcrNumber?: string | null;
	tType?: string | null;
	tTypeC?: string | null;
	plateNumber?: string | null;
	truckType?: string | null;
	truckingFollowUpId?: string | null;
	containerId?: string | null;
	shipper?: string | null;
	cbm?: number | null;
	grossWeight?: number | null;
	quantity?: number | null;
	pickupAt?: string | null;
	deliveryAt?: string | null;
	notes?: string | null;
	isCombined?: boolean | null;
	containerNo?: string | null;
	vehicleInfo?: string | null;
	driver?: string | null;
	vendor?: string | null;
	warehouse?: string | null;
	implementationDate?: string | null;
	service?: string | null;
	ops?: string | null;
	bienBanBT?: boolean | null;
	truckingNumberId?: string | null;
	truckingNumber?: {
		driverName?: string | null;
		plateNumber?: string | null;
		driverPhone?: string | null;
		driverCCCD?: string | null;
		driverLicense?: string | null;
	} | null;
	tripNumber?: number | null;
	vendorCosts?: VendorCostRow[];
};

export type VendorCostStatus = "PENDING" | "APPROVED" | "REJECTED";

export type VendorCostRow = {
	id: string;
	truckingFollowUpId?: string | null;
	fcrId?: string | null;
	vendorId?: string | null;
	feeTypeId?: string | null;
	feeName: string;
	isDisbursement: boolean;
	isSelling?: boolean;
	vatPercent?: number | null;
	totalVat?: number | null;
	totalFee?: number | null;
	sellerTaxCode?: string | null;
	invoiceNumber?: string | null;
	invoiceLink?: string | null;
	trackingCode?: string | null;
	note?: string | null;
	rowOrder?: number | null;
	entryMode?: "MANUAL" | "EXCEL_IMPORT" | null;
	createdByVendor?: string | null;
	createdAt?: string | Date | null;
	updatedAt?: string | Date | null;
	// Status workflow
	status?: VendorCostStatus | null;
	rejectionReason?: string | null;
	reviewedById?: string | null;
	reviewedAt?: string | Date | null;
	reviewMessage?: string | null;
	vendor?: {
		name?: string | null;
	} | null;
	feeType?: {
		name?: string | null;
		isNotDefault?: boolean;
	} | null;
	reviewer?: {
		name?: string | null;
		email: string;
	} | null;
};

export type TruckingFollowUpRow = {
	id: string;
	botMessage?: string | null;
	handler?: string | null;
	requestNumber?: string | null;
	jobNumber?: string | null;
	serviceMode?: string | null;
	operationType?: OperationType | null;
	cbm?: number | null;
	grossWeight?: number | null;
	quantity?: number | null;
	createdAt?: string;
	updatedAt?: string;
	companyName?: string | null;
	taxCode?: string | null;
	vendor?: string | null;
	billOrBooking?: string | null;
	closingTime?: string | null;
	cutOffTime?: string | null;
	vesselName?: string | null;
	veselNumber?: string | null;
	carrierName?: string | null;
	routineDetail?: string | null;
	note?: string | null;
	note2?: string | null;
	note3?: string | null;
	note4?: string | null;
	note5?: string | null;
	fromLocation?: string | null;
	toLocation?: string | null;
	truckType?: string | null;
	pickOrLiftPlace?: string | null;
	commodityName?: string | null;
	warehouse?: string | null;
	pickUpTime?: string | null;
	ccgh?: string[];
	driveUrl?: string | null;
	localPath?: string | null;
	authority?: string | null;
	maLo?: string | null;
	transitPort?: string | null;
	destinationPort?: string | null;
	deliveryContactDetail?: string | null;
	eportService?: string | null;
	eportBooking?: string | null;
	maNhanConmt?: string | null;
	soLenh?: string | null;
	ngatDienDate?: string | null;
	implementationDate?: string | null;
	isFinished?: boolean;
	parentJobNumber?: string | null;
	subJobsCount?: number;
	transactionCode?: string | null;
	amount?: number | null;
	invoiceTaxCode?: string | null;
	ops?: string | null;
	hsCode?: string | null;
	donViKhuTrung?: string | null;
	temperature?: number | null;
	payDate?: string | null;
	bbbt?: string | null;
	clientName?: string | null;
	pvst?: boolean;
	bienBanBT?: boolean;
	checkNhapKho?: string | null;
	hasRedDeclaration?: boolean;
	hasTqDateComplete?: boolean;
	highestPriorityBatch?: "red" | "yellow" | "green" | null;

	// Relations
	followUps?: FollowUpRow[];
	declarations?: DeclarationRow[];
	containers?: ContainerRow[];
	fcrs?: FCRRow[];
	paymentRequests?: PaymentRequestRow[];
	user?: {
		id: string;
		name?: string | null;
		email: string;
		username?: string | null;
		image?: string | null;
	};
	handlerUser?: {
		id: string;
		name?: string | null;
		email: string;
		username?: string | null;
		image?: string | null;
	} | null;
	createdBy?: string | null;
	domain?: string | null;
	logJobs?: string; // Computed string of logistics job numbers
	invokerTasks?: InvokerTask[]; // Bot tasks from Invoker table
	_count?: {
		activityLogs?: number;
		paymentRequests?: number;
	};
};
