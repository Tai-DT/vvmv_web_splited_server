"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { FollowUpRow } from "@/app/(home)/internal/followup/types";
import { apiFetch } from "@/lib/api/client";

type UpdateFollowUpParams = {
	id: string;
	field: string;
	value: unknown;
};

/**
 * Custom mutation hook for follow-up updates with optimistic updates.
 * Updates the UI immediately, then syncs with the server in the background.
 * Rolls back on error.
 */
export function useFollowUpMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ id, field, value }: UpdateFollowUpParams) => {
			const response = await apiFetch("/api/followup/update", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id, field, value }),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || "Failed to update field");
			}

			return response.json();
		},

		// Optimistic update - update cache BEFORE server responds
		onMutate: async ({ id, field, value }) => {
			// Cancel any outgoing refetches to prevent race conditions
			await queryClient.cancelQueries({ queryKey: ["followups"] });

			// Snapshot the previous values for rollback
			const previousQueries = queryClient.getQueriesData({
				queryKey: ["followups"],
			});

			// Optimistically update all matching queries in the cache - instant UI change
			queryClient.setQueriesData<FollowUpRow[]>(
				{ queryKey: ["followups"] },
				(old) => {
					if (!Array.isArray(old)) return old;
					return old.map((row) => {
						if (row.id !== id) return row;
						const updated = { ...row, [field]: value };
						// When clearing handler, also clear the resolved handlerUser
						if (field === "handler" && !value) {
							(updated as any).handlerUser = null;
						}
						return updated;
					});
				},
			);

			// Return context with snapshot for rollback
			return { previousQueries };
		},

		// If mutation fails, rollback to previous value
		onError: (error, _variables, context) => {
			if (context?.previousQueries) {
				context.previousQueries.forEach(([queryKey, oldData]) => {
					queryClient.setQueryData(queryKey, oldData);
				});
			}
			toast.error(error instanceof Error ? error.message : "Failed to update", {
				duration: Infinity,
			});
		},

		onSettled: (_data, error) => {
			// Only refetch on success to sync server-computed fields (e.g. status)
			// The optimistic update already handles the UI; this ensures eventual consistency
			// without triggering redundant refetches on every keystroke
			if (!error) {
				queryClient.invalidateQueries({
					queryKey: ["followups"],
					refetchType: "none", // Mark stale but don't refetch immediately
				});
			}
		},
	});
}
