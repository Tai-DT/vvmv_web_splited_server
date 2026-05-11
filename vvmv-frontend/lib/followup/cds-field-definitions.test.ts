import { describe, expect, it } from "vitest";
import {
	FIELD_DEFINITIONS,
	getCdsInfoFieldUsage,
	isCdsInfoFieldRequiredForOperation,
	isCdsInfoFieldVisibleForOperation,
} from "./cds-field-definitions";
import { isPersonOrganizationClassificationRequiredForOperationCode } from "./cds-person-organization-classification";

describe("CDS field definitions", () => {
	it("shows person organization classification on import and export drafts", () => {
		expect(
			isCdsInfoFieldVisibleForOperation(
				"personOrganizationClassification",
				"XUAT",
			),
		).toBe(true);
		expect(
			isCdsInfoFieldVisibleForOperation(
				"personOrganizationClassification",
				"NHAP",
			),
		).toBe(true);
		expect(
			isCdsInfoFieldRequiredForOperation(
				"personOrganizationClassification",
				"NHAP",
			),
		).toBe(false);
	});

	it("requires person organization classification only for selected E operation codes", () => {
		expect(
			isPersonOrganizationClassificationRequiredForOperationCode("E11"),
		).toBe(true);
		expect(
			isPersonOrganizationClassificationRequiredForOperationCode("E82"),
		).toBe(true);
		expect(
			isPersonOrganizationClassificationRequiredForOperationCode("A12"),
		).toBe(false);
		expect(
			isPersonOrganizationClassificationRequiredForOperationCode("E54"),
		).toBe(false);
		expect(
			isPersonOrganizationClassificationRequiredForOperationCode("B11"),
		).toBe(false);
	});

	it("requires declaration processing department only for import", () => {
		expect(
			isCdsInfoFieldRequiredForOperation(
				"declarationProcessingDeptCode",
				"NHAP",
			),
		).toBe(true);
		expect(
			isCdsInfoFieldRequiredForOperation(
				"declarationProcessingDeptCode",
				"XUAT",
			),
		).toBe(false);
	});

	it("does not mark cargo custom code as statically required because A12 and B11 can be blank", () => {
		const definition = FIELD_DEFINITIONS.find(
			(item) => item.appPath === "cargoList[].customCode",
		);

		expect(definition?.importance).toBe("recommended");
		expect(definition?.requiredFor).toBeUndefined();
	});

	it("exposes other-information fields to the AI schema", () => {
		expect(getCdsInfoFieldUsage("packageMarks")?.importance).toBe(
			"recommended",
		);
		expect(getCdsInfoFieldUsage("note")?.importance).toBe("optional");
		expect(
			getCdsInfoFieldUsage("internalBusinessManagementNumber")?.importance,
		).toBe("optional");
	});
});
