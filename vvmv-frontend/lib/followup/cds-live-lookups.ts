import sql from "mssql";
import { CDS_HARDCODED_FIELD_OPTION_FIELDS } from "@/app/(home)/internal/followup/_components/panels/cds/cds-sets";
import { parseMssqlConnectionString } from "@/lib/db/mssql-connection-string";
import type {
	CdsDatabaseFieldOptionKey,
	CdsDatabaseLookups,
	DatabaseElectronicAttachmentLookup,
	DatabaseFieldOptionLookup,
	DatabaseImportLicenseLookup,
	DatabaseOperationCodeLookup,
	DatabasePermitLookup,
	DatabasePermitTypeLookup,
	DeclarationDirection,
} from "@/lib/followup/cds-database-lookups";
import {
	getCdsElectronicAttachmentTypeDescription,
	isUsableCdsElectronicAttachmentNumber,
} from "@/lib/followup/cds-electronic-attachment-types";
import {
	CDS_RELEASE_BEFORE_PERMIT_LABELS,
	CDS_TAX_PAYER_LABELS,
	CDS_TAX_PAYMENT_DEADLINE_LABELS,
} from "@/lib/followup/cds-tax-options";
import {
	isAllowedVnaccsStandardFieldValue,
	VNACCS_STANDARD_FIELD_LABELS,
} from "@/lib/followup/cds-vnaccs-standard-rules";
import {
	deriveOperationTypeFromOperationCode,
	EXPORT_OPERATION_CODES,
	IMPORT_OPERATION_CODES,
} from "@/lib/followup/operation-type";
import {
	normalizeProcessingDepartmentOperationCodes,
	type ProcessingDepartmentLookup,
} from "@/lib/followup/processing-department";

const LIVE_LOOKUP_CACHE_TTL_MS = 10 * 60 * 1000;

const HEADER_FIELD_OPTION_MAPPINGS_BASE = [
	{ field: "customsCode", column: "MA_HQ" },
	{ field: "exportCountryCode", column: "NUOC_XK" },
	{ field: "invoiceFormClassificationCode", column: "MA_HDTM" },
	{ field: "invoiceClassificationCode", column: "MA_PL_GIA_HDTM" },
	{ field: "paymentMethod", column: "MA_PTTT" },
	{ field: "invoicePriceCondition", column: "MA_GH" },
	{ field: "invoiceCurrency", column: "MA_NT" },
	{ field: "taxableValueCurrencyCode", column: "MA_NT_TGTT" },
	{ field: "taxPaymentDeadlineCode", column: "MA_THOI_HAN_NOP_THUE" },
	{ field: "packageType", column: "DVT_KIEN" },
	{ field: "weightUnit", column: "DVT_TR_LUONG" },
	{ field: "transportFeeClassificationCode", column: "MA_PHI_VC" },
	{ field: "transportFeeCurrencyCode", column: "MA_NT_PHI_VC" },
	{ field: "insuranceFeeClassificationCode", column: "MA_PHI_BH" },
	{ field: "insuranceFeeCurrencyCode", column: "MA_NT_PHI_BH" },
] as const satisfies ReadonlyArray<{
	field: CdsDatabaseFieldOptionKey;
	column: string;
}>;

const HEADER_FIELD_OPTION_MAPPINGS: Array<{
	field: CdsDatabaseFieldOptionKey;
	column: string;
}> = HEADER_FIELD_OPTION_MAPPINGS_BASE.filter(
	(mapping) => !CDS_HARDCODED_FIELD_OPTION_FIELDS.has(mapping.field),
);

const VNACCS_FIELD_OPTION_MAPPINGS_BASE = [
	{ field: "valuationDeclarationTypeCode", column: "MA_KHAI_TRGIA" },
	{ field: "taxPayer", column: "MA_NGUOI_NOP_THUE" },
	{ field: "releaseBeforePermitCode", column: "MA_LY_DO_BP" },
] as const satisfies ReadonlyArray<{
	field: CdsDatabaseFieldOptionKey;
	column: string;
}>;

const VNACCS_FIELD_OPTION_MAPPINGS: Array<{
	field: CdsDatabaseFieldOptionKey;
	column: string;
}> = VNACCS_FIELD_OPTION_MAPPINGS_BASE.filter(
	(mapping) => !CDS_HARDCODED_FIELD_OPTION_FIELDS.has(mapping.field),
);

const VNACCS2_FIELD_OPTION_MAPPINGS_BASE = [
	{ field: "cargoClassificationCode", column: "MA_PHAN_LOAI_HH" },
	{
		field: "personOrganizationClassification",
		column: "CANHAN_TOCHUC",
	},
	{ field: "transportMethodCode", column: "MA_HIEU_PTVC" },
] as const satisfies ReadonlyArray<{
	field: CdsDatabaseFieldOptionKey;
	column: string;
}>;

const VNACCS2_FIELD_OPTION_MAPPINGS: Array<{
	field: CdsDatabaseFieldOptionKey;
	column: string;
}> = VNACCS2_FIELD_OPTION_MAPPINGS_BASE.filter(
	(mapping) => !CDS_HARDCODED_FIELD_OPTION_FIELDS.has(mapping.field),
);

type SqlRow = Record<string, unknown>;

type CachedLookupState = {
	connectionKey: string;
	expiresAt: number;
	promise: Promise<CdsDatabaseLookups>;
};

type LookupLabelMaps = Partial<
	Record<CdsDatabaseFieldOptionKey, Map<string, string>>
>;

const REFERENCE_FIELD_OPTION_SOURCES: Partial<
	Record<CdsDatabaseFieldOptionKey, DatabaseFieldOptionLookup["source"]>
> = Object.fromEntries(
	Object.entries({
		cargoClassificationCode: "vnaccs",
		customsCode: "header",
		exportCountryCode: "header",
		guaranteeBankCode: "header",
		insuranceFeeClassificationCode: "header",
		insuranceFeeCurrencyCode: "header",
		invoiceClassificationCode: "header",
		invoiceCurrency: "header",
		invoiceFormClassificationCode: "header",
		invoicePriceCondition: "header",
		packageType: "header",
		paymentMethod: "header",
		personOrganizationClassification: "vnaccs",
		releaseBeforePermitCode: "vnaccs",
		taxPayer: "vnaccs",
		taxPaymentDeadlineCode: "header",
		taxableValueCurrencyCode: "header",
		taxSubstituteBankCode: "header",
		transportFeeClassificationCode: "header",
		transportFeeCurrencyCode: "header",
		transportMethodCode: "vnaccs",
		transportVehicleCode: "header",
		valuationDeclarationTypeCode: "vnaccs",
		weightUnit: "header",
	}).filter(
		([fieldKey]) =>
			!CDS_HARDCODED_FIELD_OPTION_FIELDS.has(
				fieldKey as CdsDatabaseFieldOptionKey,
			),
	),
) as Partial<
	Record<CdsDatabaseFieldOptionKey, DatabaseFieldOptionLookup["source"]>
>;

const globalForLiveLookups = globalThis as unknown as {
	cdsLiveLookupsCache?: CachedLookupState;
};

function toSqlQuotedList(values: readonly string[]) {
	return values.map((value) => `'${value.replace(/'/g, "''")}'`).join(", ");
}

const IMPORT_OPERATION_CODES_SQL = toSqlQuotedList(IMPORT_OPERATION_CODES);
const EXPORT_OPERATION_CODES_SQL = toSqlQuotedList(EXPORT_OPERATION_CODES);

function buildHeaderDirectionCaseExpression(headerAlias: string) {
	const xOrNExpression = `UPPER(LTRIM(RTRIM(CAST(${headerAlias}._XorN AS NVARCHAR(8)))))`;
	const operationCodeExpression = `UPPER(LTRIM(RTRIM(CAST(${headerAlias}.MA_LH AS NVARCHAR(32)))))`;

	return `
CASE
  WHEN ${xOrNExpression} = 'N' THEN 'import'
  WHEN ${xOrNExpression} = 'X' THEN 'export'
  WHEN ${operationCodeExpression} IN (${IMPORT_OPERATION_CODES_SQL}) THEN 'import'
  WHEN ${operationCodeExpression} IN (${EXPORT_OPERATION_CODES_SQL}) THEN 'export'
  ELSE 'unknown'
END
`.trim();
}

const HEADER_DIRECTION_CASE_SQL = buildHeaderDirectionCaseExpression("h");
const HEADER_IS_IMPORT_SQL = `(${HEADER_DIRECTION_CASE_SQL}) = 'import'`;
const HEADER_IS_EXPORT_SQL = `(${HEADER_DIRECTION_CASE_SQL}) = 'export'`;

function clean(value: unknown): string | null {
	const normalized = String(value ?? "").trim();
	return normalized === "" ? null : normalized;
}

function cleanCode(value: unknown): string | null {
	return clean(value)?.toUpperCase() ?? null;
}

function normalizeDirectionFromOperationCode(
	value: unknown,
): DeclarationDirection {
	const operationType = deriveOperationTypeFromOperationCode(value);

	if (operationType === "NHAP") {
		return "import";
	}

	if (operationType === "XUAT") {
		return "export";
	}

	return "unknown";
}

function normalizeDirectionFromXOrN(value: unknown): DeclarationDirection {
	const normalized = cleanCode(value);

	if (normalized === "N") {
		return "import";
	}

	if (normalized === "X") {
		return "export";
	}

	return "unknown";
}

function normalizeIsoDate(value: unknown): string | null {
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) {
			return null;
		}

		return value.toISOString().slice(0, 10);
	}

	const normalized = clean(value);
	if (!normalized) {
		return null;
	}

	if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
		return normalized;
	}

	const parsed = new Date(normalized);
	return Number.isNaN(parsed.getTime())
		? null
		: parsed.toISOString().slice(0, 10);
}

