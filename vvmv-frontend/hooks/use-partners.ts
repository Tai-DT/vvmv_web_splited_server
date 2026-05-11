"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

export type Partner = {
	id: string;
	name: string;
	domain?: string;
};

type PartnersResponse = {
	partners: Partner[];
};

async function fetchPartners(): Promise<Partner[]> {
	const response = await apiFetch("/api/partners");
	if (!response.ok) {
		const data = await response.json();
		throw new Error(data.message || "Failed to fetch partners");
	}
	const data: PartnersResponse = await response.json();
	return data.partners;
}

export function usePartners() {
	const {
		data: partners = [],
		isLoading,
		error,
	} = useQuery({
		queryKey: ["partners"],
		queryFn: fetchPartners,
		staleTime: 5 * 60 * 1000, // 5 minutes - reference data changes rarely
		gcTime: 30 * 60 * 1000, // 30 minutes garbage collection
	});

	return {
		partners,
		isLoading,
		error: error instanceof Error ? error.message : null,
	};
}
