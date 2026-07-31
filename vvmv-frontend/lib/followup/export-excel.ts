import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import type {
	CargoListRow,
	FollowUpCdsInfoRow,
} from "@/app/(home)/internal/followup/types";
import { prismaRPA } from "@/lib/db";
import {
	CDS_INFO_COLLECTION_INCLUDE,
	hydrateCdsCollections,
} from "@/lib/followup/cds-normalized-collections";
import { normalizeCdsWeightUnit } from "@/lib/followup/cds-weight-units";
import {
	ECUS_FLAT_HEADER_COLUMN_MAP,
	ECUS_TEMPLATE_CARGO_CELL_MAP,
	ECUS_TEMPLATE_CARGO_START_ROW,
	ECUS_TEMPLATE_CDS_CELL_MAP,
	ECUS_TEMPLATE_SHEET_NAMES,
	getEcusTemplateSheetName,
} from "@/lib/followup/ecus-excel-mapping";
import {
	type LegacyTemplateSheetPatch,
	writeLegacyTemplateWorkbook,
} from "@/lib/followup/legacy-xls-template";
import {
	deriveHanAppName,
	deriveOperationType,
	type FollowUpOperationType,
} from "@/lib/followup/operation-type";

type ExportFollowUp = NonNullable<
	Awaited<ReturnType<typeof loadFollowUpForExport>>
>;

type FlatExportRow = Record<string, ExcelJS.CellValue>;
type LegacyCellValue = string | number | boolean | null | undefined;

const LEGACY_TEMPLATE_FILE_BY_OPERATION: Record<
	NonNullable<FollowUpOperationType>,
	string
> = {
	NHAP: "Nhap ToKhaiExport.xls",
	XUAT: "xuat ToKhaiExport.xls",
};

function normalizeLegacyHeader(value: unknown) {
	return String(value ?? "")
		.normalize("NFKC")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase();
}

function formatLegacyTemplateDate(value: unknown) {
	const parsed = toDate(value);
	if (!parsed) {
		return "";
	}

	return [
		parsed.getMonth() + 1,
		parsed.getDate(),
		String(parsed.getFullYear()).slice(-2),
	].join("/");
}

function readLegacyHeaderRow(
	sheet: XLSX.WorkSheet | undefined,
	rowNumber: number,
) {
	if (!sheet) {
		return [] as string[];
	}

	const rows = XLSX.utils.sheet_to_json<(string | number | boolean)[]>(sheet, {
		header: 1,
		raw: false,
		blankrows: false,
		defval: "",
	});
	return (rows[rowNumber - 1] ?? []).map((value) => String(value ?? ""));
}

/** Extra KhaiToKhai columns (after template column 75). Do not rewrite the .xls with SheetJS — extend headers in memory on export only. */
const ECUS_EXTRA_KHAITOKHAI_HEADER_LABELS = [
	"Số quản lý của nội bộ doanh nghiệp",
	"Mã địa điểm xếp hàng lên xe chở hàng",
	"Tên địa điểm xếp hàng lên xe chở hàng",
	"Địa chỉ địa điểm xếp hàng lên xe chở hàng",
] as const;

function extendKhaiToKhaiLegacyHeaders(sheet: XLSX.WorkSheet | undefined) {
	const base = readLegacyHeaderRow(sheet, 1);
	const start = 76;
	const needed = start + ECUS_EXTRA_KHAITOKHAI_HEADER_LABELS.length;
	const headers = [...base];
	while (headers.length < needed) {
		headers.push("");
	}
	ECUS_EXTRA_KHAITOKHAI_HEADER_LABELS.forEach((label, index) => {
		headers[start + index] = label;
	});
	return headers;
}

function buildLegacySparseRow(
	headers: string[],
	valuesByHeader: Record<string, LegacyCellValue>,
) {
	const normalizedValues = new Map<string, LegacyCellValue>(
		Object.entries(valuesByHeader).map(([key, value]) => [
			normalizeLegacyHeader(key),
			value,
		]),
	);

	const row = new Array<LegacyCellValue>(headers.length);

	headers.forEach((header, index) => {
		const normalizedHeader = normalizeLegacyHeader(header);
		const value = normalizedValues.get(normalizedHeader);

		row[index] = value ?? "";
	});

	return row;
}

function buildLegacyDenseRows(
	rows: LegacyCellValue[][],
	totalRowCount: number,
	columnCount: number,
) {
	return Array.from(
		{ length: Math.max(totalRowCount, rows.length) },
		(_, index) =>
			rows[index] ?? new Array<LegacyCellValue>(columnCount).fill(""),
	);
}

function getLegacyTemplateRowCount(
	sheet: XLSX.WorkSheet | undefined,
	originRow: number,
) {
	if (!sheet?.["!ref"]) {
		return 0;
	}

	const range = XLSX.utils.decode_range(sheet["!ref"]);
	return Math.max(range.e.r - (originRow - 1) + 1, 0);
}

function toText(value: unknown) {
	const normalized = String(value ?? "").trim();
	return normalized === "" ? null : normalized;
}

function toNumber(value: unknown) {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}

	if (typeof value === "string" && value.trim() === "") {
		return null;
	}

	const normalized = Number(value);
	return Number.isFinite(normalized) ? normalized : null;
}

function toDate(value: unknown) {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value;
	}

	if (typeof value !== "string" || value.trim() === "") {
		return null;
	}

	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDisplayDate(value: unknown) {
	const parsed = toDate(value);
	if (!parsed) {
		return "";
	}

	return [
		String(parsed.getDate()).padStart(2, "0"),
		String(parsed.getMonth() + 1).padStart(2, "0"),
		parsed.getFullYear(),
	].join("/");
}

function toNullableCellValue(
	value: string | number | Date | null | undefined,
): ExcelJS.CellValue {
	return value ?? "";
}

function resolveCargoUnitPrice(cargo: Partial<CargoListRow>) {
	const qty = toNumber(cargo.qty);
	const unitPrice = toNumber(cargo.unitPrice);
	const totalPrice = toNumber(cargo.totalPrice);

	if (unitPrice !== null && unitPrice > 0) {
		return unitPrice;
	}

	if (qty !== null && qty > 0 && totalPrice !== null && totalPrice > 0) {
		return totalPrice / qty;
	}

	return null;
}

function resolveCargoTotalPrice(cargo: Partial<CargoListRow>) {
	const qty = toNumber(cargo.qty);
	const unitPrice = toNumber(cargo.unitPrice);
	const totalPrice = toNumber(cargo.totalPrice);

	if (totalPrice !== null && totalPrice > 0) {
		return totalPrice;
	}

	if (qty !== null && qty > 0 && unitPrice !== null && unitPrice > 0) {
		return qty * unitPrice;
	}

	return null;
}

