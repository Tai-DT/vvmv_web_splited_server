import {
	isCdsLookupValueField,
	normalizeCdsImportLicenseSlotValue,
	normalizeCdsLookupValueField,
	stripCdsLookupDisplayLabel,
} from "@/lib/followup/cds-code-values";
import {
	LEGACY_CDS_INFO_FIELD_ALIASES,
	PERSISTED_CDS_INFO_FIELDS,
} from "@/lib/followup/cds-info-contract";
import { normalizeLooseNumber } from "@/lib/followup/number-utils";

export type CdsPayload = Record<string, unknown>;

const NUMBER_FIELDS = new Set([
	"packageQuantity",
	"grossWeightTotal",
	"containerQuantity",
	"declaredValue",
	"totalInvoiceValue",
	"totalTaxableValue",
	"transportFee",
	"insuranceFee",
	"exchangeRate",
	"netWeight",
]);

const BOOLEAN_FIELDS = new Set([
	"seaportSupervisionEnabled",
	"airportSupervisionEnabled",
]);

const DATE_STRING_FIELDS = new Set([
	"expectedDeclarationDate",
	"reExportDeadline",
	"departureArrivalDate",
	"commercialInvoiceDate",
	"estimatedArrivalAtDestinationDate",
	"transportDepartureDate",
	"contractDate",
	"contractGoodsDate",
]);

const STRING_ARRAY_JSON_FIELDS = new Set([
	"otherLegalDocumentCodes",
	"importLicenses",
]);

const OBJECT_ARRAY_JSON_FIELDS = new Set([
	"billItems",
	"valuationAdjustments",
	"electronicAttachments",
	"transportSchedules",
]);

export const CDS_INFO_JSON_FIELD_NAMES = new Set([
	...STRING_ARRAY_JSON_FIELDS,
	...OBJECT_ARRAY_JSON_FIELDS,
]);

function normalizeString(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	const text = String(value).trim();
	return text === "" ? null : text;
}

function normalizeNumber(value: unknown): number | null {
	return normalizeLooseNumber(value);
}

function normalizeBoolean(value: unknown): boolean | null {
	if (value === null || value === undefined || value === "") return null;
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return value !== 0;

	const normalized = String(value).trim().toLowerCase();
	if (["true", "1", "yes", "on"].includes(normalized)) return true;
	if (["false", "0", "no", "off"].includes(normalized)) return false;
	return null;
}

function sanitizeBillItems(value: unknown) {
	if (!Array.isArray(value)) return null;

	const normalized = value
		.map((item) => {
			if (!item || typeof item !== "object" || Array.isArray(item)) {
				return null;
			}

			const row = item as Record<string, unknown>;
			return {
				billNumber: normalizeString(row.billNumber),
				billDate: normalizeLocalDate(row.billDate),
				hawbNumber: normalizeString(row.hawbNumber),
				mawbYear: normalizeString(row.mawbYear),
			};
		})
		.filter(
			(
				item,
			): item is {
				billNumber: string | null;
				billDate: string | null;
				hawbNumber: string | null;
				mawbYear: string | null;
			} =>
				!!item &&
				Object.values(item).some((field) => field !== null && field !== ""),
		);

	return normalized.length > 0 ? normalized : null;
}

function sanitizeStringArray(
	value: unknown,
	normalizeItem: (value: unknown) => string | null = normalizeString,
) {
	if (!Array.isArray(value)) return null;

	const normalized = value.map((item) => normalizeItem(item) ?? null);
	return normalized.some((item) => item !== null) ? normalized : null;
}

function sanitizeValuationAdjustments(value: unknown) {
	if (!Array.isArray(value)) return null;

	const normalized = value
		.map((item) => {
			if (!item || typeof item !== "object" || Array.isArray(item)) {
				return null;
			}

			const row = item as Record<string, unknown>;
			return {
				nameCode: stripCdsLookupDisplayLabel(row.nameCode),
				classificationCode: stripCdsLookupDisplayLabel(row.classificationCode),
				currencyCode: stripCdsLookupDisplayLabel(row.currencyCode),
				adjustmentValue: normalizeNumber(row.adjustmentValue),
				allocationRatio: normalizeNumber(row.allocationRatio),
			};
		})
		.filter(
			(
				item,
			): item is {
				nameCode: string | null;
				classificationCode: string | null;
				currencyCode: string | null;
				adjustmentValue: number | null;
				allocationRatio: number | null;
			} =>
				!!item &&
				Object.values(item).some((field) => field !== null && field !== ""),
		);

	return normalized.length > 0 ? normalized : null;
}

function sanitizeElectronicAttachments(value: unknown) {
	if (!Array.isArray(value)) return null;

	const normalized = value
		.map((item) => {
			if (!item || typeof item !== "object" || Array.isArray(item)) {
				return null;
			}

			const row = item as Record<string, unknown>;
			return {
				attachmentNumber: normalizeString(row.attachmentNumber),
				attachmentDescription: stripCdsLookupDisplayLabel(
					row.attachmentDescription,
				),
			};
		})
		.filter(
			(
				item,
			): item is {
				attachmentNumber: string | null;
				attachmentDescription: string | null;
			} =>
				!!item &&
				Object.values(item).some((field) => field !== null && field !== ""),
		);

	return normalized.length > 0 ? normalized : null;
}

