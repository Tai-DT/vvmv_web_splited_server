// Nhập khẩu: E11, E15, E21, E31, E41 — Xuất khẩu: E42, E52, E62, E82.
// Giữ đủ cả hai nhóm vì hàm dùng chung cho cả tờ khai nhập và xuất
// (xem cds-required-schema.ts và mô tả trường trong cds-field-definitions.ts).
export const PERSON_ORGANIZATION_CLASSIFICATION_REQUIRED_OPERATION_CODES =
	new Set(["E11", "E15", "E21", "E31", "E41", "E42", "E52", "E62", "E82"]);

export function normalizePersonOrganizationOperationCode(value: unknown) {
	const normalized = String(value ?? "")
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, "");

	return normalized || null;
}

export function isPersonOrganizationClassificationRequiredForOperationCode(
	operationCode: unknown,
) {
	const normalized = normalizePersonOrganizationOperationCode(operationCode);

	return normalized
		? PERSON_ORGANIZATION_CLASSIFICATION_REQUIRED_OPERATION_CODES.has(
				normalized,
			)
		: false;
}
