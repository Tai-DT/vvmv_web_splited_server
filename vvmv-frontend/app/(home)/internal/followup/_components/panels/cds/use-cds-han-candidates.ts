// use-cds-han-candidates.ts – HAN candidate logic extracted from cds-info-panel.tsx (Phase 3)
"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { HanDeclarationCandidate } from "@/lib/followup/han-declaration-loader";
import type { FollowUpOperationType } from "@/lib/followup/operation-type";
import {
	type CdsHanConnectionInfo,
	parseCdsHanConnectionInfo,
} from "./cds-han-connection-info";

export interface UseCdsHanCandidatesParams {
	followUpId: string;
	resolvedOperationType: FollowUpOperationType | null;
	onHanConnectionResolved?: (info: CdsHanConnectionInfo | null) => void;
}

export function useCdsHanCandidates({
	followUpId,
	resolvedOperationType,
	onHanConnectionResolved,
}: UseCdsHanCandidatesParams) {
	const [showHanCandidateDialog, setShowHanCandidateDialog] = useState(false);
	const [hanCandidates, setHanCandidates] = useState<HanDeclarationCandidate[]>(
		[],
	);
	const [hanCandidatesLoading, setHanCandidatesLoading] = useState(false);
	const [hanCandidatesError, setHanCandidatesError] = useState<string | null>(
		null,
	);
	const [selectedHanCandidateId, setSelectedHanCandidateId] = useState<
		string | null
	>(null);

	const handleOpenHanCandidates = useCallback(async () => {
		if (resolvedOperationType !== "XUAT") {
			return;
		}

		setHanCandidatesError(null);
		setHanCandidatesLoading(true);

		try {
			const response = await fetch(
				`/api/followup/${followUpId}/han-declarations`,
			);

			const payload = await response.json();

			if (!response.ok) {
				throw new Error(payload?.error || "Không thể tải danh sách HAN");
			}

			const candidates = Array.isArray(payload?.data?.candidates)
				? (payload.data.candidates as HanDeclarationCandidate[])
				: [];
			const hanConnection = parseCdsHanConnectionInfo(
				payload?.data?.hanConnection,
			);

			setHanCandidates(candidates);
			onHanConnectionResolved?.(hanConnection);
			setSelectedHanCandidateId(null);
			setShowHanCandidateDialog(true);

			if (candidates.length === 0) {
				toast.info("Không tìm thấy tờ khai nhập mới phù hợp", {
					description:
						"HAN_2024 không trả về ứng viên nào theo MST của follow-up này.",
				});
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : "Không thể tải HAN";
			setHanCandidatesError(message);
			toast.error("Không thể tải danh sách tờ khai HAN", {
				description: message,
			});
		} finally {
			setHanCandidatesLoading(false);
		}
	}, [followUpId, onHanConnectionResolved, resolvedOperationType]);

	return {
		showHanCandidateDialog,
		setShowHanCandidateDialog,
		hanCandidates,
		hanCandidatesLoading,
		hanCandidatesError,
		selectedHanCandidateId,
		setSelectedHanCandidateId,
		handleOpenHanCandidates,
	};
}
