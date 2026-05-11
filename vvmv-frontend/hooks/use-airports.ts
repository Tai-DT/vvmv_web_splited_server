"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

export type Airport = {
	id: string;
	name: string;
};

type AirportsResponse = {
	airports: Airport[];
};

async function fetchAirports(): Promise<Airport[]> {
	const response = await apiFetch("/api/airports");
	if (!response.ok) {
		const data = await response.json();
		throw new Error(data.message || "Failed to fetch airports");
	}
	const data: AirportsResponse = await response.json();

	const airportsWithEmpty = [{ id: "", name: "Empty" }, ...data.airports];

	return airportsWithEmpty;
}

export function useAirports() {
	const {
		data: airports = [],
		isLoading,
		error,
	} = useQuery({
		queryKey: ["airports"],
		queryFn: fetchAirports,
		staleTime: 5 * 60 * 1000, // 5 minutes - reference data changes rarely
		gcTime: 30 * 60 * 1000, // 30 minutes garbage collection
	});

	return {
		airports,
		isLoading,
		error: error instanceof Error ? error.message : null,
	};
}
