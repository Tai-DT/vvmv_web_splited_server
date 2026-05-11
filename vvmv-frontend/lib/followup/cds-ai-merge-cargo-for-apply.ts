import type { CargoListRow } from "@/app/(home)/internal/followup/types";
import {
	extractAssignedPromptValue,
	normalizePromptSearchText,
} from "@/lib/followup/cds-ai-chat-cds-info-patch";

/** Matches CDS AI cargo merge filtering (avoid lib imports from UI bundle). */
function isEmptyPlaceholderText(value: string) {
	const compact = value.trim().replace(/\s+/g, " ");
	const normalized = compact
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/đ/g, "d")
		.replace(/Đ/g, "D")
		.toLowerCase();

	return new Set([
		"-",
		"--",
		"—",
		"n/a",
		"n.a.",
		"khong co",
		"khong tim thay",
		"chua co",
	]).has(normalized);
}

function isMeaningfulValue(value: unknown): boolean {
	if (value === null || value === undefined) {
		return false;
	}

	if (typeof value === "string") {
		return value.trim() !== "" && !isEmptyPlaceholderText(value);
	}

	if (typeof value === "number") {
		return Number.isFinite(value);
	}

	if (Array.isArray(value)) {
		return value.some((item) => isMeaningfulValue(item));
	}

	if (typeof value === "object") {
		return Object.values(value as Record<string, unknown>).some((item) =>
			isMeaningfulValue(item),
		);
	}

	return true;
}

type PromptCargoPatch = Pick<
	Partial<CargoListRow>,
	"hsCode" | "originalCountry"
>;

function isGlobalCargoUpdatePrompt(promptText: string) {
	const normalized = normalizePromptSearchText(promptText);
	return /\b(tat ca|toan bo|toan danh sach|all|moi mat hang|cac mat hang)\b/.test(
		normalized,
	);
}

export function isClearCargoListPromptForApply(promptText: string) {
	const normalized = normalizePromptSearchText(promptText);
	return /\b(xoa|bo|clear)\b[\s\S]{0,80}\b(toan bo|tat ca|het|all)\b[\s\S]{0,80}\b(danh sach hang|hang hoa|cargo)\b/.test(
		normalized,
	);
}

export function extractCargoDeleteIndexesForApply(promptText: string) {
	const normalized = normalizePromptSearchText(promptText);
	const indexes = new Set<number>();
	const matches = normalized.matchAll(
		/\b(?:xoa|bo)\s+(?:dong\s+hang|dong|hang)\s+(?:so\s*)?((?:\d+)(?:\s*(?:,|va|&)\s*\d+)*)/g,
	);

	for (const match of matches) {
		const indexText = match[1] ?? "";
		for (const numberText of indexText.matchAll(/\d+/g)) {
			const rowNumber = Number(numberText[0]);
			if (Number.isInteger(rowNumber) && rowNumber > 0) {
				indexes.add(rowNumber - 1);
			}
		}
	}

	for (const match of normalized.matchAll(/\b(?:xoa|bo)\s+dong\s+(\d+)\b/g)) {
		const rowNumber = Number(match[1]);
		if (Number.isInteger(rowNumber) && rowNumber > 0) {
			indexes.add(rowNumber - 1);
		}
	}

	return indexes;
}

export function shouldReplaceCargoListFromAi(promptText: string) {
	const normalized = normalizePromptSearchText(promptText);
	return /\b(thay the|ghi de|tao lai|lap lai|dung|ap)\b[\s\S]{0,80}\b(danh sach hang|cargo)\b/.test(
		normalized,
	);
}

