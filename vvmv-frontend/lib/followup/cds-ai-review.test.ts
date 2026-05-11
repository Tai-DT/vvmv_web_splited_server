import { describe, expect, it } from "vitest";
import { sanitizeCdsAiDocumentResult } from "./cds-ai-document";
import {
	areCdsAiComparableValuesEqual,
	buildCdsAiFieldReviewMap,
	getCdsAiFieldReviewSignature,
	isCdsAiFieldReviewResolved,
	normalizeCdsAiComparableValue,
	shouldShowCdsAiFieldInfo,
	shouldShowCdsAiFieldReview,
} from "./cds-ai-review";

describe("buildCdsAiFieldReviewMap", () => {
	it("flags AI values that differ from the previous CDS value", () => {
		const result = sanitizeCdsAiDocumentResult(
			{
				cdsInfo: {
					commercialInvoice: "INV-002",
				},
			},
			"NHAP",
		);

		const reviewMap = buildCdsAiFieldReviewMap({
			beforeData: {
				commercialInvoice: "INV-001",
			},
			currentData: {
				commercialInvoice: "INV-002",
			},
			result,
		});

		expect(reviewMap.commercialInvoice?.hasOldMismatch).toBe(true);
		expect(reviewMap.commercialInvoice?.hasSourceConflict).toBe(false);
		expect(reviewMap.commercialInvoice?.hasAiFill).toBe(false);
		expect(shouldShowCdsAiFieldReview(reviewMap.commercialInvoice)).toBe(true);
		expect(shouldShowCdsAiFieldInfo(reviewMap.commercialInvoice)).toBe(false);
		expect(
			reviewMap.commercialInvoice?.choices.map((item) => item.value),
		).toEqual(["INV-001", "INV-002"]);
	});

	it("marks fields filled by AI from empty CDS values as info, not warnings", () => {
		const result = sanitizeCdsAiDocumentResult(
			{
				cdsInfo: {
					commercialInvoice: "INV-001",
				},
			},
			"NHAP",
		);

		const reviewMap = buildCdsAiFieldReviewMap({
			beforeData: {
				commercialInvoice: "",
			},
			currentData: {
				commercialInvoice: "INV-001",
			},
			result,
		});

		expect(reviewMap.commercialInvoice?.hasAiFill).toBe(true);
		expect(reviewMap.commercialInvoice?.hasOldMismatch).toBe(false);
		expect(reviewMap.commercialInvoice?.hasSourceConflict).toBe(false);
		expect(shouldShowCdsAiFieldReview(reviewMap.commercialInvoice)).toBe(false);
		expect(shouldShowCdsAiFieldInfo(reviewMap.commercialInvoice)).toBe(true);
	});

	it("does not keep AI-filled info when the current value no longer matches AI", () => {
		const result = sanitizeCdsAiDocumentResult(
			{
				cdsInfo: {
					commercialInvoice: "INV-001",
				},
			},
			"NHAP",
		);

		const reviewMap = buildCdsAiFieldReviewMap({
			beforeData: {
				commercialInvoice: "",
			},
			currentData: {
				commercialInvoice: "INV-USER",
			},
			result,
		});

		expect(reviewMap.commercialInvoice).toBeUndefined();
	});

	it("flags document conflicts when sources disagree", () => {
		const result = sanitizeCdsAiDocumentResult(
			{
				cdsInfo: {
					billOfLading: "BL-001",
				},
				fieldSources: {
					billOfLading: [
						{
							fileName: "bill.pdf",
							documentType: "bill_of_lading",
							value: "BL-001",
						},
						{
							fileName: "invoice.pdf",
							documentType: "invoice",
							value: "BL-999",
						},
					],
				},
			},
			"NHAP",
		);

		const reviewMap = buildCdsAiFieldReviewMap({
			beforeData: {},
			currentData: {
				billOfLading: "BL-001",
			},
			result,
		});

		expect(reviewMap.billOfLading?.hasOldMismatch).toBe(false);
		expect(reviewMap.billOfLading?.hasSourceConflict).toBe(true);
		expect(reviewMap.billOfLading?.hasAiFill).toBe(true);
		expect(shouldShowCdsAiFieldReview(reviewMap.billOfLading)).toBe(true);
		expect(shouldShowCdsAiFieldInfo(reviewMap.billOfLading)).toBe(false);
		expect(reviewMap.billOfLading?.choices.map((item) => item.value)).toEqual([
			"BL-001",
			"BL-001",
			"BL-999",
		]);
	});

	it("does not flag equivalent dates, numbers, or whitespace", () => {
		expect(areCdsAiComparableValuesEqual("2026-04-01", "04/01/2026")).toBe(
			true,
		);
		expect(areCdsAiComparableValuesEqual("1,200", 1200)).toBe(true);
		expect(areCdsAiComparableValuesEqual("  INV   001 ", "INV 001")).toBe(true);

		const result = sanitizeCdsAiDocumentResult(
			{
				cdsInfo: {
					grossWeightTotal: "1,200",
				},
				fieldSources: {
					grossWeightTotal: [
						{
							fileName: "packing.pdf",
							documentType: "packing_list",
							value: "1,200",
						},
						{
							fileName: "bill.pdf",
							documentType: "bill_of_lading",
							value: 1200,
						},
					],
				},
			},
			"NHAP",
		);

		const reviewMap = buildCdsAiFieldReviewMap({
			beforeData: {
				grossWeightTotal: 1200,
			},
			currentData: {
				grossWeightTotal: 1200,
			},
			result,
		});

		expect(reviewMap.grossWeightTotal).toBeUndefined();
	});

	it("treats missing placeholders as AI-filled info when AI has a value", () => {
		const result = sanitizeCdsAiDocumentResult(
			{
				cdsInfo: {
					commercialInvoice: "INV-001",
				},
				fieldSources: {
					commercialInvoice: [
						{
							fileName: "packing.pdf",
							documentType: "packing_list",
							value: "Không có",
						},
						{
							fileName: "invoice.pdf",
							documentType: "invoice",
							value: "INV-001",
						},
						{
							fileName: "bill.pdf",
							documentType: "bill_of_lading",
							value: "not found",
						},
					],
				},
			},
			"NHAP",
		);

		const reviewMap = buildCdsAiFieldReviewMap({
			beforeData: {
				commercialInvoice: "Không có",
			},
			currentData: {
				commercialInvoice: "INV-001",
			},
			result,
		});

		expect(reviewMap.commercialInvoice?.hasAiFill).toBe(true);
		expect(shouldShowCdsAiFieldReview(reviewMap.commercialInvoice)).toBe(false);
		expect(shouldShowCdsAiFieldInfo(reviewMap.commercialInvoice)).toBe(true);
	});

	it("resolves a reviewed conflict only while signature and current value match", () => {
		const result = sanitizeCdsAiDocumentResult(
			{
				cdsInfo: {
					commercialInvoice: "INV-002",
				},
				fieldSources: {
					commercialInvoice: [
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
				},
			},
			"NHAP",
		);
		const review = buildCdsAiFieldReviewMap({
			beforeData: {
				commercialInvoice: "INV-001",
			},
			currentData: {
				commercialInvoice: "INV-003",
			},
			result,
		}).commercialInvoice;

		expect(review).toBeDefined();
		if (!review) {
			throw new Error("Expected commercialInvoice review.");
		}

		const reviewedState = {
			signature: getCdsAiFieldReviewSignature(review),
			selectedComparableValue: normalizeCdsAiComparableValue("INV-003"),
		};

		expect(isCdsAiFieldReviewResolved(review, reviewedState)).toBe(true);
		expect(
			isCdsAiFieldReviewResolved(
				{
					...review,
					currentValue: "INV-004",
				},
				reviewedState,
			),
		).toBe(false);
		expect(
			isCdsAiFieldReviewResolved(review, {
				...reviewedState,
				signature: "new-ai-result",
			}),
		).toBe(false);
	});
});
