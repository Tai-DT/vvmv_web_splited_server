import { describe, expect, it } from "vitest";
import { getCdsDatabaseLookups } from "@/lib/followup/cds-database-lookups";
import { hasCdsExportFile } from "@/test/cds-exports-dataset";
import type { CdsDatabaseFieldOption } from "./cds-lookup-types";
import { formatLookupOptionLabel } from "./cds-lookup-utils";
import {
	buildGuaranteeBankLookupOptions,
	type CdsFieldKey,
	getOperationCodeLookupSource,
	mergeOperationCodeSelectOptions,
} from "./use-cds-lookup-options.build";

function toSelectOptions(rows: CdsDatabaseFieldOption[] | undefined) {
	return (rows ?? []).map((item) => ({
		value: item.value,
		label: formatLookupOptionLabel(item.value, item.label),
		meta: {
			address: item.address ?? null,
			usedCount: String(item.count ?? 0),
		},
	}));
}

describe("use-cds-lookup-options.build", () => {
	it.skipIf(!hasCdsExportFile("cds_bank_codes.json"))(
		"builds non-empty guarantee bank options from merged CDS database lookups",
		() => {
			const lookups = getCdsDatabaseLookups();
			const getDynamicOptions = (fieldKey: CdsFieldKey) => {
				if (fieldKey === "guaranteeBankCode") {
					return toSelectOptions(lookups.fieldOptions.guaranteeBankCode);
				}
				if (fieldKey === "taxSubstituteBankCode") {
					return toSelectOptions(lookups.fieldOptions.taxSubstituteBankCode);
				}
				return [];
			};

			const options = buildGuaranteeBankLookupOptions(getDynamicOptions);
			expect(options.length).toBeGreaterThan(0);
		},
	);

	it("includes an operation code present only in the dynamic payload list", () => {
		const merged = mergeOperationCodeSelectOptions(
			[
				{
					code: "__ONLY_IN_DYNAMIC_PAYLOAD__",
					name: "Synthetic payload row",
					direction: "unknown",
				},
			],
			"import",
		);

		expect(
			merged.some((option) => option.value === "__ONLY_IN_DYNAMIC_PAYLOAD__"),
		).toBe(true);
	});

	describe("getOperationCodeLookupSource", () => {
		it('returns "live" when the payload includes operation codes', () => {
			expect(
				getOperationCodeLookupSource([
					{ code: "A11", name: "Test", direction: "import" },
				]),
			).toBe("live");
		});

		it('returns "fallback" when the payload has no operation codes (ECUS-only)', () => {
			expect(getOperationCodeLookupSource([])).toBe("fallback");
			expect(getOperationCodeLookupSource(undefined)).toBe("fallback");
			expect(getOperationCodeLookupSource(null)).toBe("fallback");
		});
	});
});
