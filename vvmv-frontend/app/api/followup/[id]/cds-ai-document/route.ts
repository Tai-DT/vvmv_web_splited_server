import mammoth from "mammoth";
import { type NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import {
	buildCdsAiDocumentChecklist,
	parseGeminiCdsAiDocumentJson,
	sanitizeCdsAiDocumentResult,
} from "@/lib/followup/cds-ai-document";
import {
	type CdsAiDocumentInputFile,
	extractSupportedDocumentsFromArchive,
	inferDocumentMimeType,
	isArchiveUpload,
} from "@/lib/followup/cds-ai-document-archive";
import { checkFollowUpPermission } from "@/lib/followup/check-permission";
import type { FollowUpOperationType } from "@/lib/followup/operation-type";
import {
	extractGeminiUsageMetrics,
	type GeminiUsageMetadataLike,
} from "@/lib/gemini-usage-metadata";
import { getFileContent } from "@/lib/google-drive/upload";
import type { Prisma } from "@/prisma/client";

export const maxDuration = 300;

/** Server overrides client: GEMINI_CDS_DOCUMENT_MODEL > NEXT_PUBLIC_GEMINI_CDS_DOCUMENT_MODEL > default Flash. */
const DEFAULT_MODEL =
	process.env.GEMINI_CDS_DOCUMENT_MODEL ??
	process.env.NEXT_PUBLIC_GEMINI_CDS_DOCUMENT_MODEL ??
	"gemini-2.5-flash";
const MAX_TEXT_PART_CHARS = 120_000;

/** When set (comma-separated), only these model ids are accepted from the client; otherwise any string is passed through to the Gemini API. */
function normalizeRequestedGeminiModel(requested: string | null): string {
	const fallback = DEFAULT_MODEL;
	if (!requested?.trim()) return fallback;
	const allowRaw = process.env.GEMINI_CDS_DOCUMENT_MODEL_ALLOWLIST?.trim();
	if (!allowRaw) return requested.trim();
	const allowed = new Set(
		allowRaw
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean),
	);
	return allowed.has(requested.trim()) ? requested.trim() : fallback;
}
const MAX_CHAT_TRANSCRIPT_CHARS = 16_000;

function isCdsAiFewShotExamplesEnabled(): boolean {
	const v = process.env.CDS_AI_DOCUMENT_FEW_SHOT;
	return v !== "0" && v !== "false";
}

/** Short Vietnamese examples; disable with CDS_AI_DOCUMENT_FEW_SHOT=0 to save tokens. */
const CDS_AI_FEW_SHOT_BLOCK = `Ví dụ xử lý yêu cầu chat (trả về JSON đúng schema, không markdown):
- "Bỏ #123 trong tên hàng": giữ số dòng; sửa vietnameseName/originalCargoName (bỏ chuỗi trên từng dòng cần sửa).
- "Xóa dòng 3" / "bỏ dòng hàng 3": bỏ phần tử cargo ứng với STT 3, giữ các dòng khác.
- "Thêm 1 dòng theo mẫu: ...": thêm phần tử cargo mới, không xóa dòng cũ nếu không nói rõ.
- Thiếu thông tin: hỏi lại trong assistantMessage (tối đa 2 lựa chọn rõ ràng), warnings bắt đầu bằng "Phần Danh sách hàng:" nếu liên quan dòng hàng.`;

function isCdsAiCompactSystemPrompt(): boolean {
	const v = process.env.CDS_AI_DOCUMENT_COMPACT_PROMPT;
	return v === "1" || v === "true";
}

/** Shorter schema description when CDS_AI_DOCUMENT_COMPACT_PROMPT=true (fewer prompt tokens). */
const CDS_AI_COMPACT_SCHEMA_BLOCK = `Schema JSON (rút gọn — máy chủ chuẩn hóa key/type sau):
{
  "assistantMessage": "Tóm tắt ngắn tiếng Việt",
  "documents": [
    {
      "fileName": "string",
      "documentType": "invoice | packing_list | bill_of_lading | air_waybill | permit | contract | co | other",
      "ocrSummary": "string",
      "extractedFields": ["string"],
      "warnings": ["string"]
    }
  ],
  "cdsInfo": "(object, key camelCase) — toàn bộ trường form CDS: thông tin chung, đối tác, vận đơn, hóa đơn/thuế, kho và địa điểm, đính kèm điện tử, giấy phép, lịch vận chuyển, truckLoadingLocation*, ...",
  "fieldSources": "(object) mỗi key = tên trường cdsInfo; giá trị = [ { fileName, documentType, value } ]",
  "cargoList": [ "(object) dòng hàng: customCode, hsCode, vietnameseName, originalCargoName, qty, unit, unitPrice, thuế, ..." ],
  "warnings": ["string"]
}
Điền đủ fieldSources khi nhiều chứng từ khác nhau cho cùng một trường.`;

type GeminiInlinePart = {
	inline_data: {
		mime_type: string;
		data: string;
	};
};

type GeminiTextPart = { text: string };

