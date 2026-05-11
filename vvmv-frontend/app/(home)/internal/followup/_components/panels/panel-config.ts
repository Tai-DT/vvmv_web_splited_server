import type { CargoListRow, FollowUpCdsInfoRow } from "../../types";

export type PanelFieldType = "text" | "number" | "date" | "textarea" | "select";

export type CargoColumn = {
	key: Extract<keyof CargoListRow, string>;
	label: string;
	type: Extract<PanelFieldType, "text" | "number" | "date">;
	minWidth?: string;
	compactWidth?: string;
	/** Legacy / ECUS / old web export headers for Excel–header matching */
	headerAliases?: string[];
};

export type CdsInfoFieldConfig = {
	key: Extract<keyof FollowUpCdsInfoRow, string>;
	label: string;
	type: PanelFieldType;
	placeholder?: string;
	disabled?: boolean;
	rows?: number;
};

export type CdsInfoSectionConfig = {
	title: string;
	fields: CdsInfoFieldConfig[];
};

/**
 * Thứ tự cột bám ECUS_2025 «Danh sách hàng» (copy TSV / dán từ lưới ECUS).
 * Bốn cột sau «Trị giá hóa đơn» khớp nhãn thường gặp trên ECUS desktop.
 */
export const FOLLOWUP_CARGO_COLUMNS: CargoColumn[] = [
	{
		key: "customCode",
		label: "Mã hàng",
		type: "text",
		minWidth: "120px",
		compactWidth: "96px",
	},
	{
		key: "vietnameseName",
		label: "Tên hàng (mô tả chi tiết)",
		type: "text",
		minWidth: "260px",
		compactWidth: "220px",
		headerAliases: ["Tên hàng", "Ten hang"],
	},
	{
		key: "hsCode",
		label: "Mã HS",
		type: "text",
		minWidth: "120px",
		compactWidth: "96px",
	},
	{
		key: "originalCountry",
		label: "Xuất xứ",
		type: "text",
		minWidth: "120px",
		compactWidth: "96px",
		headerAliases: ["Nước XX", "Nuoc XX"],
	},
	{
		key: "qty",
		label: "Lượng",
		type: "number",
		minWidth: "90px",
		compactWidth: "72px",
	},
	{
		key: "unit",
		label: "Đơn vị tính",
		type: "text",
		minWidth: "110px",
		compactWidth: "92px",
	},
	{
		key: "qty2",
		label: "Lượng 2",
		type: "number",
		minWidth: "90px",
		compactWidth: "72px",
	},
	{
		key: "unit2",
		label: "Đơn vị tính 2",
		type: "text",
		minWidth: "110px",
		compactWidth: "92px",
	},
	{
		key: "unitPrice",
		label: "Đơn giá hóa đơn",
		type: "number",
		minWidth: "120px",
		compactWidth: "100px",
		headerAliases: ["Đơn giá HĐ", "Don gia HD"],
	},
	{
		key: "totalPrice",
		label: "Trị giá hóa đơn",
		type: "number",
		minWidth: "120px",
		compactWidth: "108px",
		headerAliases: ["Trị giá HĐ", "Tri gia HD"],
	},
	{
		key: "lineTaxableValue",
		label: "Trị giá tính thuế",
		type: "number",
		minWidth: "130px",
		compactWidth: "112px",
		headerAliases: ["Tri gia tinh thue"],
	},
	{
		key: "exportTaxRatePercent",
		label: "TS XK(%)",
		type: "number",
		minWidth: "90px",
		compactWidth: "76px",
		headerAliases: ["TS XK", "Thuế suất xuất khẩu", "Thue suat xuat khau"],
	},
	{
		key: "exportTaxAmount",
		label: "Tiền thuế XK",
		type: "number",
		minWidth: "120px",
		compactWidth: "104px",
		headerAliases: ["Tien thue XK"],
	},
	{
		key: "taxableUnitPrice",
		label: "Đơn giá tính thuế",
		type: "number",
		minWidth: "120px",
		compactWidth: "104px",
		headerAliases: ["Don gia tinh thue"],
	},
	{
		key: "imExDutyExemptionCode",
		label: "Mã miễn giảm không chịu thuế XNK",
		type: "text",
		minWidth: "220px",
		compactWidth: "210px",
	},
	{
		key: "imExDutyExemptionCondition",
		label: "Điều kiện miễn giảm thuế XNK",
		type: "text",
		minWidth: "210px",
		compactWidth: "180px",
	},
	{
		key: "imExDutyExemptionAmount",
		label: "Tiền miễn giảm thuế XNK",
		type: "number",
		minWidth: "160px",
		compactWidth: "132px",
	},
	{
		key: "importTaxCode",
		label: "Mã biểu thuế nhập khẩu",
		type: "text",
		minWidth: "170px",
		compactWidth: "152px",
	},
	{
		key: "importTaxRate",
		label: "Thuế suất nhập khẩu",
		type: "number",
		minWidth: "140px",
		compactWidth: "112px",
	},
	{
		key: "importTaxAmount",
		label: "Tiền thuế nhập khẩu",
		type: "number",
		minWidth: "150px",
		compactWidth: "124px",
	},
	{
		key: "vatTaxCode",
		label: "Mã biểu thuế VAT",
		type: "text",
		minWidth: "150px",
		compactWidth: "132px",
	},
	{
		key: "vatTaxRate",
		label: "Thuế suất VAT",
		type: "number",
		minWidth: "120px",
		compactWidth: "96px",
	},
	{
		key: "vatTaxAmount",
		label: "Tiền thuế VAT",
		type: "number",
		minWidth: "130px",
		compactWidth: "108px",
	},
	{
		key: "dutyReductionCode",
		label: "Mã miễn giảm",
		type: "text",
		minWidth: "130px",
		compactWidth: "96px",
	},
	{
		key: "originalCargoName",
		label: "Tên hàng trên chứng từ",
		type: "text",
		minWidth: "260px",
		compactWidth: "220px",
	},
];

