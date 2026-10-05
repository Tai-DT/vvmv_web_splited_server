// cds-lookup-types.ts – types extracted from cds-info-panel.tsx (Phase 1)

import type { CdsExportValidationIssue } from "@/lib/followup/cds-export-validation";
import type { HistoricalPrefillFieldMeta } from "@/lib/followup/history-prefill";
import type { ProcessingDepartmentLookup } from "@/lib/followup/processing-department";
import type { FollowUpCdsInfoRow } from "../../../types";
import type { OcrValidationIssue } from "./cds-types";

export type BillItem = NonNullable<FollowUpCdsInfoRow["billItems"]>[number];

export type LookupDialogOption = {
	id: string;
	value: string;
	label: string;
	description?: string;
	meta?: Record<string, string | null | undefined>;
	searchText: string;
};

export type LookupDialogVariant = "list" | "location-table";

export type LookupDialogState = {
	title: string;
	description?: string;
	emptyMessage: string;
	options: LookupDialogOption[];
	variant?: LookupDialogVariant;
	searchPlaceholder?: string;
	selectedValue?: string | null;
	selectedOptionId?: string | null;
	onSelect: (option: LookupDialogOption) => void;
};

export type DeclarationDirection = "import" | "export" | "unknown";

export type CdsDatabaseOperationCode = {
	code: string;
	name: string;
	direction: DeclarationDirection;
};

export type CdsDatabaseImportLicense = {
	id: string;
	permitTypeCode: string | null;
	permitTypeName: string | null;
	permitNo: string;
	permitIssueDate: string | null;
	permitExpiryDate: string | null;
	declarationCount: number | null;
	firstDeclarationDate: string | null;
	lastDeclarationDate: string | null;
	sampleDeclarationNo: string | null;
	sampleCustomsCode: string | null;
	isExplicitImportLicense: boolean;
};

export type CdsDatabasePermit = CdsDatabaseImportLicense;

export type CdsDatabasePermitType = {
	code: string;
	name: string;
};

export type CdsDatabaseFieldOption = {
	field: string;
	value: string;
	label?: string | null;
	address?: string | null;
	count: number;
	direction: DeclarationDirection;
	source: "header" | "vnaccs" | "app" | "app_saved" | "snapshot";
};

export type CdsProcessingDepartmentLookup = ProcessingDepartmentLookup;

export type CdsDatabaseElectronicAttachment = {
	attachmentTypeCode: string;
	attachmentNumber: string | null;
	attachmentDescription: string | null;
	count: number;
};

export type CdsDatabaseLookupsPayload = {
	operationCodes: CdsDatabaseOperationCode[];
	importLicenses: CdsDatabaseImportLicense[];
	permits: CdsDatabasePermit[];
	permitTypes: CdsDatabasePermitType[];
	processingDepartments: CdsProcessingDepartmentLookup[];
	fieldOptions: Partial<
		Record<Extract<keyof FollowUpCdsInfoRow, string>, CdsDatabaseFieldOption[]>
	>;
	electronicAttachments: CdsDatabaseElectronicAttachment[];
};

export type SelectOption = {
	value: string;
	label: string;
	meta?: Record<string, string | null | undefined>;
};

export type LookupSource = "live" | "app" | "app_saved" | "fallback" | "none";

export type CargoIdentificationCandidate = {
	id: string;
	declarationNumber: string | null;
	cargoIdentificationNumber: string;
	declarationDate: string | null;
	createdAt: string | null;
	taxCode: string | null;
	companyName: string | null;
	jobNumber: string | null;
	sourceLabel: string;
};

export type CargoEditorDialogMode =
	| "default"
	| "add"
	| "detail"
	| "columns"
	| "allocation"
	| "utilities";

export type ImportStringListField =
	| "otherLegalDocumentCodes"
	| "importLicenses";
export type ImportLegacyStringField =
	| "otherLegalDocumentCode"
	| "importLicense";

export type ValuationAdjustmentRow = NonNullable<
	FollowUpCdsInfoRow["valuationAdjustments"]
>[number];

export type ElectronicAttachmentRow = NonNullable<
	FollowUpCdsInfoRow["electronicAttachments"]
>[number];

export type TransportScheduleRow = NonNullable<
	FollowUpCdsInfoRow["transportSchedules"]
>[number];

export type ReviewPanelItem = {
	fieldKey: keyof FollowUpCdsInfoRow;
	label: string;
	currentDisplay: string;
	validationIssues: CdsExportValidationIssue[];
	ocrIssue?: OcrValidationIssue;
	historyMeta?: HistoricalPrefillFieldMeta;
	historySuggestion: string | null;
	catalogMismatch: boolean;
	catalogOptionsCount: number;
	suggestionValues: string[];
	score: number;
};

export type FieldRenderLockOptions = {
	forceDisabled?: boolean;
	disabledReason?: string | null;
};

export type ImportImage1SourceField =
	| "importerCode"
	| "entrustedImporterCode"
	| "exporterCode";

export type LookupDialogMeta = {
	title: string;
	description: string;
	emptyMessage: string;
	successMessage: string;
};

export type PartnersMasterDataDirectoryResponse = {
	partners?: Array<{
		id: string;
		taxCode?: string | null;
		fullName?: string | null;
	}>;
};
