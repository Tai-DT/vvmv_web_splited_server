// cds-tab-configs.ts – tab configurations extracted from cds-info-panel.tsx

import { FOLLOWUP_CDS_INFO_SECTION_CONFIGS } from "../panel-config";
import type { CdsInfoTabConfig } from "./cds-types";
import { createCompositeSection, getSection } from "./cds-utils";

export const IMPORT_TAB_CONFIGS: CdsInfoTabConfig[] = [
	{
		id: "ai-document",
		label: "AI chứng từ",
		description:
			"Khu vực dành cho AI chứng từ sẽ được bổ sung tại đây để thao tác trước khi vào tab thông tin chung.",
		kind: "form",
		sections: [],
	},
	{
		id: "import-general-1",
		label: "Thông tin chung",
		description:
			"Tờ khai nhập khẩu, đơn vị xuất nhập khẩu và vận đơn của lô hàng.",
		kind: "form",
		sections: [
			createCompositeSection("Thông tin tờ khai nhập khẩu", [
				{
					sectionTitle: "Thông tin tờ khai",
					keys: [
						{ key: "declarationNumber", disabled: true },
						{ key: "declarationSequenceNumber", disabled: true },
						{ key: "firstDeclarationNumber", disabled: true },
						{ key: "branchNumberPart1", disabled: true },
						{ key: "branchNumberPart2", disabled: true },
						"correspondingDeclarationNumber",
						"operationCode",
						{ key: "cargoClassificationCode", disabled: true },
						"customsCode",
						"declarationProcessingDeptCode",
						"transportMethodCode",
						"expectedDeclarationDate",
						"reExportDeadline",
						"personOrganizationClassification",
					],
				},
			]),
			createCompositeSection("Đơn vị xuất nhập khẩu", [
				{
					sectionTitle: "Người nhập khẩu / xuất khẩu",
					keys: [
						{ key: "importerCode", disabled: true },
						"importExportUnitName",
						"importerPostalCode",
						"importExportBusinessAddress",
						"importerPhone",
						"entrustedImporterCode",
						"entrustedImporterName",
						"exporterCode",
						"customsDeclarantCode",
					],
				},
				{
					sectionTitle: "Đối tác",
					keys: [
						"partnerName",
						"partnerAddress1",
						"partnerAddress2",
						"partnerAddress3",
						"partnerAddress4",
						"exportCountryCode",
					],
				},
			]),
			createCompositeSection("Vận đơn", [
				{
					sectionTitle: "Thông tin Logistics",
					keys: [
						"billOfLading",
						"packageQuantity",
						"packageType",
						"grossWeightTotal",
						"weightUnit",
						"warehouseLocationCode",
						"warehouseLocationName",
						"unloadingLocationCode",
						"unloadingLocationName",
						"loadingLocationCode",
						"loadingLocationName",
						"transportVehicleCode",
						"transportVehicleName",
						"departureArrivalDate",
						"containerQuantity",
						"packageMarks",
					],
				},
			]),
		],
	},
	{
		id: "import-general-2",
		label: "Thông tin chung 2",
		description:
			"Hóa đơn, trị giá, thuế, hợp đồng và các thông tin bổ sung khác.",
		kind: "form",
		sections: [
			getSection("Thông tin hóa đơn"),
			getSection("Khai trị giá"),
			getSection("Thông tin thuế"),
			getSection("Hợp đồng"),
			getSection("Khác"),
		],
	},
	{
		id: "cargo-list",
		label: "Danh sách hàng",
		description: "Đối chiếu danh sách hàng nhập đã lưu cho follow-up này.",
		kind: "cargo",
		sections: [],
	},
	{
		id: "import-customs-instructions",
		label: "Chỉ thị của Hải quan",
		description:
			"Khu vực chỉ thị riêng của Hải quan sẽ được tách thành tab độc lập giống bố cục ECUS.",
		kind: "form",
		sections: [],
	},
	{
		id: "import-processing-results",
		label: "Kết quả xử lý tờ khai",
		description:
			"Khu vực theo dõi kết quả xử lý tờ khai sẽ được hiển thị theo tab riêng.",
		kind: "form",
		sections: [],
	},
	{
		id: "import-management",
		label: "Quản lý tờ khai",
		description:
			"Các nghiệp vụ quản lý tờ khai sau khi khai báo sẽ được gom vào tab riêng.",
		kind: "form",
		sections: [],
	},
];

