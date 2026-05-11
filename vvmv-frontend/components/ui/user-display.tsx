"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

export type UserDisplaySize = "xs" | "sm" | "md" | "lg";

export interface UserData {
	id?: string;
	name?: string | null;
	username?: string | null;
	email?: string | null;
	image?: string | null;
}

interface UserDisplayProps {
	user?: UserData | null;
	size?: UserDisplaySize;
	showEmail?: boolean;
	className?: string;
	placeholder?: string;
}

// Size configurations
const sizeConfig: Record<
	UserDisplaySize,
	{ avatar: number; avatarClass: string; nameClass: string; emailClass: string }
> = {
	xs: {
		avatar: 20,
		avatarClass: "h-5 w-5 text-[10px]",
		nameClass: "text-xs",
		emailClass: "text-[10px]",
	},
	sm: {
		avatar: 24,
		avatarClass: "h-6 w-6 text-xs",
		nameClass: "text-xs",
		emailClass: "text-[11px]",
	},
	md: {
		avatar: 28,
		avatarClass: "h-7 w-7 text-sm",
		nameClass: "text-sm",
		emailClass: "text-xs",
	},
	lg: {
		avatar: 36,
		avatarClass: "h-9 w-9 text-base",
		nameClass: "text-sm",
		emailClass: "text-xs",
	},
};

/**
 * UserDisplay Component
 *
 * A reusable component for displaying user information with avatar.
 * Supports multiple sizes: xs, sm, md, lg
 *
 * @example
 * <UserDisplay user={user} size="md" showEmail />
 * <UserDisplay user={user} size="sm" />
 */
export const UserDisplay = ({
	user,
	size = "md",
	showEmail = true,
	className,
	placeholder = "Unknown",
}: UserDisplayProps) => {
	const config = sizeConfig[size];

	if (!user) {
		return <span className="text-muted-foreground">{placeholder}</span>;
	}

	const displayName = user.name || user.username || placeholder;
	const initial = displayName.charAt(0).toUpperCase();

	return (
		<div className={cn("flex items-center gap-2", className)}>
			{/* Avatar */}
			{user.image ? (
				<Image
					src={user.image}
					alt={displayName}
					width={config.avatar}
					height={config.avatar}
					className="rounded-full shrink-0"
				/>
			) : (
				<div
					className={cn(
						"flex items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold shrink-0",
						config.avatarClass,
					)}
				>
					{initial}
				</div>
			)}

			{/* Name & Email */}
			<div className="flex flex-col min-w-0 flex-1 text-left items-start">
				<span
					className={cn("font-medium truncate max-w-full", config.nameClass)}
				>
					{displayName}
				</span>
				{showEmail && user.email && (
					<span
						className={cn(
							"text-muted-foreground truncate max-w-full",
							config.emailClass,
						)}
					>
						{user.email}
					</span>
				)}
			</div>
		</div>
	);
};
