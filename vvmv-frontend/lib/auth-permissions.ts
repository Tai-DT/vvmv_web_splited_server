import { createAccessControl } from "better-auth/plugins/access";

/**
 * Access Control Configuration
 * Defines resources and their available actions for RBAC
 *
 * Resources:
 * - external: Customer-facing routes (tracking, public pages)
 * - internal: Staff-only routes (followup management, settings)
 * - admin: Admin-only routes (user management, team management)
 */
const statement = {
	external: ["read", "write"], // Customer-facing resources
	internal: ["read", "write", "delete"], // Internal staff resources
	admin: ["read", "write", "delete"], // Admin resources (user/team management)
} as const;

// Create access control instance
export const ac = createAccessControl(statement);

/**
 * CUSTOMER Role
 * - Can only access external (customer-facing) routes
 * - Read-only access to external resources
 */
export const customerRole = ac.newRole({
	external: ["read"],
});

/**
 * STAFF Role
 * - Can access internal (staff) routes
 * - Full read/write/delete access to internal resources
 * - No admin access
 */
export const staffRole = ac.newRole({
	internal: ["read", "write", "delete"],
});

/**
 * MANAGER Role
 * - Can access internal routes with full permissions
 * - Can access admin routes for user/team management (site-scoped)
 * - Site-specific access (filtered in API routes)
 */
export const managerRole = ac.newRole({
	internal: ["read", "write", "delete"],
	admin: ["read", "write", "delete"],
});

/**
 * ADMIN Role
 * - Full access to all resources
 * - Can access both external and internal routes
 * - Full admin permissions (all sites)
 */
export const adminRole = ac.newRole({
	external: ["read", "write"],
	internal: ["read", "write", "delete"],
	admin: ["read", "write", "delete"],
});
