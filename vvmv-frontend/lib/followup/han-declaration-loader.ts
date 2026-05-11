import sql from "mssql";
import type {
	CargoListRow,
	FollowUpCdsInfoRow,
} from "@/app/(home)/internal/followup/types";
import { parseMssqlConnectionString } from "@/lib/db/mssql-connection-string";
import type { FollowUpOperationType } from "@/lib/followup/operation-type";
import {
	normalizeProcessingDepartmentOperationCodes,
	type ProcessingDepartmentLookup,
	pickPreferredProcessingDepartment,
} from "@/lib/followup/processing-department";

type SqlRow = Record<string, unknown>;

const CUSTOMS_WAREHOUSE_V2_LABEL_APPLY_SQL = `
      OUTER APPLY (
        SELECT TOP (1)
          CAST(locationLabels.label AS NVARCHAR(512)) AS label
        FROM (
          SELECT
            CAST(
              COALESCE(
                NULLIF(CAST(TEN_DIA_DIEM_VN AS NVARCHAR(512)), ''),
                NULLIF(CAST(TEN_DIA_DIEM_TCVN_VN AS NVARCHAR(512)), ''),
                NULLIF(CAST(TEN_DIA_DIEM_TCVN AS NVARCHAR(512)), ''),
                NULLIF(CAST(TEN_DIA_DIEM AS NVARCHAR(512)), '')
              ) AS NVARCHAR(512)
            ) AS label,
            1 AS priority
          FROM dbo.SDIA_DIEM WITH (NOLOCK)
          WHERE
            UPPER(LTRIM(RTRIM(CAST(MA_DIA_DIEM AS NVARCHAR(64))))) =
              UPPER(LTRIM(RTRIM(CAST(v2.MA_DD_LUU_KHO AS NVARCHAR(64)))))
            AND ISNULL(HIENTHI, -1) <> 0

          UNION ALL

          SELECT
            CAST(
              COALESCE(
                NULLIF(CAST(TEN_CK_VN AS NVARCHAR(512)), ''),
                NULLIF(CAST(TEN_CU AS NVARCHAR(512)), ''),
                NULLIF(CAST(Ten_CK1_VN AS NVARCHAR(512)), ''),
                NULLIF(CAST(Ten_CK1 AS NVARCHAR(512)), ''),
                NULLIF(CAST(Ten_CK AS NVARCHAR(512)), '')
              ) AS NVARCHAR(512)
            ) AS label,
            2 AS priority
          FROM dbo.SCUAKHAU WITH (NOLOCK)
          WHERE
            UPPER(LTRIM(RTRIM(CAST(Ma_CK AS NVARCHAR(64))))) =
              UPPER(LTRIM(RTRIM(CAST(v2.MA_DD_LUU_KHO AS NVARCHAR(64)))))
            AND ISNULL(HienThi, -1) <> 0

          UNION ALL

          SELECT
            CAST(
              COALESCE(
                NULLIF(CAST(TEN_CK_VN AS NVARCHAR(512)), ''),
                NULLIF(CAST(TEN_CU AS NVARCHAR(512)), ''),
                NULLIF(CAST(Ten_CK1_VN AS NVARCHAR(512)), ''),
                NULLIF(CAST(Ten_CK1 AS NVARCHAR(512)), ''),
                NULLIF(CAST(Ten_CK AS NVARCHAR(512)), '')
              ) AS NVARCHAR(512)
            ) AS label,
            3 AS priority
          FROM dbo.SCUAKHAUNN WITH (NOLOCK)
          WHERE
            UPPER(LTRIM(RTRIM(CAST(MA_CK AS NVARCHAR(64))))) =
              UPPER(LTRIM(RTRIM(CAST(v2.MA_DD_LUU_KHO AS NVARCHAR(64)))))
            AND ISNULL(HienThi, -1) <> 0
        ) locationLabels
        WHERE NULLIF(LTRIM(RTRIM(locationLabels.label)), '') IS NOT NULL
        ORDER BY locationLabels.priority
      ) customsWarehouseV2Label
`;

export type HanDeclarationStatusFlags = {
	xOrN: string | null;
	tttk: string | null;
	isTqdt: number | null;
	isDuyet: number | null;
	isDaDuyet: number | null;
	isCreatePtq: number | null;
	kdtLastInfo: string | null;
};

export type HanDeclarationCandidate = {
	declarationId: number;
	declarationNumber: string | null;
	declarationDate: string | null;
	taxCode: string | null;
	companyName: string | null;
	operationCode: string | null;
	customsCode: string | null;
	containerCount: number;
	statusFlags: HanDeclarationStatusFlags;
	prefill: Partial<FollowUpCdsInfoRow>;
};

export type HanDeclarationPrefillMatch = {
	declarationId: number;
	declarationNumber: string | null;
	declarationDate: string | null;
	taxCode: string | null;
	companyName: string | null;
	operationCode: string | null;
	xOrN: string | null;
	prefill: Partial<FollowUpCdsInfoRow>;
	cargoList: Array<Partial<CargoListRow>>;
};

export type HanCompanyPartyProfile = {
	taxCode: string | null;
	companyName: string | null;
	importerPostalCode: string | null;
	importExportBusinessAddress: string | null;
	importerPhone: string | null;
	sourceDeclarationId: number | null;
	sourceDeclarationNumber: string | null;
	sourceDeclarationDate: string | null;
};

type HanCompanyPartyProfileTextField =
	| "taxCode"
	| "companyName"
	| "importerPostalCode"
	| "importExportBusinessAddress"
	| "importerPhone";

function buildHanCargoPrefill(row: SqlRow) {
	return {
		customCode: clean(row.customCode),
		hsCode: clean(row.hsCode),
		originalCountry: cleanCode(row.originalCountry),
		originalCargoName: clean(row.originalCargoName),
		vietnameseName: clean(row.vietnameseName),
		dutyReductionCode: cleanCode(row.dutyReductionCode),
		imExDutyExemptionCode: cleanCode(row.imExDutyExemptionCode),
		qty: toNumber(row.qty),
		unit: cleanCode(row.unit),
		unitPrice: toNumber(row.unitPrice),
		totalPrice: toNumber(row.totalPrice),
		qty2: toNumber(row.qty2),
		unit2: cleanCode(row.unit2),
		importTaxCode: cleanCode(row.importTaxCode),
		importTaxRate: toNumber(row.importTaxRate),
		importTaxAmount: toNumber(row.importTaxAmount),
		vatTaxCode: cleanCode(row.vatTaxCode),
		vatTaxRate: toNumber(row.vatTaxRate),
		vatTaxAmount: toNumber(row.vatTaxAmount),
		imExDutyExemptionCondition: clean(row.imExDutyExemptionCondition),
		imExDutyExemptionAmount: toNumber(row.imExDutyExemptionAmount),
	} satisfies Partial<CargoListRow>;
}

function resolveHanCounterpartyCode(row: SqlRow, isImport: boolean) {
	return cleanCode(isImport ? row.partnerSenderCode : row.partnerReceiverCode);
}

function resolveHanCounterpartyName(row: SqlRow, isImport: boolean) {
	return (
		clean(isImport ? row.partnerSenderName : row.partnerReceiverName) ??
		clean(row.partnerName)
	);
}

async function loadHanCargoByDeclarationId(
	pool: sql.ConnectionPool,
	declarationId: number,
) {
	const request = pool.request();
	request.input("declarationId", sql.Numeric(18, 0), declarationId);

	const result = await request.query<SqlRow>(`
    SELECT
      CAST(COALESCE(c.MA_HANGKB, c.MA_HANG) AS NVARCHAR(128)) AS customCode,
      CAST(c.MA_HTS AS NVARCHAR(64)) AS hsCode,
      CAST(c.NUOC_XX AS NVARCHAR(32)) AS originalCountry,
      CAST(COALESCE(c.TEN_HANG_E, c.TEN_HANG) AS NVARCHAR(1024)) AS originalCargoName,
      CAST(c.TEN_HANG AS NVARCHAR(1024)) AS vietnameseName,
      CAST(c.MA_PHU AS NVARCHAR(64)) AS dutyReductionCode,
      CAST(c.MIENTHUE_MA AS NVARCHAR(64)) AS imExDutyExemptionCode,
      COALESCE(c.LUONG_HTS, c.LUONG) AS qty,
      CAST(COALESCE(c.DVT_HTS, c.MA_DVT, c.DVT_DGIA_HDTM) AS NVARCHAR(32)) AS unit,
      COALESCE(c.DONGIA_HTS, c.DGIA_HDTM, c.DGIA_KB) AS unitPrice,
      COALESCE(c.TRIGIA_HDTM, c.TRIGIA_KB) AS totalPrice,
      c.LUONG2 AS qty2,
      CAST(c.MA_DVT2 AS NVARCHAR(32)) AS unit2,
      CAST(c.TS_XNK_MA_BT AS NVARCHAR(64)) AS importTaxCode,
      c.TS_XNK AS importTaxRate,
      c.THUE_XNK AS importTaxAmount,
      CAST(c.TS_VAT_MA_BT AS NVARCHAR(64)) AS vatTaxCode,
      c.TS_VAT AS vatTaxRate,
      c.THUE_VAT AS vatTaxAmount,
      CAST(c.DK_MIEN_GIAM_THUE AS NVARCHAR(512)) AS imExDutyExemptionCondition,
      c.MIENTHUE_THUE_GIAM AS imExDutyExemptionAmount
    FROM dbo.DHANGMDDK c WITH (NOLOCK)
    WHERE c._DToKhaiMDID = @declarationId
    ORDER BY c._DHangMDDKID ASC;
  `);

	return result.recordset.map((row) => buildHanCargoPrefill(row));
}

