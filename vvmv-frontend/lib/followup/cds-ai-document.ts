import type {
	CargoListRow,
	FollowUpCdsInfoRow,
} from "@/app/(home)/internal/followup/types";
import { sanitizeCargoListPayload } from "@/lib/followup/ai-ocr-sync";
import {
	isCargoCustomCodeRequiredForOperationCode,
	normalizeCargoOperationCode,
} from "@/lib/followup/cargo-custom-code-rules";
import { isCargoRowEffectivelyEmpty } from "@/lib/followup/cargo-list-validation";
import { FIELD_DEFINITIONS } from "@/lib/followup/cds-field-definitions";
import {
	LEGACY_CDS_INFO_FIELD_ALIASES,
	PERSISTED_CDS_INFO_FIELDS,
} from "@/lib/followup/cds-info-contract";
import {
	sanitizeCdsInfoPayload,
	sanitizeCdsInfoPayloadDetailed,
} from "@/lib/followup/cds-info-sanitize";
import {
	isCdsPartnerAddressField,
	normalizeCdsPartnerAddressFields,
	splitCdsPartnerAddressText,
} from "@/lib/followup/cds-partner-address";
import { getCdsVnaccsFieldLabel } from "@/lib/followup/cds-vnaccs-field-labels";
import type { FollowUpOperationType } from "@/lib/followup/operation-type";
import { isPersonOrganizationClassificationRequiredForOperationCode } from "./cds-person-organization-classification";

export type CdsAiDocumentChecklistStatus = "found" | "missing" | "needs_review";

export type CdsAiDocumentFileSummary = {
	fileName: string;
	documentType: string | null;
	ocrSummary: string | null;
	extractedFields: string[];
	warnings: string[];
};

export type CdsAiDocumentFieldSource = {
	fileName: string;
	documentType: string | null;
	value: string | number | null;
};

export type CdsAiDocumentChecklistItem = {
	id: string;
	label: string;
	status: CdsAiDocumentChecklistStatus;
	fieldKey?: keyof FollowUpCdsInfoRow;
	reason: string | null;
};

export const CDS_AI_DOCUMENT_KNOWN_ROOT_KEYS = new Set([
	"cdsInfo",
	"cargoList",
	"fieldSources",
	"documents",
	"warnings",
	"assistantMessage",
	"electronicAttachments",
	"importLicenses",
	"otherLegalDocumentCodes",
	"transportSchedules",
	/** Present when re-parsing an already-sanitized extraction payload */
	"checklist",
	"sanitizationNotes",
]);

export type CdsAiSanitizationNotes = {
	rejectedCdsInfoKeys: string[];
	rejectedTopLevelKeys: string[];
};

export type CdsAiDocumentExtractionResult = {
	assistantMessage: string;
	documents: CdsAiDocumentFileSummary[];
	cdsInfo: Partial<FollowUpCdsInfoRow>;
	fieldSources: Partial<
		Record<keyof FollowUpCdsInfoRow, CdsAiDocumentFieldSource[]>
	>;
	cargoList: Partial<CargoListRow>[];
	warnings: string[];
	checklist: CdsAiDocumentChecklistItem[];
	sanitizationNotes: CdsAiSanitizationNotes;
};

type ChecklistFieldConfig = {
	id: string;
	label: string;
	fieldKey: keyof FollowUpCdsInfoRow;
};

const COMMON_CHECKLIST_FIELDS: ChecklistFieldConfig[] = [
	{ id: "operationCode", label: "Mã loại hình", fieldKey: "operationCode" },
	{
		id: "importExportUnitName",
		label: "Tên doanh nghiệp XNK",
		fieldKey: "importExportUnitName",
	},
	{ id: "partnerName", label: "Tên đối tác", fieldKey: "partnerName" },
	{ id: "billOfLading", label: "Số vận đơn", fieldKey: "billOfLading" },
	{
		id: "commercialInvoice",
		label: "Số hóa đơn thương mại",
		fieldKey: "commercialInvoice",
	},
	{
		id: "commercialInvoiceDate",
		label: "Ngày hóa đơn thương mại",
		fieldKey: "commercialInvoiceDate",
	},
	{
		id: "packageQuantity",
		label: "Số lượng kiện",
		fieldKey: "packageQuantity",
	},
	{
		id: "grossWeightTotal",
		label: "Tổng trọng lượng hàng",
		fieldKey: "grossWeightTotal",
	},
];