function getResolvedOperationType(
	followUp: Pick<ExportFollowUp, "operationType" | "cdsInfo">,
): FollowUpOperationType | null {
	return deriveOperationType({
		operationType: followUp.operationType,
		operationCode: followUp.cdsInfo?.operationCode,
	});
}

function getPrimaryDeclaration(declarations: ExportFollowUp["declarations"]) {
	if (declarations.length === 0) {
		return null;
	}

	return (
		[...declarations].sort((left, right) => {
			const leftTime = left.declarationDate
				? new Date(left.declarationDate).getTime()
				: 0;
			const rightTime = right.declarationDate
				? new Date(right.declarationDate).getTime()
				: 0;

			return rightTime - leftTime;
		})[0] ?? null
	);
}

function deriveDeclarationYear(
	cdsInfo: Partial<FollowUpCdsInfoRow> | null | undefined,
	declaration: ReturnType<typeof getPrimaryDeclaration>,
) {
	const source =
		declaration?.declarationDate ??
		cdsInfo?.expectedDeclarationDate ??
		cdsInfo?.commercialInvoiceDate;
	const parsed = toDate(source);
	return parsed ? parsed.getFullYear() : new Date().getFullYear();
}

function getPreviewCargoRows(followUp: ExportFollowUp) {
	if (followUp.cargoLists.length > 0) {
		return followUp.cargoLists as unknown as Partial<CargoListRow>[];
	}

	return [{}];
}

function buildFlatExportRows(followUp: ExportFollowUp): FlatExportRow[] {
	const cdsInfo = (followUp.cdsInfo ?? {}) as Partial<FollowUpCdsInfoRow>;
	const declaration = getPrimaryDeclaration(followUp.declarations);
	const operationType = getResolvedOperationType(followUp);
	const operationMarker = operationType === "XUAT" ? "X" : "N";
	const declarationYear = deriveDeclarationYear(cdsInfo, declaration);
	const cargoRows = getPreviewCargoRows(followUp);
	const weightUnit = normalizeCdsWeightUnit(cdsInfo.weightUnit);

	return cargoRows.map((cargo) => {
		const row: FlatExportRow = {};
		const cargoUnitPrice = resolveCargoUnitPrice(cargo);
		const cargoTotalPrice = resolveCargoTotalPrice(cargo);

		row[ECUS_FLAT_HEADER_COLUMN_MAP.expectedDeclarationDate] =
			toDate(
				declaration?.declarationDate ??
					cdsInfo.expectedDeclarationDate ??
					cdsInfo.commercialInvoiceDate,
			) ?? "";
		row[ECUS_FLAT_HEADER_COLUMN_MAP.declarationNumber] =
			toText(declaration?.declarationNumber ?? cdsInfo.declarationNumber) ?? "";
		row[ECUS_FLAT_HEADER_COLUMN_MAP.operationMarker] = operationMarker;
		row[ECUS_FLAT_HEADER_COLUMN_MAP.operationCode] =
			cdsInfo.operationCode ?? "";
		row[ECUS_FLAT_HEADER_COLUMN_MAP.declarationYear] = declarationYear;
		row[ECUS_FLAT_HEADER_COLUMN_MAP.customsCode] =
			toText(cdsInfo.customsCode ?? declaration?.customsCode) ?? "";
		row[ECUS_FLAT_HEADER_COLUMN_MAP.partnerName] =
			toText(cdsInfo.partnerName ?? followUp.supplier) ?? "";
		row[ECUS_FLAT_HEADER_COLUMN_MAP.exportCountryCode] =
			toText(cdsInfo.exportCountryCode) ?? "";
		row[ECUS_FLAT_HEADER_COLUMN_MAP.billOfLading] =
			toText(
				cdsInfo.billOfLading ??
					followUp.billOrBooking ??
					declaration?.billBooking,
			) ?? "";
		row[ECUS_FLAT_HEADER_COLUMN_MAP.packageQuantity] =
			toNumber(cdsInfo.packageQuantity ?? followUp.quantity) ?? "";
		row[ECUS_FLAT_HEADER_COLUMN_MAP.packageType] =
			toText(cdsInfo.packageType ?? followUp.unit) ?? "";
		row[ECUS_FLAT_HEADER_COLUMN_MAP.grossWeightTotal] =
			toNumber(
				cdsInfo.grossWeightTotal ??
					followUp.grossWeight ??
					declaration?.grossWeight ??
					cargo.grossWeight,
			) ?? "";
		row[ECUS_FLAT_HEADER_COLUMN_MAP.weightUnit] = toText(weightUnit) ?? "";
		row[ECUS_FLAT_HEADER_COLUMN_MAP.warehouseLocationName] =
			toText(
				cdsInfo.warehouseLocationName ??
					followUp.location ??
					declaration?.diaDiemLuuKho,
			) ?? "";
		row[ECUS_FLAT_HEADER_COLUMN_MAP.loadingLocationName] =
			toText(cdsInfo.loadingLocationName) ?? "";
		row[ECUS_FLAT_HEADER_COLUMN_MAP.unloadingLocationName] =
			toText(cdsInfo.unloadingLocationName) ?? "";
		row[ECUS_FLAT_HEADER_COLUMN_MAP.transportVehicleName] =
			toText(cdsInfo.transportVehicleName) ?? "";
		row[ECUS_FLAT_HEADER_COLUMN_MAP.departureArrivalDate] =
			toDate(cdsInfo.departureArrivalDate) ?? "";
		row[ECUS_FLAT_HEADER_COLUMN_MAP.note] =
			toText(cdsInfo.note ?? followUp.notes) ?? "";
		row[ECUS_FLAT_HEADER_COLUMN_MAP.commercialInvoice] =
			toText(
				cdsInfo.commercialInvoice ?? followUp.invoice ?? declaration?.invoice,
			) ?? "";
		row[ECUS_FLAT_HEADER_COLUMN_MAP.commercialInvoiceDate] =
			toDate(cdsInfo.commercialInvoiceDate) ?? "";
		row[ECUS_FLAT_HEADER_COLUMN_MAP.paymentMethod] =
			toText(cdsInfo.paymentMethod) ?? "";
		row[ECUS_FLAT_HEADER_COLUMN_MAP.totalInvoiceValue] =
			toNumber(cdsInfo.totalInvoiceValue ?? cdsInfo.declaredValue) ?? "";
		row[ECUS_FLAT_HEADER_COLUMN_MAP.invoiceCurrency] =
			toText(cdsInfo.invoiceCurrency) ?? "";

		row.B = toText(cargo.customCode) ?? "";
		row.D = toText(cargo.customCode) ?? "";
		row.E = toText(cargo.originalCargoName ?? cargo.vietnameseName) ?? "";
		row.AV = toText(cargo.originalCountry) ?? "";
		row.AY = toText(cargo.customCode) ?? "";
		row.AZ = cargoTotalPrice ?? "";
		row.BA = cargoTotalPrice ?? "";
		row.BB = toNumber(cargo.qty) ?? "";
		row.BD = cargoUnitPrice ?? "";
		row.BG = toText(cargo.unit ?? followUp.unit) ?? "";

		return row;
	});
}

