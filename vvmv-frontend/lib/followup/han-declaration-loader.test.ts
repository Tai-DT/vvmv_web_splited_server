import { describe, expect, it, vi } from "vitest";
import { buildHanDeclarationPrefill } from "./han-declaration-loader";

vi.mock("mssql", () => ({ default: {} }));

describe("HAN declaration loader", () => {
	it("does not fallback export tax destination from final unloading location", () => {
		const prefill = buildHanDeclarationPrefill({
			xOrN: "X",
			customsWarehouseCode: "LB001",
			customsWarehouseName: "Kho ICD Long Binh",
			customsWarehouseCodeV2: "02DSEA0",
			customsWarehouseNameV2: "Kho luu hang VNACCS",
			foreignLocationCode: "JPTYO",
			foreignLocationName: "Tokyo Port",
			taxDestinationLocationCode: null,
		});

		expect(prefill.warehouseLocationCode).toBe("02DSEA0");
		expect(prefill.loadingLocationCode).toBe("LB001");
		expect(prefill.unloadingLocationCode).toBe("JPTYO");
		expect(prefill.taxDestinationLocation).toBeNull();
		expect(prefill.finalDestinationCode).toBeNull();
	});

	it("reads tax destination only from DDS_CONT_TK.MA_DIA_DIEM", () => {
		const prefill = buildHanDeclarationPrefill({
			xOrN: "N",
			customsWarehouseCode: "VNCLI",
			customsWarehouseName: "Cat Lai",
			customsWarehouseCodeV2: "02DSEA0",
			customsWarehouseNameV2: "Kho luu hang VNACCS",
			foreignLocationCode: "HKHKG",
			foreignLocationName: "Hong Kong",
			taxDestinationLocationCode: "BOND01",
		});

		expect(prefill.loadingLocationCode).toBe("HKHKG");
		expect(prefill.unloadingLocationCode).toBe("02DSEA0");
		expect(prefill.taxDestinationLocation).toBe("BOND01");
		expect(prefill.finalDestinationCode).toBe("BOND01");
	});

	it("maps BL_THUE / DAM_BAO bank columns to tax substitute vs guarantee fields", () => {
		const prefill = buildHanDeclarationPrefill({
			taxSubstituteBankCode: "VCB01",
			guaranteeBankCode: "BIDV02",
		});

		expect(prefill.taxSubstituteBankCode).toBe("VCB01");
		expect(prefill.guaranteeBankCode).toBe("BIDV02");
	});

	it("reads package marks and DDS container note into the highlighted fields", () => {
		const prefill = buildHanDeclarationPrefill({
			xOrN: "X",
			packageMarks: "PKG-001",
			note: "Ghi chu container",
		});

		expect(prefill.packageMarks).toBe("PKG-001");
		expect(prefill.note).toBe("Ghi chu container");
	});
});
