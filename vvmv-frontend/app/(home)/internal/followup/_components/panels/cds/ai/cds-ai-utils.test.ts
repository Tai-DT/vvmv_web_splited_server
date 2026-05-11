import { describe, expect, it } from "vitest";
import { shouldApplyCdsAiValueToField } from "./cds-ai-utils";

describe("shouldApplyCdsAiValueToField", () => {
	it("applies AI value only when current CDS field is empty", () => {
		expect(
			shouldApplyCdsAiValueToField({
				aiValue: "INV-001",
				currentValue: "",
			}),
		).toBe(true);

		expect(
			shouldApplyCdsAiValueToField({
				aiValue: "INV-002",
				currentValue: "INV-001",
			}),
		).toBe(false);
	});

	it("does not apply empty AI placeholders over empty CDS fields", () => {
		expect(
			shouldApplyCdsAiValueToField({
				aiValue: "Không có",
				currentValue: "",
			}),
		).toBe(false);
	});
});