function toInteger(value: unknown): number | null {
	if (typeof value === "number") {
		return Number.isFinite(value) ? Math.trunc(value) : null;
	}

	const normalized = clean(value);
	if (!normalized) {
		return null;
	}

	const parsed = Number.parseInt(normalized, 10);
	return Number.isFinite(parsed) ? parsed : null;
}

function prettifyAttachmentDescription(value: string) {
	return value
		.replace(/[_-]+/g, " ")
		.toLowerCase()
		.replace(/\b\w/g, (character) => character.toUpperCase());
}

function buildCorrespondingDeclarationLabel(args: {
	declarationNumber: string | null;
	operationCode: string | null;
	declarationDate: string | null;
	taxCode: string | null;
	companyName: string | null;
}) {
	const parts = [
		args.declarationNumber ? `Từ TK ${args.declarationNumber}` : null,
		args.operationCode,
		args.declarationDate ? `ĐK ${args.declarationDate}` : null,
		args.taxCode,
		args.companyName,
	].filter((part): part is string => Boolean(part));

	return parts.length > 0 ? parts.join(" | ") : null;
}

export function hasCdsDatabaseLookupContent(lookups: CdsDatabaseLookups) {
	return (
		lookups.operationCodes.length > 0 ||
		lookups.importLicenses.length > 0 ||
		lookups.permits.length > 0 ||
		lookups.permitTypes.length > 0 ||
		lookups.processingDepartments.length > 0 ||
		Object.values(lookups.fieldOptions).some(
			(options) => Array.isArray(options) && options.length > 0,
		) ||
		lookups.electronicAttachments.length > 0
	);
}

function emptyLookups(): CdsDatabaseLookups {
	return {
		operationCodes: [],
		importLicenses: [],
		permits: [],
		permitTypes: [],
		processingDepartments: [],
		fieldOptions: {},
		electronicAttachments: [],
	};
}

async function withReadonlyPool<T>(
	connectionString: string | null | undefined,
	callback: (pool: sql.ConnectionPool) => Promise<T>,
) {
	const normalizedConnectionString = clean(connectionString);
	if (!normalizedConnectionString) {
		return null;
	}
	const sqlConfig = parseMssqlConnectionString(normalizedConnectionString, {
		appName: "vvmv-cds-readonly-lookups",
		requestTimeout: 45000,
	});

	if (!sqlConfig) {
		return null;
	}

	const pool = new sql.ConnectionPool(sqlConfig);

	await pool.connect();

	try {
		await pool
			.request()
			.query(
				"SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED; SET LOCK_TIMEOUT 5000;",
			);

		return await callback(pool);
	} finally {
		await pool.close();
	}
}

async function queryRows<T extends SqlRow>(
	pool: sql.ConnectionPool,
	query: string,
) {
	const result = await pool.request().query<T>(query);
	return result.recordset ?? [];
}

type FieldOptionQueryRow = {
	value: string | null;
	label: string | null;
	address?: string | null;
	direction: string | null;
	count: number | string | null;
};

function normalizeFieldOptionDirection(
	value: unknown,
): DatabaseFieldOptionLookup["direction"] {
	return value === "import" || value === "export" || value === "unknown"
		? value
		: "unknown";
}

function mapFieldOptionRows(
	field: CdsDatabaseFieldOptionKey,
	rows: FieldOptionQueryRow[],
	source: DatabaseFieldOptionLookup["source"] = "header",
) {
	const options: DatabaseFieldOptionLookup[] = [];

	rows.forEach((row) => {
		const value = cleanCode(row.value);
		if (!value) {
			return;
		}

		options.push({
			field,
			value,
			label: clean(row.label) ?? null,
			address: clean(row.address) ?? null,
			count: toInteger(row.count) ?? 0,
			direction: normalizeFieldOptionDirection(row.direction),
			source,
		});
	});

	return options;
}

function mapSharedFieldOptionRows(
	fields: CdsDatabaseFieldOptionKey[],
	rows: FieldOptionQueryRow[],
	source: DatabaseFieldOptionLookup["source"] = "header",
) {
	const normalizedRows = rows
		.map((row) => {
			const value = cleanCode(row.value);
			if (!value) {
				return null;
			}

			return {
				value,
				label: clean(row.label),
				address: clean(row.address),
				count: toInteger(row.count) ?? 0,
				direction: normalizeFieldOptionDirection(row.direction),
			};
		})
		.filter(
			(
				row,
			): row is {
				value: string;
				label: string | null;
				address: string | null;
				count: number;
				direction: DatabaseFieldOptionLookup["direction"];
			} => row !== null,
		);

	const options: DatabaseFieldOptionLookup[] = [];

	fields.forEach((field) => {
		normalizedRows.forEach((row) => {
			options.push({
				field,
				value: row.value,
				label: row.label,
				address: row.address,
				count: row.count,
				direction: row.direction,
				source,
			});
		});
	});

	return options;
}

async function loadOperationCodes(pool: sql.ConnectionPool) {
	const rows = await queryRows<{
		code: string | null;
		name: string | null;
	}>(
		pool,
		`
SELECT
  CAST(MA_LOAI_HINH AS NVARCHAR(32)) AS code,
  CAST(TEN_LOAI_HINH AS NVARCHAR(255)) AS name
FROM dbo.SLOAIHINH WITH (NOLOCK)
WHERE
  ISNULL(CAST(MA_LOAI_HINH AS NVARCHAR(32)), '') <> ''
  AND ISNULL(CAST(TEN_LOAI_HINH AS NVARCHAR(255)), '') <> '';
`,
	);

	return rows
		.map((row) => {
			const code = cleanCode(row.code);
			const name = clean(row.name);

			if (!code || !name) {
				return null;
			}

			return {
				code,
				name,
				direction: normalizeDirectionFromOperationCode(code),
			} satisfies DatabaseOperationCodeLookup;
		})
		.filter((row): row is DatabaseOperationCodeLookup => row !== null)
		.sort((left, right) =>
			left.code.localeCompare(right.code, "en", { numeric: true }),
		);
}

async function loadPermitTypes(pool: sql.ConnectionPool) {
	const rows = await queryRows<{
		code: string | null;
		name: string | null;
	}>(
		pool,
		`
SELECT
  CAST(Ma_Loai_GP AS NVARCHAR(64)) AS code,
  CAST(
    COALESCE(
      NULLIF(CAST(Ten_Loai_GP AS NVARCHAR(512)), ''),
      NULLIF(CAST(Ten_Loai_GP1 AS NVARCHAR(512)), '')
    ) AS NVARCHAR(512)
  ) AS name
FROM dbo.SLOAI_GP WITH (NOLOCK)
WHERE ISNULL(CAST(Ma_Loai_GP AS NVARCHAR(64)), '') <> '';
`,
	);

	return rows
		.map((row) => {
			const code = cleanCode(row.code);
			const name = clean(row.name) ?? code;

			if (!code || !name) {
				return null;
			}

			return {
				code,
				name,
			} satisfies DatabasePermitTypeLookup;
		})
		.filter((row): row is DatabasePermitTypeLookup => row !== null)
		.sort((left, right) =>
			left.code.localeCompare(right.code, "en", { numeric: true }),
		);
}

function mapPermitRows(
	rows: Array<{
		permitTypeCode: string | null;
		permitTypeName: string | null;
		permitNo: string | null;
		firstDeclarationDate: Date | string | null;
		lastDeclarationDate: Date | string | null;
		declarationCount: number | string | null;
		sampleDeclarationNo: string | null;
		sampleCustomsCode: string | null;
	}>,
	options?: {
		explicitImportLicense?: boolean;
	},
) {
	const permits: DatabasePermitLookup[] = [];

	rows.forEach((row) => {
		const permitNo = clean(row.permitNo);
		if (!permitNo) {
			return;
		}

		const permitTypeCode = cleanCode(row.permitTypeCode);

		permits.push({
			id: `${permitTypeCode ?? "NO_TYPE"}::${permitNo}`,
			permitTypeCode,
			permitTypeName: clean(row.permitTypeName),
			permitNo,
			permitIssueDate: null,
			permitExpiryDate: null,
			declarationCount: toInteger(row.declarationCount),
			firstDeclarationDate: normalizeIsoDate(row.firstDeclarationDate),
			lastDeclarationDate: normalizeIsoDate(row.lastDeclarationDate),
			sampleDeclarationNo: clean(row.sampleDeclarationNo),
			sampleCustomsCode: cleanCode(row.sampleCustomsCode),
			isExplicitImportLicense: Boolean(options?.explicitImportLicense),
		});
	});

	return permits.sort((left, right) => {
		const dateCompare = (right.lastDeclarationDate ?? "").localeCompare(
			left.lastDeclarationDate ?? "",
			"en",
		);
		if (dateCompare !== 0) {
			return dateCompare;
		}

		const countCompare =
			(right.declarationCount ?? 0) - (left.declarationCount ?? 0);
		if (countCompare !== 0) {
			return countCompare;
		}

		return left.permitNo.localeCompare(right.permitNo, "en", {
			numeric: true,
		});
	});
}

