import { describe, expect, it } from "vitest";
import {
	getBlockingCdsExportIssues,
	validateCdsForEcusExport,
} from "@/lib/followup/cds-export-validation";

function buildValidExportInput() {
	return {
		operationType: "XUAT",
		cdsInfo: {
			operationCode: "B11",
			customsCode: "02CI",
			transportMethodCode: "9",
			partnerName: "Buyer Sample",
			packageQuantity: 12,
			packageType: "PKG",
			totalInvoiceValue: 12000,
			invoicePriceCondition: "FOB",
			invoiceCurrency: "USD",
			unloadingLocationCode: "VNDEST",
			loadingLocationCode: "VNZZZ",
		},
		cargoList: [
			{
				customCode: "ITEM-001",
				vietnameseName: "Hang mau",
				originalCountry: "VN",
				unit: "PCE",
				qty: 10,
				unitPrice: 12,
			},
		],
	};
}

describe("validateCdsForEcusExport", () => {
	it("does not block export when non-star fields are blank", () => {
		const result = validateCdsForEcusExport(buildValidExportInput());
		const blockingIssues = getBlockingCdsExportIssues(result.issues);

		expect(blockingIssues).toHaveLength(0);
		expect(result.issues).toContainEqual(
			expect.objectContaining({
				path: "cdsInfo.contractDate",
				severity: "warning",
			}),
		);
		expect(result.issues).toContainEqual(
			expect.objectContaining({
				path: "cdsInfo.warehouseLocationCode",
				severity: "warning",
			}),
		);
	});

	it("still blocks export when a red-star field is blank", () => {
		const input = buildValidExportInput();
		const result = validateCdsForEcusExport({
			...input,
			cdsInfo: {
				...input.cdsInfo,
				totalInvoiceValue: null,
			},
		});
		const blockingIssues = getBlockingCdsExportIssues(result.issues);

		expect(blockingIssues).toContainEqual(
			expect.objectContaining({
				path: "cdsInfo.totalInvoiceValue",
				severity: "error",
			}),
		);
	});

	it("does not require cargo custom code for A12 and B11", () => {
		for (const operationCode of ["A12", "B11"]) {
			const input = buildValidExportInput();
			const result = validateCdsForEcusExport({
				...input,
				operationType: operationCode === "A12" ? "NHAP" : "XUAT",
				cdsInfo: {
					...input.cdsInfo,
					operationCode,
				},
				cargoList: input.cargoList.map((row) => ({
					...row,
					customCode: "",
				})),
			});

			expect(result.issues).not.toContainEqual(
				expect.objectContaining({
					path: "cargoList[0].customCode",
				}),
			);
		}
	});

	it("still requires cargo custom code for other operation codes", () => {
		const input = buildValidExportInput();
		const result = validateCdsForEcusExport({
			...input,
			cdsInfo: {
				...input.cdsInfo,
				operationCode: "E42",
			},
			cargoList: input.cargoList.map((row) => ({
				...row,
				customCode: "",
			})),
		});

		expect(getBlockingCdsExportIssues(result.issues)).toContainEqual(
			expect.objectContaining({
				path: "cargoList[0].customCode",
				severity: "error",
			}),
		);
	});

	it("does not validate person organization classification for export operation codes", () => {
		for (const operationCode of ["B11", "E42", "E54"]) {
			const result = validateCdsForEcusExport({
				...buildValidExportInput(),
				cdsInfo: {
					...buildValidExportInput().cdsInfo,
					operationCode,
					personOrganizationClassification: null,
				},
			});

			expect(result.issues).not.toContainEqual(
				expect.objectContaining({
					path: "cdsInfo.personOrganizationClassification",
				}),
			);
		}
	});

	it("requires person organization classification for selected import E operation codes", () => {
		const importE11 = validateCdsForEcusExport({
			...buildValidExportInput(),
			operationType: "NHAP",
			cdsInfo: {
				...buildValidExportInput().cdsInfo,
				operationCode: "E11",
				personOrganizationClassification: null,
			},
		});

		expect(getBlockingCdsExportIssues(importE11.issues)).toContainEqual(
			expect.objectContaining({
				path: "cdsInfo.personOrganizationClassification",
				severity: "error",
			}),
		);
	});

	it("allows 7-character warehouse location codes for export", () => {
		const input = buildValidExportInput();
		const result = validateCdsForEcusExport({
			...input,
			cdsInfo: {
				...input.cdsInfo,
				warehouseLocationCode: "02DSEA0",
			},
		});

		expect(result.issues).not.toContainEqual(
			expect.objectContaining({
				path: "cdsInfo.warehouseLocationCode",
				message: expect.stringContaining("dài hơn"),
			}),
		);
	});

	it("warns when warehouse location codes exceed 7 characters", () => {
		const input = buildValidExportInput();
		const result = validateCdsForEcusExport({
			...input,
			cdsInfo: {
				...input.cdsInfo,
				warehouseLocationCode: "02DSEA0X",
			},
		});

		expect(result.issues).toContainEqual(
			expect.objectContaining({
				path: "cdsInfo.warehouseLocationCode",
				severity: "warning",
				message: expect.stringContaining("dài hơn 7 ký tự"),
			}),
		);
	});

	it("warns when export final destination location is blank", () => {
		const input = buildValidExportInput();
		const result = validateCdsForEcusExport({
			...input,
			cdsInfo: {
				...input.cdsInfo,
				unloadingLocationCode: "",
			},
		});

		expect(result.issues).toContainEqual(
			expect.objectContaining({
				path: "cdsInfo.unloadingLocationCode",
				severity: "warning",
				message: expect.stringContaining("đang trống"),
			}),
		);
	});

	it("validates transport schedule rows that only have a location code", () => {
		const input = buildValidExportInput();
		const result = validateCdsForEcusExport({
			...input,
			cdsInfo: {
				...input.cdsInfo,
				transportSchedules: [{ locationCode: "VNHAN01X" }],
			},
		});

		expect(result.issues).toContainEqual(
			expect.objectContaining({
				path: "cdsInfo.transportSchedules",
				severity: "warning",
				message: expect.stringContaining(
					"ít nhất 1 ngày đến hoặc ngày khởi hành",
				),
			}),
		);
		expect(result.issues).toContainEqual(
			expect.objectContaining({
				path: "cdsInfo.transportSchedules[0].locationCode",
				severity: "warning",
				message: expect.stringContaining("dài hơn 7 ký tự"),
			}),
		);
	});

	it("warns when truck loading container fields exceed HAN limits", () => {
		const input = buildValidExportInput();
		const result = validateCdsForEcusExport({
			...input,
			cdsInfo: {
				...input.cdsInfo,
				truckLoadingLocationCode: "VNHAN01AX.VNHAN02B",
				truckLoadingLocationName: "A".repeat(71),
				truckLoadingLocationAddress: "B".repeat(301),
			},
		});

		expect(result.issues).toContainEqual(
			expect.objectContaining({
				path: "cdsInfo.truckLoadingLocationCode",
				severity: "warning",
				message: expect.stringContaining("dài hơn 8 ký tự"),
			}),
		);
		expect(result.issues).toContainEqual(
			expect.objectContaining({
				path: "cdsInfo.truckLoadingLocationName",
				severity: "warning",
				message: expect.stringContaining("dài hơn 70 ký tự"),
			}),
		);
		expect(result.issues).toContainEqual(
			expect.objectContaining({
				path: "cdsInfo.truckLoadingLocationAddress",
				severity: "warning",
				message: expect.stringContaining("dài hơn 300 ký tự"),
			}),
		);
	});
});
