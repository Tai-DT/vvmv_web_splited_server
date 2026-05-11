// cds-collection-tables.tsx – collection table components extracted from cds-info-panel.tsx (Phase 4)
"use client";

import { Loader2, Upload } from "lucide-react";
import type React from "react";
import { Fragment } from "react";
import { cn } from "@/lib/utils";
import type { FollowUpCdsInfoRow } from "../../../types";
import {
	BufferedInput,
	finalizeNativeSelectInteraction,
	markPendingNativeSelectInteraction,
} from "./cds-classic-ui";
import { DatePickerInput } from "./cds-date-picker";
import { stopCdsInteraction } from "./cds-utils";

export interface CdsCollectionTablesProps {
	data: Partial<FollowUpCdsInfoRow>;
	ecusTableInputCls: string;
	ecusBillTableInputCls: string;
	ecusDisabledFieldCls: string;
	importLicenseOptions: Array<{
		value: string;
		label: string;
	}>;
	legalDocumentOptions: Array<{
		value: string;
		label: string;
	}>;
	electronicAttachmentTypeOptions: Array<{
		value: string;
		label: string;
	}>;
	renderClassicLabel: (label: string) => React.ReactNode;
	getBillItemRowLockReason: (index: number) => string | null;
	updateBillItem: (index: number, field: string, value: string) => void;
	getValuationAdjustmentLockReason: (index: number) => string | null;
	updateValuationAdjustment: (
		index: number,
		field: string,
		value: string,
	) => void;
	getElectronicAttachmentLockReason: (index: number) => string | null;
	updateElectronicAttachment: (
		index: number,
		field: string,
		value: string,
	) => void;
	handleOpenElectronicAttachmentTypeLookup: (index: number) => void;
	handleOpenElectronicAttachmentLookup: (index: number) => void;
	handleUploadElectronicAttachment: (index: number) => void;
	uploadingAttachmentIndex: number | null;
	getTransportScheduleLockReason: (index: number) => string | null;
	updateTransportSchedule: (
		index: number,
		field: string,
		value: string,
	) => void;
	handleOpenTransportLocationLookup: (index: number) => void;
	showExportLicenseTable: boolean;
	getExportLicenseRowLockReason: (index: number) => string | null;
	updateImportLicenseSlot: (index: number, value: string | null) => void;
	handleOpenImportLicenseTypeLookup: (index: number) => void;
	updateLegalDocumentSlot: (index: number, value: string | null) => void;
	handleOpenLegalDocumentCodeLookup: (index: number) => void;
	handleOpenExportPermitLookup: (index: number) => void;
	showLicenseFields: boolean;
	getImportLicenseSlotLockReason: (index: number) => string | null;
	showLegalDocumentFields: boolean;
	getLegalDocumentSlotLockReason: (index: number) => string | null;
	suppressManualScrollRestore?: (applyChange: () => void) => void;
}

const ecusTinyActionButtonCls =
	"inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-none border border-slate-500 bg-[#d9d9d9] text-[11px] leading-none text-slate-700 shadow-none transition hover:bg-[#ececec] disabled:border-[#b5b5b5] disabled:bg-[#d8d8d8] disabled:text-slate-600 disabled:cursor-default";

const ecusUploadActionButtonCls =
	"inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-none border border-slate-500 bg-[#efe3a8] text-[#2f94b6] shadow-none transition hover:bg-[#f4e8b8] disabled:border-[#b5b5b5] disabled:bg-[#d8d8d8] disabled:text-slate-600 disabled:cursor-default";

const ecusCollectionLabelCls = "pt-[2px] text-[11px] text-black";
const ecusCollectionTwoColumnGridCls =
	"mt-1 mb-0.5 grid gap-x-3 gap-y-1 sm:grid-cols-[188px_1fr]";
const transportScheduleCodeWidthCls = "w-[100px]";
const transportScheduleNameWidthCls = "w-[224px]";
const transportScheduleDateWidthCls = "w-[130px]";
const electronicAttachmentGridCls =
	"grid grid-cols-[28px_100px_22px_140px_22px_22px] items-center gap-0.5";
