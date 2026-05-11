import type { ColumnConfig } from "@/components/shared/data-table/types/column-config";
import { BadgeCell } from "../../../followup/_components/cells/badge-cell";
import { DateCell } from "../../../followup/_components/cells/date-cell";
import { DateTimeCell } from "../../../followup/_components/cells/datetime-cell";
import { DocumentsCell } from "../../../followup/_components/cells/documents-cell";
import { EditableCell } from "../../../followup/_components/cells/editable-cell";
import { HandlerCell } from "../../../followup/_components/cells/handler-cell";
import { BadgeSelectCell } from "../cells/badge-select-cell";
import { BooleanToggleCell } from "../cells/boolean-toggle-cell";
import { CheckNhapKhoCell } from "../cells/check-nhap-kho-cell";
import { DriveUrlsCell } from "../cells/drive-urls-cell";
import { FcrVehicleInfoCell } from "../cells/fcr-vehicle-info-cell";
import { LogJobsCell } from "../cells/log-jobs-cell";
import { TruckingActionsCell } from "../cells/trucking-actions-cell";
import { TruckingCompanyBadgeCell } from "../cells/trucking-company-badge-cell";
import { TruckingDiffEditableCell } from "../cells/trucking-diff-editable-cell";
import { TruckingGrossWeightCell } from "../cells/trucking-gross-weight-cell";
import { TruckingJobNumberCell } from "../cells/trucking-job-number-cell";
import { TruckingStatusCell } from "../cells/trucking-status-cell";
import { TruckingCreatedByCell } from "../cells/trucking-user-cell";
import { TruckingWarehouseCell } from "../cells/trucking-warehouse-cell";
import { TRUCKING_FOLLOWUP_LABELS } from "./column-labels";

// Stable filter: only show shipping lines matching the row's operationType (or general ones with null operationType)
const filterShippingLineByOperationType = (
	item: Record<string, any>,
	row: { operationType?: string | null },
) => !item.operationType || item.operationType === row.operationType;

// Don Vi Khu Trung options (3 companies)
export const DON_VI_KHU_TRUNG_OPTIONS = [
	{
		id: "0902365466 - Công Ty Cổ Phần  Giám Định Đại Việt",
		name: "0902365466 - Công Ty Cổ Phần  Giám Định Đại Việt",
	},
	{
		id: "0908685946 - Công ty Cổ Phần Giám Định  Khử Trùng VIETNAM CONTROL",
		name: "0908685946 - Công ty Cổ Phần Giám Định  Khử Trùng VIETNAM CONTROL",
	},
	{
		id: "0886670968 - CÔNG TY CỔ PHẦN GIÁM ĐỊNH KHỬ TRÙNG ĐẠI CỒ VIỆT",
		name: "0886670968 - CÔNG TY CỔ PHẦN GIÁM ĐỊNH KHỬ TRÙNG ĐẠI CỒ VIỆT",
	},
];

// Eport Service options (4 customs inspection types)
const EPORT_SERVICE_OPTIONS = [
	{
		id: "KHÔNG KIỂM HÓA",
		name: "KHÔNG KIỂM HÓA",
	},
	{
		id: "KIỂM HÓA",
		name: "KIỂM HÓA",
	},
	{
		id: "KIỂM HÓA 100%",
		name: "KIỂM HÓA 100%",
	},
	{
		id: "KHỬ TRÙNG",
		name: "KHỬ TRÙNG",
	},
];

