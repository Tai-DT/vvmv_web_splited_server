"use client";

import {
	AlertCircle,
	Anchor,
	ArrowLeft,
	Box,
	CalendarClock,
	Check,
	CheckCircle2,
	ChevronRight,
	ExternalLink,
	File as FileIcon2,
	FileSpreadsheet,
	FileText,
	Folder,
	HardDrive,
	Image as ImageIcon,
	Info,
	Loader2,
	MapPin,
	RefreshCw,
	Ship,
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
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Popover,
	PopoverContent,
	PopoverPositioner,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectPositioner,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useContainerSizes } from "@/hooks/use-container-sizes";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContainerInfo {
	id: string;
	containerNo?: string | null;
	sealNo?: string | null;
	containerSize?: string | null;
	portLocation?: string | null;
	plateNumber?: string | null;
	grossWeight?: number | null;
	packageQty?: number | null;
}

interface EditableContainerRow {
	id: string;
	containerSize: string;
	containerNo: string;
	sealNo: string;
	portLocation: string;
	plateNumber: string;
	grossWeight: number | null;
	packageQty: number | null;
}

interface BookingResult {
	model?: string;
	eportBooking: string | null;
	eportBookingSuggestions?: string[];
	carrierName?: string | null;
	originalCarrierName?: string | null;
	carrierNameSuggestions?: string[];
	transitPort: string | null;
	originalTransitPort?: string | null;
	transitPortSuggestions?: string[];
	destinationPort: string | null;
	originalDestinationPort?: string | null;
	destinationPortSuggestions?: string[];
	vesselName: string | null;
	vesselNameSuggestions?: string[];
	veselNumber: string | null;
	veselNumberSuggestions?: string[];
	pickOrLiftPlace: string | null;
	originalPickOrLiftPlace?: string | null;
	pickOrLiftPlaceSuggestions?: string[];
	blockCode?: string | null;
	blockCodeSuggestions?: string[];
	cutOffTime: string | null;
	cutOffTimeSuggestions?: string[];
	cutOffAtPort?: string | null;
	containerQuantity: number | null;
	containerSizes: string[];
	deliveryAt?: string | null;
	containers: Array<{
		containerNo: string | null;
		sealNo: string | null;
		containerSize: string | null;
		grossWeight: number | null;
		packageQty: number | null;
	}>;
	warnings: string[];
	extractionDetails?: Record<string, string>;
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

type SnpLookupInfo = {
	customsStatuses: string[];
	vesselName: string;
	veselNumber: string;
	truckVessels: string[];
};

interface BookingBulkAiDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	containers: ContainerInfo[];
	jobNumber?: string | null;
	truckingFollowUpId?: string;
	driveUrl?: string | null;
	/** SITE_ID for SNP port lookup, derived from FCR.deliveryAt */
	siteId?: string | null;
	isExport?: boolean;
	onConfirm: (result: {
		eportBooking: string | null;
		carrierName: string | null;
		transitPort: string | null;
		destinationPort: string | null;
		vesselName: string | null;
		veselNumber: string | null;
		pickOrLiftPlace: string | null;
		blockCode: string | null;
		cutOffTime: string | null;
		cutOffAtPort: string | null;
		containerRows: Array<{
			id: string;
			containerSize: string | null;
			containerNo: string | null;
			sealNo: string | null;
			portLocation: string | null;
			plateNumber: string | null;
			grossWeight: number | null;
			packageQty: number | null;
		}>;
	}) => Promise<void>;
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

/** Format ISO datetime → dd/MM/yyyy HH:mm */
function formatDateTimeVN(value: string | null | undefined): string {
	if (!value) return "";
	const raw = String(value).trim();

	// Keep booking clock-time as entered (no timezone conversion)
	let m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
	if (m) {
		const [, day, month, year, hh = "0", mm = "0"] = m;
		const d = String(Number(day)).padStart(2, "0");
		const mo = String(Number(month)).padStart(2, "0");
		const h = String(Number(hh)).padStart(2, "0");
		const min = String(Number(mm)).padStart(2, "0");
		return `${d}/${mo}/${year} ${h}:${min}`;
	}

	m = raw.match(
		/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?(?:Z|[+-]\d{2}:?\d{2})?$/,
	);
	if (m) {
		const [, year, month, day, hh = "00", mm = "00"] = m;
		return `${day}/${month}/${year} ${hh}:${mm}`;
	}

	try {
		const date = new Date(raw);
		if (isNaN(date.getTime())) return value;
		const d = String(date.getUTCDate()).padStart(2, "0");
		const m = String(date.getUTCMonth() + 1).padStart(2, "0");
		const y = date.getUTCFullYear();
		const h = String(date.getUTCHours()).padStart(2, "0");
		const min = String(date.getUTCMinutes()).padStart(2, "0");
		return `${d}/${m}/${y} ${h}:${min}`;
	} catch {
		return value || "";
	}
}

// ─── Subcomponent for rendering reasons ──────────────────────────────────────
function FieldReason({ reason }: { reason?: string }) {
	if (!reason) return null;
	const isWarning = reason.includes("CẢNH BÁO") || reason.includes("⚠️");
	const text = reason
		.replace("⚠️ CẢNH BÁO\\n", "")
		.replace("⚠️ CẢNH BÁO", "")
		.replace("⚠️", "")
		.trim();
	return (
		<Popover>
			<PopoverTrigger
				title="Xem lý do"
				className={cn(
					"ml-1.5 inline-flex items-center justify-center rounded-full w-4 h-4 transition-colors",
					isWarning
						? "text-amber-500 hover:bg-amber-100"
						: "text-blue-500 hover:bg-blue-100",
				)}
			>
				<Info className="h-3 w-3" />
			</PopoverTrigger>
			<PopoverPositioner align="start" sideOffset={8}>
				<PopoverContent className="w-80 p-3 text-xs shadow-lg">
					<div className="flex items-start gap-2">
						{isWarning ? (
							<AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
						) : (
							<Info className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" />
						)}
						<span className="whitespace-pre-line leading-relaxed text-slate-700 dark:text-slate-300">
							{text}
						</span>
					</div>
				</PopoverContent>
			</PopoverPositioner>
		</Popover>
	);
}

// ─── Component ────────────────────────────────────────────────────────────────
export function BookingBulkAiDialog({
	open,
	onOpenChange,
	containers,
	jobNumber,
	truckingFollowUpId,
	driveUrl,
	siteId,
	isExport,
	onConfirm,
}: BookingBulkAiDialogProps) {
	const [activeTab, setActiveTab] = useState<SourceTab>("local");
	const [sessionId, setSessionId] = useState("");

	const availableModels = useMemo(() => {
		return (process.env.NEXT_PUBLIC_GEMINI_AUTOFILL_BOOKING_MODEL || "")
			.split(",")
			.map((m) => m.trim())
			.filter(Boolean);
	}, []);

	const [modelName, setModelName] = useState<string | null>(
		process.env.NEXT_PUBLIC_GEMINI_AUTOFILL_BOOKING_MODEL
			? process.env.NEXT_PUBLIC_GEMINI_AUTOFILL_BOOKING_MODEL.split(",")
					.map((m) => m.trim())
					.filter(Boolean)[0] || null
			: null,
	);

	// Container sizes combobox
	const { containerSizes } = useContainerSizes();
	const sizeOptions = useMemo(
		() => containerSizes.map((s) => ({ id: s, name: s })),
		[containerSizes],
	);

	// Normalize size strings for comparison ("40 HC" === "40HC")
	const normalizeSize = useCallback(
		(s: string | null | undefined) =>
			(s ?? "").trim().toUpperCase().replace(/\s+/g, ""),
		[],
	);

	// Find matching option in sizeOptions for an AI-provided size string
	const resolveSize = useCallback(
		(aiSizeRaw: string | null | undefined): string => {
			if (!aiSizeRaw) return "";
			const norm = normalizeSize(aiSizeRaw);
			return (
				sizeOptions.find((o) => normalizeSize(o.id) === norm)?.id ?? aiSizeRaw
			);
		},
		[sizeOptions, normalizeSize],
	);

	// Editable container rows & original snapshot (for revert)
	const [editableContainerRows, setEditableContainerRows] = useState<
		EditableContainerRow[]
	>([]);
	const [originalContainerRows, setOriginalContainerRows] = useState<
		EditableContainerRow[]
	>([]);
	const [fetchingLocation, setFetchingLocation] = useState(false);

	// Local files
	const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
	const [isDragging, setIsDragging] = useState(false);

	// Drive
	const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([]);
	const [driveFolders, setDriveFolders] = useState<DriveItem[]>([]);
	const [driveFiles, setDriveFiles] = useState<DriveItem[]>([]);
	const [fetchingDrive, setFetchingDrive] = useState(false);
	const [selectedDriveIds, setSelectedDriveIds] = useState<string[]>([]);

	// History
	const [loadingHistory, setLoadingHistory] = useState(false);
	const [isRestored, setIsRestored] = useState(false);
	const [restoredAt, setRestoredAt] = useState<string | null>(null);

	// Results
	const [analyzing, setAnalyzing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [lookingUpTraTau, setLookingUpTraTau] = useState(false);
	const [traTauMessage, setTraTauMessage] = useState("");
	const [traTauMessageType, setTraTauMessageType] = useState<
		"success" | "error" | null
	>(null);
	const [result, setResult] = useState<BookingResult | null>(null);

	const [showExtractionDetails, setShowExtractionDetails] = useState(false);

	// Editable fields
	const [editEportBooking, setEditEportBooking] = useState("");
	const [editCarrierName, setEditCarrierName] = useState("");
	const [editTransitPort, setEditTransitPort] = useState("");
	const [editDestinationPort, setEditDestinationPort] = useState("");
	const [editVesselName, setEditVesselName] = useState("");
	const [editVeselNumber, setEditVeselNumber] = useState("");
	const [editPickOrLiftPlace, setEditPickOrLiftPlace] = useState("");
	const [editBlockCode, setEditBlockCode] = useState("");
	const [editCutOffTime, setEditCutOffTime] = useState("");
	const [editCutOffAtPort, setEditCutOffAtPort] = useState("");
	const [snpInfo, setSnpInfo] = useState<SnpLookupInfo>({
		customsStatuses: [],
		vesselName: "",
		veselNumber: "",
		truckVessels: [],
	});

	const fileInputRef = useRef<HTMLInputElement>(null);

	const parseTruckVessel = useCallback(
		(truckVessel: string | null | undefined) => {
			const raw = truckVessel?.trim();
			if (!raw) return { vesselName: "", veselNumber: "" };
			const separatorIndex = raw.lastIndexOf(" - ");
			if (separatorIndex === -1) {
				return { vesselName: raw, veselNumber: "" };
			}
			return {
				vesselName: raw.slice(0, separatorIndex).trim(),
				veselNumber: raw.slice(separatorIndex + 3).trim(),
			};
		},
		[],
	);

	const normalizeCompare = (value: string) =>
		value.trim().replace(/\s+/g, " ").toUpperCase();

	const vesselNameMismatch = useMemo(() => {
		if (!snpInfo.vesselName || !editVesselName.trim()) return false;
		return (
			normalizeCompare(snpInfo.vesselName) !== normalizeCompare(editVesselName)
		);
	}, [editVesselName, snpInfo.vesselName]);

	const veselNumberMismatch = useMemo(() => {
		if (!snpInfo.veselNumber || !editVeselNumber.trim()) return false;
		return (
			normalizeCompare(snpInfo.veselNumber) !==
			normalizeCompare(editVeselNumber)
		);
	}, [editVeselNumber, snpInfo.veselNumber]);

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
				toast.error("Lỗi tải Drive: " + err.message);
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
		setResult(null);
		setIsRestored(false);
		setRestoredAt(null);
		setShowExtractionDetails(false);
		setEditEportBooking("");
		setEditCarrierName("");
		setEditTransitPort("");
		setEditDestinationPort("");
		setEditVesselName("");
		setEditVeselNumber("");
		setEditPickOrLiftPlace("");
		setEditBlockCode("");
		setEditCutOffTime("");
		setEditCutOffAtPort("");
		setSnpInfo({
			customsStatuses: [],
			vesselName: "",
			veselNumber: "",
			truckVessels: [],
		});
		setTraTauMessage("");
		setTraTauMessageType(null);
		// Init editable container rows from current containers prop
		const initRows = containers.map((c) => ({
			id: c.id,
			containerSize: c.containerSize || "",
			containerNo: c.containerNo || "",
			sealNo: c.sealNo || "",
			portLocation: c.portLocation || "",
			plateNumber: c.plateNumber || "",
			grossWeight: (c as any).grossWeight ?? null,
			packageQty: (c as any).packageQty ?? null,
		}));
		setEditableContainerRows(initRows);
		setOriginalContainerRows(initRows);

		if (!jobNumber) return;

		setLoadingHistory(true);
		fetch(
			`/api/trucking-followup/container/ai-autofill-booking?jobNumber=${encodeURIComponent(jobNumber)}`,
		)
			.then((r) => r.json())
			.then((data) => {
				if (!data.history) return;
				const h = data.history;

				if (
					h.eportBooking ||
					h.carrierName ||
					h.transitPort ||
					h.destinationPort ||
					h.vesselName ||
					h.veselNumber ||
					h.cutOffTime ||
					h.pickOrLiftPlace ||
					h.blockCode ||
					h.cutOffAtPort
				) {
					setResult(h);
					setEditEportBooking(h.eportBooking || "");
					setEditCarrierName(h.carrierName || "");
					setEditTransitPort(h.transitPort || "");
					setEditDestinationPort(h.destinationPort || "");
					setEditVesselName(h.vesselName || "");
					setEditVeselNumber(h.veselNumber || "");
					setEditPickOrLiftPlace(h.pickOrLiftPlace || "");
					setEditBlockCode(h.blockCode || "");
					setEditCutOffTime(h.cutOffTime ? formatDateTimeVN(h.cutOffTime) : "");
					setEditCutOffAtPort(
						h.cutOffAtPort ? formatDateTimeVN(h.cutOffAtPort) : "",
					);
					setIsRestored(true);
					setRestoredAt(h.createdAt || null);
				}

				const wfId = h.workingFolderId as string | null;
				if (wfId) {
					setActiveTab("drive");
					setSelectedDriveIds(h.fileIds || []);
					setBreadcrumb([{ id: wfId, name: "📂 Thư mục làm việc" }]);
					loadFolder(wfId, true);
				} else if ((h.fileIds || []).length > 0 && rootFolderId) {
					setActiveTab("drive");
					setSelectedDriveIds(h.fileIds);
					loadFolder(rootFolderId, true);
				}
			})
			.catch(() => {})
			.finally(() => setLoadingHistory(false));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	// ─── Drive navigation ────────────────────────────────────────────────────
	const enterFolder = (f: DriveItem) => {
		setBreadcrumb((p) => [...p, { id: f.id, name: f.name }]);
		loadFolder(f.id, true); // giữ lại file đã chọn khi chuyển folder
	};

	const navigateTo = (index: number) => {
		if (index === -1) {
			setBreadcrumb([]);
			rootFolderId && loadFolder(rootFolderId, true); // giữ lại file đã chọn khi chuyển folder
		} else {
			const c = breadcrumb.slice(0, index + 1);
			setBreadcrumb(c);
			loadFolder(c[c.length - 1].id, true); // giữ lại file đã chọn khi chuyển folder
		}
	};

	const toggleDrive = (f: DriveItem) => {
		setSelectedDriveIds((p) =>
			p.includes(f.id) ? p.filter((x) => x !== f.id) : [...p, f.id],
		);
	};

	const selectAllInFolder = () => {
		const ids = driveFiles.map((f) => f.id);
		const allSelected = ids.every((id) => selectedDriveIds.includes(id));
		if (allSelected) {
			setSelectedDriveIds((p) => p.filter((id) => !ids.includes(id)));
		} else {
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
		setResult(null);
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
		setResult(null);
		setIsRestored(false);
		setShowExtractionDetails(false);

		try {
			let body: any;

			if (activeTab === "drive") {
				body = {
					fileIds: selectedDriveIds,
					jobNumber: jobNumber || undefined,
					sessionId,
					existingContainers: containers.map((c) => ({
						id: c.id,
						containerNo: c.containerNo || null,
						containerSize: c.containerSize || null,
						sealNo: c.sealNo || null,
					})),
					validContainerSizes: sizeOptions.map((o) => o.id),
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
					existingContainers: containers.map((c) => ({
						id: c.id,
						containerNo: c.containerNo || null,
						containerSize: c.containerSize || null,
						sealNo: c.sealNo || null,
					})),
					validContainerSizes: sizeOptions.map((o) => o.id),
				};
			}

			if (modelName) {
				body.model = modelName;
			}

			const res = await fetch(
				"/api/trucking-followup/container/ai-autofill-booking",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				},
			);
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || "Lỗi phân tích");

			setResult(data);
			setEditEportBooking(data.eportBooking || "");
			setEditCarrierName(data.carrierName || "");
			setEditTransitPort(data.transitPort || "");
			setEditDestinationPort(data.destinationPort || "");
			setEditVesselName(data.vesselName || "");
			setEditVeselNumber(data.veselNumber || "");
			setEditPickOrLiftPlace(data.pickOrLiftPlace || "");
			setEditBlockCode(data.blockCode || "");
			setEditCutOffTime(
				data.cutOffTime ? formatDateTimeVN(data.cutOffTime) : "",
			);

			// Update metrics (GW, Package Qty) for existing containers if they were empty or if AI found new values
			if (data.containers && data.containers.length > 0) {
				setEditableContainerRows((prev) =>
					prev.map((row, idx) => {
						const ai = data.containers[idx];
						if (!ai) return row;
						return {
							...row,
							grossWeight: row.grossWeight || ai.grossWeight,
							packageQty: row.packageQty || ai.packageQty,
						};
					}),
				);
			}

			// Lookup Cut Off tại cảng via Tra tàu action API only when both vessel fields are available.
			const hasVesselName = Boolean(
				data.vesselName && String(data.vesselName).trim(),
			);
			const hasVesselNumber = Boolean(
				data.veselNumber && String(data.veselNumber).trim(),
			);
			if (jobNumber && hasVesselName && hasVesselNumber) {
				try {
					const traTauRes = await fetch("/api/trucking-followup/tra-tau", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							jobNumber,
							vesselName: data.vesselName,
							veselNumber: data.veselNumber,
						}),
					});
					const traTauData = await traTauRes.json();

					if (traTauRes.ok && traTauData?.success) {
						const iso = traTauData?.data?.closingTimeIso as string | undefined;
						setEditCutOffAtPort(iso ? formatDateTimeVN(iso) : "");
						if (iso) {
							setTraTauMessage("Tra tàu thành công");
							setTraTauMessageType("success");
						} else {
							setTraTauMessage("Tra tàu không có dữ liệu Cut Off tại cảng");
							setTraTauMessageType("error");
						}
					} else {
						setEditCutOffAtPort("");
						setTraTauMessage(traTauData?.message || "Tra tàu thất bại");
						setTraTauMessageType("error");
					}
				} catch {
					setEditCutOffAtPort("");
					setTraTauMessage("Tra tàu thất bại");
					setTraTauMessageType("error");
				}
			} else {
				setEditCutOffAtPort("");
				setTraTauMessage("");
				setTraTauMessageType(null);
			}