async function loadHanProcessingDepartmentsByCustomsCodes(
	pool: sql.ConnectionPool,
	customsCodes: Array<string | null | undefined>,
) {
	const normalizedCustomsCodes = [
		...new Set(
			customsCodes
				.map((value) => cleanCode(value))
				.filter((value): value is string => Boolean(value)),
		),
	];

	if (normalizedCustomsCodes.length === 0) {
		return [];
	}

	const request = pool.request();
	normalizedCustomsCodes.forEach((customsCode, index) => {
		request.input(`customsCode${index}`, sql.NVarChar(32), customsCode);
	});

	const result = await request.query<SqlRow>(`
    SELECT
      CAST(s.MA AS NVARCHAR(32)) AS code,
      CAST(s.MA_HQ AS NVARCHAR(32)) AS customsCode,
      CAST(
        COALESCE(
          NULLIF(CAST(s.TEN_TCVN AS NVARCHAR(512)), ''),
          NULLIF(CAST(s.TEN AS NVARCHAR(512)), '')
        ) AS NVARCHAR(512)
      ) AS name,
      CAST(s.MA_LH_XLY AS NVARCHAR(512)) AS operationCodes,
      CASE WHEN s.IDA = 1 THEN 1 ELSE 0 END AS allowImport,
      CASE WHEN s.EDA = 1 THEN 1 ELSE 0 END AS allowExport
    FROM dbo.SHAIQUAN_Sub s WITH (NOLOCK)
    WHERE
      ISNULL(LTRIM(RTRIM(CAST(s.MA AS NVARCHAR(32)))), '') <> ''
      AND ISNULL(LTRIM(RTRIM(CAST(s.MA_HQ AS NVARCHAR(32)))), '') <> ''
      AND ISNULL(s.HienThi, -1) <> 0
      AND UPPER(LTRIM(RTRIM(CAST(s.MA_HQ AS NVARCHAR(32))))) IN (${normalizedCustomsCodes
				.map((_, index) => `@customsCode${index}`)
				.join(", ")})
    ORDER BY
      UPPER(LTRIM(RTRIM(CAST(s.MA_HQ AS NVARCHAR(32))))),
      UPPER(LTRIM(RTRIM(CAST(s.MA AS NVARCHAR(32)))));
  `);

	return result.recordset
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
				allowImport: row.allowImport === 1,
				allowExport: row.allowExport === 1,
			} satisfies ProcessingDepartmentLookup;
		})
		.filter((item): item is ProcessingDepartmentLookup => item !== null);
}

function clean(value: unknown): string | null {
	const text = String(value ?? "").trim();
	return text === "" ? null : text;
}

function cleanCode(value: unknown): string | null {
	return clean(value)?.toUpperCase() ?? null;
}

function directionFromXOrN(value: unknown) {
	const normalized = cleanCode(value);

	if (normalized === "N") {
		return "import" as const;
	}

	if (normalized === "X") {
		return "export" as const;
	}

	return "unknown" as const;
}

function resolveHanProcessingDepartmentCode(
	departments: ProcessingDepartmentLookup[],
	row: SqlRow,
) {
	return (
		pickPreferredProcessingDepartment(departments, {
			customsCode: cleanCode(row.customsCode),
			operationCode: cleanCode(row.operationCode),
			direction: directionFromXOrN(row.xOrN),
		})?.code ?? null
	);
}

function toNumber(value: unknown): number | null {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}

	const normalized = clean(value);
	if (!normalized) {
		return null;
	}

	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(value: unknown): string | null {
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
		? normalized
		: parsed.toISOString().slice(0, 10);
}

function normalizeTaxCode(value: unknown): string | null {
	const digits = String(value ?? "").replace(/\D+/g, "");
	return digits || null;
}

function isPlaceholderPostalCode(value: unknown): boolean {
	return clean(value)?.toLowerCase() === "x";
}

function shouldUseHanCompanyPartyValue(
	field: HanCompanyPartyProfileTextField,
	currentValue: unknown,
	nextValue: unknown,
) {
	if (nextValue === null || nextValue === undefined || nextValue === "") {
		return false;
	}

	if (
		currentValue === null ||
		currentValue === undefined ||
		currentValue === ""
	) {
		return true;
	}

	return (
		field === "importerPostalCode" &&
		isPlaceholderPostalCode(currentValue) &&
		!isPlaceholderPostalCode(nextValue)
	);
}

export async function loadHanCompanyPartyProfileByTaxCode(options: {
	connectionString: string;
	taxCode: string;
}): Promise<HanCompanyPartyProfile | null> {
	const taxCode = normalizeTaxCode(options.taxCode);
	if (!taxCode) {
		return null;
	}

	const sqlConfig = parseMssqlConnectionString(options.connectionString, {
		appName: "vvmv-han-company-party-profile",
	});

	if (!sqlConfig) {
		throw new Error("Connection HAN_2024 không hợp lệ.");
	}

	const pool = new sql.ConnectionPool(sqlConfig);
	await pool.connect();

	try {
		await pool
			.request()
			.query(
				"SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED; SET LOCK_TIMEOUT 5000;",
			);

		const request = pool.request();
		request.input("taxCode", sql.NVarChar(32), taxCode);

		const result = await request.query<SqlRow>(`
      SELECT TOP (50)
        CAST(h._DToKhaiMDID AS BIGINT) AS declarationId,
        CAST(h.SOTK AS NVARCHAR(64)) AS declarationNumber,
        h.NGAY_DK AS declarationDate,
        CAST(h.MA_DV AS NVARCHAR(32)) AS taxCode,
        CAST(h._Ten_DV_L1 AS NVARCHAR(512)) AS companyName,
        CAST(h.MA_BC_DV AS NVARCHAR(20)) AS importerPostalCode,
        CAST(h.DIA_CHI_DV AS NVARCHAR(500)) AS importExportBusinessAddress,
        CAST(h.SO_DT_DV AS NVARCHAR(50)) AS importerPhone
      FROM dbo.DTOKHAIMD h WITH (NOLOCK)
      WHERE REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(LTRIM(RTRIM(CAST(h.MA_DV AS NVARCHAR(32)))), ' ', ''),
            '-',
            ''
          ),
          '.',
          ''
        ),
        '/',
        ''
      ) = @taxCode
      ORDER BY
        COALESCE(h.NGAY_DK, '1900-01-01') DESC,
        h._DToKhaiMDID DESC;
    `);

		const merged: HanCompanyPartyProfile = {
			taxCode,
			companyName: null,
			importerPostalCode: null,
			importExportBusinessAddress: null,
			importerPhone: null,
			sourceDeclarationId: null,
			sourceDeclarationNumber: null,
			sourceDeclarationDate: null,
		};

		for (const row of result.recordset) {
			const sourceDeclarationId = toNumber(row.declarationId);
			const sourceDeclarationNumber = clean(row.declarationNumber);
			const sourceDeclarationDate = toIsoDate(row.declarationDate);

			if (!merged.sourceDeclarationId && sourceDeclarationId !== null) {
				merged.sourceDeclarationId = sourceDeclarationId;
				merged.sourceDeclarationNumber = sourceDeclarationNumber;
				merged.sourceDeclarationDate = sourceDeclarationDate;
			}

			const nextValues: Pick<
				HanCompanyPartyProfile,
				HanCompanyPartyProfileTextField
			> = {
				taxCode: normalizeTaxCode(row.taxCode),
				companyName: clean(row.companyName),
				importerPostalCode: clean(row.importerPostalCode),
				importExportBusinessAddress: clean(row.importExportBusinessAddress),
				importerPhone: clean(row.importerPhone),
			};

			(
				Object.entries(nextValues) as Array<
					[HanCompanyPartyProfileTextField, string | null]
				>
			).forEach(([field, value]) => {
				if (shouldUseHanCompanyPartyValue(field, merged[field], value)) {
					merged[field] = value;
				}
			});
		}

		return merged.sourceDeclarationId ? merged : null;
	} finally {
		await pool.close();
	}
}

function buildHanElectronicAttachments(row: SqlRow) {
	return [1, 2, 3]
		.map((index) => {
			const suffix = index === 1 ? "" : String(index);
			const typeCode = cleanCode(row[`attachmentTypeCode${suffix}`]);
			const attachmentNumber = clean(row[`attachmentNumber${suffix}`]);

			if (!typeCode && !attachmentNumber) {
				return null;
			}

			return {
				attachmentDescription: typeCode,
				attachmentNumber,
			};
		})
		.filter(
			(
				item,
			): item is {
				attachmentNumber: string | null;
				attachmentDescription: string | null;
			} => item !== null,
		);
}

