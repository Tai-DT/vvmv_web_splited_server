import type { VariantProps } from "class-variance-authority";
import { Badge, type badgeVariants } from "@/components/ui/badge";

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

// Role color variants
export const roleVariants: Record<string, BadgeVariant> = {
	SUPERADMIN: "destructive", // Red (highest privilege)
	ADMIN: "destructive", // Red
	MANAGER: "purple", // Purple
	STAFF: "success", // Green
	CUSTOMER: "secondary", // Gray
};

// Site color variants
export const siteVariants: Record<string, BadgeVariant> = {
	SGN: "info", // Blue
	HAN: "success", // Green
	DAD: "purple", // Purple
};

// Legacy color map for backwards compatibility
export const roleColors: Record<string, string> = {
	SUPERADMIN: "bg-red-500",
	ADMIN: "bg-red-500",
	MANAGER: "bg-purple-500",
	STAFF: "bg-green-500",
	CUSTOMER: "bg-gray-500",
};

interface RoleBadgeProps {
	role: string;
	className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
	const variant = roleVariants[role] || "secondary";
	return (
		<Badge variant={variant} className={className}>
			{role}
		</Badge>
	);
}

interface SiteBadgeProps {
	site: string | null;
	className?: string;
}

export function SiteBadge({ site, className }: SiteBadgeProps) {
	if (!site) return "-";

	const variant = siteVariants[site] || "secondary";
	return (
		<Badge variant={variant} className={className}>
			{site}
		</Badge>
	);
}
