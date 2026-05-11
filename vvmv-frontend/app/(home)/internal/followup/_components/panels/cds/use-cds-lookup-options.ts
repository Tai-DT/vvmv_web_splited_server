// use-cds-lookup-options.ts – lookup option computation extracted from CdsInfoPanel (Phase 3)
"use client";

import { useCallback, useMemo } from "react";
import { getCdsStaticFieldOptions } from "@/lib/followup/cds-static-field-options";
import {
	CDS_RELEASE_BEFORE_PERMIT_OPTIONS,
	CDS_TAX_PAYER_OPTIONS,
	CDS_TAX_PAYMENT_DEADLINE_OPTIONS,
} from "@/lib/followup/cds-tax-options";
import {
	getVnaccsStandardFieldOptions,
	isAllowedVnaccsStandardFieldValue,
} from "@/lib/followup/cds-vnaccs-standard-rules";
import {
	getCdsWeightUnitOptions,
	isAllowedCdsWeightUnit,
} from "@/lib/followup/cds-weight-units";
import {
	filterProcessingDepartments,
	pickPreferredProcessingDepartment,
} from "@/lib/followup/processing-department";
import type { FollowUpCdsInfoRow } from "../../../types";
import { ECUS_COUNTRY_OPTIONS } from "../ecus-country-options";
import { ECUS_CUSTOMS_CODE_OPTIONS } from "../ecus-customs-options";
import { ECUS_LEGAL_DOCUMENT_OPTIONS } from "../ecus-legal-document-options";
import { ECUS_LOCATION_OPTIONS } from "../ecus-location-options";
import type {
	CdsDatabaseFieldOption,
	CdsDatabaseLookupsPayload,
	DeclarationDirection,
	LookupSource,
	SelectOption,
} from "./cds-lookup-types";
import {
	dedupeSelectOptions,
	formatLookupOptionLabel,
} from "./cds-lookup-utils";
import {
	ECUS_BUSINESS_GROUP_OPTIONS,
	ECUS_CARGO_CLASSIFICATION_OPTIONS,
	ECUS_INSPECTION_RESULT_OPTIONS,
	ECUS_PERSON_ORG_OPTIONS,
	ECUS_TRANSPORT_METHOD_OPTIONS,
} from "./cds-options";
import { hasProcessingDepartmentPrerequisites } from "./cds-processing-department-dependencies";
import {
	APP_FIELD_OPTION_FIELDS,
	CDS_HARDCODED_FIELD_OPTION_FIELDS,
} from "./cds-sets";
import {
	buildGuaranteeBankLookupOptions,
	type CdsFieldKey,
	getOperationCodeLookupSource,
	mergeOperationCodeSelectOptions,
	preferReturnedOptions,
} from "./use-cds-lookup-options.build";

const EMPTY_SELECT_OPTIONS: SelectOption[] = [];
type FieldOptionSourceStats = {
	hasManualAppFieldOptions: boolean;
	hasSavedAppFieldOptions: boolean;
	hasLiveFieldOptions: boolean;
};

const EMPTY_FIELD_OPTION_SOURCE_STATS: FieldOptionSourceStats = {
	hasManualAppFieldOptions: false,
	hasSavedAppFieldOptions: false,
	hasLiveFieldOptions: false,
};
const CDS_APP_CATALOG_FIELD_OPTIONS = new Set<CdsFieldKey>([
	"packageType",
	"weightUnit",
]);

function shouldSkipDynamicFieldOptions(fieldKey: CdsFieldKey) {
	return (
		CDS_HARDCODED_FIELD_OPTION_FIELDS.has(fieldKey) &&
		!CDS_APP_CATALOG_FIELD_OPTIONS.has(fieldKey)
	);
}

function isAllowedDynamicFieldOptionValue(
	fieldKey: CdsFieldKey,
	value: string,
) {
	if (fieldKey === "weightUnit") {
		return isAllowedCdsWeightUnit(value);
	}

	return isAllowedVnaccsStandardFieldValue(fieldKey, value);
}

function toStandardSelectOptions(fieldKey: CdsFieldKey) {
	return dedupeSelectOptions(
		getVnaccsStandardFieldOptions(fieldKey).map((option) => ({
			value: option.value,
			label: option.label,
		})),
	);
}

