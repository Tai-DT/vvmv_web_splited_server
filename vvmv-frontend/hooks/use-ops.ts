"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

type OpsResponse = {
	ops: string[];
};

async function fetchOps(): Promise<string[]> {
	const response = await apiFetch("/api/ops");
	if (!response.ok) {
		const data = await response.json();
		throw new Error(data.message || "Failed to fetch ops");
	}
	const data: OpsResponse = await response.json();
	return data.ops;
}

export function useOps() {
	const {
		data: ops = [],
		isLoading,
		error,
	} = useQuery({
		queryKey: ["ops"],
		queryFn: fetchOps,
		staleTime: 5 * 60 * 1000, // 5 minutes - reference data changes rarely
		gcTime: 30 * 60 * 1000, // 30 minutes garbage collection
	});

	return {
		ops,
		isLoading,
		error: error instanceof Error ? error.message : null,
	};
}