export const FOLLOWUP_CARGO_VISIBLE_KEYS = new Set(
	FOLLOWUP_CARGO_COLUMNS.map((column) => column.key),
);

export const FOLLOWUP_CDS_INFO_SECTION_CONFIGS: CdsInfoSectionConfig[] = [
	{
		title: "Thông tin tờ khai",
		fields: [
			{ key: "declarationNumber", label: "Số tờ khai", type: "text" },
			{
				key: "declarationSequenceNumber",
				label: "STT tờ khai",
				type: "text",
			},
			{
				key: "firstDeclarationNumber",
				label: "Số tờ khai đầu tiên",
				type: "text",
			},
			{ key: "branchNumberPart1", label: "Số nhánh 1", type: "text" },
			{ key: "branchNumberPart2", label: "Số nhánh 2", type: "text" },
			{
				key: "correspondingDeclarationNumber",
				label: "Số tờ khai tạm nhập tái xuất tương ứng",
				type: "text",
			},
			{ key: "operationCode", label: "Mã LH", type: "text" },
			{
				key: "cargoClassificationCode",
				label: "Mã phân loại hàng hóa",
				type: "text",
			},
			{
				key: "businessTypeGroup",
				label: "Nhóm loại hình hồ sơ",
				type: "text",
			},
			{
				key: "transportMethodCode",
				label: "Mã hiệu phương thức vận chuyển",
				type: "text",
			},
			{ key: "customsCode", label: "Mã HQ", type: "text" },
			{
				key: "expectedDeclarationDate",
				label: "Ngày đăng ký tờ khai dự kiến",
				type: "date",
			},
			{
				key: "reExportDeadline",
				label: "Ngày hết hạn tái xuất",
				type: "date",
			},
			{
				key: "personOrganizationClassification",
				label: "Phân loại các nhân tổ chức",
				type: "text",
			},
			{
				key: "declarationProcessingDeptCode",
				label: "Mã bộ phận xử lý TK",
				type: "text",
			},
		],
	},
	{
		title: "Người nhập khẩu / xuất khẩu",
		fields: [
			{ key: "importerCode", label: "Mã đơn vị XNK", type: "text" },
			{
				key: "importExportUnitName",
				label: "Tên đơn vị xuất/nhập khẩu",
				type: "text",
			},
			{
				key: "importerPostalCode",
				label: "Mã bưu chính đơn vị XNK",
				type: "text",
			},
			{
				key: "importExportBusinessAddress",
				label: "Địa chỉ doanh nghiệp xuất/nhập khẩu",
				type: "text",
			},
			{
				key: "importerPhone",
				label: "Điện thoại đơn vị XNK (nếu có)",
				type: "text",
			},
			{
				key: "entrustedImporterCode",
				label: "Mã người nhập khẩu ủy thác",
				type: "text",
			},
			{
				key: "entrustedImporterName",
				label: "Tên người nhập khẩu ủy thác",
				type: "text",
			},
			{
				key: "exporterCode",
				label: "Mã đối tác VNACCS",
				type: "text",
			},
			{
				key: "exporterPostalCode",
				label: "Mã bưu chính đối tác",
				type: "text",
			},
			{
				key: "customsDeclarantCode",
				label: "Mã người khai hải quan",
				type: "text",
			},
		],
	},
	{
		title: "Đối tác",
		fields: [
			{ key: "partnerName", label: "Tên đối tác", type: "text" },
			{
				key: "partnerAddress1",
				label: "Địa chỉ đối tác 1",
				type: "text",
			},
			{
				key: "partnerAddress2",
				label: "Địa chỉ đối tác 2",
				type: "text",
			},
			{
				key: "partnerAddress3",
				label: "Địa chỉ đối tác 3",
				type: "text",
			},
			{
				key: "partnerAddress4",
				label: "Địa chỉ đối tác 4",
				type: "text",
			},
			{
				key: "exportCountryCode",
				label: "Mã nước (ô Mã Nước)",
				type: "text",
			},
		],
	},
	{
		title: "Thông tin Logistics",
		fields: [
			{ key: "billOfLading", label: "Vận đơn", type: "text" },
			{ key: "packageQuantity", label: "Số lượng kiện", type: "number" },
			{ key: "packageType", label: "Loại kiện", type: "text" },
			{
				key: "grossWeightTotal",
				label: "Tổng trọng lượng hàng (Gross)",
				type: "number",
			},
			{
				key: "weightUnit",
				label: "Đơn vị tính trọng lượng",
				type: "text",
			},
			{
				key: "containerQuantity",
				label: "Số lượng cont",
				type: "number",
			},
			{
				key: "packageMarks",
				label: "Ký hiệu và số hiệu bao bì",
				type: "text",
			},
			{
				key: "warehouseLocationCode",
				label: "Mã địa điểm lưu kho",
				type: "text",
			},
			{
				key: "unloadingLocationCode",
				label: "Mã địa điểm dỡ hàng",
				type: "text",
			},
			{
				key: "loadingLocationCode",
				label: "Mã địa điểm xếp hàng",
				type: "text",
			},
			{
				key: "transportVehicleCode",
				label: "Mã phương tiện vận chuyển",
				type: "text",
			},
			{
				key: "departureArrivalDate",
				label: "Ngày đi/Ngày đến",
				type: "date",
			},
			{
				key: "warehouseLocationName",
				label: "Tên địa điểm lưu kho",
				type: "text",
			},
			{
				key: "unloadingLocationName",
				label: "Tên địa điểm dỡ hàng",
				type: "text",
			},
			{
				key: "loadingLocationName",
				label: "Tên địa điểm xếp hàng",
				type: "text",
			},
			{
				key: "transportVehicleName",
				label: "Tên phương tiện vận chuyển",
				type: "text",
			},
		],
	},
	{
		title: "Thông tin hóa đơn",
		fields: [
			{
				key: "commercialInvoice",
				label: "Hóa đơn thương mại",
				type: "text",
			},
			{
				key: "invoiceFormClassificationCode",
				label: "Mã phân loại hình thức hóa đơn",
				type: "text",
			},
			{
				key: "electronicInvoiceReceiptNumber",
				label: "Số tiếp nhận hóa đơn điện tử",
				type: "text",
			},
			{ key: "commercialInvoiceDate", label: "Ngày HĐTM", type: "date" },
			{
				key: "invoicePriceCondition",
				label: "Điều kiện giá hóa đơn",
				type: "text",
			},
			{
				key: "paymentMethod",
				label: "Phương thức thanh toán",
				type: "text",
			},
			{
				key: "invoiceClassificationCode",
				label: "Mã phân loại hóa đơn",
				type: "text",
			},
			{ key: "declaredValue", label: "Trị giá KB", type: "number" },
			{
				key: "totalInvoiceValue",
				label: "Tổng trị giá HĐ",
				type: "number",
			},
			{
				key: "totalTaxableValue",
				label: "Tổng trị giá TT",
				type: "number",
			},
			{ key: "invoiceCurrency", label: "Ngoại tệ hóa đơn", type: "text" },
			{
				key: "taxableValueCurrencyCode",
				label: "Mã đồng tiền trị giá tính thuế",
				type: "text",
			},
			{
				key: "exchangeRate",
				label: "Tỷ giá tính thuế",
				type: "number",
			},
		],
	},
	{
		title: "Khai trị giá",
		fields: [
			{
				key: "valuationDeclarationTypeCode",
				label: "Mã phân loại tờ khai trị giá",
				type: "text",
			},
			{ key: "transportFee", label: "Phí VC", type: "number" },
			{
				key: "transportFeeClassificationCode",
				label: "Mã phân loại phí vận chuyển",
				type: "text",
			},
			{
				key: "transportFeeCurrencyCode",
				label: "Mã tiền phí vận chuyển",
				type: "text",
			},
			{ key: "insuranceFee", label: "Phí BH", type: "number" },
			{
				key: "insuranceFeeClassificationCode",
				label: "Mã phân loại phí bảo hiểm",
				type: "text",
			},
			{
				key: "insuranceFeeCurrencyCode",
				label: "Mã tiền phí bảo hiểm",
				type: "text",
			},
			{
				key: "insuranceRegistrationNumber",
				label: "Số đăng ký bảo hiểm",
				type: "text",
			},
		],
	},
	{
		title: "Thông tin thuế",
		fields: [
			{ key: "taxPayer", label: "Người nộp thuế", type: "text" },
			{
				key: "releaseBeforePermitCode",
				label: "Mã lý do đề nghị BP",
				type: "text",
			},
			{
				key: "taxPaymentDeadlineCode",
				label: "Mã xác định thời hạn nộp thuế",
				type: "text",
			},
			{
				key: "taxSubstituteBankCode",
				label: "Mã NH nộp thuế thay",
				type: "text",
			},
			{
				key: "creditLimitIssueYear",
				label: "Năm phát hành hạn mức",
				type: "text",
			},
			{
				key: "guaranteeBankCode",
				label: "Mã ngân hàng bảo lãnh",
				type: "text",
			},
			{
				key: "creditLimitDocumentSymbol",
				label: "Ký hiệu chứng từ hạn mức",
				type: "text",
			},
			{
				key: "creditLimitDocumentNumber",
				label: "Số chứng từ hạn mức",
				type: "text",
			},
			{
				key: "guaranteeDocumentSymbol",
				label: "Ký hiệu chứng từ bảo lãnh",
				type: "text",
			},
			{
				key: "guaranteeDocumentNumber",
				label: "Số chứng từ bảo lãnh",
				type: "text",
			},
			{
				key: "taxDestinationLocation",
				label: "Địa điểm đích cho vận chuyển bảo thuế",
				type: "text",
			},
			{
				key: "estimatedArrivalAtDestinationDate",
				label: "Ngày dự kiến đến địa điểm đích",
				type: "date",
			},
			{
				key: "transportDepartureDate",
				label: "Ngày khởi hành vận chuyển",
				type: "date",
			},
			{ key: "note", label: "Ghi chú", type: "textarea" },
		],
	},
	{
		title: "Hợp đồng",
		fields: [
			{ key: "contractNumber", label: "Số HĐ", type: "text" },
			{ key: "contractDate", label: "Ngày HĐ", type: "date" },
			{ key: "contractGoodsDate", label: "Ngày HHHĐ", type: "date" },
		],
	},
	{
		title: "Khác",
		fields: [
			{
				key: "internalBusinessManagementNumber",
				label: "Số quản lý của nội bộ doanh nghiệp",
				type: "text",
			},
			{
				key: "valuationDeclarationDetail",
				label: "Chi tiết khai trị giá",
				type: "textarea",
			},
			{
				key: "truckLoadingLocationCode",
				label: "Mã địa điểm xếp hàng lên xe chở hàng",
				type: "text",
			},
			{
				key: "truckLoadingLocationName",
				label: "Tên địa điểm xếp hàng lên xe chở hàng",
				type: "text",
			},
			{
				key: "truckLoadingLocationAddress",
				label: "Địa chỉ địa điểm xếp hàng lên xe chở hàng",
				type: "textarea",
			},
			{
				key: "netWeight",
				label: "Trọng lượng tịnh (Net)",
				type: "number",
			},
		],
	},
];

