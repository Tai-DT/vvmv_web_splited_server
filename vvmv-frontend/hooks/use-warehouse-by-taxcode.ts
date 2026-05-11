"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

export interface WarehouseOption {
	id: string;
	warehouseName: string;
	deliveryAddress?: string | null;
	contactInfo?: string | null;
	invoiceInfo?: string | null;
	notes?: string | null;
	mapPosition?: string | null;
}

type WarehouseResponse = {
	warehouses: WarehouseOption[];
};

async function fetchWarehousesByTaxCode(
	taxCode: string,
): Promise<WarehouseOption[]> {
	if (!taxCode) return [];
	const response = await apiFetch(
		`/api/warehouse-by-taxcode?taxCode=${encodeURIComponent(taxCode)}`,
	);
	if (!response.ok) {
		const data = await response.json();
		throw new Error(data.message || "Failed to fetch warehouses");
	}
	const data: WarehouseResponse = await response.json();
	return data.warehouses;
}

/**
 * Hook to fetch warehouse names (WarehouseConfig) filtered by a customer's
 * taxCode via the PartnersMasterData → WarehouseConfig relationship.
 *
 * @param taxCode - The customer tax code (MST) to look up. Pass "" or null to skip fetching.
 */
export function useWarehouseByTaxCode(taxCode: string | null | undefined) {
	const enabled = Boolean(taxCode && taxCode.trim() !== "");

	const {
		data: warehouses = [],
		isLoading,
		error,
	} = useQuery({
		queryKey: ["warehouses-by-taxcode", taxCode],
		queryFn: () => fetchWarehousesByTaxCode(taxCode!),
		enabled,
		staleTime: 2 * 60 * 1000, // 2 minutes – warehouse data is semi-static
		gcTime: 10 * 60 * 1000,
	});

	return {
		warehouses,
		isLoading,
		error: error instanceof Error ? error.message : null,
	};
}
