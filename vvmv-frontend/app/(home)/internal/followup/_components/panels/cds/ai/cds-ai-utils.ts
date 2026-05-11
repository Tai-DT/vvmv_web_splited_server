import { CDS_INFO_FIELDS_APPLY_NULL_ON_OVERWRITE } from "@/lib/followup/cds-ai-clear-patch";
import type {
	CdsAiDocumentChecklistStatus,
	CdsAiDocumentExtractionResult,
} from "@/lib/followup/cds-ai-document";
import { isCdsInfoFieldVisibleForOperation } from "@/lib/followup/cds-field-definitions";
import { isCdsWebLockedField } from "@/lib/followup/cds-web-locked-fields";
import type { FollowUpOperationType } from "@/lib/followup/operation-type";
import type { CargoListRow, FollowUpCdsInfoRow } from "../../../../types";
import type { CargoColumn } from "../../panel-config";
import { CDS_FIELD_INPUT_TYPES } from "./cds-ai-constants";
import type { DiffStatus } from "./cds-ai-types";

/* ------------------------------------------------------------------ */
/*  Tone helpers (Classic ECUS style)                                   */
/* ------------------------------------------------------------------ */

export function getMetricCardClasses(
	tone: "sky" | "amber" | "emerald" | "slate" | "rose",
) {
	if (tone === "sky") {
		return "border-blue-300 bg-blue-50 text-blue-900";
	}

	if (tone === "amber") {
		return "border-amber-300 bg-amber-50 text-amber-900";
	}

	if (tone === "emerald") {
		return "border-emerald-300 bg-emerald-50 text-emerald-900";
	}

	if (tone === "rose") {
		return "border-red-300 bg-red-50 text-red-900";
	}

	return "border-[#a8a8a8] bg-[#f5f5f5] text-[#2f2f2f]";
}

/* ------------------------------------------------------------------ */
/*  Checklist metadata                                                 */
/* ------------------------------------------------------------------ */

export function getChecklistMeta(status: CdsAiDocumentChecklistStatus) {
	if (status === "found") {
		return {
			badgeLabel: "Đã nhận diện",
			badgeVariant: "success" as const,
			dotClassName: "bg-emerald-500",
		};
	}

	if (status === "missing") {
		return {
			badgeLabel: "Thiếu dữ liệu",
			badgeVariant: "destructive" as const,
			dotClassName: "bg-red-500",
		};
	}

	return {
		badgeLabel: "Cần rà soát",
		badgeVariant: "warning" as const,
		dotClassName: "bg-amber-500",
	};
}

/* ------------------------------------------------------------------ */
/*  Value helpers                                                      */
/* ------------------------------------------------------------------ */

function isEmptyPlaceholderText(value: string) {
	const compact = value.trim().replace(/\s+/g, " ");
	const normalized = compact
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/đ/g, "d")
		.replace(/Đ/g, "D")
		.toLowerCase();

	return new Set([
		"-",
		"--",
		"—",
		"n/a",
		"n.a.",
		"not applicable",
		"not found",
		"missing",
		"null",
		"undefined",
		"unknown",
		"khong co",
		"khong tim thay",
		"khong thay",
		"chua co",
		"chua xac dinh",
	]).has(normalized);
}

export function isMeaningfulValue(value: unknown): boolean {
	if (value === null || value === undefined) {
		return false;
	}

	if (typeof value === "string") {
		return value.trim() !== "" && !isEmptyPlaceholderText(value);
	}

	if (typeof value === "number") {
		return Number.isFinite(value);
	}

	if (Array.isArray(value)) {
		return value.some((item) => isMeaningfulValue(item));
	}

	if (typeof value === "object") {
		return Object.values(value as Record<string, unknown>).some((item) =>
			isMeaningfulValue(item),
		);
	}

	return true;
}

export function shouldApplyCdsAiValueToField(args: {
	aiValue: unknown;
	currentValue: unknown;
}) {
	return (
		isMeaningfulValue(args.aiValue) && !isMeaningfulValue(args.currentValue)
	);
}

/** Các trường CDS: khi chat ghi đè, không thay thế giá trị người dùng đã có bằng giá trị AI khác trừ khi prompt sửa đúng trường đó (xem promptTouchedFieldKeys). */
export const CDS_AI_CHAT_USER_RETAIN_FIELDS = new Set<string>([
	"declarationProcessingDeptCode",
	"transportVehicleCode",
	"transportVehicleName",
	"loadingLocationCode",
	"loadingLocationName",
	"unloadingLocationCode",
	"unloadingLocationName",
]);

export type CdsAiCdsInfoApplyOptions = {
	overwrite?: boolean;
	promptTouchedFieldKeys?: ReadonlySet<string>;
};

