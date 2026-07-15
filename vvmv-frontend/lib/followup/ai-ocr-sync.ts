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
import { DEFAULT_CDS_WEIGHT_UNIT } from "@/lib/followup/cds-weight-units";
import {
	normalizeLooseNumber,
	normalizeWeightNumber,
} from "@/lib/followup/number-utils";

type AIOcrRecord = Record<string, unknown>;
type AIOcrCargoItem = Record<string, unknown>;
type SanitizedCdsInfoPayload = Record<string, unknown>;
type SanitizedCargoItem = {
	customCode: string | null;
	hsCode: string | null;
	originalCountry: string | null;
	originalCargoName: string | null;
	dutyReductionCode: string | null;
	imExDutyExemptionCode: string | null;
	qty: number | null;
	unit: string | null;
	unitPrice: number | null;
	totalPrice: number | null;
	qty2: number | null;
	unit2: string | null;
	vietnameseName: string | null;
	importTaxCode: string | null;
	importTaxRate: number | null;
	importTaxAmount: number | null;
	vatTaxCode: string | null;
	vatTaxRate: number | null;
	vatTaxAmount: number | null;
	imExDutyExemptionCondition: string | null;
	imExDutyExemptionAmount: number | null;
	lineTaxableValue: number | null;
	exportTaxRatePercent: number | null;
	exportTaxAmount: number | null;
	taxableUnitPrice: number | null;
	importer: string | null;
	packageQty: number | null;
	packageType: string | null;
	grossWeight: number | null;
	invoiceNo: string | null;
	invoiceDate: Date | null;
	term: string | null;
};

