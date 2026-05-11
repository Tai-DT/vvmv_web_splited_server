import type { CdsDatabaseFieldOptionKey } from "@/lib/followup/cds-database-lookups";
import type { FollowUpOperationType } from "@/lib/followup/operation-type";

export type FieldInputType = "text" | "number" | "date" | "select";
export type FieldImportance = "required" | "recommended" | "optional";

export type FieldLookup =
	| {
			type: "operationCodes";
	  }
	| {
			type: "fieldOptions";
			key: CdsDatabaseFieldOptionKey;
	  }
	| {
			type: "static";
			values: Array<{ value: string; label: string }>;
	  };

export type FieldHanMapping = {
	table: string;
	column: string;
};

export type FieldHanMappingByOperation = Partial<
	Record<FollowUpOperationType, FieldHanMapping>
>;

export type FieldHanMappingConfig =
	| FieldHanMapping
	| FieldHanMappingByOperation;

export type FieldDefinition = {
	sectionKey: string;
	sectionLabel: string;
	appPath: string;
	label: string;
	inputType: FieldInputType;
	importance?: FieldImportance;
	visibleFor?: FollowUpOperationType[];
	requiredFor?: FollowUpOperationType[];
	lookup?: FieldLookup;
	hanMapping?: FieldHanMappingConfig;
	autofillFrom?: string[];
	notes?: string[];
};

export type CdsInfoFieldUsage = {
	fieldKey: string;
	visibleFor: FollowUpOperationType[] | null;
	requiredFor: FollowUpOperationType[];
	importance: FieldImportance;
};

