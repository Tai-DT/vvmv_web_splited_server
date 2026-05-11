"use client";

import {
	AlertTriangle,
	CheckCircle2,
	ChevronDown,
	Clock,
	Cpu,
	FileArchive,
	FileCheck,
	File as FileIcon,
	FileJson,
	FileSearch,
	FileSpreadsheet,
	FileText,
	FileText as FileTextIcon,
	HardDrive,
	History,
	Image as ImageIcon,
	RefreshCw,
	Search,
	Sparkles,
	Table as TableIcon,
	Tag,
	Trash2,
	X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
import { Spinner } from "@/components/ui/spinner";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipPositioner,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface GeminiAutoFillDialogProps {
	id: string;
	type: "followup" | "trucking";
	jobNumber: string;
	driveUrl?: string | null;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
	initialData?: any;
}

/** Same order as ECUS / FOLLOWUP_CARGO_COLUMNS for consistent AI + paste hints */
const CARGO_COLUMNS = [
	{ key: "customCode", label: "Mã hàng", type: "text", minWidth: "130px" },
	{
		key: "vietnameseName",
		label: "Tên hàng (mô tả chi tiết)",
		type: "text",
		minWidth: "400px",
	},
	{ key: "hsCode", label: "Mã HS", type: "text", minWidth: "120px" },
	{ key: "originalCountry", label: "Xuất xứ", type: "text", minWidth: "140px" },
	{ key: "qty", label: "Lượng", type: "number", minWidth: "80px" },
	{ key: "unit", label: "Đơn vị tính", type: "text", minWidth: "90px" },
	{ key: "qty2", label: "Lượng 2", type: "number", minWidth: "90px" },
	{ key: "unit2", label: "Đơn vị tính 2", type: "text", minWidth: "100px" },
	{
		key: "unitPrice",
		label: "Đơn giá hóa đơn",
		type: "number",
		minWidth: "100px",
	},
	{
		key: "totalPrice",
		label: "Trị giá hóa đơn",
		type: "number",
		minWidth: "120px",
	},
	{
		key: "lineTaxableValue",
		label: "Trị giá tính thuế",
		type: "number",
		minWidth: "120px",
	},
	{
		key: "exportTaxRatePercent",
		label: "TS XK(%)",
		type: "number",
		minWidth: "90px",
	},
	{
		key: "exportTaxAmount",
		label: "Tiền thuế XK",
		type: "number",
		minWidth: "110px",
	},
	{
		key: "taxableUnitPrice",
		label: "Đơn giá tính thuế",
		type: "number",
		minWidth: "120px",
	},
	{
		key: "imExDutyExemptionCode",
		label: "Mã miễn giảm không chịu thuế XNK",
		type: "text",
		minWidth: "190px",
	},
	{
		key: "imExDutyExemptionCondition",
		label: "Điều kiện miễn giảm thuế XNK",
		type: "text",
		minWidth: "180px",
	},
	{
		key: "imExDutyExemptionAmount",
		label: "Tiền miễn giảm thuế XNK",
		type: "number",
		minWidth: "140px",
	},
	{
		key: "importTaxCode",
		label: "Mã biểu thuế nhập khẩu",
		type: "text",
		minWidth: "160px",
	},
	{
		key: "importTaxRate",
		label: "Thuế suất nhập khẩu",
		type: "number",
		minWidth: "120px",
	},
	{
		key: "importTaxAmount",
		label: "Tiền thuế nhập khẩu",
		type: "number",
		minWidth: "130px",
	},
	{
		key: "vatTaxCode",
		label: "Mã biểu thuế VAT",
		type: "text",
		minWidth: "130px",
	},
	{
		key: "vatTaxRate",
		label: "Thuế suất VAT",
		type: "number",
		minWidth: "110px",
	},
	{
		key: "vatTaxAmount",
		label: "Tiền thuế VAT",
		type: "number",
		minWidth: "120px",
	},
	{
		key: "dutyReductionCode",
		label: "Mã miễn giảm",
		type: "text",
		minWidth: "130px",
	},
	{
		key: "originalCargoName",
		label: "Tên hàng trên chứng từ",
		type: "text",
		minWidth: "320px",
	},
] as const;

interface DriveFile {
	id: string;
	name: string;
	mimeType: string;
}

/**
 * Removes null, undefined, and empty string values from an object to save tokens.
 */
function scrubData(data: any) {
	if (!data) return data;
	const scrubbed = JSON.parse(JSON.stringify(data)); // Deep clone
	const recursiveScrub = (obj: any) => {
		Object.keys(obj).forEach((key) => {
			const val = obj[key];
			if (val === null || val === undefined || val === "") {
				delete obj[key];
			} else if (Array.isArray(val)) {
				obj[key] = val.map((item) => recursiveScrub(item));
			} else if (typeof val === "object" && !(val instanceof Date)) {
				recursiveScrub(val);
			}
		});
		return obj;
	};
	return recursiveScrub(scrubbed);
}

export function GeminiAutoFillDialog({
	id,
	type,
	jobNumber,
	driveUrl,
	isOpen,
	onOpenChange,
	onSuccess,
	initialData,
}: GeminiAutoFillDialogProps) {
	const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
	const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
	const [fetchingFiles, setFetchingFiles] = useState(false);
	const [analyzedFiles, setAnalyzedFiles] = useState<DriveFile[]>([]);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [suggestingMissing, setSuggestingMissing] = useState(false);
	const [extractedData, setExtractedData] = useState<any>(null);
	const [aiOriginalData, setAiOriginalData] = useState<any>(null);
	const [cargoTypes, setCargoTypes] = useState<string[]>([]);
	const [units, setUnits] = useState<string[]>([]);
	const [hsSuggestions, setHsSuggestions] = useState<
		Record<number, { code: string; desc: string }[]>
	>({});
	const [dataConflicts, setDataConflicts] = useState<
		Record<
			string,
			{
				values: { value: string; source: string }[];
				selected: string;
				reason: string;
			}
		>
	>({});
	const [cargoConflicts, setCargoConflicts] = useState<
		Record<
			number,
			Record<
				string,
				{
					values: { value: string; source: string }[];
					selected: string;
					reason: string;
				}
			>
		>
	>({});
	const [chatHistory, setChatHistory] = useState<
		{ role: "user" | "model"; parts: { text: string }[] }[]
	>([]);
	const [chatInput, setChatInput] = useState("");
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [sessions, setSessions] = useState<
		{ id: string; label: string; date: string; fileNames?: string[] }[]
	>([]);
	const [userCustomPrompt, setUserCustomPrompt] = useState("");
	const [promptHistory, setPromptHistory] = useState<
		{
			prompt: string;
			taxCode: string | null;
			operationType: string | null;
			serviceMode: string | null;
			priority: number;
			count?: number;
		}[]
	>([]);
	const [showPromptHistory, setShowPromptHistory] = useState(false);
	const [promptSearch, setPromptSearch] = useState("");
	const [fetchingPrompts, setFetchingPrompts] = useState(false);
	const [selectedModel, setSelectedModel] = useState<string>(
		process.env.NEXT_PUBLIC_GEMINI_AUTOFILL_MODEL_FLASH || "gemini-2.5-flash",
	);
	const promptRef = useRef<HTMLDivElement>(null);

	// Derived context
	const taxCode = initialData?.taxCode as string | undefined;
	const operationType = initialData?.operationType as string | undefined;
	const serviceMode = initialData?.serviceMode as string | undefined;

	const hasMissingHsSuggestions = useMemo(() => {
		if (!extractedData?.cargoList) return false;
		return extractedData.cargoList.some(
			(_item: any, idx: number) =>
				!hsSuggestions[idx] || hsSuggestions[idx].length === 0,
		);
	}, [extractedData?.cargoList, hsSuggestions]);

	// Extract Folder ID from driveUrl
	const folderId = useMemo(() => {
		if (!driveUrl) return null;
		const match = driveUrl.match(/folders\/([a-zA-Z0-9_-]+)/);
		return match ? match[1] : null;
	}, [driveUrl]);

	const fetchDriveFiles = async (fid: string) => {
		setFetchingFiles(true);
		try {
			const response = await fetch(`/api/google-drive/files?folderId=${fid}`);
			const data = await response.json();
			if (response.ok) {
				setDriveFiles(data.files || []);
				// Auto-select files that look like documents (optional)
			} else {
				toast.error(`Không thể lấy danh sách file từ Drive: ${data.message}`);
			}
		} catch (_error) {
			toast.error("Lỗi kết nối bộ nhớ Drive");
		} finally {
			setFetchingFiles(false);
		}
	};

	const fetchChatHistory = async (job: string, sid?: string) => {
		try {
			const url = sid
				? `/api/gemini/history?jobNumber=${job}&sessionId=${sid}`
				: `/api/gemini/history?jobNumber=${job}`;

			const res = await fetch(url);
			const data = await res.json();

			if (data.sessions) {
				setSessions(data.sessions);
			}

			if (data.history) {
				setChatHistory(data.history);
			}
			if (data.latestData) {
				setExtractedData(data.latestData);
			}
			if (data.currentSessionId) {
				setSessionId(data.currentSessionId);
			}
			// Restore analyzed files from DB fileNames
			if (
				data.fileNames &&
				Array.isArray(data.fileNames) &&
				data.fileNames.length > 0
			) {
				const fileIds: string[] = data.fileIds || [];
				const restoredFiles: DriveFile[] = (data.fileNames as string[]).map(
					(name: string, i: number) => ({
						id: fileIds[i] || `history-${i}`,
						name,
						mimeType: name.endsWith(".pdf")
							? "application/pdf"
							: name.endsWith(".xlsx") || name.endsWith(".xls")
								? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
								: name.endsWith(".docx") || name.endsWith(".doc")
									? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
									: name.match(/\.(jpg|jpeg|png|gif|webp)$/i)
										? "image/jpeg"
										: "application/octet-stream",
					}),
				);
				setAnalyzedFiles(restoredFiles);
			}
		} catch (e) {
			console.error("Failed to load chat history:", e);
		}
	};

	const fetchPromptHistory = async (search?: string, goal?: string) => {
		setFetchingPrompts(true);
		try {
			const params = new URLSearchParams();
			if (taxCode) params.set("taxCode", taxCode);
			if (operationType) params.set("operationType", operationType);
			if (serviceMode) params.set("serviceMode", serviceMode);
			if (search) params.set("search", search);
			if (goal) params.set("goal", goal);
			const res = await fetch(`/api/gemini/prompts?${params.toString()}`);
			const data = await res.json();
			if (data.prompts) setPromptHistory(data.prompts);
		} catch (e) {
			console.error(e);
		} finally {
			setFetchingPrompts(false);
		}
	};

	// Fetch files from Drive folder when dialog opens
	useEffect(() => {
		if (isOpen && folderId) {
			fetchDriveFiles(folderId);
		}
	}, [isOpen, folderId, fetchDriveFiles]);

	// Fetch Cargo Types and Units
	useEffect(() => {
		if (isOpen) {
			fetch("/api/cargo-types")
				.then((res) => res.json())
				.then((data) => {
					if (data.cargoTypes) {
						// Deduplicate to avoid React key errors
						setCargoTypes(Array.from(new Set(data.cargoTypes as string[])));
					}
				})
				.catch(console.error);

			fetch("/api/units")
				.then((res) => res.json())
				.then((data) => {
					if (data.units) {
						// Deduplicate to avoid React key errors
						setUnits(Array.from(new Set(data.units as string[])));
					}
				})
				.catch(console.error);

			// Fetch prompt history
			fetchPromptHistory(undefined, "extract");
			// Fetch persistent chat history for this job
			fetchChatHistory(jobNumber);
		}
	}, [
		isOpen,
		jobNumber, // Fetch persistent chat history for this job
		fetchChatHistory, // Fetch prompt history
		fetchPromptHistory,
	]);

	// Close prompt history dropdown when clicking outside
	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (promptRef.current && !promptRef.current.contains(e.target as Node)) {
				setShowPromptHistory(false);
			}
		};
		if (showPromptHistory) document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [showPromptHistory]);

	const getFileIcon = (mimeType: string, fileName: string) => {
		const ext = fileName.split(".").pop()?.toLowerCase();
		if (
			mimeType.includes("spreadsheet") ||
			mimeType.includes("excel") ||
			ext === "csv" ||
			ext === "xlsx" ||
			ext === "xls"
		) {
			return <FileSpreadsheet className="w-4 h-4 text-emerald-600" />;
		}
		if (mimeType.startsWith("image/")) {
			return <ImageIcon className="w-4 h-4 text-purple-600" />;
		}
		if (mimeType.includes("pdf")) {
			return <FileTextIcon className="w-4 h-4 text-rose-600" />;
		}
		if (mimeType.includes("word") || ext === "doc" || ext === "docx") {
			return <FileTextIcon className="w-4 h-4 text-blue-600" />;
		}
		if (mimeType.includes("json")) {
			return <FileJson className="w-4 h-4 text-amber-600" />;
		}
		if (
			mimeType.includes("zip") ||
			mimeType.includes("compressed") ||
			ext === "zip" ||
			ext === "rar"
		) {
			return <FileArchive className="w-4 h-4 text-orange-600" />;
		}
		return <FileIcon className="w-4 h-4 text-gray-400" />;
	};

	const normalizeConfirmIntentText = (value: string) =>
		value
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/đ/g, "d")
			.replace(/Đ/g, "D")
			.toLowerCase()
			.trim();

	const shouldAutoSaveFromChatConfirmation = (message: string) => {
		const normalized = normalizeConfirmIntentText(message);
		if (normalized.length === 0) return false;
		const confirmKeywords = [
			"xac nhan",
			"dong y",
			"ok luon",
			"ok save",
			"luu luon",
			"luu di",
			"save luon",
			"save di",
			"chap nhan",
			"truyen vao",
			"truyen du lieu vao",
			"ap dung vao he thong",
			"dien vao he thong",
			"cap nhat vao he thong",
			"dua vao he thong",
			"theo yeu cau",
		];
		return confirmKeywords.some((keyword) => normalized.includes(keyword));
	};

	const saveExtractedData = async (payload: any, successMessage?: string) => {
		if (!payload) return false;
		setSaving(true);
		try {
			const { conflicts: _conflicts, ...dataToSave } = payload;

			// Convert date strings to Date objects for FollowUp
			if (type === "followup") {
				["deliveryDate", "transportDate", "etaEtd"].forEach((key) => {
					if (dataToSave[key] !== undefined) {
						if (dataToSave[key]) {
							const d = new Date(dataToSave[key]);
							if (!Number.isNaN(d.getTime())) {
								dataToSave[key] = d;
							} else {
								dataToSave[key] = null;
							}
						} else {
							dataToSave[key] = null;
						}
					}
				});
			}

			const response = await fetch("/api/followup/bulk-update", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id, type, data: dataToSave }),
			});

			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.message || "Failed to save data");
			}

			toast.success(successMessage || "Đã cập nhật dữ liệu vào hệ thống!");
			onSuccess?.();
			onOpenChange(false);
			return true;
		} catch (error: any) {
			toast.error(`Lỗi lưu dữ liệu: ${error.message}`);
			return false;
		} finally {
			setSaving(false);
		}
	};

	const toggleFileSelection = (fileId: string) => {
		setSelectedFileIds((prev) =>
			prev.includes(fileId)
				? prev.filter((id) => id !== fileId)
				: [...prev, fileId],
		);
	};

	const handleAnalyze = async () => {
		if (selectedFileIds.length === 0) {
			toast.error("Vui lòng chọn ít nhất một file để phân tích");
			return;
		}

		const newSid = crypto.randomUUID();
		setSessionId(newSid);
		setLoading(true);
		setExtractedData(null);
		setChatHistory([]);
		setChatInput("");

		try {
			const operationType = initialData?.operationType;
			const etaInstruction =
				operationType === "XUAT"
					? "Vì đây là hàng XUẤT (Export), trường `etaEtd` phải là ngày Estimated Time of Departure (ETD - ngày tàu chạy/máy bay cất cánh/hàng đi)."
					: operationType === "NHAP"
						? "Vì đây là hàng NHẬP (Import), trường `etaEtd` phải là ngày Estimated Time of Arrival (ETA - ngày tàu/máy bay/hàng đến)."
						: "Trường `etaEtd` là ngày ETA (ngày đến) đối với hàng nhập, hoặc là ngày ETD (ngày đi) đối với hàng xuất.";

			const systemInstruction = `Bạn là trợ lý chuyên nghiệp về Logistics. Nhiệm vụ của bạn là phân tích các tài liệu được cung cấp và trích xuất thông tin chính xác theo cấu trúc JSON.
      
      QUY TẮC QUAN TRỌNG:
      1. Các trường ngày (deliveryDate, transportDate, etaEtd, invoiceDate) PHẢI trả về định dạng YYYY-MM-DD.
      2. ${etaInstruction}
      3. Nếu mã HS (hsCode) không có sẵn trong tài liệu, hãy dựa vào mô tả hàng hóa (vietnameseName) để GỢI Ý tối đa 3 trường hợp mã HS 8 số phù hợp (theo biểu thuế VN) vào mảng "hsCodeSuggestions" (mỗi item gồm "code" và "desc" giải thích khi nào chọn mã này), đồng thời chọn ra mã đúng nhất gán vào trường "hsCode".
      4. Đối với các trường số (grossWeight, cbm, quantity, qty, unitPrice, totalPrice, qty2, packageQty), hãy đảm bảo trả về kiểu số (number), không phải chuỗi (string).
      5. ĐIỀU KHOẢN ĐẶC BIỆT (XỬ LÝ MÂU THUẪN DỮ LIỆU): Nếu phát hiện thông tin mâu thuẫn giữa các file, hãy trích xuất giá trị từ tài liệu tin cậy hơn và TRẢ VỀ đối tượng "conflicts" chứa tất cả giá trị phát hiện được. 
         - Cấu trúc: "conflicts": { "<tên_trường>": { "values": [{ "value": "...", "source": "..." }], "selected": "...", "reason": "..." } }
      6. Đối với mâu thuẫn trong các mục dữ liệu của "cargoList", hãy bổ sung thuộc tính "conflicts" tương tự vào chính item đó trong mảng. Trong đó, mỗi trường bị mâu thuẫn (ví dụ: hsCode, qty, grossWeight) phải là một key trong đối tượng "conflicts" đó.
      
      CẤU TRÚC JSON BẮT BUỘC:
      {
        "cargoType": "...",
        "billOrBooking": "...",
        "invoice": "...",
        "grossWeight": 0.0,
        "cbm": 0.0,
        "quantity": 0,
        "unit": "...",
        "commodityName": "...",
        "pol": "...",
        "pod": "...",
        "warehouse": "...",
        "deliveryDate": "YYYY-MM-DD",
        "poNumber": "...",
        "pickupLocation": "...",
        "loadingLocation": "...",
        "transportMethod": "...",
        "transportDate": "YYYY-MM-DD",
        "taxService": "...",
        "etaEtd": "YYYY-MM-DD",
        "notes": "...",
        "cargoList": [
          {
            "customCode": "...",
            "hsCode": "...",
            "originalCountry": "...",
            "originalCargoName": "...",
            "dutyReductionCode": "...",
            "imExDutyExemptionCode": "...",
            "hsCodeSuggestions": [
              {
                "code": "...",
                "desc": "..."
              }
            ],
            "qty": 0.0,
            "unit": "...",
            "unitPrice": 0.0,
            "totalPrice": 0.0,
            "qty2": 0.0,
            "unit2": "...",
            "vietnameseName": "...",
            "importTaxCode": "...",
            "importTaxRate": 0.0,
            "importTaxAmount": 0.0,
            "vatTaxCode": "...",
            "vatTaxRate": 0.0,
            "vatTaxAmount": 0.0,
            "imExDutyExemptionCondition": "...",
            "imExDutyExemptionAmount": 0.0,
            "importer": "...",
            "packageQty": 0.0,
            "packageType": "...",
            "grossWeight": 0.0,
            "invoiceNo": "...",
            "invoiceDate": "YYYY-MM-DD",
            "term": "..."
          }
        ]
      }
      
      Hãy phân tích tài liệu đính kèm và trích xuất thông tin cho Job Logistics có số: ${jobNumber}.`;

			const userPrompt =
				userCustomPrompt.trim() ||
				"Phân tích tài liệu và trích xuất thông tin theo cấu trúc đã yêu cầu.";

			// Validation for unsupported formats before calling API
			for (const fileId of selectedFileIds) {
				const fileInfo = driveFiles.find((f) => f.id === fileId);
				if (!fileInfo) continue;
			}

			const response = await fetch("/api/gemini", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					model: selectedModel,
					fileIds: selectedFileIds,
					userCustomPrompt: userCustomPrompt.trim() || null,
					systemInstruction: systemInstruction,
					responseType: "json",
					jobNumber: jobNumber,
					taxCode: taxCode,
					operationType: operationType,
					serviceMode: serviceMode,
					sessionId: newSid,
					goal: "extract",
				}),
			});

			const data = await response.json();
			if (data.text) {
				// Since we use responseType: "json", data.text should already be a clean JSON string
				// but it might still have markdown wrappers if the model doesn't strictly follow response_mime_type (unlikely for newer models)
				const jsonStr = data.text.replace(/```json|```/g, "").trim();
				let parsed = JSON.parse(jsonStr);

				// Handle case where AI returns an array instead of a single object
				if (Array.isArray(parsed)) {
					parsed = parsed[0] || {};
				}

				const coerceConflictSelectedValue = (
					selectedValue: string,
					currentValue: unknown,
				) => {
					if (typeof currentValue === "number") {
						const numericValue = Number(selectedValue);
						return Number.isFinite(numericValue) ? numericValue : currentValue;
					}
					return selectedValue;
				};

				const applyConflictSelections = (
					target: Record<string, any>,
					conflicts: Record<
						string,
						{
							values?: { value: string; source: string }[];
							selected?: string;
							reason?: string;
						}
					>,
				) => {
					const next = { ...target };
					Object.entries(conflicts).forEach(([fieldKey, conflict]) => {
						if (!conflict || typeof conflict !== "object") return;
						const selectedValue =
							typeof conflict.selected === "string"
								? conflict.selected.trim()
								: "";
						if (selectedValue === "") return;
						next[fieldKey] = coerceConflictSelectedValue(
							selectedValue,
							next[fieldKey],
						);
					});
					return next;
				};

				const sanitizeConflictMap = (
					source: unknown,
				): Record<
					string,
					{
						values: { value: string; source: string }[];
						selected: string;
						reason: string;
					}
				> => {
					if (!source || typeof source !== "object" || Array.isArray(source)) {
						return {};
					}

					const output: Record<
						string,
						{
							values: { value: string; source: string }[];
							selected: string;
							reason: string;
						}
					> = {};

					Object.entries(source as Record<string, unknown>).forEach(
						([fieldKey, rawConflict]) => {
							if (
								!rawConflict ||
								typeof rawConflict !== "object" ||
								Array.isArray(rawConflict)
							) {
								return;
							}
							const conflict = rawConflict as Record<string, unknown>;
							const values = Array.isArray(conflict.values)
								? conflict.values
										.map((entry) => {
											if (
												!entry ||
												typeof entry !== "object" ||
												Array.isArray(entry)
											) {
												return null;
											}
											const value = String(
												(entry as Record<string, unknown>).value ?? "",
											).trim();
											const sourceName = String(
												(entry as Record<string, unknown>).source ?? "",
											).trim();
											if (!value) return null;
											return {
												value,
												source: sourceName,
											};
										})
										.filter(
											(
												entry,
											): entry is {
												value: string;
												source: string;
											} => entry !== null,
										)
								: [];
							const selected =
								typeof conflict.selected === "string"
									? conflict.selected.trim()
									: "";
							const reason =
								typeof conflict.reason === "string" ? conflict.reason : "";
							output[fieldKey] = {
								values,
								selected,
								reason,
							};
						},
					);

					return output;
				};

				// Parse conflicts from AI response
				const parsedTopLevelConflicts = sanitizeConflictMap(parsed.conflicts);
				setDataConflicts(parsedTopLevelConflicts);

				const newHsSuggestions: Record<
					number,
					{ code: string; desc: string }[]
				> = {};
				const newCargoConflicts: Record<number, Record<string, any>> = {};
				if (parsed.cargoList && Array.isArray(parsed.cargoList)) {
					parsed.cargoList = parsed.cargoList.map(
						(cargo: any, index: number) => {
							let nextCargo = cargo;
							if (
								cargo.hsCodeSuggestions &&
								Array.isArray(cargo.hsCodeSuggestions) &&
								cargo.hsCodeSuggestions.length > 0
							) {
								newHsSuggestions[index] = cargo.hsCodeSuggestions;
							}
							if (cargo.conflicts && typeof cargo.conflicts === "object") {
								newCargoConflicts[index] = cargo.conflicts;
								nextCargo = applyConflictSelections(
									cargo,
									cargo.conflicts as Record<
										string,
										{
											values?: { value: string; source: string }[];
											selected?: string;
											reason?: string;
										}
									>,
								);
							}
							return nextCargo;
						},
					);
				}
				setHsSuggestions((prev) => ({ ...prev, ...newHsSuggestions }));
				setCargoConflicts(newCargoConflicts);

				let finalCargoType = parsed.cargoType;
				if (finalCargoType) {
					const found = cargoTypes.find((c) =>
						c.toLowerCase().includes(finalCargoType?.toLowerCase()),
					);
					if (found) finalCargoType = found;
				}

				let finalUnit = parsed.unit;
				if (finalUnit) {
					const found = units.find((u) =>
						u.toLowerCase().includes(finalUnit?.toLowerCase()),
					);
					if (found) finalUnit = found;
				}

				setAiOriginalData({
					...parsed,
					cargoType: finalCargoType,
					unit: finalUnit,
				});

				const mergedData = applyConflictSelections(
					{
						...parsed,
						cargoType: finalCargoType,
						unit: finalUnit,
					},
					parsedTopLevelConflicts,
				);
				if (initialData) {
					Object.keys(parsed).forEach((key) => {
						if (key !== "cargoList") {
							const userVal = initialData[key];
							let formattedUserVal = userVal;
							if (userVal instanceof Date) {
								formattedUserVal = userVal.toISOString().split("T")[0];
							} else if (
								typeof userVal === "string" &&
								userVal.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
							) {
								formattedUserVal = userVal.split("T")[0];
							}
							if (
								formattedUserVal !== undefined &&
								formattedUserVal !== null &&
								String(formattedUserVal).trim() !== ""
							) {
								mergedData[key] = formattedUserVal;
							}
						}
					});
				}
				setExtractedData(mergedData);
				// Save which files were used for this analysis
				const usedFiles = driveFiles.filter((f) =>
					selectedFileIds.includes(f.id),
				);
				setAnalyzedFiles(usedFiles);
				// Initialize chat history with the first analysis
				setChatHistory([
					{ role: "user", parts: [{ text: userPrompt }] },
					{
						role: "model",
						parts: [
							{
								text: "Tôi đã trích xuất dữ liệu thành công. Bạn có muốn tôi điều chỉnh hay bổ sung thông tin gì không?",
							},
						],
					},
				]);
				toast.success("AI đã trích xuất thông tin thành công!");
			} else {
				throw new Error(data.error || "Không nhận được phản hồi phù hợp");
			}
		} catch (error: any) {
			console.error(error);
			toast.error(`Lỗi: ${error.message}`);
		} finally {
			setLoading(false);
		}
	};

	const handleSuggestMissingHSCodes = async () => {
		if (!extractedData?.cargoList) return;

		const missingIndices = extractedData.cargoList
			.map((item: any, idx: number) => ({ item, idx }))
			.filter(
				({ item, idx }: { item: any; idx: number }) =>
					(!hsSuggestions[idx] || hsSuggestions[idx].length === 0) &&
					item.vietnameseName,
			)
			.map(({ idx }: { idx: number }) => idx);

		if (missingIndices.length === 0) {
			toast.error("Vui lòng nhập tên tiếng Việt cho các dòng hàng cần gợi ý");
			return;
		}

		setSuggestingMissing(true);
		try {
			const itemsToSuggest = missingIndices.map((idx: number) => ({
				index: idx,
				name: extractedData.cargoList[idx].vietnameseName,
				// Include item-specific context if any
				importer: extractedData.cargoList[idx].importer,
			}));

			const contextInfo = [
				operationType &&
					`Loại hình: ${operationType === "NHAP" ? "NHẬP KHẨU" : "XUẤT KHẨU"}`,
				extractedData.cargoType && `Nhóm hàng: ${extractedData.cargoType}`,
				serviceMode && `Phương thức: ${serviceMode}`,
			]
				.filter(Boolean)
				.join(", ");

			const systemInstruction = `Bạn là chuyên gia Logistics và Phân loại hàng hóa (Customs Classification). Nhiệm vụ của bạn là gợi ý mã HS CODE 8 số theo Biểu thuế XNK Việt Nam hiện hành.
      
      BỐI CẢNH QUAN TRỌNG: ${contextInfo || "Thông tin vận chuyển chung"}.
      
      QUY TẮC PHÂN LOẠI:
      1. Căn cứ vào tên hàng tiếng Việt và bối cảnh (Ví dụ: Hàng gia công xuất khẩu có thể áp mã khác hàng kinh doanh tiêu dùng).
      2. TRẢ VỀ DUY NHẤT một khối JSON có mảng "results". 
      3. Mỗi phần tử trong "results" cần: "index", và mảng "suggestions" (tối đa 3 gợi ý).
      4. Mỗi gợi ý (suggestion) gồm:
         - "code": Mã HS 8 số (viết liền, ví dụ "85171300").
         - "desc": Giải thích ngắn gọn tại sao chọn mã này trong bối cảnh ${operationType || "XNK"} này.
      
      CẤU TRÚC JSON:
      {
        "results": [
          {
             "index": 0,
             "suggestions": [
               { "code": "...", "desc": "..." }
             ]
          }
        ]
      }`;

			const userPrompt = `Dựa trên bối cảnh ${contextInfo}, hãy gợi ý mã HS cho các mặt hàng sau:
${JSON.stringify(itemsToSuggest, null, 2)}`;

			const response = await fetch("/api/gemini", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					model: selectedModel,
					prompt: userPrompt,
					systemInstruction: systemInstruction,
					responseType: "json",
					jobNumber: jobNumber,
					taxCode: taxCode,
					operationType: operationType,
					serviceMode: serviceMode,
					goal: "suggest-hs",
				}),
			});

			const data = await response.json();
			if (data.text) {
				const jsonStr = data.text.replace(/```json|```/g, "").trim();
				const parsed = JSON.parse(jsonStr);
				const results = Array.isArray(parsed) ? parsed : parsed.results || [];

				const newHsSuggestions = { ...hsSuggestions };
				const newCargoList = [...extractedData.cargoList];
				const newAiCargoList = [...(aiOriginalData?.cargoList || [])];

				let updated = 0;
				for (const res of results) {
					const idx = res.index;
					const suggestions = res.suggestions || [];
					if (suggestions.length > 0) {
						newHsSuggestions[idx] = suggestions;
						const hsCode = suggestions[0].code.trim().replace(/\s+/g, "");
						newCargoList[idx].hsCode = hsCode;

						if (!newAiCargoList[idx]) newAiCargoList[idx] = {};
						newAiCargoList[idx].hsCode = hsCode;

						updated++;
					}
				}

				if (updated > 0) {
					setHsSuggestions(newHsSuggestions);
					setExtractedData({ ...extractedData, cargoList: newCargoList });
					setAiOriginalData({ ...aiOriginalData, cargoList: newAiCargoList });
					toast.success(
						`AI đã gợi ý mã HS cho ${updated} dòng hàng dựa trên bối cảnh ${operationType || "XNK"}`,
					);
				} else {
					toast.error("AI không tìm thấy gợi ý phù hợp");
				}
			}
		} catch (error) {
			console.error(error);
			toast.error("Lỗi khi gợi ý mã HS");
		} finally {
			setSuggestingMissing(false);
		}
	};

	const handleChat = async () => {
		if (!chatInput.trim() || loading) return;

		const userMsg = chatInput.trim();
		const shouldAutoSaveAfterChat = shouldAutoSaveFromChatConfirmation(userMsg);
		const newHistory = [
			...chatHistory,
			{ role: "user" as const, parts: [{ text: userMsg }] },
		];

		// Performance: Limit history context to last 6 messages
		const historyWindow = chatHistory.slice(-6);

		setChatHistory(newHistory);
		setChatInput("");
		setLoading(true);

		try {
			// Token Limit optimization: Scrub empty data before sending
			const optimizedContext = scrubData(extractedData);

			const systemInstruction = `Bạn là chuyên gia Logistics đang hỗ trợ người dùng hoàn thiện dữ liệu trích xuất.
      
      QUY TẮC HIỆU SUẤT (TIẾT KIỆM TOKEN):
      1. Luôn trả về một đối tượng JSON: { "explanation": "...", "updates": { ... } }
      2. "explanation": Giải thích ngắn gọn thao tác bạn đã thực hiện.
      3. "updates": CHỈ CHỨA các trường cần thay đổi hoặc bổ sung theo đúng key của schema bên dưới.
      
      SCHEMA PHẢI THEO ĐÚNG CÁC KEY SAU:
      - Bảng thông tin chung: "cargoType", "billOrBooking", "invoice", "grossWeight", "cbm", "quantity", "unit", "commodityName", "pol", "pod", "warehouse", "deliveryDate", "poNumber", "pickupLocation", "loadingLocation", "transportMethod", "transportDate", "taxService", "etaEtd", "notes".
      - Bảng danh sách hàng ("cargoList"): TRẢ VỀ mảng đối tượng chứa "index" (vị trí từ 0) và các trường: "customCode", "hsCode", "qty", "unit", "unitPrice", "totalPrice", "qty2", "unit2", "vietnameseName", "importTaxCode", "importTaxRate", "importTaxAmount", "vatTaxCode", "vatTaxRate", "vatTaxAmount", "imExDutyExemptionCondition", "imExDutyExemptionAmount", "importer", "packageQty", "packageType", "grossWeight", "invoiceNo", "invoiceDate", "term".
        VD: "updates": { "cargoList": [{ "index": 0, "hsCode": "8517.13.00" }] }
 
      DỮ LIỆU HIỆN TẠI (Tóm tắt):
      ${JSON.stringify(optimizedContext)}
      
      Hãy căn cứ vào lịch sử hội thoại, các tài liệu đã cung cấp và yêu cầu của người dùng để trả về các cập nhật.`;

			const response = await fetch("/api/gemini", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					model: selectedModel,
					history: historyWindow.map((h) => ({
						role: h.role === "user" ? "user" : "model",
						parts: h.parts,
					})),
					userCustomPrompt: userMsg,
					systemInstruction: systemInstruction,
					responseType: "json",
					jobNumber,
					taxCode,
					operationType,
					serviceMode,
					goal: "chat-extract",
					sessionId: sessionId,
				}),
			});

			const data = await response.json();
			if (data.text) {
				const jsonStr = data.text.replace(/```json|```/g, "").trim();
				let parsed = JSON.parse(jsonStr);
				if (Array.isArray(parsed)) {
					parsed = parsed[0] || {};
				}

				if (parsed.updates) {
					let nextExtractedDataAfterChat: any = null;
					setExtractedData((prev: any) => {
						const next = { ...prev };

						// Mapping common AI key mismatches
						const topKeyMap: Record<string, string> = {
							invoiceNumber: "invoice",
							invoiceNo: "invoice",
							commodity: "commodityName",
							delivery: "deliveryDate",
						};

						const itemKeyMap: Record<string, string> = {
							invoice: "invoiceNo",
							invoiceNumber: "invoiceNo",
							name: "vietnameseName",
						};

						// Merge top-level updates
						Object.keys(parsed.updates).forEach((key) => {
							if (key !== "cargoList") {
								const targetKey = topKeyMap[key] || key;
								next[targetKey] = parsed.updates[key];
							}
						});

						// Targeted updates for cargoList
						if (
							parsed.updates.cargoList &&
							Array.isArray(parsed.updates.cargoList)
						) {
							const newCargoList = [...(next.cargoList || [])];
							parsed.updates.cargoList.forEach((update: any) => {
								const i = update.index;
								if (typeof i === "number" && newCargoList[i]) {
									const { index: _index, ...fields } = update;
									const mappedFields: any = {};
									Object.keys(fields).forEach((fKey) => {
										const targetFKey = itemKeyMap[fKey] || fKey;
										mappedFields[targetFKey] = fields[fKey];
									});
									newCargoList[i] = { ...newCargoList[i], ...mappedFields };
								}
							});
							next.cargoList = newCargoList;
						}
						nextExtractedDataAfterChat = next;
						return next;
					});

					if (shouldAutoSaveAfterChat && nextExtractedDataAfterChat) {
						await saveExtractedData(
							nextExtractedDataAfterChat,
							"Đã xác nhận và tự động lưu dữ liệu vào hệ thống!",
						);
						return;
					}
				}

				setChatHistory([
					...newHistory,
					{
						role: "model",
						parts: [
							{
								text: parsed.explanation || "Đã cập nhật dữ liệu theo yêu cầu.",
							},
						],
					},
				]);
			}
		} catch (error: any) {
			console.error("Chat Error:", error);
			toast.error(`Lỗi chat: ${error.message}`);
		} finally {
			setLoading(false);
		}
	};

	const handleSave = async () => {
		if (!extractedData) return;
		await saveExtractedData(extractedData);
	};

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent
				className="!max-w-[95vw] w-[95vw] max-h-[96vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-[32px] bg-white ring-1 ring-black/5"
				style={{ maxWidth: "95vw", width: "95vw" }}
			>
				<div className="flex-1 overflow-auto custom-scrollbar relative">
					<DialogHeader className="p-5 md:p-7 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] text-white relative overflow-hidden shrink-0 border-b border-white/5 rounded-t-[32px]">
						<div className="absolute top-0 right-0 w-[600px] h-[600px] bg-orange-500/10 rounded-full blur-[140px] -mr-64 -mt-64 animate-pulse"></div>
						<div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[120px] -ml-32 -mb-32"></div>

						<div className="relative z-10">
							<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10">
								<div className="flex items-start gap-6">
									<div className="flex-shrink-0 w-20 h-20 rounded-[28px] bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-2xl shadow-orange-500/40 rotate-6 transform transition-transform hover:rotate-0 group">
										<Sparkles className="w-10 h-10 text-white animate-pulse" />
									</div>
									<div className="space-y-2">
										<div className="flex items-center gap-4 flex-wrap">
											<DialogTitle className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-orange-200">
												AI AutoFill
												<span className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-orange-200">
													{" "}
												</span>
												<Select
													value={selectedModel}
													onValueChange={(v) => setSelectedModel(v as string)}
												>
													<SelectTrigger className="inline-flex items-center gap-2 px-4 py-1.5 h-auto rounded-full text-[11px] font-black bg-orange-500/10 text-orange-400 border border-orange-500/20 uppercase tracking-widest shadow-inner w-auto min-w-0 [&>svg]:text-orange-400">
														<span className="w-2 h-2 rounded-full bg-orange-400 animate-ping flex-shrink-0"></span>
														<SelectValue />
													</SelectTrigger>
													<SelectPositioner>
														<SelectContent>
															<SelectItem
																value={
																	process.env
																		.NEXT_PUBLIC_GEMINI_AUTOFILL_MODEL_FLASH ||
																	"gemini-2.5-flash"
																}
															>
																<div className="flex items-center gap-2">
																	<Cpu className="w-3.5 h-3.5 text-blue-500" />
																	<span>Gemini 2.5 Flash</span>
																	<span className="text-[10px] text-muted-foreground">
																		(Nhanh)
																	</span>
																</div>
															</SelectItem>
															<SelectItem
																value={
																	process.env
																		.NEXT_PUBLIC_GEMINI_AUTOFILL_MODEL_PRO ||
																	"gemini-2.5-pro"
																}
															>
																<div className="flex items-center gap-2">
																	<Sparkles className="w-3.5 h-3.5 text-orange-500" />
																	<span>Gemini 2.5 Pro</span>
																	<span className="text-[10px] text-muted-foreground">
																		(Chính xác)
																	</span>
																</div>
															</SelectItem>
														</SelectContent>
													</SelectPositioner>
												</Select>
											</DialogTitle>
										</div>
										<DialogDescription className="text-slate-400 font-bold text-lg flex items-center gap-3 flex-wrap">
											Trích xuất dữ liệu cho:
											<span className="bg-slate-800/80 text-orange-400 px-4 py-1.5 rounded-2xl border border-white/10 shadow-2xl font-black">
												{jobNumber}
											</span>
										</DialogDescription>
									</div>
								</div>

								{/* Progress Steps */}
								<div className="grid grid-cols-3 gap-4 md:gap-6 w-full lg:max-w-2xl">
									{[
										{
											icon: <HardDrive className="w-6 h-6" />,
											title: "Bước 01",
											subtitle: "Chọn tài liệu",
											desc: "Chọn Invoice, Packing List hoặc các chứng từ liên quan từ Drive.",
											color:
												"from-blue-500/10 to-indigo-500/10 text-blue-300 border-blue-500/20 hover:border-blue-500/50",
										},
										{
											icon: <Cpu className="w-6 h-6" />,
											title: "Bước 02",
											subtitle: "Phân tích AI",
											desc: "AI sẽ tự động đọc, hiểu và trích xuất dữ liệu chi tiết. Bạn có thể trao đổi với AI để cải thiện chất lượng dữ liệu. ",
											color:
												"from-orange-500/10 to-red-500/10 text-orange-300 border-orange-500/20 hover:border-orange-500/50",
										},
										{
											icon: <FileCheck className="w-6 h-6" />,
											title: "Bước 03",
											subtitle: "Kiểm tra & Lưu",
											desc: "Hiệu chỉnh kết quả nếu cần và lưu trực tiếp vào hệ thống.",
											color:
												"from-emerald-500/10 to-teal-500/10 text-emerald-300 border-emerald-500/20 hover:border-emerald-500/50",
										},
									].map((step, i) => (
										<div
											key={i}
											className={cn(
												"relative overflow-hidden p-5 md:p-6 rounded-[32px] border bg-gradient-to-br backdrop-blur-3xl transition-all hover:scale-[1.05] active:scale-[0.98] cursor-default group",
												step.color,
											)}
										>
											<div className="space-y-4 text-left">
												<div className="flex items-center gap-3">
													<div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 shadow-inner group-hover:bg-white/10 transition-all">
														{step.icon}
													</div>
													<div className="min-w-0">
														<h4 className="text-[9px] font-black uppercase tracking-[0.2em] opacity-50 group-hover:opacity-100 transition-opacity whitespace-nowrap">
															{step.title}
														</h4>
														<p className="text-[14px] font-black text-white/95 truncate">
															{step.subtitle}
														</p>
													</div>
												</div>
												<p className="text-[10px] sm:text-[11px] font-medium leading-relaxed text-slate-400 group-hover:text-slate-300 transition-colors">
													{step.desc}
												</p>
											</div>
										</div>
									))}
								</div>
							</div>
						</div>
					</DialogHeader>

					<div className="p-8 md:p-12 space-y-10 bg-white">
						{/* Drive Files Selection (Sticky sub-header) */}
						<div className="space-y-4 sticky top-0 z-50 bg-white/95 backdrop-blur-md py-4 -mx-12 px-12 border-b border-gray-100 shadow-sm mb-8">
							<div className="flex items-center justify-between">
								<label className="text-sm font-bold text-gray-700 flex items-center gap-2">
									<HardDrive className="w-4 h-4 text-blue-500" />
									Danh sách file trong Google Drive
								</label>
								<div className="flex items-center gap-1">
									<Button
										variant="ghost"
										size="sm"
										className="text-[10px] h-7 text-blue-600 hover:text-blue-700 font-bold px-2 rounded-lg"
										onClick={() => {
											if (selectedFileIds.length === driveFiles.length) {
												setSelectedFileIds([]);
											} else {
												setSelectedFileIds(driveFiles.map((f) => f.id));
											}
										}}
										disabled={fetchingFiles || driveFiles.length === 0}
									>
										<CheckCircle2 className="w-3 h-3 mr-1.5" />
										{selectedFileIds.length === driveFiles.length
											? "Bỏ chọn tất cả"
											: `Chọn tất cả (${driveFiles.length})`}
									</Button>
									<div className="w-px h-3 bg-gray-200 mx-1" />
									<Button
										variant="ghost"
										size="sm"
										className="text-[10px] h-7 text-blue-600 hover:text-blue-700 font-bold px-2 rounded-lg"
										onClick={() => folderId && fetchDriveFiles(folderId)}
										disabled={fetchingFiles || !folderId}
									>
										<RefreshCw
											className={cn(
												"w-3 h-3 mr-1.5",
												fetchingFiles && "animate-spin",
											)}
										/>
										Làm mới
									</Button>
								</div>
							</div>

							{!folderId ? (
								<div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center text-amber-700">
									<FileSearch className="w-10 h-10 mx-auto mb-2 opacity-50" />
									<p className="text-sm font-medium">
										Chưa có liên kết Drive cho Job này.
									</p>
								</div>
							) : fetchingFiles ? (
								<div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-3">
									<Spinner className="w-8 h-8" />
									<p className="text-xs font-medium animate-pulse">
										Đang quét thư mục Drive...
									</p>
								</div>
							) : (
								<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar p-0.5">
									{driveFiles.map((file) => (
										<div
											key={file.id}
											className={cn(
												"flex items-center gap-2 p-1.5 rounded-md border transition-all cursor-pointer group relative",
												selectedFileIds.includes(file.id)
													? "bg-blue-50/50 border-blue-300"
													: "bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50",
											)}
											onClick={() => toggleFileSelection(file.id)}
										>
											<div className="shrink-0 flex items-center justify-center w-6 h-6 rounded bg-white border border-gray-50 flex items-center justify-center">
												{getFileIcon(file.mimeType, file.name)}
											</div>

											<div className="flex-1 min-w-0">
												<p
													className={cn(
														"text-[9px] font-bold truncate transition-colors leading-none",
														selectedFileIds.includes(file.id)
															? "text-blue-700"
															: "text-gray-700",
													)}
												>
													{file.name}
												</p>
											</div>

											<div
												className={cn(
													"w-3 h-3 rounded-full border flex items-center justify-center transition-all shrink-0",
													selectedFileIds.includes(file.id)
														? "bg-blue-600 border-blue-600 text-white"
														: "bg-white border-gray-200",
												)}
											>
												{selectedFileIds.includes(file.id) && (
													<CheckCircle2 className="w-2 h-2" />
												)}
											</div>
										</div>
									))}
								</div>
							)}
						</div>

						{/* User Custom Prompt */}
						{chatHistory.length === 0 && (
							<div className="space-y-1.5" ref={promptRef}>
								<div className="flex items-center justify-between">
									<label className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
										<Sparkles className="w-3.5 h-3.5 text-orange-400" />
										Hướng dẫn thêm cho AI
										<span className="text-gray-400 font-normal">
											(tùy chọn)
										</span>
									</label>
									<button
										type="button"
										onClick={() => {
											setShowPromptHistory((v) => !v);
											if (!showPromptHistory)
												fetchPromptHistory(promptSearch, "extract");
										}}
										className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-lg transition-colors"
										disabled={loading || fetchingPrompts}
									>
										<History className="w-3 h-3" />
										Dùng lại
										{promptHistory.length > 0 && (
											<span className="bg-blue-200 text-blue-700 rounded-full px-1.5 py-0 text-[10px] font-bold">
												{promptHistory.length}
											</span>
										)}
										<ChevronDown
											className={cn(
												"w-3 h-3 transition-transform",
												showPromptHistory && "rotate-180",
											)}
										/>
									</button>
								</div>

								{/* Prompt History Dropdown */}
								{showPromptHistory && (
									<div className="border border-blue-100 rounded-xl bg-white shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
										{/* Search bar */}
										<div className="p-2 border-b border-gray-100">
											<div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5">
												<Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
												<input
													type="text"
													value={promptSearch}
													onChange={(e) => {
														setPromptSearch(e.target.value);
														fetchPromptHistory(e.target.value, "extract");
													}}
													placeholder="Tìm kiếm trong lịch sử..."
													className="flex-1 bg-transparent text-xs outline-none text-gray-700 placeholder:text-gray-400"
													autoFocus
												/>
												{promptSearch && (
													<button
														onClick={() => {
															setPromptSearch("");
															fetchPromptHistory("", "extract");
														}}
													>
														<X className="w-3 h-3 text-gray-400 hover:text-gray-600" />
													</button>
												)}
											</div>
										</div>

										{/* Prompt list */}
										<div className="max-h-[220px] overflow-y-auto">
											{fetchingPrompts ? (
												<div className="flex items-center justify-center py-6 text-gray-400 gap-2">
													<RefreshCw className="w-3.5 h-3.5 animate-spin" />
													<span className="text-xs">Đang tải...</span>
												</div>
											) : promptHistory.length === 0 ? (
												<div className="py-6 text-center text-xs text-gray-400 italic">
													Chưa có lịch sử prompt nào
												</div>
											) : (
												<div className="divide-y divide-gray-50">
													{promptHistory.map((item, i) => (
														<button
															key={i}
															type="button"
															onClick={() => {
																setUserCustomPrompt(item.prompt);
																setShowPromptHistory(false);
															}}
															className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors group"
														>
															<div className="flex items-start gap-2">
																<div className="flex-1 min-w-0">
																	<p className="text-xs text-gray-700 group-hover:text-blue-700 line-clamp-2 leading-relaxed">
																		{item.prompt}
																	</p>
																	<div className="flex items-center gap-2 mt-1 flex-wrap">
																		{item.priority === 0 && (
																			<span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 rounded">
																				<Tag className="w-2.5 h-2.5" /> Khớp
																				hoàn toàn
																			</span>
																		)}
																		{item.priority === 1 && (
																			<span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 rounded">
																				<Tag className="w-2.5 h-2.5" /> Cùng KH
																				&amp; loại
																			</span>
																		)}
																		{item.priority === 2 && (
																			<span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-gray-600 bg-gray-50 px-1.5 rounded">
																				<Tag className="w-2.5 h-2.5" /> Liên
																				quan
																			</span>
																		)}
																		{(item as any).count > 1 && (
																			<span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-orange-600 bg-orange-50 px-1.5 rounded">
																				Dùng {(item as any).count} lần
																			</span>
																		)}
																		{item.taxCode && (
																			<span className="text-[10px] text-gray-400 font-mono">
																				{item.taxCode}
																			</span>
																		)}
																		{item.operationType && (
																			<span className="text-[10px] text-gray-400">
																				{item.operationType}
																			</span>
																		)}
																		{item.serviceMode && (
																			<span className="text-[10px] text-gray-400 font-bold">
																				{item.serviceMode}
																			</span>
																		)}
																	</div>
																</div>
																<CheckCircle2 className="w-3.5 h-3.5 text-blue-300 opacity-0 group-hover:opacity-100 shrink-0 mt-0.5 transition-opacity" />
															</div>
														</button>
													))}
												</div>
											)}
										</div>
									</div>
								)}

								<Textarea
									value={userCustomPrompt}
									onChange={(e) => setUserCustomPrompt(e.target.value)}
									placeholder="Ví dụ: Tập trung vào hàng hóa điện tử, đơn vị tính là chiếc, bỏ qua các ghi chú không liên quan..."
									className="min-h-[70px] text-sm resize-none border-gray-200 focus:border-orange-400 focus:ring-orange-200 rounded-xl"
									disabled={loading}
								/>
							</div>
						)}

						<Button
							className="w-full h-12 bg-orange-600 hover:bg-orange-700 font-bold gap-2 text-base shadow-lg shadow-orange-100"
							onClick={handleAnalyze}
							disabled={
								loading || selectedFileIds.length === 0 || fetchingFiles
							}
						>
							{loading ? (
								<RefreshCw className="w-5 h-5 animate-spin" />
							) : (
								<Sparkles className="w-5 h-5" />
							)}
							BẮT ĐẦU PHÂN TÍCH VỚI AI
						</Button>

						{/* Chat Interface (ChatGPT Style) */}
						{chatHistory.length > 0 && (
							<div className="space-y-4 border-t pt-6">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
										<Sparkles className="w-4 h-4 text-orange-500" />
										Trao đổi & Hiệu chỉnh kết quả
									</div>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => {
											setChatHistory([]);
											setChatInput("");
											setSessionId(null);
											toast.info(
												"Đã làm mới hội thoại. Bạn có thể nhập hướng dẫn mới.",
											);
										}}
										className="h-7 text-[10px] font-bold text-gray-400 hover:text-red-500 hover:bg-red-50 gap-1.5"
									>
										<RefreshCw className="w-3 h-3" />
										Bắt đầu lại hội thoại mới
									</Button>
								</div>

								<div className="flex border border-gray-100 rounded-3xl overflow-hidden bg-white shadow-sm h-[450px]">
									{/* Sidebar: Session History */}
									<div className="w-[240px] border-r border-gray-50 bg-gray-50/50 flex flex-col shrink-0">
										<div className="p-4 border-b border-gray-50 bg-white/50">
											<h3 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
												<Clock className="w-3 h-3" /> Lịch sử hội thoại
											</h3>
										</div>
										<div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
											{sessions.length === 0 ? (
												<div className="py-10 text-center px-4">
													<p className="text-[10px] text-gray-400 font-medium leading-relaxed italic">
														Chưa có lịch sử hội thoại cho Job này
													</p>
												</div>
											) : (
												sessions.map((s) => (
													<button
														key={s.id}
														onClick={() => {
															if (s.id !== sessionId) {
																setSessionId(s.id);
																fetchChatHistory(jobNumber, s.id);
															}
														}}
														className={cn(
															"w-full text-left p-3 rounded-2xl transition-all group relative",
															sessionId === s.id
																? "bg-white shadow-sm border border-orange-100 text-orange-700"
																: "hover:bg-white/80 text-gray-500 hover:text-gray-700",
														)}
													>
														<div className="flex items-center gap-3">
															<div
																className={cn(
																	"w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors",
																	sessionId === s.id
																		? "bg-orange-100 text-orange-600"
																		: "bg-gray-100 text-gray-400 group-hover:bg-white group-hover:text-gray-600",
																)}
															>
																<FileText className="w-4 h-4" />
															</div>
															<div className="flex-1 min-w-0">
																<p className="text-[11px] font-bold truncate leading-none mb-1">
																	{s.label}
																</p>
																<p className="text-[9px] font-medium opacity-50">
																	{new Date(s.date).toLocaleDateString("vi-VN")}
																</p>
															</div>
															{sessionId === s.id && (
																<div className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-sm shadow-orange-200" />
															)}
														</div>
													</button>
												))
											)}
										</div>
									</div>

									{/* Main: Chat History */}
									<div className="flex-1 flex flex-col bg-white min-w-0 relative">
										<div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar scroll-smooth">
											{/* System card: files used in this session */}
											{analyzedFiles.length > 0 && (
												<div className="flex justify-center">
													<div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 max-w-[90%] shadow-sm">
														<p className="text-[10px] font-extrabold text-emerald-700 mb-2 flex items-center gap-1.5">
															<FileCheck className="w-3.5 h-3.5" />
															Tài liệu đã phân tích trong phiên này:
														</p>
														<div className="flex flex-wrap gap-1.5">
															{analyzedFiles.map((f) => (
																<span
																	key={f.id}
																	className="inline-flex items-center gap-1 text-[10px] font-semibold bg-white text-emerald-700 border border-emerald-200 rounded-lg px-2 py-0.5"
																>
																	{getFileIcon(f.mimeType, f.name)}
																	<span>{f.name}</span>
																</span>
															))}
														</div>
													</div>
												</div>
											)}

											{chatHistory.map((chat, idx) => (
												<div
													key={idx}
													className={cn(
														"flex w-full",
														chat.role === "user"
															? "justify-end"
															: "justify-start animate-in fade-in slide-in-from-left-2",
													)}
												>
													<div
														className={cn(
															"max-w-[85%] p-4 rounded-3xl text-[13px] leading-relaxed relative group",
															chat.role === "user"
																? "bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-100"
																: "bg-gray-50 text-gray-700 rounded-tl-none border border-gray-100",
														)}
													>
														<div className="flex items-start gap-3">
															{chat.role === "model" && (
																<div className="w-6 h-6 rounded-lg bg-orange-500 text-white flex items-center justify-center shrink-0 mt-0.5">
																	<Sparkles className="w-3.5 h-3.5" />
																</div>
															)}
															<div className="flex-1 whitespace-pre-wrap font-medium">
																{chat.parts[0].text}
															</div>
														</div>
													</div>
												</div>
											))}
											{loading &&
												chatHistory.length > 0 &&
												chatHistory[chatHistory.length - 1].role === "user" && (
													<div className="flex justify-start animate-pulse">
														<div className="bg-gray-50 p-4 rounded-3xl rounded-tl-none border border-gray-100 flex items-center gap-3">
															<div className="w-6 h-6 rounded-lg bg-orange-500 text-white flex items-center justify-center shrink-0">
																<Sparkles className="w-3.5 h-3.5 animate-spin" />
															</div>
															<span className="text-[11px] font-bold text-gray-400 tracking-wide uppercase">
																AI đang xử lý...
															</span>
														</div>
													</div>
												)}
										</div>

										{/* Input Area */}
										<div className="p-4 border-t border-gray-50 bg-gray-50/20 backdrop-blur-sm">
											<div className="flex gap-2 bg-white p-2 rounded-2xl border border-gray-100 focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-50 transition-all shadow-sm">
												<Input
													value={chatInput}
													onChange={(e) => setChatInput(e.target.value)}
													placeholder="Yêu cầu AI điều chỉnh (VD: 'Sửa lại mã HS dòng 2'...)"
													onKeyDown={(e) => e.key === "Enter" && handleChat()}
													disabled={loading}
													className="flex-1 h-10 bg-transparent border-none text-[13px] font-medium placeholder:text-gray-300 focus-visible:ring-0 shadow-none px-2"
												/>
												<Button
													onClick={handleChat}
													disabled={loading || !chatInput.trim()}
													className="shrink-0 h-10 w-10 rounded-xl bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-100 flex items-center justify-center p-0 transition-transform active:scale-95"
												>
													<Sparkles className="w-4 h-4 text-white" />
												</Button>
											</div>
										</div>
									</div>
								</div>
							</div>
						)}

						{/* Extracted Data Preview */}
						{extractedData && (
							<div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
										<TableIcon className="w-4 h-4" /> Dữ liệu đã trích xuất (Vui
										lòng kiểm tra lại)
									</div>

									{aiOriginalData && (
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="h-7 text-[10px] font-extrabold border-orange-200 text-orange-600 bg-white hover:bg-orange-50 transition-all shadow-sm rounded-xl flex items-center gap-2 px-3 group"
											onClick={() => {
												const mergedData = {
													...extractedData,
													...aiOriginalData,
													cargoList: (extractedData.cargoList || []).map(
														(item: any, idx: number) => ({
															...item,
															...(aiOriginalData.cargoList?.[idx] || {}),
														}),
													),
												};
												setExtractedData(mergedData);
												toast.success(
													"Hệ thống đã áp dụng tất cả các gợi ý từ AI cho các trường thông tin.",
												);
											}}
										>
											<Sparkles className="w-3.5 h-3.5 group-hover:animate-pulse" />
											ÁP DỤNG TẤT CẢ GỢI Ý CỦA AI
										</Button>
									)}
								</div>

								{/* Data Conflict Summary Banner - also sticky context if needed, but for now inside content */}
								{(() => {
									const totalConflicts =
										Object.keys(dataConflicts).length +
										Object.values(cargoConflicts).reduce(
											(acc, curr) => acc + Object.keys(curr).length,
											0,
										);
									if (totalConflicts === 0) return null;

									return (
										<div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 border-l-4 border-l-amber-500 shadow-sm">
											<AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
											<span className="text-[12px] font-bold text-amber-800">
												⚠️ Phát hiện {totalConflicts} mâu thuẫn dữ liệu giữa các
												tài liệu. Các trường có biểu tượng ⚠️ cần kiểm tra.
											</span>
										</div>
									);
								})()}

								<div className="grid grid-cols-2 gap-4 bg-gray-50 p-6 rounded-2xl border border-gray-100 shadow-inner">
									{type === "trucking" ? (
										<>
											<DataField
												label="Công ty"
												value={extractedData.companyName}
												aiSuggestedValue={aiOriginalData?.companyName}
												originalValue={initialData?.companyName}
												conflict={dataConflicts.companyName}
												multiline
												onChange={(v) =>
													setExtractedData({ ...extractedData, companyName: v })
												}
											/>
											<DataField
												label="MST"
												value={extractedData.taxCode}
												aiSuggestedValue={aiOriginalData?.taxCode}
												originalValue={initialData?.taxCode}
												conflict={dataConflicts.taxCode}
												onChange={(v) =>
													setExtractedData({ ...extractedData, taxCode: v })
												}
											/>
										</>
									) : (
										<DataField
											label="Loại Hàng"
											value={extractedData.cargoType}
											aiSuggestedValue={aiOriginalData?.cargoType}
											originalValue={initialData?.cargoType}
											conflict={dataConflicts.cargoType}
											options={cargoTypes}
											onChange={(v) =>
												setExtractedData({ ...extractedData, cargoType: v })
											}
										/>
									)}
									<DataField
										label="Số Bill/Booking"
										value={extractedData.billOrBooking}
										aiSuggestedValue={aiOriginalData?.billOrBooking}
										originalValue={initialData?.billOrBooking}
										conflict={dataConflicts.billOrBooking}
										onChange={(v) =>
											setExtractedData({ ...extractedData, billOrBooking: v })
										}
									/>
									{type === "followup" && (
										<>
											<DataField
												label="Số Invoice"
												value={extractedData.invoice}
												aiSuggestedValue={aiOriginalData?.invoice}
												originalValue={initialData?.invoice}
												conflict={dataConflicts.invoice}
												onChange={(v) =>
													setExtractedData({ ...extractedData, invoice: v })
												}
											/>
											<DataField
												label="Ngày giao-gửi"
												value={extractedData.deliveryDate}
												aiSuggestedValue={aiOriginalData?.deliveryDate}
												originalValue={initialData?.deliveryDate}
												conflict={dataConflicts.deliveryDate}
												onChange={(v) =>
													setExtractedData({
														...extractedData,
														deliveryDate: v,
													})
												}
											/>
											<DataField
												label="Số PO"
												value={extractedData.poNumber}
												aiSuggestedValue={aiOriginalData?.poNumber}
												originalValue={initialData?.poNumber}
												conflict={dataConflicts.poNumber}
												onChange={(v) =>
													setExtractedData({ ...extractedData, poNumber: v })
												}
											/>
											<DataField
												label="Điểm nhận"
												value={extractedData.pickupLocation}
												aiSuggestedValue={aiOriginalData?.pickupLocation}
												originalValue={initialData?.pickupLocation}
												conflict={dataConflicts.pickupLocation}
												multiline
												onChange={(v) =>
													setExtractedData({
														...extractedData,
														pickupLocation: v,
													})
												}
											/>
											<DataField
												label="Điểm xếp"
												value={extractedData.loadingLocation}
												aiSuggestedValue={aiOriginalData?.loadingLocation}
												originalValue={initialData?.loadingLocation}
												multiline
												onChange={(v) =>
													setExtractedData({
														...extractedData,
														loadingLocation: v,
													})
												}
											/>
											<DataField
												label="Phương tiện VC"
												value={extractedData.transportMethod}
												aiSuggestedValue={aiOriginalData?.transportMethod}
												originalValue={initialData?.transportMethod}
												conflict={dataConflicts.transportMethod}
												onChange={(v) =>
													setExtractedData({
														...extractedData,
														transportMethod: v,
													})
												}
											/>
											<DataField
												label="Ngày khởi hành"
												value={extractedData.transportDate}
												aiSuggestedValue={aiOriginalData?.transportDate}
												originalValue={initialData?.transportDate}
												conflict={dataConflicts.transportDate}
												onChange={(v) =>
													setExtractedData({
														...extractedData,
														transportDate: v,
													})
												}
											/>
											<DataField
												label="Đích bảo thuế"
												value={extractedData.taxService}
												aiSuggestedValue={aiOriginalData?.taxService}
												originalValue={initialData?.taxService}
												conflict={dataConflicts.taxService}
												onChange={(v) =>
													setExtractedData({ ...extractedData, taxService: v })
												}
											/>
											<DataField
												label="ETA/ETD"
												value={extractedData.etaEtd}
												aiSuggestedValue={aiOriginalData?.etaEtd}
												originalValue={initialData?.etaEtd}
												conflict={dataConflicts.etaEtd}
												onChange={(v) =>
													setExtractedData({ ...extractedData, etaEtd: v })
												}
											/>
										</>
									)}
									<div className="grid grid-cols-4 gap-3 col-span-2">
										<DataField
											label="Số lượng"
											value={extractedData.quantity}
											aiSuggestedValue={aiOriginalData?.quantity}
											originalValue={initialData?.quantity}
											conflict={dataConflicts.quantity}
											onChange={(v) =>
												setExtractedData({ ...extractedData, quantity: v })
											}
											type="number"
										/>
										<DataField
											label="Đơn vị (Unit)"
											value={extractedData.unit}
											aiSuggestedValue={aiOriginalData?.unit}
											originalValue={initialData?.unit}
											options={units}
											onChange={(v) =>
												setExtractedData({ ...extractedData, unit: v })
											}
										/>
										<DataField
											label="G.W"
											value={extractedData.grossWeight}
											aiSuggestedValue={aiOriginalData?.grossWeight}
											originalValue={initialData?.grossWeight}
											conflict={dataConflicts.grossWeight}
											onChange={(v) =>
												setExtractedData({ ...extractedData, grossWeight: v })
											}
											type="number"
										/>
										<DataField
											label="CBM"
											value={extractedData.cbm}
											aiSuggestedValue={aiOriginalData?.cbm}
											originalValue={initialData?.cbm}
											conflict={dataConflicts.cbm}
											onChange={(v) =>
												setExtractedData({ ...extractedData, cbm: v })
											}
											type="number"
										/>
									</div>
									<DataField
										label="Tên hàng"
										value={extractedData.commodityName}
										aiSuggestedValue={aiOriginalData?.commodityName}
										originalValue={initialData?.commodityName}
										conflict={dataConflicts.commodityName}
										onChange={(v) =>
											setExtractedData({ ...extractedData, commodityName: v })
										}
										className="col-span-2"
										multiline
									/>
									<DataField
										label="Kho/Bãi (Warehouse)"
										value={extractedData.warehouse}
										aiSuggestedValue={aiOriginalData?.warehouse}
										originalValue={initialData?.warehouse}
										conflict={dataConflicts.warehouse}
										multiline
										onChange={(v) =>
											setExtractedData({ ...extractedData, warehouse: v })
										}
										className={cn(type === "trucking" && "col-span-2")}
									/>
									{type === "followup" && (
										<>
											<DataField
												label="POL"
												value={extractedData.pol}
												aiSuggestedValue={aiOriginalData?.pol}
												originalValue={initialData?.pol}
												conflict={dataConflicts.pol}
												onChange={(v) =>
													setExtractedData({ ...extractedData, pol: v })
												}
											/>
											<DataField
												label="POD"
												value={extractedData.pod}
												aiSuggestedValue={aiOriginalData?.pod}
												originalValue={initialData?.pod}
												conflict={dataConflicts.pod}
												onChange={(v) =>
													setExtractedData({ ...extractedData, pod: v })
												}
											/>
										</>
									)}
									<DataField
										label="Ghi chú"
										value={
											type === "followup"
												? extractedData.notes
												: extractedData.note
										}
										aiSuggestedValue={
											type === "followup"
												? aiOriginalData?.notes
												: aiOriginalData?.note
										}
										originalValue={
											type === "followup"
												? initialData?.notes
												: initialData?.note
										}
										multiline
										onChange={(v) =>
											setExtractedData({
												...extractedData,
												[type === "followup" ? "notes" : "note"]: v,
											})
										}
										className="col-span-2"
									/>
								</div>

								{/* Cargo List Section (Only for FollowUp) */}
								{type === "followup" && (
									<div className="space-y-3 pt-2">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
												<TableIcon className="w-4 h-4" /> Chi tiết danh sách
												hàng
												{hasMissingHsSuggestions && (
													<Button
														type="button"
														variant="outline"
														size="sm"
														className="h-6 ml-2 px-2 text-[10px] font-bold border-orange-200 text-orange-600 bg-orange-50 hover:bg-orange-100 hover:text-orange-700 transition-colors shadow-sm rounded flex items-center gap-1.5"
														onClick={handleSuggestMissingHSCodes}
														disabled={suggestingMissing}
													>
														{suggestingMissing ? (
															<RefreshCw className="w-3 h-3 animate-spin" />
														) : (
															<Sparkles className="w-3 h-3" />
														)}
														AI Gợi ý mã HS bị thiếu
													</Button>
												)}
											</div>
											<Button
												variant="outline"
												size="sm"
												className="h-7 text-[10px] font-bold border-dashed"
												onClick={() => {
													const newList = [
														...(extractedData.cargoList || []),
														{
															vietnameseName: "",
															hsCode: "",
															qty: 0,
															unit: "",
															unitPrice: 0,
															totalPrice: 0,
															qty2: 0,
															unit2: "",
															importTaxCode: "",
															vatTaxCode: "",
															packageQty: 0,
															packageType: "",
															grossWeight: 0,
															invoiceNo: "",
														},
													];
													setExtractedData({
														...extractedData,
														cargoList: newList,
													});
												}}
											>
												+ Thêm dòng
											</Button>
										</div>

										<div className="border rounded-lg overflow-auto bg-white shadow-sm custom-scrollbar max-h-[600px]">
											<Table className="min-w-[1800px] border-separate border-spacing-0">
												<TableHeader className="bg-slate-100/95 sticky top-0 z-50 shadow-sm">
													<TableRow>
														<TableHead className="px-2 text-[10px] font-extrabold text-gray-500 uppercase tracking-widest w-12 min-w-[48px] max-w-[48px] text-center h-8 sticky left-0 bg-slate-100 z-40 border-r">
															#
														</TableHead>
														{CARGO_COLUMNS.map((col, cIdx) => (
															<TableHead
																key={col.key}
																className={cn(
																	"px-2 text-[10px] font-extrabold text-gray-500 uppercase tracking-widest h-8 whitespace-nowrap transition-all",
																	cIdx === 0 &&
																		"sticky left-12 bg-slate-100 z-40 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]",
																)}
																style={{ minWidth: (col as any).minWidth }}
															>
																{col.label}
															</TableHead>
														))}
														<TableHead className="px-2 w-10 h-8"></TableHead>
													</TableRow>
												</TableHeader>
												<TableBody>
													{(extractedData.cargoList || []).map(
														(item: any, idx: number) => (
															<TableRow
																key={idx}
																className="hover:bg-slate-50 transition-colors h-auto min-h-[40px]"
															>
																<TableCell className="px-2 py-1 text-center text-[10px] font-bold text-gray-400 sticky left-0 bg-white z-20 border-r w-12 min-w-[48px] max-w-[48px]">
																	{idx + 1}
																</TableCell>
																{CARGO_COLUMNS.map((col, cIdx) => (
																	<TableCell
																		key={col.key}
																		className={cn(
																			"px-1 py-1 transition-all",
																			cIdx === 0 &&
																				"sticky left-12 bg-white z-20 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]",
																		)}
																	>
																		{(() => {
																			const val = String(
																				item[col.key] || "",
																			).trim();
																			const aiVal = String(
																				aiOriginalData?.cargoList?.[idx]?.[
																					col.key
																				] || "",
																			).trim();
																			const origVal = String(
																				initialData?.cargoList?.[idx]?.[
																					col.key
																				] || "",
																			).trim();
																			const suggestions = hsSuggestions[idx];
																			const hasSug =
																				col.key === "hsCode" &&
																				suggestions &&
																				suggestions.length > 0;
																			const cellConflict =
																				cargoConflicts[idx]?.[col.key];

																			const cellInner = (
																				<div className="flex flex-col gap-0.5 group w-full relative">
																					<div className="flex items-center gap-1">
																						<TooltipProvider delay={500}>
																							<Tooltip>
																								<TooltipTrigger>
																									{col.type === "text" ? (
																										<Textarea
																											className={cn(
																												"min-h-[28px] h-auto py-1 text-[11px] font-bold border rounded px-1.5 w-full transition-colors resize-none leading-[1.3] overflow-hidden",
																												(() => {
																													if (cellConflict)
																														return "border-amber-400 bg-amber-50/30 text-amber-900";
																													if (hasSug)
																														return "border-orange-300 border-l-4 border-l-orange-500 bg-orange-50/50 text-orange-900 shadow-sm";
																													if (
																														aiVal !== "" &&
																														val !== aiVal
																													)
																														return "border-orange-300 bg-orange-50/30 text-orange-700";
																													if (
																														aiVal !== "" &&
																														origVal !== "" &&
																														val === aiVal &&
																														aiVal !== origVal
																													)
																														return "border-purple-300 bg-purple-50 text-purple-700";
																													return "border-transparent bg-transparent hover:bg-white focus:bg-white";
																												})(),
																											)}
																											style={{
																												minWidth: (col as any)
																													.minWidth,
																											}}
																											rows={(() => {
																												const lines =
																													val.split("\n");
																												const charsPerLine =
																													parseInt(
																														(col as any)
																															.minWidth,
																														10,
																													) / 7.5; // Roughly 7.5px per char for 11px bold
																												const wrappedLines =
																													lines.reduce(
																														(acc, line) =>
																															acc +
																															Math.max(
																																1,
																																Math.ceil(
																																	line.length /
																																		charsPerLine,
																																),
																															),
																														0,
																													);
																												return Math.min(
																													10,
																													wrappedLines,
																												); // Max 10 rows to prevent table explosion
																											})()}
																											value={
																												item[col.key] ?? ""
																											}
																											onChange={(e) => {
																												const newList = [
																													...extractedData.cargoList,
																												];
																												newList[idx][col.key] =
																													e.target.value;
																												setExtractedData({
																													...extractedData,
																													cargoList: newList,
																												});
																											}}
																										/>
																									) : (
																										<Input
																											type={
																												col.type === "number"
																													? "number"
																													: "text"
																											}
																											className={cn(
																												"h-7 text-[11px] font-bold border rounded px-1.5 w-full transition-colors",
																												(() => {
																													if (cellConflict)
																														return "border-amber-400 bg-amber-50/30 text-amber-900";
																													if (hasSug)
																														return "border-orange-300 border-l-4 border-l-orange-500 bg-orange-50/50 text-orange-900 shadow-sm";
																													if (
																														aiVal !== "" &&
																														val !== aiVal
																													)
																														return "border-orange-300 bg-orange-50/30 text-orange-700";
																													if (
																														aiVal !== "" &&
																														origVal !== "" &&
																														val === aiVal &&
																														aiVal !== origVal
																													)
																														return "border-purple-300 bg-purple-50 text-purple-700";
																													return "border-transparent bg-transparent hover:bg-white focus:bg-white";
																												})(),
																											)}
																											style={{
																												minWidth: (col as any)
																													.minWidth,
																											}}
																											value={
																												item[col.key] ?? ""
																											}
																											onChange={(e) => {
																												const newList = [
																													...extractedData.cargoList,
																												];
																												newList[idx][col.key] =
																													col.type === "number"
																														? parseFloat(
																																e.target.value,
																															) || 0
																														: e.target.value;
																												setExtractedData({
																													...extractedData,
																													cargoList: newList,
																												});
																											}}
																										/>
																									)}
																								</TooltipTrigger>
																								{val && val.length > 20 && (
																									<TooltipPositioner side="top">
																										<TooltipContent className="max-w-[300px] break-words text-[11px] bg-slate-800 text-white">
																											{val}
																										</TooltipContent>
																									</TooltipPositioner>
																								)}
																							</Tooltip>
																						</TooltipProvider>

																						{cellConflict && (
																							<Popover>
																								<PopoverTrigger className="shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center hover:bg-amber-200 transition-colors animate-pulse shadow-sm border border-amber-200">
																									<AlertTriangle className="w-3 h-3" />
																								</PopoverTrigger>
																								<PopoverPositioner
																									side="top"
																									sideOffset={8}
																								>
																									<PopoverContent className="bg-white border border-amber-200 shadow-2xl rounded-2xl p-3 z-[110] w-[280px] pointer-events-auto animate-in zoom-in-95">
																										<div className="space-y-2">
																											<p className="text-[10px] font-bold text-amber-800 flex items-center gap-1.5">
																												<AlertTriangle className="w-3.5 h-3.5" />{" "}
																												Mâu thuẫn dữ liệu tại
																												dòng này
																											</p>
																											<div className="space-y-1">
																												{Array.isArray(
																													cellConflict.values,
																												) &&
																													cellConflict.values.map(
																														(
																															v: any,
																															vIdx: number,
																														) => (
																															<button
																																key={vIdx}
																																type="button"
																																onClick={() => {
																																	const newList =
																																		[
																																			...extractedData.cargoList,
																																		];
																																	newList[idx][
																																		col.key
																																	] =
																																		col.type ===
																																		"number"
																																			? parseFloat(
																																					v.value,
																																				)
																																			: v.value;
																																	setExtractedData(
																																		{
																																			...extractedData,
																																			cargoList:
																																				newList,
																																		},
																																	);
																																}}
																																className={cn(
																																	"w-full text-left p-2 rounded-xl border transition-all flex flex-col gap-0.5",
																																	val ===
																																		String(
																																			v.value,
																																		)
																																		? "bg-amber-100 border-amber-300 text-amber-900 shadow-sm"
																																		: "bg-gray-50 border-gray-100 hover:border-amber-200 hover:bg-amber-50 text-gray-700",
																																)}
																															>
																																<span className="text-[12px] font-bold">
																																	{v.value}
																																</span>
																																<span className="text-[9px] opacity-70 font-medium italic">
																																	Nguồn:{" "}
																																	{v.source}
																																</span>
																															</button>
																														),
																													)}
																											</div>
																											{cellConflict.reason && (
																												<div className="text-[9px] text-amber-900 bg-amber-50/50 p-2 rounded-lg leading-relaxed border border-amber-100/50 italic">
																													💡{" "}
																													{cellConflict.reason}
																												</div>
																											)}
																										</div>
																									</PopoverContent>
																								</PopoverPositioner>
																							</Popover>
																						)}

																						{hasSug && (
																							<Popover>
																								<PopoverTrigger className="shrink-0 w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center hover:bg-orange-200 transition-colors animate-pulse shadow-sm border border-orange-200">
																									<Sparkles className="w-3 h-3" />
																								</PopoverTrigger>
																								<PopoverPositioner
																									side="top"
																									sideOffset={8}
																								>
																									<PopoverContent className="bg-white border border-slate-200 shadow-2xl rounded-2xl p-3 z-[100] w-[350px] pointer-events-auto animate-in zoom-in-95 data-[side=top]:slide-in-from-bottom-2">
																										<div className="flex flex-col gap-1.5 w-full">
																											<p className="text-[10px] font-extrabold text-slate-400 capitalize tracking-tighter mb-1 ml-1 select-none">
																												AI GỢI Ý (CHỌN 1 CASE):
																											</p>
																											{suggestions.map(
																												(
																													sug: any,
																													sIdx: number,
																												) => (
																													<button
																														key={sIdx}
																														type="button"
																														onClick={(e) => {
																															e.preventDefault();
																															const newList = [
																																...extractedData.cargoList,
																															];
																															newList[idx][
																																col.key
																															] = sug.code;
																															setExtractedData({
																																...extractedData,
																																cargoList:
																																	newList,
																															});

																															const newAiCargoList =
																																[
																																	...(aiOriginalData?.cargoList ||
																																		[]),
																																];
																															if (
																																!newAiCargoList[
																																	idx
																																]
																															)
																																newAiCargoList[
																																	idx
																																] = {};
																															newAiCargoList[
																																idx
																															][col.key] =
																																sug.code;
																															setAiOriginalData(
																																{
																																	...aiOriginalData,
																																	cargoList:
																																		newAiCargoList,
																																},
																															);
																														}}
																														className={cn(
																															"text-left rounded-xl border p-2 transition-all hover:scale-[1.01] flex flex-col gap-1 w-full",
																															val === sug.code
																																? "bg-orange-600 text-white border-orange-700 shadow-md"
																																: "bg-white text-slate-700 border-slate-200 hover:border-orange-400 hover:text-orange-700 hover:bg-orange-50",
																														)}
																													>
																														<span className="flex items-center gap-1.5 font-bold tracking-tight text-[12px] group/sug">
																															<Sparkles
																																className={cn(
																																	"w-3 h-3 transition-transform group-hover/sug:rotate-12",
																																	val ===
																																		sug.code
																																		? "text-orange-200"
																																		: "text-orange-500",
																																)}
																															/>
																															{sug.code}
																														</span>
																														<span
																															className={cn(
																																"text-[10px] whitespace-normal opacity-80 leading-relaxed font-medium break-words",
																																val === sug.code
																																	? "text-white"
																																	: "text-slate-500",
																															)}
																														>
																															{sug.desc}
																														</span>
																													</button>
																												),
																											)}
																										</div>
																									</PopoverContent>
																								</PopoverPositioner>
																							</Popover>
																						)}
																					</div>

																					{aiVal !== "" && val !== aiVal && (
																						<button
																							onClick={() => {
																								const newList = [
																									...extractedData.cargoList,
																								];
																								newList[idx][col.key] =
																									col.type === "number"
																										? parseFloat(aiVal)
																										: aiVal;
																								setExtractedData({
																									...extractedData,
																									cargoList: newList,
																								});
																							}}
																							className="text-[9px] font-bold text-orange-500 hover:underline flex items-center gap-0.5 text-left mt-0.5"
																						>
																							<Sparkles className="w-2 h-2" />{" "}
																							AI: {aiVal}
																						</button>
																					)}

																					{aiVal !== "" &&
																						origVal !== "" &&
																						val === aiVal &&
																						aiVal !== origVal && (
																							<button
																								onClick={() => {
																									const newList = [
																										...extractedData.cargoList,
																									];
																									newList[idx][col.key] =
																										col.type === "number"
																											? parseFloat(origVal)
																											: origVal;
																									setExtractedData({
																										...extractedData,
																										cargoList: newList,
																									});
																								}}
																								className="text-[9px] font-bold text-purple-500 hover:underline flex items-center gap-0.5 text-left mt-0.5"
																							>
																								<RefreshCw className="w-2 h-2" />{" "}
																								Undo: {origVal}
																							</button>
																						)}
																				</div>
																			);

																			return cellInner;
																		})()}
																	</TableCell>
																))}
																<TableCell className="px-2 py-1">
																	<Button
																		variant="ghost"
																		size="icon"
																		className="h-7 w-7 text-gray-300 hover:text-red-500 hover:bg-red-50"
																		onClick={() => {
																			const newList =
																				extractedData.cargoList.filter(
																					(_: any, i: number) => i !== idx,
																				);
																			setExtractedData({
																				...extractedData,
																				cargoList: newList,
																			});
																		}}
																	>
																		<Trash2 className="w-3.5 h-3.5" />
																	</Button>
																</TableCell>
															</TableRow>
														),
													)}
													{extractedData.cargoList?.length > 0 && (
														<TableRow className="bg-orange-50 font-bold border-t-2 border-orange-200/50 sticky bottom-0 z-30 shadow-[0_-2px_5px_rgba(0,0,0,0.05)]">
															<TableCell className="px-2 py-2 text-center text-[10px] text-slate-400 sticky left-0 bg-orange-50 z-40 border-r border-b shadow-inner w-12 min-w-[48px] max-w-[48px]">
																∑
															</TableCell>
															{CARGO_COLUMNS.map((col, cIdx) => {
																if (
																	[
																		"qty",
																		"totalPrice",
																		"grossWeight",
																		"packageQty",
																	].includes(col.key)
																) {
																	const sum = extractedData.cargoList.reduce(
																		(acc: number, item: any) =>
																			acc + (parseFloat(item[col.key]) || 0),
																		0,
																	);
																	return (
																		<TableCell
																			key={col.key}
																			className={cn(
																				"px-2 py-2 text-[11px] text-orange-700 font-extrabold transition-all border-b",
																				cIdx === 0 &&
																					"sticky left-12 bg-orange-50 z-40 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]",
																			)}
																		>
																			{sum.toLocaleString("en-US", {
																				maximumFractionDigits: 2,
																			})}
																		</TableCell>
																	);
																}
																if (cIdx === 0) {
																	return (
																		<TableCell
																			key={col.key}
																			className="px-2 py-2 text-[10px] uppercase text-orange-600 font-black tracking-widest sticky left-12 bg-orange-50 z-40 border-r border-b shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
																		>
																			TỔNG CỘNG
																		</TableCell>
																	);
																}
																return (
																	<TableCell
																		key={col.key}
																		className={cn(
																			"px-1 py-1 transition-all border-b",
																			cIdx === 0 &&
																				"sticky left-12 bg-orange-50 z-40 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]",
																		)}
																	></TableCell>
																);
															})}
															<TableCell className="px-2 py-1 border-b bg-orange-50"></TableCell>
														</TableRow>
													)}
												</TableBody>
											</Table>
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
				<DialogFooter className="border-t pt-4 bg-white/50 backdrop-blur-sm -mx-6 px-6 pb-6 mt-0">
					<Button
						variant="ghost"
						onClick={() => onOpenChange(false)}
						disabled={saving}
						className="rounded-xl font-bold"
					>
						Hủy
					</Button>
					<Button
						className="bg-green-600 hover:bg-green-700 font-bold gap-2 rounded-xl px-8 shadow-lg shadow-green-100"
						disabled={!extractedData || saving}
						onClick={handleSave}
					>
						{saving ? (
							<Spinner className="w-4 h-4" />
						) : (
							<CheckCircle2 className="w-5 h-5" />
						)}
						Save all
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function DataField({
	label,
	value,
	originalValue,
	aiSuggestedValue,
	onChange,
	className = "",
	type = "text",
	options,
	multiline = false,
	conflict,
}: {
	label: string;
	value: any;
	originalValue?: any;
	aiSuggestedValue?: any;
	onChange: (v: any) => void;
	className?: string;
	type?: string;
	options?: string[];
	multiline?: boolean;
	conflict?: {
		values: { value: string; source: string }[];
		selected: string;
		reason: string;
	};
}) {
	const formatStr = (v: any) => {
		if (v === undefined || v === null) return "";
		if (v instanceof Date) return v.toISOString().split("T")[0];
		if (typeof v === "string" && v.match(/^\d{4}-\d{2}-\d{2}T/))
			return v.split("T")[0];
		return String(v).trim();
	};

	const aiStr = formatStr(aiSuggestedValue);
	const originalStr = formatStr(originalValue);
	const valueStr = formatStr(value);

	const isAiValid = aiStr !== "";
	const isOriginalValid = originalStr !== "";

	// 1. Current value differs from AI suggestion
	const isCurrentDiffFormAi = isAiValid && valueStr !== aiStr;

	// 2. Current value is showing AI's suggestion AND it differs from user's original value
	const isCurrentShowingAiDifferingFromOriginal =
		isAiValid && isOriginalValid && valueStr === aiStr && aiStr !== originalStr;

	const inputEl = options ? (
		<select
			value={value ?? ""}
			onChange={(e) => onChange(e.target.value)}
			className={cn(
				"h-10 text-sm font-bold bg-white border focus:border-orange-500 rounded-lg w-full px-3 outline-none transition-colors",
				conflict
					? "border-amber-400 bg-amber-50/30"
					: isCurrentDiffFormAi
						? "border-orange-300 focus:ring-orange-300"
						: isCurrentShowingAiDifferingFromOriginal
							? "border-purple-300 bg-purple-50 text-purple-700 focus:ring-purple-300"
							: "border-gray-200 focus:ring-blue-500",
			)}
		>
			<option value=""></option>
			{Array.from(new Set(options)).map((opt, i) => (
				<option key={`${opt}-${i}`} value={opt}>
					{opt}
				</option>
			))}
		</select>
	) : multiline ? (
		<Textarea
			value={value ?? ""}
			onChange={(e) => onChange(e.target.value)}
			className={cn(
				"min-h-[80px] text-sm font-bold transition-colors resize-none",
				conflict
					? "border-amber-400 bg-amber-50/50"
					: isCurrentDiffFormAi
						? "border-orange-300 focus-visible:ring-orange-300 bg-orange-50 text-orange-700"
						: isCurrentShowingAiDifferingFromOriginal
							? "border-purple-300 focus-visible:ring-purple-300 bg-purple-50 text-purple-700"
							: "border-gray-200 focus-visible:ring-blue-500 focus-visible:border-blue-500",
			)}
		/>
	) : (
		<Input
			type={type}
			value={value ?? ""}
			onChange={(e) =>
				onChange(
					type === "number" ? parseFloat(e.target.value) : e.target.value,
				)
			}
			className={cn(
				"h-10 text-sm font-bold transition-colors",
				conflict
					? "border-amber-400 bg-amber-50/50"
					: isCurrentDiffFormAi
						? "border-orange-300 focus-visible:ring-orange-300 bg-orange-50 text-orange-700"
						: isCurrentShowingAiDifferingFromOriginal
							? "border-purple-300 focus-visible:ring-purple-300 bg-purple-50 text-purple-700"
							: "border-gray-200 focus-visible:ring-blue-500 focus-visible:border-blue-500",
			)}
		/>
	);

	return (
		<div className={cn("space-y-1.5", className)}>
			<div className="flex items-center justify-between pl-1">
				<label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest text-[10px] truncate max-w-[150px]">
					{label}
				</label>
				{conflict && (
					<Popover>
						<PopoverTrigger className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-md hover:bg-amber-200 transition-colors animate-pulse shrink-0">
							<AlertTriangle className="w-3 h-3" />
							MÂU THUẪN
						</PopoverTrigger>
						<PopoverPositioner side="top" sideOffset={5}>
							<PopoverContent className="w-[280px] p-3 rounded-2xl border border-amber-200 shadow-xl bg-white z-[110] animate-in zoom-in-95">
								<div className="space-y-2">
									<p className="text-[11px] font-bold text-amber-800 flex items-center gap-1.5">
										<AlertTriangle className="w-3.5 h-3.5" /> Dữ liệu không khớp
										giữa các file
									</p>
									<div className="space-y-1">
										{Array.isArray(conflict.values) &&
											conflict.values.map((v, idx) => (
												<button
													key={idx}
													type="button"
													onClick={() =>
														onChange(
															type === "number" ? parseFloat(v.value) : v.value,
														)
													}
													className={cn(
														"w-full text-left p-2 rounded-xl border transition-all flex flex-col gap-0.5",
														valueStr === formatStr(v.value)
															? "bg-amber-100 border-amber-300 text-amber-900 shadow-sm"
															: "bg-gray-50 border-gray-100 hover:border-amber-200 hover:bg-amber-50 text-gray-700",
													)}
												>
													<span className="text-[12px] font-bold">
														{v.value}
													</span>
													<span className="text-[9px] opacity-70 font-medium italic">
														Nguồn: {v.source}
													</span>
												</button>
											))}
									</div>
									{conflict.reason && (
										<div className="text-[9px] text-amber-900 bg-amber-50/50 p-2 rounded-lg leading-relaxed border border-amber-100/50">
											💡 <strong>Lý do AI chọn mặc định:</strong>{" "}
											{conflict.reason}
										</div>
									)}
								</div>
							</PopoverContent>
						</PopoverPositioner>
					</Popover>
				)}
			</div>

			{conflict ? (
				<Popover>
					<PopoverTrigger className="w-full text-left p-0 border-none bg-transparent">
						{inputEl}
					</PopoverTrigger>
					<PopoverPositioner side="bottom" sideOffset={2}>
						<PopoverContent className="w-[280px] p-2 rounded-xl border border-amber-100 shadow-lg bg-amber-50/95 backdrop-blur-sm z-[110] animate-in fade-in">
							<p className="text-[9px] font-bold text-amber-700 px-1 italic">
								Click vào nhãn "MÂU THUẪN" bên trên để chọn lại giá trị đúng.
							</p>
						</PopoverContent>
					</PopoverPositioner>
				</Popover>
			) : (
				inputEl
			)}

			{isCurrentDiffFormAi && !conflict && (
				<button
					type="button"
					onClick={() =>
						onChange(type === "number" ? parseFloat(aiStr) : aiStr)
					}
					className="text-[10px] flex items-center gap-1 font-bold text-orange-500 hover:text-orange-600 transition-colors animate-in fade-in pl-1"
				>
					<Sparkles className="w-3 h-3" />✨ Chọn AI: {aiStr}
				</button>
			)}

			{isCurrentShowingAiDifferingFromOriginal && !conflict && (
				<button
					type="button"
					onClick={() =>
						onChange(type === "number" ? parseFloat(originalStr) : originalStr)
					}
					className="text-[10px] flex items-center gap-1 font-bold text-purple-500 hover:text-purple-600 transition-colors animate-in fade-in pl-1"
				>
					<RefreshCw className="w-3 h-3" />
					Hoàn tác: {originalStr}
				</button>
			)}
		</div>
	);
}
