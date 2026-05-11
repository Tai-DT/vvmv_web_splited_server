// cds-prefill.ts – prefill/hydrate functions extracted from cds-info-panel.tsx (Phase 2)

import {
	isCdsLookupValueField,
	normalizeCdsLookupValueField,
} from "@/lib/followup/cds-code-values";
import { normalizeTransportMethodCode } from "@/lib/followup/cds-followup-field-sync";
import { buildCdsHanFieldComparisonSummary } from "@/lib/followup/cds-han-compare";
import {
	DEFAULT_CDS_WEIGHT_UNIT,
	normalizeCdsWeightUnit,
} from "@/lib/followup/cds-weight-units";
import {
	type CompanyProfileDefaults,
	mergeCompanyProfileDefaults,
} from "@/lib/followup/company-profile-defaults";
import type { HanDeclarationCandidate } from "@/lib/followup/han-declaration-loader";
import type {
	DeclarationRow,
	FollowUpCdsInfoRow,
	FollowUpRow,
} from "../../../types";
import { findEcusLocationOptionByText } from "../ecus-location-options";
import { LOOKUP_PAIRED_NAME_FIELDS } from "./cds-lookup-dialog-meta";
import {
	normalizeDeclarationCandidate,
	normalizeImportCollectionFields,
} from "./cds-normalize";

function stripPairedLookupName(value: unknown, code: unknown) {
	const text = String(value ?? "").trim();
	if (!text) {
		return null;
	}

	const normalizedCode = String(code ?? "").trim();
	if (normalizedCode) {
		const codePrefix = `${normalizedCode} - `;
		if (text.startsWith(codePrefix)) {
			return text.slice(codePrefix.length).trim() || null;
		}
	}

	const separatorIndex = text.indexOf(" - ");
	if (separatorIndex > 0 && separatorIndex <= 16) {
		return text.slice(separatorIndex + 3).trim() || null;
	}

	return text;
}

function normalizeText(value: unknown) {
	const text = String(value ?? "").trim();
	return text || null;
}

function toNaturalAddressCase(value: unknown) {
	const text = String(value ?? "").trim();
	if (!text) {
		return null;
	}

	const lower = text.toLocaleLowerCase("vi-VN");
	let result = "";
	let shouldUppercase = true;

	for (const char of lower) {
		if (shouldUppercase && /[a-zA-ZÀ-ỹ]/.test(char)) {
			result += char.toLocaleUpperCase("vi-VN");
			shouldUppercase = false;
			continue;
		}

		result += char;
		if (/[,.;:\-/()]/.test(char)) {
			shouldUppercase = true;
		}
	}

	return result
		.replace(/\bVsip\b/g, "VSIP")
		.replace(/\bKcn\b/g, "KCN")
		.replace(/\bTp\b/g, "TP");
}

function isLikelyLocationCode(value: unknown) {
	const text = String(value ?? "")
		.trim()
		.toUpperCase();
	return /^[A-Z]{5}$/.test(text) || /^(?=.*\d)[A-Z0-9]{5,8}$/.test(text);
}

function resolveLocationCodeFromCandidates(
	candidates: Array<unknown>,
	options?: {
		allowTextMatch?: boolean;
	},
): string | null {
	for (const candidate of candidates) {
		const text = normalizeText(candidate);
		if (!text) {
			continue;
		}

		if (isLikelyLocationCode(text)) {
			return text.toUpperCase();
		}

		if (options?.allowTextMatch !== true) {
			continue;
		}

		const matched = findEcusLocationOptionByText(text);
		if (matched?.value) {
			return matched.value;
		}
	}

	return null;
}

function shouldUseTransportFallbackCode(
	transportMethodCode: unknown,
	transportVehicleCode: unknown,
) {
	const method = String(transportMethodCode ?? "").trim();
	const vehicleCode = String(transportVehicleCode ?? "").trim();

	if (vehicleCode) {
		return false;
	}

	// Sea container/sea bulk flows require fallback call-sign when empty.
	return method === "2" || method === "3";
}

function toDdMmmDate(value: unknown) {
	const raw = String(value ?? "").trim();
	if (!raw) {
		return null;
	}

	const date = new Date(raw);
	if (Number.isNaN(date.getTime())) {
		return null;
	}

	const day = String(date.getDate()).padStart(2, "0");
	const month = date
		.toLocaleString("en-US", { month: "short" })
		.toUpperCase()
		.slice(0, 3);
	return `${day}${month}`;
}

