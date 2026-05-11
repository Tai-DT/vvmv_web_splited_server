"use client";

import { FilePlus2, FileText, Printer, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { BufferedTextarea } from "../cds-classic-ui";
import {
	ElectronicAttachmentsTable,
	ExportLicenseDocumentTable,
	TransportSchedulesTable,
	transportScheduleGridCls,
} from "../cds-collection-tables";
import { CdsImportExportBusinessAddressFields } from "../cds-import-export-business-address-fields";
import {
	ECUS_BUSINESS_GROUP_OPTIONS,
	resolveCdsBusinessTypeGroup,
} from "../cds-options";
import {
	exportClassicFormBodyCls,
	exportClassicPanelFrameCls,
	exportClassicPartyTitleCls,
	exportClassicSectionBodyCls,
	exportClassicTopGridCls,
} from "../cds-styles";
import type { CdsTabRenderProps } from "./cds-tab-props";

export function CdsExportGeneralTab({
	data,
	handleFieldChange,
	suppressManualScrollRestore,
	renderClassicLabel,
	renderClassicDateInput,
	renderClassicInput,
	renderClassicReadonlyInput,
	renderClassicSelect,
	renderClassicCodeLookupSelect,
	renderLookupCodeAndName,
	renderLookupPickerButton,
	renderInfoButton,
	renderExportSectionHeader,
	getExportFieldLockOptions,
	valuationAllocationRatioTotal,
	commonTableProps,
}: CdsTabRenderProps) {
	const classicTextareaCls =
		"min-h-[40px] resize-none rounded-none border border-slate-500 bg-white px-1 py-0.5 text-[11px] text-slate-900 shadow-none outline-none focus-visible:ring-0 focus:border-sky-700 leading-[16px]";
	const compactSectionGridCls =
		"grid w-full grid-cols-1 gap-x-6 gap-y-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]";
	const taxTripleGridCls =
		"grid w-full grid-cols-1 gap-x-4 gap-y-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]";
	const billDualGridCls =
		"grid w-full grid-cols-1 gap-x-6 gap-y-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]";
	const contractDatesGridCls =
		"grid w-full grid-cols-1 gap-x-6 gap-y-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]";
	const sectionInsetCls = "";
	const sectionPrimaryLabelWidth = "sm:w-[188px]";
	const rowBaseLabelWidth = sectionPrimaryLabelWidth;
	const topLeftLabelWidth = sectionPrimaryLabelWidth;
	const topRightLabelWidth = sectionPrimaryLabelWidth;
	const sectionSecondaryLabelWidth = sectionPrimaryLabelWidth;
	const sectionTertiaryLabelWidth = "sm:w-[160px]";
	const partyLabelWidth = sectionPrimaryLabelWidth;
	const contractLabelWidth = sectionPrimaryLabelWidth;
	const partyShortFieldBoxCls = "w-full sm:max-w-[220px]";
	const partyLongFieldBoxCls = "w-full sm:max-w-[760px]";
	const partyCountryFieldBoxCls = "w-full sm:max-w-[320px]";
	const lookupFieldBoxCls = "w-full sm:max-w-[520px]";
	const wideLookupFieldBoxCls = "w-full sm:max-w-[520px]";
	const taxLookupFieldBoxCls = "w-full sm:max-w-[640px]";
	const taxDeadlineFieldBoxCls = "w-full sm:max-w-[640px]";
	const mediumFieldBoxCls = "w-full sm:max-w-[520px]";
	const shortFieldBoxCls = partyShortFieldBoxCls;
	const dateFieldBoxCls = shortFieldBoxCls;
	const tripleFieldBoxCls = "w-full";
	const mediumShortFieldBoxCls = partyCountryFieldBoxCls;
	const partyShortPickerFieldBoxCls =
		"flex w-full flex-wrap items-center gap-0.5 sm:max-w-[220px] sm:flex-nowrap";
	const topShortPickerFieldBoxCls = partyShortPickerFieldBoxCls;
	const multiPartFieldGroupCls = "flex w-full flex-wrap items-center gap-1";
	const shortInlinePairCls =
		"grid w-full grid-cols-1 gap-1 sm:flex sm:max-w-[444px] sm:items-center";
	const shortInlineFieldCls = "w-full sm:w-[220px]";
	const tinyInlineFieldCls = "w-[48px] sm:w-[30px]";
	const lookupPickerButtonCls = "w-[24px] px-0";
	const transportLookupFieldBoxCls =
		"flex w-full flex-wrap items-center gap-0.5 sm:max-w-[520px] sm:flex-nowrap";
	const transportCodeFieldCls = "w-full sm:w-[100px]";
	const bankCodeFieldWidthCls = "w-[100px]";
	const rightLaneContentCls = "flex justify-start";

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
		children: React.ReactNode;
		labelWidth?: string;
		className?: string;
		alignTop?: boolean;
		contentClassName?: string;
	}) => (
		<div
			className={cn(
				"flex min-h-[22px] flex-col gap-x-1.5 gap-y-1 sm:flex-row sm:gap-y-0.5",
				alignTop ? "items-start" : "sm:items-center",
				className,
			)}
		>
			<div
				className={cn(
					"w-full pr-1 pt-px text-left leading-[16px] sm:shrink-0",
					labelWidth ?? rowBaseLabelWidth,
				)}
			>
				{renderClassicLabel(label, required)}
			</div>
			<div className={cn("min-w-0 flex-1", contentClassName)}>{children}</div>
		</div>
	);

	const RightRow = ({
		contentClassName,
		...props
	}: {
		label: string;
		required?: boolean;
		children: React.ReactNode;
		labelWidth?: string;
		className?: string;
		alignTop?: boolean;
		contentClassName?: string;
	}) => (
		<Row
			{...props}
			contentClassName={cn(rightLaneContentCls, contentClassName)}
		/>
	);

	const SectionBlock = ({
		title,
		children,
		className,
	}: {
		title: string;
		children: React.ReactNode;
		className?: string;
	}) => (
		<section className={cn("pt-0.5", className)}>
			{renderExportSectionHeader(title)}
			<div className={exportClassicSectionBodyCls}>{children}</div>
		</section>
	);

	const PartyTitle = ({ children }: { children: React.ReactNode }) => (
		<div className={exportClassicPartyTitleCls}>{children}</div>
	);
	const resolvedBusinessTypeGroup = resolveCdsBusinessTypeGroup(
		data.businessTypeGroup,
		data.operationCode,
	);

	return (
		<div
			className="bg-[#efefef] px-0 py-1 pb-8"
			style={{ fontFamily: "Tahoma, Arial, sans-serif" }}
		>
			<div className={exportClassicPanelFrameCls}>
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
										className="h-3 w-3"
									/>
									<span>{option.label}</span>
								</label>
							))}
						</div>

						<div className={exportClassicTopGridCls}>
							<div className="space-y-1">
								<Row label="Số tờ khai" labelWidth={topLeftLabelWidth}>
									<div className={shortFieldBoxCls}>
										{renderClassicInput(
											"declarationNumber",
											undefined,
											undefined,
											getExportFieldLockOptions("declarationNumber"),
										)}
									</div>
								</Row>

								<Row label="Số tờ khai đầu tiên" labelWidth={topLeftLabelWidth}>
									<div className={multiPartFieldGroupCls}>
										<div className={shortInlineFieldCls}>
											{renderClassicInput(
												"firstDeclarationNumber",
												undefined,
												undefined,
												getExportFieldLockOptions("firstDeclarationNumber"),
											)}
										</div>
										<span className="ml-1 text-[#1e395b]">Số nhánh:</span>
										<div className={tinyInlineFieldCls}>
											{renderClassicInput(
												"branchNumberPart1",
												undefined,
												undefined,
												getExportFieldLockOptions("branchNumberPart1"),
											)}
										</div>
										<span className="text-slate-600">/</span>
										<div className={tinyInlineFieldCls}>
											{renderClassicInput(
												"branchNumberPart2",
												undefined,
												undefined,
												getExportFieldLockOptions("branchNumberPart2"),
											)}
										</div>
									</div>
								</Row>

								<Row
									label="Mã loại hình"
									required
									labelWidth={topLeftLabelWidth}
								>
									<div className={lookupFieldBoxCls}>
										{renderLookupCodeAndName("operationCode")}
									</div>
								</Row>

								<Row
									label="Cơ quan Hải quan"
									required
									labelWidth={topLeftLabelWidth}
								>
									<div className={lookupFieldBoxCls}>
										{renderLookupCodeAndName("customsCode")}
									</div>
								</Row>

								<Row
									label="Thời hạn tái nhập khẩu"
									labelWidth={topLeftLabelWidth}
								>
									<div className={dateFieldBoxCls}>
										{renderClassicDateInput("reExportDeadline")}
									</div>
								</Row>

								<Row
									label="Ngày khai báo dự kiến (nếu có)"
									labelWidth={topLeftLabelWidth}
								>
									<div className={dateFieldBoxCls}>
										{renderClassicDateInput("expectedDeclarationDate")}
									</div>
								</Row>
							</div>

							<div className="space-y-1">
								<RightRow label="STT" labelWidth={topRightLabelWidth}>
									<div className={shortFieldBoxCls}>
										{renderClassicInput(
											"declarationSequenceNumber",
											undefined,
											undefined,
											getExportFieldLockOptions("declarationSequenceNumber"),
										)}
									</div>
								</RightRow>

								<RightRow
									label="Số tờ khai tạm nhập tái xuất tương ứng"
									labelWidth={topRightLabelWidth}
								>
									<div className={topShortPickerFieldBoxCls}>
										<div className="flex-1">
											{renderClassicInput("correspondingDeclarationNumber")}
										</div>
										{renderLookupPickerButton(
											"correspondingDeclarationNumber",
											{
												className: lookupPickerButtonCls,
											},
										)}
									</div>
								</RightRow>

								<RightRow
									label="Mã phân loại hàng hóa"
									labelWidth={topRightLabelWidth}
								>
									<div className={shortFieldBoxCls}>
										{renderClassicSelect(
											"cargoClassificationCode",
											undefined,
											getExportFieldLockOptions("cargoClassificationCode"),
										)}
									</div>
								</RightRow>

								<RightRow
									label="Mã bộ phận xử lý tờ khai"
									labelWidth={topRightLabelWidth}
								>
									<div className={shortFieldBoxCls}>
										{renderClassicSelect("declarationProcessingDeptCode")}
									</div>
								</RightRow>

								<RightRow
									label="Mã hiệu phương thức vận chuyển"
									required
									labelWidth={topRightLabelWidth}
								>
									<div className={shortFieldBoxCls}>
										{renderClassicSelect("transportMethodCode")}
									</div>
								</RightRow>
							</div>
						</div>
					</div>

					<SectionBlock title="Đơn vị xuất nhập khẩu">
						<div className="space-y-2.5">
							<div className="space-y-1">
								<PartyTitle>Người xuất khẩu</PartyTitle>
								<Row
									label="Mã"
									labelWidth={partyLabelWidth}
									className={sectionInsetCls}
								>
									<div className={partyShortFieldBoxCls}>
										{renderClassicInput(
											"importerCode",
											undefined,
											undefined,
											getExportFieldLockOptions("importerCode"),
										)}
									</div>
								</Row>
								<Row
									label="Tên"
									labelWidth={partyLabelWidth}
									className={sectionInsetCls}
								>
									<div className={partyLongFieldBoxCls}>
										{renderClassicInput("importExportUnitName")}
									</div>
								</Row>
								<Row
									label="Mã bưu chính"
									labelWidth={partyLabelWidth}
									className={sectionInsetCls}
								>
									<div className={partyShortFieldBoxCls}>
										{renderClassicInput("importerPostalCode")}
									</div>
								</Row>
								<Row
									label="Địa chỉ"
									labelWidth={partyLabelWidth}
									alignTop
									className={sectionInsetCls}
								>
									<div className={partyLongFieldBoxCls}>
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
								<Row
									label="Điện thoại"
									labelWidth={partyLabelWidth}
									className={sectionInsetCls}
								>
									<div className={partyShortFieldBoxCls}>
										{renderClassicInput("importerPhone")}
									</div>
								</Row>
							</div>

							<div className="space-y-1">
								<PartyTitle>Người ủy thác xuất khẩu</PartyTitle>
								<Row
									label="Mã"
									labelWidth={partyLabelWidth}
									className={sectionInsetCls}
								>
									<div className={partyShortFieldBoxCls}>
										{renderClassicInput("entrustedImporterCode")}
									</div>
								</Row>
								<Row
									label="Tên"
									labelWidth={partyLabelWidth}
									className={sectionInsetCls}
								>
									<div className={partyLongFieldBoxCls}>
										{renderClassicInput("entrustedImporterName")}
									</div>
								</Row>
							</div>

							<div className="space-y-1">
								<PartyTitle>Người nhập khẩu</PartyTitle>
								<Row
									label="Mã"
									labelWidth={partyLabelWidth}
									className={sectionInsetCls}
								>
									<div className={partyShortPickerFieldBoxCls}>
										<div className="flex-1">
											{renderClassicInput("exporterCode")}
										</div>
										{renderLookupPickerButton("exporterCode", {
											className: lookupPickerButtonCls,
										})}
									</div>
								</Row>
								<Row
									label="Tên"
									required
									labelWidth={partyLabelWidth}
									className={sectionInsetCls}
								>
									<div className={partyLongFieldBoxCls}>
										{renderClassicInput("partnerName")}
									</div>
								</Row>
								<Row
									label="Mã bưu chính"
									labelWidth={partyLabelWidth}
									className={sectionInsetCls}
								>
									<div className={partyShortFieldBoxCls}>
										{renderClassicInput("exporterPostalCode")}
									</div>
								</Row>
								<Row
									label="Địa chỉ"
									required
									labelWidth={partyLabelWidth}
									alignTop
									className={sectionInsetCls}
								>
									<div
										className={cn(
											partyLongFieldBoxCls,
											"grid grid-cols-1 gap-1 sm:grid-cols-2",
										)}
									>
										{renderClassicInput("partnerAddress1")}
										{renderClassicInput("partnerAddress2")}
										{renderClassicInput("partnerAddress3")}
										{renderClassicInput("partnerAddress4")}
									</div>
								</Row>
								<Row
									label="Mã nước"
									labelWidth={partyLabelWidth}
									className={sectionInsetCls}
								>
									<div className={partyCountryFieldBoxCls}>
										{renderClassicCodeLookupSelect("exportCountryCode")}
									</div>
								</Row>
								<Row
									label="Mã người khai Hải quan"
									labelWidth={partyLabelWidth}
									className={sectionInsetCls}
								>
									<div className={partyShortFieldBoxCls}>
										{renderClassicInput("customsDeclarantCode")}
									</div>
								</Row>
							</div>
						</div>
					</SectionBlock>

					<SectionBlock title="Vận đơn">
						<div className="space-y-1.5">
							<Row
								label="Số vận đơn"
								labelWidth={sectionPrimaryLabelWidth}
								className={sectionInsetCls}
							>
								<div className="flex flex-wrap items-center gap-1">
									<div className={shortFieldBoxCls}>
										{renderClassicInput("billOfLading")}
									</div>
									{renderInfoButton(
										"Số vận đơn hiện nhập trực tiếp hoặc lấy từ dữ liệu đã nạp.",
										{
											ariaLabel: "Chọn số vận đơn",
											icon: <Search aria-hidden="true" className="size-3.5" />,
											className: "h-[22px] w-[24px] px-0",
										},
									)}
									{renderInfoButton(
										"Đăng ký vận đơn riêng trong web chưa bật cho màn này.",
										{
											ariaLabel: "Đăng ký vận đơn",
											icon: (
												<FilePlus2 aria-hidden="true" className="size-3.5" />
											),
											className: "h-[22px] w-[24px] px-0",
										},
									)}
									{renderInfoButton(
										"In định danh chưa được bật cho màn tờ khai xuất khẩu.",
										{
											ariaLabel: "In định danh vận đơn",
											icon: <Printer aria-hidden="true" className="size-3.5" />,
											className: "h-[22px] w-[24px] px-0",
										},
									)}
								</div>
							</Row>

							<div className={billDualGridCls}>
								<Row
									label="Số lượng kiện"
									required
									labelWidth={sectionPrimaryLabelWidth}
									className={sectionInsetCls}
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
								className={sectionInsetCls}
							>
								<div className={lookupFieldBoxCls}>
									{renderClassicCodeLookupSelect("warehouseLocationCode")}
								</div>
							</Row>

							<Row
								label="Địa điểm nhận hàng cuối cùng"
								required
								labelWidth={sectionPrimaryLabelWidth}
								className={sectionInsetCls}
							>
								<div className={wideLookupFieldBoxCls}>
									{renderClassicCodeLookupSelect("unloadingLocationCode", {
										codeWidthClassName: bankCodeFieldWidthCls,
									})}
								</div>
							</Row>

							<Row
								label="Địa điểm xếp hàng"
								labelWidth={sectionPrimaryLabelWidth}
								className={sectionInsetCls}
							>
								<div className={wideLookupFieldBoxCls}>
									{renderClassicCodeLookupSelect("loadingLocationCode", {
										codeWidthClassName: bankCodeFieldWidthCls,
									})}
								</div>
							</Row>

							<Row
								label="Phương tiện vận chuyển"
								labelWidth={sectionPrimaryLabelWidth}
								className={sectionInsetCls}
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

							<Row
								label="Ngày hàng đi dự kiến"
								required
								labelWidth={sectionPrimaryLabelWidth}
								className={sectionInsetCls}
							>
								<div className={dateFieldBoxCls}>
									{renderClassicDateInput("departureDate")}
								</div>
							</Row>

							<Row
								label="Ký hiệu và số hiệu"
								labelWidth={sectionPrimaryLabelWidth}
								className={sectionInsetCls}
								alignTop
							>
								<div className={mediumFieldBoxCls}>
									<BufferedTextarea
										value={String(data.packageMarks ?? "")}
										onCommit={(nextValue) =>
											handleFieldChange("packageMarks", nextValue)
										}
										suppressManualScrollRestore={suppressManualScrollRestore}
										rows={2}
										className={classicTextareaCls}
									/>
								</div>
							</Row>
						</div>
					</SectionBlock>

					<SectionBlock title="Thông tin hợp đồng">
						<div className="space-y-[3px]">
							<Row label="Số hợp đồng" labelWidth={contractLabelWidth}>
								<div className="flex flex-wrap items-center justify-start gap-3">
									<div className={shortFieldBoxCls}>
										{renderClassicInput("contractNumber")}
									</div>
									{renderInfoButton(
										"Khai báo thông tin hợp đồng theo yêu cầu của Hải quan chưa được bật cho màn tờ khai xuất khẩu.",
										{
											ariaLabel:
												"Khai báo thông tin HĐ theo yêu cầu của Hải quan",
											icon: (
												<FileText aria-hidden="true" className="size-3.5" />
											),
											className: "h-[22px] w-[24px] px-0",
										},
									)}
								</div>
							</Row>

							<div className={contractDatesGridCls}>
								<Row label="Ngày hợp đồng" labelWidth={contractLabelWidth}>
									<div className={dateFieldBoxCls}>
										{renderClassicDateInput("contractDate")}
									</div>
								</Row>
								<RightRow label="Ngày hết hạn" labelWidth={contractLabelWidth}>
									<div className={dateFieldBoxCls}>
										{renderClassicDateInput("contractGoodsDate")}
									</div>
								</RightRow>
							</div>
						</div>
					</SectionBlock>

					<SectionBlock title="Chứng từ giấy phép">
						<ExportLicenseDocumentTable {...commonTableProps} />
					</SectionBlock>

					<SectionBlock title="Thông tin hóa đơn">
						<div className="space-y-[3px]">
							<Row
								label="Phân loại hình thức hóa đơn"
								labelWidth={sectionPrimaryLabelWidth}
							>
								<div className={shortFieldBoxCls}>
									{renderClassicSelect("invoiceFormClassificationCode")}
								</div>
							</Row>

							<div className={compactSectionGridCls}>
								<Row
									label="Số tiếp nhận hóa đơn điện tử"
									labelWidth={sectionPrimaryLabelWidth}
								>
									<div className={shortFieldBoxCls}>
										{renderClassicInput("electronicInvoiceReceiptNumber")}
									</div>
								</Row>
								<RightRow
									label="Số hóa đơn"
									labelWidth={sectionSecondaryLabelWidth}
								>
									<div className={shortFieldBoxCls}>
										{renderClassicInput("commercialInvoice")}
									</div>
								</RightRow>
							</div>

							<div className={compactSectionGridCls}>
								<Row
									label="Ngày phát hành"
									labelWidth={sectionPrimaryLabelWidth}
								>
									<div className={dateFieldBoxCls}>
										{renderClassicDateInput("commercialInvoiceDate")}
									</div>
								</Row>
								<RightRow
									label="Phương thức thanh toán"
									labelWidth={sectionSecondaryLabelWidth}
								>
									<div className={shortFieldBoxCls}>
										{renderClassicSelect("paymentMethod")}
									</div>
								</RightRow>
							</div>

							<div className={compactSectionGridCls}>
								<Row
									label="Mã phân loại giá hóa đơn"
									required
									labelWidth={sectionPrimaryLabelWidth}
								>
									<div className={shortFieldBoxCls}>
										{renderClassicSelect("invoiceClassificationCode")}
									</div>
								</Row>
								<RightRow
									label="Điều kiện giá hóa đơn"
									required
									labelWidth={sectionSecondaryLabelWidth}
								>
									<div className={shortFieldBoxCls}>
										{renderClassicSelect("invoicePriceCondition")}
									</div>
								</RightRow>
							</div>

							<div className={compactSectionGridCls}>
								<Row
									label="Tổng trị giá hóa đơn"
									required
									labelWidth={sectionPrimaryLabelWidth}
								>
									<div className={shortFieldBoxCls}>
										{renderClassicInput("totalInvoiceValue")}
									</div>
								</Row>
								<RightRow
									label="Mã đồng tiền của hóa đơn"
									required
									labelWidth={sectionSecondaryLabelWidth}
								>
									<div className={shortFieldBoxCls}>
										{renderClassicSelect("invoiceCurrency")}
									</div>
								</RightRow>
							</div>

							<div className={compactSectionGridCls}>
								<Row
									label="Trị giá tính thuế"
									labelWidth={sectionPrimaryLabelWidth}
								>
									<div className={shortFieldBoxCls}>
										{renderClassicInput("totalTaxableValue")}
									</div>
								</Row>
								<RightRow
									label="Mã đồng tiền trị giá tính thuế"
									labelWidth={sectionSecondaryLabelWidth}
								>
									<div className={shortFieldBoxCls}>
										{renderClassicSelect("taxableValueCurrencyCode")}
									</div>
								</RightRow>
							</div>
						</div>
					</SectionBlock>

					<SectionBlock title="Thuế và bảo lãnh">
						<div className="space-y-[3px]">
							<div className={compactSectionGridCls}>
								<Row
									label="Phân loại không cần quy đổi VNĐ"
									labelWidth={sectionPrimaryLabelWidth}
								>
									<div className={shortFieldBoxCls}>
										{renderClassicInput("valuationDeclarationTypeCode")}
									</div>
								</Row>
								<RightRow
									label="Tổng hệ số phân bổ trị giá tính thuế"
									labelWidth={sectionSecondaryLabelWidth}
								>
									<div className={shortFieldBoxCls}>
										{renderClassicReadonlyInput(valuationAllocationRatioTotal)}
									</div>
								</RightRow>
							</div>

							<Row label="Người nộp thuế" labelWidth={sectionPrimaryLabelWidth}>
								<div className={shortFieldBoxCls}>
									{renderClassicSelect("taxPayer")}
								</div>
							</Row>

							<Row
								label="Mã ngân hàng trả thuế thay"
								labelWidth={sectionPrimaryLabelWidth}
							>
								<div className={taxLookupFieldBoxCls}>
									{renderClassicCodeLookupSelect("taxSubstituteBankCode", {
										codeWidthClassName: bankCodeFieldWidthCls,
									})}
								</div>
							</Row>

							<div className={taxTripleGridCls}>
								<Row
									label="Năm phát hành hạn mức"
									labelWidth={sectionPrimaryLabelWidth}
								>
									<div className={tripleFieldBoxCls}>
										{renderClassicInput("creditLimitIssueYear")}
									</div>
								</Row>
								<RightRow
									label="Ký hiệu CT hạn mức"
									labelWidth={sectionTertiaryLabelWidth}
								>
									<div className={tripleFieldBoxCls}>
										{renderClassicInput("creditLimitDocumentSymbol")}
									</div>
								</RightRow>
								<RightRow
									label="Số CT hạn mức"
									labelWidth={sectionTertiaryLabelWidth}
								>
									<div className={tripleFieldBoxCls}>
										{renderClassicInput("creditLimitDocumentNumber")}
									</div>
								</RightRow>
							</div>

							<Row
								label="Mã xác định thời hạn nộp thuế"
								labelWidth={sectionPrimaryLabelWidth}
							>
								<div className={taxDeadlineFieldBoxCls}>
									{renderClassicCodeLookupSelect("taxPaymentDeadlineCode", {
										codeWidthClassName: bankCodeFieldWidthCls,
										showButton: false,
									})}
								</div>
							</Row>

							<Row
								label="Mã ngân hàng bảo lãnh"
								labelWidth={sectionPrimaryLabelWidth}
							>
								<div className={taxLookupFieldBoxCls}>
									{renderClassicCodeLookupSelect("guaranteeBankCode", {
										codeWidthClassName: bankCodeFieldWidthCls,
									})}
								</div>
							</Row>

							<div className={taxTripleGridCls}>
								<Row
									label="Năm phát hành bảo lãnh"
									labelWidth={sectionPrimaryLabelWidth}
								>
									<div className={tripleFieldBoxCls}>
										{renderClassicInput("creditLimitIssueYear")}
									</div>
								</Row>
								<RightRow
									label="Ký hiệu CT bảo lãnh"
									labelWidth={sectionTertiaryLabelWidth}
								>
									<div className={tripleFieldBoxCls}>
										{renderClassicInput("guaranteeDocumentSymbol")}
									</div>
								</RightRow>
								<RightRow
									label="Số CT bảo lãnh"
									labelWidth={sectionTertiaryLabelWidth}
								>
									<div className={tripleFieldBoxCls}>
										{renderClassicInput("guaranteeDocumentNumber")}
									</div>
								</RightRow>
							</div>
						</div>
					</SectionBlock>

					<SectionBlock title="Thông tin đính kèm">
						<ElectronicAttachmentsTable {...commonTableProps} />
					</SectionBlock>

					<SectionBlock title="Thông tin vận chuyển">
						<div className="space-y-[3px]">
							<Row
								label="Ngày khởi hành vận chuyển"
								labelWidth={sectionPrimaryLabelWidth}
							>
								<div className={dateFieldBoxCls}>
									{renderClassicDateInput("transportDepartureDate")}
								</div>
							</Row>
							<TransportSchedulesTable {...commonTableProps} />
							<div className="mt-1 mb-0.5 grid gap-x-3 gap-y-1 sm:grid-cols-[188px_1fr]">
								<div className="pt-[2px] text-[11px] text-black">
									Địa điểm đích cho vận chuyển bảo thuế
								</div>
								<div className="cds-visible-x-scrollbar">
									<div className="w-[654px] min-w-[654px]">
										<div
											className={cn(
												transportScheduleGridCls,
												"mb-px text-[12px] text-black",
											)}
										>
											<span className="w-[28px] shrink-0" aria-hidden />
											<div className="col-span-3 flex min-w-0 items-center gap-0.5">
												<div className={lookupFieldBoxCls}>
													{renderClassicCodeLookupSelect(
														"taxDestinationLocation",
													)}
												</div>
											</div>
											<div className="w-[130px] shrink-0">
												{renderClassicDateInput(
													"estimatedArrivalAtDestinationDate",
												)}
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</SectionBlock>

					<SectionBlock title="Thông tin khác">
						<div className="space-y-[3px]">
							<Row
								label="Phần ghi chú"
								labelWidth={sectionPrimaryLabelWidth}
								alignTop
								className="items-start"
							>
								<div className={partyLongFieldBoxCls}>
									<BufferedTextarea
										value={typeof data.note === "string" ? data.note : ""}
										onCommit={(nextValue) =>
											handleFieldChange("note", nextValue)
										}
										suppressManualScrollRestore={suppressManualScrollRestore}
										rows={1}
										className={cn(classicTextareaCls, "min-h-[26px]")}
									/>
								</div>
							</Row>
							<Row
								label="Số quản lý của nội bộ doanh nghiệp"
								labelWidth={sectionPrimaryLabelWidth}
							>
								<div className={mediumShortFieldBoxCls}>
									{renderClassicInput("internalBusinessManagementNumber")}
								</div>
							</Row>
						</div>
					</SectionBlock>
				</div>
			</div>
		</div>
	);
}
