import {
	FIELD_DEFINITIONS,
	type FieldDefinition,
	type FieldHanMapping,
	type FieldHanMappingConfig,
	type FieldImportance,
	type FieldInputType,
	type FieldLookup,
	getCdsInfoFieldUsage,
	isCdsInfoFieldRequiredForOperation,
	isCdsInfoFieldVisibleForOperation,
} from "@/lib/followup/cds-field-definitions";
import {
	getHanColumnMetadataMap,
	type HanColumnMetadata,
} from "@/lib/followup/cds-han-metadata";
import type { FollowUpOperationType } from "@/lib/followup/operation-type";

export type ExternalCdsFieldSchema = {
	sectionKey: string;
	sectionLabel: string;
	appPath: string;
	label: string;
	inputType: FieldInputType;
	required: boolean;
	importance: FieldImportance;
	lookup: FieldLookup | null;
	autofillFrom: string[];
	notes: string[];
	hanMapping:
		| (FieldHanMapping & {
				columnExists: boolean;
				dataType: string | null;
				isNullable: boolean | null;
				maxLength: number | null;
				numericPrecision: number | null;
				numericScale: number | null;
		  })
		| null;
};

export type ExternalCdsSectionSchema = {
	key: string;
	label: string;
	fields: ExternalCdsFieldSchema[];
};

export type ExternalCdsRule = {
	code: string;
	level: "error" | "warning";
	message: string;
};

export type ExternalCdsSchema = {
	operationType: FollowUpOperationType;
	sourceDatabase: string;
	metadataSource: "live" | "fallback";
	sections: ExternalCdsSectionSchema[];
	rules: ExternalCdsRule[];
	examplePayload: Record<string, unknown>;
};

export {
	getCdsInfoFieldUsage,
	isCdsInfoFieldRequiredForOperation,
	isCdsInfoFieldVisibleForOperation,
};

function shouldIncludeField(
	definition: FieldDefinition,
	operationType: FollowUpOperationType,
) {
	if (!definition.visibleFor) {
		return true;
	}

	return definition.visibleFor.includes(operationType);
}

function buildHanMapping(
	mapping: FieldHanMappingConfig | undefined,
	metadataMap: Map<string, HanColumnMetadata>,
	operationType: FollowUpOperationType,
) {
	const resolvedMapping = resolveHanMappingForOperation(mapping, operationType);
	if (!resolvedMapping) {
		return null;
	}

	const metadata =
		metadataMap.get(
			`${resolvedMapping.table.toUpperCase()}::${resolvedMapping.column.toUpperCase()}`,
		) ?? null;

	return {
		...resolvedMapping,
		columnExists: metadata !== null,
		dataType: metadata?.dataType ?? null,
		isNullable: metadata?.isNullable ?? null,
		maxLength: metadata?.maxLength ?? null,
		numericPrecision: metadata?.numericPrecision ?? null,
		numericScale: metadata?.numericScale ?? null,
	};
}

function resolveHanMappingForOperation(
	mapping: FieldHanMappingConfig | undefined,
	operationType: FollowUpOperationType,
): FieldHanMapping | null {
	if (!mapping) {
		return null;
	}

	if ("table" in mapping && "column" in mapping) {
		return mapping;
	}

	return mapping[operationType] ?? null;
}

