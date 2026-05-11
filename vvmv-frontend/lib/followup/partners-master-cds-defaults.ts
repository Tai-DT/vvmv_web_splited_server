export type PartnerMasterDataCdsSource = {
	taxCode?: string | null;
	fullName?: string | null;
	invoiceData?: string | null;
	invoiceCompanyName?: string | null;
	invoiceAddress?: string | null;
	invoicePostalCode?: string | null;
	invoicePhone?: string | null;
	maHQ?: string | null;
	warehouse?: string | null;
	site?: string | null;
	enableCDS?: boolean | null;
};

export type FollowUpCdsDefaultSource = {
	operationType?: string | null;
	taxCode?: string | null;
	companyName?: string | null;
};

export type PartnerMasterCdsDefaults = {
	importerCode?: string | null;
	importExportUnitName?: string | null;
	importerPostalCode?: string | null;
	importExportBusinessAddress?: string | null;
	importerPhone?: string | null;
	customsCode?: string | null;
	warehouseLocationName?: string | null;
};

const ADDRESS_LABEL_PATTERN =
	/^(?:dia\s*chi|địa\s*chỉ|address|addr)\s*[:：-]\s*(.+)$/i;
const COMPANY_NAME_LABEL_PATTERN =
	/^(?:ten\s*(?:cong\s*ty|cty|don\s*vi)|tên\s*(?:công\s*ty|cty|đơn\s*vị)|company(?:\s*name)?|name)\s*[:：-]\s*(.+)$/i;
const PHONE_LABEL_PATTERN =
	/^(?:dien\s*thoai|điện\s*thoại|phone|tel|telephone|sdt|sđt|so\s*dien\s*thoai|số\s*điện\s*thoại)\s*[:：-]\s*(.+)$/i;
const POSTAL_CODE_LABEL_PATTERN =
	/^(?:ma\s*buu\s*chinh|mã\s*bưu\s*chính|postal(?:\s*code)?|zip(?:\s*code)?|postcode)\s*[:：-]\s*(.+)$/i;
const TAX_CODE_LABEL_PATTERN =
	/^(?:mst|ma\s*so\s*thue|mã\s*số\s*thuế|tax\s*(?:code|id|number)?|taxcode)\s*[:：-]?\s*(.+)$/i;

function cleanText(value: unknown): string | null {
	const text = String(value ?? "")
		.replace(/\s+/g, " ")
		.trim();

	return text || null;
}

function normalizeComparable(value: unknown): string {
	return String(value ?? "")
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase();
}

function normalizeTaxComparable(value: unknown): string {
	return String(value ?? "").replace(/\D+/g, "");
}

function getInvoiceLines(invoiceData?: string | null): string[] {
	return String(invoiceData ?? "")
		.split(/\r?\n|;/)
		.map((line) => cleanText(line))
		.filter((line): line is string => Boolean(line));
}

function getLabeledValue(lines: string[], pattern: RegExp): string | null {
	for (const line of lines) {
		const match = line.match(pattern);
		const value = cleanText(match?.[1]);
		if (value) {
			return value;
		}
	}

	return null;
}

function isTaxLine(line: string, taxCode?: string | null): boolean {
	if (TAX_CODE_LABEL_PATTERN.test(line)) {
		return true;
	}

	const normalizedTaxCode = normalizeTaxComparable(taxCode);
	return (
		Boolean(normalizedTaxCode) &&
		normalizeTaxComparable(line).includes(normalizedTaxCode)
	);
}

function getInvoiceAddress(
	invoiceData?: string | null,
	options: { companyName?: string | null; taxCode?: string | null } = {},
): string | null {
	const lines = getInvoiceLines(invoiceData);
	const labeledAddress = getLabeledValue(lines, ADDRESS_LABEL_PATTERN);
	if (labeledAddress) {
		return labeledAddress;
	}

	if (lines.length <= 1) {
		return null;
	}

	const normalizedCompanyName = normalizeComparable(options.companyName);
	const candidateLines = lines.filter((line) => {
		if (isTaxLine(line, options.taxCode)) {
			return false;
		}

		if (
			normalizedCompanyName &&
			normalizeComparable(line) === normalizedCompanyName
		) {
			return false;
		}

		if (
			COMPANY_NAME_LABEL_PATTERN.test(line) ||
			ADDRESS_LABEL_PATTERN.test(line)
		) {
			return false;
		}

		return true;
	});

	return cleanText(candidateLines.join(", "));
}

function getInvoiceCompanyName(invoiceData?: string | null): string | null {
	return getLabeledValue(
		getInvoiceLines(invoiceData),
		COMPANY_NAME_LABEL_PATTERN,
	);
}

function getInvoicePhone(invoiceData?: string | null): string | null {
	const value = getLabeledValue(
		getInvoiceLines(invoiceData),
		PHONE_LABEL_PATTERN,
	);
	if (!value) {
		return null;
	}

	const digits = value.replace(/\D+/g, "");
	return digits || value;
}

