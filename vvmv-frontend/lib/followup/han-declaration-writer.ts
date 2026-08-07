import sql from "mssql";
import type {
	CargoListRow,
	ContainerRow,
	DeclarationRow,
	FollowUpCdsInfoRow,
	FollowUpRow,
} from "@/app/(home)/internal/followup/types";
import { parseMssqlConnectionString } from "@/lib/db/mssql-connection-string";
import { sanitizeCargoListPayload } from "@/lib/followup/ai-ocr-sync";
import { resolveCdsBusinessTypeGroup } from "@/lib/followup/cds-business-type-groups";
import {
	normalizeCdsTruckLoadingLocationCodes,
	stripCdsLookupDisplayLabel,
} from "@/lib/followup/cds-code-values";
import {
	buildCdsHanVerificationSummary,
	getUnverifiedHanMappingWarnings,
} from "@/lib/followup/cds-han-compare";
import {
	getHanColumnMetadataMap,
	type HanColumnMetadata,
} from "@/lib/followup/cds-han-metadata";
import { normalizeCdsPartnerAddressFields } from "@/lib/followup/cds-partner-address";
import { normalizeCdsWeightUnit } from "@/lib/followup/cds-weight-units";
import {
	type HanDeclarationPrefillMatch,
	loadHanDeclarationPrefillById,
} from "@/lib/followup/han-declaration-loader";
import {
	deriveHanAppName,
	deriveOperationType,
	type FollowUpOperationType,
} from "@/lib/followup/operation-type";

type SqlScalar = string | number | Date | null;
type SqlRecord = Record<string, SqlScalar>;
const HAN_STRING_TYPES = new Set(["char", "nchar", "varchar", "nvarchar"]);
type HanCargoRowInput = Pick<
	Partial<CargoListRow>,
	| "customCode"
	| "hsCode"
	| "originalCountry"
	| "vietnameseName"
	| "originalCargoName"
	| "dutyReductionCode"
	| "imExDutyExemptionCode"
	| "unit"
	| "qty"
	| "unitPrice"
	| "totalPrice"
	| "unit2"
	| "qty2"
	| "importTaxCode"
	| "importTaxRate"
	| "importTaxAmount"
	| "vatTaxCode"
	| "vatTaxRate"
	| "vatTaxAmount"
	| "imExDutyExemptionCondition"
	| "imExDutyExemptionAmount"
>;
type HanCargoRowContext = Pick<
	Partial<FollowUpCdsInfoRow>,
	| "operationCode"
	| "customsCode"
	| "invoiceCurrency"
	| "taxableValueCurrencyCode"
>;

export type RegisterCdsIntoHanInput = {
	connectionString: string;
	cdsInfo: Partial<FollowUpCdsInfoRow>;
	cargoList: Array<Partial<CargoListRow>>;
	containers?: Array<Pick<ContainerRow, "containerNo">> | null;
	declarationId?: number | null;
	followUpTaxCode?: string | null;
	followUpCompanyName?: string | null;
	followUpSummary?: Partial<FollowUpRow> | null;
	declarations?: DeclarationRow[] | null;
	operationType?: string | null;
	localDeclarationId?: string | null;
	warnings?: string[] | null;
};

export type RegisterCdsIntoHanResult = {
	status: "inserted" | "reused";
	declarationId: number;
	declarationNumber: string | null;
	roundTripDeclaration: HanDeclarationPrefillMatch | null;
	operationType: FollowUpOperationType | null;
	ddsContTkId: number | null;
	insertedTables: string[];
	updatedTables: string[];
	containerDetailCount: number;
	localDeclarationId: string | null;
	warnings: string[];
	verify: ReturnType<typeof buildCdsHanVerificationSummary>;
};

function shouldRetryWithTlsFallback(error: unknown) {
	const message =
		error instanceof Error ? error.message.toLowerCase() : String(error ?? "");
	return (
		message.includes("ssl") ||
		message.includes("tls") ||
		message.includes("unsupported protocol") ||
		message.includes("handshake")
	);
}

async function connectHanPoolWithTlsFallback(
	sqlConfig: sql.config,
): Promise<sql.ConnectionPool> {
	const pool = new sql.ConnectionPool(sqlConfig);

	try {
		await pool.connect();
		return pool;
	} catch (error) {
		try {
			await pool.close();
		} catch {
			// Ignore close errors from failed initial connect.
		}

		if (!shouldRetryWithTlsFallback(error)) {
			throw error;
		}

		const fallbackConfig: sql.config = {
			...sqlConfig,
			options: {
				...(sqlConfig.options ?? {}),
				encrypt: true,
				trustServerCertificate: true,
			},
		};
		const fallbackPool = new sql.ConnectionPool(fallbackConfig);
		await fallbackPool.connect();
		return fallbackPool;
	}
}

function clean(value: unknown): string | null {
	const text = String(value ?? "").trim();
	return text === "" ? null : text;
}

function normalizeTaxCodeDigits(value: unknown): string | null {
	const digits = String(value ?? "").replace(/\D+/g, "");
	return digits || null;
}

function cleanCode(value: unknown): string | null {
	const text = clean(value);
	return text ? text.toUpperCase() : null;
}

function cleanCodeWithinMax(value: unknown, maxLength: number): string | null {
	const text = cleanCode(value);
	return text && text.length <= maxLength ? text : null;
}

/** MA_DIA_DIEM (DDS): strip lookup label, uppercase, max 7 chars for HAN. */
function normalizeDdsTaxDestinationCode(value: unknown): string | null {
	const stripped = stripCdsLookupDisplayLabel(value);
	const code = cleanCode(stripped);
	if (!code) {
		return null;
	}
	return code.length <= 7 ? code : code.slice(0, 7);
}

function cleanWithinMax(value: unknown, maxLength: number): string | null {
	const text = clean(value);
	return text && text.length <= maxLength ? text : null;
}

/** HAN NVARCHAR fields: keep leading chars instead of dropping over-length text. */
function cleanTruncateMax(value: unknown, maxLength: number): string | null {
	const text = clean(value);
	if (!text) {
		return null;
	}
	return text.length <= maxLength ? text : text.slice(0, maxLength);
}

/** VNACCS truck slot codes are max 8 chars; truncate so ECUS still receives a code. */
function normalizeTruckLoadingCodeSegment(value: unknown): string | null {
	const code = cleanCode(value);
	if (!code) {
		return null;
	}
	return code.length <= 8 ? code : code.slice(0, 8);
}

function toIntegerNumber(value: unknown): number | null {
	const text = clean(value);
	if (!text) {
		return null;
	}

	const normalized = text.replace(/,/g, "");
	if (!/^\d+$/.test(normalized)) {
		return null;
	}

	const parsed = Number(normalized);
	return Number.isSafeInteger(parsed) ? parsed : null;
}

function normalizeBusinessTypeGroup(
	value: unknown,
	operationCode?: unknown,
): string | null {
	const resolved = resolveCdsBusinessTypeGroup(value, operationCode);
	return resolved ? cleanCodeWithinMax(resolved, 8) : null;
}

function toNumber(value: unknown): number | null {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}

	const text = clean(value);
	if (!text) {
		return null;
	}

	const normalized = text.replace(/,/g, "");
	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : null;
}

function toSqlDate(value: unknown): Date | null {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value;
	}

	const text = clean(value);
	if (!text) {
		return null;
	}

	if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
		return new Date(`${text}T00:00:00.000Z`);
	}

	const parsed = new Date(text);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function firstNonEmpty(
	...values: Array<string | null | undefined>
): string | null {
	for (const value of values) {
		const normalized = clean(value);
		if (normalized) {
			return normalized;
		}
	}

	return null;
}

function firstCodeNameWithinMax(
	maxLength: number,
	candidates: Array<{ code: unknown; name?: unknown }>,
) {
	for (const candidate of candidates) {
		const code = cleanCodeWithinMax(candidate.code, maxLength);
		if (code) {
			return {
				code,
				name: clean(candidate.name),
			};
		}
	}

	return { code: null, name: null };
}

