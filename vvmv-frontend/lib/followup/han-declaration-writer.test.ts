import { describe, expect, it, vi } from "vitest";
import {
	buildCargoRowRecord,
	buildDdsContTkRecord,
	buildHeaderRecord,
	buildVnaccs2Record,
	buildVnaccsRecord,
	shouldWriteDdsContTkRecord,
} from "./han-declaration-writer";

vi.mock("mssql", () => ({ default: {} }));

describe("HAN declaration header writer", () => {
	it("writes export loading location to MA_CK when VNACCS warehouse code has 7 characters", () => {
		const record = buildHeaderRecord({
			cdsInfo: {
				operationCode: "B11",
				warehouseLocationCode: "02DSEA0",
				warehouseLocationName: "Kho luu hang VNACCS",
				loadingLocationCode: "VNZZZ",
				loadingLocationName: "UNKNOWN",
				unloadingLocationCode: "VNDEST",
				unloadingLocationName: "Final destination",
			},
			operationType: "XUAT",
			containerNumbers: [],
		});

		expect(record.MA_CK).toBe("VNZZZ");
		expect(record.TEN_CK).toBe("UNKNOWN");
		expect(record.MA_CANGNN).toBe("VNDEST");
	});

	it("uses entrusted exporter name as a fallback for HAN entrusted party name", () => {
		const record = buildHeaderRecord({
			cdsInfo: {
				operationCode: "A11",
				entrustedExporterName: "Exporter entrusted party",
			},
			operationType: "NHAP",
			containerNumbers: [],
		});

		expect(record._TEN_DVUT).toBe("Exporter entrusted party");
	});

	it("keeps package marks blank on export HAN header", () => {
		const record = buildHeaderRecord({
			cdsInfo: {
				packageMarks: "PKG-001",
			},
			operationType: "XUAT",
			containerNumbers: [],
		});

		expect(record.KY_HIEU_SO_HIEU).toBeNull();
	});

	it("keeps air transport vehicle code blank on export HAN header", () => {
		const record = buildHeaderRecord({
			cdsInfo: {
				transportMethodCode: "1",
				transportVehicleCode: "MH0767",
			},
			operationType: "XUAT",
			containerNumbers: [],
		});

		expect(record.MA_PTVT).toBeNull();
	});

	it("does not fallback HAN gross weight unit to package units", () => {
		const record = buildHeaderRecord({
			cdsInfo: {
				weightUnit: "PR - Đôi/cặp",
			},
			followUpSummary: {
				unit: "PR",
			},
			operationType: "XUAT",
			containerNumbers: [],
		});

		expect(record.DVT_TR_LUONG).toBe("KGM");
	});

	it("preserves valid HAN gross weight units", () => {
		const record = buildHeaderRecord({
			cdsInfo: {
				weightUnit: "TNE - METRIC-TONS",
			},
			followUpSummary: {
				unit: "PR",
			},
			operationType: "XUAT",
			containerNumbers: [],
		});

		expect(record.DVT_TR_LUONG).toBe("TNE");
	});
});

