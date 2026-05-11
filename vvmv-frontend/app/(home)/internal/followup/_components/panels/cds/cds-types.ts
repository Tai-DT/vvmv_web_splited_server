// Types and constants extracted from cds-info-panel.tsx

import type { CdsHanVerificationSummary } from "@/lib/followup/cds-han-compare";
import type { FollowUpOperationType } from "@/lib/followup/operation-type";
import type {
	ContainerRow,
	DeclarationRow,
	FollowUpCdsInfoRow,
	FollowUpRow,
} from "../../../types";
import type { CdsInfoFieldConfig } from "../panel-config";

export type OcrValidationIssue = {
	path: string;
	severity: "error" | "warning" | "info";
	message: string;
	suggestions?: string[];
};

export type CdsRequiredFieldStatus = {
	followUpId: string;
	canRegister: boolean;
	missingFields: Array<"MA_DV" | "MA_HQ" | "DV_DT" | "MA_LH">;
	resolved: {
		maDv: { value: string | null; source: string };
		maHq: { value: string | null; source: string };
		dvDt: { value: string | null; source: string };
		maLh: { value: string | null; source: string };
	};
	declarationNumber: string | null;
};

export type CdsRegisterResult = {
	status: "inserted" | "reused";
	declarationId: number;
	declarationNumber: string | null;
	operationType: FollowUpOperationType | null;
	ddsContTkId: number | null;
	insertedTables: string[];
	updatedTables: string[];
	containerDetailCount: number;
	localDeclarationId: string | null;
	warnings: string[];
	verify?: CdsHanVerificationSummary;
	lifecycleStatus?: "REGISTERED";
	registeredAt?: string;
	registeredBy?: string;
};

export type FieldConfig = CdsInfoFieldConfig;

export const EMPTY_CONTAINERS: ContainerRow[] = [];
export const EMPTY_DECLARATIONS: DeclarationRow[] = [];

// Types for tab configuration
export type CdsInfoTabConfig = {
	id: string;
	label: string;
	description: string;
	sections: { title: string; fields: FieldConfig[] }[];
	kind: "form" | "cargo" | "container";
};

export type TabChecklistItemConfig = {
	id: string;
	label: string;
	fieldKey?: keyof FollowUpCdsInfoRow;
	requirePositiveNumber?: boolean;
	kind?: "field" | "cargo" | "precheck";
};

export type CompositeFieldRef =
	| FieldConfig["key"]
	| (Partial<FieldConfig> & { key: FieldConfig["key"] });

export type {
	FollowUpCdsInfoRow,
	FollowUpRow,
	ContainerRow,
	DeclarationRow,
	CdsInfoFieldConfig,
	FollowUpOperationType,
};
