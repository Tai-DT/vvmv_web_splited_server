import { describe, expect, it } from "vitest";
import {
	buildSyncedFollowUpCdsInfoPayload,
	sanitizeFollowUpCdsInfoPayload,
} from "./ai-ocr-sync";

describe("sanitizeFollowUpCdsInfoPayload", () => {
	it("splits lookup display labels into code and clean name", () => {
		const payload = sanitizeFollowUpCdsInfoPayload({
			warehouseLocationName: "02DSEA0 - CTY TNHH DỊCH VỤ TIẾP VẬN TOÀN CẦU",
			loadingLocationName: "VNCLI - CANG CAT LAI",
		});

		expect(payload.warehouseLocationCode).toBe("02DSEA0");
		expect(payload.warehouseLocationName).toBe(
			"CTY TNHH DỊCH VỤ TIẾP VẬN TOÀN CẦU",
		);
		expect(payload.loadingLocationCode).toBe("VNCLI");
		expect(payload.loadingLocationName).toBe("CANG CAT LAI");
	});

	it("drops inferred transport departure date for A12 and cleans vehicle code", () => {
		const payload = sanitizeFollowUpCdsInfoPayload(
			{
				operationCode: "A12",
				transportDepartureDate: "2026-05-07",
				transportVehicleCode: "VN123 ETA 2026-05-07 POD TIANJIN",
			},
			{ allowTransportDepartureDate: true },
		);

		expect(payload.transportDepartureDate).toBeUndefined();
		expect(payload.transportVehicleCode).toBe("VN123");
	});

	it("keeps method-only transport text as vehicle name, not vehicle code", () => {
		const payload = sanitizeFollowUpCdsInfoPayload({
			transportVehicleCode: "By air",
			transportVehicleName: "By air",
		});

		expect(payload.transportVehicleCode).toBeUndefined();
		expect(payload.transportVehicleName).toBe("By air");
	});
});

describe("buildSyncedFollowUpCdsInfoPayload", () => {
	it("does not derive transport departure date from ETA/ETD", () => {
		const payload = buildSyncedFollowUpCdsInfoPayload({
			etaEtd: "2026-05-07",
			cdsInfo: {
				operationCode: "A12",
			},
		});

		expect(payload.departureArrivalDate).toBe("2026-05-07");
		expect(payload.transportDepartureDate).toBeUndefined();
	});
});
