import { NextResponse } from "next/server";
import {
	APP_FIELD_OPTION_FIELD_NAMES,
	CDS_HARDCODED_FIELD_OPTION_FIELDS,
} from "@/app/(home)/internal/followup/_components/panels/cds/cds-sets";
import type { FollowUpCdsInfoRow } from "@/app/(home)/internal/followup/types";
import { auth } from "@/lib/auth";
import { prismaRPA, queryERPHAN, queryERPHCM } from "@/lib/db";
import {
	buildSavedCdsFieldOptions,
	type SavedCdsLookupSnapshot,
} from "@/lib/followup/cds-app-saved-lookups";
import type {
	CdsDatabaseLookups,
	DatabaseElectronicAttachmentLookup,
	DatabaseFieldOptionLookup,
} from "@/lib/followup/cds-database-lookups";
import {
	getCdsElectronicAttachmentTypeDescription,
	isUsableCdsElectronicAttachmentNumber,
} from "@/lib/followup/cds-electronic-attachment-types";
import {
	getLiveCdsDatabaseLookups,
	hasCdsDatabaseLookupContent,
	mergeCdsDatabaseLookups,
} from "@/lib/followup/cds-live-lookups";
import { filterSavedFieldOptionsAgainstLookups } from "@/lib/followup/cds-lookups-sanitize";
import {
	type CdsPackageUnitCode,
	getCdsPackageUnitCodes,
} from "@/lib/followup/cds-package-unit-codes";
import {
	isAllowedVnaccsStandardFieldValue,
	isVnaccsStandardField,
} from "@/lib/followup/cds-vnaccs-standard-rules";
import {
	normalizeLookupValueKey,
	pickBetterLookupLabel,
	toAppLookupOptionsFromCodeNameRows,
} from "@/lib/followup/cds-web-field-options";
import {
	DEFAULT_CDS_WEIGHT_UNIT,
	getCdsWeightUnitOptions,
} from "@/lib/followup/cds-weight-units";
import { checkFollowUpPermission } from "@/lib/followup/check-permission";
import { resolveHanConnectionForTaxCode } from "@/lib/followup/han-connection";
import type { Site } from "@/prisma/client";

export const runtime = "nodejs";
export const maxDuration = 120;

const HAN_AUTHORITATIVE_APP_FALLBACK_FIELDS = new Set<
	Extract<keyof FollowUpCdsInfoRow, string>
>([
	"loadingLocationCode",
	"unloadingLocationCode",
	"warehouseLocationCode",
	"taxDestinationLocation",
	"transportVehicleCode",
]);

type AppFieldOptionMap = Partial<
	Record<Extract<keyof FollowUpCdsInfoRow, string>, DatabaseFieldOptionLookup[]>
>;

type SavedSubmissionLogRow = {
	operationType: string | null;
	requestPayload: unknown;
	followUp: {
		domain: Site | null;
	} | null;
};

const SAVED_LOOKUP_HISTORY_LIMIT = 1000;
const CDS_STEP_TIMEOUT_MS = Number.parseInt(
	process.env.CDS_STEP_TIMEOUT_MS || "8000",
	10,
);
const CDS_ENABLE_LIVE_LOOKUPS = process.env.CDS_ENABLE_LIVE_LOOKUPS === "true";
/** Set on deploy to always use committed `database/exports/.../cds_database_lookups.json` as the base (live HAN will not replace it). */
const CDS_USE_COMMITTED_LOOKUP_SNAPSHOT_ONLY =
	process.env.CDS_USE_COMMITTED_LOOKUP_SNAPSHOT_ONLY === "true";
const CDS_ENABLE_APP_DB_LOOKUPS =
	process.env.CDS_ENABLE_APP_DB_LOOKUPS !== "false";
const CDS_ENABLE_SAVED_HISTORY_LOOKUPS =
	process.env.CDS_ENABLE_SAVED_HISTORY_LOOKUPS !== "false";
const CDS_ENABLE_ERP_VEHICLE_LOOKUPS =
	process.env.CDS_ENABLE_ERP_VEHICLE_LOOKUPS === "true";
const CDS_STRICT_APP_LOOKUPS = process.env.CDS_STRICT_APP_LOOKUPS !== "false";
const CDS_FIELD_OPTIONS_LIMIT = Number.parseInt(
	process.env.CDS_FIELD_OPTIONS_LIMIT || "120",
	10,
);
const CDS_IMPORT_LICENSES_LIMIT = Number.parseInt(
	process.env.CDS_IMPORT_LICENSES_LIMIT || "500",
	10,
);
const CDS_PERMITS_LIMIT = Number.parseInt(
	process.env.CDS_PERMITS_LIMIT || "500",
	10,
);
const CDS_ELECTRONIC_ATTACHMENTS_LIMIT = Number.parseInt(
	process.env.CDS_ELECTRONIC_ATTACHMENTS_LIMIT || "400",
	10,
);
const CDS_OPERATION_CODES_LIMIT = Number.parseInt(
	process.env.CDS_OPERATION_CODES_LIMIT || "500",
	10,
);
const CDS_PROCESSING_DEPARTMENTS_LIMIT = Number.parseInt(
	process.env.CDS_PROCESSING_DEPARTMENTS_LIMIT || "800",
	10,
);
const CDS_FAST_FIELD_OPTIONS_LIMIT = Number.parseInt(
	process.env.CDS_FAST_FIELD_OPTIONS_LIMIT || "60",
	10,
);
/**
 * High-cardinality CDS field options (banks, locations, warehouses, vehicles).
 * Global fast/full caps would hide most valid codes after count-based sorting.
 * Supports legacy env CDS_BANK_FIELD_OPTIONS_LIMIT.
 */
