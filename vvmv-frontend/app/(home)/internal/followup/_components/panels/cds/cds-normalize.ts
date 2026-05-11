// cds-normalize.ts – normalization functions extracted from cds-info-panel.tsx (Phase 2)

import { normalizeLooseNumber } from "@/lib/followup/number-utils";
import type { FollowUpCdsInfoRow } from "../../../types";
import type {
	ElectronicAttachmentRow,
	TransportScheduleRow,
	ValuationAdjustmentRow,
} from "./cds-lookup-types";
import {
	IMPORT_ELECTRONIC_ATTACHMENT_ROW_COUNT,
	IMPORT_LEGAL_DOCUMENT_SLOT_COUNT,
	IMPORT_LICENSE_SLOT_COUNT,
	IMPORT_TRANSPORT_SCHEDULE_ROW_COUNT,
	IMPORT_VALUATION_ADJUSTMENT_ROW_COUNT,
} from "./cds-slot-constants";

export function normalizeNumber(
	value: string | number | null | undefined,
): number | null {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}

	if (typeof value !== "string") {
		return null;
	}

	return normalizeLooseNumber(value);
}

export function normalizeLookupValue(value: string | null | undefined) {
	return (value ?? "")
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.replace(/[^A-Za-z0-9]+/g, " ")
		.trim()
		.replace(/\s+/g, " ")
		.toUpperCase();
}

export function normalizeDeclarationCandidate(
	value: string | null | undefined,
) {
	const normalized = value?.trim();
	return normalized ? normalized : null;
}

export function normalizeFixedStringList(
	value: unknown,
	size: number,
	fallback?: unknown,
) {
	const source = Array.isArray(value) ? value : [];
	const normalized = Array.from({ length: size }, (_, index) => {
		const item = source[index];
		return typeof item === "string"
			? normalizeDeclarationCandidate(item)
			: item === null
				? null
				: null;
	});

	if (
		fallback !== undefined &&
		fallback !== null &&
		!normalized.some((item) => item !== null)
	) {
		normalized[0] = normalizeDeclarationCandidate(String(fallback));
	}

	return normalized;
}

export function normalizeValuationAdjustmentsCollection(value: unknown) {
	const source = Array.isArray(value) ? value : [];

	return Array.from(
		{ length: IMPORT_VALUATION_ADJUSTMENT_ROW_COUNT },
		(_, index) => {
			const row =
				source[index] && typeof source[index] === "object"
					? (source[index] as Record<string, unknown>)
					: null;

			return {
				nameCode:
					row && typeof row.nameCode === "string"
						? normalizeDeclarationCandidate(row.nameCode)
						: null,
				classificationCode:
					row && typeof row.classificationCode === "string"
						? normalizeDeclarationCandidate(row.classificationCode)
						: null,
				currencyCode:
					row && typeof row.currencyCode === "string"
						? normalizeDeclarationCandidate(row.currencyCode)
						: null,
				adjustmentValue:
					row && typeof row.adjustmentValue === "number"
						? row.adjustmentValue
						: row && typeof row.adjustmentValue === "string"
							? normalizeNumber(row.adjustmentValue)
							: null,
				allocationRatio:
					row && typeof row.allocationRatio === "number"
						? row.allocationRatio
						: row && typeof row.allocationRatio === "string"
							? normalizeNumber(row.allocationRatio)
							: null,
			} satisfies ValuationAdjustmentRow;
		},
	);
}

export function normalizeElectronicAttachmentsCollection(value: unknown) {
	const source = Array.isArray(value) ? value : [];

	return Array.from(
		{ length: IMPORT_ELECTRONIC_ATTACHMENT_ROW_COUNT },
		(_, index) => {
			const row =
				source[index] && typeof source[index] === "object"
					? (source[index] as Record<string, unknown>)
					: null;

			return {
				attachmentNumber:
					row && typeof row.attachmentNumber === "string"
						? normalizeDeclarationCandidate(row.attachmentNumber)
						: null,
				attachmentDescription:
					row && typeof row.attachmentDescription === "string"
						? normalizeDeclarationCandidate(row.attachmentDescription)
						: null,
			} satisfies ElectronicAttachmentRow;
		},
	);
}

