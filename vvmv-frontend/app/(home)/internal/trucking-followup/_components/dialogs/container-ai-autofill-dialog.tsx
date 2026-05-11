"use client";

import {
	AlertCircle,
	ArrowLeft,
	Check,
	CheckCircle2,
	ChevronRight,
	File,
	FileSpreadsheet,
	FileText,
	Folder,
	FolderOpen,
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
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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

// ─── File icon helper ──────────────────────────────────────────────────────────
function FileIcon({
	mimeType,
	className,
}: {
	mimeType: string;
	className?: string;
}) {
	if (mimeType.startsWith("image/")) return <ImageIcon className={className} />;
	if (mimeType === "application/pdf") return <FileText className={className} />;
	if (
		mimeType ===
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
		mimeType === "application/vnd.ms-excel"
	)
		return <FileSpreadsheet className={className} />;
	if (
		mimeType ===
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
		mimeType === "application/msword"
	)
		return <FileText className={className} />;
	return <File className={className} />;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ExtractedContainerInfo {
	containerNo: string | null;
	sealNo: string | null;
	tareWeight: number | null;
	masGross: number | null;
	containerType: string | null;
}

interface SelectedImage {
	file: File;
	preview: string;
	name: string;
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

interface ContainerAiAutofillDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	containerId: string;
	currentContainerNo?: string | null;
	currentContainerSize?: string | null;
	jobNumber?: string | null;
	driveUrl?: string | null;
	billOrBooking?: string | null;
	operationType?: string | null;
	fromLocation?: string | null;
	toLocation?: string | null;
	onConfirm: (data: {
		containerNo: string | null;
		sealNo: string | null;
		tareWeight: number | null;
		masGross: number | null;
		containerType: string | null;
		kc?: string | null;
		containerSize?: string | null;
		newFolderUrl?: string | null;
	}) => Promise<void>;
}

type SourceTab = "local" | "drive";

// ─── Component ─────────────────────────────────────────────────────────────────

export function ContainerAiAutofillDialog({
	open,
	onOpenChange,
	containerId,
	currentContainerNo,
	currentContainerSize,
	jobNumber,
	driveUrl,
	billOrBooking,
	operationType,
	fromLocation,
	toLocation,
	onConfirm,
}: ContainerAiAutofillDialogProps) {
	// Tab
	const [activeTab, setActiveTab] = useState<SourceTab>("local");

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

	// Session
	const [sessionId, setSessionId] = useState<string>("");

	// Local upload
	const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
	const [isDragging, setIsDragging] = useState(false);

	// Drive navigation
	const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([]);
	const [driveFolders, setDriveFolders] = useState<DriveItem[]>([]);
	const [driveImageFiles, setDriveImageFiles] = useState<DriveItem[]>([]);
	const [fetchingFiles, setFetchingFiles] = useState(false);
	const [selectedDriveFileIds, setSelectedDriveFileIds] = useState<string[]>(
		[],
	);

	// Working folder (temp folder created before analysis)
	const [workingFolderId, setWorkingFolderId] = useState<string | null>(null);
	const [containerParentFolderId, setContainerParentFolderId] = useState<
		string | null
	>(null);
	const [creatingFolder, setCreatingFolder] = useState(false);

	// Analysis result
	const [analyzing, setAnalyzing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [extracted, setExtracted] = useState<ExtractedContainerInfo | null>(
		null,
	);
	const [billMismatch, setBillMismatch] = useState<{
		detected: string;
		reason: string;
	} | null>(null);
	const [isRestoredFromHistory, setIsRestoredFromHistory] = useState(false);
	const [restoredAt, setRestoredAt] = useState<string | null>(null);
	const [loadingHistory, setLoadingHistory] = useState(false);

	const availableModels = useMemo(() => {
		return (process.env.NEXT_PUBLIC_GEMINI_AUTOFILL_CONTAINER_MODEL || "")
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
	}, []);

	const [modelName, setModelName] = useState<string | null>(
		availableModels[0] || null,
	);

	// Editable result fields
	const [editContainerNo, setEditContainerNo] = useState("");
	const [editSealNo, setEditSealNo] = useState("");
	const [editTareWeight, setEditTareWeight] = useState("");
	const [editMasGross, setEditMasGross] = useState("");
	const [editContainerType, setEditContainerType] = useState("");
	const [editKc, setEditKc] = useState<string | null>(null);
	const [editContainerSize, setEditContainerSize] = useState<string | null>(
		null,
	);
	// fileRoles from AI: which file is container / seal / other
	const [fileRoles, setFileRoles] = useState<
		Array<{
			fileIndex: number;
			role: "container" | "seal" | "other";
			cropRegion?: { top: number; left: number; bottom: number; right: number };
		}>
	>([]);
	// fileIds at the time of analysis (Drive or uploaded)
	const [analysisFileIds, setAnalysisFileIds] = useState<string[]>([]);
	const [fileMetadataMap, setFileMetadataMap] = useState<
		Record<string, FileMetadata>
	>({});

	const fileInputRef = useRef<HTMLInputElement>(null);

	// Derived: root folder from driveUrl
	const rootFolderId = driveUrl
		? (driveUrl.match(/folders\/([a-zA-Z0-9_-]+)/)?.[1] ?? null)
		: null;

	const currentFolderId =
		breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].id : rootFolderId;

	// ─── Load folder ──────────────────────────────────────────────────────────
	const loadFolder = useCallback(
		async (folderId: string, keepSelection = false) => {
			setFetchingFiles(true);
			if (!keepSelection) {
				setSelectedDriveFileIds([]);
				setExtracted(null);
			}
			try {
				const res = await fetch(
					`/api/google-drive/files?folderId=${folderId}&includeFolders=true`,
				);
				const data = await res.json();
				if (!res.ok) throw new Error(data.message || "Không thể tải Drive");
				setDriveFolders(data.folders || []);
				// Show ALL file types (images, PDF, Word, Excel, ...)
				setDriveImageFiles(data.files || []);
			} catch (err: any) {
				toast.error(`Lỗi tải Drive: ${err.message}`);
			} finally {
				setFetchingFiles(false);
			}
		},
		[],
	);

	// ─── Restore history when dialog opens ───────────────────────────────────
	useEffect(() => {
		if (!open) return;

		setSessionId(crypto.randomUUID());
		setWorkingFolderId(null);

		setLoadingHistory(true);
		const params = new URLSearchParams();
		params.set("containerId", containerId);
		if (jobNumber) params.set("jobNumber", jobNumber);
		fetch(`/api/trucking-followup/container/ai-autofill?${params.toString()}`)
			.then((r) => r.json())
			.then((data) => {
				if (!data.history) return;
				const h = data.history;

				// Restore result fields
				setExtracted({
					containerNo: h.containerNo,
					sealNo: h.sealNo,
					tareWeight: h.tareWeight,
					masGross: h.masGross,
					containerType: h.containerType ?? null,
				});
				setEditContainerNo(h.containerNo || "");
				setEditSealNo(h.sealNo || "");
				setEditTareWeight(h.tareWeight != null ? String(h.tareWeight) : "");
				setEditMasGross(h.masGross != null ? String(h.masGross) : "");
				setEditContainerType(h.containerType || "");
				setEditKc(h.kc ?? null);
				// Restore AI roles and file IDs
				setFileRoles(h.fileRoles || []);
				setAnalysisFileIds(h.fileIds || []);

				// Dynamically re-compute bill mismatch with CURRENT billOrBooking
				// This handles: (1) user fixed the booking → warning clears
				//               (2) user changed booking to wrong value → warning appears
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
									reason: `Số bill/booking phát hiện trong ảnh (${detected}) không khớp với giá trị hiện tại (${billOrBooking}).`,
								},
					);
				} else {
					setBillMismatch(null);
				}

				setIsRestoredFromHistory(true);
				setRestoredAt(h.createdAt || null);

				// Restore working folder & file selection
				const wfId = h.workingFolderId as string | null;
				if (wfId && rootFolderId) {
					setWorkingFolderId(wfId);
					setActiveTab("drive");
					setSelectedDriveFileIds(h.fileIds || []);
					// Navigate directly into the working folder
					setBreadcrumb([{ id: wfId, name: "📂 Thư mục làm việc" }]);
					loadFolder(wfId, true);
				} else if (h.fileIds?.length > 0 && rootFolderId) {
					// Older history with Drive fileIds but no working folder
					setActiveTab("drive");
					setSelectedDriveFileIds(h.fileIds);
					loadFolder(rootFolderId, true);
				}
			})
			.catch(() => {})
			.finally(() => setLoadingHistory(false));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, billOrBooking, containerId, jobNumber, loadFolder, rootFolderId]);

	// ─── Navigation ──────────────────────────────────────────────────────────
	const enterFolder = (folder: DriveItem) => {
		setBreadcrumb((prev) => [...prev, { id: folder.id, name: folder.name }]);
		loadFolder(folder.id);
	};

	const navigateTo = (index: number) => {
		if (index === -1) {
			setBreadcrumb([]);
			if (rootFolderId) loadFolder(rootFolderId);
		} else {
			const newCrumb = breadcrumb.slice(0, index + 1);
			setBreadcrumb(newCrumb);
			loadFolder(newCrumb[newCrumb.length - 1].id);
		}
	};

	// Sync metadata for selected drive files
	useEffect(() => {
		if (driveImageFiles.length > 0) {
			const newMetadata: Record<string, FileMetadata> = {};
			let changed = false;
			driveImageFiles.forEach((f) => {
				if (selectedDriveFileIds.includes(f.id)) {
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
	}, [driveImageFiles, selectedDriveFileIds, fileMetadataMap]);

	// ─── Close ───────────────────────────────────────────────────────────────
	const handleClose = () => {
		selectedImages.forEach((img) => URL.revokeObjectURL(img.preview));
		setSelectedImages([]);
		setSelectedDriveFileIds([]);
		setExtracted(null);
		setEditContainerNo("");
		setEditSealNo("");
		setEditTareWeight("");
		setEditMasGross("");
		setEditContainerType("");
		setEditKc(null);
		setEditContainerSize(null);
		setBreadcrumb([]);
		setDriveFolders([]);
		setDriveImageFiles([]);
		setSessionId("");
		setIsRestoredFromHistory(false);
		setRestoredAt(null);
		setWorkingFolderId(null);
		onOpenChange(false);
	};

	// ─── Local upload ─────────────────────────────────────────────────────────
	const addImages = useCallback((files: File[]) => {
		const imageFiles = files.filter((f) => f.type.startsWith("image/"));
		if (imageFiles.length === 0) {
			toast.error("Vui lòng chỉ chọn file ảnh");
			return;
		}
		setSelectedImages((prev) => [
			...prev,
			...imageFiles.map((file) => ({
				file,
				preview: URL.createObjectURL(file),
				name: file.name,
			})),
		]);
		setExtracted(null);
	}, []);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files) {
			addImages(Array.from(e.target.files));
			e.target.value = "";
		}
	};

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragging(false);
			if (e.dataTransfer.files) addImages(Array.from(e.dataTransfer.files));
		},
		[addImages],
	);

	const removeImage = (index: number) => {
		setSelectedImages((prev) => {
			const updated = [...prev];
			URL.revokeObjectURL(updated[index].preview);
			updated.splice(index, 1);
			return updated;
		});
	};

	const toggleDriveFile = (file: DriveItem) => {
		setSelectedDriveFileIds((prev) => {
			const isSelected = prev.includes(file.id);
			if (isSelected) return prev.filter((id) => id !== file.id);

			// Store metadata
			setFileMetadataMap((m) => ({
				...m,
				[file.id]: {
					name: file.name,
					mimeType: file.mimeType,
					thumbnailLink: file.thumbnailLink,
				},
			}));
			return [...prev, file.id];
		});
	};

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

	// ─── Create temp working folder & move/upload files into it ──────────────
	const prepareWorkingFolder = async (): Promise<{
		folderId: string;
		fileIds: string[];
		fileNames: string[];
	} | null> => {
		if (!rootFolderId) return null;

		const tempName = `_AI_${Date.now()}`;
		setCreatingFolder(true);

		try {
			// Step 1: get or create CONTAINER parent folder
			const parent = await getOrCreateContainerFolder();
			const parentFolderUrl = parent ? parent.folderUrl : driveUrl!;

			// Step 2: create temp folder inside CONTAINER (or job root if CONTAINER failed)
			const createRes = await fetch(
				"/api/google-drive/create-folder-and-move",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						parentFolderUrl,
						folderName: tempName,
						fileIds: activeTab === "drive" ? selectedDriveFileIds : [],
					}),
				},
			);
			const createData = await createRes.json();
			if (!createRes.ok)
				throw new Error(createData.message || "Không thể tạo thư mục tạm");

			const newFolderId: string = createData.newFolderId;
			let resolvedFileIds = activeTab === "drive" ? selectedDriveFileIds : [];
			let resolvedFileNames: string[] =
				activeTab === "drive"
					? driveImageFiles
							.filter((f) => selectedDriveFileIds.includes(f.id))
							.map((f) => f.name)
					: [];

			// If local: upload files to the new folder
			if (activeTab === "local" && selectedImages.length > 0) {
				try {
					const formData = new FormData();
					formData.append("folderId", newFolderId);
					selectedImages.forEach((img) => {
						formData.append("files", img.file, img.name);
					});

					const uploadRes = await fetch("/api/google-drive/upload-to-folder", {
						method: "POST",
						body: formData,
					});
					if (uploadRes.ok) {
						const uploadData = await uploadRes.json();
						resolvedFileIds = uploadData.fileIds || [];
						resolvedFileNames =
							uploadData.fileNames || selectedImages.map((i) => i.name);
					}
				} catch (uploadErr: any) {
					console.warn(
						"Upload to folder failed, will use base64:",
						uploadErr.message,
					);
				}
			}

			setWorkingFolderId(newFolderId);
			setActiveTab("drive");
			setBreadcrumb([{ id: newFolderId, name: tempName }]);
			loadFolder(newFolderId, true);

			return {
				folderId: newFolderId,
				fileIds: resolvedFileIds,
				fileNames: resolvedFileNames,
			};
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
			? selectedImages.length > 0
			: selectedDriveFileIds.length > 0;

	const applyExtracted = (
		data: ExtractedContainerInfo & {
			fileRoles?: Array<{
				fileIndex: number;
				role: "container" | "seal" | "other";
				cropRegion?: {
					top: number;
					left: number;
					bottom: number;
					right: number;
				};
			}>;
			billMismatch?: { detected: string; reason: string } | null;
		},
		currentFileIds?: string[],
	) => {
		setExtracted(data);
		setEditContainerNo(data.containerNo || "");
		setEditSealNo(data.sealNo || "");
		setEditTareWeight(data.tareWeight != null ? String(data.tareWeight) : "");
		setEditMasGross(data.masGross != null ? String(data.masGross) : "");
		setEditContainerType(data.containerType || "");
		setEditKc((data as any).kc ?? null);
		setEditContainerSize((data as any).mappedContainerSize ?? null);
		setFileRoles(data.fileRoles || []);
		setBillMismatch(data.billMismatch ?? null);
		if (currentFileIds) setAnalysisFileIds(currentFileIds);
	};

	const handleAnalyze = async () => {
		if (!hasSelection) {
			toast.error("Vui lòng chọn ít nhất 1 ảnh để phân tích");
			return;
		}
		setAnalyzing(true);
		setExtracted(null);
		setIsRestoredFromHistory(false);
		setRestoredAt(null);

		try {
			let body: any;
			let wfId = workingFolderId;

			const model = modelName || undefined;

			// Step 1: Create working folder (if Drive URL available)
			if (driveUrl && !wfId) {
				const prep = await prepareWorkingFolder();
				if (prep) {
					wfId = prep.folderId;
					// Use the moved/uploaded file IDs for analysis
					if (prep.fileIds.length > 0) {
						body = {
							fileIds: prep.fileIds,
							jobNumber: jobNumber || undefined,
							sessionId,
							containerId,
							workingFolderId: wfId,
							model,
						};
					} else {
						// Fallback: local base64 if upload wasn't available
						const imagesData = await Promise.all(
							selectedImages.map(
								(img) =>
									new Promise<{ data: string; mimeType: string; name: string }>(
										(resolve, reject) => {
											const reader = new FileReader();
											reader.onload = () => {
												const r = reader.result as string;
												resolve({
													data: r.split(",")[1],
													mimeType: img.file.type,
													name: img.file.name,
												});
											};
											reader.onerror = reject;
											reader.readAsDataURL(img.file);
										},
									),
							),
						);
						body = {
							images: imagesData,
							jobNumber: jobNumber || undefined,
							sessionId,
							containerId,
							workingFolderId: wfId,
							model,
						};
					}
				} else {
					// Folder creation failed, fall back to no-Drive mode
					if (activeTab === "drive") {
						body = {
							fileIds: selectedDriveFileIds,
							jobNumber: jobNumber || undefined,
							sessionId,
							containerId,
							model,
						};
					} else {
						const imagesData = await Promise.all(
							selectedImages.map(
								(img) =>
									new Promise<{ data: string; mimeType: string; name: string }>(
										(resolve, reject) => {
											const reader = new FileReader();
											reader.onload = () => {
												const r = reader.result as string;
												resolve({
													data: r.split(",")[1],
													mimeType: img.file.type,
													name: img.file.name,
												});
											};
											reader.onerror = reject;
											reader.readAsDataURL(img.file);
										},
									),
							),
						);
						body = {
							images: imagesData,
							jobNumber: jobNumber || undefined,
							sessionId,
							containerId,
							model,
						};
					}
				}
			} else if (activeTab === "drive") {
				body = {
					fileIds: selectedDriveFileIds,
					jobNumber: jobNumber || undefined,
					sessionId,
					containerId,
					workingFolderId: wfId || undefined,
					model,
				};
			} else {
				const imagesData = await Promise.all(
					selectedImages.map(
						(img) =>
							new Promise<{ data: string; mimeType: string; name: string }>(
								(resolve, reject) => {
									const reader = new FileReader();
									reader.onload = () => {
										const r = reader.result as string;
										resolve({
											data: r.split(",")[1],
											mimeType: img.file.type,
											name: img.file.name,
										});
									};
									reader.onerror = reject;
									reader.readAsDataURL(img.file);
								},
							),
					),
				);
				body = {
					images: imagesData,
					jobNumber: jobNumber || undefined,
					sessionId,
					containerId,
					workingFolderId: wfId || undefined,
					model,
				};
			}

			// Inject billOrBooking and location info for kc lookup
			if (billOrBooking && body) (body as any).billOrBooking = billOrBooking;
			if (operationType && body) (body as any).operationType = operationType;
			// Send resolved airport name (not raw code) for ContainerSizeConfig port matching
			if (portName && body) (body as any).portName = portName;

			const res = await fetch("/api/trucking-followup/container/ai-autofill", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || "Lỗi phân tích ảnh");
			// Track which fileIds were used for analysis
			const usedFileIds = (body as any).fileIds || [];
			applyExtracted(data, usedFileIds);
			if (data.model) setModelName(data.model);
			toast.success("AI đã trích xuất thông tin thành công!");
		} catch (error: any) {
			toast.error(`Lỗi: ${error.message || "Không thể phân tích ảnh"}`);
		} finally {
			setAnalyzing(false);
		}
	};

	// ─── Rename files in working folder by role ──────────────────────────────────
	const renameFilesByRole = async (
		fileIds: string[],
		roles: typeof fileRoles,
		containerNo: string | null,
		sealNo: string | null,
	): Promise<{ renamed: number; failed: number }> => {
		const containerCounts: Record<string, number> = {};
		const sealCounts: Record<string, number> = {};
		let renamed = 0;
		let failed = 0;
		await Promise.all(
			roles.map(async ({ fileIndex, role }) => {
				const fileId = fileIds[fileIndex];
				if (!fileId || role === "other") return;
				try {
					let baseName: string;
					if (role === "container" && containerNo) {
						containerCounts[containerNo] =
							(containerCounts[containerNo] || 0) + 1;
						baseName =
							containerCounts[containerNo] > 1
								? `${containerNo}_0${containerCounts[containerNo]}`
								: containerNo;
					} else if (role === "seal" && sealNo) {
						sealCounts[sealNo] = (sealCounts[sealNo] || 0) + 1;
						baseName =
							sealCounts[sealNo] > 1
								? `${sealNo}_0${sealCounts[sealNo]}`
								: sealNo;
					} else return;
					const res = await fetch("/api/google-drive/rename-file", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ fileId, newName: baseName }),
					});
					if (res.ok) renamed++;
					else failed++;
				} catch (e: any) {
					console.warn("Rename file failed:", e.message);
					failed++;
				}
			}),
		);
		return { renamed, failed };
	};

	// ─── Confirm ────────────────────────────────────────────────────────────
	const handleConfirm = async () => {
		if (!extracted) return;
		setSaving(true);
		try {
			const containerNoToSave = editContainerNo.trim() || null;
			const sealNoToSave = editSealNo.trim() || null;
			let newFolderUrl: string | null = null;

			// Step 1: rename files by role before renaming/creating folder
			// Use analysisFileIds first; fall back to workingFolder files from Drive selection
			const idsForRename =
				analysisFileIds.length > 0 ? analysisFileIds : selectedDriveFileIds;
			if (fileRoles.length > 0 && idsForRename.length > 0) {
				const { renamed, failed } = await renameFilesByRole(
					idsForRename,
					fileRoles,
					containerNoToSave,
					sealNoToSave,
				);
				if (renamed > 0)
					toast.success(`Đã đổi tên ${renamed} file theo số container/seal`);
				if (failed > 0) toast.warning(`${failed} file không thể đổi tên`);
			}

			if (workingFolderId && containerNoToSave) {
				// Rename temp folder to container no
				try {
					const res = await fetch("/api/google-drive/rename-folder", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							folderId: workingFolderId,
							newName: containerNoToSave,
						}),
					});
					const data = await res.json();
					if (res.ok && data.url) {
						newFolderUrl = data.url;
						toast.success(`Đã đổi tên thư mục thành "${containerNoToSave}"`);
					}
				} catch (renameErr: any) {
					console.warn("Rename folder failed:", renameErr);
					toast.warning("Không thể đổi tên thư mục Drive");
				}
			} else if (driveUrl && containerNoToSave && !workingFolderId) {
				// No working folder → create named folder in CONTAINER
				try {
					const parent = await getOrCreateContainerFolder();
					const parentFolderUrl = parent ? parent.folderUrl : driveUrl;
					const res = await fetch("/api/google-drive/create-folder-and-move", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							parentFolderUrl,
							folderName: containerNoToSave,
							fileIds: activeTab === "drive" ? selectedDriveFileIds : [],
						}),
					});
					const data = await res.json();
					if (res.ok && data.newFolderUrl) newFolderUrl = data.newFolderUrl;
				} catch {}
			}

			await onConfirm({
				containerNo: containerNoToSave,
				sealNo: sealNoToSave,
				tareWeight: editTareWeight ? parseFloat(editTareWeight) || null : null,
				masGross: editMasGross ? parseFloat(editMasGross) || null : null,
				containerType: editContainerType.trim() || null,
				kc: editKc || null,
				// Only override containerSize if a value is set (either from mapping or user-edited)
				containerSize: editContainerSize || null,
				newFolderUrl,
			});

			handleClose();
		} catch (err: any) {
			toast.error(`Lỗi lưu dữ liệu: ${err.message || "Unknown error"}`);
		} finally {
			setSaving(false);
		}
	};

	const hasExtracted = extracted !== null;
	const isBusy = analyzing || saving || creatingFolder;

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-[1000px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-base">
						<Sparkles className="h-4 w-4 text-violet-500" />
						AI Đọc Thông Tin Container
						{availableModels.length > 0 && (
							<Select
								value={modelName ? [modelName] : []}
								onValueChange={(val: any) =>
									setModelName(Array.isArray(val) ? val[0] : val)
								}
							>
								<SelectTrigger className="h-6 w-fit min-w-[120px] text-[10px] font-semibold border-violet-200 bg-violet-50 text-violet-700 px-2 py-0 ml-2">
									<SelectValue placeholder="Chọn model..." />
								</SelectTrigger>
								<SelectPositioner>
									<SelectContent>
										{availableModels.map((m) => (
											<SelectItem key={m} value={m} className="text-[10px]">
												{m}
											</SelectItem>
										))}
									</SelectContent>
								</SelectPositioner>
							</Select>
						)}
						{currentContainerNo && (
							<span className="text-xs font-normal text-muted-foreground ml-1">
								(Dòng: {currentContainerNo})
							</span>
						)}
					</DialogTitle>
					<DialogDescription className="text-xs">
						Chọn ảnh container — AI tự động trích xuất Container No, Seal No,
						Tare Weight và Max Weight.
						{driveUrl &&
							" File sẽ được đưa vào thư mục tạm trước khi đặt tên theo số container."}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2">
					{/* Source Tabs */}
					<div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
						<button
							type="button"
							onClick={() => setActiveTab("local")}
							className={cn(
								"flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-all",
								activeTab === "local"
									? "bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-sm"
									: "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300",
							)}
						>
							<Upload className="h-3.5 w-3.5" />
							Tải ảnh lên
						</button>
						<button
							type="button"
							onClick={() => {
								setActiveTab("drive");
								if (
									rootFolderId &&
									driveFolders.length === 0 &&
									driveImageFiles.length === 0 &&
									!fetchingFiles
								) {
									loadFolder(rootFolderId);
								}
							}}
							disabled={!rootFolderId}
							className={cn(
								"flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-all",
								!rootFolderId && "opacity-40 cursor-not-allowed",
								activeTab === "drive"
									? "bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-sm"
									: "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300",
							)}
						>
							<HardDrive className="h-3.5 w-3.5" />
							Từ Drive
							{!rootFolderId && (
								<span className="text-[10px] opacity-60">(chưa có Drive)</span>
							)}
						</button>
					</div>

					{/* ── LOCAL TAB ── */}
					{activeTab === "local" && (
						<>
							<div
								onDrop={handleDrop}
								onDragOver={(e) => {
									e.preventDefault();
									setIsDragging(true);
								}}
								onDragLeave={() => setIsDragging(false)}
								onClick={() => fileInputRef.current?.click()}
								className={cn(
									"border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200",
									isDragging
										? "border-violet-500 bg-violet-50 dark:bg-violet-950/20"
										: "border-slate-300 dark:border-slate-600 hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-950/10",
								)}
							>
								<input
									ref={fileInputRef}
									type="file"
									accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.ms-excel,.pdf,.doc,.docx,.xls,.xlsx"
									multiple
									className="hidden"
									onChange={handleFileChange}
								/>
								<Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
								<p className="text-sm font-medium">
									Kéo thả file vào đây hoặc click để chọn
								</p>
								<p className="text-xs text-muted-foreground mt-1">
									Ảnh, PDF, Word, Excel, ...
								</p>
							</div>

							{selectedImages.length > 0 && (
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<p className="text-xs font-medium text-muted-foreground">
											{selectedImages.length} file đã chọn
										</p>
										<Button
											variant="ghost"
											size="sm"
											className="h-6 text-xs text-red-500 hover:text-red-700 px-2"
											onClick={() => {
												selectedImages.forEach((img) =>
													URL.revokeObjectURL(img.preview),
												);
												setSelectedImages([]);
											}}
										>
											Xóa tất cả
										</Button>
									</div>
									<div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[200px] overflow-y-auto">
										{selectedImages.map((img, idx) => (
											<div
												key={idx}
												className="relative group rounded-md overflow-hidden border border-slate-200 dark:border-slate-700"
											>
												{/* eslint-disable-next-line @next/next/no-img-element */}
												<img
													src={img.preview}
													alt={img.name}
													className="w-full h-20 object-cover"
												/>
												<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation();
															removeImage(idx);
														}}
														className="bg-white/90 rounded-full p-1 hover:bg-white"
													>
														<X className="h-3 w-3 text-red-500" />
													</button>
												</div>
												<div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
													<p className="text-[9px] text-white truncate">
														{img.name}
													</p>
												</div>
											</div>
										))}
									</div>
								</div>
							)}
						</>
					)}

					{/* ── DRIVE TAB ── */}
					{activeTab === "drive" && (
						<div className="space-y-2">
							{/* Breadcrumb */}
							<div className="flex items-center gap-1 flex-wrap">
								<button
									type="button"
									onClick={() => navigateTo(-1)}
									className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
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
												"text-xs hover:underline max-w-[120px] truncate",
												idx === breadcrumb.length - 1
													? "text-slate-700 dark:text-slate-300 font-medium"
													: "text-blue-600 dark:text-blue-400",
											)}
										>
											{crumb.name}
										</button>
									</span>
								))}
								<div className="ml-auto flex items-center gap-1">
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
										onClick={() =>
											currentFolderId && loadFolder(currentFolderId)
										}
										disabled={fetchingFiles}
									>
										<RefreshCw
											className={cn("h-3 w-3", fetchingFiles && "animate-spin")}
										/>
									</Button>
								</div>
							</div>

							{/* File browser */}
							{fetchingFiles ? (
								<div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
									<Loader2 className="h-4 w-4 animate-spin" />
									<span className="text-xs">Đang tải...</span>
								</div>
							) : (
								<div className="border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
									{driveFolders.length === 0 && driveImageFiles.length === 0 ? (
										<div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
											<ImageIcon className="h-8 w-8 opacity-30" />
											<p className="text-xs">Thư mục trống</p>
										</div>
									) : (
										<div className="max-h-[240px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
											{/* Folders */}
											{driveFolders.map((folder) => (
												<div
													key={folder.id}
													onClick={() => enterFolder(folder)}
													className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 text-xs"
												>
													<Folder className="h-4 w-4 text-amber-400 shrink-0" />
													<span className="flex-1 font-medium truncate">
														{folder.name}
													</span>
													<ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
												</div>
											))}
											{/* Files */}
											{driveImageFiles.map((file: DriveItem) => {
												const isSelected = selectedDriveFileIds.includes(
													file.id,
												);
												return (
													<div
														key={file.id}
														onClick={() => toggleDriveFile(file)}
														className={cn(
															"flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors text-xs",
															isSelected
																? "bg-violet-50 dark:bg-violet-950/30"
																: "hover:bg-slate-50 dark:hover:bg-slate-800/50",
														)}
													>
														<div
															className={cn(
																"h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 transition-colors",
																isSelected
																	? "bg-violet-600 border-violet-600"
																	: "border-slate-300 dark:border-slate-600",
															)}
														>
															{isSelected && (
																<Check className="h-2.5 w-2.5 text-white" />
															)}
														</div>
														{file.thumbnailLink ? (
															<img
																src={file.thumbnailLink}
																className="h-6 w-6 object-cover rounded shadow-sm border border-slate-200"
																alt=""
															/>
														) : (
															<FileIcon
																mimeType={file.mimeType}
																className="h-3.5 w-3.5 text-violet-400 shrink-0"
															/>
														)}
														<span className="truncate flex-1 font-medium">
															{file.name}
														</span>
													</div>
												);
											})}
										</div>
									)}
								</div>
							)}

							{selectedDriveFileIds.length > 0 && (
								<p className="text-xs text-violet-600 dark:text-violet-400 font-medium">
									Đã chọn {selectedDriveFileIds.length} file
								</p>
							)}
						</div>
					)}

					{/* Loading history */}
					{loadingHistory && (
						<div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
							<Loader2 className="h-3 w-3 animate-spin" />
							<span>Đang tải kết quả lần trước...</span>
						</div>
					)}

					{/* Creating folder indicator */}
					{creatingFolder && (
						<div className="flex items-center gap-2 text-xs text-blue-600 py-1">
							<Loader2 className="h-3 w-3 animate-spin" />
							<span>Đang tạo thư mục làm việc trên Drive...</span>
						</div>
					)}

					{/* Analyze Button */}
					<Button
						onClick={handleAnalyze}
						disabled={!hasSelection || isBusy}
						className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2"
						size="sm"
					>
						{analyzing ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" />
								AI đang phân tích...
							</>
						) : (
							<>
								<Sparkles className="h-4 w-4" />
								{hasExtracted ? "Phân tích lại" : "Phân tích với AI"}
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
									Phát hiện trong ảnh:{" "}
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

					{/* Extracted Results */}
					{hasExtracted && (
						<div className="border border-violet-200 dark:border-violet-800 rounded-lg p-4 bg-violet-50/50 dark:bg-violet-950/20 space-y-3">
							<div className="flex items-center gap-2">
								<CheckCircle2 className="h-4 w-4 text-violet-600" />
								<p className="text-sm font-semibold text-violet-700 dark:text-violet-400">
									{isRestoredFromHistory ? "Kết quả lần trước" : "Kết quả AI"} —
									Xác nhận hoặc chỉnh sửa
								</p>
							</div>

							{/* Container & Seal Thumbnails — cropped to number region */}
							{fileRoles.length > 0 && (
								<div className="flex gap-4 py-2 border-y border-violet-100 dark:border-violet-900/50">
									{fileRoles
										.filter(
											(fr) => fr.role === "container" || fr.role === "seal",
										)
										.map((fr, idx) => {
											let previewUrl: string | null = null;
											let fullUrl: string | null = null;
											let name = "";
											if (activeTab === "local") {
												const si = selectedImages[fr.fileIndex];
												previewUrl = si?.preview || null;
												fullUrl = previewUrl;
												name = si?.name || "";
											} else {
												const fid =
													analysisFileIds[fr.fileIndex] ||
													selectedDriveFileIds[fr.fileIndex];
												const meta = fileMetadataMap[fid];
												previewUrl = meta?.thumbnailLink || null;
												fullUrl = previewUrl
													? previewUrl.replace(/=s\d+/, "=s1600")
													: null;
												name = meta?.name || "";
											}

											if (!previewUrl && activeTab === "local") return null;

											const crop = fr.cropRegion;
											const hasCrop =
												crop &&
												crop.top >= 0 &&
												crop.left >= 0 &&
												crop.bottom > crop.top &&
												crop.right > crop.left;

											return (
												<div key={idx} className="space-y-1 group">
													<p className="text-[10px] font-bold text-violet-600 uppercase">
														{fr.role === "container"
															? "📷 Container No"
															: "🔏 Seal No"}
														{hasCrop && (
															<span className="ml-1.5 text-[9px] text-violet-400 font-normal normal-case">
																(Đã zoom)
															</span>
														)}
													</p>
													<div
														className="relative h-48 w-80 border-2 border-white dark:border-slate-800 rounded-lg overflow-hidden shadow-md bg-slate-200 dark:bg-slate-900 cursor-zoom-in hover:border-violet-400 transition-all"
														onClick={() =>
															(fullUrl || previewUrl) &&
															window.open(fullUrl || previewUrl!, "_blank")
														}
													>
														{previewUrl ? (
															<img
																src={previewUrl}
																referrerPolicy="no-referrer"
																className="h-full w-full transition-transform group-hover:scale-105"
																style={
																	hasCrop
																		? {
																				objectFit: "cover" as const,
																				objectPosition: `${((crop.left + crop.right) / 2) * 100}% ${((crop.top + crop.bottom) / 2) * 100}%`,
																				transform: `scale(${1 / Math.max(crop.right - crop.left, crop.bottom - crop.top)})`,
																				transformOrigin: `${((crop.left + crop.right) / 2) * 100}% ${((crop.top + crop.bottom) / 2) * 100}%`,
																			}
																		: { objectFit: "cover" as const }
																}
																alt={name}
															/>
														) : (
															<div className="h-full w-full flex items-center justify-center">
																<ImageIcon className="h-10 w-10 text-slate-400 opacity-20" />
															</div>
														)}
														<div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
													</div>
													{name && (
														<p className="text-[9px] text-muted-foreground truncate max-w-[320px]">
															{name}
														</p>
													)}
												</div>
											);
										})}
								</div>
							)}

							{/* History restore banner */}
							{isRestoredFromHistory && restoredAt && (
								<div className="flex items-center gap-2 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md text-xs text-amber-700 dark:text-amber-400">
									<span className="shrink-0">🕐</span>
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
										. Chọn ảnh và bấm <strong>Phân tích lại</strong> để cập
										nhật.
									</span>
								</div>
							)}

							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-1">
									<p className="text-xs font-medium">Container No</p>
									<Input
										value={editContainerNo}
										onChange={(e) =>
											setEditContainerNo(e.target.value.toUpperCase())
										}
										placeholder="MSCU1234567"
										className="h-8 text-sm font-mono"
									/>
								</div>
								<div className="space-y-1">
									<p className="text-xs font-medium">Seal No</p>
									<Input
										value={editSealNo}
										onChange={(e) => setEditSealNo(e.target.value)}
										placeholder="VN123456"
										className="h-8 text-sm font-mono"
									/>
								</div>
								<div className="space-y-1">
									<p className="text-xs font-medium">Tare Weight (kg)</p>
									<Input
										value={editTareWeight}
										onChange={(e) => setEditTareWeight(e.target.value)}
										type="number"
										placeholder="2200"
										className="h-8 text-sm tabular-nums"
									/>
								</div>
								<div className="space-y-1">
									<p className="text-xs font-medium">
										Max Weight / masGross (kg)
									</p>
									<Input
										value={editMasGross}
										onChange={(e) => setEditMasGross(e.target.value)}
										type="number"
										placeholder="30480"
										className="h-8 text-sm tabular-nums"
									/>
								</div>
								<div className="space-y-1 col-span-2 grid grid-cols-3 gap-3">
									<div className="space-y-1">
										<p className="text-xs font-medium">Loại Cont (ISO 6346)</p>
										<Input
											value={editContainerType}
											onChange={(e) =>
												setEditContainerType(e.target.value.toUpperCase())
											}
											placeholder="Ví dụ: 45G1, 22R1, 42G0..."
											className="h-8 text-sm font-mono"
											maxLength={4}
										/>
									</div>
									<div className="space-y-1">
										<p className="text-xs font-medium">Kích Cỡ (KC)</p>
										<Input
											value={editKc ?? ""}
											onChange={(e) => setEditKc(e.target.value || null)}
											placeholder="Nhập kích cỡ..."
											className="h-8 text-sm font-mono"
										/>
									</div>
									<div className="space-y-1">
										<p className="text-xs font-medium">Container Size</p>
										<VirtualizedCombobox
											items={sizeOptions}
											value={editContainerSize ?? ""}
											onChange={(val: string) =>
												setEditContainerSize(val || null)
											}
											placeholder="Chọn size..."
											searchPlaceholder="Tìm size..."
											showClearOption={true}
											triggerClassName="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm font-mono"
										/>
									</div>
								</div>
								{/* Port used for KC lookup */}
								{(operationType || portCode) && (
									<div className="col-span-2 flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-md">
										<span className="text-[10px] text-muted-foreground shrink-0">
											Port tra KC:
										</span>
										{portName ? (
											<span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
												{portName}
												{portCode && portCode !== portName && (
													<span className="font-normal text-muted-foreground ml-1">
														({portCode})
													</span>
												)}
											</span>
										) : (
											<span className="text-xs text-muted-foreground italic">
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
							</div>

							{/* Container Size mismatch alert */}
							{editContainerSize &&
								currentContainerSize &&
								editContainerSize !== currentContainerSize && (
									<div className="flex items-start gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700 rounded-lg text-xs text-amber-800 dark:text-amber-400">
										<AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
										<div>
											<p className="font-semibold">
												Container Size sẽ được cập nhật
											</p>
											<p>
												Hiện tại:{" "}
												<span className="font-mono font-bold line-through opacity-70">
													{currentContainerSize}
												</span>
												{" → "}
												Mới:{" "}
												<span className="font-mono font-bold text-amber-700 dark:text-amber-300">
													{editContainerSize}
												</span>
											</p>
										</div>
									</div>
								)}

							{workingFolderId && editContainerNo.trim() && (
								<div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-md text-xs text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
									<FolderOpen className="h-3.5 w-3.5 shrink-0" />
									<span>
										Khi xác nhận, thư mục tạm sẽ được đổi tên thành{" "}
										<strong>"{editContainerNo.trim()}"</strong>.
									</span>
								</div>
							)}
						</div>
					)}
				</div>

				<DialogFooter className="gap-2">
					<Button
						variant="outline"
						onClick={handleClose}
						disabled={isBusy}
						size="sm"
					>
						Hủy
					</Button>
					{hasExtracted && (
						<Button
							onClick={handleConfirm}
							disabled={isBusy}
							size="sm"
							className="bg-violet-600 hover:bg-violet-700 text-white gap-1"
						>
							{saving ? (
								<>
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
									Đang lưu...
								</>
							) : (
								<>
									<CheckCircle2 className="h-3.5 w-3.5" />
									Xác nhận & Lưu
								</>
							)}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
