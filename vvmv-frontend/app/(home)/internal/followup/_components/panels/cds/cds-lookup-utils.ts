// cds-lookup-utils.ts – lookup utility functions extracted from cds-info-panel.tsx (Phase 2)

import { normalizeCdsTruckLoadingLocationCodes } from "@/lib/followup/cds-code-values";
import { deriveOperationType } from "@/lib/followup/operation-type";
import type { FollowUpCdsInfoRow } from "../../../types";
import { findEcusCountryOptionByText } from "../ecus-country-options";
import {
	findEcusLocationOptionByText,
	findEcusLocationOptionByValue,
} from "../ecus-location-options";
import { CDS_FIELD_LABELS } from "./cds-field-labels";
import { LOOKUP_PAIRED_NAME_FIELDS } from "./cds-lookup-dialog-meta";
import type {
	DeclarationDirection,
	LookupDialogOption,
	SelectOption,
} from "./cds-lookup-types";
import { normalizeLookupValue } from "./cds-normalize";

const EMPTY_LOOKUP_DESCRIPTIONS: Partial<
	Record<keyof FollowUpCdsInfoRow, string>
> = {
	cargoClassificationCode: "Chỉ khai khi hàng thuộc nhóm A-K theo quy định.",
	declarationProcessingDeptCode:
		"Nhập mã đội thủ tục hoặc để hệ thống gợi ý theo dữ liệu hiện có.",
	transportMethodCode: "Chọn mã 1, 2, 3, 4, 5, 6 hoặc 9.",
};

export function getLookupDescription(
	fieldKey: keyof FollowUpCdsInfoRow,
	data: Partial<FollowUpCdsInfoRow>,
	getLookupOptionsForField: (
		fieldKey: keyof FollowUpCdsInfoRow,
	) => SelectOption[],
) {
	const rawValue = data[fieldKey];
	const value =
		rawValue === null || rawValue === undefined ? "" : String(rawValue).trim();
	if (!value) {
		return EMPTY_LOOKUP_DESCRIPTIONS[fieldKey] ?? "";
	}

	const options = getLookupOptionsForField(fieldKey);
	const lookupDescription = getLookupDescriptionForValue(options, value);
	if (lookupDescription) {
		return lookupDescription;
	}

	if (fieldKey === "exportCountryCode") {
		const matchedCountry = findEcusCountryOptionByText(value);
		return matchedCountry?.fullName || matchedCountry?.name || "";
	}

	if (
		fieldKey === "taxDestinationLocation" ||
		fieldKey === "loadingLocationCode" ||
		fieldKey === "unloadingLocationCode" ||
		fieldKey === "warehouseLocationCode" ||
		fieldKey === "customsWarehouseCode" ||
		fieldKey === "finalDestinationCode"
	) {
		const matchedLocation = findEcusLocationOptionByText(value);
		return matchedLocation?.name || "";
	}

	return "";
}

export function getPairedLookupNameField(fieldKey: keyof FollowUpCdsInfoRow) {
	return LOOKUP_PAIRED_NAME_FIELDS[fieldKey];
}

export function usesManualLookupPicker(fieldKey: keyof FollowUpCdsInfoRow) {
	return (
		fieldKey === "correspondingDeclarationNumber" ||
		fieldKey === "transportVehicleCode"
	);
}

export function getLookupOptionDescription(option: SelectOption) {
	const prefix = `${option.value} - `;
	return option.label.startsWith(prefix)
		? option.label.slice(prefix.length)
		: option.label;
}

function normalizeTruckLoadingLocationCodePart(value: unknown) {
	const code = normalizeCdsTruckLoadingLocationCodes(value)
		?.split(".")[0]
		?.trim();

	return code ? code.toUpperCase() : null;
}

export function getTruckLoadingLocationOptionAddress(
	option: Pick<SelectOption, "meta"> | undefined,
) {
	return option?.meta?.address?.trim() || null;
}

function getFirstSelectedTruckLoadingLocation(
	parts: unknown[],
	options: SelectOption[],
) {
	const first = parts
		.map((part, index) => ({
			code: normalizeTruckLoadingLocationCodePart(part),
			index,
		}))
		.find((part): part is { code: string; index: number } =>
			Boolean(part.code),
		);

	if (!first) {
		return null;
	}

	const option = options.find(
		(item) => normalizeTruckLoadingLocationCodePart(item.value) === first.code,
	);

	return {
		...first,
		option,
	};
}

export function getFirstSelectedTruckLoadingLocationAddress(
	parts: unknown[],
	options: SelectOption[],
) {
	const first = getFirstSelectedTruckLoadingLocation(parts, options);

	return getTruckLoadingLocationOptionAddress(first?.option);
}

export function getFirstSelectedTruckLoadingLocationName(
	parts: unknown[],
	options: SelectOption[],
	fallbackNames: Array<string | null | undefined> = [],
) {
	const first = getFirstSelectedTruckLoadingLocation(parts, options);
	if (!first) {
		return null;
	}

	const fallbackName = String(fallbackNames[first.index] ?? "").trim();
	if (fallbackName) {
		return fallbackName;
	}

	if (first.option) {
		const optionName = getLookupOptionDescription(first.option).trim();
		if (optionName) {
			return optionName;
		}
	}

	return findEcusLocationOptionByValue(first.code)?.name ?? null;
}

