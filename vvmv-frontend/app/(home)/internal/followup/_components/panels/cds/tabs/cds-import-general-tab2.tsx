"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BufferedTextarea } from "../cds-classic-ui";
import {
	ElectronicAttachmentsTable,
	ImportLicenseSlots,
	LegalDocumentSlots,
	TransportSchedulesTable,
	transportScheduleGridCls,
	ValuationAdjustmentsTable,
} from "../cds-collection-tables";
import {
	exportClassicFormBodyCls,
	exportClassicSectionBodyCls,
	importPanelFrameCls,
} from "../cds-styles";
import type { CdsTabRenderProps } from "./cds-tab-props";

export function CdsImportGeneralTab2({
	data,
	handleFieldChange,
	suppressManualScrollRestore,
	renderClassicLabel,
	renderInfoButton,
	renderExportSectionHeader,
	renderClassicDateInput,
	renderClassicInput,
	renderClassicReadonlyInput,
	renderClassicSelect,
	renderClassicCodeLookupSelect,
	renderLookupCodeAndName,
	valuationAllocationRatioTotal,
	commonTableProps,
}: CdsTabRenderProps) {
	const classicTextareaCls =
		"min-h-[40px] resize-none rounded-none border border-slate-500 bg-white px-1 py-0.5 text-[11px] leading-[16px] text-slate-900 shadow-none outline-none focus:border-sky-700 focus-visible:ring-0";
	const compactSectionGridCls =
		"grid w-full grid-cols-1 gap-x-6 gap-y-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]";
	const taxTripleGridCls =
		"grid w-full grid-cols-1 gap-x-4 gap-y-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]";
	const sectionPrimaryLabelWidth = "sm:w-[188px]";
	const sectionSecondaryLabelWidth = sectionPrimaryLabelWidth;
	const sectionTertiaryLabelWidth = "sm:w-[160px]";
	const rowBaseLabelWidth = sectionPrimaryLabelWidth;
	const shortFieldBoxCls = "w-full sm:max-w-[220px]";
	const mediumFieldBoxCls = "w-full sm:max-w-[320px]";
	const summaryFieldBoxCls = "w-full sm:max-w-[320px]";
	const lookupFieldBoxCls = "w-full sm:max-w-[520px]";
	const taxDeadlineFieldBoxCls = "w-full sm:max-w-[640px]";
	const taxLookupFieldBoxCls = "w-full sm:max-w-[640px]";
	const dateFieldBoxCls = shortFieldBoxCls;
	const tripleFieldBoxCls = "w-full";
	const noteFieldBoxCls = "w-full sm:max-w-[878px]";
	const valuationCodeFieldBoxCls = shortFieldBoxCls;
	const valuationReadonlyFieldBoxCls = shortFieldBoxCls;
	const valuationInsuranceGridCls =
		"flex w-full flex-wrap items-center gap-x-2 gap-y-1 sm:max-w-[760px]";
	const valuationTransportGridCls =
		"flex w-full flex-wrap items-center gap-x-2 gap-y-1 sm:max-w-[640px]";
	const inlineMetaCls = "text-[11px] text-black";
	const lookupCodeWidthCls = "w-[100px]";
	const narrowLookupCodeWidthCls = "w-[100px]";
	const feeAmountFieldCls = "w-full sm:w-[160px]";
	const feeCodeFieldCls = "w-full sm:w-[72px]";
	const feeRegistrationFieldCls = "w-full sm:w-[140px]";
	const infoLinkButtonCls =
		"h-auto min-h-[22px] w-auto border-0 bg-transparent px-0 text-[11px] font-normal text-[#2b59c3] underline underline-offset-2 hover:bg-transparent disabled:!border-0 disabled:!bg-transparent disabled:!text-[#2b59c3]";
	const rightLaneContentCls = "flex justify-start";

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
		children: ReactNode;
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

	const InlineMetaField = ({
		label,
		children,
		className,
		fieldClassName,
	}: {
		label: string;
		children: ReactNode;
		className?: string;
		fieldClassName?: string;
	}) => (
		<div className={cn("flex min-w-0 items-center gap-1", className)}>
			<span className={cn(inlineMetaCls, "shrink-0")}>{label}</span>
			<div className={cn("min-w-0", fieldClassName)}>{children}</div>
		</div>
	);

	const ValuationFeeGroup = ({
		title,
		children,
	}: {
		title: string;
		children: ReactNode;
	}) => (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
			<span className="sr-only">{title}</span>
			{children}
		</div>
	);

	return (
		<div
			className="bg-[#efefef] px-0 py-1 pb-8"
			style={{ fontFamily: "Tahoma, Arial, sans-serif" }}
		>
			<div className={importPanelFrameCls}>
				<div className={exportClassicFormBodyCls}>
					<SectionBlock title="Thông tin hợp đồng">
						<div className="space-y-[3px]">
							<Row label="Số hợp đồng">
								<div className={mediumFieldBoxCls}>
									{renderClassicInput("contractNumber")}
								</div>
							</Row>

							<div className={compactSectionGridCls}>
								<Row label="Ngày hợp đồng">
									<div className={dateFieldBoxCls}>
										{renderClassicDateInput("contractDate")}
									</div>
								</Row>
								<RightRow label="Ngày hết hạn">
									<div className="flex w-full flex-wrap items-center gap-2 sm:max-w-[560px]">
										<div className={dateFieldBoxCls}>
											{renderClassicDateInput("contractGoodsDate")}
										</div>
										{renderInfoButton(
											"Khai báo thông tin hợp đồng theo yêu cầu của Hải quan chưa được bật cho màn tờ khai nhập khẩu.",
											{
												ariaLabel:
													"Khai báo thông tin HĐ theo yêu cầu của Hải quan",
												buttonLabel:
													"Khai báo thông tin HĐ theo yêu cầu của Hải quan",
												className: infoLinkButtonCls,
											},
										)}
									</div>
								</RightRow>
							</div>
						</div>
					</SectionBlock>

					<SectionBlock title="Thông tin văn bản và giấy phép">
						<LegalDocumentSlots {...commonTableProps} />
						<ImportLicenseSlots {...commonTableProps} />
					</SectionBlock>

					<SectionBlock title="Hóa đơn thương mại">
						<div className="space-y-[3px]">
							<Row label="Phân loại hình thức hóa đơn" required>
								<div className={mediumFieldBoxCls}>
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
									<div className={summaryFieldBoxCls}>
										{renderClassicInput("commercialInvoice")}
									</div>
								</RightRow>
							</div>

							<div className={compactSectionGridCls}>
								<Row label="Ngày phát hành">
									<div className={dateFieldBoxCls}>
										{renderClassicDateInput("commercialInvoiceDate")}
									</div>
								</Row>
								<RightRow label="Phương thức thanh toán">
									<div className={summaryFieldBoxCls}>
										{renderClassicSelect("paymentMethod")}
									</div>
								</RightRow>
							</div>

							<div className={compactSectionGridCls}>
								<Row label="Mã phân loại giá hóa đơn" required>
									<div className={shortFieldBoxCls}>
										{renderClassicSelect("invoiceClassificationCode")}
									</div>
								</Row>
								<RightRow label="Điều kiện giá hóa đơn" required>
									<div className={summaryFieldBoxCls}>
										{renderClassicSelect("invoicePriceCondition")}
									</div>
								</RightRow>
							</div>

							<div className={compactSectionGridCls}>
								<Row label="Tổng trị giá hóa đơn" required>
									<div className={shortFieldBoxCls}>
										{renderClassicInput("totalInvoiceValue")}
									</div>
								</Row>
								<RightRow label="Mã đồng tiền của hóa đơn" required>
									<div className={summaryFieldBoxCls}>
										{renderClassicSelect("invoiceCurrency")}
									</div>
								</RightRow>
							</div>
						</div>
					</SectionBlock>

					<SectionBlock title="Tờ khai trị giá">
						<div className="space-y-[3px]">
							<div className={compactSectionGridCls}>
								<Row label="Mã phân loại khai trị giá">
									<div className={valuationCodeFieldBoxCls}>
										{renderClassicSelect("valuationDeclarationTypeCode")}
									</div>
								</Row>
								<RightRow label="Số tiếp nhận tờ khai trị giá tổng hợp">
									<div className={shortFieldBoxCls}>
										{renderClassicInput(
											"valuationSummaryReceiptNumber",
											undefined,
											undefined,
											{ forceDisabled: true },
										)}
									</div>
								</RightRow>
							</div>

							<div className={compactSectionGridCls}>
								<Row label="Mã tiền tệ">
									<div className={valuationCodeFieldBoxCls}>
										{renderClassicSelect(
											"taxableValueCurrencyCode",
											undefined,
											{
												forceDisabled: true,
											},
										)}
									</div>
								</Row>
								<RightRow label="Giá cơ sở để hiệu chỉnh giá">
									<div className={shortFieldBoxCls}>
										{renderClassicInput(
											"totalTaxableValue",
											undefined,
											undefined,
											{ forceDisabled: true },
										)}
									</div>
								</RightRow>
							</div>

							<Row label="Phí vận chuyển">
								<ValuationFeeGroup title="Thông tin phí vận chuyển">
									<div className={valuationTransportGridCls}>
										<InlineMetaField
											label="Mã loại:"
											fieldClassName={feeCodeFieldCls}
										>
											{renderClassicSelect("transportFeeClassificationCode")}
										</InlineMetaField>
										<InlineMetaField
											label="Mã tiền:"
											fieldClassName={feeCodeFieldCls}
										>
											{renderClassicSelect("transportFeeCurrencyCode")}
										</InlineMetaField>
										<InlineMetaField
											label="Phí VC:"
											fieldClassName={feeAmountFieldCls}
										>
											{renderClassicInput("transportFee")}
										</InlineMetaField>
									</div>
								</ValuationFeeGroup>
							</Row>

							<Row label="Phí bảo hiểm">
								<ValuationFeeGroup title="Thông tin phí bảo hiểm">
									<div className={valuationInsuranceGridCls}>
										<InlineMetaField
											label="Mã loại:"
											fieldClassName={feeCodeFieldCls}
										>
											{renderClassicSelect("insuranceFeeClassificationCode")}
										</InlineMetaField>
										<InlineMetaField
											label="Mã tiền:"
											fieldClassName={feeCodeFieldCls}
										>
											{renderClassicSelect("insuranceFeeCurrencyCode")}
										</InlineMetaField>
										<InlineMetaField
											label="Phí BH:"
											fieldClassName={feeAmountFieldCls}
										>
											{renderClassicInput("insuranceFee")}
										</InlineMetaField>
										<InlineMetaField
											label="Số ĐK:"
											fieldClassName={feeRegistrationFieldCls}
										>
											{renderClassicInput("insuranceRegistrationNumber")}
										</InlineMetaField>
									</div>
								</ValuationFeeGroup>
							</Row>
						</div>

						<div className="pt-1">
							<ValuationAdjustmentsTable {...commonTableProps} />
						</div>

						<div className="pt-1">
							<Row label="Chi tiết khai trị giá" alignTop>
								<div className={noteFieldBoxCls}>
									<BufferedTextarea
										value={String(data.valuationDeclarationDetail ?? "")}
										onCommit={(nextValue) =>
											handleFieldChange("valuationDeclarationDetail", nextValue)
										}
										suppressManualScrollRestore={suppressManualScrollRestore}
										rows={3}
										className={cn(classicTextareaCls, "h-auto")}
									/>
								</div>
							</Row>
						</div>

						<div className={cn(compactSectionGridCls, "pt-1")}>
							<Row label="Tổng hệ số phân bổ trị giá">
								<div className={valuationReadonlyFieldBoxCls}>
									{renderClassicReadonlyInput(valuationAllocationRatioTotal)}
								</div>
							</Row>
							<RightRow label="Người nộp thuế">
								<div className={shortFieldBoxCls}>
									{renderClassicSelect("taxPayer")}
								</div>
							</RightRow>
						</div>
					</SectionBlock>

					<SectionBlock title="Thuế và bảo lãnh">
						<div className="space-y-[3px]">
							<Row label="Mã lý do đề nghị BP">
								<div className={taxDeadlineFieldBoxCls}>
									{renderClassicCodeLookupSelect("releaseBeforePermitCode", {
										codeWidthClassName: narrowLookupCodeWidthCls,
										showButton: false,
									})}
								</div>
							</Row>

							<Row label="Mã ngân hàng trả thuế thay">
								<div className={taxLookupFieldBoxCls}>
									{renderLookupCodeAndName("taxSubstituteBankCode", undefined, {
										codeWidthClassName: lookupCodeWidthCls,
									})}
								</div>
							</Row>

							<div className={taxTripleGridCls}>
								<Row label="Năm phát hành hạn mức">
									<div className={tripleFieldBoxCls}>
										{renderClassicInput("creditLimitIssueYear")}
									</div>
								</Row>
								<RightRow
									label="Ký hiệu chứng từ hạn mức"
									labelWidth={sectionTertiaryLabelWidth}
								>
									<div className={tripleFieldBoxCls}>
										{renderClassicInput("creditLimitDocumentSymbol")}
									</div>
								</RightRow>
								<RightRow
									label="Số chứng từ hạn mức"
									labelWidth={sectionTertiaryLabelWidth}
								>
									<div className={tripleFieldBoxCls}>
										{renderClassicInput("creditLimitDocumentNumber")}
									</div>
								</RightRow>
							</div>

							<Row label="Mã xác định thời hạn nộp thuế">
								<div className={taxDeadlineFieldBoxCls}>
									{renderClassicCodeLookupSelect("taxPaymentDeadlineCode", {
										codeWidthClassName: narrowLookupCodeWidthCls,
										showButton: false,
									})}
								</div>
							</Row>

							<Row label="Mã ngân hàng bảo lãnh">
								<div className={taxLookupFieldBoxCls}>
									{renderLookupCodeAndName("guaranteeBankCode", undefined, {
										codeWidthClassName: lookupCodeWidthCls,
									})}
								</div>
							</Row>

							<div className={taxTripleGridCls}>
								<Row label="Năm phát hành bảo lãnh">
									<div className={tripleFieldBoxCls}>
										{renderClassicInput("guaranteeIssueYear")}
									</div>
								</Row>
								<RightRow
									label="Ký hiệu chứng từ bảo lãnh"
									labelWidth={sectionTertiaryLabelWidth}
								>
									<div className={tripleFieldBoxCls}>
										{renderClassicInput("guaranteeDocumentSymbol")}
									</div>
								</RightRow>
								<RightRow
									label="Số chứng từ bảo lãnh"
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
							<div className={compactSectionGridCls}>
								{/* "Ngày đến địa điểm đích" được khai ở khối vận chuyển bảo
								    thuế bên dưới; không bind lại estimatedArrivalAtDestinationDate
								    tại đây để tránh hai ô ghi đè lẫn nhau. */}
								<RightRow label="Ngày khởi hành vận chuyển">
									<div className={dateFieldBoxCls}>
										{renderClassicDateInput("transportDepartureDate")}
									</div>
								</RightRow>
							</div>

							<TransportSchedulesTable {...commonTableProps} />

							<div className="mt-1 mb-0.5 grid gap-x-3 gap-y-1 pt-0.5 sm:grid-cols-[188px_1fr]">
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
													{renderLookupCodeAndName(
														"taxDestinationLocation",
														undefined,
														{
															codeWidthClassName: lookupCodeWidthCls,
														},
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
							<Row label="Phần ghi chú" alignTop>
								<div className={noteFieldBoxCls}>
									<BufferedTextarea
										value={String(data.note ?? "")}
										onCommit={(nextValue) =>
											handleFieldChange("note", nextValue)
										}
										suppressManualScrollRestore={suppressManualScrollRestore}
										rows={2}
										className={cn(classicTextareaCls, "min-h-[44px]")}
									/>
								</div>
							</Row>

							<Row label="Số quản lý của nội bộ doanh nghiệp">
								<div className={mediumFieldBoxCls}>
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
