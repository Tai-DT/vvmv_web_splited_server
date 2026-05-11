// use-cds-form.ts – form handlers extracted from cds-info-panel.tsx (Phase 3)
"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
	isCdsLookupValueField,
	normalizeCdsLookupValueField,
} from "@/lib/followup/cds-code-values";
import {
	buildCdsPartnerAddressFieldChangePatch,
	isCdsPartnerAddressField,
	normalizeCdsPartnerAddressFields,
} from "@/lib/followup/cds-partner-address";
import { isCdsWebLockedField } from "@/lib/followup/cds-web-locked-fields";
import {
	type CompanyProfileDefaults,
	mergeCompanyProfileDefaults,
} from "@/lib/followup/company-profile-defaults";
import type { FollowUpOperationType } from "@/lib/followup/operation-type";
import type { FollowUpCdsInfoRow, FollowUpRow } from "../../../types";
import { findEcusCountryOptionByText } from "../ecus-country-options";
import { ECUS_PARTNER_DIRECTORY } from "../ecus-partner-directory";
import { LOOKUP_PAIRED_NAME_FIELDS } from "./cds-lookup-dialog-meta";
import type { SelectOption } from "./cds-lookup-types";
import {
	getLookupDescriptionForValue,
	getPairedLookupNameField,
} from "./cds-lookup-utils";
import { normalizeLookupValue } from "./cds-normalize";
import {
	findPartnerDirectoryEntry,
	mergePartnerDirectoryEntries,
} from "./cds-partner-utils";
import { areShallowRecordsEqual } from "./cds-utils";

const NON_DETERMINISTIC_PAIRED_LOOKUP_FIELDS = new Set<
	keyof FollowUpCdsInfoRow
>(["transportVehicleCode"]);
const COMPANY_PARTY_FIELD_KEYS = [
	"importerCode",
	"importExportUnitName",
	"importerPostalCode",
	"importExportBusinessAddress",
	"importerPhone",
] as const satisfies ReadonlyArray<keyof FollowUpCdsInfoRow>;

type CompanyPartyAutofillPayload = Pick<
	FollowUpCdsInfoRow,
	(typeof COMPANY_PARTY_FIELD_KEYS)[number]
>;

export interface UseCdsFormParams {
	data: Partial<FollowUpCdsInfoRow>;
	setData: React.Dispatch<React.SetStateAction<Partial<FollowUpCdsInfoRow>>>;
	preserveActiveScroll?: (applyChange: () => void) => void;
	resolvedOperationType: FollowUpOperationType | null;
	taxCode?: string | null;
	companyName?: string | null;
	followUpSummary?: Partial<FollowUpRow> | null;
	companyProfile?: CompanyProfileDefaults | null;
	getLookupOptionsForField: (
		fieldKey: keyof FollowUpCdsInfoRow,
	) => SelectOption[];
}

function clearImportImage1DependentFields(
	record: Record<string, unknown>,
	triggerField: "importerCode" | "exporterCode" | "entrustedImporterCode",
) {
	if (triggerField === "importerCode") {
		record.importExportUnitName = null;
		record.importerPostalCode = null;
		record.importExportBusinessAddress = null;
		record.importerPhone = null;
	} else if (triggerField === "entrustedImporterCode") {
		record.entrustedImporterName = null;
	} else if (triggerField === "exporterCode") {
		record.partnerName = null;
		record.exporterPostalCode = null;
		record.partnerAddress1 = null;
		record.partnerAddress2 = null;
		record.partnerAddress3 = null;
		record.partnerAddress4 = null;
		record.exportCountryCode = null;
	}
}

function normalizeComparableAutofillValue(value: unknown) {
	return value === null || value === undefined ? "" : String(value).trim();
}

function buildCompanyPartyAutofillPayload(args: {
	companyProfileDefaults: CompanyProfileDefaults | null;
	taxCode?: string | null;
	companyName?: string | null;
	followUpSummary?: Partial<FollowUpRow> | null;
}) {
	const resolvedCompanyTaxCode =
		args.companyProfileDefaults?.taxCode ||
		args.taxCode?.trim() ||
		args.followUpSummary?.taxCode?.trim() ||
		null;
	const resolvedCompanyName =
		args.companyProfileDefaults?.companyName ||
		args.companyName?.trim() ||
		args.followUpSummary?.companyName?.trim() ||
		null;

	return {
		importerCode: resolvedCompanyTaxCode,
		importExportUnitName: resolvedCompanyName,
		importerPostalCode: args.companyProfileDefaults?.importerPostalCode ?? null,
		importExportBusinessAddress:
			args.companyProfileDefaults?.importExportBusinessAddress ?? null,
		importerPhone: args.companyProfileDefaults?.importerPhone ?? null,
	} satisfies CompanyPartyAutofillPayload;
}