function normalizeString(value: unknown): string | null {
	if (value === null || value === undefined) {
		return null;
	}

	const text = String(value).trim();
	return text === "" ? null : text;
}

function normalizeStringList(values: FormDataEntryValue[]): string[] {
	return values.flatMap((value) => {
		if (typeof value !== "string") {
			return [];
		}

		const normalized = normalizeString(value);
		return normalized ? [normalized] : [];
	});
}

function truncateTextContent(
	text: string,
	fileName: string,
): {
	text: string;
	truncationWarningVi: string | null;
} {
	if (text.length <= MAX_TEXT_PART_CHARS) {
		return { text, truncationWarningVi: null };
	}

	return {
		text: `${text.slice(0, MAX_TEXT_PART_CHARS)}\n[Đã cắt bớt nội dung ${fileName} để tránh quá dài cho OCR AI.]`,
		truncationWarningVi: `Phần chứng từ: nội dung "${fileName}" đã bị giới hạn ${MAX_TEXT_PART_CHARS.toLocaleString("vi-VN")} ký tự khi gửi AI; phần cuối tệp có thể chưa được đọc hết.`,
	};
}

async function buildFilePart(input: CdsAiDocumentInputFile): Promise<{
	part: GeminiInlinePart | GeminiTextPart;
	warning: string | null;
	fileName: string;
	mimeType: string;
	fileSize: number;
}> {
	const fileName = input.fileName || "document";
	const mimeType = input.mimeType;
	const buffer = input.buffer;
	const lowerName = fileName.toLowerCase();

	if (mimeType.startsWith("image/") || mimeType === "application/pdf") {
		return {
			part: {
				inline_data: {
					mime_type: mimeType,
					data: buffer.toString("base64"),
				},
			},
			warning: null,
			fileName,
			mimeType,
			fileSize: buffer.length,
		};
	}

	if (
		mimeType ===
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
		mimeType === "application/vnd.ms-excel.sheet.macroenabled.12" ||
		mimeType === "application/vnd.ms-excel" ||
		lowerName.endsWith(".xlsx") ||
		lowerName.endsWith(".xlsm") ||
		lowerName.endsWith(".xls")
	) {
		const workbook = XLSX.read(buffer, { type: "buffer" });
		let content = `[Excel file: ${fileName}]\n`;
		workbook.SheetNames.forEach((sheetName) => {
			content += `\n[Sheet: ${sheetName}]\n`;
			content += `${XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName])}\n`;
		});

		const truncated = truncateTextContent(content, fileName);
		return {
			part: { text: truncated.text },
			warning: truncated.truncationWarningVi,
			fileName,
			mimeType,
			fileSize: buffer.length,
		};
	}

	if (
		mimeType ===
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
		lowerName.endsWith(".docx")
	) {
		const extracted = await mammoth.extractRawText({ buffer });

		const truncated = truncateTextContent(
			`[Word file: ${fileName}]\n${extracted.value}`,
			fileName,
		);

		return {
			part: {
				text: truncated.text,
			},
			warning: truncated.truncationWarningVi,
			fileName,
			mimeType,
			fileSize: buffer.length,
		};
	}

	if (
		mimeType.startsWith("text/") ||
		mimeType === "application/json" ||
		mimeType === "application/xml" ||
		mimeType === "text/xml" ||
		mimeType === "application/rtf" ||
		lowerName.endsWith(".json") ||
		lowerName.endsWith(".xml") ||
		lowerName.endsWith(".txt") ||
		lowerName.endsWith(".csv") ||
		lowerName.endsWith(".log") ||
		lowerName.endsWith(".html") ||
		lowerName.endsWith(".htm") ||
		lowerName.endsWith(".rtf")
	) {
		const truncated = truncateTextContent(
			`[Text file: ${fileName}]\n${buffer.toString("utf8")}`,
			fileName,
		);
		return {
			part: {
				text: truncated.text,
			},
			warning: truncated.truncationWarningVi,
			fileName,
			mimeType,
			fileSize: buffer.length,
		};
	}

	return {
		part: {
			text: `[Metadata only] ${fileName}\nMIME type: ${mimeType}\nLoại file này chưa hỗ trợ OCR trực tiếp trong CDS AI, chỉ dùng metadata để đối chiếu.`,
		},
		warning: `File ${fileName} (${mimeType}) chưa được OCR trực tiếp, cần kiểm tra tay nếu đây là chứng từ chính.`,
		fileName,
		mimeType,
		fileSize: buffer.length,
	};
}