function resetPreviewSheet(sheet: ExcelJS.Worksheet) {
	sheet.getCell("D1").value = "";
	sheet.getCell("D2").value = "";
	sheet.getCell("D3").value = "";
	sheet.getCell("D4").value = "";
	sheet.getCell("D5").value = "";

	for (const address of Object.values(ECUS_TEMPLATE_CDS_CELL_MAP)) {
		sheet.getCell(address).value = "";
	}

	for (
		let rowNumber = ECUS_TEMPLATE_CARGO_START_ROW;
		rowNumber <= 400;
		rowNumber += 1
	) {
		for (const column of Object.values(ECUS_TEMPLATE_CARGO_CELL_MAP)) {
			sheet.getCell(`${column}${rowNumber}`).value = "";
		}
	}
}

function fillPreviewSheet(sheet: ExcelJS.Worksheet, followUp: ExportFollowUp) {
	const cdsInfo = (followUp.cdsInfo ?? {}) as Partial<FollowUpCdsInfoRow>;
	const declaration = getPrimaryDeclaration(followUp.declarations);
	const operationType = getResolvedOperationType(followUp);
	const cargoRows = getPreviewCargoRows(followUp);

	resetPreviewSheet(sheet);

	sheet.getCell("D1").value = toText(followUp.taxCode) ?? "";
	sheet.getCell("D2").value =
		toText(cdsInfo.importExportUnitName ?? followUp.companyName) ?? "";
	sheet.getCell("D4").value = toText(followUp.handler) ?? "";
	sheet.getCell("D5").value = "HAN_2024";

	const previewValues: Partial<
		Record<keyof FollowUpCdsInfoRow, ExcelJS.CellValue>
	> = {
		customsCode: toNullableCellValue(
			cdsInfo.customsCode ?? declaration?.customsCode,
		),
		operationCode: toNullableCellValue(cdsInfo.operationCode),
		partnerName: toNullableCellValue(cdsInfo.partnerName),
		personOrganizationClassification: toNullableCellValue(
			cdsInfo.personOrganizationClassification,
		),
		declarationProcessingDeptCode: toNullableCellValue(
			cdsInfo.declarationProcessingDeptCode,
		),
		transportMethodCode: toNullableCellValue(cdsInfo.transportMethodCode),
		billOfLading: toNullableCellValue(
			cdsInfo.billOfLading ??
				followUp.billOrBooking ??
				declaration?.billBooking,
		),
		packageQuantity: toNullableCellValue(
			toNumber(cdsInfo.packageQuantity ?? followUp.quantity),
		),
		grossWeightTotal: toNullableCellValue(
			toNumber(
				cdsInfo.grossWeightTotal ??
					followUp.grossWeight ??
					declaration?.grossWeight,
			),
		),
		warehouseLocationCode: toNullableCellValue(cdsInfo.warehouseLocationCode),
		warehouseLocationName: toNullableCellValue(
			cdsInfo.warehouseLocationName ??
				followUp.location ??
				declaration?.diaDiemLuuKho,
		),
		transportVehicleCode: toNullableCellValue(cdsInfo.transportVehicleCode),
		transportVehicleName: toNullableCellValue(cdsInfo.transportVehicleName),
		departureArrivalDate: toNullableCellValue(
			toDate(cdsInfo.departureArrivalDate),
		),
		loadingLocationCode: toNullableCellValue(cdsInfo.loadingLocationCode),
		loadingLocationName: toNullableCellValue(cdsInfo.loadingLocationName),
		unloadingLocationCode: toNullableCellValue(cdsInfo.unloadingLocationCode),
		unloadingLocationName: toNullableCellValue(cdsInfo.unloadingLocationName),
		containerQuantity: toNullableCellValue(toNumber(cdsInfo.containerQuantity)),
		licenseNumber: toNullableCellValue(cdsInfo.licenseNumber),
		commercialInvoice: toNullableCellValue(
			cdsInfo.commercialInvoice ?? followUp.invoice ?? declaration?.invoice,
		),
		commercialInvoiceDate: toNullableCellValue(
			toDate(cdsInfo.commercialInvoiceDate),
		),
		totalInvoiceValue: toNullableCellValue(
			toNumber(cdsInfo.totalInvoiceValue ?? cdsInfo.declaredValue),
		),
		paymentMethod: toNullableCellValue(cdsInfo.paymentMethod),
		invoicePriceCondition: toNullableCellValue(cdsInfo.invoicePriceCondition),
		invoiceCurrency: toNullableCellValue(cdsInfo.invoiceCurrency),
		insuranceFee: toNullableCellValue(toNumber(cdsInfo.insuranceFee)),
		transportFee: toNullableCellValue(toNumber(cdsInfo.transportFee)),
		taxPayer: toNullableCellValue(cdsInfo.taxPayer),
		releaseBeforePermitCode: toNullableCellValue(
			cdsInfo.releaseBeforePermitCode,
		),
		declaredValue: toNullableCellValue(toNumber(cdsInfo.declaredValue)),
		totalTaxableValue: toNullableCellValue(toNumber(cdsInfo.totalTaxableValue)),
		taxPaymentDeadlineCode: toNullableCellValue(cdsInfo.taxPaymentDeadlineCode),
		guaranteeBankCode: toNullableCellValue(cdsInfo.guaranteeBankCode),
		contractNumber: toNullableCellValue(cdsInfo.contractNumber),
		contractDate: toNullableCellValue(toDate(cdsInfo.contractDate)),
		contractGoodsDate: toNullableCellValue(toDate(cdsInfo.contractGoodsDate)),
		importExportUnitName: toNullableCellValue(
			cdsInfo.importExportUnitName ?? followUp.companyName,
		),
		importExportBusinessAddress: toNullableCellValue(
			cdsInfo.importExportBusinessAddress,
		),
		exportCountryCode: toNullableCellValue(cdsInfo.exportCountryCode),
		packageType: toNullableCellValue(cdsInfo.packageType ?? followUp.unit),
		weightUnit: toNullableCellValue(normalizeCdsWeightUnit(cdsInfo.weightUnit)),
		invoiceClassificationCode: toNullableCellValue(
			cdsInfo.invoiceClassificationCode,
		),
		transportFeeClassificationCode: toNullableCellValue(
			cdsInfo.transportFeeClassificationCode,
		),
		insuranceFeeClassificationCode: toNullableCellValue(
			cdsInfo.insuranceFeeClassificationCode,
		),
		transportFeeCurrencyCode: toNullableCellValue(
			cdsInfo.transportFeeCurrencyCode,
		),
		insuranceFeeCurrencyCode: toNullableCellValue(
			cdsInfo.insuranceFeeCurrencyCode,
		),
		partnerAddress1: toNullableCellValue(cdsInfo.partnerAddress1),
		note: toNullableCellValue(cdsInfo.note ?? followUp.notes),
		invoiceFormClassificationCode: toNullableCellValue(
			cdsInfo.invoiceFormClassificationCode,
		),
		taxDestinationLocation: toNullableCellValue(cdsInfo.taxDestinationLocation),
		estimatedArrivalAtDestinationDate: toNullableCellValue(
			toDate(cdsInfo.estimatedArrivalAtDestinationDate),
		),
		transportDepartureDate: toNullableCellValue(
			toDate(cdsInfo.transportDepartureDate),
		),
		valuationDeclarationTypeCode: toNullableCellValue(
			cdsInfo.valuationDeclarationTypeCode,
		),
		partnerAddress2: toNullableCellValue(cdsInfo.partnerAddress2),
		partnerAddress3: toNullableCellValue(cdsInfo.partnerAddress3),
		partnerAddress4: toNullableCellValue(cdsInfo.partnerAddress4),
		taxableValueCurrencyCode: toNullableCellValue(
			cdsInfo.taxableValueCurrencyCode,
		),
	};

	for (const [field, address] of Object.entries(ECUS_TEMPLATE_CDS_CELL_MAP)) {
		sheet.getCell(address).value =
			previewValues[field as keyof FollowUpCdsInfoRow] ?? "";
	}

	const hanAppName = deriveHanAppName({
		operationType,
		operationCode: cdsInfo.operationCode,
		taxCode: cdsInfo.importerCode ?? followUp.taxCode,
	});

	sheet.getCell("B9").value = 1;
	sheet.getCell("BB9").value = operationType === "XUAT" ? "XUAT" : "NHAP";
	sheet.getCell("BD9").value = hanAppName;
	sheet.getCell("AL9").value = toNullableCellValue(
		toNumber(declaration?.totalTaxAmount),
	);

	if (cargoRows.length > 1) {
		const rowsToAdd = cargoRows.length - 1;
		sheet.duplicateRow(ECUS_TEMPLATE_CARGO_START_ROW, rowsToAdd, true);
	}

	cargoRows.forEach((cargo, index) => {
		const rowNumber = ECUS_TEMPLATE_CARGO_START_ROW + index;
		const cargoUnitPrice = resolveCargoUnitPrice(cargo);
		const cargoTotalPrice = resolveCargoTotalPrice(cargo);
		sheet.getCell(`K${rowNumber}`).value = index + 1;
		sheet.getCell(`T${rowNumber}`).value = toNullableCellValue(cargoUnitPrice);
		sheet.getCell(`U${rowNumber}`).value = toNullableCellValue(cargoTotalPrice);

		const cargoValues: Partial<Record<keyof CargoListRow, ExcelJS.CellValue>> =
			{
				vietnameseName: toNullableCellValue(
					cargo.vietnameseName ?? cargo.originalCargoName,
				),
				customCode: toNullableCellValue(cargo.customCode),
				hsCode: toNullableCellValue(cargo.hsCode),
				originalCountry: toNullableCellValue(cargo.originalCountry),
				unit: toNullableCellValue(cargo.unit),
				qty: toNullableCellValue(toNumber(cargo.qty)),
				unitPrice: toNullableCellValue(cargoUnitPrice),
				totalPrice: toNullableCellValue(cargoTotalPrice),
				imExDutyExemptionCode: toNullableCellValue(cargo.imExDutyExemptionCode),
				importTaxCode: toNullableCellValue(cargo.importTaxCode),
				vatTaxCode: toNullableCellValue(cargo.vatTaxCode),
				dutyReductionCode: toNullableCellValue(cargo.dutyReductionCode),
				unit2: toNullableCellValue(cargo.unit2),
				qty2: toNullableCellValue(toNumber(cargo.qty2)),
			};

		for (const [field, column] of Object.entries(
			ECUS_TEMPLATE_CARGO_CELL_MAP,
		)) {
			sheet.getCell(`${column}${rowNumber}`).value =
				cargoValues[field as keyof CargoListRow] ?? "";
		}
		sheet.getCell(`J${rowNumber}`).value = toNullableCellValue(cargoTotalPrice);
	});
}

