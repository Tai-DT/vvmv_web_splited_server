import type { FollowUpCdsInfoRow } from "@/app/(home)/internal/followup/types";
import { normalizeCdsLookupValueField } from "@/lib/followup/cds-code-values";
import type { DatabaseFieldOptionLookup } from "@/lib/followup/cds-database-lookups";

type CdsFieldKey = Extract<keyof FollowUpCdsInfoRow, string>;

type CodeNameRow = {
	code: string | null | undefined;
	name: string | null | undefined;
};

export const APP_NAME_ONLY_FIELD_NAMES = new Set<CdsFieldKey>([
	"businessTypeGroup",
]);

export function normalizeLookupValueKey(value: string) {
	return value.trim().toUpperCase();
}

function getLookupLabelQuality(
	label: string | null | undefined,
	value: string,
) {
	const normalizedLabel = String(label ?? "").trim();
	const normalizedValue = value.trim();

	if (!normalizedLabel) {
		return 0;
	}

	if (
		normalizeLookupValueKey(normalizedLabel) ===
		normalizeLookupValueKey(normalizedValue)
	) {
		return 1;
	}

	if (
		normalizeLookupValueKey(normalizedLabel).startsWith(
			`${normalizeLookupValueKey(normalizedValue)} - `,
		)
	) {
		return 3;
	}

	return 2;
}

export function pickBetterLookupLabel(
	currentLabel: string | null | undefined,
	incomingLabel: string | null | undefined,
	value: string,
) {
	const currentQuality = getLookupLabelQuality(currentLabel, value);
	const incomingQuality = getLookupLabelQuality(incomingLabel, value);

	if (incomingQuality > currentQuality) {
		return incomingLabel ?? null;
	}

	if (incomingQuality < currentQuality) {
		return currentLabel ?? null;
	}

	return String(incomingLabel ?? "").trim().length >
		String(currentLabel ?? "").trim().length
		? (incomingLabel ?? null)
		: (currentLabel ?? null);
}

export function normalizeAppFieldOptionRow(args: {
	fieldName: CdsFieldKey;
	code: string | null | undefined;
	name: string | null | undefined;
}) {
	const name = String(args.name ?? "").trim();
	const code = (normalizeCdsLookupValueField(args.fieldName, args.code) ?? "")
		.trim()
		.toUpperCase();
	const allowsNameOnly = APP_NAME_ONLY_FIELD_NAMES.has(args.fieldName);

	if (!name) {
		return null;
	}

	if (!allowsNameOnly && !code) {
		return null;
	}

	const value = (code || name).trim();
	if (!value) {
		return null;
	}

	return {
		value,
		label: code ? `${code} - ${name}` : name,
	};
}

export function toAppLookupOptionsFromCodeNameRows(
	fieldName: CdsFieldKey,
	rows: CodeNameRow[],
): DatabaseFieldOptionLookup[] {
	const grouped = new Map<
		string,
		Pick<DatabaseFieldOptionLookup, "value" | "label" | "count">
	>();

	for (const row of rows) {
		const normalizedRow = normalizeAppFieldOptionRow({
			fieldName,
			code: row.code,
			name: row.name,
		});

		if (!normalizedRow) {
			continue;
		}

		const normalizedKey = normalizeLookupValueKey(normalizedRow.value);
		const existing = grouped.get(normalizedKey);

		if (existing) {
			existing.count += 1;
			existing.label =
				pickBetterLookupLabel(
					existing.label,
					normalizedRow.label,
					normalizedRow.value,
				) ?? existing.label;
			continue;
		}

		grouped.set(normalizedKey, {
			value: normalizedRow.value,
			label: normalizedRow.label,
			count: 1,
		});
	}

	return [...grouped.values()]
		.sort((left, right) => {
			if (right.count !== left.count) {
				return right.count - left.count;
			}

			return left.value.localeCompare(right.value, "en", { numeric: true });
		})
		.map((item) => ({
			field: fieldName,
			value: item.value,
			label: item.label,
			count: item.count,
			direction: "unknown" as const,
			source: "app" as const,
		}));
}
