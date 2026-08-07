import { describe, expect, it } from "vitest";
import { getCdsPackageUnitCodes } from "@/lib/followup/cds-package-unit-codes";
import { hasCdsExportFile } from "@/test/cds-exports-dataset";

describe("getCdsPackageUnitCodes", () => {
	it.skipIf(!hasCdsExportFile("BAN_DON_VI_KIEN_HANG.json"))(
		"loads package units from the app BAN_DON_VI_KIEN_HANG catalog",
		() => {
			const units = getCdsPackageUnitCodes();

			expect(units.length).toBeGreaterThanOrEqual(130);
			expect(units[0]).toMatchObject({
				code: "BA",
				name: "BARREL",
				nameVn: "Thùng tròn",
				isVnaccs: true,
				visibleFlag: "-1",
			});
			expect(units.find((unit) => unit.code === "PK")).toMatchObject({
				name: "PACKAGE",
				nameVn: "Kiện",
				legacyCode: "39",
			});
			expect(units.find((unit) => unit.code === "CT")).toMatchObject({
				name: "CARTON",
				nameVn: "Giấy, bìa",
			});
		},
	);
});
