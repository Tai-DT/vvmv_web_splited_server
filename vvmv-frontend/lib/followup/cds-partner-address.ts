import type { FollowUpCdsInfoRow } from "@/app/(home)/internal/followup/types";

/** Giới hạn ký tự mỗi ô địa chỉ đối tác trên web — khớp ECUS/VNACCS (50 ký tự/ô). */
export const CDS_PARTNER_ADDRESS_LINE_MAX_LENGTH = 50;
export const CDS_PARTNER_ADDRESS_LINE_COUNT = 4;

export const CDS_PARTNER_ADDRESS_FIELD_KEYS = [
	"partnerAddress1",
	"partnerAddress2",
	"partnerAddress3",
	"partnerAddress4",
] as const satisfies ReadonlyArray<keyof FollowUpCdsInfoRow>;

export type CdsPartnerAddressFieldKey =
	(typeof CDS_PARTNER_ADDRESS_FIELD_KEYS)[number];

const PARTNER_ADDRESS_FIELD_SET = new Set<string>(
	CDS_PARTNER_ADDRESS_FIELD_KEYS,
);

function charLength(value: string) {
	return Array.from(value).length;
}

function sliceChars(value: string, start: number, end?: number) {
	return Array.from(value).slice(start, end).join("");
}

function splitAddressIntoPreferredUnits(value: string) {
	const units: string[] = [];
	const chars = Array.from(value);
	let currentUnit = "";

	for (let index = 0; index < chars.length; index += 1) {
		const char = chars[index];
		currentUnit += char;

		if (char !== "," && char !== ";") {
			continue;
		}

		const normalizedUnit = currentUnit.trim();
		if (normalizedUnit) {
			units.push(normalizedUnit);
		}
		currentUnit = "";

		while (chars[index + 1] === " ") {
			index += 1;
		}
	}

	const trailingUnit = currentUnit.trim();
	if (trailingUnit) {
		units.push(trailingUnit);
	}

	return units.length > 0 ? units : [value];
}

function splitTextByWords(value: string, maxLength: number) {
	const lines: string[] = [];
	let currentLine = "";

	const pushCurrentLine = () => {
		if (!currentLine) {
			return;
		}

		lines.push(currentLine);
		currentLine = "";
	};

	for (const word of value.split(" ")) {
		if (!word) {
			continue;
		}

		if (charLength(word) > maxLength) {
			pushCurrentLine();

			for (let index = 0; index < charLength(word); index += maxLength) {
				lines.push(sliceChars(word, index, index + maxLength));
			}
			continue;
		}

		if (!currentLine) {
			currentLine = word;
			continue;
		}

		const candidate = `${currentLine} ${word}`;
		if (charLength(candidate) <= maxLength) {
			currentLine = candidate;
			continue;
		}

		pushCurrentLine();
		currentLine = word;
	}

	pushCurrentLine();
	return lines;
}

export function isCdsPartnerAddressField(
	fieldKey: keyof FollowUpCdsInfoRow | string,
): fieldKey is CdsPartnerAddressFieldKey {
	return PARTNER_ADDRESS_FIELD_SET.has(String(fieldKey));
}

export function normalizeCdsPartnerAddressText(value: unknown) {
	const text = String(value ?? "")
		.replace(/\r?\n+/g, " ")
		.replace(/\s+/g, " ")
		.replace(/\s+([,.;:])/g, "$1")
		.trim();

	return text || null;
}

