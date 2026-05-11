"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

type WorkTypesResponse = {
	workTypes: string[];
};

async function fetchWorkTypes(): Promise<string[]> {
	const response = await apiFetch("/api/work-types");
	if (!response.ok) {
		const data = await response.json();
		throw new Error(data.message || "Failed to fetch work types");
	}
	const data: WorkTypesResponse = await response.json();
	return data.workTypes;
}

export function useWorkTypes() {
	const {
		data: workTypes = [],
		isLoading,
		error,
	} = useQuery({
		queryKey: ["work-types"],
		queryFn: fetchWorkTypes,
		staleTime: 5 * 60 * 1000, // 5 minutes - reference data changes rarely
		gcTime: 30 * 60 * 1000, // 30 minutes garbage collection
	});

	return {
		workTypes,
		isLoading,
		error: error instanceof Error ? error.message : null,
	};
}
