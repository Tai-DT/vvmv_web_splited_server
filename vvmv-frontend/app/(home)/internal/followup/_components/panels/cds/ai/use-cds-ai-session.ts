"use client";

import {
	startTransition,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { cargoListsMeaningfullyDiffer } from "@/lib/followup/cds-ai-cargo-diff";
import { extractCdsInfoPatchFromPrompt } from "@/lib/followup/cds-ai-chat-cds-info-patch";
import {
	isBroadDataOperationPrompt,
	isExplicitCargoUpdatePrompt,
	isExplicitUserUpdatePrompt,
	promptMentionsCargoScope,
} from "@/lib/followup/cds-ai-chat-gates";
import { buildCdsAiChatTranscript } from "@/lib/followup/cds-ai-chat-transcript";
import { extractCdsClearPatchFromPrompt } from "@/lib/followup/cds-ai-clear-patch";
import {
	type CdsAiDocumentExtractionResult,
	rebuildCdsAiDocumentResult,
	sanitizeCdsAiDocumentResult,
} from "@/lib/followup/cds-ai-document";
import { mergeCargoRowsForApply } from "@/lib/followup/cds-ai-merge-cargo-for-apply";
import { isCdsWebLockedField } from "@/lib/followup/cds-web-locked-fields";
import type { FollowUpOperationType } from "@/lib/followup/operation-type";
import type {
	CargoListRow,
	FollowUpCdsInfoRow,
	FollowUpRow,
} from "../../../../types";
import { FOLLOWUP_CARGO_COLUMNS } from "../../panel-config";
import {
	CDS_AI_DOCUMENT_MODEL_STORAGE_KEY,
	parseCdsAiDocumentModelOptions,
} from "./cds-ai-model-options";
import type {
	CdsAiTimingBreakdown,
	ChatMessage,
	DriveFile,
	HistorySession,
} from "./cds-ai-types";
import {
	buildCurrentSnapshot,
	type CdsAiCdsInfoApplyOptions,
	collectApplicableCdsInfoEntries,
	extractDriveFolderId,
	getDocumentWarningCount,
	getDriveFileNameCandidates,
	getFileSignature,
	getFilledFieldCount,
	isMeaningfulValue,
	mergeUniqueStrings,
	normalizePrompt,
	parseCargoDraft,
	parseCdsFieldDraft,
} from "./cds-ai-utils";

function toNullableNumber(value: unknown) {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sanitizeUsageMetrics(value: unknown) {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}

	const record = value as Record<string, unknown>;
	const timingRaw = record.timing;
	let timing: CdsAiTimingBreakdown | null = null;
	if (timingRaw && typeof timingRaw === "object" && !Array.isArray(timingRaw)) {
		const t = timingRaw as Record<string, unknown>;
		timing = {
			prepDriveMs: toNullableNumber(t.prepDriveMs),
			prepUploadMs: toNullableNumber(t.prepUploadMs),
			geminiMs: toNullableNumber(t.geminiMs),
			sanitizeMs: toNullableNumber(t.sanitizeMs),
		};
	}

	return {
		promptTokens: toNullableNumber(record.promptTokens),
		candidatesTokens: toNullableNumber(record.candidatesTokens),
		totalTokens: toNullableNumber(record.totalTokens),
		durationMs: toNullableNumber(record.durationMs),
		timing,
	};
}

function getLocalFileFallbackMessage(error: unknown) {
	const message = error instanceof Error ? error.message.trim() : "";
	const normalizedMessage = message.toLowerCase();

	if (normalizedMessage.includes("file not found")) {
		return "Không tìm thấy file trên Google Drive. AI sẽ dùng file local cho lượt này.";
	}

	return "Không thể lưu file lên Google Drive. AI sẽ dùng file local cho lượt này.";
}

type CdsAiUsageMetricsState = ReturnType<typeof sanitizeUsageMetrics>;

type PersistGateAnalyze = {
	kind: "analyze";
	result: CdsAiDocumentExtractionResult;
	cdsOptions: CdsAiCdsInfoApplyOptions;
	shouldApplyCargoChanges: boolean;
	promptToSend: string;
	shouldApplyChatChanges: boolean;
	usage: CdsAiUsageMetricsState;
	assistantMessageId: string;
	effectiveDriveFileIds: string[];
	effectiveDriveFileNames: string[];
	effectiveSessionId: string;
	cargoOutcomeRows: number;
	cargoOutcomeShouldApply: boolean;
};

type PersistGateManual = {
	kind: "manual";
	result: CdsAiDocumentExtractionResult;
	overwriteAllFromAi: boolean;
	skippedLockedFieldCount: number;
	cargoWillPersist: boolean;
	cargoRowsCount: number;
};

export type CdsAiPersistGate = PersistGateAnalyze | PersistGateManual;

interface UseCdsAiSessionOptions {
	followUpId: string;
	operationType: FollowUpOperationType | null;
	followUpSummary?: Partial<FollowUpRow> | null;
	currentData: Partial<FollowUpCdsInfoRow>;
	currentCargoList: Partial<CargoListRow>[];
	handleFieldChange: (field: keyof FollowUpCdsInfoRow, value: unknown) => void;
	onCdsInfoPersisted?: (data: Partial<FollowUpCdsInfoRow>) => void;
	onCargoApplied?: (rows: Partial<CargoListRow>[]) => void;
}

export function useCdsAiSession({
	followUpId,
	operationType,
	followUpSummary,
	currentData,
	currentCargoList,
	handleFieldChange,
	onCdsInfoPersisted,
	onCargoApplied,
}: UseCdsAiSessionOptions) {
	const [files, setFiles] = useState<File[]>([]);
	const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
	const [selectedDriveFileIds, setSelectedDriveFileIds] = useState<string[]>(
		[],
	);
	const [prompt, setPrompt] = useState("");
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
	const [autoUploadToDrive, setAutoUploadToDrive] = useState(true);
	const [fieldDrafts, setFieldDrafts] = useState<Record<string, string>>({});
	const [cargoDrafts, setCargoDrafts] = useState<Record<string, string>>({});
	const [lastAutoApplySnapshot, setLastAutoApplySnapshot] =
		useState<Partial<FollowUpCdsInfoRow> | null>(null);
	const [persistGate, setPersistGate] = useState<CdsAiPersistGate | null>(null);

	const geminiModelOptions = useMemo(
		() => parseCdsAiDocumentModelOptions(),
		[],
	);

	const [selectedGeminiModel, setSelectedGeminiModel] = useState<string>(() => {
		const options = parseCdsAiDocumentModelOptions();
		const first = options[0] ?? "gemini-2.5-flash";
		if (typeof window === "undefined") return first;
		try {
			const stored = localStorage.getItem(CDS_AI_DOCUMENT_MODEL_STORAGE_KEY);
			if (stored && options.includes(stored)) return stored;
		} catch {
			/* ignore */
		}
		return first;
	});

	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const transcriptEndRef = useRef<HTMLDivElement | null>(null);
	const persistGateRef = useRef<CdsAiPersistGate | null>(null);
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

	useEffect(() => {
		persistGateRef.current = persistGate;
	}, [persistGate]);

	useEffect(() => {
		if (!geminiModelOptions.includes(selectedGeminiModel)) {
			setSelectedGeminiModel(geminiModelOptions[0] ?? "gemini-2.5-flash");
		}
	}, [geminiModelOptions, selectedGeminiModel]);

	useEffect(() => {
		try {
			localStorage.setItem(
				CDS_AI_DOCUMENT_MODEL_STORAGE_KEY,
				selectedGeminiModel,
			);
		} catch {
			/* ignore */
		}
	}, [selectedGeminiModel]);

	const selectedDriveFiles = useMemo(
		() => driveFiles.filter((file) => selectedDriveFileIds.includes(file.id)),
		[driveFiles, selectedDriveFileIds],
	);

	const findExistingDriveFileForLocal = useCallback(
		(localFile: File) => {
			const localNameCandidates = new Set(
				getDriveFileNameCandidates(localFile.name),
			);

			return driveFiles.find((driveFile) => {
				const hasMatchingName = getDriveFileNameCandidates(driveFile.name).some(
					(name) => localNameCandidates.has(name),
				);

				if (!hasMatchingName) {
					return false;
				}

				if (driveFile.size) {
					const driveSize = Number(driveFile.size);
					return Number.isFinite(driveSize) && driveSize === localFile.size;
				}

				return driveFile.name === localFile.name;
			});
		},
		[driveFiles],
	);

	const activeSession = useMemo(
		() => sessions.find((entry) => entry.id === sessionId) ?? null,
		[sessionId, sessions],
	);

	const currentSnapshot = useMemo(
		() => buildCurrentSnapshot(currentData, currentCargoList),
		[currentCargoList, currentData],
	);
	const isCurrentDeclarationLocked = useMemo(() => {
		const declarationNumber =
			typeof currentData.declarationNumber === "string"
				? currentData.declarationNumber.trim()
				: "";

		return (
			declarationNumber !== "" &&
			(currentData.cdsStatus === "REGISTERED" ||
				currentData.ecusDeclarationId != null)
		);
	}, [
		currentData.cdsStatus,
		currentData.declarationNumber,
		currentData.ecusDeclarationId,
	]);
	const hasCurrentSnapshot = currentSnapshot !== null;
	const canAnalyze = useMemo(
		() =>
			files.length > 0 ||
			selectedDriveFileIds.length > 0 ||
			(!!latestResult && prompt.trim().length > 0) ||
			(hasCurrentSnapshot && prompt.trim().length > 0),
		[
			files.length,
			hasCurrentSnapshot,
			latestResult,
			prompt,
			selectedDriveFileIds.length,
		],
	);

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

	/* ---- File management ---- */

	const appendFiles = useCallback((nextFiles: File[]) => {
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
	}, []);

	const removeFile = useCallback((index: number) => {
		setFiles((current) =>
			current.filter((_, currentIndex) => currentIndex !== index),
		);
	}, []);

	/* ---- Drive ---- */

	const fetchDriveFiles = useCallback(async () => {
		if (!driveFolderId || driveFolderId === "." || driveFolderId.length < 10) {
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

	const toggleDriveFileSelection = useCallback((fileId: string) => {
		setSelectedDriveFileIds((current) =>
			current.includes(fileId)
				? current.filter((id) => id !== fileId)
				: [...current, fileId],
		);
	}, []);

	const selectAllDriveFiles = useCallback(() => {
		if (selectedDriveFileIds.length === driveFiles.length) {
			setSelectedDriveFileIds([]);
			return;
		}
		setSelectedDriveFileIds(driveFiles.map((file) => file.id));
	}, [driveFiles, selectedDriveFileIds.length]);

	/* ---- History ---- */

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
				setLastAutoApplySnapshot(null);
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

	/* ---- Session ---- */

	const handleStartNewSession = useCallback(() => {
		setSessionId(null);
		setMessages([]);
		setLatestResult(null);
		setActiveResultMessageId(null);
		setSessionFileIds([]);
		setSessionFileNames([]);
		setPrompt("");
		setFieldDrafts({});
		setCargoDrafts({});
		setLastAutoApplySnapshot(null);
		setPersistGate(null);
	}, []);

	/* ---- Draft commit ---- */

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
					fieldSources: result.fieldSources,
					cargoList: nextCargoList as Partial<CargoListRow>[],
				},
				operationType,
			);
		},
		[cargoDrafts, fieldDrafts, operationType],
	);

	const syncMessageResult = useCallback(
		(
			messageId: string | null,
			result: CdsAiDocumentExtractionResult | null,
		) => {
			if (!messageId || !result) {
				return;
			}

			setMessages((current) => {
				let didChange = false;
				const next = current.map((message) => {
					if (message.id !== messageId || message.role !== "assistant") {
						return message;
					}

					if (
						message.result === result &&
						message.text === result.assistantMessage
					) {
						return message;
					}

					didChange = true;
					return {
						...message,
						text: result.assistantMessage || message.text,
						result,
					};
				});

				return didChange ? next : current;
			});
		},
		[],
	);

	const activateResultMessage = useCallback(
		(messageId: string, result: CdsAiDocumentExtractionResult) => {
			syncMessageResult(
				activeResultMessageId,
				buildCommittedResult(latestResult),
			);
			setLatestResult(rebuildCdsAiDocumentResult(result, operationType));
			setActiveResultMessageId(messageId);
			setFieldDrafts({});
			setCargoDrafts({});
			setLastAutoApplySnapshot(null);
		},
		[
			activeResultMessageId,
			buildCommittedResult,
			latestResult,
			operationType,
			syncMessageResult,
		],
	);

	const flushDraftsToLatestResult = useCallback(() => {
		const committed = buildCommittedResult(latestResult);
		if (!committed) {
			return null;
		}

		setLatestResult(committed);
		syncMessageResult(activeResultMessageId, committed);
		if (Object.keys(fieldDrafts).length > 0) {
			setFieldDrafts({});
		}
		if (Object.keys(cargoDrafts).length > 0) {
			setCargoDrafts({});
		}

		return committed;
	}, [
		activeResultMessageId,
		buildCommittedResult,
		cargoDrafts,
		fieldDrafts,
		latestResult,
		syncMessageResult,
	]);

	const getApplicableCdsInfoFields = useCallback(
		(
			result: CdsAiDocumentExtractionResult,
			options?: CdsAiCdsInfoApplyOptions,
		) =>
			collectApplicableCdsInfoEntries(
				result,
				currentData,
				operationType,
				options,
			),
		[currentData, operationType],
	);

	const applyCdsInfoResultToMainForm = useCallback(
		(
			result: CdsAiDocumentExtractionResult,
			options?: CdsAiCdsInfoApplyOptions,
		) => {
			const beforeApplySnapshot = { ...currentData };
			const applicableFields = getApplicableCdsInfoFields(result, options);
			const nextData = { ...currentData };
			const nextDataRecord = nextData as Record<string, unknown>;

			setLastAutoApplySnapshot(beforeApplySnapshot);
			startTransition(() => {
				applicableFields.forEach(([fieldKey, value]) => {
					nextDataRecord[fieldKey] = value;
					handleFieldChange(fieldKey as keyof FollowUpCdsInfoRow, value);
				});
			});

			return {
				count: applicableFields.length,
				nextData,
			};
		},
		[currentData, getApplicableCdsInfoFields, handleFieldChange],
	);

	useEffect(() => {
		syncMessageResult(activeResultMessageId, latestResult);
	}, [activeResultMessageId, latestResult, syncMessageResult]);

	const commitFieldDraft = useCallback(
		(fieldKey: string, rawValue?: string) => {
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
		},
		[fieldDrafts, operationType],
	);

	const commitCargoDraft = useCallback(
		(rowIndex: number, columnKey: string, rawValue?: string) => {
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
		},
		[cargoDrafts, operationType],
	);

	const applyCargoRowsToMainList = useCallback(
		async (rows: Partial<CargoListRow>[]) => {
			const response = await fetch(`/api/followup/${followUpId}/cargo`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ items: rows }),
			});

			if (!response.ok) {
				const payload = await response.json().catch(() => ({}));
				throw new Error(payload?.error || "Không thể áp danh sách hàng từ AI.");
			}

			onCargoApplied?.(rows);
			return rows.length;
		},
		[followUpId, onCargoApplied],
	);

	const persistCdsInfoToMainRecord = useCallback(
		async (dataToPersist: Partial<FollowUpCdsInfoRow>) => {
			const response = await fetch(`/api/followup/${followUpId}/cds-info`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					data: dataToPersist,
					preserveLifecycle: true,
				}),
			});
			const payload = await response.json().catch(() => ({}));

			if (!response.ok) {
				if (payload?.data && typeof payload.data === "object") {
					onCdsInfoPersisted?.(payload.data as Partial<FollowUpCdsInfoRow>);
				}
				if (Array.isArray(payload?.cargoList)) {
					onCargoApplied?.(payload.cargoList as Partial<CargoListRow>[]);
				}
				throw new Error(payload?.error || "Không thể lưu dữ liệu CDS từ AI.");
			}

			if (payload?.data && typeof payload.data === "object") {
				onCdsInfoPersisted?.(payload.data as Partial<FollowUpCdsInfoRow>);
			}

			return payload?.data as Partial<FollowUpCdsInfoRow> | undefined;
		},
		[followUpId, onCargoApplied, onCdsInfoPersisted],
	);

	const notifyAnalyzePersistOutcome = useCallback(
		(
			autoAppliedFieldCount: number,
			didApplyCargoChanges: boolean,
			autoAppliedCargoCount: number,
			shouldApplyChatChangesFlag: boolean,
			extractedCdsFieldCount: number,
		) => {
			if (autoAppliedFieldCount > 0 || didApplyCargoChanges) {
				const persistSummary = [
					autoAppliedFieldCount > 0
						? `${autoAppliedFieldCount} trường CDS đã lưu`
						: null,
					didApplyCargoChanges
						? `${autoAppliedCargoCount} dòng hàng đã lưu`
						: null,
				]
					.filter(Boolean)
					.join(", ");
				toast.success(
					shouldApplyChatChangesFlag
						? "AI đã cập nhật dữ liệu theo chat"
						: "AI đã điền ô trống vào CDS",
					{
						description:
							persistSummary ||
							(shouldApplyChatChangesFlag
								? "Đã áp dụng theo yêu cầu."
								: "Đã áp dụng từ kết quả phân tích."),
					},
				);
			} else if (extractedCdsFieldCount > 0) {
				toast.info("AI đã phân tích xong", {
					description: shouldApplyChatChangesFlag
						? "AI có dữ liệu đề xuất nhưng chưa có trường hợp lệ để cập nhật."
						: "AI có dữ liệu đề xuất nhưng các ô CDS tương ứng đã có dữ liệu nên chưa ghi đè.",
				});
			}
		},
		[],
	);

	const cancelPersistGate = useCallback(() => {
		setPersistGate(null);
		toast.message("Chưa lưu lên máy chủ", {
			description:
				"Kết quả AI vẫn trong khung chat — mở tab Nạp và bấm Áp dụng khi sẵn sàng.",
		});
	}, []);

	const confirmPersistGate = useCallback(async () => {
		const gate = persistGateRef.current;
		if (!gate) {
			return;
		}

		setIsApplying(true);
		try {
			if (gate.kind === "analyze") {
				const cdsInfoApplyResult = applyCdsInfoResultToMainForm(
					gate.result,
					gate.cdsOptions,
				);
				let autoAppliedCargoCount = 0;
				let didApplyCargoChanges = false;

				if (!isCurrentDeclarationLocked && cdsInfoApplyResult.count > 0) {
					await persistCdsInfoToMainRecord(cdsInfoApplyResult.nextData);
				}

				if (gate.shouldApplyCargoChanges) {
					const cargoApplyResult = mergeCargoRowsForApply({
						aiRows: gate.result.cargoList,
						currentRows: currentCargoList,
						promptText: gate.promptToSend,
					});

					if (cargoApplyResult.shouldApply) {
						autoAppliedCargoCount = await applyCargoRowsToMainList(
							cargoApplyResult.rows,
						);
						didApplyCargoChanges = true;
					}
				}

				const extractedCdsFieldCount = getFilledFieldCount(gate.result);
				notifyAnalyzePersistOutcome(
					cdsInfoApplyResult.count,
					didApplyCargoChanges,
					autoAppliedCargoCount,
					gate.shouldApplyChatChanges,
					extractedCdsFieldCount,
				);
			} else {
				const resultToApply = gate.result;
				const overwriteAllFromAi = gate.overwriteAllFromAi;
				const cdsInfoApplyResult = applyCdsInfoResultToMainForm(
					resultToApply,
					overwriteAllFromAi ? { overwrite: true } : undefined,
				);

				if (cdsInfoApplyResult.count > 0) {
					await persistCdsInfoToMainRecord(cdsInfoApplyResult.nextData);
				}

				let cargoApplied = 0;
				if (gate.cargoWillPersist) {
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

					cargoApplied = gate.cargoRowsCount;
					onCargoApplied?.(resultToApply.cargoList);
				}

				const cdsSummary = overwriteAllFromAi
					? cdsInfoApplyResult.count > 0
						? `Đã cập nhật ${cdsInfoApplyResult.count} trường CDS và lưu máy chủ`
						: "Không có trường CDS hợp lệ để cập nhật"
					: cdsInfoApplyResult.count > 0
						? `Đã điền ${cdsInfoApplyResult.count} ô trống trong CDS và lưu máy chủ`
						: "Không có ô CDS trống để điền";

				const detail = [
					cdsSummary,
					gate.skippedLockedFieldCount > 0
						? `bỏ qua ${gate.skippedLockedFieldCount} trường đang khóa`
						: null,
					cargoApplied > 0
						? `và ${cargoApplied} dòng hàng`
						: resultToApply.cargoList.length > 0 &&
								!overwriteAllFromAi &&
								currentCargoList.length > 0
							? "và giữ nguyên danh sách hàng hiện có"
							: null,
				]
					.filter(Boolean)
					.join(" ");

				toast.success("Đã áp dữ liệu AI vào CDS", {
					description: detail,
				});
			}
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Không thể hoàn tất lưu CDS.",
			);
		} finally {
			setPersistGate(null);
			setIsApplying(false);
		}
	}, [
		applyCargoRowsToMainList,
		applyCdsInfoResultToMainForm,
		currentCargoList,
		currentCargoList.length,
		followUpId,
		isCurrentDeclarationLocked,
		notifyAnalyzePersistOutcome,
		onCargoApplied,
		persistCdsInfoToMainRecord,
	]);

	/* ---- Analyze ---- */

	const handleAnalyze = useCallback(async () => {
		const committedLatestResult = flushDraftsToLatestResult();
		const revisionSeed = committedLatestResult ?? latestResult;
		const promptToSend = prompt;
		const promptHasText = promptToSend.trim().length > 0;
		const shouldReviseExisting = !!revisionSeed && promptHasText;
		const canUseSnapshotOnly = !!currentSnapshot && promptHasText;
		const shouldApplyChatChanges =
			canUseSnapshotOnly && isExplicitUserUpdatePrompt(promptToSend);
		const now = new Date();

		if (shouldApplyChatChanges && isCurrentDeclarationLocked) {
			toast.warning("Tờ khai đã được app cấp số", {
				description:
					"AI chỉ được rà soát/đối chiếu, không cập nhật trực tiếp dữ liệu thật của tờ khai đã cấp số.",
			});
			return;
		}

		if (
			!files.length &&
			selectedDriveFileIds.length === 0 &&
			!shouldReviseExisting &&
			!canUseSnapshotOnly
		) {
			toast.error("Cần chọn ít nhất 1 file từ máy hoặc Google Drive.");
			return;
		}

		const userPrompt = normalizePrompt(promptToSend, operationType);
		const effectiveSessionId = sessionId ?? crypto.randomUUID();
		const selectedDriveNames = selectedDriveFiles.map((file) => file.name);
		let effectiveDriveFileIds =
			selectedDriveFileIds.length > 0 ? selectedDriveFileIds : sessionFileIds;
		let effectiveDriveFileNames =
			selectedDriveNames.length > 0 ? selectedDriveNames : sessionFileNames;
		let pendingLocalFiles = [...files];

		if (pendingLocalFiles.length > 0 && autoUploadToDrive && driveFolderId) {
			const existingDriveFiles: DriveFile[] = [];
			const newLocalFiles: File[] = [];

			pendingLocalFiles.forEach((file) => {
				const existingDriveFile = findExistingDriveFileForLocal(file);
				if (existingDriveFile) {
					existingDriveFiles.push(existingDriveFile);
					return;
				}

				newLocalFiles.push(file);
			});

			if (existingDriveFiles.length > 0) {
				const existingIds = existingDriveFiles.map((file) => file.id);
				const existingNames = existingDriveFiles.map((file) => file.name);
				effectiveDriveFileIds = mergeUniqueStrings([
					...effectiveDriveFileIds,
					...existingIds,
				]);
				effectiveDriveFileNames = mergeUniqueStrings([
					...effectiveDriveFileNames,
					...existingNames,
				]);
				setSelectedDriveFileIds((current) =>
					mergeUniqueStrings([...current, ...existingIds]),
				);
				pendingLocalFiles = newLocalFiles;
				setFiles(newLocalFiles);

				if (newLocalFiles.length === 0) {
					toast.info("File đã có sẵn trên Drive, AI sẽ không upload lại.");
				}
			}

			if (pendingLocalFiles.length > 0) {
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
					const uploadedCount =
						typeof uploadPayload?.uploadedCount === "number"
							? uploadPayload.uploadedCount
							: uploadedIds.length;
					const reusedCount =
						typeof uploadPayload?.reusedCount === "number"
							? uploadPayload.reusedCount
							: 0;

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

					if (uploadedCount > 0 && reusedCount > 0) {
						toast.success(
							`Đã lưu ${uploadedCount} file mới, dùng lại ${reusedCount} file đã có trên Drive.`,
						);
					} else if (uploadedCount > 0) {
						toast.success("Đã lưu file local lên Google Drive của hồ sơ.");
					} else if (reusedCount > 0) {
						toast.info("File đã có sẵn trên Drive, AI sẽ không upload lại.");
					}

					void fetchDriveFiles();
				} catch (error) {
					toast.warning(getLocalFileFallbackMessage(error));
				} finally {
					setIsUploadingToDrive(false);
				}
			}
		}

		if (
			!pendingLocalFiles.length &&
			effectiveDriveFileIds.length === 0 &&
			!shouldReviseExisting &&
			!canUseSnapshotOnly
		) {
			toast.error("Không còn file hợp lệ để gửi cho AI phân tích.");
			return;
		}

		const priorTranscriptSource = messages.map((message) => ({
			role: message.role,
			text: message.text,
		}));

		setIsAnalyzing(true);
		setPrompt("");
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
			const chatTranscript = buildCdsAiChatTranscript(priorTranscriptSource);
			if (chatTranscript) {
				formData.append("chatTranscript", chatTranscript);
			}
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

			formData.append("model", selectedGeminiModel);

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

			let result = sanitizeCdsAiDocumentResult(payload?.data, operationType);
			let chatPromptTouchedFieldKeys: ReadonlySet<string> | undefined;
			if (shouldApplyChatChanges) {
				const cdsInfoPatch = {
					...extractCdsInfoPatchFromPrompt(promptToSend),
					...extractCdsClearPatchFromPrompt(promptToSend),
				};
				chatPromptTouchedFieldKeys = new Set(
					Object.keys(cdsInfoPatch).filter((key) => {
						const typed = key as keyof FollowUpCdsInfoRow;
						return cdsInfoPatch[typed] !== undefined;
					}),
				);
				if (Object.keys(cdsInfoPatch).length > 0) {
					result = rebuildCdsAiDocumentResult(
						{
							...result,
							cdsInfo: {
								...result.cdsInfo,
								...cdsInfoPatch,
							},
						},
						operationType,
					);
				}
			}

			const usage = sanitizeUsageMetrics(payload?.usage);
			const assistantMessageId = `${Date.now()}-assistant`;

			const cdsOpts: CdsAiCdsInfoApplyOptions = {
				overwrite: shouldApplyChatChanges,
				promptTouchedFieldKeys: shouldApplyChatChanges
					? (chatPromptTouchedFieldKeys ?? new Set())
					: undefined,
			};
			const cdsEntries = collectApplicableCdsInfoEntries(
				result,
				currentData,
				operationType,
				cdsOpts,
			);

			const trustModelCargoDiff =
				shouldApplyChatChanges &&
				cargoListsMeaningfullyDiffer(currentCargoList, result.cargoList) &&
				promptMentionsCargoScope(promptToSend);

			const shouldApplyCargoChanges =
				!isCurrentDeclarationLocked &&
				result.cargoList.length > 0 &&
				(shouldApplyChatChanges
					? isExplicitCargoUpdatePrompt(promptToSend) ||
						isBroadDataOperationPrompt(promptToSend) ||
						trustModelCargoDiff
					: true);

			const cargoOutcome = shouldApplyCargoChanges
				? mergeCargoRowsForApply({
						aiRows: result.cargoList,
						currentRows: currentCargoList,
						promptText: promptToSend,
					})
				: { rows: [] as Partial<CargoListRow>[], shouldApply: false };

			const needsCdsPersist =
				cdsEntries.length > 0 && !isCurrentDeclarationLocked;
			const needsCargoPersist =
				shouldApplyCargoChanges &&
				!isCurrentDeclarationLocked &&
				cargoOutcome.shouldApply;

			setLatestResult(result);
			setActiveResultMessageId(assistantMessageId);
			setFieldDrafts({});
			setCargoDrafts({});
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
					usage,
				},
			]);

			const extractedCdsFieldCount = getFilledFieldCount(result);

			if (needsCdsPersist || needsCargoPersist) {
				setPersistGate({
					kind: "analyze",
					result,
					cdsOptions: cdsOpts,
					shouldApplyCargoChanges,
					promptToSend,
					shouldApplyChatChanges,
					usage,
					assistantMessageId,
					effectiveDriveFileIds,
					effectiveDriveFileNames,
					effectiveSessionId,
					cargoOutcomeRows: cargoOutcome.rows.length,
					cargoOutcomeShouldApply: cargoOutcome.shouldApply,
				});
				return;
			}

			const cdsInfoApplyResult = applyCdsInfoResultToMainForm(result, cdsOpts);
			const autoAppliedFieldCount = cdsInfoApplyResult.count;
			let autoAppliedCargoCount = 0;
			let didApplyCargoChanges = false;

			if (!isCurrentDeclarationLocked && autoAppliedFieldCount > 0) {
				await persistCdsInfoToMainRecord(cdsInfoApplyResult.nextData);
			}

			if (shouldApplyCargoChanges) {
				const cargoApplyResult = mergeCargoRowsForApply({
					aiRows: result.cargoList,
					currentRows: currentCargoList,
					promptText: promptToSend,
				});

				if (cargoApplyResult.shouldApply) {
					autoAppliedCargoCount = await applyCargoRowsToMainList(
						cargoApplyResult.rows,
					);
					didApplyCargoChanges = true;
				}
			}

			notifyAnalyzePersistOutcome(
				autoAppliedFieldCount,
				didApplyCargoChanges,
				autoAppliedCargoCount,
				shouldApplyChatChanges,
				extractedCdsFieldCount,
			);
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
	}, [
		applyCargoRowsToMainList,
		autoUploadToDrive,
		applyCdsInfoResultToMainForm,
		currentCargoList,
		currentData,
		currentSnapshot,
		driveFolderId,
		fetchDriveFiles,
		findExistingDriveFileForLocal,
		files,
		flushDraftsToLatestResult,
		followUpId,
		followUpSummary?.jobNumber,
		isCurrentDeclarationLocked,
		latestResult,
		messages,
		notifyAnalyzePersistOutcome,
		operationType,
		persistCdsInfoToMainRecord,
		prompt,
		selectedGeminiModel,
		selectedDriveFileIds,
		selectedDriveFiles,
		sessionFileIds,
		sessionFileNames,
		sessionId,
	]);

	/* ---- Apply ---- */

	const handleApply = useCallback(async () => {
		const resultToApply = flushDraftsToLatestResult() ?? latestResult;
		if (!resultToApply) {
			return;
		}

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

		const overwriteAllFromAi = !fillMissingOnly;

		let cargoWillPersist = false;
		let cargoRowsCount = 0;
		if (resultToApply.cargoList.length > 0) {
			const canReplaceCargo = !fillMissingOnly || currentCargoList.length === 0;
			if (canReplaceCargo) {
				cargoWillPersist = true;
				cargoRowsCount = resultToApply.cargoList.length;
			}
		}

		setPersistGate({
			kind: "manual",
			result: resultToApply,
			overwriteAllFromAi,
			skippedLockedFieldCount,
			cargoWillPersist,
			cargoRowsCount,
		});
	}, [
		currentCargoList.length,
		fillMissingOnly,
		flushDraftsToLatestResult,
		latestResult,
		operationType,
	]);

	/* ---- Effects ---- */

	useEffect(() => {
		void fetchDriveFiles();
	}, [fetchDriveFiles]);

	useEffect(() => {
		void loadHistory();
	}, [loadHistory]);

	return {
		// State
		files,
		driveFiles,
		selectedDriveFileIds,
		prompt,
		messages,
		sessions,
		sessionId,
		latestResult,
		activeResultMessageId,
		sessionFileNames,
		isAnalyzing,
		isApplying,
		isFetchingDriveFiles,
		isLoadingHistory,
		isUploadingToDrive,
		dragging,
		fillMissingOnly,
		autoUploadToDrive,
		geminiModelOptions,
		selectedGeminiModel,
		fieldDrafts,
		cargoDrafts,
		canAnalyze,
		attachedSourceCount,
		activeDraftFieldCount,
		activeDraftWarningCount,
		lastAutoApplySnapshot,
		hasCurrentSnapshot,
		driveUrl,
		driveFolderId,
		activeSessionLabel: activeSession?.label ?? null,
		persistGate,

		// Refs
		fileInputRef,
		transcriptEndRef,

		// Actions
		setPrompt,
		setDragging,
		setFillMissingOnly,
		setAutoUploadToDrive,
		setSelectedGeminiModel,
		setFieldDrafts,
		setCargoDrafts,
		activateResultMessage,
		appendFiles,
		removeFile,
		toggleDriveFileSelection,
		selectAllDriveFiles,
		refreshDriveFiles: () => void fetchDriveFiles(),
		loadHistory: (id: string) => void loadHistory(id),
		handleStartNewSession,
		handleAnalyze: () => void handleAnalyze(),
		handleApply: () => void handleApply(),
		confirmPersistGate,
		cancelPersistGate,
		commitFieldDraft,
		commitCargoDraft,
	};
}

export type CdsAiSession = ReturnType<typeof useCdsAiSession>;
