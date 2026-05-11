"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

interface PartnerWarehouse {
	id: string;
	taxCode: string | null;
	warehouse: string | null;
}

export function usePartnerWarehouses(taxCode?: string | null) {
	const { data: warehouses = [], isLoading } = useQuery({
		queryKey: ["partner-warehouses", taxCode],
		queryFn: async () => {
			if (!taxCode) return [];
			const params = new URLSearchParams({
				search: taxCode,
				pageSize: "100",
			});
			const response = await apiFetch(
				`/api/admin/partners-master-data?${params}`,
			);
			if (!response.ok) return [];
			const data = await response.json();
			// Filter by exact tax code just in case search is fuzzy
			return (data.partners || [])
				.filter((p: any) => p.taxCode === taxCode && p.warehouse)
				.map((p: any) => ({
					id: p.id,
					taxCode: p.taxCode,
					warehouse: p.warehouse,
				}));
		},
		enabled: !!taxCode,
		staleTime: 60 * 1000,
	});

	return { warehouses, isLoading };
}
