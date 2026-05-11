import type { FollowUpCdsInfoRow } from "@/app/(home)/internal/followup/types";
import type {
	CdsAiDocumentExtractionResult,
	CdsAiDocumentFieldSource,
} from "@/lib/followup/cds-ai-document";
import { normalizeLocalDate } from "@/lib/followup/cds-info-sanitize";
import { normalizeLooseNumber } from "@/lib/followup/number-utils";

export type CdsAiFieldReviewChoiceSource = "old" | "ai" | "document";

export type CdsAiFieldReviewChoice = {
	id: string;
	label: string;
	detail: string | null;
	sourceType: CdsAiFieldReviewChoiceSource;
	value: string | number | null;
};

export type CdsAiFieldReview = {
	fieldKey: keyof FollowUpCdsInfoRow;
	oldValue: unknown;
	currentValue: unknown;
	aiValue: unknown;
	sourceValues: CdsAiDocumentFieldSource[];
	hasAiFill: boolean;
	hasOldMismatch: boolean;
	hasSourceConflict: boolean;
	choices: CdsAiFieldReviewChoice[];
};

export type CdsAiFieldReviewMap = Partial<
	Record<keyof FollowUpCdsInfoRow, CdsAiFieldReview>
>;

export type CdsAiReviewedFieldState = {
	signature: string;
	selectedComparableValue: string;
};

export type CdsAiReviewedFieldMap = Partial<
	Record<keyof FollowUpCdsInfoRow, CdsAiReviewedFieldState>
>;

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
		"khong co",
		"khong tim thay",
		"khong thay",
		"chua co",
	]).has(normalized);
}

function isMeaningfulValue(value: unknown): boolean {
	if (value === null || value === undefined) {
		return false;
	}

	if (typeof value === "string") {
		return value.trim() !== "" && !isEmptyPlaceholderText(value);
	}

	if (typeof value === "number") {
		return Number.isFinite(value);
	}

	return true;
}

function isDateLikeText(value: string) {
	return (
		/^\d{4}-\d{1,2}-\d{1,2}$/.test(value) ||
		/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(value)
	);
}

function isNumericLikeText(value: string) {
	return /^[+-]?\d[\d\s.,]*$/.test(value);
}

export function normalizeCdsAiComparableValue(value: unknown): string {
	if (!isMeaningfulValue(value)) {
		return "";
	}

	if (typeof value === "number") {
		return `number:${value}`;
	}

	const text = String(value).trim().replace(/\s+/g, " ");
	if (!text) {
		return "";
	}

	if (isDateLikeText(text)) {
		const normalizedDate = normalizeLocalDate(text);
		if (normalizedDate) {
			return `date:${normalizedDate}`;
		}
	}

	if (isNumericLikeText(text)) {
		const normalizedNumber = normalizeLooseNumber(text);
		if (normalizedNumber !== null) {
			return `number:${normalizedNumber}`;
		}
	}

	return `text:${text.toLocaleUpperCase("vi-VN")}`;
}

export function areCdsAiComparableValuesEqual(left: unknown, right: unknown) {
	return (
		normalizeCdsAiComparableValue(left) === normalizeCdsAiComparableValue(right)
	);
}

export function formatCdsAiReviewValue(value: unknown): string {
	if (!isMeaningfulValue(value)) {
		return "Trống";
	}

	if (typeof value === "string" || typeof value === "number") {
		return String(value);
	}

	return JSON.stringify(value);
}

function toChoiceValue(value: unknown): string | number | null {
	if (!isMeaningfulValue(value)) {
		return null;
	}

	if (typeof value === "number") {
		return value;
	}

	return String(value);
}

function buildChoices(args: {
	oldValue: unknown;
	aiValue: unknown;
	sourceValues: CdsAiDocumentFieldSource[];
}) {
	const choices: CdsAiFieldReviewChoice[] = [];

	if (isMeaningfulValue(args.oldValue)) {
		choices.push({
			id: "old",
			label: "Dữ liệu CDS cũ",
			detail: null,
			sourceType: "old",
			value: toChoiceValue(args.oldValue),
		});
	}

	if (isMeaningfulValue(args.aiValue)) {
		choices.push({
			id: "ai",
			label: "AI đề xuất",
			detail: null,
			sourceType: "ai",
			value: toChoiceValue(args.aiValue),
		});
	}

	args.sourceValues.forEach((source, index) => {
		if (!isMeaningfulValue(source.value)) {
			return;
		}

		choices.push({
			id: `document-${index}`,
			label: source.fileName,
			detail: source.documentType,
			sourceType: "document",
			value: toChoiceValue(source.value),
		});
	});

	return choices;
}

