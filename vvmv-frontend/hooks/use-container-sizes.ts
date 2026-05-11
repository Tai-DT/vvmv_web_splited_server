"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";

type ContainerSizesResponse = {
	containerSizes: string[];
};

export function useContainerSizes() {
	const [containerSizes, setContainerSizes] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		async function fetchContainerSizes() {
			try {
				setIsLoading(true);
				setError(null);

				const response = await apiFetch("/api/container-sizes");

				if (!response.ok) {
					const data = await response.json();
					throw new Error(data.message || "Failed to fetch container sizes");
				}

				const data: ContainerSizesResponse = await response.json();
				setContainerSizes(data.containerSizes);
			} catch (err) {
				setError(err instanceof Error ? err.message : "An error occurred");
				setContainerSizes([]);
			} finally {
				setIsLoading(false);
			}
		}

		fetchContainerSizes();
	}, []);

	return { containerSizes, isLoading, error };
}