export const EXPORT_TAB_CONFIGS: CdsInfoTabConfig[] = [
	{
		id: "ai-document",
		label: "AI chứng từ",
		description:
			"Khu vực dành cho AI chứng từ sẽ được bổ sung tại đây để thao tác trước khi vào tab thông tin chung.",
		kind: "form",
		sections: [],
	},
	{
		id: "export-general",
		label: "Thông tin chung",
		description:
			"Tờ khai xuất, doanh nghiệp, vận đơn và các nhóm thông tin nền theo bố cục ECUS.",
		kind: "form",
		sections: [
			createCompositeSection("Thông tin tờ khai", [
				{
					sectionTitle: "Thông tin tờ khai",
					keys: [
						{ key: "declarationNumber", disabled: true },
						{ key: "declarationSequenceNumber", label: "STT", disabled: true },
						{ key: "firstDeclarationNumber", disabled: true },
						{ key: "branchNumberPart1", label: "Số nhánh 1", disabled: true },
						{ key: "branchNumberPart2", label: "Số nhánh 2", disabled: true },
						"correspondingDeclarationNumber",
						{ key: "operationCode", label: "Mã loại hình" },
						{ key: "cargoClassificationCode", disabled: true },
						{ key: "customsCode", label: "Cơ quan Hải quan" },
						{
							key: "declarationProcessingDeptCode",
							label: "Mã bộ phận xử lý tờ khai",
						},
						{
							key: "personOrganizationClassification",
							label: "Cá nhân / tổ chức",
						},
						{ key: "reExportDeadline", label: "Thời hạn tái nhập khẩu" },
						"transportMethodCode",
						{
							key: "expectedDeclarationDate",
							label: "Ngày khai báo (dự kiến)",
						},
					],
				},
			]),
			createCompositeSection("Đơn vị xuất nhập khẩu", [
				{
					sectionTitle: "Người nhập khẩu / xuất khẩu",
					keys: [
						{
							key: "importerCode",
							label: "Mã người xuất khẩu",
							disabled: true,
						},
						{ key: "importExportUnitName", label: "Tên người xuất khẩu" },
						{
							key: "importerPostalCode",
							label: "Mã bưu chính người xuất khẩu",
						},
						{
							key: "importExportBusinessAddress",
							label: "Địa chỉ người xuất khẩu",
						},
						{ key: "importerPhone", label: "Điện thoại người xuất khẩu" },
						{
							key: "entrustedImporterCode",
							label: "Mã người ủy thác xuất khẩu",
						},
						{
							key: "entrustedImporterName",
							label: "Tên người ủy thác xuất khẩu",
						},
						{ key: "exporterCode", label: "Mã người nhập khẩu" },
						{
							key: "exporterPostalCode",
							label: "Mã bưu chính người nhập khẩu",
						},
					],
				},
				{
					sectionTitle: "Đối tác",
					keys: [
						{ key: "partnerName", label: "Tên người nhập khẩu" },
						{ key: "partnerAddress1", label: "Địa chỉ người nhập khẩu 1" },
						{ key: "partnerAddress2", label: "Địa chỉ người nhập khẩu 2" },
						{ key: "partnerAddress3", label: "Địa chỉ người nhập khẩu 3" },
						{ key: "partnerAddress4", label: "Địa chỉ người nhập khẩu 4" },
						{ key: "exportCountryCode", label: "Mã nước" },
					],
				},
				{
					sectionTitle: "Người nhập khẩu / xuất khẩu",
					keys: [
						{ key: "customsDeclarantCode", label: "Mã người khai Hải quan" },
					],
				},
			]),
			createCompositeSection("Vận đơn", [
				{
					sectionTitle: "Thông tin Logistics",
					keys: [
						{ key: "billOfLading", label: "Số vận đơn" },
						"packageQuantity",
						"grossWeightTotal",
						"weightUnit",
						{
							key: "warehouseLocationCode",
							label: "Mã địa điểm lưu kho hàng chờ thông quan dự kiến",
						},
						{
							key: "warehouseLocationName",
							label: "Tên địa điểm lưu kho hàng chờ thông quan dự kiến",
						},
						{
							key: "unloadingLocationCode",
							label: "Mã địa điểm nhận hàng cuối cùng",
						},
						{
							key: "unloadingLocationName",
							label: "Tên địa điểm nhận hàng cuối cùng",
						},
						{ key: "loadingLocationCode", label: "Mã địa điểm xếp hàng" },
						{ key: "loadingLocationName", label: "Tên địa điểm xếp hàng" },
						{ key: "transportVehicleCode", label: "Mã phương tiện vận chuyển" },
						{
							key: "transportVehicleName",
							label: "Tên phương tiện vận chuyển",
						},
						{ key: "departureArrivalDate", label: "Ngày hàng đi dự kiến" },
						{ key: "packageMarks", label: "Ký hiệu và số hiệu" },
					],
				},
			]),
			createCompositeSection("Thông tin hợp đồng", [
				{
					sectionTitle: "Hợp đồng",
					keys: [
						{ key: "contractNumber", label: "Số hợp đồng" },
						{ key: "contractDate", label: "Ngày hợp đồng" },
						{ key: "contractGoodsDate", label: "Ngày hết hạn" },
					],
				},
			]),
			createCompositeSection("Chứng từ giấy phép xuất khẩu", []),
			createCompositeSection("Thông tin hóa đơn", [
				{
					sectionTitle: "Thông tin hóa đơn",
					keys: [
						"invoiceFormClassificationCode",
						"electronicInvoiceReceiptNumber",
						{ key: "commercialInvoice", label: "Số hóa đơn" },
						"paymentMethod",
						{ key: "commercialInvoiceDate", label: "Ngày phát hành" },
						"invoicePriceCondition",
						"invoiceClassificationCode",
						{ key: "invoiceCurrency", label: "Mã đồng tiền của hóa đơn" },
						{ key: "totalInvoiceValue", label: "Tổng trị giá hóa đơn" },
						{ key: "totalTaxableValue", label: "Trị giá tính thuế" },
						"taxableValueCurrencyCode",
					],
				},
			]),
			createCompositeSection("Thuế và bảo lãnh", [
				{
					sectionTitle: "Khai trị giá",
					keys: ["valuationDeclarationTypeCode"],
				},
				{
					sectionTitle: "Thông tin thuế",
					keys: [
						"taxPayer",
						"releaseBeforePermitCode",
						"taxSubstituteBankCode",
						"creditLimitIssueYear",
						"creditLimitDocumentSymbol",
						"creditLimitDocumentNumber",
						"taxPaymentDeadlineCode",
						"guaranteeBankCode",
						"guaranteeDocumentSymbol",
						"guaranteeDocumentNumber",
					],
				},
			]),
			createCompositeSection("Thông tin đính kèm", []),
			createCompositeSection("Thông tin vận chuyển", [
				{
					sectionTitle: "Thông tin vận chuyển",
					keys: [
						{
							key: "transportDepartureDate",
							label: "Ngày khởi hành vận chuyển",
						},
						{
							key: "taxDestinationLocation",
							label: "Mã địa điểm đích cho vận chuyển bảo thuế",
						},
						{
							key: "estimatedArrivalAtDestinationDate",
							label: "Ngày đến địa điểm đích",
						},
					],
				},
			]),
			createCompositeSection("Thông tin khác", [
				{
					sectionTitle: "Thông tin khác",
					keys: ["note", "internalBusinessManagementNumber"],
				},
			]),
		],
	},
	{
		id: "export-container",
		label: "Thông tin Container",
		description: "Địa điểm xếp hàng và danh sách số container của lô hàng.",
		kind: "container",
		sections: [
			createCompositeSection("Thông tin container", [
				{
					sectionTitle: "Thông tin Logistics",
					keys: [
						"billOfLading",
						"packageQuantity",
						"packageType",
						"grossWeightTotal",
						"weightUnit",
						"containerQuantity",
						"warehouseLocationCode",
						"warehouseLocationName",
						"unloadingLocationCode",
						"unloadingLocationName",
						"loadingLocationCode",
						"loadingLocationName",
						"transportVehicleCode",
						"transportVehicleName",
						"departureArrivalDate",
						"packageMarks",
					],
				},
			]),
			createCompositeSection("Điều vận container", [
				{
					sectionTitle: "Thông tin thuế",
					keys: [
						"taxDestinationLocation",
						"estimatedArrivalAtDestinationDate",
						"transportDepartureDate",
					],
				},
				{
					sectionTitle: "Khác",
					keys: [
						"truckLoadingLocationCode",
						"truckLoadingLocationName",
						"truckLoadingLocationAddress",
					],
				},
			]),
		],
	},
	{
		id: "cargo-list",
		label: "Danh sách hàng",
		description: "Đối chiếu danh sách hàng xuất đã lưu cho follow-up này.",
		kind: "cargo",
		sections: [],
	},
	{
		id: "export-customs-indicators",
		label: "Chỉ tiêu của Hải quan",
		description:
			"Nhóm chỉ tiêu bổ sung theo yêu cầu của Hải quan sẽ được tách riêng giống bố cục ECUS.",
		kind: "form",
		sections: [],
	},
	{
		id: "export-processing-results",
		label: "Kết quả xử lý tờ khai",
		description:
			"Khu vực theo dõi kết quả xử lý tờ khai sẽ được hiển thị theo tab riêng.",
		kind: "form",
		sections: [],
	},
	{
		id: "export-management",
		label: "Quản lý tờ khai",
		description:
			"Các nghiệp vụ quản lý tờ khai sau khi khai báo sẽ được gom vào tab riêng.",
		kind: "form",
		sections: [],
	},
];