function sanitizeTransportSchedules(value: unknown) {
	if (!Array.isArray(value)) return null;

	const normalized = value
		.map((item) => {
			if (!item || typeof item !== "object" || Array.isArray(item)) {
				return null;
			}

			const row = item as Record<string, unknown>;
			return {
				locationCode: stripCdsLookupDisplayLabel(row.locationCode),
				locationName: normalizeString(row.locationName),
				arrivalDate: normalizeLocalDate(row.arrivalDate),
				departureDate: normalizeLocalDate(row.departureDate),
			};
		})
		.filter(
			(
				item,
			): item is {
				locationCode: string | null;
				locationName: string | null;
				arrivalDate: string | null;
				departureDate: string | null;
			} =>
				!!item &&
				Object.values(item).some((field) => field !== null && field !== ""),
		);

	return normalized.length > 0 ? normalized : null;
}

export function normalizeLocalDate(value: unknown): string | null {
	const text = normalizeString(value);
	if (!text) return null;

	if (/^\d+(\.\d+)?$/.test(text)) {
		const serial = Math.floor(Number(text));
		if (serial >= 20000 && serial <= 80000) {
			const millis = (serial - 25569) * 86400 * 1000;
			return new Date(millis).toISOString().split("T")[0];
		}
	}

	if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

	const d = new Date(text);
	if (Number.isNaN(d.getTime())) return null;
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function sanitizeCdsInfoPayloadDetailed(payload: CdsPayload): {
	sanitized: CdsPayload;
	rejectedKeys: string[];
} {
	const output: CdsPayload = {};
	const rejectedKeys = new Set<string>();

	Object.entries(payload).forEach(([key, rawValue]) => {
		const targetKey = LEGACY_CDS_INFO_FIELD_ALIASES[key] ?? key;

		if (
			targetKey === "id" ||
			targetKey === "followUpId" ||
			targetKey === "createdAt" ||
			targetKey === "updatedAt"
		) {
			return;
		}

		if (!PERSISTED_CDS_INFO_FIELDS.has(targetKey)) {
			rejectedKeys.add(key);
			return;
		}

		if (
			targetKey === "declarationNumber" ||
			targetKey === "firstDeclarationNumber"
		) {
			output[targetKey] = null;
			return;
		}

		if (NUMBER_FIELDS.has(targetKey)) {
			output[targetKey] = normalizeNumber(rawValue);
			return;
		}

		if (BOOLEAN_FIELDS.has(targetKey)) {
			output[targetKey] = normalizeBoolean(rawValue);
			return;
		}

		if (DATE_STRING_FIELDS.has(targetKey)) {
			output[targetKey] = normalizeLocalDate(rawValue);
			return;
		}

		if (STRING_ARRAY_JSON_FIELDS.has(targetKey)) {
			output[targetKey] = sanitizeStringArray(
				rawValue,
				targetKey === "importLicenses"
					? normalizeCdsImportLicenseSlotValue
					: stripCdsLookupDisplayLabel,
			);
			return;
		}

		if (OBJECT_ARRAY_JSON_FIELDS.has(targetKey)) {
			if (targetKey === "billItems") {
				output[targetKey] = sanitizeBillItems(rawValue);
				return;
			}

			if (targetKey === "valuationAdjustments") {
				output[targetKey] = sanitizeValuationAdjustments(rawValue);
				return;
			}

			if (targetKey === "electronicAttachments") {
				output[targetKey] = sanitizeElectronicAttachments(rawValue);
				return;
			}

			if (targetKey === "transportSchedules") {
				output[targetKey] = sanitizeTransportSchedules(rawValue);
				return;
			}

			output[targetKey] = null;
			return;
		}

		output[targetKey] = isCdsLookupValueField(targetKey)
			? normalizeCdsLookupValueField(targetKey, rawValue)
			: normalizeString(rawValue);
	});

	const legalDocumentCodes = Array.isArray(output.otherLegalDocumentCodes)
		? (output.otherLegalDocumentCodes as Array<string | null>)
		: null;
	if (legalDocumentCodes) {
		output.otherLegalDocumentCode = legalDocumentCodes[0] ?? null;
	}

	const importLicenses = Array.isArray(output.importLicenses)
		? (output.importLicenses as Array<string | null>)
		: null;
	if (importLicenses) {
		const firstLicense = importLicenses[0] ?? null;
		if (typeof firstLicense === "string" && firstLicense.includes(":")) {
			const [codePart, ...rest] = firstLicense.split(":");
			output.importLicense = normalizeCdsLookupValueField(
				"importLicense",
				codePart,
			);
			output.licenseNumber = normalizeString(rest.join(":"));
		} else {
			output.importLicense = normalizeCdsLookupValueField(
				"importLicense",
				firstLicense,
			);
		}
	}

	return {
		sanitized: output,
		rejectedKeys: [...rejectedKeys].sort(),
	};
}

export function sanitizeCdsInfoPayload(payload: CdsPayload): CdsPayload {
	return sanitizeCdsInfoPayloadDetailed(payload).sanitized;
}
