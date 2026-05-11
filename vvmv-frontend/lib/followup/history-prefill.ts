export const OCR_PREFILL_FIELDS = [
	"operationCode",
	"correspondingDeclarationNumber",
	"customsCode",
	"declarationProcessingDeptCode",
	"personOrganizationClassification",
	"importerCode",
	"importExportUnitName",
	"importerPostalCode",
	"importExportBusinessAddress",
	"importerPhone",
	"entrustedImporterCode",
	"entrustedImporterName",
	"entrustedExporterName",
	"partnerName",
	"exporterPostalCode",
	"exportCountryCode",
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
	"transportVehicleCode",
	"transportVehicleName",
	"departureArrivalDate",
	"importLicense",
	"licenseNumber",
	"electronicInvoiceReceiptNumber",
	"commercialInvoice",
	"invoiceFormClassificationCode",
	"commercialInvoiceDate",
	"paymentMethod",
	"invoiceClassificationCode",
	"declaredValue",
	"totalInvoiceValue",
	"totalTaxableValue",
	"contractNumber",
	"contractDate",
	"contractGoodsDate",
	"invoicePriceCondition",
	"invoiceCurrency",
	"taxableValueCurrencyCode",
	"valuationDeclarationTypeCode",
	"transportFee",
	"transportFeeClassificationCode",
	"transportFeeCurrencyCode",
	"insuranceFee",
	"insuranceFeeClassificationCode",
	"insuranceFeeCurrencyCode",
	"insuranceRegistrationNumber",
	"taxPayer",
	"releaseBeforePermitCode",
	"taxPaymentDeadlineCode",
	"taxDestinationLocation",
	"internalBusinessManagementNumber",
	"otherLegalDocumentCode",
] as const;

export type HistoricalPrefillRecord = {
	id: string;
	jobNumber: string | null;
	taxCode: string | null;
	companyName: string | null;
	createdAt: Date | string;
	cdsInfo: Record<string, unknown> | null;
};

export type HistoricalPrefillSource = {
	id: string;
	jobNumber: string | null;
	taxCode: string | null;
	companyName: string | null;
	createdAt: string;
	sourceType?: "history" | "profile";
	sourceLabel?: string;
};

export type HistoricalPrefillFieldMeta = {
	value: string;
	count: number;
	sources: HistoricalPrefillSource[];
	sourceType?: "history" | "profile";
	sourceLabel?: string;
};

const LINKED_FIELD_GROUPS = [
	["customsCode", "declarationProcessingDeptCode"],
] as const;
const LINKED_FIELDS = new Set<string>(LINKED_FIELD_GROUPS.flat());

function normalizeValue(value: string) {
	return value.trim().toUpperCase();
}

