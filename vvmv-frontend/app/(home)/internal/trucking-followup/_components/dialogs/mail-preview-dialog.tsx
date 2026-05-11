"use client";

import {
	CheckSquare,
	ChevronLeft,
	Code2,
	ExternalLink,
	Eye,
	FileText,
	FolderOpen,
	Mail,
	Paperclip,
	Search,
	Send,
	Square,
	Upload,
	X,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type MailDraft = {
	vendorName?: string;
	to: string;
	cc?: string;
	subject: string;
	replyThread?: {
		threadId: string;
		inReplyTo?: string;
		references?: string;
	};
	bodyPrefix: string;
	isHtml?: boolean;
	driveUrl: string;
	driveFiles: Array<{
		id: string;
		name: string;
		webViewLink?: string;
		mimeType: string;
	}>;
	userEmail: string;
};

interface SelectedFile {
	file: File;
	preview?: string;
	name: string;
	mimeType: string;
}

interface DriveFileGroup {
	folder: string | null;
	files: MailDraft["driveFiles"];
}

interface MailPreviewDialogProps {
	drafts: MailDraft[];
	onClose: () => void;
}

function groupDriveFiles(files: MailDraft["driveFiles"]): DriveFileGroup[] {
	const rootFiles: MailDraft["driveFiles"] = [];
	const folderMap = new Map<string, MailDraft["driveFiles"]>();

	for (const f of files) {
		const match = f.name.match(/^\[(.+?)\] (.+)$/);
		if (match) {
			const folder = match[1];
			const cleanName = match[2];
			if (!folderMap.has(folder)) folderMap.set(folder, []);
			folderMap.get(folder)?.push({ ...f, name: cleanName });
		} else {
			rootFiles.push(f);
		}
	}

	const groups: DriveFileGroup[] = [];
	if (rootFiles.length > 0) groups.push({ folder: null, files: rootFiles });
	for (const [folder, files] of folderMap.entries()) {
		groups.push({ folder, files });
	}
	return groups;
}

function splitEmails(str: string) {
	return str
		.split(/[;,]/)
		.map((s) => s.trim())
		.filter(Boolean);
}

// Per-draft persisted state shape
type DraftState = {
	selectedFileIds: Set<string>;
	selectedLocalFiles: SelectedFile[];
	editableBody: string;
	editableSubject: string;
	editableNote: string;
};

function makeDraftState(draft: MailDraft): DraftState {
	const selectedFileIds = new Set(
		draft.driveFiles
			.filter((f) => f.name.startsWith("[Freight Doc"))
			.map((f) => f.id),
	);
	return {
		selectedFileIds,
		selectedLocalFiles: [],
		editableBody: draft.bodyPrefix,
		editableSubject: draft.subject,
		editableNote: "",
	};
}

export function MailPreviewDialog({ drafts, onClose }: MailPreviewDialogProps) {
	const [activeDraftIdx, setActiveDraftIdx] = useState(0);
	const [isSendingAll, setIsSendingAll] = useState(false);
	const [fileSearch, setFileSearch] = useState("");
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Per-draft state: keyed by draft index, persists across tab switches
	const [draftStates, setDraftStates] = useState<Map<number, DraftState>>(
		new Map(),
	);

	const draft = drafts[activeDraftIdx] ?? null;
	const isOpen = drafts.length > 0;

	// Initialize state for new drafts set
	const prevDraftsRef = useRef<MailDraft[]>([]);
	if (drafts !== prevDraftsRef.current && drafts.length > 0) {
		prevDraftsRef.current = drafts;
		const initial = new Map<number, DraftState>();
		drafts.forEach((d, i) => initial.set(i, makeDraftState(d)));
		setDraftStates(initial);
		setActiveDraftIdx(0);
		setFileSearch("");
	}

	// Helpers to read/write current draft's state
	const currentState: DraftState =
		draftStates.get(activeDraftIdx) ??
		(draft
			? makeDraftState(draft)
			: {
					selectedFileIds: new Set(),
					selectedLocalFiles: [],
					editableBody: "",
					editableSubject: "",
					editableNote: "",
				});
	const selectedFileIds = currentState.selectedFileIds;
	const selectedLocalFiles = currentState.selectedLocalFiles;
	const editableBody = currentState.editableBody;
	const editableSubject = currentState.editableSubject;
	const editableNote = currentState.editableNote;

	const patchState = useCallback(
		(idx: number, patch: Partial<DraftState>) => {
			setDraftStates((prev) => {
				const next = new Map(prev);
				const cur =
					next.get(idx) ??
					(drafts[idx]
						? makeDraftState(drafts[idx])
						: {
								selectedFileIds: new Set(),
								selectedLocalFiles: [],
								editableBody: "",
								editableSubject: "",
								editableNote: "",
							});
				next.set(idx, { ...cur, ...patch });
				return next;
			});
		},
		[drafts],
	);

	const setSelectedFileIds = useCallback(
		(updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
			setDraftStates((prev) => {
				const next = new Map(prev);
				const cur = next.get(activeDraftIdx);
				if (!cur) return prev;
				const newSet =
					typeof updater === "function"
						? updater(cur.selectedFileIds)
						: updater;
				next.set(activeDraftIdx, { ...cur, selectedFileIds: newSet });
				return next;
			});
		},
		[activeDraftIdx],
	);

	const setSelectedLocalFiles = useCallback(
		(updater: SelectedFile[] | ((prev: SelectedFile[]) => SelectedFile[])) => {
			setDraftStates((prev) => {
				const next = new Map(prev);
				const cur = next.get(activeDraftIdx);
				if (!cur) return prev;
				const newFiles =
					typeof updater === "function"
						? updater(cur.selectedLocalFiles)
						: updater;
				next.set(activeDraftIdx, { ...cur, selectedLocalFiles: newFiles });
				return next;
			});
		},
		[activeDraftIdx],
	);

	const setEditableBody = useCallback(
		(val: string) => {
			patchState(activeDraftIdx, { editableBody: val });
		},
		[activeDraftIdx, patchState],
	);

	const setEditableSubject = useCallback(
		(val: string) => {
			patchState(activeDraftIdx, { editableSubject: val });
		},
		[activeDraftIdx, patchState],
	);

	const setEditableNote = useCallback(
		(val: string) => {
			patchState(activeDraftIdx, { editableNote: val });
		},
		[activeDraftIdx, patchState],
	);

	const fileGroups = useMemo(
		() => (draft ? groupDriveFiles(draft.driveFiles) : []),
		[draft],
	);
	const recipients = useMemo(
		() => (draft ? splitEmails(draft.to) : []),
		[draft],
	);

	const filteredGroups = useMemo(() => {
		const q = fileSearch.trim().toLowerCase();
		if (!q) return fileGroups;
		return fileGroups
			.map((g) => ({
				...g,
				files: g.files.filter((f) => f.name.toLowerCase().includes(q)),
			}))
			.filter((g) => g.files.length > 0);
	}, [fileGroups, fileSearch]);

	const allFileIds = useMemo(
		() => draft?.driveFiles.map((f) => f.id) ?? [],
		[draft],
	);
	const allSelected =
		allFileIds.length > 0 && allFileIds.every((id) => selectedFileIds.has(id));

	const _handleToggleAll = () => {
		setSelectedFileIds(allSelected ? new Set() : new Set(allFileIds));
	};

	const handleToggleFolder = (group: DriveFileGroup) => {
		const ids = group.files.map((f) => f.id);
		const allGroupSelected = ids.every((id) => selectedFileIds.has(id));
		setSelectedFileIds((prev) => {
			const next = new Set(prev);
			if (allGroupSelected) ids.forEach((id) => next.delete(id));
			else ids.forEach((id) => next.add(id));
			return next;
		});
	};

	const addLocalFiles = useCallback(
		(files: File[]) => {
			setSelectedLocalFiles((prev) => [
				...prev,
				...files.map((f) => ({
					file: f,
					name: f.name,
					mimeType: f.type || "application/octet-stream",
					preview: f.type.startsWith("image/")
						? URL.createObjectURL(f)
						: undefined,
				})),
			]);
		},
		[setSelectedLocalFiles],
	);

	const handleClose = useCallback(() => {
		// Revoke all objectURLs across all drafts
		draftStates.forEach((s) =>
			s.selectedLocalFiles.forEach(
				(f) => f.preview && URL.revokeObjectURL(f.preview),
			),
		);
		setDraftStates(new Map());
		setActiveDraftIdx(0);
		onClose();
	}, [draftStates, onClose]);

	// Build full body for a given draft state
	const buildBody = useCallback((d: MailDraft, state: DraftState) => {
		const driveFileNames = d.driveFiles
			.filter((f) => state.selectedFileIds.has(f.id))
			.map((f) => {
				const m = f.name.match(/^\[.+?\] (.+)$/);
				return m ? m[1] : f.name;
			});
		const localFileNames = state.selectedLocalFiles.map((f) => f.name);
		const all = [...driveFileNames, ...localFileNames];

		const esc = (s: string) =>
			(s ?? "")
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;");

		let currentBody = state.editableBody;
		if (state.editableNote?.trim()) {
			const noteHtml = `
<div style="margin-top:20px;padding:12px 14px;background:#f8fafc;border-left:4px solid #3b82f6;border-radius:4px;">
  <div style="font-size:11px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">GHI CHÚ THÊM</div>
  <div style="font-size:12px;color:#1e293b;white-space:pre-line;">${esc(state.editableNote)}</div>
</div>`;
			currentBody = currentBody.replace(
				'<p style="margin-top:24px;">Trân trọng,</p>',
				`${noteHtml}\n  <p style="margin-top:24px;">Trân trọng,</p>`,
			);
		}

		if (d.isHtml) {
			// Inject file list as HTML before </body>
			if (all.length === 0) return currentBody;
			const rows = all
				.map(
					(name) =>
						`<tr><td style="padding:4px 12px;font-size:12px;color:#1e293b;">📎 ${name}</td></tr>`,
				)
				.join("");
			const fileSection = `
        <p style="margin-top:20px;font-weight:600;font-size:13px;">Danh sách tệp đính kèm:</p>
        <table style="border-collapse:collapse;width:100%;max-width:680px;border:1px solid #e2e8f0;">
          ${rows}
        </table>`;
			return currentBody.replace(/<\/body>/i, `${fileSection}</body>`);
		}

		let appended = state.editableNote?.trim()
			? `\n\nGHI CHÚ THÊM:\n${state.editableNote}`
			: "";
		appended +=
			all.length > 0
				? `\n\nDanh s\u00e1ch t\u1ec7p \u0111\u00ednh k\u00e8m:\n${all.map((n) => `- ${n}`).join("\n")}`
				: "";
		return currentBody + appended;
	}, []);

	// Send a single draft by index
	const sendOneDraft = useCallback(
		async (idx: number) => {
			const d = drafts[idx];
			const state = draftStates.get(idx);
			if (!d || !state) return;
			const localFilesData = await Promise.all(
				state.selectedLocalFiles.map(
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
			const res = await fetch("/api/trucking-followup/send-mail", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					to: d.to,
					cc: d.cc,
					subject: state.editableSubject || d.subject,
					body: buildBody(d, state),
					isHtml: d.isHtml ?? false,
					driveFileIds: Array.from(state.selectedFileIds),
					localFiles: localFilesData,
					threadId: d.replyThread?.threadId,
					inReplyTo: d.replyThread?.inReplyTo,
					references: d.replyThread?.references,
				}),
			});
			const result = await res.json();
			if (!res.ok) throw new Error(result.message || "Failed to send mail");
			return result;
		},
		[drafts, draftStates, buildBody],
	);

	const handleSendCurrent = async () => {
		const toastId = toast.loading(
			`Đang gửi email đến ${draft?.vendorName ?? "vendor"}...`,
		);
		try {
			await sendOneDraft(activeDraftIdx);
			toast.success("Đã gửi email thành công!");
			if (drafts.length === 1) handleClose();
		} catch (e: any) {
			toast.error("Lỗi gửi email", { description: e.message });
		} finally {
			toast.dismiss(toastId);
		}
	};

	const handleSendAll = async () => {
		setIsSendingAll(true);
		const toastId = toast.loading(`Đang gửi ${drafts.length} email...`);
		let success = 0,
			failed = 0;
		for (let i = 0; i < drafts.length; i++) {
			try {
				await sendOneDraft(i);
				success++;
			} catch {
				failed++;
			}
		}
		toast.dismiss(toastId);
		if (failed === 0) {
			toast.success(`Đã gửi ${success} email thành công!`);
			handleClose();
		} else {
			toast.warning(`Gửi xong: ${success} thành công, ${failed} lỗi`);
		}
		setIsSendingAll(false);
	};

	// Preview body = editable body + injected file list (for iframe preview)
	const previewHtml = useMemo(() => {
		if (!draft) return "";
		return buildBody(draft, currentState);
	}, [draft, currentState, buildBody]);

	// For plain-text: appended section preview below textarea
	const appendedSection = useMemo(() => {
		if (!draft || draft.isHtml) return "";
		const driveFileNames = draft.driveFiles
			.filter((f) => selectedFileIds.has(f.id))
			.map((f) => {
				const m = f.name.match(/^\[.+?\] (.+)$/);
				return `- ${m ? m[1] : f.name}`;
			});
		const localFileNames = selectedLocalFiles.map((f) => `- ${f.name}`);
		const all = [...driveFileNames, ...localFileNames];
		if (all.length === 0) return "";
		return `\n\nDanh s\u00e1ch t\u1ec7p \u0111\u00ednh k\u00e8m:\n${all.join("\n")}`;
	}, [draft, selectedFileIds, selectedLocalFiles]);

	const [bodyTab, setBodyTab] = useState<"preview" | "source">("preview");
	const [previewFile, setPreviewFile] = useState<{
		name: string;
		embedUrl: string;
	} | null>(null);

	const getDriveEmbedUrl = (webViewLink: string) => {
		// Extract file ID from various Google Drive URL formats and build /preview URL
		const match = webViewLink.match(/\/d\/([\w-]+)/);
		if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
		// Fallback for docs/sheets/slides
		return webViewLink.replace(/\/edit.*$/, "/preview");
	};

	const attachCount = selectedFileIds.size + selectedLocalFiles.length;

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
			<DialogContent className="p-0 sm:max-w-[1000px] max-w-[95vw] max-h-[90dvh] flex flex-col gap-0 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl shadow-xl overflow-hidden [&>button]:hidden">
				{/* ── File Preview Overlay ── */}
				{previewFile && (
					<div className="absolute inset-0 z-50 flex flex-col bg-white dark:bg-slate-900">
						<div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
							<button
								type="button"
								onClick={() => setPreviewFile(null)}
								className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500 hover:text-blue-600 transition-colors"
							>
								<ChevronLeft className="size-4" />
								Quay lại
							</button>
							<span className="flex-1 text-[12px] font-semibold text-slate-700 dark:text-slate-200 truncate">
								{previewFile.name}
							</span>
							<a
								href={previewFile.embedUrl.replace("/preview", "/view")}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
							>
								<ExternalLink className="size-3" />
								Mở Drive
							</a>
						</div>
						<iframe
							src={previewFile.embedUrl}
							className="flex-1 w-full border-0"
							allow="autoplay"
							title={previewFile.name}
						/>
					</div>
				)}
				{draft && (
					<div className="flex flex-col flex-1 min-h-0">
						{/* ── Header ── */}
						<div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
							<div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#ea4335]">
								<Mail className="size-4 text-white" />
							</div>
							<div className="flex-1">
								<p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
									Soạn & Gửi Email
								</p>
								<p className="text-[11px] text-slate-400">
									Xem trước, chỉnh sửa nội dung và chọn tệp đính kèm
								</p>
							</div>
							<button
								onClick={handleClose}
								className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
							>
								<X className="size-4" />
							</button>
						</div>

						{/* ── Vendor Tabs (only when multiple vendors) ── */}
						{drafts.length > 1 && (
							<div className="flex items-center gap-1 px-5 pt-3 pb-0 overflow-x-auto">
								{drafts.map((d, i) => (
									<button
										key={i}
										type="button"
										onClick={() => setActiveDraftIdx(i)}
										className={cn(
											"shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-t-lg border border-b-0 transition-colors",
											i === activeDraftIdx
												? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
												: "bg-slate-50 dark:bg-slate-800 border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300",
										)}
									>
										{d.vendorName || `Vendor ${i + 1}`}
									</button>
								))}
							</div>
						)}

						{/* ── Body ── */}
						<div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
							<div className="px-5 py-3 flex items-start gap-3">
								<span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-14 pt-1 shrink-0">
									Đến
								</span>
								<div className="flex flex-wrap gap-1.5 flex-1">
									{recipients.length > 0 ? (
										recipients.map((email, i) => (
											<span
												key={i}
												className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700/50 text-blue-700 dark:text-blue-300 text-[11px] font-medium"
											>
												{email}
											</span>
										))
									) : (
										<span className="text-[11px] text-slate-400 italic">
											Không có người nhận
										</span>
									)}
								</div>
							</div>

							{/* CC */}
							{draft?.cc && (
								<div className="px-5 py-2 flex items-start gap-3 border-t border-slate-100 dark:border-slate-800">
									<span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-14 pt-1 shrink-0">
										Cc
									</span>
									<div className="flex flex-wrap gap-1.5 flex-1">
										{splitEmails(draft.cc).map((email, i) => (
											<span
												key={i}
												className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-medium"
											>
												{email}
											</span>
										))}
									</div>
								</div>
							)}

							{/* Subject */}
							<div className="px-5 py-3 flex items-center gap-3">
								<span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-14 shrink-0">
									Tiêu đề
								</span>
								<input
									type="text"
									value={editableSubject}
									onChange={(e) => setEditableSubject(e.target.value)}
									className="flex-1 text-[13px] font-semibold text-slate-700 dark:text-slate-200 leading-snug bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-400 dark:focus:border-blue-500 focus:outline-none transition-colors py-0.5 rounded-none"
									placeholder="Nhập tiêu đề email..."
								/>
							</div>

							{/* Drive Files & Freight Docs */}
							{(() => {
								const renderDriveSection = (
									mode: "freightDoc" | "jobDrive",
									title: string,
									Icon: React.ElementType,
									iconColor: string,
									titleColor: string,
									emptyMessage?: string,
								) => {
									const sectionFiles = draft.driveFiles.filter((f) =>
										mode === "freightDoc"
											? f.name.startsWith("[Freight Doc")
											: !f.name.startsWith("[Freight Doc"),
									);
									if (mode === "freightDoc" && sectionFiles.length === 0)
										return null;

									const sectionGroups = filteredGroups.filter((g) =>
										mode === "freightDoc"
											? g.folder?.startsWith("Freight Doc")
											: !g.folder?.startsWith("Freight Doc"),
									);
									const sectionIds = sectionFiles.map((f) => f.id);
									const allSelected =
										sectionIds.length > 0 &&
										sectionIds.every((id) => selectedFileIds.has(id));

									return (
										<div
											className={cn(
												"px-5 py-3 space-y-2",
												mode === "freightDoc" &&
													"border-b border-slate-100 dark:border-slate-800",
											)}
										>
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-1.5">
													<Icon className={cn("size-3", iconColor)} />
													<span
														className={cn(
															"text-[11px] font-semibold uppercase tracking-wider",
															titleColor,
														)}
													>
														{title}
													</span>
													{sectionFiles.length > 0 && (
														<span className="text-[10px] text-slate-400">
															(
															{
																sectionIds.filter((id) =>
																	selectedFileIds.has(id),
																).length
															}
															/{sectionFiles.length})
														</span>
													)}
												</div>
												<div className="flex items-center gap-2">
													{sectionFiles.length > 0 && (
														<button
															type="button"
															onClick={() => {
																setSelectedFileIds((prev) => {
																	const next = new Set(prev);
																	if (allSelected)
																		sectionIds.forEach((id) => next.delete(id));
																	else sectionIds.forEach((id) => next.add(id));
																	return next;
																});
															}}
															className={cn(
																"flex items-center gap-1 text-[11px] font-medium transition-colors hover:text-blue-600 dark:hover:text-blue-400",
																mode === "freightDoc"
																	? "text-indigo-500 hover:text-indigo-600 dark:text-indigo-400"
																	: "text-blue-500 hover:text-blue-600 dark:text-blue-400",
															)}
														>
															{allSelected ? (
																<>
																	<CheckSquare
																		className={cn("size-3", iconColor)}
																	/>{" "}
																	Bỏ chọn tất cả
																</>
															) : (
																<>
																	<Square className="size-3 text-slate-400" />{" "}
																	Chọn tất cả
																</>
															)}
														</button>
													)}
													{mode === "jobDrive" &&
														draft.driveUrl &&
														draft.driveUrl !== "Không có link đính kèm" && (
															<a
																href={draft.driveUrl}
																target="_blank"
																rel="noopener noreferrer"
																className="flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
															>
																<FolderOpen className="size-3" />
																Mở thư mục
																<ExternalLink className="size-2.5" />
															</a>
														)}
												</div>
											</div>

											<div className="max-h-[200px] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
												{sectionFiles.length > 0 ? (
													sectionGroups.length > 0 ? (
														<div>
															{sectionGroups.map((group, gi) => {
																const groupIds = group.files.map((f) => f.id);
																const groupAllSelected = groupIds.every((id) =>
																	selectedFileIds.has(id),
																);
																const groupSomeSelected = groupIds.some((id) =>
																	selectedFileIds.has(id),
																);
																return (
																	<div key={`${gi}-${group.folder}`}>
																		{group.folder && (
																			<button
																				type="button"
																				onClick={() =>
																					handleToggleFolder(group)
																				}
																				className="w-full flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700/60 border-b border-slate-200 dark:border-slate-600/50 hover:bg-slate-200 dark:hover:bg-slate-600/60 transition-colors group/folder sticky top-0 z-10"
																			>
																				<FolderOpen className="size-3 text-amber-500 shrink-0" />
																				<span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate flex-1 text-left">
																					{group.folder}
																				</span>
																				<span
																					className={cn(
																						"text-[10px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums",
																						groupAllSelected
																							? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
																							: groupSomeSelected
																								? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
																								: "bg-slate-200 text-slate-500 dark:bg-slate-600 dark:text-slate-400",
																					)}
																				>
																					{
																						groupIds.filter((id) =>
																							selectedFileIds.has(id),
																						).length
																					}
																					/{groupIds.length}
																				</span>
																			</button>
																		)}
																		{group.files.map((f) => (
																			<label
																				key={f.id}
																				className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700/40 cursor-pointer transition-colors group border-b border-slate-100 dark:border-slate-700/30 last:border-0"
																			>
																				<input
																					type="checkbox"
																					className="size-3.5 rounded border-slate-300 dark:border-slate-500 accent-blue-600 shrink-0 cursor-pointer"
																					checked={selectedFileIds.has(f.id)}
																					onChange={(e) => {
																						setSelectedFileIds((prev) => {
																							const next = new Set(prev);
																							if (e.target.checked)
																								next.add(f.id);
																							else next.delete(f.id);
																							return next;
																						});
																					}}
																				/>
																				<FileText className="size-3 text-slate-400 shrink-0" />
																				<span
																					className="text-[12px] text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white font-medium truncate flex-1 transition-colors"
																					title={f.name}
																				>
																					{f.name}
																				</span>
																				{f.webViewLink && (
																					<button
																						type="button"
																						onClick={(e) => {
																							e.preventDefault();
																							e.stopPropagation();
																							setPreviewFile({
																								name: f.name,
																								embedUrl: getDriveEmbedUrl(
																									f.webViewLink!,
																								),
																							});
																						}}
																						className="shrink-0 p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
																						title="Xem trước file"
																					>
																						<Eye className="size-3" />
																					</button>
																				)}
																			</label>
																		))}
																	</div>
																);
															})}
														</div>
													) : (
														<div className="flex flex-col items-center gap-1.5 py-6 text-slate-400">
															<Search className="size-5 opacity-30" />
															<p className="text-[11px] italic">
																Không tìm thấy tệp khớp
															</p>
														</div>
													)
												) : (
													<div className="flex flex-col items-center gap-1.5 py-7 text-slate-400">
														{emptyMessage ? (
															<>
																<FolderOpen className="size-7 opacity-30" />
																<p className="text-[11px] italic">
																	{emptyMessage}
																</p>
															</>
														) : null}
													</div>
												)}
											</div>
										</div>
									);
								};

								return (
									<>
										{draft.driveFiles.length > 3 && (
											<div className="px-5 pt-3 pb-1">
												<div className="relative">
													<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-slate-400 pointer-events-none" />
													<input
														type="text"
														value={fileSearch}
														onChange={(e) => setFileSearch(e.target.value)}
														placeholder="Tìm kiếm tệp đính kèm..."
														className="w-full pl-7 pr-3 py-1.5 text-[12px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition"
													/>
													{fileSearch && (
														<button
															type="button"
															onClick={() => setFileSearch("")}
															className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
														>
															<X className="size-3" />
														</button>
													)}
												</div>
											</div>
										)}

										{renderDriveSection(
											"freightDoc",
											"Chứng từ từ hệ thống (Freight Doc)",
											FileText,
											"text-indigo-500",
											"text-indigo-600 dark:text-indigo-400",
										)}

										{renderDriveSection(
											"jobDrive",
											"Chứng từ chung của Lô / Job",
											FolderOpen,
											"text-blue-500",
											"text-blue-600 dark:text-blue-400",
											"Thư mục trống hoặc sai Link Drive",
										)}
									</>
								);
							})()}

							{/* Local Upload — compact */}
							<div className="px-5 py-2.5 border-t border-slate-100 dark:border-slate-800">
								<input
									ref={fileInputRef}
									type="file"
									multiple
									className="hidden"
									onChange={(e) => {
										if (e.target.files) {
											addLocalFiles(Array.from(e.target.files));
											e.target.value = "";
										}
									}}
								/>
								<div className="flex items-center gap-2 flex-wrap">
									<button
										type="button"
										onClick={() => fileInputRef.current?.click()}
										className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 border border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-400 px-2.5 py-1 rounded-lg transition-colors"
									>
										<Upload className="size-3" />
										Thêm tệp từ máy
									</button>
									{selectedLocalFiles.map((f, idx) => (
										<span
											key={idx}
											className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 font-medium max-w-[180px]"
										>
											<FileText className="size-3 text-slate-400 shrink-0" />
											<span className="truncate">{f.name}</span>
											<button
												type="button"
												onClick={() => {
													f.preview && URL.revokeObjectURL(f.preview);
													setSelectedLocalFiles((p) =>
														p.filter((_, i) => i !== idx),
													);
												}}
												className="shrink-0 p-0.5 rounded text-slate-400 hover:text-red-500 transition-colors"
											>
												<X className="size-2.5" />
											</button>
										</span>
									))}
								</div>
							</div>

							<div className="px-5 py-3 space-y-2">
								<div className="flex flex-col gap-2">
									<div className="flex items-center gap-1.5">
										<FileText className="size-3 text-slate-400" />
										<span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
											Ghi chú thêm
										</span>
									</div>
									<Textarea
										value={editableNote}
										onChange={(e) => setEditableNote(e.target.value)}
										placeholder="Nhập ghi chú hoặc yêu cầu đặc biệt muốn nhắn gửi đến vendor/ops... (sẽ hiển thị ở cuối email)"
										className="w-full text-[12px] bg-slate-50 dark:bg-slate-800/50 border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-400 resize-none min-h-[60px]"
									/>
								</div>

								{/* Tab header */}
								<div className="flex items-center justify-between pt-2">
									<div className="flex items-center gap-1.5">
										<Mail className="size-3 text-slate-400" />
										<span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
											Nội dung
										</span>
										{!draft?.isHtml && (
											<span className="text-[10px] text-slate-400 ml-1">
												(có thể chỉnh sửa)
											</span>
										)}
									</div>
									{draft?.isHtml && (
										<div className="flex items-center rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
											<button
												type="button"
												onClick={() => setBodyTab("preview")}
												className={cn(
													"flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold transition-colors",
													bodyTab === "preview"
														? "bg-blue-600 text-white"
														: "bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
												)}
											>
												<Eye className="size-3" /> Preview
											</button>
											<button
												type="button"
												onClick={() => setBodyTab("source")}
												className={cn(
													"flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold transition-colors border-l border-slate-200 dark:border-slate-700",
													bodyTab === "source"
														? "bg-blue-600 text-white"
														: "bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
												)}
											>
												<Code2 className="size-3" /> HTML
											</button>
										</div>
									)}
								</div>

								{/* Preview iframe (HTML mode only) */}
								{draft?.isHtml && bodyTab === "preview" && (
									<iframe
										key={previewHtml}
										srcDoc={previewHtml}
										className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white"
										style={{ height: 280 }}
										sandbox="allow-same-origin"
										title="Email preview"
									/>
								)}

								{/* Source / plain-text editor */}
								{(!draft?.isHtml || bodyTab === "source") && (
									<Textarea
										value={editableBody}
										onChange={(e) => setEditableBody(e.target.value)}
										className="text-[12px] font-mono resize-y min-h-[220px] bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 leading-relaxed tracking-wide focus-visible:ring-1 focus-visible:ring-blue-400"
										placeholder="Nội dung email..."
									/>
								)}

								{/* Plain-text auto-appended files */}
								{appendedSection && (
									<div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 px-3 py-2">
										<p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
											Tự động thêm vào cuối email
										</p>
										<pre className="text-[11px] text-slate-500 dark:text-slate-400 font-mono whitespace-pre-wrap leading-relaxed">
											{appendedSection.trimStart()}
										</pre>
									</div>
								)}
							</div>
						</div>

						{/* ── Footer ── */}
						<div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 shrink-0">
							<div>
								{attachCount > 0 && (
									<span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700/40 px-2.5 py-1 rounded-lg">
										<Paperclip className="size-3" />
										{attachCount} đính kèm
									</span>
								)}
							</div>
							<div className="flex items-center gap-2">
								<Button
									variant="ghost"
									size="sm"
									onClick={handleClose}
									className="h-8 px-4 text-[12px] text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
								>
									Hủy
								</Button>
								{/* Send current vendor */}
								<Button
									size="sm"
									onClick={handleSendCurrent}
									disabled={isSendingAll}
									className="h-8 px-3 text-[12px] bg-[#ea4335] hover:bg-[#d33426] text-white rounded-lg font-semibold shadow-sm gap-1.5"
								>
									<Send className="size-3" />
									{drafts.length > 1
										? `Gửi: ${draft?.vendorName ?? "vendor"}`
										: "Gửi email"}
								</Button>
								{/* Send All — only visible when multiple vendors */}
								{drafts.length > 1 && (
									<Button
										size="sm"
										onClick={handleSendAll}
										disabled={isSendingAll}
										className="h-8 px-3 text-[12px] bg-slate-800 hover:bg-slate-900 dark:bg-slate-600 dark:hover:bg-slate-500 text-white rounded-lg font-semibold shadow-sm gap-1.5"
									>
										<Send className="size-3" />
										Gửi tất cả ({drafts.length})
									</Button>
								)}
							</div>
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
