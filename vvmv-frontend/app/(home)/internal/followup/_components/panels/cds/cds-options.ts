// cds-options.ts – option arrays for ECUS constants

import {
	VNACCS_CARGO_CLASSIFICATION_OPTIONS,
	VNACCS_INSPECTION_RESULT_OPTIONS,
	VNACCS_PERSON_ORG_OPTIONS,
	VNACCS_TRANSPORT_METHOD_OPTIONS,
} from "@/lib/followup/cds-vnaccs-standard-rules";

export {
	CDS_BUSINESS_TYPE_GROUP_OPTIONS as ECUS_BUSINESS_GROUP_OPTIONS,
	normalizeCdsBusinessTypeGroup,
	resolveCdsBusinessTypeGroup,
} from "@/lib/followup/cds-business-type-groups";

export const ECUS_OPERATION_CODE_OPTIONS = [
	{ code: "A11", name: "Nhập kinh doanh tiêu dùng" },
	{ code: "A12", name: "Nhập kinh doanh sản xuất" },
	{ code: "A21", name: "Chuyển tiêu thụ nội địa từ nguồn tạm nhập" },
	{ code: "A31", name: "Nhập hàng hóa đã xuất khẩu" },
	{
		code: "A41",
		name: "Nhập kinh doanh của doanh nghiệp thực hiện quyền nhập khẩu",
	},
	{
		code: "A42",
		name: "Thay đổi mục đích sử dụng hoặc chuyển tiêu thụ nội địa từ các loại hình khác,trừ tạm nhập",
	},
	{ code: "A43", name: "Nhập khẩu hàng hóa thuộc Chương trình ưu đãi thuế" },
	{ code: "A44", name: "Tạm nhập hàng hóa bán tại cửa hàng miễn thuế" },
	{ code: "A45", name: "Nhập khẩu hàng chuyển phát nhanh" },
	{ code: "AAA", name: "Loại hình dùng cho tờ khai nộp phí (OLA)" },
	{ code: "B11", name: "Xuất kinh doanh" },
	{ code: "B12", name: "Xuất sau khi đã tạm xuất" },
	{ code: "B13", name: "Xuất khẩu hàng đã nhập khẩu" },
	{ code: "B14", name: "Xuất khẩu hàng chuyển phát nhanh" },
	{ code: "C11", name: "Hàng nước ngoài gửi kho ngoại quan" },
	{ code: "C12", name: "Hàng xuất từ kho ngoại quan đi nước ngoài" },
	{ code: "C21", name: "Hàng đưa vào khu phi thuế quan" },
	{ code: "C22", name: "Hàng đưa ra khỏi khu phi thuế quan" },
	{ code: "E11", name: "Nhập nguyên liệu của DNCX từ nước ngoài" },
	{ code: "E13", name: "Nhập hàng hóa khác vào DNCX" },
	{
		code: "E15",
		name: "Nhập nguyên liệu của doanh nghiệp chế xuất từ nội địa",
	},
	{
		code: "E21",
		name: "Nhập nguyên liệu, vật tư để gia công cho thương nhân nước ngoài",
	},
	{
		code: "E23",
		name: "Nhập nguyên liệu, vật tư gia công từ hợp đồng khác chuyển sang",
	},
	{ code: "E31", name: "Nhập nguyên liệu sản xuất xuất khẩu" },
	{ code: "E33", name: "Nhập nguyên liệu vào kho bảo thuế" },
	{ code: "E41", name: "Nhập sản phẩm thuê gia công ở nước ngoài" },
	{ code: "E42", name: "Xuất khẩu sản phẩm của Doanh nghiệp chế xuất" },
	{ code: "E52", name: "Xuất sản phẩm gia công cho thương nhân nước ngoài" },
	{ code: "E54", name: "Xuất nguyên liệu gia công từ hợp đồng khác sang" },
	{ code: "E62", name: "Xuất sản phẩm Sản xuất xuất khẩu" },
	{ code: "E82", name: "Xuất nguyên liệu, vật tư thuê gia công ở nước ngoài" },
	{ code: "G11", name: "Tạm nhập hàng kinh doanh tạm nhập tái xuất" },
	{ code: "G12", name: "Tạm nhập máy móc, thiết bị phục vụ dự án có thời hạn" },
	{ code: "G13", name: "Tạm nhập miễn thuế" },
	{ code: "G14", name: "Tạm nhập khác" },
	{ code: "G21", name: "Tái xuất hàng kinh doanh tạm nhập tái xuất" },
	{ code: "G22", name: "Tái xuất thiết bị, máy móc phục vụ dự án có thời hạn" },
	{ code: "G23", name: "Tái xuất miễn thuế hàng tạm nhập" },
	{ code: "G24", name: "Tái xuất khác" },
	{ code: "G51", name: "Tái nhập hàng đã tạm xuất" },
	{ code: "G61", name: "Tạm xuất hàng hóa" },
	{ code: "H11", name: "Hàng nhập khẩu khác" },
	{ code: "H21", name: "Xuất khẩu hàng khác" },
] as const;

export const ECUS_PERSON_ORG_OPTIONS = VNACCS_PERSON_ORG_OPTIONS;

export const ECUS_CARGO_CLASSIFICATION_OPTIONS =
	VNACCS_CARGO_CLASSIFICATION_OPTIONS;

export const ECUS_TRANSPORT_METHOD_OPTIONS = VNACCS_TRANSPORT_METHOD_OPTIONS;

export const ECUS_WEIGHT_UNIT_OPTIONS = [
	{ value: "KGM", label: "Kilogram", alias: "KG" },
	{ value: "GRM", label: "Gram", alias: "G" },
	{ value: "TNE", label: "Metric ton", alias: "MT" },
	{ value: "LBS", label: "Pound", alias: "LB" },
] as const;

export const ECUS_INSPECTION_RESULT_OPTIONS = VNACCS_INSPECTION_RESULT_OPTIONS;
