// Enum types matching Prisma schema
export type OperationType = "XUAT" | "NHAP";
export type Domain = "SGN" | "DAD" | "HAN";
export type CdsStatus = "DRAFT" | "REGISTERED";

/** Sub-tab types for the expanded row details panel */
export type SubTabType =
	| "tasks"
	| "containers"
	| "declarations"
	| "co"
	| "cargo"
	| "cdsInfo";

export type DeclarationRow = {
	id: string;
	followUpId: string;
	declarationNumber?: string | null;
	/** Dữ liệu phản hồi từ hải quan, không bắt buộc khi gửi mới */
	batch?: string | null;
	attachDocuments?: string | null;
	kvgsDate?: string | null;
	/** Ngày thông quan do hải quan trả về sau khi xử lý */
	tqDate?: string | null;
	authority?: string | null;
	customsCode?: string | null;
	workType?: string | null;
	declarationDate?: string | null;
	grossWeight?: number | null;
	quantity?: number | null;
	unit?: string | null;
	etaEtd?: string | null;
	billBooking?: string | null;
	invoice?: string | null;
	pol?: string | null;
	pod?: string | null;
	warehouse?: string | null;
	vehicle?: string | null;
	mstClient?: string | null;
	clientName?: string | null;
	partner?: string | null;
	diaDiemLuuKho?: string | null;
	diaDiemBaoThue?: string | null;
	/** Text thô (để tương thích cũ) */
	containers?: string | null;
	totalTaxAmount?: number | null;
	vatTax?: number | null;
	ieTax?: number | null;
	taxRemark?: string | null;
	firstCds?: string | null;
	createdAt?: string;
	updatedAt?: string;
	driveUrl?: string | null; // DRIVE URL
	mvUrl?: string | null; // BARCODE FILE URL
	/** Container đã link qua bảng ContainerDeclaration */
	linkedContainers?: { id: string; containerNo?: string | null }[];
};

export type ContainerRow = {
	id: string;
	followUpId?: string | null;
	truckingFollowUpId?: string | null;
	containerNo?: string | null;
	sealNo?: string | null;
	containerSize?: string | null;
	quantity?: number | null;
	grossWeight?: number | null;
	masGross?: number | null;
	tareWeight?: number | null;
	kc?: string | null;
	containerType?: string | null;
	closingTime?: string | null;
	cutOffTime?: string | null;
	cutOffAtPort?: string | null;
	vesselName?: string | null;
	veselNumber?: string | null;
	pickOrLiftPlace?: string | null;
	blockCode?: string | null;
	maLo?: string | null;
	vatTaxCode?: string | null;
	noEport?: boolean;
	vendor?: string | null;
	implementationDate?: string | null;
	emptyReturnDeadline?: string | null;
	plateNumber?: string | null;
	warehouse?: string | null;
	podUrl?: string | null;
	createdAt?: string;
	updatedAt?: string;
	/** Tờ khai đã được link qua bảng ContainerDeclaration */
	linkedDeclarations?: { id: string; declarationNumber?: string | null }[];
	packageQty?: number | null;
};

export type FollowUpRow = {
	id: string; // UUID from database
	no?: number; // Frontend-only sequential number
	status?: string | null;
	botMessage?: string | null;
	operationType?: OperationType | null; // XUAT/NHAP
	serviceMode?: string | null; // SERVICE MODE
	taxCode?: string | null; // MST
	companyName?: string | null; // CONG TY
	jobNumber?: string | null; // SO JOB
	driveUrl?: string | null; // DRIVE URL
	localPath?: string | null; // LOCAL PATH
	notes?: string | null; // NOTES
	cargoType?: string | null; // LOAI HANG HOA
	cbm?: number | null; // CBM
	pickUpTime?: string | null; // PICK UP TIME (date string)
	commodityName?: string | null; // TEN HANG HOA
	deliveryDate?: string | null; // NGAY GIAO/NGAY GUI (date string)
	truckNumber?: string | null; // SO XE
	location?: string | null; // NOI NHAN RONG/NOI HA RONG
	supervisionGate?: string | null; // QUA KHU VUC GIAM SAT
	handler?: string | null; // NGUOI THUC HIEN
	startTime?: string | null; // START (date string)
	endTime?: string | null; // END (date string)
	poNumber?: string | null; // PO NO
	note2?: string | null; // GHI CHU 2
	note3?: string | null; // GHI CHU 3
	shmtDate?: string | null; // SHMT DATE (date string)
	domain?: Domain | null; // DOMAIN
	arNumber?: string | null; // AR NUMBER
	// New fields
	pickupLocation?: string | null; // CHI TIET DIA DIEM NHAN HANG
	loadingLocation?: string | null; // CHI TIET DIA DIEM XEP HANG
	transportMethod?: string | null; // PHUONG TIEN VAN CHUYEN
	transportDate?: string | null; // NGAY KHOI HANH VAN CHUYEN
	taxService?: string | null; // DICH BAO THUE
	coNumber?: string | null; // SO CO (Certificate of Origin)
	unit?: string | null; // DVT (Unit)
	workType?: string | null; // LOAI HINH FORM CONG VIEC
	pol?: string | null; // POL (Port of Loading) - stores AirPortID
	pod?: string | null; // POD (Port of Discharge) - stores AirPortID
	warehouse?: string | null; // Warehouse - stores AirPortID
	authority?: string | null; // CO QUAN HAI QUAN/NHA NUOC - stores AirPortID
	quantity?: number | null; // SO LUONG
	billOrBooking?: string | null; // BILL/BOOKING
	supplier?: string | null; // SUPPLIER
	grossWeight?: number | null; // g.w
	invoice?: string | null; // Invoice
	requestTruckingNo?: string | null; // REQUEST TRUCKING NO
	etaEtd?: string | null; // ETA/ETD
	createdBy: string; // User ID who created this record
	jobPriority?: number | 7; // Job priority
	// Relations (read-only, managed by external system)
	declarations?: DeclarationRow[];
	containers?: ContainerRow[];
	cerOfOrigins?: CerOfOriginRow[];
	cargoLists?: CargoListRow[];
	cdsInfo?: FollowUpCdsInfoRow | null;
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
	// Count for lazy-loaded relations (from Prisma _count)
	_count?: {
		cargoLists?: number;
		activityLogs?: number;
		paymentRequests?: number;
	};
	createdAt?: string;
	updatedAt?: string;
	invokerTasks?: InvokerTask[]; // Bot tasks from Invoker table (not saved to DB)
	canEdit?: boolean; // Frontend flag to check if current user can edit this record
	isFinished?: boolean; // Flag to indicate if job is finished in ERP (delivered = 1)
	enableKVGS?: boolean; // Whether KVGS automation is enabled for this partner
	enableCDS?: boolean; // Whether CDS tracking is enabled for this partner
	// Internal UI fields (pre-calculated for performance)
	_isFinished?: boolean;
	_isDone?: boolean;
};

