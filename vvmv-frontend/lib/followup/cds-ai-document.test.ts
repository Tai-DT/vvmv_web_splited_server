import { describe, expect, it } from "vitest";
import { sanitizeCdsAiDocumentResult } from "./cds-ai-document";
import { CDS_PARTNER_ADDRESS_LINE_MAX_LENGTH } from "./cds-partner-address";
import { getCdsVnaccsFieldLabel } from "./cds-vnaccs-field-labels";

describe("sanitizeCdsAiDocumentResult", () => {
	it("labels exporterCode by VNACCS role for export declarations", () => {
		expect(getCdsVnaccsFieldLabel("exporterCode", "XUAT")).toBe(
			"Mã người nhập khẩu (MA_Nguoi_Nhan_Hang)",
		);
		expect(getCdsVnaccsFieldLabel("exporterCode", "NHAP")).toBe(
			"Mã người xuất khẩu (MA_Nguoi_Giao_Hang)",
		);
	});

	it("drops missing phone warnings because importerPhone is optional", () => {
		const result = sanitizeCdsAiDocumentResult(
			{
				documents: [
					{
						fileName: "invoice.pdf",
						warnings: [
							"Phần Thông tin chung: Trường 'Số điện thoại của người nhập khẩu' không tìm thấy trên chứng từ.",
						],
					},
				],
				warnings: [
					"Phần Thông tin chung: Trường 'Số điện thoại của người nhập khẩu' không tìm thấy trên chứng từ.",
				],
			},
			"XUAT",
		);

		expect(result.warnings).toEqual([]);
		expect(result.documents[0]?.warnings).toEqual([]);
		expect(result.checklist.some((item) => item.id === "warnings")).toBe(false);
	});

	it("renames export country warnings to the export VNACCS country field", () => {
		const result = sanitizeCdsAiDocumentResult(
			{
				warnings: [
					"Phần Thông tin chung: Trường 'Mã quốc gia xuất khẩu' không tìm thấy trên chứng từ.",
				],
			},
			"XUAT",
		);

		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain("Mã nước nhập khẩu (ô Mã Nước)");
		expect(result.warnings[0]).not.toContain("Mã quốc gia xuất khẩu");
	});

	it("keeps import country warnings aligned with import VNACCS wording", () => {
		const result = sanitizeCdsAiDocumentResult(
			{
				warnings: [
					"Phần Thông tin chung: Trường 'Mã quốc gia xuất khẩu' không tìm thấy trên chứng từ.",
				],
			},
			"NHAP",
		);

		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain("Mã nước xuất khẩu (ô Mã Nước)");
	});

	it("checks person organization classification only for selected E operation codes", () => {
		const requiredResult = sanitizeCdsAiDocumentResult(
			{
				cdsInfo: {
					operationCode: "E11",
				},
			},
			"NHAP",
		);
		const optionalResult = sanitizeCdsAiDocumentResult(
			{
				cdsInfo: {
					operationCode: "A12",
				},
			},
			"NHAP",
		);

		expect(
			requiredResult.checklist.some(
				(item) => item.id === "personOrganizationClassification",
			),
		).toBe(true);
		expect(
			optionalResult.checklist.some(
				(item) => item.id === "personOrganizationClassification",
			),
		).toBe(false);
	});

	it("does not warn about missing cargo custom code for B11", () => {
		const result = sanitizeCdsAiDocumentResult(
			{
				cdsInfo: {
					operationCode: "B11",
				},
				cargoList: [
					{
						customCode: "",
						hsCode: "39269099",
						vietnameseName: "Linh kien nhua",
					},
				],
				documents: [
					{
						fileName: "invoice.pdf",
						warnings: ["Dòng hàng 1: Mã hàng đang trống."],
					},
				],
				warnings: ["Dòng hàng 1: Mã hàng đang trống."],
			},
			"XUAT",
		);

		expect(result.warnings).toEqual([]);
		expect(result.documents[0]?.warnings).toEqual([]);
		expect(result.checklist.some((item) => item.id === "cargoCustomCode")).toBe(
			false,
		);
		expect(result.checklist.some((item) => item.id === "warnings")).toBe(false);
	});

	it("keeps cargo custom code warnings for operation codes that require it", () => {
		const result = sanitizeCdsAiDocumentResult(
			{
				cdsInfo: {
					operationCode: "E42",
				},
				cargoList: [
					{
						customCode: "",
						hsCode: "39269099",
						vietnameseName: "Linh kien nhua",
					},
				],
				warnings: ["Dòng hàng 1: Mã hàng đang trống."],
			},
			"XUAT",
		);

		expect(result.warnings).toHaveLength(1);
		expect(result.checklist).toContainEqual(
			expect.objectContaining({
				id: "cargoCustomCode",
				status: "missing",
			}),
		);
	});

	it("renames export postal code warnings to the local exporter label", () => {
		const result = sanitizeCdsAiDocumentResult(
			{
				warnings: [
					"Phần Thông tin chung: Trường 'Mã bưu chính của người nhập khẩu' không tìm thấy trên chứng từ.",
				],
			},
			"XUAT",
		);

		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain("Mã bưu chính người xuất khẩu");
		expect(result.warnings[0]).not.toContain(
			"Mã bưu chính của người nhập khẩu",
		);
	});

	it("keeps valid field sources and normalizes values", () => {
		const result = sanitizeCdsAiDocumentResult(
			{
				fieldSources: {
					commercialInvoice: [
						{
							fileName: "invoice.pdf",
							documentType: "invoice",
							value: " INV-001 ",
						},
					],
					grossWeightTotal: [
						{
							fileName: "packing.pdf",
							documentType: "packing_list",
							value: "1,200",
						},
					],
					partnerAddress1: [
						{
							fileName: "invoice.pdf",
							documentType: "invoice",
							value:
								"No. 11, Road 8, VSIP Bac Ninh Industrial Urban And Service Park",
						},
					],
				},
			},
			"NHAP",
		);

		expect(result.fieldSources.commercialInvoice).toEqual([
			{
				fileName: "invoice.pdf",
				documentType: "invoice",
				value: "INV-001",
			},
		]);
		expect(result.fieldSources.grossWeightTotal?.[0]?.value).toBe(1200);
		expect(
			Array.from(String(result.fieldSources.partnerAddress1?.[0]?.value ?? ""))
				.length,
		).toBeLessThanOrEqual(CDS_PARTNER_ADDRESS_LINE_MAX_LENGTH);
	});

	it("drops field sources for keys outside the CDS schema", () => {
		const result = sanitizeCdsAiDocumentResult(
			{
				fieldSources: {
					commercialInvoice: [
						{
							fileName: "invoice.pdf",
							documentType: "invoice",
							value: "INV-001",
						},
					],
					notACdsField: [
						{
							fileName: "invoice.pdf",
							documentType: "invoice",
							value: "SHOULD_DROP",
						},
					],
				},
			},
			"NHAP",
		);

		expect(result.fieldSources.commercialInvoice).toHaveLength(1);
		expect(
			result.fieldSources["notACdsField" as keyof typeof result.fieldSources],
		).toBeUndefined();
	});

	it("keeps package marks, note, and internal management number from AI output", () => {
		const result = sanitizeCdsAiDocumentResult(
			{
				cdsInfo: {
					packageMarks: "INV-001",
					note: "HD:INV-001",
					internalBusinessManagementNumber: "XTC",
				},
				fieldSources: {
					packageMarks: [
						{
							fileName: "invoice.pdf",
							documentType: "invoice",
							value: "INV-001",
						},
					],
					internalBusinessManagementNumber: [
						{
							fileName: "invoice.pdf",
							documentType: "invoice",
							value: "XTC",
						},
					],
				},
			},
			"XUAT",
		);

		expect(result.cdsInfo.packageMarks).toBe("INV-001");
		expect(result.cdsInfo.note).toBe("HD:INV-001");
		expect(result.cdsInfo.internalBusinessManagementNumber).toBe("XTC");
		expect(result.fieldSources.packageMarks?.[0]?.value).toBe("INV-001");
		expect(
			result.fieldSources.internalBusinessManagementNumber?.[0]?.value,
		).toBe("XTC");
	});

	it("defaults missing field sources to an empty object for old history", () => {
		const result = sanitizeCdsAiDocumentResult(
			{
				cdsInfo: {
					commercialInvoice: "INV-001",
				},
			},
			"NHAP",
		);

		expect(result.fieldSources).toEqual({});
	});

	it("splits long partner address values returned by AI across the four address fields", () => {
		const result = sanitizeCdsAiDocumentResult(
			{
				cdsInfo: {
					partnerAddress1:
						"No. 11, Road 8, VSIP Bac Ninh Industrial Urban And Service Park, Tu Son, Bac Ninh, Viet Nam",
				},
			},
			"NHAP",
		);

		const addressLines = [
			result.cdsInfo.partnerAddress1,
			result.cdsInfo.partnerAddress2,
			result.cdsInfo.partnerAddress3,
			result.cdsInfo.partnerAddress4,
		].filter((line): line is string => typeof line === "string" && !!line);

		expect(addressLines.length).toBeGreaterThan(1);
		addressLines.forEach((line) => {
			expect(Array.from(line).length).toBeLessThanOrEqual(
				CDS_PARTNER_ADDRESS_LINE_MAX_LENGTH,
			);
		});
	});
});
