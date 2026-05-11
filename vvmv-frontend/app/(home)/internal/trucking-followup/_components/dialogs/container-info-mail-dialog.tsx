"use client";

import {
	ArrowLeft,
	Check,
	ChevronLeft,
	ChevronRight,
	File,
	File as FileIcon2,
	FileSpreadsheet,
	FileText,
	Folder,
	HardDrive,
	Image as ImageIcon,
	Loader2,
	Mail,
	Paperclip,
	RefreshCw,
	Send,
	Trash2,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { TruckingFollowUpRow } from "../../types";

// ─── Gmail thread type ──────────────────────────────────────────────────────
import {
	type GmailThread,
	GmailThreadPicker as ThreadPicker,
} from "./gmail-thread-picker";

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

type SourceTab = "local" | "drive";

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function formatDate(d: string) {
	try {
		const date = new Date(d);
		return date.toLocaleDateString("vi-VN", {
			day: "2-digit",
			month: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return d;
	}
}

function senderName(from: string) {
	const m = from.match(/^(.+?)\s*<.+>$/);
	return m ? m[1].replace(/"/g, "") : from.split("@")[0];
}

function formatNum(v: any) {
	if (v === null || v === undefined || v === "") return "";
	const num = Number(v);
	return Number.isNaN(num) ? v : num.toLocaleString();
}

function buildContainerTableHtml(
	containers: TruckingFollowUpRow["containers"],
	booking?: string | null,
	fcrs?: TruckingFollowUpRow["fcrs"],
	jobNumber?: string | null,
	logisticsJobNumber?: string | null,
): string {
	if (!containers || containers.length === 0) {
		return `<div style="padding: 24px; text-align: center; color: #64748b; font-style: italic; border: 1px dashed #cbd5e1; border-radius: 8px;">Không có dữ liệu container</div>`;
	}

	const isHcmJob = (jobNumber || "").toUpperCase().startsWith("HCM");
	const showKc = isHcmJob;
	const showLogisticsJob = !!logisticsJobNumber;

	const rows = containers
		.map((c: any, index: number) => {
			const bg = index % 2 === 0 ? "#ffffff" : "#f8fafc";
			// Lấy driverName từ FCR tương ứng với container này
			const matchedFcr = fcrs?.find((f) => f.containerId === c.id);
			const driverName = matchedFcr?.driver || c.driver || c.driverName || "";
			return `<tr style="background-color: ${bg}; transition: background-color 0.2s;">
        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #475569; border-right: 1px solid #f1f5f9;">${booking || ""}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #0f172a; border-right: 1px solid #f1f5f9;">${c.containerNo || ""}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #475569; border-right: 1px solid #f1f5f9;">${c.sealNo || ""}</td>
        ${showKc ? `<td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #475569; border-right: 1px solid #f1f5f9;">${c.kc || ""}</td>` : ""}
        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #475569; text-align: right; border-right: 1px solid #f1f5f9;">${formatNum(c.tareWeight)}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #475569; text-align: right; border-right: 1px solid #f1f5f9;">${formatNum(c.masGross)}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #475569; border-right: 1px solid #f1f5f9;">${c.plateNumber || ""}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #475569; border-right: 1px solid #f1f5f9;">${driverName}</td>
        ${showLogisticsJob ? `<td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #6366f1; font-weight: 600;">${logisticsJobNumber}</td>` : ""}
      </tr>`;
		})
		.join("");

	return `
<div style="border: 3px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 24px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);">
  <table style="border-collapse: collapse; width: 100%; max-width: 1000px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <thead>
      <tr style="background: linear-gradient(90deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff;">
        <th style="padding: 14px 16px; text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">SỐ BOOKING</th>
        <th style="padding: 14px 16px; text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">SỐ CONT</th>
        <th style="padding: 14px 16px; text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">SỐ SEAL</th>
        ${showKc ? `<th style="padding: 14px 16px; text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">KC</th>` : ""}
        <th style="padding: 14px 16px; text-align: right; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">TARE (kg)</th>
        <th style="padding: 14px 16px; text-align: right; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">MAX GROSS (kg)</th>
        <th style="padding: 14px 16px; text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">SỐ XE</th>
        <th style="padding: 14px 16px; text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">TÊN TÀI XẾ</th>
        ${showLogisticsJob ? `<th style="padding: 14px 16px; text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">SỐ JOB LOGISTICS</th>` : ""}
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
}

function buildEmailBody(
	containers: TruckingFollowUpRow["containers"],
	booking: string | null | undefined,
	extraNote: string,
	fcrs?: TruckingFollowUpRow["fcrs"],
	jobNumber?: string | null,
	logisticsJobNumber?: string | null,
	jobInfo?: string,
): string {
	const tableHtml = buildContainerTableHtml(
		containers,
		booking,
		fcrs,
		jobNumber,
		logisticsJobNumber,
	);

	const noteSection = extraNote.trim()
		? `<div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
        <div style="font-size: 12px; font-weight: 700; color: #1d4ed8; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.05em;">Thông tin đính kèm / Ghi chú thêm</div>
        <div style="font-size: 14px; color: #1e3a8a; white-space: pre-line; line-height: 1.6;">${extraNote.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
       </div>`
		: "";

	return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; max-width: 800px; width: 100%; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
          <tr>
            <td style="padding: 40px;">

              <!-- Header -->


              <!-- Greeting -->
              <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;"><strong>Kính gửi Quý Khách Hàng,</strong></p>
              <p style="margin: 0 0 ${jobInfo ? "12px" : "28px"}; font-size: 15px; color: #334155; line-height: 1.6;">Chúng tôi xin gửi thông tin chi tiết các container thuộc lô hàng của Quý khách như sau:</p>
              ${jobInfo ? `<p style="margin: 0 0 24px; font-weight: 700; color: #0369a1; font-size: 16px;">${jobInfo}</p>` : ""}

              <!-- Table Data -->
              ${tableHtml}

              <!-- Extra Note -->
              ${noteSection}

              <!-- Footer -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 24px;">
                <tr>
                  <td style="font-size: 14px; color: #334155; line-height: 1.6;">
                    <p style="margin: 0 0 4px;">Trân trọng cảm ơn,</p>
                    <p style="margin: 0; font-weight: 600; color: #0f172a;">Team FCL</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>
        
        <!-- Subtle Footer Note -->
        <table border="0" cellspacing="0" cellpadding="0" style="max-width: 800px; width: 100%; margin-top: 20px;">
          <tr>
            <td align="center" style="font-size: 12px; color: #94a3b8; line-height: 1.5;">
              <p style="margin: 0;">Email này được gửi tự động từ hệ thống quản lý giao nhận.</p>
              <p style="margin: 0;">Vui lòng phản hồi trực tiếp nếu Quý khách có bất kỳ yêu cầu điều chỉnh hoặc sai sót nào.</p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Thread Picker imported above

// ─── Main Dialog ─────────────────────────────────────────────────────────────

interface ContainerInfoMailDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	row: TruckingFollowUpRow | null;
}

type Step = "pick-thread" | "compose";

export function ContainerInfoMailDialog({
	open,
	onOpenChange,
	row,
}: ContainerInfoMailDialogProps) {
	const [step, setStep] = useState<Step>("pick-thread");
	const [selectedThread, setSelectedThread] = useState<GmailThread | null>(
		null,
	);
	const [toField, setToField] = useState("");
	const [ccField, setCcField] = useState("");
	const [editableNote, setEditableNote] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [activeTab, setActiveTab] = useState<SourceTab>("local");
	const [localImages, setLocalImages] = useState<
		Array<{ file: File; preview: string; name: string; mimeType: string }>
	>([]);
	const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([]);
	const [driveFolders, setDriveFolders] = useState<DriveItem[]>([]);
	const [driveFiles, setDriveFiles] = useState<DriveItem[]>([]);
	const [fetchingDrive, setFetchingDrive] = useState(false);
	const [selectedDriveFiles, setSelectedDriveFiles] = useState<DriveItem[]>([]);
	const [resolvedDriveUrl, setResolvedDriveUrl] = useState<string | null>(
		row?.driveUrl || null,
	);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		let isMounted = true;
		if (open && row?.id) {
			setResolvedDriveUrl(row?.driveUrl || null);
			fetch(`/api/trucking-followup/drive-url?id=${row.id}`)
				.then((res) => res.json())
				.then((data) => {
					if (isMounted) {
						setResolvedDriveUrl(data.driveUrl || row.driveUrl || null);
					}
				})
				.catch((err) => {
					console.error("Failed to fetch resolved driveUrl", err);
					if (isMounted) setResolvedDriveUrl(row.driveUrl || null);
				});
		} else {
			setResolvedDriveUrl(null);
		}
		return () => {
			isMounted = false;
		};
	}, [open, row]);

	const matchDrive = resolvedDriveUrl?.match(/(?:folders\/|id=)([\w-]+)/);
	const rootFolderId = matchDrive ? matchDrive[1] : resolvedDriveUrl || null;
	const currentFolderId =
		breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].id : rootFolderId;

	// Reset when dialog closes / row changes
	useEffect(() => {
		if (!open) {
			setStep("pick-thread");
			setSelectedThread(null);
			setToField("");
			setCcField("");
			setEditableNote("");
			setLocalImages([]);
			setSelectedDriveFiles([]);
			setBreadcrumb([]);
			setDriveFolders([]);
			setDriveFiles([]);
			setActiveTab("local");
		}
	}, [open]);

	const loadFolder = useCallback(
		async (folderId: string, keepSelection = false) => {
			setFetchingDrive(true);
			if (!keepSelection) setSelectedDriveFiles([]);
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

	const enterFolder = (f: DriveItem) => {
		setBreadcrumb((p) => [...p, { id: f.id, name: f.name }]);
		loadFolder(f.id, true); // giữ lại file đã chọn khi chuyển folder
	};

	const navigateTo = (index: number) => {
		if (index === -1) {
			setBreadcrumb([]);
			rootFolderId && loadFolder(rootFolderId, true); // giữ lại file đã chọn khi back ra ngoài
		} else {
			const c = breadcrumb.slice(0, index + 1);
			setBreadcrumb(c);
			loadFolder(c[c.length - 1].id, true); // giữ lại file đã chọn khi chuyển folder
		}
	};

	const toggleDrive = (f: DriveItem) => {
		setSelectedDriveFiles((p) =>
			p.some((x) => x.id === f.id) ? p.filter((x) => x.id !== f.id) : [...p, f],
		);
	};

	const selectAllInFolder = () => {
		const allSelected = driveFiles.every((df) =>
			selectedDriveFiles.some((sf) => sf.id === df.id),
		);
		if (allSelected) {
			setSelectedDriveFiles((p) =>
				p.filter((sf) => !driveFiles.some((df) => df.id === sf.id)),
			);
		} else {
			const merged = [...selectedDriveFiles];
			for (const df of driveFiles) {
				if (!merged.some((m) => m.id === df.id)) merged.push(df);
			}
			setSelectedDriveFiles(merged);
		}
	};

	// When a thread is selected, pre-fill To and Cc (Reply All)
	const handleSelectThread = (thread: GmailThread) => {
		setSelectedThread(thread);
		// Reply goes back to whoever sent the last email in the thread
		setToField(thread.from || "");

		// Extract raw emails from From to filter them out of CC
		const fromEmails: string[] =
			(thread.from || "").match(
				/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
			) || [];

		// Reply All: add all others from To & Cc to CC, excluding the original sender
		const ccEmails = [thread.to, thread.cc]
			.filter(Boolean)
			.join(", ")
			.split(/[;,]/)
			.map((e) => {
				const match = e.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
				return match ? match[0] : null;
			})
			.filter(
				(e): e is string => Boolean(e) && !fromEmails.includes(e as string),
			);

		// Deduplicate emails
		const uniqueCc = Array.from(new Set(ccEmails)).join(", ");
		setCcField(uniqueCc);

		setStep("compose");
	};

	const handleBack = () => {
		setStep("pick-thread");
		setSelectedThread(null);
		setToField("");
		setCcField("");
	};

	const handleAddImages = (files: File[]) => {
		const added = files
			.filter((f) => f.type.startsWith("image/"))
			.map((f) => ({
				file: f,
				preview: URL.createObjectURL(f),
				name: f.name,
				mimeType: f.type,
			}));
		setLocalImages((prev) => [...prev, ...added]);
	};

	const handleRemoveImage = (idx: number) => {
		setLocalImages((prev) => {
			URL.revokeObjectURL(prev[idx].preview);
			return prev.filter((_, i) => i !== idx);
		});
	};

	const handleSend = async () => {
		if (!selectedThread) return;
		if (!toField.trim()) {
			toast.error("Vui lòng nhập địa chỉ email người nhận.");
			return;
		}

		setIsSending(true);
		const toastId = toast.loading("Đang gửi email...");

		try {
			const subject = selectedThread.subject.startsWith("Re:")
				? selectedThread.subject
				: `Re: ${selectedThread.subject}`;

			const sendOpType =
				row?.operationType?.toUpperCase() === "XUAT"
					? "Xuất"
					: row?.operationType?.toUpperCase() === "NHAP"
						? "Nhập"
						: row?.operationType || "";
			const sendJobInfo = [
				sendOpType,
				row?.serviceMode,
				row?.companyName,
				row?.billOrBooking,
			]
				.filter(Boolean)
				.join(" + ");
			const htmlBody = buildEmailBody(
				row?.containers,
				row?.eportBooking || row?.billOrBooking,
				editableNote,
				row?.fcrs,
				row?.jobNumber,
				row?.followUps?.[0]?.jobNumber,
				sendJobInfo || undefined,
			);

			// Read images as base64
			const imageFiles = await Promise.all(
				localImages.map(
					(img) =>
						new Promise<{ data: string; mimeType: string; name: string }>(
							(resolve, reject) => {
								const reader = new FileReader();
								reader.onload = () => {
									const r = reader.result as string;
									resolve({
										data: r.split(",")[1],
										mimeType: img.mimeType,
										name: img.name,
									});
								};
								reader.onerror = reject;
								reader.readAsDataURL(img.file);
							},
						),
				),
			);

			const res = await fetch("/api/trucking-followup/send-mail", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					to: toField,
					cc: ccField || undefined,
					subject,
					body: htmlBody,
					isHtml: true,
					driveFileIds: selectedDriveFiles.map((f) => f.id),
					localFiles: imageFiles,
					threadId: selectedThread.threadId,
					inReplyTo: selectedThread.inReplyTo,
					references: selectedThread.references,
				}),
			});

			const result = await res.json();
			toast.dismiss(toastId);

			if (!res.ok) throw new Error(result.message || "Gửi email thất bại");

			toast.success("Email đã được gửi thành công!");
			onOpenChange(false);
		} catch (e: any) {
			toast.dismiss(toastId);
			toast.error("Lỗi gửi email", { description: e.message });
		} finally {
			setIsSending(false);
		}
	};

	const containers = row?.containers ?? [];
	const previewOpType =
		row?.operationType?.toUpperCase() === "XUAT"
			? "Xuất"
			: row?.operationType?.toUpperCase() === "NHAP"
				? "Nhập"
				: row?.operationType || "";
	const previewJobInfo = [
		previewOpType,
		row?.serviceMode,
		row?.companyName,
		row?.billOrBooking,
	]
		.filter(Boolean)
		.join(" + ");
	const previewBody = buildEmailBody(
		containers,
		row?.eportBooking || row?.billOrBooking,
		editableNote,
		row?.fcrs,
		row?.jobNumber,
		row?.followUps?.[0]?.jobNumber,
		previewJobInfo || undefined,
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="p-0 max-w-[640px] max-h-[90dvh] flex flex-col gap-0 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl shadow-xl overflow-hidden [&>button]:hidden">
				<div className="flex flex-col flex-1 min-h-0">
					{/* ── Header ── */}
					<div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
						<div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600">
							<Mail className="size-4 text-white" />
						</div>
						<div className="flex-1">
							<p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
								{step === "pick-thread"
									? "Chọn email để reply"
									: "Email thông tin Container"}
							</p>
							<p className="text-[11px] text-slate-400">
								{step === "pick-thread"
									? "Chọn một email trong hộp thư Gmail để reply vào đó"
									: `Reply vào: ${selectedThread?.subject}`}
							</p>
						</div>
						<button
							onClick={() => onOpenChange(false)}
							className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
						>
							<X className="size-4" />
						</button>
					</div>

					{/* ── Step: Pick Thread ── */}
					{step === "pick-thread" && (
						<ThreadPicker onSelect={handleSelectThread} />
					)}

					{/* ── Step: Compose ── */}
					{step === "compose" && selectedThread && (
						<div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
							{/* Back */}
							<div className="px-5 py-2 flex items-center">
								<button
									type="button"
									onClick={handleBack}
									className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-blue-600 transition-colors"
								>
									<ChevronLeft className="size-3" />
									Chọn email khác
								</button>
							</div>

							{/* Thread info */}
							<div className="px-5 py-2 bg-blue-50/40 dark:bg-blue-900/10">
								<p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 truncate">
									{selectedThread.subject}
								</p>
								<p className="text-[10px] text-slate-400 truncate">
									{senderName(selectedThread.from)} ·{" "}
									{formatDate(selectedThread.date)}
								</p>
							</div>

							{/* To */}
							<div className="px-5 py-3 flex items-center gap-3">
								<span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-14 shrink-0">
									Đến
								</span>
								<input
									type="text"
									value={toField}
									onChange={(e) => setToField(e.target.value)}
									className="flex-1 text-[12px] text-slate-700 dark:text-slate-200 bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-400 focus:outline-none transition-colors py-0.5"
									placeholder="Email người nhận..."
								/>
							</div>

							{/* CC */}
							<div className="px-5 py-2 flex items-center gap-3">
								<span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-14 shrink-0">
									CC
								</span>
								<input
									type="text"
									value={ccField}
									onChange={(e) => setCcField(e.target.value)}
									className="flex-1 text-[12px] text-slate-700 dark:text-slate-200 bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-400 focus:outline-none transition-colors py-0.5"
									placeholder="Email CC (tuỳ chọn)..."
								/>
							</div>

							{/* Thẻ xem trước nội dung HTML Email thực tế */}
							<div className="px-5 py-4 space-y-2 flex-1 flex flex-col min-h-0">
								<div className="flex items-center gap-1.5">
									<File className="size-3 text-blue-500" />
									<span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
										Bản xem trước Email
									</span>
									<span className="text-[10px] text-slate-400">
										— nội dung thực tế sẽ được gửi đi
									</span>
								</div>

								<div className="flex-1 min-h-[220px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white shadow-inner overflow-hidden flex flex-col">
									<iframe
										key={previewBody}
										srcDoc={previewBody}
										className="w-full flex-1"
										sandbox="allow-same-origin"
										title="Email preview"
									/>
								</div>
							</div>

							{/* Ghi chú thêm */}
							<div className="px-5 py-2 space-y-1.5 shrink-0">
								<span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
									Ghi chú thêm
								</span>
								<textarea
									value={editableNote}
									onChange={(e) => setEditableNote(e.target.value)}
									rows={2}
									placeholder="Nhập ghi chú hoặc yêu cầu đặc biệt... (hiển thị cuối email)"
									className="w-full text-[12px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-400 focus:outline-none resize-none transition-colors"
								/>
							</div>

							{/* Image & File Upload */}
							<div className="px-5 py-3 space-y-2">
								<div className="flex items-center justify-between mb-2">
									<div className="flex items-center gap-1.5">
										<ImageIcon className="size-3 text-amber-500" />
										<span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
											Đính kèm file
										</span>
										{(localImages.length > 0 ||
											selectedDriveFiles.length > 0) && (
											<span className="text-[10px] text-slate-400">
												({localImages.length} máy tính,{" "}
												{selectedDriveFiles.length} Drive)
											</span>
										)}
									</div>
								</div>

								<div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg mb-2">
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
										<Paperclip className="h-3.5 w-3.5" />
										Máy tính
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
												? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm"
												: "text-slate-500 hover:text-slate-700",
										)}
									>
										<HardDrive className="h-3.5 w-3.5" />
										Từ Google Drive
									</button>
								</div>

								{activeTab === "local" && (
									<>
										<div className="flex justify-end mb-2">
											<button
												type="button"
												onClick={() => fileInputRef.current?.click()}
												className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-blue-600 border border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-400 px-2.5 py-1 rounded-lg transition-colors"
											>
												<Paperclip className="size-3" />
												Thêm ảnh (máy tính)
											</button>
										</div>
										<input
											ref={fileInputRef}
											type="file"
											multiple
											accept="image/*"
											className="hidden"
											onChange={(e) => {
												if (e.target.files) {
													handleAddImages(Array.from(e.target.files));
													e.target.value = "";
												}
											}}
										/>

										{localImages.length > 0 && (
											<div className="grid grid-cols-4 gap-2">
												{localImages.map((img, idx) => (
													<div
														key={idx}
														className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 aspect-square"
													>
														{/* eslint-disable-next-line @next/next/no-img-element */}
														<img
															src={img.preview}
															alt={img.name}
															className="w-full h-full object-cover"
														/>
														<button
															type="button"
															onClick={() => handleRemoveImage(idx)}
															className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
														>
															<Trash2 className="size-2.5" />
														</button>
														<div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
															<p className="text-[9px] text-white truncate">
																{img.name}
															</p>
														</div>
													</div>
												))}
											</div>
										)}
									</>
								)}

								{activeTab === "drive" && (
									<div className="space-y-2 mt-2">
										<div className="flex items-center gap-1 flex-wrap mb-1">
											<button
												type="button"
												onClick={() => navigateTo(-1)}
												className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
											>
												<HardDrive className="h-3 w-3" />
												Job Drive
											</button>
											{breadcrumb.map((crumb, idx) => (
												<span
													key={crumb.id}
													className="flex items-center gap-1"
												>
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
														className={cn(
															"h-3 w-3",
															fetchingDrive && "animate-spin",
														)}
													/>
												</Button>
											</div>
										</div>

										{fetchingDrive ? (
											<div className="flex items-center justify-center py-6 gap-2 text-muted-foreground bg-slate-50 dark:bg-slate-800/20 rounded-lg">
												<Loader2 className="h-4 w-4 animate-spin" />
												<span className="text-xs">
													Đang tải Google Drive...
												</span>
											</div>
										) : (
											<div className="border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden bg-white dark:bg-slate-900 border-x border-y">
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
																		selectedDriveFiles.some(
																			(sf) => sf.id === f.id,
																		),
																	)
																		? "bg-blue-500 border-blue-500"
																		: "border-slate-300",
																)}
															>
																{driveFiles.every((f) =>
																	selectedDriveFiles.some(
																		(sf) => sf.id === f.id,
																	),
																) && (
																	<Check className="h-2.5 w-2.5 text-white" />
																)}
															</div>
															<span>
																Chọn tất cả ({driveFiles.length} file)
															</span>
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
													{driveFiles.length === 0 &&
														driveFolders.length === 0 && (
															<div className="py-6 text-center text-xs text-slate-400 italic">
																Thư mục trống
															</div>
														)}
													{driveFiles.map((f) => {
														const sel = selectedDriveFiles.some(
															(sf) => sf.id === f.id,
														);
														return (
															<div
																key={f.id}
																onClick={() => toggleDrive(f)}
																className={cn(
																	"flex items-center gap-2.5 px-3 py-2 cursor-pointer text-xs transition-colors",
																	sel
																		? "bg-blue-50 dark:bg-blue-900/20"
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
															</div>
														);
													})}
												</div>
											</div>
										)}

										{selectedDriveFiles.length > 0 && (
											<div className="mt-2 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
												<p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">
													ĐÃ CHỌN TỪ DRIVE ({selectedDriveFiles.length})
												</p>
												<div className="flex flex-wrap gap-1.5">
													{selectedDriveFiles.map((sf) => (
														<div
															key={sf.id}
															className="flex items-center gap-1 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 border px-1.5 py-0.5 rounded shadow-sm text-[10px]"
														>
															<FileTypeIcon
																mimeType={sf.mimeType}
																className="w-2.5 h-2.5 text-blue-500"
															/>
															<span className="truncate max-w-[120px]">
																{sf.name}
															</span>
															<button
																onClick={(e) => {
																	e.stopPropagation();
																	toggleDrive(sf);
																}}
																className="text-slate-400 hover:text-red-500 rounded-full hover:bg-slate-100 p-0.5"
															>
																<X className="w-2 h-2" />
															</button>
														</div>
													))}
												</div>
											</div>
										)}
									</div>
								)}
							</div>
						</div>
					)}

					{/* ── Footer ── */}
					<div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 shrink-0">
						<div>
							{step === "compose" &&
								(localImages.length > 0 || selectedDriveFiles.length > 0) && (
									<span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/40 px-2.5 py-1 rounded-lg">
										<ImageIcon className="size-3" />
										{localImages.length + selectedDriveFiles.length} file đính
										kèm
									</span>
								)}
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onOpenChange(false)}
								className="h-8 px-4 text-[12px] text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
							>
								Hủy
							</Button>
							{step === "compose" && (
								<Button
									size="sm"
									onClick={handleSend}
									disabled={isSending}
									className="h-8 px-3 text-[12px] bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-sm gap-1.5"
								>
									<Send className="size-3" />
									{isSending ? "Đang gửi..." : "Gửi email"}
								</Button>
							)}
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
