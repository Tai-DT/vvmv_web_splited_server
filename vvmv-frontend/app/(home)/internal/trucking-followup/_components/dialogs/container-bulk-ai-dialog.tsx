"use client";

import {
	AlertCircle,
	ArrowLeft,
	Check,
	CheckCheck,
	CheckCircle2,
	ChevronRight,
	ExternalLink,
	File as FileIcon2,
	FileSpreadsheet,
	FileText,
	Folder,
	HardDrive,
	Image as ImageIcon,
	Loader2,
	RefreshCw,
	Sparkles,
	Upload,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { VirtualizedCombobox } from "@/app/(home)/internal/followup/_components/shared/virtualized-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectPositioner,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useAirports } from "@/hooks/use-airports";
import { useContainerSizes } from "@/hooks/use-container-sizes";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContainerRow {
	id: string;
	containerNo?: string | null;
	sealNo?: string | null;
	containerSize?: string | null;
	tareWeight?: number | null;
	masGross?: number | null;
}

interface BulkResult {
	rowId: string;
	containerNo: string | null;
	sealNo: string | null;
	tareWeight: number | null;
	masGross: number | null;
	containerType?: string | null;
	kc?: string | null;
	mappedContainerSize?: string | null;
	matchedFileIds: string[];
	matchedFileNames: string[];
	fileRoles: Array<{
		fileIndex: number;
		role: "container" | "seal" | "other";
		cropRegion?: {
			top: number;
			left: number;
			bottom: number;
			right: number;
			rotation?: number;
		};
	}>;
}

interface EditedResult extends BulkResult {
	applied: boolean;
}

interface SelectedFile {
	file: File;
	preview?: string;
	name: string;
	mimeType: string;
}

interface DriveItem {
	id: string;
	name: string;
	mimeType: string;
	isFolder: boolean;
	thumbnailLink?: string | null;
}

interface BreadcrumbEntry {
	id: string;
	name: string;
}

interface FileMetadata {
	name: string;
	mimeType: string;
	thumbnailLink?: string | null;
}

interface ContainerBulkAiDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	rows: ContainerRow[];
	jobNumber?: string | null;
	driveUrl?: string | null;
	billOrBooking?: string | null;
	operationType?: string | null;
	fromLocation?: string | null;
	toLocation?: string | null;
	onConfirm: (
		results: Array<{
			rowId: string;
			containerNo: string | null;
			sealNo: string | null;
			tareWeight: number | null;
			masGross: number | null;
			containerType?: string | null;
			kc?: string | null;
			mappedContainerSize?: string | null;
			newFolderUrl?: string | null;
		}>,
	) => Promise<void>;
}

type SourceTab = "local" | "drive";