const CDS_LARGE_CATALOG_FIELD_OPTIONS_LIMIT = Number.parseInt(
	process.env.CDS_LARGE_CATALOG_FIELD_OPTIONS_LIMIT ??
		process.env.CDS_BANK_FIELD_OPTIONS_LIMIT ??
		"8000",
	10,
);
const APP_DYNAMIC_FIELD_OPTION_FIELD_NAMES =
	APP_FIELD_OPTION_FIELD_NAMES.filter(
		(fieldName) => !CDS_HARDCODED_FIELD_OPTION_FIELDS.has(fieldName),
	);
const CDS_PACKAGE_UNIT_JSON_FIELD_NAMES = ["packageType"] as const;
const CDS_BANK_FIELD_KEYS_LIST = [
	"taxSubstituteBankCode",
	"guaranteeBankCode",
] as const satisfies readonly Extract<keyof FollowUpCdsInfoRow, string>[];
/** Same risk pattern as banks: huge master lists + app DB rows are often partial. */
const CDS_LARGE_CATALOG_FIELD_KEYS = new Set<
	Extract<keyof FollowUpCdsInfoRow, string>
>([
	...CDS_BANK_FIELD_KEYS_LIST,
	...HAN_AUTHORITATIVE_APP_FALLBACK_FIELDS,
	"customsWarehouseCode",
	"finalDestinationCode",
	"packageType",
	"weightUnit",
]);
/** App DB rows for bank codes are merged in fast mode so deployment always has catalog + DB. */
const CDS_FAST_APP_DB_FIELDS = CDS_BANK_FIELD_KEYS_LIST;

type CdsDbFieldOptionRow = {
	field: string;
	value: string;
	label: string | null;
	address: string | null;
	count: number | null;
	direction: string | null;
	source: string | null;
};

async function loadCdsDatabaseLookupsFromDb(): Promise<CdsDatabaseLookups | null> {
	try {
		const [
			operationCodes,
			importLicenses,
			permits,
			permitTypes,
			processingDepartments,
			fieldRows,
			electronicAttachments,
		] = await Promise.all([
			prismaRPA.$queryRawUnsafe<
				Array<{ code: string; name: string; direction: string }>
			>(
				`SELECT code, name, direction FROM cds_operation_code_lookup ORDER BY code LIMIT ${CDS_OPERATION_CODES_LIMIT}`,
			),
			prismaRPA.$queryRawUnsafe<Array<Record<string, unknown>>>(
				`SELECT * FROM cds_permit_lookup WHERE kind = 'import_license' ORDER BY declaration_count DESC NULLS LAST, permit_no LIMIT ${CDS_IMPORT_LICENSES_LIMIT}`,
			),
			prismaRPA.$queryRawUnsafe<Array<Record<string, unknown>>>(
				`SELECT * FROM cds_permit_lookup WHERE kind = 'permit' ORDER BY declaration_count DESC NULLS LAST, permit_no LIMIT ${CDS_PERMITS_LIMIT}`,
			),
			prismaRPA.$queryRawUnsafe<Array<{ code: string; name: string }>>(
				`SELECT code, name FROM cds_permit_type_lookup ORDER BY code`,
			),
			prismaRPA.$queryRawUnsafe<Array<Record<string, unknown>>>(
				`SELECT code, customs_code, name, operation_codes, allow_import, allow_export FROM cds_processing_department_lookup ORDER BY customs_code, code LIMIT ${CDS_PROCESSING_DEPARTMENTS_LIMIT}`,
			),
			prismaRPA.$queryRawUnsafe<CdsDbFieldOptionRow[]>(
				`SELECT field, value, label, address, count, direction, source
				 FROM (
				   SELECT *, row_number() OVER (PARTITION BY field ORDER BY count DESC, value ASC) AS rn
				   FROM cds_field_option_lookup
				 ) ranked
				 WHERE rn <= ${CDS_LARGE_CATALOG_FIELD_OPTIONS_LIMIT}
				 ORDER BY field, count DESC, value ASC`,
			),
			prismaRPA.$queryRawUnsafe<Array<Record<string, unknown>>>(
				`SELECT attachment_type_code, attachment_number, attachment_description, count
				 FROM cds_electronic_attachment_lookup
				 ORDER BY count DESC, attachment_type_code
				 LIMIT ${CDS_ELECTRONIC_ATTACHMENTS_LIMIT}`,
			),
		]);

		if (
			operationCodes.length === 0 &&
			fieldRows.length === 0 &&
			permitTypes.length === 0
		) {
			return null;
		}

		const toPermit = (row: Record<string, unknown>) => ({
			id: String(row.id ?? ""),
			permitTypeCode: (row.permit_type_code as string | null) ?? null,
			permitTypeName: (row.permit_type_name as string | null) ?? null,
			permitNo: String(row.permit_no ?? ""),
			permitIssueDate: (row.permit_issue_date as string | null) ?? null,
			permitExpiryDate: (row.permit_expiry_date as string | null) ?? null,
			declarationCount:
				row.declaration_count == null ? null : Number(row.declaration_count),
			firstDeclarationDate:
				(row.first_declaration_date as string | null) ?? null,
			lastDeclarationDate: (row.last_declaration_date as string | null) ?? null,
			sampleDeclarationNo: (row.sample_declaration_no as string | null) ?? null,
			sampleCustomsCode: (row.sample_customs_code as string | null) ?? null,
			isExplicitImportLicense: Boolean(row.is_explicit_import_license),
		});

		const fieldOptions: CdsDatabaseLookups["fieldOptions"] = {};
		for (const row of fieldRows) {
			const field = row.field as keyof typeof fieldOptions;
			const list = fieldOptions[field] ?? [];
			list.push({
				field: row.field as DatabaseFieldOptionLookup["field"],
				value: row.value,
				label: row.label,
				address: row.address,
				count: Number(row.count ?? 0),
				direction:
					row.direction === "import" || row.direction === "export"
						? row.direction
						: "unknown",
				source:
					row.source === "header" ||
					row.source === "vnaccs" ||
					row.source === "app" ||
					row.source === "app_saved"
						? row.source
						: "vnaccs",
			});
			fieldOptions[field] = list;
		}

		return {
			operationCodes: operationCodes.map((row) => ({
				code: row.code,
				name: row.name,
				direction:
					row.direction === "import" || row.direction === "export"
						? row.direction
						: "unknown",
			})),
			importLicenses: importLicenses.map(toPermit),
			permits: permits.map(toPermit),
			permitTypes,
			processingDepartments: processingDepartments.map((row) => ({
				code: String(row.code ?? ""),
				customsCode: String(row.customs_code ?? ""),
				name: String(row.name ?? ""),
				operationCodes: Array.isArray(row.operation_codes)
					? (row.operation_codes as string[])
					: [],
				allowImport: Boolean(row.allow_import),
				allowExport: Boolean(row.allow_export),
			})),
			fieldOptions,
			electronicAttachments: electronicAttachments.map((row) => ({
				attachmentTypeCode: String(row.attachment_type_code ?? ""),
				attachmentNumber: (row.attachment_number as string | null) ?? null,
				attachmentDescription:
					(row.attachment_description as string | null) ?? null,
				count: Number(row.count ?? 0),
			})),
		};
	} catch (error) {
		console.warn(
			"CDS DB lookup tables unavailable, falling back to JSON:",
			error,
		);
		return null;
	}
}

