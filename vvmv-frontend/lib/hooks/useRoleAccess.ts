"use client";

import { useUserRole } from "@/lib/auth-utils";

/**
 * Hook to check user's role access
 * Compatible with AppSidebar component expectations
 */
export function useRoleAccess() {
	const role = useUserRole();

	return {
		isCustomer: role === "CUSTOMER",
		isStaff: role === "STAFF",
		isAdmin: role === "ADMIN",
		// Legacy compatibility (not used in this app, but AppSidebar might expect these)
		isCrew: false,
		isAgency: false,
		isPlanner: false,
		isAgencyOrPlanner: false,
	};
}
