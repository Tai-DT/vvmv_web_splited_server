// use-cds-data.ts – data fetching hooks extracted from cds-info-panel.tsx (Phase 3)
"use client";

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { buildFollowUpPreferredCdsInfoPayload } from "@/lib/followup/cds-followup-field-sync";
import type { CompanyProfileDefaults } from "@/lib/followup/company-profile-defaults";
import type { FollowUpOperationType } from "@/lib/followup/operation-type";
import { deriveOperationType } from "@/lib/followup/operation-type";
import type {
	CargoListRow,
	DeclarationRow,
	FollowUpCdsInfoRow,
	FollowUpRow,
} from "../../../types";
import {
	type CdsHanConnectionInfo,
	parseCdsHanConnectionInfo,
} from "./cds-han-connection-info";
import type { CdsDatabaseLookupsPayload } from "./cds-lookup-types";
import { normalizeImportCollectionFields } from "./cds-normalize";
import {
	buildExportPrefillPayload,
	buildImportPrefillPayload,
	hydrateCdsInfoUiFields,
	mergeMissingFieldValues,
	mergePreferredFieldValues,
} from "./cds-prefill";

const CDS_LOOKUP_CACHE_TTL_MS = 5 * 60 * 1000;
const CDS_LOOKUP_REQUEST_TIMEOUT_MS = 12000;
let cdsLookupsCache: {
	cacheKey: string;
	fetchedAt: number;
	payload: CdsDatabaseLookupsPayload;
} | null = null;

async function fetchCdsLookupsWithRetry(
	followUpId: string,
	options?: {
		attempts?: number;
		mode?: "fast" | "full";
	},
) {
	const attempts = options?.attempts ?? 2;
	const mode = options?.mode ?? "fast";
	const params = new URLSearchParams({ followUpId, mode });

	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		const controller = new AbortController();
		const timeout = setTimeout(
			() => controller.abort(),
			CDS_LOOKUP_REQUEST_TIMEOUT_MS,
		);
		try {
			const response = await fetch(`/api/followup/cds-lookups?${params}`, {
				cache: "no-store",
				signal: controller.signal,
			});

			if (!response.ok) {
				if (attempt === attempts) {
					clearTimeout(timeout);
					return null;
				}

				clearTimeout(timeout);
				continue;
			}

			const payload = (await response.json()) as {
				data?: CdsDatabaseLookupsPayload;
			};
			clearTimeout(timeout);

			if (payload.data) {
				return payload.data;
			}
		} catch {
			clearTimeout(timeout);
			if (attempt === attempts) {
				return null;
			}
		}
	}

	return null;
}

export interface UseCdsDataParams {
	followUpId: string;
	operationType: FollowUpOperationType | null;
	followUpSummary?: Partial<FollowUpRow> | null;
	declarations?: DeclarationRow[];
}

