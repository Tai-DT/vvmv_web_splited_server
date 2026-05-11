"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

type VehiclesResponse = {
	vehicles: string[];
};

async function fetchVehicles(): Promise<string[]> {
	const response = await apiFetch("/api/vehicles");
	if (!response.ok) {
		const data = await response.json();
		throw new Error(data.message || "Failed to fetch vehicles");
	}
	const data: VehiclesResponse = await response.json();
	return data.vehicles;
}

export function useVehicles() {
	const {
		data: vehicles = [],
		isLoading,
		error,
	} = useQuery({
		queryKey: ["vehicles"],
		queryFn: fetchVehicles,
		staleTime: 10 * 60 * 1000, // 10 minutes - reference data changes rarely
		gcTime: 60 * 60 * 1000, // 60 minutes garbage collection
	});

	return {
		vehicles,
		isLoading,
		error: error instanceof Error ? error.message : null,
	};
}
