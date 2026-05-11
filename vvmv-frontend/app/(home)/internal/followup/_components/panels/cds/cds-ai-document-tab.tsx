"use client";

import {
	CheckCircle2,
	FileText,
	FolderOpen,
	HardDrive,
	History,
	Loader2,
	MessageSquareText,
	Paperclip,
	RefreshCw,
	Send,
	Sparkles,
	Trash2,
	Upload,
} from "lucide-react";
import {
	type ChangeEvent,
	startTransition,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	type CdsAiDocumentChecklistStatus,
	type CdsAiDocumentExtractionResult,
	rebuildCdsAiDocumentResult,
	sanitizeCdsAiDocumentResult,
} from "@/lib/followup/cds-ai-document";
import { FIELD_DEFINITIONS } from "@/lib/followup/cds-field-definitions";
import { isCdsWebLockedField } from "@/lib/followup/cds-web-locked-fields";
import type { FollowUpOperationType } from "@/lib/followup/operation-type";
import { cn } from "@/lib/utils";
import type {
	CargoListRow,
	FollowUpCdsInfoRow,
	FollowUpRow,
} from "../../../types";
import { type CargoColumn, FOLLOWUP_CARGO_COLUMNS } from "../panel-config";
import { getCdsAiFieldLabel } from "./ai/cds-ai-constants";

type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	text: string;
	result?: CdsAiDocumentExtractionResult | null;
	tone?: "default" | "error";
};

type DriveFile = {
	id: string;
	name: string;
	mimeType: string;
};

type HistorySession = {
	id: string;
	label: string;
	date: string;
	fileNames?: string[];
};

type DiffStatus = "same" | "new" | "changed";

const CDS_FIELD_INPUT_TYPES = Object.fromEntries(
	FIELD_DEFINITIONS.filter((definition) =>
		definition.appPath.startsWith("cdsInfo."),
	).map((definition) => [
		definition.appPath.replace("cdsInfo.", ""),
		definition.inputType,
	]),
) as Record<string, "text" | "number" | "date" | "select">;

const QUICK_CHAT_PROMPTS = [
	"Giữ nguyên kết quả hiện tại nhưng sửa lại số invoice theo chứng từ mới.",
	"Chỉ điền các ô còn trống, không thay danh sách hàng đang có.",
	"Rà lại mã HS, tên hàng và gộp các dòng hàng bị trùng.",
];

function getLocalFileFallbackMessage(error: unknown) {
	const message = error instanceof Error ? error.message.trim() : "";
	const normalizedMessage = message.toLowerCase();

	if (normalizedMessage.includes("file not found")) {
		return "Không tìm thấy file trên Google Drive. AI sẽ dùng file local cho lượt này.";
	}

	return "Không thể lưu file lên Google Drive. AI sẽ dùng file local cho lượt này.";
}

function getMetricCardClasses(
	tone: "sky" | "amber" | "emerald" | "slate" | "rose",
) {
	if (tone === "sky") {
		return "border-sky-200 bg-sky-50 text-sky-900";
	}

	if (tone === "amber") {
		return "border-amber-200 bg-amber-50 text-amber-900";
	}

	if (tone === "emerald") {
		return "border-emerald-200 bg-emerald-50 text-emerald-900";
	}

	if (tone === "rose") {
		return "border-rose-200 bg-rose-50 text-rose-900";
	}

	return "border-slate-200 bg-slate-50 text-slate-900";
}

function getChecklistMeta(status: CdsAiDocumentChecklistStatus) {
	if (status === "found") {
		return {
			badgeLabel: "Đã nhận diện",
			badgeVariant: "success" as const,
			dotClassName: "bg-emerald-500",
		};
	}

	if (status === "missing") {
		return {
			badgeLabel: "Thiếu dữ liệu",
			badgeVariant: "destructive" as const,
			dotClassName: "bg-rose-500",
		};
	}

	return {
		badgeLabel: "Cần rà soát",
		badgeVariant: "warning" as const,
		dotClassName: "bg-amber-500",
	};
}

function getFilledFieldCount(result: CdsAiDocumentExtractionResult) {
	return Object.values(result.cdsInfo).filter((value) =>
		isMeaningfulValue(value),
	).length;
}

function getDocumentWarningCount(result: CdsAiDocumentExtractionResult) {
	return result.documents.reduce(
		(total, document) => total + document.warnings.length,
		0,
	);
}

function normalizePrompt(
	prompt: string,
	operationType: FollowUpOperationType | null,
) {
	const trimmed = prompt.trim();
	if (trimmed) {
		return trimmed;
	}

	return operationType === "NHAP"
		? "OCR chứng từ nhập khẩu và trích xuất dữ liệu để điền CDS."
		: operationType === "XUAT"
			? "OCR chứng từ xuất khẩu và trích xuất dữ liệu để điền CDS."
			: "OCR chứng từ và trích xuất dữ liệu cần thiết để điền CDS.";
}

function getFileSignature(file: File) {
	return `${file.name}-${file.size}-${file.lastModified}`;
}

function isMeaningfulValue(value: unknown): boolean {
	if (value === null || value === undefined) {
		return false;
	}

	if (typeof value === "string") {
		return value.trim() !== "";
	}

	if (typeof value === "number") {
		return Number.isFinite(value);
	}

	if (Array.isArray(value)) {
		return value.some((item) => isMeaningfulValue(item));
	}

	if (typeof value === "object") {
		return Object.values(value as Record<string, unknown>).some((item) =>
			isMeaningfulValue(item),
		);
	}

	return true;
}

function formatValue(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}

	if (typeof value === "number") {
		return String(value);
	}

	if (typeof value === "string") {
		return value;
	}

	if (Array.isArray(value)) {
		const compact = value
			.map((item) =>
				typeof item === "object" ? JSON.stringify(item) : String(item ?? ""),
			)
			.filter((item) => item.trim() !== "");
		return compact.join(" | ");
	}

	return JSON.stringify(value);
}

function formatComparableValue(value: unknown): string {
	if (!isMeaningfulValue(value)) {
		return "";
	}

	if (typeof value === "number") {
		return String(value);
	}

	if (typeof value === "string") {
		return value.trim();
	}

	return JSON.stringify(value);
}

function resolveDiffStatus(
	currentValue: unknown,
	nextValue: unknown,
): DiffStatus {
	if (!isMeaningfulValue(currentValue) && isMeaningfulValue(nextValue)) {
		return "new";
	}

	return formatComparableValue(currentValue) ===
		formatComparableValue(nextValue)
		? "same"
		: "changed";
}

function isScalarEditable(value: unknown) {
	return (
		value === null ||
		value === undefined ||
		typeof value === "string" ||
		typeof value === "number"
	);
}