async function loadBaseCdsDatabaseLookups(): Promise<CdsDatabaseLookups> {
	const dbLookups = await loadCdsDatabaseLookupsFromDb();
	if (dbLookups) return dbLookups;
	const { getCdsDatabaseLookups } = await import(
		"@/lib/followup/cds-database-lookups"
	);
	return getCdsDatabaseLookups();
}

const SAVED_CDS_INFO_SELECT = {
	operationCode: true,
	cargoClassificationCode: true,
	customsCode: true,
	declarationProcessingDeptCode: true,
	exportCountryCode: true,
	guaranteeBankCode: true,
	insuranceFeeClassificationCode: true,
	insuranceFeeCurrencyCode: true,
	inspectionResultCode: true,
	invoiceClassificationCode: true,
	invoiceCurrency: true,
	invoiceFormClassificationCode: true,
	invoicePriceCondition: true,
	loadingLocationCode: true,
	loadingLocationName: true,
	packageType: true,
	paymentMethod: true,
	personOrganizationClassification: true,
	releaseBeforePermitCode: true,
	taxableValueCurrencyCode: true,
	taxDestinationLocation: true,
	taxPayer: true,
	taxPaymentDeadlineCode: true,
	taxSubstituteBankCode: true,
	transportFeeClassificationCode: true,
	transportFeeCurrencyCode: true,
	transportMethodCode: true,
	transportVehicleCode: true,
	transportVehicleName: true,
	unloadingLocationCode: true,
	unloadingLocationName: true,
	valuationDeclarationTypeCode: true,
	warehouseLocationCode: true,
	warehouseLocationName: true,
	weightUnit: true,
	electronicAttachmentRows: { orderBy: { sortOrder: "asc" as const } },
	updatedAt: true,
	followUp: {
		select: {
			domain: true,
			operationType: true,
		},
	},
} as const;

function timeoutError(label: string, timeoutMs: number) {
	return new Error(`${label} timed out after ${timeoutMs}ms`);
}

async function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	label: string,
): Promise<T> {
	let timer: NodeJS.Timeout | null = null;
	try {
		const timeoutPromise = new Promise<never>((_, reject) => {
			timer = setTimeout(
				() => reject(timeoutError(label, timeoutMs)),
				Math.max(timeoutMs, 1),
			);
		});

		return await Promise.race([promise, timeoutPromise]);
	} finally {
		if (timer) {
			clearTimeout(timer);
		}
	}
}

function toAppFieldOptions(
	field: Extract<keyof FollowUpCdsInfoRow, string>,
	values: Array<string | null | undefined>,
): DatabaseFieldOptionLookup[] {
	const counts = new Map<string, number>();

	for (const value of values) {
		const normalized = String(value ?? "").trim();
		if (!normalized) {
			continue;
		}

		const key = normalized.toUpperCase();
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}

	return [...counts.entries()]
		.map(([value, count]) => ({
			field,
			value,
			label: value,
			count,
			direction: "unknown" as const,
			source: "app" as const,
		}))
		.sort((left, right) => {
			if (right.count !== left.count) {
				return right.count - left.count;
			}

			return left.value.localeCompare(right.value, "en", { numeric: true });
		});
}

async function loadAppVehicleOptions(
	site: string | null | undefined,
	isSuperAdmin: boolean,
) {
	if (!CDS_ENABLE_ERP_VEHICLE_LOOKUPS) {
		return [] satisfies DatabaseFieldOptionLookup[];
	}

	const effectiveSite = (site ?? "SGN") as Site;

	const query = `
    SELECT VHUnitNo as Item
    FROM dbo.VehicleList
    WHERE VHUnitNo IS NOT NULL AND LTRIM(RTRIM(VHUnitNo)) <> ''
    ORDER BY VHUnitNo
  `;

	let recordset: Array<{ Item: string }> = [];

	if (isSuperAdmin) {
		const [hcmResult, hanResult] = await Promise.all([
			queryERPHCM<{ Item: string }>(query),
			queryERPHAN<{ Item: string }>(query),
		]);
		recordset = [...hcmResult.recordset, ...hanResult.recordset];
	} else {
		const result =
			effectiveSite === "SGN"
				? await queryERPHCM<{ Item: string }>(query)
				: await queryERPHAN<{ Item: string }>(query);
		recordset = result.recordset;
	}

	return toAppFieldOptions(
		"transportVehicleCode",
		recordset.map((row) => row.Item),
	);
}