const IMPORT_CHECKLIST_FIELDS: ChecklistFieldConfig[] = [
	{
		id: "declarationProcessingDeptCode",
		label: "Mã bộ phận xử lý tờ khai",
		fieldKey: "declarationProcessingDeptCode",
	},
	{
		id: "transportMethodCode",
		label: "Mã hiệu phương thức vận chuyển",
		fieldKey: "transportMethodCode",
	},
];

const EXPORT_CHECKLIST_FIELDS: ChecklistFieldConfig[] = [
	{
		id: "declarationProcessingDeptCode",
		label: "Mã bộ phận xử lý tờ khai",
		fieldKey: "declarationProcessingDeptCode",
	},
	{
		id: "transportMethodCode",
		label: "Mã hiệu phương thức vận chuyển",
		fieldKey: "transportMethodCode",
	},
	{
		id: "customsDeclarantCode",
		label: "Mã người khai hải quan",
		fieldKey: "customsDeclarantCode",
	},
];

const STATIC_AI_CHECKLIST_FIELD_KEYS = new Set<string>(
	[
		...COMMON_CHECKLIST_FIELDS,
		...IMPORT_CHECKLIST_FIELDS,
		...EXPORT_CHECKLIST_FIELDS,
	].map((entry) => entry.fieldKey as string),
);

/** Up to five extra CDS fields marked required in cds-field-definitions for this operation type. */
function collectExtraRequiredChecklistFields(
	operationType: FollowUpOperationType | null,
): ChecklistFieldConfig[] {
	if (!operationType) {
		return [];
	}

	const extras: ChecklistFieldConfig[] = [];
	const seen = new Set<string>();

	for (const def of FIELD_DEFINITIONS) {
		if (!def.appPath.startsWith("cdsInfo.")) {
			continue;
		}

		const fieldKey = def.appPath.slice("cdsInfo.".length).trim();
		if (
			!fieldKey ||
			!def.requiredFor?.includes(operationType) ||
			STATIC_AI_CHECKLIST_FIELD_KEYS.has(fieldKey) ||
			!PERSISTED_CDS_INFO_FIELDS.has(fieldKey) ||
			seen.has(fieldKey)
		) {
			continue;
		}

		seen.add(fieldKey);
		extras.push({
			id: fieldKey,
			label: def.label,
			fieldKey: fieldKey as keyof FollowUpCdsInfoRow,
		});
	}

	extras.sort((a, b) =>
		(a.fieldKey as string).localeCompare(b.fieldKey as string, "vi"),
	);
	return extras.slice(0, 5);
}

const PERSON_ORGANIZATION_CHECKLIST_FIELD: ChecklistFieldConfig = {
	id: "personOrganizationClassification",
	label: "Phân loại cá nhân/tổ chức",
	fieldKey: "personOrganizationClassification",
};

function normalizeString(value: unknown): string | null {
	if (value === null || value === undefined) {
		return null;
	}

	const text = String(value).trim();
	return text === "" ? null : text;
}

function normalizeStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.map((item) => normalizeString(item))
		.filter((item): item is string => !!item);
}

function resolveCdsFieldKey(key: string): keyof FollowUpCdsInfoRow | null {
	const targetKey = LEGACY_CDS_INFO_FIELD_ALIASES[key] ?? key;

	if (!PERSISTED_CDS_INFO_FIELDS.has(targetKey)) {
		return null;
	}

	return targetKey as keyof FollowUpCdsInfoRow;
}

