"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useVehicles } from "@/hooks/use-vehicles";
import type { TruckingFollowUpRow } from "../types";

interface UpdateTruckingFollowUpParams {
	id: string;
	field: string;
	value: unknown;
}

// Vietnamese plate number regex pattern
const PLATE_REGEX =
	/\b([0-9]{2}[A-Z]{1,2}[\s\-.]?[0-9]{3,5}(?:[.\s]?[0-9]{1,2})?)\b/i;

export function useTruckingFollowUpMutation() {
	const queryClient = useQueryClient();
	const { vehicles } = useVehicles();

	return useMutation({
		mutationFn: async ({ id, field, value }: UpdateTruckingFollowUpParams) => {
			let matchedPlateNumber: string | undefined;

			// When updating note5 ("Thông tin xe"), extract plate number
			// and validate against cached vehicles list
			if (field === "note5" && value) {
				const note5Value = String(value);
				const plateMatch = note5Value.match(PLATE_REGEX);

				if (plateMatch) {
					const rawPlate = plateMatch[1].replace(/[\s\-.]/g, "").toUpperCase();

					// Check against cached vehicles from ERP
					const matched = vehicles.find(
						(v) => v.replace(/[\s\-.]/g, "").toUpperCase() === rawPlate,
					);

					if (matched) {
						matchedPlateNumber = matched.trim();
					}
				}
			}

			const response = await fetch("/api/trucking-followup/update", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id, field, value, matchedPlateNumber }),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || "Failed to update");
			}

			const result = await response.json();

			// Add frontend-side vehicle sync info for toast
			if (field === "note5" && value) {
				const note5Value = String(value);
				const plateMatch = note5Value.match(PLATE_REGEX);

				if (plateMatch) {
					const rawMatch = plateMatch[1].trim();
					if (matchedPlateNumber) {
						result.vehicleSyncResult = {
							status: "matched",
							message: `Đã đồng bộ BKS "${matchedPlateNumber}" xuống FCR và Container.`,
						};
					} else {
						result.vehicleSyncResult = {
							status: "not_found",
							message: `Biển số "${rawMatch}" không tìm thấy trong hệ thống xe.`,
						};
					}
				} else {
					result.vehicleSyncResult = {
						status: "no_plate",
						message:
							"Không tìm thấy biển số xe trong nội dung. Vui lòng kiểm tra lại format (VD: 29H88352, 29E-149.82).",
					};
				}
			}

			return result;
		},
		onMutate: async ({ id, field, value }) => {
			// Cancel any outgoing refetches
			await queryClient.cancelQueries({ queryKey: ["trucking-followups"] });

			// Snapshot the previous values
			const previousQueries = queryClient.getQueriesData({
				queryKey: ["trucking-followups"],
			});

			// Optimistically update all matching queries in the cache
			queryClient.setQueriesData(
				{ queryKey: ["trucking-followups"] },
				(old: any) => {
					if (!old || !Array.isArray(old.data)) return old;
					return {
						...old,
						data: old.data.map((row: TruckingFollowUpRow) => {
							if (row.id !== id) return row;
							const updated = { ...row, [field]: value };
							// When clearing handler, also clear the resolved handlerUser
							if (field === "handler" && !value) {
								(updated as any).handlerUser = null;
							}
							return updated;
						}),
					};
				},
			);

			return { previousQueries };
		},
		onSuccess: (data) => {
			if (data?.vehicleSyncResult) {
				const { status, message } = data.vehicleSyncResult;
				if (status === "matched") {
					toast.success("Đồng bộ BKS", { description: message });
				} else if (status === "not_found" || status === "no_plate") {
					toast.warning("Cảnh báo BKS", { description: message });
				} else if (status === "error") {
					toast.error("Lỗi tra cứu BKS", { description: message });
				}
			}
		},
		onError: (err, _variables, context) => {
			// If the mutation fails, use the context returned from onMutate to rollback
			if (context?.previousQueries) {
				context.previousQueries.forEach(([queryKey, oldData]) => {
					queryClient.setQueryData(queryKey, oldData);
				});
			}
			toast.error("Update failed", {
				description: err instanceof Error ? err.message : "Unknown error",
			});
		},
		onSettled: () => {
			// Always refetch after error or success
			queryClient.invalidateQueries({ queryKey: ["trucking-followups"] });
			queryClient.invalidateQueries({ queryKey: ["dispatch-board"] });
		},
	});
}
