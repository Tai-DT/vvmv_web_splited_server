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
