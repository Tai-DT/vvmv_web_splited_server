import { describe, expect, it } from "vitest";
import {
	applyCdsCompanyPartyDefaults,
	buildCdsCompanyPartyDefaultWarnings,
	mergeCdsCompanyPartyDefaults,
} from "./cds-company-party-defaults";

describe("cds company party defaults", () => {
	const defaults = {
		importerCode: "2300674028",
		importExportUnitName: "Cong ty ABC",
		importerPostalCode: "700000",
		importExportBusinessAddress: "123 Nguyen Trai",
		importerPhone: "02223765438",
	};

	it("overrides local party fields before registering to HAN", () => {
		expect(
			applyCdsCompanyPartyDefaults(
				{
					importerCode: "999",
					importExportUnitName: "Wrong Co",
					importerPostalCode: null,
					importExportBusinessAddress: "Old address",
					importerPhone: "123",
				},
				defaults,
			),
		).toMatchObject(defaults);
	});

	it("emits warnings instead of blocking errors for mismatched party fields", () => {
		const warnings = buildCdsCompanyPartyDefaultWarnings(
			{
				importerCode: "2300674028",
				importExportUnitName: "Other Co",
				importerPostalCode: null,
				importExportBusinessAddress: "Old address",
				importerPhone: "0222 376 5438",
			},
			defaults,
		);

		expect(warnings.map((warning) => warning.field)).toEqual([
			"importExportUnitName",
			"importerPostalCode",
			"importExportBusinessAddress",
		]);
	});

	it("fills missing defaults from fallback without replacing confirmed values", () => {
		expect(
			mergeCdsCompanyPartyDefaults(
				{
					importerCode: "1816781693",
					importExportUnitName: "TNHH Det May Phuong Dong",
					importerPostalCode: "x",
				},
				{
					importerCode: "999",
					importExportUnitName: "Other",
					importerPostalCode: "700000",
					importExportBusinessAddress: "123 Nguyen Trai",
					importerPhone: "02812345678",
				},
			),
		).toEqual({
			importerCode: "1816781693",
			importExportUnitName: "TNHH Det May Phuong Dong",
			importerPostalCode: "700000",
			importExportBusinessAddress: "123 Nguyen Trai",
			importerPhone: "02812345678",
		});
	});
});