async function loadAppCustomsWarehouseOptions(
	site: string | null | undefined,
	isSuperAdmin: boolean,
) {
	const normalizedSite = (site ?? "SGN") as Site;
	const siteFilter = isSuperAdmin
		? {}
		: normalizedSite === "HAN"
			? { site: "HAN" as Site }
			: { site: { in: [normalizedSite, "HAN" as Site] } };
	const rows = await prismaRPA.customsWarehouse.findMany({
		where: siteFilter,
		orderBy: [{ whCode: "asc" }, { whName: "asc" }],
		select: {
			whCode: true,
			whName: true,
		},
	});

	return toAppLookupOptionsFromCodeNameRows(
		"customsWarehouseCode",
		rows.map((row) => ({
			code: row.whCode,
			name: row.whName,
		})),
	);
}

async function loadAppFieldOptions(
	site: string | null | undefined,
	isSuperAdmin: boolean,
	options?: {
		includeErpVehicles?: boolean;
		onlyFields?: ReadonlyArray<Extract<keyof FollowUpCdsInfoRow, string>>;
	},
): Promise<AppFieldOptionMap> {
	const normalizedSite = (site ?? "SGN") as Site;
	const onlyFieldsSet =
		options?.onlyFields && options.onlyFields.length > 0
			? new Set(options.onlyFields)
			: null;
	const targetFields = APP_DYNAMIC_FIELD_OPTION_FIELD_NAMES.filter(
		(fieldName) => (onlyFieldsSet ? onlyFieldsSet.has(fieldName) : true),
	);
	const hanFallbackFields = targetFields.filter((fieldName) =>
		CDS_LARGE_CATALOG_FIELD_KEYS.has(fieldName),
	);

	const rows = await prismaRPA.fieldOption.findMany({
		where: {
			fieldName: { in: targetFields },
			isActive: true,
			...(isSuperAdmin
				? {}
				: { OR: [{ site: null }, { site: normalizedSite }] }),
		},
		orderBy: [
			{ fieldName: "asc" },
			{ order: "asc" },
			{ code: "asc" },
			{ name: "asc" },
		],
		select: {
			fieldName: true,
			code: true,
			name: true,
		},
	});
	const hanFallbackRows =
		!isSuperAdmin && normalizedSite !== "HAN" && hanFallbackFields.length > 0
			? await prismaRPA.fieldOption.findMany({
					where: {
						fieldName: { in: hanFallbackFields },
						isActive: true,
						site: "HAN",
					},
					orderBy: [
						{ fieldName: "asc" },
						{ order: "asc" },
						{ code: "asc" },
						{ name: "asc" },
					],
					select: {
						fieldName: true,
						code: true,
						name: true,
					},
				})
			: [];
	const mergedRows = [...rows, ...hanFallbackRows];

	const groupedRows = new Map<
		Extract<keyof FollowUpCdsInfoRow, string>,
		Array<{ code: string | null | undefined; name: string | null | undefined }>
	>();

	for (const row of mergedRows) {
		const fieldName = row.fieldName.trim();
		if (!fieldName) {
			continue;
		}

		const fieldKey = fieldName as Extract<keyof FollowUpCdsInfoRow, string>;
		if (CDS_HARDCODED_FIELD_OPTION_FIELDS.has(fieldKey)) {
			continue;
		}

		if (
			isVnaccsStandardField(fieldKey) &&
			!isAllowedVnaccsStandardFieldValue(fieldKey, row.code ?? "")
		) {
			continue;
		}

		const current = groupedRows.get(fieldKey) ?? [];
		current.push({
			code: row.code,
			name: row.name,
		});
		groupedRows.set(fieldKey, current);
	}

	const includeErpVehicles =
		(options?.includeErpVehicles ?? true) &&
		(!onlyFieldsSet || onlyFieldsSet.has("transportVehicleCode"));
	const shouldLoadCustomsWarehouse =
		!onlyFieldsSet || onlyFieldsSet.has("customsWarehouseCode");
	const [customsWarehouseResult, vehicleResult] = await Promise.allSettled([
		shouldLoadCustomsWarehouse
			? loadAppCustomsWarehouseOptions(site, isSuperAdmin)
			: Promise.resolve([] satisfies DatabaseFieldOptionLookup[]),
		includeErpVehicles
			? loadAppVehicleOptions(site, isSuperAdmin)
			: Promise.resolve([] satisfies DatabaseFieldOptionLookup[]),
	]);

	const customsWarehouseOptions =
		customsWarehouseResult.status === "fulfilled"
			? customsWarehouseResult.value
			: [];
	const vehicleOptions =
		vehicleResult.status === "fulfilled" ? vehicleResult.value : [];

	if (customsWarehouseResult.status === "rejected") {
		console.warn(
			"CDS app customs warehouses unavailable, keeping DB field-options only:",
			customsWarehouseResult.reason,
		);
	}

	if (vehicleResult.status === "rejected") {
		console.warn(
			"CDS app vehicle options unavailable, keeping DB field-options only:",
			vehicleResult.reason,
		);
	}

	const result: AppFieldOptionMap = {};

	for (const [fieldKey, groupedFieldRows] of groupedRows.entries()) {
		result[fieldKey] = toAppLookupOptionsFromCodeNameRows(
			fieldKey,
			groupedFieldRows,
		);
	}

	result.customsWarehouseCode =
		mergeFieldOptionLists<DatabaseFieldOptionLookup>(
			result.customsWarehouseCode ?? [],
			customsWarehouseOptions,
			"customsWarehouseCode",
		);
	result.transportVehicleCode =
		mergeFieldOptionLists<DatabaseFieldOptionLookup>(
			result.transportVehicleCode ?? [],
			vehicleOptions,
			"transportVehicleCode",
		);

	return result;
}

function omitHardcodedFieldOptions(fieldOptions: AppFieldOptionMap) {
	const nextFieldOptions = { ...fieldOptions };

	CDS_HARDCODED_FIELD_OPTION_FIELDS.forEach((fieldKey) => {
		delete nextFieldOptions[fieldKey];
	});

	return nextFieldOptions;
}

function getFieldOptionSourcePriority(
	source: "header" | "vnaccs" | "app" | "app_saved",
) {
	switch (source) {
		case "header":
		case "vnaccs":
			return 3;
		case "app_saved":
			return 2;
		case "app":
			return 1;
		default:
			return 0;
	}
}