// ─── File icon ────────────────────────────────────────────────────────────────
function FileTypeIcon({
	mimeType,
	className,
}: {
	mimeType: string;
	className?: string;
}) {
	if (mimeType.startsWith("image/")) return <ImageIcon className={className} />;
	if (mimeType === "application/pdf") return <FileText className={className} />;
	if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
		return <FileSpreadsheet className={className} />;
	if (mimeType.includes("wordprocessing") || mimeType.includes("msword"))
		return <FileText className={className} />;
	return <FileIcon2 className={className} />;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ContainerBulkAiDialog({
	open,
	onOpenChange,
	rows,
	jobNumber,
	driveUrl,
	billOrBooking,
	operationType,
	fromLocation,
	toLocation,
	onConfirm,
}: ContainerBulkAiDialogProps) {
	const [activeTab, setActiveTab] = useState<SourceTab>("local");
	const [sessionId, setSessionId] = useState("");

	// Resolve airport code → name for KC lookup
	const { airports } = useAirports();
	const { containerSizes } = useContainerSizes();
	const sizeOptions = useMemo(
		() => containerSizes.map((s) => ({ id: s, name: s })),
		[containerSizes],
	);
	const portCode = operationType === "XUAT" ? toLocation : fromLocation;
	const portName = useMemo(() => {
		if (!portCode) return null;
		const found = airports.find((a) => a.id === portCode);
		return found?.name ?? portCode; // fallback to code if not found
	}, [airports, portCode]);

	// Local files
	const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
	const [isDragging, setIsDragging] = useState(false);

	// Drive
	const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([]);
	const [driveFolders, setDriveFolders] = useState<DriveItem[]>([]);
	const [driveFiles, setDriveFiles] = useState<DriveItem[]>([]);
	const [fetchingDrive, setFetchingDrive] = useState(false);
	const [selectedDriveIds, setSelectedDriveIds] = useState<string[]>([]);
	const [analysisFileIds, setAnalysisFileIds] = useState<string[]>([]);
	const [fileMetadataMap, setFileMetadataMap] = useState<
		Record<string, FileMetadata>
	>({});

	// Working + parent folder
	const [workingFolderId, setWorkingFolderId] = useState<string | null>(null);
	const [containerParentFolderId, setContainerParentFolderId] = useState<
		string | null
	>(null);
	const [creatingFolder, setCreatingFolder] = useState(false);

	// History
	const [loadingHistory, setLoadingHistory] = useState(false);
	const [isRestored, setIsRestored] = useState(false);
	const [restoredAt, setRestoredAt] = useState<string | null>(null);

	// Results
	const [analyzing, setAnalyzing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [results, setResults] = useState<EditedResult[]>([]);
	const [billMismatch, setBillMismatch] = useState<{
		detected: string;
		reason: string;
	} | null>(null);
	const availableModels = useMemo(() => {
		return (process.env.NEXT_PUBLIC_GEMINI_AUTOFILL_CONTAINER_MODEL || "")
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
	}, []);

	const [modelName, setModelName] = useState<string | null>(
		process.env.NEXT_PUBLIC_GEMINI_AUTOFILL_CONTAINER_MODEL
			? process.env.NEXT_PUBLIC_GEMINI_AUTOFILL_CONTAINER_MODEL.split(",")
					.map((s) => s.trim())
					.filter(Boolean)[0] || null
			: null,
	);

	const fileInputRef = useRef<HTMLInputElement>(null);

	const rootFolderId =
		driveUrl?.match(/folders\/([a-zA-Z0-9_-]+)/)?.[1] ?? null;
	const currentFolderId =
		breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].id : rootFolderId;

	// ─── Load Drive folder ───────────────────────────────────────────────────
	const loadFolder = useCallback(
		async (folderId: string, keepSelection = false) => {
			setFetchingDrive(true);
			if (!keepSelection) setSelectedDriveIds([]);
			try {
				const res = await fetch(
					`/api/google-drive/files?folderId=${folderId}&includeFolders=true`,
				);
				const data = await res.json();
				if (!res.ok) throw new Error(data.message);
				setDriveFolders(data.folders || []);
				setDriveFiles(data.files || []);
			} catch (err: any) {
				toast.error(`Lỗi tải Drive: ${err.message}`);
			} finally {
				setFetchingDrive(false);
			}
		},
		[],
	);

	// ─── Restore history on open ─────────────────────────────────────────────
	useEffect(() => {
		if (!open) return;

		setSessionId(crypto.randomUUID());
		setResults([]);
		setAnalysisFileIds([]);
		setIsRestored(false);
		setRestoredAt(null);
		setWorkingFolderId(null);
		setContainerParentFolderId(null);

		if (!jobNumber) return;

		setLoadingHistory(true);
		fetch(
			`/api/trucking-followup/container/ai-autofill-bulk?jobNumber=${encodeURIComponent(jobNumber)}`,
		)
			.then((r) => r.json())
			.then((data) => {
				if (!data.history) return;
				const h = data.history;

				if (h.results?.length > 0) {
					const restored: EditedResult[] = h.results.map((r: BulkResult) => ({
						...r,
						fileRoles: r.fileRoles || [],
						applied: !!(r.containerNo || r.sealNo),
					}));
					setResults(restored);
					setIsRestored(true);
					setRestoredAt(h.createdAt || null);
				}

				// Dynamically re-compute bill mismatch with CURRENT billOrBooking
				const detected: string | null = h.detectedBillOrBooking ?? null;
				if (detected && billOrBooking) {
					const matches =
						detected.trim().toLowerCase() ===
						billOrBooking.trim().toLowerCase();
					setBillMismatch(
						matches
							? null
							: {
									detected,
									reason: `Số bill/booking phát hiện trong tài liệu (${detected}) không khớp với giá trị hiện tại (${billOrBooking}).`,
								},
					);
				} else {
					setBillMismatch(null);
				}

				const wfId = h.workingFolderId as string | null;
				if (wfId) {
					setWorkingFolderId(wfId);
					setActiveTab("drive");
					setSelectedDriveIds(h.fileIds || []);
					setAnalysisFileIds(h.fileIds || []);
					setBreadcrumb([{ id: wfId, name: "📂 Thư mục làm việc" }]);
					loadFolder(wfId, true);
				} else if ((h.fileIds || []).length > 0 && rootFolderId) {
					setActiveTab("drive");
					setSelectedDriveIds(h.fileIds);
					setAnalysisFileIds(h.fileIds || []);
					loadFolder(rootFolderId, true);
				}
			})
			.catch(() => {})
			.finally(() => setLoadingHistory(false));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, billOrBooking, jobNumber, loadFolder, rootFolderId]);

	// ─── Get or create "CONTAINER" parent folder ─────────────────────────────
	const getOrCreateContainerFolder = async (): Promise<{
		folderId: string;
		folderUrl: string;
	} | null> => {
		if (!driveUrl) return null;
		if (containerParentFolderId) {
			return {
				folderId: containerParentFolderId,
				folderUrl: `https://drive.google.com/drive/folders/${containerParentFolderId}`,
			};
		}
		try {
			const res = await fetch("/api/google-drive/create-folder-and-move", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					parentFolderUrl: driveUrl,
					folderName: "CONTAINER",
					fileIds: [],
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message);
			setContainerParentFolderId(data.newFolderId);
			return { folderId: data.newFolderId, folderUrl: data.newFolderUrl };
		} catch (err: any) {
			console.warn("Could not create CONTAINER folder:", err.message);
			return null;
		}
	};

	// ─── Drive navigation ────────────────────────────────────────────────────
	const enterFolder = (f: DriveItem) => {
		setBreadcrumb((p) => [...p, { id: f.id, name: f.name }]);
		loadFolder(f.id);
	};

	const navigateTo = (index: number) => {
		if (index === -1) {
			setBreadcrumb([]);
			rootFolderId && loadFolder(rootFolderId);
		} else {
			const c = breadcrumb.slice(0, index + 1);
			setBreadcrumb(c);
			loadFolder(c[c.length - 1].id);
		}
	};

	// Sync metadata for selected drive files
	useEffect(() => {
		if (driveFiles.length > 0) {
			const newMetadata: Record<string, FileMetadata> = {};
			let changed = false;
			driveFiles.forEach((f) => {
				if (selectedDriveIds.includes(f.id)) {
					if (
						!fileMetadataMap[f.id] ||
						fileMetadataMap[f.id].thumbnailLink !== f.thumbnailLink
					) {
						newMetadata[f.id] = {
							name: f.name,
							mimeType: f.mimeType,
							thumbnailLink: f.thumbnailLink,
						};
						changed = true;
					}
				}
			});
			if (changed) {
				setFileMetadataMap((prev) => ({ ...prev, ...newMetadata }));
			}
		}
	}, [driveFiles, selectedDriveIds, fileMetadataMap]);

	const toggleDrive = (f: DriveItem) => {
		setSelectedDriveIds((p) => {
			const isSelected = p.includes(f.id);
			if (isSelected) return p.filter((x) => x !== f.id);

			// Update metadata map when selecting
			setFileMetadataMap((prev) => ({
				...prev,
				[f.id]: {
					name: f.name,
					mimeType: f.mimeType,
					thumbnailLink: f.thumbnailLink,
				},
			}));
			return [...p, f.id];
		});
	};

	const selectAllInFolder = () => {
		const ids = driveFiles.map((f) => f.id);
		const allSelected = ids.every((id) => selectedDriveIds.includes(id));
		if (allSelected) {
			setSelectedDriveIds((p) => p.filter((id) => !ids.includes(id)));
		} else {
			// Add metadata for new selections
			const newMetadata: Record<string, FileMetadata> = {};
			driveFiles.forEach((f) => {
				newMetadata[f.id] = {
					name: f.name,
					mimeType: f.mimeType,
					thumbnailLink: f.thumbnailLink,
				};
			});
			setFileMetadataMap((prev) => ({ ...prev, ...newMetadata }));
			setSelectedDriveIds((p) => [...new Set([...p, ...ids])]);
		}
	};

	// ─── Local files ─────────────────────────────────────────────────────────
	const addFiles = useCallback((files: File[]) => {
		setSelectedFiles((prev) => [
			...prev,
			...files.map((f) => ({
				file: f,
				name: f.name,
				mimeType: f.type,
				preview: f.type.startsWith("image/")
					? URL.createObjectURL(f)
					: undefined,
			})),
		]);
		setResults([]);
		setIsRestored(false);
	}, []);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files) {
			addFiles(Array.from(e.target.files));
			e.target.value = "";
		}
	};

	const openLocalFileInNewTab = (f: SelectedFile) => {
		const fromPreview = !!f.preview;
		const url = f.preview || URL.createObjectURL(f.file);
		window.open(url, "_blank", "noopener,noreferrer");
		if (!fromPreview) setTimeout(() => URL.revokeObjectURL(url), 60_000);
	};

	const openDriveFileInNewTab = (fileId: string) => {
		window.open(
			`https://drive.google.com/file/d/${fileId}/view`,
			"_blank",
			"noopener,noreferrer",
		);
	};

	// ─── Create working folder inside CONTAINER ───────────────────────────────
	const createWorkingFolder = async (): Promise<{
		folderId: string;
		resolvedFileIds: string[];
		resolvedFileNames: string[];
	} | null> => {
		if (!driveUrl) return null;
		setCreatingFolder(true);
		const tempName = `_BULK_AI_${Date.now()}`;
		try {
			// Step 1: get or create "CONTAINER" parent folder
			const parent = await getOrCreateContainerFolder();
			const parentFolderUrl = parent ? parent.folderUrl : driveUrl;

			// Step 2: create temp folder inside CONTAINER
			const createRes = await fetch(
				"/api/google-drive/create-folder-and-move",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						parentFolderUrl,
						folderName: tempName,
						fileIds: activeTab === "drive" ? selectedDriveIds : [],
					}),
				},
			);
			const createData = await createRes.json();
			if (!createRes.ok)
				throw new Error(createData.message || "Không thể tạo thư mục tạm");

			const newFolderId: string = createData.newFolderId;
			let resolvedFileIds = activeTab === "drive" ? selectedDriveIds : [];
			let resolvedFileNames: string[] =
				activeTab === "drive"
					? driveFiles
							.filter((f) => selectedDriveIds.includes(f.id))
							.map((f) => f.name)
					: [];

			// Upload local files
			if (activeTab === "local" && selectedFiles.length > 0) {
				try {
					const formData = new FormData();
					formData.append("folderId", newFolderId);
					selectedFiles.forEach((f) =>
						formData.append("files", f.file, f.name),
					);
					const uploadRes = await fetch("/api/google-drive/upload-to-folder", {
						method: "POST",
						body: formData,
					});
					if (uploadRes.ok) {
						const uploadData = await uploadRes.json();
						resolvedFileIds = uploadData.fileIds || [];
						resolvedFileNames =
							uploadData.fileNames || selectedFiles.map((f) => f.name);
					}
				} catch (e: any) {
					console.warn("Upload to folder failed:", e.message);
				}
			}

			setWorkingFolderId(newFolderId);
			setActiveTab("drive");
			setBreadcrumb([{ id: newFolderId, name: tempName }]);
			loadFolder(newFolderId, true);

			return { folderId: newFolderId, resolvedFileIds, resolvedFileNames };
		} catch (err: any) {
			toast.error(`Lỗi tạo thư mục tạm: ${err.message}`);
			return null;
		} finally {
			setCreatingFolder(false);
		}
	};

	// ─── Analyze ─────────────────────────────────────────────────────────────
	const hasSelection =
		activeTab === "local"
			? selectedFiles.length > 0
			: selectedDriveIds.length > 0;

	const handleAnalyze = async () => {
		if (!hasSelection) {
			toast.error("Vui lòng chọn ít nhất 1 file");
			return;
		}
		setAnalyzing(true);
		setResults([]);
		setIsRestored(false);
		setBillMismatch(null);

		try {
			let body: any;
			let wfId = workingFolderId;

			// Create working folder first (if Drive available and none exists yet)
			if (driveUrl && !wfId) {
				const prep = await createWorkingFolder();
				if (prep && prep.resolvedFileIds.length > 0) {
					wfId = prep.folderId;
					body = {
						fileIds: prep.resolvedFileIds,
						jobNumber: jobNumber || undefined,
						sessionId,
						workingFolderId: wfId,
						billOrBooking: billOrBooking || undefined,
						operationType: operationType || undefined,
						portName: portName || undefined,
						rows: rows.map((r) => ({
							id: r.id,
							containerNo: r.containerNo,
							containerSize: r.containerSize,
						})),
					};
				}
			}

			if (!body) {
				if (activeTab === "drive") {
					body = {
						fileIds: selectedDriveIds,
						jobNumber: jobNumber || undefined,
						sessionId,
						workingFolderId: wfId || undefined,
						billOrBooking: billOrBooking || undefined,
						operationType: operationType || undefined,
						portName: portName || undefined,
						rows: rows.map((r) => ({
							id: r.id,
							containerNo: r.containerNo,
							containerSize: r.containerSize,
						})),
					};
				} else {
					const imagesData = await Promise.all(
						selectedFiles.map(
							(f) =>
								new Promise<{ data: string; mimeType: string; name: string }>(
									(resolve, reject) => {
										const reader = new FileReader();
										reader.onload = () => {
											const r = reader.result as string;
											resolve({
												data: r.split(",")[1],
												mimeType: f.mimeType,
												name: f.name,
											});
										};
										reader.onerror = reject;
										reader.readAsDataURL(f.file);
									},
								),
						),
					);
					body = {
						images: imagesData,
						jobNumber: jobNumber || undefined,
						sessionId,
						workingFolderId: wfId || undefined,
						billOrBooking: billOrBooking || undefined,
						operationType: operationType || undefined,
						portName: portName || undefined,
						rows: rows.map((r) => ({
							id: r.id,
							containerNo: r.containerNo,
							containerSize: r.containerSize,
						})),
					};
				}
			}

			if (modelName) {
				body.model = modelName;
			}

			const res = await fetch(
				"/api/trucking-followup/container/ai-autofill-bulk",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				},
			);
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || "Lỗi phân tích");

			// Capture bill/booking mismatch warning
			if (data.billMismatch) setBillMismatch(data.billMismatch);
			else setBillMismatch(null);
			if (data.model) setModelName(data.model);

			const editedResults: EditedResult[] = (data.results || []).map(
				(r: BulkResult) => ({
					...r,
					fileRoles: r.fileRoles || [],
					applied: !!(r.containerNo || r.sealNo || r.tareWeight || r.masGross),
				}),
			);
			setResults(editedResults);
			// Track which fileIds were used for analysis (protects against selectedDriveIds changing)
			const usedFileIds = (body as any).fileIds || [];
			setAnalysisFileIds(usedFileIds);
			const found = editedResults.filter((r) => r.containerNo).length;
			toast.success(`AI tìm thấy ${found}/${rows.length} container!`);
		} catch (error: any) {
			toast.error(`Lỗi: ${error.message || "Không thể phân tích"}`);
		} finally {
			setAnalyzing(false);
		}
	};

	// ─── Result editing ───────────────────────────────────────────────────────
	const updateResult = (rowId: string, field: keyof BulkResult, value: any) =>
		setResults((prev) =>
			prev.map((r) => (r.rowId === rowId ? { ...r, [field]: value } : r)),
		);

	const toggleApply = (rowId: string) =>
		setResults((prev) =>
			prev.map((r) => (r.rowId === rowId ? { ...r, applied: !r.applied } : r)),
		);

	// ─── Confirm ─────────────────────────────────────────────────────────────
	const handleConfirm = async () => {
		const toApply = results.filter((r) => r.applied);
		if (toApply.length === 0) {
			toast.warning("Không có dòng nào được chọn");
			return;
		}
		setSaving(true);

		// Helper: rename files by role for a container
		const renameFilesByRole = async (
			fileIds: string[],
			roles: Array<{ fileIndex: number; role: string }>,
			containerNo: string | null,
			sealNo: string | null,
		) => {
			const cCounts: Record<string, number> = {};
			const sCounts: Record<string, number> = {};
			let renamed = 0;
			await Promise.all(
				roles.map(async ({ fileIndex, role }) => {
					const fileId = fileIds[fileIndex];
					if (!fileId || role === "other") return;
					try {
						let baseName: string;
						if (role === "container" && containerNo) {
							cCounts[containerNo] = (cCounts[containerNo] || 0) + 1;
							baseName =
								cCounts[containerNo] > 1
									? `${containerNo}_0${cCounts[containerNo]}`
									: containerNo;
						} else if (role === "seal" && sealNo) {
							sCounts[sealNo] = (sCounts[sealNo] || 0) + 1;
							baseName =
								sCounts[sealNo] > 1 ? `${sealNo}_0${sCounts[sealNo]}` : sealNo;
						} else return;
						const res = await fetch("/api/google-drive/rename-file", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ fileId, newName: baseName }),
						});
						if (res.ok) renamed++;
					} catch (e: any) {
						console.warn("Rename file:", e.message);
					}
				}),
			);
			return renamed;
		};

		try {
			const parent = driveUrl ? await getOrCreateContainerFolder() : null;
			const parentFolderUrl = parent ? parent.folderUrl : driveUrl;

			const enriched = await Promise.all(
				toApply.map(async (r) => {
					let newFolderUrl: string | null = null;

					// Step 1: rename files by role
					if (r.fileRoles?.length > 0 && r.matchedFileIds?.length > 0) {
						const renamed = await renameFilesByRole(
							r.matchedFileIds,
							r.fileRoles,
							r.containerNo,
							r.sealNo,
						);
						if (renamed > 0)
							toast.success(
								`[${r.containerNo || "?"}] Đổi tên ${renamed} file`,
							);
					}

					// Step 2: create named folder for this container
					if (parentFolderUrl && r.containerNo) {
						try {
							const nameRes = await fetch(
								"/api/google-drive/create-folder-and-move",
								{
									method: "POST",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({
										parentFolderUrl,
										folderName: r.containerNo,
										fileIds: r.matchedFileIds || [],
									}),
								},
							);
							const nd = await nameRes.json();
							if (nameRes.ok) newFolderUrl = nd.newFolderUrl;
						} catch {}
					}
					return {
						rowId: r.rowId,
						containerNo: r.containerNo,
						sealNo: r.sealNo,
						tareWeight: r.tareWeight,
						masGross: r.masGross,
						containerType: r.containerType ?? null,
						kc: r.kc ?? null,
						mappedContainerSize: r.mappedContainerSize ?? null,
						newFolderUrl,
					};
				}),
			);

			await onConfirm(enriched);
			onOpenChange(false);
		} catch (err: any) {
			toast.error(`Lỗi lưu: ${err.message}`);
		} finally {
			setSaving(false);
		}
	};

	const handleClose = () => {
		selectedFiles.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
		onOpenChange(false);
	};

	const isBusy = analyzing || saving || creatingFolder;
	const hasResults = results.length > 0;
	const appliedCount = results.filter((r) => r.applied).length;

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-[1000px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-base">
						<Sparkles className="h-4 w-4 text-red-500" />
						AI Autofill Toàn Bộ Container
						{availableModels.length > 1 ? (
							<Select
								value={modelName ? [modelName] : []}
								onValueChange={(val: any) =>
									setModelName(Array.isArray(val) ? val[0] : val)
								}
							>
								<SelectTrigger className="h-6 w-fit min-w-[120px] text-[10px] font-semibold border-red-200 bg-red-50 text-red-700 px-2 py-0">
									<SelectValue placeholder="Chọn model..." />
								</SelectTrigger>
								<SelectPositioner>
									<SelectContent>
										{availableModels.map((m) => (
											<SelectItem
												key={m}
												value={m}
												className="text-[10px] font-semibold text-red-700"
											>
												{m}
											</SelectItem>
										))}
									</SelectContent>
								</SelectPositioner>
							</Select>
						) : modelName ? (
							<Badge
								variant="outline"
								className="text-[10px] font-semibold border-red-200 bg-red-50 text-red-700 px-1.5 py-0"
							>
								{modelName}
							</Badge>
						) : null}
						<Badge variant="secondary" className="text-xs ml-1">
							{rows.length} dòng
						</Badge>
					</DialogTitle>
					<DialogDescription className="text-xs">
						Chọn tất cả file có thông tin container — AI phân loại và điền vào
						từng dòng.
						{driveUrl &&
							" File được gom vào CONTAINER → thư mục tạm, sau khi xác nhận tạo thư mục theo số container."}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2">
					{/* Tabs */}
					<div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
						<button
							type="button"
							onClick={() => setActiveTab("local")}
							className={cn(
								"flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-all",
								activeTab === "local"
									? "bg-white dark:bg-slate-700 text-red-600 shadow-sm"
									: "text-slate-500 hover:text-slate-700",
							)}
						>
							<Upload className="h-3.5 w-3.5" />
							Tải file lên
						</button>
						<button
							type="button"
							onClick={() => {
								setActiveTab("drive");
								if (rootFolderId && !driveFiles.length && !fetchingDrive)
									loadFolder(rootFolderId);
							}}
							disabled={!rootFolderId}
							className={cn(
								"flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-all",
								!rootFolderId && "opacity-40 cursor-not-allowed",
								activeTab === "drive"
									? "bg-white dark:bg-slate-700 text-red-600 shadow-sm"
									: "text-slate-500 hover:text-slate-700",
							)}
						>
							<HardDrive className="h-3.5 w-3.5" />
							Từ Drive
						</button>
					</div>

					{/* ── LOCAL ── */}
					{activeTab === "local" && (
						<>
							<div
								onDrop={(e) => {
									e.preventDefault();
									setIsDragging(false);
									e.dataTransfer.files &&
										addFiles(Array.from(e.dataTransfer.files));
								}}
								onDragOver={(e) => {
									e.preventDefault();
									setIsDragging(true);
								}}
								onDragLeave={() => setIsDragging(false)}
								onClick={() => fileInputRef.current?.click()}
								className={cn(
									"border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all",
									isDragging
										? "border-red-400 bg-red-50"
										: "border-slate-300 hover:border-red-300",
								)}
							>
								<input
									ref={fileInputRef}
									type="file"
									accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
									multiple
									className="hidden"
									onChange={handleFileChange}
								/>
								<Upload className="h-7 w-7 mx-auto mb-1.5 text-muted-foreground" />
								<p className="text-sm font-medium">
									Kéo thả hoặc click để chọn file
								</p>
								<p className="text-xs text-muted-foreground">
									Ảnh, PDF, Word, Excel · Chọn nhiều cùng lúc
								</p>
							</div>

							{selectedFiles.length > 0 && (
								<div className="space-y-1.5">
									<div className="flex items-center justify-between">
										<p className="text-xs font-medium text-muted-foreground">
											{selectedFiles.length} file đã chọn
										</p>
										<Button
											variant="ghost"
											size="sm"
											className="h-6 text-xs text-red-500 px-2"
											onClick={() => {
												selectedFiles.forEach(
													(f) => f.preview && URL.revokeObjectURL(f.preview),
												);
												setSelectedFiles([]);
											}}
										>
											Xóa tất cả
										</Button>
									</div>
									<div className="max-h-[150px] overflow-y-auto space-y-1">
										{selectedFiles.map((f, idx) => (
											<div
												key={idx}
												className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 rounded text-xs"
											>
												<FileTypeIcon
													mimeType={f.mimeType}
													className="h-3.5 w-3.5 text-red-400 shrink-0"
												/>
												<span className="flex-1 truncate">{f.name}</span>
												<button
													type="button"
													onClick={() => openLocalFileInNewTab(f)}
													title="Mở tab mới"
												>
													<ExternalLink className="h-3 w-3 text-muted-foreground hover:text-red-600" />
												</button>
												<button
													type="button"
													onClick={() => {
														f.preview && URL.revokeObjectURL(f.preview);
														setSelectedFiles((p) =>
															p.filter((_, i) => i !== idx),
														);
													}}
												>
													<X className="h-3 w-3 text-muted-foreground hover:text-red-500" />
												</button>
											</div>
										))}
									</div>
								</div>
							)}
						</>
					)}

					{/* ── DRIVE ── */}
					{activeTab === "drive" && (
						<div className="space-y-2">
							<div className="flex items-center gap-1 flex-wrap">
								<button
									type="button"
									onClick={() => navigateTo(-1)}
									className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
								>
									<HardDrive className="h-3 w-3" />
									Drive
								</button>
								{breadcrumb.map((crumb, idx) => (
									<span key={crumb.id} className="flex items-center gap-1">
										<ChevronRight className="h-3 w-3 text-muted-foreground" />
										<button
											type="button"
											onClick={() => navigateTo(idx)}
											className={cn(
												"text-xs hover:underline max-w-[140px] truncate",
												idx === breadcrumb.length - 1
													? "text-slate-700 dark:text-slate-300 font-medium"
													: "text-blue-600",
											)}
										>
											{crumb.name}
										</button>
									</span>
								))}
								<div className="ml-auto flex gap-1">
									{breadcrumb.length > 0 && (
										<Button
											variant="ghost"
											size="sm"
											className="h-5 px-1.5 text-xs"
											onClick={() => navigateTo(breadcrumb.length - 2)}
										>
											<ArrowLeft className="h-3 w-3" />
										</Button>
									)}
									<Button
										variant="ghost"
										size="sm"
										className="h-5 px-1.5 text-xs"
										disabled={fetchingDrive}
										onClick={() =>
											currentFolderId && loadFolder(currentFolderId)
										}
									>
										<RefreshCw
											className={cn("h-3 w-3", fetchingDrive && "animate-spin")}
										/>
									</Button>
								</div>
							</div>

							{fetchingDrive ? (
								<div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
									<Loader2 className="h-4 w-4 animate-spin" />
									<span className="text-xs">Đang tải...</span>
								</div>
							) : (
								<div className="border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
									<div className="max-h-[220px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
										{driveFiles.length > 0 && (
											<div
												onClick={selectAllInFolder}
												className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 text-xs font-medium cursor-pointer hover:bg-slate-100"
											>
												<div
													className={cn(
														"h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 transition-colors",
														driveFiles.every((f) =>
															selectedDriveIds.includes(f.id),
														)
															? "bg-red-500 border-red-500"
															: "border-slate-300",
													)}
												>
													{driveFiles.every((f) =>
														selectedDriveIds.includes(f.id),
													) && <Check className="h-2.5 w-2.5 text-white" />}
												</div>
												<span>Chọn tất cả ({driveFiles.length} file)</span>
												{selectedDriveIds.length > 0 && (
													<span className="ml-auto text-red-600 font-semibold">
														{
															selectedDriveIds.filter((id) =>
																driveFiles.some((f) => f.id === id),
															).length
														}{" "}
														đã chọn
													</span>
												)}
											</div>
										)}
										{driveFolders.map((f) => (
											<div
												key={f.id}
												onClick={() => enterFolder(f)}
												className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50 text-xs"
											>
												<Folder className="h-4 w-4 text-amber-400 shrink-0" />
												<span className="flex-1 font-medium truncate">
													{f.name}
												</span>
												<ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
											</div>
										))}
										{driveFiles.map((f) => {
											const sel = selectedDriveIds.includes(f.id);
											return (
												<div
													key={f.id}
													onClick={() => toggleDrive(f)}
													className={cn(
														"flex items-center gap-2.5 px-3 py-2 cursor-pointer text-xs transition-colors",
														sel
															? "bg-red-50 dark:bg-red-950/20"
															: "hover:bg-slate-50 dark:hover:bg-slate-800/50",
													)}
												>
													<div
														className={cn(
															"h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 transition-colors",
															sel
																? "bg-red-500 border-red-500"
																: "border-slate-300",
														)}
													>
														{sel && (
															<Check className="h-2.5 w-2.5 text-white" />
														)}
													</div>
													{f.thumbnailLink ? (
														<img
															src={f.thumbnailLink}
															className="h-6 w-6 object-cover rounded shadow-sm border border-slate-200"
															alt=""
														/>
													) : (
														<FileTypeIcon
															mimeType={f.mimeType}
															className="h-3.5 w-3.5 text-red-400 shrink-0"
														/>
													)}
													<span className="flex-1 truncate font-medium">
														{f.name}
													</span>
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation();
															openDriveFileInNewTab(f.id);
														}}
														title="Mở tab mới"
													>
														<ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-red-600" />
													</button>
												</div>
											);
										})}
										{driveFolders.length === 0 && driveFiles.length === 0 && (
											<div className="flex flex-col items-center py-8 text-muted-foreground gap-2">
												<ImageIcon className="h-7 w-7 opacity-30" />
												<p className="text-xs">Thư mục trống</p>
											</div>
										)}
									</div>
								</div>
							)}
							{selectedDriveIds.length > 0 && (
								<p className="text-xs text-red-600 font-medium">
									Đã chọn {selectedDriveIds.length} file
								</p>
							)}
						</div>
					)}

					{/* Status indicators */}
					{loadingHistory && (
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<Loader2 className="h-3 w-3 animate-spin" />
							Đang tải kết quả lần trước...
						</div>
					)}
					{creatingFolder && (
						<div className="flex items-center gap-2 text-xs text-blue-600">
							<Loader2 className="h-3 w-3 animate-spin" />
							Đang tạo thư mục CONTAINER và thư mục làm việc...
						</div>
					)}

					{/* Container rows summary */}
					<div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
						<p className="text-xs font-semibold text-muted-foreground mb-1.5">
							Các dòng container ({rows.length})
						</p>
						<div className="flex flex-wrap gap-1.5">
							{rows.map((r, i) => (
								<Badge key={r.id} variant="outline" className="text-xs gap-1">
									<span className="font-semibold">#{i + 1}</span>
									{r.containerSize && (
										<span className="text-blue-600">{r.containerSize}</span>
									)}
									{r.containerNo ? (
										<span className="font-mono text-green-700">
											{r.containerNo}
										</span>
									) : (
										<span className="text-muted-foreground italic">trống</span>
									)}
								</Badge>
							))}
						</div>
					</div>

					{/* Ordering tip */}
					<div className="flex items-start gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-xs text-blue-700 dark:text-blue-400">
						<span className="text-base leading-none mt-0.5">💡</span>
						<span>
							<strong>Mẹo:</strong> Ảnh chụp bên hông container (không có số) sẽ
							được AI ghép theo thứ tự xuất hiện. Để chính xác hơn, hãy{" "}
							<strong>chọn file theo nhóm</strong>: tất cả ảnh của cont 1 trước,
							rồi cont 2,... Ảnh chụp số container hoặc số seal sẽ được tự động
							nhận diện.
						</span>
					</div>

					{/* Analyze button */}
					<Button
						onClick={handleAnalyze}
						disabled={!hasSelection || isBusy}
						className="w-full bg-red-500 hover:bg-red-600 text-white gap-2"
						size="sm"
					>
						{analyzing ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" />
								AI đang phân tích...
							</>
						) : creatingFolder ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" />
								Đang chuẩn bị thư mục...
							</>
						) : (
							<>
								<Sparkles className="h-4 w-4" />
								{hasResults ? "Phân tích lại" : "Phân tích với AI"}
							</>
						)}
					</Button>

					{/* Bill/Booking mismatch warning */}
					{billMismatch && (
						<div className="flex items-start gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-700 rounded-lg text-xs text-red-700 dark:text-red-400">
							<AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
							<div>
								<p className="font-semibold">
									Cảnh báo: Bill/Booking không khớp!
								</p>
								<p>
									Phát hiện:{" "}
									<span className="font-mono font-bold">
										{billMismatch.detected}
									</span>
								</p>
								<p className="text-red-600/80 dark:text-red-400/70">
									{billMismatch.reason}
								</p>
							</div>
						</div>
					)}

					{/* Results */}
					{hasResults && (
						<div className="border border-red-200 dark:border-red-800 rounded-lg overflow-hidden">
							<div className="bg-red-50 dark:bg-red-950/30 px-3 py-2 flex items-center justify-between">
								<div className="flex items-center gap-2">
									<CheckCircle2 className="h-4 w-4 text-red-500" />
									<p className="text-sm font-semibold text-red-700 dark:text-red-400">
										{isRestored ? "Kết quả lần trước" : "Kết quả AI"} —{" "}
										{appliedCount}/{results.length} dòng được chọn
									</p>
								</div>
								<Button
									variant="ghost"
									size="sm"
									className="h-6 text-xs text-red-600 px-2"
									onClick={() =>
										setResults((p) =>
											p.map((r) => ({
												...r,
												applied: !!(r.containerNo || r.sealNo),
											})),
										)
									}
								>
									<CheckCheck className="h-3 w-3 mr-1" />
									Auto-select
								</Button>
							</div>

							{/* Port used for KC lookup */}
							{(operationType || portCode) && (
								<div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-xs">
									<span className="text-muted-foreground shrink-0">
										Port tra KC:
									</span>
									{portName ? (
										<span className="font-semibold text-blue-700 dark:text-blue-400">
											{portName}
											{portCode && portCode !== portName && (
												<span className="font-normal text-muted-foreground ml-1">
													({portCode})
												</span>
											)}
										</span>
									) : (
										<span className="text-muted-foreground italic">
											— chưa có
										</span>
									)}
									{operationType && (
										<span
											className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded ${
												operationType === "XUAT"
													? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
													: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
											}`}
										>
											{operationType === "XUAT" ? "📦 XUẤT" : "📥 NHẬP"}
										</span>
									)}
								</div>
							)}

							{isRestored && restoredAt && (
								<div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 text-xs text-amber-700">
									<span>🕐</span>
									<span>
										Khôi phục từ{" "}
										<strong>
											{new Date(restoredAt).toLocaleString("vi-VN", {
												day: "2-digit",
												month: "2-digit",
												hour: "2-digit",
												minute: "2-digit",
											})}
										</strong>
										. Bấm <strong>Phân tích lại</strong> để cập nhật.
									</span>
								</div>
							)}

							<div className="divide-y divide-red-100 dark:divide-red-900">
								{results.map((r, idx) => {
									const row = rows.find((rw) => rw.id === r.rowId);
									const hasData =
										r.containerNo || r.sealNo || r.tareWeight || r.masGross;
									return (
										<div
											key={r.rowId}
											className={cn(
												"p-3 space-y-2",
												r.applied
													? "bg-white dark:bg-slate-900"
													: "bg-slate-50/50 dark:bg-slate-800/30 opacity-60",
											)}
										>
											<div className="flex items-center gap-2">
												<div
													onClick={() => toggleApply(r.rowId)}
													className={cn(
														"h-4 w-4 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors",
														r.applied
															? "bg-red-500 border-red-500"
															: "border-slate-300 dark:border-slate-600",
													)}
												>
													{r.applied && (
														<Check className="h-3 w-3 text-white" />
													)}
												</div>
												<span className="text-xs font-semibold">
													#{idx + 1}
												</span>
												{row?.containerSize && (
													<Badge
														variant="secondary"
														className="text-[10px] h-4 px-1"
													>
														{row.containerSize}
													</Badge>
												)}
												{!hasData && (
													<span className="flex items-center gap-1 text-xs text-amber-600 ml-auto">
														<AlertCircle className="h-3 w-3" />
														Không tìm thấy
													</span>
												)}
												{r.matchedFileNames.length > 0 && (
													<span className="text-[10px] text-muted-foreground ml-auto truncate max-w-[180px]">
														← {r.matchedFileNames.slice(0, 2).join(", ")}
													</span>
												)}
											</div>

											{/* Display Container & Seal Images — cropped to number region */}
											{(r.applied || hasData) &&
												r.fileRoles &&
												r.fileRoles.length > 0 && (
													<div className="flex gap-2 pl-6 pb-1">
														{r.fileRoles
															.filter(
																(fr) =>
																	fr.role === "container" || fr.role === "seal",
															)
															.map((fr, idx) => {
																let previewUrl: string | null = null;
																let fullUrl: string | null = null;
																let driveFileId: string | null = null;
																let name = "";
																if (activeTab === "local") {
																	const sf = selectedFiles[fr.fileIndex];
																	previewUrl = sf?.preview || null;
																	fullUrl = previewUrl;
																	name = sf?.name || "";
																} else {
																	const fid =
																		analysisFileIds[fr.fileIndex] ||
																		selectedDriveIds[fr.fileIndex];
																	driveFileId = fid || null;
																	const meta = fileMetadataMap[fid];
																	const driveFile = driveFiles.find(
																		(df) => df.id === fid,
																	);
																	name = meta?.name || driveFile?.name || "";
																	// Use proxy endpoint for reliable thumbnail loading
																	if (fid) {
																		previewUrl = `/api/google-drive/thumbnail?fileId=${fid}`;
																		fullUrl = `https://drive.google.com/file/d/${fid}/view`;
																	}
																}

																if (!previewUrl && activeTab === "local")
																	return null;

																const crop = fr.cropRegion;
																const hasCrop =
																	crop &&
																	crop.top >= 0 &&
																	crop.left >= 0 &&
																	crop.bottom > crop.top &&
																	crop.right > crop.left;

																// Click handler: open in Drive viewer for drive files, or preview for local
																const handleImageClick = () => {
																	if (activeTab !== "local" && driveFileId) {
																		window.open(
																			`https://drive.google.com/file/d/${driveFileId}/view`,
																			"_blank",
																			"noopener,noreferrer",
																		);
																	} else if (fullUrl || previewUrl) {
																		window.open(
																			fullUrl || previewUrl!,
																			"_blank",
																		);
																	}
																};

																return (
																	<div key={idx} className="relative group">
																		<div className="text-[9px] font-semibold text-muted-foreground uppercase mb-0.5 ml-0.5">
																			{fr.role === "container"
																				? "📷 Cont"
																				: "🔏 Seal"}
																			{hasCrop && (
																				<span className="ml-1 text-[8px] text-violet-400 font-normal normal-case">
																					(zoom)
																				</span>
																			)}
																		</div>
																		<div
																			className="relative h-32 w-80 border border-slate-200 dark:border-slate-700 rounded overflow-hidden bg-slate-100 dark:bg-slate-800 shadow-sm cursor-zoom-in group-hover:border-red-400 transition-colors"
																			onClick={handleImageClick}
																		>
																			{previewUrl ? (
																				<img
																					src={previewUrl}
																					referrerPolicy="no-referrer"
																					className="h-full w-full transition-transform group-hover:scale-110"
																					style={
																						hasCrop
																							? ({
																									objectFit: "contain",
																									// object-view-box crops the source image to the exact region
																									// Add extra padding (8%) to ensure no text is clipped
																									objectViewBox: `inset(${Math.max(0, crop.top * 100 - 8)}% ${Math.max(0, (1 - crop.right) * 100 - 8)}% ${Math.max(0, (1 - crop.bottom) * 100 - 8)}% ${Math.max(0, crop.left * 100 - 8)}%)`,
																									transform: crop.rotation
																										? `rotate(${-crop.rotation}deg)`
																										: undefined,
																								} as React.CSSProperties)
																							: { objectFit: "cover" as const }
																					}
																					alt={name}
																				/>
																			) : (
																				<div className="h-full w-full flex items-center justify-center">
																					<ImageIcon className="h-6 w-6 text-slate-300" />
																				</div>
																			)}
																			<div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
																				<ExternalLink className="h-5 w-5 text-white drop-shadow-md" />
																			</div>
																		</div>
																		{name && (
																			<div className="text-[8px] text-muted-foreground mt-0.5 truncate max-w-[192px]">
																				{name}
																			</div>
																		)}
																	</div>
																);
															})}
													</div>
												)}
											{hasData && (
												<div className="grid grid-cols-2 gap-2 pl-6">
													<div>
														<p className="text-[10px] text-muted-foreground mb-0.5">
															Container No
														</p>
														<input
															value={r.containerNo || ""}
															onChange={(e) =>
																updateResult(
																	r.rowId,
																	"containerNo",
																	e.target.value.toUpperCase() || null,
																)
															}
															placeholder="MSCU1234567"
															className="w-full h-6 text-xs font-mono px-1.5 border rounded bg-background"
														/>
													</div>
													<div>
														<p className="text-[10px] text-muted-foreground mb-0.5">
															Seal No
														</p>
														<input
															value={r.sealNo || ""}
															onChange={(e) =>
																updateResult(
																	r.rowId,
																	"sealNo",
																	e.target.value || null,
																)
															}
															placeholder="VN123456"
															className="w-full h-6 text-xs font-mono px-1.5 border rounded bg-background"
														/>
													</div>
													<div>
														<p className="text-[10px] text-muted-foreground mb-0.5">
															Tare (kg)
														</p>
														<input
															type="number"
															value={r.tareWeight ?? ""}
															onChange={(e) =>
																updateResult(
																	r.rowId,
																	"tareWeight",
																	e.target.value
																		? Number(e.target.value)
																		: null,
																)
															}
															placeholder="2200"
															className="w-full h-6 text-xs tabular-nums px-1.5 border rounded bg-background"
														/>
													</div>
													<div>
														<p className="text-[10px] text-muted-foreground mb-0.5">
															Max Weight (kg)
														</p>
														<input
															type="number"
															value={r.masGross ?? ""}
															onChange={(e) =>
																updateResult(
																	r.rowId,
																	"masGross",
																	e.target.value
																		? Number(e.target.value)
																		: null,
																)
															}
															placeholder="30480"
															className="w-full h-6 text-xs tabular-nums px-1.5 border rounded bg-background"
														/>
													</div>
													<div className="col-span-2 grid grid-cols-3 gap-2">
														<div>
															<p className="text-[10px] text-muted-foreground mb-0.5">
																Loại Cont (ISO 6346)
															</p>
															<input
																value={r.containerType || ""}
																onChange={(e) =>
																	updateResult(
																		r.rowId,
																		"containerType",
																		e.target.value.toUpperCase() || null,
																	)
																}
																placeholder="Ví dụ: 45G1, 22R1, 42G0..."
																maxLength={4}
																className="w-full h-6 text-xs font-mono px-1.5 border rounded bg-background"
															/>
														</div>
														<div>
															<p className="text-[10px] text-muted-foreground mb-0.5">
																Kích Cỡ (KC)
															</p>
															<input
																value={r.kc || ""}
																onChange={(e) =>
																	updateResult(
																		r.rowId,
																		"kc",
																		e.target.value || null,
																	)
																}
																placeholder="Nhập kích cỡ..."
																className="w-full h-6 text-xs font-mono px-1.5 border rounded bg-background"
															/>
														</div>
														<div>
															<p className="text-[10px] text-muted-foreground mb-0.5">
																Container Size
															</p>
															<VirtualizedCombobox
																items={sizeOptions}
																value={r.mappedContainerSize || ""}
																onChange={(val: string) =>
																	updateResult(
																		r.rowId,
																		"mappedContainerSize",
																		val || null,
																	)
																}
																placeholder="Chọn size..."
																searchPlaceholder="Tìm size..."
																showClearOption={true}
																triggerClassName="flex h-6 w-full items-center justify-between rounded px-1.5 py-0 text-[11px] font-mono border bg-background"
															/>
														</div>
													</div>
												</div>
											)}
											{/* Container Size mismatch alert */}
											{r.applied &&
												r.mappedContainerSize &&
												row?.containerSize &&
												r.mappedContainerSize !== row.containerSize && (
													<div className="flex items-center gap-2 pl-6 pr-2 py-1 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-700 rounded text-[10px] text-amber-800 dark:text-amber-400">
														<span className="shrink-0">⚠️</span>
														<span>
															Container Size:{" "}
															<span className="font-mono line-through opacity-70">
																{row.containerSize}
															</span>
															{" → "}
															<span className="font-mono font-bold text-amber-700 dark:text-amber-300">
																{r.mappedContainerSize}
															</span>
														</span>
													</div>
												)}
										</div>
									);
								})}
							</div>
						</div>
					)}
				</div>

				<DialogFooter className="gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={handleClose}
						disabled={isBusy}
					>
						Hủy
					</Button>
					{hasResults && appliedCount > 0 && (
						<Button
							size="sm"
							onClick={handleConfirm}
							disabled={isBusy}
							className="bg-red-500 hover:bg-red-600 text-white gap-1"
						>
							{saving ? (
								<>
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
									Đang lưu...
								</>
							) : (
								<>
									<CheckCircle2 className="h-3.5 w-3.5" />
									Xác nhận {appliedCount} dòng
								</>
							)}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