function fillLegacyVnaccSheet(
	sheet: ExcelJS.Worksheet,
	followUp: ExportFollowUp,
) {
	const cdsInfo = (followUp.cdsInfo ?? {}) as Partial<FollowUpCdsInfoRow>;
	const declaration = getPrimaryDeclaration(followUp.declarations);
	const cargoRows = followUp.cargoLists as unknown as Partial<CargoListRow>[];
	const hasMultipleCargos = cargoRows.length > 1;
	const combinedCargoName = cargoRows
		.map((cargo) => cargo.vietnameseName || cargo.originalCargoName)
		.filter(Boolean)
		.join(", ");
	const combinedInvoices = cargoRows
		.map((cargo) => cargo.invoiceNo)
		.filter(Boolean)
		.join(", ");
	const invoice =
		cdsInfo.commercialInvoice ??
		followUp.invoice ??
		declaration?.invoice ??
		combinedInvoices;

	const row = sheet.getRow(2);

	row.getCell("A").value = declaration?.declarationNumber || "";
	row.getCell("B").value =
		getResolvedOperationType(followUp) === "XUAT" ? "Xuất" : "Nhập";
	row.getCell("C").value = followUp.serviceMode || "";
	row.getCell("D").value =
		cdsInfo.importExportUnitName ?? followUp.companyName ?? "";
	row.getCell("E").value = cdsInfo.declarationProcessingDeptCode || "";
	row.getCell("F").value = cdsInfo.customsCode || followUp.workType || "";
	row.getCell("G").value = "";
	row.getCell("H").value = followUp.cargoType || followUp.commodityName || "";
	row.getCell("I").value = hasMultipleCargos
		? `${combinedCargoName} và ${cargoRows.length - 1} mục khác`
		: combinedCargoName;
	row.getCell("J").value = cdsInfo.packageQuantity ?? followUp.quantity ?? "";
	row.getCell("K").value = cdsInfo.packageType ?? followUp.unit ?? "";
	row.getCell("L").value = followUp.cbm || "";
	row.getCell("M").value =
		cdsInfo.grossWeightTotal ?? followUp.grossWeight ?? "";
	row.getCell("N").value = invoice || "";
	row.getCell("O").value = cdsInfo.contractNumber ?? followUp.poNumber ?? "";
	row.getCell("P").value = cdsInfo.billOfLading ?? followUp.billOrBooking ?? "";
	row.getCell("Q").value = followUp.pickUpTime || "";
	row.getCell("R").value = formatDisplayDate(
		cdsInfo.estimatedArrivalAtDestinationDate ?? followUp.deliveryDate,
	);
	row.getCell("S").value =
		cdsInfo.transportVehicleName ?? followUp.truckNumber ?? "";
	row.getCell("T").value = cdsInfo.unloadingLocationName ?? "";
	row.getCell("U").value = followUp.supervisionGate || "";
	row.getCell("V").value = followUp.handler || "";
	row.getCell("W").value = cdsInfo.note ?? followUp.notes ?? "";
	row.getCell("X").value = followUp.note2 || "";
	row.getCell("Y").value = followUp.note3 || "";
	row.getCell("Z").value = formatDisplayDate(followUp.shmtDate);
	row.getCell("AA").value =
		cdsInfo.warehouseLocationName ?? followUp.location ?? "";
	row.getCell("AB").value = cdsInfo.loadingLocationName ?? "";
	row.getCell("AC").value =
		cdsInfo.transportMethodCode ?? followUp.transportMethod ?? "";
	row.getCell("AD").value = formatDisplayDate(
		cdsInfo.transportDepartureDate ?? followUp.transportDate,
	);
	row.getCell("AE").value = cdsInfo.taxDestinationLocation ?? "";
	row.getCell("AF").value =
		followUp.cerOfOrigins?.[0]?.coNo ?? followUp.coNumber ?? "";
	row.getCell("AG").value = followUp.pol || "";
	row.getCell("AH").value = followUp.pod || "";
	row.getCell("AI").value = followUp.warehouse || "";
	row.getCell("AJ").value = followUp.supplier || "";
	row.getCell("AK").value = formatDisplayDate(followUp.etaEtd);
	row.getCell("AL").value = followUp.jobPriority || "";
	row.getCell("AM").value = followUp.taxCode || "";
	row.getCell("AN").value = followUp.requestTruckingNo || "";
	row.getCell("AO").value = formatDisplayDate(followUp.createdAt);
	row.getCell("AP").value = followUp.createdBy || "";
	row.getCell("AQ").value = formatDisplayDate(followUp.updatedAt);
	row.commit();
}

