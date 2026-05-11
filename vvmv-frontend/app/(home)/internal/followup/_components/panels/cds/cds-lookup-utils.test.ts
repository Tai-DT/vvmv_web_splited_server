import { describe, expect, it } from "vitest";
import {
	buildLookupDialogOptions,
	dedupeSelectOptions,
	getFirstSelectedTruckLoadingLocationAddress,
	getFirstSelectedTruckLoadingLocationName,
} from "./cds-lookup-utils";

describe("cds lookup utils", () => {
	it("preserves address metadata for location-table lookup options", () => {
		const [option] = buildLookupDialogOptions("truckLoadingLocationCode", [
			{
				value: "18A3OZZ",
				label: "18A3OZZ - LO I3",
				meta: {
					address: "LO I3, KCN DAI DONG-HOAN SON",
				},
			},
		]);

		expect(option?.meta?.address).toBe("LO I3, KCN DAI DONG-HOAN SON");
		expect(option?.searchText).toContain("lo i3, kcn dai dong-hoan son");
	});

	it("keeps metadata when deduping select options", () => {
		const [option] = dedupeSelectOptions([
			{
				value: "18A3OZZ",
				label: "18A3OZZ",
				meta: {
					address: "LO I3, KCN DAI DONG-HOAN SON",
				},
			},
			{
				value: "18A3OZZ",
				label: "18A3OZZ - LO I3",
			},
		]);

		expect(option).toMatchObject({
			value: "18A3OZZ",
			label: "18A3OZZ - LO I3",
			meta: {
				address: "LO I3, KCN DAI DONG-HOAN SON",
			},
		});
	});

	it("returns the address for the first selected truck loading code", () => {
		const address = getFirstSelectedTruckLoadingLocationAddress(
			["01FIRST", "02LAST"],
			[
				{
					value: "01FIRST",
					label: "01FIRST - First location",
					meta: { address: "Dia chi cua ma dau tien" },
				},
				{
					value: "02LAST",
					label: "02LAST - Last location",
					meta: { address: "Dia chi cua ma cuoi" },
				},
			],
		);

		expect(address).toBe("Dia chi cua ma dau tien");
	});

	it("does not fall back to a later truck loading code address", () => {
		const address = getFirstSelectedTruckLoadingLocationAddress(
			["01FIRST", "02LAST"],
			[
				{
					value: "01FIRST",
					label: "01FIRST - First location",
				},
				{
					value: "02LAST",
					label: "02LAST - Last location",
					meta: { address: "Dia chi cua ma cuoi" },
				},
			],
		);

		expect(address).toBeNull();
	});

	it("normalizes truck loading option values before matching address", () => {
		const address = getFirstSelectedTruckLoadingLocationAddress(
			["01first - First location"],
			[
				{
					value: "01FIRST - First location",
					label: "01FIRST - First location",
					meta: { address: "Dia chi da chuan hoa" },
				},
			],
		);

		expect(address).toBe("Dia chi da chuan hoa");
	});

	it("returns the name for the first selected truck loading code", () => {
		const name = getFirstSelectedTruckLoadingLocationName(
			["01FIRST", "02LAST"],
			[
				{
					value: "01FIRST",
					label: "01FIRST - First location",
				},
				{
					value: "02LAST",
					label: "02LAST - Last location",
				},
			],
		);

		expect(name).toBe("First location");
	});

	it("does not use a later truck loading code name", () => {
		const name = getFirstSelectedTruckLoadingLocationName(
			["01FIRST", "02LAST"],
			[
				{
					value: "02LAST",
					label: "02LAST - Last location",
				},
			],
		);

		expect(name).toBeNull();
	});

	it("prefers the fallback name for the first selected truck loading code", () => {
		const name = getFirstSelectedTruckLoadingLocationName(
			["01FIRST", "02LAST"],
			[
				{
					value: "01FIRST",
					label: "01FIRST - First location",
				},
			],
			["Ten da luu cua ma dau", "Ten ma sau"],
		);

		expect(name).toBe("Ten da luu cua ma dau");
	});
});