describe("HAN declaration DDS writer", () => {
	it("writes import tax destination and arrival from explicit CDS fields", () => {
		const record = buildDdsContTkRecord({
			declarationId: 123,
			cdsInfo: {
				customsCode: "02CI",
				operationCode: "A11",
				transportMethodCode: "1",
				taxDestinationLocation: "bond01",
				estimatedArrivalAtDestinationDate: "2026-05-03",
				warehouseLocationCode: "WRONG1",
				customsWarehouseCode: "WRONG2",
			},
			operationType: "NHAP",
			declarationNumber: null,
			companyTaxCode: "0312345678",
		});

		expect(record.MA_DIA_DIEM).toBe("BOND01");
		expect(record.DINH_DANH_HANG_HOA).toBeNull();
		expect(record.NGAY_TAU_DEN).toBeInstanceOf(Date);
		expect((record.NGAY_TAU_DEN as Date).toISOString().slice(0, 10)).toBe(
			"2026-05-03",
		);
	});

	it("writes DDS goods identity and supervision customs code", () => {
		const record = buildDdsContTkRecord({
			declarationId: 123,
			cdsInfo: {
				customsCode: "02CI",
				operationCode: "A11",
				transportMethodCode: "1",
				taxDestinationLocation: "01DDEC1",
				billOfLading: "BL-001",
				// Goods identity is only transmitted when supervision is enabled.
				seaportSupervisionEnabled: true,
			},
			operationType: "NHAP",
			declarationNumber: null,
			companyTaxCode: "0312345678",
			supervisionCustomsCode: "01dd",
			hasContainers: true,
		});

		expect(record.DINH_DANH_HANG_HOA).toBe("BL-001");
		expect(record.MA_HQ_GIAMSAT).toBe("01DD");
		expect(record.isContainer).toBe(1);
	});

	it("writes CDS note to DDS container note", () => {
		const record = buildDdsContTkRecord({
			declarationId: 123,
			cdsInfo: {
				note: "Ghi chu container",
			},
			operationType: "XUAT",
			declarationNumber: null,
			companyTaxCode: "0312345678",
		});

		expect(record.NOTE).toBe("Ghi chu container");
	});

	it("does not fallback import DDS destination to warehouse fields", () => {
		const record = buildDdsContTkRecord({
			declarationId: 123,
			cdsInfo: {
				warehouseLocationCode: "WARE01",
				customsWarehouseCode: "CUST01",
			},
			operationType: "NHAP",
			declarationNumber: null,
			companyTaxCode: "0312345678",
		});

		expect(record.MA_DIA_DIEM).toBeNull();
		expect(record.NGAY_TAU_DEN).toBeNull();
	});

	it("does not fallback import DDS arrival date when it is blank", () => {
		const record = buildDdsContTkRecord({
			declarationId: 123,
			cdsInfo: {
				taxDestinationLocation: "BOND01",
				departureArrivalDate: "2026-05-09",
			},
			operationType: "NHAP",
			declarationNumber: null,
			companyTaxCode: "0312345678",
		});

		expect(record.MA_DIA_DIEM).toBe("BOND01");
		expect(record.NGAY_TAU_DEN).toBeNull();
	});

	it("creates import DDS rows without containers only for explicit DDS fields", () => {
		expect(
			shouldWriteDdsContTkRecord({
				cdsInfo: { taxDestinationLocation: "BOND01" },
				containerNumbers: [],
				operationType: "NHAP",
			}),
		).toBe(true);

		expect(
			shouldWriteDdsContTkRecord({
				cdsInfo: { estimatedArrivalAtDestinationDate: "2026-05-03" },
				containerNumbers: [],
				operationType: "NHAP",
			}),
		).toBe(true);

		expect(
			shouldWriteDdsContTkRecord({
				cdsInfo: { warehouseLocationCode: "WARE01" },
				containerNumbers: [],
				operationType: "NHAP",
			}),
		).toBe(false);
	});
});