function formatFileSize(file: File) {
	if (file.size < 1024) {
		return `${file.size} B`;
	}

	if (file.size < 1024 * 1024) {
		return `${(file.size / 1024).toFixed(1)} KB`;
	}

	return `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
}

function extractDriveFolderId(driveUrl?: string | null) {
	if (!driveUrl) {
		return null;
	}

	const match = driveUrl.match(/(?:folders\/|id=)([a-zA-Z0-9_-]+)/);
	return match ? match[1] : null;
}

function mergeUniqueStrings(values: string[]) {
	return Array.from(new Set(values.filter((value) => value.trim() !== "")));
}

function pickMeaningfulFields<T extends Record<string, unknown>>(
	value: T,
): Partial<T> {
	return Object.fromEntries(
		Object.entries(value).filter(([, fieldValue]) =>
			isMeaningfulValue(fieldValue),
		),
	) as Partial<T>;
}

function buildCurrentSnapshot(
	currentData: Partial<FollowUpCdsInfoRow>,
	currentCargoList: Partial<CargoListRow>[],
) {
	const cdsInfo = pickMeaningfulFields(
		currentData as Record<string, unknown>,
	) as Partial<FollowUpCdsInfoRow>;

	const cargoList = currentCargoList
		.map((row) => {
			const persistableFields = { ...row };
			delete persistableFields.id;
			delete persistableFields.followUpId;
			delete persistableFields.createdAt;
			delete persistableFields.updatedAt;

			return pickMeaningfulFields(
				persistableFields as Record<string, unknown>,
			) as Partial<CargoListRow>;
		})
		.filter((row) => Object.keys(row).length > 0);

	if (Object.keys(cdsInfo).length === 0 && cargoList.length === 0) {
		return null;
	}

	return {
		cdsInfo,
		cargoList,
	};
}

function parseCdsFieldDraft(
	fieldKey: string,
	rawValue: string,
	previousValue: unknown,
) {
	const trimmed = rawValue.trim();
	if (trimmed === "") {
		return null;
	}

	const inputType = CDS_FIELD_INPUT_TYPES[fieldKey];
	if (inputType === "number" || typeof previousValue === "number") {
		const parsed = Number(trimmed.replace(/,/g, ""));
		return Number.isFinite(parsed) ? parsed : (previousValue ?? null);
	}

	return trimmed;
}

function parseCargoDraft(
	column: CargoColumn,
	rawValue: string,
	previousValue: unknown,
) {
	const trimmed = rawValue.trim();
	if (trimmed === "") {
		return null;
	}

	if (column.type === "number") {
		const parsed = Number(trimmed.replace(/,/g, ""));
		return Number.isFinite(parsed) ? parsed : (previousValue ?? null);
	}

	return trimmed;
}

function getCargoRowKey(row: Partial<CargoListRow>) {
	return [
		row.customCode,
		row.hsCode,
		row.originalCargoName,
		row.vietnameseName,
		row.invoiceNo,
		row.invoiceDate,
	]
		.map((value) => String(value ?? "").trim())
		.filter((value) => value !== "")
		.join("|");
}

function getCargoCellDiffClass(status: DiffStatus) {
	if (status === "new") {
		return "border-sky-200 bg-sky-50/70";
	}

	if (status === "same") {
		return "border-emerald-200 bg-emerald-50/70";
	}

	return "border-amber-200 bg-amber-50/70";
}

interface CdsAiDocumentTabProps {
	followUpId: string;
	operationType: FollowUpOperationType | null;
	followUpSummary?: Partial<FollowUpRow> | null;
	currentData: Partial<FollowUpCdsInfoRow>;
	currentCargoList: Partial<CargoListRow>[];
	handleFieldChange: (field: keyof FollowUpCdsInfoRow, value: unknown) => void;
	onCargoApplied?: (rows: Partial<CargoListRow>[]) => void;
}

export function CdsAiDocumentTab({
	followUpId,
	operationType,
	followUpSummary,
	currentData,
	currentCargoList,
	handleFieldChange,
	onCargoApplied,
}: CdsAiDocumentTabProps) {
	const [files, setFiles] = useState<File[]>([]);
	const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
	const [selectedDriveFileIds, setSelectedDriveFileIds] = useState<string[]>(
		[],
	);
	const [composerPrompt, setComposerPrompt] = useState("");
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [sessions, setSessions] = useState<HistorySession[]>([]);
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [latestResult, setLatestResult] =
		useState<CdsAiDocumentExtractionResult | null>(null);
	const [activeResultMessageId, setActiveResultMessageId] = useState<
		string | null
	>(null);
	const [sessionFileIds, setSessionFileIds] = useState<string[]>([]);
	const [sessionFileNames, setSessionFileNames] = useState<string[]>([]);
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [isApplying, setIsApplying] = useState(false);
	const [isFetchingDriveFiles, setIsFetchingDriveFiles] = useState(false);
	const [isLoadingHistory, setIsLoadingHistory] = useState(false);
	const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
	const [dragging, setDragging] = useState(false);
	const [fillMissingOnly, setFillMissingOnly] = useState(true);
	const [autoUploadToDrive, setAutoUploadToDrive] = useState(false);
	const [fieldDrafts, setFieldDrafts] = useState<Record<string, string>>({});
	const [cargoDrafts, setCargoDrafts] = useState<Record<string, string>>({});

	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const transcriptEndRef = useRef<HTMLDivElement | null>(null);
	const driveUrl = followUpSummary?.driveUrl ?? null;
	const driveFolderId = useMemo(
		() => extractDriveFolderId(driveUrl),
		[driveUrl],
	);

	const transcriptVersion = useMemo(
		() =>
			`${messages.length}-${activeResultMessageId ?? ""}-${latestResult?.assistantMessage ?? ""}`,
		[activeResultMessageId, latestResult?.assistantMessage, messages.length],
	);

	useEffect(() => {
		void transcriptVersion;
		transcriptEndRef.current?.scrollIntoView({
			block: "end",
			behavior: "smooth",
		});
	}, [transcriptVersion]);

	const canAnalyze = useMemo(
		() =>
			files.length > 0 ||
			selectedDriveFileIds.length > 0 ||
			(!!latestResult && composerPrompt.trim().length > 0),
		[composerPrompt, files.length, latestResult, selectedDriveFileIds.length],
	);

	const selectedDriveFiles = useMemo(
		() => driveFiles.filter((file) => selectedDriveFileIds.includes(file.id)),
		[driveFiles, selectedDriveFileIds],
	);

	const activeSession = useMemo(
		() => sessions.find((entry) => entry.id === sessionId) ?? null,
		[sessionId, sessions],
	);

	const currentSnapshot = useMemo(
		() => buildCurrentSnapshot(currentData, currentCargoList),
		[currentCargoList, currentData],
	);

	const extractedFieldEntries = useMemo(
		() =>
			Object.entries(latestResult?.cdsInfo ?? {}).filter(([, value]) =>
				isMeaningfulValue(value),
			),
		[latestResult],
	);

	const scalarFieldEntries = useMemo(
		() => extractedFieldEntries.filter(([, value]) => isScalarEditable(value)),
		[extractedFieldEntries],
	);

	const structuredFieldEntries = useMemo(
		() => extractedFieldEntries.filter(([, value]) => !isScalarEditable(value)),
		[extractedFieldEntries],
	);

	const cdsDiffRows = useMemo(
		() =>
			extractedFieldEntries.map(([fieldKey, value]) => ({
				fieldKey,
				label: getCdsAiFieldLabel(fieldKey, operationType),
				currentValue: currentData[fieldKey as keyof FollowUpCdsInfoRow],
				aiValue: value,
				status: resolveDiffStatus(
					currentData[fieldKey as keyof FollowUpCdsInfoRow],
					value,
				),
			})),
		[currentData, extractedFieldEntries, operationType],
	);

	const cdsDiffSummary = useMemo(
		() => ({
			newCount: cdsDiffRows.filter((row) => row.status === "new").length,
			sameCount: cdsDiffRows.filter((row) => row.status === "same").length,
			changedCount: cdsDiffRows.filter((row) => row.status === "changed")
				.length,
		}),
		[cdsDiffRows],
	);

	const cargoDiffSummary = useMemo(() => {
		if (!latestResult) {
			return {
				aiRows: 0,
				currentRows: currentCargoList.length,
				newRows: 0,
				changedRows: 0,
				sameRows: 0,
			};
		}

		const summary = latestResult.cargoList.reduce(
			(accumulator, row, rowIndex) => {
				const currentRow = currentCargoList[rowIndex];
				const keys = FOLLOWUP_CARGO_COLUMNS.map((column) => column.key);
				const hasCurrentValues = keys.some((key) =>
					isMeaningfulValue(currentRow?.[key]),
				);
				const hasDifferences = keys.some(
					(key) =>
						resolveDiffStatus(
							currentRow?.[key],
							row[key as keyof CargoListRow],
						) !== "same",
				);

				if (!hasCurrentValues) {
					accumulator.newRows += 1;
				} else if (hasDifferences) {
					accumulator.changedRows += 1;
				} else {
					accumulator.sameRows += 1;
				}

				return accumulator;
			},
			{
				aiRows: latestResult.cargoList.length,
				currentRows: currentCargoList.length,
				newRows: 0,
				changedRows: 0,
				sameRows: 0,
			},
		);

		return summary;
	}, [currentCargoList, latestResult]);

	const attachedSourceCount = files.length + selectedDriveFileIds.length;
	const activeDraftFieldCount = useMemo(
		() => (latestResult ? getFilledFieldCount(latestResult) : 0),
		[latestResult],
	);
	const activeDraftWarningCount = useMemo(
		() =>
			latestResult
				? latestResult.warnings.length + getDocumentWarningCount(latestResult)
				: 0,
		[latestResult],
	);

	const appendFiles = (nextFiles: File[]) => {
		if (nextFiles.length === 0) {
			return;
		}

		setFiles((current) => {
			const seen = new Set(current.map((file) => getFileSignature(file)));
			const merged = [...current];

			nextFiles.forEach((file) => {
				const signature = getFileSignature(file);
				if (seen.has(signature)) {
					return;
				}

				seen.add(signature);
				merged.push(file);
			});

			return merged;
		});
	};

	const fetchDriveFiles = useCallback(async () => {
		if (!driveFolderId) {
			setDriveFiles([]);
			setSelectedDriveFileIds([]);
			return;
		}

		setIsFetchingDriveFiles(true);
		try {
			const response = await fetch(
				`/api/google-drive/files?folderId=${driveFolderId}`,
			);
			const payload = await response.json().catch(() => ({}));

			if (!response.ok) {
				throw new Error(
					payload?.message || "Không thể lấy file từ Google Drive.",
				);
			}

			setDriveFiles(payload.files || []);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Không thể lấy file từ Google Drive.",
			);
		} finally {
			setIsFetchingDriveFiles(false);
		}
	}, [driveFolderId]);

	const loadHistory = useCallback(
		async (requestedSessionId?: string | null) => {
			setIsLoadingHistory(true);
			try {
				const params = new URLSearchParams();
				if (requestedSessionId) {
					params.set("sessionId", requestedSessionId);
				}

				const query = params.toString();
				const response = await fetch(
					`/api/followup/${followUpId}/cds-ai-document/history${query ? `?${query}` : ""}`,
				);
				const payload = await response.json().catch(() => ({}));

				if (!response.ok) {
					throw new Error(
						payload?.error || "Không thể tải lịch sử chat CDS AI.",
					);
				}

				const historyMessages = Array.isArray(payload.history)
					? (payload.history as ChatMessage[])
					: [];
				const restoredResult = payload.latestResult
					? sanitizeCdsAiDocumentResult(payload.latestResult, operationType)
					: null;

				setSessions(Array.isArray(payload.sessions) ? payload.sessions : []);
				setMessages(historyMessages);
				setLatestResult(restoredResult);
				setActiveResultMessageId(payload.activeResultMessageId || null);
				setSessionId(payload.currentSessionId || null);
				setSessionFileIds(
					Array.isArray(payload.fileIds) ? payload.fileIds : [],
				);
				setSessionFileNames(
					Array.isArray(payload.fileNames) ? payload.fileNames : [],
				);
				setSelectedDriveFileIds(
					Array.isArray(payload.fileIds) ? payload.fileIds : [],
				);
				setFieldDrafts({});
				setCargoDrafts({});
			} catch (error) {
				toast.error(
					error instanceof Error
						? error.message
						: "Không thể tải lịch sử chat CDS AI.",
				);
			} finally {
				setIsLoadingHistory(false);
			}
		},
		[followUpId, operationType],
	);

	useEffect(() => {
		void fetchDriveFiles();
	}, [fetchDriveFiles]);

	useEffect(() => {
		void loadHistory();
	}, [loadHistory]);

	const handleStartNewSession = useCallback(() => {
		setSessionId(null);
		setMessages([]);
		setLatestResult(null);
		setActiveResultMessageId(null);
		setSessionFileIds([]);
		setSessionFileNames([]);
		setComposerPrompt("");
		setFieldDrafts({});
		setCargoDrafts({});
	}, []);

	const buildCommittedResult = useCallback(
		(result: CdsAiDocumentExtractionResult | null) => {
			if (!result) {
				return null;
			}

			const nextCdsInfo = { ...result.cdsInfo } as Record<string, unknown>;
			Object.entries(fieldDrafts).forEach(([fieldKey, rawValue]) => {
				nextCdsInfo[fieldKey] = parseCdsFieldDraft(
					fieldKey,
					rawValue,
					nextCdsInfo[fieldKey],
				);
			});

			const nextCargoList = result.cargoList.map(
				(row) => ({ ...row }) as Record<string, unknown>,
			);
			Object.entries(cargoDrafts).forEach(([draftKey, rawValue]) => {
				const [rowIndexText, columnKey] = draftKey.split(":");
				const rowIndex = Number.parseInt(rowIndexText ?? "", 10);
				const column = FOLLOWUP_CARGO_COLUMNS.find(
					(item) => item.key === columnKey,
				);

				if (!Number.isFinite(rowIndex) || !column || !nextCargoList[rowIndex]) {
					return;
				}

				nextCargoList[rowIndex][columnKey] = parseCargoDraft(
					column,
					rawValue,
					nextCargoList[rowIndex][columnKey],
				);
			});

			return rebuildCdsAiDocumentResult(
				{
					...result,
					cdsInfo: nextCdsInfo as Partial<FollowUpCdsInfoRow>,
					cargoList: nextCargoList as Partial<CargoListRow>[],
				},
				operationType,
			);
		},
		[cargoDrafts, fieldDrafts, operationType],
	);

	const flushDraftsToLatestResult = useCallback(() => {
		const committed = buildCommittedResult(latestResult);
		if (!committed) {
			return null;
		}

		setLatestResult(committed);
		if (Object.keys(fieldDrafts).length > 0) {
			setFieldDrafts({});
		}
		if (Object.keys(cargoDrafts).length > 0) {
			setCargoDrafts({});
		}

		return committed;
	}, [buildCommittedResult, cargoDrafts, fieldDrafts, latestResult]);

	const commitFieldDraft = (fieldKey: string, rawValue?: string) => {
		setLatestResult((current) => {
			if (!current) {
				return current;
			}

			const draftValue = rawValue ?? fieldDrafts[fieldKey];
			if (draftValue === undefined) {
				return current;
			}

			return rebuildCdsAiDocumentResult(
				{
					...current,
					cdsInfo: {
						...current.cdsInfo,
						[fieldKey]: parseCdsFieldDraft(
							fieldKey,
							draftValue,
							current.cdsInfo[fieldKey as keyof FollowUpCdsInfoRow],
						),
					},
				},
				operationType,
			);
		});

		setFieldDrafts((current) => {
			const next = { ...current };
			delete next[fieldKey];
			return next;
		});
	};

	const commitCargoDraft = (
		rowIndex: number,
		columnKey: CargoColumn["key"],
		rawValue?: string,
	) => {
		const draftKey = `${rowIndex}:${columnKey}`;

		setLatestResult((current) => {
			if (!current) {
				return current;
			}

			const draftValue = rawValue ?? cargoDrafts[draftKey];
			if (draftValue === undefined) {
				return current;
			}

			const column = FOLLOWUP_CARGO_COLUMNS.find(
				(item) => item.key === columnKey,
			);
			if (!column) {
				return current;
			}

			const nextCargoList = current.cargoList.map((row, currentRowIndex) =>
				currentRowIndex === rowIndex
					? {
							...row,
							[columnKey]: parseCargoDraft(
								column,
								draftValue,
								row[columnKey as keyof CargoListRow],
							),
						}
					: row,
			);

			return rebuildCdsAiDocumentResult(
				{
					...current,
					cargoList: nextCargoList,
				},
				operationType,
			);
		});

		setCargoDrafts((current) => {
			const next = { ...current };
			delete next[draftKey];
			return next;
		});
	};

	const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
		appendFiles(Array.from(event.target.files ?? []));
		event.target.value = "";
	};

	const handleAnalyze = async () => {
		const committedLatestResult = flushDraftsToLatestResult();
		const revisionSeed = committedLatestResult ?? latestResult;
		const shouldReviseExisting =
			!!revisionSeed && composerPrompt.trim().length > 0;
		const now = new Date();

		if (
			!files.length &&
			selectedDriveFileIds.length === 0 &&
			!shouldReviseExisting
		) {
			toast.error("Cần chọn ít nhất 1 file từ máy hoặc Google Drive.");
			return;
		}

		const userPrompt = normalizePrompt(composerPrompt, operationType);
		const effectiveSessionId = sessionId ?? crypto.randomUUID();
		const selectedDriveNames = selectedDriveFiles.map((file) => file.name);
		let effectiveDriveFileIds =
			selectedDriveFileIds.length > 0 ? selectedDriveFileIds : sessionFileIds;
		let effectiveDriveFileNames =
			selectedDriveNames.length > 0 ? selectedDriveNames : sessionFileNames;
		let pendingLocalFiles = [...files];

		if (pendingLocalFiles.length > 0 && autoUploadToDrive && driveFolderId) {
			setIsUploadingToDrive(true);
			try {
				const uploadFormData = new FormData();
				uploadFormData.append("folderId", driveFolderId);
				pendingLocalFiles.forEach((file) => {
					uploadFormData.append("files", file, file.name);
				});

				const uploadResponse = await fetch(
					"/api/google-drive/upload-to-folder",
					{
						method: "POST",
						body: uploadFormData,
					},
				);
				const uploadPayload = await uploadResponse.json().catch(() => ({}));

				if (!uploadResponse.ok) {
					throw new Error(
						uploadPayload?.message || "Không thể lưu file lên Google Drive.",
					);
				}

				const uploadedIds = Array.isArray(uploadPayload.fileIds)
					? (uploadPayload.fileIds as string[])
					: [];
				const uploadedNames = Array.isArray(uploadPayload.fileNames)
					? (uploadPayload.fileNames as string[])
					: pendingLocalFiles.map((file) => file.name);

				effectiveDriveFileIds = mergeUniqueStrings([
					...effectiveDriveFileIds,
					...uploadedIds,
				]);
				effectiveDriveFileNames = mergeUniqueStrings([
					...effectiveDriveFileNames,
					...uploadedNames,
				]);
				setSelectedDriveFileIds((current) =>
					mergeUniqueStrings([...current, ...uploadedIds]),
				);
				setFiles([]);
				pendingLocalFiles = [];
				toast.success("Đã lưu file local lên Google Drive của hồ sơ.");
				void fetchDriveFiles();
			} catch (error) {
				toast.warning(getLocalFileFallbackMessage(error));
			} finally {
				setIsUploadingToDrive(false);
			}
		}

		if (
			!pendingLocalFiles.length &&
			effectiveDriveFileIds.length === 0 &&
			!shouldReviseExisting
		) {
			toast.error("Không còn file hợp lệ để gửi cho AI phân tích.");
			return;
		}

		setIsAnalyzing(true);
		setSessionId(effectiveSessionId);
		setMessages((current) => [
			...current,
			{
				id: `${Date.now()}-user`,
				role: "user",
				text: userPrompt,
			},
		]);

		try {
			const formData = new FormData();
			formData.append("prompt", userPrompt);
			formData.append("operationType", operationType ?? "");
			formData.append("jobNumber", followUpSummary?.jobNumber ?? "");
			formData.append("sessionId", effectiveSessionId);

			if (shouldReviseExisting && revisionSeed) {
				formData.append("draftResult", JSON.stringify(revisionSeed));
			}

			if (currentSnapshot) {
				formData.append("currentSnapshot", JSON.stringify(currentSnapshot));
			}

			effectiveDriveFileIds.forEach((fileId) => {
				formData.append("driveFileIds", fileId);
			});
			effectiveDriveFileNames.forEach((fileName) => {
				formData.append("driveFileNames", fileName);
			});

			pendingLocalFiles.forEach((file, index) => {
				formData.append(`file${index}`, file);
			});

			const clientCdsModel =
				process.env.NEXT_PUBLIC_GEMINI_CDS_DOCUMENT_MODEL?.trim();
			if (clientCdsModel) {
				formData.append("model", clientCdsModel);
			}

			const response = await fetch(
				`/api/followup/${followUpId}/cds-ai-document`,
				{
					method: "POST",
					body: formData,
				},
			);
			const payload = await response.json().catch(() => ({}));

			if (!response.ok) {
				throw new Error(
					payload?.error || "Không thể phân tích chứng từ bằng Gemini.",
				);
			}

			const result = sanitizeCdsAiDocumentResult(payload?.data, operationType);
			const assistantMessageId = `${Date.now()}-assistant`;

			setLatestResult(result);
			setActiveResultMessageId(assistantMessageId);
			setFieldDrafts({});
			setCargoDrafts({});
			setComposerPrompt("");
			setSessionFileIds(effectiveDriveFileIds);
			setSessionFileNames(
				effectiveDriveFileNames.length > 0
					? effectiveDriveFileNames
					: result.documents.map((document) => document.fileName),
			);
			setSessions((current) => {
				const next = current.filter((entry) => entry.id !== effectiveSessionId);
				return [
					{
						id: effectiveSessionId,
						date: now.toISOString(),
						label: `Phiên ${new Intl.DateTimeFormat("vi-VN", {
							hour: "2-digit",
							minute: "2-digit",
							day: "2-digit",
							month: "2-digit",
						}).format(now)}`,
						fileNames:
							effectiveDriveFileNames.length > 0
								? effectiveDriveFileNames
								: result.documents.map((document) => document.fileName),
					},
					...next,
				];
			});
			setMessages((current) => [
				...current,
				{
					id: assistantMessageId,
					role: "assistant",
					text: result.assistantMessage,
					result,
				},
			]);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Phân tích chứng từ thất bại.";
			toast.error(message);
			setMessages((current) => [
				...current,
				{
					id: `${Date.now()}-assistant-error`,
					role: "assistant",
					text: message,
					tone: "error",
				},
			]);
		} finally {
			setIsAnalyzing(false);
		}
	};

	const toggleDriveFileSelection = (fileId: string) => {
		setSelectedDriveFileIds((current) =>
			current.includes(fileId)
				? current.filter((id) => id !== fileId)
				: [...current, fileId],
		);
	};

	const handleApply = async () => {
		const resultToApply = flushDraftsToLatestResult() ?? latestResult;
		if (!resultToApply) {
			return;
		}
		setIsApplying(true);

		try {
			const skippedLockedFieldCount = Object.entries(
				resultToApply.cdsInfo,
			).filter(
				([fieldKey, value]) =>
					isMeaningfulValue(value) &&
					isCdsWebLockedField(
						fieldKey as keyof FollowUpCdsInfoRow,
						operationType,
					),
			).length;

			const changedFields = Object.entries(resultToApply.cdsInfo).filter(
				([fieldKey, value]) => {
					if (!isMeaningfulValue(value)) {
						return false;
					}

					if (
						isCdsWebLockedField(
							fieldKey as keyof FollowUpCdsInfoRow,
							operationType,
						)
					) {
						return false;
					}

					if (!fillMissingOnly) {
						return true;
					}

					return !isMeaningfulValue(
						currentData[fieldKey as keyof FollowUpCdsInfoRow],
					);
				},
			);

			startTransition(() => {
				changedFields.forEach(([fieldKey, value]) => {
					handleFieldChange(fieldKey as keyof FollowUpCdsInfoRow, value);
				});
			});

			let cargoApplied = 0;
			if (resultToApply.cargoList.length > 0) {
				const canReplaceCargo =
					!fillMissingOnly || currentCargoList.length === 0;

				if (canReplaceCargo) {
					const response = await fetch(`/api/followup/${followUpId}/cargo`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ items: resultToApply.cargoList }),
					});

					if (!response.ok) {
						const payload = await response.json().catch(() => ({}));
						throw new Error(
							payload?.error || "Không thể áp danh sách hàng từ AI.",
						);
					}

					cargoApplied = resultToApply.cargoList.length;
					onCargoApplied?.(resultToApply.cargoList);
				}
			}

			const detail = [
				changedFields.length > 0
					? `Đã áp ${changedFields.length} trường CDS`
					: "Không có trường CDS mới để áp",
				skippedLockedFieldCount > 0
					? `bỏ qua ${skippedLockedFieldCount} trường đang khóa`
					: null,
				cargoApplied > 0
					? `và ${cargoApplied} dòng hàng`
					: resultToApply.cargoList.length > 0 &&
							fillMissingOnly &&
							currentCargoList.length > 0
						? "và giữ nguyên danh sách hàng hiện có"
						: null,
			]
				.filter(Boolean)
				.join(" ");

			toast.success("Đã áp dữ liệu AI vào CDS", {
				description: detail,
			});
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Không thể áp dữ liệu AI.",
			);
		} finally {
			setIsApplying(false);
		}
	};

	const renderResultPreview = (
		result: CdsAiDocumentExtractionResult,
		isActive: boolean,
	) => {
		const checklistFoundCount = result.checklist.filter(
			(item) => item.status === "found",
		).length;
		const warningCount =
			result.warnings.length + getDocumentWarningCount(result);

		return (
			<div className="mt-2 overflow-hidden rounded-[20px] border border-[#d7dde7] bg-[linear-gradient(180deg,#fffdfa_0%,#f6f8fc_100%)] shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
				<div className="flex flex-wrap items-center gap-2 border-b border-[#ebeef4] bg-[linear-gradient(90deg,#11283f_0%,#173957_100%)] px-3 py-2.5 text-white">
					<Badge
						variant="secondary"
						className="h-5 rounded-full border border-white/20 bg-white/10 px-2 py-0 text-[9px] font-semibold text-white"
					>
						Kết quả bóc tách
					</Badge>
					{isActive ? (
						<Badge
							variant="secondary"
							className="h-5 rounded-full border border-white/20 bg-[#f6b94d] px-2 py-0 text-[9px] font-semibold text-[#14283d]"
						>
							Bản nháp hiện tại
						</Badge>
					) : null}
					<span className="text-[10px] text-white/72">
						AI đã gom dữ liệu chính để bạn xem ngay trong luồng chat.
					</span>
				</div>

				<div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-4">
					<div
						className={cn(
							"rounded-[14px] border px-3 py-2.5",
							getMetricCardClasses("sky"),
						)}
					>
						<div className="text-[10px] uppercase tracking-[0.08em] text-sky-700">
							Chứng từ
						</div>
						<div className="mt-1 text-[17px] font-semibold">
							{result.documents.length}
						</div>
						<div className="mt-1 text-[10px] text-sky-800/80">
							Bộ file AI đã đọc để bóc dữ liệu CDS.
						</div>
					</div>
					<div
						className={cn(
							"rounded-[14px] border px-3 py-2.5",
							getMetricCardClasses("emerald"),
						)}
					>
						<div className="text-[10px] uppercase tracking-[0.08em] text-emerald-700">
							Trường CDS
						</div>
						<div className="mt-1 text-[17px] font-semibold">
							{getFilledFieldCount(result)}
						</div>
						<div className="mt-1 text-[10px] text-emerald-800/80">
							Số trường có dữ liệu rõ ràng để đối chiếu.
						</div>
					</div>
					<div
						className={cn(
							"rounded-[14px] border px-3 py-2.5",
							getMetricCardClasses("slate"),
						)}
					>
						<div className="text-[10px] uppercase tracking-[0.08em] text-slate-600">
							Dòng hàng
						</div>
						<div className="mt-1 text-[17px] font-semibold">
							{result.cargoList.length}
						</div>
						<div className="mt-1 text-[10px] text-slate-700/80">
							Dòng hàng AI đang đề xuất cho CDS.
						</div>
					</div>
					<div
						className={cn(
							"rounded-[14px] border px-3 py-2.5",
							getMetricCardClasses(warningCount > 0 ? "amber" : "emerald"),
						)}
					>
						<div className="text-[10px] uppercase tracking-[0.08em]">
							Trạng thái rà soát
						</div>
						<div className="mt-1 text-[17px] font-semibold">
							{checklistFoundCount}/{result.checklist.length}
						</div>
						<div className="mt-1 text-[10px]">
							{warningCount > 0
								? `Có ${warningCount} cảnh báo cần kiểm tra lại.`
								: "Không có cảnh báo nổi bật từ AI ở lượt này."}
						</div>
					</div>
				</div>

				{result.documents.length > 0 ? (
					<div className="border-t border-[#ebeef4] px-3 py-3">
						<div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">
							Chứng từ AI đã dùng
						</div>
						<div className="flex flex-wrap gap-2">
							{result.documents.map((document) => (
								<div
									key={document.fileName}
									className="inline-flex items-center gap-2 rounded-full border border-[#d7dde7] bg-white px-2.5 py-1.5 text-[10px] text-slate-700 shadow-sm"
								>
									<Paperclip className="size-3.5 text-[#2d628f]" />
									<span className="max-w-[240px] truncate font-medium">
										{document.fileName}
									</span>
									{document.documentType ? (
										<span className="text-[10px] uppercase text-[#2d628f]">
											{document.documentType}
										</span>
									) : null}
								</div>
							))}
						</div>
					</div>
				) : null}

				{warningCount > 0 ? (
					<div className="border-t border-amber-200 bg-[linear-gradient(90deg,#fff4d9_0%,#fff7e7_100%)] px-3 py-2.5 text-[10px] leading-5 text-amber-900">
						{result.warnings[0] ??
							"AI có trả về cảnh báo từ chứng từ hoặc từ phần OCR, cần rà lại trước khi áp."}
					</div>
				) : null}
			</div>
		);
	};

	const renderActiveResultDetails = () => {
		if (!latestResult) {
			return null;
		}

		const warningCount =
			latestResult.warnings.length + getDocumentWarningCount(latestResult);

		return (
			<div className="mt-3 overflow-hidden rounded-[22px] border border-[#d5dee9] bg-[linear-gradient(180deg,#ffffff_0%,#f4f7fb_100%)] shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
				<div className="border-b border-[#e7edf4] bg-[linear-gradient(120deg,#14314b_0%,#1b4667_52%,#f5b64a_180%)] px-3 py-3.5 text-white">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div className="min-w-0 flex-1">
							<div className="flex flex-wrap items-center gap-2">
								<Badge
									variant="secondary"
									className="h-5 rounded-full border border-white/20 bg-white/12 px-2 py-0 text-[9px] font-semibold text-white"
								>
									Bản nháp để áp vào CDS
								</Badge>
								<Badge
									variant="secondary"
									className="h-5 rounded-full border border-white/20 bg-[#f7c866] px-2 py-0 text-[9px] font-semibold text-[#1b3248]"
								>
									{fillMissingOnly
										? "Chỉ điền ô trống"
										: "Có thể ghi đè dữ liệu"}
								</Badge>
							</div>
							<div className="mt-2 text-[15px] font-semibold text-white">
								Kết quả hiện tại
							</div>
							<div className="mt-1 max-w-[760px] text-[11px] leading-5 text-white/78">
								Mọi chỉnh sửa ở đây sẽ cập nhật bản nháp đang active trong cuộc
								chat. Khi ổn, dùng nút áp dữ liệu để đẩy vào CDS.
							</div>
						</div>
						<div className="max-w-[260px] rounded-[14px] border border-white/15 bg-white/10 px-3 py-2.5 text-[10px] leading-5 text-white/78 backdrop-blur">
							Nếu muốn sửa logic phức tạp như gộp dòng hàng, đổi cách hiểu chứng
							từ hoặc giữ lại một phần dữ liệu cũ, hãy ra lệnh tiếp trong khung
							chat bên dưới.
						</div>
					</div>
				</div>

				<div className="grid gap-2 px-3 pt-3 md:grid-cols-2 xl:grid-cols-5">
					<div
						className={cn(
							"rounded-[14px] border px-3 py-2.5",
							getMetricCardClasses("sky"),
						)}
					>
						<div className="text-[10px] uppercase tracking-[0.08em] text-sky-700">
							Chứng từ
						</div>
						<div className="mt-1 text-[16px] font-semibold">
							{latestResult.documents.length}
						</div>
						<div className="mt-1 text-[10px] text-sky-800/80">
							File được AI dùng cho bản nháp này.
						</div>
					</div>
					<div
						className={cn(
							"rounded-[14px] border px-3 py-2.5",
							getMetricCardClasses("emerald"),
						)}
					>
						<div className="text-[10px] uppercase tracking-[0.08em] text-emerald-700">
							Trường CDS
						</div>
						<div className="mt-1 text-[16px] font-semibold">
							{getFilledFieldCount(latestResult)}
						</div>
						<div className="mt-1 text-[10px] text-emerald-800/80">
							Trường đã bóc được dữ liệu.
						</div>
					</div>
					<div
						className={cn(
							"rounded-[14px] border px-3 py-2.5",
							getMetricCardClasses("sky"),
						)}
					>
						<div className="text-[10px] uppercase tracking-[0.08em] text-sky-700">
							Trường mới
						</div>
						<div className="mt-1 text-[16px] font-semibold">
							{cdsDiffSummary.newCount}
						</div>
						<div className="mt-1 text-[10px] text-sky-800/80">
							Trường AI bổ sung thêm so với CDS hiện tại.
						</div>
					</div>
					<div
						className={cn(
							"rounded-[14px] border px-3 py-2.5",
							getMetricCardClasses("amber"),
						)}
					>
						<div className="text-[10px] uppercase tracking-[0.08em] text-amber-700">
							Khác dữ liệu cũ
						</div>
						<div className="mt-1 text-[16px] font-semibold">
							{cdsDiffSummary.changedCount}
						</div>
						<div className="mt-1 text-[10px] text-amber-800/80">
							Trường cần quyết định giữ dữ liệu cũ hay dùng AI.
						</div>
					</div>
					<div
						className={cn(
							"rounded-[14px] border px-3 py-2.5",
							getMetricCardClasses(warningCount > 0 ? "rose" : "slate"),
						)}
					>
						<div className="text-[10px] uppercase tracking-[0.08em]">
							Cảnh báo
						</div>
						<div className="mt-1 text-[16px] font-semibold">{warningCount}</div>
						<div className="mt-1 text-[10px]">
							{warningCount > 0
								? "Có điểm cần kiểm tra tay trước khi áp."
								: "Không có cảnh báo nổi bật ở bản nháp hiện tại."}
						</div>
					</div>
				</div>

				{latestResult.documents.length > 0 ? (
					<div className="px-4 pt-4">
						<div className="overflow-hidden rounded-[22px] border border-[#dbe3ee] bg-white shadow-sm">
							<div className="border-b border-[#edf2f7] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
								Chứng từ AI đã dùng
							</div>
							<div className="grid gap-3 p-4 xl:grid-cols-2">
								{latestResult.documents.map((document) => (
									<div
										key={document.fileName}
										className="rounded-[18px] border border-[#e8eef5] bg-[#fbfdff] px-4 py-3"
									>
										<div className="flex flex-wrap items-center gap-2">
											<div className="text-[12px] font-semibold text-slate-700">
												{document.fileName}
											</div>
											{document.documentType ? (
												<Badge
													variant="info"
													className="h-5 rounded-full px-2 py-0 text-[9px] uppercase"
												>
													{document.documentType}
												</Badge>
											) : null}
										</div>
										{document.ocrSummary ? (
											<div className="mt-2 text-[11px] leading-6 text-slate-600">
												{document.ocrSummary}
											</div>
										) : null}
										{document.extractedFields.length > 0 ? (
											<div className="mt-3">
												<div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
													Trường đã nhận diện
												</div>
												<div className="mt-2 flex flex-wrap gap-2">
													{document.extractedFields.map((field) => (
														<span
															key={`${document.fileName}-${field}`}
															className="rounded-full border border-[#d6e1ed] bg-white px-2.5 py-1 text-[10px] text-slate-600"
														>
															{field}
														</span>
													))}
												</div>
											</div>
										) : null}
										{document.warnings.length > 0 ? (
											<div className="mt-3 rounded-[14px] border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-6 text-amber-800">
												{document.warnings.join(" ")}
											</div>
										) : null}
									</div>
								))}
							</div>
						</div>
					</div>
				) : null}

				<div className="grid gap-4 px-4 py-4 xl:grid-cols-[320px_minmax(0,1fr)]">
					<div className="space-y-4">
						<div className="overflow-hidden rounded-[20px] border border-[#dbe3ee] bg-white">
							<div className="border-b border-[#edf2f7] px-4 py-3 text-[12px] font-semibold text-slate-700">
								Checklist trích xuất
							</div>
							<div className="space-y-2 p-4">
								{latestResult.checklist.map((item) => {
									const meta = getChecklistMeta(item.status);

									return (
										<div
											key={item.id}
											className="rounded-[16px] border border-[#edf2f7] bg-[#fbfdff] px-3 py-3"
										>
											<div className="flex flex-wrap items-center gap-2">
												<span
													className={cn(
														"inline-block size-2 rounded-full",
														meta.dotClassName,
													)}
												/>
												<div className="min-w-0 flex-1 text-[11px] font-semibold text-slate-700">
													{item.label}
												</div>
												<Badge
													variant={meta.badgeVariant}
													className="h-5 rounded-full px-2 py-0 text-[9px] font-semibold"
												>
													{meta.badgeLabel}
												</Badge>
											</div>
											{item.reason ? (
												<div className="mt-2 text-[10px] leading-5 text-slate-500">
													{item.reason}
												</div>
											) : null}
										</div>
									);
								})}
							</div>
						</div>

						<div className="overflow-hidden rounded-[20px] border border-[#dbe3ee] bg-white">
							<div className="border-b border-[#edf2f7] px-4 py-3 text-[12px] font-semibold text-slate-700">
								So sánh danh sách hàng
							</div>
							<div className="grid gap-2 p-4 sm:grid-cols-2">
								<div
									className={cn(
										"rounded-[18px] border px-3 py-3",
										getMetricCardClasses("sky"),
									)}
								>
									<div className="text-[10px] uppercase tracking-[0.08em] text-sky-700">
										Dòng AI
									</div>
									<div className="mt-1 text-[16px] font-semibold">
										{cargoDiffSummary.aiRows}
									</div>
								</div>
								<div
									className={cn(
										"rounded-[18px] border px-3 py-3",
										getMetricCardClasses("slate"),
									)}
								>
									<div className="text-[10px] uppercase tracking-[0.08em] text-slate-600">
										Dòng hiện có
									</div>
									<div className="mt-1 text-[16px] font-semibold">
										{cargoDiffSummary.currentRows}
									</div>
								</div>
								<div
									className={cn(
										"rounded-[18px] border px-3 py-3",
										getMetricCardClasses("amber"),
									)}
								>
									<div className="text-[10px] uppercase tracking-[0.08em] text-amber-700">
										Dòng khác
									</div>
									<div className="mt-1 text-[16px] font-semibold">
										{cargoDiffSummary.changedRows}
									</div>
								</div>
								<div
									className={cn(
										"rounded-[18px] border px-3 py-3",
										getMetricCardClasses("emerald"),
									)}
								>
									<div className="text-[10px] uppercase tracking-[0.08em] text-emerald-700">
										Dòng trùng
									</div>
									<div className="mt-1 text-[16px] font-semibold">
										{cargoDiffSummary.sameRows}
									</div>
								</div>
							</div>
							<div className="border-t border-[#edf2f7] px-4 py-3 text-[11px] leading-6 text-slate-500">
								{fillMissingOnly && currentCargoList.length > 0
									? "Chế độ hiện tại đang giữ nguyên danh sách hàng cũ nếu CDS đã có dữ liệu."
									: "Nếu bạn áp dữ liệu bây giờ, danh sách hàng có thể được thay bằng bản nháp AI."}
							</div>
						</div>

						{latestResult.warnings.length > 0 ? (
							<div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-6 text-amber-800">
								{latestResult.warnings.join(" ")}
							</div>
						) : null}
					</div>

					<div className="space-y-4">
						<div className="overflow-hidden rounded-[20px] border border-[#dbe3ee] bg-white">
							<div className="border-b border-[#edf2f7] px-4 py-3 text-[12px] font-semibold text-slate-700">
								Chênh lệch CDS và chỉnh sửa trực tiếp
							</div>
							<div className="space-y-3 p-4">
								{scalarFieldEntries.length > 0 ? (
									scalarFieldEntries.map(([fieldKey, value]) => {
										const diffStatus = resolveDiffStatus(
											currentData[fieldKey as keyof FollowUpCdsInfoRow],
											value,
										);

										return (
											<div
												key={fieldKey}
												className="rounded-[18px] border border-[#edf2f7] bg-[#fbfdff] px-4 py-3"
											>
												<div className="flex flex-wrap items-center gap-2">
													<div className="text-[12px] font-semibold text-slate-700">
														{getCdsAiFieldLabel(fieldKey, operationType)}
													</div>
													<Badge
														variant={
															diffStatus === "new"
																? "info"
																: diffStatus === "same"
																	? "success"
																	: "warning"
														}
														className="h-5 rounded-full px-2 py-0 text-[9px] font-semibold"
													>
														{diffStatus === "new"
															? "Mới"
															: diffStatus === "same"
																? "Trùng"
																: "Khác"}
													</Badge>
												</div>
												<div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
													<div className="rounded-[16px] border border-[#dde5ef] bg-white px-3 py-3">
														<div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
															Dữ liệu hiện có
														</div>
														<div className="mt-1 break-words text-[11px] leading-6 text-slate-700">
															{formatValue(
																currentData[
																	fieldKey as keyof FollowUpCdsInfoRow
																],
															) || (
																<span className="text-slate-400">Trống</span>
															)}
														</div>
													</div>
													<div className="rounded-[16px] border border-[#dde5ef] bg-white px-3 py-3">
														<div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
															Giá trị AI có thể sửa
														</div>
														<Input
															value={
																fieldDrafts[fieldKey] ?? formatValue(value)
															}
															onChange={(event) =>
																setFieldDrafts((current) => ({
																	...current,
																	[fieldKey]: event.target.value,
																}))
															}
															onBlur={() => commitFieldDraft(fieldKey)}
															className="mt-2 h-9 rounded-[12px] border-[#cfd8e3] bg-white text-[11px] shadow-none focus-visible:ring-0"
														/>
													</div>
												</div>
											</div>
										);
									})
								) : (
									<div className="rounded-[16px] border border-[#edf2f7] bg-[#fbfdff] px-3 py-4 text-[11px] text-slate-500">
										AI chưa bóc được trường scalar nào để so sánh.
									</div>
								)}

								{structuredFieldEntries.length > 0 ? (
									<div className="space-y-2">
										<div className="text-[11px] font-semibold text-slate-700">
											Trường cấu trúc
										</div>
										{structuredFieldEntries.map(([fieldKey, value]) => (
											<div
												key={fieldKey}
												className="rounded-[18px] border border-[#edf2f7] bg-[#fbfdff] px-4 py-3"
											>
												<div className="text-[12px] font-semibold text-slate-700">
													{getCdsAiFieldLabel(fieldKey, operationType)}
												</div>
												<div className="mt-2 whitespace-pre-wrap break-words text-[10px] leading-6 text-slate-600">
													{formatValue(value)}
												</div>
												<div className="mt-2 text-[10px] text-slate-500">
													Trường này đang để xem nhanh. Nếu muốn chỉnh sâu, hãy
													ra lệnh qua chat.
												</div>
											</div>
										))}
									</div>
								) : null}
							</div>
						</div>

						<div className="overflow-hidden rounded-[20px] border border-[#dbe3ee] bg-white">
							<div className="border-b border-[#edf2f7] px-4 py-3 text-[12px] font-semibold text-slate-700">
								Bản nháp danh sách hàng có thể chỉnh sửa
							</div>
							<div className="overflow-x-auto p-4">
								{latestResult.cargoList.length > 0 ? (
									<table className="min-w-full border-separate border-spacing-0 text-[11px]">
										<thead>
											<tr className="bg-[#f6f9fc] text-left text-slate-600">
												<th className="sticky top-0 z-10 border border-[#e6ebf2] bg-[#f6f9fc] px-2 py-2 font-medium">
													#
												</th>
												{FOLLOWUP_CARGO_COLUMNS.map((column) => (
													<th
														key={column.key}
														className="sticky top-0 z-10 border border-[#e6ebf2] bg-[#f6f9fc] px-2 py-2 font-medium"
													>
														{column.label}
													</th>
												))}
											</tr>
										</thead>
										<tbody>
											{latestResult.cargoList.map((row, rowIndex) => (
												<tr
													key={
														getCargoRowKey(row) ||
														JSON.stringify({
															customCode: row.customCode ?? null,
															hsCode: row.hsCode ?? null,
															vietnameseName: row.vietnameseName ?? null,
															invoiceNo: row.invoiceNo ?? null,
														})
													}
												>
													<td className="border border-[#eef2f6] bg-[#fbfdff] px-2 py-2 align-top text-[10px] font-semibold text-slate-500">
														{rowIndex + 1}
													</td>
													{FOLLOWUP_CARGO_COLUMNS.map((column) => {
														const diffStatus = resolveDiffStatus(
															currentCargoList[rowIndex]?.[
																column.key as keyof CargoListRow
															],
															row[column.key as keyof CargoListRow],
														);
														const draftKey = `${rowIndex}:${column.key}`;

														return (
															<td
																key={`${rowIndex}-${column.key}`}
																className="border border-[#eef2f6] p-1 align-top"
															>
																<Input
																	value={
																		cargoDrafts[draftKey] ??
																		formatValue(
																			row[column.key as keyof CargoListRow],
																		)
																	}
																	onChange={(event) =>
																		setCargoDrafts((current) => ({
																			...current,
																			[draftKey]: event.target.value,
																		}))
																	}
																	onBlur={() =>
																		commitCargoDraft(rowIndex, column.key)
																	}
																	className={cn(
																		"h-8 rounded-[10px] border text-[10px] shadow-none focus-visible:ring-0",
																		getCargoCellDiffClass(diffStatus),
																	)}
																/>
															</td>
														);
													})}
												</tr>
											))}
										</tbody>
									</table>
								) : (
									<div className="rounded-[16px] border border-[#edf2f7] bg-[#fbfdff] px-3 py-4 text-[11px] text-slate-500">
										Chưa có dòng hàng nào được AI trích xuất.
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	};

	return (
		<div className="relative isolate overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_top_left,#fff0c8_0%,#edf3f8_30%,#dfe8f2_100%)]">
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,49,75,0.14),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(245,182,74,0.18),transparent_26%)]" />
			<div className="relative grid h-full min-h-0 gap-3 p-3 xl:grid-cols-[320px_minmax(0,1fr)]">
				<aside className="min-h-0">
					<div className="flex h-full min-h-[680px] flex-col overflow-hidden rounded-[22px] border border-white/20 bg-[linear-gradient(180deg,#112033_0%,#17314a_48%,#16324a_100%)] text-white shadow-[0_18px_44px_rgba(15,23,42,0.2)]">
						<div className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0)_100%)] px-4 py-4">
							<div className="flex items-start justify-between gap-3">
								<div>
									<Badge
										variant="secondary"
										className="h-5 rounded-full border border-white/15 bg-white/10 px-2 py-0 text-[9px] font-semibold text-white"
									>
										CDS AI
									</Badge>
									<div className="mt-3 text-[18px] font-semibold tracking-[-0.02em] text-white">
										Điều khiển
									</div>
									<div className="mt-1 max-w-[240px] text-[11px] leading-5 text-white/70">
										Quản lý nguồn chứng từ, phiên chat và chế độ áp dữ liệu
										trong một khu vực điều khiển cố định.
									</div>
								</div>
								<div className="rounded-[16px] border border-white/12 bg-white/8 px-3 py-2.5 text-right backdrop-blur">
									<div className="text-[9px] uppercase tracking-[0.14em] text-white/45">
										Draft
									</div>
									<div className="mt-1 text-[20px] font-semibold text-white">
										{activeDraftFieldCount}
									</div>
									<div className="text-[9px] text-white/55">
										trường đang có dữ liệu
									</div>
								</div>
							</div>

							<div className="mt-4 grid grid-cols-2 gap-2">
								<div className="rounded-[14px] border border-white/10 bg-white/8 px-3 py-2.5 backdrop-blur">
									<div className="text-[9px] uppercase tracking-[0.1em] text-white/45">
										Nguồn
									</div>
									<div className="mt-1 text-[16px] font-semibold text-white">
										{attachedSourceCount}
									</div>
									<div className="text-[9px] text-white/55">file đang gắn</div>
								</div>
								<div className="rounded-[14px] border border-white/10 bg-white/8 px-3 py-2.5 backdrop-blur">
									<div className="text-[9px] uppercase tracking-[0.1em] text-white/45">
										Phiên
									</div>
									<div className="mt-1 text-[16px] font-semibold text-white">
										{sessions.length}
									</div>
									<div className="text-[9px] text-white/55">lịch sử đã lưu</div>
								</div>
								<div className="rounded-[14px] border border-white/10 bg-white/8 px-3 py-2.5 backdrop-blur">
									<div className="text-[9px] uppercase tracking-[0.1em] text-white/45">
										Cảnh báo
									</div>
									<div className="mt-1 text-[16px] font-semibold text-white">
										{activeDraftWarningCount}
									</div>
									<div className="text-[9px] text-white/55">cần rà soát</div>
								</div>
								<div className="rounded-[14px] border border-white/10 bg-white/8 px-3 py-2.5 backdrop-blur">
									<div className="text-[9px] uppercase tracking-[0.1em] text-white/45">
										Áp dụng
									</div>
									<div className="mt-1 text-[16px] font-semibold text-white">
										{fillMissingOnly ? "Fill" : "Overwrite"}
									</div>
									<div className="text-[9px] text-white/55">
										chế độ hiện tại
									</div>
								</div>
							</div>
						</div>

						<div className="flex-1 space-y-3 overflow-y-auto p-3">
							<div className="overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.07] backdrop-blur">
								<div className="border-b border-white/10 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/72">
									Nạp chứng từ
								</div>
								<div className="p-3">
									<button
										type="button"
										onClick={() => fileInputRef.current?.click()}
										onDragEnter={() => setDragging(true)}
										onDragOver={(event) => {
											event.preventDefault();
											setDragging(true);
										}}
										onDragLeave={() => setDragging(false)}
										onDrop={(event) => {
											event.preventDefault();
											setDragging(false);
											appendFiles(Array.from(event.dataTransfer.files ?? []));
										}}
										className={cn(
											"flex min-h-[124px] w-full flex-col items-center justify-center gap-2 rounded-[16px] border border-dashed px-3 py-4 text-center transition-colors",
											dragging
												? "border-[#8fd8ff] bg-white/14"
												: "border-white/18 bg-[#102235] hover:bg-white/10",
										)}
									>
										<Upload className="size-5 text-[#8fd8ff]" />
										<div className="text-[12px] font-semibold text-white">
											Kéo thả hoặc bấm để thêm chứng từ
										</div>
										<div className="max-w-[250px] text-[10px] leading-5 text-white/62">
											Hỗ trợ ảnh, PDF, Excel, Word, CSV, TXT, JSON, XML, ZIP,
											RAR. File nén sẽ tự giải và bỏ qua file kết quả thông
											quan.
										</div>
									</button>
									<Input
										ref={fileInputRef}
										type="file"
										multiple
										onChange={handleFileInputChange}
										className="hidden"
									/>
								</div>
							</div>

							<div className="overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.07] backdrop-blur">
								<div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
									<div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/72">
										File local chờ phân tích
									</div>
									<Badge
										variant="secondary"
										className="h-5 rounded-full border border-white/12 bg-white/10 px-2 py-0 text-[9px] font-semibold text-white"
									>
										{files.length}
									</Badge>
								</div>
								<div className="max-h-52 space-y-2 overflow-y-auto p-3">
									{files.length > 0 ? (
										files.map((file, index) => (
											<div
												key={getFileSignature(file)}
												className="flex items-start gap-2.5 rounded-[14px] border border-white/10 bg-[#102338] px-3 py-2.5"
											>
												<Paperclip className="mt-0.5 size-4 shrink-0 text-[#8fd8ff]" />
												<div className="min-w-0 flex-1">
													<div className="truncate text-[10px] font-semibold text-white">
														{file.name}
													</div>
													<div className="mt-0.5 text-[9px] text-white/52">
														{formatFileSize(file)}
													</div>
												</div>
												<button
													type="button"
													onClick={() =>
														setFiles((current) =>
															current.filter(
																(_, currentIndex) => currentIndex !== index,
															),
														)
													}
													className="inline-flex size-6 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/62 hover:text-rose-300"
													aria-label={`Xóa ${file.name}`}
												>
													<Trash2 className="size-3" />
												</button>
											</div>
										))
									) : (
										<div className="rounded-[14px] border border-white/10 bg-[#102338] px-3 py-3 text-[10px] text-white/55">
											Chưa có chứng từ local nào được nạp.
										</div>
									)}
								</div>
							</div>

							<div className="overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.07] backdrop-blur">
								<div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
									<div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/72">
										<HardDrive className="size-4 text-[#8fd8ff]" />
										Google Drive của hồ sơ
									</div>
									{driveUrl ? (
										<a
											href={driveUrl}
											target="_blank"
											rel="noreferrer"
											className="inline-flex items-center gap-1 text-[9px] font-semibold text-[#8fd8ff] hover:underline"
										>
											<FolderOpen className="size-3.5" />
											Mở Drive
										</a>
									) : null}
								</div>
								<div className="space-y-3 p-3">
									<div className="text-[10px] leading-5 text-white/62">
										{driveUrl
											? "Bạn có thể chọn file sẵn có trên Drive hoặc nạp file local để AI tự lưu lên Drive trước khi OCR."
											: "Hồ sơ này chưa có link Google Drive. AI vẫn phân tích file local nhưng chưa lưu được lên Drive."}
									</div>

									<label
										htmlFor={`cds-ai-upload-drive-${followUpId}`}
										className="flex items-start gap-2 rounded-[14px] border border-white/10 bg-[#102338] px-3 py-2.5 text-[10px] text-white/80"
									>
										<Checkbox
											id={`cds-ai-upload-drive-${followUpId}`}
											checked={autoUploadToDrive}
											disabled={!driveFolderId}
											onCheckedChange={(checked) =>
												setAutoUploadToDrive(checked === true)
											}
											className="mt-0.5"
										/>
										<span>
											Tự lưu file local lên Google Drive trước khi phân tích.
											{!driveFolderId
												? " Cần có link Drive ở hồ sơ để bật."
												: ""}
										</span>
									</label>

									<div className="space-y-2">
										<div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-white/80">
											<span>File trên Google Drive</span>
											<div className="flex items-center gap-3">
												<button
													type="button"
													onClick={() => {
														if (
															selectedDriveFileIds.length === driveFiles.length
														) {
															setSelectedDriveFileIds([]);
															return;
														}

														setSelectedDriveFileIds(
															driveFiles.map((file) => file.id),
														);
													}}
													disabled={driveFiles.length === 0}
													className="text-[9px] font-semibold text-[#8fd8ff] disabled:text-white/30"
												>
													{selectedDriveFileIds.length === driveFiles.length &&
													driveFiles.length > 0
														? "Bỏ chọn"
														: "Chọn hết"}
												</button>
												<button
													type="button"
													onClick={() => void fetchDriveFiles()}
													disabled={!driveFolderId || isFetchingDriveFiles}
													className="inline-flex items-center gap-1 text-[9px] font-semibold text-[#8fd8ff] disabled:text-white/30"
												>
													<RefreshCw
														className={cn(
															"size-3",
															isFetchingDriveFiles && "animate-spin",
														)}
													/>
													Làm mới
												</button>
											</div>
										</div>

										<div className="max-h-52 space-y-2 overflow-y-auto">
											{!driveFolderId ? (
												<div className="rounded-[14px] border border-white/10 bg-[#102338] px-3 py-3 text-[10px] text-white/55">
													Chưa có link Drive để lấy file.
												</div>
											) : isFetchingDriveFiles ? (
												<div className="flex items-center gap-2 rounded-[14px] border border-white/10 bg-[#102338] px-3 py-3 text-[10px] text-white/55">
													<Loader2 className="size-4 animate-spin" />
													Đang tải danh sách file từ Drive...
												</div>
											) : driveFiles.length > 0 ? (
												driveFiles.map((file) => {
													const selected = selectedDriveFileIds.includes(
														file.id,
													);

													return (
														<button
															key={file.id}
															type="button"
															onClick={() => toggleDriveFileSelection(file.id)}
															className={cn(
																"flex w-full items-start gap-2.5 rounded-[14px] border px-3 py-2.5 text-left transition-colors",
																selected
																	? "border-[#77c4f8] bg-[#18324a]"
																	: "border-white/10 bg-[#102338]",
															)}
														>
															<span
																className={cn(
																	"mt-0.5 inline-flex size-5 items-center justify-center rounded-full border text-[10px]",
																	selected
																		? "border-[#8fd8ff] bg-[#8fd8ff] text-[#102235]"
																		: "border-white/12 bg-white/6 text-white/40",
																)}
															>
																{selected ? (
																	<CheckCircle2 className="size-3.5" />
																) : null}
															</span>
															<div className="min-w-0 flex-1">
																<div className="truncate text-[10px] font-semibold text-white">
																	{file.name}
																</div>
																<div className="mt-0.5 truncate text-[9px] text-white/52">
																	{file.mimeType}
																</div>
															</div>
														</button>
													);
												})
											) : (
												<div className="rounded-[14px] border border-white/10 bg-[#102338] px-3 py-3 text-[10px] text-white/55">
													Thư mục Drive hiện chưa có file nào.
												</div>
											)}
										</div>
									</div>
								</div>
							</div>

							<div className="overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.07] backdrop-blur">
								<div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
									<div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/72">
										<History className="size-4 text-[#8fd8ff]" />
										Lịch sử chat
									</div>
									<button
										type="button"
										onClick={handleStartNewSession}
										className="text-[9px] font-semibold text-[#8fd8ff]"
									>
										Phiên mới
									</button>
								</div>
								<div className="max-h-52 space-y-2 overflow-y-auto p-3">
									{isLoadingHistory ? (
										<div className="flex items-center gap-2 rounded-[14px] border border-white/10 bg-[#102338] px-3 py-3 text-[10px] text-white/55">
											<Loader2 className="size-4 animate-spin" />
											Đang tải lịch sử chat...
										</div>
									) : sessions.length > 0 ? (
										sessions.map((entry) => (
											<button
												key={entry.id}
												type="button"
												onClick={() => void loadHistory(entry.id)}
												className={cn(
													"flex w-full items-start justify-between gap-2.5 rounded-[14px] border px-3 py-2.5 text-left transition-colors",
													sessionId === entry.id
														? "border-[#77c4f8] bg-[#18324a]"
														: "border-white/10 bg-[#102338]",
												)}
											>
												<div className="min-w-0 flex-1">
													<div className="truncate text-[10px] font-semibold text-white">
														{entry.label}
													</div>
													<div className="mt-0.5 truncate text-[9px] text-white/52">
														{(entry.fileNames || []).join(", ") ||
															"Không có file lưu kèm"}
													</div>
												</div>
												{sessionId === entry.id ? (
													<span className="rounded-full bg-[#8fd8ff] px-2 py-1 text-[9px] font-semibold text-[#102235]">
														Đang mở
													</span>
												) : null}
											</button>
										))
									) : (
										<div className="rounded-[14px] border border-white/10 bg-[#102338] px-3 py-3 text-[10px] text-white/55">
											Chưa có lịch sử chat CDS AI nào được lưu.
										</div>
									)}
								</div>
							</div>

							<div className="overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.07] backdrop-blur">
								<div className="border-b border-white/10 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/72">
									Cách áp dữ liệu
								</div>
								<div className="p-3">
									<label
										htmlFor={`cds-ai-fill-missing-${followUpId}`}
										className="flex items-start gap-2 rounded-[14px] border border-white/10 bg-[#102338] px-3 py-2.5 text-[10px] text-white/80"
									>
										<Checkbox
											id={`cds-ai-fill-missing-${followUpId}`}
											checked={fillMissingOnly}
											onCheckedChange={(checked) =>
												setFillMissingOnly(checked === true)
											}
											className="mt-0.5"
										/>
										<span>
											Chỉ điền ô đang trống khi áp vào CDS. Nếu bỏ chọn, AI có
											thể ghi đè dữ liệu hiện có và thay toàn bộ danh sách hàng.
										</span>
									</label>
								</div>
							</div>
						</div>

						<div className="border-t border-white/10 bg-white/[0.05] p-3">
							<div className="grid gap-2 sm:grid-cols-2">
								<Button
									type="button"
									onClick={handleStartNewSession}
									className="h-9 rounded-full border border-white/12 bg-white/8 text-[11px] text-white hover:bg-white/12"
								>
									<History className="mr-1 size-4" />
									Phiên mới
								</Button>
								<Button
									type="button"
									onClick={handleApply}
									disabled={isApplying || !latestResult}
									className="h-9 rounded-full bg-[linear-gradient(90deg,#f5b64a_0%,#ffd47a_100%)] text-[11px] text-[#13273e] hover:opacity-95"
								>
									<FileText className="mr-1 size-4" />
									{isApplying ? "Đang áp..." : "Áp vào CDS"}
								</Button>
							</div>
							<div className="mt-2 rounded-[14px] border border-white/10 bg-[#102338] px-3 py-2.5 text-[10px] leading-5 text-white/62">
								Phía phải là assistant workspace để gửi lệnh, xem hội thoại và
								rà soát bản nháp chi tiết như khi dùng ChatGPT.
							</div>
						</div>
					</div>
				</aside>

				<section className="flex min-h-[680px] min-w-0 flex-col overflow-hidden rounded-[24px] border border-white/35 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(248,250,252,0.96)_45%,rgba(242,246,250,0.98)_100%)] shadow-[0_18px_44px_rgba(15,23,42,0.12)] backdrop-blur">
					<div className="border-b border-[#e5ebf3] bg-[linear-gradient(180deg,rgba(255,255,255,0.9)_0%,rgba(245,248,252,0.95)_100%)] px-4 py-4">
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div className="min-w-0 flex-1">
								<Badge
									variant="secondary"
									className="h-5 rounded-full border border-[#d4dde8] bg-white px-2 py-0 text-[9px] font-semibold text-slate-600"
								>
									Chat & kết quả
								</Badge>
								<div className="mt-3 flex items-center gap-2 text-[18px] font-semibold tracking-[-0.02em] text-slate-900">
									<MessageSquareText className="size-5 text-[#14314b]" />
									Trợ lý CDS
								</div>
								<div className="mt-1 max-w-[820px] text-[11px] leading-6 text-slate-600">
									OCR, chỉnh sửa và rà soát dữ liệu CDS được gom vào cùng một
									không gian làm việc. Chat là trung tâm, kết quả và bản nháp đi
									theo từng lượt trả lời để dễ đọc và dễ quyết định hơn.
								</div>
							</div>

							{(sessionId || sessionFileNames.length > 0) && (
								<div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
									{sessionId ? (
										<span className="rounded-full border border-[#d5ddea] bg-white px-3 py-1 shadow-sm">
											Phiên: {activeSession?.label ?? sessionId}
										</span>
									) : null}
									{sessionFileNames.length > 0 ? (
										<span className="rounded-full border border-[#d5ddea] bg-white px-3 py-1 shadow-sm">
											File nguồn: {sessionFileNames.join(", ")}
										</span>
									) : null}
								</div>
							)}
						</div>
					</div>

					<div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
						{messages.length === 0 ? (
							<div className="mx-auto flex h-full min-h-[320px] w-full max-w-[760px] flex-col items-center justify-center gap-4 rounded-[22px] border border-white/70 bg-[linear-gradient(180deg,#ffffff_0%,#f7f3eb_100%)] px-6 text-center shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
								{isLoadingHistory ? (
									<Loader2 className="size-7 animate-spin text-[#14314b]" />
								) : (
									<Sparkles className="size-7 text-[#14314b]" />
								)}
								<div className="text-[18px] font-semibold tracking-[-0.02em] text-slate-900">
									{isLoadingHistory
										? "Đang khôi phục lịch sử chat"
										: "Bắt đầu một phiên làm việc với CDS AI"}
								</div>
								<div className="max-w-[620px] text-[11px] leading-6 text-slate-500">
									{isLoadingHistory
										? "Tab CDS AI đang nạp lại hội thoại và kết quả gần nhất đã lưu trong hệ thống."
										: "Chọn chứng từ ở cột bên trái, sau đó mô tả yêu cầu ngay trong khung chat. Bạn có thể yêu cầu bóc từ đầu hoặc sửa tiếp trên kết quả hiện tại."}
								</div>
								{!isLoadingHistory ? (
									<div className="flex flex-wrap justify-center gap-2">
										{QUICK_CHAT_PROMPTS.map((quickPrompt) => (
											<button
												key={quickPrompt}
												type="button"
												onClick={() => setComposerPrompt(quickPrompt)}
												className="rounded-full border border-[#d7e0eb] bg-white px-3 py-1.5 text-[10px] text-slate-600 shadow-sm hover:bg-[#f4f8fc]"
											>
												{quickPrompt}
											</button>
										))}
									</div>
								) : null}
							</div>
						) : (
							<div className="mx-auto flex w-full max-w-[1040px] flex-col gap-4">
								{messages.map((message) => {
									const isUser = message.role === "user";
									const isActiveResultMessage =
										message.id === activeResultMessageId;
									const messageResult =
										message.role === "assistant"
											? isActiveResultMessage
												? (latestResult ?? message.result ?? null)
												: (message.result ?? null)
											: null;

									return (
										<div
											key={message.id}
											className={cn(
												"flex gap-3",
												isUser ? "justify-end" : "justify-start",
											)}
										>
											{!isUser ? (
												<div className="flex size-8 shrink-0 items-center justify-center rounded-[14px] bg-[linear-gradient(180deg,#14314b_0%,#1f4e74_100%)] text-[10px] font-semibold text-white shadow-[0_10px_20px_rgba(20,49,75,0.2)]">
													AI
												</div>
											) : null}

											<div
												className={cn(
													"min-w-0 max-w-[min(100%,980px)]",
													isUser ? "items-end" : "items-start",
												)}
											>
												<div
													className={cn(
														"mb-1 text-[11px] font-semibold",
														isUser
															? "text-right text-slate-500"
															: "text-slate-600",
													)}
												>
													{isUser ? "Bạn" : "CDS AI"}
												</div>
												<div
													className={cn(
														"rounded-[18px] border px-4 py-3 text-[12px] leading-6 shadow-[0_8px_20px_rgba(15,23,42,0.04)]",
														isUser
															? "ml-auto border-[#193451] bg-[linear-gradient(180deg,#163450_0%,#1d486d_100%)] text-white"
															: message.tone === "error"
																? "border-rose-200 bg-rose-50 text-rose-700"
																: "border-white/70 bg-white text-slate-700",
													)}
												>
													{message.text}
												</div>

												{messageResult
													? renderResultPreview(
															messageResult,
															isActiveResultMessage,
														)
													: null}
												{isActiveResultMessage
													? renderActiveResultDetails()
													: null}
											</div>

											{isUser ? (
												<div className="flex size-8 shrink-0 items-center justify-center rounded-[14px] bg-[linear-gradient(180deg,#f5b64a_0%,#f6c76d_100%)] text-[10px] font-semibold text-[#17314b] shadow-[0_10px_20px_rgba(245,182,74,0.2)]">
													Bạn
												</div>
											) : null}
										</div>
									);
								})}

								{isAnalyzing ? (
									<div className="flex gap-3">
										<div className="flex size-8 shrink-0 items-center justify-center rounded-[14px] bg-[linear-gradient(180deg,#14314b_0%,#1f4e74_100%)] text-[10px] font-semibold text-white shadow-[0_10px_20px_rgba(20,49,75,0.2)]">
											AI
										</div>
										<div className="rounded-[18px] border border-white/70 bg-white px-4 py-3 text-[11px] text-slate-500 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
											<div className="flex items-center gap-2">
												<Loader2 className="size-4 animate-spin text-[#2d628f]" />
												AI đang đọc chứng từ và dựng lại kết quả CDS...
											</div>
										</div>
									</div>
								) : null}

								<div ref={transcriptEndRef} />
							</div>
						)}
					</div>

					<div className="border-t border-[#e5ebf3] bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(248,250,252,0.96)_100%)] px-4 py-4">
						<div className="mx-auto flex w-full max-w-[1040px] flex-col gap-2.5">
							<div className="flex flex-wrap gap-2">
								{QUICK_CHAT_PROMPTS.map((quickPrompt) => (
									<button
										key={quickPrompt}
										type="button"
										onClick={() => setComposerPrompt(quickPrompt)}
										className="rounded-full border border-[#d7e0eb] bg-white px-3 py-1.5 text-[10px] text-slate-600 shadow-sm hover:bg-[#f4f8fc]"
									>
										{quickPrompt}
									</button>
								))}
							</div>

							<div className="overflow-hidden rounded-[20px] border border-white/80 bg-[linear-gradient(180deg,#ffffff_0%,#faf6ef_100%)] shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
								<div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#edf2f7] px-4 py-3">
									<div className="min-w-0 flex-1">
										<div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
											Composer
										</div>
										<div className="mt-1 text-[13px] font-semibold text-slate-900">
											Mô tả yêu cầu kế tiếp cho AI
										</div>
									</div>
									<div className="flex flex-wrap gap-2">
										<span className="rounded-full border border-[#d7e0eb] bg-white px-3 py-1 text-[9px] text-slate-600">
											{attachedSourceCount > 0
												? `${attachedSourceCount} nguồn đang gắn`
												: latestResult
													? "Đang dùng ngữ cảnh phiên hiện tại"
													: "Chưa gắn nguồn"}
										</span>
										<span className="rounded-full border border-[#d7e0eb] bg-white px-3 py-1 text-[9px] text-slate-600">
											{fillMissingOnly ? "Chỉ điền ô trống" : "Cho phép ghi đè"}
										</span>
									</div>
								</div>
								<div className="px-4 pt-3">
									<Textarea
										value={composerPrompt}
										onChange={(event) => setComposerPrompt(event.target.value)}
										placeholder="Ví dụ: giữ nguyên kết quả nhưng đổi invoice thành INV-002, bỏ dòng hàng số 2, hoặc chỉ điền các ô đang trống."
										className="min-h-[92px] resize-none rounded-none border-0 bg-transparent p-0 text-[12px] leading-6 shadow-none focus-visible:ring-0"
									/>
								</div>
								<div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf2f7] px-4 py-3">
									<div className="text-[10px] leading-5 text-slate-500">
										{files.length > 0
											? `Đang gắn ${files.length} file local cho lượt phân tích này.`
											: selectedDriveFileIds.length > 0
												? `Đang gắn ${selectedDriveFileIds.length} file từ Google Drive cho lượt phân tích này.`
												: sessionFileNames.length > 0 && latestResult
													? "AI sẽ tiếp tục dùng bộ file đã lưu của phiên hiện tại nếu bạn chỉ yêu cầu chỉnh kết quả."
													: latestResult
														? "Không cần nạp lại file nếu bạn chỉ muốn AI chỉnh kết quả hiện tại qua chat."
														: "Chưa có file nào được gắn vào prompt."}
									</div>
									<Button
										type="button"
										onClick={handleAnalyze}
										disabled={isAnalyzing || isUploadingToDrive || !canAnalyze}
										className="h-9 rounded-full bg-[linear-gradient(90deg,#14314b_0%,#1d4a6f_100%)] px-5 text-[11px] text-white hover:opacity-95"
									>
										<Send className="mr-1 size-4" />
										{isUploadingToDrive
											? "Đang lưu Drive..."
											: isAnalyzing
												? "Đang gửi AI..."
												: "Gửi cho AI"}
									</Button>
								</div>
							</div>
						</div>
					</div>
				</section>
			</div>
		</div>
	);
}
