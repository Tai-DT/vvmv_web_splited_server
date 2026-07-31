import type { Prisma } from "@/prisma/client";

export type CdsCollectionPayload = Record<string, unknown>;

export const CDS_INFO_COLLECTION_INCLUDE = {
	billItemRows: { orderBy: { sortOrder: "asc" as const } },
	valuationAdjustmentRows: { orderBy: { sortOrder: "asc" as const } },
	transportScheduleRows: { orderBy: { sortOrder: "asc" as const } },
	importLicenseRows: { orderBy: { sortOrder: "asc" as const } },
	otherLegalDocumentRows: { orderBy: { sortOrder: "asc" as const } },
	electronicAttachmentRows: { orderBy: { sortOrder: "asc" as const } },
} as const;

export function hydrateCdsCollections(cdsInfo: unknown): CdsCollectionPayload {
	if (!cdsInfo || typeof cdsInfo !== "object") {
		return {};
	}

	const row = cdsInfo as CdsCollectionPayload & {
		billItemRows?: CdsCollectionPayload[];
		valuationAdjustmentRows?: CdsCollectionPayload[];
		transportScheduleRows?: CdsCollectionPayload[];
		importLicenseRows?: CdsCollectionPayload[];
		otherLegalDocumentRows?: CdsCollectionPayload[];
		electronicAttachmentRows?: CdsCollectionPayload[];
	};

	return {
		...row,
		billItems: Array.isArray(row.billItemRows)
			? row.billItemRows.map((item) => ({
					billNumber: item.billNumber ?? null,
					billDate: item.billDate ?? null,
					hawbNumber: item.hawbNumber ?? null,
					mawbYear: item.mawbYear ?? null,
				}))
			: row.billItems,
		valuationAdjustments: Array.isArray(row.valuationAdjustmentRows)
			? row.valuationAdjustmentRows.map((item) => ({
					nameCode: item.nameCode ?? null,
					classificationCode: item.classificationCode ?? null,
					currencyCode: item.currencyCode ?? null,
					adjustmentValue: item.adjustmentValue ?? null,
					allocationRatio: item.allocationRatio ?? null,
				}))
			: row.valuationAdjustments,
		transportSchedules: Array.isArray(row.transportScheduleRows)
			? row.transportScheduleRows.map((item) => ({
					locationCode: item.locationCode ?? null,
					locationName: item.locationName ?? null,
					arrivalDate: item.arrivalDate ?? null,
					departureDate: item.departureDate ?? null,
				}))
			: row.transportSchedules,
		importLicenses: Array.isArray(row.importLicenseRows)
			? row.importLicenseRows.map((item) => item.licenseNumber ?? null)
			: row.importLicenses,
		otherLegalDocumentCodes: Array.isArray(row.otherLegalDocumentRows)
			? row.otherLegalDocumentRows.map((item) => item.documentCode ?? null)
			: row.otherLegalDocumentCodes,
		electronicAttachments: Array.isArray(row.electronicAttachmentRows)
			? row.electronicAttachmentRows.map((item) => ({
					attachmentNumber: item.attachmentNumber ?? null,
					attachmentDescription: item.attachmentDescription ?? null,
				}))
			: row.electronicAttachments,
	};
}

export function toPrismaCdsScalarPayload(payload: CdsCollectionPayload) {
	const collectionFields = new Set([
		"billItems",
		"valuationAdjustments",
		"transportSchedules",
		"importLicenses",
		"otherLegalDocumentCodes",
		"electronicAttachments",
	]);

	return Object.fromEntries(
		Object.entries(payload)
			.filter(([key]) => !collectionFields.has(key))
			.map(([key, value]) => [key, value === undefined ? null : value]),
	);
}

export function buildCdsCollectionWrites(payload: CdsCollectionPayload) {
	const rows = (key: string) =>
		Array.isArray(payload[key]) ? payload[key] : [];

	return {
		billItemRows: {
			deleteMany: {},
			create: rows("billItems").map((item, index) => {
				const entry = item as CdsCollectionPayload;
				return {
					sortOrder: index,
					billNumber: (entry.billNumber as string | null | undefined) ?? null,
					billDate: (entry.billDate as string | null | undefined) ?? null,
					hawbNumber: (entry.hawbNumber as string | null | undefined) ?? null,
					mawbYear: (entry.mawbYear as string | null | undefined) ?? null,
				};
			}),
		},
		valuationAdjustmentRows: {
			deleteMany: {},
			create: rows("valuationAdjustments").map((item, index) => {
				const entry = item as CdsCollectionPayload;
				return {
					sortOrder: index,
					nameCode: (entry.nameCode as string | null | undefined) ?? null,
					classificationCode:
						(entry.classificationCode as string | null | undefined) ?? null,
					currencyCode:
						(entry.currencyCode as string | null | undefined) ?? null,
					adjustmentValue:
						(entry.adjustmentValue as number | null | undefined) ?? null,
					allocationRatio:
						(entry.allocationRatio as number | null | undefined) ?? null,
				};
			}),
		},
		transportScheduleRows: {
			deleteMany: {},
			create: rows("transportSchedules").map((item, index) => {
				const entry = item as CdsCollectionPayload;
				return {
					sortOrder: index,
					locationCode:
						(entry.locationCode as string | null | undefined) ?? null,
					locationName:
						(entry.locationName as string | null | undefined) ?? null,
					arrivalDate: (entry.arrivalDate as string | null | undefined) ?? null,
					departureDate:
						(entry.departureDate as string | null | undefined) ?? null,
				};
			}),
		},
		importLicenseRows: {
			deleteMany: {},
			create: rows("importLicenses").map((value, index) => ({
				sortOrder: index,
				licenseNumber: (value as string | null | undefined) ?? null,
			})),
		},
		otherLegalDocumentRows: {
			deleteMany: {},
			create: rows("otherLegalDocumentCodes").map((value, index) => ({
				sortOrder: index,
				documentCode: (value as string | null | undefined) ?? null,
			})),
		},
		electronicAttachmentRows: {
			deleteMany: {},
			create: rows("electronicAttachments").map((item, index) => {
				const entry = item as CdsCollectionPayload;
				return {
					sortOrder: index,
					attachmentNumber:
						(entry.attachmentNumber as string | null | undefined) ?? null,
					attachmentDescription:
						(entry.attachmentDescription as string | null | undefined) ?? null,
				};
			}),
		},
	} satisfies Pick<
		Prisma.FollowUpCdsInfoUpdateInput,
		| "billItemRows"
		| "valuationAdjustmentRows"
		| "transportScheduleRows"
		| "importLicenseRows"
		| "otherLegalDocumentRows"
		| "electronicAttachmentRows"
	>;
}

/**
 * Nested creates only — the create branch of an upsert rejects `deleteMany`.
 */
export function buildCdsCollectionCreates(payload: CdsCollectionPayload) {
	return Object.fromEntries(
		Object.entries(buildCdsCollectionWrites(payload)).map(
			([rowsField, write]) => [rowsField, { create: write.create }],
		),
	);
}
