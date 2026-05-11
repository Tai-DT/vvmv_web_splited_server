"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

type UnitsResponse = {
	units: string[];
};

async function fetchUnits(): Promise<string[]> {
	const response = await apiFetch("/api/units");
	if (!response.ok) {
		const data = await response.json();
		throw new Error(data.message || "Failed to fetch units");
	}
	const data: UnitsResponse = await response.json();
	return data.units;
}

export function useUnits() {
	const {
		data: units = [],
		isLoading,
		error,
	} = useQuery({
		queryKey: ["units"],
		queryFn: fetchUnits,
		staleTime: 5 * 60 * 1000, // 5 minutes - reference data changes rarely
		gcTime: 30 * 60 * 1000, // 30 minutes garbage collection
	});

	return {
		units,
		isLoading,
		error: error instanceof Error ? error.message : null,
	};
}