function normalizeFieldSourceValue(
	fieldKey: keyof FollowUpCdsInfoRow,
	value: unknown,
): string | number | null {
	if (value === null || value === undefined) {
		return null;
	}

	if (isCdsPartnerAddressField(fieldKey)) {
		return splitCdsPartnerAddressText(value, { lineCount: 1 })[0] ?? null;
	}

	const sanitized = sanitizeCdsInfoPayload({ [fieldKey]: value });
	const normalized = sanitized[fieldKey as string];

	if (typeof normalized === "number" && Number.isFinite(normalized)) {
		return normalized;
	}

	if (typeof normalized === "string") {
		const text = normalized.trim();
		return text === "" ? null : text;
	}

	if (typeof normalized === "boolean") {
		return normalized ? "true" : "false";
	}

	const text = normalizeString(value);
	return text;
}

function sanitizeFieldSourceEntry(
	fieldKey: keyof FollowUpCdsInfoRow,
	value: unknown,
): CdsAiDocumentFieldSource | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}

	const record = value as Record<string, unknown>;
	const fileName = normalizeString(record.fileName);

	if (!fileName) {
		return null;
	}

	return {
		fileName,
		documentType: normalizeString(record.documentType),
		value: normalizeFieldSourceValue(fieldKey, record.value),
	};
}

function sanitizeFieldSources(
	value: unknown,
): Partial<Record<keyof FollowUpCdsInfoRow, CdsAiDocumentFieldSource[]>> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}

	const output: Partial<
		Record<keyof FollowUpCdsInfoRow, CdsAiDocumentFieldSource[]>
	> = {};

	Object.entries(value as Record<string, unknown>).forEach(
		([rawFieldKey, rawSources]) => {
			const fieldKey = resolveCdsFieldKey(rawFieldKey);
			if (!fieldKey || !Array.isArray(rawSources)) {
				return;
			}

			const sources = rawSources
				.map((source) => sanitizeFieldSourceEntry(fieldKey, source))
				.filter(
					(source): source is CdsAiDocumentFieldSource => source !== null,
				);

			if (sources.length > 0) {
				output[fieldKey] = sources;
			}
		},
	);

	return output;
}

function normalizeWarningSearchText(value: string) {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/đ/g, "d")
		.replace(/Đ/g, "D")
		.toLowerCase();
}

function looksLikeMissingFieldWarning(searchText: string) {
	return (
		searchText.includes("khong tim thay") ||
		searchText.includes("khong thay") ||
		searchText.includes("khong co") ||
		searchText.includes("dang trong") ||
		searchText.includes("thieu") ||
		searchText.includes("missing") ||
		searchText.includes("not found")
	);
}

function looksLikeCargoCustomCodeWarning(searchText: string) {
	return (
		searchText.includes("customcode") ||
		searchText.includes("ma_hangkb") ||
		searchText.includes("ma hangkb") ||
		searchText.includes("ma hang khai bao") ||
		searchText.includes("ma hang dang trong") ||
		searchText.includes("ma hang")
	);
}

function replaceWarningLabel(
	warning: string,
	patterns: RegExp[],
	label: string | null,
) {
	if (!label) {
		return warning;
	}

	return patterns.reduce(
		(current, pattern) => current.replace(pattern, label),
		warning,
	);
}

function normalizeCdsAiWarning(
	warning: string,
	operationType: FollowUpOperationType | null,
	operationCode: unknown,
): string | null {
	const searchText = normalizeWarningSearchText(warning);

	if (
		!isCargoCustomCodeRequiredForOperationCode(operationCode) &&
		looksLikeMissingFieldWarning(searchText) &&
		looksLikeCargoCustomCodeWarning(searchText)
	) {
		return null;
	}

	if (
		(searchText.includes("importerphone") ||
			searchText.includes("so dien thoai")) &&
		looksLikeMissingFieldWarning(searchText)
	) {
		return null;
	}

	let normalized = warning;
	normalized = replaceWarningLabel(
		normalized,
		[
			/Mã quốc gia xuất khẩu/gi,
			/Mã quốc gia nhập khẩu/gi,
			/Mã nước xuất khẩu/gi,
			/Mã nước nhập khẩu/gi,
			/exportCountryCode/g,
		],
		getCdsVnaccsFieldLabel("exportCountryCode", operationType),
	);
	normalized = replaceWarningLabel(
		normalized,
		[/Mã bưu chính của người nhập khẩu/gi, /Mã bưu chính người nhập khẩu/gi],
		getCdsVnaccsFieldLabel("importerPostalCode", operationType),
	);
	normalized = replaceWarningLabel(
		normalized,
		[
			/Mã số thuế của người nhập khẩu/gi,
			/MST của người nhập khẩu/gi,
			/MST người nhập khẩu/gi,
		],
		getCdsVnaccsFieldLabel("importerCode", operationType),
	);
	normalized = replaceWarningLabel(
		normalized,
		[/exporterCode/g],
		getCdsVnaccsFieldLabel("exporterCode", operationType),
	);

	return normalized;
}