export function shouldShowCdsAiFieldReview(
	review: CdsAiFieldReview | null | undefined,
) {
	return Boolean(review?.hasOldMismatch || review?.hasSourceConflict);
}

export function shouldShowCdsAiFieldInfo(
	review: CdsAiFieldReview | null | undefined,
) {
	return Boolean(review?.hasAiFill && !shouldShowCdsAiFieldReview(review));
}

export function getCdsAiFieldReviewSignature(review: CdsAiFieldReview) {
	return JSON.stringify({
		fieldKey: review.fieldKey,
		oldValue: normalizeCdsAiComparableValue(review.oldValue),
		aiValue: normalizeCdsAiComparableValue(review.aiValue),
		hasAiFill: review.hasAiFill,
		hasOldMismatch: review.hasOldMismatch,
		hasSourceConflict: review.hasSourceConflict,
		sources: review.sourceValues.map((source) => ({
			fileName: source.fileName,
			documentType: source.documentType,
			value: normalizeCdsAiComparableValue(source.value),
		})),
	});
}

export function isCdsAiFieldReviewResolved(
	review: CdsAiFieldReview | null | undefined,
	reviewedState: CdsAiReviewedFieldState | null | undefined,
) {
	if (!review || !shouldShowCdsAiFieldReview(review) || !reviewedState) {
		return false;
	}

	return (
		getCdsAiFieldReviewSignature(review) === reviewedState.signature &&
		normalizeCdsAiComparableValue(review.currentValue) ===
			reviewedState.selectedComparableValue
	);
}

export function buildCdsAiFieldReviewMap(args: {
	beforeData: Partial<FollowUpCdsInfoRow> | null | undefined;
	currentData: Partial<FollowUpCdsInfoRow>;
	result: CdsAiDocumentExtractionResult | null | undefined;
}): CdsAiFieldReviewMap {
	const { beforeData, currentData, result } = args;

	if (!result) {
		return {};
	}

	const fieldKeys = new Set<keyof FollowUpCdsInfoRow>();
	Object.keys(result.cdsInfo).forEach((key) => {
		fieldKeys.add(key as keyof FollowUpCdsInfoRow);
	});
	Object.keys(result.fieldSources ?? {}).forEach((key) => {
		fieldKeys.add(key as keyof FollowUpCdsInfoRow);
	});

	const output: CdsAiFieldReviewMap = {};

	fieldKeys.forEach((fieldKey) => {
		const oldValue = beforeData?.[fieldKey];
		const currentValue = currentData[fieldKey];
		const aiValue = result.cdsInfo[fieldKey];
		const sourceValues = result.fieldSources[fieldKey] ?? [];
		const meaningfulSourceComparables = sourceValues
			.map((source) => normalizeCdsAiComparableValue(source.value))
			.filter((value) => value !== "");
		const hasSourceConflict = new Set(meaningfulSourceComparables).size > 1;
		const hasOldMismatch =
			isMeaningfulValue(oldValue) &&
			isMeaningfulValue(aiValue) &&
			!areCdsAiComparableValuesEqual(oldValue, aiValue);
		const hasAiFill =
			!isMeaningfulValue(oldValue) &&
			isMeaningfulValue(aiValue) &&
			areCdsAiComparableValuesEqual(currentValue, aiValue);

		if (!hasOldMismatch && !hasSourceConflict && !hasAiFill) {
			return;
		}

		output[fieldKey] = {
			fieldKey,
			oldValue,
			currentValue,
			aiValue,
			sourceValues,
			hasAiFill,
			hasOldMismatch,
			hasSourceConflict,
			choices: buildChoices({
				oldValue,
				aiValue,
				sourceValues,
			}),
		};
	});

	return output;
}