function getInvoicePostalCode(invoiceData?: string | null): string | null {
	return getLabeledValue(
		getInvoiceLines(invoiceData),
		POSTAL_CODE_LABEL_PATTERN,
	);
}

export function parsePartnerInvoiceData({
	invoiceData,
	companyName,
	taxCode,
}: {
	invoiceData?: string | null;
	companyName?: string | null;
	taxCode?: string | null;
}) {
	const invoiceCompanyName = getInvoiceCompanyName(invoiceData);
	const resolvedCompanyName = cleanText(companyName) ?? invoiceCompanyName;

	return {
		invoiceCompanyName,
		invoiceAddress: getInvoiceAddress(invoiceData, {
			companyName: resolvedCompanyName,
			taxCode,
		}),
		invoicePostalCode: getInvoicePostalCode(invoiceData),
		invoicePhone: getInvoicePhone(invoiceData),
	};
}

function hasUsefulPartyValue(value: unknown): boolean {
	return cleanText(value) !== null;
}

function isPlaceholderPostalCode(value: unknown): boolean {
	return normalizeComparable(value) === "x";
}

function shouldReplaceMergedDefault(
	field: keyof PartnerMasterCdsDefaults,
	currentValue: unknown,
	nextValue: unknown,
) {
	if (!hasUsefulPartyValue(nextValue)) {
		return false;
	}

	if (!hasUsefulPartyValue(currentValue)) {
		return true;
	}

	return (
		field === "importerPostalCode" &&
		isPlaceholderPostalCode(currentValue) &&
		!isPlaceholderPostalCode(nextValue)
	);
}

function getPartnerPriority(
	partner: PartnerMasterDataCdsSource,
	preferredSite?: string | null,
) {
	let priority = 0;

	if (preferredSite && partner.site === preferredSite) {
		priority += 4;
	}

	if (partner.enableCDS === true) {
		priority += 2;
	}

	if (partner.enableCDS === false) {
		priority -= 1;
	}

	return priority;
}

function orderPartnerSourcesForCdsDefaults({
	partners,
	preferredSite,
}: {
	partners: PartnerMasterDataCdsSource[];
	preferredSite?: string | null;
}) {
	return [...partners].sort((left, right) => {
		const rightPriority = getPartnerPriority(right, preferredSite);
		const leftPriority = getPartnerPriority(left, preferredSite);
		return rightPriority - leftPriority;
	});
}

export function buildPartnerMasterCdsDefaults({
	followUp,
	partner,
}: {
	followUp: FollowUpCdsDefaultSource;
	partner: PartnerMasterDataCdsSource | null | undefined;
}): PartnerMasterCdsDefaults {
	if (
		!partner ||
		(followUp.operationType !== "XUAT" && followUp.operationType !== "NHAP")
	) {
		return {};
	}

	const taxCode = cleanText(partner.taxCode) ?? cleanText(followUp.taxCode);
	const companyName =
		cleanText(partner.invoiceCompanyName) ??
		cleanText(partner.fullName) ??
		getInvoiceCompanyName(partner.invoiceData) ??
		cleanText(followUp.companyName);
	const parsedInvoiceData = parsePartnerInvoiceData({
		invoiceData: partner.invoiceData,
		companyName,
		taxCode,
	});
	const address =
		cleanText(partner.invoiceAddress) ?? parsedInvoiceData.invoiceAddress;
	const postalCode =
		cleanText(partner.invoicePostalCode) ?? parsedInvoiceData.invoicePostalCode;
	const phone =
		cleanText(partner.invoicePhone) ?? parsedInvoiceData.invoicePhone;

	return {
		importerCode: taxCode,
		importExportUnitName: companyName,
		importerPostalCode: postalCode ?? "x",
		importExportBusinessAddress: address,
		importerPhone: phone,
		customsCode: cleanText(partner.maHQ),
		warehouseLocationName: cleanText(partner.warehouse),
	};
}

export function buildMergedPartnerMasterCdsDefaults({
	followUp,
	partners,
	preferredSite,
}: {
	followUp: FollowUpCdsDefaultSource;
	partners: PartnerMasterDataCdsSource[];
	preferredSite?: string | null;
}): PartnerMasterCdsDefaults {
	const merged: PartnerMasterCdsDefaults = {};
	const orderedPartners = orderPartnerSourcesForCdsDefaults({
		partners,
		preferredSite,
	});

	for (const partner of orderedPartners) {
		const defaults = buildPartnerMasterCdsDefaults({ followUp, partner });

		(
			Object.entries(defaults) as Array<
				[keyof PartnerMasterCdsDefaults, string | null | undefined]
			>
		).forEach(([field, value]) => {
			if (shouldReplaceMergedDefault(field, merged[field], value)) {
				merged[field] = value;
			}
		});
	}

	return merged;
}
