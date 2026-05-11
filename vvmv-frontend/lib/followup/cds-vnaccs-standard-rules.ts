import type { FollowUpCdsInfoRow } from "@/app/(home)/internal/followup/types";

type CdsFieldKey = Extract<keyof FollowUpCdsInfoRow, string>;

export type CdsStandardOption = {
	value: string;
	label: string;
};

function toStandardOptions(labels: Record<string, string>) {
	return Object.entries(labels).map(([value, label]) => ({
		value,
		label: `${value} - ${label}`,
	}));
}

export const VNACCS_PERSON_ORG_LABELS = {
	"1": "Cá nhân gửi cá nhân",
	"2": "Tổ chức/công ty gửi cá nhân",
	"3": "Cá nhân gửi tổ chức/công ty",
	"4": "Tổ chức/công ty gửi tổ chức/công ty",
	"5": "Khác",
} as const;

export const VNACCS_PERSON_ORG_OPTIONS = toStandardOptions(
	VNACCS_PERSON_ORG_LABELS,
);

export const VNACCS_CARGO_CLASSIFICATION_LABELS = {
	A: "Hàng quà biếu, quà tặng",
	B: "Hàng an ninh, quốc phòng",
	C: "Hàng cứu trợ khẩn cấp",
	D: "Hàng phòng chống thiên tai, dịch bệnh",
	E: "Hàng viện trợ nhân đạo, viện trợ không hoàn lại",
	F: "Hàng bưu chính, chuyển phát nhanh",
	G: "Hàng tài sản di chuyển",
	H: "Hàng hóa được sử dụng cho PTVT xuất, nhập cảnh",
	I: "Hàng ngoại giao",
	J: "Hàng khác theo quy định của Chính phủ",
	K: "Hàng bảo quản đặc biệt",
} as const;

export const VNACCS_CARGO_CLASSIFICATION_OPTIONS = toStandardOptions(
	VNACCS_CARGO_CLASSIFICATION_LABELS,
);

export const VNACCS_TRANSPORT_METHOD_LABELS = {
	"1": "Đường không",
	"2": "Đường biển (container)",
	"3": "Đường biển (hàng rời, lỏng...)",
	"4": "Đường bộ (xe tải)",
	"5": "Đường sắt",
	"6": "Đường sông",
	"9": "Khác",
} as const;

export const VNACCS_TRANSPORT_METHOD_OPTIONS = toStandardOptions(
	VNACCS_TRANSPORT_METHOD_LABELS,
);

export const VNACCS_INSPECTION_RESULT_LABELS = {
	A: "Không có bất thường",
	B: "Có bất thường",
	C: "Cần tham vấn ý kiến cơ quan Hải quan",
} as const;

export const VNACCS_INSPECTION_RESULT_OPTIONS = toStandardOptions(
	VNACCS_INSPECTION_RESULT_LABELS,
);

export const VNACCS_TAX_PAYER_LABELS = {
	"1": "Người xuất khẩu (nhập khẩu)",
	"2": "Đại lý khai hải quan",
} as const;

export const VNACCS_TAX_PAYER_OPTIONS = toStandardOptions(
	VNACCS_TAX_PAYER_LABELS,
);

export const VNACCS_RELEASE_BEFORE_PERMIT_LABELS = {
	A: "Chờ xác định mã số hàng hóa",
	B: "Chờ xác định trị giá tính thuế",
	C: "Trường hợp khác",
} as const;

export const VNACCS_RELEASE_BEFORE_PERMIT_OPTIONS = toStandardOptions(
	VNACCS_RELEASE_BEFORE_PERMIT_LABELS,
);

export const VNACCS_TAX_PAYMENT_DEADLINE_LABELS = {
	A: "Trường hợp được áp dụng thời hạn nộp thuế do sử dụng bảo lãnh riêng",
	B: "Trường hợp được áp dụng thời hạn nộp thuế do sử dụng bảo lãnh chung",
	C: "Trường hợp được áp dụng thời hạn nộp thuế mà không sử dụng bảo lãnh",
	D: "Trường hợp nộp thuế ngay",
} as const;