function buildExamplePayload(operationType: FollowUpOperationType) {
	if (operationType === "NHAP") {
		return {
			operationType: "NHAP",
			taxCode: "2300674028",
			companyName: "Acme Import Co., Ltd.",
			jobNumber: "HANLOGI260412001",
			cdsInfo: {
				operationCode: "A12",
				customsCode: "01CI",
				expectedDeclarationDate: "2026-04-12",
				transportMethodCode: "1",
				exportCountryCode: "CN",
				personOrganizationClassification: "1",
				declarationProcessingDeptCode: "01",
				importerCode: "2300674028",
				importExportUnitName: "Acme Import Co., Ltd.",
				partnerName: "Shipper Sample",
				billOfLading: "BL20260412001",
				packageQuantity: 12,
				packageType: "BX",
				grossWeightTotal: 2560,
				weightUnit: "KGM",
				loadingLocationCode: "CNHKG",
				commercialInvoice: "INV-2026-001",
				commercialInvoiceDate: "2026-04-10",
				totalInvoiceValue: 12000,
				paymentMethod: "KC",
				invoicePriceCondition: "FOB",
				invoiceCurrency: "USD",
				taxableValueCurrencyCode: "USD",
				valuationDeclarationTypeCode: "6",
				taxPayer: "1",
				releaseBeforePermitCode: "A",
				taxPaymentDeadlineCode: "D",
			},
			cargoList: [
				{
					customCode: "ITEM-001",
					hsCode: "39269099",
					vietnameseName: "Linh kien nhua ky thuat",
					originalCargoName: "Engineering plastic component",
					originalCountry: "CN",
					unit: "PCE",
					qty: 1000,
					unitPrice: 12,
					totalPrice: 12000,
					dutyReductionCode: "1",
					imExDutyExemptionCode: "XNK32",
					importTaxCode: "B01",
					vatTaxCode: "VAT10",
					qty2: 1000,
					unit2: "PCE",
				},
			],
		} satisfies Record<string, unknown>;
	}

	return {
		operationType: "XUAT",
		taxCode: "2300674028",
		companyName: "Acme Export Co., Ltd.",
		jobNumber: "HANLOGE260412001",
		cdsInfo: {
			operationCode: "B11",
			customsCode: "02CI",
			expectedDeclarationDate: "2026-04-12",
			transportMethodCode: "9",
			exportCountryCode: "VN",
			declarationProcessingDeptCode: "01",
			importerCode: "2300674028",
			importExportUnitName: "Acme Export Co., Ltd.",
			partnerName: "Buyer Sample",
			billOfLading: "BL20260412001",
			packageQuantity: 12,
			packageType: "BX",
			grossWeightTotal: 2560,
			weightUnit: "KGM",
			commercialInvoice: "INV-2026-001",
			commercialInvoiceDate: "2026-04-10",
			totalInvoiceValue: 12000,
			paymentMethod: "KC",
			invoicePriceCondition: "FOB",
			invoiceCurrency: "USD",
			warehouseLocationCode: "02DSEA0",
			unloadingLocationCode: "VNDEST",
			loadingLocationCode: "VNZZZ",
			transportVehicleCode: "TAU-001",
			packageMarks: "PKG-001",
			contractNumber: "HD-2026-001",
			contractDate: "2026-04-05",
		},
		cargoList: [
			{
				customCode: "ITEM-001",
				hsCode: "39269099",
				vietnameseName: "Linh kien nhua ky thuat",
				originalCargoName: "Engineering plastic component",
				originalCountry: "VN",
				unit: "PCE",
				qty: 1000,
				unitPrice: 12,
				totalPrice: 12000,
				dutyReductionCode: "1",
				imExDutyExemptionCode: "XNK31",
				importTaxCode: "B30",
				qty2: 1000,
				unit2: "PCE",
			},
		],
	} satisfies Record<string, unknown>;
}

function buildRules(operationType: FollowUpOperationType): ExternalCdsRule[] {
	const rules: ExternalCdsRule[] = [
		{
			code: "cargo-list-min-1",
			level: "error",
			message: "Phải có ít nhất 1 dòng hàng không rỗng trong cargoList.",
		},
		{
			code: "cargo-price-either",
			level: "error",
			message: "Mỗi dòng hàng phải có unitPrice hoặc totalPrice.",
		},
		{
			code: "tax-code-fallback",
			level: "warning",
			message:
				"taxCode có thể tự điền sang cdsInfo.importerCode nếu importerCode chưa gửi.",
		},
		{
			code: "company-name-fallback",
			level: "warning",
			message:
				"companyName có thể tự điền sang cdsInfo.importExportUnitName nếu trường CDS tương ứng còn trống.",
		},
	];

	if (operationType === "NHAP") {
		rules.push({
			code: "import-extra-required",
			level: "error",
			message:
				"Nhập khẩu bắt buộc thêm declarationProcessingDeptCode, valuationDeclarationTypeCode, taxableValueCurrencyCode, taxPayer và taxPaymentDeadlineCode. Riêng personOrganizationClassification chỉ bắt buộc khi mã loại hình là E11, E15, E21, E31 hoặc E41.",
		});
	}

	if (operationType === "XUAT") {
		rules.push({
			code: "export-extra-required",
			level: "error",
			message:
				"Xuất khẩu cần khai đủ các trường bắt buộc theo tờ khai xuất. Riêng personOrganizationClassification chỉ bắt buộc khi mã loại hình là E42, E52, E62 hoặc E82.",
		});
	}

	return rules;
}

export async function buildExternalCdsSchema(
	operationType: FollowUpOperationType,
): Promise<ExternalCdsSchema> {
	const metadataMap = await getHanColumnMetadataMap();
	const sections = new Map<string, ExternalCdsSectionSchema>();

	for (const definition of FIELD_DEFINITIONS) {
		if (!shouldIncludeField(definition, operationType)) {
			continue;
		}

		const importance = definition.importance ?? "optional";
		const required = definition.requiredFor?.includes(operationType) ?? false;

		const field: ExternalCdsFieldSchema = {
			sectionKey: definition.sectionKey,
			sectionLabel: definition.sectionLabel,
			appPath: definition.appPath,
			label: definition.label,
			inputType: definition.inputType,
			required,
			importance: required ? "required" : importance,
			lookup: definition.lookup ?? null,
			autofillFrom: definition.autofillFrom ?? [],
			notes: definition.notes ?? [],
			hanMapping: buildHanMapping(
				definition.hanMapping,
				metadataMap,
				operationType,
			),
		};

		const existingSection = sections.get(definition.sectionKey);
		if (existingSection) {
			existingSection.fields.push(field);
			continue;
		}

		sections.set(definition.sectionKey, {
			key: definition.sectionKey,
			label: definition.sectionLabel,
			fields: [field],
		});
	}

	return {
		operationType,
		sourceDatabase: "HAN_2024",
		metadataSource: metadataMap.size > 0 ? "live" : "fallback",
		sections: [...sections.values()],
		rules: buildRules(operationType),
		examplePayload: buildExamplePayload(operationType),
	};
}
