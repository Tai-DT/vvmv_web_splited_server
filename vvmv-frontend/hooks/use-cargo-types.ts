"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

type CargoTypesResponse = {
	cargoTypes: string[];
};

async function fetchCargoTypes(): Promise<string[]> {
	const response = await apiFetch("/api/cargo-types");
	if (!response.ok) {
		const data = await response.json();
		throw new Error(data.message || "Failed to fetch cargo types");
	}
	const data: CargoTypesResponse = await response.json();
	return data.cargoTypes;
}

export function useCargoTypes() {
	const {
		data: cargoTypes = [],
		isLoading,
		error,
	} = useQuery({
		queryKey: ["cargo-types"],
		queryFn: fetchCargoTypes,
		staleTime: 5 * 60 * 1000, // 5 minutes - reference data changes rarely
		gcTime: 30 * 60 * 1000, // 30 minutes garbage collection
	});

	return {
		cargoTypes,
		isLoading,
		error: error instanceof Error ? error.message : null,
	};
}