export function formatLookupOptionLabel(
	value: string,
	label?: string | null,
): string {
	const normalizedValue = value.trim();
	const normalizedLabel = String(label ?? "").trim();

	if (!normalizedLabel || normalizedLabel === normalizedValue) {
		return normalizedValue;
	}

	const prefix = `${normalizedValue} - `;
	return normalizedLabel.startsWith(prefix)
		? normalizedLabel
		: `${normalizedValue} - ${normalizedLabel}`;
}

export function buildLookupDialogOptions(
	fieldKey: keyof FollowUpCdsInfoRow,
	options: SelectOption[],
): LookupDialogOption[] {
	return options.map((option, index) => {
		const description = getLookupOptionDescription(option);

		return {
			id: `${String(fieldKey)}-${option.value}-${index}`,
			value: option.value,
			label: option.label,
			description,
			meta: option.meta,
			searchText: [
				option.value,
				option.label,
				description,
				...Object.values(option.meta ?? {}).filter(Boolean),
				CDS_FIELD_LABELS.get(String(fieldKey)) ?? "",
			]
				.filter(Boolean)
				.join(" ")
				.toLowerCase(),
		};
	});
}

export function countPopulatedCollectionRows(
	value: unknown,
	rowHasValue?: (row: Record<string, unknown>) => boolean,
) {
	if (!Array.isArray(value)) {
		return 0;
	}

	return value.reduce((count, item) => {
		if (!item || typeof item !== "object") {
			return count;
		}

		const row = item as Record<string, unknown>;
		const hasValue =
			rowHasValue?.(row) ??
			Object.values(row).some((field) => {
				if (typeof field === "string") {
					return field.trim() !== "";
				}
				if (typeof field === "number") {
					return Number.isFinite(field);
				}
				return field !== null && field !== undefined;
			});

		return hasValue ? count + 1 : count;
	}, 0);
}

export function mergeLookupOptionLists(...lists: LookupDialogOption[][]) {
	const merged = new Map<string, LookupDialogOption>();

	lists.forEach((options) => {
		options.forEach((option) => {
			const key = normalizeLookupValue(option.value);
			const existing = merged.get(key);

			if (!existing) {
				merged.set(key, option);
				return;
			}

			merged.set(key, {
				...existing,
				...option,
				description: existing.description ?? option.description,
			});
		});
	});

	return [...merged.values()];
}

export function dedupeSelectOptions(options: SelectOption[]) {
	const merged = new Map<string, SelectOption>();

	options.forEach((option) => {
		const value = option.value?.trim();
		const label = option.label?.trim() || value;

		if (!value) {
			return;
		}

		const key = value.toUpperCase();
		const candidate = {
			value,
			label,
			meta: option.meta,
		};
		const existing = merged.get(key);

		if (!existing) {
			merged.set(key, candidate);
			return;
		}

		const existingHasDescription =
			getLookupOptionDescription(existing) !== existing.value;
		const candidateHasDescription =
			getLookupOptionDescription(candidate) !== candidate.value;

		if (existingHasDescription !== candidateHasDescription) {
			merged.set(
				key,
				mergeSelectOptionMeta(
					candidateHasDescription ? candidate : existing,
					candidateHasDescription ? existing : candidate,
				),
			);
			return;
		}

		if (candidate.label.length > existing.label.length) {
			merged.set(key, mergeSelectOptionMeta(candidate, existing));
			return;
		}

		merged.set(key, mergeSelectOptionMeta(existing, candidate));
	});

	return [...merged.values()];
}

export function dedupeSelectOptionsByValueAndLabel(options: SelectOption[]) {
	const merged = new Map<string, SelectOption>();

	options.forEach((option) => {
		const value = option.value?.trim();
		const label = option.label?.trim() || value;

		if (!value) {
			return;
		}

		const key = `${value}::${label}`;
		if (merged.has(key)) {
			return;
		}

		merged.set(key, {
			value,
			label,
			meta: option.meta,
		});
	});

	return [...merged.values()];
}

function mergeSelectOptionMeta(
	preferred: SelectOption,
	fallback: SelectOption,
) {
	return {
		...preferred,
		meta:
			preferred.meta || fallback.meta
				? {
						...(fallback.meta ?? {}),
						...(preferred.meta ?? {}),
					}
				: undefined,
	};
}

export function getOperationCodeDirection(
	operationCode: string | null | undefined,
): DeclarationDirection {
	const operationType = deriveOperationType({
		operationCode,
	});

	if (operationType === "NHAP") {
		return "import";
	}

	if (operationType === "XUAT") {
		return "export";
	}

	return "unknown";
}
export function getLookupDescriptionForValue(
	options: SelectOption[],
	rawValue: string | null | undefined,
): string {
	const value = String(rawValue ?? "").trim();
	if (!value) {
		return "";
	}

	const matchedOption = options.find(
		(option) =>
			normalizeLookupValue(option.value) === normalizeLookupValue(value),
	);
	if (!matchedOption) {
		return "";
	}

	return getLookupOptionDescription(matchedOption);
}
