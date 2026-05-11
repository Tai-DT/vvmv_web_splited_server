import type { CdsAiDocumentExtractionResult } from "@/lib/followup/cds-ai-document";
import type { FollowUpOperationType } from "@/lib/followup/operation-type";
import type {
	CargoListRow,
	FollowUpCdsInfoRow,
	FollowUpRow,
} from "../../../../types";

/* ------------------------------------------------------------------ */
/*  Domain types                                                       */
/* ------------------------------------------------------------------ */

export type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	text: string;
	result?: CdsAiDocumentExtractionResult | null;
	usage?: CdsAiUsageMetrics | null;
	tone?: "default" | "error";
};

export type CdsAiTimingBreakdown = {
	prepDriveMs: number | null;
	prepUploadMs: number | null;
	geminiMs: number | null;
	sanitizeMs: number | null;
};

export type CdsAiUsageMetrics = {
	promptTokens: number | null;
	candidatesTokens: number | null;
	totalTokens: number | null;
	durationMs: number | null;
	timing?: CdsAiTimingBreakdown | null;
};

export type DriveFile = {
	id: string;
	name: string;
	mimeType: string;
	size?: string | null;
};

export type HistorySession = {
	id: string;
	label: string;
	date: string;
	fileNames?: string[];
};

export type DiffStatus = "same" | "new" | "changed";

/* ------------------------------------------------------------------ */
/*  Component prop types                                               */
/* ------------------------------------------------------------------ */

export interface CdsAiDocumentTabProps {
	followUpId: string;
	operationType: FollowUpOperationType | null;
	followUpSummary?: Partial<FollowUpRow> | null;
	currentData: Partial<FollowUpCdsInfoRow>;
	currentCargoList: Partial<CargoListRow>[];
	handleFieldChange: (field: keyof FollowUpCdsInfoRow, value: unknown) => void;
	onCdsInfoPersisted?: (data: Partial<FollowUpCdsInfoRow>) => void;
	onCargoApplied?: (rows: Partial<CargoListRow>[]) => void;
}

export interface CdsAiSidebarProps {
	followUpId: string;
	files: File[];
	driveFiles: DriveFile[];
	selectedDriveFileIds: string[];
	sessions: HistorySession[];
	sessionId: string | null;
	fillMissingOnly: boolean;
	autoUploadToDrive: boolean;
	activeDraftFieldCount: number;
	activeDraftWarningCount: number;
	attachedSourceCount: number;
	dragging: boolean;
	isFetchingDriveFiles: boolean;
	isLoadingHistory: boolean;
	isApplying: boolean;
	driveUrl: string | null;
	driveFolderId: string | null;
	latestResult: CdsAiDocumentExtractionResult | null;
	onAppendFiles: (files: File[]) => void;
	onRemoveFile: (index: number) => void;
	onToggleDriveFile: (fileId: string) => void;
	onSelectAllDriveFiles: () => void;
	onRefreshDriveFiles: () => void;
	onLoadHistory: (sessionId: string) => void;
	onStartNewSession: () => void;
	onSetFillMissingOnly: (value: boolean) => void;
	onSetAutoUploadToDrive: (value: boolean) => void;
	onSetDragging: (value: boolean) => void;
	onApply: () => void;
	fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export interface CdsAiChatProps {
	messages: ChatMessage[];
	latestResult: CdsAiDocumentExtractionResult | null;
	activeResultMessageId: string | null;
	isAnalyzing: boolean;
	isLoadingHistory: boolean;
	sessionId: string | null;
	sessionFileNames: string[];
	activeSessionLabel: string | null;
	transcriptEndRef: React.RefObject<HTMLDivElement | null>;
	onSetPrompt: (prompt: string) => void;
}

export interface CdsAiComposerProps {
	prompt: string;
	attachedSourceCount: number;
	fillMissingOnly: boolean;
	files: File[];
	selectedDriveFileIds: string[];
	sessionFileNames: string[];
	latestResult: CdsAiDocumentExtractionResult | null;
	hasCurrentSnapshot: boolean;
	isAnalyzing: boolean;
	isUploadingToDrive: boolean;
	canAnalyze: boolean;
	geminiModelOptions: string[];
	selectedGeminiModel: string;
	onSelectGeminiModel: (modelId: string) => void;
	onSetPrompt: (prompt: string) => void;
	onAnalyze: () => void;
}

export interface CdsAiResultPreviewProps {
	result: CdsAiDocumentExtractionResult;
	isActive: boolean;
	onActivate?: () => void;
}

export interface CdsAiResultDetailsProps {
	latestResult: CdsAiDocumentExtractionResult;
	currentData: Partial<FollowUpCdsInfoRow>;
	currentCargoList: Partial<CargoListRow>[];
	fillMissingOnly: boolean;
	operationType: FollowUpOperationType | null;
	fieldDrafts: Record<string, string>;
	cargoDrafts: Record<string, string>;
	onSetFieldDrafts: React.Dispatch<
		React.SetStateAction<Record<string, string>>
	>;
	onSetCargoDrafts: React.Dispatch<
		React.SetStateAction<Record<string, string>>
	>;
	onCommitFieldDraft: (fieldKey: string) => void;
	onCommitCargoDraft: (rowIndex: number, columnKey: string) => void;
}

export interface CdsAiMetricCardProps {
	tone: "sky" | "amber" | "emerald" | "slate" | "rose";
	label: string;
	value: React.ReactNode;
	description: string;
}