async function loadImportLicenses(pool: sql.ConnectionPool) {
	const rows = await queryRows<{
		permitTypeCode: string | null;
		permitTypeName: string | null;
		permitNo: string | null;
		firstDeclarationDate: Date | string | null;
		lastDeclarationDate: Date | string | null;
		declarationCount: number | string | null;
		sampleDeclarationNo: string | null;
		sampleCustomsCode: string | null;
	}>(
		pool,
		`
SELECT TOP (200000)
  CAST(h.MA_GP AS NVARCHAR(64)) AS permitTypeCode,
  CAST(
    COALESCE(
      NULLIF(CAST(pg.Ten_Loai_GP AS NVARCHAR(512)), ''),
      NULLIF(CAST(pg.Ten_Loai_GP1 AS NVARCHAR(512)), '')
    ) AS NVARCHAR(512)
  ) AS permitTypeName,
  CAST(h.SO_GP AS NVARCHAR(128)) AS permitNo,
  MIN(h.NGAY_DK) AS firstDeclarationDate,
  MAX(h.NGAY_DK) AS lastDeclarationDate,
  COUNT(1) AS declarationCount,
  MIN(CAST(h.SOTK AS NVARCHAR(64))) AS sampleDeclarationNo,
  MIN(CAST(h.MA_HQ AS NVARCHAR(32))) AS sampleCustomsCode
FROM dbo.DTOKHAIMD h WITH (NOLOCK)
LEFT JOIN dbo.SLOAI_GP pg WITH (NOLOCK)
  ON pg.Ma_Loai_GP = h.MA_GP
WHERE
  ${HEADER_IS_IMPORT_SQL}
  AND ISNULL(CAST(h.SO_GP AS NVARCHAR(128)), '') <> ''
GROUP BY
  h.MA_GP,
  h.SO_GP,
  pg.Ten_Loai_GP,
  pg.Ten_Loai_GP1
ORDER BY MAX(h.NGAY_DK) DESC;
`,
	);

	return mapPermitRows(rows, {
		explicitImportLicense: true,
	}) satisfies DatabaseImportLicenseLookup[];
}

async function loadPermits(pool: sql.ConnectionPool) {
	const rows = await queryRows<{
		permitTypeCode: string | null;
		permitTypeName: string | null;
		permitNo: string | null;
		firstDeclarationDate: Date | string | null;
		lastDeclarationDate: Date | string | null;
		declarationCount: number | string | null;
		sampleDeclarationNo: string | null;
		sampleCustomsCode: string | null;
	}>(
		pool,
		`
SELECT TOP (200000)
  CAST(h.MA_GP AS NVARCHAR(64)) AS permitTypeCode,
  CAST(
    COALESCE(
      NULLIF(CAST(pg.Ten_Loai_GP AS NVARCHAR(512)), ''),
      NULLIF(CAST(pg.Ten_Loai_GP1 AS NVARCHAR(512)), '')
    ) AS NVARCHAR(512)
  ) AS permitTypeName,
  CAST(h.SO_GP AS NVARCHAR(128)) AS permitNo,
  MIN(h.NGAY_DK) AS firstDeclarationDate,
  MAX(h.NGAY_DK) AS lastDeclarationDate,
  COUNT(1) AS declarationCount,
  MIN(CAST(h.SOTK AS NVARCHAR(64))) AS sampleDeclarationNo,
  MIN(CAST(h.MA_HQ AS NVARCHAR(32))) AS sampleCustomsCode
FROM dbo.DTOKHAIMD h WITH (NOLOCK)
LEFT JOIN dbo.SLOAI_GP pg WITH (NOLOCK)
  ON pg.Ma_Loai_GP = h.MA_GP
WHERE ISNULL(CAST(h.SO_GP AS NVARCHAR(128)), '') <> ''
GROUP BY
  h.MA_GP,
  h.SO_GP,
  pg.Ten_Loai_GP,
  pg.Ten_Loai_GP1
ORDER BY MAX(h.NGAY_DK) DESC;
`,
	);

	return mapPermitRows(rows);
}

async function loadHeaderFieldOption(
	pool: sql.ConnectionPool,
	mapping: { field: CdsDatabaseFieldOptionKey; column: string },
) {
	const valueExpression =
		mapping.field === "exportCountryCode"
			? `CASE WHEN ${HEADER_IS_EXPORT_SQL} THEN CAST(h.NUOC_NK AS NVARCHAR(64)) ELSE CAST(h.NUOC_XK AS NVARCHAR(64)) END`
			: `CAST(h.${mapping.column} AS NVARCHAR(64))`;
	const rows = await queryRows<{
		value: string | null;
		direction: string | null;
		count: number | string | null;
	}>(
		pool,
		`
SELECT TOP (5000)
  UPPER(LTRIM(RTRIM(${valueExpression}))) AS value,
  ${HEADER_DIRECTION_CASE_SQL} AS direction,
  COUNT(1) AS count
FROM dbo.DTOKHAIMD h WITH (NOLOCK)
WHERE ISNULL(LTRIM(RTRIM(${valueExpression})), '') <> ''
GROUP BY
  UPPER(LTRIM(RTRIM(${valueExpression}))),
  ${HEADER_DIRECTION_CASE_SQL}
ORDER BY COUNT(1) DESC, value;
`,
	);

	const options: DatabaseFieldOptionLookup[] = [];

	rows.forEach((row) => {
		const value = cleanCode(row.value);
		if (!value) {
			return;
		}

		options.push({
			field: mapping.field,
			value,
			count: toInteger(row.count) ?? 0,
			direction:
				row.direction === "import" ||
				row.direction === "export" ||
				row.direction === "unknown"
					? row.direction
					: "unknown",
			source: "header",
		});
	});

	return options;
}

async function loadVnaccsFieldOption(
	pool: sql.ConnectionPool,
	mapping: { field: CdsDatabaseFieldOptionKey; column: string },
) {
	const valueExpression =
		mapping.field === "valuationDeclarationTypeCode"
			? `CASE WHEN ${HEADER_IS_EXPORT_SQL} THEN CAST(v.MA_PL_NOP_THUE AS NVARCHAR(64)) ELSE CAST(v.MA_KHAI_TRGIA AS NVARCHAR(64)) END`
			: `CAST(v.${mapping.column} AS NVARCHAR(64))`;
	const rows = await queryRows<{
		value: string | null;
		direction: string | null;
		count: number | string | null;
	}>(
		pool,
		`
SELECT TOP (5000)
  UPPER(LTRIM(RTRIM(${valueExpression}))) AS value,
  ${HEADER_DIRECTION_CASE_SQL} AS direction,
  COUNT(1) AS count
FROM dbo.DTOKHAIMD_VNACCS v WITH (NOLOCK)
INNER JOIN dbo.DTOKHAIMD h WITH (NOLOCK)
  ON h._DToKhaiMDID = v._DToKhaiMDID
WHERE ISNULL(LTRIM(RTRIM(${valueExpression})), '') <> ''
GROUP BY
  UPPER(LTRIM(RTRIM(${valueExpression}))),
  ${HEADER_DIRECTION_CASE_SQL}
ORDER BY COUNT(1) DESC, value;
`,
	);

	const options: DatabaseFieldOptionLookup[] = [];

	rows.forEach((row) => {
		const value = cleanCode(row.value);
		if (!value) {
			return;
		}

		options.push({
			field: mapping.field,
			value,
			count: toInteger(row.count) ?? 0,
			direction:
				row.direction === "import" ||
				row.direction === "export" ||
				row.direction === "unknown"
					? row.direction
					: "unknown",
			source: "vnaccs",
		});
	});

	return options;
}

async function loadVnaccs2FieldOption(
	pool: sql.ConnectionPool,
	mapping: { field: CdsDatabaseFieldOptionKey; column: string },
) {
	const rows = await queryRows<{
		value: string | null;
		direction: string | null;
		count: number | string | null;
	}>(
		pool,
		`
SELECT TOP (5000)
  UPPER(LTRIM(RTRIM(CAST(v2.${mapping.column} AS NVARCHAR(64))))) AS value,
  ${HEADER_DIRECTION_CASE_SQL} AS direction,
  COUNT(1) AS count
FROM dbo.DTOKHAIMD_VNACCS2 v2 WITH (NOLOCK)
INNER JOIN dbo.DTOKHAIMD h WITH (NOLOCK)
  ON h._DToKhaiMDID = v2._DTOKHAIMDID
WHERE ISNULL(LTRIM(RTRIM(CAST(v2.${mapping.column} AS NVARCHAR(64)))), '') <> ''
GROUP BY
  UPPER(LTRIM(RTRIM(CAST(v2.${mapping.column} AS NVARCHAR(64))))),
  ${HEADER_DIRECTION_CASE_SQL}
ORDER BY COUNT(1) DESC, value;
`,
	);

	const options: DatabaseFieldOptionLookup[] = [];

	rows.forEach((row) => {
		const value = cleanCode(row.value);
		if (!value) {
			return;
		}

		options.push({
			field: mapping.field,
			value,
			count: toInteger(row.count) ?? 0,
			direction:
				row.direction === "import" ||
				row.direction === "export" ||
				row.direction === "unknown"
					? row.direction
					: "unknown",
			source: "vnaccs",
		});
	});

	return options;
}

