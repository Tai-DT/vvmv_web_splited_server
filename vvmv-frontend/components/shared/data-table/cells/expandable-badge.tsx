"use client";

import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipPositioner,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface BadgeConfig {
	/** Icon component to display */
	icon: LucideIcon;
	/** Badge count */
	count: number;
	/** Tab identifier for expansion */
	tabId: string;
	/** Tooltip label */
	label: string;
	/** Badge color classes */
	colorClasses: string;
	/** Always render this badge even when count is 0 */
	alwaysVisible?: boolean;
	/** Hide the numeric count and show icon only */
	hideCount?: boolean;
	/** Override the accessible label for the interactive badge */
	ariaLabel?: string;
}

interface ExpandableBadgeProps {
	config: BadgeConfig;
	isExpanded: boolean;
	currentTab?: string;
	onToggle: (tabId: string) => void;
	tabIndex?: number;
}

/**
 * ExpandableBadge - Shared badge button component for row expansion
 *
 * Used in actions column to display counts and trigger row expansion with specific tab.
 * Handles both click and keyboard navigation.
 */
export function ExpandableBadge({
	config,
	isExpanded,
	currentTab,
	onToggle,
	tabIndex,
}: ExpandableBadgeProps) {
	const { icon: Icon, count: rawCount, tabId, label, colorClasses } = config;
	const count = Number.isFinite(rawCount) ? rawCount : 0;
	const shouldRender = config.alwaysVisible || count > 0;
	const isActive = isExpanded && currentTab === tabId;

	if (!shouldRender) return null;

	const handleActivate = (e: React.MouseEvent<HTMLButtonElement>) => {
		e.stopPropagation();
		onToggle(tabId);
	};

	const tooltipLabel =
		count > 0 && !config.hideCount ? `${label}: ${count}` : label;
	const accessibilityLabel = config.ariaLabel || tooltipLabel;
	const trigger = (
		<button
			type="button"
			className="inline-flex cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			aria-label={accessibilityLabel}
			aria-pressed={isActive}
			tabIndex={tabIndex}
			onClick={handleActivate}
		>
			<Badge
				variant="outline"
				className={cn(
					"shrink-0 font-medium transition-colors hover:opacity-80",
					config.hideCount
						? "size-4 justify-center p-0 max-md:size-8 max-md:min-h-10 max-md:min-w-10"
						: "h-4 gap-0.5 px-1 text-[9px] max-md:h-8 max-md:min-h-9 max-md:px-2 max-md:text-[10px]",
					isActive && "ring-1 ring-current/20",
					colorClasses,
				)}
			>
				<Icon
					className={cn(
						config.hideCount
							? "size-2.5 max-md:size-4"
							: "size-2 max-md:size-3",
					)}
				/>
				{config.hideCount ? null : String(count)}
			</Badge>
		</button>
	);

	return (
		<Tooltip>
			<TooltipTrigger render={trigger} />
			<TooltipPositioner side="top">
				<TooltipContent>{tooltipLabel}</TooltipContent>
			</TooltipPositioner>
		</Tooltip>
	);
}
