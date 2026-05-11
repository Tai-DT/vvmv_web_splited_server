"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import type { OperationType } from "@/prisma/client";

export interface ShippingLine {
	id: string;
	name: string;
	operationType: OperationType | null;
}

type ShippingLinesResponse = {
	shippingLines: ShippingLine[];
};

async function fetchShippingLines(
	site?: string,
	operationType?: OperationType | null,
): Promise<ShippingLine[]> {
	const params = new URLSearchParams();
	if (site) params.append("site", site);
	if (operationType) params.append("operationType", operationType);

	const response = await apiFetch(`/api/shipping-lines?${params}`);
	if (!response.ok) {
		const data = await response.json();
		throw new Error(data.message || "Failed to fetch shipping lines");
	}
	const data: ShippingLinesResponse = await response.json();
	return data.shippingLines;
}

export function useShippingLines(
	site?: string,
	operationType?: OperationType | null,
) {
	const {
		data: shippingLines = [],
		isLoading,
		error,
	} = useQuery({
		queryKey: ["shipping-lines", site, operationType],
		queryFn: () => fetchShippingLines(site, operationType),
		staleTime: 5 * 60 * 1000,
		gcTime: 30 * 60 * 1000,
	});

	return {
		shippingLines,
		isLoading,
		error: error instanceof Error ? error.message : null,
	};
}