async function loadCorrespondingDeclarationFieldOptions(
	pool: sql.ConnectionPool,
) {
	const rows = await queryRows<{
		value: string | null;
		direction: string | null;
		declarationNumber: string | null;
		operationCode: string | null;
		declarationDate: Date | string | null;
		taxCode: string | null;
		companyName: string | null;
		count: number | string | null;
	}>(
		pool,
		`
WITH source AS (
  SELECT
    UPPER(LTRIM(RTRIM(CAST(h.SOTK_TN_TX AS NVARCHAR(64))))) AS value,
    CASE
      WHEN UPPER(LTRIM(RTRIM(CAST(h._XorN AS NVARCHAR(8))))) = 'N' THEN 'import'
      WHEN UPPER(LTRIM(RTRIM(CAST(h._XorN AS NVARCHAR(8))))) = 'X' THEN 'export'
      ELSE 'unknown'
    END AS direction,
    CAST(h.SOTK AS NVARCHAR(64)) AS declarationNumber,
    CAST(h.MA_LH AS NVARCHAR(32)) AS operationCode,
    h.NGAY_DK AS declarationDate,
    CAST(h.MA_DV AS NVARCHAR(14)) AS taxCode,
    CAST(h._Ten_DV_L1 AS NVARCHAR(255)) AS companyName,
    CAST(h._DToKhaiMDID AS BIGINT) AS declarationId
  FROM dbo.DTOKHAIMD h WITH (NOLOCK)
  WHERE ISNULL(LTRIM(RTRIM(CAST(h.SOTK_TN_TX AS NVARCHAR(64)))), '') <> ''
),
ranked AS (
  SELECT
    value,
    direction,
    declarationNumber,
    operationCode,
    declarationDate,
    taxCode,
    companyName,
    COUNT(1) OVER (PARTITION BY value, direction) AS entryCount,
    ROW_NUMBER() OVER (
      PARTITION BY value, direction
      ORDER BY COALESCE(declarationDate, '1900-01-01') DESC, declarationId DESC
    ) AS rowNumber
  FROM source
)
SELECT TOP (5000)
  value,
  direction,
  declarationNumber,
  operationCode,
  declarationDate,
  taxCode,
  companyName,
  entryCount AS count
FROM ranked
WHERE rowNumber = 1
ORDER BY
  entryCount DESC,
  COALESCE(declarationDate, '1900-01-01') DESC,
  value;
`,
	);

	const options: DatabaseFieldOptionLookup[] = [];

	rows.forEach((row) => {
		const value = cleanCode(row.value);
		if (!value) {
			return;
		}

		options.push({
			field: "correspondingDeclarationNumber",
			value,
			label: buildCorrespondingDeclarationLabel({
				declarationNumber: clean(row.declarationNumber),
				operationCode: cleanCode(row.operationCode),
				declarationDate: normalizeIsoDate(row.declarationDate),
				taxCode: cleanCode(row.taxCode),
				companyName: clean(row.companyName),
			}),
			count: toInteger(row.count) ?? 0,
			direction:
				row.direction === "import" ||
				row.direction === "export" ||
				row.direction === "unknown"
					? row.direction
					: normalizeDirectionFromXOrN(row.direction),
			source: "header",
		});
	});

	return options;
}

async function loadSharedLocationFieldOptions(pool: sql.ConnectionPool) {
	const rows = await queryRows<FieldOptionQueryRow>(
		pool,
		`
WITH
usage_source AS (
  SELECT
    UPPER(LTRIM(RTRIM(CAST(h.MA_CK AS NVARCHAR(64))))) AS value,
    ${HEADER_DIRECTION_CASE_SQL} AS direction,
    COUNT(1) AS count
  FROM dbo.DTOKHAIMD h WITH (NOLOCK)
  WHERE ISNULL(LTRIM(RTRIM(CAST(h.MA_CK AS NVARCHAR(64)))), '') <> ''
  GROUP BY
    UPPER(LTRIM(RTRIM(CAST(h.MA_CK AS NVARCHAR(64))))),
    ${HEADER_DIRECTION_CASE_SQL}

  UNION ALL

  SELECT
    UPPER(LTRIM(RTRIM(CAST(h.MA_CANGNN AS NVARCHAR(64))))) AS value,
    ${HEADER_DIRECTION_CASE_SQL} AS direction,
    COUNT(1) AS count
  FROM dbo.DTOKHAIMD h WITH (NOLOCK)
  WHERE ISNULL(LTRIM(RTRIM(CAST(h.MA_CANGNN AS NVARCHAR(64)))), '') <> ''
  GROUP BY
    UPPER(LTRIM(RTRIM(CAST(h.MA_CANGNN AS NVARCHAR(64))))),
    ${HEADER_DIRECTION_CASE_SQL}

  UNION ALL

  SELECT
    UPPER(LTRIM(RTRIM(CAST(v2.MA_DD_LUU_KHO AS NVARCHAR(64))))) AS value,
    ${HEADER_DIRECTION_CASE_SQL} AS direction,
    COUNT(1) AS count
  FROM dbo.DTOKHAIMD_VNACCS2 v2 WITH (NOLOCK)
  INNER JOIN dbo.DTOKHAIMD h WITH (NOLOCK)
    ON h._DToKhaiMDID = v2._DToKhaiMDID
  WHERE ISNULL(LTRIM(RTRIM(CAST(v2.MA_DD_LUU_KHO AS NVARCHAR(64)))), '') <> ''
  GROUP BY
    UPPER(LTRIM(RTRIM(CAST(v2.MA_DD_LUU_KHO AS NVARCHAR(64))))),
    ${HEADER_DIRECTION_CASE_SQL}
),
usage_counts AS (
  SELECT
    value,
    direction,
    SUM(count) AS count
  FROM usage_source
  GROUP BY value, direction
),
master_locations AS (
  SELECT
    UPPER(LTRIM(RTRIM(CAST(Ma_CK AS NVARCHAR(64))))) AS value,
    CAST(
      COALESCE(
        NULLIF(CAST(TEN_CK_VN AS NVARCHAR(512)), ''),
        NULLIF(CAST(TEN_CU AS NVARCHAR(512)), ''),
        NULLIF(CAST(Ten_CK1_VN AS NVARCHAR(512)), ''),
        NULLIF(CAST(Ten_CK1 AS NVARCHAR(512)), ''),
        NULLIF(CAST(Ten_CK AS NVARCHAR(512)), '')
      ) AS NVARCHAR(512)
    ) AS label,
    CAST('unknown' AS NVARCHAR(16)) AS direction,
    CAST(0 AS INT) AS count
  FROM dbo.SCUAKHAU WITH (NOLOCK)
  WHERE
    ISNULL(LTRIM(RTRIM(CAST(Ma_CK AS NVARCHAR(64)))), '') <> ''
    AND ISNULL(HienThi, -1) <> 0

  UNION ALL

  SELECT
    UPPER(LTRIM(RTRIM(CAST(MA_CK AS NVARCHAR(64))))) AS value,
    CAST(
      COALESCE(
        NULLIF(CAST(TEN_CK_VN AS NVARCHAR(512)), ''),
        NULLIF(CAST(TEN_CU AS NVARCHAR(512)), ''),
        NULLIF(CAST(TEN_CK1_VN AS NVARCHAR(512)), ''),
        NULLIF(CAST(TEN_CK1 AS NVARCHAR(512)), ''),
        NULLIF(CAST(TEN_CK AS NVARCHAR(512)), '')
      ) AS NVARCHAR(512)
    ) AS label,
    CAST('unknown' AS NVARCHAR(16)) AS direction,
    CAST(0 AS INT) AS count
  FROM dbo.SCUAKHAUNN WITH (NOLOCK)
  WHERE
    ISNULL(LTRIM(RTRIM(CAST(MA_CK AS NVARCHAR(64)))), '') <> ''
    AND ISNULL(HienThi, -1) <> 0

  UNION ALL

  SELECT
    UPPER(LTRIM(RTRIM(CAST(MA_DIA_DIEM AS NVARCHAR(64))))) AS value,
    CAST(
      COALESCE(
        NULLIF(CAST(TEN_DIA_DIEM_VN AS NVARCHAR(512)), ''),
        NULLIF(CAST(TEN_DIA_DIEM_TCVN_VN AS NVARCHAR(512)), ''),
        NULLIF(CAST(TEN_DIA_DIEM_TCVN AS NVARCHAR(512)), ''),
        NULLIF(CAST(TEN_DIA_DIEM AS NVARCHAR(512)), '')
      ) AS NVARCHAR(512)
    ) AS label,
    CAST('unknown' AS NVARCHAR(16)) AS direction,
    CAST(0 AS INT) AS count
  FROM dbo.SDIA_DIEM WITH (NOLOCK)
  WHERE
    ISNULL(LTRIM(RTRIM(CAST(MA_DIA_DIEM AS NVARCHAR(64)))), '') <> ''
    AND ISNULL(HIENTHI, -1) <> 0
),
location_options AS (
SELECT
  usage_counts.value,
  COALESCE(domesticPort.label, foreignPort.label, locationPlace.label) AS label,
  usage_counts.direction,
  usage_counts.count
FROM usage_counts
OUTER APPLY (
  SELECT TOP (1)
    CAST(
      COALESCE(
        NULLIF(CAST(TEN_CK_VN AS NVARCHAR(512)), ''),
        NULLIF(CAST(TEN_CU AS NVARCHAR(512)), ''),
        NULLIF(CAST(Ten_CK1_VN AS NVARCHAR(512)), ''),
        NULLIF(CAST(Ten_CK1 AS NVARCHAR(512)), ''),
        NULLIF(CAST(Ten_CK AS NVARCHAR(512)), '')
      ) AS NVARCHAR(512)
    ) AS label
  FROM dbo.SCUAKHAU WITH (NOLOCK)
  WHERE
    UPPER(LTRIM(RTRIM(CAST(Ma_CK AS NVARCHAR(64))))) = usage_counts.value
    AND ISNULL(HienThi, -1) <> 0
) domesticPort
OUTER APPLY (
  SELECT TOP (1)
    CAST(
      COALESCE(
        NULLIF(CAST(TEN_CK_VN AS NVARCHAR(512)), ''),
        NULLIF(CAST(TEN_CU AS NVARCHAR(512)), ''),
        NULLIF(CAST(TEN_CK1_VN AS NVARCHAR(512)), ''),
        NULLIF(CAST(TEN_CK1 AS NVARCHAR(512)), ''),
        NULLIF(CAST(TEN_CK AS NVARCHAR(512)), '')
      ) AS NVARCHAR(512)
    ) AS label
  FROM dbo.SCUAKHAUNN WITH (NOLOCK)
  WHERE
    UPPER(LTRIM(RTRIM(CAST(MA_CK AS NVARCHAR(64))))) = usage_counts.value
    AND ISNULL(HienThi, -1) <> 0
) foreignPort
OUTER APPLY (
  SELECT TOP (1)
    CAST(
      COALESCE(
        NULLIF(CAST(TEN_DIA_DIEM_VN AS NVARCHAR(512)), ''),
        NULLIF(CAST(TEN_DIA_DIEM_TCVN_VN AS NVARCHAR(512)), ''),
        NULLIF(CAST(TEN_DIA_DIEM_TCVN AS NVARCHAR(512)), ''),
        NULLIF(CAST(TEN_DIA_DIEM AS NVARCHAR(512)), '')
      ) AS NVARCHAR(512)
    ) AS label
  FROM dbo.SDIA_DIEM WITH (NOLOCK)
  WHERE
    UPPER(LTRIM(RTRIM(CAST(MA_DIA_DIEM AS NVARCHAR(64))))) = usage_counts.value
    AND ISNULL(HIENTHI, -1) <> 0
) locationPlace
  UNION ALL

  SELECT
    value,
    label,
    direction,
    count
  FROM master_locations
)
SELECT
  value,
  MAX(label) AS label,
  direction,
  MAX(count) AS count
FROM location_options
GROUP BY value, direction
ORDER BY MAX(count) DESC, value;
`,
	);

	return mapSharedFieldOptionRows(
		[
			"loadingLocationCode",
			"unloadingLocationCode",
			"warehouseLocationCode",
			"customsWarehouseCode",
			"finalDestinationCode",
			"taxDestinationLocation",
		],
		rows,
		"header",
	);
}