function fillFlatSheet(sheet: ExcelJS.Worksheet, followUp: ExportFollowUp) {
	if (sheet.rowCount > 0) {
		sheet.spliceRows(1, sheet.rowCount);
	}

	const rows = buildFlatExportRows(followUp);
	rows.forEach((rowValues, index) => {
		const row = sheet.getRow(index + 1);
		for (const [column, value] of Object.entries(rowValues)) {
			row.getCell(column).value = value;
		}
		row.commit();
	});
}

function fillGuideSheet(sheet: ExcelJS.Worksheet) {
	if (sheet.rowCount > 0) {
		sheet.spliceRows(1, sheet.rowCount);
	}

	const guideRows = [
		["Sheet", "Mục đích", "Ghi chú"],
		[
			ECUS_TEMPLATE_SHEET_NAMES.flat,
			"Sheet dữ liệu phẳng để nạp vào hệ ECUS theo mapping IMPORT_TOKHAI",
			"Không có header dòng 1. Mỗi dòng là 1 dòng hàng, các cột header được lặp lại.",
		],
		[
			ECUS_TEMPLATE_SHEET_NAMES.import,
			"Sheet preview dễ đọc cho tờ khai nhập",
			"Dùng để kiểm tra dữ liệu trong app, không nên coi đây là sheet import tự động.",
		],
		[
			ECUS_TEMPLATE_SHEET_NAMES.export,
			"Sheet preview dễ đọc cho tờ khai xuất",
			"Dùng để kiểm tra dữ liệu trong app, không nên coi đây là sheet import tự động.",
		],
		[
			"Lưu ý",
			"Một số cột không có trong app hiện tại",
			"Các cột như tỷ giá, thuế suất/tiền thuế theo dòng có thể cần bổ sung thủ công bên ECUS.",
		],
	];

	guideRows.forEach((values, index) => {
		sheet.addRow(values);
		if (index === 0) {
			sheet.getRow(1).font = { bold: true };
		}
	});

	sheet.columns = [{ width: 18 }, { width: 45 }, { width: 80 }];
}