			toast.success("AI đã trích xuất thông tin booking!");
			// Auto-fetch port locations after AI is done
			fetchSnpLocations();
		} catch (error: any) {
			toast.error("Lỗi: " + (error.message || "Không thể phân tích"));
		} finally {
			setAnalyzing(false);
		}
	};

	// ─── SNP location fetch ───────────────────────────────────────────────────
	const fetchSnpLocations = useCallback(async () => {
		if (!siteId) return;
		const nos = editableContainerRows
			.map((r) => r.containerNo.trim())
			.filter(Boolean);
		if (nos.length === 0) return;
		setFetchingLocation(true);
		try {
			const res = await fetch("/api/trucking-followup/snp-location", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ containerNos: nos, siteId, isExport }),
			});
			if (!res.ok) return;
			const data = await res.json();
			const results: {
				containerNo: string;
				location: string | null;
				customClearanceStatus: string | null;
				truckVessel: string | null;
				plateNumber: string | null;
			}[] = data.results ?? [];
			const locationMap = Object.fromEntries(
				results.map((r) => [r.containerNo.toUpperCase(), r.location ?? ""]),
			);
			const plateNumberMap = Object.fromEntries(
				results.map((r) => [r.containerNo.toUpperCase(), r.plateNumber ?? ""]),
			);
			const customsStatuses = Array.from(
				new Set(
					results
						.map((r) => r.customClearanceStatus?.trim())
						.filter((value): value is string => !!value),
				),
			);
			const truckVessels = Array.from(
				new Set(
					results
						.map((r) => r.truckVessel?.trim())
						.filter((value): value is string => !!value),
				),
			);
			const parsedTruckVessel = parseTruckVessel(truckVessels[0] ?? "");
			setSnpInfo({
				customsStatuses,
				vesselName: parsedTruckVessel.vesselName,
				veselNumber: parsedTruckVessel.veselNumber,
				truckVessels,
			});
			setEditableContainerRows((prev) =>
				prev.map((row) => ({
					...row,
					portLocation:
						locationMap[row.containerNo.toUpperCase()] || row.portLocation,
					plateNumber:
						plateNumberMap[row.containerNo.toUpperCase()] || row.plateNumber,
				})),
			);
		} catch {
			// silently ignore
		} finally {
			setFetchingLocation(false);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [siteId, editableContainerRows]);

	const handleLookupTraTau = async () => {
		const vesselName = editVesselName.trim();
		const veselNumber = editVeselNumber.trim();

		if (!vesselName || !veselNumber) {
			setTraTauMessage("Cần đủ Tên tàu và Số chuyến tàu để tra tàu");
			setTraTauMessageType("error");
			return;
		}

		if (!jobNumber) {
			setTraTauMessage("Không có job number để tra tàu");
			setTraTauMessageType("error");
			return;
		}

		setLookingUpTraTau(true);
		try {
			const res = await fetch("/api/trucking-followup/tra-tau", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ jobNumber, vesselName, veselNumber }),
			});

			const data = await res.json();
			if (!res.ok || !data?.success) {
				setEditCutOffAtPort("");
				setTraTauMessage(data?.message || "Tra tàu thất bại");
				setTraTauMessageType("error");
				throw new Error(data?.message || "Tra tàu thất bại");
			}

			const iso = data?.data?.closingTimeIso as string | undefined;
			if (!iso) {
				setEditCutOffAtPort("");
				setTraTauMessage("Không có dữ liệu Cut Off tại cảng");
				setTraTauMessageType("error");
				throw new Error("Không có dữ liệu Cut Off tại cảng");
			}

			setEditCutOffAtPort(formatDateTimeVN(iso));
			setTraTauMessage("Tra tàu thành công");
			setTraTauMessageType("success");
		} catch (error: any) {
			setEditCutOffAtPort("");
			setTraTauMessage(error?.message || "Tra tàu thất bại");
			setTraTauMessageType("error");
		} finally {
			setLookingUpTraTau(false);
		}
	};

	// ─── Parse cutoff time for API ───────────────────────────────────────────
	const parseCutOffForAPI = (value: string): string | null => {
		if (!value) return null;
		const v = value.trim();

		// Format 1: dd/MM/yyyy HH:mm
		let match = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
		if (match) {
			const [, day, month, year, hours, minutes] = match;
			const d = String(Number(day)).padStart(2, "0");
			const m = String(Number(month)).padStart(2, "0");
			const h = String(Number(hours)).padStart(2, "0");
			const min = String(Number(minutes)).padStart(2, "0");
			return `${year}-${m}-${d}T${h}:${min}:00.000Z`;
		}

		// Format 1b: HH:mm dd/MM/yyyy
		match = v.match(/^(\d{1,2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
		if (match) {
			const [, hours, minutes, day, month, year] = match;
			const d = String(Number(day)).padStart(2, "0");
			const m = String(Number(month)).padStart(2, "0");
			const h = String(Number(hours)).padStart(2, "0");
			const min = String(Number(minutes)).padStart(2, "0");
			return `${year}-${m}-${d}T${h}:${min}:00.000Z`;
		}

		// Format 2: ISO 8601
		match = v.match(
			/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?(?:Z|[+-]\d{2}:?\d{2})?$/,
		);
		if (match) {
			const [, year, month, day, hours = "00", minutes = "00"] = match;
			return `${year}-${month}-${day}T${hours}:${minutes}:00.000Z`;
		}

		return null;
	};

	// ─── Confirm ─────────────────────────────────────────────────────────────
	const handleConfirm = async () => {
		setSaving(true);
		try {
			let cutOffAtPortForSave = parseCutOffForAPI(editCutOffAtPort);

			// Always use the current values in AI popup fields to call Tra tàu API before saving.
			const vesselName = editVesselName.trim();
			const veselNumber = editVeselNumber.trim();
			if (jobNumber && vesselName && veselNumber) {
				try {
					const traTauRes = await fetch("/api/trucking-followup/tra-tau", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ jobNumber, vesselName, veselNumber }),
					});
					const traTauData = await traTauRes.json();

					if (traTauRes.ok && traTauData?.success) {
						const iso = traTauData?.data?.closingTimeIso as string | undefined;
						if (iso) {
							cutOffAtPortForSave = iso;
							setEditCutOffAtPort(formatDateTimeVN(iso));
						} else {
							cutOffAtPortForSave = null;
							setEditCutOffAtPort("");
						}
					} else {
						cutOffAtPortForSave = null;
						setEditCutOffAtPort("");
					}
				} catch {
					// On Tra tàu error, keep Cut Off tại cảng empty.
					cutOffAtPortForSave = null;
					setEditCutOffAtPort("");
				}
			}

			await onConfirm({
				eportBooking: editEportBooking || null,
				carrierName: editCarrierName || null,
				transitPort: editTransitPort || null,
				destinationPort: editDestinationPort || null,
				vesselName: editVesselName || null,
				veselNumber: editVeselNumber || null,
				pickOrLiftPlace: editPickOrLiftPlace || null,
				blockCode: editBlockCode || null,
				cutOffTime: parseCutOffForAPI(editCutOffTime),
				cutOffAtPort: cutOffAtPortForSave,
				containerRows: editableContainerRows.map((r) => ({
					id: r.id,
					containerSize: r.containerSize || null,
					containerNo: r.containerNo || null,
					sealNo: r.sealNo || null,
					portLocation: r.portLocation || null,
					plateNumber: r.plateNumber || null,
					grossWeight: r.grossWeight,
					packageQty: r.packageQty,
				})),
			});
			onOpenChange(false);
		} catch (err: any) {
			toast.error("Lỗi lưu: " + err.message);
		} finally {
			setSaving(false);
		}
	};

	const handleClose = () => {
		selectedFiles.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
		onOpenChange(false);
	};

	const isBusy = analyzing || saving || lookingUpTraTau;
	const hasResults = result !== null;
	const hasAnyData =
		editEportBooking ||
		editCarrierName ||
		editTransitPort ||
		editDestinationPort ||
		editVesselName ||
		editVeselNumber ||
		editCutOffTime ||
		editCutOffAtPort ||
		editBlockCode ||
		editPickOrLiftPlace;

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-[1000px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-base">
						<Ship className="h-4 w-4 text-blue-500" />
						AI Autofill Booking
						{availableModels.length > 1 ? (
							<Select
								value={modelName ? [modelName] : []}
								onValueChange={(val: any) =>
									setModelName(Array.isArray(val) ? val[0] : val)
								}
							>
								<SelectTrigger className="h-6 w-fit min-w-[120px] text-[10px] font-semibold border-blue-200 bg-blue-50 text-blue-700 px-2 py-0">
									<SelectValue placeholder="Chọn model..." />
								</SelectTrigger>
								<SelectPositioner>
									<SelectContent>
										{availableModels.map((m) => (
											<SelectItem
												key={m}
												value={m}
												className="text-[10px] font-semibold text-blue-700"
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
								className="text-[10px] font-semibold border-blue-200 bg-blue-50 text-blue-700 px-1.5 py-0"
							>
								{modelName}
							</Badge>
						) : null}
						{result?.deliveryAt && (
							<Badge
								variant="outline"
								className="text-[10px] font-bold border-blue-200 bg-blue-50 text-blue-700 px-1.5 py-0"
							>
								Cảng: {result.deliveryAt}
							</Badge>
						)}
						<Badge variant="secondary" className="text-xs ml-1">
							{containers.length} container
						</Badge>
					</DialogTitle>
					<DialogDescription className="text-xs">
						Chọn file chứa thông tin booking — AI sẽ trích xuất số booking,
						cảng, tàu và ngày cut-off.
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
									? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm"
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
									loadFolder(rootFolderId, true); // giữ lại file đã chọn khi chuyển tab
							}}
							disabled={!rootFolderId}
							className={cn(
								"flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-all",
								!rootFolderId && "opacity-40 cursor-not-allowed",
								activeTab === "drive"
									? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm"
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
										? "border-blue-400 bg-blue-50"
										: "border-slate-300 hover:border-blue-300",
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
									Ảnh booking, PDF, Word, Excel
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
													className="h-3.5 w-3.5 text-blue-400 shrink-0"
												/>
												<span className="flex-1 truncate">{f.name}</span>
												<button
													type="button"
													onClick={() => openLocalFileInNewTab(f)}
													title="Mở tab mới"
												>
													<ExternalLink className="h-3 w-3 text-muted-foreground hover:text-blue-600" />
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
										onClick={
											() => currentFolderId && loadFolder(currentFolderId, true) // giữ lại file đã chọn khi reload folder
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
															? "bg-blue-500 border-blue-500"
															: "border-slate-300",
													)}
												>
													{driveFiles.every((f) =>
														selectedDriveIds.includes(f.id),
													) && <Check className="h-2.5 w-2.5 text-white" />}
												</div>
												<span>Chọn tất cả ({driveFiles.length} file)</span>
												{selectedDriveIds.length > 0 && (
													<span className="ml-auto text-blue-600 font-semibold">
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
															? "bg-blue-50 dark:bg-blue-950/20"
															: "hover:bg-slate-50 dark:hover:bg-slate-800/50",
													)}
												>
													<div
														className={cn(
															"h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 transition-colors",
															sel
																? "bg-blue-500 border-blue-500"
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
															className="h-3.5 w-3.5 text-blue-400 shrink-0"
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
														<ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-blue-600" />
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
								<p className="text-xs text-blue-600 font-medium">
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

					{/* Analyze button */}
					<Button
						onClick={handleAnalyze}
						disabled={!hasSelection || isBusy}
						className="w-full bg-blue-500 hover:bg-blue-600 text-white gap-2"
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
								{hasResults ? "Phân tích lại" : "Phân tích với AI"}
							</>
						)}
					</Button>

					{/* Warnings */}
					{result && result.warnings && result.warnings.length > 0 && (
						<div className="space-y-1.5">
							{result.warnings.map((w, i) => (
								<div
									key={i}
									className="flex items-start gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-700 rounded-lg text-xs text-red-700 dark:text-red-400"
								>
									<AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
									<span className="whitespace-pre-line">{w}</span>
								</div>
							))}
						</div>
					)}

					{/* Results */}
					{hasResults && (
						<div className="border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
							<div className="bg-blue-50 dark:bg-blue-950/30 px-3 py-2 flex items-center gap-2">
								<CheckCircle2 className="h-4 w-4 text-blue-500" />
								<p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
									{isRestored ? "Kết quả lần trước" : "Kết quả AI"}
								</p>
							</div>

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

							<div className="p-3 space-y-3">
								{/* Carrier + Booking */}
								<div className="grid grid-cols-2 gap-3">
									<div>
										<div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center">
											<Ship className="h-3.5 w-3.5 mr-1.5" />
											Hãng tàu
											<FieldReason
												reason={result?.extractionDetails?.carrierName}
											/>
										</div>
										<input
											value={editCarrierName}
											onChange={(e) => setEditCarrierName(e.target.value)}
											placeholder="Carrier name..."
											className="w-full h-7 text-xs px-2 border rounded bg-background"
										/>
										{result.originalCarrierName && (
											<p
												className="text-[10px] text-amber-600 dark:text-amber-500 font-medium mt-0.5 truncate cursor-pointer hover:underline flex items-center gap-1"
												title="Bấm để lấy tên gốc"
												onClick={() =>
													setEditCarrierName(result.originalCarrierName || "")
												}
											>
												<RefreshCw className="h-2 w-2" />
												Gốc: {result.originalCarrierName}
											</p>
										)}
										{result.carrierNameSuggestions &&
											result.carrierNameSuggestions.length > 0 && (
												<div className="flex flex-wrap gap-1 mt-1.5">
													{result.carrierNameSuggestions.map((s) => (
														<Badge
															key={s}
															variant="outline"
															className="cursor-pointer text-[9px] px-1.5 py-0 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
															onClick={() => setEditCarrierName(s)}
														>
															{s}
														</Badge>
													))}
												</div>
											)}
									</div>
									<div>
										<div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center">
											<Anchor className="h-3.5 w-3.5 mr-1.5" />
											Số BOOKING (EPORT)
											<FieldReason
												reason={result?.extractionDetails?.eportBooking}
											/>
										</div>
										<input
											value={editEportBooking}
											onChange={(e) => setEditEportBooking(e.target.value)}
											placeholder="Nhập số booking..."
											className="w-full h-7 text-xs font-mono px-2 border rounded bg-background"
										/>
										{result.eportBookingSuggestions &&
											result.eportBookingSuggestions.length > 0 && (
												<div className="flex flex-wrap gap-1 mt-1.5 transition-all">
													{result.eportBookingSuggestions.map((s) => (
														<Badge
															key={s}
															variant="outline"
															className="cursor-pointer text-[9px] px-1.5 py-0 hover:bg-blue-50 hover:text-blue-600 border-blue-100 transition-colors"
															onClick={() => setEditEportBooking(s)}
														>
															{s}
														</Badge>
													))}
												</div>
											)}
									</div>
								</div>

								{/* Vessel */}
								<div className="grid grid-cols-2 gap-3">
									<div>
										<div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center">
											<Ship className="h-3.5 w-3.5 mr-1.5" />
											Tên tàu
											<FieldReason
												reason={result?.extractionDetails?.vesselName}
											/>
										</div>
										<input
											value={editVesselName}
											onChange={(e) => setEditVesselName(e.target.value)}
											placeholder="Vessel name..."
											className={cn(
												"w-full h-7 text-xs px-2 border rounded bg-background",
												vesselNameMismatch && "border-red-300 bg-red-50",
											)}
										/>
										{vesselNameMismatch && (
											<div className="mt-1 flex items-center gap-1 text-[10px] text-red-600">
												<AlertCircle className="h-3 w-3" />
												SNP đang trả về tên tàu: {snpInfo.vesselName}
											</div>
										)}
										{result.vesselNameSuggestions &&
											result.vesselNameSuggestions.length > 0 && (
												<div className="flex flex-wrap gap-1 mt-1.5">
													{result.vesselNameSuggestions.map((s) => (
														<Badge
															key={s}
															variant="outline"
															className="cursor-pointer text-[9px] px-1.5 py-0 hover:bg-blue-50 hover:text-blue-600 border-blue-100 transition-colors"
															onClick={() => setEditVesselName(s)}
														>
															{s}
														</Badge>
													))}
												</div>
											)}
									</div>
									<div>
										<div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center">
											<Anchor className="h-3.5 w-3.5 mr-1.5" />
											Số chuyến tàu
											<FieldReason
												reason={result?.extractionDetails?.veselNumber}
											/>
										</div>
										<input
											value={editVeselNumber}
											onChange={(e) => setEditVeselNumber(e.target.value)}
											placeholder="Voyage number..."
											className={cn(
												"w-full h-7 text-xs font-mono px-2 border rounded bg-background",
												veselNumberMismatch && "border-red-300 bg-red-50",
											)}
										/>
										{veselNumberMismatch && (
											<div className="mt-1 flex items-center gap-1 text-[10px] text-red-600">
												<AlertCircle className="h-3 w-3" />
												SNP đang trả về số chuyến: {snpInfo.veselNumber}
											</div>
										)}
										{result.veselNumberSuggestions &&
											result.veselNumberSuggestions.length > 0 && (
												<div className="flex flex-wrap gap-1 mt-1.5">
													{result.veselNumberSuggestions.map((s) => (
														<Badge
															key={s}
															variant="outline"
															className="cursor-pointer text-[9px] px-1.5 py-0 hover:bg-blue-50 hover:text-blue-600 border-blue-100 transition-colors"
															onClick={() => setEditVeselNumber(s)}
														>
															{s}
														</Badge>
													))}
												</div>
											)}
									</div>
								</div>

								{/* Transit Port + Block Code */}
								<div className="grid grid-cols-2 gap-3">
									<div>
										<div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center">
											<MapPin className="h-3.5 w-3.5 mr-1.5" />
											Cảng chuyển tải
											<FieldReason
												reason={result?.extractionDetails?.transitPort}
											/>
										</div>
										<input
											value={editTransitPort}
											onChange={(e) => setEditTransitPort(e.target.value)}
											placeholder="Transit port..."
											className="w-full h-7 text-xs px-2 border rounded bg-background"
										/>
										{result.originalTransitPort && (
											<p
												className="text-[10px] text-amber-600 dark:text-amber-500 font-medium mt-0.5 truncate cursor-pointer hover:underline flex items-center gap-1"
												title="Bấm để lấy tên gốc"
												onClick={() =>
													setEditTransitPort(result.originalTransitPort || "")
												}
											>
												<RefreshCw className="h-2 w-2" />
												Gốc: {result.originalTransitPort}
											</p>
										)}
										{result.transitPortSuggestions &&
											result.transitPortSuggestions.length > 0 && (
												<div className="flex flex-wrap gap-1 mt-1.5">
													{result.transitPortSuggestions.map((s) => (
														<Badge
															key={s}
															variant="outline"
															className="cursor-pointer text-[9px] px-1.5 py-0 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
															onClick={() => setEditTransitPort(s)}
														>
															{s}
														</Badge>
													))}
												</div>
											)}
									</div>
									<div>
										<div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center">
											<Box className="h-3.5 w-3.5 mr-1.5" />
											Block Code
											<FieldReason
												reason={result?.extractionDetails?.blockCode}
											/>
										</div>
										<input
											value={editBlockCode}
											onChange={(e) => setEditBlockCode(e.target.value)}
											placeholder="Nhập block code..."
											className="w-full h-7 text-xs px-2 border rounded bg-background"
										/>
										{result.blockCodeSuggestions &&
											result.blockCodeSuggestions.length > 0 && (
												<div className="flex flex-wrap gap-1 mt-1.5">
													{result.blockCodeSuggestions.map((s) => (
														<Badge
															key={s}
															variant="outline"
															className="cursor-pointer text-[9px] px-1.5 py-0 hover:bg-blue-50 hover:text-blue-600 border-blue-100 transition-colors"
															onClick={() => setEditBlockCode(s)}
														>
															{s}
														</Badge>
													))}
												</div>
											)}
									</div>
								</div>

								{/* Destination Port + Cut-off */}
								<div className="grid grid-cols-2 gap-3">
									<div>
										<div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center">
											<MapPin className="h-3.5 w-3.5 mr-1.5" />
											Cảng đích
											<FieldReason
												reason={result?.extractionDetails?.destinationPort}
											/>
										</div>
										<input
											value={editDestinationPort}
											onChange={(e) => setEditDestinationPort(e.target.value)}
											placeholder="Destination port..."
											className="w-full h-7 text-xs px-2 border rounded bg-background"
										/>
										{result.originalDestinationPort && (
											<p
												className="text-[10px] text-amber-600 dark:text-amber-500 font-medium mt-0.5 truncate cursor-pointer hover:underline flex items-center gap-1"
												title="Bấm để lấy tên gốc"
												onClick={() =>
													setEditDestinationPort(
														result.originalDestinationPort || "",
													)
												}
											>
												<RefreshCw className="h-2 w-2" />
												Gốc: {result.originalDestinationPort}
											</p>
										)}
										{result.destinationPortSuggestions &&
											result.destinationPortSuggestions.length > 0 && (
												<div className="flex flex-wrap gap-1 mt-1.5">
													{result.destinationPortSuggestions.map((s) => (
														<Badge
															key={s}
															variant="outline"
															className="cursor-pointer text-[9px] px-1.5 py-0 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
															onClick={() => setEditDestinationPort(s)}
														>
															{s}
														</Badge>
													))}
												</div>
											)}
									</div>
									<div>
										<div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center">
											<CalendarClock className="h-3.5 w-3.5 mr-1.5" />
											Ngày Cut-off
											<FieldReason
												reason={result?.extractionDetails?.cutOffTime}
											/>
										</div>
										<input
											value={editCutOffTime}
											onChange={(e) => setEditCutOffTime(e.target.value)}
											placeholder="dd/MM/yyyy HH:mm"
											className="w-full h-7 text-xs tabular-nums px-2 border rounded bg-background"
										/>
										{result.cutOffTimeSuggestions &&
											result.cutOffTimeSuggestions.length > 0 && (
												<div className="flex flex-wrap gap-1 mt-1.5">
													{result.cutOffTimeSuggestions.map((s) => (
														<Badge
															key={s}
															variant="outline"
															className="cursor-pointer text-[9px] px-1.5 py-0 hover:bg-blue-50 hover:text-blue-600 border-blue-100 transition-colors"
															onClick={() =>
																setEditCutOffTime(formatDateTimeVN(s))
															}
														>
															{formatDateTimeVN(s)}
														</Badge>
													))}
												</div>
											)}
									</div>
								</div>

								{/* Pick / Lift Place */}
								<div>
									<div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center">
										<MapPin className="h-3.5 w-3.5 mr-1.5" />
										Nơi Lấy/Hạ Container
										<FieldReason
											reason={result?.extractionDetails?.pickOrLiftPlace}
										/>
									</div>
									<input
										value={editPickOrLiftPlace}
										onChange={(e) => setEditPickOrLiftPlace(e.target.value)}
										placeholder="Tên nơi lấy hạ..."
										className="w-full h-7 text-xs px-2 border rounded bg-background"
									/>
									{result.originalPickOrLiftPlace && (
										<p
											className="text-[10px] text-amber-600 dark:text-amber-500 font-medium mt-0.5 truncate cursor-pointer hover:underline flex items-center gap-1"
											title="Bấm để lấy tên gốc"
											onClick={() =>
												setEditPickOrLiftPlace(
													result.originalPickOrLiftPlace || "",
												)
											}
										>
											<RefreshCw className="h-2 w-2" />
											Gốc: {result.originalPickOrLiftPlace}
										</p>
									)}
									{result.pickOrLiftPlaceSuggestions &&
										result.pickOrLiftPlaceSuggestions.length > 0 && (
											<div className="flex flex-wrap gap-1 mt-1.5">
												{result.pickOrLiftPlaceSuggestions.map((s) => (
													<Badge
														key={s}
														variant="outline"
														className="cursor-pointer text-[9px] px-1.5 py-0 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
														onClick={() => setEditPickOrLiftPlace(s)}
													>
														{s}
													</Badge>
												))}
											</div>
										)}
								</div>

								{/* Container stats from booking */}
								{(result.containerQuantity ||
									result.containerSizes.length > 0) && (
									<div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2 text-xs">
										<p className="text-[10px] font-semibold text-muted-foreground mb-1">
											Thông tin container trong booking
										</p>
										<div className="flex gap-3">
											{result.containerQuantity && (
												<span>
													Số lượng:{" "}
													<strong className="text-blue-700">
														{result.containerQuantity}
													</strong>
												</span>
											)}
											{(result.containerSizes?.length ?? 0) > 0 && (
												<span>
													Sizes:{" "}
													<strong className="text-blue-700">
														{result.containerSizes.join(", ")}
													</strong>
												</span>
											)}
										</div>
									</div>
								)}

								{/* Container comparison table */}
								{editableContainerRows.length > 0 && (
									<div>
										<div className="flex items-center justify-between mb-1.5">
											<p className="text-[10px] font-semibold text-muted-foreground uppercase">
												Container ({editableContainerRows.length})
											</p>
											<Button
												type="button"
												size="sm"
												variant="outline"
												onClick={fetchSnpLocations}
												disabled={fetchingLocation || !siteId}
												className="h-6 text-[10px] px-2 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
												title={
													!siteId
														? "Không xác định được cảng từ FCR"
														: "Tra vị trí container tại cảng SNP"
												}
											>
												{fetchingLocation ? (
													<>
														<Loader2 className="h-3 w-3 mr-1 animate-spin" />
														Đang tra...
													</>
												) : (
													<>
														<MapPin className="h-3 w-3 mr-1" />
														Tra vị trí container
													</>
												)}
											</Button>
										</div>
										<div className="border border-slate-200 dark:border-slate-700 rounded overflow-hidden">
											<table className="w-full text-xs">
												<thead>
													<tr className="bg-slate-50 dark:bg-slate-800/80 text-[10px] text-muted-foreground uppercase">
														<th className="px-2 py-1 text-left font-semibold w-[110px]">
															Container Size
														</th>
														<th className="px-2 py-1 text-left font-semibold">
															Container No
														</th>
														<th className="px-2 py-1 text-left font-semibold">
															Seal No
														</th>
														<th className="px-2 py-1 text-left font-semibold w-[80px]">
															GW
														</th>
														<th className="px-2 py-1 text-left font-semibold w-[80px]">
															Package
														</th>
														<th className="px-2 py-1 text-left font-semibold w-[120px]">
															Vị trí container
														</th>
														<th className="px-2 py-1 text-left font-semibold w-[120px]">
															Biển số xe
														</th>
													</tr>
												</thead>
												<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
													{editableContainerRows.map((row, idx) => {
														// Per-row AI data
														const aiContainer =
															result.containers?.[idx] ?? null;
														const aiSizeRaw =
															aiContainer?.containerSize ??
															result.containerSizes?.[idx] ??
															null;
														const aiSizeResolved = resolveSize(aiSizeRaw);
														const aiContainerNo =
															aiContainer?.containerNo ?? null;
														const aiSealNo = aiContainer?.sealNo ?? null;
														const aiGrossWeight =
															aiContainer?.grossWeight ?? null;
														const aiPackageQty =
															aiContainer?.packageQty ?? null;
														const origRow = originalContainerRows[idx];

														// Mismatch: different after normalize (so "40 HC" === "40HC" is NOT a mismatch)
														const sizeMismatch =
															aiSizeRaw &&
															normalizeSize(aiSizeResolved) !==
																normalizeSize(row.containerSize);
														const noMismatch =
															aiContainerNo &&
															aiContainerNo.toUpperCase() !==
																row.containerNo.toUpperCase();
														const sealMismatch =
															aiSealNo && aiSealNo !== row.sealNo;
														const gwMismatch =
															aiGrossWeight !== null &&
															aiGrossWeight !== row.grossWeight;
														const qtyMismatch =
															aiPackageQty !== null &&
															aiPackageQty !== row.packageQty;

														// Is the row currently set to the AI value? (for toggle reverting)
														const sizeIsAi =
															aiSizeResolved &&
															row.containerSize === aiSizeResolved;
														const noIsAi =
															aiContainerNo &&
															row.containerNo.toUpperCase() ===
																aiContainerNo.toUpperCase();
														const sealIsAi =
															aiSealNo && row.sealNo === aiSealNo;

														return (
															<tr key={row.id}>
																<td className="px-1 py-0.5">
																	<div className="space-y-0.5">
																		<VirtualizedCombobox
																			items={sizeOptions}
																			value={row.containerSize}
																			onChange={(val) =>
																				setEditableContainerRows((prev) =>
																					prev.map((r) =>
																						r.id === row.id
																							? { ...r, containerSize: val }
																							: r,
																					),
																				)
																			}
																			placeholder="Chọn size..."
																			searchPlaceholder="Tìm size..."
																			showClearOption={true}
																			triggerClassName={`flex h-6 w-full items-center justify-between rounded px-1.5 py-0 text-[11px] font-mono border bg-background ${
																				sizeMismatch
																					? "border-amber-400"
																					: sizeIsAi &&
																							origRow?.containerSize !==
																								aiSizeResolved
																						? "border-blue-400"
																						: ""
																			}`}
																		/>
																		{sizeMismatch && aiSizeResolved && (
																			<button
																				type="button"
																				onClick={() =>
																					setEditableContainerRows((prev) =>
																						prev.map((r) =>
																							r.id === row.id
																								? {
																										...r,
																										containerSize:
																											aiSizeResolved,
																									}
																								: r,
																						),
																					)
																				}
																				className="w-full text-left text-[9px] text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 flex items-center gap-0.5 group"
																				title="Bấm để áp dụng giá trị AI"
																			>
																				<span className="group-hover:underline">
																					⚠️ AI:{" "}
																					<span className="font-mono font-bold">
																						{aiSizeResolved}
																					</span>
																				</span>
																				<span className="ml-auto opacity-0 group-hover:opacity-100 text-[8px] border border-amber-400 rounded px-0.5">
																					áp dụng
																				</span>
																			</button>
																		)}
																		{!sizeMismatch &&
																			sizeIsAi &&
																			origRow?.containerSize &&
																			origRow.containerSize !==
																				aiSizeResolved && (
																				<button
																					type="button"
																					onClick={() =>
																						setEditableContainerRows((prev) =>
																							prev.map((r) =>
																								r.id === row.id
																									? {
																											...r,
																											containerSize:
																												origRow.containerSize,
																										}
																									: r,
																							),
																						)
																					}
																					className="w-full text-left text-[9px] text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-0.5 group"
																					title="Quay về giá trị ban đầu"
																				>
																					<span className="group-hover:underline">
																						↩ DB:{" "}
																						<span className="font-mono font-bold">
																							{origRow.containerSize}
																						</span>
																					</span>
																				</button>
																			)}
																	</div>
																</td>
																<td className="px-1 py-0.5">
																	<div className="space-y-0.5">
																		<input
																			value={row.containerNo}
																			onChange={(e) =>
																				setEditableContainerRows((prev) =>
																					prev.map((r) =>
																						r.id === row.id
																							? {
																									...r,
																									containerNo:
																										e.target.value.toUpperCase(),
																								}
																							: r,
																					),
																				)
																			}
																			placeholder="MSCU1234567"
																			className={`w-full h-6 text-xs font-mono px-1.5 border rounded bg-background ${
																				noMismatch
																					? "border-amber-400"
																					: noIsAi &&
																							origRow?.containerNo &&
																							origRow.containerNo.toUpperCase() !==
																								aiContainerNo?.toUpperCase()
																						? "border-blue-400"
																						: ""
																			}`}
																		/>
																		{noMismatch && aiContainerNo && (
																			<button
																				type="button"
																				onClick={() =>
																					setEditableContainerRows((prev) =>
																						prev.map((r) =>
																							r.id === row.id
																								? {
																										...r,
																										containerNo:
																											aiContainerNo.toUpperCase(),
																									}
																								: r,
																						),
																					)
																				}
																				className="w-full text-left text-[9px] text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 flex items-center gap-0.5 group"
																				title="Bấm để áp dụng giá trị AI"
																			>
																				<span className="group-hover:underline">
																					⚠️ AI:{" "}
																					<span className="font-mono font-bold">
																						{aiContainerNo}
																					</span>
																				</span>
																				<span className="ml-auto opacity-0 group-hover:opacity-100 text-[8px] border border-amber-400 rounded px-0.5">
																					áp dụng
																				</span>
																			</button>
																		)}
																		{!noMismatch &&
																			noIsAi &&
																			origRow?.containerNo &&
																			origRow.containerNo.toUpperCase() !==
																				aiContainerNo?.toUpperCase() && (
																				<button
																					type="button"
																					onClick={() =>
																						setEditableContainerRows((prev) =>
																							prev.map((r) =>
																								r.id === row.id
																									? {
																											...r,
																											containerNo:
																												origRow.containerNo,
																										}
																									: r,
																							),
																						)
																					}
																					className="w-full text-left text-[9px] text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-0.5 group"
																					title="Quay về giá trị ban đầu"
																				>
																					<span className="group-hover:underline">
																						↩ DB:{" "}
																						<span className="font-mono font-bold">
																							{origRow.containerNo}
																						</span>
																					</span>
																				</button>
																			)}
																	</div>
																</td>
																<td className="px-1 py-0.5">
																	<div className="space-y-0.5">
																		<input
																			value={row.sealNo}
																			onChange={(e) =>
																				setEditableContainerRows((prev) =>
																					prev.map((r) =>
																						r.id === row.id
																							? { ...r, sealNo: e.target.value }
																							: r,
																					),
																				)
																			}
																			placeholder="VN123456"
																			className={`w-full h-6 text-xs font-mono px-1.5 border rounded bg-background ${
																				sealMismatch
																					? "border-amber-400"
																					: sealIsAi &&
																							origRow?.sealNo &&
																							origRow.sealNo !== aiSealNo
																						? "border-blue-400"
																						: ""
																			}`}
																		/>
																		{sealMismatch && aiSealNo && (
																			<button
																				type="button"
																				onClick={() =>
																					setEditableContainerRows((prev) =>
																						prev.map((r) =>
																							r.id === row.id
																								? { ...r, sealNo: aiSealNo }
																								: r,
																						),
																					)
																				}
																				className="w-full text-left text-[9px] text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 flex items-center gap-0.5 group"
																				title="Bấm để áp dụng giá trị AI"
																			>
																				<span className="group-hover:underline">
																					⚠️ AI:{" "}
																					<span className="font-mono font-bold">
																						{aiSealNo}
																					</span>
																				</span>
																				<span className="ml-auto opacity-0 group-hover:opacity-100 text-[8px] border border-amber-400 rounded px-0.5">
																					áp dụng
																				</span>
																			</button>
																		)}
																		{!sealMismatch &&
																			sealIsAi &&
																			origRow?.sealNo &&
																			origRow.sealNo !== aiSealNo && (
																				<button
																					type="button"
																					onClick={() =>
																						setEditableContainerRows((prev) =>
																							prev.map((r) =>
																								r.id === row.id
																									? {
																											...r,
																											sealNo: origRow.sealNo,
																										}
																									: r,
																							),
																						)
																					}
																					className="w-full text-left text-[9px] text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-0.5 group"
																					title="Quay về giá trị ban đầu"
																				>
																					<span className="group-hover:underline">
																						↩ DB:{" "}
																						<span className="font-mono font-bold">
																							{origRow.sealNo}
																						</span>
																					</span>
																				</button>
																			)}
																	</div>
																</td>
																<td className="px-1 py-0.5">
																	<div className="space-y-0.5">
																		<input
																			type="number"
																			value={row.grossWeight ?? ""}
																			onChange={(e) =>
																				setEditableContainerRows((prev) =>
																					prev.map((r) =>
																						r.id === row.id
																							? {
																									...r,
																									grossWeight: e.target.value
																										? parseFloat(e.target.value)
																										: null,
																								}
																							: r,
																					),
																				)
																			}
																			placeholder="GW"
																			className={`w-full h-6 text-xs px-1.5 border rounded bg-background ${
																				gwMismatch ? "border-amber-400" : ""
																			}`}
																		/>
																		{gwMismatch && aiGrossWeight !== null && (
																			<button
																				type="button"
																				onClick={() =>
																					setEditableContainerRows((prev) =>
																						prev.map((r) =>
																							r.id === row.id
																								? {
																										...r,
																										grossWeight: aiGrossWeight,
																									}
																								: r,
																						),
																					)
																				}
																				className="w-full text-left text-[9px] text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 flex items-center gap-0.5 group"
																				title="Bấm để áp dụng giá trị AI"
																			>
																				<span className="group-hover:underline">
																					⚠️ AI:{" "}
																					<span className="font-mono font-bold">
																						{aiGrossWeight}
																					</span>
																				</span>
																				<span className="ml-auto opacity-0 group-hover:opacity-100 text-[8px] border border-amber-400 rounded px-0.5">
																					áp dụng
																				</span>
																			</button>
																		)}
																	</div>
																</td>
																<td className="px-1 py-0.5">
																	<div className="space-y-0.5">
																		<input
																			type="number"
																			value={row.packageQty ?? ""}
																			onChange={(e) =>
																				setEditableContainerRows((prev) =>
																					prev.map((r) =>
																						r.id === row.id
																							? {
																									...r,
																									packageQty: e.target.value
																										? parseFloat(e.target.value)
																										: null,
																								}
																							: r,
																					),
																				)
																			}
																			placeholder="Qty"
																			className={`w-full h-6 text-xs px-1.5 border rounded bg-background ${
																				qtyMismatch ? "border-amber-400" : ""
																			}`}
																		/>
																		{qtyMismatch && aiPackageQty !== null && (
																			<button
																				type="button"
																				onClick={() =>
																					setEditableContainerRows((prev) =>
																						prev.map((r) =>
																							r.id === row.id
																								? {
																										...r,
																										packageQty: aiPackageQty,
																									}
																								: r,
																						),
																					)
																				}
																				className="w-full text-left text-[9px] text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 flex items-center gap-0.5 group"
																				title="Bấm để áp dụng giá trị AI"
																			>
																				<span className="group-hover:underline">
																					⚠️ AI:{" "}
																					<span className="font-mono font-bold">
																						{aiPackageQty}
																					</span>
																				</span>
																				<span className="ml-auto opacity-0 group-hover:opacity-100 text-[8px] border border-amber-400 rounded px-0.5">
																					áp dụng
																				</span>
																			</button>
																		)}
																	</div>
																</td>
																<td className="px-1 py-0.5">
																	<input
																		value={row.portLocation}
																		onChange={(e) =>
																			setEditableContainerRows((prev) =>
																				prev.map((r) =>
																					r.id === row.id
																						? {
																								...r,
																								portLocation: e.target.value,
																							}
																						: r,
																				),
																			)
																		}
																		placeholder={
																			fetchingLocation
																				? "Đang tra..."
																				: siteId
																					? "—"
																					: "Không khả dụng"
																		}
																		className={`w-full h-6 text-xs font-mono px-1.5 border rounded bg-background ${
																			row.portLocation
																				? "border-emerald-400 text-emerald-700 dark:text-emerald-400"
																				: ""
																		}`}
																	/>
																</td>
																<td className="px-1 py-0.5">
																	<input
																		value={row.plateNumber}
																		onChange={(e) =>
																			setEditableContainerRows((prev) =>
																				prev.map((r) =>
																					r.id === row.id
																						? {
																								...r,
																								plateNumber: e.target.value,
																							}
																						: r,
																				),
																			)
																		}
																		placeholder={
																			fetchingLocation
																				? "Đang tra..."
																				: siteId
																					? "—"
																					: ""
																		}
																		className={`w-full h-6 text-xs font-mono px-1.5 border rounded bg-background ${
																			row.plateNumber
																				? "border-emerald-400 text-emerald-700 dark:text-emerald-400"
																				: ""
																		}`}
																	/>
																</td>
															</tr>
														);
													})}
												</tbody>
											</table>
										</div>

										{(snpInfo.customsStatuses.length > 0 ||
											snpInfo.truckVessels.length > 0) && (
											<div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
												<div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase text-blue-700">
													<Info className="h-3.5 w-3.5" />
													Thông tin SNP
												</div>
												<div className="space-y-2 text-xs">
													<div className="flex flex-wrap items-center gap-2">
														<span className="font-medium text-slate-600">
															Tình trạng thông quan:
														</span>
														{snpInfo.customsStatuses.length > 0 ? (
															snpInfo.customsStatuses.map((status) => (
																<Badge
																	key={status}
																	variant="outline"
																	className="border-blue-200 bg-white text-blue-700"
																>
																	{status}
																</Badge>
															))
														) : (
															<span className="text-muted-foreground">-</span>
														)}
													</div>
													{snpInfo.truckVessels.length > 0 && (
														<div className="text-slate-600">
															SNP tàu/chuyến:{" "}
															<span className="font-medium text-slate-900">
																{snpInfo.truckVessels.join(" | ")}
															</span>
														</div>
													)}
												</div>
											</div>
										)}
									</div>
								)}

								{/* Cut Off at Port (from Tra tàu API) */}
								<div>
									<div className="flex items-center justify-between mb-1.5">
										<div className="flex items-center gap-1.5">
											<Ship className="h-3 w-3 text-purple-500" />
											<p className="text-[10px] font-semibold text-muted-foreground uppercase">
												Cut Off tại cảng
											</p>
											{traTauMessage && (
												<span
													className={cn(
														"text-[10px] font-medium",
														traTauMessageType === "success"
															? "text-emerald-600"
															: "text-red-500",
													)}
												>
													{traTauMessage}
												</span>
											)}
										</div>
										<Button
											type="button"
											size="sm"
											variant="outline"
											onClick={handleLookupTraTau}
											disabled={lookingUpTraTau}
											className="h-6 text-[10px] px-2 bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 dark:bg-indigo-950/30 dark:border-indigo-800 dark:text-indigo-400"
										>
											{lookingUpTraTau ? (
												<>
													<Loader2 className="h-3 w-3 mr-1 animate-spin" />
													Đang tra...
												</>
											) : (
												<>
													<Ship className="h-3 w-3 mr-1" />
													Tra tàu
												</>
											)}
										</Button>
									</div>
									<input
										value={editCutOffAtPort}
										onChange={(e) => setEditCutOffAtPort(e.target.value)}
										placeholder="dd/MM/yyyy HH:mm"
										className="w-full h-7 text-xs tabular-nums px-2 border rounded bg-background"
									/>
								</div>
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
					{hasResults && hasAnyData && (
						<Button
							size="sm"
							onClick={handleConfirm}
							disabled={isBusy}
							className="bg-blue-500 hover:bg-blue-600 text-white gap-1"
						>
							{saving ? (
								<>
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
									Đang lưu...
								</>
							) : (
								<>
									<CheckCircle2 className="h-3.5 w-3.5" />
									Xác nhận
								</>
							)}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
