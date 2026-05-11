/**
 * Role types for user authorization
 */
export type Role = "CUSTOMER" | "STAFF" | "MANAGER" | "ADMIN" | "SUPERADMIN";

/**
 * Resource types for access control
 */
export type Resource = "external" | "internal";

/**
 * Permission actions
 */
export type Action = "read" | "write" | "delete";

/**
 * Type guard to check if a string is a valid role
 */
export function isValidRole(role: string): role is Role {
	return ["CUSTOMER", "STAFF", "MANAGER", "ADMIN", "SUPERADMIN"].includes(role);
}

/**
 * Helper to safely get role with fallback
 */
export function getRoleOrDefault(role: string | null | undefined): Role {
	if (!role || !isValidRole(role)) {
		return "STAFF"; // Default role
	}
	return role;
}