export type InvokerTask = {
	task_name: string;
	status: string;
	message: string | null;
	created_time: string | null;
	started_time: string | null;
	completed_time: string | null;
	machine_name: string | null;
	user_account: string | null;
	triggered_by_user: {
		id: string;
		name: string | null;
		username: string | null;
		email: string;
		image: string | null;
	} | null;
};

export type CerOfOriginRow = {
	id: string;
	followUpId: string;
	coNo?: string | null;
	coDate?: string;
	issuedDepartment?: string | null;
	issuedPlace?: string | null;
	form?: string | null;
	importer?: string | null;
	exporter?: string | null;
	invoice?: string | null;
	totalLines?: number | null;
	createdAt?: string;
	updatedAt?: string;
	driveUrl?: string | null; // DRIVE URL
};

export type PaymentRequestRow = {
	id: string;
	declarationNumber?: string | null;
	taxCode?: string | null;
	amount?: number | null;
	authority?: string | null;
	type?: string | null;
	arNumber?: string | null;
	notifyNumber?: string | null;
	followUpId?: string | null;
	truckingFollowUpId?: string | null;
	createdBy?: string;
	createdAt?: string;
	updatedAt?: string;
	user?: { id: string; name?: string | null; email: string } | null;
};

export type CargoListRow = {
	id: string;
	followUpId: string;
	customCode?: string | null;
	hsCode?: string | null;
	originalCountry?: string | null;
	originalCargoName?: string | null;
	dutyReductionCode?: string | null;
	imExDutyExemptionCode?: string | null;
	qty?: number | null;
	unitPrice?: number | null;
	qty2?: number | null;
	unit2?: string | null;
	vietnameseName?: string | null;
	importer?: string | null;
	packageQty?: number | null;
	packageType?: string | null;
	grossWeight?: number | null;
	invoiceNo?: string | null;
	invoiceDate?: string | null;
	term?: string | null;
	unit?: string | null;
	totalPrice?: number | null;
	/** Trị giá tính thuế (dòng) — ECUS_2025 */
	lineTaxableValue?: number | null;
	/** TS XK (%) */
	exportTaxRatePercent?: number | null;
	/** Tiền thuế xuất khẩu */
	exportTaxAmount?: number | null;
	/** Đơn giá tính thuế */
	taxableUnitPrice?: number | null;
	importTaxCode?: string | null;
	importTaxRate?: number | null;
	importTaxAmount?: number | null;
	vatTaxCode?: string | null;
	vatTaxRate?: number | null;
	vatTaxAmount?: number | null;
	imExDutyExemptionCondition?: string | null;
	imExDutyExemptionAmount?: number | null;
	createdAt?: string;
	updatedAt?: string;
};

