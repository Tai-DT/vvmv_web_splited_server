import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { sanitizeCdsAiDocumentResult } from "@/lib/followup/cds-ai-document";
import { CdsAiDocumentPanel } from "./cds-ai-document-tab";
import type { CdsAiSession } from "./use-cds-ai-session";

function createMockSession(overrides: Partial<CdsAiSession> = {}) {
	const latestResult = sanitizeCdsAiDocumentResult(
		{
			assistantMessage: "Đã phân tích và nạp dữ liệu vào CDS info.",
			cdsInfo: {
				commercialInvoice: "INV-001",
				importerName: "ABC COMPANY",
			},
			documents: [
				{
					fileName: "invoice.pdf",
					documentType: "invoice",
					warnings: ["Invoice có dữ liệu khác packing list."],
				},
			],
			warnings: ["Có dữ liệu cần rà soát."],
		},
		"NHAP",
	);

	return {
		files: [],
		driveFiles: [
			{
				id: "drive-file-1",
				name: "invoice.pdf",
				mimeType: "application/pdf",
			},
		],
		selectedDriveFileIds: ["drive-file-1"],
		prompt: "",
		messages: [
			{
				id: "assistant-1",
				role: "assistant",
				text: "Đã phân tích và nạp dữ liệu vào CDS info.",
				result: latestResult,
			},
		],
		sessions: [
			{
				id: "session-1",
				label: "Phiên 09:00 26/04",
				date: "2026-04-26T09:00:00.000Z",
				fileNames: ["invoice.pdf"],
			},
		],
		sessionId: "session-1",
		latestResult,
		activeResultMessageId: "assistant-1",
		sessionFileNames: ["invoice.pdf"],
		isAnalyzing: false,
		isApplying: false,
		isFetchingDriveFiles: false,
		isLoadingHistory: false,
		isUploadingToDrive: false,
		dragging: false,
		fillMissingOnly: true,
		autoUploadToDrive: true,
		geminiModelOptions: ["gemini-2.5-flash"],
		selectedGeminiModel: "gemini-2.5-flash",
		fieldDrafts: {},
		cargoDrafts: {},
		canAnalyze: true,
		attachedSourceCount: 1,
		activeDraftFieldCount: 2,
		activeDraftWarningCount: 2,
		lastAutoApplySnapshot: null,
		driveUrl: "https://drive.google.com/drive/folders/example",
		driveFolderId: "drive-folder-1",
		activeSessionLabel: "Phiên 09:00 26/04",
		fileInputRef: createRef<HTMLInputElement>(),
		transcriptEndRef: createRef<HTMLDivElement>(),
		setPrompt: vi.fn(),
		setDragging: vi.fn(),
		setFillMissingOnly: vi.fn(),
		setAutoUploadToDrive: vi.fn(),
		setSelectedGeminiModel: vi.fn(),
		setFieldDrafts: vi.fn(),
		setCargoDrafts: vi.fn(),
		activateResultMessage: vi.fn(),
		appendFiles: vi.fn(),
		removeFile: vi.fn(),
		toggleDriveFileSelection: vi.fn(),
		selectAllDriveFiles: vi.fn(),
		refreshDriveFiles: vi.fn(),
		loadHistory: vi.fn(),
		handleStartNewSession: vi.fn(),
		handleAnalyze: vi.fn(),
		handleApply: vi.fn(),
		commitFieldDraft: vi.fn(),
		commitCargoDraft: vi.fn(),
		...overrides,
	} as unknown as CdsAiSession;
}

describe("CdsAiDocumentPanel compact layout", () => {
	it("renders compact controls and status summary without detailed result tables", async () => {
		const user = userEvent.setup();

		render(
			<CdsAiDocumentPanel
				followUpId="follow-up-1"
				operationType="NHAP"
				currentData={{}}
				currentCargoList={[]}
				handleFieldChange={vi.fn()}
				session={createMockSession()}
			/>,
		);

		expect(screen.getByTestId("cds-ai-compact-panel")).toBeInTheDocument();

		// Sidebar starts hidden — open menu (mặc định: menu full, chat ẩn)
		const toggleButton = screen.getByRole("button", { name: /^menu$/i });
		await user.click(toggleButton);

		// Bật «Hiện chat» để thấy ô nhập và composer khi test split layout
		await user.click(screen.getByTestId("cds-ai-toggle-chat-for-menu"));

		expect(screen.getByRole("button", { name: /thêm chứng từ/i }));
		expect(screen.getByText("Chứng từ local")).toBeInTheDocument();
		expect(screen.getByText("File Drive")).toBeInTheDocument();
		expect(screen.getByTestId("cds-ai-local-file-list")).toBeInTheDocument();
		expect(screen.getByTestId("cds-ai-drive-file-list")).toBeInTheDocument();
		expect(screen.getByRole("textbox")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /gửi cho ai/i }),
		).toBeInTheDocument();
		expect(screen.getByText(/ai tìm thấy \d+ field/i)).toBeInTheDocument();
		expect(screen.getAllByText(/cảnh báo/i).length).toBeGreaterThan(0);
		expect(
			screen.getByRole("button", { name: /nạp lại cds/i }),
		).toBeInTheDocument();
		expect(screen.queryByText(/kết quả ai/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/bản nháp hiện tại/i)).not.toBeInTheDocument();
	});
});
