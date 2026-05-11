// use-cds-collection-locks.ts – collection locking logic extracted from cds-info-panel.tsx (Phase 3)
"use client";

import { useCallback } from "react";
import type { FollowUpOperationType } from "@/lib/followup/operation-type";
import type { FollowUpCdsInfoRow } from "../../../types";
import {
	getSequentialLockReason,
	hasAnyRowValue,
	hasMeaningfulCollectionValue,
} from "./cds-field-locks";

export interface UseCdsCollectionLocksParams {
	data: Partial<FollowUpCdsInfoRow>;
	resolvedOperationType: FollowUpOperationType | null;
}

export function useCdsCollectionLocks({
	data,
	resolvedOperationType,
}: UseCdsCollectionLocksParams) {
	const getBillItemRowLockReason = useCallback(
		(index: number) => {
			const items = Array.isArray(data.billItems) ? data.billItems : [];
			const currentItem =
				items[index] && typeof items[index] === "object" ? items[index] : null;
			const previousItem =
				index > 0 && items[index - 1] && typeof items[index - 1] === "object"
					? items[index - 1]
					: null;

			return getSequentialLockReason({
				index,
				currentHasValue: hasAnyRowValue(
					currentItem as Record<string, unknown> | null,
					["billNumber", "billDate", "hawbNumber", "mawbYear"],
				),
				previousHasValue: hasMeaningfulCollectionValue(
					previousItem?.billNumber,
				),
				label: "vận đơn",
			});
		},
		[data.billItems],
	);

	const getLegalDocumentSlotLockReason = useCallback(
		(index: number) => {
			const items = Array.isArray(data.otherLegalDocumentCodes)
				? data.otherLegalDocumentCodes
				: [];

			return getSequentialLockReason({
				index,
				currentHasValue: hasMeaningfulCollectionValue(items[index]),
				previousHasValue:
					index === 0 || hasMeaningfulCollectionValue(items[index - 1]),
				label: "mã văn bản pháp quy",
				unit: "ô",
			});
		},
		[data.otherLegalDocumentCodes],
	);

	const getImportLicenseSlotLockReason = useCallback(
		(index: number) => {
			const items = Array.isArray(data.importLicenses)
				? data.importLicenses
				: [];

			return getSequentialLockReason({
				index,
				currentHasValue: hasMeaningfulCollectionValue(items[index]),
				previousHasValue:
					index === 0 || hasMeaningfulCollectionValue(items[index - 1]),
				label:
					resolvedOperationType === "XUAT"
						? "giấy phép xuất khẩu"
						: "giấy phép nhập khẩu",
			});
		},
		[data.importLicenses, resolvedOperationType],
	);

	const getExportLicenseRowLockReason = useCallback(
		(index: number) => {
			const permitNumbers = Array.isArray(data.importLicenses)
				? data.importLicenses
				: [];
			const legalCodes = Array.isArray(data.otherLegalDocumentCodes)
				? data.otherLegalDocumentCodes
				: [];

			return getSequentialLockReason({
				index,
				currentHasValue:
					hasMeaningfulCollectionValue(permitNumbers[index]) ||
					hasMeaningfulCollectionValue(legalCodes[index]),
				previousHasValue:
					index === 0 ||
					hasMeaningfulCollectionValue(permitNumbers[index - 1]) ||
					hasMeaningfulCollectionValue(legalCodes[index - 1]),
				label: "giấy phép xuất khẩu",
			});
		},
		[data.importLicenses, data.otherLegalDocumentCodes],
	);

	const getValuationAdjustmentLockReason = useCallback(
		(index: number) => {
			const items = Array.isArray(data.valuationAdjustments)
				? data.valuationAdjustments
				: [];
			const currentItem =
				items[index] && typeof items[index] === "object" ? items[index] : null;
			const previousItem =
				index > 0 && items[index - 1] && typeof items[index - 1] === "object"
					? items[index - 1]
					: null;

			return getSequentialLockReason({
				index,
				currentHasValue: hasAnyRowValue(
					currentItem as Record<string, unknown> | null,
					[
						"nameCode",
						"classificationCode",
						"currencyCode",
						"adjustmentValue",
						"allocationRatio",
					],
				),
				previousHasValue:
					index === 0 ||
					hasAnyRowValue(previousItem as Record<string, unknown> | null, [
						"nameCode",
						"classificationCode",
						"currencyCode",
						"adjustmentValue",
						"allocationRatio",
					]),
				label: "khoản điều chỉnh trị giá",
			});
		},
		[data.valuationAdjustments],
	);

	const getElectronicAttachmentLockReason = useCallback(
		(index: number) => {
			const items = Array.isArray(data.electronicAttachments)
				? data.electronicAttachments
				: [];
			const currentItem =
				items[index] && typeof items[index] === "object" ? items[index] : null;
			const previousItem =
				index > 0 && items[index - 1] && typeof items[index - 1] === "object"
					? items[index - 1]
					: null;

			return getSequentialLockReason({
				index,
				currentHasValue: hasAnyRowValue(
					currentItem as Record<string, unknown> | null,
					["attachmentNumber", "attachmentDescription"],
				),
				previousHasValue:
					index === 0 ||
					hasAnyRowValue(previousItem as Record<string, unknown> | null, [
						"attachmentNumber",
						"attachmentDescription",
					]),
				label: "đính kèm điện tử",
			});
		},
		[data.electronicAttachments],
	);

	const getTransportScheduleLockReason = useCallback(
		(index: number) => {
			const items = Array.isArray(data.transportSchedules)
				? data.transportSchedules
				: [];
			const currentItem =
				items[index] && typeof items[index] === "object" ? items[index] : null;
			const previousItem =
				index > 0 && items[index - 1] && typeof items[index - 1] === "object"
					? items[index - 1]
					: null;

			return getSequentialLockReason({
				index,
				currentHasValue: hasAnyRowValue(
					currentItem as Record<string, unknown> | null,
					["locationCode", "locationName", "arrivalDate", "departureDate"],
				),
				previousHasValue:
					index === 0 ||
					hasAnyRowValue(previousItem as Record<string, unknown> | null, [
						"locationCode",
						"locationName",
						"arrivalDate",
						"departureDate",
					]),
				label: "thông tin trung chuyển",
			});
		},
		[data.transportSchedules],
	);

	return {
		getBillItemRowLockReason,
		getLegalDocumentSlotLockReason,
		getImportLicenseSlotLockReason,
		getExportLicenseRowLockReason,
		getValuationAdjustmentLockReason,
		getElectronicAttachmentLockReason,
		getTransportScheduleLockReason,
	};
}
