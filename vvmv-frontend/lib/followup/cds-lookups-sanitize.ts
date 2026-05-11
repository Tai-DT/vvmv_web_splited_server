import {
	ECUS_CARGO_CLASSIFICATION_OPTIONS,
	ECUS_PERSON_ORG_OPTIONS,
	ECUS_TRANSPORT_METHOD_OPTIONS,
} from "@/app/(home)/internal/followup/_components/panels/cds/cds-options";
import { ECUS_COUNTRY_OPTIONS } from "@/app/(home)/internal/followup/_components/panels/ecus-country-options";
import { ECUS_CUSTOMS_CODE_OPTIONS } from "@/app/(home)/internal/followup/_components/panels/ecus-customs-options";
import { ECUS_LOCATION_OPTIONS } from "@/app/(home)/internal/followup/_components/panels/ecus-location-options";
import type { FollowUpCdsInfoRow } from "@/app/(home)/internal/followup/types";
import type {
	CdsDatabaseLookups,
	DatabaseFieldOptionLookup,
} from "@/lib/followup/cds-database-lookups";
import { getCdsStaticFieldOptions } from "@/lib/followup/cds-static-field-options";
import {
	CDS_RELEASE_BEFORE_PERMIT_OPTIONS,
	CDS_TAX_PAYER_OPTIONS,
	CDS_TAX_PAYMENT_DEADLINE_OPTIONS,
} from "@/lib/followup/cds-tax-options";
import { getVnaccsStandardFieldOptions } from "@/lib/followup/cds-vnaccs-standard-rules";
import { getCdsWeightUnitOptions } from "@/lib/followup/cds-weight-units";

type FieldOptionMap = Partial<
	Record<Extract<keyof FollowUpCdsInfoRow, string>, DatabaseFieldOptionLookup[]>
>;

const STRICT_SAVED_FIELD_KEYS = new Set<
	Extract<keyof FollowUpCdsInfoRow, string>
>([
	"cargoClassificationCode",
	"customsCode",
	"declarationProcessingDeptCode",
	"exportCountryCode",
	"guaranteeBankCode",
	"insuranceFeeClassificationCode",
	"insuranceFeeCurrencyCode",
	"inspectionResultCode",
	"invoiceClassificationCode",
	"invoiceCurrency",
	"invoiceFormClassificationCode",
	"invoicePriceCondition",
	"packageType",
	"paymentMethod",
	"personOrganizationClassification",
	"releaseBeforePermitCode",
	"loadingLocationCode",
	"unloadingLocationCode",
	"warehouseLocationCode",
	"customsWarehouseCode",
	"finalDestinationCode",
	"taxDestinationLocation",
	"taxableValueCurrencyCode",
	"taxPayer",
	"taxPaymentDeadlineCode",
	"taxSubstituteBankCode",
	"transportFeeClassificationCode",
	"transportFeeCurrencyCode",
	"transportMethodCode",
	"transportVehicleCode",
	"valuationDeclarationTypeCode",
	"weightUnit",
]);

function normalizeValue(value: string) {
	return value.trim().toUpperCase();
}

function addAllowedValues(target: Set<string>, values: Array<unknown>) {
	values.forEach((value) => {
		const normalized = normalizeValue(String(value ?? ""));
		if (!normalized) {
			return;
		}

		target.add(normalized);
	});
}

function buildAllowedValueSet(
	fieldKey: Extract<keyof FollowUpCdsInfoRow, string>,
	lookups: CdsDatabaseLookups,
) {
	const allowed = new Set<string>();

	if (fieldKey !== "weightUnit") {
		addAllowedValues(
			allowed,
			(lookups.fieldOptions[fieldKey] ?? []).map((item) => item.value),
		);
	}

	addAllowedValues(
		allowed,
		getVnaccsStandardFieldOptions(fieldKey).map((item) => item.value),
	);

	addAllowedValues(
		allowed,
		getCdsStaticFieldOptions(fieldKey).map((item) => item.value),
	);

	switch (fieldKey) {
		case "cargoClassificationCode":
			addAllowedValues(
				allowed,
				ECUS_CARGO_CLASSIFICATION_OPTIONS.map((item) => item.value),
			);
			break;
		case "customsCode":
			addAllowedValues(
				allowed,
				ECUS_CUSTOMS_CODE_OPTIONS.map((item) => item.value),
			);
			break;
		case "declarationProcessingDeptCode":
			addAllowedValues(
				allowed,
				lookups.processingDepartments.map((item) => item.code),
			);
			break;
		case "exportCountryCode":
			addAllowedValues(
				allowed,
				ECUS_COUNTRY_OPTIONS.map((item) => item.value),
			);
			break;
		case "loadingLocationCode":
		case "unloadingLocationCode":
		case "warehouseLocationCode":
		case "customsWarehouseCode":
		case "finalDestinationCode":
		case "taxDestinationLocation":
			addAllowedValues(
				allowed,
				ECUS_LOCATION_OPTIONS.map((item) => item.value),
			);
			break;
		case "personOrganizationClassification":
			addAllowedValues(
				allowed,
				ECUS_PERSON_ORG_OPTIONS.map((item) => item.value),
			);
			break;
		case "releaseBeforePermitCode":
			addAllowedValues(
				allowed,
				CDS_RELEASE_BEFORE_PERMIT_OPTIONS.map((item) => item.value),
			);
			break;
		case "taxPayer":
			addAllowedValues(
				allowed,
				CDS_TAX_PAYER_OPTIONS.map((item) => item.value),
			);
			break;
		case "taxPaymentDeadlineCode":
			addAllowedValues(
				allowed,
				CDS_TAX_PAYMENT_DEADLINE_OPTIONS.map((item) => item.value),
			);
			break;
		case "transportMethodCode":
			addAllowedValues(
				allowed,
				ECUS_TRANSPORT_METHOD_OPTIONS.map((item) => item.value),
			);
			break;
		case "weightUnit":
			addAllowedValues(
				allowed,
				getCdsWeightUnitOptions().map((item) => item.value),
			);
			break;
		default:
			break;
	}

	return allowed;
}

export function filterSavedFieldOptionsAgainstLookups(
	savedFieldOptions: FieldOptionMap,
	lookups: CdsDatabaseLookups,
) {
	const filtered: FieldOptionMap = {};

	(
		Object.entries(savedFieldOptions) as Array<
			[
				Extract<keyof FollowUpCdsInfoRow, string>,
				DatabaseFieldOptionLookup[] | undefined,
			]
		>
	).forEach(([fieldKey, options]) => {
		if (!options || options.length === 0) {
			return;
		}

		if (!STRICT_SAVED_FIELD_KEYS.has(fieldKey)) {
			filtered[fieldKey] = options;
			return;
		}

		const allowedValues = buildAllowedValueSet(fieldKey, lookups);

		if (allowedValues.size === 0) {
			filtered[fieldKey] = options;
			return;
		}

		const nextOptions = options.filter((option) =>
			allowedValues.has(normalizeValue(option.value)),
		);

		if (nextOptions.length > 0) {
			filtered[fieldKey] = nextOptions;
		}
	});

	return filtered;
}
