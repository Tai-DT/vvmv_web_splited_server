"use client";

import {
	History,
	PanelLeftClose,
	PanelLeftOpen,
	Sparkles,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { CdsAiApplyPreviewDialog } from "./cds-ai-apply-preview-dialog";
import { CdsAiChat } from "./cds-ai-chat";
import { CdsAiComposer } from "./cds-ai-composer";
import { CdsAiSidebar } from "./cds-ai-sidebar";
import type { CdsAiDocumentTabProps } from "./cds-ai-types";
import { type CdsAiSession, useCdsAiSession } from "./use-cds-ai-session";

/**
 * Orchestrator for the CDS AI Document Tab.
 *
 * Menu (sources) và chat tách rõ: mở Menu → menu full chiều cao, chat ẩn;
 * đóng Menu hoặc bấm «Hiện chat» để xem lại hội thoại.
 */
export function CdsAiDocumentTab({
	followUpId,
	operationType,
	followUpSummary,
	currentData,
	currentCargoList,
	handleFieldChange,
	onCdsInfoPersisted,
	onCargoApplied,
}: CdsAiDocumentTabProps) {
	const session = useCdsAiSession({
		followUpId,
		operationType,
		followUpSummary,
		currentData,
		currentCargoList,
		handleFieldChange,
		onCdsInfoPersisted,
		onCargoApplied,
	});

	return (
		<CdsAiDocumentPanel
			followUpId={followUpId}
			operationType={operationType}
			followUpSummary={followUpSummary}
			currentData={currentData}
			currentCargoList={currentCargoList}
			handleFieldChange={handleFieldChange}
			onCdsInfoPersisted={onCdsInfoPersisted}
			onCargoApplied={onCargoApplied}
			session={session}
		/>
	);
}

export function CdsAiDocumentPanel({
	followUpId,
	operationType,
	currentData,
	currentCargoList,
	session,
	onClose,
}: CdsAiDocumentTabProps & { session: CdsAiSession; onClose?: () => void }) {
	const [isSidebarVisible, setIsSidebarVisible] = useState(false);
	/** true while menu open = chat ẩn (mặc định); false = chia khung menu + chat. */
	const [isChatHiddenForMenu, setIsChatHiddenForMenu] = useState(true);

	const shouldAutoOpenMenu = useMemo(
		() =>
			!session.isLoadingHistory &&
			session.messages.length === 0 &&
			session.attachedSourceCount === 0,
		[
			session.attachedSourceCount,
			session.isLoadingHistory,
			session.messages.length,
		],
	);

	useEffect(() => {
		if (shouldAutoOpenMenu) {
			setIsSidebarVisible(true);
		}
	}, [shouldAutoOpenMenu]);

	useEffect(() => {
		if (isSidebarVisible) {
			setIsChatHiddenForMenu(true);
		} else {
			setIsChatHiddenForMenu(false);
		}
	}, [isSidebarVisible]);

	const showChat = !isSidebarVisible || !isChatHiddenForMenu;

	return (
		<div
			data-testid="cds-ai-compact-panel"
			className="flex h-full min-h-0 flex-col overflow-hidden bg-[#efefef] text-black"
		>
			{/* ── ECUS-style Header ── */}
			<header className="shrink-0 border-b border-[#999] bg-[#f0f0f0] px-2 py-1">
				<div className="flex items-center gap-1.5">
					<button
						type="button"
						onClick={() => setIsSidebarVisible((current) => !current)}
						className="inline-flex h-[22px] shrink-0 items-center gap-1 border border-[#9f9f9f] bg-[#ececec] px-1.5 text-[10.5px] text-black hover:bg-[#e4e4e4]"
						aria-pressed={isSidebarVisible}
					>
						{isSidebarVisible ? (
							<PanelLeftClose className="size-3" />
						) : (
							<PanelLeftOpen className="size-3" />
						)}
						{isSidebarVisible ? "Ẩn" : "Menu"}
					</button>

					{isSidebarVisible ? (
						<button
							type="button"
							data-testid="cds-ai-toggle-chat-for-menu"
							onClick={() => setIsChatHiddenForMenu((current) => !current)}
							className="inline-flex h-[22px] shrink-0 items-center gap-1 border border-[#9f9f9f] bg-[#ececec] px-1.5 text-[10.5px] text-black hover:bg-[#e4e4e4]"
							aria-pressed={isChatHiddenForMenu}
							title={
								isChatHiddenForMenu
									? "Hiện chat (chia khung với menu)"
									: "Ẩn chat — chỉ xem menu nguồn"
							}
						>
							{isChatHiddenForMenu ? "Hiện chat" : "Ẩn chat"}
						</button>
					) : null}

					<div className="flex min-w-0 flex-1 items-center gap-1.5">
						<Sparkles className="size-3.5 shrink-0 text-[#4466cc]" />
						<div className="min-w-0">
							<span className="text-[11px] font-bold text-black">CDS AI</span>
							<span className="ml-1.5 truncate text-[10px] text-slate-500">
								{session.activeSessionLabel ?? "Phiên hiện tại"}
							</span>
						</div>
					</div>

					<div className="flex shrink-0 items-center gap-1">
						<button
							type="button"
							onClick={session.handleStartNewSession}
							className="inline-flex h-[22px] items-center gap-1 border border-[#9f9f9f] bg-[#ececec] px-1.5 text-[10.5px] text-black hover:bg-[#e4e4e4]"
						>
							<History className="size-3" />
							Mới
						</button>
						{onClose ? (
							<button
								type="button"
								onClick={onClose}
								title="Đóng CDS AI"
								aria-label="Đóng CDS AI"
								className="inline-flex size-[22px] shrink-0 items-center justify-center border border-[#9f9f9f] bg-[#ececec] text-slate-600 hover:bg-[#e4e4e4]"
							>
								<X className="size-3" />
							</button>
						) : null}
					</div>
				</div>
			</header>

			{/* ── Body: Sidebar (collapsible) + Chat ── */}
			<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
				{/* Sidebar: full height when chat ẩn (default); có thể chia khung khi Hiện chat */}
				{isSidebarVisible ? (
					<div
						className={cn(
							"min-h-0 overflow-hidden border-b border-[#999]",
							isChatHiddenForMenu
								? "flex min-h-0 flex-1 flex-col"
								: "max-h-[min(40%,300px)] shrink-0",
						)}
					>
						<CdsAiSidebar
							followUpId={followUpId}
							files={session.files}
							driveFiles={session.driveFiles}
							selectedDriveFileIds={session.selectedDriveFileIds}
							sessions={session.sessions}
							sessionId={session.sessionId}
							fillMissingOnly={session.fillMissingOnly}
							autoUploadToDrive={session.autoUploadToDrive}
							activeDraftFieldCount={session.activeDraftFieldCount}
							activeDraftWarningCount={session.activeDraftWarningCount}
							attachedSourceCount={session.attachedSourceCount}
							dragging={session.dragging}
							isFetchingDriveFiles={session.isFetchingDriveFiles}
							isLoadingHistory={session.isLoadingHistory}
							isApplying={session.isApplying}
							driveUrl={session.driveUrl}
							driveFolderId={session.driveFolderId}
							latestResult={session.latestResult}
							onAppendFiles={session.appendFiles}
							onRemoveFile={session.removeFile}
							onToggleDriveFile={session.toggleDriveFileSelection}
							onSelectAllDriveFiles={session.selectAllDriveFiles}
							onRefreshDriveFiles={session.refreshDriveFiles}
							onLoadHistory={session.loadHistory}
							onStartNewSession={session.handleStartNewSession}
							onSetFillMissingOnly={session.setFillMissingOnly}
							onSetAutoUploadToDrive={session.setAutoUploadToDrive}
							onSetDragging={session.setDragging}
							onApply={session.handleApply}
							fileInputRef={session.fileInputRef}
						/>
					</div>
				) : null}

				{/* Chat + Composer: takes remaining space (optional while menu is expanded) */}
				{showChat ? (
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
						<CdsAiChat
							messages={session.messages}
							latestResult={session.latestResult}
							activeResultMessageId={session.activeResultMessageId}
							isAnalyzing={session.isAnalyzing}
							isLoadingHistory={session.isLoadingHistory}
							sessionId={session.sessionId}
							sessionFileNames={session.sessionFileNames}
							activeSessionLabel={session.activeSessionLabel}
							transcriptEndRef={session.transcriptEndRef}
							onSetPrompt={session.setPrompt}
						/>

						<CdsAiComposer
							prompt={session.prompt}
							attachedSourceCount={session.attachedSourceCount}
							fillMissingOnly={session.fillMissingOnly}
							files={session.files}
							selectedDriveFileIds={session.selectedDriveFileIds}
							sessionFileNames={session.sessionFileNames}
							latestResult={session.latestResult}
							hasCurrentSnapshot={session.hasCurrentSnapshot}
							isAnalyzing={session.isAnalyzing}
							isUploadingToDrive={session.isUploadingToDrive}
							canAnalyze={session.canAnalyze}
							geminiModelOptions={session.geminiModelOptions}
							selectedGeminiModel={session.selectedGeminiModel}
							onSelectGeminiModel={session.setSelectedGeminiModel}
							onSetPrompt={session.setPrompt}
							onAnalyze={session.handleAnalyze}
						/>
					</div>
				) : null}
			</div>

			<CdsAiApplyPreviewDialog
				gate={session.persistGate}
				currentData={currentData}
				operationType={operationType}
				currentCargoRowCount={currentCargoList.length}
				onConfirm={() => void session.confirmPersistGate()}
				onCancel={session.cancelPersistGate}
				isWorking={session.isApplying}
			/>
		</div>
	);
}