export const FOLLOWUP_CDS_SECTION_COLORS = [
	{ bg: "bg-blue-50 border-blue-200", header: "text-blue-700" },
	{ bg: "bg-violet-50 border-violet-200", header: "text-violet-700" },
	{ bg: "bg-emerald-50 border-emerald-200", header: "text-emerald-700" },
	{ bg: "bg-orange-50 border-orange-200", header: "text-orange-700" },
	{ bg: "bg-cyan-50 border-cyan-200", header: "text-cyan-700" },
	{ bg: "bg-amber-50 border-amber-200", header: "text-amber-700" },
	{ bg: "bg-red-50 border-red-200", header: "text-red-700" },
	{ bg: "bg-pink-50 border-pink-200", header: "text-pink-700" },
	{ bg: "bg-slate-50 border-slate-200", header: "text-slate-600" },
] as const;

function formatDateValue(value: unknown): string {
	if (!value) return "";

	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		const day = String(value.getDate()).padStart(2, "0");
		const month = String(value.getMonth() + 1).padStart(2, "0");
		const year = value.getFullYear();
		return `${day}/${month}/${year}`;
	}

	const text = String(value).trim();
	if (!text) return "";

	const ddmmyyyyMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
	if (ddmmyyyyMatch) {
		return text;
	}

	const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
	if (isoMatch) {
		return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
	}

	const parsed = new Date(text);
	if (Number.isNaN(parsed.getTime())) {
		return text;
	}

	const day = String(parsed.getDate()).padStart(2, "0");
	const month = String(parsed.getMonth() + 1).padStart(2, "0");
	const year = parsed.getFullYear();
	return `${day}/${month}/${year}`;
}

export function formatPanelDisplayValue(
	value: unknown,
	type: PanelFieldType | CargoColumn["type"] = "text",
): string {
	if (value === null || value === undefined) {
		return "";
	}

	if (type === "number") {
		const numeric =
			typeof value === "number"
				? value
				: typeof value === "string" && value.trim() !== ""
					? Number(value.replace(/,/g, ""))
					: Number.NaN;

		if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
			return numeric.toLocaleString("en-US", {
				maximumFractionDigits: 2,
			});
		}
	}

	if (type === "date") {
		return formatDateValue(value);
	}

	const text = String(value).trim();
	return text;
}