function normalizeCreatedAt(value: Date | string) {
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function getNormalizedCdsInfo(record: HistoricalPrefillRecord) {
	return record.cdsInfo &&
		typeof record.cdsInfo === "object" &&
		!Array.isArray(record.cdsInfo)
		? record.cdsInfo
		: null;
}

function buildHistoricalSource(record: HistoricalPrefillRecord) {
	return {
		id: record.id,
		jobNumber: record.jobNumber,
		taxCode: record.taxCode,
		companyName: record.companyName,
		createdAt: normalizeCreatedAt(record.createdAt),
	};
}

export function buildHistoricalOcrPrefill(
	records: HistoricalPrefillRecord[],
	fields: readonly string[] = OCR_PREFILL_FIELDS,
) {
	const data: Record<string, string> = {};
	const fieldMeta: Record<string, HistoricalPrefillFieldMeta> = {};
	const requestedFields = new Set(fields);

	for (const group of LINKED_FIELD_GROUPS) {
		if (!group.every((field) => requestedFields.has(field))) {
			continue;
		}

		const candidates = records
			.map((record) => {
				const cdsInfo = getNormalizedCdsInfo(record);
				const values = cdsInfo
					? group.map((field) =>
							typeof cdsInfo[field] === "string" && cdsInfo[field].trim() !== ""
								? cdsInfo[field].trim()
								: null,
						)
					: [];

				return {
					record,
					values,
				};
			})
			.filter(
				(
					item,
				): item is {
					record: HistoricalPrefillRecord;
					values: string[];
				} => item.values.length === group.length && item.values.every(Boolean),
			);

		if (candidates.length < 2) continue;

		const counts = new Map<
			string,
			{
				rawValues: string[];
				count: number;
				sources: HistoricalPrefillSource[];
			}
		>();

		for (const candidate of candidates) {
			const key = candidate.values.map(normalizeValue).join("||");
			const current = counts.get(key) ?? {
				rawValues: candidate.values,
				count: 0,
				sources: [],
			};

			current.count += 1;
			current.sources.push(buildHistoricalSource(candidate.record));
			counts.set(key, current);
		}

		const ranked = [...counts.values()].sort((a, b) => b.count - a.count);
		const top = ranked[0];
		const second = ranked[1];

		if (top && top.count >= 2 && (!second || top.count > second.count)) {
			group.forEach((field, index) => {
				data[field] = top.rawValues[index];
				fieldMeta[field] = {
					value: top.rawValues[index],
					count: top.count,
					sources: top.sources.slice(0, 3),
					sourceType: "history",
					sourceLabel: "Lịch sử cùng khách hàng",
				};
			});
		}
	}

	for (const field of fields) {
		if (LINKED_FIELDS.has(field)) {
			continue;
		}

		const candidates = records
			.map((record) => ({
				record,
				value: getNormalizedCdsInfo(record)?.[field] ?? null,
			}))
			.filter(
				(item): item is { record: HistoricalPrefillRecord; value: string } =>
					typeof item.value === "string" && item.value.trim() !== "",
			)
			.map((item) => ({
				record: item.record,
				value: item.value.trim(),
			}));

		if (candidates.length < 2) continue;

		const counts = new Map<
			string,
			{ raw: string; count: number; sources: HistoricalPrefillSource[] }
		>();

		for (const candidate of candidates) {
			const key = normalizeValue(candidate.value);
			const current = counts.get(key) ?? {
				raw: candidate.value,
				count: 0,
				sources: [],
			};

			current.count += 1;
			current.sources.push(buildHistoricalSource(candidate.record));
			counts.set(key, current);
		}

		const ranked = [...counts.values()].sort((a, b) => b.count - a.count);
		const top = ranked[0];
		const second = ranked[1];

		if (top && top.count >= 2 && (!second || top.count > second.count)) {
			data[field] = top.raw;
			fieldMeta[field] = {
				value: top.raw,
				count: top.count,
				sources: top.sources.slice(0, 3),
				sourceType: "history",
				sourceLabel: "Lịch sử cùng khách hàng",
			};
		}
	}

	return { data, fieldMeta };
}

export function buildLatestHistoricalOcrPrefill(
	records: HistoricalPrefillRecord[],
	fields: readonly string[] = OCR_PREFILL_FIELDS,
) {
	const data: Record<string, string> = {};
	const fieldMeta: Record<string, HistoricalPrefillFieldMeta> = {};

	for (const field of fields) {
		const latest = records.find((record) => {
			const value = getNormalizedCdsInfo(record)?.[field];
			return typeof value === "string" && value.trim() !== "";
		});

		if (!latest) {
			continue;
		}

		const value = String(getNormalizedCdsInfo(latest)?.[field]).trim();
		if (!value) {
			continue;
		}

		data[field] = value;
		fieldMeta[field] = {
			value,
			count: 1,
			sources: [buildHistoricalSource(latest)],
			sourceType: "history",
			sourceLabel: "Lịch sử gần nhất cùng khách hàng",
		};
	}

	return { data, fieldMeta };
}