/** ECUS: hàng trung chuyển + hàng địa điểm đích bảo thuế dùng chung lưới cột. */
export const transportScheduleGridCls =
	"grid grid-cols-[28px_100px_224px_22px_130px_8px_130px] items-center gap-0.5";
const THREE_ROW_INDEXES = [0, 1, 2] as const;
const FIVE_ROW_INDEXES = [0, 1, 2, 3, 4] as const;

type BillItemRow = NonNullable<FollowUpCdsInfoRow["billItems"]>[number];
type ValuationAdjustmentRow = NonNullable<
	FollowUpCdsInfoRow["valuationAdjustments"]
>[number];
type ElectronicAttachmentRow = NonNullable<
	FollowUpCdsInfoRow["electronicAttachments"]
>[number];
type TransportScheduleRow = NonNullable<
	FollowUpCdsInfoRow["transportSchedules"]
>[number] & {
	locationCode?: string | null;
};

function parseImportLicenseSlotValue(value: string | null | undefined) {
	const raw = value == null ? "" : String(value).trim();
	if (!raw) {
		return { code: "", number: "" };
	}

	const [code, ...rest] = raw.split(":");
	return {
		code: code.trim(),
		number: rest.join(":").trim(),
	};
}

function buildImportLicenseSlotValue(code: string, number: string) {
	const normalizedCode = code.trim();
	const normalizedNumber = number.trim();

	if (!normalizedCode && !normalizedNumber) {
		return null;
	}

	if (!normalizedNumber) {
		return normalizedCode || null;
	}

	return normalizedCode
		? `${normalizedCode}:${normalizedNumber}`
		: `:${normalizedNumber}`;
}

export const BillItemsTable: React.FC<CdsCollectionTablesProps> = (props) => {
	const {
		data,
		ecusBillTableInputCls,
		ecusDisabledFieldCls,
		renderClassicLabel,
		getBillItemRowLockReason,
		updateBillItem,
		suppressManualScrollRestore,
	} = props;

	const items = (data.billItems ?? []) as BillItemRow[];
	return (
		<div className="cds-visible-x-scrollbar -mx-1 px-1">
			<div className="mt-2 mb-1 grid grid-cols-[160px_28px_minmax(220px,1fr)_110px_minmax(170px,1fr)_88px] items-center gap-x-1 gap-y-1 text-[12px] min-w-[780px]">
				<div className="pt-1 text-left">{renderClassicLabel("Số vận đơn")}</div>
				<div />
				<div className="text-center">Số vận đơn</div>
				<div className="text-center">Ngày vận đơn</div>
				<div className="text-center">Số HAWB</div>
				<div className="text-center">Năm MAWB</div>
				{FIVE_ROW_INDEXES.map((rowIndex) => {
					const item = items[rowIndex] ?? {};
					const rowLockReason = getBillItemRowLockReason(rowIndex);
					const isRowDisabled = rowLockReason !== null;
					return (
						<Fragment key={`bill-${rowIndex}`}>
							<div />
							<span className="text-[12px] text-right text-black shrink-0">
								{rowIndex + 1}
							</span>
							<BufferedInput
								value={String(item.billNumber ?? "")}
								onCommit={(nextValue) =>
									updateBillItem(rowIndex, "billNumber", nextValue)
								}
								suppressManualScrollRestore={suppressManualScrollRestore}
								disabled={isRowDisabled}
								title={rowLockReason ?? undefined}
								className={cn(
									ecusBillTableInputCls,
									isRowDisabled && ecusDisabledFieldCls,
								)}
							/>
							<BufferedInput
								value={String(item.billDate ?? "")}
								onCommit={(nextValue) =>
									updateBillItem(rowIndex, "billDate", nextValue)
								}
								suppressManualScrollRestore={suppressManualScrollRestore}
								disabled={isRowDisabled}
								title={rowLockReason ?? undefined}
								className={cn(
									ecusBillTableInputCls,
									isRowDisabled && ecusDisabledFieldCls,
								)}
							/>
							<BufferedInput
								value={String(item.hawbNumber ?? "")}
								onCommit={(nextValue) =>
									updateBillItem(rowIndex, "hawbNumber", nextValue)
								}
								suppressManualScrollRestore={suppressManualScrollRestore}
								disabled={isRowDisabled}
								title={rowLockReason ?? undefined}
								className={cn(
									ecusBillTableInputCls,
									isRowDisabled && ecusDisabledFieldCls,
								)}
							/>
							<BufferedInput
								value={String(item.mawbYear ?? "")}
								onCommit={(nextValue) =>
									updateBillItem(rowIndex, "mawbYear", nextValue)
								}
								suppressManualScrollRestore={suppressManualScrollRestore}
								disabled={isRowDisabled}
								title={rowLockReason ?? undefined}
								className={cn(
									ecusBillTableInputCls,
									isRowDisabled && ecusDisabledFieldCls,
								)}
							/>
						</Fragment>
					);
				})}
			</div>
		</div>
	);
};

