import type { FollowUpCdsInfoRow } from "@/app/(home)/internal/followup/types";
import {
	type FollowUpOperationType,
	normalizeOperationTypeValue,
} from "@/lib/followup/operation-type";

type CdsFieldKey = Extract<keyof FollowUpCdsInfoRow, string>;

const IMPORT_WEB_LOCKED_FIELDS = [
	"declarationNumber",
	"declarationSequenceNumber",
	"firstDeclarationNumber",
	"branchNumberPart1",
	"branchNumberPart2",
	"cargoClassificationCode",
	"importerCode",
] as const satisfies readonly CdsFieldKey[];

const EXPORT_WEB_LOCKED_FIELDS = [
	"declarationNumber",
	"declarationSequenceNumber",
	"firstDeclarationNumber",
	"branchNumberPart1",
	"branchNumberPart2",
	"cargoClassificationCode",
	"importerCode",
] as const satisfies readonly CdsFieldKey[];

const WEB_LOCKED_FIELDS_BY_OPERATION = {
	NHAP: new Set<CdsFieldKey>(IMPORT_WEB_LOCKED_FIELDS),
	XUAT: new Set<CdsFieldKey>(EXPORT_WEB_LOCKED_FIELDS),
} as const satisfies Record<FollowUpOperationType, ReadonlySet<CdsFieldKey>>;

function resolveOperationType(
	operationType: unknown,
): FollowUpOperationType | null {
	return normalizeOperationTypeValue(operationType);
}

export function getCdsWebLockedFieldSet(operationType: unknown) {
	const resolvedOperationType = resolveOperationType(operationType);
	if (!resolvedOperationType) {
		return null;
	}

	return WEB_LOCKED_FIELDS_BY_OPERATION[resolvedOperationType];
}

export function isCdsWebLockedField(
	fieldKey: keyof FollowUpCdsInfoRow,
	operationType: unknown,
) {
	const lockedFieldSet = getCdsWebLockedFieldSet(operationType);
	return lockedFieldSet?.has(fieldKey as CdsFieldKey) ?? false;
}

export function omitCdsWebLockedFields<T extends Record<string, unknown>>(
	payload: T,
	operationType: unknown,
) {
	const lockedFieldSet = getCdsWebLockedFieldSet(operationType);
	if (!lockedFieldSet) {
		return { ...payload } as Partial<T>;
	}

	return Object.fromEntries(
		Object.entries(payload).filter(
			([fieldKey]) => !lockedFieldSet.has(fieldKey as CdsFieldKey),
		),
	) as Partial<T>;
}
