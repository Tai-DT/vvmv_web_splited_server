// cds-field-locks.ts – field lock/disable constants extracted from cds-info-panel.tsx (Phase 1)

import type { FollowUpCdsInfoRow } from "../../../types";
import type { ImportImage1SourceField } from "./cds-lookup-types";

export const IMPORT_IMAGE_1_DEPENDENT_FIELDS_BY_SOURCE = {
	importerCode: [
		"importExportUnitName",
		"importerPostalCode",
		"importExportBusinessAddress",
		"importerPhone",
	],
	entrustedImporterCode: ["entrustedImporterName"],
	exporterCode: [
		"partnerName",
		"exporterPostalCode",
		"partnerAddress1",
		"partnerAddress2",
		"partnerAddress3",
		"partnerAddress4",
		"exportCountryCode",
	],
} satisfies Record<
	ImportImage1SourceField,
	readonly (keyof FollowUpCdsInfoRow)[]
>;

const STATIC_LOCKED_FIELD_KEYS: (keyof FollowUpCdsInfoRow)[] = [
	"declarationNumber",
	"declarationSequenceNumber",
	"firstDeclarationNumber",
	"branchNumberPart1",
	"branchNumberPart2",
	"cargoClassificationCode",
	"importerCode",
];

function buildStaticDisabledReasons(
	suffix: string,
): Partial<Record<keyof FollowUpCdsInfoRow, string>> {
	return Object.fromEntries(
		STATIC_LOCKED_FIELD_KEYS.map((key) => [
			key,
			`Ô này đang khóa theo giao diện ECUS của ${suffix}.`,
		]),
	) as Partial<Record<keyof FollowUpCdsInfoRow, string>>;
}

export const IMPORT_IMAGE_1_STATIC_DISABLED_REASONS =
	buildStaticDisabledReasons("màn nhập khẩu");

// Theo giao diện ECUS export trong ảnh đối chiếu, các ô này hiển thị xám
// nên cần khóa thao tác thay vì chỉ đổi màu.
export const EXPORT_STATIC_DISABLED_REASONS =
	buildStaticDisabledReasons("màn xuất khẩu");

export function clearImportImage1DependentFields(
	next: Record<string, unknown>,
	sourceField: ImportImage1SourceField,
) {
	IMPORT_IMAGE_1_DEPENDENT_FIELDS_BY_SOURCE[sourceField].forEach((fieldKey) => {
		next[fieldKey] = null;
	});
}

export function hasMeaningfulCollectionValue(value: unknown): boolean {
	if (value === null || value === undefined) {
		return false;
	}

	if (typeof value === "string") {
		return value.trim() !== "";
	}

	if (typeof value === "number") {
		return Number.isFinite(value);
	}

	if (typeof value === "boolean") {
		return value;
	}

	if (Array.isArray(value)) {
		return value.some((item) => hasMeaningfulCollectionValue(item));
	}

	if (typeof value === "object") {
		return Object.values(value).some((item) =>
			hasMeaningfulCollectionValue(item),
		);
	}

	return true;
}

export function hasAnyRowValue(
	row: Record<string, unknown> | null | undefined,
	keys?: string[],
) {
	if (!row) {
		return false;
	}

	const values = keys ? keys.map((key) => row[key]) : Object.values(row);
	return values.some((value) => hasMeaningfulCollectionValue(value));
}

export function getSequentialLockReason({
	index,
	currentHasValue,
	previousHasValue,
	label,
	unit = "dòng",
}: {
	index: number;
	currentHasValue: boolean;
	previousHasValue: boolean;
	label: string;
	unit?: "dòng" | "ô";
}) {
	if (index === 0 || currentHasValue || previousHasValue) {
		return null;
	}

	return `Nhập ${unit} ${index} của ${label} trước để mở ${unit} ${index + 1}.`;
}