function toStaticSelectOptions(fieldKey: CdsFieldKey) {
	return dedupeSelectOptions(
		getCdsStaticFieldOptions(fieldKey).map((option) => ({
			value: option.value,
			label: option.label,
		})),
	);
}

export interface UseCdsLookupOptionsParams {
	cdsLookups: CdsDatabaseLookupsPayload | null;
	lookupDirection: DeclarationDirection;
	data: Partial<FollowUpCdsInfoRow>;
}

export function useCdsLookupOptions({
	cdsLookups,
	lookupDirection,
	data,
}: UseCdsLookupOptionsParams) {
	const fieldOptions = cdsLookups?.fieldOptions ?? {};
	const processingDepartmentCustomsCode = data.customsCode;
	const processingDepartmentOperationCode = data.operationCode;
	const hasProcessingDepartmentDependencies = useMemo(
		() =>
			hasProcessingDepartmentPrerequisites({
				customsCode: processingDepartmentCustomsCode,
				operationCode: processingDepartmentOperationCode,
			}),
		[processingDepartmentCustomsCode, processingDepartmentOperationCode],
	);

	const dynamicFieldOptionsByField = useMemo(() => {
		const result: Partial<Record<CdsFieldKey, SelectOption[]>> = {};

		(
			Object.entries(fieldOptions) as Array<
				[CdsFieldKey, CdsDatabaseFieldOption[]]
			>
		).forEach(([fieldKey, rawFieldOptions]) => {
			if (shouldSkipDynamicFieldOptions(fieldKey)) {
				return;
			}

			const filteredFieldOptions = rawFieldOptions.filter(
				(item) =>
					(lookupDirection === "unknown" ||
						item.direction === "unknown" ||
						item.direction === lookupDirection) &&
					isAllowedDynamicFieldOptionValue(fieldKey, item.value),
			);

			result[fieldKey] = [...filteredFieldOptions]
				.sort((left, right) => right.count - left.count)
				.map((item) => ({
					value: item.value,
					label: formatLookupOptionLabel(item.value, item.label),
					meta: {
						address: item.address ?? null,
						usedCount: String(item.count ?? 0),
					},
				}));
		});

		return result;
	}, [fieldOptions, lookupDirection]);

	const fieldOptionSourceByField = useMemo(() => {
		const result: Partial<Record<CdsFieldKey, FieldOptionSourceStats>> = {};

		(
			Object.entries(fieldOptions) as Array<
				[CdsFieldKey, CdsDatabaseFieldOption[]]
			>
		).forEach(([fieldKey, rawFieldOptions]) => {
			if (shouldSkipDynamicFieldOptions(fieldKey)) {
				return;
			}

			const filteredFieldOptions = rawFieldOptions.filter(
				(item) =>
					(lookupDirection === "unknown" ||
						item.direction === "unknown" ||
						item.direction === lookupDirection) &&
					isAllowedDynamicFieldOptionValue(fieldKey, item.value),
			);

			result[fieldKey] = {
				hasManualAppFieldOptions:
					APP_FIELD_OPTION_FIELDS.has(fieldKey) &&
					filteredFieldOptions.some((item) => item.source === "app"),
				hasSavedAppFieldOptions: filteredFieldOptions.some(
					(item) => item.source === "app_saved",
				),
				hasLiveFieldOptions: filteredFieldOptions.some(
					(item) => item.source === "header" || item.source === "vnaccs",
				),
			};
		});

		return result;
	}, [fieldOptions, lookupDirection]);

	const operationCodeOptions = useMemo(
		() =>
			mergeOperationCodeSelectOptions(
				cdsLookups?.operationCodes,
				lookupDirection,
			),
		[cdsLookups?.operationCodes, lookupDirection],
	);

	const importLicenseOptions = useMemo(() => {
		const permitTypeOptions = (cdsLookups?.permitTypes ?? []).map((item) => ({
			value: item.code,
			label: formatLookupOptionLabel(item.code, item.name),
		}));

		const permitTypeFallbackOptions = [
			...(cdsLookups?.importLicenses ?? []),
			...(cdsLookups?.permits ?? []),
		]
			.map((item) => {
				const permitTypeCode = item.permitTypeCode?.trim();

				if (!permitTypeCode) {
					return null;
				}

				return {
					value: permitTypeCode,
					label: formatLookupOptionLabel(
						permitTypeCode,
						item.permitTypeName?.trim() || permitTypeCode,
					),
				};
			})
			.filter((item): item is SelectOption => item !== null);

		return dedupeSelectOptions([
			...permitTypeOptions,
			...permitTypeFallbackOptions,
		]);
	}, [
		cdsLookups?.importLicenses,
		cdsLookups?.permitTypes,
		cdsLookups?.permits,
	]);

	const legalDocumentOptions = useMemo(
		() =>
			dedupeSelectOptions(
				ECUS_LEGAL_DOCUMENT_OPTIONS.map((option) => ({
					value: option.value,
					label: option.label,
				})),
			),
		[],
	);

	const customsCodeOptions = useMemo(
		() =>
			dedupeSelectOptions(
				ECUS_CUSTOMS_CODE_OPTIONS.map((option) => ({
					value: option.value,
					label: option.label,
				})),
			),
		[],
	);

	const countryOptions = useMemo(
		() =>
			dedupeSelectOptions(
				ECUS_COUNTRY_OPTIONS.map((option) => ({
					value: option.value,
					label: `${option.value} - ${option.fullName || option.name}`,
				})),
			),
		[],
	);

	const locationOptions = useMemo(
		() =>
			dedupeSelectOptions(
				ECUS_LOCATION_OPTIONS.map((option) => ({
					value: option.value,
					label: option.label,
				})),
			),
		[],
	);

	const personOrgOptions = useMemo(
		() =>
			dedupeSelectOptions(
				ECUS_PERSON_ORG_OPTIONS.map((option) => ({
					value: option.value,
					label: option.label,
				})),
			),
		[],
	);

	const cargoClassificationOptions = useMemo(
		() =>
			dedupeSelectOptions(
				ECUS_CARGO_CLASSIFICATION_OPTIONS.map((option) => ({
					value: option.value,
					label: option.label,
				})),
			),
		[],
	);

	const transportMethodOptions = useMemo(
		() =>
			dedupeSelectOptions(
				ECUS_TRANSPORT_METHOD_OPTIONS.map((option) => ({
					value: option.value,
					label: option.label,
				})),
			),
		[],
	);

	const businessGroupOptions = useMemo(
		() =>
			dedupeSelectOptions(
				ECUS_BUSINESS_GROUP_OPTIONS.map((option) => ({
					value: option.value,
					label: option.label,
				})),
			),
		[],
	);

	const taxPayerOptions = useMemo(
		() =>
			dedupeSelectOptions(
				CDS_TAX_PAYER_OPTIONS.map((option) => ({
					value: option.value,
					label: option.label,
				})),
			),
		[],
	);

	const taxPaymentDeadlineOptions = useMemo(
		() =>
			dedupeSelectOptions(
				CDS_TAX_PAYMENT_DEADLINE_OPTIONS.map((option) => ({
					value: option.value,
					label: option.label,
				})),
			),
		[],
	);

	const releaseBeforePermitOptions = useMemo(
		() =>
			dedupeSelectOptions(
				CDS_RELEASE_BEFORE_PERMIT_OPTIONS.map((option) => ({
					value: option.value,
					label: option.label,
				})),
			),
		[],
	);

	const invoiceFormClassificationOptions = useMemo(
		() => toStandardSelectOptions("invoiceFormClassificationCode"),
		[],
	);

	const invoiceClassificationOptions = useMemo(
		() => toStandardSelectOptions("invoiceClassificationCode"),
		[],
	);

	const insuranceFeeClassificationOptions = useMemo(
		() => toStandardSelectOptions("insuranceFeeClassificationCode"),
		[],
	);

	const transportFeeClassificationOptions = useMemo(
		() => toStandardSelectOptions("transportFeeClassificationCode"),
		[],
	);

	const valuationDeclarationTypeOptions = useMemo(
		() => toStandardSelectOptions("valuationDeclarationTypeCode"),
		[],
	);

	const paymentMethodOptions = useMemo(
		() => toStaticSelectOptions("paymentMethod"),
		[],
	);

	const invoicePriceConditionOptions = useMemo(
		() => toStaticSelectOptions("invoicePriceCondition"),
		[],
	);

	const currencyOptions = useMemo(
		() => toStaticSelectOptions("invoiceCurrency"),
		[],
	);

	const packageTypeOptions = useMemo(
		() => toStaticSelectOptions("packageType"),
		[],
	);

	const weightUnitOptions = useMemo(
		() => dedupeSelectOptions(getCdsWeightUnitOptions()),
		[],
	);

	const processingDepartmentSelectOptions = useMemo(() => {
		const fallbackOptions = (
			cdsLookups?.fieldOptions?.declarationProcessingDeptCode ?? []
		)
			.filter(
				(item) =>
					lookupDirection === "unknown" ||
					item.direction === "unknown" ||
					item.direction === lookupDirection,
			)
			.sort((left, right) => right.count - left.count)
			.map((item) => ({
				value: item.value,
				label: formatLookupOptionLabel(item.value, item.label),
			}));

		const customsCode =
			typeof data.customsCode === "string" ? data.customsCode : null;
		const operationCode =
			typeof data.operationCode === "string" ? data.operationCode : null;

		if (
			!hasProcessingDepartmentDependencies ||
			!customsCode ||
			!operationCode
		) {
			return EMPTY_SELECT_OPTIONS;
		}

		const liveOptions = filterProcessingDepartments(
			cdsLookups?.processingDepartments ?? [],
			{
				customsCode,
				operationCode,
				direction: lookupDirection,
			},
		).map((item) => ({
			value: item.code,
			label: formatLookupOptionLabel(item.code, item.name),
		}));

		return liveOptions.length > 0
			? dedupeSelectOptions(liveOptions)
			: dedupeSelectOptions(fallbackOptions);
	}, [
		cdsLookups?.fieldOptions?.declarationProcessingDeptCode,
		cdsLookups?.processingDepartments,
		data.customsCode,
		data.operationCode,
		hasProcessingDepartmentDependencies,
		lookupDirection,
	]);

	const suggestedProcessingDepartment = useMemo(() => {
		const customsCode =
			typeof data.customsCode === "string" ? data.customsCode : null;
		const operationCode =
			typeof data.operationCode === "string" ? data.operationCode : null;

		if (
			!hasProcessingDepartmentDependencies ||
			!customsCode ||
			!operationCode
		) {
			return null;
		}

		return pickPreferredProcessingDepartment(
			cdsLookups?.processingDepartments ?? [],
			{
				customsCode,
				operationCode,
				direction: lookupDirection,
			},
		);
	}, [
		cdsLookups?.processingDepartments,
		data.customsCode,
		data.operationCode,
		hasProcessingDepartmentDependencies,
		lookupDirection,
	]);

	const lookupOptionsByField = useMemo<
		Partial<Record<keyof FollowUpCdsInfoRow, SelectOption[]>>
	>(() => {
		const getDynamicOptions = (fieldKey: CdsFieldKey) =>
			dynamicFieldOptionsByField[fieldKey] ?? EMPTY_SELECT_OPTIONS;

		return {
			businessTypeGroup: businessGroupOptions,
			cargoClassificationCode: preferReturnedOptions(
				getDynamicOptions("cargoClassificationCode"),
				cargoClassificationOptions,
			),
			correspondingDeclarationNumber: dedupeSelectOptions(
				getDynamicOptions("correspondingDeclarationNumber"),
			),
			customsCode: preferReturnedOptions(
				getDynamicOptions("customsCode"),
				customsCodeOptions,
			),
			declarationProcessingDeptCode: processingDepartmentSelectOptions,
			exportCountryCode: preferReturnedOptions(
				getDynamicOptions("exportCountryCode"),
				countryOptions,
			),
			guaranteeBankCode: buildGuaranteeBankLookupOptions(getDynamicOptions),
			importLicense: importLicenseOptions,
			inspectionResultCode: dedupeSelectOptions([
				...getDynamicOptions("inspectionResultCode"),
				...ECUS_INSPECTION_RESULT_OPTIONS,
			]),
			insuranceFeeClassificationCode: preferReturnedOptions(
				getDynamicOptions("insuranceFeeClassificationCode"),
				insuranceFeeClassificationOptions,
			),
			insuranceFeeCurrencyCode: preferReturnedOptions(
				getDynamicOptions("insuranceFeeCurrencyCode"),
				currencyOptions,
			),
			invoiceClassificationCode: preferReturnedOptions(
				getDynamicOptions("invoiceClassificationCode"),
				invoiceClassificationOptions,
			),
			invoiceCurrency: preferReturnedOptions(
				getDynamicOptions("invoiceCurrency"),
				currencyOptions,
			),
			invoiceFormClassificationCode: preferReturnedOptions(
				getDynamicOptions("invoiceFormClassificationCode"),
				invoiceFormClassificationOptions,
			),
			invoicePriceCondition: preferReturnedOptions(
				getDynamicOptions("invoicePriceCondition"),
				invoicePriceConditionOptions,
			),
			loadingLocationCode: preferReturnedOptions(
				getDynamicOptions("loadingLocationCode"),
				locationOptions,
			),
			otherLegalDocumentCode: legalDocumentOptions,
			operationCode: operationCodeOptions,
			packageType: preferReturnedOptions(
				getDynamicOptions("packageType"),
				packageTypeOptions,
			),
			paymentMethod: preferReturnedOptions(
				getDynamicOptions("paymentMethod"),
				paymentMethodOptions,
			),
			personOrganizationClassification: preferReturnedOptions(
				getDynamicOptions("personOrganizationClassification"),
				personOrgOptions,
			),
			releaseBeforePermitCode: dedupeSelectOptions([
				...releaseBeforePermitOptions,
				...getDynamicOptions("releaseBeforePermitCode"),
			]),
			taxableValueCurrencyCode: preferReturnedOptions(
				getDynamicOptions("taxableValueCurrencyCode"),
				currencyOptions,
			),
			taxDestinationLocation: preferReturnedOptions(
				getDynamicOptions("taxDestinationLocation"),
				locationOptions,
			),
			taxPayer: dedupeSelectOptions([
				...taxPayerOptions,
				...getDynamicOptions("taxPayer"),
			]),
			taxPaymentDeadlineCode: dedupeSelectOptions([
				...taxPaymentDeadlineOptions,
				...getDynamicOptions("taxPaymentDeadlineCode"),
			]),
			taxSubstituteBankCode: dedupeSelectOptions([
				...getDynamicOptions("taxSubstituteBankCode"),
				...getDynamicOptions("guaranteeBankCode"),
			]),
			transportFeeClassificationCode: preferReturnedOptions(
				getDynamicOptions("transportFeeClassificationCode"),
				transportFeeClassificationOptions,
			),
			transportFeeCurrencyCode: preferReturnedOptions(
				getDynamicOptions("transportFeeCurrencyCode"),
				currencyOptions,
			),
			transportMethodCode: preferReturnedOptions(
				getDynamicOptions("transportMethodCode"),
				transportMethodOptions,
			),
			transportVehicleCode: dedupeSelectOptions(
				getDynamicOptions("transportVehicleCode"),
			),
			truckLoadingLocationCode: preferReturnedOptions(
				getDynamicOptions("truckLoadingLocationCode"),
				getDynamicOptions("loadingLocationCode"),
			),
			unloadingLocationCode: preferReturnedOptions(
				getDynamicOptions("unloadingLocationCode"),
				locationOptions,
			),
			valuationDeclarationTypeCode: preferReturnedOptions(
				getDynamicOptions("valuationDeclarationTypeCode"),
				valuationDeclarationTypeOptions,
			),
			warehouseLocationCode: preferReturnedOptions(
				getDynamicOptions("warehouseLocationCode"),
				locationOptions,
			),
			customsWarehouseCode: preferReturnedOptions(
				getDynamicOptions("customsWarehouseCode"),
				locationOptions,
			),
			finalDestinationCode: preferReturnedOptions(
				getDynamicOptions("finalDestinationCode"),
				locationOptions,
			),
			weightUnit: preferReturnedOptions(
				getDynamicOptions("weightUnit"),
				weightUnitOptions,
			),
		};
	}, [
		businessGroupOptions,
		cargoClassificationOptions,
		countryOptions,
		currencyOptions,
		customsCodeOptions,
		dynamicFieldOptionsByField,
		insuranceFeeClassificationOptions,
		importLicenseOptions,
		invoiceClassificationOptions,
		invoiceFormClassificationOptions,
		invoicePriceConditionOptions,
		legalDocumentOptions,
		locationOptions,
		operationCodeOptions,
		packageTypeOptions,
		paymentMethodOptions,
		personOrgOptions,
		processingDepartmentSelectOptions,
		releaseBeforePermitOptions,
		taxPayerOptions,
		taxPaymentDeadlineOptions,
		transportFeeClassificationOptions,
		transportMethodOptions,
		valuationDeclarationTypeOptions,
		weightUnitOptions,
	]);

	const getLookupOptionsForField = useCallback(
		(fieldKey: keyof FollowUpCdsInfoRow): SelectOption[] =>
			lookupOptionsByField[fieldKey] ?? EMPTY_SELECT_OPTIONS,
		[lookupOptionsByField],
	);

	const getLookupSourceForField = useCallback(
		(fieldKey: keyof FollowUpCdsInfoRow): LookupSource => {
			const fieldSourceStats =
				fieldOptionSourceByField[fieldKey as CdsFieldKey] ??
				EMPTY_FIELD_OPTION_SOURCE_STATS;
			const {
				hasManualAppFieldOptions,
				hasSavedAppFieldOptions,
				hasLiveFieldOptions,
			} = fieldSourceStats;

			if (
				hasManualAppFieldOptions &&
				!hasSavedAppFieldOptions &&
				!hasLiveFieldOptions
			) {
				if (
					fieldKey === "declarationProcessingDeptCode" &&
					(cdsLookups?.processingDepartments?.length ?? 0) > 0
				) {
					return "live";
				}

				return "app";
			}

			if (
				hasSavedAppFieldOptions &&
				!hasManualAppFieldOptions &&
				!hasLiveFieldOptions
			) {
				return "app_saved";
			}

			switch (fieldKey) {
				case "operationCode":
					return getOperationCodeLookupSource(cdsLookups?.operationCodes);
				case "importLicense":
					return (cdsLookups?.importLicenses?.length ?? 0) > 0 ||
						(cdsLookups?.permitTypes?.length ?? 0) > 0 ||
						(cdsLookups?.permits?.length ?? 0) > 0
						? "live"
						: "none";
				case "otherLegalDocumentCode":
				case "businessTypeGroup":
					return "fallback";
				case "correspondingDeclarationNumber":
					return hasLiveFieldOptions
						? "live"
						: hasSavedAppFieldOptions
							? "app_saved"
							: "none";
				case "customsCode":
				case "exportCountryCode":
				case "taxDestinationLocation":
				case "loadingLocationCode":
				case "unloadingLocationCode":
				case "warehouseLocationCode":
				case "truckLoadingLocationCode":
				case "customsWarehouseCode":
				case "finalDestinationCode":
				case "personOrganizationClassification":
				case "cargoClassificationCode":
				case "transportMethodCode":
					return hasLiveFieldOptions
						? "live"
						: hasSavedAppFieldOptions
							? "app_saved"
							: hasManualAppFieldOptions
								? "app"
								: "fallback";
				case "declarationProcessingDeptCode":
					return (cdsLookups?.processingDepartments?.length ?? 0) > 0 ||
						hasLiveFieldOptions
						? "live"
						: hasSavedAppFieldOptions
							? "app_saved"
							: hasManualAppFieldOptions
								? "app"
								: "fallback";
				case "transportVehicleCode":
					return hasLiveFieldOptions
						? "live"
						: hasSavedAppFieldOptions
							? "app_saved"
							: hasManualAppFieldOptions
								? "app"
								: "none";
				case "weightUnit":
					return hasLiveFieldOptions
						? "live"
						: hasSavedAppFieldOptions
							? "app_saved"
							: hasManualAppFieldOptions
								? "app"
								: "fallback";
				case "paymentMethod":
				case "invoicePriceCondition":
				case "invoiceCurrency":
				case "taxableValueCurrencyCode":
				case "valuationDeclarationTypeCode":
				case "inspectionResultCode":
				case "invoiceFormClassificationCode":
				case "invoiceClassificationCode":
				case "transportFeeClassificationCode":
				case "transportFeeCurrencyCode":
				case "insuranceFeeClassificationCode":
				case "insuranceFeeCurrencyCode":
				case "packageType":
					return hasLiveFieldOptions
						? "live"
						: hasSavedAppFieldOptions
							? "app_saved"
							: hasManualAppFieldOptions
								? "app"
								: "fallback";
				case "taxSubstituteBankCode":
				case "guaranteeBankCode":
					return hasLiveFieldOptions
						? "live"
						: hasSavedAppFieldOptions
							? "app_saved"
							: hasManualAppFieldOptions
								? "app"
								: "none";
				case "taxPayer":
				case "releaseBeforePermitCode":
				case "taxPaymentDeadlineCode":
					return hasLiveFieldOptions
						? "live"
						: hasSavedAppFieldOptions
							? "app_saved"
							: hasManualAppFieldOptions
								? "app"
								: "fallback";
				default:
					return "none";
			}
		},
		[
			cdsLookups?.importLicenses?.length,
			cdsLookups?.operationCodes?.length,
			cdsLookups?.permitTypes?.length,
			cdsLookups?.permits?.length,
			cdsLookups?.processingDepartments?.length,
			fieldOptionSourceByField,
		],
	);

	const getLookupSourceDetail = useCallback(
		(fieldKey: keyof FollowUpCdsInfoRow, source: LookupSource) => {
			if (source === "none") {
				return "";
			}

			if (source === "app_saved") {
				switch (fieldKey) {
					case "declarationProcessingDeptCode":
						return "Lịch sử CDS đã lưu/gửi từ app web: mã bộ phận xử lý đã từng sử dụng.";
					case "taxDestinationLocation":
					case "loadingLocationCode":
					case "unloadingLocationCode":
					case "warehouseLocationCode":
					case "truckLoadingLocationCode":
					case "customsWarehouseCode":
					case "finalDestinationCode":
						return "Lịch sử CDS đã lưu/gửi từ app web: địa điểm đã từng khai trên các hồ sơ trước.";
					case "transportVehicleCode":
						return "Lịch sử CDS đã lưu/gửi từ app web: mã phương tiện đã từng khai.";
					default:
						return "Lịch sử CDS đã lưu/gửi từ app web.";
				}
			}

			if (source === "app") {
				switch (fieldKey) {
					case "declarationProcessingDeptCode":
						return "App-side field-options: mã bộ phận xử lý tờ khai từ dữ liệu nội bộ.";
					case "taxDestinationLocation":
					case "loadingLocationCode":
					case "unloadingLocationCode":
					case "warehouseLocationCode":
					case "truckLoadingLocationCode":
					case "customsWarehouseCode":
					case "finalDestinationCode":
						return "App-side field-options: địa điểm xử lý/kê khai từ dữ liệu nội bộ, fallback ECUS local khi trống.";
					case "personOrganizationClassification":
						return "App-side field-options: phân loại cá nhân/tổ chức từ dữ liệu nội bộ, fallback ECUS local khi trống.";
					case "cargoClassificationCode":
						return "App-side field-options: mã phân loại hàng hóa từ dữ liệu nội bộ, fallback ECUS local khi trống.";
					case "transportMethodCode":
						return "App-side field-options: phương thức vận chuyển từ dữ liệu nội bộ, fallback ECUS local khi trống.";
					case "transportVehicleCode":
						return "App-side field-options: phương tiện vận chuyển từ dữ liệu nội bộ.";
					case "packageType":
						return "App-side BAN_DON_VI_KIEN_HANG: hiển thị mã đơn vị, tên tiếng Anh và tên tiếng Việt từ database/exports/BAN_DON_VI_KIEN_HANG.json.";
					case "weightUnit":
						return "App-side field-options: danh mục đơn vị trọng lượng hợp lệ, mặc định KGM.";
					case "businessTypeGroup":
						return "App-side field-options: nhóm loại hình nghiệp vụ từ dữ liệu nội bộ.";
					default:
						return "App-side field-options từ dữ liệu nội bộ.";
				}
			}

			if (source === "live") {
				switch (fieldKey) {
					case "operationCode":
						return "HAN_2024 live: mã loại hình từ dữ liệu tờ khai gần nhất.";
					case "importLicense":
						return "HAN_2024 live + danh mục SLOAI_GP: mã loại giấy phép nhập khẩu đã phát sinh hoặc đang có trong app.";
					case "correspondingDeclarationNumber":
						return "HAN_2024 live: số tờ khai tương ứng lấy từ dữ liệu đã đăng ký.";
					case "customsCode":
						return "HAN_2024 live + fallback local: mã cơ quan hải quan đã phát sinh.";
					case "exportCountryCode":
						return "HAN_2024 live + fallback local: mã nước xuất khẩu/xuất xứ đã phát sinh.";
					case "declarationProcessingDeptCode":
						return "Danh mục bộ phận xử lý tờ khai từ SHAIQUAN_Sub, fallback lịch sử app/HAN khi cần.";
					case "personOrganizationClassification":
					case "cargoClassificationCode":
					case "transportMethodCode":
						return "HAN_2024 live từ DTOKHAIMD_VNACCS2, có thể ghép thêm lịch sử app nếu chưa có đủ.";
					case "loadingLocationCode":
					case "unloadingLocationCode":
					case "warehouseLocationCode":
					case "truckLoadingLocationCode":
					case "customsWarehouseCode":
					case "finalDestinationCode":
						return "HAN_2024 live từ danh mục ECUS/HAN đầy đủ, ưu tiên mã đã từng khai.";
					case "transportVehicleCode":
						return "HAN_2024 live từ dữ liệu tờ khai đã đăng ký, ghép với lịch sử app khi cần.";
					default:
						return "HAN_2024 live/fallback local cho danh mục lookup.";
				}
			}

			switch (fieldKey) {
				case "operationCode":
					return "Fallback local: danh mục loại hình nội bộ chuẩn hóa.";
				case "customsCode":
					return "Fallback local: danh mục mã hải quan nội bộ.";
				case "exportCountryCode":
					return "Fallback local: danh mục mã nước nội bộ.";
				case "personOrganizationClassification":
					return "Fallback local: phân loại cá nhân/tổ chức chuẩn hóa.";
				case "cargoClassificationCode":
					return "Fallback local: mã phân loại hàng hóa chuẩn hóa.";
				case "taxPayer":
					return "Fallback local: mã người nộp thuế chuẩn hóa.";
				case "releaseBeforePermitCode":
					return "Fallback local: mã lý do đề nghị giải phóng hàng trên cơ sở bảo lãnh.";
				case "taxPaymentDeadlineCode":
					return "Fallback local: mã xác định thời hạn nộp thuế chuẩn hóa theo ECUS.";
				case "transportMethodCode":
					return "Fallback local: phương thức vận chuyển chuẩn hóa.";
				case "inspectionResultCode":
					return "Fallback local: mã kết quả kiểm tra nội dung chuẩn hóa.";
				case "invoiceFormClassificationCode":
					return "Fallback local: phân loại hình thức hóa đơn theo bộ mã chuẩn VNACCS.";
				case "invoiceClassificationCode":
					return "Fallback local: phân loại giá hóa đơn theo bộ mã chuẩn VNACCS.";
				case "paymentMethod":
					return "Fallback local: phương thức thanh toán hardcode theo catalog ổn định.";
				case "invoicePriceCondition":
					return "Fallback local: điều kiện giá hóa đơn hardcode theo catalog ổn định.";
				case "invoiceCurrency":
				case "taxableValueCurrencyCode":
				case "transportFeeCurrencyCode":
				case "insuranceFeeCurrencyCode":
					return "Fallback local: danh mục mã tiền tệ hardcode theo catalog ổn định.";
				case "transportFeeClassificationCode":
					return "Fallback local: mã phân loại phí vận chuyển chuẩn hóa theo VNACCS.";
				case "insuranceFeeClassificationCode":
					return "Fallback local: mã phân loại phí bảo hiểm chuẩn hóa theo VNACCS.";
				case "valuationDeclarationTypeCode":
					return "Fallback local: mã phân loại khai trị giá chuẩn hóa theo VNACCS.";
				case "packageType":
					return "Fallback local: loại kiện theo catalog ổn định.";
				case "weightUnit":
					return "Fallback local: đơn vị trọng lượng hardcode theo catalog ổn định.";
				default:
					return "Fallback local: danh mục nội bộ chuẩn hóa.";
			}
		},
		[],
	);

	return {
		operationCodeOptions,
		importLicenseOptions,
		suggestedProcessingDepartment,
		getLookupOptionsForField,
		getLookupSourceForField,
		getLookupSourceDetail,
	};
}