export function collectApplicableCdsInfoEntries(
	result: CdsAiDocumentExtractionResult,
	currentData: Partial<FollowUpCdsInfoRow>,
	operationType: FollowUpOperationType | null,
	options?: CdsAiCdsInfoApplyOptions,
): Array<[keyof FollowUpCdsInfoRow, unknown]> {
	const overwrite = options?.overwrite === true;
	const patchKeys = options?.promptTouchedFieldKeys;

	return Object.entries(result.cdsInfo).filter(([fieldKey, value]) => {
		const typedKey = fieldKey as keyof FollowUpCdsInfoRow;
		const currentValue = currentData[typedKey];
		const clearOverwrite =
			overwrite &&
			CDS_INFO_FIELDS_APPLY_NULL_ON_OVERWRITE.has(typedKey) &&
			(value === null ||
				value === "" ||
				(typeof value === "string" && value.trim() === ""));

		let shouldApply = overwrite
			? isMeaningfulValue(value) || clearOverwrite
			: shouldApplyCdsAiValueToField({
					aiValue: value,
					currentValue,
				});

		if (
			overwrite &&
			shouldApply &&
			!clearOverwrite &&
			patchKeys !== undefined &&
			CDS_AI_CHAT_USER_RETAIN_FIELDS.has(fieldKey) &&
			!patchKeys.has(fieldKey) &&
			isMeaningfulValue(currentValue) &&
			isMeaningfulValue(value) &&
			formatComparableValue(currentValue) !== formatComparableValue(value)
		) {
			shouldApply = false;
		}

		return (
			shouldApply &&
			isCdsInfoFieldVisibleForOperation(fieldKey, operationType) &&
			!isCdsWebLockedField(typedKey, operationType)
		);
	}) as Array<[keyof FollowUpCdsInfoRow, unknown]>;
}

export function formatValue(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}

	if (typeof value === "number") {
		return String(value);
	}

	if (typeof value === "string") {
		return value;
	}

	if (Array.isArray(value)) {
		const compact = value
			.map((item) =>
				typeof item === "object" ? JSON.stringify(item) : String(item ?? ""),
			)
			.filter((item) => item.trim() !== "");
		return compact.join(" | ");
	}

	return JSON.stringify(value);
}

export function formatComparableValue(value: unknown): string {
	if (!isMeaningfulValue(value)) {
		return "";
	}

	if (typeof value === "number") {
		return String(value);
	}

	if (typeof value === "string") {
		return value.trim();
	}

	return JSON.stringify(value);
}

/* ------------------------------------------------------------------ */
/*  Diff helpers                                                       */
/* ------------------------------------------------------------------ */

export function resolveDiffStatus(
	currentValue: unknown,
	nextValue: unknown,
): DiffStatus {
	if (!isMeaningfulValue(currentValue) && isMeaningfulValue(nextValue)) {
		return "new";
	}

	return formatComparableValue(currentValue) ===
		formatComparableValue(nextValue)
		? "same"
		: "changed";
}

export function isScalarEditable(value: unknown) {
	return (
		value === null ||
		value === undefined ||
		typeof value === "string" ||
		typeof value === "number"
	);
}

export function getCargoCellDiffClass(status: DiffStatus) {
	if (status === "new") {
		return "border-blue-200 bg-blue-50/70";
	}

	if (status === "same") {
		return "border-emerald-200 bg-emerald-50/70";
	}

	return "border-amber-200 bg-amber-50/70";
}

/* ------------------------------------------------------------------ */
/*  File helpers                                                       */
/* ------------------------------------------------------------------ */