function resolveTransportMethodCodeFromBillOrBooking(value: unknown) {
	const text = String(value ?? "").trim();
	if (!text) {
		return null;
	}

	const normalized = text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.replace(/đ/g, "d")
		.replace(/Đ/g, "D")
		.toUpperCase();

	if (
		normalized.includes("LCL") ||
		normalized.includes("CFS") ||
		normalized.includes("CONSOL")
	) {
		return "3";
	}

	if (normalized.includes("FCL") || normalized.includes("CY/CY")) {
		return "2";
	}

	if (
		normalized.includes("AIR") ||
		normalized.includes("CPN") ||
		normalized.includes("COURIER") ||
		normalized.includes("AWB")
	) {
		return "1";
	}

	return null;
}

function resolveAirTransportVehicleName(args: {
	currentName: unknown;
	billOrBooking: unknown;
	dateCandidate: unknown;
}) {
	const current = String(args.currentName ?? "").trim();
	if (current && /^[A-Z0-9]{2}[A-Z0-9]{4}\/\d{2}[A-Z]{3}$/i.test(current)) {
		return current.toUpperCase();
	}

	const source = current || String(args.billOrBooking ?? "").trim();
	const codeMatch = source.toUpperCase().match(/\b[A-Z0-9]{2}[A-Z0-9]{2,4}\b/);
	const flightCode = codeMatch ? codeMatch[0] : null;
	const ddMmm = toDdMmmDate(args.dateCandidate);

	if (flightCode && ddMmm) {
		return `${flightCode}/${ddMmm}`.toUpperCase();
	}

	return current || null;
}

function resolveSeaTransportVehicleName(args: {
	currentName: unknown;
	transportMethodText: unknown;
}) {
	const current = String(args.currentName ?? "").trim();
	if (current) {
		return current;
	}

	const raw = String(args.transportMethodText ?? "").trim();
	if (!raw) {
		return null;
	}

	const normalized = raw
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.replace(/đ/g, "d")
		.replace(/Đ/g, "D")
		.toUpperCase();

	const genericModeOnly =
		normalized === "SEA" ||
		normalized === "OCEAN" ||
		normalized === "LCL" ||
		normalized === "FCL" ||
		normalized === "CFS" ||
		normalized === "DUONG BIEN";

	if (genericModeOnly) {
		return null;
	}

	return raw;
}

function normalizeHydratedCdsInfo(
	source: Partial<FollowUpCdsInfoRow>,
): Partial<FollowUpCdsInfoRow> {
	const next = { ...source } as Record<string, unknown>;

	Object.entries(next).forEach(([fieldKey, fieldValue]) => {
		if (isCdsLookupValueField(fieldKey)) {
			next[fieldKey] = normalizeCdsLookupValueField(fieldKey, fieldValue);
		}
	});

	Object.entries(LOOKUP_PAIRED_NAME_FIELDS).forEach(
		([codeField, nameField]) => {
			next[nameField] = stripPairedLookupName(next[nameField], next[codeField]);
		},
	);

	const addressFields: Array<keyof FollowUpCdsInfoRow> = [
		"importExportBusinessAddress",
		"partnerAddress1",
		"partnerAddress2",
		"partnerAddress3",
		"partnerAddress4",
		"truckLoadingLocationAddress",
	];
	addressFields.forEach((field) => {
		next[field] = toNaturalAddressCase(next[field]);
	});

	return next as Partial<FollowUpCdsInfoRow>;
}

