"use client";

import {
	Building2,
	Check,
	ChevronDown,
	Columns3,
	Copy,
	FileSpreadsheet,
	FileText,
	FolderOpenIcon,
	MinusIcon,
	Package,
	PlayCircle,
	PlusIcon,
	SaveIcon,
	Trash2Icon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { WarehouseCombobox } from "@/components/shared/warehouse-combobox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuPositioner,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectPositioner,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useAirports } from "@/hooks/use-airports";
import { useCargoTypes } from "@/hooks/use-cargo-types";
import { useContainerSizes } from "@/hooks/use-container-sizes";
import { useFieldTemplates } from "@/hooks/use-field-templates";
import { useForeignPorts } from "@/hooks/use-foreign-ports";
import { useOps } from "@/hooks/use-ops";
import { usePartners } from "@/hooks/use-partners";
import { usePickOrLiftPlaces } from "@/hooks/use-pick-or-lift-place";
import { useServiceModes } from "@/hooks/use-service-modes";
import { useShippingLines } from "@/hooks/use-shipping-lines";
import { useTruckTypes } from "@/hooks/use-truck-types";
import { useUnits } from "@/hooks/use-units";
import { useVehicles } from "@/hooks/use-vehicles";
import { useVendors } from "@/hooks/use-vendor";
import { useWorkTypes } from "@/hooks/use-work-types";
import { cn } from "@/lib/utils";
import type { FollowUp } from "@/prisma/client";
import { ImportContainersDialog } from "../../../followup/_components/dialogs/import-containers-dialog";
import {
	UserCombobox,
	VirtualizedCombobox,
} from "../../../followup/_components/shared";
import { ContainerFields } from "../../../followup/_components/shared/container-fields";
import { FileUpload } from "../../../followup/_components/shared/file-upload";
import { PartnerCombobox } from "../../../followup/_components/shared/partner-combobox";
import { FOLLOWUP_LABELS } from "../../../followup/_components/table/column-labels";
import type { ContainerRow, FollowUpRow } from "../../../followup/types";
import { DON_VI_KHU_TRUNG_OPTIONS } from "../../../trucking-followup/_components/table/column-headers";
import { TRUCKING_FOLLOWUP_LABELS } from "../../../trucking-followup/_components/table/column-labels";
import { LoadTemplateDialog } from "./load-template-dialog";
import { SaveTemplateDialog } from "./save-template-dialog";

// Generate UUID that works in both server and client environments
function generateUUID(): string {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return crypto.randomUUID();
	}
	// Fallback for environments without crypto.randomUUID
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

// Date fields that need special formatting for input type="date"
const DATE_FIELDS = ["shmtDate", "deliveryDate", "transportDate", "etaEtd"];

// Vietnamese plate number regex pattern
const PLATE_REGEX =
	/\b([0-9]{2}[A-Z]{1,2}[\s\-.]?[0-9]{3,5}(?:[.\s]?[0-9]{1,2})?)\b/i;

const DECIMAL_FORM_FIELDS = new Set(["cbm", "grossWeight"]);
const INTEGER_FORM_FIELDS = new Set(["quantity"]);

// Format date value to YYYY-MM-DD for input type="date"
function formatDateForInput(value: unknown): string {
	if (!value) return "";

	const strValue = String(value);

	// Already in YYYY-MM-DD format
	if (/^\d{4}-\d{2}-\d{2}$/.test(strValue)) {
		return strValue;
	}

	// Try parsing as Date (handles ISO strings like "2025-02-05T00:00:00.000Z")
	const date = new Date(strValue);
	if (!Number.isNaN(date.getTime())) {
		// Format to YYYY-MM-DD
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}

	// Try DD/MM/YYYY format
	const ddmmyyyy = strValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (ddmmyyyy) {
		const [, dd, mm, yyyy] = ddmmyyyy;
		return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
	}

	return "";
}

function parseOptionalDecimalValue(value: unknown): number | null {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}

	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) {
			return null;
		}

		const parsed = Number(trimmed);
		return Number.isFinite(parsed) ? parsed : null;
	}

	return null;
}

function parseOptionalIntegerValue(value: unknown): number | null {
	if (typeof value === "number") {
		return Number.isFinite(value) ? Math.trunc(value) : null;
	}

	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) {
			return null;
		}

		const parsed = Number.parseInt(trimmed, 10);
		return Number.isFinite(parsed) ? parsed : null;
	}

	return null;
}

interface AddRecordDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onAddRecord: (
		newRecord: FollowUpRow,
		files?: FileList | null,
	) => Promise<void>;
	prefillData?: FollowUpRow | null;
	mode?: "FOLLOWUP" | "TRUCKING"; // TRUCKING mode hides operationType and defaults to TRUCK
}

const OPERATION_TYPES = ["XUAT", "NHAP", "TRUCK"];
const DOMAINS = ["SGN", "DAD", "HAN"];

// Optional columns for Logistics (FOLLOWUP mode)
const OPTIONAL_FOLLOWUP_FIELDS: (keyof FollowUp)[] = [
	"serviceMode",
	"unit",
	"notes",
	"cargoType",
	"workType",
	"cbm",
	"deliveryDate",
	"truckNumber",
	"location",
	"supervisionGate",
	"handler",
	"poNumber",
	"note2",
	"note3",
	"pickupLocation",
	"loadingLocation",
	"transportMethod",
	"transportDate",
	"taxService",
	"coNumber",
	"quantity",
	"supplier",
	"grossWeight",
	"invoice",
	"billOrBooking",
	"authority",
	"pol",
	"pod",
	"pickUpTime",
	"commodityName",
	"shmtDate",
	"warehouse",
	"etaEtd",
];

const OPTIONAL_TRUCKING_FIELDS: string[] = [
	// "serviceMode", // Moved to required for TRUCKING
	"cbm",
	"grossWeight",
	"quantity",
	"closingTime",
	"cutOffTime",
	"vesselName",
	"veselNumber",
	"carrierName",
	"routineDetail",
	"fromLocation",
	"toLocation",
	"pickOrLiftPlace",
	"commodityName",
	"warehouse",
	"pickUpTime",
	// "ccgh",
	"authority",
	"maLo",
	"transitPort",
	"destinationPort",
	"deliveryContactDetail",
	"eportService",
	"eportBooking",
	"maNhanConmt",
	"soLenh",
	"ngatDienDate",
	"implementationDate",
	"note",
	"note2",
	"note3",
	"note4",
	"note5",
	"handler",
	"billOrBooking",
	"vendor",
	"hsCode",
	"donViKhuTrung",
	"temperature",
	"payDate",
	"bbbt",
	"clientName",
	"truckType",
	"tTypeC",
	"invoiceTaxCode",
	"ops",
];

// Helper function to get optional columns based on mode
function getOptionalColumns(mode: "FOLLOWUP" | "TRUCKING") {
	if (mode === "TRUCKING") {
		return OPTIONAL_TRUCKING_FIELDS.map((key) => ({
			key,
			label:
				TRUCKING_FOLLOWUP_LABELS[
					key as keyof typeof TRUCKING_FOLLOWUP_LABELS
				] || key,
		})).sort((a, b) => a.label.localeCompare(b.label, "vi"));
	}
	return OPTIONAL_FOLLOWUP_FIELDS.map((key) => ({
		key,
		label: FOLLOWUP_LABELS[key] || key,
	})).sort((a, b) => a.label.localeCompare(b.label, "vi"));
}

