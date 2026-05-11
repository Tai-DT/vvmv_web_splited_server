"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import type { PortType } from "@/prisma/client";

export interface ForeignPort {
	id: string;
	name: string;
	portType: PortType | null;
}

async function fetchForeignPorts(portType?: PortType): Promise<ForeignPort[]> {
	const params = new URLSearchParams();
	if (portType) params.append("portType", portType);
	const res = await apiFetch(`/api/foreign-ports?${params}`);
	if (!res.ok) throw new Error("Failed to fetch foreign ports");
	const data = await res.json();
	return data.ports;
}

export function useForeignPorts(portType?: PortType) {
	const {
		data: ports = [],
		isLoading,
		error,
	} = useQuery({
		queryKey: ["foreign-ports", portType],
		queryFn: () => fetchForeignPorts(portType),
		staleTime: 5 * 60 * 1000,
		gcTime: 30 * 60 * 1000,
	});

	return {
		ports,
		isLoading,
		error: error instanceof Error ? error.message : null,
	};
}