export function normalizeTransportSchedulesCollection(
	value: unknown,
	fallback?: {
		locationCode?: unknown;
		locationName?: unknown;
		arrivalDate?: unknown;
	},
) {
	const source = Array.isArray(value) ? value : [];

	const rows = Array.from(
		{ length: IMPORT_TRANSPORT_SCHEDULE_ROW_COUNT },
		(_, index) => {
			const row =
				source[index] && typeof source[index] === "object"
					? (source[index] as Record<string, unknown>)
					: null;

			return {
				locationCode:
					row && typeof row.locationCode === "string"
						? normalizeDeclarationCandidate(row.locationCode)
						: null,
				locationName:
					row && typeof row.locationName === "string"
						? normalizeDeclarationCandidate(row.locationName)
						: null,
				arrivalDate:
					row && typeof row.arrivalDate === "string"
						? normalizeDeclarationCandidate(row.arrivalDate)
						: null,
				departureDate:
					row && typeof row.departureDate === "string"
						? normalizeDeclarationCandidate(row.departureDate)
						: null,
			} satisfies TransportScheduleRow;
		},
	);

	if (
		fallback &&
		!rows.some((row) =>
			Object.values(row).some((field) => field !== null && field !== ""),
		)
	) {
		rows[0] = {
			locationCode:
				typeof fallback.locationCode === "string"
					? normalizeDeclarationCandidate(fallback.locationCode)
					: null,
			locationName:
				typeof fallback.locationName === "string"
					? normalizeDeclarationCandidate(fallback.locationName)
					: null,
			arrivalDate:
				typeof fallback.arrivalDate === "string"
					? normalizeDeclarationCandidate(fallback.arrivalDate)
					: null,
			departureDate: null,
		};
	}

	return rows;
}

export function normalizeImportCollectionFields(
	value: Partial<FollowUpCdsInfoRow> | null | undefined,
) {
	const source = value ?? {};
	const primaryImportLicenseSlot =
		typeof source.importLicense === "string" && source.importLicense.trim()
			? typeof source.licenseNumber === "string" && source.licenseNumber.trim()
				? `${source.importLicense.trim()}:${source.licenseNumber.trim()}`
				: source.importLicense.trim()
			: typeof source.licenseNumber === "string" && source.licenseNumber.trim()
				? `:${source.licenseNumber.trim()}`
				: undefined;

	return {
		...source,
		otherLegalDocumentCodes: normalizeFixedStringList(
			source.otherLegalDocumentCodes,
			IMPORT_LEGAL_DOCUMENT_SLOT_COUNT,
			source.otherLegalDocumentCode,
		),
		importLicenses: normalizeFixedStringList(
			source.importLicenses,
			IMPORT_LICENSE_SLOT_COUNT,
			primaryImportLicenseSlot,
		),
		valuationAdjustments: normalizeValuationAdjustmentsCollection(
			source.valuationAdjustments,
		),
		electronicAttachments: normalizeElectronicAttachmentsCollection(
			source.electronicAttachments,
		),
		transportSchedules: normalizeTransportSchedulesCollection(
			source.transportSchedules,
		),
	} satisfies Partial<FollowUpCdsInfoRow>;
}

export function normalizeComparisonValue(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}

	if (typeof value === "number") {
		return Number.isFinite(value) ? String(value) : "";
	}

	if (value instanceof Date) {
		return Number.isNaN(value.getTime())
			? ""
			: value.toISOString().slice(0, 10);
	}

	if (typeof value === "string") {
		const isoDateMatch = value.match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/);
		if (isoDateMatch) {
			return isoDateMatch[1];
		}
	}

	if (Array.isArray(value)) {
		return value.map((item) => normalizeComparisonValue(item)).join("|");
	}

	if (typeof value === "object") {
		return JSON.stringify(value);
	}

	return String(value).trim();
}
