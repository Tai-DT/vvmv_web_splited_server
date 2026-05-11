import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CdsAiFieldReview } from "@/lib/followup/cds-ai-review";
import { CdsAiConflictPicker } from "./cds-ai-conflict-picker";

describe("CdsAiConflictPicker", () => {
	const review: CdsAiFieldReview = {
		fieldKey: "commercialInvoice",
		oldValue: "INV-001",
		currentValue: "INV-002",
		aiValue: "INV-002",
		sourceValues: [
			{
				fileName: "invoice.pdf",
				documentType: "invoice",
				value: "INV-002",
			},
			{
				fileName: "packing.pdf",
				documentType: "packing_list",
				value: "INV-003",
			},
		],
		hasAiFill: false,
		hasOldMismatch: true,
		hasSourceConflict: true,
		choices: [
			{
				id: "old",
				label: "Dữ liệu CDS cũ",
				detail: null,
				sourceType: "old",
				value: "INV-001",
			},
			{
				id: "ai",
				label: "AI đề xuất",
				detail: null,
				sourceType: "ai",
				value: "INV-002",
			},
			{
				id: "document-1",
				label: "packing.pdf",
				detail: "packing_list",
				sourceType: "document",
				value: "INV-003",
			},
		],
	};

	it("shows the warning icon and lets users select a value", async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();

		render(
			<CdsAiConflictPicker
				fieldKey="commercialInvoice"
				operationType="NHAP"
				review={review}
				onSelect={onSelect}
			>
				<input aria-label="invoice" />
			</CdsAiConflictPicker>,
		);

		expect(screen.getByLabelText("invoice")).toBeInTheDocument();
		await user.click(
			screen.getByTestId("cds-ai-conflict-trigger-commercialInvoice"),
		);

		expect(await screen.findByText("Dữ liệu CDS cũ")).toBeInTheDocument();
		expect(screen.getAllByText("AI đề xuất").length).toBeGreaterThan(0);
		expect(screen.getByText("packing.pdf")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /packing\.pdf/i }));

		expect(onSelect).toHaveBeenCalledWith("commercialInvoice", "INV-003");
	});

	it("shows a reviewed check icon while still allowing users to reopen choices", async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();

		render(
			<CdsAiConflictPicker
				fieldKey="commercialInvoice"
				operationType="NHAP"
				review={review}
				isReviewed
				onSelect={onSelect}
			>
				<input aria-label="invoice" />
			</CdsAiConflictPicker>,
		);

		await user.click(screen.getByLabelText(/đã rà soát dữ liệu ai cho/i));

		expect(await screen.findByText("Đã rà soát")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: /packing\.pdf/i }));

		expect(onSelect).toHaveBeenCalledWith("commercialInvoice", "INV-003");
	});

	it("shows an AI-filled info icon without treating empty old values as warnings", async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		const infoReview: CdsAiFieldReview = {
			...review,
			oldValue: "",
			currentValue: "INV-002",
			aiValue: "INV-002",
			sourceValues: [
				{
					fileName: "invoice.pdf",
					documentType: "invoice",
					value: "INV-002",
				},
			],
			hasAiFill: true,
			hasOldMismatch: false,
			hasSourceConflict: false,
			choices: [
				{
					id: "ai",
					label: "AI đề xuất",
					detail: null,
					sourceType: "ai",
					value: "INV-002",
				},
				{
					id: "document-0",
					label: "invoice.pdf",
					detail: "invoice",
					sourceType: "document",
					value: "INV-002",
				},
			],
		};

		render(
			<CdsAiConflictPicker
				fieldKey="commercialInvoice"
				operationType="NHAP"
				review={infoReview}
				onSelect={onSelect}
			>
				<input aria-label="invoice" />
			</CdsAiConflictPicker>,
		);

		expect(
			screen.queryByLabelText(/cảnh báo dữ liệu ai cho/i),
		).not.toBeInTheDocument();

		await user.click(screen.getByLabelText(/ai đã điền dữ liệu cho/i));

		expect(await screen.findByText("AI đã điền")).toBeInTheDocument();
		expect(screen.getByText("Trống")).toBeInTheDocument();
		expect(screen.getAllByText("AI đề xuất").length).toBeGreaterThan(0);
		expect(screen.getByText("invoice.pdf")).toBeInTheDocument();
		expect(screen.queryByText("Khác dữ liệu CDS cũ")).not.toBeInTheDocument();
		expect(
			screen.queryByText("Chứng từ không khớp nhau"),
		).not.toBeInTheDocument();
	});
});
