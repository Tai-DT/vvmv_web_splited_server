import { UserRole } from "@/prisma/client";

/**
 * User role options for forms
 * This is automatically derived from the Prisma UserRole enum
 * to ensure it stays in sync with the database schema
 */
export const USER_ROLE_OPTIONS = Object.values(UserRole).map((role) => ({
	value: role,
	label: formatRoleLabel(role),
}));

/**
 * Format role value to human-readable label
 */
function formatRoleLabel(role: UserRole): string {
	const labelMap: Record<UserRole, string> = {
		CUSTOMER: "Customer",
		STAFF: "Staff",
		MANAGER: "Manager",
		ADMIN: "Admin",
		SUPERADMIN: "Super Admin",
	};

	return labelMap[role] || role;
}
