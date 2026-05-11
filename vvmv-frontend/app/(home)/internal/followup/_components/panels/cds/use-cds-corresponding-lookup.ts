// use-cds-corresponding-lookup.ts – corresponding declaration lookup logic extracted from cds-info-panel.tsx (Phase 3)
"use client";

import { useCallback } from "react";
import type { HanDeclarationPrefillMatch } from "@/lib/followup/han-declaration-loader";
import type { FollowUpOperationType } from "@/lib/followup/operation-type";
import type { CargoListRow, FollowUpCdsInfoRow } from "../../../types";
import {
	type CdsHanConnectionInfo,
	parseCdsHanConnectionInfo,
} from "./cds-han-connection-info";
import {
	CORRESPONDING_DECLARATION_PREFILL_FIELDS,
	mergeHanPrefillIntoCdsData,
} from "./cds-prefill";

export interface UseCdsCorrespondingLookupParams {
	followUpId: string;
	data: Partial<FollowUpCdsInfoRow>;
	resolvedOperationType: FollowUpOperationType | null;
	setData: React.Dispatch<React.SetStateAction<Partial<FollowUpCdsInfoRow>>>;
	setCargoList: (items: Partial<CargoListRow>[]) => void;
	onHanConnectionResolved?: (info: CdsHanConnectionInfo | null) => void;
}

export function useCdsCorrespondingLookup({
	followUpId,
	data,
	setData,
	setCargoList,
	onHanConnectionResolved,
}: UseCdsCorrespondingLookupParams) {
	const handleApplyCorrespondingDeclarationLookup = useCallback(
		async (declarationNumber: string) => {
			const normalized = declarationNumber.trim();
			if (!normalized) {
				return null;
			}

			const response = await fetch(
				`/api/followup/${followUpId}/han-declarations/by-number`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ declarationNumber: normalized }),
				},
			);
			const payload = await response.json().catch(() => ({}));

			if (!response.ok) {
				throw new Error(
					payload?.error || "Không thể nạp và lưu tờ khai từ app/HAN vào web",
				);
			}

			const match = (
				payload?.data?.appDeclaration
					? {
							declarationId: payload.data.appDeclaration.declarationId,
							declarationNumber: payload.data.appDeclaration.declarationNumber,
							declarationDate: payload.data.appDeclaration.declarationDate,
							taxCode: null,
							companyName: null,
							operationCode: null,
							xOrN: null,
							prefill: payload.data.cdsInfo,
							cargoList: payload.data.cargoList,
						}
					: (payload?.data ?? null)
			) as HanDeclarationPrefillMatch | null;
			onHanConnectionResolved?.(
				parseCdsHanConnectionInfo(payload?.hanConnection),
			);
			if (!match?.prefill) {
				return null;
			}

			const nextData = mergeHanPrefillIntoCdsData(
				{
					...data,
					correspondingDeclarationNumber: normalized,
				},
				match.prefill,
				CORRESPONDING_DECLARATION_PREFILL_FIELDS,
			);
			setData(nextData);

			const hanCargoList = Array.isArray(match.cargoList)
				? (match.cargoList as Partial<CargoListRow>[])
				: [];

			if (hanCargoList.length > 0) setCargoList(hanCargoList);

			return match;
		},
		[data, followUpId, onHanConnectionResolved, setCargoList, setData],
	);

	return {
		handleApplyCorrespondingDeclarationLookup,
	};
}
