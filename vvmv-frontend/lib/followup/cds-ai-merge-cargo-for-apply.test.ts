import { describe, expect, it } from "vitest";
import { extractCargoDeleteIndexesForApply } from "./cds-ai-merge-cargo-for-apply";

describe("extractCargoDeleteIndexesForApply", () => {
	it("parses bỏ dòng N (compact form after normalize)", () => {
		const idx = extractCargoDeleteIndexesForApply("bỏ dòng 3");
		expect(idx.has(2)).toBe(true);
	});
});