function buildHanValuationAdjustments(row: SqlRow) {
	return [1, 2, 3, 4, 5]
		.map((index) => {
			const suffix = index === 1 ? "" : String(index);
			const nameCode = cleanCode(row[`valuationAdjustmentNameCode${suffix}`]);
			const classificationCode = cleanCode(
				row[`valuationAdjustmentClassificationCode${suffix}`],
			);
			const currencyCode = cleanCode(
				row[`valuationAdjustmentCurrencyCode${suffix}`],
			);
			const adjustmentValue = toNumber(
				row[`valuationAdjustmentValue${suffix}`],
			);
			const allocationRatio = toNumber(
				row[`valuationAdjustmentAllocationRatio${suffix}`],
			);

			if (
				!nameCode &&
				!classificationCode &&
				!currencyCode &&
				adjustmentValue === null &&
				allocationRatio === null
			) {
				return null;
			}

			return {
				nameCode,
				classificationCode,
				currencyCode,
				adjustmentValue,
				allocationRatio,
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
			} => item !== null,
		);
}

function buildHanTransportSchedules(row: SqlRow) {
	return [1, 2, 3]
		.map((index) => {
			const suffix = String(index);
			const rawLocation = clean(row[`transportScheduleLocation${suffix}`]);
			const locationCode = cleanCode(rawLocation);
			const locationName =
				rawLocation && rawLocation !== locationCode ? rawLocation : null;
			const arrivalDate = toIsoDate(
				row[`transportScheduleArrivalDate${suffix}`],
			);
			const departureDate = toIsoDate(
				row[`transportScheduleDepartureDate${suffix}`],
			);

			if (!locationCode && !locationName && !arrivalDate && !departureDate) {
				return null;
			}

			return {
				locationCode,
				locationName,
				arrivalDate,
				departureDate,
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
			} => item !== null,
		);
}

function buildHanBillItems(row: SqlRow) {
	return [1, 2, 3, 4, 5]
		.map((index) => {
			const suffix = String(index);
			const billNumber =
				index === 1
					? clean(row.billOfLading)
					: clean(row[`billNumber${suffix}`]);
			const billDate = toIsoDate(row[`billDate${suffix}`]);
			const hawbNumber = clean(row[`hawbNumber${suffix}`]);
			const mawbYear = clean(row[`mawbYear${suffix}`]);

			if (!billNumber && !billDate && !hawbNumber && !mawbYear) {
				return null;
			}

			return {
				billNumber,
				billDate,
				hawbNumber,
				mawbYear,
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
			} => item !== null,
		);
}

function buildHanTruckLoadingLocation(row: SqlRow) {
	const codes = [1, 2, 3, 4, 5]
		.map((index) => cleanCode(row[`truckLoadingLocationCode${index}`]))
		.filter((code): code is string => Boolean(code));

	return {
		code: codes.length > 0 ? codes.join(".") : null,
		name: clean(row.truckLoadingLocationName),
		address: clean(row.truckLoadingLocationAddress),
	};
}

export function isNewDraftStatus(row: HanDeclarationStatusFlags) {
	const tttk = cleanCode(row.tttk);
	const hasReviewState =
		row.isDuyet !== null ||
		row.isDaDuyet !== null ||
		row.isCreatePtq !== null ||
		clean(row.kdtLastInfo) !== null;

	return tttk === "N" || (row.isTqdt === 1 && !hasReviewState);
}

export function isNewImportStatus(row: HanDeclarationStatusFlags) {
	return isNewDraftStatus(row);
}

function createRequestParams(
	request: sql.Request,
	limit: number,
	taxCode: string | null,
	xOrN: "N" | "X" | null,
) {
	request.input("limit", sql.Int, limit);
	request.input("taxCode", sql.NVarChar(14), taxCode);
	request.input("xOrN", sql.NVarChar(1), xOrN);
}

function resolveRequestedXorN(operationType?: FollowUpOperationType | null) {
	if (operationType === "NHAP") return "N";
	if (operationType === "XUAT") return "X";
	return null;
}

export function buildHanDeclarationPrefill(row: SqlRow) {
	const declarationDate = toIsoDate(row.declarationDate);
	const transportDepartureDate = toIsoDate(row.transportDepartureDate);
	const transportArrivalDate = toIsoDate(row.transportArrivalDate);
	const contractDate = toIsoDate(row.contractDate);
	const contractGoodsDate = toIsoDate(row.contractGoodsDate);
	const commercialInvoiceDate = toIsoDate(row.commercialInvoiceDate);
	const reExportDeadline = toIsoDate(row.reExportDeadlineHeader);

	const xOrN = cleanCode(row.xOrN);
	const isImport = xOrN === "N";
	const taxCodeValue = cleanCode(row.taxCode);
	const companyName = clean(row.companyName);
	const partnerName = resolveHanCounterpartyName(row, isImport);
	const counterpartyCode = resolveHanCounterpartyCode(row, isImport);
	const customsCode = cleanCode(row.customsCode);
	const warehouseCodeV2 = cleanCode(row.customsWarehouseCodeV2);
	const headerWarehouseCode = cleanCode(row.customsWarehouseCode);
	const headerWarehouseName = clean(row.customsWarehouseName);
	const warehouseCode = warehouseCodeV2 ?? headerWarehouseCode;
	const warehouseName =
		warehouseCodeV2 && warehouseCodeV2 !== headerWarehouseCode
			? clean(row.customsWarehouseNameV2)
			: (clean(row.customsWarehouseNameV2) ?? clean(row.customsWarehouseName));
	const foreignLocationCode = cleanCode(row.foreignLocationCode);
	const foreignLocationName = clean(row.foreignLocationName);
	const taxDestinationLocationCode = cleanCode(row.taxDestinationLocationCode);
	const transportVehicleCode = cleanCode(row.transportVehicleCode);
	const electronicAttachments = buildHanElectronicAttachments(row);
	const valuationAdjustments = buildHanValuationAdjustments(row);
	const transportSchedules = buildHanTransportSchedules(row);
	const entrustedName = clean(row.entrustedImporterName);
	const customsDeclarantCode =
		cleanCode(row.customsDeclarantCode) ?? cleanCode(row.customsDeclarantUser);
	const estimatedArrivalAtDestinationDate =
		toIsoDate(row.estimatedArrivalAtDestinationDate) ?? transportArrivalDate;
	const billItems = buildHanBillItems(row);
	const truckLoadingLocation = buildHanTruckLoadingLocation(row);
	const buildImportLicenseSlot = (codeValue: unknown, numberValue: unknown) => {
		const code = cleanCode(codeValue);
		const number = clean(numberValue);
		return code && number ? `${code}:${number}` : (code ?? number);
	};
	const importLicenses = [
		buildImportLicenseSlot(row.importLicense, row.licenseNumber),
		buildImportLicenseSlot(row.licenseCode2, row.licenseNumber2),
		buildImportLicenseSlot(row.licenseCode3, row.licenseNumber3),
		buildImportLicenseSlot(row.licenseCode4, row.licenseNumber4),
		buildImportLicenseSlot(row.licenseCode5, row.licenseNumber5),
	];
	const otherLegalDocumentCodes = [
		cleanCode(row.otherLegalDocumentCode1),
		cleanCode(row.otherLegalDocumentCode2),
		cleanCode(row.otherLegalDocumentCode3),
		cleanCode(row.otherLegalDocumentCode4),
		cleanCode(row.otherLegalDocumentCode5),
	];

	return {
		declarationSequenceNumber: clean(row.declarationSequenceNumber),
		branchNumberPart1: clean(row.branchNumber),
		branchNumberPart2: clean(row.branchTotal),
		correspondingDeclarationNumber: clean(row.correspondingDeclarationNumber),
		importerCode: taxCodeValue,
		importExportUnitName: companyName,
		importerPostalCode: clean(row.importerPostalCode),
		importExportBusinessAddress: clean(row.importExportBusinessAddress),
		importerPhone: clean(row.importerPhone),
		entrustedImporterCode: cleanCode(row.entrustedImporterCode),
		entrustedImporterName: entrustedName,
		exporterCode: counterpartyCode,
		partnerName,
		partnerAddress1: clean(row.partnerAddress1),
		partnerAddress2: clean(row.partnerAddress2),
		partnerAddress3: clean(row.partnerAddress3),
		partnerAddress4: clean(row.partnerAddress4),
		exporterPostalCode: clean(row.exporterPostalCode),
		entrustedExporterName: entrustedName,
		customsDeclarantCode,
		customsCode,
		declarationProcessingDeptCode: cleanCode(row.declarationProcessingDeptCode),
		cargoClassificationCode: cleanCode(row.cargoClassificationCode),
		personOrganizationClassification: cleanCode(
			row.personOrganizationClassification,
		),
		expectedDeclarationDate: declarationDate,
		billOfLading: clean(row.billOfLading) ?? clean(row.goodsIdentity),
		billItems: billItems.length > 0 ? billItems : null,
		packageQuantity: toNumber(row.packageQuantity),
		packageType: clean(row.packageType),
		grossWeightTotal: toNumber(row.grossWeightTotal),
		weightUnit: cleanCode(row.weightUnit),
		containerQuantity: toNumber(row.containerQuantity),
		packageMarks: clean(row.packageMarks),
		inspectionResultCode: clean(row.inspectionResultCode),
		warehouseLocationCode: warehouseCode,
		warehouseLocationName: warehouseName,
		loadingLocationCode: isImport ? foreignLocationCode : headerWarehouseCode,
		loadingLocationName: isImport ? foreignLocationName : headerWarehouseName,
		unloadingLocationCode: isImport ? warehouseCode : foreignLocationCode,
		unloadingLocationName: isImport ? warehouseName : foreignLocationName,
		customsWarehouseCode: warehouseCode,
		customsWarehouseName: warehouseName,
		finalDestinationCode: taxDestinationLocationCode,
		finalDestinationName: null,
		transportMethodCode: cleanCode(row.transportMethodCode),
		transportVehicleCode,
		transportVehicleName: clean(row.transportVehicleName),
		departureArrivalDate:
			(isImport ? transportArrivalDate : transportDepartureDate) ??
			declarationDate,
		departureDate: transportDepartureDate ?? declarationDate,
		estimatedArrivalAtDestinationDate,
		transportDepartureDate: transportDepartureDate ?? declarationDate,
		importLicense: cleanCode(row.importLicense),
		licenseNumber: clean(row.licenseNumber),
		importLicenses: importLicenses.some((item) => item !== null)
			? importLicenses
			: null,
		reExportDeadline,
		contractNumber: clean(row.contractNumber),
		contractDate,
		contractGoodsDate,
		paymentMethod: cleanCode(row.paymentMethod),
		invoicePriceCondition: cleanCode(row.invoicePriceCondition),
		electronicInvoiceReceiptNumber: clean(row.electronicInvoiceReceiptNumber),
		electronicAttachments,
		commercialInvoice: clean(row.commercialInvoice),
		commercialInvoiceDate,
		invoiceFormClassificationCode: cleanCode(row.invoiceFormClassificationCode),
		invoiceClassificationCode: cleanCode(row.invoiceClassificationCode),
		declaredValue: toNumber(row.declaredValue),
		totalInvoiceValue: toNumber(row.totalInvoiceValue),
		totalTaxableValue: toNumber(row.totalTaxableValue),
		invoiceCurrency: cleanCode(row.invoiceCurrency),
		taxableValueCurrencyCode: cleanCode(row.taxableValueCurrencyCode),
		valuationDeclarationTypeCode: isImport
			? cleanCode(row.valuationDeclarationTypeCode)
			: (cleanCode(row.taxPaymentClassificationCode) ??
				cleanCode(row.valuationDeclarationTypeCode)),
		valuationSummaryReceiptNumber: clean(row.valuationSummaryReceiptNumber),
		valuationAdjustments:
			valuationAdjustments.length > 0 ? valuationAdjustments : null,
		valuationDeclarationDetail: clean(row.valuationDeclarationDetail),
		taxPayer: cleanCode(row.taxPayer),
		releaseBeforePermitCode: isImport
			? cleanCode(row.releaseBeforePermitCode)
			: null,
		taxPaymentDeadlineCode: cleanCode(row.taxPaymentDeadlineCodeHeader),
		taxDestinationLocation: taxDestinationLocationCode,
		transportFeeClassificationCode: cleanCode(
			row.transportFeeClassificationCode,
		),
		transportFeeCurrencyCode: cleanCode(row.transportFeeCurrencyCode),
		transportFee: toNumber(row.transportFee),
		insuranceFeeClassificationCode: cleanCode(
			row.insuranceFeeClassificationCode,
		),
		insuranceFeeCurrencyCode: cleanCode(row.insuranceFeeCurrencyCode),
		insuranceFee: toNumber(row.insuranceFee),
		insuranceRegistrationNumber: clean(row.insuranceRegistrationNumber),
		exportCountryCode: isImport
			? cleanCode(row.exportCountryCode)
			: cleanCode(row.importCountryCode),
		internalBusinessManagementNumber: clean(
			row.internalBusinessManagementNumber,
		),
		note: clean(row.note),
		businessTypeGroup: clean(row.businessTypeGroup),
		exchangeRate: toNumber(row.exchangeRate),
		netWeight: toNumber(row.netWeight),
		taxSubstituteBankCode: cleanCode(row.taxSubstituteBankCode),
		guaranteeBankCode: cleanCode(row.guaranteeBankCode),
		creditLimitDocumentSymbol:
			clean(row.creditLimitDocumentSymbol) ??
			clean(row.creditLimitDocumentSymbolHeader),
		guaranteeDocumentSymbol:
			clean(row.creditLimitDocumentSymbol) ??
			clean(row.creditLimitDocumentSymbolHeader),
		creditLimitDocumentNumber:
			clean(row.creditLimitDocumentNumber) ??
			clean(row.creditLimitDocumentNumberHeader),
		guaranteeDocumentNumber:
			clean(row.creditLimitDocumentNumber) ??
			clean(row.creditLimitDocumentNumberHeader),
		creditLimitIssueYear:
			clean(row.creditLimitIssueYear) ?? clean(row.creditLimitIssueYearHeader),
		otherLegalDocumentCodes: otherLegalDocumentCodes.some(
			(item) => item !== null,
		)
			? otherLegalDocumentCodes
			: null,
		transportSchedules:
			transportSchedules.length > 0 ? transportSchedules : null,
		truckLoadingLocationCode: truckLoadingLocation.code,
		truckLoadingLocationName: truckLoadingLocation.name,
		truckLoadingLocationAddress: truckLoadingLocation.address,
	} satisfies Partial<FollowUpCdsInfoRow>;
}

export async function loadHanNewImportCandidates(options: {
	connectionString: string;
	limit?: number;
	taxCode?: string | null;
	operationType?: FollowUpOperationType | null;
}) {
	const limit = Math.max(1, Math.min(options.limit ?? 5, 20));
	const taxCode = cleanCode(options.taxCode);
	const xOrN = resolveRequestedXorN(options.operationType);
	const sqlConfig = parseMssqlConnectionString(options.connectionString, {
		appName: "vvmv-han-candidate-loader",
	});

	if (!sqlConfig) {
		throw new Error("Connection HAN_2024 không hợp lệ.");
	}

	const pool = new sql.ConnectionPool(sqlConfig);

	await pool.connect();

	try {
		await pool
			.request()
			.query(
				"SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED; SET LOCK_TIMEOUT 5000;",
			);

		const request = pool.request();
		createRequestParams(request, limit, taxCode, xOrN);

		const result = await request.query<SqlRow>(`
      SELECT TOP (@limit)
        CAST(h._DToKhaiMDID AS BIGINT) AS declarationId,
        CAST(h.SOTK AS NVARCHAR(64)) AS declarationNumber,
        CAST(h.SOTK_DAU_TIEN AS NVARCHAR(64)) AS firstDeclarationNumber,
        CAST(h.SOTK_NHANH AS NVARCHAR(32)) AS branchNumber,
        CAST(
          COUNT(1) OVER (PARTITION BY CAST(h.SOTK_DAU_TIEN AS NVARCHAR(64)))
          AS NVARCHAR(16)
        ) AS branchTotal,
        CAST(h.SOTK_TN_TX AS NVARCHAR(64)) AS correspondingDeclarationNumber,
        h.NGAY_DK AS declarationDate,
        CAST(h.MA_DV AS NVARCHAR(14)) AS taxCode,
        CAST(h._Ten_DV_L1 AS NVARCHAR(512)) AS companyName,
        CAST(h.MA_LH AS NVARCHAR(32)) AS operationCode,
        CAST(h.MA_HQ AS NVARCHAR(32)) AS customsCode,
        CAST(h.MA_CK AS NVARCHAR(64)) AS customsWarehouseCode,
        CAST(h.TEN_CK AS NVARCHAR(255)) AS customsWarehouseName,
        CAST(v2.MA_DD_LUU_KHO AS NVARCHAR(64)) AS customsWarehouseCodeV2,
        CAST(customsWarehouseV2Label.label AS NVARCHAR(512)) AS customsWarehouseNameV2,
        CAST(h.MA_CANGNN AS NVARCHAR(64)) AS foreignLocationCode,
        CAST(h.CANGNN AS NVARCHAR(255)) AS foreignLocationName,
        CAST(h.MA_PTVT AS NVARCHAR(64)) AS transportVehicleCode,
        CAST(h.TEN_PTVT AS NVARCHAR(255)) AS transportVehicleName,
        h.NGAYKH AS transportDepartureDate,
        h.NGAYDEN AS transportArrivalDate,
        CAST(h.VAN_DON AS NVARCHAR(500)) AS billOfLading,
        CAST(v2.VAN_DON2 AS NVARCHAR(50)) AS billNumber2,
        CAST(v2.VAN_DON3 AS NVARCHAR(50)) AS billNumber3,
        CAST(v2.VAN_DON4 AS NVARCHAR(50)) AS billNumber4,
        CAST(v2.VAN_DON5 AS NVARCHAR(50)) AS billNumber5,
        v2.NGAY_VAN_DON AS billDate1,
        v2.NGAY_VAN_DON2 AS billDate2,
        v2.NGAY_VAN_DON3 AS billDate3,
        v2.NGAY_VAN_DON4 AS billDate4,
        v2.NGAY_VAN_DON5 AS billDate5,
        CAST(v2.VAN_DON_MAWB AS NVARCHAR(50)) AS hawbNumber1,
        CAST(v2.VAN_DON_MAWB2 AS NVARCHAR(50)) AS hawbNumber2,
        CAST(v2.VAN_DON_MAWB3 AS NVARCHAR(50)) AS hawbNumber3,
        CAST(v2.VAN_DON_MAWB4 AS NVARCHAR(50)) AS hawbNumber4,
        CAST(v2.VAN_DON_MAWB5 AS NVARCHAR(50)) AS hawbNumber5,
        CAST(v2.VAN_DON_NAM AS NVARCHAR(10)) AS mawbYear1,
        CAST(v2.VAN_DON_NAM2 AS NVARCHAR(10)) AS mawbYear2,
        CAST(v2.VAN_DON_NAM3 AS NVARCHAR(10)) AS mawbYear3,
        CAST(v2.VAN_DON_NAM4 AS NVARCHAR(10)) AS mawbYear4,
        CAST(v2.VAN_DON_NAM5 AS NVARCHAR(10)) AS mawbYear5,
        h.SO_KIEN AS packageQuantity,
        CAST(h.DVT_KIEN AS NVARCHAR(32)) AS packageType,
        h.TR_LUONG AS grossWeightTotal,
        CAST(h.DVT_TR_LUONG AS NVARCHAR(32)) AS weightUnit,
        CAST(h.SO_HDTM AS NVARCHAR(128)) AS commercialInvoice,
        h.NGAY_HDTM AS commercialInvoiceDate,
        CAST(h.MA_PTTT AS NVARCHAR(32)) AS paymentMethod,
        CAST(h.MA_GH AS NVARCHAR(32)) AS invoicePriceCondition,
        CAST(h.MA_PL_GIA_HDTM AS NVARCHAR(32)) AS invoiceClassificationCode,
        CAST(h.KIEMHOANK AS NVARCHAR(16)) AS inspectionResultCode,
        CAST(h.MA_NT AS NVARCHAR(32)) AS invoiceCurrency,
        CAST(h.MA_NT_TGTT AS NVARCHAR(32)) AS taxableValueCurrencyCode,
        CAST(v.MA_KHAI_TRGIA AS NVARCHAR(32)) AS valuationDeclarationTypeCode,
        CAST(v.MA_PL_NOP_THUE AS NVARCHAR(32)) AS taxPaymentClassificationCode,
        CAST(v.MA_NGUOI_NOP_THUE AS NVARCHAR(32)) AS taxPayer,
        CAST(v.MA_LY_DO_BP AS NVARCHAR(32)) AS releaseBeforePermitCode,
        CAST(h.MA_THOI_HAN_NOP_THUE AS NVARCHAR(32)) AS taxPaymentDeadlineCodeHeader,
        h.TONGTGKB AS declaredValue,
        h.TONGTGTT AS totalTaxableValue,
        h.TONGTG_HDTM AS totalInvoiceValue,
        CAST(h.MA_PHI_VC AS NVARCHAR(32)) AS transportFeeClassificationCode,
        CAST(h.MA_NT_PHI_VC AS NVARCHAR(32)) AS transportFeeCurrencyCode,
        h.PHI_VC AS transportFee,
        CAST(h.MA_PHI_BH AS NVARCHAR(32)) AS insuranceFeeClassificationCode,
        CAST(h.MA_NT_PHI_BH AS NVARCHAR(32)) AS insuranceFeeCurrencyCode,
        h.PHI_BH AS insuranceFee,
        CAST(h.SO_DK_PHI_BH AS NVARCHAR(128)) AS insuranceRegistrationNumber,
        CAST(h.NUOC_XK AS NVARCHAR(32)) AS exportCountryCode,
        CAST(h.NUOC_NK AS NVARCHAR(32)) AS importCountryCode,
        CAST(h.DV_DT AS NVARCHAR(512)) AS partnerName,
        CAST(h.Ma_Nguoi_Nhan_Hang AS NVARCHAR(64)) AS partnerReceiverCode,
        CAST(h.Ten_Nguoi_Nhan_Hang AS NVARCHAR(512)) AS partnerReceiverName,
        CAST(h.Ma_Nguoi_Giao_Hang AS NVARCHAR(64)) AS partnerSenderCode,
        CAST(h.Ten_Nguoi_Giao_Hang AS NVARCHAR(512)) AS partnerSenderName,
        CAST(v2.MA_PHAN_LOAI_HH AS NVARCHAR(32)) AS cargoClassificationCode,
        CAST(v.MA_QLY_USER AS NVARCHAR(128)) AS internalBusinessManagementNumber,
        CAST(v2.DIA_CHI_DT1 AS NVARCHAR(50)) AS partnerAddress1,
        CAST(v2.DIA_CHI_DT2 AS NVARCHAR(50)) AS partnerAddress2,
        CAST(v2.DIA_CHI_DT3 AS NVARCHAR(50)) AS partnerAddress3,
        CAST(v2.DIA_CHI_DT4 AS NVARCHAR(50)) AS partnerAddress4,
        CAST(h.MA_BC_DT AS NVARCHAR(20)) AS exporterPostalCode,
        CAST(h.MA_NGUOI_CHI_DINH_CT AS NVARCHAR(64)) AS customsDeclarantCode,
        CAST(h.USER_DK AS NVARCHAR(64)) AS customsDeclarantUser,
        CAST(v2.NHOM_HO_SO AS NVARCHAR(8)) AS businessTypeGroup,
        h.TYGIA_VND AS exchangeRate,
        CAST(h.MA_HDTM AS NVARCHAR(32)) AS invoiceFormClassificationCode,
        CAST(h.SO_HD AS NVARCHAR(128)) AS contractNumber,
        h.NGAY_HD AS contractDate,
        h.NGAY_HHHD AS contractGoodsDate,
        CAST(h.SO_TN_HDTM AS NVARCHAR(128)) AS electronicInvoiceReceiptNumber,
        CAST(v.MA_KHOAN_DC AS NVARCHAR(32)) AS valuationAdjustmentNameCode,
        CAST(v.MA_LOAI_DC AS NVARCHAR(32)) AS valuationAdjustmentClassificationCode,
        CAST(v.MA_NT_DC AS NVARCHAR(32)) AS valuationAdjustmentCurrencyCode,
        v.TRIGIA_DC AS valuationAdjustmentValue,
        v.TONG_HS_PB_DC AS valuationAdjustmentAllocationRatio,
        CAST(v.MA_KHOAN_DC2 AS NVARCHAR(32)) AS valuationAdjustmentNameCode2,
        CAST(v.MA_LOAI_DC2 AS NVARCHAR(32)) AS valuationAdjustmentClassificationCode2,
        CAST(v.MA_NT_DC2 AS NVARCHAR(32)) AS valuationAdjustmentCurrencyCode2,
        v.TRIGIA_DC2 AS valuationAdjustmentValue2,
        v.TONG_HS_PB_DC2 AS valuationAdjustmentAllocationRatio2,
        CAST(v.MA_KHOAN_DC3 AS NVARCHAR(32)) AS valuationAdjustmentNameCode3,
        CAST(v.MA_LOAI_DC3 AS NVARCHAR(32)) AS valuationAdjustmentClassificationCode3,
        CAST(v.MA_NT_DC3 AS NVARCHAR(32)) AS valuationAdjustmentCurrencyCode3,
        v.TRIGIA_DC3 AS valuationAdjustmentValue3,
        v.TONG_HS_PB_DC3 AS valuationAdjustmentAllocationRatio3,
        CAST(v.MA_KHOAN_DC4 AS NVARCHAR(32)) AS valuationAdjustmentNameCode4,
        CAST(v.MA_LOAI_DC4 AS NVARCHAR(32)) AS valuationAdjustmentClassificationCode4,
        CAST(v.MA_NT_DC4 AS NVARCHAR(32)) AS valuationAdjustmentCurrencyCode4,
        v.TRIGIA_DC4 AS valuationAdjustmentValue4,
        v.TONG_HS_PB_DC4 AS valuationAdjustmentAllocationRatio4,
        CAST(v.MA_KHOAN_DC5 AS NVARCHAR(32)) AS valuationAdjustmentNameCode5,
        CAST(v.MA_LOAI_DC5 AS NVARCHAR(32)) AS valuationAdjustmentClassificationCode5,
        CAST(v.MA_NT_DC5 AS NVARCHAR(32)) AS valuationAdjustmentCurrencyCode5,
        v.TRIGIA_DC5 AS valuationAdjustmentValue5,
        v.TONG_HS_PB_DC5 AS valuationAdjustmentAllocationRatio5,
        CAST(v.MA_LOAI_DINH_KEM AS NVARCHAR(64)) AS attachmentTypeCode,
        CAST(v.SO_DINH_KEM AS NVARCHAR(64)) AS attachmentNumber,
        CAST(v.MA_LOAI_DINH_KEM2 AS NVARCHAR(64)) AS attachmentTypeCode2,
        CAST(v.SO_DINH_KEM2 AS NVARCHAR(64)) AS attachmentNumber2,
        CAST(v.MA_LOAI_DINH_KEM3 AS NVARCHAR(64)) AS attachmentTypeCode3,
        CAST(v.SO_DINH_KEM3 AS NVARCHAR(64)) AS attachmentNumber3,
        CAST(v.MA_VB_PQUY AS NVARCHAR(32)) AS otherLegalDocumentCode1,
        CAST(v.MA_VB_PQUY2 AS NVARCHAR(32)) AS otherLegalDocumentCode2,
        CAST(v.MA_VB_PQUY3 AS NVARCHAR(32)) AS otherLegalDocumentCode3,
        CAST(v.MA_VB_PQUY4 AS NVARCHAR(32)) AS otherLegalDocumentCode4,
        CAST(v.MA_VB_PQUY5 AS NVARCHAR(32)) AS otherLegalDocumentCode5,
        CAST(v.TRUNG_CHUYEN_DIA_DIEM AS NVARCHAR(255)) AS transportScheduleLocation1,
        v.TRUNG_CHUYEN_NGAY_DEN AS transportScheduleArrivalDate1,
        v.TRUNG_CHUYEN_NGAY_KH AS transportScheduleDepartureDate1,
        CAST(v.TRUNG_CHUYEN_DIA_DIEM2 AS NVARCHAR(255)) AS transportScheduleLocation2,
        v.TRUNG_CHUYEN_NGAY_DEN2 AS transportScheduleArrivalDate2,
        v.TRUNG_CHUYEN_NGAY_KH2 AS transportScheduleDepartureDate2,
        CAST(v.TRUNG_CHUYEN_DIA_DIEM3 AS NVARCHAR(255)) AS transportScheduleLocation3,
        v.TRUNG_CHUYEN_NGAY_DEN3 AS transportScheduleArrivalDate3,
        v.TRUNG_CHUYEN_NGAY_KH3 AS transportScheduleDepartureDate3,
        CAST(v.MA_DIEM_XEP_HANG_LEN_XE AS NVARCHAR(8)) AS truckLoadingLocationCode1,
        CAST(v.MA_DIEM_XEP_HANG_LEN_XE2 AS NVARCHAR(8)) AS truckLoadingLocationCode2,
        CAST(v.MA_DIEM_XEP_HANG_LEN_XE3 AS NVARCHAR(8)) AS truckLoadingLocationCode3,
        CAST(v.MA_DIEM_XEP_HANG_LEN_XE4 AS NVARCHAR(8)) AS truckLoadingLocationCode4,
        CAST(v.MA_DIEM_XEP_HANG_LEN_XE5 AS NVARCHAR(8)) AS truckLoadingLocationCode5,
        CAST(v.TEN_DIEM_XEP_HANG_LEN_XE AS NVARCHAR(70)) AS truckLoadingLocationName,
        CAST(v.DIA_CHI_DIEM_XEP_HANG_LEN_XE AS NVARCHAR(300)) AS truckLoadingLocationAddress,
        CAST(dds.taxDestinationLocationCode AS NVARCHAR(64)) AS taxDestinationLocationCode,
        CAST(dds.goodsIdentity AS NVARCHAR(255)) AS goodsIdentity,
        dds.estimatedArrivalAtDestinationDate AS estimatedArrivalAtDestinationDate,
        CAST(dds.note AS NVARCHAR(500)) AS note,
        CAST(h.KDT_LASTINFO AS NVARCHAR(500)) AS kdtLastInfo,
        CAST(h.TTTK AS NVARCHAR(8)) AS tttk,
        CAST(h._XorN AS NVARCHAR(8)) AS xOrN,
        h.IsTQDT AS isTqdt,
        h.IS_DUYET AS isDuyet,
        h.IsDaDuyet AS isDaDuyet,
        h.isCreatePTQ AS isCreatePtq,
        cont.containerCount AS containerCount
      FROM dbo.DTOKHAIMD h WITH (NOLOCK)
      LEFT JOIN dbo.DTOKHAIMD_VNACCS v WITH (NOLOCK)
        ON v._DTOKHAIMDID = h._DToKhaiMDID
      LEFT JOIN dbo.DTOKHAIMD_VNACCS2 v2 WITH (NOLOCK)
        ON v2._DTOKHAIMDID = h._DToKhaiMDID
      ${CUSTOMS_WAREHOUSE_V2_LABEL_APPLY_SQL}
      OUTER APPLY (
        SELECT TOP 1
          CAST(c.MA_DIA_DIEM AS NVARCHAR(64)) AS taxDestinationLocationCode,
          CAST(c.DINH_DANH_HANG_HOA AS NVARCHAR(255)) AS goodsIdentity,
          c.NGAY_TAU_DEN AS estimatedArrivalAtDestinationDate,
          CAST(c.NOTE AS NVARCHAR(500)) AS note
        FROM dbo.DDS_CONT_TK c WITH (NOLOCK)
        WHERE c._DTOKHAIMDID = h._DToKhaiMDID
        ORDER BY c.DDS_CONT_TKID DESC
      ) dds
      OUTER APPLY (
        SELECT COUNT(1) AS containerCount
        FROM dbo.DDS_CONT_TK c WITH (NOLOCK)
        WHERE c._DTOKHAIMDID = h._DToKhaiMDID
      ) cont
      WHERE
        (@taxCode IS NULL OR h.MA_DV = @taxCode)
        AND (@xOrN IS NULL OR h._XorN = @xOrN)
        AND (
          ISNULL(h.TTTK, N'') = N'N'
          OR (
            ISNULL(h.IsTQDT, 0) = 1
            AND NULLIF(LTRIM(RTRIM(CAST(h.KDT_LASTINFO AS NVARCHAR(500)))), '') IS NULL
            AND h.IS_DUYET IS NULL
            AND h.IsDaDuyet IS NULL
            AND h.isCreatePTQ IS NULL
          )
        )
      ORDER BY
        COALESCE(h.NGAY_DK, '1900-01-01') DESC,
        h._DToKhaiMDID DESC;
    `);

		const processingDepartments =
			await loadHanProcessingDepartmentsByCustomsCodes(
				pool,
				result.recordset.map((row) => cleanCode(row.customsCode)),
			);

		const candidates = result.recordset
			.map<HanDeclarationCandidate | null>((row) => {
				const nextRow: SqlRow = {
					...row,
					declarationProcessingDeptCode: resolveHanProcessingDepartmentCode(
						processingDepartments,
						row,
					),
				};
				const statusFlags: HanDeclarationStatusFlags = {
					xOrN: clean(nextRow.xOrN),
					tttk: clean(nextRow.tttk),
					isTqdt: toNumber(nextRow.isTqdt),
					isDuyet: toNumber(nextRow.isDuyet),
					isDaDuyet: toNumber(nextRow.isDaDuyet),
					isCreatePtq: toNumber(nextRow.isCreatePtq),
					kdtLastInfo: clean(nextRow.kdtLastInfo),
				};

				if (!isNewDraftStatus(statusFlags)) {
					return null;
				}
				const declarationDate = toIsoDate(nextRow.declarationDate);
				const taxCodeValue = cleanCode(nextRow.taxCode);
				const companyName = clean(nextRow.companyName);
				const customsCode = cleanCode(nextRow.customsCode);
				const declarationNumber =
					clean(nextRow.declarationNumber) ??
					clean(nextRow.firstDeclarationNumber);

				return {
					declarationId: Number(nextRow.declarationId),
					declarationNumber,
					declarationDate,
					taxCode: taxCodeValue,
					companyName,
					operationCode: cleanCode(nextRow.operationCode),
					customsCode,
					containerCount: toNumber(nextRow.containerCount) ?? 0,
					statusFlags,
					prefill: {
						declarationNumber,
						firstDeclarationNumber:
							clean(nextRow.firstDeclarationNumber) ?? declarationNumber,
						...buildHanDeclarationPrefill(nextRow),
					},
				} satisfies HanDeclarationCandidate;
			})
			.filter(
				(candidate): candidate is HanDeclarationCandidate => candidate !== null,
			);

		return candidates.slice(0, limit);
	} finally {
		await pool.close();
	}
}

async function loadHanDeclarationPrefillInternal(args: {
	connectionString: string;
	whereClause: string;
	bindParams: (request: sql.Request) => void;
}) {
	const sqlConfig = parseMssqlConnectionString(args.connectionString, {
		appName: "vvmv-han-declaration-prefill",
	});

	if (!sqlConfig) {
		throw new Error("Connection HAN_2024 không hợp lệ.");
	}

	const pool = new sql.ConnectionPool(sqlConfig);

	await pool.connect();

	try {
		await pool
			.request()
			.query(
				"SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED; SET LOCK_TIMEOUT 5000;",
			);

		const request = pool.request();
		args.bindParams(request);

		const result = await request.query<SqlRow>(`
      SELECT TOP 1
        CAST(h._DToKhaiMDID AS BIGINT) AS declarationId,
        CAST(h.SOTK AS NVARCHAR(64)) AS declarationNumber,
        CAST(h.SOTK_DAU_TIEN AS NVARCHAR(64)) AS firstDeclarationNumber,
        CAST(h.SOTK_NHANH AS NVARCHAR(32)) AS branchNumber,
        CAST(
          COUNT(1) OVER (PARTITION BY CAST(h.SOTK_DAU_TIEN AS NVARCHAR(64)))
          AS NVARCHAR(16)
        ) AS branchTotal,
        CAST(h.SOTK_TN_TX AS NVARCHAR(64)) AS correspondingDeclarationNumber,
        h.NGAY_DK AS declarationDate,
        CAST(h.MA_DV AS NVARCHAR(14)) AS taxCode,
        CAST(h._Ten_DV_L1 AS NVARCHAR(512)) AS companyName,
        CAST(h.MA_LH AS NVARCHAR(32)) AS operationCode,
        CAST(h._XorN AS NVARCHAR(8)) AS xOrN,
        CAST(h.MA_HQ AS NVARCHAR(32)) AS customsCode,
        CAST(h.MA_CK AS NVARCHAR(64)) AS customsWarehouseCode,
        CAST(h.TEN_CK AS NVARCHAR(255)) AS customsWarehouseName,
        CAST(v2.MA_DD_LUU_KHO AS NVARCHAR(64)) AS customsWarehouseCodeV2,
        CAST(customsWarehouseV2Label.label AS NVARCHAR(512)) AS customsWarehouseNameV2,
        CAST(h.MA_CANGNN AS NVARCHAR(64)) AS foreignLocationCode,
        CAST(h.CANGNN AS NVARCHAR(255)) AS foreignLocationName,
        CAST(v2.MA_HIEU_PTVC AS NVARCHAR(32)) AS transportMethodCode,
        CAST(h.MA_PTVT AS NVARCHAR(64)) AS transportVehicleCode,
        CAST(h.TEN_PTVT AS NVARCHAR(255)) AS transportVehicleName,
        h.NGAYKH AS transportDepartureDate,
        h.NGAYDEN AS transportArrivalDate,
        CAST(h.VAN_DON AS NVARCHAR(500)) AS billOfLading,
        CAST(v2.VAN_DON2 AS NVARCHAR(50)) AS billNumber2,
        CAST(v2.VAN_DON3 AS NVARCHAR(50)) AS billNumber3,
        CAST(v2.VAN_DON4 AS NVARCHAR(50)) AS billNumber4,
        CAST(v2.VAN_DON5 AS NVARCHAR(50)) AS billNumber5,
        v2.NGAY_VAN_DON AS billDate1,
        v2.NGAY_VAN_DON2 AS billDate2,
        v2.NGAY_VAN_DON3 AS billDate3,
        v2.NGAY_VAN_DON4 AS billDate4,
        v2.NGAY_VAN_DON5 AS billDate5,
        CAST(v2.VAN_DON_MAWB AS NVARCHAR(50)) AS hawbNumber1,
        CAST(v2.VAN_DON_MAWB2 AS NVARCHAR(50)) AS hawbNumber2,
        CAST(v2.VAN_DON_MAWB3 AS NVARCHAR(50)) AS hawbNumber3,
        CAST(v2.VAN_DON_MAWB4 AS NVARCHAR(50)) AS hawbNumber4,
        CAST(v2.VAN_DON_MAWB5 AS NVARCHAR(50)) AS hawbNumber5,
        CAST(v2.VAN_DON_NAM AS NVARCHAR(10)) AS mawbYear1,
        CAST(v2.VAN_DON_NAM2 AS NVARCHAR(10)) AS mawbYear2,
        CAST(v2.VAN_DON_NAM3 AS NVARCHAR(10)) AS mawbYear3,
        CAST(v2.VAN_DON_NAM4 AS NVARCHAR(10)) AS mawbYear4,
        CAST(v2.VAN_DON_NAM5 AS NVARCHAR(10)) AS mawbYear5,
        h.SO_KIEN AS packageQuantity,
        CAST(h.DVT_KIEN AS NVARCHAR(32)) AS packageType,
        h.TR_LUONG AS grossWeightTotal,
        CAST(h.DVT_TR_LUONG AS NVARCHAR(32)) AS weightUnit,
        h.SO_CONTAINER AS containerQuantity,
        CAST(h.KY_HIEU_SO_HIEU AS NVARCHAR(255)) AS packageMarks,
        CAST(h.SO_HDTM AS NVARCHAR(128)) AS commercialInvoice,
        h.NGAY_HDTM AS commercialInvoiceDate,
        CAST(h.MA_PTTT AS NVARCHAR(32)) AS paymentMethod,
        CAST(h.MA_GH AS NVARCHAR(32)) AS invoicePriceCondition,
        CAST(h.MA_PL_GIA_HDTM AS NVARCHAR(32)) AS invoiceClassificationCode,
        CAST(h.MA_NT AS NVARCHAR(32)) AS invoiceCurrency,
        CAST(h.MA_NT_TGTT AS NVARCHAR(32)) AS taxableValueCurrencyCode,
        CAST(v.MA_KHAI_TRGIA AS NVARCHAR(32)) AS valuationDeclarationTypeCode,
        CAST(v.MA_PL_NOP_THUE AS NVARCHAR(32)) AS taxPaymentClassificationCode,
        CAST(v.MA_NGUOI_NOP_THUE AS NVARCHAR(32)) AS taxPayer,
        CAST(v.MA_LY_DO_BP AS NVARCHAR(32)) AS releaseBeforePermitCode,
        CAST(h.MA_THOI_HAN_NOP_THUE AS NVARCHAR(32)) AS taxPaymentDeadlineCodeHeader,
        h.TONGTGKB AS declaredValue,
        h.TONGTGTT AS totalTaxableValue,
        h.TONGTG_HDTM AS totalInvoiceValue,
        CAST(h.MA_PHI_VC AS NVARCHAR(32)) AS transportFeeClassificationCode,
        CAST(h.MA_NT_PHI_VC AS NVARCHAR(32)) AS transportFeeCurrencyCode,
        h.PHI_VC AS transportFee,
        CAST(h.MA_PHI_BH AS NVARCHAR(32)) AS insuranceFeeClassificationCode,
        CAST(h.MA_NT_PHI_BH AS NVARCHAR(32)) AS insuranceFeeCurrencyCode,
        h.PHI_BH AS insuranceFee,
        CAST(h.SO_DK_PHI_BH AS NVARCHAR(128)) AS insuranceRegistrationNumber,
        CAST(h.NUOC_XK AS NVARCHAR(32)) AS exportCountryCode,
        CAST(h.NUOC_NK AS NVARCHAR(32)) AS importCountryCode,
        CAST(h.DV_DT AS NVARCHAR(512)) AS partnerName,
        CAST(h.Ma_Nguoi_Nhan_Hang AS NVARCHAR(64)) AS partnerReceiverCode,
        CAST(h.Ten_Nguoi_Nhan_Hang AS NVARCHAR(512)) AS partnerReceiverName,
        CAST(h.Ma_Nguoi_Giao_Hang AS NVARCHAR(64)) AS partnerSenderCode,
        CAST(h.Ten_Nguoi_Giao_Hang AS NVARCHAR(512)) AS partnerSenderName,
        CAST(v2.MA_PHAN_LOAI_HH AS NVARCHAR(32)) AS cargoClassificationCode,
        CAST(v.MA_QLY_USER AS NVARCHAR(128)) AS internalBusinessManagementNumber,
        CAST(v2.CANHAN_TOCHUC AS NVARCHAR(32)) AS personOrganizationClassification,
        CAST(v2.DIA_CHI_DT1 AS NVARCHAR(50)) AS partnerAddress1,
        CAST(v2.DIA_CHI_DT2 AS NVARCHAR(50)) AS partnerAddress2,
        CAST(v2.DIA_CHI_DT3 AS NVARCHAR(50)) AS partnerAddress3,
        CAST(v2.DIA_CHI_DT4 AS NVARCHAR(50)) AS partnerAddress4,
        CAST(h.MA_BC_DT AS NVARCHAR(20)) AS exporterPostalCode,
        CAST(v2.NHOM_HO_SO AS NVARCHAR(8)) AS businessTypeGroup,
        h.TYGIA_VND AS exchangeRate,
        h._TR_LUONG_Net AS netWeight,
        CAST(v.SO_TN_KHAI_TRGIA AS NVARCHAR(128)) AS valuationSummaryReceiptNumber,
        CAST(v.MA_KHOAN_DC AS NVARCHAR(32)) AS valuationAdjustmentNameCode,
        CAST(v.MA_LOAI_DC AS NVARCHAR(32)) AS valuationAdjustmentClassificationCode,
        CAST(v.MA_NT_DC AS NVARCHAR(32)) AS valuationAdjustmentCurrencyCode,
        v.TRIGIA_DC AS valuationAdjustmentValue,
        v.TONG_HS_PB_DC AS valuationAdjustmentAllocationRatio,
        CAST(v.MA_KHOAN_DC2 AS NVARCHAR(32)) AS valuationAdjustmentNameCode2,
        CAST(v.MA_LOAI_DC2 AS NVARCHAR(32)) AS valuationAdjustmentClassificationCode2,
        CAST(v.MA_NT_DC2 AS NVARCHAR(32)) AS valuationAdjustmentCurrencyCode2,
        v.TRIGIA_DC2 AS valuationAdjustmentValue2,
        v.TONG_HS_PB_DC2 AS valuationAdjustmentAllocationRatio2,
        CAST(v.MA_KHOAN_DC3 AS NVARCHAR(32)) AS valuationAdjustmentNameCode3,
        CAST(v.MA_LOAI_DC3 AS NVARCHAR(32)) AS valuationAdjustmentClassificationCode3,
        CAST(v.MA_NT_DC3 AS NVARCHAR(32)) AS valuationAdjustmentCurrencyCode3,
        v.TRIGIA_DC3 AS valuationAdjustmentValue3,
        v.TONG_HS_PB_DC3 AS valuationAdjustmentAllocationRatio3,
        CAST(v.MA_KHOAN_DC4 AS NVARCHAR(32)) AS valuationAdjustmentNameCode4,
        CAST(v.MA_LOAI_DC4 AS NVARCHAR(32)) AS valuationAdjustmentClassificationCode4,
        CAST(v.MA_NT_DC4 AS NVARCHAR(32)) AS valuationAdjustmentCurrencyCode4,
        v.TRIGIA_DC4 AS valuationAdjustmentValue4,
        v.TONG_HS_PB_DC4 AS valuationAdjustmentAllocationRatio4,
        CAST(v.MA_KHOAN_DC5 AS NVARCHAR(32)) AS valuationAdjustmentNameCode5,
        CAST(v.MA_LOAI_DC5 AS NVARCHAR(32)) AS valuationAdjustmentClassificationCode5,
        CAST(v.MA_NT_DC5 AS NVARCHAR(32)) AS valuationAdjustmentCurrencyCode5,
        v.TRIGIA_DC5 AS valuationAdjustmentValue5,
        v.TONG_HS_PB_DC5 AS valuationAdjustmentAllocationRatio5,
        CAST(v.NOI_DUNG_KHAI_TRGIA AS NVARCHAR(850)) AS valuationDeclarationDetail,
        CAST(h.MA_HDTM AS NVARCHAR(32)) AS invoiceFormClassificationCode,
        CAST(v2.BL_THUE_MA_NG_HANG AS NVARCHAR(32)) AS taxSubstituteBankCode,
        CAST(h.DAM_BAO_MA_NG_HANG AS NVARCHAR(32)) AS guaranteeBankCode,
        CAST(v2.BL_THUE_KY_HIEU_CT AS NVARCHAR(32)) AS creditLimitDocumentSymbol,
        CAST(h.DAM_BAO_KY_HIEU_CT AS NVARCHAR(32)) AS creditLimitDocumentSymbolHeader,
        CAST(v2.BL_THUE_SO_CT AS NVARCHAR(64)) AS creditLimitDocumentNumber,
        CAST(h.DAM_BAO_SO_CT AS NVARCHAR(64)) AS creditLimitDocumentNumberHeader,
        CAST(v2.BL_THUE_NAM_CT AS NVARCHAR(10)) AS creditLimitIssueYear,
        CAST(h.DAM_BAO_NAM_PHAT_HANH AS NVARCHAR(10)) AS creditLimitIssueYearHeader,
        CAST(v2.MA_GP2 AS NVARCHAR(32)) AS licenseCode2,
        CAST(v2.SO_GP2 AS NVARCHAR(128)) AS licenseNumber2,
        CAST(v2.MA_GP3 AS NVARCHAR(32)) AS licenseCode3,
        CAST(v2.SO_GP3 AS NVARCHAR(128)) AS licenseNumber3,
        CAST(v2.MA_GP4 AS NVARCHAR(32)) AS licenseCode4,
        CAST(v2.SO_GP4 AS NVARCHAR(128)) AS licenseNumber4,
        CAST(v2.MA_GP5 AS NVARCHAR(32)) AS licenseCode5,
        CAST(v2.SO_GP5 AS NVARCHAR(128)) AS licenseNumber5,
        CAST(h.SO_HD AS NVARCHAR(128)) AS contractNumber,
        h.NGAY_HD AS contractDate,
        h.NGAY_HHHD AS contractGoodsDate,
        h.NGAY_THN_THX AS reExportDeadlineHeader,
        CAST(h.MA_GP AS NVARCHAR(64)) AS importLicense,
        CAST(h.SO_GP AS NVARCHAR(128)) AS licenseNumber,
        CAST(h.KIEMHOANK AS NVARCHAR(16)) AS inspectionResultCode,
        CAST(h.MA_BC_DV AS NVARCHAR(20)) AS importerPostalCode,
        CAST(h.DIA_CHI_DV AS NVARCHAR(500)) AS importExportBusinessAddress,
        CAST(h.SO_DT_DV AS NVARCHAR(50)) AS importerPhone,
        CAST(h.MA_DVUT AS NVARCHAR(50)) AS entrustedImporterCode,
        CAST(h._TEN_DVUT AS NVARCHAR(300)) AS entrustedImporterName,
        CAST(h.MA_NGUOI_CHI_DINH_CT AS NVARCHAR(64)) AS customsDeclarantCode,
        CAST(h.USER_DK AS NVARCHAR(64)) AS customsDeclarantUser,
        CAST(h.SO_TN_HDTM AS NVARCHAR(128)) AS electronicInvoiceReceiptNumber,
        CAST(v.MA_LOAI_DINH_KEM AS NVARCHAR(64)) AS attachmentTypeCode,
        CAST(v.SO_DINH_KEM AS NVARCHAR(64)) AS attachmentNumber,
        CAST(v.MA_LOAI_DINH_KEM2 AS NVARCHAR(64)) AS attachmentTypeCode2,
        CAST(v.SO_DINH_KEM2 AS NVARCHAR(64)) AS attachmentNumber2,
        CAST(v.MA_LOAI_DINH_KEM3 AS NVARCHAR(64)) AS attachmentTypeCode3,
        CAST(v.SO_DINH_KEM3 AS NVARCHAR(64)) AS attachmentNumber3,
        CAST(v.MA_VB_PQUY AS NVARCHAR(32)) AS otherLegalDocumentCode1,
        CAST(v.MA_VB_PQUY2 AS NVARCHAR(32)) AS otherLegalDocumentCode2,
        CAST(v.MA_VB_PQUY3 AS NVARCHAR(32)) AS otherLegalDocumentCode3,
        CAST(v.MA_VB_PQUY4 AS NVARCHAR(32)) AS otherLegalDocumentCode4,
        CAST(v.MA_VB_PQUY5 AS NVARCHAR(32)) AS otherLegalDocumentCode5
        ,CAST(v.TRUNG_CHUYEN_DIA_DIEM AS NVARCHAR(255)) AS transportScheduleLocation1
        ,v.TRUNG_CHUYEN_NGAY_DEN AS transportScheduleArrivalDate1
        ,v.TRUNG_CHUYEN_NGAY_KH AS transportScheduleDepartureDate1
        ,CAST(v.TRUNG_CHUYEN_DIA_DIEM2 AS NVARCHAR(255)) AS transportScheduleLocation2
        ,v.TRUNG_CHUYEN_NGAY_DEN2 AS transportScheduleArrivalDate2
        ,v.TRUNG_CHUYEN_NGAY_KH2 AS transportScheduleDepartureDate2
        ,CAST(v.TRUNG_CHUYEN_DIA_DIEM3 AS NVARCHAR(255)) AS transportScheduleLocation3
        ,v.TRUNG_CHUYEN_NGAY_DEN3 AS transportScheduleArrivalDate3
        ,v.TRUNG_CHUYEN_NGAY_KH3 AS transportScheduleDepartureDate3
        ,CAST(v.MA_DIEM_XEP_HANG_LEN_XE AS NVARCHAR(8)) AS truckLoadingLocationCode1
        ,CAST(v.MA_DIEM_XEP_HANG_LEN_XE2 AS NVARCHAR(8)) AS truckLoadingLocationCode2
        ,CAST(v.MA_DIEM_XEP_HANG_LEN_XE3 AS NVARCHAR(8)) AS truckLoadingLocationCode3
        ,CAST(v.MA_DIEM_XEP_HANG_LEN_XE4 AS NVARCHAR(8)) AS truckLoadingLocationCode4
        ,CAST(v.MA_DIEM_XEP_HANG_LEN_XE5 AS NVARCHAR(8)) AS truckLoadingLocationCode5
        ,CAST(v.TEN_DIEM_XEP_HANG_LEN_XE AS NVARCHAR(70)) AS truckLoadingLocationName
        ,CAST(v.DIA_CHI_DIEM_XEP_HANG_LEN_XE AS NVARCHAR(300)) AS truckLoadingLocationAddress
        ,CAST(dds.taxDestinationLocationCode AS NVARCHAR(64)) AS taxDestinationLocationCode
        ,CAST(dds.goodsIdentity AS NVARCHAR(255)) AS goodsIdentity
        ,dds.estimatedArrivalAtDestinationDate AS estimatedArrivalAtDestinationDate
        ,CAST(dds.note AS NVARCHAR(500)) AS note
      FROM dbo.DTOKHAIMD h WITH (NOLOCK)
      LEFT JOIN dbo.DTOKHAIMD_VNACCS v WITH (NOLOCK)
        ON v._DToKhaiMDID = h._DToKhaiMDID
      LEFT JOIN dbo.DTOKHAIMD_VNACCS2 v2 WITH (NOLOCK)
        ON v2._DTOKHAIMDID = h._DToKhaiMDID
      ${CUSTOMS_WAREHOUSE_V2_LABEL_APPLY_SQL}
      OUTER APPLY (
        SELECT TOP 1
          CAST(c.MA_DIA_DIEM AS NVARCHAR(64)) AS taxDestinationLocationCode,
          CAST(c.DINH_DANH_HANG_HOA AS NVARCHAR(255)) AS goodsIdentity,
          c.NGAY_TAU_DEN AS estimatedArrivalAtDestinationDate,
          CAST(c.NOTE AS NVARCHAR(500)) AS note
        FROM dbo.DDS_CONT_TK c WITH (NOLOCK)
        WHERE c._DTOKHAIMDID = h._DToKhaiMDID
        ORDER BY c.DDS_CONT_TKID DESC
      ) dds
      WHERE ${args.whereClause}
      ORDER BY h._DToKhaiMDID DESC;
    `);

		const row = result.recordset[0];
		if (!row) {
			return null;
		}

		const processingDepartments =
			await loadHanProcessingDepartmentsByCustomsCodes(pool, [
				cleanCode(row.customsCode),
			]);
		const nextRow: SqlRow = {
			...row,
			declarationProcessingDeptCode: resolveHanProcessingDepartmentCode(
				processingDepartments,
				row,
			),
		};

		const declarationId = Number(nextRow.declarationId);
		const cargoList = await loadHanCargoByDeclarationId(pool, declarationId);
		const declarationNumber =
			clean(nextRow.declarationNumber) ?? clean(nextRow.firstDeclarationNumber);

		return {
			declarationId,
			declarationNumber,
			declarationDate: toIsoDate(nextRow.declarationDate),
			taxCode: cleanCode(nextRow.taxCode),
			companyName: clean(nextRow.companyName),
			operationCode: cleanCode(nextRow.operationCode),
			xOrN: clean(nextRow.xOrN),
			prefill: buildHanDeclarationPrefill(nextRow),
			cargoList,
		} satisfies HanDeclarationPrefillMatch;
	} finally {
		await pool.close();
	}
}

export async function loadHanDeclarationPrefillByNumber(options: {
	connectionString: string;
	declarationNumber: string;
}) {
	const declarationNumber = clean(options.declarationNumber);
	if (!declarationNumber) {
		throw new Error("Missing declaration number");
	}

	return loadHanDeclarationPrefillInternal({
		connectionString: options.connectionString,
		whereClause: `
      CAST(h.SOTK AS NVARCHAR(64)) = @declarationNumber
      OR CAST(h.SOTK_DAU_TIEN AS NVARCHAR(64)) = @declarationNumber
    `,
		bindParams(request) {
			request.input("declarationNumber", sql.NVarChar(64), declarationNumber);
		},
	});
}

export async function loadHanDeclarationPrefillById(options: {
	connectionString: string;
	declarationId: number;
}) {
	if (!Number.isFinite(options.declarationId)) {
		throw new Error("Missing declaration id");
	}

	return loadHanDeclarationPrefillInternal({
		connectionString: options.connectionString,
		whereClause: "h._DToKhaiMDID = @declarationId",
		bindParams(request) {
			request.input("declarationId", sql.Numeric(18, 0), options.declarationId);
		},
	});
}