function normalizeCdsAiWarnings(
	value: unknown,
	operationType: FollowUpOperationType | null,
	operationCode: unknown,
) {
	return normalizeStringArray(value)
		.map((warning) =>
			normalizeCdsAiWarning(warning, operationType, operationCode),
		)
		.filter((warning): warning is string => !!warning);
}

function isFilled(value: unknown): boolean {
	if (value === null || value === undefined) {
		return false;
	}

	if (typeof value === "string") {
		return value.trim() !== "";
	}

	if (typeof value === "number") {
		return Number.isFinite(value);
	}

	if (Array.isArray(value)) {
		return value.some((item) => isFilled(item));
	}

	if (typeof value === "object") {
		return Object.values(value as Record<string, unknown>).some((item) =>
			isFilled(item),
		);
	}

	return true;
}

function sanitizeDocumentSummary(
	value: unknown,
	operationType: FollowUpOperationType | null,
	operationCode: unknown,
): CdsAiDocumentFileSummary | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}

	const record = value as Record<string, unknown>;
	const fileName = normalizeString(record.fileName);
	if (!fileName) {
		return null;
	}

	return {
		fileName,
		documentType: normalizeString(record.documentType),
		ocrSummary: normalizeString(record.ocrSummary),
		extractedFields: normalizeStringArray(record.extractedFields),
		warnings: normalizeCdsAiWarnings(
			record.warnings,
			operationType,
			operationCode,
		),
	};
}

function buildChecklist(
	operationType: FollowUpOperationType | null,
	cdsInfo: Partial<FollowUpCdsInfoRow>,
	cargoList: Partial<CargoListRow>[],
	warnings: string[],
): CdsAiDocumentChecklistItem[] {
	const checklistConfigs = [...COMMON_CHECKLIST_FIELDS];

	if (operationType === "NHAP") {
		checklistConfigs.push(...IMPORT_CHECKLIST_FIELDS);
	} else if (operationType === "XUAT") {
		checklistConfigs.push(...EXPORT_CHECKLIST_FIELDS);
	}

	checklistConfigs.push(...collectExtraRequiredChecklistFields(operationType));

	if (
		isPersonOrganizationClassificationRequiredForOperationCode(
			cdsInfo.operationCode,
		)
	) {
		checklistConfigs.push(PERSON_ORGANIZATION_CHECKLIST_FIELD);
	}

	const checklist = checklistConfigs.map<CdsAiDocumentChecklistItem>(
		({ id, label, fieldKey }) => {
			const value = cdsInfo[fieldKey];
			const hasValue = isFilled(value);

			return {
				id,
				label,
				fieldKey,
				status: hasValue ? "found" : "missing",
				reason: hasValue
					? "AI đã nhận diện được trường này."
					: "Chưa thấy rõ trên chứng từ đã nạp.",
			};
		},
	);

	const cargoRows = cargoList.length;
	const cargoHasCoreData = cargoList.some(
		(item) =>
			isFilled(item.vietnameseName) ||
			isFilled(item.originalCargoName) ||
			isFilled(item.hsCode),
	);

	checklist.push({
		id: "cargoList",
		label: "Danh sách hàng",
		status:
			cargoRows === 0 ? "missing" : cargoHasCoreData ? "found" : "needs_review",
		reason:
			cargoRows === 0
				? "Chưa trích xuất được dòng hàng nào."
				: cargoHasCoreData
					? `Đã trích xuất ${cargoRows} dòng hàng.`
					: "Có dòng hàng nhưng thiếu tên hàng hoặc mã HS, cần rà soát.",
	});

	const missingCargoCustomCodeRows = isCargoCustomCodeRequiredForOperationCode(
		cdsInfo.operationCode,
	)
		? cargoList
				.map((item, index) =>
					isCargoRowEffectivelyEmpty(item) || isFilled(item.customCode)
						? null
						: index + 1,
				)
				.filter((item): item is number => item !== null)
		: [];

	if (missingCargoCustomCodeRows.length > 0) {
		checklist.push({
			id: "cargoCustomCode",
			label: "Mã hàng",
			status: "missing",
			reason: `Dòng hàng ${missingCargoCustomCodeRows.join(", ")} thiếu mã hàng cho loại hình ${normalizeCargoOperationCode(cdsInfo.operationCode)}.`,
		});
	}

	if (warnings.length > 0) {
		checklist.push({
			id: "warnings",
			label: "Cảnh báo OCR",
			status: "needs_review",
			reason: warnings[0] ?? "Gemini có trả về cảnh báo cần kiểm tra lại.",
		});
	}

	return checklist;
}