export const FIELD_DEFINITIONS: FieldDefinition[] = [
	{
		sectionKey: "followUp",
		sectionLabel: "Thông tin hồ sơ",
		appPath: "operationType",
		label: "Loại nghiệp vụ",
		inputType: "select",
		importance: "required",
		requiredFor: ["NHAP", "XUAT"],
		lookup: {
			type: "static",
			values: [
				{ value: "NHAP", label: "Nhập khẩu" },
				{ value: "XUAT", label: "Xuất khẩu" },
			],
		},
	},
	{
		sectionKey: "followUp",
		sectionLabel: "Thông tin hồ sơ",
		appPath: "taxCode",
		label: "Mã số thuế",
		inputType: "text",
		importance: "required",
		requiredFor: ["NHAP", "XUAT"],
		notes: ["Dùng làm fallback cho MA_DV khi đẩy sang app khai báo."],
	},
	{
		sectionKey: "followUp",
		sectionLabel: "Thông tin hồ sơ",
		appPath: "companyName",
		label: "Tên doanh nghiệp",
		inputType: "text",
		importance: "recommended",
		autofillFrom: ["cdsInfo.importExportUnitName"],
		notes: [
			"Nếu trống, hệ thống vẫn lưu draft nhưng CDS thường cần tên đơn vị rõ ràng.",
		],
	},
	{
		sectionKey: "followUp",
		sectionLabel: "Thông tin hồ sơ",
		appPath: "jobNumber",
		label: "Số job nội bộ",
		inputType: "text",
		importance: "optional",
	},
	{
		sectionKey: "general",
		sectionLabel: "Thông tin tờ khai",
		appPath: "cdsInfo.operationCode",
		label: "Mã loại hình",
		inputType: "select",
		importance: "required",
		requiredFor: ["NHAP", "XUAT"],
		lookup: { type: "operationCodes" },
		hanMapping: { table: "DTOKHAIMD", column: "MA_LH" },
	},
	{
		sectionKey: "general",
		sectionLabel: "Thông tin tờ khai",
		appPath: "cdsInfo.customsCode",
		label: "Mã cơ quan hải quan",
		inputType: "text",
		importance: "required",
		requiredFor: ["NHAP", "XUAT"],
		hanMapping: { table: "DTOKHAIMD", column: "MA_HQ" },
	},
	{
		sectionKey: "general",
		sectionLabel: "Thông tin tờ khai",
		appPath: "cdsInfo.expectedDeclarationDate",
		label: "Ngày khai báo dự kiến (nếu có)",
		inputType: "date",
		importance: "optional",
		hanMapping: { table: "DTOKHAIMD", column: "NGAY_DK" },
	},
	{
		sectionKey: "general",
		sectionLabel: "Thông tin tờ khai",
		appPath: "cdsInfo.transportMethodCode",
		label: "Mã phương thức vận chuyển",
		inputType: "text",
		importance: "required",
		requiredFor: ["NHAP", "XUAT"],
		notes: [
			"Chọn một trong các mã 1, 2, 3, 4, 5, 6 hoặc 9 theo phương thức vận chuyển thực tế.",
			'Mã "9" chỉ dùng cho các phương thức khác hoặc các trường hợp đặc thù như xuất khẩu tại chỗ / kho ngoại quan vào khu phi thuế quan.',
			"Đây là một trong các chỉ tiêu không được khai sửa sau khi khai chính thức, cần chốt đúng trước khi đăng ký.",
		],
		hanMapping: { table: "DTOKHAIMD_VNACCS2", column: "MA_HIEU_PTVC" },
	},
	{
		sectionKey: "general",
		sectionLabel: "Thông tin tờ khai",
		appPath: "cdsInfo.exportCountryCode",
		label: "Mã nước (ô Mã Nước)",
		inputType: "text",
		importance: "required",
		requiredFor: ["NHAP", "XUAT"],
		hanMapping: {
			NHAP: { table: "DTOKHAIMD", column: "NUOC_XK" },
			XUAT: { table: "DTOKHAIMD", column: "NUOC_NK" },
		},
	},
	{
		sectionKey: "general",
		sectionLabel: "Thông tin tờ khai",
		appPath: "cdsInfo.personOrganizationClassification",
		label: "Phân loại cá nhân / tổ chức",
		inputType: "text",
		importance: "recommended",
		visibleFor: ["NHAP", "XUAT"],
		notes: [
			"Ghi sang DTOKHAIMD_VNACCS2.CANHAN_TOCHUC cho cả tờ khai nhập và xuất.",
			"Chỉ bắt buộc với các mã loại hình E11, E15, E21, E31, E41, E42, E52, E62 và E82; các mã loại hình khác chỉ cảnh báo nếu giá trị không hợp lệ.",
		],
		hanMapping: { table: "DTOKHAIMD_VNACCS2", column: "CANHAN_TOCHUC" },
	},
	{
		sectionKey: "general",
		sectionLabel: "Thông tin tờ khai",
		appPath: "cdsInfo.declarationProcessingDeptCode",
		label: "Mã bộ phận xử lý tờ khai",
		inputType: "text",
		importance: "required",
		requiredFor: ["NHAP"],
		notes: [
			"Người dùng có thể nhập trực tiếp mã Đội thủ tục xử lý tờ khai.",
			"Nếu để trống, web app hiện chỉ tự gợi ý theo mã Hải quan + loại hình + hướng nhập/xuất từ danh mục bộ phận xử lý đang có.",
			"Repo hiện chưa có bảng mapping HS -> Đội thủ tục, nên rule tự xác định theo mã HS chưa được nội suy trong codebase.",
			"HAN_2024 không có cột ghi trực tiếp mã bộ phận xử lý trong các bảng tờ khai chính; loader suy ra mã này từ danh mục SHAIQUAN_Sub.",
		],
	},
	{
		sectionKey: "partner",
		sectionLabel: "Đơn vị xuất nhập khẩu",
		appPath: "cdsInfo.importerCode",
		label: "Mã người xuất / nhập khẩu",
		inputType: "text",
		importance: "recommended",
		autofillFrom: ["taxCode"],
		hanMapping: { table: "DTOKHAIMD", column: "MA_DV" },
	},
	{
		sectionKey: "partner",
		sectionLabel: "Đơn vị xuất nhập khẩu",
		appPath: "cdsInfo.importExportUnitName",
		label: "Tên đơn vị xuất / nhập khẩu",
		inputType: "text",
		importance: "required",
		requiredFor: ["NHAP", "XUAT"],
		autofillFrom: ["companyName"],
		hanMapping: { table: "DTOKHAIMD", column: "_Ten_DV_L1" },
	},
	{
		sectionKey: "partner",
		sectionLabel: "Đơn vị xuất nhập khẩu",
		appPath: "cdsInfo.partnerName",
		label: "Tên đối tác",
		inputType: "text",
		importance: "required",
		requiredFor: ["NHAP", "XUAT"],
		hanMapping: { table: "DTOKHAIMD", column: "DV_DT" },
	},
	{
		sectionKey: "shipment",
		sectionLabel: "Vận đơn",
		appPath: "cdsInfo.billOfLading",
		label: "Số vận đơn / số định danh hàng hóa",
		inputType: "text",
		importance: "required",
		requiredFor: ["NHAP", "XUAT"],
		hanMapping: { table: "DTOKHAIMD", column: "VAN_DON" },
	},
	{
		sectionKey: "shipment",
		sectionLabel: "Vận đơn",
		appPath: "cdsInfo.packageQuantity",
		label: "Số lượng kiện",
		inputType: "number",
		importance: "required",
		requiredFor: ["NHAP", "XUAT"],
		hanMapping: { table: "DTOKHAIMD", column: "SO_KIEN" },
	},
	{
		sectionKey: "shipment",
		sectionLabel: "Vận đơn",
		appPath: "cdsInfo.packageType",
		label: "Đơn vị kiện",
		inputType: "select",
		importance: "required",
		requiredFor: ["NHAP", "XUAT"],
		lookup: { type: "fieldOptions", key: "packageType" },
		hanMapping: { table: "DTOKHAIMD", column: "DVT_KIEN" },
	},
	{
		sectionKey: "shipment",
		sectionLabel: "Vận đơn",
		appPath: "cdsInfo.grossWeightTotal",
		label: "Tổng trọng lượng gross",
		inputType: "number",
		importance: "required",
		requiredFor: ["NHAP", "XUAT"],
		hanMapping: { table: "DTOKHAIMD", column: "TR_LUONG" },
	},
	{
		sectionKey: "shipment",
		sectionLabel: "Vận đơn",
		appPath: "cdsInfo.weightUnit",
		label: "Đơn vị trọng lượng",
		inputType: "select",
		importance: "required",
		requiredFor: ["NHAP", "XUAT"],
		lookup: { type: "fieldOptions", key: "weightUnit" },
		hanMapping: { table: "DTOKHAIMD", column: "DVT_TR_LUONG" },
	},
	{
		sectionKey: "invoice",
		sectionLabel: "Hóa đơn",
		appPath: "cdsInfo.invoiceFormClassificationCode",
		label: "Phân loại hình thức hóa đơn",
		inputType: "select",
		importance: "required",
		visibleFor: ["NHAP", "XUAT"],
		requiredFor: ["NHAP", "XUAT"],
		lookup: { type: "fieldOptions", key: "invoiceFormClassificationCode" },
		hanMapping: { table: "DTOKHAIMD", column: "MA_HDTM" },
	},
	{
		sectionKey: "invoice",
		sectionLabel: "Hóa đơn",
		appPath: "cdsInfo.commercialInvoice",
		label: "Số hóa đơn thương mại",
		inputType: "text",
		importance: "required",
		requiredFor: ["NHAP", "XUAT"],
		hanMapping: { table: "DTOKHAIMD", column: "SO_HDTM" },
	},
	{
		sectionKey: "invoice",
		sectionLabel: "Hóa đơn",
		appPath: "cdsInfo.commercialInvoiceDate",
		label: "Ngày phát hành hóa đơn",
		inputType: "date",
		importance: "required",
		requiredFor: ["NHAP", "XUAT"],
		hanMapping: { table: "DTOKHAIMD", column: "NGAY_HDTM" },
	},
	{
		sectionKey: "invoice",
		sectionLabel: "Hóa đơn",
		appPath: "cdsInfo.totalInvoiceValue",
		label: "Tổng trị giá hóa đơn",
		inputType: "number",
		importance: "required",
		requiredFor: ["NHAP", "XUAT"],
		hanMapping: { table: "DTOKHAIMD", column: "TONGTG_HDTM" },
	},
	{
		sectionKey: "invoice",
		sectionLabel: "Hóa đơn",
		appPath: "cdsInfo.paymentMethod",
		label: "Phương thức thanh toán",
		inputType: "select",
		importance: "required",
		requiredFor: ["NHAP", "XUAT"],
		lookup: { type: "fieldOptions", key: "paymentMethod" },
		hanMapping: { table: "DTOKHAIMD", column: "MA_PTTT" },
	},
	{
		sectionKey: "invoice",
		sectionLabel: "Hóa đơn",
		appPath: "cdsInfo.invoicePriceCondition",
		label: "Điều kiện giá hóa đơn",
		inputType: "select",
		importance: "required",
		requiredFor: ["NHAP", "XUAT"],
		lookup: { type: "fieldOptions", key: "invoicePriceCondition" },
		hanMapping: { table: "DTOKHAIMD", column: "MA_GH" },
	},
	{
		sectionKey: "invoice",
		sectionLabel: "Hóa đơn",
		appPath: "cdsInfo.invoiceCurrency",
		label: "Mã đồng tiền hóa đơn",
		inputType: "select",
		importance: "required",
		requiredFor: ["NHAP", "XUAT"],
		lookup: { type: "fieldOptions", key: "invoiceCurrency" },
		hanMapping: { table: "DTOKHAIMD", column: "MA_NT" },
	},
	{
		sectionKey: "invoice",
		sectionLabel: "Hóa đơn",
		appPath: "cdsInfo.taxableValueCurrencyCode",
		label: "Mã tiền trị giá tính thuế",
		inputType: "select",
		importance: "required",
		visibleFor: ["NHAP", "XUAT"],
		requiredFor: ["NHAP", "XUAT"],
		lookup: { type: "fieldOptions", key: "taxableValueCurrencyCode" },
		hanMapping: { table: "DTOKHAIMD", column: "MA_NT_TGTT" },
	},
	{
		sectionKey: "invoice",
		sectionLabel: "Hóa đơn",
		appPath: "cdsInfo.valuationDeclarationTypeCode",
		label: "Mã phân loại khai trị giá",
		inputType: "select",
		importance: "required",
		visibleFor: ["NHAP", "XUAT"],
		requiredFor: ["NHAP", "XUAT"],
		lookup: { type: "fieldOptions", key: "valuationDeclarationTypeCode" },
		hanMapping: {
			NHAP: { table: "DTOKHAIMD_VNACCS", column: "MA_KHAI_TRGIA" },
			XUAT: { table: "DTOKHAIMD_VNACCS", column: "MA_PL_NOP_THUE" },
		},
	},
	{
		sectionKey: "invoice",
		sectionLabel: "Hóa đơn",
		appPath: "cdsInfo.taxPayer",
		label: "Mã người nộp thuế",
		inputType: "select",
		importance: "required",
		visibleFor: ["NHAP", "XUAT"],
		requiredFor: ["NHAP", "XUAT"],
		lookup: { type: "fieldOptions", key: "taxPayer" },
		hanMapping: { table: "DTOKHAIMD_VNACCS", column: "MA_NGUOI_NOP_THUE" },
	},
	{
		sectionKey: "invoice",
		sectionLabel: "Hóa đơn",
		appPath: "cdsInfo.releaseBeforePermitCode",
		label: "Mã lý do đề nghị BP",
		inputType: "select",
		importance: "optional",
		visibleFor: ["NHAP"],
		lookup: { type: "fieldOptions", key: "releaseBeforePermitCode" },
		hanMapping: { table: "DTOKHAIMD_VNACCS", column: "MA_LY_DO_BP" },
	},
	{
		sectionKey: "invoice",
		sectionLabel: "Hóa đơn",
		appPath: "cdsInfo.taxPaymentDeadlineCode",
		label: "Mã xác định thời hạn nộp thuế",
		inputType: "select",
		importance: "required",
		visibleFor: ["NHAP", "XUAT"],
		requiredFor: ["NHAP", "XUAT"],
		lookup: { type: "fieldOptions", key: "taxPaymentDeadlineCode" },
		hanMapping: { table: "DTOKHAIMD", column: "MA_THOI_HAN_NOP_THUE" },
	},
	{
		sectionKey: "general",
		sectionLabel: "Thông tin tờ khai",
		appPath: "cdsInfo.cargoClassificationCode",
		label: "Mã phân loại hàng hóa",
		inputType: "text",
		importance: "recommended",
		visibleFor: ["NHAP", "XUAT"],
		notes: [
			"Chỉ khai khi hàng hóa thuộc một trong các nhóm đặc thù A-K theo quy định hiện hành.",
			'Mã "J" chỉ dùng khi có văn bản riêng của Chính phủ; hàng hóa thông thường không chọn mã này.',
			"Đây là một trong các chỉ tiêu không được khai sửa sau khi khai chính thức, cần xác nhận đúng trước khi đăng ký.",
		],
		hanMapping: { table: "DTOKHAIMD_VNACCS2", column: "MA_PHAN_LOAI_HH" },
	},
	{
		sectionKey: "shipment",
		sectionLabel: "Vận đơn",
		appPath: "cdsInfo.warehouseLocationCode",
		label: "Mã địa điểm lưu kho",
		inputType: "text",
		importance: "recommended",
		visibleFor: ["NHAP", "XUAT"],
		requiredFor: ["XUAT"],
		hanMapping: { table: "DTOKHAIMD_VNACCS2", column: "MA_DD_LUU_KHO" },
	},
	{
		sectionKey: "shipment",
		sectionLabel: "Vận đơn",
		appPath: "cdsInfo.loadingLocationCode",
		label: "Mã địa điểm xếp hàng",
		inputType: "text",
		importance: "recommended",
		visibleFor: ["NHAP", "XUAT"],
		requiredFor: ["NHAP"],
		hanMapping: {
			NHAP: { table: "DTOKHAIMD", column: "MA_CANGNN" },
			XUAT: { table: "DTOKHAIMD", column: "MA_CK" },
		},
	},
	{
		sectionKey: "shipment",
		sectionLabel: "Vận đơn",
		appPath: "cdsInfo.unloadingLocationCode",
		label: "Mã địa điểm dỡ hàng / nhận hàng cuối cùng",
		inputType: "text",
		importance: "recommended",
		visibleFor: ["NHAP", "XUAT"],
		requiredFor: ["XUAT"],
		hanMapping: {
			XUAT: { table: "DTOKHAIMD", column: "MA_CANGNN" },
		},
	},
	{
		sectionKey: "shipment",
		sectionLabel: "Vận đơn",
		appPath: "cdsInfo.transportVehicleCode",
		label: "Mã phương tiện vận chuyển",
		inputType: "text",
		importance: "recommended",
		visibleFor: ["NHAP", "XUAT"],
		requiredFor: ["XUAT"],
		hanMapping: { table: "DTOKHAIMD", column: "MA_PTVT" },
	},
	{
		sectionKey: "shipment",
		sectionLabel: "Vận đơn",
		appPath: "cdsInfo.packageMarks",
		label: "Ký hiệu và số hiệu",
		inputType: "text",
		importance: "recommended",
		visibleFor: ["NHAP", "XUAT"],
		hanMapping: { table: "DTOKHAIMD", column: "KY_HIEU_SO_HIEU" },
		notes: [
			"Luồng xuất khẩu hiện cảnh báo nếu trường này trống trước khi đăng ký.",
		],
	},
	{
		sectionKey: "contract",
		sectionLabel: "Hợp đồng",
		appPath: "cdsInfo.contractNumber",
		label: "Số hợp đồng",
		inputType: "text",
		importance: "recommended",
		visibleFor: ["NHAP", "XUAT"],
		requiredFor: ["XUAT"],
		hanMapping: { table: "DTOKHAIMD", column: "SO_HD" },
	},
	{
		sectionKey: "contract",
		sectionLabel: "Hợp đồng",
		appPath: "cdsInfo.contractDate",
		label: "Ngày hợp đồng",
		inputType: "date",
		importance: "recommended",
		visibleFor: ["NHAP", "XUAT"],
		requiredFor: ["XUAT"],
		hanMapping: { table: "DTOKHAIMD", column: "NGAY_HD" },
	},
	{
		sectionKey: "contract",
		sectionLabel: "Hợp đồng",
		appPath: "cdsInfo.contractGoodsDate",
		label: "Ngày hết hạn hợp đồng",
		inputType: "date",
		importance: "optional",
		visibleFor: ["NHAP", "XUAT"],
		hanMapping: { table: "DTOKHAIMD", column: "NGAY_HHHD" },
	},
	{
		sectionKey: "other",
		sectionLabel: "Thông tin khác",
		appPath: "cdsInfo.note",
		label: "Phần ghi chú",
		inputType: "text",
		importance: "optional",
		visibleFor: ["NHAP", "XUAT"],
		hanMapping: { table: "DDS_CONT_TK", column: "NOTE" },
	},
	{
		sectionKey: "other",
		sectionLabel: "Thông tin khác",
		appPath: "cdsInfo.internalBusinessManagementNumber",
		label: "Số quản lý của nội bộ doanh nghiệp",
		inputType: "text",
		importance: "optional",
		visibleFor: ["NHAP", "XUAT"],
		hanMapping: { table: "DTOKHAIMD_VNACCS", column: "MA_QLY_USER" },
	},
	{
		sectionKey: "cargo",
		sectionLabel: "Danh sách hàng",
		appPath: "cargoList[].customCode",
		label: "Mã hàng khai báo",
		inputType: "text",
		importance: "recommended",
		hanMapping: { table: "DHANGMDDK", column: "MA_HANGKB" },
		notes: [
			"Validation bắt buộc với hầu hết mã loại hình; riêng A12 và B11 cho phép trống theo dữ liệu HAN_2024.",
			"Nếu MA_HANGKB trống, loader sẽ fallback sang MA_HANG.",
		],
	},
	{
		sectionKey: "cargo",
		sectionLabel: "Danh sách hàng",
		appPath: "cargoList[].hsCode",
		label: "Mã HS",
		inputType: "text",
		importance: "recommended",
		hanMapping: { table: "DHANGMDDK", column: "MA_HTS" },
		notes: [
			"Hiện web app chỉ cảnh báo nếu trống, nhưng nên gửi để đối chiếu và khai thuế.",
		],
	},
	{
		sectionKey: "cargo",
		sectionLabel: "Danh sách hàng",
		appPath: "cargoList[].vietnameseName",
		label: "Tên hàng tiếng Việt",
		inputType: "text",
		importance: "required",
		requiredFor: ["NHAP", "XUAT"],
		hanMapping: { table: "DHANGMDDK", column: "TEN_HANG" },
	},
	{
		sectionKey: "cargo",
		sectionLabel: "Danh sách hàng",
		appPath: "cargoList[].originalCargoName",
		label: "Tên hàng trên chứng từ",
		inputType: "text",
		importance: "recommended",
		hanMapping: { table: "DHANGMDDK", column: "TEN_HANG_E" },
		notes: ["Nếu TEN_HANG_E trống, loader sẽ fallback sang TEN_HANG."],
	},
	{
		sectionKey: "cargo",
		sectionLabel: "Danh sách hàng",
		appPath: "cargoList[].originalCountry",
		label: "Nước xuất xứ",
		inputType: "text",
		importance: "required",
		requiredFor: ["NHAP", "XUAT"],
		hanMapping: { table: "DHANGMDDK", column: "NUOC_XX" },
	},
	{
		sectionKey: "cargo",
		sectionLabel: "Danh sách hàng",
		appPath: "cargoList[].unit",
		label: "Đơn vị tính",
		inputType: "text",
		importance: "required",
		requiredFor: ["NHAP", "XUAT"],
		hanMapping: { table: "DHANGMDDK", column: "DVT_HTS" },
		notes: ["Nếu DVT_HTS trống, loader sẽ fallback sang MA_DVT."],
	},
	{
		sectionKey: "cargo",
		sectionLabel: "Danh sách hàng",
		appPath: "cargoList[].qty",
		label: "Số lượng",
		inputType: "number",
		importance: "required",
		requiredFor: ["NHAP", "XUAT"],
		hanMapping: { table: "DHANGMDDK", column: "LUONG_HTS" },
		notes: ["Nếu LUONG_HTS trống, loader sẽ fallback sang LUONG."],
	},
	{
		sectionKey: "cargo",
		sectionLabel: "Danh sách hàng",
		appPath: "cargoList[].unitPrice",
		label: "Đơn giá",
		inputType: "number",
		importance: "recommended",
		hanMapping: { table: "DHANGMDDK", column: "DONGIA_HTS" },
		notes: [
			"Loader ưu tiên DONGIA_HTS, sau đó fallback sang DGIA_HDTM rồi DGIA_KB.",
			"Mỗi dòng hàng cần có unitPrice hoặc totalPrice.",
		],
	},
	{
		sectionKey: "cargo",
		sectionLabel: "Danh sách hàng",
		appPath: "cargoList[].totalPrice",
		label: "Trị giá dòng hàng",
		inputType: "number",
		importance: "recommended",
		hanMapping: { table: "DHANGMDDK", column: "TRIGIA_HDTM" },
		notes: [
			"Nếu TRIGIA_HDTM trống, loader sẽ fallback sang TRIGIA_KB.",
			"Mỗi dòng hàng cần có totalPrice hoặc unitPrice.",
		],
	},
	{
		sectionKey: "cargo",
		sectionLabel: "Danh sách hàng",
		appPath: "cargoList[].dutyReductionCode",
		label: "Mã miễn giảm",
		inputType: "text",
		importance: "optional",
		hanMapping: { table: "DHANGMDDK", column: "MA_PHU" },
	},
	{
		sectionKey: "cargo",
		sectionLabel: "Danh sách hàng",
		appPath: "cargoList[].imExDutyExemptionCode",
		label: "Mã miễn giảm / không chịu thuế XNK",
		inputType: "text",
		importance: "optional",
		hanMapping: { table: "DHANGMDDK", column: "MIENTHUE_MA" },
	},
	{
		sectionKey: "cargo",
		sectionLabel: "Danh sách hàng",
		appPath: "cargoList[].imExDutyExemptionCondition",
		label: "Điều kiện miễn giảm thuế XNK",
		inputType: "text",
		importance: "optional",
		hanMapping: { table: "DHANGMDDK", column: "DK_MIEN_GIAM_THUE" },
	},
	{
		sectionKey: "cargo",
		sectionLabel: "Danh sách hàng",
		appPath: "cargoList[].imExDutyExemptionAmount",
		label: "Tiền miễn giảm thuế XNK",
		inputType: "number",
		importance: "optional",
		hanMapping: { table: "DHANGMDDK", column: "MIENTHUE_THUE_GIAM" },
	},
	{
		sectionKey: "cargo",
		sectionLabel: "Danh sách hàng",
		appPath: "cargoList[].qty2",
		label: "Số lượng 2",
		inputType: "number",
		importance: "optional",
		hanMapping: { table: "DHANGMDDK", column: "LUONG2" },
	},
	{
		sectionKey: "cargo",
		sectionLabel: "Danh sách hàng",
		appPath: "cargoList[].unit2",
		label: "Đơn vị tính 2",
		inputType: "text",
		importance: "optional",
		hanMapping: { table: "DHANGMDDK", column: "MA_DVT2" },
	},
	{
		sectionKey: "cargo",
		sectionLabel: "Danh sách hàng",
		appPath: "cargoList[].importTaxCode",
		label: "Mã biểu thuế nhập khẩu",
		inputType: "text",
		importance: "recommended",
		hanMapping: { table: "DHANGMDDK", column: "TS_XNK_MA_BT" },
		notes: [
			"Trường này có thể vẫn xuất hiện ở dữ liệu HAN của một số luồng xuất khẩu.",
		],
	},
	{
		sectionKey: "cargo",
		sectionLabel: "Danh sách hàng",
		appPath: "cargoList[].importTaxRate",
		label: "Thuế suất nhập khẩu",
		inputType: "number",
		importance: "recommended",
		hanMapping: { table: "DHANGMDDK", column: "TS_XNK" },
	},
	{
		sectionKey: "cargo",
		sectionLabel: "Danh sách hàng",
		appPath: "cargoList[].importTaxAmount",
		label: "Tiền thuế nhập khẩu",
		inputType: "number",
		importance: "recommended",
		hanMapping: { table: "DHANGMDDK", column: "THUE_XNK" },
	},
	{
		sectionKey: "cargo",
		sectionLabel: "Danh sách hàng",
		appPath: "cargoList[].vatTaxCode",
		label: "Mã biểu thuế VAT",
		inputType: "text",
		importance: "recommended",
		hanMapping: { table: "DHANGMDDK", column: "TS_VAT_MA_BT" },
		notes: [
			"Trường này có thể vẫn xuất hiện ở dữ liệu HAN của một số luồng xuất khẩu.",
		],
	},
	{
		sectionKey: "cargo",
		sectionLabel: "Danh sách hàng",
		appPath: "cargoList[].vatTaxRate",
		label: "Thuế suất VAT",
		inputType: "number",
		importance: "recommended",
		hanMapping: { table: "DHANGMDDK", column: "TS_VAT" },
	},
	{
		sectionKey: "cargo",
		sectionLabel: "Danh sách hàng",
		appPath: "cargoList[].vatTaxAmount",
		label: "Tiền thuế VAT",
		inputType: "number",
		importance: "recommended",
		hanMapping: { table: "DHANGMDDK", column: "THUE_VAT" },
	},
];