function buildLegacyHeaderSheetRows(
	sheet: XLSX.WorkSheet | undefined,
	followUp: ExportFollowUp,
) {
	if (!sheet) {
		return null;
	}

	const headers = extendKhaiToKhaiLegacyHeaders(sheet);
	if (headers.length === 0) {
		return null;
	}

	const cdsInfo = (followUp.cdsInfo ?? {}) as Partial<FollowUpCdsInfoRow>;
	const declaration = getPrimaryDeclaration(followUp.declarations);
	const resolvedOperationType = getResolvedOperationType(followUp);
	const weightUnit = normalizeCdsWeightUnit(cdsInfo.weightUnit);
	const hanAppName = deriveHanAppName({
		operationType: resolvedOperationType,
		operationCode: cdsInfo.operationCode,
		taxCode: cdsInfo.importerCode ?? followUp.taxCode,
	});
	const row = buildLegacySparseRow(headers, {
		STT: 1,
		"Số tờ khai": cdsInfo.declarationNumber ?? declaration?.declarationNumber,
		"Ngày đăng ký":
			formatLegacyTemplateDate(
				declaration?.declarationDate ?? cdsInfo.expectedDeclarationDate,
			) || "",
		"Mã HQ": cdsInfo.customsCode ?? declaration?.customsCode,
		"Mã LH": cdsInfo.operationCode,
		"Tên đối tác": cdsInfo.partnerName ?? followUp.supplier,
		"Mã đại lý HQ": cdsInfo.customsDeclarantCode,
		"Phân loại các nhân tổ chức": cdsInfo.personOrganizationClassification,
		"Mã bộ phận xử lý tk": cdsInfo.declarationProcessingDeptCode,
		"Mã hiệu phương thức vận chuyển": cdsInfo.transportMethodCode,
		"Vận đơn":
			cdsInfo.billOfLading ??
			followUp.billOrBooking ??
			declaration?.billBooking,
		"Số lượng kiện": toNumber(cdsInfo.packageQuantity ?? followUp.quantity),
		"Tổng trọng lượng hàng (Gross)":
			toNumber(
				cdsInfo.grossWeightTotal ??
					followUp.grossWeight ??
					declaration?.grossWeight,
			) ?? "",
		"Mã địa điểm lưu kho": cdsInfo.warehouseLocationCode,
		"Tên địa điểm lưu kho":
			cdsInfo.warehouseLocationName ??
			followUp.location ??
			declaration?.diaDiemLuuKho,
		"Mã phương tiện vận chuyển": cdsInfo.transportVehicleCode,
		"Tên phương tiện vận chuyển": cdsInfo.transportVehicleName,
		"Ngày đến": formatLegacyTemplateDate(cdsInfo.departureArrivalDate),
		"Mã địa điểm xếp hàng": cdsInfo.loadingLocationCode,
		"Tên địa điểm xếp hàng": cdsInfo.loadingLocationName,
		"Mã địa điểm dỡ hàng": cdsInfo.unloadingLocationCode,
		"Tên địa điểm dỡ hàng": cdsInfo.unloadingLocationName,
		"Số lượng cont": toNumber(cdsInfo.containerQuantity),
		"Số giấy phép": cdsInfo.licenseNumber,
		"Số HĐTM":
			cdsInfo.commercialInvoice ?? followUp.invoice ?? declaration?.invoice,
		"Ngày HĐTM": formatLegacyTemplateDate(cdsInfo.commercialInvoiceDate),
		"Tổng trị giá HĐ":
			toNumber(cdsInfo.totalInvoiceValue ?? cdsInfo.declaredValue) ?? "",
		"Phương thức thanh toán": cdsInfo.paymentMethod,
		"Điều kiện giá hóa đơn": cdsInfo.invoicePriceCondition,
		"Ng.Tệ hóa đơn": cdsInfo.invoiceCurrency,
		"Tỷ giá VNĐ": "",
		"Phí BH": toNumber(cdsInfo.insuranceFee),
		"Phí VC": toNumber(cdsInfo.transportFee),
		"Người nộp thuế": cdsInfo.taxPayer,
		"Trị giá KB": toNumber(cdsInfo.declaredValue),
		"Tổng trị giá TT": toNumber(cdsInfo.totalTaxableValue),
		"Tổng tiền thuế": toNumber(declaration?.totalTaxAmount),
		"Mã lý do đề nghị BP": cdsInfo.releaseBeforePermitCode,
		"Mã ngân hàng trả thuế": cdsInfo.taxSubstituteBankCode,
		"Năm phát hành hạn mức": cdsInfo.creditLimitIssueYear,
		"Ký hiệu CT hạn mức": cdsInfo.creditLimitDocumentSymbol,
		"Số CT hạn mức": cdsInfo.creditLimitDocumentNumber,
		"Mã xác định thời hạn nộp thuế": cdsInfo.taxPaymentDeadlineCode,
		"Mã ngân hàng bảo lãnh": cdsInfo.guaranteeBankCode,
		"Năm phát hành bảo lãnh":
			cdsInfo.guaranteeIssueYear ?? cdsInfo.creditLimitIssueYear,
		"Ký hiệu CT bảo lãnh": cdsInfo.guaranteeDocumentSymbol,
		"Số hiệu CT bảo lãnh": cdsInfo.guaranteeDocumentNumber,
		"Số HĐ": cdsInfo.contractNumber ?? followUp.poNumber,
		"Ngày HĐ": formatLegacyTemplateDate(cdsInfo.contractDate),
		"Ngày HHHĐ": formatLegacyTemplateDate(cdsInfo.contractGoodsDate),
		"Trạng thái": declaration ? "T" : "",
		"Phân luồng": toText(declaration?.batch) ?? "",
		"Loại tờ khai nhập xuất": resolvedOperationType === "XUAT" ? "X" : "N",
		"Tên đơn vị xuất/nhập khẩu":
			cdsInfo.importExportUnitName ?? followUp.companyName,
		"Loại hình tờ khai": hanAppName,
		"Địa chỉ doanh nghiệp xuất/nhập khẩu": cdsInfo.importExportBusinessAddress,
		"Mã nước xuất khẩu": cdsInfo.exportCountryCode,
		"Loại kiện": cdsInfo.packageType ?? followUp.unit,
		"Đơn vị tính trọng lượng": weightUnit,
		"Hóa đơn thương mại": cdsInfo.electronicInvoiceReceiptNumber,
		"Mã phân loại hóa đơn": cdsInfo.invoiceClassificationCode,
		"Mã phân loại phí vận chuyển": cdsInfo.transportFeeClassificationCode,
		"Mã phân loại phí bảo hiểm": cdsInfo.insuranceFeeClassificationCode,
		"Mã tiền phí vận chuyển": cdsInfo.transportFeeCurrencyCode,
		"Mã tiền phí bảo hiểm": cdsInfo.insuranceFeeCurrencyCode,
		"Địa chỉ người xuất/nhập khẩu1": cdsInfo.partnerAddress1,
		"Ghi chú": cdsInfo.note ?? followUp.notes,
		"Mã phân loại hình thức hóa đơn": cdsInfo.invoiceFormClassificationCode,
		"Địa điểm đích cho vận chuyển báo thuế": cdsInfo.taxDestinationLocation,
		"Ngày dự kiến đến địa điểm đích": formatLegacyTemplateDate(
			cdsInfo.estimatedArrivalAtDestinationDate,
		),
		"Ngày khởi hành vận chuyển": formatLegacyTemplateDate(
			cdsInfo.transportDepartureDate,
		),
		"Mã phân loại tờ khai trị giá": cdsInfo.valuationDeclarationTypeCode,
		"Địa chỉ người xuất/nhập khẩu2": cdsInfo.partnerAddress2,
		"Địa chỉ người xuất/nhập khẩu3": cdsInfo.partnerAddress3,
		"Địa chỉ người xuất/nhập khẩu4": cdsInfo.partnerAddress4,
		"Mã đồng tiền trị giá tính thuế": cdsInfo.taxableValueCurrencyCode,
		"Số quản lý của nội bộ doanh nghiệp":
			cdsInfo.internalBusinessManagementNumber,
		"Mã địa điểm xếp hàng lên xe chở hàng": cdsInfo.truckLoadingLocationCode,
		"Tên địa điểm xếp hàng lên xe chở hàng": cdsInfo.truckLoadingLocationName,
		"Địa chỉ địa điểm xếp hàng lên xe chở hàng":
			cdsInfo.truckLoadingLocationAddress,
	});

	return {
		originRow: 2,
		rows: buildLegacyDenseRows(
			[row],
			getLegacyTemplateRowCount(sheet, 2),
			headers.length,
		),
	};
}