export function useCdsData({
	followUpId,
	operationType,
	followUpSummary,
	declarations = [],
}: UseCdsDataParams) {
	const [data, setData] = useState<Partial<FollowUpCdsInfoRow>>({});
	const [cargoList, setCargoList] = useState<Partial<CargoListRow>[]>([]);
	const [cdsLookups, setCdsLookups] =
		useState<CdsDatabaseLookupsPayload | null>(null);
	const [companyProfile, setCompanyProfile] =
		useState<CompanyProfileDefaults | null>(null);
	const [hanConnection, setHanConnection] =
		useState<CdsHanConnectionInfo | null>(null);
	const [hanConnectionError, setHanConnectionError] = useState<string | null>(
		null,
	);
	const [isLookupLoading, setIsLookupLoading] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const lookupRequestIdRef = useRef(0);
	const lookupInFlightRef = useRef(false);

	const resolvedOperationType = React.useMemo(
		() =>
			deriveOperationType({ operationType, operationCode: data.operationCode }),
		[data.operationCode, operationType],
	);

	const latestFetchContextRef = useRef({
		declarations,
		followUpSummary,
		resolvedOperationType,
	});

	useEffect(() => {
		latestFetchContextRef.current = {
			declarations,
			followUpSummary,
			resolvedOperationType,
		};
	}, [declarations, followUpSummary, resolvedOperationType]);

	const fetchData = useCallback(
		async (options?: { forceOperationType?: FollowUpOperationType | null }) => {
			setIsLoading(true);
			setError(null);
			try {
				const [cdsResponse, cargoResponse] = await Promise.all([
					fetch(`/api/followup/${followUpId}/cds-info`),
					fetch(`/api/followup/${followUpId}/cargo`),
				]);

				if (!cdsResponse.ok) {
					throw new Error("Không thể tải dữ liệu CDS");
				}

				const payload = await cdsResponse.json();
				const rawData = payload?.data || {};
				const historyDefaults = payload?.historyDefaults || {};
				const nextCompanyProfile =
					payload?.companyProfile && typeof payload.companyProfile === "object"
						? (payload.companyProfile as CompanyProfileDefaults)
						: null;
				const nextHanConnection = parseCdsHanConnectionInfo(
					payload?.hanConnection,
				);
				const nextHanConnectionError =
					typeof payload?.hanConnectionError === "string"
						? payload.hanConnectionError
						: null;
				const crossOperationReferenceDefaults =
					payload?.crossOperationReferenceDefaults ||
					payload?.exportReferenceDefaults ||
					{};
				const fetchContext = latestFetchContextRef.current;
				const effectiveOperationType =
					options?.forceOperationType ?? fetchContext.resolvedOperationType;
				const prefillPayload =
					effectiveOperationType === "XUAT"
						? buildExportPrefillPayload({
								followUpSummary: fetchContext.followUpSummary,
								declarations: fetchContext.declarations,
								companyProfile: nextCompanyProfile,
							})
						: effectiveOperationType === "NHAP"
							? buildImportPrefillPayload({
									followUpSummary: fetchContext.followUpSummary,
									declarations: fetchContext.declarations,
									companyProfile: nextCompanyProfile,
								})
							: null;
				const followUpPreferredPayload = buildFollowUpPreferredCdsInfoPayload(
					fetchContext.followUpSummary,
				);

				const normalizedData = normalizeImportCollectionFields(
					mergePreferredFieldValues(
						mergeMissingFieldValues(
							prefillPayload
								? mergeMissingFieldValues(rawData, prefillPayload)
								: rawData,
							mergeMissingFieldValues(
								historyDefaults,
								crossOperationReferenceDefaults,
							),
						),
						followUpPreferredPayload,
					),
				);

				setCompanyProfile(nextCompanyProfile);
				setHanConnection(nextHanConnection);
				setHanConnectionError(nextHanConnectionError);
				setData(hydrateCdsInfoUiFields(normalizedData));

				if (cargoResponse.ok) {
					const cargoPayload = await cargoResponse.json();
					setCargoList(Array.isArray(cargoPayload) ? cargoPayload : []);
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Có lỗi khi tải dữ liệu");
			} finally {
				setIsLoading(false);
			}
		},
		[followUpId],
	);

	const fetchLookups = useCallback(
		async (forceRefresh = false) => {
			if (lookupInFlightRef.current) {
				return false;
			}

			const requestId = lookupRequestIdRef.current + 1;
			lookupRequestIdRef.current = requestId;

			const cacheCheckAt = Date.now();
			if (
				!forceRefresh &&
				cdsLookupsCache &&
				cdsLookupsCache.cacheKey === followUpId &&
				cacheCheckAt - cdsLookupsCache.fetchedAt < CDS_LOOKUP_CACHE_TTL_MS
			) {
				setCdsLookups(cdsLookupsCache.payload);
				return true;
			}

			lookupInFlightRef.current = true;
			setIsLookupLoading(true);
			try {
				const payload = await fetchCdsLookupsWithRetry(followUpId, {
					attempts: forceRefresh ? 2 : 1,
					mode: forceRefresh ? "full" : "fast",
				});

				if (lookupRequestIdRef.current !== requestId) {
					return false;
				}

				if (!payload) {
					return false;
				}

				cdsLookupsCache = {
					cacheKey: followUpId,
					fetchedAt: Date.now(),
					payload,
				};
				setCdsLookups(payload);

				return true;
			} finally {
				lookupInFlightRef.current = false;
				setIsLookupLoading(false);
			}
		},
		[followUpId],
	);

	const handleReloadLookups = useCallback(async () => {
		const ok = await fetchLookups(true);

		if (ok) {
			toast.success("Đã làm mới danh mục lookup", {
				description: "Nguồn dữ liệu được tải lại từ DD Info theo MST hiện tại.",
			});
			return;
		}

		toast.error("Không thể làm mới danh mục lookup", {
			description: "Vui lòng kiểm tra kết nối rồi thử lại.",
		});
	}, [fetchLookups]);

	useEffect(() => {
		void fetchData();
	}, [fetchData]);

	useEffect(() => {
		void fetchLookups();
	}, [fetchLookups]);

	return {
		data,
		setData,
		cargoList,
		setCargoList,
		cdsLookups,
		setCdsLookups,
		companyProfile,
		hanConnection,
		setHanConnection,
		hanConnectionError,
		setHanConnectionError,
		isLoading,
		isLookupLoading,
		error,
		setError,
		resolvedOperationType,
		fetchData,
		fetchLookups,
		handleReloadLookups,
	};
}
