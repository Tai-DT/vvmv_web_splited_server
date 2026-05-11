"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 60 * 1000, // 1 minute
						gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
						refetchOnWindowFocus: false, // Prevent refetch on tab focus
						retry: 1, // Only retry once on failure
					},
					mutations: {
						retry: 0, // Don't retry mutations
					},
				},
			}),
	);

	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}
