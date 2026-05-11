// use-cds-collections.ts – collection update helpers extracted from cds-info-panel.tsx (Phase 3)
"use client";

import { useCallback } from "react";
import {
	normalizeCdsImportLicenseSlotValue,
	stripCdsLookupDisplayLabel,
} from "@/lib/followup/cds-code-values";
import type { FollowUpCdsInfoRow } from "../../../types";

export interface UseCdsCollectionsParams {
	setData: React.Dispatch<React.SetStateAction<Partial<FollowUpCdsInfoRow>>>;
}

export function useCdsCollections({ setData }: UseCdsCollectionsParams) {
	const updateBillItem = useCallback(
		(index: number, field: string, value: string) => {
			setData((prev) => {
				const billItems = Array.isArray(prev.billItems)
					? [...prev.billItems]
					: [];
				const item = billItems[index] || {};
				billItems[index] = { ...item, [field]: value };

				if (index !== 0 || field !== "billNumber") {
					return { ...prev, billItems };
				}

				const normalizedTopBill = String(prev.billOfLading ?? "").trim();
				const normalizedFirstBill = String(item.billNumber ?? "").trim();
				const normalizedNextValue = String(value ?? "").trim();
				const nextData: Partial<FollowUpCdsInfoRow> = { ...prev, billItems };

				// Keep the main bill field aligned with the first bill row.
				if (!normalizedTopBill || normalizedTopBill === normalizedFirstBill) {
					nextData.billOfLading = normalizedNextValue || null;
				}

				return nextData;
			});
		},
		[setData],
	);

	const updateValuationAdjustment = useCallback(
		(index: number, field: string, value: unknown) => {
			setData((prev) => {
				const valuationAdjustments = Array.isArray(prev.valuationAdjustments)
					? [...prev.valuationAdjustments]
					: [];
				const item = valuationAdjustments[index] || {};
				const nextValue =
					field === "nameCode" ||
					field === "classificationCode" ||
					field === "currencyCode"
						? stripCdsLookupDisplayLabel(value)
						: value;
				valuationAdjustments[index] = { ...item, [field]: nextValue };
				return { ...prev, valuationAdjustments };
			});
		},
		[setData],
	);

	const updateElectronicAttachment = useCallback(
		(index: number, field: string, value: string) => {
			setData((prev) => {
				const electronicAttachments = Array.isArray(prev.electronicAttachments)
					? [...prev.electronicAttachments]
					: [];
				const item = electronicAttachments[index] || {};
				const nextValue =
					field === "attachmentDescription"
						? stripCdsLookupDisplayLabel(value)
						: value;
				electronicAttachments[index] = { ...item, [field]: nextValue };
				return { ...prev, electronicAttachments };
			});
		},
		[setData],
	);

	const updateTransportSchedule = useCallback(
		(index: number, field: string, value: string) => {
			setData((prev) => {
				const transportSchedules = Array.isArray(prev.transportSchedules)
					? [...prev.transportSchedules]
					: [];
				const item = transportSchedules[index] || {};
				const nextValue =
					field === "locationCode" ? stripCdsLookupDisplayLabel(value) : value;
				transportSchedules[index] = { ...item, [field]: nextValue };
				return { ...prev, transportSchedules };
			});
		},
		[setData],
	);

	const updateImportLicenseSlot = useCallback(
		(index: number, value: string | null) => {
			setData((prev) => {
				const licenses = Array.isArray(prev.importLicenses)
					? [...prev.importLicenses]
					: [];
				licenses[index] = normalizeCdsImportLicenseSlotValue(value);
				return { ...prev, importLicenses: licenses };
			});
		},
		[setData],
	);

	const updateLegalDocumentSlot = useCallback(
		(index: number, value: string | null) => {
			setData((prev) => {
				const codes = Array.isArray(prev.otherLegalDocumentCodes)
					? [...prev.otherLegalDocumentCodes]
					: [];
				codes[index] = stripCdsLookupDisplayLabel(value);
				return { ...prev, otherLegalDocumentCodes: codes };
			});
		},
		[setData],
	);

	return {
		updateBillItem,
		updateValuationAdjustment,
		updateElectronicAttachment,
		updateTransportSchedule,
		updateImportLicenseSlot,
		updateLegalDocumentSlot,
	};
}