export function AddRecordDialog({
	open,
	onOpenChange,
	onAddRecord,
	prefillData,
	mode = "FOLLOWUP",
}: AddRecordDialogProps) {
	const OPTIONAL_COLUMNS = useMemo(() => getOptionalColumns(mode), [mode]);
	const { airports } = useAirports();
	const { serviceModes } = useServiceModes();
	const { units } = useUnits();
	const { cargoTypes } = useCargoTypes();
	const { workTypes } = useWorkTypes();
	const { truckTypes } = useTruckTypes();
	const { containerSizes } = useContainerSizes();
	const { vendors: vendorsRaw } = useVendors();
	const { ops: opsRaw } = useOps();
	const { pickOrLiftPlaces: pickOrLiftPlacesRaw } = usePickOrLiftPlaces();
	const { shippingLines } = useShippingLines();
	const { ports: transitPortsRaw } = useForeignPorts("TRANSIT");
	const { ports: destinationPortsRaw } = useForeignPorts("DESTINATION");
	const { partners } = usePartners();
	const { data: templates } = useFieldTemplates();
	const { vehicles } = useVehicles();

	// Memoize combobox options
	const vendorOptions = useMemo(
		() => vendorsRaw.map((v: string) => ({ id: v, name: v })),
		[vendorsRaw],
	);
	const opsOptions = useMemo(
		() => opsRaw.map((v: string) => ({ id: v, name: v })),
		[opsRaw],
	);
	const pickOrLiftPlaceOptions = useMemo(
		() => pickOrLiftPlacesRaw.map((p: string) => ({ id: p, name: p })),
		[pickOrLiftPlacesRaw],
	);
	const shippingLineOptions = useMemo(
		() => shippingLines.map((s) => ({ id: s.name, name: s.name })),
		[shippingLines],
	);
	const transitPortOptions = useMemo(
		() => transitPortsRaw.map((p) => ({ id: p.name, name: p.name })),
		[transitPortsRaw],
	);
	const destinationPortOptions = useMemo(
		() => destinationPortsRaw.map((p) => ({ id: p.name, name: p.name })),
		[destinationPortsRaw],
	);
	const partnerOptions = useMemo(
		() => partners.map((p) => ({ id: p.id, name: p.name })),
		[partners],
	);

	const [formData, setFormData] = useState<Record<string, string | number>>({
		operationType: "",
		taxCode: "",
		serviceMode: "",
	});

	const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
		new Set(),
	);
	const [duplicateCount, setDuplicateCount] = useState(1);
	const [dropdownOpen, setDropdownOpen] = useState(false);
	const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
	const [loadTemplateDialogOpen, setLoadTemplateDialogOpen] = useState(false);
	const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);
	const [templateSaveMode, setTemplateSaveMode] = useState<"create" | "update">(
		"create",
	);
	const [activeTemplate, setActiveTemplate] = useState<{
		id: string;
		name: string;
		description?: string | null;
	} | null>(null);
	const [importContainersDialogOpen, setImportContainersDialogOpen] =
		useState(false);
	const [subRowContainers, setSubRowContainers] = useState<
		Partial<ContainerRow>[]
	>([]);
	const [isCheckingBillOrBooking, setIsCheckingBillOrBooking] = useState(false);
	const [billOrBookingError, setBillOrBookingError] = useState<string | null>(
		null,
	);
	const [isFormDirty, setIsFormDirty] = useState(false);
	const hasAutoLoadedDefaultTemplateRef = useRef(false);

	// Tab state
	const [activeTab, setActiveTab] = useState<"single" | "batch">("single");

	const markFormDirty = useCallback(() => {
		hasAutoLoadedDefaultTemplateRef.current = true;
		setIsFormDirty(true);
	}, []);

	// Batch Run state
	const [batchItems, setBatchItems] = useState<
		Array<{
			id: string;
			templateId: string;
			name: string;
			selectedFields: string[];
			fieldData?: Record<string, any> | null;
			count: number;
			jobFieldData: Record<string, string | number>[];
		}>
	>([]);
	const [batchPickerOpen, setBatchPickerOpen] = useState(false);
	const [isBatchRunning, setIsBatchRunning] = useState(false);

	const getBatchEditableFields = useCallback(
		(item: {
			selectedFields: string[];
			fieldData?: Record<string, any> | null;
		}) => {
			const fields = new Set(item.selectedFields);

			if (mode === "TRUCKING") {
				const truckingCoreFields = [
					"serviceMode",
					"truckType",
					"tTypeC",
					"vendor",
					"warehouse",
					"fromLocation",
					"toLocation",
					"implementationDate",
				];

				for (const key of truckingCoreFields) {
					if (item.fieldData?.[key] !== undefined) {
						fields.add(key);
					}
				}
			}

			return Array.from(fields).filter(
				(key) => key !== "operationType" && key !== "taxCode",
			);
		},
		[mode],
	);

	const createBatchJobData = useCallback(
		(
			fieldKeys: string[],
			fieldData?: Record<string, any> | null,
		): Record<string, string | number> => {
			return fieldKeys.reduce<Record<string, string | number>>((acc, key) => {
				const value = fieldData?.[key];
				if (value !== undefined && value !== null) {
					acc[key] = value as string | number;
				}
				return acc;
			}, {});
		},
		[],
	);

	const updateBatchJobField = useCallback(
		(
			itemId: string,
			jobIndex: number,
			fieldKey: string,
			value: string | number,
		) => {
			// Auto-fill license plate detection for batch jobs
			if (mode === "TRUCKING" && fieldKey === "note5" && value) {
				const note5Value = String(value);
				const plateMatch = note5Value.match(PLATE_REGEX);

				if (plateMatch) {
					const rawPlate = plateMatch[1].replace(/[\s\-.]/g, "").toUpperCase();
					const matched = vehicles.find(
						(v) => v.replace(/[\s\-.]/g, "").toUpperCase() === rawPlate,
					);

					if (matched) {
						toast.success("Đã phát hiện BKS", {
							description: `Đã nhận diện "${matched.trim()}" từ Note 5. Biển số sẽ tự động áp dụng khi tạo Job.`,
							duration: 3000,
						});
					}
				}
			}

			setBatchItems((prev) =>
				prev.map((item) => {
					if (item.id !== itemId) return item;

					const nextJobFieldData = [...item.jobFieldData];
					const currentJobData = nextJobFieldData[jobIndex] ?? {};
					nextJobFieldData[jobIndex] = {
						...currentJobData,
						[fieldKey]: value,
					};

					return {
						...item,
						jobFieldData: nextJobFieldData,
					};
				}),
			);
		},
		[mode, vehicles],
	);

	const renderBatchJobField = useCallback(
		(
			item: {
				id: string;
				fieldData?: Record<string, any> | null;
				jobFieldData: Record<string, string | number>[];
			},
			jobIndex: number,
			fieldKey: string,
		) => {
			const column = OPTIONAL_COLUMNS.find(
				(entry) => entry.key === fieldKey,
			) ?? {
				key: fieldKey,
				label:
					TRUCKING_FOLLOWUP_LABELS[
						fieldKey as keyof typeof TRUCKING_FOLLOWUP_LABELS
					] || fieldKey,
			};

			const jobData = item.jobFieldData?.[jobIndex] ?? {};
			const value = jobData[fieldKey];
			const onValueChange = (nextValue: string | number) =>
				updateBatchJobField(item.id, jobIndex, fieldKey, nextValue);

			const airportFields = ["authority", "fromLocation", "toLocation"];

			if (fieldKey === "serviceMode") {
				return (
					<div key={fieldKey} className="space-y-1">
						<label className="text-[11px] font-medium">{column.label}</label>
						<Select
							value={(value as string) || ""}
							onValueChange={(nextValue: unknown) =>
								onValueChange(nextValue as string)
							}
						>
							<SelectTrigger className="h-8 text-xs w-full">
								<SelectValue placeholder="Chọn service mode..." />
							</SelectTrigger>
							<SelectPositioner>
								<SelectContent>
									{serviceModes.map((serviceMode) => (
										<SelectItem
											key={serviceMode}
											value={serviceMode}
											className="text-xs"
										>
											{serviceMode}
										</SelectItem>
									))}
								</SelectContent>
							</SelectPositioner>
						</Select>
					</div>
				);
			}

			if (fieldKey === "truckType") {
				return (
					<div key={fieldKey} className="space-y-1">
						<label className="text-[11px] font-medium">{column.label}</label>
						<Select
							value={(value as string) || ""}
							onValueChange={(nextValue: unknown) =>
								onValueChange(nextValue as string)
							}
						>
							<SelectTrigger className="h-8 text-xs w-full">
								<SelectValue placeholder="Chọn loại xe..." />
							</SelectTrigger>
							<SelectPositioner>
								<SelectContent>
									{truckTypes.map((type) => (
										<SelectItem key={type} value={type} className="text-xs">
											{type}
										</SelectItem>
									))}
								</SelectContent>
							</SelectPositioner>
						</Select>
					</div>
				);
			}

			if (airportFields.includes(fieldKey)) {
				return (
					<VirtualizedCombobox
						key={fieldKey}
						label={column.label}
						items={airports}
						value={(value as string) || ""}
						onChange={(nextValue) => onValueChange(nextValue)}
						placeholder="Chọn địa điểm..."
						searchPlaceholder="Search by code or name..."
						emptyMessage="No results found."
					/>
				);
			}

			if (fieldKey === "vendor") {
				return (
					<VirtualizedCombobox
						key={fieldKey}
						label={column.label}
						items={vendorOptions}
						value={(value as string) || ""}
						onChange={(nextValue) => onValueChange(nextValue)}
						placeholder="Select vendor..."
						searchPlaceholder="Search vendor..."
						emptyMessage="No vendors found."
						hideId
					/>
				);
			}

			if (fieldKey === "ops") {
				return (
					<VirtualizedCombobox
						key={fieldKey}
						label={column.label}
						items={opsOptions}
						value={(value as string) || ""}
						onChange={(nextValue) => onValueChange(nextValue)}
						placeholder="Select OPS..."
						searchPlaceholder="Search OPS..."
						emptyMessage="No OPS found."
						hideId
					/>
				);
			}

			if (fieldKey === "transitPort") {
				return (
					<VirtualizedCombobox
						key={fieldKey}
						label={column.label}
						items={transitPortOptions}
						value={(value as string) || ""}
						onChange={(nextValue) => onValueChange(nextValue)}
						placeholder="Chọn cảng chuyển tải..."
						searchPlaceholder="Search port..."
						emptyMessage="No ports found."
						hideId
					/>
				);
			}

			if (fieldKey === "destinationPort") {
				return (
					<VirtualizedCombobox
						key={fieldKey}
						label={column.label}
						items={destinationPortOptions}
						value={(value as string) || ""}
						onChange={(nextValue) => onValueChange(nextValue)}
						placeholder="Chọn cảng đích..."
						searchPlaceholder="Search port..."
						emptyMessage="No ports found."
						hideId
					/>
				);
			}

			if (fieldKey === "pickOrLiftPlace") {
				return (
					<VirtualizedCombobox
						key={fieldKey}
						label={column.label}
						items={pickOrLiftPlaceOptions}
						value={(value as string) || ""}
						onChange={(nextValue) => onValueChange(nextValue)}
						placeholder="Select place..."
						searchPlaceholder="Search place..."
						emptyMessage="No places found."
						hideId
					/>
				);
			}

			if (fieldKey === "carrierName") {
				return (
					<VirtualizedCombobox
						key={fieldKey}
						label={column.label}
						items={shippingLineOptions}
						value={(value as string) || ""}
						onChange={(nextValue) => onValueChange(nextValue)}
						placeholder="Select carrier..."
						searchPlaceholder="Search carrier..."
						emptyMessage="No carriers found."
						hideId
					/>
				);
			}

			if (fieldKey === "invoiceTaxCode") {
				return (
					<VirtualizedCombobox
						key={fieldKey}
						label={column.label}
						items={partnerOptions}
						value={(value as string) || ""}
						onChange={(nextValue) => onValueChange(nextValue)}
						placeholder="Select MST..."
						searchPlaceholder="Search MST..."
						emptyMessage="No partners found."
					/>
				);
			}

			if (fieldKey === "donViKhuTrung") {
				return (
					<VirtualizedCombobox
						key={fieldKey}
						label={column.label}
						items={DON_VI_KHU_TRUNG_OPTIONS}
						value={(value as string) || ""}
						onChange={(nextValue) => onValueChange(nextValue)}
						placeholder="Select..."
						searchPlaceholder="Search..."
						emptyMessage="No results found."
						hideId
					/>
				);
			}

			if (fieldKey === "handler") {
				return (
					<UserCombobox
						key={fieldKey}
						label={column.label}
						value={(value as string) || ""}
						onChange={(nextValue) => onValueChange(nextValue)}
						placeholder={`Select ${column.label.toLowerCase()}...`}
						department="Logistics"
					/>
				);
			}

			if (fieldKey === "warehouse") {
				return (
					<WarehouseCombobox
						key={fieldKey}
						taxCode={(item.fieldData?.taxCode as string) || null}
						value={(value as string) || ""}
						onChange={(nextValue) => onValueChange(nextValue)}
						label={column.label}
						placeholder="Chọn kho..."
						positionerClassName="z-[200]"
					/>
				);
			}

			if (
				fieldKey === "cbm" ||
				fieldKey === "grossWeight" ||
				fieldKey === "temperature"
			) {
				return (
					<div key={fieldKey} className="space-y-1">
						<label className="text-[11px] font-medium">{column.label}</label>
						<Input
							type="number"
							step="0.01"
							className="h-8 text-xs"
							value={(value as number) ?? ""}
							onChange={(event) => onValueChange(event.target.value)}
						/>
					</div>
				);
			}

			if (fieldKey === "quantity") {
				return (
					<div key={fieldKey} className="space-y-1">
						<label className="text-[11px] font-medium">{column.label}</label>
						<Input
							type="number"
							step="1"
							min="0"
							className="h-8 text-xs"
							value={(value as number) ?? ""}
							onChange={(event) => onValueChange(event.target.value)}
						/>
					</div>
				);
			}

			if (
				fieldKey === "deliveryDate" ||
				fieldKey === "transportDate" ||
				fieldKey === "etaEtd" ||
				fieldKey === "shmtDate" ||
				fieldKey === "implementationDate" ||
				fieldKey === "payDate" ||
				fieldKey === "closingTime" ||
				fieldKey === "cutOffTime"
			) {
				return (
					<div key={fieldKey} className="space-y-1">
						<label className="text-[11px] font-medium">{column.label}</label>
						<Input
							type="date"
							className="h-8 text-xs"
							value={formatDateForInput(value) || ""}
							onChange={(event) => onValueChange(event.target.value)}
						/>
					</div>
				);
			}

			if (fieldKey === "ngatDienDate") {
				return (
					<div key={fieldKey} className="space-y-1">
						<label className="text-[11px] font-medium">{column.label}</label>
						<Input
							type="datetime-local"
							className="h-8 text-xs"
							value={(value as string) || ""}
							onChange={(event) => onValueChange(event.target.value)}
						/>
					</div>
				);
			}

			return (
				<div key={fieldKey} className="space-y-1">
					<label className="text-[11px] font-medium">{column.label}</label>
					<Input
						className="h-8 text-xs"
						value={(value as string) || ""}
						onChange={(event) => onValueChange(event.target.value)}
						placeholder={`Enter ${column.label.toLowerCase()}`}
					/>
				</div>
			);
		},
		[
			OPTIONAL_COLUMNS,
			airports,
			destinationPortOptions,
			opsOptions,
			partnerOptions,
			pickOrLiftPlaceOptions,
			serviceModes,
			shippingLineOptions,
			transitPortOptions,
			truckTypes,
			updateBatchJobField,
			vendorOptions,
		],
	);

	// Container validation (duplicates and empty numbers)
	const containerErrors = useMemo(() => {
		const errorIndices = new Map<number, string>();
		const seen = new Map<string, number>();

		subRowContainers.forEach((c, index) => {
			const containerNo = c.containerNo?.trim().toUpperCase();

			// Check if empty
			if (!containerNo) {
				errorIndices.set(index, "Required");
				return;
			}

			// Check if duplicate
			if (seen.has(containerNo)) {
				errorIndices.set(index, "Duplicate number");
				errorIndices.set(seen.get(containerNo)!, "Duplicate number");
			} else {
				seen.set(containerNo, index);
			}
		});

		return errorIndices;
	}, [subRowContainers]);

	// Prefill form data when dialog opens with prefillData (for Rerun Transaction)
	useEffect(() => {
		if (open && prefillData) {
			hasAutoLoadedDefaultTemplateRef.current = true;
			setIsFormDirty(false);

			// Build form data from prefillData
			const newFormData: Record<string, string | number> = {
				operationType: prefillData.operationType || "",
				taxCode: prefillData.taxCode || "",
			};

			// Collect which optional columns have values
			const columnsToSelect = new Set<string>();

			for (const col of OPTIONAL_COLUMNS) {
				const value = prefillData[col.key as keyof FollowUpRow];
				if (value !== null && value !== undefined && value !== "") {
					// Format date fields for input type="date"
					if (DATE_FIELDS.includes(col.key)) {
						const formattedDate = formatDateForInput(value);
						if (formattedDate) {
							newFormData[col.key] = formattedDate;
							columnsToSelect.add(col.key);
						}
					} else {
						newFormData[col.key] = value as string | number;
						columnsToSelect.add(col.key);
					}
				}
			}

			setFormData(newFormData);
			setSelectedColumns(columnsToSelect);

			// Prefill containers if any
			if (prefillData.containers && prefillData.containers.length > 0) {
				setSubRowContainers(
					prefillData.containers.map((c) => ({
						...c,
						id: generateUUID(), // Generate new IDs for the copies
					})),
				);
			}
		} else if (!open) {
			hasAutoLoadedDefaultTemplateRef.current = false;
			setIsFormDirty(false);

			// Reset form when dialog closes
			setFormData({
				operationType: "",
				taxCode: "",
			});
			setSelectedColumns(new Set());
			setSubRowContainers([]);
			setSelectedFiles(null);
			setDuplicateCount(1);
			setBillOrBookingError(null);
			setActiveTemplate(null);
			setTemplateSaveMode("create");
		}
	}, [open, prefillData, OPTIONAL_COLUMNS]);

	// Debounced check for duplicate billOrBooking
	useEffect(() => {
		const billValue = formData.billOrBooking as string;
		if (!billValue || !selectedColumns.has("billOrBooking")) {
			setBillOrBookingError(null);
			return;
		}

		const timer = setTimeout(async () => {
			setIsCheckingBillOrBooking(true);
			try {
				const domainParam = formData.domain ? `&site=${formData.domain}` : "";
				const response = await fetch(
					`/api/followup/check-bill-booking?value=${encodeURIComponent(billValue)}${domainParam}`,
				);
				const data = await response.json();
				if (data.exists) {
					setBillOrBookingError(
						`Bill/Booking already exists in job ${data.jobNumber || "unknown"}${formData.domain ? ` for site ${formData.domain}` : ""}`,
					);
				} else {
					setBillOrBookingError(null);
				}
			} catch (error) {
				console.error("Error checking billOrBooking:", error);
			} finally {
				setIsCheckingBillOrBooking(false);
			}
		}, 500);

		return () => clearTimeout(timer);
	}, [formData.billOrBooking, formData.domain, selectedColumns.has]);

	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement>,
		field: string,
	) => {
		const value = e.target.value;

		markFormDirty();

		setFormData((prev) => ({
			...prev,
			[field]: value,
		}));

		// Auto-fill license plate for containers in trucking mode when note5 is updated
		if (mode === "TRUCKING" && field === "note5" && value) {
			const note5Value = String(value);
			const plateMatch = note5Value.match(PLATE_REGEX);

			if (plateMatch) {
				const rawPlate = plateMatch[1].replace(/[\s\-.]/g, "").toUpperCase();

				// Check against cached vehicles from ERP
				const matched = vehicles.find(
					(v) => v.replace(/[\s\-.]/g, "").toUpperCase() === rawPlate,
				);

				if (matched) {
					const matchedPlateNumber = matched.trim();
					setSubRowContainers((prev) =>
						prev.map((c) => ({
							...c,
							plateNumber: matchedPlateNumber,
						})),
					);
					toast.success("Đã phát hiện BKS", {
						description: `Tự động điền "${matchedPlateNumber}" cho các container.`,
					});
				}
			}
		}
	};

	const handleNumericInputBlur = useCallback((field: string) => {
		setFormData((prev) => {
			const currentValue = prev[field];

			if (DECIMAL_FORM_FIELDS.has(field)) {
				const parsedValue = parseOptionalDecimalValue(currentValue);
				const normalizedValue = parsedValue === null ? "" : parsedValue;

				if (currentValue === normalizedValue) {
					return prev;
				}

				return {
					...prev,
					[field]: normalizedValue,
				};
			}

			if (INTEGER_FORM_FIELDS.has(field)) {
				const parsedValue = parseOptionalIntegerValue(currentValue);
				const normalizedValue = parsedValue === null ? "" : parsedValue;

				if (currentValue === normalizedValue) {
					return prev;
				}

				return {
					...prev,
					[field]: normalizedValue,
				};
			}

			return prev;
		});
	}, []);

	const handleSelectChange = (field: string, value: string) => {
		markFormDirty();

		setFormData((prev) => ({
			...prev,
			[field]: value,
		}));
	};

	const handleColumnToggle = (columnKey: string) => {
		markFormDirty();

		setSelectedColumns((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(columnKey)) {
				newSet.delete(columnKey);
			} else {
				newSet.add(columnKey);
			}
			return newSet;
		});
	};

	const handleLoadTemplate = (
		templateId: string,
		selectedFields: string[],
		fieldData?: Record<string, any> | null,
		templateMeta?: {
			name: string;
			description?: string | null;
		},
	) => {
		hasAutoLoadedDefaultTemplateRef.current = true;
		setIsFormDirty(false);

		setSelectedColumns(new Set(selectedFields));
		setActiveTemplate(
			templateMeta
				? {
						id: templateId,
						name: templateMeta.name,
						description: templateMeta.description,
					}
				: null,
		);

		// Load field data if available
		if (fieldData) {
			// Extract special fields
			const { _containers, _duplicateCount, ...regularFields } = fieldData;

			// Restore form data
			setFormData((prev) => ({
				...prev,
				...regularFields,
			}));

			// Restore containers if available
			if (_containers && Array.isArray(_containers)) {
				setSubRowContainers(
					_containers.map((c: any) => ({
						...c,
						id: generateUUID(), // Generate new IDs for template containers
					})),
				);
			}

			// Restore duplicate count if available
			if (_duplicateCount && typeof _duplicateCount === "number") {
				setDuplicateCount(_duplicateCount);
			}
		} else {
			setSubRowContainers([]);
			setDuplicateCount(1);
		}
	};

	// Auto-load only default template whenever opening Add New (without prefill)
	useEffect(() => {
		if (
			!open ||
			prefillData ||
			isFormDirty ||
			hasAutoLoadedDefaultTemplateRef.current
		)
			return;
		if (!templates || templates.length === 0) {
			setActiveTemplate(null);
			return;
		}

		const defaultTemplate = templates.find((template) => template.isDefault);
		if (!defaultTemplate) {
			setActiveTemplate(null);
			return;
		}

		handleLoadTemplate(
			defaultTemplate.id,
			defaultTemplate.selectedFields,
			defaultTemplate.fieldData,
			{
				name: defaultTemplate.name,
				description: defaultTemplate.description,
			},
		);
	}, [isFormDirty, open, prefillData, templates, handleLoadTemplate]);

	const incrementDuplicates = () => {
		markFormDirty();
		setDuplicateCount((prev) => Math.min(prev + 1, 10));
	};

	const decrementDuplicates = () => {
		markFormDirty();
		setDuplicateCount((prev) => Math.max(prev - 1, 1));
	};

	// Container sub-row handlers
	const handleAddContainer = () => {
		markFormDirty();

		const defaultWarehouse =
			selectedColumns.has("warehouse") && typeof formData.warehouse === "string"
				? formData.warehouse
				: "";

		// Check for existing plate in note5
		let plateFromNote = "";
		if (mode === "TRUCKING" && formData.note5) {
			const match = String(formData.note5).match(PLATE_REGEX);
			if (match) {
				const rawPlate = match[1].replace(/[\s\-.]/g, "").toUpperCase();
				const matched = vehicles.find(
					(v) => v.replace(/[\s\-.]/g, "").toUpperCase() === rawPlate,
				);
				if (matched) plateFromNote = matched.trim();
			}
		}

		setSubRowContainers((prev) => [
			...prev,
			{
				id: generateUUID(),
				followUpId: "",
				containerNo: "",
				sealNo: "",
				quantity: 1,
				grossWeight: undefined,
				warehouse: defaultWarehouse,
				plateNumber: plateFromNote,
			},
		]);
	};

	const handleRemoveContainer = (index: number) => {
		markFormDirty();
		setSubRowContainers((prev) => prev.filter((_, i) => i !== index));
	};

	const handleImportContainers = (containers: any[]) => {
		markFormDirty();

		const defaultWarehouse =
			selectedColumns.has("warehouse") && typeof formData.warehouse === "string"
				? formData.warehouse
				: "";

		const importedContainers = containers.map((container) => ({
			id: generateUUID(),
			followUpId: "",
			containerNo: container.containerNo || "",
			sealNo: container.sealNo || "",
			containerSize: container.containerSize || "",
			quantity: 1,
			grossWeight: container.grossWeight ?? undefined,
			tareWeight: container.tareWeight ?? undefined,
			warehouse: container.warehouse || defaultWarehouse,
		}));

		setSubRowContainers((prev) => [...prev, ...importedContainers]);
	};

	const handleContainerFieldChange = (
		index: number,
		field: keyof ContainerRow,
		value: string | number,
	) => {
		markFormDirty();

		setSubRowContainers((prev) =>
			prev.map((container, i) =>
				i === index ? { ...container, [field]: value } : container,
			),
		);
	};

	// Builds a single FollowUpRow from explicit data (used by both handleSubmit and batch run)
	const buildRecord = (
		data: Record<string, string | number>,
		cols: Set<string>,
		containers: Partial<ContainerRow>[],
	): FollowUpRow => {
		const record: FollowUpRow = {
			id: generateUUID(),
			status: "",
			botMessage: "",
			operationType: data.operationType as FollowUpRow["operationType"],
			taxCode: data.taxCode as string,
			serviceMode:
				mode === "TRUCKING"
					? (data.serviceMode as string) || null
					: cols.has("serviceMode")
						? (data.serviceMode as FollowUpRow["serviceMode"]) || null
						: null,
			notes: cols.has("notes") ? (data.notes as string) || "" : "",
			cargoType: cols.has("cargoType") ? (data.cargoType as string) || "" : "",
			cbm: cols.has("cbm") ? parseOptionalDecimalValue(data.cbm) : null,
			deliveryDate: cols.has("deliveryDate")
				? (data.deliveryDate as string) || ""
				: "",
			truckNumber: cols.has("truckNumber")
				? (data.truckNumber as string) || ""
				: "",
			location: cols.has("location") ? (data.location as string) || "" : "",
			supervisionGate: cols.has("supervisionGate")
				? (data.supervisionGate as string) || ""
				: "",
			handler: cols.has("handler") ? (data.handler as string) || "" : "",
			poNumber: cols.has("poNumber") ? (data.poNumber as string) || "" : "",
			note2: cols.has("note2") ? (data.note2 as string) || "" : "",
			note3: cols.has("note3") ? (data.note3 as string) || "" : "",
			domain: null,
			arNumber: "",
			pickupLocation: cols.has("pickupLocation")
				? (data.pickupLocation as string) || ""
				: "",
			loadingLocation: cols.has("loadingLocation")
				? (data.loadingLocation as string) || ""
				: "",
			transportMethod: cols.has("transportMethod")
				? (data.transportMethod as string) || ""
				: "",
			transportDate: cols.has("transportDate")
				? (data.transportDate as string) || ""
				: "",
			taxService: cols.has("taxService")
				? (data.taxService as string) || ""
				: "",
			coNumber: cols.has("coNumber") ? (data.coNumber as string) || "" : "",
			unit: cols.has("unit") ? (data.unit as string) || "" : "",
			workType: cols.has("workType") ? (data.workType as string) || "" : "",
			quantity: cols.has("quantity")
				? parseOptionalIntegerValue(data.quantity)
				: null,
			billOrBooking: cols.has("billOrBooking")
				? (data.billOrBooking as string) || ""
				: "",
			supplier: cols.has("supplier") ? (data.supplier as string) || "" : "",
			grossWeight: cols.has("grossWeight")
				? parseOptionalDecimalValue(data.grossWeight)
				: null,
			invoice: cols.has("invoice") ? (data.invoice as string) || "" : "",
			authority: cols.has("authority") ? (data.authority as string) || "" : "",
			createdBy: cols.has("createdBy") ? (data.createdBy as string) || "" : "",
			pol: cols.has("pol") ? (data.pol as string) || "" : "",
			pod: cols.has("pod") ? (data.pod as string) || "" : "",
			etaEtd: cols.has("etaEtd") ? (data.etaEtd as string) || "" : "",
			requestTruckingNo: "",
			jobPriority: cols.has("jobPriority")
				? (parseOptionalIntegerValue(data.jobPriority) ?? 6)
				: 6,
			driveUrl: "",
			localPath: "",
			pickUpTime: cols.has("pickUpTime")
				? (data.pickUpTime as string) || ""
				: "",
			commodityName: cols.has("commodityName")
				? (data.commodityName as string) || ""
				: "",
			startTime: "",
			endTime: "",
			shmtDate: cols.has("shmtDate") ? (data.shmtDate as string) || "" : "",
			warehouse: cols.has("warehouse") ? (data.warehouse as string) || "" : "",
			containers: containers.map((c) => {
				let plateNumber = c.plateNumber;

				// Auto-fill plate from note5 if not already set (important for Batch Run)
				if (mode === "TRUCKING" && data.note5 && !plateNumber) {
					const note5Value = String(data.note5);
					const plateMatch = note5Value.match(PLATE_REGEX);

					if (plateMatch) {
						const rawPlate = plateMatch[1]
							.replace(/[\s\-.]/g, "")
							.toUpperCase();
						const matched = vehicles.find(
							(v) => v.replace(/[\s\-.]/g, "").toUpperCase() === rawPlate,
						);
						if (matched) {
							plateNumber = matched.trim();
						}
					}
				}

				return {
					...c,
					id: generateUUID(),
					followUpId: "",
					plateNumber,
					warehouse:
						(typeof c.warehouse === "string" && c.warehouse) ||
						(cols.has("warehouse") ? (data.warehouse as string) || "" : ""),
				};
			}) as ContainerRow[],
		};
		// For TRUCKING mode, attach selected optional fields not already in FollowUpRow
		if (mode === "TRUCKING") {
			for (const field of cols) {
				if (!(field in record) && data[field] !== undefined) {
					(record as Record<string, unknown>)[field] = data[field];
				}
			}
		}
		return record;
	};

	const handleSubmit = () => {
		// Validation - Tax Code is always required, Operation Type only for FOLLOWUP mode
		if (!formData.taxCode) {
			toast.error("Please fill in Tax Code (required field)");
			return;
		}
		if (!formData.operationType) {
			toast.error("Please fill in Operation Type (required field)");
			return;
		}
		if (mode === "TRUCKING" && !formData.serviceMode) {
			toast.error("Please fill in Service Mode (required field)");
			return;
		}

		if (billOrBookingError) {
			toast.error(billOrBookingError);
			return;
		}

		if (containerErrors.size > 0) {
			toast.error("Duplicate or missing container numbers in the list.");
			return;
		}

		// Capture form data before resetting
		const capturedFormData = { ...formData };
		const capturedSelectedColumns = new Set(selectedColumns);
		const capturedDuplicateCount = duplicateCount;
		const capturedFiles = selectedFiles;
		const capturedContainers = [...subRowContainers];

		// Reset form and close dialog immediately
		setFormData({
			operationType: "",
			taxCode: "",
			serviceMode: "",
		});
		setSelectedColumns(new Set());
		setDuplicateCount(1);
		setSelectedFiles(null);
		setSubRowContainers([]);
		setDropdownOpen(false);
		onOpenChange(false);

		// Process records in background (sequentially, one by one)
		(async () => {
			for (let i = 0; i < capturedDuplicateCount; i++) {
				const newRecord = buildRecord(
					capturedFormData,
					capturedSelectedColumns,
					capturedContainers,
				);
				await onAddRecord(newRecord, capturedFiles);
			}
		})();
	};

	const handleBatchRun = async () => {
		if (batchItems.length === 0) return;

		// Required fields from the form are used as fallback if the template doesn't have them
		const requiredFields = {
			operationType: formData.operationType,
			taxCode: formData.taxCode,
			serviceMode: formData.serviceMode,
		};

		const capturedBatch = [...batchItems];
		const capturedFiles = selectedFiles;

		// Reset and close
		setBatchItems([]);
		setFormData({ operationType: "", taxCode: "", serviceMode: "" });
		setSelectedColumns(new Set());
		setDuplicateCount(1);
		setSelectedFiles(null);
		setSubRowContainers([]);
		onOpenChange(false);

		setIsBatchRunning(true);
		try {
			for (const item of capturedBatch) {
				const { _containers, ...regularFields } = item.fieldData ?? {};
				const baseMergedData: Record<string, string | number> = {
					...requiredFields,
					...(regularFields as Record<string, string | number>),
				};
				const cols = new Set(item.selectedFields);
				const containers: Partial<ContainerRow>[] = Array.isArray(_containers)
					? _containers
					: [];

				for (let i = 0; i < item.count; i++) {
					const mergedData = { ...baseMergedData };
					const jobOverrides = item.jobFieldData[i] ?? {};
					for (const [fieldKey, fieldValue] of Object.entries(jobOverrides)) {
						if (
							fieldValue === "" ||
							fieldValue === null ||
							fieldValue === undefined
						)
							continue;
						mergedData[fieldKey] = fieldValue;
						cols.add(fieldKey);
					}
					const record = buildRecord(mergedData, cols, containers);
					await onAddRecord(record, capturedFiles);
				}
			}
			toast.success(
				`Batch complete: ${capturedBatch.length} template(s) submitted`,
			);
		} finally {
			setIsBatchRunning(false);
		}
	};

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="max-h-[90vh] overflow-y-auto !p-0">
					{/* Header with gradient accent */}
					<div className="relative p-4 pr-12 border-b bg-gradient-to-br from-slate-50 to-indigo-50/50 dark:from-slate-950 dark:to-indigo-950/30 overflow-hidden !text-left">
						<div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
						<div className="flex items-center gap-4 relative">
							<div className="size-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-white/20">
								<FileText className="size-6 text-white" />
							</div>
							<div className="flex-1 min-w-0">
								<DialogTitle className="text-xl font-semibold">
									{prefillData ? "Duplicate Transaction" : "Add New Record"}
								</DialogTitle>
								<p className="text-sm text-muted-foreground mt-0.5">
									Fill in the details to create a new follow-up record
								</p>
							</div>
						</div>
						{/* Tab switcher */}
						<div className="flex mt-3 gap-1 relative">
							<button
								type="button"
								onClick={() => setActiveTab("single")}
								className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
									activeTab === "single"
										? "bg-white dark:bg-slate-800 shadow-sm text-foreground"
										: "text-muted-foreground hover:text-foreground"
								}`}
							>
								Single
							</button>
							<button
								type="button"
								onClick={() => setActiveTab("batch")}
								className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
									activeTab === "batch"
										? "bg-white dark:bg-slate-800 shadow-sm text-foreground"
										: "text-muted-foreground hover:text-foreground"
								}`}
							>
								Batch Run
								{batchItems.length > 0 && (
									<span className="text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-full font-medium leading-none">
										{batchItems.length}
									</span>
								)}
							</button>
						</div>
					</div>

					{activeTab === "single" && (
						<>
							{/* Show original record info when rerunning */}
							{prefillData && (
								<div className="mx-6 mt-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm space-y-1">
									<p className="font-medium text-amber-800 dark:text-amber-300 flex items-center gap-2">
										<Copy className="size-4" />
										Duplicating from Original Record:
									</p>
									<div className="flex gap-4 text-amber-700 dark:text-amber-400">
										<span>
											Job: <strong>{prefillData.jobNumber || "—"}</strong>
										</span>
										<span>
											Company: <strong>{prefillData.companyName || "—"}</strong>
										</span>
									</div>
								</div>
							)}

							<div className="px-6 py-4 space-y-5">
								{/* Template Management Section - Moved to top */}
								<div className="rounded-xl border bg-card p-4 shadow-sm">
									<div className="flex flex-col gap-2">
										<div className="flex items-center justify-between">
											<div className="flex items-center justify-center gap-2">
												<div className="size-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
													<FileText className="size-4 text-purple-600 dark:text-purple-400" />
												</div>
												<h3 className="font-semibold">Field Templates</h3>
											</div>
											<span className="text-xs text-muted-foreground">
												Save/Load presets
											</span>
										</div>

										{activeTemplate && (
											<div className="text-xs rounded-md border border-emerald-200/70 bg-emerald-50/70 px-2.5 py-1.5 text-emerald-700">
												Editing template: <strong>{activeTemplate.name}</strong>
											</div>
										)}

										{/* Template Action Buttons */}
										<div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 w-full">
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => setLoadTemplateDialogOpen(true)}
												className="w-full"
											>
												<FolderOpenIcon className="size-4" />
												Load Template
											</Button>
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => {
													setTemplateSaveMode("create");
													setSaveTemplateDialogOpen(true);
												}}
												disabled={
													(mode === "FOLLOWUP" && !formData.operationType) ||
													(!formData.taxCode && selectedColumns.size === 0)
												}
												className="w-full"
											>
												<SaveIcon className="size-4" />
												Save as New
											</Button>
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => {
													setTemplateSaveMode("update");
													setSaveTemplateDialogOpen(true);
												}}
												disabled={!activeTemplate}
												className="w-full"
											>
												<SaveIcon className="size-4" />
												Update Template
											</Button>
										</div>
									</div>
								</div>

								{/* Required Fields Section */}
								<div className="rounded-xl border bg-card p-4 shadow-sm">
									<div className="flex items-center gap-2 mb-4">
										<div className="size-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
											<Building2 className="size-4 text-red-600 dark:text-red-400" />
										</div>
										<h3 className="font-semibold">Required Fields</h3>
										<span className="text-xs text-red-500 ml-1">
											* Required
										</span>
									</div>

									<div className={cn("grid gap-4 grid-cols-1 md:grid-cols-2")}>
										{/* Operation Type */}
										<div className="space-y-2">
											<label className="text-sm font-medium">
												Operation Type <span className="text-red-500">*</span>
											</label>
											<Select
												value={formData.operationType as string}
												onValueChange={(value: unknown) =>
													handleSelectChange("operationType", value as string)
												}
											>
												<SelectTrigger className="w-full">
													<SelectValue placeholder="Select operation type" />
												</SelectTrigger>
												<SelectPositioner>
													<SelectContent>
														{OPERATION_TYPES.filter(
															(type) => type !== "TRUCK",
														).map((type) => (
															<SelectItem key={type} value={type}>
																{type}
															</SelectItem>
														))}
													</SelectContent>
												</SelectPositioner>
											</Select>
										</div>

										{/* Tax Code */}
										<PartnerCombobox
											label="Tax Code"
											required
											value={formData.taxCode as string}
											onChange={(value) => handleSelectChange("taxCode", value)}
											placeholder="Select tax code..."
										/>
									</div>

									{/* Service Mode - Required only for TRUCKING */}
									{mode === "TRUCKING" && (
										<div className="mt-4 space-y-2">
											<label className="text-sm font-medium">
												Service Mode <span className="text-red-500">*</span>
											</label>
											<Select
												value={(formData.serviceMode as string) || ""}
												onValueChange={(value: unknown) =>
													handleSelectChange("serviceMode", value as string)
												}
											>
												<SelectTrigger className="w-full">
													<SelectValue placeholder="Select service mode" />
												</SelectTrigger>
												<SelectPositioner>
													<SelectContent>
														{serviceModes.map((m) => (
															<SelectItem key={m} value={m}>
																{m}
															</SelectItem>
														))}
													</SelectContent>
												</SelectPositioner>
											</Select>
										</div>
									)}
								</div>

								{/* Files & Documents Section */}
								<div className="rounded-xl border bg-card p-4 shadow-sm">
									<div className="flex items-center gap-2 mb-4">
										<div className="size-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
											<FileText className="size-4 text-blue-600 dark:text-blue-400" />
										</div>
										<h3 className="font-semibold">Files & Documents</h3>
										<span className="text-xs text-muted-foreground ml-1">
											(Optional)
										</span>
									</div>

									<FileUpload
										files={selectedFiles ? Array.from(selectedFiles) : []}
										onChange={(files) => {
											// Convert File[] back to FileList
											const dataTransfer = new DataTransfer();
											files.forEach((file) => dataTransfer.items.add(file));
											setSelectedFiles(dataTransfer.files);
										}}
										maxFiles={10}
									/>
								</div>

								{/* Optional Columns Selection - Multi-select Dropdown */}
								<div className="rounded-xl border bg-card p-4 shadow-sm">
									<div className="flex items-center gap-2 mb-4">
										<div className="size-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
											<Columns3 className="size-4 text-purple-600 dark:text-purple-400" />
										</div>
										<h3 className="font-semibold">Optional Columns</h3>
										{selectedColumns.size > 0 && (
											<span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
												{selectedColumns.size} selected
											</span>
										)}
									</div>
									<DropdownMenu
										open={dropdownOpen}
										onOpenChange={setDropdownOpen}
									>
										<DropdownMenuTrigger
											render={
												<Button
													variant="outline"
													className="w-full justify-between hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
												>
													{selectedColumns.size > 0
														? `${selectedColumns.size} columns selected`
														: "Select columns to fill"}
													<ChevronDown className="ml-2 size-4 opacity-50" />
												</Button>
											}
										/>
										<DropdownMenuPositioner className="z-[110]">
											<DropdownMenuContent className="w-[var(--anchor-width)] z-[110]">
												<div className="max-h-80 overflow-y-auto">
													{OPTIONAL_COLUMNS.map((column) => (
														<div
															key={column.key}
															className="flex items-center gap-2 cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/20 px-2 py-1.5 rounded transition-colors"
															onClick={() => handleColumnToggle(column.key)}
														>
															<Checkbox
																checked={selectedColumns.has(column.key)}
																onCheckedChange={() =>
																	handleColumnToggle(column.key)
																}
															/>
															<span className="text-sm">{column.label}</span>
														</div>
													))}
												</div>
											</DropdownMenuContent>
										</DropdownMenuPositioner>
									</DropdownMenu>

									{/* Dynamic Input Fields for Selected Columns - Nested inside to fix layout */}
									{selectedColumns.size > 0 && (
										<div className="space-y-4 mt-6 pt-6 border-t border-purple-100 dark:border-purple-900/30">
											<h3 className="text-sm font-semibold text-muted-foreground">
												Fill Selected Columns
											</h3>
											<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
												{Array.from(selectedColumns).map((columnKey) => {
													const column = OPTIONAL_COLUMNS.find(
														(c) => c.key === columnKey,
													);
													if (!column) return null;

													// Special handling for serviceMode (dropdown)
													if (columnKey === "serviceMode") {
														return (
															<div key={columnKey} className="space-y-2">
																<label className="text-sm font-medium">
																	{column.label}
																</label>
																<Select
																	value={(formData.serviceMode as string) || ""}
																	onValueChange={(value: unknown) =>
																		handleSelectChange(
																			"serviceMode",
																			value as string,
																		)
																	}
																>
																	<SelectTrigger className="w-full">
																		<SelectValue placeholder="Select service mode" />
																	</SelectTrigger>
																	<SelectPositioner>
																		<SelectContent>
																			{serviceModes.map((mode) => (
																				<SelectItem key={mode} value={mode}>
																					{mode}
																				</SelectItem>
																			))}
																		</SelectContent>
																	</SelectPositioner>
																</Select>
															</div>
														);
													}

													// Special handling for unit (dropdown)
													if (columnKey === "unit") {
														return (
															<div key={columnKey} className="space-y-2">
																<label className="text-sm font-medium">
																	{column.label}
																</label>
																<Select
																	value={(formData.unit as string) || ""}
																	onValueChange={(value: unknown) =>
																		handleSelectChange("unit", value as string)
																	}
																>
																	<SelectTrigger className="w-full">
																		<SelectValue placeholder="Select unit" />
																	</SelectTrigger>
																	<SelectPositioner>
																		<SelectContent>
																			{units.map((unit) => (
																				<SelectItem key={unit} value={unit}>
																					{unit}
																				</SelectItem>
																			))}
																		</SelectContent>
																	</SelectPositioner>
																</Select>
															</div>
														);
													}

													// Special handling for cargoType (dropdown)
													if (columnKey === "cargoType") {
														return (
															<div key={columnKey} className="space-y-2">
																<label className="text-sm font-medium">
																	{column.label}
																</label>
																<Select
																	value={(formData.cargoType as string) || ""}
																	onValueChange={(value: unknown) =>
																		handleSelectChange(
																			"cargoType",
																			value as string,
																		)
																	}
																>
																	<SelectTrigger className="w-full">
																		<SelectValue placeholder="Select cargo type" />
																	</SelectTrigger>
																	<SelectPositioner>
																		<SelectContent>
																			{cargoTypes.map((type) => (
																				<SelectItem key={type} value={type}>
																					{type}
																				</SelectItem>
																			))}
																		</SelectContent>
																	</SelectPositioner>
																</Select>
															</div>
														);
													}

													// Special handling for Airport fields (authority, pol, pod, warehouse)
													const airportFields = [
														"authority",
														"fromLocation",
														"toLocation",
														// "pol",
														// "pod",
														// "warehouse",
													];
													if (airportFields.includes(columnKey)) {
														return (
															<VirtualizedCombobox
																key={columnKey}
																label={column.label}
																items={airports}
																value={formData[columnKey] as string}
																onChange={(value) =>
																	handleSelectChange(columnKey, value)
																}
																placeholder="Select place..."
																searchPlaceholder="Search by code or name..."
																emptyMessage="No results found."
															/>
														);
													}

													// Special handling for workType (dropdown)
													if (columnKey === "workType") {
														return (
															<div key={columnKey} className="space-y-2">
																<label className="text-sm font-medium">
																	{column.label}
																</label>
																<Select
																	value={(formData.workType as string) || ""}
																	onValueChange={(value: unknown) =>
																		handleSelectChange(
																			"workType",
																			value as string,
																		)
																	}
																>
																	<SelectTrigger className="w-full">
																		<SelectValue placeholder="Select work type" />
																	</SelectTrigger>
																	<SelectPositioner>
																		<SelectContent>
																			{workTypes.map((type) => (
																				<SelectItem key={type} value={type}>
																					{type}
																				</SelectItem>
																			))}
																		</SelectContent>
																	</SelectPositioner>
																</Select>
															</div>
														);
													}

													// Special handling for truckType (dropdown)
													if (columnKey === "truckType") {
														return (
															<div key={columnKey} className="space-y-2">
																<label className="text-sm font-medium">
																	{column.label}
																</label>
																<Select
																	value={(formData.truckType as string) || ""}
																	onValueChange={(value: unknown) =>
																		handleSelectChange(
																			"truckType",
																			value as string,
																		)
																	}
																>
																	<SelectTrigger className="w-full">
																		<SelectValue placeholder="Select loại xe" />
																	</SelectTrigger>
																	<SelectPositioner>
																		<SelectContent>
																			{truckTypes.map((type) => (
																				<SelectItem key={type} value={type}>
																					{type}
																				</SelectItem>
																			))}
																		</SelectContent>
																	</SelectPositioner>
																</Select>
															</div>
														);
													}

													// Special handling for vendor (combobox with vendor options)
													if (columnKey === "vendor") {
														return (
															<VirtualizedCombobox
																key={columnKey}
																label={column.label}
																items={vendorOptions}
																value={(formData.vendor as string) || ""}
																onChange={(value) =>
																	handleSelectChange("vendor", value)
																}
																placeholder="Select vendor..."
																searchPlaceholder="Search vendor..."
																emptyMessage="No vendors found."
																hideId
															/>
														);
													}

													// Special handling for ops (combobox with ops options)
													if (columnKey === "ops") {
														return (
															<VirtualizedCombobox
																key={columnKey}
																label={column.label}
																items={opsOptions}
																value={(formData.ops as string) || ""}
																onChange={(value) =>
																	handleSelectChange("ops", value)
																}
																placeholder="Select OPS..."
																searchPlaceholder="Search OPS..."
																emptyMessage="No OPS found."
																hideId
															/>
														);
													}

													// Special handling for transitPort (combobox)
													if (columnKey === "transitPort") {
														return (
															<VirtualizedCombobox
																key={columnKey}
																label={column.label}
																items={transitPortOptions}
																value={(formData.transitPort as string) || ""}
																onChange={(value) =>
																	handleSelectChange("transitPort", value)
																}
																placeholder="Chọn cảng chuyển tải..."
																searchPlaceholder="Search port..."
																emptyMessage="No ports found."
																hideId
															/>
														);
													}

													// Special handling for destinationPort (combobox)
													if (columnKey === "destinationPort") {
														return (
															<VirtualizedCombobox
																key={columnKey}
																label={column.label}
																items={destinationPortOptions}
																value={
																	(formData.destinationPort as string) || ""
																}
																onChange={(value) =>
																	handleSelectChange("destinationPort", value)
																}
																placeholder="Chọn cảng đích..."
																searchPlaceholder="Search port..."
																emptyMessage="No ports found."
																hideId
															/>
														);
													}

													// Special handling for pickOrLiftPlace (combobox)
													if (columnKey === "pickOrLiftPlace") {
														return (
															<VirtualizedCombobox
																key={columnKey}
																label={column.label}
																items={pickOrLiftPlaceOptions}
																value={
																	(formData.pickOrLiftPlace as string) || ""
																}
																onChange={(value) =>
																	handleSelectChange("pickOrLiftPlace", value)
																}
																placeholder="Select place..."
																searchPlaceholder="Search place..."
																emptyMessage="No places found."
																hideId
															/>
														);
													}

													// Special handling for carrierName (combobox with shipping lines)
													if (columnKey === "carrierName") {
														return (
															<VirtualizedCombobox
																key={columnKey}
																label={column.label}
																items={shippingLineOptions}
																value={(formData.carrierName as string) || ""}
																onChange={(value) =>
																	handleSelectChange("carrierName", value)
																}
																placeholder="Select carrier..."
																searchPlaceholder="Search carrier..."
																emptyMessage="No carriers found."
																hideId
															/>
														);
													}

													// Special handling for invoiceTaxCode (combobox with partners)
													if (columnKey === "invoiceTaxCode") {
														return (
															<VirtualizedCombobox
																key={columnKey}
																label={column.label}
																items={partnerOptions}
																value={
																	(formData.invoiceTaxCode as string) || ""
																}
																onChange={(value) =>
																	handleSelectChange("invoiceTaxCode", value)
																}
																placeholder="Select MST..."
																searchPlaceholder="Search MST..."
																emptyMessage="No partners found."
															/>
														);
													}

													// Special handling for donViKhuTrung (combobox)
													if (columnKey === "donViKhuTrung") {
														return (
															<VirtualizedCombobox
																key={columnKey}
																label={column.label}
																items={DON_VI_KHU_TRUNG_OPTIONS}
																value={(formData.donViKhuTrung as string) || ""}
																onChange={(value) =>
																	handleSelectChange("donViKhuTrung", value)
																}
																placeholder="Select..."
																searchPlaceholder="Search..."
																emptyMessage="No results found."
																hideId
															/>
														);
													}

													// Special handling for supplier (partner combobox)
													if (columnKey === "supplier") {
														return (
															<PartnerCombobox
																key={columnKey}
																label={column.label}
																value={formData.supplier as string}
																onChange={(value) =>
																	handleSelectChange("supplier", value)
																}
																placeholder="Select supplier..."
															/>
														);
													}

													// Special handling for numeric fields
													if (
														columnKey === "cbm" ||
														columnKey === "grossWeight"
													) {
														return (
															<div key={columnKey} className="space-y-2">
																<label className="text-sm font-medium">
																	{column.label}
																</label>
																<Input
																	type="number"
																	step="0.01"
																	placeholder={`Enter ${column.label.toLowerCase()}`}
																	value={(formData[columnKey] as number) ?? ""}
																	onChange={(e) =>
																		handleInputChange(e, columnKey)
																	}
																	onBlur={() =>
																		handleNumericInputBlur(columnKey)
																	}
																/>
															</div>
														);
													}

													// Special handling for quantity (integer)
													if (columnKey === "quantity") {
														return (
															<div key={columnKey} className="space-y-2">
																<label className="text-sm font-medium">
																	{column.label}
																</label>
																<Input
																	type="number"
																	step="1"
																	min="0"
																	placeholder={`Enter ${column.label.toLowerCase()}`}
																	value={(formData[columnKey] as number) ?? ""}
																	onChange={(e) =>
																		handleInputChange(e, columnKey)
																	}
																	onBlur={() =>
																		handleNumericInputBlur(columnKey)
																	}
																/>
															</div>
														);
													}

													// Special handling for date fields
													if (
														columnKey === "deliveryDate" ||
														columnKey === "transportDate" ||
														columnKey === "etaEtd" ||
														columnKey === "shmtDate" ||
														columnKey === "implementationDate"
													) {
														return (
															<div key={columnKey} className="space-y-2">
																<label className="text-sm font-medium">
																	{column.label}
																</label>
																<Input
																	type="date"
																	value={(formData[columnKey] as string) || ""}
																	onChange={(e) =>
																		handleInputChange(e, columnKey)
																	}
																/>
															</div>
														);
													}

													// Special handling for datetime fields (date + time)
													if (columnKey === "ngatDienDate") {
														return (
															<div key={columnKey} className="space-y-2">
																<label className="text-sm font-medium">
																	{column.label}
																</label>
																<Input
																	type="datetime-local"
																	value={(formData[columnKey] as string) || ""}
																	onChange={(e) =>
																		handleInputChange(e, columnKey)
																	}
																/>
															</div>
														);
													}

													// Special handling for multiline text fields (trucking routineDetail, deliveryContactDetail)
													if (
														columnKey === "routineDetail" ||
														columnKey === "deliveryContactDetail" ||
														columnKey === "note4" ||
														columnKey === "note5"
													) {
														return (
															<div key={columnKey} className="space-y-2">
																<label className="text-sm font-medium">
																	{column.label}
																</label>
																<Input
																	placeholder={`Enter ${column.label.toLowerCase()}`}
																	value={(formData[columnKey] as string) || ""}
																	onChange={(e) =>
																		handleInputChange(e, columnKey)
																	}
																/>
															</div>
														);
													}
													if (columnKey === "domain") {
														return (
															<div key={columnKey} className="space-y-2">
																<label className="text-sm font-medium">
																	{column.label}
																</label>
																<Select
																	value={(formData.domain as string) || ""}
																	onValueChange={(value: unknown) =>
																		handleSelectChange(
																			"domain",
																			value as string,
																		)
																	}
																>
																	<SelectTrigger className="w-full">
																		<SelectValue placeholder="Select domain" />
																	</SelectTrigger>
																	<SelectPositioner>
																		<SelectContent>
																			{DOMAINS.map((d) => (
																				<SelectItem key={d} value={d}>
																					{d}
																				</SelectItem>
																			))}
																		</SelectContent>
																	</SelectPositioner>
																</Select>
															</div>
														);
													}

													// Special handling for user fields (handler, createdBy)
													if (columnKey === "handler") {
														return (
															<UserCombobox
																key={columnKey}
																label={column.label}
																value={(formData[columnKey] as string) || ""}
																onChange={(value) =>
																	handleSelectChange(columnKey, value)
																}
																placeholder={`Select ${column.label.toLowerCase()}...`}
																department="Logistics"
															/>
														);
													}

													// Special handling for warehouse (combobox filtered by taxCode)
													if (columnKey === "warehouse") {
														return (
															<WarehouseCombobox
																key={columnKey}
																taxCode={(formData.taxCode as string) || null}
																value={(formData.warehouse as string) || ""}
																onChange={(value) =>
																	handleSelectChange("warehouse", value)
																}
																label={column.label}
																placeholder="Chọn kho..."
																positionerClassName="z-[200]"
															/>
														);
													}

													// Default text input
													return (
														<div key={columnKey} className="space-y-2">
															<label className="text-sm font-medium">
																{column.label}
															</label>
															<div className="relative">
																<Input
																	placeholder={`Enter ${column.label.toLowerCase()}`}
																	value={(formData[columnKey] as string) || ""}
																	onChange={(e) =>
																		handleInputChange(e, columnKey)
																	}
																	className={cn(
																		columnKey === "billOrBooking" &&
																			billOrBookingError &&
																			"border-red-500 pr-10 focus-visible:ring-red-500",
																	)}
																/>
																{columnKey === "billOrBooking" && (
																	<div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
																		{isCheckingBillOrBooking ? (
																			<div className="size-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
																		) : billOrBookingError ? (
																			<div
																				className="size-4 rounded-full bg-red-500 flex items-center justify-center"
																				title={billOrBookingError}
																			>
																				<span className="text-[10px] text-white font-bold">
																					!
																				</span>
																			</div>
																		) : formData.billOrBooking ? (
																			<div className="size-4 rounded-full bg-green-500 flex items-center justify-center">
																				<Check className="size-3 text-white" />
																			</div>
																		) : null}
																	</div>
																)}
															</div>
															{columnKey === "billOrBooking" &&
																billOrBookingError && (
																	<p className="text-[11px] text-red-500 font-medium">
																		{billOrBookingError}
																	</p>
																)}
														</div>
													);
												})}
											</div>
										</div>
									)}
								</div>

								{/* Add Containers Section */}
								<div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col gap-4">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<div className="size-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
												<Package className="size-4 text-green-600 dark:text-green-400" />
											</div>
											<h3 className="font-semibold">Add Containers</h3>
											{subRowContainers.length > 0 && (
												<span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
													{subRowContainers.length} container
													{subRowContainers.length > 1 ? "s" : ""}
												</span>
											)}
										</div>
										<div className="flex items-center gap-3">
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => setImportContainersDialogOpen(true)}
												className="gap-2 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 transition-colors"
											>
												<FileSpreadsheet className="size-4" />
												Import Excel
											</Button>
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={handleAddContainer}
												className="gap-2 hover:border-green-300 dark:hover:border-green-700 hover:text-green-600 transition-colors"
											>
												<PlusIcon className="size-4" />
												Add Container
											</Button>
										</div>
									</div>

									{/* Container Fields */}
									{subRowContainers.length > 0 && (
										<div className="space-y-4">
											{subRowContainers.map((container, index) => (
												<ContainerFields
													key={container.id || index}
													index={index}
													container={container}
													onFieldChange={(field, value) =>
														handleContainerFieldChange(index, field, value)
													}
													onRemove={() => handleRemoveContainer(index)}
													showRemoveButton={true}
													containerSizes={containerSizes}
													error={containerErrors.get(index)}
												/>
											))}
										</div>
									)}
								</div>

								{/* Duplicate Rows Section */}
								<div className="rounded-xl border bg-card p-4 shadow-sm">
									<div className="flex items-center gap-2 mb-4">
										<div className="size-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
											<Copy className="size-4 text-orange-600 dark:text-orange-400" />
										</div>
										<h3 className="font-semibold">Duplicate Rows</h3>
									</div>
									<div className="flex items-center gap-3">
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={decrementDuplicates}
											disabled={duplicateCount <= 1}
											className="size-9 p-0"
										>
											<MinusIcon className="size-4" />
										</Button>
										<div className="min-w-20 text-center">
											<span className="text-lg font-semibold">
												{duplicateCount}
											</span>
											<span className="text-sm text-muted-foreground ml-1">
												{duplicateCount === 1 ? "row" : "rows"}
											</span>
										</div>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={incrementDuplicates}
											disabled={duplicateCount >= 10}
											className="size-9 p-0"
										>
											<PlusIcon className="size-4" />
										</Button>
										<span className="text-xs text-muted-foreground ml-2">
											(Max: 10)
										</span>
									</div>
								</div>
							</div>
							{/* end single tab */}
						</>
					)}

					{/* Batch Run Tab */}
					{activeTab === "batch" && (
						<div className="px-6 py-4 space-y-4">
							<div className="flex items-center justify-between">
								<p className="text-sm text-muted-foreground">
									Each template creates its own record(s) using the data saved
									in the template.
								</p>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setBatchPickerOpen(true)}
									className="gap-1.5 text-xs shrink-0 ml-3"
								>
									<PlusIcon className="size-3.5" />
									Add Template
								</Button>
							</div>

							{batchItems.length === 0 ? (
								<div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground text-sm">
									No templates in batch yet. Click &ldquo;Add Template&rdquo; to
									begin.
								</div>
							) : (
								<div className="space-y-3">
									{batchItems.map((item) => (
										<div
											key={item.id}
											className="rounded-lg border bg-card overflow-hidden"
										>
											{/* Template header row */}
											<div className="flex items-center gap-3 p-3">
												<div className="min-w-0 flex-1">
													<div className="font-medium text-sm truncate">
														{item.name}
													</div>
													<div className="text-xs text-muted-foreground mt-0.5 space-x-2">
														<span>
															• {item.selectedFields.length} field
															{item.selectedFields.length !== 1 ? "s" : ""}
														</span>
														{(item.fieldData?._containers?.length ?? 0) > 0 && (
															<span>
																• {item.fieldData?._containers?.length}{" "}
																container
																{item.fieldData?._containers?.length !== 1
																	? "s"
																	: ""}
															</span>
														)}
													</div>
												</div>
												{/* Run count controls */}
												<div className="flex items-center gap-1 shrink-0">
													<Button
														type="button"
														variant="outline"
														size="sm"
														onClick={() =>
															setBatchItems((prev) =>
																prev.map((b) =>
																	b.id === item.id
																		? {
																				...b,
																				count: Math.max(1, b.count - 1),
																				jobFieldData: b.jobFieldData.slice(
																					0,
																					Math.max(1, b.count - 1),
																				),
																			}
																		: b,
																),
															)
														}
														disabled={item.count <= 1}
														className="size-6 p-0"
													>
														<MinusIcon className="size-3" />
													</Button>
													<span className="w-6 text-center text-sm font-medium tabular-nums">
														{item.count}
													</span>
													<Button
														type="button"
														variant="outline"
														size="sm"
														onClick={() =>
															setBatchItems((prev) =>
																prev.map((b) =>
																	b.id === item.id
																		? {
																				...b,
																				count: Math.min(10, b.count + 1),
																				jobFieldData: [
																					...b.jobFieldData,
																					...(b.count < 10
																						? [
																								createBatchJobData(
																									getBatchEditableFields(b),
																									b.fieldData,
																								),
																							]
																						: []),
																				],
																			}
																		: b,
																),
															)
														}
														disabled={item.count >= 10}
														className="size-6 p-0"
													>
														<PlusIcon className="size-3" />
													</Button>
												</div>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={() =>
														setBatchItems((prev) =>
															prev.filter((b) => b.id !== item.id),
														)
													}
													className="size-7 p-0 text-destructive hover:text-destructive shrink-0"
												>
													<Trash2Icon className="size-3.5" />
												</Button>
											</div>

											{/* Per-job field overrides */}
											{mode === "TRUCKING" && item.count > 0 && (
												<div className="border-t bg-muted/30 px-3 py-2 space-y-1.5">
													<p className="text-[11px] font-medium text-muted-foreground mb-1.5">
														Trường cho từng job:
													</p>
													{Array.from({ length: item.count }).map(
														(_, jobIdx) => {
															const editableFields =
																getBatchEditableFields(item);
															return (
																<div
																	key={jobIdx}
																	className="rounded-md border bg-background/80 p-2.5 space-y-2"
																>
																	<div className="text-xs font-medium text-muted-foreground">
																		Job {jobIdx + 1}
																	</div>
																	{editableFields.length === 0 ? (
																		<p className="text-xs text-muted-foreground">
																			Template này chưa có field nào để chỉnh
																			theo từng job.
																		</p>
																	) : (
																		<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
																			{editableFields.map((fieldKey) =>
																				renderBatchJobField(
																					item,
																					jobIdx,
																					fieldKey,
																				),
																			)}
																		</div>
																	)}
																</div>
															);
														},
													)}
												</div>
											)}
										</div>
									))}
								</div>
							)}
						</div>
					)}

					<DialogFooter className="px-6 py-4 border-t bg-muted/30">
						<Button
							variant="outline"
							onClick={() => onOpenChange(false)}
							className="min-w-24"
						>
							Cancel
						</Button>
						{activeTab === "single" && containerErrors.size === 0 && (
							<Button
								onClick={handleSubmit}
								className="min-w-32 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25"
							>
								Add{" "}
								{duplicateCount > 1 ? `${duplicateCount} Records` : "Record"}
							</Button>
						)}
						{activeTab === "batch" && batchItems.length > 0 && (
							<Button
								onClick={handleBatchRun}
								disabled={isBatchRunning}
								className="min-w-40 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-500/20 gap-2"
							>
								<PlayCircle className="size-4" />
								{isBatchRunning
									? "Running…"
									: `Run Batch (${batchItems.length})`}
							</Button>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Template Dialogs */}
			<LoadTemplateDialog
				open={loadTemplateDialogOpen}
				onOpenChange={setLoadTemplateDialogOpen}
				onLoadTemplate={handleLoadTemplate}
			/>
			<LoadTemplateDialog
				open={batchPickerOpen}
				onOpenChange={setBatchPickerOpen}
				mode="batch"
				onAddToBatch={(templates) =>
					setBatchItems((prev) => [
						...prev,
						...templates.map((t) => {
							const count =
								typeof t.fieldData?._duplicateCount === "number" &&
								t.fieldData._duplicateCount > 0
									? t.fieldData._duplicateCount
									: 1;
							return {
								id: generateUUID(),
								templateId: t.id,
								name: t.name,
								selectedFields: t.selectedFields,
								fieldData: t.fieldData,
								count,
								jobFieldData: Array.from({ length: count }, () =>
									createBatchJobData(
										getBatchEditableFields({
											selectedFields: t.selectedFields,
											fieldData: t.fieldData,
										}),
										t.fieldData,
									),
								),
							};
						}),
					])
				}
			/>
			<SaveTemplateDialog
				open={saveTemplateDialogOpen}
				onOpenChange={setSaveTemplateDialogOpen}
				mode={templateSaveMode}
				editingTemplate={activeTemplate}
				selectedFields={Array.from(selectedColumns)}
				fieldData={{
					...formData,
					_containers: subRowContainers,
					_duplicateCount: duplicateCount,
				}}
			/>
			<ImportContainersDialog
				open={importContainersDialogOpen}
				onOpenChange={setImportContainersDialogOpen}
				onImport={handleImportContainers}
			/>
		</>
	);
}