function mergeFieldOptionLists<
	T extends {
		value: string;
		direction: string;
		count: number;
		source: "header" | "vnaccs" | "app" | "app_saved";
		label?: string | null;
		address?: string | null;
	},
>(
	currentOptions: T[],
	incomingOptions: T[],
	_fieldName?: Extract<keyof FollowUpCdsInfoRow, string>,
) {
	const mergedByKey = new Map<string, T>();

	[...currentOptions, ...incomingOptions].forEach((item) => {
		const normalizedValueKey = normalizeLookupValueKey(item.value);
		const key = `${item.direction}::${normalizedValueKey}`;
		const existing = mergedByKey.get(key);

		if (!existing) {
			mergedByKey.set(key, {
				...item,
				value: item.value.trim(),
			});
			return;
		}

		const existingPriority = getFieldOptionSourcePriority(existing.source);
		const incomingPriority = getFieldOptionSourcePriority(item.source);
		const preferred = existingPriority >= incomingPriority ? existing : item;
		const fallback = preferred === existing ? item : existing;

		mergedByKey.set(key, {
			...preferred,
			value: preferred.value.trim(),
			label: pickBetterLookupLabel(
				preferred.label,
				fallback.label,
				preferred.value,
			),
			address: preferred.address || fallback.address || null,
			count: Math.max(existing.count, item.count),
		});
	});

	return [...mergedByKey.values()].sort((left, right) => {
		if (right.count !== left.count) {
			return right.count - left.count;
		}

		if (left.direction !== right.direction) {
			return left.direction.localeCompare(right.direction, "en");
		}

		return left.value.localeCompare(right.value, "en", {
			numeric: true,
		});
	});
}

function cleanLookupText(value: unknown) {
	const normalized = String(value ?? "").trim();
	return normalized ? normalized : null;
}

function cleanAttachmentTypeCode(value: unknown) {
	const text = cleanLookupText(value);
	if (!text) {
		return null;
	}

	const separatorIndex = text.indexOf(" - ");
	const code = separatorIndex > 0 ? text.slice(0, separatorIndex) : text;
	const normalized = code.trim().toUpperCase();

	return normalized || null;
}

function buildSavedElectronicAttachmentLookups(
	snapshots: SavedCdsLookupSnapshot[],
) {
	const merged = new Map<string, DatabaseElectronicAttachmentLookup>();

	snapshots.forEach((snapshot) => {
		const attachments = Array.isArray(snapshot.cdsInfo?.electronicAttachments)
			? snapshot.cdsInfo.electronicAttachments
			: [];

		attachments.forEach((row) => {
			if (!row || typeof row !== "object") {
				return;
			}

			const attachmentTypeCode = cleanAttachmentTypeCode(
				row.attachmentDescription,
			);
			const attachmentNumber = cleanLookupText(row.attachmentNumber);

			if (
				!attachmentTypeCode ||
				!attachmentNumber ||
				!isUsableCdsElectronicAttachmentNumber(
					attachmentTypeCode,
					attachmentNumber,
				)
			) {
				return;
			}

			const key = `${attachmentTypeCode}::${attachmentNumber}`;
			const existing = merged.get(key);

			if (existing) {
				existing.count += 1;
				return;
			}

			merged.set(key, {
				attachmentTypeCode,
				attachmentNumber,
				attachmentDescription:
					getCdsElectronicAttachmentTypeDescription(attachmentTypeCode) ??
					attachmentTypeCode,
				count: 1,
			});
		});
	});

	return [...merged.values()].sort((left, right) => {
		if (left.attachmentTypeCode !== right.attachmentTypeCode) {
			return left.attachmentTypeCode.localeCompare(
				right.attachmentTypeCode,
				"en",
			);
		}

		if (right.count !== left.count) {
			return right.count - left.count;
		}

		return (left.attachmentNumber ?? "").localeCompare(
			right.attachmentNumber ?? "",
			"en",
			{ numeric: true },
		);
	});
}

function mergeElectronicAttachmentLookups(
	current: DatabaseElectronicAttachmentLookup[],
	incoming: DatabaseElectronicAttachmentLookup[],
) {
	const merged = new Map<string, DatabaseElectronicAttachmentLookup>();

	[...current, ...incoming].forEach((item) => {
		const attachmentTypeCode = cleanAttachmentTypeCode(item.attachmentTypeCode);
		const attachmentNumber = cleanLookupText(item.attachmentNumber);

		if (!attachmentTypeCode || !attachmentNumber) {
			return;
		}

		const key = `${attachmentTypeCode}::${attachmentNumber}`;
		const existing = merged.get(key);

		if (!existing) {
			merged.set(key, {
				...item,
				attachmentTypeCode,
				attachmentNumber,
			});
			return;
		}

		merged.set(key, {
			...existing,
			attachmentDescription:
				existing.attachmentDescription ?? item.attachmentDescription ?? null,
			count: Math.max(existing.count, item.count),
		});
	});

	return [...merged.values()].sort((left, right) => {
		if (left.attachmentTypeCode !== right.attachmentTypeCode) {
			return left.attachmentTypeCode.localeCompare(
				right.attachmentTypeCode,
				"en",
			);
		}

		if (right.count !== left.count) {
			return right.count - left.count;
		}

		return (left.attachmentNumber ?? "").localeCompare(
			right.attachmentNumber ?? "",
			"en",
			{ numeric: true },
		);
	});
}

function toSafeLimit(value: number, fallback: number) {
	if (!Number.isFinite(value) || value <= 0) {
		return fallback;
	}
	return Math.floor(value);
}

function optionSourcePriority(source: DatabaseFieldOptionLookup["source"]) {
	switch (source) {
		case "header":
			return 4;
		case "vnaccs":
			return 3;
		case "app_saved":
			return 2;
		case "app":
			return 1;
	}

	const unreachable: never = source;
	return unreachable;
}

