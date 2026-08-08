import { describe, expect, it } from "vitest";
import {
	buildCdsPartnerAddressFieldChangePatch,
	CDS_PARTNER_ADDRESS_LINE_MAX_LENGTH,
	normalizeCdsPartnerAddressFields,
	splitCdsPartnerAddressText,
} from "./cds-partner-address";

function expectAddressLinesWithinLimit(
	lines: Array<string | null | undefined>,
) {
	lines
		.filter((line): line is string => !!line)
		.forEach((line) => {
			expect(Array.from(line).length).toBeLessThanOrEqual(
				CDS_PARTNER_ADDRESS_LINE_MAX_LENGTH,
			);
		});
}

describe("CDS partner address helpers", () => {
	it("splits a long exporter address into up to four VNACCS address lines", () => {
		const lines = splitCdsPartnerAddressText(
			"Số 11, đường 8, Khu công nghiệp đô thị và dịch vụ VSIP Bắc Ninh, Phường Từ Sơn, tỉnh Bắc Ninh, Việt Nam",
		);

		expect(lines).toEqual([
			"Số 11, đường 8,",
			"Khu công nghiệp đô thị và dịch vụ VSIP Bắc Ninh,",
			"Phường Từ Sơn, tỉnh Bắc Ninh, Việt Nam",
		]);
		expectAddressLinesWithinLimit(lines);
	});

	it("falls back to word splitting when an address segment is longer than one app line", () => {
		const lines = splitCdsPartnerAddressText(
			"Factory Building A Very Long Industrial Technology Manufacturing Zone Without Good Comma, Bac Ninh, Viet Nam",
		);

		expect(lines.length).toBeGreaterThan(1);
		expect(lines[0]).toBe("Factory Building A Very Long Industrial Technology");
		expectAddressLinesWithinLimit(lines);
	});

	it("keeps already valid address lines in their original address boxes", () => {
		const fields = normalizeCdsPartnerAddressFields({
			partnerAddress2: "Tokyo second address line",
		});

		expect(fields).toEqual({
			partnerAddress1: null,
			partnerAddress2: "Tokyo second address line",
			partnerAddress3: null,
			partnerAddress4: null,
		});
	});

	it("reflows address fields when one field exceeds the app character limit", () => {
		const fields = normalizeCdsPartnerAddressFields({
			partnerAddress1:
				"No. 11, Road 8, VSIP Bac Ninh Industrial Urban And Service Park",
			partnerAddress2: "Tu Son, Bac Ninh, Viet Nam",
		});

		expect(fields.partnerAddress1).toBeTruthy();
		expect(fields.partnerAddress2).toBeTruthy();
		expectAddressLinesWithinLimit([
			fields.partnerAddress1,
			fields.partnerAddress2,
			fields.partnerAddress3,
			fields.partnerAddress4,
		]);
	});

	it("keeps every character when reflowing four full-width lines loaded from HAN", () => {
		// Cột HAN VNACCS2.DIA_CHI_DT1..DT4 là NVARCHAR(50). Mở tờ khai có đủ bốn
		// dòng sát bề rộng cột rồi lưu lại không được làm rơi ký tự nào — trước đây
		// giới hạn web hẹp hơn cột nên tỉnh, quốc gia, điện thoại, fax và mã bưu
		// chính bị cắt mất trong lúc gộp-chia lại.
		const fromHan = {
			partnerAddress1: "SAMSUNG ELECTRONICS VIETNAM CO LTD, YEN PHONG",
			partnerAddress2: "INDUSTRIAL PARK, YEN TRUNG COMMUNE, YEN PHONG",
			partnerAddress3: "DISTRICT, BAC NINH PROVINCE, VIETNAM, TEL 0241",
			partnerAddress4: "3939000, FAX 02413939001, POSTCODE 790000",
		};

		const fields = normalizeCdsPartnerAddressFields(fromHan);
		const lines = [
			fields.partnerAddress1,
			fields.partnerAddress2,
			fields.partnerAddress3,
			fields.partnerAddress4,
		];

		expectAddressLinesWithinLimit(lines);

		const wordsBefore = Object.values(fromHan)
			.join(" ")
			.split(/[\s,]+/);
		const textAfter = lines.filter(Boolean).join(" ");
		for (const word of wordsBefore) {
			expect(textAfter).toContain(word);
		}
	});

	it("splits a pasted long value from the active address field onward", () => {
		const patch = buildCdsPartnerAddressFieldChangePatch(
			"partnerAddress2",
			"12345678901234567890123456789012345678901234567890 Extra address details",
		);

		expect(patch.partnerAddress1).toBeUndefined();
		expect(patch.partnerAddress2).toHaveLength(
			CDS_PARTNER_ADDRESS_LINE_MAX_LENGTH,
		);
		expect(patch.partnerAddress3).toBe("Extra address details");
		expectAddressLinesWithinLimit([
			patch.partnerAddress2,
			patch.partnerAddress3,
			patch.partnerAddress4,
		]);
	});
});
