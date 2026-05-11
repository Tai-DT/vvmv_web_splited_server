import { normalizeCdsBusinessTypeGroup } from "@/lib/followup/cds-business-type-groups";
import { normalizeCdsWeightUnit } from "@/lib/followup/cds-weight-units";

export const CDS_LOOKUP_VALUE_FIELDS = new Set<string>([
	"businessTypeGroup",
	"cargoClassificationCode",
	"correspondingDeclarationNumber",
	"customsCode",
	"customsDeclarantCode",
	"customsWarehouseCode",
	"declarationProcessingDeptCode",
	"entrustedImporterCode",
	"exportCountryCode",
	"exporterCode",
	"finalDestinationCode",
	"guaranteeBankCode",
	"importLicense",
	"importerCode",
	"inspectionResultCode",
	"insuranceFeeClassificationCode",
	"insuranceFeeCurrencyCode",
	"invoiceClassificationCode",
	"invoiceCurrency",
	"invoiceFormClassificationCode",
	"invoicePriceCondition",
	"loadingLocationCode",
	"operationCode",
	"otherLegalDocumentCode",
	"packageType",
	"paymentMethod",
	"personOrganizationClassification",
	"releaseBeforePermitCode",
	"taxableValueCurrencyCode",
	"taxDestinationLocation",
	"taxPayer",
	"taxPaymentDeadlineCode",
	"taxSubstituteBankCode",
	"transportFeeClassificationCode",
	"transportFeeCurrencyCode",
	"transportMethodCode",
	"transportVehicleCode",
	"truckLoadingLocationCode",
	"unloadingLocationCode",
	"valuationDeclarationTypeCode",
	"warehouseLocationCode",
	"weightUnit",
]);

const CDS_INVOICE_PRICE_CONDITION_CODES = new Set([
	"DAP",
	"CIF",
	"EXW",
	"FOB",
	"FCA",
	"DDU",
	"CIP",
	"DDP",
	"CPT",
	"CFR",
	"C&F",
	"DAF",
	"DAT",
	"C&I",
	"FAS",
	"DEQ",
	"DES",
	"DPU",
]);

function normalizeText(value: unknown): string | null {
	if (value === null || value === undefined) {
		return null;
	}

	const text = String(value).trim();
	return text === "" ? null : text;
}

export function isCdsLookupValueField(fieldKey: string) {
	return CDS_LOOKUP_VALUE_FIELDS.has(fieldKey);
}

export function stripCdsLookupDisplayLabel(value: unknown): string | null {
	const text = normalizeText(value);
	if (!text) {
		return null;
	}

	const separatorIndex = text.indexOf(" - ");
	if (separatorIndex <= 0) {
		return text;
	}

	const code = text.slice(0, separatorIndex).trim();
	return code || text;
}

export function normalizeCdsLookupValueField(
	fieldKey: string,
	value: unknown,
): string | null {
	if (fieldKey === "businessTypeGroup") {
		return normalizeCdsBusinessTypeGroup(value);
	}

	if (fieldKey === "truckLoadingLocationCode") {
		return normalizeCdsTruckLoadingLocationCodes(value);
	}

	if (fieldKey === "weightUnit") {
		if (!normalizeText(value)) {
			return null;
		}

		return normalizeCdsWeightUnit(value);
	}

	if (!isCdsLookupValueField(fieldKey)) {
		return normalizeText(value);
	}

	if (fieldKey === "invoicePriceCondition") {
		const normalized = normalizeText(value);
		if (!normalized) {
			return null;
		}

		const stripped = stripCdsLookupDisplayLabel(normalized);
		if (!stripped) {
			return null;
		}

		const upperStripped = stripped.toUpperCase();
		if (CDS_INVOICE_PRICE_CONDITION_CODES.has(upperStripped)) {
			return upperStripped;
		}

		const upperSource = normalized.toUpperCase();
		const detectedCode = Array.from(CDS_INVOICE_PRICE_CONDITION_CODES).find(
			(code) =>
				upperSource === code ||
				upperSource.includes(`${code} `) ||
				upperSource.includes(` ${code}`) ||
				upperSource.includes(`(${code})`) ||
				upperSource.includes(`/${code}`),
		);

		return detectedCode ?? upperStripped;
	}

	return stripCdsLookupDisplayLabel(value);
}

export function normalizeCdsTruckLoadingLocationCodes(
	value: unknown,
): string | null {
	const text = normalizeText(value);
	if (!text) {
		return null;
	}

	const codes = text
		.split(/[.,/]+/)
		.flatMap((part) => {
			const trimmed = part.trim();
			if (!trimmed) {
				return [];
			}

			return trimmed.includes(" - ") ? [trimmed] : trimmed.split("-");
		})
		.map((part) => stripCdsLookupDisplayLabel(part)?.toUpperCase() ?? null)
		.filter((part): part is string => Boolean(part));

	return codes.length > 0 ? codes.join(".") : null;
}

export function normalizeCdsImportLicenseSlotValue(
	value: unknown,
): string | null {
	const text = normalizeText(value);
	if (!text) {
		return null;
	}

	const [rawCode, ...rest] = text.split(":");
	const code = stripCdsLookupDisplayLabel(rawCode);
	const number = rest.join(":").trim();

	if (!code && !number) {
		return null;
	}

	if (!number) {
		return code;
	}

	return code ? `${code}:${number}` : number;
}