export function extractGlobalCargoPatchFromPrompt(promptText: string) {
	if (!isGlobalCargoUpdatePrompt(promptText)) {
		return null;
	}

	const normalized = normalizePromptSearchText(promptText);
	const patch: PromptCargoPatch = {};
	const hsLabel = "(?:ma\\s+hs(?:\\s+code)?|hs\\s+code)";
	const hsValue = extractAssignedPromptValue(normalized, hsLabel);
	const hsCode = hsValue?.match(/\b\d{4,12}\b/)?.[0];
	if (hsCode) {
		patch.hsCode = hsCode;
	}

	const countryLabel = "(?:nuoc\\s+xuat\\s+xu|xuat\\s+xu|original\\s+country)";
	const countryValue = extractAssignedPromptValue(normalized, countryLabel);
	const countryCode = countryValue
		?.replace(/\s+/g, " ")
		.replace(/^ma\s+/i, "")
		.trim();
	if (countryCode) {
		patch.originalCountry = countryCode.toUpperCase().replace(/\s+/g, "");
	}

	return Object.keys(patch).length > 0 ? patch : null;
}

export function stripCargoPersistenceFields(row: Partial<CargoListRow>) {
	const next = { ...row };
	delete next.id;
	delete next.followUpId;
	delete next.createdAt;
	delete next.updatedAt;
	return next;
}

function normalizeHsCodeForMerge(value: unknown): string | null {
	if (value === null || value === undefined) {
		return null;
	}
	const normalized = String(value).trim().replace(/\s+/g, "");
	return normalized === "" ? null : normalized.replace(/\./g, "");
}

function normalizeCustomCodeForMerge(value: unknown): string | null {
	if (value === null || value === undefined) {
		return null;
	}
	const normalized = String(value).trim().replace(/\s+/g, "").toUpperCase();
	return normalized === "" ? null : normalized;
}

/** Current row index paired with AI row index, or `null` if no keyed match yet. */
function resolveKeyedCurrentIndex(args: {
	aiRow: Partial<CargoListRow>;
	currentRows: Partial<CargoListRow>[];
	usedCurrent: ReadonlySet<number>;
}): number | null {
	const hsAi = normalizeHsCodeForMerge(args.aiRow.hsCode);
	const cuAi = normalizeCustomCodeForMerge(args.aiRow.customCode);

	if (hsAi !== null && cuAi !== null) {
		for (let k = 0; k < args.currentRows.length; k++) {
			if (args.usedCurrent.has(k)) {
				continue;
			}

			const current = args.currentRows[k];
			if (
				normalizeHsCodeForMerge(current?.hsCode) === hsAi &&
				normalizeCustomCodeForMerge(current?.customCode) === cuAi
			) {
				return k;
			}
		}
		return null;
	}

	if (hsAi === null) {
		return null;
	}

	let matchIndex: number | null = null;
	let duplicate = false;

	for (let k = 0; k < args.currentRows.length; k++) {
		if (args.usedCurrent.has(k)) {
			continue;
		}

		const currentHs = normalizeHsCodeForMerge(args.currentRows[k]?.hsCode);

		if (currentHs !== hsAi) {
			continue;
		}

		if (matchIndex !== null) {
			duplicate = true;
			break;
		}

		matchIndex = k;
	}

	if (duplicate || matchIndex === null) {
		return null;
	}

	return matchIndex;
}

/**
 * Fallback alignment: positional index when keyed matching does not resolve a row,
 * preserving prior index-based merge behavior after greedy key pairing.
 */
function resolvePairingIndices(args: {
	aiRowCount: number;
	currentRowCount: number;
	keyedCurrentIndices: Array<number | null>;
}): number[] {
	const usedCurrent = new Set<number>();
	for (const k of args.keyedCurrentIndices) {
		if (typeof k === "number") {
			usedCurrent.add(k);
		}
	}

	const out = args.keyedCurrentIndices.map<number>(() => -1);

	for (let i = 0; i < args.aiRowCount; i++) {
		const keyed = args.keyedCurrentIndices[i];
		if (typeof keyed === "number") {
			out[i] = keyed;
		}
	}

	for (let i = 0; i < args.aiRowCount; i++) {
		if (out[i] !== -1) {
			continue;
		}

		if (i < args.currentRowCount && !usedCurrent.has(i)) {
			out[i] = i;
			usedCurrent.add(i);
		}
	}

	for (let i = 0; i < args.aiRowCount; i++) {
		if (out[i] !== -1) {
			continue;
		}

		let fallback: number | null = null;
		for (let k = 0; k < args.currentRowCount; k++) {
			if (!usedCurrent.has(k)) {
				fallback = k;
				break;
			}
		}

		if (fallback !== null) {
			out[i] = fallback;
			usedCurrent.add(fallback);
		}
	}

	return out;
}