export const ValuationAdjustmentsTable: React.FC<CdsCollectionTablesProps> = (
	props,
) => {
	const {
		data,
		ecusTableInputCls,
		ecusDisabledFieldCls,
		getValuationAdjustmentLockReason,
		updateValuationAdjustment,
		suppressManualScrollRestore,
	} = props;

	const items = (data.valuationAdjustments ?? []) as ValuationAdjustmentRow[];
	const valuationGridCls =
		"grid min-w-[1024px] grid-cols-[28px_170px_176px_170px_252px_204px] items-center gap-px";
	const valuationHeaderCls =
		"text-center text-[11px] leading-[16px] text-black";
	const valuationIndexCls =
		"pr-1 text-right text-[12px] leading-[16px] text-black";
	const valuationInputCls = cn(
		ecusTableInputCls,
		"w-full border-[#93a7c7] bg-white focus:border-[#6f8fb8]",
	);
	const valuationCodeInputCls = cn(valuationInputCls, "text-center");

	return (
		<div className="cds-visible-x-scrollbar mt-2 mb-1">
			<div className="text-[12px] text-black mb-0.5">Các khoản điều chỉnh:</div>
			<div className="min-w-[1024px]">
				<div className={cn(valuationGridCls, "mb-px")}>
					<div />
					<span className={valuationHeaderCls}>Mã tên</span>
					<span className={valuationHeaderCls}>Mã phân loại</span>
					<span className={valuationHeaderCls}>Mã nguyên tệ</span>
					<span className={valuationHeaderCls}>Trị giá điều chỉnh</span>
					<span className={valuationHeaderCls}>Hệ số phân bổ</span>
				</div>
				{FIVE_ROW_INDEXES.map((rowIndex) => {
					const item = items[rowIndex] ?? {};
					const rowLockReason = getValuationAdjustmentLockReason(rowIndex);
					const isRowDisabled = rowLockReason !== null;
					return (
						<div
							key={`va-${rowIndex}`}
							className={cn(valuationGridCls, "mb-px")}
						>
							<span className={valuationIndexCls}>({rowIndex + 1})</span>
							<BufferedInput
								value={String(item.nameCode ?? "")}
								onCommit={(nextValue) =>
									updateValuationAdjustment(rowIndex, "nameCode", nextValue)
								}
								suppressManualScrollRestore={suppressManualScrollRestore}
								disabled={isRowDisabled}
								title={rowLockReason ?? undefined}
								className={cn(
									valuationCodeInputCls,
									isRowDisabled && ecusDisabledFieldCls,
								)}
							/>
							<BufferedInput
								value={String(item.classificationCode ?? "")}
								onCommit={(nextValue) =>
									updateValuationAdjustment(
										rowIndex,
										"classificationCode",
										nextValue,
									)
								}
								suppressManualScrollRestore={suppressManualScrollRestore}
								disabled={isRowDisabled}
								title={rowLockReason ?? undefined}
								className={cn(
									valuationCodeInputCls,
									isRowDisabled && ecusDisabledFieldCls,
								)}
							/>
							<BufferedInput
								value={String(item.currencyCode ?? "")}
								onCommit={(nextValue) =>
									updateValuationAdjustment(rowIndex, "currencyCode", nextValue)
								}
								suppressManualScrollRestore={suppressManualScrollRestore}
								disabled={isRowDisabled}
								title={rowLockReason ?? undefined}
								className={cn(
									valuationCodeInputCls,
									isRowDisabled && ecusDisabledFieldCls,
								)}
							/>
							<BufferedInput
								value={
									item.adjustmentValue != null
										? String(item.adjustmentValue)
										: ""
								}
								onCommit={(nextValue) =>
									updateValuationAdjustment(
										rowIndex,
										"adjustmentValue",
										nextValue,
									)
								}
								suppressManualScrollRestore={suppressManualScrollRestore}
								disabled={isRowDisabled}
								title={rowLockReason ?? undefined}
								className={cn(
									valuationInputCls,
									isRowDisabled && ecusDisabledFieldCls,
								)}
							/>
							<BufferedInput
								value={
									item.allocationRatio != null
										? String(item.allocationRatio)
										: ""
								}
								onCommit={(nextValue) =>
									updateValuationAdjustment(
										rowIndex,
										"allocationRatio",
										nextValue,
									)
								}
								suppressManualScrollRestore={suppressManualScrollRestore}
								disabled={isRowDisabled}
								title={rowLockReason ?? undefined}
								className={cn(
									valuationInputCls,
									isRowDisabled && ecusDisabledFieldCls,
								)}
							/>
						</div>
					);
				})}
			</div>
		</div>
	);
};