export function hydrateCdsInfoUiFields(
	value: Partial<FollowUpCdsInfoRow> | null | undefined,
) {
	const source = normalizeHydratedCdsInfo(value ?? {});
	const firstBillItem =
		Array.isArray(source.billItems) &&
		source.billItems[0] &&
		typeof source.billItems[0] === "object"
			? source.billItems[0]
			: null;
	const firstBillNumber =
		typeof firstBillItem?.billNumber === "string"
			? firstBillItem.billNumber.trim()
			: "";

	const customsWarehouseCode =
		source.customsWarehouseCode ?? source.warehouseLocationCode ?? null;
	const customsWarehouseName =
		source.customsWarehouseName ?? source.warehouseLocationName ?? null;
	const finalDestinationCode =
		source.finalDestinationCode ?? source.taxDestinationLocation ?? null;
	const finalDestinationName = source.finalDestinationName ?? null;
	const departureDate =
		source.departureDate ?? source.departureArrivalDate ?? null;
	const invoiceFormClassificationCode =
		source.invoiceFormClassificationCode ?? "A";
	const invoiceClassificationCode = source.invoiceClassificationCode ?? "A";
	const paymentMethod = source.paymentMethod ?? "KC";
	const valuationDeclarationTypeCode =
		source.valuationDeclarationTypeCode ?? "6";
	const taxPayer = source.taxPayer ?? "1";
	const taxPaymentDeadlineCode = source.taxPaymentDeadlineCode ?? "D";
	const transportMethodCode = source.transportMethodCode ?? null;
	const seaportSupervisionEnabled = source.seaportSupervisionEnabled ?? null;
	const airportSupervisionEnabled = source.airportSupervisionEnabled ?? null;
	const transportVehicleCode =
		transportMethodCode === "1"
			? null
			: shouldUseTransportFallbackCode(
						transportMethodCode,
						source.transportVehicleCode,
					)
				? "9999"
				: source.transportVehicleCode;

	return {
		...source,
		declarationNumber: null,
		firstDeclarationNumber: null,
		warehouseLocationCode:
			source.warehouseLocationCode ?? customsWarehouseCode ?? null,
		warehouseLocationName:
			source.warehouseLocationName ?? customsWarehouseName ?? null,
		customsWarehouseCode,
		customsWarehouseName,
		taxDestinationLocation:
			source.taxDestinationLocation ?? finalDestinationCode ?? null,
		finalDestinationCode,
		finalDestinationName,
		billOfLading: source.billOfLading ?? (firstBillNumber || null),
		departureArrivalDate: source.departureArrivalDate ?? departureDate ?? null,
		departureDate,
		invoiceFormClassificationCode,
		invoiceClassificationCode,
		paymentMethod,
		valuationDeclarationTypeCode,
		taxPayer,
		taxPaymentDeadlineCode,
		seaportSupervisionEnabled,
		airportSupervisionEnabled,
		transportVehicleCode,
		// Keep this field empty by default until business rules are finalized.
		internalBusinessManagementNumber: null,
		weightUnit: normalizeCdsWeightUnit(source.weightUnit),
	} satisfies Partial<FollowUpCdsInfoRow>;
}

export function mergeMissingFieldValues(
	current: Partial<FollowUpCdsInfoRow>,
	fallback: Partial<FollowUpCdsInfoRow>,
) {
	const next: Record<string, unknown> = { ...current };

	Object.entries(fallback).forEach(([key, value]) => {
		const currentValue = next[key];
		const isEmptyValue =
			currentValue === null ||
			currentValue === undefined ||
			currentValue === "" ||
			(Array.isArray(currentValue) && currentValue.length === 0);

		if (isEmptyValue && value !== null && value !== undefined && value !== "") {
			next[key] = value;
		}
	});

	return next as Partial<FollowUpCdsInfoRow>;
}

export function mergePreferredFieldValues(
	current: Partial<FollowUpCdsInfoRow>,
	preferred: Partial<FollowUpCdsInfoRow>,
) {
	const next: Record<string, unknown> = { ...current };

	Object.entries(preferred).forEach(([key, value]) => {
		if (value === null || value === undefined || value === "") {
			return;
		}

		next[key] = value;
	});

	return next as Partial<FollowUpCdsInfoRow>;
}

export function mergeHanPrefillIntoCdsData(
	current: Partial<FollowUpCdsInfoRow>,
	prefill: Partial<FollowUpCdsInfoRow> | null | undefined,
	fields?: Array<keyof FollowUpCdsInfoRow>,
) {
	const scopedPrefill =
		prefill && typeof prefill === "object"
			? Array.isArray(fields)
				? pickCdsInfoFields(prefill, fields)
				: prefill
			: {};

	const nextData = normalizeImportCollectionFields(
		mergePreferredFieldValues(current, scopedPrefill),
	);

	return hydrateCdsInfoUiFields(nextData);
}

export const CORRESPONDING_DECLARATION_PREFILL_FIELDS: Array<
	keyof FollowUpCdsInfoRow