export const VNACCS_TAX_PAYMENT_DEADLINE_OPTIONS = toStandardOptions(
	VNACCS_TAX_PAYMENT_DEADLINE_LABELS,
);

export const VNACCS_INVOICE_FORM_CLASSIFICATION_LABELS = {
	A: "Hóa đơn thương mại",
	B: "Chứng từ thay thế hóa đơn thương mại hoặc không có hóa đơn thương mại",
	D: "Hóa đơn điện tử (trường hợp đăng ký hóa đơn điện tử trên VNACCS)",
} as const;

export const VNACCS_INVOICE_FORM_CLASSIFICATION_OPTIONS = toStandardOptions(
	VNACCS_INVOICE_FORM_CLASSIFICATION_LABELS,
);

export const VNACCS_INVOICE_CLASSIFICATION_LABELS = {
	A: "Giá hóa đơn cho hàng hóa phải trả tiền",
	B: "Giá hóa đơn cho hàng hóa không phải trả tiền (FOC/hàng khuyến mại)",
	C: "Giá hóa đơn cho hàng hóa bao gồm phải trả tiền và không phải trả tiền",
	D: "Các trường hợp khác",
} as const;

export const VNACCS_INVOICE_CLASSIFICATION_OPTIONS = toStandardOptions(
	VNACCS_INVOICE_CLASSIFICATION_LABELS,
);

export const VNACCS_TRANSPORT_FEE_CLASSIFICATION_LABELS = {
	A: "Chứng từ vận tải ghi tổng cước chung cho toàn bộ lô hàng",
	B: "Lô hàng có cả hàng trả tiền và FOC/khuyến mại",
	C: "Tờ khai chỉ nhập khẩu một phần hàng của lô trên chứng từ vận tải",
	D: "Phân bổ cước theo tỷ lệ trọng lượng hoặc dung tích",
	E: "Trị giá hóa đơn đã có cước nhưng cước thực tế vượt hóa đơn",
	F: "Có cước vượt cước và chỉ nhập khẩu một phần hàng của lô",
} as const;

export const VNACCS_TRANSPORT_FEE_CLASSIFICATION_OPTIONS = toStandardOptions(
	VNACCS_TRANSPORT_FEE_CLASSIFICATION_LABELS,
);

export const VNACCS_INSURANCE_FEE_CLASSIFICATION_LABELS = {
	A: "Bảo hiểm riêng",
	D: "Không bảo hiểm",
} as const;

export const VNACCS_INSURANCE_FEE_CLASSIFICATION_OPTIONS = toStandardOptions(
	VNACCS_INSURANCE_FEE_CLASSIFICATION_LABELS,
);

export const VNACCS_VALUATION_DECLARATION_TYPE_LABELS = {
	"1": "Trị giá giao dịch của hàng hóa giống hệt",
	"2": "Trị giá giao dịch của hàng hóa tương tự",
	"3": "Phương pháp khấu trừ",
	"4": "Phương pháp tính toán",
	"6": "Phương pháp trị giá giao dịch",
	"7": "Trị giá giao dịch khi có quan hệ đặc biệt nhưng không ảnh hưởng giá",
	"8": "Trị giá giao dịch với phân bổ khoản điều chỉnh thủ công",
	"9": "Phương pháp suy luận",
	T: "Trường hợp đặc biệt",
} as const;

export const VNACCS_VALUATION_DECLARATION_TYPE_OPTIONS = toStandardOptions(
	VNACCS_VALUATION_DECLARATION_TYPE_LABELS,
);

