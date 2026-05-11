import { describe, expect, it } from "vitest";
import { getCdsCargoUnitCodes } from "@/lib/followup/cds-cargo-unit-codes";

describe("getCdsCargoUnitCodes", () => {
	it("loads the HAN_2024 SDVT cargo unit lookup sorted by real usage", () => {
		const units = getCdsCargoUnitCodes();

		expect(units.length).toBeGreaterThanOrEqual(160);
		expect(units[0]).toMatchObject({
			code: "PCE",
			nameVn: "Cái/Chiếc",
			usedCount: 1529158,
			inSdvtMaster: true,
		});
		expect(units.find((unit) => unit.code === "KGM")).toMatchObject({
			nameVn: "Kilogam",
			inSdvtMaster: true,
		});
		expect(units.some((unit) => !unit.inSdvtMaster && unit.usedCount > 0)).toBe(
			true,
		);
	});
});