const CDS_INFO_FIELD_USAGE = new Map<string, CdsInfoFieldUsage>(
	FIELD_DEFINITIONS.flatMap((definition) => {
		if (!definition.appPath.startsWith("cdsInfo.")) {
			return [];
		}

		const fieldKey = definition.appPath.slice("cdsInfo.".length).trim();
		if (!fieldKey) {
			return [];
		}

		return [
			[
				fieldKey,
				{
					fieldKey,
					visibleFor: definition.visibleFor ? [...definition.visibleFor] : null,
					requiredFor: definition.requiredFor
						? [...definition.requiredFor]
						: [],
					importance: definition.importance ?? "optional",
				},
			] as const,
		];
	}),
);

export function getCdsInfoFieldUsage(fieldKey: string) {
	return CDS_INFO_FIELD_USAGE.get(fieldKey) ?? null;
}

export function isCdsInfoFieldVisibleForOperation(
	fieldKey: string,
	operationType: FollowUpOperationType | null,
) {
	if (!operationType) {
		return true;
	}

	const usage = getCdsInfoFieldUsage(fieldKey);
	if (!usage?.visibleFor) {
		return true;
	}

	return usage.visibleFor.includes(operationType);
}

export function isCdsInfoFieldRequiredForOperation(
	fieldKey: string,
	operationType: FollowUpOperationType | null,
) {
	if (!operationType) {
		return false;
	}

	const usage = getCdsInfoFieldUsage(fieldKey);
	if (!usage) {
		return false;
	}

	return usage.requiredFor.includes(operationType);
}
