export type CompanyProfileDefaults = {
	taxCode: string;
	companyName: string;
	importerPostalCode: string | null;
	importExportBusinessAddress: string | null;
	importerPhone: string | null;
	exporterPostalCode: string | null;
	partnerAddress1: string | null;
	partnerAddress2: string | null;
	partnerAddress3: string | null;
	partnerAddress4: string | null;
	customsCode?: string | null;
	warehouseLocationName?: string | null;
};

const COMPANY_PROFILE_DEFAULTS_BY_TAX_CODE: Record<
	string,
	CompanyProfileDefaults
> = {
	"2300674028": {
		taxCode: "2300674028",
		companyName: "Công ty trách nhiệm hữu hạn Unigen Việt Nam Hà Nội",
		importerPostalCode: "x",
		importExportBusinessAddress:
			"Số 11, đường 8, Khu công nghiệp đô thị và dịch vụ VSIP Bắc Ninh, Phường Từ Sơn, tỉnh Bắc Ninh, Việt Nam",
		importerPhone: "02223765438",
		exporterPostalCode: "x",
		partnerAddress1:
			"Số 11, đường 8, Khu công nghiệp đô thị và dịch vụ VSIP Bắc Ninh, Phường Từ Sơn, tỉnh Bắc Ninh, Việt Nam",
		partnerAddress2: null,
		partnerAddress3: null,
		partnerAddress4: null,
	},
};

function normalizeTaxCode(value: unknown) {
	const digits = String(value ?? "").replace(/\D+/g, "");
	return digits || null;
}

function normalizeText(value: unknown) {
	const text = String(value ?? "").trim();
	return text || null;
}

function normalizeName(value: unknown) {
	return String(value ?? "")
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase();
}

const COMPANY_PROFILE_DEFAULTS_BY_NAME = Object.fromEntries(
	Object.values(COMPANY_PROFILE_DEFAULTS_BY_TAX_CODE).map((profile) => [
		normalizeName(profile.companyName),
		profile,
	]),
) as Record<string, CompanyProfileDefaults>;

export function getCompanyProfileDefaults(args: {
	taxCode?: unknown;
	companyName?: unknown;
}) {
	const normalizedTaxCode = normalizeTaxCode(args.taxCode);
	if (
		normalizedTaxCode &&
		COMPANY_PROFILE_DEFAULTS_BY_TAX_CODE[normalizedTaxCode]
	) {
		return COMPANY_PROFILE_DEFAULTS_BY_TAX_CODE[normalizedTaxCode];
	}

	const normalizedCompanyName = normalizeName(args.companyName);
	if (
		normalizedCompanyName &&
		COMPANY_PROFILE_DEFAULTS_BY_NAME[normalizedCompanyName]
	) {
		return COMPANY_PROFILE_DEFAULTS_BY_NAME[normalizedCompanyName];
	}

	return null;
}

export function mergeCompanyProfileDefaults(args: {
	taxCode?: unknown;
	companyName?: unknown;
	companyProfile?: Partial<CompanyProfileDefaults> | null;
}) {
	const sourceProfile = args.companyProfile ?? null;
	const staticProfile = getCompanyProfileDefaults({
		taxCode: normalizeText(sourceProfile?.taxCode) ?? args.taxCode,
		companyName: normalizeText(sourceProfile?.companyName) ?? args.companyName,
	});

	if (!sourceProfile && !staticProfile) {
		return null;
	}

	const taxCode =
		normalizeText(sourceProfile?.taxCode) ??
		staticProfile?.taxCode ??
		normalizeTaxCode(args.taxCode) ??
		"";
	const companyName =
		normalizeText(sourceProfile?.companyName) ??
		staticProfile?.companyName ??
		normalizeText(args.companyName) ??
		"";

	if (!taxCode && !companyName) {
		return null;
	}

	return {
		taxCode,
		companyName,
		importerPostalCode:
			normalizeText(sourceProfile?.importerPostalCode) ??
			staticProfile?.importerPostalCode ??
			null,
		importExportBusinessAddress:
			normalizeText(sourceProfile?.importExportBusinessAddress) ??
			staticProfile?.importExportBusinessAddress ??
			null,
		importerPhone:
			normalizeText(sourceProfile?.importerPhone) ??
			staticProfile?.importerPhone ??
			null,
		exporterPostalCode:
			normalizeText(sourceProfile?.exporterPostalCode) ??
			staticProfile?.exporterPostalCode ??
			null,
		partnerAddress1:
			normalizeText(sourceProfile?.partnerAddress1) ??
			staticProfile?.partnerAddress1 ??
			null,
		partnerAddress2:
			normalizeText(sourceProfile?.partnerAddress2) ??
			staticProfile?.partnerAddress2 ??
			null,
		partnerAddress3:
			normalizeText(sourceProfile?.partnerAddress3) ??
			staticProfile?.partnerAddress3 ??
			null,
		partnerAddress4:
			normalizeText(sourceProfile?.partnerAddress4) ??
			staticProfile?.partnerAddress4 ??
			null,
		customsCode:
			normalizeText(sourceProfile?.customsCode) ??
			staticProfile?.customsCode ??
			null,
		warehouseLocationName:
			normalizeText(sourceProfile?.warehouseLocationName) ??
			staticProfile?.warehouseLocationName ??
			null,
	} satisfies CompanyProfileDefaults;
}
