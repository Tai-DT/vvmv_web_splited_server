export type ProcessingDepartmentLookup = {
	code: string;
	customsCode: string;
	name: string | null;
	operationCodes: string[];
	allowImport: boolean;
	allowExport: boolean;
};

export type ProcessingDepartmentContext = {
	customsCode?: string | null;
	operationCode?: string | null;
	direction?: "import" | "export" | "unknown" | null;
};

function clean(value: unknown) {
	const normalized = String(value ?? "").trim();
	return normalized === "" ? null : normalized;
}

function cleanCode(value: unknown) {
	return clean(value)?.toUpperCase() ?? null;
}

function normalizeOperationText(value: string) {
	return value
		.toUpperCase()
		.replace(/[^A-Z0-9,;|/]+/g, "")
		.trim();
}

function nameMentionsOperationCode(
	department: ProcessingDepartmentLookup,
	operationCode: string | null,
) {
	if (!operationCode || !department.name) {
		return false;
	}

	const normalizedName = normalizeOperationText(department.name);
	return normalizedName.includes(operationCode);
}

function hasDirectionRestriction(department: ProcessingDepartmentLookup) {
	return department.allowImport || department.allowExport;
}

function matchesDirection(
	department: ProcessingDepartmentLookup,
	direction: "import" | "export" | "unknown",
) {
	if (direction === "unknown" || !hasDirectionRestriction(department)) {
		return true;
	}

	if (direction === "import") {
		return department.allowImport;
	}

	return department.allowExport;
}

function getOperationMatchType(
	department: ProcessingDepartmentLookup,
	operationCode: string | null,
) {
	if (!operationCode) {
		return "generic";
	}

	const operationCodes = department.operationCodes;
	if (operationCodes.length === 0 || operationCodes.includes("ALL")) {
		return "generic";
	}

	return operationCodes.includes(operationCode) ? "exact" : "excluded";
}

function buildScore(
	department: ProcessingDepartmentLookup,
	operationCode: string | null,
) {
	const operationMatchType = getOperationMatchType(department, operationCode);
	const exactOperationMatch = operationMatchType === "exact";
	const genericOperationMatch = operationMatchType === "generic";
	const nameOperationMatch = nameMentionsOperationCode(
		department,
		operationCode,
	);

	return [
		exactOperationMatch ? 3 : 0,
		nameOperationMatch ? 2 : 0,
		genericOperationMatch ? 1 : 0,
		department.code === "00" ? 1 : 0,
	] as const;
}

function compareScores(left: readonly number[], right: readonly number[]) {
	const length = Math.max(left.length, right.length);

	for (let index = 0; index < length; index += 1) {
		const delta = (right[index] ?? 0) - (left[index] ?? 0);
		if (delta !== 0) {
			return delta;
		}
	}

	return 0;
}

export function normalizeProcessingDepartmentOperationCodes(
	value: string | null | undefined,
) {
	const normalized = clean(value);
	if (!normalized) {
		return [];
	}

	return [
		...new Set(
			normalized
				.split(/[,;|/]+/)
				.map((item) => cleanCode(item))
				.filter((item): item is string => Boolean(item)),
		),
	];
}

export function filterProcessingDepartments(
	departments: ProcessingDepartmentLookup[],
	context: ProcessingDepartmentContext,
) {
	const customsCode = cleanCode(context.customsCode);
	const operationCode = cleanCode(context.operationCode);
	const direction = context.direction ?? "unknown";

	return departments
		.filter((department) => {
			if (customsCode && cleanCode(department.customsCode) !== customsCode) {
				return false;
			}

			if (!matchesDirection(department, direction)) {
				return false;
			}

			return getOperationMatchType(department, operationCode) !== "excluded";
		})
		.sort((left, right) => {
			const scoreCompare = compareScores(
				buildScore(left, operationCode),
				buildScore(right, operationCode),
			);

			if (scoreCompare !== 0) {
				return scoreCompare;
			}

			if (left.code === "00" && right.code !== "00") {
				return -1;
			}

			if (left.code !== "00" && right.code === "00") {
				return 1;
			}

			return left.code.localeCompare(right.code, "en", { numeric: true });
		});
}

export function pickPreferredProcessingDepartment(
	departments: ProcessingDepartmentLookup[],
	context: ProcessingDepartmentContext,
) {
	const filtered = filterProcessingDepartments(departments, context);
	const operationCode = cleanCode(context.operationCode);

	if (filtered.length === 0) {
		return null;
	}

	if (filtered.length === 1) {
		return filtered[0];
	}

	const topScore = buildScore(filtered[0], operationCode);
	const topMatches = filtered.filter(
		(department) =>
			compareScores(buildScore(department, operationCode), topScore) === 0,
	);

	if (topMatches.length === 1) {
		return topMatches[0];
	}

	const defaultDepartment = topMatches.filter(
		(department) => department.code === "00",
	);
	if (!operationCode && defaultDepartment.length === 1) {
		return defaultDepartment[0];
	}

	return null;
}
