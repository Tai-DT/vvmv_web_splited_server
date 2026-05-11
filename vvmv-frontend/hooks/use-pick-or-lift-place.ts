"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

type PickOrLiftPlaceResponse = {
	pickOrLiftPlaces: string[];
};

async function fetchPickOrLiftPlaces(): Promise<string[]> {
	const response = await apiFetch("/api/pick-or-lift-place");
	if (!response.ok) {
		const data = await response.json();
		throw new Error(data.message || "Failed to fetch pick or lift places");
	}
	const data: PickOrLiftPlaceResponse = await response.json();
	return data.pickOrLiftPlaces;
}

export function usePickOrLiftPlaces() {
	const {
		data: pickOrLiftPlaces = [],
		isLoading,
		error,
	} = useQuery({
		queryKey: ["pick-or-lift-places"],
		queryFn: fetchPickOrLiftPlaces,
		staleTime: 5 * 60 * 1000, // 5 minutes - reference data changes rarely
		gcTime: 30 * 60 * 1000, // 30 minutes garbage collection
	});

	return {
		pickOrLiftPlaces,
		isLoading,
		error: error instanceof Error ? error.message : null,
	};
}
