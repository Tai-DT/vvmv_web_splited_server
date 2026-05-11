import { FIELD_DEFINITIONS } from "@/lib/followup/cds-field-definitions";
import { getCdsVnaccsFieldLabel } from "@/lib/followup/cds-vnaccs-field-labels";
import type { FollowUpOperationType } from "@/lib/followup/operation-type";

/* ------------------------------------------------------------------ */
/*  Quick-chat prompt suggestions                                      */
/* ------------------------------------------------------------------ */

export const QUICK_CHAT_PROMPTS = [
	"Giữ nguyên kết quả hiện tại nhưng sửa lại số invoice theo chứng từ mới.",
	"Chỉ điền các ô còn trống, không thay danh sách hàng đang có.",
	"Rà lại mã HS, tên hàng và gộp các dòng hàng bị trùng.",
	"Sửa tên hàng: bỏ chuỗi #___ trong cột tên (giữ nguyên các dòng khác).",
	"Chỉ sửa dòng STT ___ trong danh sách hàng, không đổi các dòng khác.",
];

/* ------------------------------------------------------------------ */
/*  CDS field label / input-type maps                                  */
/* ------------------------------------------------------------------ */

export const CDS_FIELD_LABELS = Object.fromEntries(
	FIELD_DEFINITIONS.filter((definition) =>
		definition.appPath.startsWith("cdsInfo."),
	).map((definition) => [
		definition.appPath.replace("cdsInfo.", ""),
		definition.label,
	]),
) as Record<string, string>;

export function getCdsAiFieldLabel(
	fieldKey: string,
	operationType: FollowUpOperationType | null,
) {
	return (
		getCdsVnaccsFieldLabel(fieldKey, operationType) ??
		CDS_FIELD_LABELS[fieldKey] ??
		fieldKey
	);
}

export const CDS_FIELD_INPUT_TYPES = Object.fromEntries(
	FIELD_DEFINITIONS.filter((definition) =>
		definition.appPath.startsWith("cdsInfo."),
	).map((definition) => [
		definition.appPath.replace("cdsInfo.", ""),
		definition.inputType,
	]),
) as Record<string, "text" | "number" | "date" | "select">;