export const TRUCKING_FOLLOWUP_HEADERS: Record<string, ColumnConfig> = {
	actions: {
		header: TRUCKING_FOLLOWUP_LABELS.actions,
		cell: TruckingActionsCell,
		size: 160,
		enableResizing: false,
		enablePinning: true,
		enableHiding: false,
		enableSorting: false,
		isPermanentlyPinned: true,
	},
	jobNumber: {
		header: TRUCKING_FOLLOWUP_LABELS.jobNumber,
		cell: TruckingJobNumberCell,
		size: 160,
		minSize: 150,
		isPermanentlyPinned: true,
	},
	requestNumber: {
		header: TRUCKING_FOLLOWUP_LABELS.requestNumber,
		size: 150,
		enableSorting: true,
	},
	isFinished: {
		header: TRUCKING_FOLLOWUP_LABELS.isFinished,
		hidden: true,
	},
	status: {
		header: TRUCKING_FOLLOWUP_LABELS.botMessage,
		cell: TruckingStatusCell,
		size: 250,
		minSize: 250,
	},
	companyName: {
		header: TRUCKING_FOLLOWUP_LABELS.companyName,
		cell: TruckingCompanyBadgeCell,
		size: 200,
	},
	vendor: {
		header: TRUCKING_FOLLOWUP_LABELS.vendor,
		cell: BadgeSelectCell,
		cellProps: { useDependency: "vendors", placeholder: "Select Vendor..." },
		size: 150,
	},
	ops: {
		header: TRUCKING_FOLLOWUP_LABELS.ops,
		cell: BadgeSelectCell,
		cellProps: { useDependency: "ops", placeholder: "Select OPS..." },
		size: 180,
	},
	hsCode: {
		header: TRUCKING_FOLLOWUP_LABELS.hsCode,
		cell: EditableCell,
		size: 120,
	},
	donViKhuTrung: {
		header: TRUCKING_FOLLOWUP_LABELS.donViKhuTrung,
		cell: BadgeSelectCell,
		cellProps: { items: DON_VI_KHU_TRUNG_OPTIONS, placeholder: "Select..." },
		size: 250,
	},
	temperature: {
		header: TRUCKING_FOLLOWUP_LABELS.temperature,
		cell: EditableCell,
		cellProps: { type: "number" },
		size: 100,
	},
	payDate: {
		header: TRUCKING_FOLLOWUP_LABELS.payDate,
		cell: DateCell,
		size: 150,
	},
	bbbt: {
		header: TRUCKING_FOLLOWUP_LABELS.bbbt,
		cell: EditableCell,
		size: 150,
		hidden: true,
	},
	clientName: {
		header: TRUCKING_FOLLOWUP_LABELS.clientName,
		cell: EditableCell,
		size: 200,
	},
	pvst: {
		header: TRUCKING_FOLLOWUP_LABELS.pvst,
		cell: BooleanToggleCell,
		size: 80,
		minSize: 70,
		enableSorting: false,
	},
	bienBanBT: {
		header: TRUCKING_FOLLOWUP_LABELS.bienBanBT,
		cell: BooleanToggleCell,
		size: 110,
		minSize: 90,
		enableSorting: false,
	},
	checkNhapKho: {
		header: TRUCKING_FOLLOWUP_LABELS.checkNhapKho,
		cell: CheckNhapKhoCell,
		size: 160,
		minSize: 140,
		enableSorting: false,
	},
	billOrBooking: {
		header: TRUCKING_FOLLOWUP_LABELS.billOrBooking,
		cell: EditableCell,
		size: 150,
	},
	serviceMode: {
		header: TRUCKING_FOLLOWUP_LABELS.serviceMode,
		cell: BadgeCell,
		cellProps: {
			mode: "single",
			colorVariant: "service",
			useDependency: "serviceModes",
		},
		size: 120,
	},
	operationType: {
		header: TRUCKING_FOLLOWUP_LABELS.operationType,
		cell: BadgeCell,
		cellProps: { mode: "view", colorVariant: "operation" },
		size: 120,
		minSize: 70,
	},
	documents: {
		header: TRUCKING_FOLLOWUP_LABELS.documents,
		cell: DocumentsCell,
		cellProps: { readOnly: true },
		size: 120,
		minSize: 70,
	},
	logJobs: {
		header: TRUCKING_FOLLOWUP_LABELS.logJobs,
		cell: LogJobsCell,
		size: 150,
		minSize: 100,
		enableSorting: false,
	},
	cbm: {
		header: TRUCKING_FOLLOWUP_LABELS.cbm,
		cell: TruckingDiffEditableCell,
		cellProps: { type: "number" },
		size: 100,
	},
	grossWeight: {
		header: TRUCKING_FOLLOWUP_LABELS.grossWeight,
		cell: TruckingGrossWeightCell,
		size: 120,
	},
	quantity: {
		header: TRUCKING_FOLLOWUP_LABELS.quantity,
		cell: TruckingDiffEditableCell,
		cellProps: { type: "number" },
		size: 100,
	},
	amount: {
		header: TRUCKING_FOLLOWUP_LABELS.amount,
		cell: EditableCell,
		cellProps: { type: "number", format: "currency-vnd" },
		size: 130,
	},
	transactionCode: {
		header: TRUCKING_FOLLOWUP_LABELS.transactionCode,
		cell: EditableCell,
		size: 160,
	},
	closingTime: {
		header: TRUCKING_FOLLOWUP_LABELS.closingTime,
		cell: DateCell,
		size: 160,
	},
	cutOffTime: {
		header: TRUCKING_FOLLOWUP_LABELS.cutOffTime,
		cell: DateCell,
		cellProps: { type: "datetime-local" },
		size: 160,
	},
	vesselName: {
		header: TRUCKING_FOLLOWUP_LABELS.vesselName,
		cell: EditableCell,
		size: 150,
	},
	veselNumber: {
		header: TRUCKING_FOLLOWUP_LABELS.veselNumber,
		cell: EditableCell,
		size: 120,
	},
	carrierName: {
		header: TRUCKING_FOLLOWUP_LABELS.carrierName,
		cell: BadgeSelectCell,
		cellProps: {
			useDependency: "shippingLines",
			filterFn: filterShippingLineByOperationType,
			placeholder: "Select Carrier...",
		},
		size: 150,
	},
	routineDetail: {
		header: TRUCKING_FOLLOWUP_LABELS.routineDetail,
		cell: EditableCell,
		cellProps: { multiline: true },
		size: 250,
	},
	fromLocation: {
		header: TRUCKING_FOLLOWUP_LABELS.fromLocation,
		cell: BadgeSelectCell,
		cellProps: {
			useDependency: "airports",
			placeholder: "Select Airport...",
			showBothIdAndName: true,
			saveAsName: true,
		},
		size: 150,
	},
	toLocation: {
		header: TRUCKING_FOLLOWUP_LABELS.toLocation,
		cell: BadgeSelectCell,
		cellProps: {
			useDependency: "airports",
			placeholder: "Select Airport...",
			showBothIdAndName: true,
			saveAsName: true,
		},
		size: 150,
	},
	truckType: {
		header: TRUCKING_FOLLOWUP_LABELS.truckType,
		cell: BadgeSelectCell,
		cellProps: {
			useDependency: "truckTypes",
			placeholder: "Select Loại xe...",
		},
		size: 150,
	},
	tTypeC: {
		header: TRUCKING_FOLLOWUP_LABELS.tTypeC,
		cell: BadgeSelectCell,
		cellProps: {
			useDependency: "truckTypes",
			placeholder: "Select Loại T-C...",
		},
		size: 150,
	},
	pickOrLiftPlace: {
		header: TRUCKING_FOLLOWUP_LABELS.pickOrLiftPlace,
		cell: BadgeSelectCell,
		cellProps: {
			useDependency: "pickOrLiftPlaces",
			placeholder: "Select place...",
		},
		size: 150,
	},
	commodityName: {
		header: TRUCKING_FOLLOWUP_LABELS.commodityName,
		cell: EditableCell,
		size: 150,
	},
	warehouse: {
		header: TRUCKING_FOLLOWUP_LABELS.warehouse,
		cell: TruckingWarehouseCell,
		size: 150,
	},
	pickUpTime: {
		header: TRUCKING_FOLLOWUP_LABELS.pickUpTime,
		cell: EditableCell,
		size: 160,
	},
	ccgh: {
		header: TRUCKING_FOLLOWUP_LABELS.ccgh,
		cell: DriveUrlsCell,
		size: 150,
	},
	authority: {
		header: TRUCKING_FOLLOWUP_LABELS.authority,
		cell: EditableCell,
		size: 150,
	},
	maLo: {
		header: TRUCKING_FOLLOWUP_LABELS.maLo,
		cell: EditableCell,
		cellProps: { readOnly: true },
		size: 120,
	},
	transitPort: {
		header: TRUCKING_FOLLOWUP_LABELS.transitPort,
		cell: BadgeSelectCell,
		cellProps: {
			useDependency: "transitPorts",
			placeholder: "Chọn cảng chuyển tải...",
		},
		size: 180,
	},
	destinationPort: {
		header: TRUCKING_FOLLOWUP_LABELS.destinationPort,
		cell: BadgeSelectCell,
		cellProps: {
			useDependency: "destinationPorts",
			placeholder: "Chọn cảng đích...",
		},
		size: 180,
	},
	deliveryContactDetail: {
		header: TRUCKING_FOLLOWUP_LABELS.deliveryContactDetail,
		cell: EditableCell,
		cellProps: { multiline: true },
		size: 250,
	},
	eportService: {
		header: TRUCKING_FOLLOWUP_LABELS.eportService,
		cell: BadgeCell,
		cellProps: {
			mode: "multiple",
			colorVariant: "eport",
			options: EPORT_SERVICE_OPTIONS.map((opt) => opt.id),
		},
		size: 200,
	},
	eportBooking: {
		header: TRUCKING_FOLLOWUP_LABELS.eportBooking,
		cell: EditableCell,
		size: 150,
	},
	maNhanConmt: {
		header: TRUCKING_FOLLOWUP_LABELS.maNhanConmt,
		cell: EditableCell,
		size: 150,
	},
	soLenh: {
		header: TRUCKING_FOLLOWUP_LABELS.soLenh,
		cell: EditableCell,
		size: 150,
	},
	invoiceTaxCode: {
		header: TRUCKING_FOLLOWUP_LABELS.invoiceTaxCode,
		cell: BadgeSelectCell,
		cellProps: {
			useDependency: "partners",
			placeholder: "Select MST...",
			showBothIdAndName: true,
		},
		size: 180,
	},
	ngatDienDate: {
		header: TRUCKING_FOLLOWUP_LABELS.ngatDienDate,
		cell: DateCell,
		cellProps: { type: "datetime-local" },
		size: 120,
	},
	implementationDate: {
		header: TRUCKING_FOLLOWUP_LABELS.implementationDate,
		cell: DateCell,
		size: 140,
	},
	note: {
		header: TRUCKING_FOLLOWUP_LABELS.note,
		cell: EditableCell,
		cellProps: { multiline: true },
		size: 200,
	},
	note2: {
		header: TRUCKING_FOLLOWUP_LABELS.note2,
		cell: EditableCell,
		cellProps: { multiline: true },
		size: 200,
	},
	note3: {
		header: TRUCKING_FOLLOWUP_LABELS.note3,
		cell: EditableCell,
		cellProps: { multiline: true },
		size: 200,
	},
	note4: {
		header: TRUCKING_FOLLOWUP_LABELS.note4,
		cell: EditableCell,
		cellProps: { multiline: true },
		size: 200,
	},
	note5: {
		header: TRUCKING_FOLLOWUP_LABELS.note5,
		cell: EditableCell,
		cellProps: { multiline: true },
		size: 200,
	},
	fcrVehicleInfo: {
		header: TRUCKING_FOLLOWUP_LABELS.fcrVehicleInfo,
		cell: FcrVehicleInfoCell,
		size: 200,
		enableSorting: false,
	},
	fcrPlateNumbers: {
		header: TRUCKING_FOLLOWUP_LABELS.fcrPlateNumbers,
		cell: FcrVehicleInfoCell,
		size: 100,
		enableSorting: false,
	},
	createdAt: {
		header: TRUCKING_FOLLOWUP_LABELS.createdAt,
		cell: DateTimeCell,
		size: 160,
	},
	createdBy: {
		header: "Người tạo",
		cell: TruckingCreatedByCell,
		size: 200,
	},
	handler: {
		header: TRUCKING_FOLLOWUP_LABELS.handler,
		cell: HandlerCell,
		cellProps: { useDependency: "siteUsers" },
		size: 200,
	},
	id: { header: TRUCKING_FOLLOWUP_LABELS.id, hidden: true },
};

export const FCR_HEADERS: Record<string, string> = {
	fcrNumber: "Số FCR",
	tType: "Loại T",
	tTypeC: "Loại T-C",
	plateNumber: "Biển số xe",
	truckType: "Loại xe",
	notes: "Ghi chú",
};
