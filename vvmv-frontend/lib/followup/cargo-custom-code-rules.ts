const OPTIONAL_CUSTOM_CODE_OPERATION_CODES = new Set(["A12", "B11"]);

export function normalizeCargoOperationCode(value: unknown) {
	return String(value ?? "")
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, "");
}

export function isCargoCustomCodeRequiredForOperationCode(value: unknown) {
	const operationCode = normalizeCargoOperationCode(value);

	if (!operationCode) {
		return true;
	}

	return !OPTIONAL_CUSTOM_CODE_OPERATION_CODES.has(operationCode);
}
