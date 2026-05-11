import type { FollowUpCdsInfoRow } from "@/app/(home)/internal/followup/types";
import { normalizeCdsLookupValueField } from "@/lib/followup/cds-code-values";
import type {
	CdsDatabaseFieldOptionKey,
	DatabaseFieldOptionLookup,
	DeclarationDirection,
} from "@/lib/followup/cds-database-lookups";
import { deriveOperationType } from "@/lib/followup/operation-type";

export type SavedCdsLookupSnapshot = {
	operationType?: unknown;
	operationCode?: unknown;
	cdsInfo?: Partial<FollowUpCdsInfoRow> | null;
};

export const SAVED_LOOKUP_FIELD_KEYS = [
	"cargoClassificationCode",
	"customsCode",
	"customsWarehouseCode",
	"declarationProcessingDeptCode",
	"exportCountryCode",
	"finalDestinationCode",
	"guaranteeBankCode",
	"insuranceFeeClassificationCode",
	"insuranceFeeCurrencyCode",
	"inspectionResultCode",
	"invoiceClassificationCode",
	"invoiceCurrency",
	"invoiceFormClassificationCode",
	"invoicePriceCondition",
	"loadingLocationCode",
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
	"unloadingLocationCode",
	"valuationDeclarationTypeCode",
	"warehouseLocationCode",
	"weightUnit",
] as const satisfies CdsDatabaseFieldOptionKey[];

const PRESERVE_CASE_FIELD_KEYS = new Set<CdsDatabaseFieldOptionKey>([]);

const FIELD_LABEL_COMPANIONS: Partial<
	Record<CdsDatabaseFieldOptionKey, keyof FollowUpCdsInfoRow>
> = {
	customsWarehouseCode: "warehouseLocationName",
	loadingLocationCode: "loadingLocationName",
	transportVehicleCode: "transportVehicleName",
	unloadingLocationCode: "unloadingLocationName",
	warehouseLocationCode: "warehouseLocationName",
};

const FIELD_VALUE_FALLBACKS: Partial<
	Record<CdsDatabaseFieldOptionKey, keyof FollowUpCdsInfoRow>
> = {
	customsWarehouseCode: "warehouseLocationCode",
	finalDestinationCode: "taxDestinationLocation",
};

function cleanText(value: unknown): string | null {
	const normalized = String(value ?? "").trim();
	return normalized === "" ? null : normalized;
}

function cleanCode(value: unknown): string | null {
	return cleanText(value)?.toUpperCase() ?? null;
}

function normalizeFieldValue(
	fieldKey: CdsDatabaseFieldOptionKey,
	cdsInfo: Partial<FollowUpCdsInfoRow>,
): string | null {
	const fallbackField = FIELD_VALUE_FALLBACKS[fieldKey];
	const rawValue =
		cdsInfo[fieldKey] ?? (fallbackField ? cdsInfo[fallbackField] : null);
	const lookupValue = normalizeCdsLookupValueField(fieldKey, rawValue);

	if (PRESERVE_CASE_FIELD_KEYS.has(fieldKey)) {
		return cleanText(lookupValue);
	}

	return cleanCode(lookupValue);
}

function buildFieldLabel(
	fieldKey: CdsDatabaseFieldOptionKey,
	value: string,
	cdsInfo: Partial<FollowUpCdsInfoRow>,
) {
	const companionField = FIELD_LABEL_COMPANIONS[fieldKey];
	const companionLabel = companionField
		? cleanText(cdsInfo[companionField])
		: null;

	if (!companionLabel || companionLabel.toUpperCase() === value.toUpperCase()) {
		return value;
	}

	return `${value} - ${companionLabel}`;
}

function toDirection(snapshot: SavedCdsLookupSnapshot): DeclarationDirection {
	const operationType = deriveOperationType({
		operationType: snapshot.operationType,
		operationCode: snapshot.operationCode ?? snapshot.cdsInfo?.operationCode,
	});

	if (operationType === "NHAP") {
		return "import";
	}

	if (operationType === "XUAT") {
		return "export";
	}

	return "unknown";
}

export function buildSavedCdsFieldOptions(
	snapshots: SavedCdsLookupSnapshot[],
): Partial<Record<CdsDatabaseFieldOptionKey, DatabaseFieldOptionLookup[]>> {
	const counts = new Map<string, DatabaseFieldOptionLookup>();

	snapshots.forEach((snapshot) => {
		const cdsInfo = snapshot.cdsInfo;
		if (!cdsInfo || typeof cdsInfo !== "object") {
			return;
		}

		const direction = toDirection(snapshot);

		SAVED_LOOKUP_FIELD_KEYS.forEach((fieldKey) => {
			const value = normalizeFieldValue(fieldKey, cdsInfo);
			if (!value) {
				return;
			}

			const key = `${fieldKey}::${direction}::${value}`;
			const existing = counts.get(key);
			const label = buildFieldLabel(fieldKey, value, cdsInfo);

			if (existing) {
				existing.count += 1;
				if (!existing.label && label) {
					existing.label = label;
				}
				return;
			}

			counts.set(key, {
				field: fieldKey,
				value,
				label,
				count: 1,
				direction,
				source: "app_saved",
			});
		});
	});

	const result: Partial<
		Record<CdsDatabaseFieldOptionKey, DatabaseFieldOptionLookup[]>
	> = {};

	counts.forEach((option) => {
		const current = result[option.field] ?? [];
		current.push(option);
		result[option.field] = current.sort((left, right) => {
			if (right.count !== left.count) {
				return right.count - left.count;
			}

			if (left.direction !== right.direction) {
				return left.direction.localeCompare(right.direction, "en");
			}

			return left.value.localeCompare(right.value, "en", { numeric: true });
		});
	});

	return result;
}
