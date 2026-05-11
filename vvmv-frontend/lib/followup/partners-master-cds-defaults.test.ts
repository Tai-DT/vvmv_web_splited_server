import { describe, expect, it } from "vitest";
import {
	buildMergedPartnerMasterCdsDefaults,
	buildPartnerMasterCdsDefaults,
} from "./partners-master-cds-defaults";

describe("buildPartnerMasterCdsDefaults", () => {
	it("builds local party defaults from partners master data", () => {
		const defaults = buildPartnerMasterCdsDefaults({
			followUp: {
				operationType: "XUAT",
				taxCode: "0312345678",
				companyName: "Fallback Company",
			},
			partner: {
				taxCode: "0312345678",
				fullName: "Cong ty ABC",
				invoiceData:
					"Ten cong ty: Cong ty ABC\nMST: 0312345678\nMa buu chinh: 700000\nDia chi: 123 Nguyen Trai, Q1\nDien thoai: 028 1234 5678",
				maHQ: "02CI",
				warehouse: "Kho ABC",
			},
		});

		expect(defaults).toEqual({
			importerCode: "0312345678",
			importExportUnitName: "Cong ty ABC",
			importerPostalCode: "700000",
			importExportBusinessAddress: "123 Nguyen Trai, Q1",
			importerPhone: "02812345678",
			customsCode: "02CI",
			warehouseLocationName: "Kho ABC",
		});
	});

	it("uses the same local party fields for import declarations", () => {
		const defaults = buildPartnerMasterCdsDefaults({
			followUp: {
				operationType: "NHAP",
				taxCode: "0312345678",
				companyName: "Fallback Company",
			},
			partner: {
				taxCode: "0312345678",
				fullName: "Cong ty ABC",
				invoiceData: null,
				maHQ: null,
				warehouse: null,
			},
		});

		expect(defaults.importerCode).toBe("0312345678");
		expect(defaults.importExportUnitName).toBe("Cong ty ABC");
		expect(defaults.importerPostalCode).toBe("x");
	});

	it("does not build defaults when operation type is unknown", () => {
		expect(
			buildPartnerMasterCdsDefaults({
				followUp: {
					operationType: null,
					taxCode: "0312345678",
					companyName: "Fallback Company",
				},
				partner: {
					taxCode: "0312345678",
					fullName: "Cong ty ABC",
					invoiceData: null,
					maHQ: null,
					warehouse: null,
				},
			}),
		).toEqual({});
	});

	it("merges missing party details from another partner master record", () => {
		const defaults = buildMergedPartnerMasterCdsDefaults({
			preferredSite: "SGN",
			followUp: {
				operationType: "NHAP",
				taxCode: "2780179049",
				companyName: "TNHH MTV Nong San Viet Uc",
			},
			partners: [
				{
					taxCode: "2780179049",
					fullName: "TNHH MTV Nong San Viet Uc",
					invoiceData: null,
					maHQ: null,
					warehouse: null,
					site: "SGN",
					enableCDS: true,
				},
				{
					taxCode: "2780179049",
					fullName: null,
					invoiceData:
						"MST: 2780179049\nMa buu chinh: 700000\nDia chi: 5 Nguyen Van Linh, Q7\nDien thoai: 028 7777 8888",
					maHQ: "02CI",
					warehouse: "Kho Viet Uc",
					site: "HAN",
					enableCDS: false,
				},
			],
		});

		expect(defaults).toEqual({
			importerCode: "2780179049",
			importExportUnitName: "TNHH MTV Nong San Viet Uc",
			importerPostalCode: "700000",
			importExportBusinessAddress: "5 Nguyen Van Linh, Q7",
			importerPhone: "02877778888",
			customsCode: "02CI",
			warehouseLocationName: "Kho Viet Uc",
		});
	});
});
