// Pure helpers for CDS lookup option lists — shared by useCdsLookupOptions and tests
import type { FollowUpCdsInfoRow } from "../../../types";
import type {
	CdsDatabaseOperationCode,
	DeclarationDirection,
	LookupSource,
	SelectOption,
} from "./cds-lookup-types";
import {
	dedupeSelectOptions,
	formatLookupOptionLabel,
	getOperationCodeDirection,
} from "./cds-lookup-utils";
import { ECUS_OPERATION_CODE_OPTIONS } from "./cds-options";

const EMPTY_SELECT_OPTIONS: SelectOption[] = [];

export type CdsFieldKey = Extract<keyof FollowUpCdsInfoRow, string>;

export function preferReturnedOptions(
	dynamicOptions: SelectOption[],
	fallbackOptions: SelectOption[] = EMPTY_SELECT_OPTIONS,
) {
	if (dynamicOptions.length > 0) {
		const fallbackLabelByValue = new Map(
			fallbackOptions.map((option) => [
				option.value.trim(),
				option.label.trim(),
			]),
		);

		const enrichedDynamicOptions = dynamicOptions.map((option) => {
			const normalizedValue = option.value.trim();
			const normalizedLabel = option.label.trim();
			const fallbackLabel = fallbackLabelByValue.get(normalizedValue);

			const looksLikeCodeOnlyLabel =
				!normalizedLabel || normalizedLabel === normalizedValue;

			if (!looksLikeCodeOnlyLabel || !fallbackLabel) {
				return option;
			}

			return {
				...option,
				label: fallbackLabel,
			};
		});

		return dedupeSelectOptions(enrichedDynamicOptions);
	}

	return dedupeSelectOptions(fallbackOptions);
}

export function buildEcusOperationCodeFallbackOptions(
	lookupDirection: DeclarationDirection,
): SelectOption[] {
	return dedupeSelectOptions(
		ECUS_OPERATION_CODE_OPTIONS.filter((item) => {
			const direction = getOperationCodeDirection(item.code);
			if (lookupDirection === "unknown" || direction === "unknown") {
				return true;
			}
			return direction === lookupDirection;
		}).map((item) => ({
			value: item.code,
			label: `${item.code} - ${item.name}`,
		})),
	);
}

export function buildDynamicOperationCodeOptions(
	operationCodes: CdsDatabaseOperationCode[] | undefined | null,
	lookupDirection: DeclarationDirection,
): SelectOption[] {
	return dedupeSelectOptions(
		(operationCodes ?? [])
			.filter((item) => {
				const direction = getOperationCodeDirection(item.code);
				if (lookupDirection === "unknown" || direction === "unknown") {
					return true;
				}
				return direction === lookupDirection;
			})
			.map((item) => ({
				value: item.code.trim(),
				label: formatLookupOptionLabel(item.code, item.name),
			})),
	);
}

export function mergeOperationCodeSelectOptions(
	operationCodes: CdsDatabaseOperationCode[] | undefined | null,
	lookupDirection: DeclarationDirection,
): SelectOption[] {
	const dynamicOptions = buildDynamicOperationCodeOptions(
		operationCodes,
		lookupDirection,
	);
	const fallbackOptions =
		buildEcusOperationCodeFallbackOptions(lookupDirection);
	return preferReturnedOptions(dynamicOptions, fallbackOptions);
}

/** Lookup UX source for operationCode: live when payload includes HAN operation codes, else ECUS-only fallback. */
export function getOperationCodeLookupSource(
	operationCodes: CdsDatabaseOperationCode[] | undefined | null,
): LookupSource {
	return (operationCodes?.length ?? 0) > 0 ? "live" : "fallback";
}

export function buildGuaranteeBankLookupOptions(
	getDynamicOptions: (fieldKey: CdsFieldKey) => SelectOption[],
): SelectOption[] {
	return dedupeSelectOptions([
		...getDynamicOptions("guaranteeBankCode"),
		...getDynamicOptions("taxSubstituteBankCode"),
	]);
}
