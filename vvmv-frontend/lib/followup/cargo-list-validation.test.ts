import { describe, expect, it } from "vitest";
import { buildCargoListClientIssues } from "@/lib/followup/cargo-list-validation";

const cargoRowWithoutCustomCode = {
	customCode: "",
	vietnameseName: "Hang mau",
	qty: 1,
	unit: "PCE",
};

describe("buildCargoListClientIssues", () => {
	it("does not warn about missing cargo custom code for A12 and B11", () => {
		for (const operationCode of ["A12", "B11"]) {
			const issues = buildCargoListClientIssues([cargoRowWithoutCustomCode], {
				operationCode,
			});

			expect(issues).not.toContainEqual(
				expect.objectContaining({
					path: "cargoList[0].customCode",
				}),
			);
		}
	});

	it("still warns about missing cargo custom code for other operation codes", () => {
		const issues = buildCargoListClientIssues([cargoRowWithoutCustomCode], {
			operationCode: "E42",
		});

		expect(issues).toContainEqual(
			expect.objectContaining({
				path: "cargoList[0].customCode",
				severity: "warning",
			}),
		);
	});
});
