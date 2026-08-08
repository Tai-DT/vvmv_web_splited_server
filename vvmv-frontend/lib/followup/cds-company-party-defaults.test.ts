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

	it("keeps user-entered party fields and only fills the blank ones", () => {
		// Khớp cam kết trong buildCdsCompanyPartyDefaultWarnings: giá trị trên form
		// khác dữ liệu chuẩn thì vẫn được giữ, chỉ cảnh báo.
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
		).toMatchObject({
			importerCode: "999",
			importExportUnitName: "Wrong Co",
			importExportBusinessAddress: "Old address",
			importerPhone: "123",
			// Chỉ ô đang trống mới được bù từ dữ liệu chuẩn.
			importerPostalCode: "700000",
		});
	});

	it("never lets the placeholder postal code overwrite a real one", () => {
		// buildPartnerMasterCdsDefaults sinh `postalCode ?? "x"`, nên default rất
		// hay mang giá trị giữ chỗ "x" khi đối tác chưa có mã bưu chính.
		expect(
			applyCdsCompanyPartyDefaults(
				{ importerPostalCode: "100000" },
				{ ...defaults, importerPostalCode: "x" },
			).importerPostalCode,
		).toBe("100000");

		// Chiều ngược lại vẫn phải nâng cấp được: "x" trên form nhường mã thật.
		expect(
			applyCdsCompanyPartyDefaults({ importerPostalCode: "x" }, defaults)
				.importerPostalCode,
		).toBe("700000");
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
