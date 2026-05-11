"use client";

import {
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	FileText,
	FolderOpen,
	History,
	Loader2,
	Paperclip,
	RefreshCw,
	Search,
	Settings2,
	Trash2,
	Upload,
} from "lucide-react";
import { type ChangeEvent, type ReactNode, useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CdsAiSidebarProps } from "./cds-ai-types";
import { getFileSignature } from "./cds-ai-utils";

export function CdsAiSidebar({
	followUpId,
	files,
	driveFiles,
	selectedDriveFileIds,
	sessions,
	sessionId,
	fillMissingOnly,
	autoUploadToDrive,
	activeDraftFieldCount,
	activeDraftWarningCount,
	attachedSourceCount,
	dragging,
	isFetchingDriveFiles,
	isLoadingHistory,
	isApplying,
	driveUrl,
	driveFolderId,
	latestResult,
	onAppendFiles,
	onRemoveFile,
	onToggleDriveFile,
	onSelectAllDriveFiles,
	onRefreshDriveFiles,
	onLoadHistory,
	onStartNewSession,
	onSetFillMissingOnly,
	onSetAutoUploadToDrive,
	onSetDragging,
	onApply,
	fileInputRef,
}: CdsAiSidebarProps) {
	const [activeMenu, setActiveMenu] = useState<"sources" | "history" | "apply">(
		"sources",
	);
	const [activeSourceTab, setActiveSourceTab] = useState<"local" | "drive">(
		"drive",
	);
	const [showDetails, setShowDetails] = useState(false);
	const [driveSearchQuery, setDriveSearchQuery] = useState("");
	const [sessionSearchQuery, setSessionSearchQuery] = useState("");

	const filteredDriveFiles = useMemo(() => {
		const query = driveSearchQuery.trim().toLowerCase();
		if (!query) {
			return driveFiles;
		}

		return driveFiles.filter((file) =>
			`${file.name} ${file.mimeType}`.toLowerCase().includes(query),
		);
	}, [driveFiles, driveSearchQuery]);

	const filteredSessions = useMemo(() => {
		const query = sessionSearchQuery.trim().toLowerCase();
		if (!query) {
			return sessions;
		}

		return sessions.filter((entry) =>
			`${entry.label} ${(entry.fileNames || []).join(" ")}`
				.toLowerCase()
				.includes(query),
		);
	}, [sessionSearchQuery, sessions]);

	const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
		onAppendFiles(Array.from(event.target.files ?? []));
		event.target.value = "";
	};

	return (
		<aside className="flex h-full min-h-0 flex-col overflow-hidden bg-[#efefef]">
			{/* ── ECUS-style Tab Bar ── */}
			<div className="cds-visible-x-scrollbar shrink-0 border-b border-[#999] bg-[#f0f0f0]">
				<div className="flex h-auto w-max min-w-full gap-0">
					<EcusTab
						active={activeMenu === "sources"}
						icon={<Paperclip />}
						label="Nguồn"
						badge={attachedSourceCount}
						onClick={() => setActiveMenu("sources")}
					/>
					<EcusTab
						active={activeMenu === "history"}
						icon={<History />}
						label="Lịch sử"
						badge={sessions.length}
						onClick={() => setActiveMenu("history")}
					/>
					<EcusTab
						active={activeMenu === "apply"}
						icon={<Settings2 />}
						label="Nạp"
						badge={activeDraftFieldCount}
						onClick={() => setActiveMenu("apply")}
					/>
				</div>
			</div>

			{/* ── Details Toggle ── */}
			<div className="shrink-0 border-b border-[#ddd] bg-[#f7f7f7] px-2 py-0.5">
				<button
					type="button"
					onClick={() => setShowDetails((current) => !current)}
					className="inline-flex w-full items-center justify-center gap-0.5 text-[9px] text-slate-500 hover:text-black"
				>
					{showDetails ? (
						<ChevronUp className="size-2.5" />
					) : (
						<ChevronDown className="size-2.5" />
					)}
					{showDetails ? "Ẩn chi tiết" : "Hiện chi tiết"}
				</button>

				{showDetails ? (
					<div className="cds-ai-fade-in mt-0.5 grid grid-cols-4 gap-1 pb-0.5">
						<MetricBox label="Nguồn" value={attachedSourceCount} />
						<MetricBox label="Phiên" value={sessions.length} />
						<MetricBox label="Draft" value={activeDraftFieldCount} />
						<MetricBox
							label="Cảnh báo"
							value={activeDraftWarningCount}
							tone={activeDraftWarningCount > 0 ? "warning" : "default"}
						/>
					</div>
				) : null}
			</div>

			{/* ── Content Area (lists scroll inside; no nested tiny max-heights) ── */}
			<div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 py-1.5">
				{/* ═══ Sources Tab ═══ */}
				{activeMenu === "sources" ? (
					<div className="flex min-h-0 flex-1 flex-col">
						{/* Source Type Toggle — ECUS tab style */}
						<div className="mb-1.5 flex shrink-0 gap-0 border-b border-[#999]">
							<button
								type="button"
								onClick={() => setActiveSourceTab("drive")}
								className={cn(
									"border border-b-0 border-[#999] px-2 py-[2px] text-[10px] -mb-px",
									activeSourceTab === "drive"
										? "bg-white font-semibold text-black border-b-white"
										: "bg-[#ececec] text-slate-600 hover:bg-[#e4e4e4]",
								)}
							>
								Drive ({selectedDriveFileIds.length}/{driveFiles.length})
							</button>
							<button
								type="button"
								onClick={() => setActiveSourceTab("local")}
								className={cn(
									"border border-b-0 border-[#999] px-2 py-[2px] text-[10px] -mb-px",
									activeSourceTab === "local"
										? "bg-white font-semibold text-black border-b-white"
										: "bg-[#ececec] text-slate-600 hover:bg-[#e4e4e4]",
								)}
							>
								Local ({files.length})
							</button>
						</div>

						{/* ── Drive Files ── */}
						<div
							className={cn(
								"flex min-h-0 flex-1 flex-col",
								activeSourceTab !== "drive" && "hidden",
							)}
						>
							<div className="mb-0.5 flex shrink-0 items-center justify-between border-b border-[#999] pb-0.5">
								<span className="text-[11px] font-bold italic text-black">
									File Drive
								</span>
								{driveUrl ? (
									<a
										href={driveUrl}
										target="_blank"
										rel="noreferrer"
										className="inline-flex items-center gap-0.5 text-[9px] text-[#4466cc] hover:underline"
									>
										<FolderOpen className="size-2.5" />
										Mở
									</a>
								) : null}
							</div>

							<label
								htmlFor={`cds-ai-upload-drive-${followUpId}`}
								className="mt-1 flex shrink-0 items-start gap-1.5 border border-[#ddd] bg-white px-2 py-1 text-[9px] text-black"
							>
								<Checkbox
									id={`cds-ai-upload-drive-${followUpId}`}
									checked={autoUploadToDrive}
									disabled={!driveFolderId}
									onCheckedChange={(checked) =>
										onSetAutoUploadToDrive(checked === true)
									}
									className="mt-px size-3"
								/>
								<span>
									Lưu file local lên Drive.
									{!driveFolderId ? " (Cần link)" : ""}
								</span>
							</label>

							<div className="mt-1 mb-0.5 flex shrink-0 items-center justify-between gap-1">
								<span className="text-[9px] text-slate-500">
									{selectedDriveFileIds.length}/{driveFiles.length} đang chọn
								</span>
								<div className="flex items-center gap-1.5">
									<button
										type="button"
										onClick={onSelectAllDriveFiles}
										disabled={driveFiles.length === 0}
										className="text-[9px] font-medium text-[#4466cc] disabled:text-slate-300 hover:underline"
									>
										{selectedDriveFileIds.length === driveFiles.length &&
										driveFiles.length > 0
											? "Bỏ chọn"
											: "Chọn hết"}
									</button>
									<button
										type="button"
										onClick={onRefreshDriveFiles}
										disabled={!driveFolderId || isFetchingDriveFiles}
										className="inline-flex items-center gap-0.5 text-[9px] font-medium text-[#4466cc] disabled:text-slate-300 hover:underline"
									>
										<RefreshCw
											className={cn(
												"size-2.5",
												isFetchingDriveFiles && "animate-spin",
											)}
										/>
										Mới
									</button>
								</div>
							</div>

							<div
								data-testid="cds-ai-drive-file-list"
								className="cds-ai-scrollbar min-h-0 flex-1 space-y-px overflow-y-auto"
							>
								{driveFiles.length > 6 ? (
									<SearchBox
										onChange={setDriveSearchQuery}
										placeholder="Tìm file Drive..."
										value={driveSearchQuery}
									/>
								) : null}
								{!driveFolderId ? (
									<div className="py-1 text-center text-[9px] text-slate-400">
										Chưa có link Drive.
									</div>
								) : isFetchingDriveFiles ? (
									<LoadingState>Đang tải file từ Drive...</LoadingState>
								) : filteredDriveFiles.length > 0 ? (
									filteredDriveFiles.map((file) => {
										const selected = selectedDriveFileIds.includes(file.id);

										return (
											<button
												key={file.id}
												type="button"
												onClick={() => onToggleDriveFile(file.id)}
												className={cn(
													"flex w-full items-center gap-1.5 border px-1.5 py-0.5 text-left",
													selected
														? "border-[#4466cc] bg-[#e8edf8] text-black"
														: "border-[#ddd] bg-white text-slate-600 hover:bg-[#f7f7f7]",
												)}
											>
												<span
													className={cn(
														"inline-flex size-3 shrink-0 items-center justify-center border",
														selected
															? "border-[#4466cc] bg-[#4466cc] text-white"
															: "border-[#999] bg-white",
													)}
												>
													{selected ? (
														<CheckCircle2 className="size-2" />
													) : null}
												</span>
												<div className="min-w-0 flex-1 truncate text-[9px] font-medium">
													{file.name}
												</div>
											</button>
										);
									})
								) : driveFiles.length > 0 ? (
									<div className="py-1 text-center text-[9px] text-slate-400">
										{`Không tìm thấy "${driveSearchQuery.trim()}".`}
									</div>
								) : (
									<div className="py-1 text-center text-[9px] text-slate-400">
										Thư mục Drive chưa có file.
									</div>
								)}
							</div>
						</div>

						{/* ── Local Files ── */}
						<div
							className={cn(
								"flex min-h-0 flex-1 flex-col",
								activeSourceTab !== "local" && "hidden",
							)}
						>
							<div className="mb-0.5 shrink-0 border-b border-[#999] pb-0.5">
								<span className="text-[11px] font-bold italic text-black">
									Chứng từ local
								</span>
								<span className="ml-2 text-[10px] text-slate-500">
									{files.length} file
								</span>
							</div>

							{/* Drop zone */}
							<button
								type="button"
								onClick={() => fileInputRef.current?.click()}
								onDragEnter={() => onSetDragging(true)}
								onDragOver={(event) => {
									event.preventDefault();
									onSetDragging(true);
								}}
								onDragLeave={() => onSetDragging(false)}
								onDrop={(event) => {
									event.preventDefault();
									onSetDragging(false);
									onAppendFiles(Array.from(event.dataTransfer.files ?? []));
								}}
								className={cn(
									"mt-1 flex w-full shrink-0 items-center justify-center gap-1.5 border-2 border-dashed px-2 py-2 text-center",
									dragging
										? "border-[#4466cc] bg-[#e8edf8] text-[#4466cc]"
										: "border-[#b9b9b9] bg-white text-slate-500 hover:border-[#999] hover:text-black",
								)}
							>
								<Upload className="size-3.5" />
								<div>
									<div className="text-[10px] font-bold">Thêm chứng từ</div>
									<div className="text-[8px] text-slate-400">
										PDF, ảnh, Excel, Word, ZIP
									</div>
								</div>
							</button>
							<Input
								ref={fileInputRef}
								type="file"
								multiple
								onChange={handleFileInputChange}
								className="hidden"
							/>

							{/* File list */}
							<div
								data-testid="cds-ai-local-file-list"
								className="cds-ai-scrollbar mt-1 min-h-0 flex-1 space-y-px overflow-y-auto"
							>
								{files.length > 0 ? (
									files.map((file, index) => (
										<div
											key={getFileSignature(file)}
											className="flex items-center gap-1.5 border border-[#ddd] bg-white px-1.5 py-0.5 hover:bg-[#f7f7f7]"
										>
											<Paperclip className="size-3 shrink-0 text-[#4466cc]" />
											<div className="min-w-0 flex-1 truncate text-[10px] font-medium text-black">
												{file.name}
											</div>
											<button
												type="button"
												onClick={() => onRemoveFile(index)}
												className="inline-flex size-4 items-center justify-center text-slate-400 hover:text-red-600"
												aria-label={`Xóa ${file.name}`}
											>
												<Trash2 className="size-2.5" />
											</button>
										</div>
									))
								) : (
									<div className="py-1 text-center text-[9px] text-slate-400">
										Chưa có file local.
									</div>
								)}
							</div>
						</div>
					</div>
				) : null}

				{/* ═══ History Tab ═══ */}
				{activeMenu === "history" ? (
					<div className="flex min-h-0 flex-1 flex-col">
						<div className="mb-0.5 flex shrink-0 items-center justify-between border-b border-[#999] pb-0.5">
							<span className="text-[11px] font-bold italic text-black">
								Lịch sử
							</span>
							<button
								type="button"
								onClick={onStartNewSession}
								className="text-[9px] font-medium text-[#4466cc] hover:underline"
							>
								Phiên mới
							</button>
						</div>

						<div className="cds-ai-scrollbar min-h-0 flex-1 space-y-px overflow-y-auto">
							{sessions.length > 6 ? (
								<SearchBox
									onChange={setSessionSearchQuery}
									placeholder="Tìm phiên..."
									value={sessionSearchQuery}
								/>
							) : null}
							{isLoadingHistory ? (
								<LoadingState>Đang tải lịch sử...</LoadingState>
							) : filteredSessions.length > 0 ? (
								filteredSessions.map((entry) => (
									<button
										key={entry.id}
										type="button"
										onClick={() => onLoadHistory(entry.id)}
										title={
											(entry.fileNames || []).filter(Boolean).join(", ") ||
											undefined
										}
										className={cn(
											"flex w-full items-center justify-between gap-1 border px-1.5 py-0.5 text-left",
											sessionId === entry.id
												? "border-[#4466cc] bg-[#e8edf8] text-black"
												: "border-[#ddd] bg-white text-slate-600 hover:bg-[#f7f7f7]",
										)}
									>
										<div className="min-w-0 flex-1 truncate text-[9px] font-medium">
											{entry.label}
										</div>
										{sessionId === entry.id ? (
											<span className="shrink-0 bg-[#4466cc] px-1 py-px text-[7px] font-bold text-white">
												Đang mở
											</span>
										) : null}
									</button>
								))
							) : sessions.length > 0 ? (
								<div className="py-1 text-center text-[9px] text-slate-400">
									{`Không tìm thấy "${sessionSearchQuery.trim()}".`}
								</div>
							) : (
								<div className="py-1 text-center text-[9px] text-slate-400">
									Chưa có lịch sử.
								</div>
							)}
						</div>
					</div>
				) : null}

				{/* ═══ Apply Tab ═══ */}
				{activeMenu === "apply" ? (
					<div className="min-h-0 flex-1 overflow-y-auto">
						<div className="mb-1 border-b border-[#999] pb-0.5">
							<span className="text-[11px] font-bold italic text-black">
								Nạp vào CDS
							</span>
						</div>

						<label
							htmlFor={`cds-ai-fill-missing-${followUpId}`}
							className="flex items-start gap-1.5 border border-[#ddd] bg-white px-2 py-1 text-[9px] text-black"
						>
							<Checkbox
								id={`cds-ai-fill-missing-${followUpId}`}
								checked={fillMissingOnly}
								onCheckedChange={(checked) =>
									onSetFillMissingOnly(checked === true)
								}
								className="mt-px size-3"
							/>
							<span>Giữ danh sách hàng hiện có. Chỉ điền ô trống.</span>
						</label>

						<div className="mt-1.5 grid grid-cols-2 gap-1">
							<MetricBox label="Field draft" value={activeDraftFieldCount} />
							<MetricBox
								label="Cảnh báo"
								value={activeDraftWarningCount}
								tone={activeDraftWarningCount > 0 ? "warning" : "default"}
							/>
						</div>
					</div>
				) : null}
			</div>

			{/* ── Footer Actions ── */}
			<div className="shrink-0 border-t border-[#999] bg-[#f0f0f0] px-2 py-1">
				<div className="grid grid-cols-2 gap-1">
					<button
						type="button"
						onClick={onStartNewSession}
						className="inline-flex h-[22px] items-center justify-center gap-1 border border-[#9f9f9f] bg-[#ececec] text-[10px] font-medium text-black hover:bg-[#e4e4e4]"
					>
						<History className="size-3" />
						Phiên mới
					</button>
					<button
						type="button"
						onClick={onApply}
						disabled={isApplying || !latestResult}
						className="inline-flex h-[22px] items-center justify-center gap-1 bg-[#4466cc] text-[10px] font-bold text-white hover:bg-[#3355bb] disabled:bg-[#b9b9b9] disabled:text-[#777]"
					>
						<FileText className="size-3" />
						{isApplying ? "Nạp..." : "Nạp lại CDS"}
					</button>
				</div>
			</div>
		</aside>
	);
}

