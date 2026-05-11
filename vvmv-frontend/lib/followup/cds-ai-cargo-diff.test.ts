import { describe, expect, it } from "vitest";
import type { CargoListRow } from "@/app/(home)/internal/followup/types";
import { cargoListsMeaningfullyDiffer } from "./cds-ai-cargo-diff";

describe("cargoListsMeaningfullyDiffer", () => {
	const row = (partial: Partial<CargoListRow>): Partial<CargoListRow> =>
		partial;

	it("returns false when tracked fields match per row", () => {
		expect(
			cargoListsMeaningfullyDiffer(
				[row({ vietnameseName: "A", hsCode: "1234" })],
				[row({ vietnameseName: "A", hsCode: "1234" })],
			),
		).toBe(false);
	});

	it("returns true when a name changes", () => {
		expect(
			cargoListsMeaningfullyDiffer(
				[row({ vietnameseName: "A" })],
				[row({ vietnameseName: "B" })],
			),
		).toBe(true);
	});

	it("returns true when row counts differ", () => {
		expect(cargoListsMeaningfullyDiffer([row({})], [])).toBe(true);
	});
});