function buildSystemInstruction(
	operationType: FollowUpOperationType | null,
	customPrompt: string | null,
	options?: {
		isDraftRevision?: boolean;
		hasCurrentSnapshot?: boolean;
		hasChatTranscript?: boolean;
	},
) {
	const operationLabel =
		operationType === "NHAP"
			? "nhập khẩu"
			: operationType === "XUAT"
				? "xuất khẩu"
				: "hải quan";
	const revisionMode = options?.isDraftRevision === true;
	const hasCurrentSnapshot = options?.hasCurrentSnapshot === true;
	const hasChatTranscript = options?.hasChatTranscript === true;

	const instructionPrefix = `Bạn là trợ lý AI chứng từ cho hồ sơ CDS ${operationLabel}.
Nhiệm vụ:
1. Đọc tất cả file người dùng tải lên.
2. OCR nội dung quan trọng từ ảnh/PDF, đọc text từ Excel/Word/Text.
3. Trích xuất dữ liệu có thể map vào form CDS và danh sách hàng.
4. Chỉ điền trường khi nhìn thấy tương đối rõ trên chứng từ, không được đoán.
${revisionMode ? "5. Nếu đã có draftResult hiện tại, hãy CHỈNH LẠI kết quả đã bóc theo yêu cầu mới của người dùng thay vì khởi tạo lại từ đầu. Giữ nguyên các phần đã đúng nếu người dùng không yêu cầu thay đổi." : ""}
${hasCurrentSnapshot ? "5. Nếu không có file mới nhưng có block dữ liệu web hiện tại, hãy xử lý yêu cầu người dùng trực tiếp trên dữ liệu đó và trả về cdsInfo/cargoList đã cập nhật theo đúng yêu cầu. Không xóa dữ liệu hiện có nếu người dùng không yêu cầu." : ""}

Quy tắc:
${hasChatTranscript ? "- Nếu có phần [Lịch sử hội thoại gần đây] trong nội dung gửi, chỉ dùng để hiểu tham chiếu; ưu tiên prompt hiện tại và block dữ liệu web/draft kèm theo.\n" : ""}
- Trả về DUY NHẤT một JSON object, không thêm markdown.
- Chuẩn ngày: YYYY-MM-DD.
- Chuẩn số: number, không có dấu phân cách hàng nghìn.
- Nếu không chắc chắn, bỏ trống field và thêm giải thích vào warnings. Khi ghi cảnh báo, PHẢI nêu rõ thuộc phần nào (VD: "Phần Thông tin chung:", "Phần Danh sách hàng:") và dùng tên tiếng Việt dễ hiểu cho người dùng cuối (VD: "Người xuất khẩu", "Tổng trọng lượng") tuyệt đối không dùng tên biến kỹ thuật.
- Nếu request có block "[Dữ liệu đang có trên web để so sánh]", hãy dùng nó làm dữ liệu hiện tại để đối chiếu trước khi kết luận.
- Nếu block đó có cargoList, hãy đọc và giữ ngữ cảnh danh sách hàng hiện có; chỉ sửa/thêm/bỏ dòng khi chứng từ hoặc yêu cầu người dùng thể hiện rõ.
- Với yêu cầu dạng thao tác dữ liệu thật (cập nhật/sửa/đổi/điền/xóa/bỏ/ghi đè/tạo lại), hãy trả về trạng thái dữ liệu cuối cùng sau thao tác trong cdsInfo và cargoList, theo đúng schema hệ thống. Trường/dòng không nằm trong yêu cầu phải giữ nguyên theo dữ liệu web hiện tại.
- Với yêu cầu chỉ hỏi/kiểm tra/đối chiếu, không tự tạo thao tác cập nhật; chỉ trả kết quả rà soát và warnings nếu có.
- Không trả mã, giá trị lookup, hoặc mã VNACCS nếu không có trong yêu cầu, chứng từ, dữ liệu web hiện tại, hoặc quy tắc hệ thống bên dưới.
- Ưu tiên nhận diện các chứng từ: commercial invoice, packing list, bill of lading/air waybill, contract, permit, C/O, attachment list.
- PDF scan/ảnh vẫn phải OCR nội dung; không được kết luận "chỉ là PDF đẹp/bản đẹp" rồi bỏ qua nếu trang có chữ, bảng, seal, bill, invoice hoặc packing list.
- documents[] phải có 1 phần tử cho mỗi file đầu vào nếu có thể.
- cdsInfo chỉ giữ các key camelCase đúng schema bên dưới.
- fieldSources ghi lại giá trị từng chứng từ đọc được cho mỗi field CDS: key là field camelCase, value là danh sách { fileName, documentType, value }. Nếu nhiều chứng từ có giá trị khác nhau cho cùng field, vẫn trả đủ từng nguồn để người dùng chọn lại trên web.
- cargoList là danh sách hàng, mỗi dòng là một mặt hàng độc lập.
- Nếu có số chứng từ, giấy phép, mã đính kèm, có thể map vào electronicAttachments / importLicenses / otherLegalDocumentCodes.
- Với hồ sơ nhập khẩu, releaseBeforePermitCode chỉ nhận A/B/C khi trên chứng từ thể hiện rõ nhu cầu giải phóng hàng; taxPaymentDeadlineCode chỉ nhận A/B/C/D khi có căn cứ rõ.
- transportDepartureDate chỉ điền khi chứng từ thể hiện rõ ngày khởi hành vận chuyển riêng biệt; không được suy ra từ departureArrivalDate, ETA/ETD, hoặc các ngày khác.
- Với mã loại hình A11/A12 và các luồng nhập kinh doanh thông thường, không tự điền transportDepartureDate nếu chứng từ chỉ có ETA/ETD, ngày invoice, ngày packing list hoặc ngày booking; ghi warning nếu người dùng yêu cầu nhưng chứng từ không có ngày khởi hành vận chuyển riêng.
- importerCode là mã đơn vị XNK (MA_DV): tờ khai nhập là người nhập khẩu, tờ khai xuất là người xuất khẩu. Không đưa mã số thuế của đơn vị XNK vào exporterCode.
- exporterCode là mã đối tác theo VNACCS: với tờ khai nhập là MA_Nguoi_Giao_Hang/người xuất khẩu; với tờ khai xuất là MA_Nguoi_Nhan_Hang/người nhập khẩu/người nhận hàng. Chỉ điền nếu chứng từ thể hiện rõ mã đối tác này.
- Với địa chỉ đơn vị XNK/người nhập khẩu/xuất khẩu: importExportBusinessAddress là địa chỉ đơn vị XNK trên invoice/profile nếu có; partnerAddress1..4 là địa chỉ đối tác/người giao/người nhận. Không trộn địa chỉ hai bên.
- partnerAddress1..partnerAddress4 là 4 dòng địa chỉ đối tác/người xuất khẩu hoặc nhập khẩu; mỗi dòng tối đa 50 ký tự theo app HAN/VNACCS. Nếu địa chỉ dài, tách theo cụm từ vào tối đa 4 dòng và không để dòng nào vượt 50 ký tự.
- exportCountryCode là ô Mã Nước: với tờ khai nhập hiểu là mã nước xuất khẩu; với tờ khai xuất hiểu là mã nước nhập khẩu. Không gọi là "Mã quốc gia xuất khẩu" trong cảnh báo của tờ khai xuất.
- billOfLading lấy từ Bill of Lading/AWB/HAWB/MAWB trước; không lấy mã tracking, booking nội bộ, số PO, số invoice hoặc số file scan. Ngày vận đơn chỉ điền vào billItems[].billDate khi bill/AWB thể hiện rõ ngày phát hành/ngày vận đơn.
- Ô "Ký hiệu và số hiệu" trên màn Thông tin chung map vào cdsInfo.packageMarks; nếu người dùng yêu cầu đưa số invoice vào phần này thì trả packageMarks bằng đúng giá trị đó.
- "Phần ghi chú" map vào cdsInfo.note; "Số quản lý của nội bộ doanh nghiệp" map vào cdsInfo.internalBusinessManagementNumber.
- "Địa điểm đích cho vận chuyển báo thuế" (mã địa điểm VNACCS) map vào cdsInfo.taxDestinationLocation; ngày dự kiến đến địa điểm đích map vào cdsInfo.estimatedArrivalAtDestinationDate.
- warehouseLocationCode/loadingLocationCode/unloadingLocationCode/taxDestinationLocation/truckLoadingLocationCode chỉ chứa mã địa điểm VNACCS. Nếu chỉ thấy tên kho/cảng/địa chỉ (ví dụ POD/POL, cảng dỡ, địa chỉ nhà máy) thì điền vào trường ...Name hoặc truckLoadingLocationAddress và cảnh báo người dùng chọn mã; không tự biến tên/địa chỉ thành mã.
- warehouseLocationName/loadingLocationName/unloadingLocationName/truckLoadingLocationName chỉ chứa tên sạch, không kèm tiền tố "CODE - ". Nếu có cả "CODE - Name", tách code vào trường *Code và name vào trường *Name.
- transportVehicleCode chỉ là mã/số chuyến/số hiệu phương tiện nếu chứng từ thể hiện riêng (flight no, vessel voyage/call sign, truck/container vehicle no). Không ghép ngày bay/ngày tàu, cảng đi/đến hoặc tên phương thức vào transportVehicleCode; các mô tả như "By air", "Sea shipment" đưa vào transportVehicleName hoặc warning.
- Tab Container ECUS (địa điểm xếp hàng lên xe): cdsInfo.truckLoadingLocationCode (chuỗi mã tối đa 5 đoạn nối bằng dấu chấm nếu có quy ước nội bộ), truckLoadingLocationName, truckLoadingLocationAddress — tách với các trường loadingLocation* (địa điểm xếp hàng trên tờ khai chung).
- personOrganizationClassification là mã VNACCS Phân loại cá nhân/tổ chức, chỉ trả về mã "1", "2", "3", "4" hoặc "5"; không trả nhãn chữ. Chỉ bắt buộc với mã loại hình E11, E15, E21, E31, E41, E42, E52, E62, E82. Nếu cả hai bên là công ty/tổ chức thì dùng "4"; nếu không đủ căn cứ hoặc loại hình khác thì bỏ trống và cảnh báo để người dùng chọn lại khi cần.
- importerPhone chỉ là điện thoại đơn vị XNK nếu chứng từ có sẵn, không bắt buộc; không tạo cảnh báo nếu thiếu số điện thoại này.
`;

	const schemaBody = isCdsAiCompactSystemPrompt()
		? CDS_AI_COMPACT_SCHEMA_BLOCK
		: `Schema JSON mong muốn:
{
  "assistantMessage": "Tóm tắt ngắn bằng tiếng Việt",
  "documents": [
    {
      "fileName": "invoice.pdf",
      "documentType": "invoice | packing_list | bill_of_lading | air_waybill | permit | contract | co | other",
      "ocrSummary": "Tóm tắt ngắn nội dung đã OCR",
      "extractedFields": ["commercialInvoice", "commercialInvoiceDate"],
      "warnings": ["Nếu có"]
    }
  ],
  "cdsInfo": {
    "operationCode": "string",
    "customsCode": "string",
    "declarationProcessingDeptCode": "string",
    "personOrganizationClassification": "string",
    "importerCode": "string",
    "importExportUnitName": "string",
    "importerPostalCode": "string",
    "importExportBusinessAddress": "string",
    "importerPhone": "string",
    "entrustedImporterCode": "string",
    "entrustedImporterName": "string",
    "exporterCode": "string",
    "partnerName": "string",
    "partnerAddress1": "string",
    "partnerAddress2": "string",
    "partnerAddress3": "string",
    "partnerAddress4": "string",
    "exportCountryCode": "string",
    "customsDeclarantCode": "string",
    "billOfLading": "string",
    "packageQuantity": 0,
    "packageType": "string",
    "grossWeightTotal": 0,
    "weightUnit": "string",
    "packageMarks": "string",
    "warehouseLocationCode": "string",
    "warehouseLocationName": "string",
    "unloadingLocationCode": "string",
    "unloadingLocationName": "string",
    "loadingLocationCode": "string",
    "loadingLocationName": "string",
    "transportVehicleCode": "string",
    "transportVehicleName": "string",
    "departureArrivalDate": "YYYY-MM-DD",
    "transportDepartureDate": "YYYY-MM-DD",
    "inspectionResultCode": "string",
    "commercialInvoice": "string",
    "commercialInvoiceDate": "YYYY-MM-DD",
    "invoiceFormClassificationCode": "string",
    "paymentMethod": "string",
    "invoicePriceCondition": "string",
    "invoiceClassificationCode": "string",
    "invoiceCurrency": "string",
    "totalInvoiceValue": 0,
    "totalTaxableValue": 0,
    "taxableValueCurrencyCode": "string",
    "valuationDeclarationTypeCode": "string",
    "transportFee": 0,
    "transportFeeClassificationCode": "string",
    "transportFeeCurrencyCode": "string",
    "insuranceFee": 0,
    "insuranceFeeClassificationCode": "string",
    "insuranceFeeCurrencyCode": "string",
    "taxPayer": "string",
    "releaseBeforePermitCode": "A | B | C",
    "taxPaymentDeadlineCode": "A | B | C | D",
    "taxSubstituteBankCode": "string",
    "guaranteeBankCode": "string",
    "contractNumber": "string",
    "contractDate": "YYYY-MM-DD",
    "contractGoodsDate": "YYYY-MM-DD",
    "note": "string",
    "internalBusinessManagementNumber": "string",
    "taxDestinationLocation": "string",
    "estimatedArrivalAtDestinationDate": "YYYY-MM-DD",
    "truckLoadingLocationCode": "string",
    "truckLoadingLocationName": "string",
    "truckLoadingLocationAddress": "string",
    "electronicAttachments": [
      { "attachmentNumber": "string", "attachmentDescription": "string" }
    ],
    "importLicenses": ["string"],
    "otherLegalDocumentCodes": ["string"],
    "transportSchedules": [
      {
        "locationCode": "string",
        "locationName": "string",
        "arrivalDate": "YYYY-MM-DD",
        "departureDate": "YYYY-MM-DD"
      }
    ]
  },
  "fieldSources": {
    "commercialInvoice": [
      {
        "fileName": "invoice.pdf",
        "documentType": "invoice",
        "value": "INV-001"
      }
    ],
    "grossWeightTotal": [
      {
        "fileName": "packing-list.pdf",
        "documentType": "packing_list",
        "value": 1200
      }
    ]
  },
  "cargoList": [
    {
      "customCode": "string",
      "hsCode": "string",
      "vietnameseName": "string",
      "originalCargoName": "string",
      "originalCountry": "string",
      "qty": 0,
      "unit": "string",
      "unitPrice": 0,
      "totalPrice": 0,
      "lineTaxableValue": 0,
      "exportTaxRatePercent": 0,
      "exportTaxAmount": 0,
      "taxableUnitPrice": 0,
      "qty2": 0,
      "unit2": "string",
      "importTaxCode": "string",
      "importTaxRate": 0,
      "importTaxAmount": 0,
      "vatTaxCode": "string",
      "vatTaxRate": 0,
      "vatTaxAmount": 0,
      "imExDutyExemptionCondition": "string",
      "imExDutyExemptionAmount": 0,
      "packageQty": 0,
      "packageType": "string",
      "grossWeight": 0,
      "invoiceNo": "string",
      "invoiceDate": "YYYY-MM-DD",
      "term": "string"
    }
  ],
  "warnings": ["string"]
}
`;

	const fewShotBlock = isCdsAiFewShotExamplesEnabled()
		? `\n${CDS_AI_FEW_SHOT_BLOCK}\n`
		: "";

	return `${instructionPrefix}

${schemaBody}
${fewShotBlock}
Người dùng đang yêu cầu thêm:
${customPrompt ?? "OCR chứng từ và trích xuất dữ liệu cần điền vào CDS."}`;
}