> = [
	"importerCode",
	"importExportUnitName",
	"importerPostalCode",
	"importExportBusinessAddress",
	"importerPhone",
	"entrustedImporterCode",
	"entrustedImporterName",
	"exporterCode",
	"partnerName",
	"exporterPostalCode",
	"partnerAddress1",
	"partnerAddress2",
	"partnerAddress3",
	"partnerAddress4",
	"entrustedExporterName",
	"customsDeclarantCode",
	"customsCode",
	"declarationProcessingDeptCode",
	"cargoClassificationCode",
	"operationCode",
	"personOrganizationClassification",
	"expectedDeclarationDate",
	"billOfLading",
	"packageQuantity",
	"packageType",
	"grossWeightTotal",
	"weightUnit",
	"containerQuantity",
	"packageMarks",
	"warehouseLocationCode",
	"warehouseLocationName",
	"loadingLocationCode",
	"loadingLocationName",
	"unloadingLocationCode",
	"unloadingLocationName",
	"customsWarehouseCode",
	"customsWarehouseName",
	"finalDestinationCode",
	"finalDestinationName",
	"transportMethodCode",
	"transportVehicleCode",
	"transportVehicleName",
	"departureArrivalDate",
	"estimatedArrivalAtDestinationDate",
	"departureDate",
	"reExportDeadline",
	"importLicense",
	"licenseNumber",
	"contractNumber",
	"contractDate",
	"contractGoodsDate",
	"paymentMethod",
	"electronicInvoiceReceiptNumber",
	"commercialInvoice",
	"commercialInvoiceDate",
	"invoiceFormClassificationCode",
	"invoicePriceCondition",
	"invoiceClassificationCode",
	"declaredValue",
	"totalInvoiceValue",
	"totalTaxableValue",
	"invoiceCurrency",
	"taxableValueCurrencyCode",
	"transportFee",
	"transportFeeClassificationCode",
	"transportFeeCurrencyCode",
	"insuranceFee",
	"insuranceFeeClassificationCode",
	"insuranceFeeCurrencyCode",
	"insuranceRegistrationNumber",
	"exportCountryCode",
];

export function pickCdsInfoFields(
	source: Partial<FollowUpCdsInfoRow>,
	fields: Array<keyof FollowUpCdsInfoRow>,
) {
	const picked: Partial<FollowUpCdsInfoRow> = {};

	fields.forEach((field) => {
		const value = source[field];
		if (value !== undefined) {
			picked[field] = value as never;
		}
	});

	return picked;
}

function getLatestDeclaration(declarations?: DeclarationRow[]) {
	return (
		[...(declarations ?? [])].sort((left, right) => {
			const leftTime = left.declarationDate
				? new Date(left.declarationDate).getTime()
				: left.createdAt
					? new Date(left.createdAt).getTime()
					: 0;
			const rightTime = right.declarationDate
				? new Date(right.declarationDate).getTime()
				: right.createdAt
					? new Date(right.createdAt).getTime()
					: 0;

			return rightTime - leftTime;
		})[0] ?? null
	);
}