export const GENERIC_TAB_CONFIGS: CdsInfoTabConfig[] = [
	{
		id: "ai-document",
		label: "AI chứng từ",
		description:
			"Khu vực dành cho AI chứng từ sẽ được bổ sung tại đây để thao tác trước khi vào tab thông tin chung.",
		kind: "form",
		sections: [],
	},
	{
		id: "general",
		label: "Thông tin chung",
		description:
			"Bộ trường CDS tổng quát khi chưa xác định được loại xuất nhập.",
		kind: "form",
		sections: FOLLOWUP_CDS_INFO_SECTION_CONFIGS,
	},
	{
		id: "cargo-list",
		label: "Danh sách hàng",
		description: "Danh sách hàng hiện có của follow-up để đối chiếu nhanh.",
		kind: "cargo",
		sections: [],
	},
];

// Helper used in the main component
export function getTabsForOperationType(
	operationType: string | null,
): CdsInfoTabConfig[] {
	if (operationType === "NHAP") {
		return IMPORT_TAB_CONFIGS;
	}

	if (operationType === "XUAT") {
		return EXPORT_TAB_CONFIGS;
	}

	return GENERIC_TAB_CONFIGS;
}

// Helper used in the main component (re‑exported for convenience)
export { getSection } from "./cds-utils";
