"use client";

import { getRoleOrDefault, type Role } from "@/types/auth";
import { useSession } from "./auth-client";

/**
 * Client-side hook to check if user has access to a specific resource
 * @param resource - The resource to check access for ('external' or 'internal')
 * @returns boolean indicating if user has access
 */
export function useHasAccess(resource: "external" | "internal"): boolean {
	const { data: session } = useSession();

	if (!session?.user?.role) {
		return false;
	}

	const role = getRoleOrDefault(session.user.role);

	// ADMIN has access to everything
	if (role === "ADMIN") {
		return true;
	}

	// CUSTOMER can only access external
	if (role === "CUSTOMER" && resource === "external") {
		return true;
	}

	// STAFF can only access internal
	if (role === "STAFF" && resource === "internal") {
		return true;
	}

	return false;
}

/**
 * Client-side hook to get the user's role
 * @returns Role or null if not authenticated
 */
export function useUserRole(): Role | null {
	const { data: session } = useSession();

	if (!session?.user?.role) {
		return null;
	}

	return getRoleOrDefault(session.user.role);
}

/**
 * Client-side hook to check if user has a specific role
 * @param role - The role to check
 * @returns boolean indicating if user has the role
 */
export function useHasRole(role: Role): boolean {
	const userRole = useUserRole();
	return userRole === role;
}

/**
 * Client-side hook to check if user is admin
 * @returns boolean indicating if user is admin
 */
export function useIsAdmin(): boolean {
	return useHasRole("ADMIN");
}
