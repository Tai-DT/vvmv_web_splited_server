"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

export type SiteUser = {
	id: string;
	name: string | null;
	email: string;
	username: string | null;
	image: string | null;
	site: string | null;
};

type SiteUsersResponse = {
	users: SiteUser[];
};

async function fetchSiteUsers(department?: string): Promise<SiteUser[]> {
	const url = department
		? `/api/users/by-site?department=${encodeURIComponent(department)}`
		: "/api/users/by-site";
	const response = await apiFetch(url);
	if (!response.ok) {
		const data = await response.json();
		throw new Error(data.message || "Failed to fetch site users");
	}
	const data: SiteUsersResponse = await response.json();
	return data.users;
}

export function useSiteUsers(department?: string) {
	const {
		data: users = [],
		isLoading,
		error,
	} = useQuery({
		queryKey: ["site-users", department],
		queryFn: () => fetchSiteUsers(department),
		staleTime: 5 * 60 * 1000, // 5 minutes - user data changes rarely
		gcTime: 30 * 60 * 1000, // 30 minutes garbage collection
	});

	return {
		users,
		isLoading,
		error: error instanceof Error ? error.message : null,
	};
}