async function loadTruckLoadingLocationFieldOptions(pool: sql.ConnectionPool) {
	const rows = await queryRows<FieldOptionQueryRow>(
		pool,
		`
WITH usage_source AS (
  SELECT
    UPPER(LTRIM(RTRIM(CAST(v.MA_DIEM_XEP_HANG_LEN_XE AS NVARCHAR(64))))) AS value,
    NULLIF(LTRIM(RTRIM(CAST(v.DIA_CHI_DIEM_XEP_HANG_LEN_XE AS NVARCHAR(300)))), '') AS address,
    v._DToKhaiMDID AS row_id,
    CAST(1 AS INT) AS slot
  FROM dbo.DTOKHAIMD_VNACCS v WITH (NOLOCK)
  WHERE ISNULL(LTRIM(RTRIM(CAST(v.MA_DIEM_XEP_HANG_LEN_XE AS NVARCHAR(64)))), '') <> ''

  UNION ALL

  SELECT
    UPPER(LTRIM(RTRIM(CAST(v.MA_DIEM_XEP_HANG_LEN_XE2 AS NVARCHAR(64))))) AS value,
    CAST(NULL AS NVARCHAR(300)) AS address,
    v._DToKhaiMDID AS row_id,
    CAST(2 AS INT) AS slot
  FROM dbo.DTOKHAIMD_VNACCS v WITH (NOLOCK)
  WHERE ISNULL(LTRIM(RTRIM(CAST(v.MA_DIEM_XEP_HANG_LEN_XE2 AS NVARCHAR(64)))), '') <> ''

  UNION ALL

  SELECT
    UPPER(LTRIM(RTRIM(CAST(v.MA_DIEM_XEP_HANG_LEN_XE3 AS NVARCHAR(64))))) AS value,
    CAST(NULL AS NVARCHAR(300)) AS address,
    v._DToKhaiMDID AS row_id,
    CAST(3 AS INT) AS slot
  FROM dbo.DTOKHAIMD_VNACCS v WITH (NOLOCK)
  WHERE ISNULL(LTRIM(RTRIM(CAST(v.MA_DIEM_XEP_HANG_LEN_XE3 AS NVARCHAR(64)))), '') <> ''

  UNION ALL

  SELECT
    UPPER(LTRIM(RTRIM(CAST(v.MA_DIEM_XEP_HANG_LEN_XE4 AS NVARCHAR(64))))) AS value,
    CAST(NULL AS NVARCHAR(300)) AS address,
    v._DToKhaiMDID AS row_id,
    CAST(4 AS INT) AS slot
  FROM dbo.DTOKHAIMD_VNACCS v WITH (NOLOCK)
  WHERE ISNULL(LTRIM(RTRIM(CAST(v.MA_DIEM_XEP_HANG_LEN_XE4 AS NVARCHAR(64)))), '') <> ''

  UNION ALL

  SELECT
    UPPER(LTRIM(RTRIM(CAST(v.MA_DIEM_XEP_HANG_LEN_XE5 AS NVARCHAR(64))))) AS value,
    CAST(NULL AS NVARCHAR(300)) AS address,
    v._DToKhaiMDID AS row_id,
    CAST(5 AS INT) AS slot
  FROM dbo.DTOKHAIMD_VNACCS v WITH (NOLOCK)
  WHERE ISNULL(LTRIM(RTRIM(CAST(v.MA_DIEM_XEP_HANG_LEN_XE5 AS NVARCHAR(64)))), '') <> ''
),
usage_counts AS (
  SELECT value, COUNT(1) AS count
  FROM usage_source
  GROUP BY value
),
latest_address AS (
  SELECT value, address
  FROM (
    SELECT
      value,
      address,
      ROW_NUMBER() OVER (
        PARTITION BY value
        ORDER BY row_id DESC, slot ASC
      ) AS rn
    FROM usage_source
    WHERE address IS NOT NULL
  ) ranked_addresses
  WHERE rn = 1
),
master_location_rows AS (
  SELECT
    CAST(1 AS INT) AS priority,
    UPPER(LTRIM(RTRIM(CAST(MA_DIA_DIEM AS NVARCHAR(64))))) AS value,
    CAST(
      COALESCE(
        NULLIF(CAST(TEN_DIA_DIEM_VN AS NVARCHAR(512)), ''),
        NULLIF(CAST(TEN_DIA_DIEM_TCVN_VN AS NVARCHAR(512)), ''),
        NULLIF(CAST(TEN_DIA_DIEM_TCVN AS NVARCHAR(512)), ''),
        NULLIF(CAST(TEN_DIA_DIEM AS NVARCHAR(512)), '')
      ) AS NVARCHAR(512)
    ) AS label,
    NULLIF(LTRIM(RTRIM(CAST(DIA_CHI AS NVARCHAR(300)))), '') AS address,
    CAST(0 AS INT) AS count
  FROM dbo.SDIA_DIEM WITH (NOLOCK)
  WHERE
    ISNULL(LTRIM(RTRIM(CAST(MA_DIA_DIEM AS NVARCHAR(64)))), '') <> ''
    AND ISNULL(HIENTHI, -1) <> 0

  UNION ALL

  SELECT
    CAST(2 AS INT) AS priority,
    UPPER(LTRIM(RTRIM(CAST(MA_CK AS NVARCHAR(64))))) AS value,
    CAST(
      COALESCE(
        NULLIF(CAST(TEN_CK_VN AS NVARCHAR(512)), ''),
        NULLIF(CAST(TEN_CU AS NVARCHAR(512)), ''),
        NULLIF(CAST(TEN_CK1_VN AS NVARCHAR(512)), ''),
        NULLIF(CAST(TEN_CK1 AS NVARCHAR(512)), ''),
        NULLIF(CAST(TEN_CK AS NVARCHAR(512)), '')
      ) AS NVARCHAR(512)
    ) AS label,
    CAST(NULL AS NVARCHAR(300)) AS address,
    CAST(0 AS INT) AS count
  FROM dbo.SCUAKHAUNN WITH (NOLOCK)
  WHERE
    ISNULL(LTRIM(RTRIM(CAST(MA_CK AS NVARCHAR(64)))), '') <> ''
    AND ISNULL(HienThi, -1) <> 0
    AND UPPER(LTRIM(RTRIM(CAST(ItemType AS NVARCHAR(50))))) IN (
      'CK_DUONGBO',
      'CUAKHAU_VN',
      'DUONG_BO'
    )
),
master_locations AS (
  SELECT value, label, address, count
  FROM (
    SELECT
      value,
      label,
      address,
      count,
      ROW_NUMBER() OVER (
        PARTITION BY value
        ORDER BY priority ASC
      ) AS rn
    FROM master_location_rows
  ) ranked_locations
  WHERE rn = 1
),
combined AS (
  SELECT
    master_locations.value,
    master_locations.label,
    COALESCE(
      CASE
        WHEN master_locations.address LIKE N'Mã tạm%' THEN NULL
        ELSE master_locations.address
      END,
      latest_address.address
    ) AS address,
    master_locations.count
  FROM master_locations
  LEFT JOIN latest_address
    ON latest_address.value = master_locations.value

  UNION ALL

  SELECT
    usage_counts.value,
    master_locations.label,
    COALESCE(
      CASE
        WHEN master_locations.address LIKE N'Mã tạm%' THEN NULL
        ELSE master_locations.address
      END,
      latest_address.address
    ) AS address,
    usage_counts.count
  FROM usage_counts
  LEFT JOIN master_locations
    ON master_locations.value = usage_counts.value
  LEFT JOIN latest_address
    ON latest_address.value = usage_counts.value
)
SELECT
  value,
  MAX(label) AS label,
  MAX(address) AS address,
  CAST('unknown' AS NVARCHAR(16)) AS direction,
  MAX(count) AS count
FROM combined
GROUP BY value
ORDER BY MAX(count) DESC, value;
`,
	);

	return mapFieldOptionRows("truckLoadingLocationCode", rows, "header");
}

