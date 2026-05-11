// use-cds-review.ts – review and submission logic extracted from cds-info-panel.tsx (Phase 3)
"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { HanDeclarationPrefillMatch } from "@/lib/followup/han-declaration-loader";
import type {
	CargoListRow,
	CdsStatus,
	FollowUpCdsInfoRow,
} from "../../../types";
import {
	type CdsHanConnectionInfo,
	parseCdsHanConnectionInfo,
} from "./cds-han-connection-info";
import { normalizeImportCollectionFields } from "./cds-normalize";
import {
	hydrateCdsInfoUiFields,
	mergeHanPrefillIntoCdsData,
} from "./cds-prefill";

export interface UseCdsReviewParams {
	followUpId: string;
	data: Partial<FollowUpCdsInfoRow>;
	setData: React.Dispatch<React.SetStateAction<Partial<FollowUpCdsInfoRow>>>;
	setCargoList?: (items: Partial<CargoListRow>[]) => void;
	flushBufferedFieldCommitsAndWait: () => Promise<void>;
	onRefresh?: () => void;
	onHanConnectionResolved?: (info: CdsHanConnectionInfo | null) => void;
}

export function useCdsReview({
	followUpId,
	data,
	setData,
	setCargoList,
	flushBufferedFieldCommitsAndWait,
	onRefresh,
	onHanConnectionResolved,
}: UseCdsReviewParams) {
	const [isSaving, setIsSaving] = useState(false);
	const [isRegistering, setIsRegistering] = useState(false);
	const [showConfirmDialog, setShowConfirmDialog] = useState(false);
	const latestDataRef = useRef(data);

	latestDataRef.current = data;

	const cdsStatus: CdsStatus =
		data.cdsStatus === "REGISTERED" ? "REGISTERED" : "DRAFT";
	const isSubmitted = cdsStatus === "REGISTERED";
	const statusBadgeLabel = cdsStatus;

	const reloadPersistedCdsInfo = useCallback(async () => {
		const response = await fetch(`/api/followup/${followUpId}/cds-info`, {
			cache: "no-store",
		});

		if (!response.ok) {
			throw new Error("Không thể tải lại CDS info sau khi truyền qua VNACC");
		}

		const payload = await response.json().catch(() => ({}));
		const savedData = payload?.data as Partial<FollowUpCdsInfoRow> | undefined;

		if (savedData && typeof savedData === "object") {
			const normalizedData = normalizeImportCollectionFields(savedData);
			setData(hydrateCdsInfoUiFields(normalizedData));
		}

		return savedData;
	}, [followUpId, setData]);

	const saveCdsPayload = useCallback(
		async (
			payloadData: Partial<FollowUpCdsInfoRow>,
			showSuccessToast = true,
			options?: { preserveLifecycle?: boolean },
		) => {
			const response = await fetch(`/api/followup/${followUpId}/cds-info`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					data: payloadData,
					preserveLifecycle: options?.preserveLifecycle === true,
				}),
			});

			const responsePayload = await response.json().catch(() => ({}));

			if (!response.ok) {
				if (responsePayload?.code === "CDS_DECLARATION_LOCKED") {
					const syncedData = responsePayload?.data as
						| Partial<FollowUpCdsInfoRow>
						| undefined;
					if (syncedData && typeof syncedData === "object") {
						const normalizedData = normalizeImportCollectionFields(syncedData);
						setData(hydrateCdsInfoUiFields(normalizedData));
					}

					const nextCargoList = Array.isArray(responsePayload?.cargoList)
						? (responsePayload.cargoList as Partial<CargoListRow>[])
						: null;
					if (nextCargoList && setCargoList) {
						setCargoList(nextCargoList);
					}

					toast.warning("Tờ khai đã được app cấp số", {
						description:
							responsePayload.error ||
							"Web đã chặn cập nhật và đồng bộ lại dữ liệu mới nhất từ app.",
					});

					return syncedData;
				}

				throw new Error(responsePayload.error || "Lưu thông tin CDS thất bại");
			}

			if (showSuccessToast) {
				toast.success("Đã lưu thông tin CDS");
			}

			return responsePayload?.data as Partial<FollowUpCdsInfoRow> | undefined;
		},
		[followUpId, setCargoList, setData],
	);

	const syncRoundTripDeclaration = useCallback(
		async (
			roundTripDeclaration: HanDeclarationPrefillMatch | null | undefined,
			lifecycleData: Partial<FollowUpCdsInfoRow>,
		) => {
			if (!roundTripDeclaration?.prefill) {
				return false;
			}

			const nextData = mergeHanPrefillIntoCdsData(
				{
					...latestDataRef.current,
					...lifecycleData,
				},
				roundTripDeclaration.prefill,
			);

			latestDataRef.current = nextData;
			setData(nextData);

			await saveCdsPayload(nextData, false, { preserveLifecycle: true });

			const hanCargoList = Array.isArray(roundTripDeclaration.cargoList)
				? (roundTripDeclaration.cargoList as Partial<CargoListRow>[])
				: [];

			if (hanCargoList.length > 0 && setCargoList) {
				setCargoList(hanCargoList);

				const cargoResponse = await fetch(`/api/followup/${followUpId}/cargo`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ items: hanCargoList }),
				});

				if (!cargoResponse.ok) {
					const cargoPayload = await cargoResponse.json().catch(() => ({}));
					throw new Error(
						cargoPayload?.error ||
							"Đã nạp được CDS từ data của người dùng nhưng chưa đồng bộ được Danh sách hàng",
					);
				}
			}

			return true;
		},
		[followUpId, saveCdsPayload, setCargoList, setData],
	);

	const saveCurrentCdsInfo = useCallback(
		async (
			showSuccessToast = true,
			options?: { preserveLifecycle?: boolean },
		) => {
			await flushBufferedFieldCommitsAndWait();
			const savedData = await saveCdsPayload(
				latestDataRef.current,
				showSuccessToast,
				options,
			);
			if (savedData && typeof savedData === "object") {
				const normalizedData = normalizeImportCollectionFields(savedData);
				setData(hydrateCdsInfoUiFields(normalizedData));
			}
			return savedData;
		},
		[flushBufferedFieldCommitsAndWait, saveCdsPayload, setData],
	);

	const handleSave = useCallback(async () => {
		setIsSaving(true);
		try {
			await saveCurrentCdsInfo();
			onRefresh?.();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Không thể lưu dữ liệu");
		} finally {
			setIsSaving(false);
		}
	}, [saveCurrentCdsInfo, onRefresh]);

	const executeRegisterDeclaration = useCallback(
		async (options?: { declarationId?: number | null }) => {
			setIsRegistering(true);
			setShowConfirmDialog(false);
			try {
				const preferredDeclarationId =
					options?.declarationId && Number.isFinite(options.declarationId)
						? options.declarationId
						: typeof latestDataRef.current.ecusDeclarationId === "number" &&
								Number.isFinite(latestDataRef.current.ecusDeclarationId)
							? latestDataRef.current.ecusDeclarationId
							: null;

				await saveCurrentCdsInfo(false);
				const response = await fetch(`/api/followup/${followUpId}/register`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body:
						preferredDeclarationId !== null
							? JSON.stringify({ declarationId: preferredDeclarationId })
							: undefined,
				});
				const payload = await response.json().catch(() => ({}));

				if (!response.ok) {
					throw new Error(payload.error || "Lỗi khi truyền qua VNACC");
				}
				onHanConnectionResolved?.(
					parseCdsHanConnectionInfo(payload.data?.hanConnection),
				);

				const lifecycleData: Partial<FollowUpCdsInfoRow> = {
					cdsStatus: "REGISTERED",
					ecusDeclarationId:
						typeof payload.data?.declarationId === "number"
							? payload.data.declarationId
							: null,
					registeredAt:
						typeof payload.data?.registeredAt === "string"
							? payload.data.registeredAt
							: null,
					registeredBy:
						typeof payload.data?.registeredBy === "string"
							? payload.data.registeredBy
							: null,
				};
				const roundTripDeclaration = (payload.data?.roundTripDeclaration ??
					null) as HanDeclarationPrefillMatch | null;

				try {
					const synced = await syncRoundTripDeclaration(
						roundTripDeclaration,
						lifecycleData,
					);

					if (!synced) {
						await reloadPersistedCdsInfo();
					}
				} catch (syncError) {
					await reloadPersistedCdsInfo();
					toast.warning("Đã truyền qua VNACC nhưng chưa nạp ngược đủ dữ liệu", {
						description:
							syncError instanceof Error
								? syncError.message
								: "Không thể nạp dữ liệu round-trip từ app về web.",
					});
				}

				const verify = payload.data?.verify as
					| {
							passed?: boolean;
							header?: { totalDifferentFields?: number };
							cargo?: { totalDifferentFields?: number };
					  }
					| undefined;
				const verifyDescription = verify?.passed
					? "Round-trip verify đã khớp với data của người dùng vừa ghi."
					: `Round-trip verify còn ${verify?.header?.totalDifferentFields ?? 0} lệch header và ${verify?.cargo?.totalDifferentFields ?? 0} lệch cargo.`;
				const statusLabel =
					payload.data?.status === "reused"
						? "cập nhật bản ghi nháp"
						: "tạo bản ghi mới";

				toast.success("Đã truyền dữ liệu qua VNACC", {
					description: `${statusLabel}. ID: ${payload.data?.declarationId ?? "—"} · Số TK: ${payload.data?.declarationNumber ?? "—"}.`,
				});
				if (verifyDescription) {
					const method = verify?.passed ? toast.success : toast.warning;
					method("Kiểm tra round-trip CDS ↔ data của người dùng", {
						description: verifyDescription,
					});
				}
				onRefresh?.();
				return payload.data;
			} catch (err) {
				toast.error("Truyền qua VNACC thất bại", {
					description:
						err instanceof Error ? err.message : "Lỗi không xác định",
				});
				return null;
			} finally {
				setIsRegistering(false);
			}
		},
		[
			saveCurrentCdsInfo,
			followUpId,
			onHanConnectionResolved,
			onRefresh,
			reloadPersistedCdsInfo,
			syncRoundTripDeclaration,
		],
	);

	const handleRegisterDeclaration = useCallback(() => {
		setShowConfirmDialog(true);
	}, []);

	return {
		isSaving,
		isRegistering,
		showConfirmDialog,
		setShowConfirmDialog,
		cdsStatus,
		isSubmitted,
		statusBadgeLabel,
		handleSave,
		handleRegisterDeclaration,
		executeRegisterDeclaration,
		saveCurrentCdsInfo,
	};
}
