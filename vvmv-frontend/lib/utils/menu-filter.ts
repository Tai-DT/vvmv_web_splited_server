import type { SidebarItem } from "@/lib/constants/menu";
import type { Role } from "@/types/auth";

/**
 * Filters menu items based on user's role and department memberships.
 * Admins and SUPERADMINs bypass all filters and see everything.
 *
 * @param items - Array of sidebar menu items to filter
 * @param userRole - User's role (CUSTOMER, STAFF, MANAGER, ADMIN, SUPERADMIN)
 * @param userDepartments - Array of department names the user belongs to (via team memberships)
 * @returns Filtered array of sidebar items the user can access (with filtered children)
 */
export function filterMenuItems(
	items: SidebarItem[],
	userRole: Role,
	userDepartments: string[],
): SidebarItem[] {
	const result: SidebarItem[] = [];

	for (const item of items) {
		// Admins and SUPERADMINs see everything — still recurse to build filtered children
		if (userRole === "ADMIN" || userRole === "SUPERADMIN") {
			if (item.items) {
				const filteredChildren = filterMenuItems(
					item.items,
					userRole,
					userDepartments,
				);
				result.push({ ...item, items: filteredChildren } as SidebarItem);
			} else {
				result.push(item);
			}
			continue;
		}

		// Check role requirement
		if (item.requiredRoles && !item.requiredRoles.includes(userRole)) {
			continue;
		}

		// Check department requirement
		if (item.requiredDepartments && item.requiredDepartments.length > 0) {
			const hasMatchingDept = item.requiredDepartments.some((dept) =>
				userDepartments.includes(dept),
			);
			if (!hasMatchingDept) continue;
		}

		// Recursively filter nested items if they exist
		if (item.items) {
			const filteredChildren = filterMenuItems(
				item.items,
				userRole,
				userDepartments,
			);
			// Only show parent if it has visible children
			if (filteredChildren.length === 0) continue;
			// ✅ Return item with FILTERED children (bug was here — old code returned item.items unfiltered)
			result.push({ ...item, items: filteredChildren } as SidebarItem);
			continue;
		}

		result.push(item);
	}

	return result;
}