const CDS_INFO_NUMBER_FIELDS = new Set([
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

const CDS_INFO_DATE_FIELDS = new Set([
	"expectedDeclarationDate",
	"reExportDeadline",
	"departureArrivalDate",
	"commercialInvoiceDate",
	"estimatedArrivalAtDestinationDate",
	"transportDepartureDate",
	"contractDate",
	"contractGoodsDate",
]);

const CDS_INFO_JSON_FIELDS = new Set([
	"billItems",
	"otherLegalDocumentCodes",
	"importLicenses",
	"valuationAdjustments",
	"electronicAttachments",
	"transportSchedules",
]);

const CDS_INFO_BOOLEAN_FIELDS = new Set([
	"seaportSupervisionEnabled",
	"airportSupervisionEnabled",
]);

const CDS_INFO_META_FIELDS = new Set([
	"id",
	"followUpId",
	"createdAt",
	"updatedAt",
]);

const CDS_LOCATION_CODE_NAME_FIELDS: Array<{
	codeField: string;
	nameField: string;
}> = [
	{ codeField: "warehouseLocationCode", nameField: "warehouseLocationName" },
	{ codeField: "loadingLocationCode", nameField: "loadingLocationName" },
	{ codeField: "unloadingLocationCode", nameField: "unloadingLocationName" },
	{
		codeField: "truckLoadingLocationCode",
		nameField: "truckLoadingLocationName",
	},
];

const IMPORT_TYPES_WITHOUT_INFERRED_TRANSPORT_DEPARTURE_DATE = new Set([
	"A11",
	"A12",
]);

const CARGO_NUMBER_FIELDS = new Set([
	"qty",
	"unitPrice",
	"totalPrice",
	"qty2",
	"lineTaxableValue",
	"exportTaxRatePercent",
	"exportTaxAmount",
	"taxableUnitPrice",
	"packageQty",
	"grossWeight",
	"importTaxRate",
	"importTaxAmount",
	"vatTaxRate",
	"vatTaxAmount",
	"imExDutyExemptionAmount",
]);

const CARGO_DATE_FIELDS = new Set(["invoiceDate"]);

const CARGO_META_FIELDS = new Set([
	"id",
	"followUpId",
	"createdAt",
	"updatedAt",
	"hsCodeSuggestions",
	"conflicts",
	"index",
]);

function normalizeString(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	const text = String(value).trim();
	return text === "" ? null : text;
}

function splitLookupDisplayValue(value: unknown) {
	const text = normalizeString(value);
	if (!text) {
		return { code: null, label: null };
	}

	const separatorIndex = text.indexOf(" - ");
	if (separatorIndex <= 0) {
		return { code: null, label: text };
	}

	const code = text.slice(0, separatorIndex).trim();
	const label = text.slice(separatorIndex + 3).trim();
	return {
		code: code || null,
		label: label || null,
	};
}

function normalizeLookupDisplayName(value: unknown, code: unknown) {
	const text = normalizeString(value);
	if (!text) {
		return null;
	}

	const normalizedCode = normalizeString(code);
	if (normalizedCode) {
		const prefix = `${normalizedCode} - `;
		if (text.toUpperCase().startsWith(prefix.toUpperCase())) {
			return normalizeString(text.slice(prefix.length));
		}
	}

	return splitLookupDisplayValue(text).label;
}

function normalizeTransportVehicleValue(value: unknown) {
	const text = normalizeString(value);
	if (!text) {
		return null;
	}

	const withoutDates = text
		.replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
		.replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, " ")
		.replace(/\b(?:ETA|ETD|SHIP\s*DATE|DEPARTURE|ARRIVAL)\b.*$/i, " ")
		.trim();
	const cleaned = withoutDates
		.replace(/\s+(?:FROM|TO|POL|POD|AT)\s+.*$/i, "")
		.replace(/\s{2,}/g, " ")
		.trim();
	const normalized = cleaned || text;

	if (/^(BY\s+)?(AIR|SEA|OCEAN|TRUCK|ROAD|RAIL|COURIER)$/i.test(normalized)) {
		return null;
	}

	return stripCdsLookupDisplayLabel(normalized);
}

function isLikelyTransportVehicleCode(value: unknown) {
	const text = normalizeString(value);
	return Boolean(
		text && /^[A-Z0-9][A-Z0-9\-/_.]{1,19}$/i.test(text) && /\d/.test(text),
	);
}

function postProcessSanitizedCdsInfoPayload(output: SanitizedCdsInfoPayload) {
	for (const { codeField, nameField } of CDS_LOCATION_CODE_NAME_FIELDS) {
		const nameParts = splitLookupDisplayValue(output[nameField]);
		if (!output[codeField] && nameParts.code) {
			output[codeField] = normalizeCdsLookupValueField(
				codeField,
				nameParts.code,
			);
		}
		if (output[nameField]) {
			output[nameField] = normalizeLookupDisplayName(
				output[nameField],
				output[codeField],
			);
		}
	}

	const transportVehicleCode = normalizeTransportVehicleValue(
		output.transportVehicleCode,
	);
	if (transportVehicleCode) {
		if (isLikelyTransportVehicleCode(transportVehicleCode)) {
			output.transportVehicleCode = transportVehicleCode;
		} else {
			if (!normalizeString(output.transportVehicleName)) {
				output.transportVehicleName = transportVehicleCode;
			}
			delete output.transportVehicleCode;
		}
	} else {
		delete output.transportVehicleCode;
	}

	const operationCode = normalizeString(output.operationCode)?.toUpperCase();
	if (
		operationCode &&
		IMPORT_TYPES_WITHOUT_INFERRED_TRANSPORT_DEPARTURE_DATE.has(operationCode)
	) {
		delete output.transportDepartureDate;
	}

	return output;
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

function normalizeGrossWeight(value: unknown): number | null {
	return normalizeWeightNumber(value);
}

function normalizeIsoDate(value: unknown): string | null {
	if (value === null || value === undefined || value === "") return null;

	// Convert Excel serial dates (e.g. 46058) into ISO date string.
	if (typeof value === "number" && Number.isFinite(value)) {
		const serial = Math.floor(value);
		if (serial >= 20000 && serial <= 80000) {
			const millis = (serial - 25569) * 86400 * 1000;
			return new Date(millis).toISOString().split("T")[0];
		}
	}

	if (value instanceof Date) {
		return Number.isNaN(value.getTime())
			? null
			: value.toISOString().split("T")[0];
	}

	const text = String(value).trim();
	if (text === "") return null;

	if (/^\d+(\.\d+)?$/.test(text)) {
		const serial = Math.floor(Number(text));
		if (serial >= 20000 && serial <= 80000) {
			const millis = (serial - 25569) * 86400 * 1000;
			return new Date(millis).toISOString().split("T")[0];
		}
	}

	if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
		return text;
	}

	const ddmmyyyyMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (ddmmyyyyMatch) {
		const [, day, month, year] = ddmmyyyyMatch;
		return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
	}

	const parsedDate = new Date(text);
	if (Number.isNaN(parsedDate.getTime())) {
		return null;
	}

	return parsedDate.toISOString().split("T")[0];
}

function normalizeDate(value: unknown): Date | null {
	const iso = normalizeIsoDate(value);
	return iso ? new Date(`${iso}T00:00:00.000Z`) : null;
}

function sanitizeCdsStringArray(
	value: unknown,
	normalizeItem: (value: unknown) => string | null = normalizeString,
) {
	if (!Array.isArray(value)) {
		return null;
	}

	const normalized = value.map((item) => normalizeItem(item) ?? null);
	return normalized.some((item) => item !== null) ? normalized : null;
}

function sanitizeCdsBillItems(value: unknown) {
	if (!Array.isArray(value)) {
		return null;
	}

	const normalized = value
		.map((item) => {
			if (!item || typeof item !== "object" || Array.isArray(item)) {
				return null;
			}

			const row = item as Record<string, unknown>;
			return {
				billNumber: normalizeString(row.billNumber),
				billDate: normalizeIsoDate(row.billDate),
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

function sanitizeCdsValuationAdjustments(value: unknown) {
	if (!Array.isArray(value)) {
		return null;
	}

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

function sanitizeCdsElectronicAttachments(value: unknown) {
	if (!Array.isArray(value)) {
		return null;
	}

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

function sanitizeCdsTransportSchedules(value: unknown) {
	if (!Array.isArray(value)) {
		return null;
	}

	const normalized = value
		.map((item) => {
			if (!item || typeof item !== "object" || Array.isArray(item)) {
				return null;
			}

			const row = item as Record<string, unknown>;
			return {
				locationCode: stripCdsLookupDisplayLabel(row.locationCode),
				locationName: normalizeString(row.locationName),
				arrivalDate: normalizeIsoDate(row.arrivalDate),
				departureDate: normalizeIsoDate(row.departureDate),
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

function getCargoItems(value: unknown): AIOcrCargoItem[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter(
		(item): item is AIOcrCargoItem =>
			typeof item === "object" && item !== null && !Array.isArray(item),
	);
}

function firstString(values: unknown[]): string | null {
	for (const value of values) {
		const normalized = normalizeString(value);
		if (normalized) {
			return normalized;
		}
	}

	return null;
}

function firstStringFromItems(
	items: AIOcrCargoItem[],
	key: string,
): string | null {
	return firstString(items.map((item) => item[key]));
}

function firstDateFromItems(
	items: AIOcrCargoItem[],
	key: string,
): string | null {
	for (const item of items) {
		const normalized = normalizeIsoDate(item[key]);
		if (normalized) {
			return normalized;
		}
	}

	return null;
}

function sumNumbers(items: AIOcrCargoItem[], key: string): number | null {
	let total = 0;
	let hasValue = false;

	for (const item of items) {
		const normalized = normalizeNumber(item[key]);
		if (normalized === null) continue;
		total += normalized;
		hasValue = true;
	}

	return hasValue ? total : null;
}

function numbersClose(a: number, b: number, tolerance = 0.05): boolean {
	return Math.abs(a - b) <= tolerance;
}

function hasConsistentCargoValuation(items: AIOcrCargoItem[]): boolean {
	if (items.length === 0) {
		return false;
	}

	return items.every((item) => {
		const qty = normalizeNumber(item.qty);
		const unitPrice = normalizeNumber(item.unitPrice);
		const totalPrice = normalizeNumber(item.totalPrice);

		if (qty === null || unitPrice === null || totalPrice === null) {
			return false;
		}

		return numbersClose(qty * unitPrice, totalPrice);
	});
}

export function sanitizeFollowUpCdsInfoPayload(
	payload: AIOcrRecord | null | undefined,
	options?: {
		allowTransportDepartureDate?: boolean;
	},
): SanitizedCdsInfoPayload {
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		return {};
	}

	const output: SanitizedCdsInfoPayload = {};

	Object.entries(payload).forEach(([key, rawValue]) => {
		const targetKey = LEGACY_CDS_INFO_FIELD_ALIASES[key] ?? key;

		if (CDS_INFO_META_FIELDS.has(targetKey)) {
			return;
		}

		if (
			targetKey === "transportDepartureDate" &&
			options?.allowTransportDepartureDate !== true
		) {
			return;
		}

		if (!PERSISTED_CDS_INFO_FIELDS.has(targetKey)) {
			return;
		}

		if (CDS_INFO_JSON_FIELDS.has(targetKey)) {
			if (targetKey === "billItems") {
				const normalized = sanitizeCdsBillItems(rawValue);
				if (normalized !== null) {
					output[targetKey] = normalized;
				}
				return;
			}

			if (
				targetKey === "otherLegalDocumentCodes" ||
				targetKey === "importLicenses"
			) {
				const normalized = sanitizeCdsStringArray(
					rawValue,
					targetKey === "importLicenses"
						? normalizeCdsImportLicenseSlotValue
						: stripCdsLookupDisplayLabel,
				);
				if (normalized !== null) {
					output[targetKey] = normalized;
				}
				return;
			}

			if (targetKey === "valuationAdjustments") {
				const normalized = sanitizeCdsValuationAdjustments(rawValue);
				if (normalized !== null) {
					output[targetKey] = normalized;
				}
				return;
			}

			if (targetKey === "electronicAttachments") {
				const normalized = sanitizeCdsElectronicAttachments(rawValue);
				if (normalized !== null) {
					output[targetKey] = normalized;
				}
				return;
			}

			if (targetKey === "transportSchedules") {
				const normalized = sanitizeCdsTransportSchedules(rawValue);
				if (normalized !== null) {
					output[targetKey] = normalized;
				}
				return;
			}
		}

		if (CDS_INFO_NUMBER_FIELDS.has(targetKey)) {
			const normalized =
				targetKey === "grossWeightTotal"
					? normalizeGrossWeight(rawValue)
					: normalizeNumber(rawValue);
			if (normalized !== null) {
				output[targetKey] = normalized;
			}
			return;
		}

		if (CDS_INFO_BOOLEAN_FIELDS.has(targetKey)) {
			const normalized = normalizeBoolean(rawValue);
			if (normalized !== null) {
				output[targetKey] = normalized;
			}
			return;
		}

		if (CDS_INFO_DATE_FIELDS.has(targetKey)) {
			const normalized = normalizeIsoDate(rawValue);
			if (normalized !== null) {
				output[targetKey] = normalized;
			}
			return;
		}

		const normalized = isCdsLookupValueField(targetKey)
			? normalizeCdsLookupValueField(targetKey, rawValue)
			: normalizeString(rawValue);
		if (normalized !== null) {
			output[targetKey] = normalized;
		}
	});

	if (Array.isArray(output.otherLegalDocumentCodes)) {
		output.otherLegalDocumentCode =
			(output.otherLegalDocumentCodes as Array<string | null>)[0] ?? null;
	}

	if (Array.isArray(output.importLicenses)) {
		const firstLicense =
			(output.importLicenses as Array<string | null>)[0] ?? null;
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

	return postProcessSanitizedCdsInfoPayload(output);
}

export function buildSyncedFollowUpCdsInfoPayload(
	payload: AIOcrRecord | null | undefined,
): SanitizedCdsInfoPayload {
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		return {};
	}

	const cargoItems = getCargoItems(payload.cargoList);
	const sumInvoiceValue = sumNumbers(cargoItems, "totalPrice");
	const sumPackageQty = sumNumbers(cargoItems, "packageQty");
	const packageTypes = cargoItems
		.map((item) => normalizeString(item.packageType))
		.filter((value): value is string => !!value);
	const cargoDescriptions = cargoItems
		.map(
			(item) =>
				normalizeString(item.originalCargoName) ||
				normalizeString(item.vietnameseName),
		)
		.filter((value): value is string => !!value)
		.join(" ")
		.toUpperCase();
	const cargoItemsWithTotalPrice = cargoItems.filter(
		(item) => normalizeNumber(item.totalPrice) !== null,
	).length;
	const derivedPayload = sanitizeFollowUpCdsInfoPayload(
		{
			importExportUnitName: payload.companyName,
			partnerName: firstString([
				payload.supplier,
				payload.companyName,
				firstStringFromItems(cargoItems, "importer"),
			]),
			billOfLading: payload.billOrBooking,
			packageQuantity: sumPackageQty ?? payload.quantity,
			packageType: firstStringFromItems(cargoItems, "packageType"),
			grossWeightTotal:
				normalizeGrossWeight(payload.grossWeight) ??
				sumNumbers(cargoItems, "grossWeight"),
			weightUnit: DEFAULT_CDS_WEIGHT_UNIT,
			warehouseLocationName: payload.warehouse,
			unloadingLocationName: payload.pickupLocation,
			loadingLocationName: payload.loadingLocation,
			transportMethodCode: payload.transportMethod,
			departureArrivalDate: payload.etaEtd,
			commercialInvoice: firstString([
				payload.invoice,
				firstStringFromItems(cargoItems, "invoiceNo"),
			]),
			commercialInvoiceDate: firstDateFromItems(cargoItems, "invoiceDate"),
			invoicePriceCondition: firstStringFromItems(cargoItems, "term"),
			declaredValue: sumInvoiceValue,
			totalInvoiceValue: sumInvoiceValue,
			totalTaxableValue: sumInvoiceValue,
			estimatedArrivalAtDestinationDate: firstString([
				payload.deliveryDate,
				payload.etaEtd,
			]),
			note: firstString([payload.notes, payload.note]),
			contractNumber: payload.poNumber,
			truckLoadingLocationName: payload.loadingLocation,
		},
		{ allowTransportDepartureDate: false },
	);

	const explicitPayload = sanitizeFollowUpCdsInfoPayload(
		typeof payload.cdsInfo === "object" && payload.cdsInfo !== null
			? (payload.cdsInfo as AIOcrRecord)
			: null,
		{ allowTransportDepartureDate: true },
	);

	const mergedPayload = {
		...derivedPayload,
		...explicitPayload,
	};

	if (
		sumInvoiceValue !== null &&
		cargoItems.length > 1 &&
		cargoItemsWithTotalPrice === cargoItems.length
	) {
		const consistentCargoValuation = hasConsistentCargoValuation(cargoItems);
		const explicitTotal = normalizeNumber(explicitPayload.totalInvoiceValue);
		const explicitDeclared = normalizeNumber(explicitPayload.declaredValue);
		const explicitTaxable = normalizeNumber(explicitPayload.totalTaxableValue);
		const explicitValuation =
			explicitTotal ?? explicitDeclared ?? explicitTaxable;

		if (
			consistentCargoValuation &&
			explicitTotal !== null &&
			!numbersClose(explicitTotal, sumInvoiceValue) &&
			explicitDeclared === null &&
			explicitTaxable === null
		) {
			mergedPayload.declaredValue = sumInvoiceValue;
			mergedPayload.totalInvoiceValue = sumInvoiceValue;
			mergedPayload.totalTaxableValue = sumInvoiceValue;
		} else if (explicitValuation !== null) {
			if (explicitDeclared === null) {
				mergedPayload.declaredValue = explicitValuation;
			}
			if (explicitTotal === null) {
				mergedPayload.totalInvoiceValue = explicitValuation;
			}
			if (explicitTaxable === null) {
				mergedPayload.totalTaxableValue = explicitValuation;
			}
		} else {
			mergedPayload.declaredValue = sumInvoiceValue;
			mergedPayload.totalInvoiceValue = sumInvoiceValue;
			mergedPayload.totalTaxableValue = sumInvoiceValue;
		}
	}

	const usesSingleCaseForMachinery =
		(sumPackageQty === 1 ||
			normalizeNumber(mergedPayload.packageQuantity) === 1) &&
		((packageTypes.length > 0 &&
			packageTypes.every((value) => value === "CS")) ||
			normalizeString(mergedPayload.packageType) === "CS") &&
		/(WOODEN|FILTER BOX|MACHINE|MACHINERY|EQUIPMENT|MODEL)/.test(
			cargoDescriptions,
		);

	if (usesSingleCaseForMachinery) {
		mergedPayload.packageType = "ZZ";
	}

	return postProcessSanitizedCdsInfoPayload(mergedPayload);
}

function isCargoItemEmpty(item: SanitizedCargoItem): boolean {
	return Object.values(item).every((value) => {
		if (value === null || value === undefined) return true;
		if (value instanceof Date) return false;
		if (typeof value === "number") return value === 0;
		return value === "";
	});
}

function isUnsetCargoAliasValue(value: unknown): boolean {
	if (value === null || value === undefined) {
		return true;
	}
	if (typeof value === "string") {
		return value.trim() === "";
	}
	return false;
}

/** LLM / legacy payloads may use alternate keys; map into canonical SanitizedCargoItem keys. */
function mergeCargoCanonicalFromAliases(
	source: Record<string, unknown>,
): Record<string, unknown> {
	const out = { ...source };
	const aliasPairs: Array<[string, keyof SanitizedCargoItem]> = [
		["ma_hs", "hsCode"],
		["MA_HS", "hsCode"],
		["hs_code", "hsCode"],
		["harmonizedSystemCode", "hsCode"],
		["ma_hang", "customCode"],
		["MA_HANG", "customCode"],
		["MA_HANGKB", "customCode"],
		["ma_hang_kb", "customCode"],
	];

	for (const [alias, canonical] of aliasPairs) {
		if (isUnsetCargoAliasValue(out[canonical]) && alias in out) {
			const aliasVal = out[alias];
			if (!isUnsetCargoAliasValue(aliasVal)) {
				out[canonical] = aliasVal;
			}
		}
	}

	return out;
}

export function sanitizeCargoListPayload(
	payload: unknown,
): SanitizedCargoItem[] {
	if (!Array.isArray(payload)) {
		return [];
	}

	return payload
		.map((item) => {
			const source =
				item && typeof item === "object" && !Array.isArray(item)
					? (item as Record<string, unknown>)
					: {};

			const mergedSource = mergeCargoCanonicalFromAliases(source);

			const sanitized: SanitizedCargoItem = {
				customCode: null,
				hsCode: null,
				originalCountry: null,
				originalCargoName: null,
				dutyReductionCode: null,
				imExDutyExemptionCode: null,
				qty: null,
				unit: null,
				unitPrice: null,
				totalPrice: null,
				qty2: null,
				unit2: null,
				vietnameseName: null,
				importTaxCode: null,
				importTaxRate: null,
				importTaxAmount: null,
				vatTaxCode: null,
				vatTaxRate: null,
				vatTaxAmount: null,
				imExDutyExemptionCondition: null,
				imExDutyExemptionAmount: null,
				lineTaxableValue: null,
				exportTaxRatePercent: null,
				exportTaxAmount: null,
				taxableUnitPrice: null,
				importer: null,
				packageQty: null,
				packageType: null,
				grossWeight: null,
				invoiceNo: null,
				invoiceDate: null,
				term: null,
			};

			Object.entries(mergedSource).forEach(([key, rawValue]) => {
				if (CARGO_META_FIELDS.has(key) || !(key in sanitized)) {
					return;
				}

				if (CARGO_NUMBER_FIELDS.has(key)) {
					sanitized[key as keyof SanitizedCargoItem] = (
						key === "grossWeight"
							? normalizeGrossWeight(rawValue)
							: normalizeNumber(rawValue)
					) as never;
					return;
				}

				if (CARGO_DATE_FIELDS.has(key)) {
					sanitized[key as keyof SanitizedCargoItem] = normalizeDate(
						rawValue,
					) as never;
					return;
				}

				sanitized[key as keyof SanitizedCargoItem] = normalizeString(
					rawValue,
				) as never;
			});

			if (sanitized.hsCode) {
				sanitized.hsCode = sanitized.hsCode.replace(/\s+/g, " ").trim();
			}

			return sanitized;
		})
		.filter((item) => !isCargoItemEmpty(item));
}