export function splitCdsPartnerAddressText(
	value: unknown,
	options?: {
		lineCount?: number;
		maxLength?: number;
	},
) {
	const maxLength = options?.maxLength ?? CDS_PARTNER_ADDRESS_LINE_MAX_LENGTH;
	const lineCount = options?.lineCount ?? CDS_PARTNER_ADDRESS_LINE_COUNT;
	const text = normalizeCdsPartnerAddressText(value);
	if (!text || maxLength <= 0 || lineCount <= 0) {
		return [];
	}

	const lines: string[] = [];
	let currentLine = "";

	const pushCurrentLine = () => {
		if (!currentLine || lines.length >= lineCount) {
			currentLine = "";
			return;
		}

		lines.push(currentLine);
		currentLine = "";
	};

	const appendUnit = (unit: string) => {
		if (lines.length >= lineCount) {
			return;
		}

		if (charLength(unit) > maxLength) {
			pushCurrentLine();
			for (const wordLine of splitTextByWords(unit, maxLength)) {
				if (lines.length >= lineCount) {
					break;
				}
				if (currentLine) {
					pushCurrentLine();
				}
				currentLine = wordLine;
			}
			return;
		}

		if (!currentLine) {
			currentLine = unit;
			return;
		}

		const candidate = `${currentLine} ${unit}`;
		if (charLength(candidate) <= maxLength) {
			currentLine = candidate;
			return;
		}

		pushCurrentLine();
		if (lines.length < lineCount) {
			currentLine = unit;
		}
	};

	for (const unit of splitAddressIntoPreferredUnits(text)) {
		appendUnit(unit);
	}

	pushCurrentLine();
	return lines;
}

export function normalizeCdsPartnerAddressFields(
	source: Partial<Record<CdsPartnerAddressFieldKey, unknown>>,
): Partial<Record<CdsPartnerAddressFieldKey, string | null>> {
	const hasAddressField = CDS_PARTNER_ADDRESS_FIELD_KEYS.some((fieldKey) =>
		Object.hasOwn(source, fieldKey),
	);
	if (!hasAddressField) {
		return {};
	}

	const normalizedByField = Object.fromEntries(
		CDS_PARTNER_ADDRESS_FIELD_KEYS.map((fieldKey) => [
			fieldKey,
			normalizeCdsPartnerAddressText(source[fieldKey]),
		]),
	) as Record<CdsPartnerAddressFieldKey, string | null>;
	const nonEmptyLines = CDS_PARTNER_ADDRESS_FIELD_KEYS.map(
		(fieldKey) => normalizedByField[fieldKey],
	).filter((line): line is string => !!line);
	const needsReflow = nonEmptyLines.some(
		(line) => charLength(line) > CDS_PARTNER_ADDRESS_LINE_MAX_LENGTH,
	);
	const resolvedLines = needsReflow
		? splitCdsPartnerAddressText(nonEmptyLines.join(" "))
		: CDS_PARTNER_ADDRESS_FIELD_KEYS.map(
				(fieldKey) => normalizedByField[fieldKey],
			);

	return Object.fromEntries(
		CDS_PARTNER_ADDRESS_FIELD_KEYS.map((fieldKey, index) => [
			fieldKey,
			resolvedLines[index] ?? null,
		]),
	) as Record<CdsPartnerAddressFieldKey, string | null>;
}

export function buildCdsPartnerAddressFieldChangePatch(
	fieldKey: CdsPartnerAddressFieldKey,
	value: unknown,
): Partial<Record<CdsPartnerAddressFieldKey, string | null>> {
	const normalizedValue = normalizeCdsPartnerAddressText(value);
	if (
		!normalizedValue ||
		charLength(normalizedValue) <= CDS_PARTNER_ADDRESS_LINE_MAX_LENGTH
	) {
		return { [fieldKey]: normalizedValue };
	}

	const startIndex = CDS_PARTNER_ADDRESS_FIELD_KEYS.indexOf(fieldKey);
	const lines = splitCdsPartnerAddressText(normalizedValue, {
		lineCount: CDS_PARTNER_ADDRESS_LINE_COUNT - startIndex,
	});

	return Object.fromEntries(
		CDS_PARTNER_ADDRESS_FIELD_KEYS.slice(startIndex).map(
			(targetFieldKey, index) => [targetFieldKey, lines[index] ?? null],
		),
	) as Partial<Record<CdsPartnerAddressFieldKey, string | null>>;
}
