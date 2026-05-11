import { describe, expect, it } from "vitest";
import type { DeclarationRow, FollowUpRow } from "../../../types";
import {
	buildExportPrefillPayload,
	buildImportPrefillPayload,
	hydrateCdsInfoUiFields,
} from "./cds-prefill";

describe("CDS prefill weight unit", () => {
	it("keeps package type from follow-up unit but defaults export weight unit to KGM", () => {
		const payload = buildExportPrefillPayload({
			followUpSummary: {
				unit: "PR",
				grossWeight: 9800,
			} satisfies Partial<FollowUpRow>,
		});

		expect(payload.packageType).toBe("PR");
		expect(payload.grossWeightTotal).toBe(9800);
		expect(payload.weightUnit).toBe("KGM");
	});

	it("does not copy import weight unit from package or cargo unit history", () => {
		const payload = buildImportPrefillPayload({
			followUpSummary: {
				unit: "PR",
			} satisfies Partial<FollowUpRow>,
			declarations: [
				{
					unit: "UNB",
					grossWeight: 1200,
				} as DeclarationRow,
			],
		});

		expect(payload.packageType).toBe("PR");
		expect(payload.grossWeightTotal).toBe(1200);
		expect(payload.weightUnit).toBe("KGM");
	});

	it("normalizes old invalid stored gross weight units when hydrating UI data", () => {
		const hydrated = hydrateCdsInfoUiFields({
			loadingLocationCode: "VNCLI - Cat Lai",
			loadingLocationName: "VNCLI - Cat Lai",
			weightUnit: "UNB - Quyển/Tập",
		});

		expect(hydrated.loadingLocationCode).toBe("VNCLI");
		expect(hydrated.loadingLocationName).toBe("Cat Lai");
		expect(hydrated.weightUnit).toBe("KGM");
	});
});
