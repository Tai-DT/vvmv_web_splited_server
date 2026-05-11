"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

type TruckTypesResponse = {
	truckTypes: string[];
};

async function fetchTruckTypes(): Promise<string[]> {
	const response = await apiFetch("/api/truck-types");
	if (!response.ok) {
		const data = await response.json();
		throw new Error(data.message || "Failed to fetch truck types");
	}
	const data: TruckTypesResponse = await response.json();
	return data.truckTypes;
}

export function useTruckTypes() {
	const {
		data: truckTypes = [],
		isLoading,
		error,
	} = useQuery({
		queryKey: ["truck-types"],
		queryFn: fetchTruckTypes,
		staleTime: 15 * 60 * 1000, // 15 minutes
		gcTime: 60 * 60 * 1000, // 60 minutes
	});

	return {
		truckTypes,
		isLoading,
		error: error instanceof Error ? error.message : null,
	};
}