/** Rebuild checklist after merging server-side file warnings without full re-sanitization. */
export function buildCdsAiDocumentChecklist(
	operationType: FollowUpOperationType | null,
	cdsInfo: Partial<FollowUpCdsInfoRow>,
	cargoList: Partial<CargoListRow>[],
	warnings: string[],
): CdsAiDocumentChecklistItem[] {
	return buildChecklist(operationType, cdsInfo, cargoList, warnings);
}

function buildAssistantMessage(
	documents: CdsAiDocumentFileSummary[],
	cdsInfo: Partial<FollowUpCdsInfoRow>,
	cargoList: Partial<CargoListRow>[],
	warnings: string[],
): string {
	const documentCount = documents.length;
	const filledFieldCount = Object.values(cdsInfo).filter((value) =>
		isFilled(value),
	).length;
	const cargoCount = cargoList.length;

	const parts = [
		documentCount > 0
			? `Đã đọc ${documentCount} chứng từ`
			: "Đã phân tích chứng từ",
		filledFieldCount > 0
			? `trích xuất ${filledFieldCount} trường CDS`
			: "chưa ra được nhiều trường CDS",
		cargoCount > 0
			? `và ${cargoCount} dòng hàng`
			: "và chưa nhận diện được dòng hàng",
	];

	if (warnings.length > 0) {
		parts.push(`Có ${warnings.length} cảnh báo cần rà lại.`);
	}

	return `${parts.join(", ")}.`;
}

export function stripGeminiJsonResponse(text: string): string {
	return text.replace(/```json|```/gi, "").trim();
}

export const CDS_AI_DOCUMENT_JSON_PARSE_ERROR_CODE =
	"CDS_AI_DOCUMENT_JSON_PARSE" as const;

export function parseGeminiCdsAiDocumentJson(rawText: string):
	| { ok: true; value: Record<string, unknown> }
	| {
			ok: false;
			errorCode: typeof CDS_AI_DOCUMENT_JSON_PARSE_ERROR_CODE;
			messageVi: string;
	  } {
	const stripped = stripGeminiJsonResponse(rawText ?? "");

	if (stripped.length === 0) {
		return {
			ok: false,
			errorCode: CDS_AI_DOCUMENT_JSON_PARSE_ERROR_CODE,
			messageVi:
				"AI không trả về JSON hợp lệ. Thu gọn chứng từ hoặc thử lại với nhắc rõ ràng hơn.",
		};
	}

	try {
		const parsed = JSON.parse(stripped) as unknown;
		if (
			parsed === null ||
			typeof parsed !== "object" ||
			Array.isArray(parsed)
		) {
			return {
				ok: false,
				errorCode: CDS_AI_DOCUMENT_JSON_PARSE_ERROR_CODE,
				messageVi:
					"Kết quả AI không có cấu trúc tờ khai mong đợi. Kiểm tra lại chứng từ hoặc chia nhỏ tệp tin.",
			};
		}

		return { ok: true, value: parsed as Record<string, unknown> };
	} catch {
		return {
			ok: false,
			errorCode: CDS_AI_DOCUMENT_JSON_PARSE_ERROR_CODE,
			messageVi:
				"Không đọc được JSON từ phản hồi AI. Thử chia nhỏ nội dung hoặc giảm số chứng từ mỗi lần gửi.",
		};
	}
}

