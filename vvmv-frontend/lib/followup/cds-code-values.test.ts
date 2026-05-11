import { describe, expect, it } from "vitest";
import { sanitizeFollowUpCdsInfoPayload } from "./ai-ocr-sync";
import { buildSavedCdsFieldOptions } from "./cds-app-saved-lookups";
import { normalizeCdsLookupValueField } from "./cds-code-values";
import { sanitizeCdsInfoPayload } from "./cds-info-sanitize";

describe("CDS code values", () => {
	it("stores only lookup codes while preserving normal text fields", () => {
		const sanitized = sanitizeCdsInfoPayload({
			businessTypeGroup: "Kinh doanh, đầu tư",
			paymentMethod: "TTR - Chuyen tien boi hoan bang dien",
			invoiceCurrency: "USD - Dollar",
			truckLoadingLocationCode: "VNHAN - Dia diem xep hang.VNCLI - Cat Lai",
			truckLoadingLocationAddress: "Dia chi xep hang",
			estimatedArrivalAtDestinationDate: "2026-04-30",
			otherLegalDocumentCodes: ["A1 - Legal document"],
			importLicenses: ["GP - Import license:LIC-001"],
			valuationAdjustments: [
				{
					nameCode: "A - Add",
					classificationCode: "1 - Manual",
					currencyCode: "USD - Dollar",
					adjustmentValue: "12.5",
				},
			],
			electronicAttachments: [
				{
					attachmentNumber: "INV-001",
					attachmentDescription: "INV - Invoice",
				},
			],
			transportSchedules: [
				{
					locationCode: "VNCLI - Cat Lai",
					locationName: "Cat Lai",
					arrivalDate: "2026-04-28",
				},
			],
		});

		expect(sanitized.businessTypeGroup).toBe("00");
		expect(sanitized.paymentMethod).toBe("TTR");
		expect(sanitized.invoiceCurrency).toBe("USD");
		expect(sanitized.truckLoadingLocationCode).toBe("VNHAN.VNCLI");
		expect(sanitized.truckLoadingLocationAddress).toBe("Dia chi xep hang");
		expect(sanitized.estimatedArrivalAtDestinationDate).toBe("2026-04-30");
		expect(sanitized.otherLegalDocumentCodes).toEqual(["A1"]);
		expect(sanitized.otherLegalDocumentCode).toBe("A1");
		expect(sanitized.importLicenses).toEqual(["GP:LIC-001"]);
		expect(sanitized.importLicense).toBe("GP");
		expect(sanitized.licenseNumber).toBe("LIC-001");
		expect(sanitized.valuationAdjustments).toEqual([
			{
				nameCode: "A",
				classificationCode: "1",
				currencyCode: "USD",
				adjustmentValue: 12.5,
				allocationRatio: null,
			},
		]);
		expect(sanitized.electronicAttachments).toEqual([
			{
				attachmentNumber: "INV-001",
				attachmentDescription: "INV",
			},
		]);
		expect(sanitized.transportSchedules).toEqual([
			{
				locationCode: "VNCLI",
				locationName: "Cat Lai",
				arrivalDate: "2026-04-28",
				departureDate: null,
			},
		]);
	});

	it("preserves short existing business group codes that are not labels", () => {
		const sanitized = sanitizeCdsInfoPayload({
			businessTypeGroup: "TEST GRO",
		});

		expect(sanitized.businessTypeGroup).toBe("TEST GRO");
	});

	it("normalizes app-saved lookup options back to code values", () => {
		const options = buildSavedCdsFieldOptions([
			{
				operationType: "NHAP",
				cdsInfo: {
					paymentMethod: "TTR - Chuyen tien boi hoan bang dien",
					invoiceCurrency: "usd - Dollar",
					loadingLocationCode: "VNCLI - Cat Lai",
					loadingLocationName: "Cat Lai",
				},
			},
		]);

		expect(options.paymentMethod?.[0]?.value).toBe("TTR");
		expect(options.invoiceCurrency?.[0]?.value).toBe("USD");
		expect(options.loadingLocationCode?.[0]).toMatchObject({
			value: "VNCLI",
			label: "VNCLI - Cat Lai",
		});
	});

	it("normalizes gross weight unit separately from package units", () => {
		expect(normalizeCdsLookupValueField("weightUnit", "PR - Đôi/cặp")).toBe(
			"KGM",
		);
		expect(normalizeCdsLookupValueField("weightUnit", "kg")).toBe("KGM");
		expect(normalizeCdsLookupValueField("weightUnit", "TNE - Metric ton")).toBe(
			"TNE",
		);
		expect(normalizeCdsLookupValueField("packageType", "PR - Đôi/cặp")).toBe(
			"PR",
		);
	});

	it("sanitizes AI CDS payload types without conflating transport schedule fields", () => {
		const sanitized = sanitizeFollowUpCdsInfoPayload({
			businessTypeGroup: "Sản xuất xuất khẩu",
			exchangeRate: "25400.5",
			netWeight: "1200.25",
			expectedDeclarationDate: "28/04/2026",
			reExportDeadline: "2026-05-30",
			seaportSupervisionEnabled: "true",
			airportSupervisionEnabled: "0",
			transportSchedules: [
				{
					locationCode: "VNCLI - Cat Lai",
					locationName: "Cat Lai",
					arrivalDate: "2026-04-28",
				},
			],
		});

		expect(sanitized.businessTypeGroup).toBe("01");
		expect(sanitized.exchangeRate).toBe(25400.5);
		expect(sanitized.netWeight).toBe(1200.25);
		expect(sanitized.expectedDeclarationDate).toBe("2026-04-28");
		expect(sanitized.reExportDeadline).toBe("2026-05-30");
		expect(sanitized.seaportSupervisionEnabled).toBe(true);
		expect(sanitized.airportSupervisionEnabled).toBe(false);
		expect(sanitized.transportSchedules).toEqual([
			{
				locationCode: "VNCLI",
				locationName: "Cat Lai",
				arrivalDate: "2026-04-28",
				departureDate: null,
			},
		]);
		expect(sanitized).not.toHaveProperty("truckLoadingLocationCode");
		expect(sanitized).not.toHaveProperty("estimatedArrivalAtDestinationDate");
	});
});
