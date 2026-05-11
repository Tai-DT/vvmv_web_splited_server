// use-cds-field-locks.ts – field locking logic extracted from cds-info-panel.tsx (Phase 3)
"use client";

import { useCallback, useMemo } from "react";
import { getCdsInfoFieldUsage } from "@/lib/followup/cds-field-definitions";
import type { FollowUpOperationType } from "@/lib/followup/operation-type";
import type { FollowUpCdsInfoRow } from "../../../types";
import {
	EXPORT_STATIC_DISABLED_REASONS,
	IMPORT_IMAGE_1_STATIC_DISABLED_REASONS,
} from "./cds-field-locks";
import type { FieldRenderLockOptions } from "./cds-lookup-types";
import { getProcessingDepartmentPrerequisiteLockReason } from "./cds-processing-department-dependencies";

export type { FieldRenderLockOptions };

export interface UseCdsFieldLocksParams {
	data: Partial<FollowUpCdsInfoRow>;
	resolvedOperationType: FollowUpOperationType | null;
}

export function useCdsFieldLocks({
	data,
	resolvedOperationType,
}: UseCdsFieldLocksParams) {
	const isAppIssuedDeclaration = useMemo(() => {
		const declarationNumber =
			typeof data.declarationNumber === "string"
				? data.declarationNumber.trim()
				: "";
		if (!declarationNumber) {
			return false;
		}

		return data.cdsStatus === "REGISTERED" || data.ecusDeclarationId != null;
	}, [data.cdsStatus, data.declarationNumber, data.ecusDeclarationId]);
	const appIssuedDeclarationLockReason = isAppIssuedDeclaration
		? "Tờ khai đã được app cấp số nên web chỉ hiển thị dữ liệu đã đồng bộ, không cho cập nhật trực tiếp."
		: null;
	const isNewCdsDraft = useMemo(() => {
		const persistedId = typeof data.id === "string" ? data.id.trim() : "";
		return !persistedId && data.ecusDeclarationId == null;
	}, [data.ecusDeclarationId, data.id]);

	const getInitialEntryLockReason = useCallback(
		(fieldKey: keyof FollowUpCdsInfoRow) => {
			if (!isNewCdsDraft || !resolvedOperationType) {
				return null;
			}

			const usage = getCdsInfoFieldUsage(String(fieldKey));
			if (
				!usage?.visibleFor ||
				usage.visibleFor.includes(resolvedOperationType)
			) {
				return null;
			}

			if (usage.visibleFor.length === 1 && usage.visibleFor[0] === "NHAP") {
				return "Trường này chỉ áp dụng cho tờ khai nhập khẩu.";
			}

			if (usage.visibleFor.length === 1 && usage.visibleFor[0] === "XUAT") {
				return "Trường này chỉ áp dụng cho tờ khai xuất khẩu.";
			}

			return "Trường này chưa áp dụng cho loại tờ khai hiện tại.";
		},
		[isNewCdsDraft, resolvedOperationType],
	);

	const resolveFieldLockState = useCallback(
		(fieldKey: keyof FollowUpCdsInfoRow, options?: FieldRenderLockOptions) => {
			const prerequisiteDisabledReason =
				fieldKey === "declarationProcessingDeptCode"
					? getProcessingDepartmentPrerequisiteLockReason(data)
					: null;
			const disabledReason =
				options?.disabledReason ??
				appIssuedDeclarationLockReason ??
				prerequisiteDisabledReason ??
				getInitialEntryLockReason(fieldKey);

			return {
				disabledReason,
				isDisabled:
					options?.forceDisabled === true ||
					appIssuedDeclarationLockReason !== null ||
					prerequisiteDisabledReason !== null ||
					disabledReason !== null,
			};
		},
		[appIssuedDeclarationLockReason, data, getInitialEntryLockReason],
	);

	const getImportImage1FieldLockReason = useCallback(
		(fieldKey: keyof FollowUpCdsInfoRow) => {
			if (resolvedOperationType !== "NHAP") {
				return null;
			}

			return IMPORT_IMAGE_1_STATIC_DISABLED_REASONS[fieldKey] ?? null;
		},
		[resolvedOperationType],
	);

	const getImportImage1FieldLockOptions = useCallback(
		(
			fieldKey: keyof FollowUpCdsInfoRow,
		): FieldRenderLockOptions | undefined => {
			const disabledReason = getImportImage1FieldLockReason(fieldKey);

			if (!disabledReason) {
				return undefined;
			}

			return {
				forceDisabled: true,
				disabledReason,
			};
		},
		[getImportImage1FieldLockReason],
	);

	const getExportFieldLockReason = useCallback(
		(fieldKey: keyof FollowUpCdsInfoRow) => {
			if (resolvedOperationType !== "XUAT") {
				return null;
			}

			return EXPORT_STATIC_DISABLED_REASONS[fieldKey] ?? null;
		},
		[resolvedOperationType],
	);

	const getExportFieldLockOptions = useCallback(
		(
			fieldKey: keyof FollowUpCdsInfoRow,
		): FieldRenderLockOptions | undefined => {
			const disabledReason = getExportFieldLockReason(fieldKey);

			if (!disabledReason) {
				return undefined;
			}

			return {
				forceDisabled: true,
				disabledReason,
			};
		},
		[getExportFieldLockReason],
	);

	return {
		isAppIssuedDeclaration,
		appIssuedDeclarationLockReason,
		isNewCdsDraft,
		getInitialEntryLockReason,
		resolveFieldLockState,
		getImportImage1FieldLockOptions,
		getExportFieldLockOptions,
	};
}
