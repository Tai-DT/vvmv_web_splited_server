import type { FollowUpCdsInfoRow } from "@/app/(home)/internal/followup/types";

export function normalizePromptSearchText(value: string) {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/đ/g, "d")
		.replace(/Đ/g, "D")
		.toLowerCase();
}

function cleanPromptAssignedValue(value: string) {
	return value
		.replace(
			/\b(ma\s+hs|hs\s+code|nuoc\s+xuat\s+xu|xuat\s+xu|ma\s+bo\s+phan|bo\s+phan\s+xu\s+ly|ma\s+xu\s+ly|declaration\s+processing)\b[\s\S]*$/i,
			"",
		)
		.replace(/^["':=\s]+|["';,\s]+$/g, "")
		.trim();
}

export function extractAssignedPromptValue(
	normalizedPrompt: string,
	label: string,
	originalPrompt?: string,
) {
	const assignmentMatch = normalizedPrompt.match(
		new RegExp(`${label}[\\s\\S]{0,140}?(?:\\bla\\b|:|=)\\s*([^\\n;,]+)`, "i"),
	);
	if (!assignmentMatch?.[1]) {
		return null;
	}

	// Free-text values must come from the original prompt (with diacritics and
	// casing), not the accent-stripped search text. Offsets line up only when
	// normalization preserved the character count.
	let rawValue = assignmentMatch[1];
	if (originalPrompt && originalPrompt.length === normalizedPrompt.length) {
		const valueStart =
			(assignmentMatch.index ?? 0) +
			assignmentMatch[0].length -
			assignmentMatch[1].length;
		rawValue = originalPrompt.slice(
			valueStart,
			valueStart + assignmentMatch[1].length,
		);
	}

	const cleaned = cleanPromptAssignedValue(rawValue);
	return cleaned === "" ? null : cleaned;
}

function pickAlphaNumericCode(
	value: string | null | undefined,
	options?: { min?: number; max?: number },
) {
	const min = options?.min ?? 1;
	const max = options?.max ?? 35;
	const token = value?.match(/[a-z0-9._/-]{1,40}/i)?.[0];
	if (!token) {
		return null;
	}

	const normalized = token.trim().replace(/\s+/g, "").toUpperCase();
	if (normalized.length < min || normalized.length > max) {
		return null;
	}

	return normalized;
}

function pickAssignedTextValue(
	normalizedPrompt: string,
	label: string,
	maxLength = 255,
	originalPrompt?: string,
) {
	const assigned = extractAssignedPromptValue(
		normalizedPrompt,
		label,
		originalPrompt,
	);
	if (!assigned) {
		return null;
	}

	const cleaned = assigned.trim();
	if (cleaned.length === 0 || cleaned.length > maxLength) {
		return null;
	}

	return cleaned;
}

/**
 * Trích các trường CDS từ chat tiếng Việt (không dấu) — đặc biệt mã bộ phận xử lý (vd. "chọn 01", "chon ma bo phan xu ly 02").
 */
export function extractCdsInfoPatchFromPrompt(
	promptText: string,
): Partial<FollowUpCdsInfoRow> {
	const normalized = normalizePromptSearchText(promptText);
	const original = promptText.normalize("NFC");
	const patch: Partial<FollowUpCdsInfoRow> = {};
	const deptContext =
		"(?:ma\\s+bo\\s+phan\\s+xu\\s+ly(?:\\s+(?:to\\s+khai|tk))?|bo\\s+phan\\s+xu\\s+ly|ma\\s+bo\\s+phan|ma\\s+xu\\s+ly|xu\\s+ly\\s+to\\s+khai|declaration\\s+processing)";
	const label =
		"(?:ma\\s+bo\\s+phan\\s+xu\\s+ly(?:\\s+(?:to\\s+khai|tk))?|bo\\s+phan\\s+xu\\s+ly|ma\\s+xu\\s+ly|declaration\\s+processing)";

	const pickDeptCode = (raw: string | null | undefined) => {
		const code = raw?.match(/\b[a-z0-9_-]{1,12}\b/i)?.[0];
		return code && code.length <= 4 ? code.toUpperCase() : null;
	};

	let code: string | null = null;

	const directiveValue =
		normalized.match(
			new RegExp(
				`${label}[\\s\\S]{0,180}?(?:dien\\s+ma|gan\\s+ma|cap\\s+nhat\\s+ma)\\s*([a-z0-9_-]{1,12})`,
				"i",
			),
		)?.[1] ?? null;
	const assignedValue =
		directiveValue === null
			? extractAssignedPromptValue(normalized, label)
			: null;
	code = pickDeptCode(directiveValue ?? assignedValue);

	if (!code) {
		const chooseFirst = normalized.match(
			new RegExp(
				`(?:chon|lua\\s+chon)\\s+(?:ma\\s+)?(\\d{1,4})\\b[\\s\\S]{0,120}?${deptContext}`,
				"i",
			),
		)?.[1];
		code = pickDeptCode(chooseFirst ?? undefined);
	}

	if (!code) {
		const chooseAfter = normalized.match(
			new RegExp(
				`${deptContext}[\\s\\S]{0,160}?(?:chon|lua\\s+chon)\\s+(?:ma\\s+)?(\\d{1,4})\\b`,
				"i",
			),
		)?.[1];
		code = pickDeptCode(chooseAfter ?? undefined);
	}

	if (!code) {
		const maLa = normalized.match(
			new RegExp(`${deptContext}\\s*(?:la|:|=)\\s*([a-z0-9_-]{1,12})`, "i"),
		)?.[1];
		code = pickDeptCode(maLa ?? undefined);
	}

	if (!code) {
		const setMa = normalized.match(
			/\b(?:dien|gan|set|update)\s+ma\s+(\d{1,4})\b[\s\S]{0,120}?(?:bo\s+phan|xu\s+ly|to\s+khai)/i,
		)?.[1];
		code = pickDeptCode(setMa ?? undefined);
	}

	if (code) {
		patch.declarationProcessingDeptCode = code;
	}

	const transportLabel =
		"(?:ma\\s+hieu\\s+phuong\\s+thuc\\s+van\\s+chuyen|phuong\\s+thuc\\s+van\\s+chuyen|ma\\s+ptvc|\\bptvc\\b)";
	const transportAssigned = extractAssignedPromptValue(
		normalized,
		transportLabel,
	);
	const transportDigit = transportAssigned?.match(/\b([1-9])\b/)?.[1];
	if (transportDigit) {
		patch.transportMethodCode = transportDigit;
	}

	const customsLabel =
		"(?:ma\\s+cqhq|co\\s+quan\\s+hai\\s+quan|ma\\s+hai\\s+quan|\\bcqhq\\b)";
	const customsAssigned = extractAssignedPromptValue(normalized, customsLabel);
	const customsCompact = customsAssigned?.replace(/\s+/g, "").toUpperCase();
	const customsCandidate = customsCompact?.match(/^(\d{2}[A-Z0-9]{2,4})$/)?.[1];
	if (customsCandidate) {
		patch.customsCode = customsCandidate;
	}

	const operationLabel =
		"(?:ma\\s+loai\\s+hinh(?:\\s+(?:to\\s+khai|tk|nk|xk))?|loai\\s+hinh(?:\\s+(?:to\\s+khai|tk))?)";
	let operationRaw =
		extractAssignedPromptValue(normalized, operationLabel) ??
		normalized.match(
			new RegExp(
				`${operationLabel}[\\s\\S]{0,160}?(?:chon|lua\\s+chon)\\s+(?:ma\\s+)?([a-z]\\d{2})\\b`,
				"i",
			),
		)?.[1];

	if (!operationRaw) {
		operationRaw = normalized.match(
			/(?:chon|lua\s+chon)\s+(?:ma\s+)?([a-z]\d{2})\b[\s\S]{0,160}?(?:ma\s+loai\s+hinh|loai\s+hinh)/i,
		)?.[1];
	}

	const operationCandidate = operationRaw
		?.trim()
		.match(/\b([a-z])\d{2}\b/i)?.[0]
		?.toUpperCase();
	if (operationCandidate && /^[A-Z]\d{2}$/.test(operationCandidate)) {
		patch.operationCode = operationCandidate;
	}

	const countryLabel = "(?:ma\\s+nuoc(?:\\s*\\()?|export\\s+country\\s+code)";
	const countryAssigned = extractAssignedPromptValue(normalized, countryLabel);
	const countryToken = countryAssigned
		?.replace(/^ma\s+/i, "")
		.trim()
		.replace(/\s+/g, "");
	if (countryToken && /^[A-Za-z]{2}$/.test(countryToken)) {
		patch.exportCountryCode = countryToken.toUpperCase();
	}

	const packageTypeLabel = "(?:loai\\s+kien|package\\s+type)";
	const packageTypeRaw = pickAssignedTextValue(
		normalized,
		packageTypeLabel,
		12,
	);
	const packageTypeCode = packageTypeRaw
		? pickAlphaNumericCode(packageTypeRaw, { min: 1, max: 6 })
		: null;
	if (packageTypeCode) {
		patch.packageType = packageTypeCode;
	}

	const billLabel = "(?:so\\s+van\\s+don|van\\s+don|bill\\s+of\\s+lading)";
	const billRaw = pickAssignedTextValue(normalized, billLabel, 40);
	const billValue = pickAlphaNumericCode(billRaw, { min: 2, max: 35 });
	if (billValue) {
		patch.billOfLading = billValue;
	}

	const loadingCodeLabel =
		"(?:ma\\s+dia\\s+diem\\s+xep\\s+hang|dia\\s+diem\\s+xep\\s+hang\\s+ma|loading\\s+location\\s+code)";
	const loadingCodeRaw = pickAssignedTextValue(
		normalized,
		loadingCodeLabel,
		20,
	);
	const loadingCode = pickAlphaNumericCode(loadingCodeRaw, { min: 2, max: 12 });
	if (loadingCode) {
		patch.loadingLocationCode = loadingCode;
	}

	const unloadingCodeLabel =
		"(?:ma\\s+dia\\s+diem\\s+nhan\\s+hang\\s+cuoi\\s+cung|ma\\s+dia\\s+diem\\s+do\\s+hang|ma\\s+dia\\s+diem\\s+do|unloading\\s+location\\s+code)";
	const unloadingCodeRaw = pickAssignedTextValue(
		normalized,
		unloadingCodeLabel,
		20,
	);
	const unloadingCode = pickAlphaNumericCode(unloadingCodeRaw, {
		min: 2,
		max: 12,
	});
	if (unloadingCode) {
		patch.unloadingLocationCode = unloadingCode;
	}

	const loadingNameLabel =
		"(?:ten\\s+dia\\s+diem\\s+xep\\s+hang|ten\\s+noi\\s+xep\\s+hang|loading\\s+location\\s+name)";
	const loadingName = pickAssignedTextValue(
		normalized,
		loadingNameLabel,
		140,
		original,
	);
	if (loadingName) {
		patch.loadingLocationName = loadingName;
	}

	const unloadingNameLabel =
		"(?:ten\\s+dia\\s+diem\\s+nhan\\s+hang\\s+cuoi\\s+cung|ten\\s+dia\\s+diem\\s+do\\s+hang|unloading\\s+location\\s+name)";
	const unloadingName = pickAssignedTextValue(
		normalized,
		unloadingNameLabel,
		140,
		original,
	);
	if (unloadingName) {
		patch.unloadingLocationName = unloadingName;
	}

	const taxDestinationLabel =
		"(?:dia\\s+diem\\s+dich\\s+cho\\s+van\\s+chuyen\\s+bao\\s+thue|dia\\s+diem\\s+dich\\s+bao\\s+thue|tax\\s+destination\\s+location)";
	const taxDestinationRaw = pickAssignedTextValue(
		normalized,
		taxDestinationLabel,
	);
	const taxDestinationCode = pickAlphaNumericCode(taxDestinationRaw, {
		min: 2,
		max: 12,
	});
	if (taxDestinationCode) {
		patch.taxDestinationLocation = taxDestinationCode;
	}

	const valuationTypeLabel =
		"(?:ma\\s+phan\\s+loai\\s+khai\\s+tri\\s+gia|phan\\s+loai\\s+khai\\s+tri\\s+gia)";
	const valuationTypeRaw = pickAssignedTextValue(
		normalized,
		valuationTypeLabel,
		20,
	);
	const valuationTypeCode = pickAlphaNumericCode(valuationTypeRaw, {
		min: 1,
		max: 4,
	});
	if (valuationTypeCode) {
		patch.valuationDeclarationTypeCode = valuationTypeCode;
	}

	const valuationDetailLabel =
		"(?:chi\\s+tiet\\s+khai\\s+tri\\s+gia|valuation\\s+declaration\\s+detail)";
	const valuationDetail = pickAssignedTextValue(
		normalized,
		valuationDetailLabel,
		400,
		original,
	);
	if (valuationDetail) {
		patch.valuationDeclarationDetail = valuationDetail;
	}

	return patch;
}
