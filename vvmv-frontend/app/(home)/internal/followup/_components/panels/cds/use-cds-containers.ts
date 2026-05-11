// use-cds-containers.ts – container grid logic extracted from cds-info-panel.tsx (Phase 3)
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import type { ContainerRow } from "../../../types";
import { areStringArraysEqual } from "./cds-utils";

const CONTAINER_SLOT_COUNT = 50;

export interface UseCdsContainersParams {
	followUpId: string;
	containers: ContainerRow[];
	onRefresh?: () => void;
}

export function useCdsContainers({
	followUpId,
	containers,
	onRefresh,
}: UseCdsContainersParams) {
	const containerImportFileRef = useRef<HTMLInputElement>(null);

	const [containerGridValues, setContainerGridValues] = useState<string[]>(() =>
		Array.from({ length: CONTAINER_SLOT_COUNT }, () => ""),
	);

	/** 50-slot container grid: sync from real containers prop */
	const containerSlots = useMemo(() => {
		const slots: string[] = Array.from(
			{ length: CONTAINER_SLOT_COUNT },
			() => "",
		);
		containers.forEach((c, i) => {
			if (i < CONTAINER_SLOT_COUNT && c.containerNo) {
				slots[i] = c.containerNo;
			}
		});
		return slots;
	}, [containers]);

	useEffect(() => {
		setContainerGridValues((prev) =>
			areStringArraysEqual(prev, containerSlots) ? prev : [...containerSlots],
		);
	}, [containerSlots]);

	const handleContainerSlotChange = useCallback(
		async (slotIndex: number, value: string) => {
			const trimmed = value.trim();
			const existingContainer = containers[slotIndex];

			if (existingContainer) {
				if (trimmed === (existingContainer.containerNo ?? "")) {
					return;
				}

				try {
					const response = await fetch("/api/followup/update-container", {
						method: "PATCH",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							containerId: existingContainer.id,
							containerNo: trimmed || null,
						}),
					});

					if (!response.ok) {
						const payload = await response.json().catch(() => ({}));
						throw new Error(payload.message || "Cập nhật container thất bại.");
					}

					onRefresh?.();
				} catch (err) {
					console.error("Failed to update container:", err);
					toast.error(
						err instanceof Error ? err.message : "Cập nhật container thất bại.",
					);
				}
			} else if (trimmed) {
				try {
					const response = await fetch("/api/followup/create-container", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							followUpId,
							containerNo: trimmed,
						}),
					});

					if (!response.ok) {
						const payload = await response.json().catch(() => ({}));
						throw new Error(payload.message || "Tạo container thất bại.");
					}

					onRefresh?.();
				} catch (err) {
					console.error("Failed to create container:", err);
					toast.error(
						err instanceof Error ? err.message : "Tạo container thất bại.",
					);
				}
			}
		},
		[containers, followUpId, onRefresh],
	);

	const handleContainerExcelImport = useCallback(
		async (event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			if (!file) return;

			try {
				const arrayBuffer = await file.arrayBuffer();
				const workbook = XLSX.read(arrayBuffer, { type: "array" });
				const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
				const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
					header: 1,
					raw: false,
				});
				const values = rows
					.flat()
					.map((v) => String(v ?? "").trim())
					.filter(Boolean)
					.slice(0, 50);

				if (values.length === 0) {
					toast.error("File không chứa số container nào.");
					return;
				}

				// Create containers that don't exist yet
				const existingNos = new Set(
					containers
						.map((c) => c.containerNo?.trim().toUpperCase())
						.filter(Boolean),
				);

				let created = 0;
				for (const containerNo of values) {
					if (existingNos.has(containerNo.toUpperCase())) continue;
					try {
						await fetch("/api/followup/create-container", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ followUpId, containerNo }),
						});
						created++;
					} catch {
						// skip duplicates
					}
				}

				if (created > 0) {
					toast.success(`Đã nhập ${created} container từ Excel.`);
					onRefresh?.();
				} else {
					toast.info("Tất cả container đã tồn tại.");
				}

				// Reset file input
				event.target.value = "";
			} catch (err) {
				console.error("Excel import error:", err);
				toast.error("Không đọc được file Excel.");
			}
		},
		[containers, followUpId, onRefresh],
	);

	const updateContainerNumber = useCallback((index: number, value: string) => {
		setContainerGridValues((prev) => {
			const next =
				prev.length === CONTAINER_SLOT_COUNT
					? [...prev]
					: Array.from(
							{ length: CONTAINER_SLOT_COUNT },
							(_, slotIndex) => prev[slotIndex] ?? "",
						);

			next[index] = value;
			return next;
		});
	}, []);

	return {
		CONTAINER_SLOT_COUNT,
		containerImportFileRef,
		containerGridValues,
		handleContainerSlotChange,
		handleContainerExcelImport,
		updateContainerNumber,
	};
}
