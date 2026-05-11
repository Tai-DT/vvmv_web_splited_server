import type {
	FollowUpCdsInfoRow,
	FollowUpRow,
} from "@/app/(home)/internal/followup/types";
import { normalizeOptionalCdsWeightUnit } from "@/lib/followup/cds-weight-units";
import {
	buildHistoricalOcrPrefill,
	type HistoricalPrefillRecord,
} from "@/lib/followup/history-prefill";

export const CDS_HISTORY_DEFAULT_FIELDS = [
	"importerCode",
	"importExportUnitName",
	"importerPostalCode",
	"importExportBusinessAddress",
	"importerPhone",
	"partnerName",
	"customsCode",
	"declarationProcessingDeptCode",
	"cargoClassificationCode",
	"personOrganizationClassification",
	"packageType",
	"weightUnit",
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
	"importLicense",
	"licenseNumber",
	"contractNumber",
	"contractDate",
	"paymentMethod",
	"invoiceFormClassificationCode",
	"invoicePriceCondition",
	"invoiceClassificationCode",
	"invoiceCurrency",
	"taxableValueCurrencyCode",
	"valuationDeclarationTypeCode",
	"transportFeeClassificationCode",
	"transportFeeCurrencyCode",
	"insuranceFeeClassificationCode",
	"insuranceFeeCurrencyCode",
	"taxPayer",
	"releaseBeforePermitCode",
	"taxPaymentDeadlineCode",
	"taxDestinationLocation",
	"internalBusinessManagementNumber",
	"businessTypeGroup",
	"exportCountryCode",
] as const satisfies ReadonlyArray<keyof FollowUpCdsInfoRow>;

export const CDS_IMPORT_EXPORT_REFERENCE_FIELDS = [
	"businessTypeGroup",
	"cargoClassificationCode",
	"contractDate",
	"contractGoodsDate",
	"contractNumber",
	"insuranceFeeClassificationCode",
	"insuranceFeeCurrencyCode",
	"invoiceClassificationCode",
	"invoiceCurrency",
	"invoiceFormClassificationCode",
	"invoicePriceCondition",
	"paymentMethod",
	"personOrganizationClassification",
	"taxableValueCurrencyCode",
	"transportFeeClassificationCode",
	"transportFeeCurrencyCode",
	"valuationDeclarationTypeCode",
] as const satisfies ReadonlyArray<keyof FollowUpCdsInfoRow>;

type CdsHistoryDefaultSourceRecord = Pick<
	FollowUpRow,
	"id" | "jobNumber" | "taxCode" | "companyName"
> & {
	createdAt?: Date | string | null;
	cdsInfo?: Partial<FollowUpCdsInfoRow> | Record<string, unknown> | null;
};

function normalizeText(value: unknown) {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime())
			? null
			: value.toISOString().slice(0, 10);
	}

	if (typeof value === "number") {
		return Number.isFinite(value) ? String(value) : null;
	}

	const normalized = String(value ?? "").trim();
	return normalized === "" ? null : normalized;
}

function normalizeCode(value: unknown) {
	return normalizeText(value)?.toUpperCase() ?? null;
}

function toHistoricalPrefillRecord(
	record: CdsHistoryDefaultSourceRecord,
): (HistoricalPrefillRecord & { operationCode: string | null }) | null {
	const cdsInfo =
		record.cdsInfo &&
		typeof record.cdsInfo === "object" &&
		!Array.isArray(record.cdsInfo)
			? (record.cdsInfo as Record<string, unknown>)
			: null;

	if (!cdsInfo) {
		return null;
	}

	const normalizedCdsInfo: Record<string, string> = {};

	CDS_HISTORY_DEFAULT_FIELDS.forEach((field) => {
		const value =
			field === "weightUnit"
				? normalizeOptionalCdsWeightUnit(cdsInfo[field])
				: normalizeText(cdsInfo[field]);
		if (value) {
			normalizedCdsInfo[field] = value;
		}
	});

	if (Object.keys(normalizedCdsInfo).length === 0) {
		return null;
	}

	return {
		id: record.id,
		jobNumber: record.jobNumber ?? null,
		taxCode: record.taxCode ?? null,
		companyName: record.companyName ?? null,
		createdAt: record.createdAt ?? new Date(0).toISOString(),
		cdsInfo: normalizedCdsInfo,
		operationCode: normalizeCode(cdsInfo.operationCode),
	};
}

export function buildCdsHistoryDefaults(args: {
	records: CdsHistoryDefaultSourceRecord[];
	currentOperationCode?: unknown;
	fields?: ReadonlyArray<keyof FollowUpCdsInfoRow>;
	sourceLabel?: string;
}) {
	const normalizedRecords = args.records
		.map((record) => toHistoricalPrefillRecord(record))
		.filter(
			(
				record,
			): record is HistoricalPrefillRecord & { operationCode: string | null } =>
				record !== null,
		);

	if (normalizedRecords.length === 0) {
		return {
			data: {} as Partial<FollowUpCdsInfoRow>,
			fieldMeta: {},
		};
	}

	const normalizedOperationCode = normalizeCode(args.currentOperationCode);
	const sameOperationCodeRecords = normalizedOperationCode
		? normalizedRecords.filter(
				(record) => record.operationCode === normalizedOperationCode,
			)
		: [];

	const candidateRecords =
		sameOperationCodeRecords.length >= 2
			? sameOperationCodeRecords
			: normalizedRecords;

	const result = buildHistoricalOcrPrefill(
		candidateRecords,
		args.fields ?? CDS_HISTORY_DEFAULT_FIELDS,
	);

	const sourceLabel = args.sourceLabel ?? "Lịch sử cùng khách hàng";

	Object.values(result.fieldMeta).forEach((meta) => {
		meta.sourceLabel = sourceLabel;
	});

	return {
		data: result.data as Partial<FollowUpCdsInfoRow>,
		fieldMeta: result.fieldMeta,
	};
}