function buildLegacyCargoSheetRows(
	sheet: XLSX.WorkSheet | undefined,
	followUp: ExportFollowUp,
) {
	if (!sheet) {
		return null;
	}

	const headers = readLegacyHeaderRow(sheet, 1);
	if (headers.length === 0) {
		return null;
	}

	const cargoRows = getPreviewCargoRows(followUp);
	const rows = cargoRows.map((cargo, index) =>
		buildLegacySparseRow(headers, {
			"Tên hàng": cargo.vietnameseName ?? cargo.originalCargoName,
			"Mã hàng": cargo.customCode,
			"Mã HS": cargo.hsCode,
			"Nước XX": cargo.originalCountry,
			"Đơn vị tính": cargo.unit ?? followUp.unit,
			Lượng: toNumber(cargo.qty),
			"Đơn giá HĐ": resolveCargoUnitPrice(cargo),
			"Trị giá HĐ": resolveCargoTotalPrice(cargo),
			"Trị giá tính thuế":
				toNumber(cargo.lineTaxableValue) ?? resolveCargoTotalPrice(cargo),
			STTHang: index + 1,
			"Mã miễn giảm không chịu thuế XNK": cargo.imExDutyExemptionCode,
			"Số tiền giảm thuế XNK": "",
			"Tiền thuế suất": "",
			"Tiền thuế TV": "",
			"Tiền thuế PB": "",
			"Tiền Thuế TTĐB": "",
			"Tiền thuế MT": "",
			"Tiền thuế VAT": "",
			"Đơn giá hợp đồng TM": resolveCargoUnitPrice(cargo),
			"Trị giá hợp đồng TM": resolveCargoTotalPrice(cargo),
			"Mã biểu thuế nhập khẩu": cargo.importTaxCode,
			"Mã biểu thuế VAT": cargo.vatTaxCode,
			"Loại hàng": cargo.dutyReductionCode,
			"Mã miễn giảm": cargo.imExDutyExemptionCode,
			"Đơn vị tính 2": cargo.unit2,
			"Lượng 2": toNumber(cargo.qty2),
		}),
	);

	return {
		originRow: 2,
		rows: buildLegacyDenseRows(
			rows,
			getLegacyTemplateRowCount(sheet, 2),
			headers.length,
		),
	};
}

function buildLegacyInspectionSheetRows(
	sheet: XLSX.WorkSheet | undefined,
	followUp: ExportFollowUp,
) {
	if (!sheet) {
		return null;
	}

	const headers = readLegacyHeaderRow(sheet, 1);
	if (headers.length === 0) {
		return null;
	}

	const cargoRows = getPreviewCargoRows(followUp);
	const rows = cargoRows.map((cargo, index) =>
		buildLegacySparseRow(headers, {
			"Tên hàng": cargo.vietnameseName ?? cargo.originalCargoName,
			"Mã hàng": cargo.customCode,
			"Mã HS": cargo.hsCode,
			"Nước xx": cargo.originalCountry,
			"Đơn vị tính": cargo.unit ?? followUp.unit,
			Lượng: toNumber(cargo.qty),
			"Đợn giá NT": resolveCargoUnitPrice(cargo),
			"Trị giá NT": resolveCargoTotalPrice(cargo),
			"Trị giá tính thuế":
				toNumber(cargo.lineTaxableValue) ?? resolveCargoTotalPrice(cargo),
			"TS XNK": "",
			"TS TTDB": "",
			"TS VAT": "",
			"TS CLGia": "",
			"Trị giá khai báo VND": "",
			"Mã phụ": cargo.customCode,
			Ma_DG: cargo.term,
			STTHang: index + 1,
			"Đơn giá tính thuế":
				toNumber(cargo.taxableUnitPrice) ?? resolveCargoUnitPrice(cargo),
			"Tiền thuế suất": "",
			"Tiền thuế TTDB": "",
			"Tiền thuế VAT": "",
			"Tiền thuế CLGia": "",
		}),
	);

	return {
		originRow: 2,
		rows: buildLegacyDenseRows(
			rows,
			getLegacyTemplateRowCount(sheet, 2),
			headers.length,
		),
	};
}

function buildLegacyDetailSheetRows(
	sheet: XLSX.WorkSheet | undefined,
	followUp: ExportFollowUp,
) {
	if (!sheet) {
		return null;
	}

	const headers = readLegacyHeaderRow(sheet, 2);
	if (headers.length === 0) {
		return null;
	}

	const cdsInfo = (followUp.cdsInfo ?? {}) as Partial<FollowUpCdsInfoRow>;
	const declaration = getPrimaryDeclaration(followUp.declarations);
	const resolvedOperationType = getResolvedOperationType(followUp);

	const row = buildLegacySparseRow(headers, {
		Stt: 1,
		"Số tờ khai":
			cdsInfo.declarationNumber ?? declaration?.declarationNumber ?? "",
		"Ngày tờ khai": formatLegacyTemplateDate(
			declaration?.declarationDate ?? cdsInfo.expectedDeclarationDate,
		),
		"Loại hình": cdsInfo.operationCode,
		"Tên khách hàng (Customer)":
			cdsInfo.importExportUnitName ?? followUp.companyName,
		"Tên người nhận hàng (Consignee)": cdsInfo.partnerName ?? followUp.supplier,
		"Số invoice":
			cdsInfo.commercialInvoice ?? followUp.invoice ?? declaration?.invoice,
		"Ngày invoice": formatLegacyTemplateDate(cdsInfo.commercialInvoiceDate),
		"Số hợp đồng": cdsInfo.contractNumber ?? followUp.poNumber,
		"Ngày hợp đồng": formatLegacyTemplateDate(cdsInfo.contractDate),
		"Ngày hết hạn hợp đồng": formatLegacyTemplateDate(
			cdsInfo.contractGoodsDate,
		),
		"Nước nhập khẩu/ xuất khẩu": cdsInfo.exportCountryCode,
		"Cửa khẩu xuất hàng/ nhập hàng":
			cdsInfo.customsCode ?? declaration?.customsCode,
		"Điều kiện giao hàng": cdsInfo.invoicePriceCondition,
		"Hình thức thanh toán": cdsInfo.paymentMethod,
		"Đồng tiền thanh toán": cdsInfo.invoiceCurrency,
		"Tỷ giá": "",
		"Số kiện": toNumber(cdsInfo.packageQuantity ?? followUp.quantity),
		"Trọng lượng tịnh": "",
		"Trọng lượng cả bì":
			toNumber(
				cdsInfo.grossWeightTotal ??
					followUp.grossWeight ??
					declaration?.grossWeight,
			) ?? "",
		"Số giấy phép": cdsInfo.licenseNumber,
		"Ngày giấy phép": "",
		"Ngày hết hạn giấy phép": formatLegacyTemplateDate(
			cdsInfo.reExportDeadline,
		),
		"Số vận đơn":
			cdsInfo.billOfLading ??
			followUp.billOrBooking ??
			declaration?.billBooking,
		"Ngày vận đơn": "",
		"Chứng từ kèm theo": Array.isArray(cdsInfo.electronicAttachments)
			? cdsInfo.electronicAttachments
					.map((item) => item?.attachmentNumber)
					.filter(Boolean)
					.join(", ")
			: "",
		Con20: "",
		Con40: "",
		"Mã chi cục hải quan": cdsInfo.customsCode ?? declaration?.customsCode,
		"Mã người ủy thác": cdsInfo.entrustedImporterCode,
		"Mã đại lý làm thủ tục hải quan": cdsInfo.customsDeclarantCode,
		"Số tiếp nhận": cdsInfo.electronicInvoiceReceiptNumber,
		"Ngày tiếp nhận": "",
		"Hệ số quy đổi CIF": "",
		"Dùng hệ số doanh nghiệp": "",
		"Hệ số doanh nghiệp quy đổi CIF": "",
		"Phí vận chuyển": toNumber(cdsInfo.transportFee),
		"Phí bảo hiểm": toNumber(cdsInfo.insuranceFee),
		"Tổng trị giá NT":
			toNumber(cdsInfo.totalInvoiceValue ?? cdsInfo.declaredValue) ?? "",
		"Tổng trị giá tính thuế": toNumber(cdsInfo.totalTaxableValue),
		"Tổng tiền thuế": toNumber(declaration?.totalTaxAmount),
		"Phương tiện vận tải": cdsInfo.transportVehicleCode,
		"Tên phương tiện vận tải": cdsInfo.transportVehicleName,
		"Ngày đến phương tiện vận tải": formatLegacyTemplateDate(
			cdsInfo.departureArrivalDate,
		),
		"Trạng thái tờ khai": declaration ? "T" : "",
		"Ngày thực xuất, thực nhập": "",
		"Tổng tiền thuế sau kiểm hóa": toNumber(declaration?.totalTaxAmount),
		"Tỉ giá USD": "",
		"Cảng địa điểm xếp hàng": cdsInfo.loadingLocationName,
		"Loại tờ khai (Nhập,xuất)":
			resolvedOperationType === "XUAT" ? "Xuất" : "Nhập",
		"Têm đợn vị xuất/nhập khẩu":
			cdsInfo.importExportUnitName ?? followUp.companyName,
	});

	return {
		originRow: 4,
		rows: buildLegacyDenseRows(
			[row],
			getLegacyTemplateRowCount(sheet, 4),
			headers.length,
		),
	};
}

