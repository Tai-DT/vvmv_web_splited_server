"use client";

import type { FollowUpCdsInfoRow } from "../../../types";

const PROCESSING_DEPARTMENT_PREREQUISITE_MESSAGE =
	"Chọn Mã loại hình và Cơ quan Hải quan trước khi chọn Mã bộ phận xử lý tờ khai.";

function normalizeDependencyValue(value: unknown) {
	const normalized = String(value ?? "").trim();
	return normalized === "" ? null : normalized.toUpperCase();
}

export function hasProcessingDepartmentPrerequisites(
	data: Pick<Partial<FollowUpCdsInfoRow>, "customsCode" | "operationCode">,
) {
	return Boolean(
		normalizeDependencyValue(data.customsCode) &&
			normalizeDependencyValue(data.operationCode),
	);
}

export function getProcessingDepartmentPrerequisiteLockReason(
	data: Pick<Partial<FollowUpCdsInfoRow>, "customsCode" | "operationCode">,
) {
	return hasProcessingDepartmentPrerequisites(data)
		? null
		: PROCESSING_DEPARTMENT_PREREQUISITE_MESSAGE;
}
