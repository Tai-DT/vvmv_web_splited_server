// cds-partner-utils.ts – partner directory functions extracted from cds-info-panel.tsx (Phase 2)

import type { EcusPartnerDirectoryEntry } from "../ecus-partner-directory";
import type { PartnersMasterDataDirectoryResponse } from "./cds-lookup-types";
import { normalizeLookupValue } from "./cds-normalize";

export function mapPartnerMasterDataToDirectoryEntry(
	partner: NonNullable<PartnersMasterDataDirectoryResponse["partners"]>[number],
): EcusPartnerDirectoryEntry | null {
	const taxCode = partner.taxCode?.trim() || null;
	const fullName = partner.fullName?.trim() || null;
	const name = fullName || taxCode;

	if (!name) {
		return null;
	}

	return {
		id: `partners-master-${partner.id}`,
		code: taxCode,
		name,
		taxCode,
		cw1Code: null,
		postalCode: null,
		address1: null,
		address2: null,
		address3: null,
		countryName: null,
	};
}

export function mergePartnerDirectoryEntry(
	current: EcusPartnerDirectoryEntry,
	candidate: EcusPartnerDirectoryEntry,
): EcusPartnerDirectoryEntry {
	const currentCodeMatchesTaxCode =
		!!current.code &&
		!!current.taxCode &&
		normalizeLookupValue(current.code) ===
			normalizeLookupValue(current.taxCode);

	return {
		id: current.id || candidate.id,
		code:
			current.code && !currentCodeMatchesTaxCode
				? current.code
				: (candidate.code ?? current.code),
		name: current.name || candidate.name,
		taxCode: current.taxCode ?? candidate.taxCode,
		cw1Code: current.cw1Code ?? candidate.cw1Code,
		postalCode: current.postalCode ?? candidate.postalCode,
		address1: current.address1 ?? candidate.address1,
		address2: current.address2 ?? candidate.address2,
		address3: current.address3 ?? candidate.address3,
		countryName: current.countryName ?? candidate.countryName,
	};
}

export function mergePartnerDirectoryEntries(
	entries: EcusPartnerDirectoryEntry[],
): EcusPartnerDirectoryEntry[] {
	const merged: EcusPartnerDirectoryEntry[] = [];

	for (const entry of entries) {
		const codeKey = normalizeLookupValue(entry.code);
		const nameKey = normalizeLookupValue(entry.name);
		const existingIndex = merged.findIndex((candidate) => {
			const candidateCodeKey = normalizeLookupValue(candidate.code);
			const candidateNameKey = normalizeLookupValue(candidate.name);

			return (
				(!!codeKey && codeKey === candidateCodeKey) ||
				(!!nameKey && nameKey === candidateNameKey)
			);
		});

		if (existingIndex === -1) {
			merged.push({ ...entry });
			continue;
		}

		merged[existingIndex] = mergePartnerDirectoryEntry(
			merged[existingIndex],
			entry,
		);
	}

	return merged;
}

export function scorePartnerDirectoryEntryMatch(
	entry: EcusPartnerDirectoryEntry,
	exporterCode: string,
	partnerName: string,
) {
	const entryCode = normalizeLookupValue(entry.code);
	const entryTaxCode = normalizeLookupValue(entry.taxCode);
	const entryName = normalizeLookupValue(entry.name);

	if (
		exporterCode &&
		(exporterCode === entryCode || exporterCode === entryTaxCode)
	) {
		return 1000;
	}

	if (
		partnerName &&
		(partnerName === entryName ||
			partnerName === entryCode ||
			partnerName === entryTaxCode)
	) {
		return 900;
	}

	if (!partnerName || !entryName) {
		return null;
	}

	if (entryName.startsWith(partnerName) || partnerName.startsWith(entryName)) {
		return 700 - Math.abs(entryName.length - partnerName.length);
	}

	if (entryName.includes(partnerName) || partnerName.includes(entryName)) {
		return 500 - Math.abs(entryName.length - partnerName.length);
	}

	return null;
}

export function findPartnerDirectoryEntry(
	entries: EcusPartnerDirectoryEntry[],
	options: {
		exporterCode?: string | null;
		partnerName?: string | null;
	},
): EcusPartnerDirectoryEntry | null {
	const exporterCode = normalizeLookupValue(options.exporterCode);
	const partnerName = normalizeLookupValue(options.partnerName);

	let bestMatch: EcusPartnerDirectoryEntry | null = null;
	let bestScore = -1;

	for (const entry of entries) {
		const score = scorePartnerDirectoryEntryMatch(
			entry,
			exporterCode,
			partnerName,
		);

		if (score === null || score <= bestScore) {
			continue;
		}

		bestMatch = entry;
		bestScore = score;
	}

	return bestMatch;
}