async function loadSharedBankFieldOptions(pool: sql.ConnectionPool) {
	const rows = await queryRows<FieldOptionQueryRow>(
		pool,
		`
WITH bank_master AS (
  SELECT
    UPPER(LTRIM(RTRIM(CAST(MA_NH AS NVARCHAR(64))))) AS code,
    CAST(
      COALESCE(
        NULLIF(CAST(TEN_NH1 AS NVARCHAR(512)), ''),
        NULLIF(CAST(TEN_NH AS NVARCHAR(512)), '')
      ) AS NVARCHAR(512)
    ) AS label
  FROM dbo.SNGAN_HANG WITH (NOLOCK)
  WHERE ISNULL(LTRIM(RTRIM(CAST(MA_NH AS NVARCHAR(64)))), '') <> ''
),
usage_source AS (
  SELECT
    UPPER(LTRIM(RTRIM(CAST(h.DAM_BAO_MA_NG_HANG AS NVARCHAR(64))))) AS value,
    ${HEADER_DIRECTION_CASE_SQL} AS direction,
    COUNT(1) AS count
  FROM dbo.DTOKHAIMD h WITH (NOLOCK)
  WHERE ISNULL(LTRIM(RTRIM(CAST(h.DAM_BAO_MA_NG_HANG AS NVARCHAR(64)))), '') <> ''
  GROUP BY
    UPPER(LTRIM(RTRIM(CAST(h.DAM_BAO_MA_NG_HANG AS NVARCHAR(64))))),
    ${HEADER_DIRECTION_CASE_SQL}

  UNION ALL

  SELECT
    UPPER(LTRIM(RTRIM(CAST(v2.BL_THUE_MA_NG_HANG AS NVARCHAR(64))))) AS value,
    ${HEADER_DIRECTION_CASE_SQL} AS direction,
    COUNT(1) AS count
  FROM dbo.DTOKHAIMD_VNACCS2 v2 WITH (NOLOCK)
  INNER JOIN dbo.DTOKHAIMD h WITH (NOLOCK)
    ON h._DToKhaiMDID = v2._DToKhaiMDID
  WHERE ISNULL(LTRIM(RTRIM(CAST(v2.BL_THUE_MA_NG_HANG AS NVARCHAR(64)))), '') <> ''
  GROUP BY
    UPPER(LTRIM(RTRIM(CAST(v2.BL_THUE_MA_NG_HANG AS NVARCHAR(64))))),
    ${HEADER_DIRECTION_CASE_SQL}
),
usage_counts AS (
  SELECT
    value,
    direction,
    SUM(count) AS count
  FROM usage_source
  GROUP BY value, direction
)
SELECT
  result.value,
  result.label,
  result.direction,
  result.count
FROM (
  SELECT
    usage_counts.value,
    bank_master.label,
    usage_counts.direction,
    usage_counts.count
  FROM usage_counts
  LEFT JOIN bank_master
    ON bank_master.code = usage_counts.value

  UNION ALL

  SELECT
    bank_master.code AS value,
    bank_master.label,
    'unknown' AS direction,
    0 AS count
  FROM bank_master
  WHERE NOT EXISTS (
    SELECT 1
    FROM usage_counts
    WHERE usage_counts.value = bank_master.code
  )
) result
ORDER BY result.count DESC, result.value;
`,
	);

	return mapSharedFieldOptionRows(
		["taxSubstituteBankCode", "guaranteeBankCode"],
		rows,
		"header",
	);
}

async function loadTransportVehicleFieldOptions(pool: sql.ConnectionPool) {
	const rows = await queryRows<FieldOptionQueryRow>(
		pool,
		`
SELECT TOP (5000)
  UPPER(LTRIM(RTRIM(CAST(h.MA_PTVT AS NVARCHAR(64))))) AS value,
  NULLIF(LTRIM(RTRIM(CAST(h.TEN_PTVT AS NVARCHAR(255)))), '') AS label,
  ${HEADER_DIRECTION_CASE_SQL} AS direction,
  COUNT(1) AS count
FROM dbo.DTOKHAIMD h WITH (NOLOCK)
WHERE ISNULL(LTRIM(RTRIM(CAST(h.MA_PTVT AS NVARCHAR(64)))), '') <> ''
GROUP BY
  UPPER(LTRIM(RTRIM(CAST(h.MA_PTVT AS NVARCHAR(64))))),
  NULLIF(LTRIM(RTRIM(CAST(h.TEN_PTVT AS NVARCHAR(255)))), ''),
  ${HEADER_DIRECTION_CASE_SQL}
ORDER BY COUNT(1) DESC, value, label;
`,
	);

	return mapFieldOptionRows("transportVehicleCode", rows, "header");
}

async function loadProcessingDepartments(pool: sql.ConnectionPool) {
	const rows = await queryRows<{
		code: string | null;
		customsCode: string | null;
		name: string | null;
		operationCodes: string | null;
		ida: number | null;
		eda: number | null;
	}>(
		pool,
		`
SELECT
  UPPER(LTRIM(RTRIM(CAST(s.MA AS NVARCHAR(32))))) AS code,
  UPPER(LTRIM(RTRIM(CAST(s.MA_HQ AS NVARCHAR(32))))) AS customsCode,
  CAST(
    COALESCE(
      NULLIF(CAST(s.TEN_TCVN AS NVARCHAR(512)), ''),
      NULLIF(CAST(s.TEN AS NVARCHAR(512)), '')
    ) AS NVARCHAR(512)
  ) AS name,
  CAST(s.MA_LH_XLY AS NVARCHAR(512)) AS operationCodes,
  CASE WHEN s.IDA = 1 THEN 1 ELSE 0 END AS ida,
  CASE WHEN s.EDA = 1 THEN 1 ELSE 0 END AS eda
FROM dbo.SHAIQUAN_Sub s WITH (NOLOCK)
WHERE
  ISNULL(LTRIM(RTRIM(CAST(s.MA AS NVARCHAR(32)))), '') <> ''
  AND ISNULL(LTRIM(RTRIM(CAST(s.MA_HQ AS NVARCHAR(32)))), '') <> ''
  AND ISNULL(s.HienThi, -1) <> 0
ORDER BY
  UPPER(LTRIM(RTRIM(CAST(s.MA_HQ AS NVARCHAR(32))))),
  UPPER(LTRIM(RTRIM(CAST(s.MA AS NVARCHAR(32)))));
`,
	);

	return rows
		.map((row) => {
			const code = cleanCode(row.code);
			const customsCode = cleanCode(row.customsCode);

			if (!code || !customsCode) {
				return null;
			}

			return {
				code,
				customsCode,
				name: clean(row.name),
				operationCodes: normalizeProcessingDepartmentOperationCodes(
					clean(row.operationCodes),
				),
				allowImport: row.ida === 1,
				allowExport: row.eda === 1,
			} satisfies ProcessingDepartmentLookup;
		})
		.filter((row): row is ProcessingDepartmentLookup => row !== null);
}

/**
 * Load Vietnamese labels from ECUS reference/catalog tables.
 * Returns a map of field → { code → label }.
 */
async function loadReferenceLabelMaps(pool: sql.ConnectionPool) {
	type LabelMap = Map<string, string>;

	const fieldLabelMaps: Partial<Record<CdsDatabaseFieldOptionKey, LabelMap>> =
		{};

	const setLabelMap = (fields: CdsDatabaseFieldOptionKey[], map: LabelMap) => {
		for (const field of fields) {
			fieldLabelMaps[field] = map;
		}
	};

	try {
		// ── Price condition labels from SPTVT ──
		const priceConditionRows = await queryRows<{
			code: string | null;
			name: string | null;
		}>(
			pool,
			`SELECT UPPER(LTRIM(RTRIM(CAST(MA_PTVT AS NVARCHAR(32))))) AS code,
              CAST(TEN_PTVT AS NVARCHAR(255)) AS name
       FROM dbo.SPTVT WITH (NOLOCK)
       WHERE ISNULL(CAST(MA_PTVT AS NVARCHAR(32)), '') <> ''`,
		);
		const priceConditionMap: LabelMap = new Map();
		for (const row of priceConditionRows) {
			const code = cleanCode(row.code);
			const name = clean(row.name);
			if (code && name) priceConditionMap.set(code, name);
		}
		setLabelMap(["transportVehicleCode"], priceConditionMap);
	} catch (error) {
		console.warn("Failed to load reference label maps:", error);
	}

	// ── Static fallback labels for codes not found in database ──
	const staticLabels: Partial<
		Record<CdsDatabaseFieldOptionKey, Record<string, string>>
	> = {
		...VNACCS_STANDARD_FIELD_LABELS,
		releaseBeforePermitCode: {
			...CDS_RELEASE_BEFORE_PERMIT_LABELS,
		},
		taxPayer: {
			...CDS_TAX_PAYER_LABELS,
		},
		taxPaymentDeadlineCode: {
			...CDS_TAX_PAYMENT_DEADLINE_LABELS,
		},
	};

	for (const [field, labels] of Object.entries(staticLabels)) {
		const key = field as CdsDatabaseFieldOptionKey;
		if (!fieldLabelMaps[key]) {
			const map: LabelMap = new Map();
			for (const [code, label] of Object.entries(labels)) {
				map.set(code.toUpperCase(), label);
			}
			fieldLabelMaps[key] = map;
		}
	}

	return fieldLabelMaps;
}

