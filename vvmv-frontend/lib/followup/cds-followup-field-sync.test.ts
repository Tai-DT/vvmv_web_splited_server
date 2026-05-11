import { describe, expect, it } from "vitest";
import {
	buildFollowUpPreferredCdsInfoPayload,
	buildFollowUpSyncPatchFromCdsInfo,
} from "./cds-followup-field-sync";

describe("cds follow-up field sync", () => {
	it("uses FollowUp table values as preferred CDS values", () => {
		const payload = buildFollowUpPreferredCdsInfoPayload({
			operationType: "NHAP",
			taxCode: "0111049392",
			authority: "03PL",
			workType: "A12",
			etaEtd: "2026-04-13T00:00:00.000Z",
			quantity: 3,
			unit: "PACKAGE",
			grossWeight: 339,
			invoice: "BWMVN260327",
			poNumber: "PO-1",
			billOrBooking: "KSBD26030246",
			pol: "CNZZZ",
			pod: "VNHUGT",
			transportDate: "2026-04-12",
			transportMethod: "sea",
			taxService: "VNBOND",
		});

		expect(payload).toMatchObject({
			importerCode: "0111049392",
			customsCode: "03PL",
			operationCode: "A12",
			departureArrivalDate: "2026-04-13",
			packageQuantity: 3,
			packageType: "PACKAGE",
			grossWeightTotal: 339,
			commercialInvoice: "BWMVN260327",
			contractNumber: "PO-1",
			billOfLading: "KSBD26030246",
			loadingLocationCode: "CNZZZ",
			unloadingLocationCode: "VNHUGT",
			transportDepartureDate: "2026-04-12",
			transportMethodCode: "2",
			taxDestinationLocation: "VNBOND",
		});
		expect(payload).not.toHaveProperty("operationType");
	});

	it("builds a save patch for green FollowUp fields only", () => {
		const patch = buildFollowUpSyncPatchFromCdsInfo({
			importerCode: "9999999999",
			customsCode: "01NV",
			operationCode: "B11",
			departureArrivalDate: "2026-10-04",
			packageQuantity: 2.8,
			packageType: "PALLET",
			grossWeightTotal: 1441,
			commercialInvoice: "00000034",
			contractNumber: "PO-2",
			billOfLading: "122600039818984",
			loadingLocationCode: "VNZZZ",
			unloadingLocationCode: "VNZZZ",
			transportDepartureDate: "2026-10-03",
			transportMethodCode: "4",
			taxDestinationLocation: "BONDED",
		});

		expect(patch).toEqual({
			authority: "01NV",
			workType: "B11",
			etaEtd: "2026-10-04",
			quantity: 2,
			unit: "PALLET",
			grossWeight: 1441,
			invoice: "00000034",
			poNumber: "PO-2",
			billOrBooking: "122600039818984",
			pol: "VNZZZ",
			pod: "VNZZZ",
			transportDate: "2026-10-03",
			transportMethod: "4",
			taxService: "BONDED",
		});
		expect(patch).not.toHaveProperty("taxCode");
		expect(patch).not.toHaveProperty("operationType");
	});
});
