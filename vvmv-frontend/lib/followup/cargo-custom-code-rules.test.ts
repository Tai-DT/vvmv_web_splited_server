import { describe, expect, it } from "vitest";
import {
	isCargoCustomCodeRequiredForOperationCode,
	normalizeCargoOperationCode,
} from "./cargo-custom-code-rules";

describe("cargo custom code rules", () => {
	it("does not require cargo custom code for A12 and B11", () => {
		expect(isCargoCustomCodeRequiredForOperationCode("A12")).toBe(false);
		expect(isCargoCustomCodeRequiredForOperationCode("B11")).toBe(false);
		expect(isCargoCustomCodeRequiredForOperationCode(" b-11 ")).toBe(false);
	});

	it("requires cargo custom code for other or missing operation codes", () => {
		expect(isCargoCustomCodeRequiredForOperationCode("E42")).toBe(true);
		expect(isCargoCustomCodeRequiredForOperationCode("A11")).toBe(true);
		expect(isCargoCustomCodeRequiredForOperationCode("")).toBe(true);
		expect(isCargoCustomCodeRequiredForOperationCode(null)).toBe(true);
	});

	it("normalizes operation codes before checking optional rules", () => {
		expect(normalizeCargoOperationCode(" b-11 ")).toBe("B11");
	});
});