/* ── Sub-components ── */

function EcusTab({
	active,
	badge,
	icon,
	label,
	onClick,
}: {
	active: boolean;
	badge: ReactNode;
	icon: ReactNode;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"relative flex items-center gap-0.5 border border-b-0 border-[#999] px-2 py-[3px] text-[10px] -mb-px [&_svg]:size-3",
				active
					? "bg-white font-semibold text-black border-b-white"
					: "bg-[#ececec] text-slate-600 hover:bg-[#e4e4e4]",
			)}
		>
			{icon}
			<span>{label}</span>
			{typeof badge === "number" && badge > 0 ? (
				<span className="ml-0.5 inline-flex h-[14px] min-w-[14px] items-center justify-center border border-amber-400 bg-amber-100 px-0.5 text-[8px] font-bold leading-none text-amber-800">
					{badge}
				</span>
			) : null}
		</button>
	);
}

function MetricBox({
	label,
	value,
	tone = "default",
}: {
	label: string;
	value: ReactNode;
	tone?: "default" | "warning";
}) {
	return (
		<div
			className={cn(
				"border px-1.5 py-0.5",
				tone === "warning"
					? "border-amber-200 bg-amber-50 text-amber-900"
					: "border-[#ddd] bg-white text-black",
			)}
		>
			<div className="text-[7px] font-medium uppercase tracking-wider text-slate-400">
				{label}
			</div>
			<div className="text-[12px] font-bold">{value}</div>
		</div>
	);
}

function SearchBox({
	value,
	onChange,
	placeholder,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
}) {
	return (
		<div className="sticky top-0 z-10 border border-[#999] bg-white px-1.5 py-0.5">
			<div className="flex items-center gap-1">
				<Search className="size-2.5 text-slate-400" />
				<input
					value={value}
					onChange={(event) => onChange(event.target.value)}
					placeholder={placeholder}
					className="h-4 w-full border-0 bg-transparent text-[9px] text-black outline-none placeholder:text-slate-400"
				/>
			</div>
		</div>
	);
}

function LoadingState({ children }: { children: ReactNode }) {
	return (
		<div className="flex items-center gap-1.5 px-1.5 py-1 text-[9px] text-slate-500">
			<Loader2 className="size-3 animate-spin" />
			{children}
		</div>
	);
}