export function buildExportPrefillPayload(args: {
	followUpSummary?: Partial<FollowUpRow> | null;
	declarations?: DeclarationRow[];
	companyProfile?: CompanyProfileDefaults | null;
}) {
	const latestDeclaration = getLatestDeclaration(args.declarations);
	const companyProfileDefaults = mergeCompanyProfileDefaults({
		taxCode: args.followUpSummary?.taxCode,
		companyName: args.followUpSummary?.companyName,
		companyProfile: args.companyProfile,
	});
	const fallbackLocationName =
		args.followUpSummary?.loadingLocation ??
		latestDeclaration?.pol ??
		latestDeclaration?.warehouse ??
		null;

	const normalizedTransportMethodCode =
		resolveTransportMethodCodeFromBillOrBooking(
			args.followUpSummary?.billOrBooking,
		) ?? normalizeTransportMethodCode(args.followUpSummary?.transportMethod);
	const defaultTransportVehicleCode =
		normalizedTransportMethodCode === "1"
			? null
			: (args.followUpSummary?.truckNumber ??
				latestDeclaration?.vehicle ??
				null);

	return {
		importerCode:
			companyProfileDefaults?.taxCode ?? args.followUpSummary?.taxCode ?? null,
		importExportUnitName:
			companyProfileDefaults?.companyName ??
			args.followUpSummary?.companyName ??
			null,
		importerPostalCode: companyProfileDefaults?.importerPostalCode ?? null,
		importExportBusinessAddress:
			companyProfileDefaults?.importExportBusinessAddress ?? null,
		importerPhone: companyProfileDefaults?.importerPhone ?? null,
		partnerName: args.followUpSummary?.supplier ?? null,
		customsCode:
			companyProfileDefaults?.customsCode ??
			latestDeclaration?.customsCode ??
			null,
		declarationProcessingDeptCode: latestDeclaration?.authority ?? null,
		operationCode:
			args.followUpSummary?.workType ?? latestDeclaration?.workType ?? null,
		expectedDeclarationDate:
			latestDeclaration?.declarationDate ??
			args.followUpSummary?.startTime ??
			null,
		billOfLading:
			args.followUpSummary?.billOrBooking ??
			latestDeclaration?.billBooking ??
			null,
		packageQuantity:
			args.followUpSummary?.quantity ?? latestDeclaration?.quantity ?? null,
		packageType: args.followUpSummary?.unit ?? latestDeclaration?.unit ?? null,
		grossWeightTotal:
			args.followUpSummary?.grossWeight ??
			latestDeclaration?.grossWeight ??
			null,
		weightUnit: DEFAULT_CDS_WEIGHT_UNIT,
		commercialInvoice:
			args.followUpSummary?.invoice ?? latestDeclaration?.invoice ?? null,
		invoiceFormClassificationCode: "A",
		valuationDeclarationTypeCode: null,
		taxPayer: "1",
		taxPaymentDeadlineCode: "D",
		transportMethodCode: normalizedTransportMethodCode,
		seaportSupervisionEnabled: false,
		airportSupervisionEnabled: false,
		loadingLocationName: fallbackLocationName,
		unloadingLocationName:
			args.followUpSummary?.pickupLocation ?? latestDeclaration?.pod ?? null,
		warehouseLocationCode: latestDeclaration?.diaDiemLuuKho ?? null,
		warehouseLocationName:
			args.followUpSummary?.warehouse ??
			companyProfileDefaults?.warehouseLocationName ??
			null,
		taxDestinationLocation: latestDeclaration?.diaDiemBaoThue ?? null,
		transportVehicleCode: defaultTransportVehicleCode,
		transportVehicleName: latestDeclaration?.vehicle ?? null,
		packageMarks: null,
		departureDate:
			args.followUpSummary?.transportDate ?? latestDeclaration?.etaEtd ?? null,
		note: args.followUpSummary?.notes ?? null,
	} satisfies Partial<FollowUpCdsInfoRow>;
}