export function useCdsForm({
	setData,
	preserveActiveScroll,
	resolvedOperationType,
	taxCode,
	companyName,
	followUpSummary,
	companyProfile,
	getLookupOptionsForField,
}: UseCdsFormParams) {
	const importImage1PartnerDirectoryEntries = useMemo(
		() => mergePartnerDirectoryEntries(ECUS_PARTNER_DIRECTORY),
		[],
	);
	const companyProfileDefaults = useMemo(
		() =>
			mergeCompanyProfileDefaults({
				taxCode: taxCode?.trim() || followUpSummary?.taxCode?.trim() || null,
				companyName:
					companyName?.trim() || followUpSummary?.companyName?.trim() || null,
				companyProfile,
			}),
		[
			companyName,
			companyProfile,
			followUpSummary?.companyName,
			followUpSummary?.taxCode,
			taxCode,
		],
	);
	const companyPartyAutofill = useMemo(
		() =>
			buildCompanyPartyAutofillPayload({
				companyProfileDefaults,
				taxCode,
				companyName,
				followUpSummary,
			}),
		[companyName, companyProfileDefaults, followUpSummary, taxCode],
	);
	const previousCompanyPartyAutofillRef = useRef(companyPartyAutofill);

	const applyInternalDataChange = useCallback(
		(applyChange: () => void) => {
			if (preserveActiveScroll) {
				preserveActiveScroll(applyChange);
				return;
			}

			applyChange();
		},
		[preserveActiveScroll],
	);

	const applyImportImage1SourceAutofill = useCallback(
		(
			next: Record<string, unknown>,
			prev: Partial<FollowUpCdsInfoRow>,
			fieldKey: keyof FollowUpCdsInfoRow,
			rawValue: unknown,
		) => {
			if (
				resolvedOperationType !== "NHAP" &&
				resolvedOperationType !== "XUAT"
			) {
				return;
			}

			const normalizedValue =
				rawValue === null || rawValue === undefined
					? ""
					: String(rawValue).trim();

			if (fieldKey === "importerCode") {
				const normalizedCompanyTaxCode = normalizeLookupValue(
					companyProfileDefaults?.taxCode ||
						taxCode?.trim() ||
						followUpSummary?.taxCode?.trim() ||
						null,
				);
				const normalizedPreviousValue = normalizeLookupValue(
					typeof prev.importerCode === "string" ? prev.importerCode : null,
				);

				if (!normalizedValue || !normalizedCompanyTaxCode) {
					clearImportImage1DependentFields(next, "importerCode");
					return;
				}

				if (
					normalizeLookupValue(normalizedValue) !== normalizedCompanyTaxCode
				) {
					clearImportImage1DependentFields(next, "importerCode");
					return;
				}

				const resolvedCompanyName =
					companyProfileDefaults?.companyName ||
					companyName?.trim() ||
					followUpSummary?.companyName?.trim() ||
					null;

				next.importExportUnitName =
					resolvedCompanyName ||
					(normalizedPreviousValue === normalizedCompanyTaxCode
						? (prev.importExportUnitName ?? null)
						: null);
				next.importerPostalCode =
					companyProfileDefaults?.importerPostalCode ??
					(normalizedPreviousValue === normalizedCompanyTaxCode
						? (prev.importerPostalCode ?? null)
						: null);
				next.importExportBusinessAddress =
					companyProfileDefaults?.importExportBusinessAddress ??
					(normalizedPreviousValue === normalizedCompanyTaxCode
						? (prev.importExportBusinessAddress ?? null)
						: null);
				next.importerPhone =
					companyProfileDefaults?.importerPhone ??
					(normalizedPreviousValue === normalizedCompanyTaxCode
						? (prev.importerPhone ?? null)
						: null);

				return;
			}

			if (fieldKey === "entrustedImporterCode") {
				if (!normalizedValue) {
					clearImportImage1DependentFields(next, "entrustedImporterCode");
					return;
				}

				const normalizedCompanyTaxCode = normalizeLookupValue(
					companyProfileDefaults?.taxCode ||
						taxCode?.trim() ||
						followUpSummary?.taxCode?.trim() ||
						null,
				);
				const resolvedCompanyName =
					companyProfileDefaults?.companyName ||
					companyName?.trim() ||
					followUpSummary?.companyName?.trim() ||
					null;

				if (
					normalizedCompanyTaxCode &&
					normalizeLookupValue(normalizedValue) === normalizedCompanyTaxCode
				) {
					next.entrustedImporterName = resolvedCompanyName;
					return;
				}

				const matchedEntry = findPartnerDirectoryEntry(
					importImage1PartnerDirectoryEntries,
					{
						exporterCode: normalizedValue,
						partnerName: null,
					},
				);

				next.entrustedImporterName = matchedEntry?.name ?? null;
				return;
			}

			if (fieldKey === "exporterCode") {
				if (!normalizedValue) {
					clearImportImage1DependentFields(next, "exporterCode");
					return;
				}

				const matchedEntry = findPartnerDirectoryEntry(
					importImage1PartnerDirectoryEntries,
					{
						exporterCode: normalizedValue,
						partnerName: null,
					},
				);

				if (!matchedEntry) {
					clearImportImage1DependentFields(next, "exporterCode");
					return;
				}

				next.partnerName = matchedEntry.name || null;
				next.exporterPostalCode = matchedEntry.postalCode ?? null;
				Object.assign(
					next,
					normalizeCdsPartnerAddressFields({
						partnerAddress1: matchedEntry.address1,
						partnerAddress2: matchedEntry.address2,
						partnerAddress3: matchedEntry.address3,
						partnerAddress4: null,
					}),
				);
				next.exportCountryCode =
					findEcusCountryOptionByText(matchedEntry.countryName)?.value ?? null;
			}
		},
		[
			companyName,
			companyProfileDefaults,
			followUpSummary?.companyName,
			followUpSummary?.taxCode,
			importImage1PartnerDirectoryEntries,
			resolvedOperationType,
			taxCode,
		],
	);

	const handleFieldChange = useCallback(
		(key: string, value: unknown) => {
			const fieldKey = key as keyof FollowUpCdsInfoRow;
			if (isCdsWebLockedField(fieldKey, resolvedOperationType)) {
				return;
			}

			const nextValue = isCdsLookupValueField(fieldKey)
				? normalizeCdsLookupValueField(fieldKey, value)
				: value;

			setData((prev) => {
				const previousRecord = prev as Record<string, unknown>;
				const next = { ...prev, [key]: nextValue } as Record<string, unknown>;
				if (isCdsPartnerAddressField(fieldKey)) {
					Object.assign(
						next,
						buildCdsPartnerAddressFieldChangePatch(fieldKey, nextValue),
					);
				}

				const isProcessingDepartmentParentField =
					fieldKey === "customsCode" || fieldKey === "operationCode";

				if (isProcessingDepartmentParentField) {
					const previousParentValue = normalizeLookupValue(prev[fieldKey]);
					const nextParentValue = normalizeLookupValue(
						nextValue === null || nextValue === undefined
							? null
							: String(nextValue),
					);

					if (
						previousParentValue !== nextParentValue &&
						normalizeLookupValue(prev.declarationProcessingDeptCode)
					) {
						next.declarationProcessingDeptCode = null;
					}
				}

				applyImportImage1SourceAutofill(next, prev, fieldKey, nextValue);

				const pairedNameField = getPairedLookupNameField(fieldKey);

				if (!pairedNameField) {
					return areShallowRecordsEqual(previousRecord, next)
						? prev
						: (next as Partial<FollowUpCdsInfoRow>);
				}

				const normalizedValue =
					nextValue === null || nextValue === undefined
						? ""
						: String(nextValue).trim();
				const options = getLookupOptionsForField(fieldKey);

				if (NON_DETERMINISTIC_PAIRED_LOOKUP_FIELDS.has(fieldKey)) {
					const previousValue =
						prev[fieldKey] === null || prev[fieldKey] === undefined
							? ""
							: String(prev[fieldKey]).trim();

					if (
						previousValue &&
						normalizedValue &&
						normalizeLookupValue(previousValue) !==
							normalizeLookupValue(normalizedValue)
					) {
						next[pairedNameField] = null;
					}

					return areShallowRecordsEqual(previousRecord, next)
						? prev
						: (next as Partial<FollowUpCdsInfoRow>);
				}

				if (!normalizedValue) {
					next[pairedNameField] = null;
					return areShallowRecordsEqual(previousRecord, next)
						? prev
						: (next as Partial<FollowUpCdsInfoRow>);
				}

				if (options.length === 0) {
					return areShallowRecordsEqual(previousRecord, next)
						? prev
						: (next as Partial<FollowUpCdsInfoRow>);
				}

				const resolvedDescription = getLookupDescriptionForValue(
					options,
					normalizedValue,
				);
				next[pairedNameField] = resolvedDescription || null;
				return areShallowRecordsEqual(previousRecord, next)
					? prev
					: (next as Partial<FollowUpCdsInfoRow>);
			});
		},
		[
			applyImportImage1SourceAutofill,
			getLookupOptionsForField,
			resolvedOperationType,
			setData,
		],
	);

	useEffect(() => {
		if (resolvedOperationType !== "NHAP" && resolvedOperationType !== "XUAT") {
			previousCompanyPartyAutofillRef.current = companyPartyAutofill;
			return;
		}

		const previousCompanyPartyAutofill =
			previousCompanyPartyAutofillRef.current;

		applyInternalDataChange(() => {
			setData((prev) => {
				const previousRecord = prev as Record<string, unknown>;
				const next = { ...prev } as Record<string, unknown>;
				let changed = false;

				COMPANY_PARTY_FIELD_KEYS.forEach((fieldKey) => {
					const currentValue = normalizeComparableAutofillValue(prev[fieldKey]);
					const previousAutofillValue = normalizeComparableAutofillValue(
						previousCompanyPartyAutofill[fieldKey],
					);
					const nextAutofillValue = companyPartyAutofill[fieldKey] ?? null;
					const normalizedNextAutofillValue =
						normalizeComparableAutofillValue(nextAutofillValue);
					const shouldAutofill =
						currentValue === "" || currentValue === previousAutofillValue;

					if (!shouldAutofill) {
						return;
					}

					const normalizedPreviousStoredValue =
						normalizeComparableAutofillValue(prev[fieldKey]);

					if (normalizedPreviousStoredValue === normalizedNextAutofillValue) {
						return;
					}

					next[fieldKey] = nextAutofillValue;
					changed = true;
				});

				return changed && !areShallowRecordsEqual(previousRecord, next)
					? (next as Partial<FollowUpCdsInfoRow>)
					: prev;
			});
		});

		previousCompanyPartyAutofillRef.current = companyPartyAutofill;
	}, [
		applyInternalDataChange,
		companyPartyAutofill,
		resolvedOperationType,
		setData,
	]);

	useEffect(() => {
		applyInternalDataChange(() => {
			setData((prev) => {
				let changed = false;
				const next = { ...prev } as Record<string, unknown>;

				(
					Object.keys(LOOKUP_PAIRED_NAME_FIELDS) as Array<
						keyof FollowUpCdsInfoRow
					>
				).forEach((fieldKey) => {
					const pairedNameField = getPairedLookupNameField(fieldKey) as
						| keyof FollowUpCdsInfoRow
						| undefined;
					if (!pairedNameField) {
						return;
					}

					const currentValue =
						prev[fieldKey] === null || prev[fieldKey] === undefined
							? ""
							: String(prev[fieldKey]).trim();

					if (NON_DETERMINISTIC_PAIRED_LOOKUP_FIELDS.has(fieldKey)) {
						return;
					}

					const options = getLookupOptionsForField(fieldKey);

					if (!currentValue) {
						if (prev[pairedNameField]) {
							next[pairedNameField] = null;
							changed = true;
						}
						return;
					}

					if (options.length === 0) {
						return;
					}

					const resolvedDescription = getLookupDescriptionForValue(
						options,
						currentValue,
					);

					if (!resolvedDescription) {
						if (prev[pairedNameField]) {
							next[pairedNameField] = null;
							changed = true;
						}
						return;
					}

					if (String(prev[pairedNameField] ?? "") !== resolvedDescription) {
						next[pairedNameField] = resolvedDescription;
						changed = true;
					}
				});

				return changed ? (next as Partial<FollowUpCdsInfoRow>) : prev;
			});
		});
	}, [applyInternalDataChange, getLookupOptionsForField, setData]);

	return {
		handleFieldChange,
	};
}