function buildCompanyRoutingWarning(args: {
	cdsInfo: Partial<FollowUpCdsInfoRow>;
	followUpTaxCode?: string | null;
	followUpCompanyName?: string | null;
	followUpSummary?: Partial<FollowUpRow> | null;
}) {
	const canonicalTaxCode = normalizeTaxCodeDigits(
		firstNonEmpty(args.followUpTaxCode, args.followUpSummary?.taxCode),
	);
	const cdsImporterTaxCode = normalizeTaxCodeDigits(args.cdsInfo.importerCode);

	if (
		!canonicalTaxCode ||
		!cdsImporterTaxCode ||
		canonicalTaxCode === cdsImporterTaxCode
	) {
		return null;
	}

	const companyLabel =
		firstNonEmpty(
			args.followUpCompanyName,
			args.followUpSummary?.companyName,
		) ?? "hồ sơ follow-up";

	return `Mã người xuất / nhập khẩu trong CDS (${cdsImporterTaxCode}) khác MST công ty của ${companyLabel} (${canonicalTaxCode}). Luồng register đã ưu tiên MST công ty để bản ghi vào đúng app.`;
}

function normalizeContainerNumbers(
	containers: Array<Pick<ContainerRow, "containerNo">> | null | undefined,
) {
	const seen = new Set<string>();
	const normalized: string[] = [];

	for (const container of containers ?? []) {
		const value = clean(container.containerNo);
		if (!value) {
			continue;
		}

		const key = value.toUpperCase();
		if (seen.has(key)) {
			continue;
		}

		seen.add(key);
		normalized.push(value);
	}

	return normalized.slice(0, 50);
}

