// cds-field-labels.ts – field label map extracted from cds-info-panel.tsx (Phase 1)

import { FOLLOWUP_CDS_INFO_SECTION_CONFIGS } from "../panel-config";

export const CDS_FIELD_LABELS = new Map<string, string>([
	...FOLLOWUP_CDS_INFO_SECTION_CONFIGS.flatMap((section) =>
		section.fields.map((field) => [field.key, field.label] as const),
	),
	["businessTypeGroup", "Nhóm loại hình"],
	["declarationNumber", "Số tờ khai"],
	["declarationSequenceNumber", "STT tờ khai"],
	["firstDeclarationNumber", "Số tờ khai đầu tiên"],
	["branchNumberPart1", "Số nhánh 1"],
	["branchNumberPart2", "Số nhánh 2"],
	["correspondingDeclarationNumber", "Số tờ khai tạm nhập tái xuất tương ứng"],
	["cargoClassificationCode", "Mã phân loại hàng hóa"],
	["expectedDeclarationDate", "Ngày khai báo dự kiến (nếu có)"],
	["reExportDeadline", "Thời hạn tái xuất"],
	["exporterCode", "Mã đối tác VNACCS"],
	["exporterPostalCode", "Mã bưu chính đối tác"],
	["electronicInvoiceReceiptNumber", "Số tiếp nhận hóa đơn điện tử"],
	["licenseNumber", "Số giấy phép"],
	["importLicense", "Giấy phép nhập khẩu"],
	["otherLegalDocumentCode", "Mã văn bản pháp quy khác"],
	["taxSubstituteBankCode", "Mã ngân hàng trả thuế thay"],
	["guaranteeBankCode", "Mã ngân hàng bảo lãnh"],
	["creditLimitIssueYear", "Năm phát hành hạn mức"],
	["creditLimitDocumentSymbol", "Ký hiệu chứng từ hạn mức"],
	["creditLimitDocumentNumber", "Số chứng từ hạn mức"],
	["guaranteeDocumentSymbol", "Ký hiệu chứng từ bảo lãnh"],
	["guaranteeDocumentNumber", "Số chứng từ bảo lãnh"],
	["insuranceRegistrationNumber", "Số đăng ký bảo hiểm"],
	["valuationSummaryReceiptNumber", "Số tiếp nhận tờ khai trị giá tổng hợp"],
	["billItems", "Danh sách vận đơn"],
	["valuationAdjustments", "Khoản điều chỉnh trị giá"],
	["electronicAttachments", "Đính kèm điện tử"],
	["transportSchedules", "Lịch vận chuyển"],
	["truckLoadingLocationAddress", "Địa chỉ địa điểm xếp hàng lên xe"],
]);