export const VNACCS_STANDARD_FIELD_LABELS = {
	cargoClassificationCode: VNACCS_CARGO_CLASSIFICATION_LABELS,
	inspectionResultCode: VNACCS_INSPECTION_RESULT_LABELS,
	insuranceFeeClassificationCode: VNACCS_INSURANCE_FEE_CLASSIFICATION_LABELS,
	invoiceClassificationCode: VNACCS_INVOICE_CLASSIFICATION_LABELS,
	invoiceFormClassificationCode: VNACCS_INVOICE_FORM_CLASSIFICATION_LABELS,
	personOrganizationClassification: VNACCS_PERSON_ORG_LABELS,
	releaseBeforePermitCode: VNACCS_RELEASE_BEFORE_PERMIT_LABELS,
	taxPayer: VNACCS_TAX_PAYER_LABELS,
	taxPaymentDeadlineCode: VNACCS_TAX_PAYMENT_DEADLINE_LABELS,
	transportFeeClassificationCode: VNACCS_TRANSPORT_FEE_CLASSIFICATION_LABELS,
	transportMethodCode: VNACCS_TRANSPORT_METHOD_LABELS,
	valuationDeclarationTypeCode: VNACCS_VALUATION_DECLARATION_TYPE_LABELS,
} as const satisfies Partial<Record<CdsFieldKey, Record<string, string>>>;

export const VNACCS_STANDARD_FIELD_OPTIONS: Partial<
	Record<CdsFieldKey, readonly CdsStandardOption[]>
> = {
	cargoClassificationCode: VNACCS_CARGO_CLASSIFICATION_OPTIONS,
	inspectionResultCode: VNACCS_INSPECTION_RESULT_OPTIONS,
	insuranceFeeClassificationCode: VNACCS_INSURANCE_FEE_CLASSIFICATION_OPTIONS,
	invoiceClassificationCode: VNACCS_INVOICE_CLASSIFICATION_OPTIONS,
	invoiceFormClassificationCode: VNACCS_INVOICE_FORM_CLASSIFICATION_OPTIONS,
	personOrganizationClassification: VNACCS_PERSON_ORG_OPTIONS,
	releaseBeforePermitCode: VNACCS_RELEASE_BEFORE_PERMIT_OPTIONS,
	taxPayer: VNACCS_TAX_PAYER_OPTIONS,
	taxPaymentDeadlineCode: VNACCS_TAX_PAYMENT_DEADLINE_OPTIONS,
	transportFeeClassificationCode: VNACCS_TRANSPORT_FEE_CLASSIFICATION_OPTIONS,
	transportMethodCode: VNACCS_TRANSPORT_METHOD_OPTIONS,
	valuationDeclarationTypeCode: VNACCS_VALUATION_DECLARATION_TYPE_OPTIONS,
};

export const VNACCS_STANDARD_FIELD_KEYS = new Set<CdsFieldKey>(
	Object.keys(VNACCS_STANDARD_FIELD_OPTIONS) as CdsFieldKey[],
);

const VNACCS_STANDARD_ALLOWED_VALUES = new Map<
	CdsFieldKey,
	ReadonlySet<string>
>(
	(
		Object.entries(VNACCS_STANDARD_FIELD_OPTIONS) as Array<
			[CdsFieldKey, readonly CdsStandardOption[]]
		>
	).map(([fieldKey, options]) => [
		fieldKey,
		new Set(options.map((option) => option.value.trim().toUpperCase())),
	]),
);

export function getVnaccsStandardFieldOptions(fieldKey: CdsFieldKey) {
	return [...(VNACCS_STANDARD_FIELD_OPTIONS[fieldKey] ?? [])];
}

export function isVnaccsStandardField(fieldKey: CdsFieldKey) {
	return VNACCS_STANDARD_FIELD_KEYS.has(fieldKey);
}

export function isAllowedVnaccsStandardFieldValue(
	fieldKey: CdsFieldKey,
	value: string,
) {
	const allowedValues = VNACCS_STANDARD_ALLOWED_VALUES.get(fieldKey);

	if (!allowedValues) {
		return true;
	}

	return allowedValues.has(value.trim().toUpperCase());
}