async function logHistory(input: {
	userId?: string;
	userName?: string | null;
	jobNumber: string | null;
	model: string;
	userCustomPrompt?: string | null;
	sessionId?: string | null;
	fileIds: string[];
	fileNames: string[];
	totalSizeMb: number;
	status: number;
	responseText?: string | null;
	errorMessage?: string | null;
	durationMs: number;
	usageMetadata?: GeminiUsageMetadataLike;
	requestBody: Record<string, unknown>;
}) {
	try {
		const usageMetrics = extractGeminiUsageMetrics(input.usageMetadata);

		await prismaRPA.geminiHistory.create({
			data: {
				jobNumber: input.jobNumber,
				userId: input.userId,
				userName: input.userName ?? null,
				model: input.model,
				userCustomPrompt: input.userCustomPrompt ?? null,
				goal: "cds-ai-document",
				sessionId: input.sessionId ?? null,
				status: input.status,
				response: input.responseText ?? null,
				errorMessage: input.errorMessage ?? null,
				fileIds: input.fileIds,
				fileNames: input.fileNames,
				totalFileSizeMb: input.totalSizeMb,
				requestBody: input.requestBody as Prisma.InputJsonValue,
				promptTokens: usageMetrics.promptTokens,
				candidatesTokens: usageMetrics.candidatesTokens,
				totalTokens: usageMetrics.totalTokens,
				durationMs: input.durationMs,
			},
		});
	} catch (error) {
		console.error("Failed to log CDS AI document history:", error);
	}
}

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const startTime = Date.now();

	let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
	const fileNames: string[] = [];
	let totalSizeMb = 0;
	let model = DEFAULT_MODEL;
	let followUpId: string | null = null;
	let jobNumber: string | null = null;
	let operationType: FollowUpOperationType | null = null;
	let prompt: string | null = null;
	let sessionId: string | null = null;
	let draftResultRaw: string | null = null;
	let isDraftRevision = false;
	let driveFileIds: string[] = [];
	let driveFileNames: string[] = [];
	let uploadFileCount = 0;
	let prepDriveMs = 0;
	let prepUploadMs = 0;
	let geminiMs = 0;
	let sanitizeMs = 0;
	let chatTranscriptForApi: string | null = null;

	try {
		session = await auth.api.getSession({ headers: req.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { id } = await params;
		followUpId = id;
		const permission = await checkFollowUpPermission(
			id,
			session.user.id,
			session.user.role ?? "",
			{ mode: "read" },
		);

		if (!permission.ok) {
			return NextResponse.json(
				{ error: permission.error },
				{ status: permission.status },
			);
		}

		const formData = await req.formData();
		prompt = normalizeString(formData.get("prompt"));
		jobNumber = normalizeString(formData.get("jobNumber"));
		model = normalizeRequestedGeminiModel(
			normalizeString(formData.get("model")),
		);
		sessionId = normalizeString(formData.get("sessionId"));
		draftResultRaw = normalizeString(formData.get("draftResult"));
		const currentSnapshotRaw = normalizeString(formData.get("currentSnapshot"));
		chatTranscriptForApi = normalizeString(formData.get("chatTranscript"));
		if (
			chatTranscriptForApi &&
			chatTranscriptForApi.length > MAX_CHAT_TRANSCRIPT_CHARS
		) {
			chatTranscriptForApi = `${chatTranscriptForApi.slice(0, MAX_CHAT_TRANSCRIPT_CHARS)}\n[Đã cắt bớt lịch sử hội thoại do quá dài.]`;
		}
		driveFileIds = normalizeStringList(formData.getAll("driveFileIds"));
		driveFileNames = normalizeStringList(formData.getAll("driveFileNames"));
		const hasPromptDrivenSnapshot = !!prompt && !!currentSnapshotRaw;

		const rawOperationType = normalizeString(formData.get("operationType"));
		operationType =
			rawOperationType === "NHAP" || rawOperationType === "XUAT"
				? rawOperationType
				: null;
		isDraftRevision = !!draftResultRaw;

		const files: File[] = [];
		for (const [key, value] of formData.entries()) {
			if (
				!key.startsWith("file") ||
				!(value instanceof File) ||
				value.size <= 0
			) {
				continue;
			}

			files.push(value);
		}
		uploadFileCount = files.length;

		if (
			files.length === 0 &&
			driveFileIds.length === 0 &&
			!isDraftRevision &&
			!hasPromptDrivenSnapshot
		) {
			return NextResponse.json(
				{ error: "Cần tải lên ít nhất 1 chứng từ để AI phân tích." },
				{ status: 400 },
			);
		}

		const apiKey = process.env.GEMINI_API_KEY;
		if (!apiKey) {
			return NextResponse.json(
				{ error: "Gemini API key chưa được cấu hình." },
				{ status: 500 },
			);
		}

		const warnings: string[] = [];
		const parts: Array<GeminiInlinePart | GeminiTextPart> = [];
		if (chatTranscriptForApi) {
			parts.push({
				text: `[Lịch sử hội thoại gần đây]\n${chatTranscriptForApi}`,
			});
		}
		parts.push({
			text:
				prompt ??
				"Hãy OCR toàn bộ chứng từ đã nạp và trích xuất dữ liệu cần điền vào CDS.",
		});

		if (draftResultRaw) {
			parts.push({
				text: `[Kết quả bóc hiện tại cần chỉnh]\n${draftResultRaw}`,
			});
		}

		if (currentSnapshotRaw) {
			parts.push({
				text: `[Dữ liệu đang có trên web để so sánh]\n${currentSnapshotRaw}`,
			});
		}

		const prepDriveStart = Date.now();
		const driveBuilt =
			driveFileIds.length === 0
				? []
				: await Promise.all(
						driveFileIds.map(async (driveFileId, index) => {
							const { buffer, mimeType, name } =
								await getFileContent(driveFileId);
							const driveFileName =
								name || driveFileNames[index] || `drive-${index + 1}`;
							return buildFilePart({
								fileName: driveFileName,
								mimeType: inferDocumentMimeType(driveFileName, mimeType),
								buffer,
								sourceType: "drive",
							});
						}),
					);
		prepDriveMs = Date.now() - prepDriveStart;

		for (const result of driveBuilt) {
			parts.push(result.part);
			fileNames.push(result.fileName);
			totalSizeMb += result.fileSize / (1024 * 1024);
			if (result.warning) {
				warnings.push(result.warning);
			}
		}

		const prepUploadStart = Date.now();
		const uploadInputGroups =
			files.length === 0
				? []
				: await Promise.all(
						files.map(async (file) => {
							const uploadedFileName = file.name || "document";
							const uploadedMimeType = inferDocumentMimeType(
								uploadedFileName,
								file.type,
							);
							const uploadedBuffer = Buffer.from(await file.arrayBuffer());

							let inputs: CdsAiDocumentInputFile[] = [
								{
									fileName: uploadedFileName,
									mimeType: uploadedMimeType,
									buffer: uploadedBuffer,
									sourceType: "upload",
								},
							];
							const extraWarnings: string[] = [];

							if (isArchiveUpload(uploadedFileName, uploadedMimeType)) {
								const extracted = await extractSupportedDocumentsFromArchive({
									archiveName: uploadedFileName,
									buffer: uploadedBuffer,
								});
								inputs = extracted.files;
								extraWarnings.push(...extracted.warnings);
							}

							return { inputs, extraWarnings };
						}),
					);
		for (const group of uploadInputGroups) {
			warnings.push(...group.extraWarnings);
		}
		const allUploadInputs = uploadInputGroups.flatMap((group) => group.inputs);
		const uploadBuilt = await Promise.all(
			allUploadInputs.map((input) => buildFilePart(input)),
		);
		prepUploadMs = Date.now() - prepUploadStart;

		for (const result of uploadBuilt) {
			parts.push(result.part);
			fileNames.push(result.fileName);
			totalSizeMb += result.fileSize / (1024 * 1024);
			if (result.warning) {
				warnings.push(result.warning);
			}
		}

		if (parts.length === 1) {
			return NextResponse.json(
				{
					error:
						"Không tìm thấy file nguồn hợp lệ để OCR. Archive có thể chỉ chứa file kết quả hoặc định dạng chưa hỗ trợ.",
				},
				{ status: 400 },
			);
		}

		const requestBody = {
			system_instruction: {
				parts: [
					{
						text: buildSystemInstruction(operationType, prompt, {
							isDraftRevision,
							hasCurrentSnapshot: !!currentSnapshotRaw,
							hasChatTranscript: !!chatTranscriptForApi,
						}),
					},
				],
			},
			contents: [{ parts }],
			generationConfig: {
				temperature: 0.1,
				topP: 0.95,
				response_mime_type: "application/json",
			},
		};

		const geminiStart = Date.now();
		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			},
		);
		const payload = await response.json();
		geminiMs = Date.now() - geminiStart;

		if (!response.ok) {
			const errorMessage =
				payload?.error?.message || `Gemini API error: ${response.status}`;
			const durationMs = Date.now() - startTime;

			await logHistory({
				userId: session.user.id,
				userName: session.user.name,
				jobNumber,
				model,
				userCustomPrompt: prompt,
				sessionId,
				fileIds: driveFileIds,
				fileNames,
				totalSizeMb: Number(totalSizeMb.toFixed(2)),
				status: response.status,
				errorMessage,
				durationMs,
				usageMetadata: payload,
				requestBody: {
					goal: "cds-ai-document",
					followUpId,
					operationType,
					prompt,
					isDraftRevision,
					driveFileCount: driveFileIds.length,
					uploadFileCount,
					fileCount: fileNames.length,
					chatTranscriptChars: chatTranscriptForApi?.length ?? 0,
					timing: {
						prepDriveMs,
						prepUploadMs,
						geminiMs,
						sanitizeMs,
					},
				},
			});

			return NextResponse.json({ error: errorMessage }, { status: 500 });
		}

		const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
		if (!text) {
			const errorMessage = "Gemini không trả về dữ liệu OCR.";
			const durationMs = Date.now() - startTime;

			await logHistory({
				userId: session.user.id,
				userName: session.user.name,
				jobNumber,
				model,
				userCustomPrompt: prompt,
				sessionId,
				fileIds: driveFileIds,
				fileNames,
				totalSizeMb: Number(totalSizeMb.toFixed(2)),
				status: 200,
				errorMessage,
				durationMs,
				usageMetadata: payload,
				requestBody: {
					goal: "cds-ai-document",
					followUpId,
					operationType,
					prompt,
					isDraftRevision,
					driveFileCount: driveFileIds.length,
					uploadFileCount,
					fileCount: fileNames.length,
					chatTranscriptChars: chatTranscriptForApi?.length ?? 0,
					timing: {
						prepDriveMs,
						prepUploadMs,
						geminiMs,
						sanitizeMs,
					},
				},
			});

			return NextResponse.json({ error: errorMessage }, { status: 500 });
		}

		const parsedDoc = parseGeminiCdsAiDocumentJson(text);
		if (!parsedDoc.ok) {
			const durationMs = Date.now() - startTime;

			await logHistory({
				userId: session.user.id,
				userName: session.user.name,
				jobNumber,
				model,
				userCustomPrompt: prompt,
				sessionId,
				fileIds: driveFileIds,
				fileNames,
				totalSizeMb: Number(totalSizeMb.toFixed(2)),
				status: 422,
				errorMessage: parsedDoc.messageVi,
				durationMs,
				usageMetadata: payload,
				requestBody: {
					goal: "cds-ai-document",
					followUpId,
					operationType,
					prompt,
					isDraftRevision,
					driveFileCount: driveFileIds.length,
					uploadFileCount,
					fileCount: fileNames.length,
					chatTranscriptChars: chatTranscriptForApi?.length ?? 0,
					timing: {
						prepDriveMs,
						prepUploadMs,
						geminiMs,
						sanitizeMs,
					},
				},
			});

			return NextResponse.json(
				{
					error: parsedDoc.messageVi,
					errorCode: parsedDoc.errorCode,
				},
				{ status: 422 },
			);
		}

		const sanitizeStart = Date.now();
		const result = sanitizeCdsAiDocumentResult(parsedDoc.value, operationType);
		const usageMetrics = extractGeminiUsageMetrics(payload);
		const mergedWarnings = [...result.warnings, ...warnings];
		result.warnings = mergedWarnings;
		result.checklist = buildCdsAiDocumentChecklist(
			operationType,
			result.cdsInfo,
			result.cargoList,
			mergedWarnings,
		);
		sanitizeMs = Date.now() - sanitizeStart;

		const durationMs = Date.now() - startTime;

		await logHistory({
			userId: session.user.id,
			userName: session.user.name,
			jobNumber,
			model,
			userCustomPrompt: prompt,
			sessionId,
			fileIds: driveFileIds,
			fileNames,
			totalSizeMb: Number(totalSizeMb.toFixed(2)),
			status: 200,
			responseText: JSON.stringify(result),
			durationMs,
			usageMetadata: payload,
			requestBody: {
				goal: "cds-ai-document",
				followUpId,
				operationType,
				prompt,
				isDraftRevision,
				driveFileCount: driveFileIds.length,
				uploadFileCount,
				fileCount: fileNames.length,
				chatTranscriptChars: chatTranscriptForApi?.length ?? 0,
				timing: {
					prepDriveMs,
					prepUploadMs,
					geminiMs,
					sanitizeMs,
				},
			},
		});

		return NextResponse.json({
			success: true,
			data: result,
			usage: {
				...usageMetrics,
				durationMs,
				timing: {
					prepDriveMs,
					prepUploadMs,
					geminiMs,
					sanitizeMs,
				},
			},
		});
	} catch (error) {
		console.error("CDS AI document OCR error:", error);

		await logHistory({
			userId: session?.user?.id,
			userName: session?.user?.name,
			jobNumber,
			model,
			userCustomPrompt: prompt,
			sessionId,
			fileIds: driveFileIds,
			fileNames,
			totalSizeMb: Number(totalSizeMb.toFixed(2)),
			status: 500,
			errorMessage:
				error instanceof Error ? error.message : "Unknown CDS AI OCR error",
			durationMs: Date.now() - startTime,
			requestBody: {
				goal: "cds-ai-document",
				followUpId,
				operationType,
				prompt,
				isDraftRevision,
				driveFileCount: driveFileIds.length,
				uploadFileCount,
				fileCount: fileNames.length,
				chatTranscriptChars: chatTranscriptForApi?.length ?? 0,
				timing: {
					prepDriveMs,
					prepUploadMs,
					geminiMs,
					sanitizeMs,
				},
			},
		});

		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : "Internal Server Error",
			},
			{ status: 500 },
		);
	}
}