function prioritizeAndLimitFieldOptions(
	options: DatabaseFieldOptionLookup[],
	limit: number,
) {
	return [...options]
		.sort((left, right) => {
			if (right.count !== left.count) {
				return right.count - left.count;
			}

			const sourcePriorityDelta =
				optionSourcePriority(right.source) - optionSourcePriority(left.source);
			if (sourcePriorityDelta !== 0) {
				return sourcePriorityDelta;
			}

			if (left.direction !== right.direction) {
				return left.direction.localeCompare(right.direction, "en");
			}

			return left.value.localeCompare(right.value, "en", { numeric: true });
		})
		.slice(0, limit);
}

function getFieldOptionsLimitForKey(
	fieldName: string,
	mode: "fast" | "full",
): number {
	if (CDS_LARGE_CATALOG_FIELD_KEYS.has(fieldName as keyof FollowUpCdsInfoRow)) {
		if (
			!Number.isFinite(CDS_LARGE_CATALOG_FIELD_OPTIONS_LIMIT) ||
			CDS_LARGE_CATALOG_FIELD_OPTIONS_LIMIT <= 0
		) {
			return Number.MAX_SAFE_INTEGER;
		}
		return toSafeLimit(CDS_LARGE_CATALOG_FIELD_OPTIONS_LIMIT, 8000);
	}

	return toSafeLimit(
		mode === "fast" ? CDS_FAST_FIELD_OPTIONS_LIMIT : CDS_FIELD_OPTIONS_LIMIT,
		mode === "fast" ? 60 : 300,
	);
}

function prioritizeLookupResponse(
	data: CdsDatabaseLookups,
	mode: "fast" | "full",
): CdsDatabaseLookups {
	const importLicenseLimit = toSafeLimit(CDS_IMPORT_LICENSES_LIMIT, 500);
	const permitLimit = toSafeLimit(CDS_PERMITS_LIMIT, 500);
	const attachmentLimit = toSafeLimit(CDS_ELECTRONIC_ATTACHMENTS_LIMIT, 400);
	const operationCodeLimit = toSafeLimit(CDS_OPERATION_CODES_LIMIT, 500);
	const processingDepartmentLimit = toSafeLimit(
		CDS_PROCESSING_DEPARTMENTS_LIMIT,
		800,
	);

	const nextFieldOptions: CdsDatabaseLookups["fieldOptions"] = {};
	for (const [fieldName, options] of Object.entries(data.fieldOptions)) {
		const typedOptions = options ?? [];
		const fieldLimit = getFieldOptionsLimitForKey(fieldName, mode);
		nextFieldOptions[fieldName as keyof typeof nextFieldOptions] =
			prioritizeAndLimitFieldOptions(typedOptions, fieldLimit);
	}

	return {
		...data,
		operationCodes: [...data.operationCodes].slice(0, operationCodeLimit),
		importLicenses: [...data.importLicenses].slice(0, importLicenseLimit),
		permits: [...data.permits].slice(0, permitLimit),
		processingDepartments: [...data.processingDepartments].slice(
			0,
			processingDepartmentLimit,
		),
		electronicAttachments: [...data.electronicAttachments].slice(
			0,
			attachmentLimit,
		),
		fieldOptions: nextFieldOptions,
	};
}

function getPackageUnitJsonLabel(unit: CdsPackageUnitCode) {
	const labelParts = [
		unit.name,
		unit.nameAlt && unit.nameAlt !== unit.name ? unit.nameAlt : null,
		unit.nameVn,
		unit.nameAltVn && unit.nameAltVn !== unit.nameVn ? unit.nameAltVn : null,
	].filter((part): part is string => Boolean(part));

	return labelParts.length > 0
		? labelParts.join(" - ")
		: (unit.legacyName ?? unit.code);
}

function toPackageUnitJsonFieldOptions(
	field: (typeof CDS_PACKAGE_UNIT_JSON_FIELD_NAMES)[number],
): DatabaseFieldOptionLookup[] {
	const units = getCdsPackageUnitCodes();

	return units.map((unit) => ({
		field,
		value: unit.code,
		label: getPackageUnitJsonLabel(unit),
		count: Math.max(units.length - unit.sortOrder + 1, 1),
		direction: "unknown" as const,
		source: "app" as const,
	}));
}

function toWeightUnitFieldOptions(): DatabaseFieldOptionLookup[] {
	return getCdsWeightUnitOptions().map((option) => ({
		field: "weightUnit",
		value: option.value,
		label: option.label,
		count: option.value === DEFAULT_CDS_WEIGHT_UNIT ? 1_000_000 : 1,
		direction: "unknown" as const,
		source: "app" as const,
	}));
}