export type FollowUpCdsInfoRow = {
	id?: string;
	followUpId?: string;
	cdsStatus?: CdsStatus | null;
	ecusDeclarationId?: number | null;
	registeredAt?: string | null;
	registeredBy?: string | null;
	businessTypeGroup?: string | null;
	declarationNumber?: string | null;
	declarationSequenceNumber?: string | null;
	firstDeclarationNumber?: string | null;
	branchNumberPart1?: string | null;
	branchNumberPart2?: string | null;
	correspondingDeclarationNumber?: string | null;
	cargoClassificationCode?: string | null;
	operationCode?: string | null;
	transportMethodCode?: string | null;
	customsCode?: string | null;
	personOrganizationClassification?: string | null;
	declarationProcessingDeptCode?: string | null;
	expectedDeclarationDate?: string | null;
	reExportDeadline?: string | null;
	importerCode?: string | null;
	importExportUnitName?: string | null;
	importerPostalCode?: string | null;
	importExportBusinessAddress?: string | null;
	importerPhone?: string | null;
	entrustedImporterCode?: string | null;
	entrustedImporterName?: string | null;
	exporterCode?: string | null;
	partnerName?: string | null;
	exporterPostalCode?: string | null;
	partnerAddress1?: string | null;
	partnerAddress2?: string | null;
	partnerAddress3?: string | null;
	partnerAddress4?: string | null;
	exportCountryCode?: string | null;
	entrustedExporterName?: string | null;
	customsDeclarantCode?: string | null;
	seaportSupervisionEnabled?: boolean | null;
	airportSupervisionEnabled?: boolean | null;
	billOfLading?: string | null;
	billItems?: Array<{
		billNumber?: string | null;
		billDate?: string | null;
		hawbNumber?: string | null;
		mawbYear?: string | null;
	}> | null;
	packageQuantity?: number | null;
	packageType?: string | null;
	grossWeightTotal?: number | null;
	weightUnit?: string | null;
	containerQuantity?: number | null;
	packageMarks?: string | null;
	warehouseLocationCode?: string | null;
	unloadingLocationCode?: string | null;
	loadingLocationCode?: string | null;
	customsWarehouseCode?: string | null;
	finalDestinationCode?: string | null;
	transportVehicleCode?: string | null;
	departureArrivalDate?: string | null;
	departureDate?: string | null;
	inspectionResultCode?: string | null;
	licenseNumber?: string | null;
	electronicInvoiceReceiptNumber?: string | null;
	warehouseLocationName?: string | null;
	unloadingLocationName?: string | null;
	loadingLocationName?: string | null;
	customsWarehouseName?: string | null;
	finalDestinationName?: string | null;
	transportVehicleName?: string | null;
	marksAndNumbers?: string | null;
	commercialInvoice?: string | null;
	invoiceFormClassificationCode?: string | null;
	commercialInvoiceDate?: string | null;
	invoicePriceCondition?: string | null;
	paymentMethod?: string | null;
	invoiceClassificationCode?: string | null;
	declaredValue?: number | null;
	totalInvoiceValue?: number | null;
	totalTaxableValue?: number | null;
	invoiceCurrency?: string | null;
	taxableValueCurrencyCode?: string | null;
	valuationDeclarationTypeCode?: string | null;
	transportFee?: number | null;
	transportFeeClassificationCode?: string | null;
	transportFeeCurrencyCode?: string | null;
	insuranceFee?: number | null;
	insuranceFeeClassificationCode?: string | null;
	insuranceFeeCurrencyCode?: string | null;
	insuranceRegistrationNumber?: string | null;
	valuationSummaryReceiptNumber?: string | null;
	valuationAdjustments?: Array<{
		nameCode?: string | null;
		classificationCode?: string | null;
		currencyCode?: string | null;
		adjustmentValue?: number | null;
		allocationRatio?: number | null;
	}> | null;
	taxPayer?: string | null;
	releaseBeforePermitCode?: string | null;
	taxPaymentDeadlineCode?: string | null;
	taxDestinationLocation?: string | null;
	taxSubstituteBankCode?: string | null;
	creditLimitIssueYear?: string | null;
	guaranteeIssueYear?: string | null;
	guaranteeBankCode?: string | null;
	creditLimitDocumentSymbol?: string | null;
	creditLimitDocumentNumber?: string | null;
	guaranteeDocumentSymbol?: string | null;
	guaranteeDocumentNumber?: string | null;
	estimatedArrivalAtDestinationDate?: string | null;
	transportDepartureDate?: string | null;
	transportSchedules?: Array<{
		locationCode?: string | null;
		locationName?: string | null;
		arrivalDate?: string | null;
		departureDate?: string | null;
	}> | null;
	note?: string | null;
	contractNumber?: string | null;
	contractDate?: string | null;
	contractGoodsDate?: string | null;
	importLicense?: string | null;
	importLicenses?: Array<string | null> | null;
	internalBusinessManagementNumber?: string | null;
	otherLegalDocumentCode?: string | null;
	otherLegalDocumentCodes?: Array<string | null> | null;
	valuationDeclarationDetail?: string | null;
	electronicAttachments?: Array<{
		attachmentNumber?: string | null;
		attachmentDescription?: string | null;
	}> | null;
	truckLoadingLocationCode?: string | null;
	truckLoadingLocationName?: string | null;
	truckLoadingLocationAddress?: string | null;
	exchangeRate?: number | null;
	netWeight?: number | null;
	createdAt?: string;
	updatedAt?: string;
};
