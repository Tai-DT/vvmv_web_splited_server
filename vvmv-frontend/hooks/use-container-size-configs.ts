"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

export interface ContainerSizeConfig {
	id: string;
	containerSize: string; // ERP size code
	isoType?: string | null; // ISO 6346 4-char code
	kc?: string | null; // Kích cỡ
	port?: string | null; // Airport/port ID
	site: string;
	createdAt?: string;
	updatedAt?: string;
}

async function fetchContainerSizeConfigs(): Promise<ContainerSizeConfig[]> {
	const res = await apiFetch("/api/container-size-configs");
	if (!res.ok) throw new Error("Failed to fetch container size configs");
	const data = await res.json();
	return data.configs || [];
}

export function useContainerSizeConfigs() {
	const {
		data: configs = [],
		isLoading,
		error,
	} = useQuery<ContainerSizeConfig[]>({
		queryKey: ["container-size-configs"],
		queryFn: fetchContainerSizeConfigs,
		staleTime: 5 * 60 * 1000,
		gcTime: 30 * 60 * 1000,
	});

	/** Lookup config by ERP containerSize string */
	function getConfig(
		containerSize: string | null | undefined,
	): ContainerSizeConfig | undefined {
		if (!containerSize) return undefined;
		return configs.find(
			(c) => c.containerSize.toLowerCase() === containerSize.toLowerCase(),
		);
	}

	return { configs, isLoading, error, getConfig };
}
