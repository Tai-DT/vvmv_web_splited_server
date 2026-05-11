"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

type ServiceModesResponse = {
	serviceModes: string[];
};

async function fetchServiceModes(): Promise<string[]> {
	const response = await apiFetch("/api/service-modes");
	if (!response.ok) {
		const data = await response.json();
		throw new Error(data.message || "Failed to fetch service modes");
	}
	const data: ServiceModesResponse = await response.json();
	return data.serviceModes;
}

export function useServiceModes() {
	const {
		data: serviceModes = [],
		isLoading,
		error,
	} = useQuery({
		queryKey: ["service-modes"],
		queryFn: fetchServiceModes,
		staleTime: 5 * 60 * 1000, // 5 minutes - reference data changes rarely
		gcTime: 30 * 60 * 1000, // 30 minutes garbage collection
	});

	return {
		serviceModes: [...new Set(serviceModes)],
		isLoading,
		error: error instanceof Error ? error.message : null,
	};
}