export function seedReferenceFieldOptions(
	fieldOptions: Partial<
		Record<CdsDatabaseFieldOptionKey, DatabaseFieldOptionLookup[]>
	>,
	labelMaps: LookupLabelMaps,
) {
	const seeded: Partial<
		Record<CdsDatabaseFieldOptionKey, DatabaseFieldOptionLookup[]>
	> = { ...fieldOptions };

	(
		Object.entries(REFERENCE_FIELD_OPTION_SOURCES) as Array<
			[
				CdsDatabaseFieldOptionKey,
				DatabaseFieldOptionLookup["source"] | undefined,
			]
		>
	).forEach(([fieldKey, source]) => {
		const labelMap = labelMaps[fieldKey];

		if (!source || !labelMap || labelMap.size === 0) {
			return;
		}

		const bucket = new Map<string, DatabaseFieldOptionLookup>();

		(seeded[fieldKey] ?? []).forEach((option) => {
			const normalizedValue = cleanCode(option.value);
			if (!normalizedValue) {
				return;
			}

			bucket.set(`${option.direction}::${normalizedValue}`, {
				...option,
				value: normalizedValue,
			});
		});

		labelMap.forEach((label, code) => {
			const normalizedCode = cleanCode(code);
			if (!normalizedCode) {
				return;
			}

			const lookupKey = `unknown::${normalizedCode}`;
			const existing = bucket.get(lookupKey);

			if (existing) {
				if (!existing.label && label) {
					bucket.set(lookupKey, {
						...existing,
						label,
					});
				}
				return;
			}

			bucket.set(lookupKey, {
				field: fieldKey,
				value: normalizedCode,
				label,
				count: 0,
				direction: "unknown",
				source,
			});
		});

		seeded[fieldKey] = [...bucket.values()];
	});

	return seeded;
}

async function loadFieldOptions(pool: sql.ConnectionPool) {
	const [rawResults, labelMaps] = await Promise.all([
		Promise.all([
			...HEADER_FIELD_OPTION_MAPPINGS.map((mapping) =>
				loadHeaderFieldOption(pool, mapping),
			),
			...VNACCS_FIELD_OPTION_MAPPINGS.map((mapping) =>
				loadVnaccsFieldOption(pool, mapping),
			),
			...VNACCS2_FIELD_OPTION_MAPPINGS.map((mapping) =>
				loadVnaccs2FieldOption(pool, mapping),
			),
			loadCorrespondingDeclarationFieldOptions(pool),
			loadSharedLocationFieldOptions(pool),
			loadTruckLoadingLocationFieldOptions(pool),
			loadSharedBankFieldOptions(pool),
			loadTransportVehicleFieldOptions(pool),
		]),
		loadReferenceLabelMaps(pool),
	]);

	const merged: Partial<
		Record<CdsDatabaseFieldOptionKey, DatabaseFieldOptionLookup[]>
	> = {};

	rawResults.flat().forEach((option) => {
		// Attach label from reference table if available
		const labelMap = labelMaps[option.field];
		if (labelMap) {
			const label = labelMap.get(option.value.toUpperCase());
			if (label) {
				option.label = label;
			}
		}

		const current = merged[option.field] ?? [];
		current.push(option);
		merged[option.field] = current;
	});

	const seeded = seedReferenceFieldOptions(merged, labelMaps);

	Object.keys(seeded).forEach((fieldKey) => {
		const options = (
			seeded[fieldKey as CdsDatabaseFieldOptionKey] ?? []
		).filter((option) =>
			isAllowedVnaccsStandardFieldValue(
				fieldKey as CdsDatabaseFieldOptionKey,
				option.value,
			),
		);

		seeded[fieldKey as CdsDatabaseFieldOptionKey] = options.sort(
			(left, right) => {
				if (right.count !== left.count) {
					return right.count - left.count;
				}

				if (left.direction !== right.direction) {
					return left.direction.localeCompare(right.direction, "en");
				}

				return left.value.localeCompare(right.value, "en", {
					numeric: true,
				});
			},
		);
	});

	return seeded;
}

async function loadElectronicAttachments(pool: sql.ConnectionPool) {
	const rows = await queryRows<{
		attachmentTypeCode: string | null;
		attachmentNumber: string | null;
		attachmentDescription: string | null;
		count: number | string | null;
	}>(
		pool,
		`
WITH attachment_pairs AS (
  SELECT
    UPPER(LTRIM(RTRIM(CAST(MA_LOAI_DINH_KEM AS NVARCHAR(64))))) AS attachmentTypeCode,
    CAST(NULLIF(LTRIM(RTRIM(CAST(SO_DINH_KEM AS NVARCHAR(128)))), '') AS NVARCHAR(128)) AS attachmentNumber
  FROM dbo.DTOKHAIMD_VNACCS WITH (NOLOCK)
  UNION ALL
  SELECT
    UPPER(LTRIM(RTRIM(CAST(MA_LOAI_DINH_KEM2 AS NVARCHAR(64))))) AS attachmentTypeCode,
    CAST(NULLIF(LTRIM(RTRIM(CAST(SO_DINH_KEM2 AS NVARCHAR(128)))), '') AS NVARCHAR(128)) AS attachmentNumber
  FROM dbo.DTOKHAIMD_VNACCS WITH (NOLOCK)
  UNION ALL
  SELECT
    UPPER(LTRIM(RTRIM(CAST(MA_LOAI_DINH_KEM3 AS NVARCHAR(64))))) AS attachmentTypeCode,
    CAST(NULLIF(LTRIM(RTRIM(CAST(SO_DINH_KEM3 AS NVARCHAR(128)))), '') AS NVARCHAR(128)) AS attachmentNumber
  FROM dbo.DTOKHAIMD_VNACCS WITH (NOLOCK)
),
derived_attachment_numbers AS (
  SELECT 'INV' AS attachmentTypeCode,
    CAST(NULLIF(LTRIM(RTRIM(CAST(h.SO_HDTM AS NVARCHAR(255)))), '') AS NVARCHAR(255)) AS attachmentNumber
  FROM dbo.DTOKHAIMD h WITH (NOLOCK)
  UNION ALL
  SELECT 'CON' AS attachmentTypeCode,
    CAST(NULLIF(LTRIM(RTRIM(CAST(h.SO_HD AS NVARCHAR(255)))), '') AS NVARCHAR(255)) AS attachmentNumber
  FROM dbo.DTOKHAIMD h WITH (NOLOCK)
  UNION ALL
  SELECT 'INS' AS attachmentTypeCode,
    CAST(NULLIF(LTRIM(RTRIM(CAST(h.SO_DK_PHI_BH AS NVARCHAR(255)))), '') AS NVARCHAR(255)) AS attachmentNumber
  FROM dbo.DTOKHAIMD h WITH (NOLOCK)
  UNION ALL
  SELECT 'BOL' AS attachmentTypeCode,
    CAST(NULLIF(LTRIM(RTRIM(CAST(h.VAN_DON AS NVARCHAR(255)))), '') AS NVARCHAR(255)) AS attachmentNumber
  FROM dbo.DTOKHAIMD h WITH (NOLOCK)
  UNION ALL
  SELECT 'BOL' AS attachmentTypeCode,
    CAST(NULLIF(LTRIM(RTRIM(CAST(v2.VAN_DON2 AS NVARCHAR(255)))), '') AS NVARCHAR(255)) AS attachmentNumber
  FROM dbo.DTOKHAIMD_VNACCS2 v2 WITH (NOLOCK)
  UNION ALL
  SELECT 'BOL' AS attachmentTypeCode,
    CAST(NULLIF(LTRIM(RTRIM(CAST(v2.VAN_DON3 AS NVARCHAR(255)))), '') AS NVARCHAR(255)) AS attachmentNumber
  FROM dbo.DTOKHAIMD_VNACCS2 v2 WITH (NOLOCK)
  UNION ALL
  SELECT 'BOL' AS attachmentTypeCode,
    CAST(NULLIF(LTRIM(RTRIM(CAST(v2.VAN_DON4 AS NVARCHAR(255)))), '') AS NVARCHAR(255)) AS attachmentNumber
  FROM dbo.DTOKHAIMD_VNACCS2 v2 WITH (NOLOCK)
  UNION ALL
  SELECT 'BOL' AS attachmentTypeCode,
    CAST(NULLIF(LTRIM(RTRIM(CAST(v2.VAN_DON5 AS NVARCHAR(255)))), '') AS NVARCHAR(255)) AS attachmentNumber
  FROM dbo.DTOKHAIMD_VNACCS2 v2 WITH (NOLOCK)
  UNION ALL
  SELECT 'BOL' AS attachmentTypeCode,
    CAST(NULLIF(LTRIM(RTRIM(CAST(v2.VAN_DON_MAWB AS NVARCHAR(255)))), '') AS NVARCHAR(255)) AS attachmentNumber
  FROM dbo.DTOKHAIMD_VNACCS2 v2 WITH (NOLOCK)
  UNION ALL
  SELECT 'BOL' AS attachmentTypeCode,
    CAST(NULLIF(LTRIM(RTRIM(CAST(v2.VAN_DON_MAWB2 AS NVARCHAR(255)))), '') AS NVARCHAR(255)) AS attachmentNumber
  FROM dbo.DTOKHAIMD_VNACCS2 v2 WITH (NOLOCK)
  UNION ALL
  SELECT 'BOL' AS attachmentTypeCode,
    CAST(NULLIF(LTRIM(RTRIM(CAST(v2.VAN_DON_MAWB3 AS NVARCHAR(255)))), '') AS NVARCHAR(255)) AS attachmentNumber
  FROM dbo.DTOKHAIMD_VNACCS2 v2 WITH (NOLOCK)
  UNION ALL
  SELECT 'BOL' AS attachmentTypeCode,
    CAST(NULLIF(LTRIM(RTRIM(CAST(v2.VAN_DON_MAWB4 AS NVARCHAR(255)))), '') AS NVARCHAR(255)) AS attachmentNumber
  FROM dbo.DTOKHAIMD_VNACCS2 v2 WITH (NOLOCK)
  UNION ALL
  SELECT 'BOL' AS attachmentTypeCode,
    CAST(NULLIF(LTRIM(RTRIM(CAST(v2.VAN_DON_MAWB5 AS NVARCHAR(255)))), '') AS NVARCHAR(255)) AS attachmentNumber
  FROM dbo.DTOKHAIMD_VNACCS2 v2 WITH (NOLOCK)
),
attachment_candidates AS (
  SELECT attachmentTypeCode, attachmentNumber
  FROM attachment_pairs
  UNION ALL
  SELECT attachmentTypeCode, attachmentNumber
  FROM derived_attachment_numbers
),
attachment_descriptions AS (
  SELECT
    UPPER(LTRIM(RTRIM(CAST(LOAI_CT AS NVARCHAR(64))))) AS attachmentTypeCode,
    MAX(CAST(NULLIF(DIENGIAI, '') AS NVARCHAR(255))) AS attachmentDescription
  FROM dbo.DCHUNGTU_BS WITH (NOLOCK)
  WHERE ISNULL(LTRIM(RTRIM(CAST(LOAI_CT AS NVARCHAR(64)))), '') <> ''
  GROUP BY UPPER(LTRIM(RTRIM(CAST(LOAI_CT AS NVARCHAR(64)))))
),
grouped_candidates AS (
  SELECT
    p.attachmentTypeCode,
    p.attachmentNumber,
    d.attachmentDescription,
    COUNT(1) AS count
  FROM attachment_candidates p
  LEFT JOIN attachment_descriptions d
    ON d.attachmentTypeCode = p.attachmentTypeCode
  WHERE ISNULL(p.attachmentTypeCode, '') <> ''
    AND ISNULL(p.attachmentNumber, '') <> ''
  GROUP BY p.attachmentTypeCode, p.attachmentNumber, d.attachmentDescription
),
ranked_candidates AS (
  SELECT
    attachmentTypeCode,
    attachmentNumber,
    attachmentDescription,
    count,
    ROW_NUMBER() OVER (
      PARTITION BY attachmentTypeCode
      ORDER BY count DESC, attachmentNumber
    ) AS rowNumber
  FROM grouped_candidates
)
SELECT
  attachmentTypeCode,
  attachmentNumber,
  attachmentDescription,
  count
FROM ranked_candidates
WHERE rowNumber <= 1000
ORDER BY attachmentTypeCode, count DESC, attachmentNumber;
`,
	);

	const options: DatabaseElectronicAttachmentLookup[] = [];

	rows.forEach((row) => {
		const attachmentTypeCode = cleanCode(row.attachmentTypeCode);
		if (!attachmentTypeCode) {
			return;
		}

		const attachmentNumber = clean(row.attachmentNumber);

		if (
			attachmentNumber &&
			!isUsableCdsElectronicAttachmentNumber(
				attachmentTypeCode,
				attachmentNumber,
			)
		) {
			return;
		}

		options.push({
			attachmentTypeCode,
			attachmentNumber,
			attachmentDescription:
				getCdsElectronicAttachmentTypeDescription(attachmentTypeCode) ??
				clean(row.attachmentDescription) ??
				prettifyAttachmentDescription(attachmentTypeCode),
			count: toInteger(row.count) ?? 0,
		});
	});

	return options;
}