export function mergeCargoRowsForApply(input: {
	aiRows: Partial<CargoListRow>[];
	currentRows: Partial<CargoListRow>[];
	promptText: string;
}) {
	if (isClearCargoListPromptForApply(input.promptText)) {
		return { rows: [], shouldApply: true };
	}

	const globalPatch = extractGlobalCargoPatchFromPrompt(input.promptText);
	const deleteIndexes = extractCargoDeleteIndexesForApply(input.promptText);
	const replaceFromAi = shouldReplaceCargoListFromAi(input.promptText);

	if (!globalPatch && input.aiRows.length === 0 && deleteIndexes.size === 0) {
		return { rows: [], shouldApply: false };
	}

	if (replaceFromAi && input.aiRows.length > 0) {
		return {
			rows: input.aiRows.map(stripCargoPersistenceFields),
			shouldApply: true,
		};
	}

	const currentRows = input.currentRows.filter(
		(_, index) => !deleteIndexes.has(index),
	);

	if (deleteIndexes.size > 0 && input.aiRows.length === 0 && !globalPatch) {
		return {
			rows: currentRows.map(stripCargoPersistenceFields),
			shouldApply: true,
		};
	}

	if (currentRows.length === 0 && input.aiRows.length === 0) {
		return { rows: [], shouldApply: true };
	}

	const usedKeyed = new Set<number>();
	const keyedPerAi: Array<number | null> = [];

	for (const aiRaw of input.aiRows) {
		const aiRow = stripCargoPersistenceFields(aiRaw);

		const k = resolveKeyedCurrentIndex({
			aiRow,
			currentRows,
			usedCurrent: usedKeyed,
		});

		if (k !== null) {
			usedKeyed.add(k);
		}

		keyedPerAi.push(k);
	}

	const pairingIndices = resolvePairingIndices({
		aiRowCount: input.aiRows.length,
		currentRowCount: currentRows.length,
		keyedCurrentIndices: keyedPerAi,
	});

	const usedCurrentEffective = new Set<number>();
	pairingIndices.forEach((k) => {
		if (k >= 0) {
			usedCurrentEffective.add(k);
		}
	});

	const rows: Partial<CargoListRow>[] = [];

	for (let aiIndex = 0; aiIndex < input.aiRows.length; aiIndex++) {
		const pairing = pairingIndices[aiIndex] ?? -1;
		const currentRow =
			pairing >= 0
				? stripCargoPersistenceFields(currentRows[pairing] ?? {})
				: {};
		const aiRow = stripCargoPersistenceFields(input.aiRows[aiIndex] ?? {});
		const merged: Partial<CargoListRow> = { ...currentRow };
		const mergedRecord = merged as Record<string, unknown>;

		Object.entries(aiRow).forEach(([fieldKey, value]) => {
			if (!isMeaningfulValue(value)) {
				return;
			}

			mergedRecord[fieldKey] = value;
		});

		if (globalPatch) {
			Object.assign(merged, globalPatch);
		}

		rows.push(merged);
	}

	for (let k = 0; k < currentRows.length; k++) {
		if (usedCurrentEffective.has(k)) {
			continue;
		}

		let merged = stripCargoPersistenceFields(currentRows[k] ?? {});
		if (globalPatch) {
			merged = { ...merged };
			Object.assign(merged, globalPatch);
		}
		rows.push(merged);
	}

	return {
		rows: rows.filter((row) => isMeaningfulValue(row)),
		shouldApply: true,
	};
}