export const ElectronicAttachmentsTable: React.FC<CdsCollectionTablesProps> = (
	props,
) => {
	const {
		data,
		ecusTableInputCls,
		ecusDisabledFieldCls,
		electronicAttachmentTypeOptions,
		getElectronicAttachmentLockReason,
		updateElectronicAttachment,
		handleOpenElectronicAttachmentTypeLookup,
		handleOpenElectronicAttachmentLookup,
		handleUploadElectronicAttachment,
		uploadingAttachmentIndex,
		suppressManualScrollRestore,
	} = props;

	const items = (data.electronicAttachments ?? []) as ElectronicAttachmentRow[];
	return (
		<div className={ecusCollectionTwoColumnGridCls}>
			<div className={ecusCollectionLabelCls}>
				Số đính kèm khai báo điện tử:
			</div>
			<div className="cds-visible-x-scrollbar">
				<div className="w-[344px] min-w-[344px]">
					<div
						className={cn(
							electronicAttachmentGridCls,
							"mb-0.5 text-[11px] text-black",
						)}
					>
						<span />
						<span className="col-span-2 text-center">Phân loại đính kèm</span>
						<span className="col-span-2 text-center">Số đính kèm</span>
						<span />
					</div>
					{THREE_ROW_INDEXES.map((rowIndex) => {
						const item = items[rowIndex] ?? {};
						const rowLockReason = getElectronicAttachmentLockReason(rowIndex);
						const isRowDisabled = rowLockReason !== null;
						const currentTypeCode =
							item.attachmentDescription === null ||
							item.attachmentDescription === undefined
								? ""
								: String(item.attachmentDescription);
						const hasCurrentTypeCodeOption =
							currentTypeCode.length > 0 &&
							electronicAttachmentTypeOptions.some(
								(option) => option.value === currentTypeCode,
							);
						return (
							<div
								key={`ea-${rowIndex}`}
								className={cn(electronicAttachmentGridCls, "mb-px")}
							>
								<span className="w-[28px] shrink-0 text-right text-[12px] text-black">
									({rowIndex + 1})
								</span>
								<select
									value={currentTypeCode}
									onPointerDown={markPendingNativeSelectInteraction}
									onChange={(e) => {
										updateElectronicAttachment(
											rowIndex,
											"attachmentDescription",
											e.target.value,
										);
										finalizeNativeSelectInteraction();
									}}
									onBlur={finalizeNativeSelectInteraction}
									disabled={isRowDisabled}
									title={rowLockReason ?? undefined}
									className={cn(
										ecusTableInputCls,
										"w-[100px] shrink-0 appearance-auto bg-white px-1 pr-5 text-center [text-align-last:center]",
										isRowDisabled && ecusDisabledFieldCls,
									)}
								>
									<option value="" />
									{hasCurrentTypeCodeOption ? null : currentTypeCode ? (
										<option value={currentTypeCode}>{currentTypeCode}</option>
									) : null}
									{electronicAttachmentTypeOptions.map((option) => (
										<option
											key={`ea-type-${option.value}`}
											value={option.value}
										>
											{option.value}
										</option>
									))}
								</select>
								<button
									type="button"
									className={ecusTinyActionButtonCls}
									onClick={(event) => {
										stopCdsInteraction(event);
										handleOpenElectronicAttachmentTypeLookup(rowIndex);
									}}
									disabled={isRowDisabled}
									title={rowLockReason ?? "Tra cứu loại đính kèm điện tử"}
								>
									...
								</button>
								<BufferedInput
									value={String(item.attachmentNumber ?? "")}
									onCommit={(nextValue) =>
										updateElectronicAttachment(
											rowIndex,
											"attachmentNumber",
											nextValue,
										)
									}
									suppressManualScrollRestore={suppressManualScrollRestore}
									disabled={isRowDisabled}
									title={rowLockReason ?? undefined}
									className={cn(
										ecusTableInputCls,
										"w-[140px] shrink-0 bg-white",
										isRowDisabled && ecusDisabledFieldCls,
									)}
								/>
								<button
									type="button"
									className={ecusTinyActionButtonCls}
									onClick={(event) => {
										stopCdsInteraction(event);
										handleOpenElectronicAttachmentLookup(rowIndex);
									}}
									disabled={isRowDisabled}
									title={rowLockReason ?? "Tra cứu số đính kèm điện tử"}
								>
									...
								</button>
								<button
									type="button"
									className={ecusUploadActionButtonCls}
									onClick={(event) => {
										stopCdsInteraction(event);
										handleUploadElectronicAttachment(rowIndex);
									}}
									disabled={
										isRowDisabled || uploadingAttachmentIndex === rowIndex
									}
									title={rowLockReason ?? "Upload đính kèm điện tử"}
								>
									{uploadingAttachmentIndex === rowIndex ? (
										<Loader2 className="h-3 w-3 animate-spin text-slate-600" />
									) : (
										<Upload className="h-3 w-3" />
									)}
								</button>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
};

export const TransportSchedulesTable: React.FC<CdsCollectionTablesProps> = (
	props,
) => {
	const {
		data,
		ecusTableInputCls,
		ecusDisabledFieldCls,
		getTransportScheduleLockReason,
		updateTransportSchedule,
		handleOpenTransportLocationLookup,
		suppressManualScrollRestore,
	} = props;

	const items = (data.transportSchedules ?? []) as TransportScheduleRow[];
	return (
		<div className={ecusCollectionTwoColumnGridCls}>
			<div className={ecusCollectionLabelCls}>Thông tin trung chuyển:</div>
			<div className="cds-visible-x-scrollbar">
				<div className="w-[654px] min-w-[654px]">
					<div
						className={cn(
							transportScheduleGridCls,
							"mb-0.5 text-[11px] text-black",
						)}
					>
						<span />
						<span className="text-center">Mã</span>
						<span className="text-center">Địa điểm</span>
						<span />
						<span className="text-center">Ngày đến</span>
						<span />
						<span className="text-center">Ngày khởi hành</span>
					</div>
					{THREE_ROW_INDEXES.map((rowIndex) => {
						const item = items[rowIndex] ?? {};
						const rowLockReason = getTransportScheduleLockReason(rowIndex);
						const isRowDisabled = rowLockReason !== null;
						return (
							<div
								key={`ts-${rowIndex}`}
								className={cn(transportScheduleGridCls, "mb-px")}
							>
								<span className="w-[28px] shrink-0 text-right text-[12px] text-black">
									({rowIndex + 1})
								</span>
								<BufferedInput
									value={String(item.locationCode ?? "")}
									onCommit={(nextValue) =>
										updateTransportSchedule(rowIndex, "locationCode", nextValue)
									}
									suppressManualScrollRestore={suppressManualScrollRestore}
									disabled={isRowDisabled}
									title={rowLockReason ?? undefined}
									className={cn(
										ecusTableInputCls,
										"shrink-0 bg-white text-center",
										transportScheduleCodeWidthCls,
										isRowDisabled && ecusDisabledFieldCls,
									)}
								/>
								<BufferedInput
									value={String(item.locationName ?? "")}
									onCommit={(nextValue) =>
										updateTransportSchedule(rowIndex, "locationName", nextValue)
									}
									suppressManualScrollRestore={suppressManualScrollRestore}
									disabled={isRowDisabled}
									title={rowLockReason ?? undefined}
									className={cn(
										ecusTableInputCls,
										"shrink-0 bg-white",
										transportScheduleNameWidthCls,
										isRowDisabled && ecusDisabledFieldCls,
									)}
								/>
								<button
									type="button"
									className={ecusTinyActionButtonCls}
									onClick={(event) => {
										stopCdsInteraction(event);
										handleOpenTransportLocationLookup(rowIndex);
									}}
									disabled={isRowDisabled}
									title={rowLockReason ?? "Tra cứu địa điểm trung chuyển"}
								>
									...
								</button>
								<DatePickerInput
									value={
										item.arrivalDate === null || item.arrivalDate === undefined
											? ""
											: String(item.arrivalDate)
									}
									onChange={(iso) =>
										updateTransportSchedule(rowIndex, "arrivalDate", iso ?? "")
									}
									disabled={isRowDisabled}
									title={rowLockReason ?? "Chọn ngày đến"}
									inputClassName={cn(
										ecusTableInputCls,
										"bg-white",
										isRowDisabled && ecusDisabledFieldCls,
									)}
									triggerClassName={ecusTinyActionButtonCls}
									wrapperClassName={cn(
										"shrink-0",
										transportScheduleDateWidthCls,
									)}
								/>
								<span className="w-[8px] shrink-0 text-center text-black">
									-
								</span>
								<DatePickerInput
									value={
										item.departureDate === null ||
										item.departureDate === undefined
											? ""
											: String(item.departureDate)
									}
									onChange={(iso) =>
										updateTransportSchedule(
											rowIndex,
											"departureDate",
											iso ?? "",
										)
									}
									disabled={isRowDisabled}
									title={rowLockReason ?? "Chọn ngày khởi hành"}
									inputClassName={cn(
										ecusTableInputCls,
										"bg-white",
										isRowDisabled && ecusDisabledFieldCls,
									)}
									triggerClassName={ecusTinyActionButtonCls}
									wrapperClassName={cn(
										"shrink-0",
										transportScheduleDateWidthCls,
									)}
								/>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
};

export const ExportLicenseDocumentTable: React.FC<CdsCollectionTablesProps> = (
	props,
) => {
	const {
		data,
		ecusTableInputCls,
		ecusDisabledFieldCls,
		getExportLicenseRowLockReason,
		updateImportLicenseSlot,
		updateLegalDocumentSlot,
		handleOpenExportPermitLookup,
		suppressManualScrollRestore,
	} = props;

	const permitNumbers = Array.isArray(data.importLicenses)
		? data.importLicenses
		: [];
	const legalCodes = Array.isArray(data.otherLegalDocumentCodes)
		? data.otherLegalDocumentCodes
		: [];
	const leftColumnIndexes = [0, 1, 3];
	const rightColumnIndexes = [2, 4];

	const renderExportLicenseSlot = (index: number) => {
		const rowLockReason = getExportLicenseRowLockReason(index);
		const isRowDisabled = rowLockReason !== null;

		return (
			<div key={`el-${index}`} className="flex items-center gap-1 mb-px">
				<span className="w-[16px] text-[12px] text-right text-black shrink-0">
					{index + 1}
				</span>
				<BufferedInput
					value={String(legalCodes[index] ?? "")}
					onCommit={(nextValue) => updateLegalDocumentSlot(index, nextValue)}
					suppressManualScrollRestore={suppressManualScrollRestore}
					disabled={isRowDisabled}
					title={rowLockReason ?? undefined}
					className={cn(
						ecusTableInputCls,
						"w-[58px] shrink-0 bg-white text-center",
						isRowDisabled && ecusDisabledFieldCls,
					)}
				/>
				<BufferedInput
					value={String(permitNumbers[index] ?? "")}
					onCommit={(nextValue) => updateImportLicenseSlot(index, nextValue)}
					suppressManualScrollRestore={suppressManualScrollRestore}
					disabled={isRowDisabled}
					title={rowLockReason ?? undefined}
					className={cn(
						ecusTableInputCls,
						"w-[180px] shrink-0 bg-white",
						isRowDisabled && ecusDisabledFieldCls,
					)}
				/>
				<button
					type="button"
					className={ecusTinyActionButtonCls}
					onClick={(event) => {
						stopCdsInteraction(event);
						handleOpenExportPermitLookup(index);
					}}
					disabled={isRowDisabled}
					title={rowLockReason ?? "Tra cứu giấy phép xuất khẩu"}
				>
					...
				</button>
			</div>
		);
	};

	return (
		<div className={ecusCollectionTwoColumnGridCls}>
			<div className={ecusCollectionLabelCls}>Giấy phép xuất khẩu:</div>
			<div className="grid grid-cols-1 gap-y-0.5 sm:grid-cols-2 sm:gap-x-6 sm:max-w-[620px]">
				<div className="space-y-0.5">
					{leftColumnIndexes.map(renderExportLicenseSlot)}
				</div>
				<div className="space-y-0.5">
					{rightColumnIndexes.map(renderExportLicenseSlot)}
				</div>
			</div>
		</div>
	);
};

export const ImportLicenseSlots: React.FC<CdsCollectionTablesProps> = (
	props,
) => {
	const {
		data,
		ecusTableInputCls,
		ecusDisabledFieldCls,
		importLicenseOptions,
		getImportLicenseSlotLockReason,
		updateImportLicenseSlot,
		handleOpenImportLicenseTypeLookup,
		suppressManualScrollRestore,
	} = props;

	const items = Array.isArray(data.importLicenses) ? data.importLicenses : [];
	const leftColumnIndexes = [0, 1, 3];
	const rightColumnIndexes = [2, 4];

	const renderImportLicenseSlot = (index: number) => {
		const rowLockReason = getImportLicenseSlotLockReason(index);
		const isRowDisabled = rowLockReason !== null;
		const { code, number } = parseImportLicenseSlotValue(items[index]);
		const hasCurrentCodeOption =
			code.length > 0 &&
			importLicenseOptions.some((option) => option.value === code);
		const selectedOption =
			code.length > 0
				? importLicenseOptions.find((option) => option.value === code)
				: undefined;
		const selectedFullLabel =
			typeof selectedOption?.label === "string"
				? selectedOption.label.trim()
				: "";
		const showImportLicenseDescription =
			code.length > 0 &&
			selectedFullLabel.length > 0 &&
			selectedFullLabel !== code;

		const selectTitle =
			rowLockReason ??
			(selectedFullLabel.length > 0
				? selectedFullLabel
				: code.length > 0
					? code
					: undefined);

		const descriptionText = showImportLicenseDescription
			? selectedFullLabel
			: "";

		return (
			<div key={`il-${index}`} className="flex flex-col gap-0">
				<div className="flex items-center gap-1">
					<span className="w-[16px] shrink-0 text-right text-[12px] text-black">
						{index + 1}
					</span>
					<select
						value={code}
						onPointerDown={markPendingNativeSelectInteraction}
						onChange={(event) => {
							updateImportLicenseSlot(
								index,
								buildImportLicenseSlotValue(event.target.value, number),
							);
							finalizeNativeSelectInteraction();
						}}
						onBlur={finalizeNativeSelectInteraction}
						disabled={isRowDisabled}
						title={selectTitle}
						className={cn(
							ecusTableInputCls,
							"w-[72px] min-w-[72px] shrink-0 appearance-auto bg-white px-1 pr-5 text-center [text-align-last:center]",
							isRowDisabled && ecusDisabledFieldCls,
						)}
					>
						<option value="" />
						{hasCurrentCodeOption ? null : code ? (
							<option value={code}>{code}</option>
						) : null}
						{importLicenseOptions.map((option) => (
							<option
								key={`import-license-${option.value}`}
								value={option.value}
								title={option.label}
							>
								{option.value}
							</option>
						))}
					</select>
					<button
						type="button"
						className={ecusTinyActionButtonCls}
						onClick={(event) => {
							stopCdsInteraction(event);
							handleOpenImportLicenseTypeLookup(index);
						}}
						disabled={isRowDisabled}
						title={rowLockReason ?? "Tra cứu mã giấy phép nhập khẩu"}
					>
						...
					</button>
					<BufferedInput
						value={number}
						onCommit={(nextValue) =>
							updateImportLicenseSlot(
								index,
								buildImportLicenseSlotValue(code, nextValue),
							)
						}
						suppressManualScrollRestore={suppressManualScrollRestore}
						disabled={isRowDisabled}
						title={rowLockReason ?? undefined}
						className={cn(
							ecusTableInputCls,
							"w-[180px] shrink-0 bg-white",
							isRowDisabled && ecusDisabledFieldCls,
						)}
					/>
				</div>
				<div
					className="ml-5 h-[14px] overflow-hidden whitespace-nowrap text-ellipsis text-[10px] leading-[14px] text-slate-700"
					title={descriptionText || undefined}
					aria-hidden={descriptionText ? undefined : true}
				>
					{descriptionText || "\u00A0"}
				</div>
			</div>
		);
	};

	return (
		<div className="mt-2 mb-1">
			<div className="text-[12px] text-black mb-0.5">Giấy phép nhập khẩu:</div>
			<div className="ml-7 grid grid-cols-1 gap-y-0.5 sm:grid-cols-2 sm:gap-x-6 sm:max-w-[620px]">
				<div className="space-y-0.5">
					{leftColumnIndexes.map(renderImportLicenseSlot)}
				</div>
				<div className="space-y-0.5">
					{rightColumnIndexes.map(renderImportLicenseSlot)}
				</div>
			</div>
		</div>
	);
};

export const LegalDocumentSlots: React.FC<CdsCollectionTablesProps> = (
	props,
) => {
	const {
		data,
		ecusTableInputCls,
		ecusDisabledFieldCls,
		legalDocumentOptions,
		getLegalDocumentSlotLockReason,
		updateLegalDocumentSlot,
		handleOpenLegalDocumentCodeLookup,
		suppressManualScrollRestore: _suppressManualScrollRestore,
	} = props;

	const items = Array.isArray(data.otherLegalDocumentCodes)
		? data.otherLegalDocumentCodes
		: [];
	return (
		<div className="mt-2 mb-1">
			<div className="text-[12px] text-black mb-0.5">
				Mã văn bản pháp quy khác:
			</div>
			<div className="ml-7 flex flex-wrap items-center gap-x-2 gap-y-1">
				{FIVE_ROW_INDEXES.map((rowIndex) => {
					const rowLockReason = getLegalDocumentSlotLockReason(rowIndex);
					const isRowDisabled = rowLockReason !== null;
					const currentValue = String(items[rowIndex] ?? "");
					const hasCurrentOption =
						currentValue.length > 0 &&
						legalDocumentOptions.some(
							(option) => option.value === currentValue,
						);
					return (
						<div key={`ld-${rowIndex}`} className="flex items-center gap-0.5">
							<select
								value={currentValue}
								onPointerDown={markPendingNativeSelectInteraction}
								onChange={(event) => {
									updateLegalDocumentSlot(rowIndex, event.target.value || null);
									finalizeNativeSelectInteraction();
								}}
								onBlur={finalizeNativeSelectInteraction}
								disabled={isRowDisabled}
								title={rowLockReason ?? undefined}
								className={cn(
									ecusTableInputCls,
									"w-[62px] shrink-0 appearance-auto bg-white px-1 pr-5 text-center [text-align-last:center]",
									isRowDisabled && ecusDisabledFieldCls,
								)}
							>
								<option value="" />
								{hasCurrentOption ? null : currentValue ? (
									<option value={currentValue}>{currentValue}</option>
								) : null}
								{legalDocumentOptions.map((option) => (
									<option
										key={`legal-document-${rowIndex}-${option.value}`}
										value={option.value}
									>
										{option.label}
									</option>
								))}
							</select>
							<button
								type="button"
								onClick={(event) => {
									stopCdsInteraction(event);
									handleOpenLegalDocumentCodeLookup(rowIndex);
								}}
								disabled={isRowDisabled}
								title={rowLockReason ?? "Tra cứu mã văn bản pháp quy"}
								className={ecusTinyActionButtonCls}
							>
								...
							</button>
						</div>
					);
				})}
			</div>
		</div>
	);
};