export function formatFileSize(file: File) {
	if (file.size < 1024) {
		return `${file.size} B`;
	}

	if (file.size < 1024 * 1024) {
		return `${(file.size / 1024).toFixed(1)} KB`;
	}

	return `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
}

/** Compact MIME label for narrow file list rows. */
export function formatMimeTypeShort(mimeType: string): string {
	const m = mimeType.trim().toLowerCase();
	if (!m) {
		return "";
	}
	if (m === "application/pdf") {
		return "PDF";
	}
	if (m.startsWith("image/")) {
		return "Ảnh";
	}
	if (
		m === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
		m === "application/vnd.ms-excel"
	) {
		return "Excel";
	}
	if (
		m ===
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
		m === "application/msword"
	) {
		return "Word";
	}
	if (m === "application/zip" || m === "application/x-zip-compressed") {
		return "ZIP";
	}
	if (mimeType.length <= 22) {
		return mimeType;
	}
	return `${mimeType.slice(0, 19)}…`;
}

export function getFileSignature(file: File) {
	return `${file.name}-${file.size}-${file.lastModified}`;
}

/* ------------------------------------------------------------------ */
/*  Drive helpers                                                      */
/* ------------------------------------------------------------------ */

export function normalizeDriveFileName(fileName: string) {
	return fileName.trim().normalize("NFC").toLowerCase();
}

export function getCanonicalDriveFileName(fileName: string) {
	const normalizedName = fileName.trim().normalize("NFC");
	return normalizedName.replace(/ \(\d+\)(?=(\.[^./\\]+)?$)/, "");
}

export function getDriveFileNameCandidates(fileName: string) {
	return Array.from(
		new Set([
			normalizeDriveFileName(fileName),
			normalizeDriveFileName(getCanonicalDriveFileName(fileName)),
		]),
	);
}

export function extractDriveFolderId(driveUrl?: string | null) {
	if (!driveUrl) {
		return null;
	}

	const match = driveUrl.match(/(?:folders\/|id=)([a-zA-Z0-9_-]+)/);
	return match ? match[1] : null;
}

export function mergeUniqueStrings(values: string[]) {
	return Array.from(new Set(values.filter((value) => value.trim() !== "")));
}

/* ------------------------------------------------------------------ */
/*  Prompt helpers                                                     */
/* ------------------------------------------------------------------ */

export function normalizePrompt(prompt: string, operationType: string | null) {
	const trimmed = prompt.trim();
	if (trimmed) {
		return trimmed;
	}

	return operationType === "NHAP"
		? "OCR chứng từ nhập khẩu và trích xuất dữ liệu để điền CDS."
		: operationType === "XUAT"
			? "OCR chứng từ xuất khẩu và trích xuất dữ liệu để điền CDS."
			: "OCR chứng từ và trích xuất dữ liệu cần thiết để điền CDS.";
}

/* ------------------------------------------------------------------ */
/*  Draft / field counters                                             */
/* ------------------------------------------------------------------ */

export function getFilledFieldCount(result: CdsAiDocumentExtractionResult) {
	return Object.values(result.cdsInfo).filter((value) =>
		isMeaningfulValue(value),
	).length;
}

export function getDocumentWarningCount(result: CdsAiDocumentExtractionResult) {
	return result.documents.reduce(
		(total, document) => total + document.warnings.length,
		0,
	);
}

export function pickMeaningfulFields<T extends Record<string, unknown>>(
	value: T,
): Partial<T> {
	return Object.fromEntries(
		Object.entries(value).filter(([, fieldValue]) =>
			isMeaningfulValue(fieldValue),
		),
	) as Partial<T>;
}

/** Đưa vào snapshot gửi AI để model thấy cả giá trị dạng placeholder (vd. UNKNOWN) — không bị lọc bởi pickMeaningfulFields. */
const SNAPSHOT_FORCE_STRING_FIELDS = new Set<string>([
	"loadingLocationCode",
	"loadingLocationName",
	"unloadingLocationCode",
	"unloadingLocationName",
]);

export function buildCurrentSnapshot(
	currentData: Partial<FollowUpCdsInfoRow>,
	currentCargoList: Partial<CargoListRow>[],
) {
	const cdsInfo = pickMeaningfulFields(
		currentData as Record<string, unknown>,
	) as Partial<FollowUpCdsInfoRow>;
	const cdsRecord = cdsInfo as Record<string, unknown>;
	const currentRecord = currentData as Record<string, unknown>;

	for (const fieldKey of SNAPSHOT_FORCE_STRING_FIELDS) {
		const raw = currentRecord[fieldKey];
		if (typeof raw === "string" && raw.trim() !== "") {
			cdsRecord[fieldKey] = raw;
		}
	}

	const cargoList = currentCargoList
		.map((row) => {
			const persistableFields = { ...row };
			delete persistableFields.id;
			delete persistableFields.followUpId;
			delete persistableFields.createdAt;
			delete persistableFields.updatedAt;

			return pickMeaningfulFields(
				persistableFields as Record<string, unknown>,
			) as Partial<CargoListRow>;
		})
		.filter((row) => Object.keys(row).length > 0);

	if (Object.keys(cdsInfo).length === 0 && cargoList.length === 0) {
		return null;
	}

	return {
		cdsInfo,
		cargoList,
	};
}

/* ------------------------------------------------------------------ */
/*  Draft parsers                                                      */
/* ------------------------------------------------------------------ */

export function parseCdsFieldDraft(
	fieldKey: string,
	rawValue: string,
	previousValue: unknown,
) {
	const trimmed = rawValue.trim();
	if (trimmed === "") {
		return null;
	}

	const inputType = CDS_FIELD_INPUT_TYPES[fieldKey];
	if (inputType === "number" || typeof previousValue === "number") {
		const parsed = Number(trimmed.replace(/,/g, ""));
		return Number.isFinite(parsed) ? parsed : (previousValue ?? null);
	}

	return trimmed;
}

export function parseCargoDraft(
	column: CargoColumn,
	rawValue: string,
	previousValue: unknown,
) {
	const trimmed = rawValue.trim();
	if (trimmed === "") {
		return null;
	}

	if (column.type === "number") {
		const parsed = Number(trimmed.replace(/,/g, ""));
		return Number.isFinite(parsed) ? parsed : (previousValue ?? null);
	}

	return trimmed;
}

/* ------------------------------------------------------------------ */
/*  Cargo row helpers                                                  */
/* ------------------------------------------------------------------ */

export function getCargoRowKey(row: Partial<CargoListRow>) {
	return [
		row.customCode,
		row.hsCode,
		row.originalCargoName,
		row.vietnameseName,
		row.invoiceNo,
		row.invoiceDate,
	]
		.map((value) => String(value ?? "").trim())
		.filter((value) => value !== "")
		.join("|");
}