function getPrimaryDeclaration(
	declarations: DeclarationRow[] | null | undefined,
) {
	if (!Array.isArray(declarations) || declarations.length === 0) {
		return null;
	}

	return (
		[...declarations].sort((left, right) => {
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

function parseImportLicenseSlots(cdsInfo: Partial<FollowUpCdsInfoRow>) {
	const rawEntries = Array.isArray(cdsInfo.importLicenses)
		? [...cdsInfo.importLicenses]
		: [];

	if (!rawEntries.some((entry) => clean(entry))) {
		rawEntries[0] =
			cleanCode(cdsInfo.importLicense) && clean(cdsInfo.licenseNumber)
				? `${cleanCode(cdsInfo.importLicense)}:${clean(cdsInfo.licenseNumber)}`
				: (cleanCode(cdsInfo.importLicense) ?? clean(cdsInfo.licenseNumber));
	}

	return Array.from({ length: 5 }, (_, index) => rawEntries[index] ?? null).map(
		(entry) => {
			const raw = clean(entry);
			if (!raw) {
				return { code: null, number: null };
			}

			const [codePart, ...rest] = raw.split(":");
			if (rest.length === 0) {
				return {
					code: cleanCode(codePart),
					number: null,
				};
			}

			return {
				code: cleanCode(codePart),
				number: clean(rest.join(":")),
			};
		},
	);
}

function normalizeBillItems(cdsInfo: Partial<FollowUpCdsInfoRow>) {
	const items = Array.isArray(cdsInfo.billItems) ? cdsInfo.billItems : [];

	return Array.from({ length: 5 }, (_, index) => {
		const row =
			items[index] && typeof items[index] === "object" ? items[index] : null;

		return {
			billNumber: cleanWithinMax(row?.billNumber, 50),
			billDate: toSqlDate(row?.billDate),
			hawbNumber: cleanWithinMax(row?.hawbNumber, 50),
			mawbYear: toIntegerNumber(row?.mawbYear),
		};
	});
}

function normalizeLegalDocumentCodes(cdsInfo: Partial<FollowUpCdsInfoRow>) {
	const items = Array.isArray(cdsInfo.otherLegalDocumentCodes)
		? cdsInfo.otherLegalDocumentCodes
		: [];

	return Array.from({ length: 5 }, (_, index) =>
		cleanCodeWithinMax(
			items[index] ?? (index === 0 ? cdsInfo.otherLegalDocumentCode : null),
			2,
		),
	);
}

function normalizeAttachments(cdsInfo: Partial<FollowUpCdsInfoRow>) {
	const attachments = Array.isArray(cdsInfo.electronicAttachments)
		? cdsInfo.electronicAttachments
		: [];

	return Array.from({ length: 3 }, (_, index) => {
		const row =
			attachments[index] && typeof attachments[index] === "object"
				? attachments[index]
				: null;

		return {
			typeCode: cleanCodeWithinMax(row?.attachmentDescription, 3),
			attachmentNumber: toIntegerNumber(row?.attachmentNumber),
		};
	});
}

function normalizeValuationAdjustments(cdsInfo: Partial<FollowUpCdsInfoRow>) {
	const adjustments = Array.isArray(cdsInfo.valuationAdjustments)
		? cdsInfo.valuationAdjustments
		: [];

	return Array.from({ length: 5 }, (_, index) => {
		const row =
			adjustments[index] && typeof adjustments[index] === "object"
				? adjustments[index]
				: null;

		return {
			nameCode: cleanCode(row?.nameCode),
			classificationCode: cleanCode(row?.classificationCode),
			currencyCode: cleanCode(row?.currencyCode),
			adjustmentValue: toNumber(row?.adjustmentValue),
			allocationRatio: toNumber(row?.allocationRatio),
		};
	});
}

function normalizeTransportSchedules(cdsInfo: Partial<FollowUpCdsInfoRow>) {
	const schedules = Array.isArray(cdsInfo.transportSchedules)
		? cdsInfo.transportSchedules
		: [];

	return Array.from({ length: 3 }, (_, index) => {
		const row =
			schedules[index] && typeof schedules[index] === "object"
				? schedules[index]
				: null;

		return {
			locationCode:
				cleanCodeWithinMax(row?.locationCode, 7) ??
				(() => {
					const legacyCode = cleanWithinMax(row?.locationName, 7);
					return legacyCode && legacyCode.length <= 7
						? cleanCode(legacyCode)
						: null;
				})(),
			locationName: clean(row?.locationName),
			arrivalDate: toSqlDate(row?.arrivalDate),
			departureDate: toSqlDate(row?.departureDate),
		};
	});
}

function normalizeTruckLoadingLocations(cdsInfo: Partial<FollowUpCdsInfoRow>) {
	const rawCodes = normalizeCdsTruckLoadingLocationCodes(
		cdsInfo.truckLoadingLocationCode,
	)
		?.split(".")
		.map((part) => normalizeTruckLoadingCodeSegment(part))
		.filter((part): part is string => Boolean(part));
	const rawName = clean(cdsInfo.truckLoadingLocationName);
	const rawAddress = clean(cdsInfo.truckLoadingLocationAddress);

	return {
		codes: Array.from({ length: 5 }, (_, index) => rawCodes?.[index] ?? null),
		name: cleanTruncateMax(rawName, 70),
		address: cleanTruncateMax(rawAddress, 300),
	};
}

function bindInput(request: sql.Request, name: string, value: SqlScalar) {
	if (value === null) {
		request.input(name, sql.NVarChar, null);
		return;
	}

	if (typeof value === "number") {
		request.input(name, sql.Float, value);
		return;
	}

	if (value instanceof Date) {
		request.input(name, sql.DateTime, value);
		return;
	}

	request.input(name, sql.NVarChar, value);
}

function createBindings(record: SqlRecord) {
	return Object.entries(record).map(([column, value], index) => ({
		column,
		paramName: `p${index}`,
		value,
	}));
}

function createIdBinding(name: string, value: number) {
	return {
		column: name,
		paramName: name,
		value,
	};
}

function toHanMetadataKey(tableName: string, columnName: string) {
	return `${tableName.toUpperCase()}::${columnName.toUpperCase()}`;
}

function sanitizeRecordForHanTable(args: {
	tableName: string;
	record: SqlRecord;
	metadataMap: Map<string, HanColumnMetadata>;
}) {
	const sanitizedRecord: SqlRecord = {};
	const warnings: string[] = [];

	for (const [columnName, value] of Object.entries(args.record)) {
		if (typeof value !== "string") {
			sanitizedRecord[columnName] = value;
			continue;
		}

		const metadata =
			args.metadataMap.get(toHanMetadataKey(args.tableName, columnName)) ??
			null;
		const maxLength = metadata?.maxLength ?? null;
		const dataType = metadata?.dataType?.toLowerCase() ?? null;

		if (
			maxLength === null ||
			maxLength < 0 ||
			!dataType ||
			!HAN_STRING_TYPES.has(dataType) ||
			value.length <= maxLength
		) {
			sanitizedRecord[columnName] = value;
			continue;
		}

		sanitizedRecord[columnName] = value.slice(0, maxLength);
		warnings.push(
			`HAN_2024 tự rút gọn ${args.tableName}.${columnName} còn ${maxLength} ký tự để khớp schema.`,
		);
	}

	return { sanitizedRecord, warnings };
}

function buildInsertQuery(
	tableName: string,
	identityColumn: string,
	record: SqlRecord,
) {
	const bindings = createBindings(record);
	const columns = bindings.map((binding) => `[${binding.column}]`).join(", ");
	const params = bindings.map((binding) => `@${binding.paramName}`).join(", ");

	return {
		bindings,
		sql: `
      INSERT INTO dbo.${tableName} (${columns})
      OUTPUT INSERTED.[${identityColumn}] AS insertedId
      VALUES (${params});
    `,
	};
}

function buildUpdateQuery(
	tableName: string,
	idColumn: string,
	idValue: number,
	record: SqlRecord,
) {
	const bindings = [
		...createBindings(record),
		createIdBinding("targetId", idValue),
	];
	const assignments = bindings
		.filter((binding) => binding.paramName !== "targetId")
		.map((binding) => `[${binding.column}] = @${binding.paramName}`)
		.join(",\n        ");

	return {
		bindings,
		sql: `
      UPDATE dbo.${tableName}
      SET ${assignments}
      WHERE [${idColumn}] = @targetId;
    `,
	};
}

async function executeWithBindings(
	request: sql.Request,
	bindings: Array<{ paramName: string; value: SqlScalar }>,
	queryText: string,
) {
	bindings.forEach((binding) => {
		bindInput(request, binding.paramName, binding.value);
	});

	return request.query(queryText);
}

async function rowExists(
	transaction: sql.Transaction,
	tableName: string,
	declarationId: number,
) {
	const request = new sql.Request(transaction);
	request.input("declarationId", sql.Numeric(18, 0), declarationId);
	const result = await request.query<{ total: number }>(`
    SELECT COUNT(1) AS total
    FROM dbo.${tableName}
    WHERE _DTOKHAIMDID = @declarationId;
  `);

	return Number(result.recordset[0]?.total ?? 0) > 0;
}

async function countRows(
	transaction: sql.Transaction,
	tableName: string,
	declarationId: number,
	keyColumn = "_DTOKHAIMDID",
) {
	const request = new sql.Request(transaction);
	request.input("declarationId", sql.Numeric(18, 0), declarationId);
	const result = await request.query<{ total: number }>(`
    SELECT COUNT(1) AS total
    FROM dbo.${tableName}
    WHERE ${keyColumn} = @declarationId;
  `);

	return Number(result.recordset[0]?.total ?? 0);
}

async function resolveDdsSupervisionCustomsCode(
	transaction: sql.Transaction,
	locationCode: string | null,
) {
	const normalizedLocationCode = cleanCodeWithinMax(locationCode, 7);

	if (!normalizedLocationCode) {
		return null;
	}

	const request = new sql.Request(transaction);
	request.input("locationCode", sql.NVarChar(16), normalizedLocationCode);
	const result = await request.query<{ code: string | null }>(`
    SELECT TOP (1) code
    FROM (
      SELECT
        UPPER(LTRIM(RTRIM(CAST(MA_HQ_GIAMSAT AS NVARCHAR(8))))) AS code,
        COUNT(1) AS usageCount,
        1 AS priority
      FROM dbo.DDS_CONT_TK WITH (NOLOCK)
      WHERE
        UPPER(LTRIM(RTRIM(CAST(MA_DIA_DIEM AS NVARCHAR(16))))) = @locationCode
        AND NULLIF(LTRIM(RTRIM(CAST(MA_HQ_GIAMSAT AS NVARCHAR(8)))), '') IS NOT NULL
      GROUP BY UPPER(LTRIM(RTRIM(CAST(MA_HQ_GIAMSAT AS NVARCHAR(8)))))

      UNION ALL

      SELECT
        UPPER(LTRIM(RTRIM(CAST(MA_HQ AS NVARCHAR(8))))) AS code,
        0 AS usageCount,
        2 AS priority
      FROM dbo.SDIA_DIEM WITH (NOLOCK)
      WHERE
        UPPER(LTRIM(RTRIM(CAST(MA_DIA_DIEM AS NVARCHAR(16))))) = @locationCode
        AND NULLIF(LTRIM(RTRIM(CAST(MA_HQ AS NVARCHAR(8)))), '') IS NOT NULL

      UNION ALL

      SELECT
        CASE
          WHEN @locationCode LIKE '[0-9][0-9]%' THEN LEFT(@locationCode, 4)
          ELSE NULL
        END AS code,
        0 AS usageCount,
        3 AS priority
    ) candidates
    WHERE NULLIF(LTRIM(RTRIM(code)), '') IS NOT NULL
    ORDER BY priority, usageCount DESC, code;
  `);

	return cleanCodeWithinMax(result.recordset[0]?.code, 8);
}

export function buildHeaderRecord(args: {
	cdsInfo: Partial<FollowUpCdsInfoRow>;
	operationType: FollowUpOperationType;
	followUpTaxCode?: string | null;
	followUpCompanyName?: string | null;
	followUpSummary?: Partial<FollowUpRow> | null;
	declarations?: DeclarationRow[] | null;
	containerNumbers: string[];
}) {
	const {
		cdsInfo,
		operationType,
		followUpTaxCode,
		followUpCompanyName,
		followUpSummary,
		declarations,
		containerNumbers,
	} = args;
	const primaryDeclaration = getPrimaryDeclaration(declarations);
	const billItems = normalizeBillItems(cdsInfo);
	const resolvedTaxCode = firstNonEmpty(
		followUpTaxCode,
		followUpSummary?.taxCode,
		cdsInfo.importerCode,
	);
	const resolvedCompanyName = firstNonEmpty(
		cdsInfo.importExportUnitName,
		followUpCompanyName,
		followUpSummary?.companyName,
	);
	const effectiveExpectedDeclarationDate =
		toSqlDate(primaryDeclaration?.declarationDate) ??
		toSqlDate(cdsInfo.expectedDeclarationDate);
	const declarationDate =
		operationType === "XUAT" ? effectiveExpectedDeclarationDate : null;
	const transportDepartureDate =
		toSqlDate(cdsInfo.transportDepartureDate) ??
		toSqlDate(cdsInfo.departureDate) ??
		toSqlDate(cdsInfo.departureArrivalDate);
	const transportArrivalDate =
		operationType === "XUAT"
			? (toSqlDate(cdsInfo.estimatedArrivalAtDestinationDate) ??
				toSqlDate(cdsInfo.departureArrivalDate))
			: null;

	const headerWarehouse =
		operationType === "NHAP"
			? firstCodeNameWithinMax(6, [
					{
						code: cdsInfo.customsWarehouseCode,
						name: cdsInfo.customsWarehouseName,
					},
				])
			: firstCodeNameWithinMax(6, [
					{
						code: cdsInfo.loadingLocationCode,
						name:
							cdsInfo.loadingLocationName ?? followUpSummary?.loadingLocation,
					},
					{
						code: cdsInfo.customsWarehouseCode,
						name: cdsInfo.customsWarehouseName,
					},
					{
						code: cdsInfo.warehouseLocationCode,
						name: cdsInfo.warehouseLocationName ?? followUpSummary?.warehouse,
					},
				]);
	const headerWarehouseCode = headerWarehouse.code;
	const headerWarehouseName = headerWarehouse.name;
	const foreignLocationCode = cleanCode(
		operationType === "XUAT"
			? (cdsInfo.unloadingLocationCode ?? cdsInfo.taxDestinationLocation)
			: (cdsInfo.loadingLocationCode ?? cdsInfo.unloadingLocationCode),
	);
	const foreignLocationName = firstNonEmpty(
		operationType === "XUAT"
			? cdsInfo.unloadingLocationName
			: cdsInfo.loadingLocationName,
		cdsInfo.loadingLocationName,
		cdsInfo.unloadingLocationName,
	);
	const partnerName = firstNonEmpty(
		cdsInfo.partnerName,
		followUpSummary?.supplier,
		primaryDeclaration?.partner,
		resolvedCompanyName,
	);
	const customsCode = cleanCode(
		cdsInfo.customsCode ?? primaryDeclaration?.customsCode,
	);
	const billOfLading = firstNonEmpty(
		cdsInfo.billOfLading,
		billItems[0]?.billNumber,
	);
	const packageQuantity =
		toNumber(cdsInfo.packageQuantity) ??
		toNumber(followUpSummary?.quantity) ??
		toNumber(primaryDeclaration?.quantity);
	const packageType = cleanCode(
		cdsInfo.packageType ?? followUpSummary?.unit ?? primaryDeclaration?.unit,
	);
	const normalizedTransportMethodCode = cleanCode(cdsInfo.transportMethodCode);
	const grossWeight =
		toNumber(cdsInfo.grossWeightTotal) ??
		toNumber(followUpSummary?.grossWeight) ??
		toNumber(primaryDeclaration?.grossWeight);
	const weightUnit = normalizeCdsWeightUnit(cdsInfo.weightUnit);
	const commercialInvoice = firstNonEmpty(
		cdsInfo.commercialInvoice,
		followUpSummary?.invoice,
		primaryDeclaration?.invoice,
	);
	const commercialInvoiceDate =
		toSqlDate(cdsInfo.commercialInvoiceDate) ??
		effectiveExpectedDeclarationDate;
	const totalInvoiceValue =
		toNumber(cdsInfo.totalInvoiceValue) ?? toNumber(cdsInfo.declaredValue);
	const branchNumber = toNumber(cdsInfo.branchNumberPart1);
	const correspondingDeclarationNumber = toNumber(
		cdsInfo.correspondingDeclarationNumber,
	);
	const electronicInvoiceReceiptNumber = toNumber(
		cdsInfo.electronicInvoiceReceiptNumber,
	);
	const importLicenses = parseImportLicenseSlots(cdsInfo);

	return {
		_XorN: operationType === "XUAT" ? "X" : "N",
		TTTK: "N",
		APP_NAME: deriveHanAppName({
			operationType,
			operationCode: cdsInfo.operationCode,
			taxCode: resolvedTaxCode,
		}),
		IsVNACCS: 1,
		IsVersion2: 1,
		IsTQDT: 1,
		// Draft export/import rows in HAN keep SOTK empty until ECUS assigns it.
		// Do not copy existing local declaration numbers into the new CDS draft.
		SOTK: null,
		SOTK_DAU_TIEN: null,
		SOTK_NHANH: branchNumber,
		SOTK_TN_TX: correspondingDeclarationNumber,
		MA_LH: cleanCode(cdsInfo.operationCode),
		NGAY_DK: declarationDate,
		MA_HQ: customsCode,
		MA_DV: cleanCode(resolvedTaxCode),
		DV_DT: partnerName,
		_Ten_DV_L1: resolvedCompanyName,
		MA_BC_DV: clean(cdsInfo.importerPostalCode),
		DIA_CHI_DV: clean(cdsInfo.importExportBusinessAddress),
		SO_DT_DV: clean(cdsInfo.importerPhone),
		MA_DVUT: cleanCode(cdsInfo.entrustedImporterCode),
		_TEN_DVUT: firstNonEmpty(
			cdsInfo.entrustedImporterName,
			cdsInfo.entrustedExporterName,
		),
		MA_NGUOI_CHI_DINH_CT: cleanCode(cdsInfo.customsDeclarantCode),
		Ma_Nguoi_Giao_Hang:
			operationType === "NHAP" ? cleanCode(cdsInfo.exporterCode) : null,
		Ten_Nguoi_Giao_Hang: operationType === "NHAP" ? partnerName : null,
		Ma_Nguoi_Nhan_Hang:
			operationType === "XUAT" ? cleanCode(cdsInfo.exporterCode) : null,
		Ten_Nguoi_Nhan_Hang: operationType === "XUAT" ? partnerName : null,
		MA_BC_DT: clean(cdsInfo.exporterPostalCode),
		MA_PTVT:
			operationType === "XUAT" && normalizedTransportMethodCode === "1"
				? null
				: cleanCode(cdsInfo.transportVehicleCode),
		TEN_PTVT: clean(cdsInfo.transportVehicleName),
		NGAYKH: transportDepartureDate,
		NGAYDEN: transportArrivalDate,
		VAN_DON: billOfLading,
		SO_KIEN: packageQuantity,
		DVT_KIEN: packageType,
		TR_LUONG: grossWeight,
		_TR_LUONG_Net: toNumber(cdsInfo.netWeight),
		DVT_TR_LUONG: weightUnit,
		SO_CONTAINER:
			containerNumbers.length > 0
				? containerNumbers.length
				: toNumber(cdsInfo.containerQuantity),
		KY_HIEU_SO_HIEU:
			operationType === "XUAT" ? null : clean(cdsInfo.packageMarks),
		KIEMHOANK: cleanCode(cdsInfo.inspectionResultCode),
		MA_CK: headerWarehouseCode,
		TEN_CK: headerWarehouseCode ? headerWarehouseName : null,
		MA_CANGNN: foreignLocationCode,
		CANGNN: foreignLocationName,
		MA_GP: importLicenses[0]?.code ?? cleanCode(cdsInfo.importLicense),
		SO_GP: importLicenses[0]?.number ?? clean(cdsInfo.licenseNumber),
		SO_HD: clean(cdsInfo.contractNumber),
		NGAY_HD: toSqlDate(cdsInfo.contractDate),
		NGAY_HHHD: toSqlDate(cdsInfo.contractGoodsDate),
		NGAY_THN_THX: toSqlDate(cdsInfo.reExportDeadline),
		SO_TN_HDTM: electronicInvoiceReceiptNumber,
		SO_HDTM: commercialInvoice,
		NGAY_HDTM: commercialInvoiceDate,
		TONGTG_HDTM: totalInvoiceValue,
		TONGTGKB:
			toNumber(cdsInfo.declaredValue) ?? toNumber(cdsInfo.totalInvoiceValue),
		TONGTGTT:
			toNumber(cdsInfo.totalTaxableValue) ??
			toNumber(cdsInfo.declaredValue) ??
			toNumber(cdsInfo.totalInvoiceValue),
		MA_GH: cleanCode(cdsInfo.invoicePriceCondition),
		MA_PL_GIA_HDTM: cleanCode(cdsInfo.invoiceClassificationCode),
		MA_PTTT: cleanCode(cdsInfo.paymentMethod),
		MA_NT: cleanCode(cdsInfo.invoiceCurrency),
		TYGIA_VND: toNumber(cdsInfo.exchangeRate),
		MA_NT_TGTT: cleanCode(cdsInfo.taxableValueCurrencyCode),
		MA_THOI_HAN_NOP_THUE: cleanCode(cdsInfo.taxPaymentDeadlineCode),
		MA_PHI_BH: cleanCode(cdsInfo.insuranceFeeClassificationCode),
		MA_NT_PHI_BH: cleanCode(cdsInfo.insuranceFeeCurrencyCode),
		PHI_BH: toNumber(cdsInfo.insuranceFee),
		SO_DK_PHI_BH: clean(cdsInfo.insuranceRegistrationNumber),
		MA_PHI_VC: cleanCode(cdsInfo.transportFeeClassificationCode),
		MA_NT_PHI_VC: cleanCode(cdsInfo.transportFeeCurrencyCode),
		PHI_VC: toNumber(cdsInfo.transportFee),
		MA_HDTM: cleanCode(cdsInfo.invoiceFormClassificationCode),
		NUOC_XK:
			operationType === "NHAP" ? cleanCode(cdsInfo.exportCountryCode) : "VN",
		NUOC_NK:
			operationType === "XUAT" ? cleanCode(cdsInfo.exportCountryCode) : null,
		KDT_LASTINFO: null,
		DAM_BAO_MA_NG_HANG: cleanCode(cdsInfo.guaranteeBankCode),
		DAM_BAO_NAM_PHAT_HANH: toNumber(cdsInfo.creditLimitIssueYear),
		DAM_BAO_KY_HIEU_CT: firstNonEmpty(
			cdsInfo.guaranteeDocumentSymbol,
			cdsInfo.creditLimitDocumentSymbol,
		),
		DAM_BAO_SO_CT: firstNonEmpty(
			cdsInfo.guaranteeDocumentNumber,
			cdsInfo.creditLimitDocumentNumber,
		),
	} satisfies SqlRecord;
}

export function buildVnaccsRecord(args: {
	cdsInfo: Partial<FollowUpCdsInfoRow>;
	containerNumbers: string[];
	operationType: FollowUpOperationType;
}) {
	const attachments = normalizeAttachments(args.cdsInfo);
	const valuationAdjustments = normalizeValuationAdjustments(args.cdsInfo);
	const legalDocumentCodes = normalizeLegalDocumentCodes(args.cdsInfo);
	const transportSchedules = normalizeTransportSchedules(args.cdsInfo);
	const truckLoadingLocations = normalizeTruckLoadingLocations(args.cdsInfo);
	const record: SqlRecord = {
		MA_KHAI_TRGIA:
			args.operationType === "NHAP"
				? cleanCode(args.cdsInfo.valuationDeclarationTypeCode)
				: null,
		MA_PL_NOP_THUE: null,
		SO_TN_KHAI_TRGIA: clean(args.cdsInfo.valuationSummaryReceiptNumber),
		MA_KHOAN_DC: valuationAdjustments[0]?.nameCode ?? null,
		MA_LOAI_DC: valuationAdjustments[0]?.classificationCode ?? null,
		MA_NT_DC: valuationAdjustments[0]?.currencyCode ?? null,
		TRIGIA_DC: valuationAdjustments[0]?.adjustmentValue ?? null,
		TONG_HS_PB_DC: valuationAdjustments[0]?.allocationRatio ?? null,
		MA_KHOAN_DC2: valuationAdjustments[1]?.nameCode ?? null,
		MA_LOAI_DC2: valuationAdjustments[1]?.classificationCode ?? null,
		MA_NT_DC2: valuationAdjustments[1]?.currencyCode ?? null,
		TRIGIA_DC2: valuationAdjustments[1]?.adjustmentValue ?? null,
		TONG_HS_PB_DC2: valuationAdjustments[1]?.allocationRatio ?? null,
		MA_KHOAN_DC3: valuationAdjustments[2]?.nameCode ?? null,
		MA_LOAI_DC3: valuationAdjustments[2]?.classificationCode ?? null,
		MA_NT_DC3: valuationAdjustments[2]?.currencyCode ?? null,
		TRIGIA_DC3: valuationAdjustments[2]?.adjustmentValue ?? null,
		TONG_HS_PB_DC3: valuationAdjustments[2]?.allocationRatio ?? null,
		MA_KHOAN_DC4: valuationAdjustments[3]?.nameCode ?? null,
		MA_LOAI_DC4: valuationAdjustments[3]?.classificationCode ?? null,
		MA_NT_DC4: valuationAdjustments[3]?.currencyCode ?? null,
		TRIGIA_DC4: valuationAdjustments[3]?.adjustmentValue ?? null,
		TONG_HS_PB_DC4: valuationAdjustments[3]?.allocationRatio ?? null,
		MA_KHOAN_DC5: valuationAdjustments[4]?.nameCode ?? null,
		MA_LOAI_DC5: valuationAdjustments[4]?.classificationCode ?? null,
		MA_NT_DC5: valuationAdjustments[4]?.currencyCode ?? null,
		TRIGIA_DC5: valuationAdjustments[4]?.adjustmentValue ?? null,
		TONG_HS_PB_DC5: valuationAdjustments[4]?.allocationRatio ?? null,
		NOI_DUNG_KHAI_TRGIA: clean(args.cdsInfo.valuationDeclarationDetail),
		MA_NGUOI_NOP_THUE: cleanCodeWithinMax(args.cdsInfo.taxPayer, 1),
		MA_LY_DO_BP:
			args.operationType === "NHAP"
				? cleanCodeWithinMax(args.cdsInfo.releaseBeforePermitCode, 1)
				: null,
		MA_QLY_USER: clean(args.cdsInfo.internalBusinessManagementNumber),
		MA_LOAI_DINH_KEM: attachments[0]?.typeCode ?? null,
		SO_DINH_KEM: attachments[0]?.attachmentNumber ?? null,
		MA_LOAI_DINH_KEM2: attachments[1]?.typeCode ?? null,
		SO_DINH_KEM2: attachments[1]?.attachmentNumber ?? null,
		MA_LOAI_DINH_KEM3: attachments[2]?.typeCode ?? null,
		SO_DINH_KEM3: attachments[2]?.attachmentNumber ?? null,
		MA_VB_PQUY: legalDocumentCodes[0] ?? null,
		MA_VB_PQUY2: legalDocumentCodes[1] ?? null,
		MA_VB_PQUY3: legalDocumentCodes[2] ?? null,
		MA_VB_PQUY4: legalDocumentCodes[3] ?? null,
		MA_VB_PQUY5: legalDocumentCodes[4] ?? null,
		TRUNG_CHUYEN_DIA_DIEM: transportSchedules[0]?.locationCode ?? null,
		TRUNG_CHUYEN_NGAY_DEN: transportSchedules[0]?.arrivalDate ?? null,
		TRUNG_CHUYEN_NGAY_KH: transportSchedules[0]?.departureDate ?? null,
		TRUNG_CHUYEN_DIA_DIEM2: transportSchedules[1]?.locationCode ?? null,
		TRUNG_CHUYEN_NGAY_DEN2: transportSchedules[1]?.arrivalDate ?? null,
		TRUNG_CHUYEN_NGAY_KH2: transportSchedules[1]?.departureDate ?? null,
		TRUNG_CHUYEN_DIA_DIEM3: transportSchedules[2]?.locationCode ?? null,
		TRUNG_CHUYEN_NGAY_DEN3: transportSchedules[2]?.arrivalDate ?? null,
		TRUNG_CHUYEN_NGAY_KH3: transportSchedules[2]?.departureDate ?? null,
		MA_DIEM_XEP_HANG_LEN_XE: truckLoadingLocations.codes[0] ?? null,
		MA_DIEM_XEP_HANG_LEN_XE2: truckLoadingLocations.codes[1] ?? null,
		MA_DIEM_XEP_HANG_LEN_XE3: truckLoadingLocations.codes[2] ?? null,
		MA_DIEM_XEP_HANG_LEN_XE4: truckLoadingLocations.codes[3] ?? null,
		MA_DIEM_XEP_HANG_LEN_XE5: truckLoadingLocations.codes[4] ?? null,
		TEN_DIEM_XEP_HANG_LEN_XE: truckLoadingLocations.name,
		DIA_CHI_DIEM_XEP_HANG_LEN_XE: truckLoadingLocations.address,
	};

	for (let index = 0; index < 50; index += 1) {
		const column = index === 0 ? "CONTAINER_NO" : `CONTAINER_NO${index + 1}`;
		record[column] = args.containerNumbers[index] ?? null;
	}

	return record;
}

export function buildVnaccs2Record(cdsInfo: Partial<FollowUpCdsInfoRow>) {
	const importLicenses = parseImportLicenseSlots(cdsInfo);
	const partnerAddress = normalizeCdsPartnerAddressFields(cdsInfo);
	const billItems = normalizeBillItems(cdsInfo);

	return {
		MA_PHAN_LOAI_HH: cleanCode(cdsInfo.cargoClassificationCode),
		CANHAN_TOCHUC: cleanCode(cdsInfo.personOrganizationClassification),
		MA_HIEU_PTVC: cleanCode(cdsInfo.transportMethodCode),
		NHOM_HO_SO: normalizeBusinessTypeGroup(
			cdsInfo.businessTypeGroup,
			cdsInfo.operationCode,
		),
		DIA_CHI_DT1: clean(
			partnerAddress.partnerAddress1 ?? cdsInfo.partnerAddress1,
		),
		DIA_CHI_DT2: clean(
			partnerAddress.partnerAddress2 ?? cdsInfo.partnerAddress2,
		),
		DIA_CHI_DT3: clean(
			partnerAddress.partnerAddress3 ?? cdsInfo.partnerAddress3,
		),
		DIA_CHI_DT4: clean(
			partnerAddress.partnerAddress4 ?? cdsInfo.partnerAddress4,
		),
		BL_THUE_MA_NG_HANG: cleanCode(cdsInfo.taxSubstituteBankCode),
		BL_THUE_KY_HIEU_CT: firstNonEmpty(
			cdsInfo.guaranteeDocumentSymbol,
			cdsInfo.creditLimitDocumentSymbol,
		),
		BL_THUE_SO_CT: firstNonEmpty(
			cdsInfo.guaranteeDocumentNumber,
			cdsInfo.creditLimitDocumentNumber,
		),
		BL_THUE_NAM_CT: toNumber(cdsInfo.creditLimitIssueYear),
		MA_DD_LUU_KHO: cleanCode(cdsInfo.warehouseLocationCode),
		MA_GP2: importLicenses[1]?.code ?? null,
		SO_GP2: importLicenses[1]?.number ?? null,
		MA_GP3: importLicenses[2]?.code ?? null,
		SO_GP3: importLicenses[2]?.number ?? null,
		MA_GP4: importLicenses[3]?.code ?? null,
		SO_GP4: importLicenses[3]?.number ?? null,
		MA_GP5: importLicenses[4]?.code ?? null,
		SO_GP5: importLicenses[4]?.number ?? null,
		VAN_DON2: billItems[1]?.billNumber ?? null,
		VAN_DON3: billItems[2]?.billNumber ?? null,
		VAN_DON4: billItems[3]?.billNumber ?? null,
		VAN_DON5: billItems[4]?.billNumber ?? null,
		NGAY_VAN_DON: billItems[0]?.billDate ?? null,
		NGAY_VAN_DON2: billItems[1]?.billDate ?? null,
		NGAY_VAN_DON3: billItems[2]?.billDate ?? null,
		NGAY_VAN_DON4: billItems[3]?.billDate ?? null,
		NGAY_VAN_DON5: billItems[4]?.billDate ?? null,
		VAN_DON_MAWB: billItems[0]?.hawbNumber ?? null,
		VAN_DON_MAWB2: billItems[1]?.hawbNumber ?? null,
		VAN_DON_MAWB3: billItems[2]?.hawbNumber ?? null,
		VAN_DON_MAWB4: billItems[3]?.hawbNumber ?? null,
		VAN_DON_MAWB5: billItems[4]?.hawbNumber ?? null,
		VAN_DON_NAM: billItems[0]?.mawbYear ?? null,
		VAN_DON_NAM2: billItems[1]?.mawbYear ?? null,
		VAN_DON_NAM3: billItems[2]?.mawbYear ?? null,
		VAN_DON_NAM4: billItems[3]?.mawbYear ?? null,
		VAN_DON_NAM5: billItems[4]?.mawbYear ?? null,
	} satisfies SqlRecord;
}

export function buildCargoRowRecord(
	row: HanCargoRowInput,
	declarationId: number,
	rowIndex: number,
	context: HanCargoRowContext = {},
) {
	const qty = toNumber(row.qty);
	const qty2 = toNumber(row.qty2);
	const unitPrice = toNumber(row.unitPrice);
	const importTaxRate = toNumber(row.importTaxRate);
	const importTaxAmount = toNumber(row.importTaxAmount);
	const vatTaxRate = toNumber(row.vatTaxRate);
	const vatTaxAmount = toNumber(row.vatTaxAmount);
	const totalPrice =
		toNumber(row.totalPrice) ??
		(qty !== null && unitPrice !== null ? qty * unitPrice : null);
	const priceUnit = cleanCodeWithinMax(row.unit, 4);
	const invoiceCurrency = cleanCodeWithinMax(context.invoiceCurrency, 3);
	const taxableCurrency = cleanCodeWithinMax(
		context.taxableValueCurrencyCode,
		3,
	);

	return {
		_DToKhaiMDID: declarationId,
		STTHANG: rowIndex + 1,
		MA_LH: cleanCodeWithinMax(context.operationCode, 5),
		MA_HQ: cleanCodeWithinMax(context.customsCode, 6),
		MA_HANGKB: clean(row.customCode),
		MA_HTS: clean(row.hsCode),
		NUOC_XX: cleanCode(row.originalCountry),
		TEN_HANG: firstNonEmpty(row.vietnameseName, row.originalCargoName),
		TEN_HANG_E: clean(row.originalCargoName),
		MA_PHU: cleanCode(row.dutyReductionCode),
		MA_DVT: cleanCode(row.unit),
		LUONG: qty,
		DVT_HTS: cleanCode(row.unit),
		LUONG_HTS: qty,
		DGIA_KB: unitPrice,
		DONGIA_HTS: unitPrice,
		TRIGIA_KB: totalPrice,
		MA_NT_DGIA_HDTM: invoiceCurrency,
		DVT_DGIA_HDTM: priceUnit,
		DGIA_HDTM: unitPrice,
		TRIGIA_HDTM: totalPrice,
		MA_NT_TRIGIA_TT_S: taxableCurrency,
		MA_NT_DGIA_TT: taxableCurrency,
		DVT_DGIA_TT: priceUnit,
		MIENTHUE_MA: cleanCode(row.imExDutyExemptionCode),
		LUONG2: qty2,
		MA_DVT2: cleanCode(row.unit2),
		TS_XNK_MA_BT: cleanCode(row.importTaxCode),
		TS_XNK: importTaxRate,
		THUE_XNK: importTaxAmount,
		TS_VAT_MA_BT: cleanCode(row.vatTaxCode),
		TS_VAT: vatTaxRate,
		THUE_VAT: vatTaxAmount,
		DK_MIEN_GIAM_THUE: clean(row.imExDutyExemptionCondition),
		MIENTHUE_THUE_GIAM: toNumber(row.imExDutyExemptionAmount),
	} satisfies SqlRecord;
}

export function buildDdsContTkRecord(args: {
	declarationId: number;
	cdsInfo: Partial<FollowUpCdsInfoRow>;
	operationType: FollowUpOperationType;
	declarationNumber: string | null;
	companyTaxCode: string | null;
	fallbackDeclarationDate?: Date | null;
	supervisionCustomsCode?: string | null;
	hasContainers?: boolean;
}) {
	const technicalDeclarationDate =
		toSqlDate(args.cdsInfo.expectedDeclarationDate) ??
		args.fallbackDeclarationDate ??
		toSqlDate(args.cdsInfo.commercialInvoiceDate) ??
		new Date();
	const declarationDate =
		args.operationType === "XUAT" ? technicalDeclarationDate : null;
	// Import DDS leaves the arrival date empty unless CDS states it explicitly —
	// only export falls back to the departure/arrival date.
	const estimatedArrivalDate =
		args.operationType === "XUAT"
			? (toSqlDate(args.cdsInfo.estimatedArrivalAtDestinationDate) ??
				toSqlDate(args.cdsInfo.departureArrivalDate))
			: toSqlDate(args.cdsInfo.estimatedArrivalAtDestinationDate);
	const billItems = normalizeBillItems(args.cdsInfo);
	const goodsIdentity = firstNonEmpty(
		args.cdsInfo.billOfLading,
		billItems[0]?.billNumber,
	);
	const shouldWriteGoodsIdentity =
		args.cdsInfo.seaportSupervisionEnabled === true ||
		args.cdsInfo.airportSupervisionEnabled === true;

	return {
		_DTOKHAIMDID: args.declarationId,
		// HAN live schema keeps DDS_CONT_TK.NgayKB non-nullable even for import
		// drafts. Use an internal fallback date here while leaving visible import
		// declaration/arrival dates empty on DTOKHAIMD and DDS_CONT_TK.
		NgayKB: technicalDeclarationDate,
		SOTK: toNumber(args.declarationNumber),
		MA_DV: args.companyTaxCode,
		MA_HQ: cleanCode(args.cdsInfo.customsCode),
		NGAY_DK: declarationDate,
		MA_LH: cleanCode(args.cdsInfo.operationCode),
		isContainer: args.hasContainers ? 1 : 0,
		TTTK: "N",
		NOTE: clean(args.cdsInfo.note),
		MA_HQ_GIAMSAT: cleanCodeWithinMax(args.supervisionCustomsCode, 8),
		MA_PTVC: toNumber(args.cdsInfo.transportMethodCode),
		NGAY_TAU_DEN: estimatedArrivalDate,
		MA_DIA_DIEM: normalizeDdsTaxDestinationCode(
			args.cdsInfo.taxDestinationLocation,
		),
		DINH_DANH_HANG_HOA: shouldWriteGoodsIdentity
			? cleanWithinMax(goodsIdentity, 255)
			: null,
	} satisfies SqlRecord;
}

export function shouldWriteDdsContTkRecord(args: {
	cdsInfo: Partial<FollowUpCdsInfoRow>;
	containerNumbers: string[];
	operationType: FollowUpOperationType;
}) {
	if (
		args.cdsInfo.seaportSupervisionEnabled === true ||
		args.cdsInfo.airportSupervisionEnabled === true
	) {
		return true;
	}

	if (args.containerNumbers.length > 0) {
		return true;
	}

	if (clean(args.cdsInfo.note)) {
		return true;
	}

	if (args.operationType === "NHAP") {
		const importDdsLocationCode = cleanCode(
			args.cdsInfo.taxDestinationLocation,
		);
		const importEstimatedArrivalDate = toSqlDate(
			args.cdsInfo.estimatedArrivalAtDestinationDate,
		);

		return Boolean(importDdsLocationCode || importEstimatedArrivalDate);
	}

	const ddsLocationCode = cleanCode(args.cdsInfo.taxDestinationLocation);
	const estimatedArrivalDate =
		toSqlDate(args.cdsInfo.estimatedArrivalAtDestinationDate) ??
		toSqlDate(args.cdsInfo.departureArrivalDate);

	return Boolean(ddsLocationCode || estimatedArrivalDate);
}

export async function registerCdsIntoHan(
	input: RegisterCdsIntoHanInput,
): Promise<RegisterCdsIntoHanResult> {
	const operationType = deriveOperationType({
		operationType: input.operationType ?? null,
		operationCode: input.cdsInfo.operationCode,
	});

	if (!operationType) {
		throw new Error("Không xác định được loại hình tờ khai để ghi HAN_2024.");
	}

	const sqlConfig = parseMssqlConnectionString(input.connectionString, {
		appName: "vvmv-cds-register",
	});

	if (!sqlConfig) {
		throw new Error("Connection HAN_2024 không hợp lệ.");
	}

	const pool = await connectHanPoolWithTlsFallback(sqlConfig);

	const transaction = new sql.Transaction(pool);
	await transaction.begin();

	const insertedTables: string[] = [];
	const updatedTables: string[] = [];
	const sanitizedCargoList = sanitizeCargoListPayload(input.cargoList);
	const containerNumbers = normalizeContainerNumbers(input.containers);
	const truncationWarnings = new Set<string>();
	const hanMetadataMap = await getHanColumnMetadataMap(
		input.connectionString,
	).catch((error) => {
		console.warn(
			"Failed to load HAN_2024 column metadata for register guard:",
			error,
		);
		return new Map<string, HanColumnMetadata>();
	});
	const sanitizeForTable = (tableName: string, record: SqlRecord) => {
		const { sanitizedRecord, warnings } = sanitizeRecordForHanTable({
			tableName,
			record,
			metadataMap: hanMetadataMap,
		});

		warnings.forEach((warning) => {
			truncationWarnings.add(warning);
		});
		return sanitizedRecord;
	};
	const headerRecord = buildHeaderRecord({
		cdsInfo: input.cdsInfo,
		operationType,
		followUpTaxCode: input.followUpTaxCode,
		followUpCompanyName: input.followUpCompanyName,
		followUpSummary: input.followUpSummary,
		declarations: input.declarations,
		containerNumbers,
	});
	const vnaccsPayloadRecord = buildVnaccsRecord({
		cdsInfo: input.cdsInfo,
		containerNumbers,
		operationType,
	});
	const vnaccs2PayloadRecord = buildVnaccs2Record(input.cdsInfo);

	const sanitizedHeaderRecord = sanitizeForTable("DTOKHAIMD", headerRecord);

	const companyTaxCode = cleanCode(
		firstNonEmpty(
			input.followUpTaxCode,
			input.followUpSummary?.taxCode,
			input.cdsInfo.importerCode,
		),
	);
	const declarationNumber =
		clean(sanitizedHeaderRecord.SOTK) ??
		clean(sanitizedHeaderRecord.SOTK_DAU_TIEN);
	const primaryDeclaration = getPrimaryDeclaration(input.declarations);
	const ddsFallbackDeclarationDate =
		toSqlDate(primaryDeclaration?.declarationDate) ?? null;

	let declarationId = Number(input.declarationId ?? 0);
	let ddsContTkId: number | null = null;

	try {
		if (declarationId > 0) {
			const request = new sql.Request(transaction);
			request.input("declarationId", sql.Numeric(18, 0), declarationId);
			const result = await request.query<{ total: number }>(`
        SELECT COUNT(1) AS total
        FROM dbo.DTOKHAIMD
        WHERE _DToKhaiMDID = @declarationId;
      `);

			if (Number(result.recordset[0]?.total ?? 0) === 0) {
				throw new Error("Không tìm thấy bản ghi HAN_2024 để cập nhật.");
			}

			const headerUpdate = buildUpdateQuery(
				"DTOKHAIMD",
				"_DToKhaiMDID",
				declarationId,
				sanitizedHeaderRecord,
			);
			await executeWithBindings(
				new sql.Request(transaction),
				headerUpdate.bindings,
				headerUpdate.sql,
			);
			updatedTables.push("DTOKHAIMD");
		} else {
			const headerInsert = buildInsertQuery(
				"DTOKHAIMD",
				"_DToKhaiMDID",
				sanitizedHeaderRecord,
			);
			const result = await executeWithBindings(
				new sql.Request(transaction),
				headerInsert.bindings,
				headerInsert.sql,
			);
			declarationId = Number(result.recordset[0]?.insertedId ?? 0);

			if (!Number.isFinite(declarationId) || declarationId <= 0) {
				throw new Error("Không lấy được ID tờ khai mới từ HAN_2024.");
			}

			insertedTables.push("DTOKHAIMD");
		}

		const vnaccsPayload = sanitizeForTable(
			"DTOKHAIMD_VNACCS",
			vnaccsPayloadRecord,
		);
		const vnaccsRecord = {
			_DTOKHAIMDID: declarationId,
			...vnaccsPayload,
		} satisfies SqlRecord;
		const hasVnaccs = await rowExists(
			transaction,
			"DTOKHAIMD_VNACCS",
			declarationId,
		);
		if (hasVnaccs) {
			const update = buildUpdateQuery(
				"DTOKHAIMD_VNACCS",
				"_DTOKHAIMDID",
				declarationId,
				vnaccsPayload,
			);
			await executeWithBindings(
				new sql.Request(transaction),
				update.bindings,
				update.sql,
			);
			updatedTables.push("DTOKHAIMD_VNACCS");
		} else {
			const insert = buildInsertQuery(
				"DTOKHAIMD_VNACCS",
				"DTOKHAIMD_VNACCSID",
				vnaccsRecord,
			);
			await executeWithBindings(
				new sql.Request(transaction),
				insert.bindings,
				insert.sql,
			);
			insertedTables.push("DTOKHAIMD_VNACCS");
		}

		const vnaccs2Payload = sanitizeForTable(
			"DTOKHAIMD_VNACCS2",
			vnaccs2PayloadRecord,
		);
		const hasVnaccs2 = await rowExists(
			transaction,
			"DTOKHAIMD_VNACCS2",
			declarationId,
		);
		if (hasVnaccs2) {
			const update = buildUpdateQuery(
				"DTOKHAIMD_VNACCS2",
				"_DTOKHAIMDID",
				declarationId,
				vnaccs2Payload,
			);
			await executeWithBindings(
				new sql.Request(transaction),
				update.bindings,
				update.sql,
			);
			updatedTables.push("DTOKHAIMD_VNACCS2");
		} else {
			const insert = buildInsertQuery(
				"DTOKHAIMD_VNACCS2",
				"DTOKHAIMD_VNACCS2ID",
				{
					_DTOKHAIMDID: declarationId,
					...vnaccs2Payload,
				},
			);
			await executeWithBindings(
				new sql.Request(transaction),
				insert.bindings,
				insert.sql,
			);
			insertedTables.push("DTOKHAIMD_VNACCS2");
		}

		const existingCargoCount = await countRows(
			transaction,
			"DHANGMDDK",
			declarationId,
			"_DToKhaiMDID",
		);
		const cargoDeleteRequest = new sql.Request(transaction);
		cargoDeleteRequest.input(
			"declarationId",
			sql.Numeric(18, 0),
			declarationId,
		);
		await cargoDeleteRequest.query(`
      DELETE FROM dbo.DHANGMDDK
      WHERE _DToKhaiMDID = @declarationId;
    `);

		for (let index = 0; index < sanitizedCargoList.length; index += 1) {
			const cargoRecord = sanitizeForTable(
				"DHANGMDDK",
				buildCargoRowRecord(sanitizedCargoList[index], declarationId, index, {
					operationCode: input.cdsInfo.operationCode,
					customsCode: input.cdsInfo.customsCode,
					invoiceCurrency: input.cdsInfo.invoiceCurrency,
					taxableValueCurrencyCode: input.cdsInfo.taxableValueCurrencyCode,
				}),
			);
			const insert = buildInsertQuery("DHANGMDDK", "_DHangMDDKID", cargoRecord);
			await executeWithBindings(
				new sql.Request(transaction),
				insert.bindings,
				insert.sql,
			);
		}

		if (existingCargoCount > 0) {
			updatedTables.push("DHANGMDDK");
		} else if (sanitizedCargoList.length > 0) {
			insertedTables.push("DHANGMDDK");
		}

		const existingDdsCount = await countRows(
			transaction,
			"DDS_CONT_TK",
			declarationId,
			"_DTOKHAIMDID",
		);
		const ddsDeleteRequest = new sql.Request(transaction);
		ddsDeleteRequest.input("declarationId", sql.Numeric(18, 0), declarationId);
		await ddsDeleteRequest.query(`
      DELETE FROM dbo.DDS_CONT_TK
      WHERE _DTOKHAIMDID = @declarationId;
    `);

		if (
			shouldWriteDdsContTkRecord({
				cdsInfo: input.cdsInfo,
				containerNumbers,
				operationType,
			})
		) {
			const ddsLocationCode = normalizeDdsTaxDestinationCode(
				input.cdsInfo.taxDestinationLocation,
			);
			const ddsSupervisionCustomsCode = await resolveDdsSupervisionCustomsCode(
				transaction,
				ddsLocationCode,
			);
			const ddsRecord = sanitizeForTable(
				"DDS_CONT_TK",
				buildDdsContTkRecord({
					declarationId,
					cdsInfo: input.cdsInfo,
					operationType,
					declarationNumber,
					companyTaxCode,
					fallbackDeclarationDate: ddsFallbackDeclarationDate,
					supervisionCustomsCode: ddsSupervisionCustomsCode,
					hasContainers: containerNumbers.length > 0,
				}),
			);
			const ddsInsert = buildInsertQuery(
				"DDS_CONT_TK",
				"DDS_CONT_TKID",
				ddsRecord,
			);
			const result = await executeWithBindings(
				new sql.Request(transaction),
				ddsInsert.bindings,
				ddsInsert.sql,
			);
			ddsContTkId = Number(result.recordset[0]?.insertedId ?? 0) || null;

			if (existingDdsCount > 0) {
				updatedTables.push("DDS_CONT_TK");
			} else {
				insertedTables.push("DDS_CONT_TK");
			}
		} else if (existingDdsCount > 0) {
			updatedTables.push("DDS_CONT_TK");
		}

		await transaction.commit();
	} catch (error) {
		await transaction.rollback().catch(() => undefined);
		throw error;
	} finally {
		await pool.close();
	}

	let writtenDeclaration: HanDeclarationPrefillMatch | null = null;
	try {
		writtenDeclaration = await loadHanDeclarationPrefillById({
			connectionString: input.connectionString,
			declarationId,
		});
	} catch {
		writtenDeclaration = null;
	}

	const companyRoutingWarning = buildCompanyRoutingWarning({
		cdsInfo: input.cdsInfo,
		followUpTaxCode: input.followUpTaxCode,
		followUpCompanyName: input.followUpCompanyName,
		followUpSummary: input.followUpSummary,
	});
	const warningSet = new Set<string>([
		...(input.warnings ?? []),
		...Array.from(truncationWarnings),
		...(companyRoutingWarning ? [companyRoutingWarning] : []),
		...getUnverifiedHanMappingWarnings(input.cdsInfo),
	]);

	if (!writtenDeclaration) {
		warningSet.add(
			"Đã ghi HAN_2024 nhưng không đọc lại được bản ghi để verify round-trip.",
		);
	}

	const verify = buildCdsHanVerificationSummary({
		current: input.cdsInfo,
		candidate: writtenDeclaration?.prefill ?? {},
		currentCargoList: sanitizedCargoList,
		candidateCargoList: writtenDeclaration?.cargoList ?? [],
		warnings: Array.from(warningSet),
	});

	if (!verify.passed) {
		warningSet.add(
			`Round-trip verify còn ${verify.header.totalDifferentFields} lệch header và ${verify.cargo.totalDifferentFields} lệch cargo.`,
		);
	}

	return {
		status: input.declarationId ? "reused" : "inserted",
		declarationId,
		declarationNumber:
			writtenDeclaration?.declarationNumber ?? declarationNumber ?? null,
		roundTripDeclaration: writtenDeclaration,
		operationType,
		ddsContTkId,
		insertedTables: Array.from(new Set(insertedTables)),
		updatedTables: Array.from(new Set(updatedTables)),
		containerDetailCount: containerNumbers.length,
		localDeclarationId: input.localDeclarationId ?? null,
		warnings: Array.from(warningSet),
		verify,
	};
}
