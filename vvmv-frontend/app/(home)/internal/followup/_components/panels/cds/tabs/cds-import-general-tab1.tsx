"use client";

import type { ReactNode } from "react";
import { isPersonOrganizationClassificationRequiredForOperationCode } from "@/lib/followup/cds-person-organization-classification";
import { cn } from "@/lib/utils";
import { BillItemsTable } from "../cds-collection-tables";
import { CdsImportExportBusinessAddressFields } from "../cds-import-export-business-address-fields";
import {
	ECUS_BUSINESS_GROUP_OPTIONS,
	resolveCdsBusinessTypeGroup,
} from "../cds-options";
import {
	exportClassicFormBodyCls,
	exportClassicPartyTitleCls,
	exportClassicSectionBodyCls,
	importPanelFrameCls,
} from "../cds-styles";
import type { CdsTabRenderProps } from "./cds-tab-props";

export function CdsImportGeneralTab1({
	data,
	handleFieldChange,
	suppressManualScrollRestore: _suppressManualScrollRestore,
	renderClassicLabel,
	renderInfoButton,
	renderExportSectionHeader,
	renderClassicDateInput,
	renderClassicInput,
	renderClassicSelect,
	renderClassicCodeLookupSelect,
	renderLookupCodeAndName,
	renderLookupPickerButton,
	getImportImage1FieldLockOptions,
	commonTableProps,
}: CdsTabRenderProps) {
	const sectionPrimaryLabelWidth = 176;
	const rowBaseLabelWidth = sectionPrimaryLabelWidth;
	const topLeftLabelWidth = 184;
	const topRightLabelWidth = 224;
	const partyLabelWidth = sectionPrimaryLabelWidth;
	const importTopGridCls =
		"grid w-full grid-cols-1 gap-x-6 gap-y-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]";
	const topLeftShortFieldBoxCls = "w-full sm:max-w-[220px]";
	const topRightShortFieldBoxCls = "w-full sm:max-w-[220px]";
	const topDateFieldBoxCls = "w-full sm:max-w-[220px]";
	const topLookupFieldBoxCls = "w-full sm:max-w-[520px]";
	const topLookupPickerFieldBoxCls =
		"flex w-full flex-wrap items-center gap-0.5 sm:max-w-[220px] sm:flex-nowrap";
	const shortFieldBoxCls = "w-full sm:max-w-[220px]";
	const mediumFieldBoxCls = "w-full sm:max-w-[320px]";
	const longFieldBoxCls = "w-full sm:max-w-[760px]";
	const lookupFieldBoxCls = "w-full sm:max-w-[520px]";
	const shortInlinePairCls =
		"grid w-full grid-cols-1 gap-1 sm:flex sm:max-w-[444px] sm:items-center";
	const shortInlineFieldCls = "w-full sm:w-[220px]";
	const lookupPickerButtonCls = "w-[24px] px-0";
	const shortPickerFieldBoxCls =
		"flex w-full flex-wrap items-center gap-0.5 sm:max-w-[220px] sm:flex-nowrap";
	const transportLookupFieldBoxCls =
		"flex w-full flex-wrap items-center gap-0.5 sm:max-w-[520px] sm:flex-nowrap";
	const topLookupCodeWidthCls = "w-[100px]";
	const compactLookupCodeWidthCls = "w-[100px]";
	const locationLookupCodeWidthCls = "w-[100px]";
	const transportCodeFieldCls = "w-full sm:w-[100px]";
	const tinyInlineFieldCls = "w-[48px] sm:w-[30px]";
	const exporterAddressGridCls = "grid grid-cols-1 gap-1 sm:grid-cols-2";
	const infoLinkButtonCls =
		"h-auto min-h-[22px] w-auto border-0 bg-transparent px-0 text-[11px] font-normal text-[#2b59c3] underline underline-offset-2 hover:bg-transparent disabled:!border-0 disabled:!bg-transparent disabled:!text-[#2b59c3]";
	const rightLaneContentCls = "flex justify-start";
	const checkboxInsetCls = "space-y-0.5 sm:pl-[184px]";
	const infoInsetCls = "pt-0.5 sm:pl-[184px]";
	const isPersonOrganizationClassificationRequired =
		isPersonOrganizationClassificationRequiredForOperationCode(
			data.operationCode,
		);
	const resolvedBusinessTypeGroup = resolveCdsBusinessTypeGroup(
		data.businessTypeGroup,
		data.operationCode,
	);

	const Row = ({
		label,
		required,
		children,
		labelWidth,
		className,
		alignTop,
		contentClassName,
	}: {
		label: string;
		required?: boolean;
		children: ReactNode;
		labelWidth?: number;
		className?: string;
		alignTop?: boolean;
		contentClassName?: string;
	}) => (
		<div
			className={cn(
				"flex min-h-[22px] flex-col gap-x-1.5 gap-y-1 sm:grid sm:gap-y-0.5",
				alignTop ? "items-start" : "sm:items-center",
				className,
			)}
			style={{
				gridTemplateColumns: `${labelWidth ?? rowBaseLabelWidth}px minmax(0, 1fr)`,
			}}
		>
			<div className="w-full pr-1 pt-px text-left leading-[16px] sm:pr-2">
				{renderClassicLabel(label, required)}
			</div>
			<div className={cn("min-w-0 flex-1", contentClassName)}>{children}</div>
		</div>
	);

	const RightRow = (props: {
		label: string;
		required?: boolean;
		children: ReactNode;
		labelWidth?: number;
		className?: string;
		alignTop?: boolean;
		contentClassName?: string;
	}) => (
		<Row
			{...props}
			contentClassName={cn(rightLaneContentCls, props.contentClassName)}
		/>
	);

	const TopRightRow = (props: {
		label: string;
		required?: boolean;
		children: ReactNode;
		labelWidth?: number;
		className?: string;
		alignTop?: boolean;
		contentClassName?: string;
	}) => <RightRow {...props} />;

	const SectionBlock = ({
		title,
		children,
	}: {
		title: string;
		children: ReactNode;
	}) => (
		<section className="pt-0.5">
			{renderExportSectionHeader(title)}
			<div className={exportClassicSectionBodyCls}>{children}</div>
		</section>
	);

	const PartyTitle = ({ children }: { children: ReactNode }) => (
		<div className={exportClassicPartyTitleCls}>{children}</div>
	);

	return (
		<div
			className="bg-[#efefef] px-0 py-1 pb-8"
			style={{ fontFamily: "Tahoma, Arial, sans-serif" }}
		>
			<div className={importPanelFrameCls}>
				<div className={exportClassicFormBodyCls}>
					<div className="space-y-1 px-[4px]">
						<div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#c7c7c7] pb-1 text-[11px]">
							<span className="font-semibold text-[#1e395b]">
								Nhóm loại hình:
							</span>
							{ECUS_BUSINESS_GROUP_OPTIONS.map((option) => (
								<label
									key={option.value}
									className="inline-flex items-center gap-1.5 text-black"
								>
									<input
										type="radio"
										name="businessTypeGroup"
										checked={resolvedBusinessTypeGroup === option.value}
										onChange={() =>
											handleFieldChange("businessTypeGroup", option.value)
										}
										className="h-3.5 w-3.5"
									/>
									<span>{option.label}</span>
								</label>
							))}
						</div>

						<div className={importTopGridCls}>
							<div className="space-y-1">
								<Row label="Số tờ khai" labelWidth={topLeftLabelWidth}>
									<div className={topLeftShortFieldBoxCls}>
										{renderClassicInput(
											"declarationNumber",
											undefined,
											undefined,
											getImportImage1FieldLockOptions("declarationNumber"),
										)}
									</div>
								</Row>

								<Row label="Số tờ khai đầu tiên" labelWidth={topLeftLabelWidth}>
									<div className="flex items-center gap-1">
										<div className={topLeftShortFieldBoxCls}>
											{renderClassicInput(
												"firstDeclarationNumber",
												undefined,
												undefined,
												getImportImage1FieldLockOptions(
													"firstDeclarationNumber",
												),
											)}
										</div>
										<span className="ml-1 text-[#1e395b]">Số nhánh:</span>
										<div className={tinyInlineFieldCls}>
											{renderClassicInput(
												"branchNumberPart1",
												undefined,
												undefined,
												getImportImage1FieldLockOptions("branchNumberPart1"),
											)}
										</div>
										<span className="text-slate-600">/</span>
										<div className={tinyInlineFieldCls}>
											{renderClassicInput(
												"branchNumberPart2",
												undefined,
												undefined,
												getImportImage1FieldLockOptions("branchNumberPart2"),
											)}
										</div>
									</div>
								</Row>

								<Row
									label="Mã loại hình"
									required
									labelWidth={topLeftLabelWidth}
								>
									<div className={topLookupFieldBoxCls}>
										{renderLookupCodeAndName("operationCode", undefined, {
											codeWidthClassName: topLookupCodeWidthCls,
										})}
									</div>
								</Row>

								<Row
									label="Cơ quan Hải quan"
									required
									labelWidth={topLeftLabelWidth}
								>
									<div className={topLookupFieldBoxCls}>
										{renderLookupCodeAndName("customsCode", undefined, {
											codeWidthClassName: topLookupCodeWidthCls,
										})}
									</div>
								</Row>

								<Row
									label="Ngày khai báo dự kiến (nếu có)"
									labelWidth={topLeftLabelWidth}
								>
									<div className={topDateFieldBoxCls}>
										{renderClassicDateInput("expectedDeclarationDate")}
									</div>
								</Row>

								<Row label="Thời hạn tái xuất" labelWidth={topLeftLabelWidth}>
									<div className={topDateFieldBoxCls}>
										{renderClassicDateInput("reExportDeadline")}
									</div>
								</Row>
							</div>

							<div className="space-y-1">
								<TopRightRow label="STT" labelWidth={topRightLabelWidth}>
									<div className={topRightShortFieldBoxCls}>
										{renderClassicInput(
											"declarationSequenceNumber",
											undefined,
											undefined,
											getImportImage1FieldLockOptions(
												"declarationSequenceNumber",
											),
										)}
									</div>
								</TopRightRow>

								<TopRightRow
									label="Số TK tạm nhập tái xuất tương ứng"
									labelWidth={topRightLabelWidth}
								>
									<div className={topLookupPickerFieldBoxCls}>
										<div className="min-w-0 flex-1">
											{renderClassicInput("correspondingDeclarationNumber")}
										</div>
										{renderLookupPickerButton(
											"correspondingDeclarationNumber",
											{
												className: lookupPickerButtonCls,
											},
										)}
									</div>
								</TopRightRow>

								<TopRightRow
									label="Mã phân loại hàng hóa"
									labelWidth={topRightLabelWidth}
								>
									<div className={topRightShortFieldBoxCls}>
										{renderClassicSelect(
											"cargoClassificationCode",
											undefined,
											getImportImage1FieldLockOptions(
												"cargoClassificationCode",
											),
										)}
									</div>
								</TopRightRow>

								<TopRightRow
									label="Phân loại cá nhân/tổ chức"
									required={isPersonOrganizationClassificationRequired}
									labelWidth={topRightLabelWidth}
								>
									<div className={topRightShortFieldBoxCls}>
										{renderClassicSelect("personOrganizationClassification")}
									</div>
								</TopRightRow>

								<TopRightRow
									label="Mã bộ phận xử lý tờ khai"
									labelWidth={topRightLabelWidth}
								>
									<div className={topRightShortFieldBoxCls}>
										{renderClassicSelect("declarationProcessingDeptCode")}
									</div>
								</TopRightRow>

								<TopRightRow
									label="Mã hiệu phương thức vận chuyển"
									required
									labelWidth={topRightLabelWidth}
								>
									<div className={topRightShortFieldBoxCls}>
										{renderClassicSelect("transportMethodCode")}
									</div>
								</TopRightRow>
							</div>
						</div>
					</div>

					<SectionBlock title="Đơn vị xuất nhập khẩu">
						<div className="space-y-2.5">
							<div className="space-y-1">
								<PartyTitle>Người nhập khẩu</PartyTitle>
								<Row label="Mã" labelWidth={partyLabelWidth}>
									<div className={shortFieldBoxCls}>
										{renderClassicInput(
											"importerCode",
											undefined,
											undefined,
											getImportImage1FieldLockOptions("importerCode"),
										)}
									</div>
								</Row>
								<Row label="Tên" labelWidth={partyLabelWidth}>
									<div className={longFieldBoxCls}>
										{renderClassicInput("importExportUnitName")}
									</div>
								</Row>
								<Row label="Mã bưu chính" labelWidth={partyLabelWidth}>
									<div className={shortFieldBoxCls}>
										{renderClassicInput("importerPostalCode")}
									</div>
								</Row>
								<Row label="Địa chỉ" labelWidth={partyLabelWidth} alignTop>
									<div className={longFieldBoxCls}>
										<CdsImportExportBusinessAddressFields
											value={data.importExportBusinessAddress}
											singleLine
											onCommit={(nextValue) =>
												handleFieldChange(
													"importExportBusinessAddress",
													nextValue,
												)
											}
										/>
									</div>
								</Row>
								<Row label="Điện thoại" labelWidth={partyLabelWidth}>
									<div className={shortFieldBoxCls}>
										{renderClassicInput("importerPhone")}
									</div>
								</Row>
							</div>

							<div className="space-y-1">
								<PartyTitle>Người ủy thác nhập khẩu</PartyTitle>
								<Row label="Mã" labelWidth={partyLabelWidth}>
									<div className={shortFieldBoxCls}>
										{renderClassicInput("entrustedImporterCode")}
									</div>
								</Row>
								<Row label="Tên" labelWidth={partyLabelWidth}>
									<div className={longFieldBoxCls}>
										{renderClassicInput("entrustedImporterName")}
									</div>
								</Row>
							</div>

							<div className="space-y-1">
								<PartyTitle>Người xuất khẩu</PartyTitle>
								<Row label="Mã" labelWidth={partyLabelWidth}>
									<div className={shortPickerFieldBoxCls}>
										<div className="flex-1">
											{renderClassicInput("exporterCode")}
										</div>
										{renderLookupPickerButton("exporterCode", {
											className: lookupPickerButtonCls,
										})}
									</div>
								</Row>
								<Row label="Tên" required labelWidth={partyLabelWidth}>
									<div className={longFieldBoxCls}>
										{renderClassicInput("partnerName")}
									</div>
								</Row>
								<Row label="Mã bưu chính" labelWidth={partyLabelWidth}>
									<div className={shortFieldBoxCls}>
										{renderClassicInput("exporterPostalCode")}
									</div>
								</Row>
								<Row
									label="Địa chỉ"
									required
									labelWidth={partyLabelWidth}
									alignTop
								>
									<div className={cn(longFieldBoxCls, exporterAddressGridCls)}>
										{renderClassicInput("partnerAddress1")}
										{renderClassicInput("partnerAddress2")}
										{renderClassicInput("partnerAddress3")}
										{renderClassicInput("partnerAddress4")}
									</div>
								</Row>
								<Row label="Mã nước" labelWidth={partyLabelWidth}>
									<div className={mediumFieldBoxCls}>
										{renderClassicCodeLookupSelect("exportCountryCode", {
											codeWidthClassName: compactLookupCodeWidthCls,
										})}
									</div>
								</Row>
								<Row
									label="Người ủy thác xuất khẩu"
									labelWidth={partyLabelWidth}
								>
									<div className={longFieldBoxCls}>
										{renderClassicInput("entrustedExporterName")}
									</div>
								</Row>
								<Row label="Mã người khai HQ" labelWidth={partyLabelWidth}>
									<div className={shortFieldBoxCls}>
										{renderClassicInput("customsDeclarantCode")}
									</div>
								</Row>
							</div>
						</div>
					</SectionBlock>

					<SectionBlock title="Vận đơn">
						<div className="space-y-1.5">
							<div className={checkboxInsetCls}>
								<label className="flex items-start gap-1.5 text-[12px] text-black cursor-pointer">
									<input
										type="checkbox"
										checked={!!data.seaportSupervisionEnabled}
										onChange={(event) =>
											handleFieldChange(
												"seaportSupervisionEnabled",
												event.target.checked,
											)
										}
										className="mt-0.5 h-3 w-3 shrink-0"
									/>
									<span>
										Khai báo số định danh theo chuẩn quản lý giám sát Hải quan
										tự động tại Cảng biển.
									</span>
								</label>
								<label className="flex items-start gap-1.5 text-[12px] text-black cursor-pointer">
									<input
										type="checkbox"
										checked={!!data.airportSupervisionEnabled}
										onChange={(event) =>
											handleFieldChange(
												"airportSupervisionEnabled",
												event.target.checked,
											)
										}
										className="mt-0.5 h-3 w-3 shrink-0"
									/>
									<span>
										Khai báo số định danh theo chuẩn quản lý giám sát Hải quan
										tự động tại Cảng hàng không
									</span>
								</label>
							</div>

							<BillItemsTable {...commonTableProps} />

							<div className={infoInsetCls}>
								{renderInfoButton(
									"Ngày vận đơn chi tiết hiện chưa bật riêng trên màn nhập khẩu, nên chỉ hiển thị dạng link tham chiếu giống ECUS.",
									{
										ariaLabel:
											"Khai báo thông tin ngày vận đơn trong chi tiết trị giá",
										buttonLabel:
											"Khai báo thông tin ngày vận đơn trong chi tiết trị giá",
										className: infoLinkButtonCls,
									},
								)}
							</div>

							<div className={importTopGridCls}>
								<Row
									label="Số lượng kiện"
									required
									labelWidth={sectionPrimaryLabelWidth}
								>
									<div className={shortInlinePairCls}>
										<div className={shortInlineFieldCls}>
											{renderClassicInput("packageQuantity")}
										</div>
										<div className={shortInlineFieldCls}>
											{renderClassicSelect("packageType")}
										</div>
									</div>
								</Row>
								<RightRow
									label="Tổng trọng lượng hàng (Gross)"
									labelWidth={sectionPrimaryLabelWidth}
								>
									<div className={shortInlinePairCls}>
										<div className={shortInlineFieldCls}>
											{renderClassicInput("grossWeightTotal")}
										</div>
										<div className={shortInlineFieldCls}>
											{renderClassicSelect("weightUnit")}
										</div>
									</div>
								</RightRow>
							</div>

							<Row
								label="Mã địa điểm lưu kho hàng chờ thông quan dự kiến"
								labelWidth={sectionPrimaryLabelWidth}
								alignTop
							>
								<div className={lookupFieldBoxCls}>
									{renderClassicCodeLookupSelect("warehouseLocationCode", {
										codeWidthClassName: locationLookupCodeWidthCls,
									})}
								</div>
							</Row>

							<Row
								label="Ký hiệu và số hiệu bao bì"
								labelWidth={sectionPrimaryLabelWidth}
							>
								<div className={longFieldBoxCls}>
									{renderClassicInput("packageMarks")}
								</div>
							</Row>

							<Row
								label="Phương tiện vận chuyển"
								labelWidth={sectionPrimaryLabelWidth}
							>
								<div className={transportLookupFieldBoxCls}>
									<div className={transportCodeFieldCls}>
										{renderClassicInput("transportVehicleCode")}
									</div>
									<div className="min-w-0 flex-1">
										{renderClassicInput("transportVehicleName")}
									</div>
								</div>
							</Row>

							<Row label="Ngày hàng đến" labelWidth={sectionPrimaryLabelWidth}>
								<div className={shortFieldBoxCls}>
									{renderClassicDateInput("departureArrivalDate")}
								</div>
							</Row>

							<Row
								label="Địa điểm dỡ hàng"
								labelWidth={sectionPrimaryLabelWidth}
							>
								<div className={lookupFieldBoxCls}>
									{renderClassicCodeLookupSelect("unloadingLocationCode", {
										codeWidthClassName: locationLookupCodeWidthCls,
									})}
								</div>
							</Row>

							<Row
								label="Địa điểm xếp hàng"
								required
								labelWidth={sectionPrimaryLabelWidth}
							>
								<div className={lookupFieldBoxCls}>
									{renderClassicCodeLookupSelect("loadingLocationCode", {
										codeWidthClassName: locationLookupCodeWidthCls,
									})}
								</div>
							</Row>

							<Row
								label="Số lượng Container"
								labelWidth={sectionPrimaryLabelWidth}
							>
								<div className={shortFieldBoxCls}>
									{renderClassicInput("containerQuantity")}
								</div>
							</Row>

							<Row
								label="Mã kết quả kiểm tra nội dung"
								labelWidth={sectionPrimaryLabelWidth}
							>
								<div className={mediumFieldBoxCls}>
									{renderClassicCodeLookupSelect("inspectionResultCode", {
										codeWidthClassName: compactLookupCodeWidthCls,
										showButton: false,
									})}
								</div>
							</Row>
						</div>
					</SectionBlock>
				</div>
			</div>
		</div>
	);
}