describe("HAN declaration VNACCS writer", () => {
	it("does not write re-export deadline into the HAN char flag column", () => {
		const record = buildVnaccsRecord({
			cdsInfo: {
				reExportDeadline: "2026-05-30",
			},
			containerNumbers: [],
			operationType: "NHAP",
		});

		expect(record).not.toHaveProperty("HET_HAN_TAM_NHAP");
	});

	it("writes truck loading location slots from CDS container grid fields", () => {
		const record = buildVnaccsRecord({
			cdsInfo: {
				truckLoadingLocationCode: "VNHAN01A - Kho 1.VNHAN02B - Kho 2",
				truckLoadingLocationName: "Kho 1, Kho 2",
				truckLoadingLocationAddress: "Dia chi xep hang",
			},
			containerNumbers: [],
			operationType: "XUAT",
		});

		expect(record.MA_DIEM_XEP_HANG_LEN_XE).toBe("VNHAN01A");
		expect(record.MA_DIEM_XEP_HANG_LEN_XE2).toBe("VNHAN02B");
		expect(record.MA_DIEM_XEP_HANG_LEN_XE3).toBeNull();
		expect(record.TEN_DIEM_XEP_HANG_LEN_XE).toBe("Kho 1, Kho 2");
		expect(record.DIA_CHI_DIEM_XEP_HANG_LEN_XE).toBe("Dia chi xep hang");
	});

	it("writes only the truck loading location code and clears blank address", () => {
		const record = buildVnaccsRecord({
			cdsInfo: {
				truckLoadingLocationCode: "VNAPIT - LOI MO A PA CHAI",
				truckLoadingLocationName: "LOI MO A PA CHAI",
				truckLoadingLocationAddress: "",
			},
			containerNumbers: [],
			operationType: "XUAT",
		});

		expect(record.MA_DIEM_XEP_HANG_LEN_XE).toBe("VNAPIT");
		expect(record.MA_DIEM_XEP_HANG_LEN_XE2).toBeNull();
		expect(record.TEN_DIEM_XEP_HANG_LEN_XE).toBe("LOI MO A PA CHAI");
		expect(record.DIA_CHI_DIEM_XEP_HANG_LEN_XE).toBeNull();
	});

	it("does not write valuation declaration type for export VNACCS records", () => {
		const record = buildVnaccsRecord({
			cdsInfo: {
				valuationDeclarationTypeCode: "5",
			},
			containerNumbers: [],
			operationType: "XUAT",
		});

		expect(record.MA_PL_NOP_THUE).toBeNull();
	});

	it("writes taxSubstituteBankCode to BL_THUE_MA_NG_HANG in VNACCS2", () => {
		const record = buildVnaccs2Record({
			taxSubstituteBankCode: "vcb01",
		});

		expect(record.BL_THUE_MA_NG_HANG).toBe("VCB01");
	});

	it("writes guaranteeBankCode to DAM_BAO_MA_NG_HANG on header", () => {
		const record = buildHeaderRecord({
			cdsInfo: {
				operationCode: "B11",
				customsCode: "02CI",
				guaranteeBankCode: "acb",
			},
			operationType: "NHAP",
			containerNumbers: [],
		});

		expect(record.DAM_BAO_MA_NG_HANG).toBe("ACB");
	});

	it("writes bill item slots to VNACCS2 airway bill columns", () => {
		const record = buildVnaccs2Record({
			billItems: [
				{
					billNumber: "HAWB-1",
					billDate: "2026-04-25",
					hawbNumber: "MAWB-1",
					mawbYear: "2026",
				},
				{
					billNumber: "HAWB-2",
					billDate: "2026-04-26",
					hawbNumber: "MAWB-2",
					mawbYear: "2027",
				},
			],
		});

		expect(record.VAN_DON2).toBe("HAWB-2");
		expect(record.VAN_DON_MAWB).toBe("MAWB-1");
		expect(record.VAN_DON_MAWB2).toBe("MAWB-2");
		expect((record.NGAY_VAN_DON as Date).toISOString().slice(0, 10)).toBe(
			"2026-04-25",
		);
		expect((record.NGAY_VAN_DON2 as Date).toISOString().slice(0, 10)).toBe(
			"2026-04-26",
		);
		expect(record.VAN_DON_NAM).toBe(2026);
		expect(record.VAN_DON_NAM2).toBe(2027);
	});
});

describe("HAN declaration cargo writer", () => {
	it("writes optional HAN cargo columns that have CDS app fields", () => {
		const record = buildCargoRowRecord(
			{
				unitPrice: 12.5,
				imExDutyExemptionCode: " mn ",
				qty2: 3,
				unit2: "kgm",
				unit: "kgm",
			},
			123,
			1,
			{
				operationCode: "a11",
				customsCode: "02ci",
				invoiceCurrency: "usd",
				taxableValueCurrencyCode: "vnd",
			},
		);

		expect(record.MA_LH).toBe("A11");
		expect(record.MA_HQ).toBe("02CI");
		expect(record.MA_NT_DGIA_HDTM).toBe("USD");
		expect(record.DVT_DGIA_HDTM).toBe("KGM");
		expect(record.MA_NT_DGIA_TT).toBe("VND");
		expect(record.MA_NT_TRIGIA_TT_S).toBe("VND");
		expect(record.DVT_DGIA_TT).toBe("KGM");
		expect(record.DONGIA_HTS).toBe(12.5);
		expect(record.MIENTHUE_MA).toBe("MN");
		expect(record.LUONG2).toBe(3);
		expect(record.MA_DVT2).toBe("KGM");
	});
});
