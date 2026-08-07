import { describe, expect, it } from "vitest";
import { hasCdsExportFile } from "@/test/cds-exports-dataset";
import { getCdsDatabaseLookups } from "./cds-database-lookups";

describe("getCdsDatabaseLookups", () => {
	it.skipIf(!hasCdsExportFile("cds_bank_codes.json"))(
		"loads bank code fallback options for tax substitute and guarantee lookups",
		() => {
			const fieldOptions = getCdsDatabaseLookups().fieldOptions;

			expect(fieldOptions.taxSubstituteBankCode?.length).toBeGreaterThanOrEqual(
				1202,
			);
			expect(fieldOptions.guaranteeBankCode?.length).toBeGreaterThanOrEqual(
				1202,
			);
			expect(
				fieldOptions.taxSubstituteBankCode?.find(
					(option) => option.value === "01203001",
				),
			).toMatchObject({
				label: "NHTMCP Ngoai Thuong Viet Nam (Hoi so chinh)",
			});
		},
	);

	it.skipIf(!hasCdsExportFile("cds_truck_loading_codes.json"))(
		"loads Truck_Loading_Codes fallback with addresses and used-count order",
		() => {
			const truckLoadingOptions =
				getCdsDatabaseLookups().fieldOptions.truckLoadingLocationCode ?? [];

			expect(truckLoadingOptions.length).toBeGreaterThanOrEqual(16_624);
			expect(truckLoadingOptions[0]).toMatchObject({
				value: "01PRZ61",
				address: "Lô 36, KCN Quang Minh, Mê Linh, Hà Nội",
				count: 5969,
			});
			expect(
				truckLoadingOptions.find((option) => option.value === "VNAPIT"),
			).toMatchObject({
				label: "LOI MO A PA CHAI",
				address: null,
			});
		},
	);

	it("fills permitTypes from embedded ECUS legal-document catalog when snapshots lack SLOAI_GP", () => {
		const { permitTypes } = getCdsDatabaseLookups();

		expect(permitTypes.length).toBeGreaterThan(100);
		expect(permitTypes.find((item) => item.code === "AA")).toMatchObject({
			code: "AA",
			name: expect.stringContaining("05/2006/QĐ"),
		});
	});
});
