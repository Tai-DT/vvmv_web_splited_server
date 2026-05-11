"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

type VendorsResponse = {
	vendors: string[];
};

async function fetchVendors(): Promise<string[]> {
	const response = await apiFetch("/api/vendors");
	if (!response.ok) {
		const data = await response.json();
		throw new Error(data.message || "Failed to fetch vendors");
	}
	const data: VendorsResponse = await response.json();
	return data.vendors;
}

export function useVendors() {
	const {
		data: vendors = [],
		isLoading,
		error,
	} = useQuery({
		queryKey: ["vendors"],
		queryFn: fetchVendors,
		staleTime: 5 * 60 * 1000, // 5 minutes - reference data changes rarely
		gcTime: 30 * 60 * 1000, // 30 minutes garbage collection
	});

	return {
		vendors,
		isLoading,
		error: error instanceof Error ? error.message : null,
	};
}