function withAppCatalogFieldOptions(data: CdsDatabaseLookups) {
	const fieldOptions = { ...data.fieldOptions };

	CDS_PACKAGE_UNIT_JSON_FIELD_NAMES.forEach((fieldName) => {
		fieldOptions[fieldName] = mergeFieldOptionLists(
			fieldOptions[fieldName] ?? [],
			toPackageUnitJsonFieldOptions(fieldName),
			fieldName,
		);
	});

	fieldOptions.weightUnit = mergeFieldOptionLists(
		fieldOptions.weightUnit ?? [],
		toWeightUnitFieldOptions(),
		"weightUnit",
	);

	return {
		...data,
		fieldOptions,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shouldIncludeSavedLookupForSite(
	rowSite: Site | null | undefined,
	site: string | null | undefined,
	isSuperAdmin: boolean,
) {
	if (isSuperAdmin) {
		return true;
	}

	const normalizedSite = (site ?? "SGN") as Site;
	return rowSite == null || rowSite === normalizedSite;
}

async function loadSavedSubmissionLogs() {
	const ecusSubmissionLogDelegate = (
		prismaRPA as unknown as {
			ecusSubmissionLog?: {
				findMany: (args: {
					take: number;
					orderBy: { preparedAt: "desc" };
					select: {
						operationType: true;
						requestPayload: true;
						followUp: {
							select: {
								domain: true;
							};
						};
					};
				}) => Promise<SavedSubmissionLogRow[]>;
			};
		}
	).ecusSubmissionLog;

	if (!ecusSubmissionLogDelegate) {
		return [] satisfies SavedSubmissionLogRow[];
	}

	return ecusSubmissionLogDelegate.findMany({
		take: SAVED_LOOKUP_HISTORY_LIMIT,
		orderBy: { preparedAt: "desc" },
		select: {
			operationType: true,
			requestPayload: true,
			followUp: {
				select: {
					domain: true,
				},
			},
		},
	});
}

async function loadSavedFieldOptions(
	site: string | null | undefined,
	isSuperAdmin: boolean,
) {
	const [savedCdsRows, submissionLogs] = await Promise.all([
		prismaRPA.followUpCdsInfo.findMany({
			take: SAVED_LOOKUP_HISTORY_LIMIT,
			orderBy: { updatedAt: "desc" },
			select: SAVED_CDS_INFO_SELECT,
		}),
		loadSavedSubmissionLogs(),
	]);

	const snapshots: SavedCdsLookupSnapshot[] = [];

	savedCdsRows.forEach((row) => {
		if (
			!shouldIncludeSavedLookupForSite(row.followUp?.domain, site, isSuperAdmin)
		) {
			return;
		}

		const {
			followUp,
			updatedAt: _updatedAt,
			electronicAttachmentRows,
			...cdsInfo
		} = row;
		snapshots.push({
			operationType: followUp?.operationType,
			operationCode: cdsInfo.operationCode,
			cdsInfo: {
				...cdsInfo,
				electronicAttachments: electronicAttachmentRows.map((item) => ({
					attachmentNumber: item.attachmentNumber,
					attachmentDescription: item.attachmentDescription,
				})),
			} as Partial<FollowUpCdsInfoRow>,
		});
	});

	submissionLogs.forEach((log) => {
		if (
			!shouldIncludeSavedLookupForSite(log.followUp?.domain, site, isSuperAdmin)
		) {
			return;
		}

		if (!isRecord(log.requestPayload)) {
			return;
		}

		const cdsInfo = isRecord(log.requestPayload.cdsInfo)
			? (log.requestPayload.cdsInfo as Partial<FollowUpCdsInfoRow>)
			: null;

		if (!cdsInfo) {
			return;
		}

		snapshots.push({
			operationType: log.requestPayload.operationType ?? log.operationType,
			operationCode: cdsInfo.operationCode,
			cdsInfo,
		});
	});

	return buildSavedCdsFieldOptions(snapshots);
}

async function loadSavedElectronicAttachmentLookups(
	site: string | null | undefined,
	isSuperAdmin: boolean,
) {
	const [savedCdsRows, submissionLogs] = await Promise.all([
		prismaRPA.followUpCdsInfo.findMany({
			take: SAVED_LOOKUP_HISTORY_LIMIT,
			orderBy: { updatedAt: "desc" },
			select: SAVED_CDS_INFO_SELECT,
		}),
		loadSavedSubmissionLogs(),
	]);

	const snapshots: SavedCdsLookupSnapshot[] = [];

	savedCdsRows.forEach((row) => {
		if (
			!shouldIncludeSavedLookupForSite(row.followUp?.domain, site, isSuperAdmin)
		) {
			return;
		}

		const {
			followUp,
			updatedAt: _updatedAt,
			electronicAttachmentRows,
			...cdsInfo
		} = row;
		snapshots.push({
			operationType: followUp?.operationType,
			operationCode: cdsInfo.operationCode,
			cdsInfo: {
				...cdsInfo,
				electronicAttachments: electronicAttachmentRows.map((item) => ({
					attachmentNumber: item.attachmentNumber,
					attachmentDescription: item.attachmentDescription,
				})),
			} as Partial<FollowUpCdsInfoRow>,
		});
	});

	submissionLogs.forEach((log) => {
		if (
			!shouldIncludeSavedLookupForSite(log.followUp?.domain, site, isSuperAdmin)
		) {
			return;
		}

		if (!isRecord(log.requestPayload)) {
			return;
		}

		const cdsInfo = isRecord(log.requestPayload.cdsInfo)
			? (log.requestPayload.cdsInfo as Partial<FollowUpCdsInfoRow>)
			: null;

		if (!cdsInfo) {
			return;
		}

		snapshots.push({
			operationType: log.requestPayload.operationType ?? log.operationType,
			operationCode: cdsInfo.operationCode,
			cdsInfo,
		});
	});

	return buildSavedElectronicAttachmentLookups(snapshots);
}

export async function GET(request: Request) {
	try {
		const session = await auth.api.getSession({
			headers: new Headers(request.headers),
		});

		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const localLookups = await loadBaseCdsDatabaseLookups();
		let data = localLookups;
		let liveConnectionString: string | null = null;
		const userSite = (session.user as { site?: string | null }).site;
		const userRole = (session.user as { role?: string | null }).role;
		const isSuperAdmin = userRole === "SUPERADMIN";
		const requestUrl = new URL(request.url);
		const mode =
			requestUrl.searchParams.get("mode") === "full" ? "full" : "fast";
		const shouldLoadLiveLookups =
			mode === "full" &&
			CDS_ENABLE_LIVE_LOOKUPS &&
			!CDS_USE_COMMITTED_LOOKUP_SNAPSHOT_ONLY;
		const shouldLoadHeavyLookups = mode === "full";
		const shouldLoadAppDbLookups = CDS_ENABLE_APP_DB_LOOKUPS;
		const fastModeAppFields =
			mode === "fast"
				? ([...CDS_FAST_APP_DB_FIELDS] as Extract<
						keyof FollowUpCdsInfoRow,
						string
					>[])
				: null;
		const shouldLoadSavedHistoryLookups =
			shouldLoadHeavyLookups &&
			CDS_ENABLE_SAVED_HISTORY_LOOKUPS &&
			!CDS_STRICT_APP_LOOKUPS;
		const followUpId =
			requestUrl.searchParams.get("followUpId")?.trim() || null;

		if (followUpId) {
			const permission = await checkFollowUpPermission(
				followUpId,
				session.user.id,
				session.user.role ?? "",
				{ mode: "read" },
			);

			if (!permission.ok) {
				return NextResponse.json(
					{ error: permission.error },
					{ status: permission.status },
				);
			}

			const followUp = await prismaRPA.followUp.findUnique({
				where: { id: followUpId },
				select: {
					taxCode: true,
					domain: true,
					cdsInfo: true,
				},
			});
			const cdsInfo =
				followUp?.cdsInfo as unknown as Partial<FollowUpCdsInfoRow> | null;

			if (shouldLoadLiveLookups) {
				liveConnectionString = await withTimeout(
					resolveHanConnectionForTaxCode({
						taxCode: cdsInfo?.importerCode ?? followUp?.taxCode,
						taxCodeCandidates: [followUp?.taxCode],
						site: followUp?.domain,
					}),
					CDS_STEP_TIMEOUT_MS,
					"Resolve HAN connection for CDS lookups",
				)
					.then((connection) => connection.connectionString)
					.catch((error) => {
						console.warn(
							"CDS live lookups unavailable because DD Info is missing:",
							error instanceof Error ? error.message : error,
						);
						return null;
					});
			}
		}

		if (shouldLoadLiveLookups) {
			try {
				const liveLookups = await withTimeout(
					getLiveCdsDatabaseLookups({
						connectionString: liveConnectionString,
					}),
					CDS_STEP_TIMEOUT_MS,
					"Fetch live CDS lookups",
				);
				if (hasCdsDatabaseLookupContent(liveLookups)) {
					// Merge into bundled snapshot (never replace): live HAN often omits large catalogs.
					data = mergeCdsDatabaseLookups(localLookups, liveLookups);
				}
			} catch (liveLookupError) {
				console.warn(
					"CDS live lookups unavailable, falling back to local cache only:",
					liveLookupError,
				);
			}
		}

		data = {
			...data,
			fieldOptions: omitHardcodedFieldOptions(data.fieldOptions),
		};
		data = withAppCatalogFieldOptions(data);

		if (shouldLoadAppDbLookups) {
			try {
				const [appFieldOptions, savedElectronicAttachments] = await withTimeout(
					Promise.all([
						loadAppFieldOptions(userSite, isSuperAdmin, {
							includeErpVehicles:
								mode === "full" && CDS_ENABLE_ERP_VEHICLE_LOOKUPS,
							onlyFields: fastModeAppFields ?? undefined,
						}),
						loadSavedElectronicAttachmentLookups(userSite, isSuperAdmin),
					]),
					CDS_STEP_TIMEOUT_MS,
					"Load app CDS lookup options",
				);
				const fieldOptions = { ...data.fieldOptions };

				for (const [fieldName, options] of Object.entries(appFieldOptions)) {
					const fieldKey = fieldName as keyof typeof fieldOptions;
					const appOptions = options ?? [];
					const shouldMergeStrictAppWithLookup =
						CDS_LARGE_CATALOG_FIELD_KEYS.has(
							fieldKey as Extract<keyof FollowUpCdsInfoRow, string>,
						);

					if (CDS_STRICT_APP_LOOKUPS) {
						// Large master catalogs must stay merged with CSV/live/saved data; app DB alone is often incomplete.
						if (!shouldMergeStrictAppWithLookup && appOptions.length > 0) {
							fieldOptions[fieldKey] = appOptions;
						}
						if (!shouldMergeStrictAppWithLookup) {
							continue;
						}
					}

					const currentOptions = fieldOptions[fieldKey] ?? [];

					if (
						HAN_AUTHORITATIVE_APP_FALLBACK_FIELDS.has(
							fieldName as Extract<keyof FollowUpCdsInfoRow, string>,
						) &&
						currentOptions.length > 0
					) {
						continue;
					}

					fieldOptions[fieldKey] = mergeFieldOptionLists(
						currentOptions,
						appOptions,
						fieldName as Extract<keyof FollowUpCdsInfoRow, string>,
					);
				}

				data = {
					...data,
					fieldOptions,
					electronicAttachments: mergeElectronicAttachmentLookups(
						data.electronicAttachments,
						savedElectronicAttachments,
					),
				};
			} catch (appFieldOptionError) {
				console.warn(
					"CDS app field-options unavailable, using CDS lookups only:",
					appFieldOptionError,
				);
			}
		}

		if (shouldLoadSavedHistoryLookups) {
			try {
				const savedFieldOptions = await withTimeout(
					loadSavedFieldOptions(userSite, isSuperAdmin),
					CDS_STEP_TIMEOUT_MS,
					"Load saved CDS lookup history",
				);
				const sanitizedSavedFieldOptions =
					filterSavedFieldOptionsAgainstLookups(savedFieldOptions, data);
				const fieldOptions = { ...data.fieldOptions };

				for (const [fieldName, options] of Object.entries(
					sanitizedSavedFieldOptions,
				)) {
					const fieldKey = fieldName as keyof typeof fieldOptions;
					if (CDS_HARDCODED_FIELD_OPTION_FIELDS.has(fieldKey)) {
						continue;
					}

					fieldOptions[fieldKey] = mergeFieldOptionLists(
						fieldOptions[fieldKey] ?? [],
						options ?? [],
						fieldName as Extract<keyof FollowUpCdsInfoRow, string>,
					);
				}

				data = {
					...data,
					fieldOptions,
				};
			} catch (savedFieldOptionError) {
				console.warn(
					"CDS saved lookup history unavailable, using HAN/app options only:",
					savedFieldOptionError,
				);
			}
		}

		return NextResponse.json({ data: prioritizeLookupResponse(data, mode) });
	} catch (error) {
		console.error("Failed to load CDS database lookups:", error);
		return NextResponse.json(
			{ error: "Không thể tải dữ liệu tra cứu CDS" },
			{ status: 500 },
		);
	}
}