async function exportCustomsDeclarationFromLegacyTemplate(
	followUp: ExportFollowUp,
) {
	const resolvedOperationType = getResolvedOperationType(followUp) ?? "NHAP";
	const templateFileName =
		LEGACY_TEMPLATE_FILE_BY_OPERATION[resolvedOperationType];
	const templatePath = path.join(
		process.cwd(),
		"public",
		"templates",
		templateFileName,
	);

	if (!fs.existsSync(templatePath)) {
		return null;
	}

	const templateBuffer = fs.readFileSync(templatePath);
	const workbook = XLSX.read(templateBuffer, {
		type: "buffer",
		cellDates: true,
		cellNF: true,
		cellStyles: true,
	});

	const sheetPatches = {
		KhaiToKhai: buildLegacyHeaderSheetRows(
			workbook.Sheets.KhaiToKhai,
			followUp,
		),
		KhaiHang: buildLegacyCargoSheetRows(workbook.Sheets.KhaiHang, followUp),
		HangKiemHoa: buildLegacyInspectionSheetRows(
			workbook.Sheets.HangKiemHoa,
			followUp,
		),
		KhaiToKhai1: buildLegacyDetailSheetRows(
			workbook.Sheets.KhaiToKhai1,
			followUp,
		),
	};
	const normalizedSheetPatches: Record<string, LegacyTemplateSheetPatch> = {};

	for (const [sheetName, patch] of Object.entries(sheetPatches)) {
		if (patch) {
			normalizedSheetPatches[sheetName] = patch;
		}
	}

	const buffer = writeLegacyTemplateWorkbook(
		templateBuffer,
		workbook,
		normalizedSheetPatches,
	);

	return {
		buffer: Buffer.from(buffer),
		extension: "xls" as const,
		fileName: templateFileName,
	};
}

async function loadFollowUpForExport(followUpId: string) {
	const followUp = await prismaRPA.followUp.findUnique({
		where: { id: followUpId },
		include: {
			cdsInfo: { include: CDS_INFO_COLLECTION_INCLUDE },
			cargoLists: true,
			declarations: true,
			cerOfOrigins: true,
		},
	});

	return followUp
		? { ...followUp, cdsInfo: hydrateCdsCollections(followUp.cdsInfo) }
		: null;
}

export async function exportCustomsDeclaration(
	followUpId: string,
): Promise<{ buffer: Buffer; extension: "xls" | "xlsx"; fileName: string }> {
	const followUp = await loadFollowUpForExport(followUpId);

	if (!followUp) {
		throw new Error("FollowUp not found");
	}

	const legacyExport =
		await exportCustomsDeclarationFromLegacyTemplate(followUp);
	if (legacyExport) {
		return legacyExport;
	}

	const templatePath = path.join(
		process.cwd(),
		"public/templates/to_khai_quan.xlsx",
	);
	const workbook = new ExcelJS.Workbook();
	await workbook.xlsx.readFile(templatePath);

	const resolvedOperationType = getResolvedOperationType(followUp);
	const previewSheetName = getEcusTemplateSheetName(resolvedOperationType);
	const previewSheet = workbook.getWorksheet(previewSheetName);
	const flatSheet =
		workbook.getWorksheet(ECUS_TEMPLATE_SHEET_NAMES.flat) ??
		workbook.addWorksheet(ECUS_TEMPLATE_SHEET_NAMES.flat);
	const guideSheet =
		workbook.getWorksheet(ECUS_TEMPLATE_SHEET_NAMES.guide) ??
		workbook.addWorksheet(ECUS_TEMPLATE_SHEET_NAMES.guide);
	const legacySheetName =
		resolvedOperationType === "XUAT" ? "VNACC-XUẤT" : "VNACC-NHẬP";
	const legacySheet = workbook.getWorksheet(legacySheetName);

	const importPreviewSheet = workbook.getWorksheet(
		ECUS_TEMPLATE_SHEET_NAMES.import,
	);
	const exportPreviewSheet = workbook.getWorksheet(
		ECUS_TEMPLATE_SHEET_NAMES.export,
	);

	if (importPreviewSheet) {
		resetPreviewSheet(importPreviewSheet);
	}
	if (exportPreviewSheet) {
		resetPreviewSheet(exportPreviewSheet);
	}

	if (!previewSheet) {
		throw new Error(`Sheet ${previewSheetName} not found in template`);
	}

	fillPreviewSheet(previewSheet, followUp);
	fillFlatSheet(flatSheet, followUp);
	fillGuideSheet(guideSheet);

	if (legacySheet) {
		fillLegacyVnaccSheet(legacySheet, followUp);
	}

	const buffer = await workbook.xlsx.writeBuffer();
	return {
		buffer: Buffer.from(buffer),
		extension: "xlsx",
		fileName: "to_khai_quan.xlsx",
	};
}
