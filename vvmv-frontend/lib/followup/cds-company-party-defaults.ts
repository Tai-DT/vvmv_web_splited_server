import type { FollowUpCdsInfoRow } from "@/app/(home)/internal/followup/types";
import type { CompanyProfileDefaults } from "@/lib/followup/company-profile-defaults";
import type { PartnerMasterCdsDefaults } from "@/lib/followup/partners-master-cds-defaults";

export type CdsCompanyPartyFieldKey =
	| "importerCode"
	| "importExportUnitName"
	| "importerPostalCode"
	| "importExportBusinessAddress"
	| "importerPhone";

export type CdsCompanyPartyDefaults = Partial<
	Pick<FollowUpCdsInfoRow, CdsCompanyPartyFieldKey>
>;

export type CdsCompanyPartyDefaultWarning = {
	field: CdsCompanyPartyFieldKey;
	label: string;
	currentValue: string | null;
	expectedValue: string;
	message: string;
};

const COMPANY_PARTY_FIELDS = [
	{ field: "importerCode", label: "MST", compareAs: "digits" },
	{ field: "importExportUnitName", label: "Tên công ty", compareAs: "text" },
	{ field: "importerPostalCode", label: "Mã bưu chính", compareAs: "text" },
	{
		field: "importExportBusinessAddress",
		label: "Địa chỉ",
		compareAs: "text",
	},
	{ field: "importerPhone", label: "Điện thoại", compareAs: "digits" },
] as const satisfies ReadonlyArray<{
	field: CdsCompanyPartyFieldKey;
	label: string;
	compareAs: "digits" | "text";
}>;

function cleanText(value: unknown) {
	const text = String(value ?? "")
		.replace(/\s+/g, " ")
		.trim();
	return text || null;
}

function normalizeComparable(value: unknown, compareAs: "digits" | "text") {
	if (compareAs === "digits") {
		return String(value ?? "").replace(/\D+/g, "");
	}

	return String(value ?? "")
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase();
}

function isPlaceholderPostalCode(value: unknown): boolean {
	return normalizeComparable(value, "text") === "x";
}

function shouldUseFallbackCompanyPartyDefault(
	field: CdsCompanyPartyFieldKey,
	currentValue: unknown,
	fallbackValue: unknown,
) {
	if (!cleanText(fallbackValue)) {
		return false;
	}

	if (!cleanText(currentValue)) {
		return true;
	}

	return (
		field === "importerPostalCode" &&
		isPlaceholderPostalCode(currentValue) &&
		!isPlaceholderPostalCode(fallbackValue)
	);
}

export function buildCdsCompanyPartyDefaultsFromCompanyProfile(
	companyProfile?: Partial<CompanyProfileDefaults> | null,
): CdsCompanyPartyDefaults {
	if (!companyProfile) {
		return {};
	}

	return {
		importerCode: cleanText(companyProfile.taxCode),
		importExportUnitName: cleanText(companyProfile.companyName),
		importerPostalCode: cleanText(companyProfile.importerPostalCode),
		importExportBusinessAddress: cleanText(
			companyProfile.importExportBusinessAddress,
		),
		importerPhone: cleanText(companyProfile.importerPhone),
	};
}

export function buildCdsCompanyPartyDefaultsFromPartnerMaster(
	defaults?: PartnerMasterCdsDefaults | null,
): CdsCompanyPartyDefaults {
	if (!defaults) {
		return {};
	}

	return {
		importerCode: cleanText(defaults.importerCode),
		importExportUnitName: cleanText(defaults.importExportUnitName),
		importerPostalCode: cleanText(defaults.importerPostalCode),
		importExportBusinessAddress: cleanText(
			defaults.importExportBusinessAddress,
		),
		importerPhone: cleanText(defaults.importerPhone),
	};
}

export function mergeCdsCompanyPartyDefaults(
	primary: CdsCompanyPartyDefaults | null | undefined,
	fallback: CdsCompanyPartyDefaults | null | undefined,
): CdsCompanyPartyDefaults {
	const merged: CdsCompanyPartyDefaults = { ...(primary ?? {}) };

	COMPANY_PARTY_FIELDS.forEach(({ field }) => {
		if (
			shouldUseFallbackCompanyPartyDefault(
				field,
				merged[field],
				fallback?.[field],
			)
		) {
			merged[field] = cleanText(fallback?.[field]);
		}
	});

	return merged;
}

export function buildCdsCompanyPartyDefaultWarnings(
	cdsInfo: Partial<FollowUpCdsInfoRow>,
	defaults: CdsCompanyPartyDefaults | null | undefined,
): CdsCompanyPartyDefaultWarning[] {
	if (!defaults) {
		return [];
	}

	return COMPANY_PARTY_FIELDS.flatMap((config) => {
		const expectedValue = cleanText(defaults[config.field]);
		if (!expectedValue) {
			return [];
		}

		const currentValue = cleanText(cdsInfo[config.field]);
		const currentComparable = normalizeComparable(
			currentValue,
			config.compareAs,
		);
		const expectedComparable = normalizeComparable(
			expectedValue,
			config.compareAs,
		);

		if (currentComparable && currentComparable === expectedComparable) {
			return [];
		}

		const message = currentValue
			? `${config.label} trên form khác dữ liệu chuẩn theo MST. Khi truyền qua app sẽ ưu tiên giữ giá trị trên form hiện tại.`
			: `${config.label} đang trống trên form. Khi truyền qua app sẽ dùng dữ liệu chuẩn theo MST: "${expectedValue}".`;

		return [
			{
				field: config.field,
				label: config.label,
				currentValue,
				expectedValue,
				message,
			},
		];
	});
}

export function applyCdsCompanyPartyDefaults(
	cdsInfo: Partial<FollowUpCdsInfoRow>,
	defaults: CdsCompanyPartyDefaults | null | undefined,
) {
	const next = { ...cdsInfo };

	if (!defaults) {
		return next;
	}

	// Khác với mergeCdsCompanyPartyDefaults (chỉ bù ô trống khi gộp hai nguồn
	// default), hàm này ghi đè dữ liệu người dùng nhập bằng thông tin doanh
	// nghiệp chuẩn ngay trước khi đăng ký sang HAN. Chênh lệch đã được
	// buildCdsCompanyPartyDefaultWarnings báo cho người dùng trước đó.
	for (const config of COMPANY_PARTY_FIELDS) {
		const defaultValue = cleanText(defaults[config.field]);
		if (defaultValue) {
			next[config.field] = defaultValue;
		}
	}

	return next;
}