export function sanitizeCdsAiDocumentResult(
	rawValue: unknown,
	operationType: FollowUpOperationType | null,
): CdsAiDocumentExtractionResult {
	const source =
		rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)
			? (rawValue as Record<string, unknown>)
			: {};

	const cdsSource =
		source.cdsInfo &&
		typeof source.cdsInfo === "object" &&
		!Array.isArray(source.cdsInfo)
			? { ...(source.cdsInfo as Record<string, unknown>) }
			: {};

	if (
		!("electronicAttachments" in cdsSource) &&
		Array.isArray(source.electronicAttachments)
	) {
		cdsSource.electronicAttachments = source.electronicAttachments;
	}
	if (
		!("importLicenses" in cdsSource) &&
		Array.isArray(source.importLicenses)
	) {
		cdsSource.importLicenses = source.importLicenses;
	}
	if (
		!("otherLegalDocumentCodes" in cdsSource) &&
		Array.isArray(source.otherLegalDocumentCodes)
	) {
		cdsSource.otherLegalDocumentCodes = source.otherLegalDocumentCodes;
	}
	if (
		!("transportSchedules" in cdsSource) &&
		Array.isArray(source.transportSchedules)
	) {
		cdsSource.transportSchedules = source.transportSchedules;
	}

	const cdsInfoSanitized = sanitizeCdsInfoPayloadDetailed(cdsSource);
	const cdsInfo = {
		...(cdsInfoSanitized.sanitized as Partial<FollowUpCdsInfoRow>),
		...normalizeCdsPartnerAddressFields(cdsSource),
	} as Partial<FollowUpCdsInfoRow>;

	const rejectedTopLevelKeys = Object.keys(source).filter(
		(key) => !CDS_AI_DOCUMENT_KNOWN_ROOT_KEYS.has(key),
	);

	const cargoList = sanitizeCargoListPayload(
		source.cargoList,
	) as Partial<CargoListRow>[];
	const fieldSources = sanitizeFieldSources(source.fieldSources);
	const documents = Array.isArray(source.documents)
		? source.documents
				.map((item) =>
					sanitizeDocumentSummary(item, operationType, cdsInfo.operationCode),
				)
				.filter((item): item is CdsAiDocumentFileSummary => !!item)
		: [];
	const warnings = normalizeCdsAiWarnings(
		source.warnings,
		operationType,
		cdsInfo.operationCode,
	);
	const assistantMessage =
		normalizeString(source.assistantMessage) ??
		buildAssistantMessage(documents, cdsInfo, cargoList, warnings);

	return {
		assistantMessage,
		documents,
		cdsInfo,
		fieldSources,
		cargoList,
		warnings,
		checklist: buildChecklist(operationType, cdsInfo, cargoList, warnings),
		sanitizationNotes: {
			rejectedCdsInfoKeys: cdsInfoSanitized.rejectedKeys,
			rejectedTopLevelKeys: rejectedTopLevelKeys.sort(),
		},
	};
}

export function rebuildCdsAiDocumentResult(
	input: {
		assistantMessage?: string | null;
		documents?: CdsAiDocumentFileSummary[];
		cdsInfo?: Partial<FollowUpCdsInfoRow>;
		fieldSources?: Partial<
			Record<keyof FollowUpCdsInfoRow, CdsAiDocumentFieldSource[]>
		>;
		cargoList?: Partial<CargoListRow>[];
		warnings?: string[];
	},
	operationType: FollowUpOperationType | null,
): CdsAiDocumentExtractionResult {
	return sanitizeCdsAiDocumentResult(
		{
			assistantMessage: input.assistantMessage ?? null,
			documents: input.documents ?? [],
			cdsInfo: input.cdsInfo ?? {},
			fieldSources: input.fieldSources ?? {},
			cargoList: input.cargoList ?? [],
			warnings: input.warnings ?? [],
		},
		operationType,
	);
}