export async function getLiveCdsDatabaseLookups(options?: {
	connectionString?: string | null;
}) {
	const connectionString = clean(options?.connectionString);
	if (!connectionString) {
		return emptyLookups();
	}

	const now = Date.now();
	const cached = globalForLiveLookups.cdsLiveLookupsCache;

	if (
		cached &&
		cached.connectionKey === connectionString &&
		cached.expiresAt > now
	) {
		return cached.promise;
	}

	const promise = withReadonlyPool(connectionString, async (pool) => {
		const [
			operationCodes,
			importLicenses,
			permits,
			permitTypes,
			processingDepartments,
			fieldOptions,
			electronicAttachments,
		] = await Promise.all([
			loadOperationCodes(pool),
			loadImportLicenses(pool),
			loadPermits(pool),
			loadPermitTypes(pool),
			loadProcessingDepartments(pool),
			loadFieldOptions(pool),
			loadElectronicAttachments(pool),
		]);

		return {
			operationCodes,
			importLicenses,
			permits,
			permitTypes,
			processingDepartments,
			fieldOptions,
			electronicAttachments,
		} satisfies CdsDatabaseLookups;
	}).then((lookups) => lookups ?? emptyLookups());

	globalForLiveLookups.cdsLiveLookupsCache = {
		connectionKey: connectionString,
		expiresAt: now + LIVE_LOOKUP_CACHE_TTL_MS,
		promise,
	};

	try {
		const resolved = await promise;
		return resolved;
	} catch (error) {
		globalForLiveLookups.cdsLiveLookupsCache = undefined;
		throw error;
	}
}

function mergeOperationCodes(
	localOptions: DatabaseOperationCodeLookup[],
	liveOptions: DatabaseOperationCodeLookup[],
) {
	const merged = new Map<string, DatabaseOperationCodeLookup>();

	[...localOptions, ...liveOptions].forEach((option) => {
		if (!option.code) {
			return;
		}

		const code = option.code.trim().toUpperCase();
		const existing = merged.get(code);

		merged.set(code, {
			code,
			name: option.name?.trim() || existing?.name || code,
			direction:
				option.direction !== "unknown"
					? option.direction
					: (existing?.direction ?? "unknown"),
		});
	});

	return [...merged.values()].sort((left, right) =>
		left.code.localeCompare(right.code, "en", { numeric: true }),
	);
}

function mergeByKey<T>(
	localItems: T[],
	liveItems: T[],
	keySelector: (item: T) => string,
	mergeItem?: (current: T, next: T) => T,
) {
	const merged = new Map<string, T>();

	[...localItems, ...liveItems].forEach((item) => {
		const key = keySelector(item);
		if (!key) {
			return;
		}

		const existing = merged.get(key);
		merged.set(key, existing && mergeItem ? mergeItem(existing, item) : item);
	});

	return [...merged.values()];
}

function getFieldOptionMergeKey(
	fieldKey: CdsDatabaseFieldOptionKey,
	item: DatabaseFieldOptionLookup,
) {
	const labelKey =
		fieldKey === "transportVehicleCode" && item.label
			? `::${item.label.trim().toUpperCase()}`
			: "";

	return `${item.source}::${item.direction}::${item.value}${labelKey}`;
}

export function mergeCdsDatabaseLookups(
	localLookups: CdsDatabaseLookups,
	liveLookups: CdsDatabaseLookups,
) {
	if (!hasCdsDatabaseLookupContent(liveLookups)) {
		return localLookups;
	}

	const fieldOptions = {
		...localLookups.fieldOptions,
	} satisfies CdsDatabaseLookups["fieldOptions"];

	const allFieldKeys = new Set<CdsDatabaseFieldOptionKey>([
		...Object.keys(localLookups.fieldOptions),
		...Object.keys(liveLookups.fieldOptions),
	] as CdsDatabaseFieldOptionKey[]);

	allFieldKeys.forEach((fieldKey) => {
		fieldOptions[fieldKey] = mergeByKey(
			localLookups.fieldOptions[fieldKey] ?? [],
			liveLookups.fieldOptions[fieldKey] ?? [],
			(item) => getFieldOptionMergeKey(fieldKey, item),
			(current, next) => ({
				...next,
				label: next.label || current.label || null,
				address: next.address || current.address || null,
				count: Math.max(current.count, next.count),
			}),
		).sort((left, right) => {
			if (right.count !== left.count) {
				return right.count - left.count;
			}

			return left.value.localeCompare(right.value, "en", { numeric: true });
		});
	});

	return {
		operationCodes: mergeOperationCodes(
			localLookups.operationCodes,
			liveLookups.operationCodes,
		),
		importLicenses: mergeByKey(
			localLookups.importLicenses,
			liveLookups.importLicenses,
			(item) => item.id,
			(current, next) => ({
				...current,
				...next,
			}),
		),
		permits: mergeByKey(
			localLookups.permits,
			liveLookups.permits,
			(item) => item.id,
			(current, next) => ({
				...current,
				...next,
			}),
		),
		permitTypes: mergeByKey(
			localLookups.permitTypes,
			liveLookups.permitTypes,
			(item) => item.code,
			(current, next) => ({
				...current,
				...next,
			}),
		),
		processingDepartments: mergeByKey(
			localLookups.processingDepartments,
			liveLookups.processingDepartments,
			(item) => `${item.customsCode}::${item.code}`,
			(current, next) => ({
				...current,
				...next,
			}),
		).sort((left, right) => {
			const customsCompare = left.customsCode.localeCompare(
				right.customsCode,
				"en",
				{
					numeric: true,
				},
			);

			if (customsCompare !== 0) {
				return customsCompare;
			}

			return left.code.localeCompare(right.code, "en", {
				numeric: true,
			});
		}),
		fieldOptions,
		electronicAttachments: mergeByKey(
			localLookups.electronicAttachments,
			liveLookups.electronicAttachments,
			(item) => `${item.attachmentTypeCode}::${item.attachmentNumber ?? ""}`,
			(current, next) => ({
				...current,
				...next,
				count: Math.max(current.count, next.count),
			}),
		).sort((left, right) => {
			if (right.count !== left.count) {
				return right.count - left.count;
			}

			const typeCompare = left.attachmentTypeCode.localeCompare(
				right.attachmentTypeCode,
				"en",
				{
					numeric: true,
				},
			);

			if (typeCompare !== 0) {
				return typeCompare;
			}

			return (left.attachmentNumber ?? "").localeCompare(
				right.attachmentNumber ?? "",
				"en",
				{
					numeric: true,
				},
			);
		}),
	} satisfies CdsDatabaseLookups;
}