export function buildImportPrefillPayload(args: {
	followUpSummary?: Partial<FollowUpRow> | null;
	declarations?: DeclarationRow[];
	companyProfile?: CompanyProfileDefaults | null;
}) {
	const latestDeclaration = getLatestDeclaration(args.declarations);
	const companyProfileDefaults = mergeCompanyProfileDefaults({
		taxCode: args.followUpSummary?.taxCode,
		companyName: args.followUpSummary?.companyName,
		companyProfile: args.companyProfile,
	});
	const normalizedTransportMethodCode =
		resolveTransportMethodCodeFromBillOrBooking(
			args.followUpSummary?.billOrBooking,
		) ?? normalizeTransportMethodCode(args.followUpSummary?.transportMethod);
	const resolvedLoadingLocationCode = resolveLocationCodeFromCandidates([
		latestDeclaration?.pol,
		args.followUpSummary?.loadingLocation,
		args.followUpSummary?.location,
	]);
	const resolvedUnloadingLocationCode = resolveLocationCodeFromCandidates([
		latestDeclaration?.pod,
		args.followUpSummary?.pickupLocation,
	]);
	const shouldDefaultSeaPackageQuantity =
		normalizedTransportMethodCode === "2" ||
		normalizedTransportMethodCode === "3";
	const shouldEnableSeaportSupervision =
		normalizedTransportMethodCode === "2" ||
		normalizedTransportMethodCode === "3";
	const shouldEnableAirportSupervision = normalizedTransportMethodCode === "1";
	const defaultTransportVehicleCode =
		normalizedTransportMethodCode === "2" ||
		normalizedTransportMethodCode === "3"
			? "9999"
			: normalizedTransportMethodCode === "1"
				? null
				: (args.followUpSummary?.truckNumber ??
					latestDeclaration?.vehicle ??
					null);
	const defaultTransportVehicleName =
		normalizedTransportMethodCode === "1"
			? resolveAirTransportVehicleName({
					currentName: latestDeclaration?.vehicle,
					billOrBooking: args.followUpSummary?.billOrBooking,
					dateCandidate:
						args.followUpSummary?.transportDate ?? latestDeclaration?.etaEtd,
				})
			: normalizedTransportMethodCode === "2" ||
					normalizedTransportMethodCode === "3"
				? resolveSeaTransportVehicleName({
						currentName: latestDeclaration?.vehicle,
						transportMethodText: args.followUpSummary?.transportMethod,
					})
				: (latestDeclaration?.vehicle ?? null);
	const defaultContainerQuantity =
		normalizedTransportMethodCode === "2"
			? (args.followUpSummary?.quantity ?? null)
			: null;

	return {
		importerCode:
			companyProfileDefaults?.taxCode ?? args.followUpSummary?.taxCode ?? null,
		importExportUnitName:
			companyProfileDefaults?.companyName ??
			args.followUpSummary?.companyName ??
			null,
		importerPostalCode: companyProfileDefaults?.importerPostalCode ?? null,
		importExportBusinessAddress:
			companyProfileDefaults?.importExportBusinessAddress ?? null,
		importerPhone: companyProfileDefaults?.importerPhone ?? null,
		partnerName:
			args.followUpSummary?.supplier ?? latestDeclaration?.partner ?? null,
		customsCode:
			companyProfileDefaults?.customsCode ??
			latestDeclaration?.customsCode ??
			null,
		declarationProcessingDeptCode: latestDeclaration?.authority ?? null,
		personOrganizationClassification: "4",
		operationCode:
			args.followUpSummary?.workType ?? latestDeclaration?.workType ?? null,
		expectedDeclarationDate: null,
		commercialInvoiceDate:
			latestDeclaration?.declarationDate ??
			args.followUpSummary?.startTime ??
			null,
		billOfLading:
			args.followUpSummary?.billOrBooking ??
			latestDeclaration?.billBooking ??
			null,
		packageQuantity:
			args.followUpSummary?.quantity ??
			latestDeclaration?.quantity ??
			(shouldDefaultSeaPackageQuantity ? 9999 : null),
		packageType: args.followUpSummary?.unit ?? latestDeclaration?.unit ?? null,
		grossWeightTotal:
			args.followUpSummary?.grossWeight ??
			latestDeclaration?.grossWeight ??
			null,
		weightUnit: DEFAULT_CDS_WEIGHT_UNIT,
		commercialInvoice:
			args.followUpSummary?.invoice ?? latestDeclaration?.invoice ?? null,
		invoiceFormClassificationCode: "A",
		taxPayer: "1",
		taxPaymentDeadlineCode: "D",
		transportMethodCode: normalizedTransportMethodCode,
		seaportSupervisionEnabled: shouldEnableSeaportSupervision,
		airportSupervisionEnabled: shouldEnableAirportSupervision,
		loadingLocationCode: resolvedLoadingLocationCode,
		warehouseLocationCode: latestDeclaration?.diaDiemLuuKho ?? null,
		warehouseLocationName:
			args.followUpSummary?.warehouse ??
			companyProfileDefaults?.warehouseLocationName ??
			null,
		taxDestinationLocation:
			resolveLocationCodeFromCandidates([latestDeclaration?.diaDiemBaoThue]) ??
			null,
		unloadingLocationCode: resolvedUnloadingLocationCode,
		transportVehicleCode: defaultTransportVehicleCode,
		transportVehicleName: defaultTransportVehicleName,
		containerQuantity: defaultContainerQuantity,
		departureArrivalDate: null,
		departureDate:
			args.followUpSummary?.transportDate ?? latestDeclaration?.etaEtd ?? null,
		note: args.followUpSummary?.notes ?? null,
	} satisfies Partial<FollowUpCdsInfoRow>;
}

export function buildHanCandidateComparisonSummary(
	current: Partial<FollowUpCdsInfoRow>,
	candidate: HanDeclarationCandidate,
) {
	return buildCdsHanFieldComparisonSummary(current, candidate.prefill);
}

export function pickCurrentDeclarationFallbackValue(
	declarations: DeclarationRow[],
) {
	return declarations
		.map((declaration) => {
			const createdAt = declaration.createdAt
				? new Date(declaration.createdAt).getTime()
				: 0;

			return {
				createdAt: Number.isNaN(createdAt) ? 0 : createdAt,
				value:
					normalizeDeclarationCandidate(declaration.firstCds) ||
					normalizeDeclarationCandidate(declaration.declarationNumber),
			};
		})
		.filter(
			(declaration): declaration is { createdAt: number; value: string } =>
				Boolean(declaration.value),
		)
		.sort((left, right) => right.createdAt - left.createdAt)[0]?.value;
}
