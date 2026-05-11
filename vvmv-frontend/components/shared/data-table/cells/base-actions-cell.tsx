"use client";

import type { Row, Table } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { TooltipProvider } from "@/components/ui/tooltip";
import { type BadgeConfig, ExpandableBadge } from "./expandable-badge";

interface BaseActionsCellProps<TData> {
	/** Table row */
	row: Row<TData>;
	/** Table instance */
	table: Table<TData>;
	/** Badge configurations */
	badges: BadgeConfig[];
	/** Actions dropdown component (3-dot menu) */
	actionsDropdown: ReactNode;
	/** Tab index for accessibility */
	tabIndex?: number;
}

/**
 * BaseActionsCell - Unified actions column cell component
 *
 * Layout (same for all tables):
 * [Checkbox] [Badges...] [3-dot menu]
 *
 * Customization:
 * - Badge configurations (icons, counts, colors, tabs)
 * - 3-dot menu content (different actions per table)
 */
export function BaseActionsCell<TData>({
	row,
	table,
	badges,
	actionsDropdown,
	tabIndex,
}: BaseActionsCellProps<TData>) {
	const isExpanded = row.getIsExpanded();
	const currentTab = (table.options.meta as any)?.activeRowTabs?.[row.id];

	const handleBadgeToggle = (tabId: string) => {
		const shouldCollapse = isExpanded && currentTab === tabId;

		if (shouldCollapse) {
			row.toggleExpanded();
		} else {
			// Set active tab first, then expand if needed
			(table.options.meta as any)?.onSubTabClick?.(row.id, tabId);
			if (!isExpanded) {
				row.toggleExpanded();
			}
		}
	};

	return (
		<TooltipProvider delay={200}>
			<div className="flex w-full min-w-0 gap-2">
				{/* Checkbox (always visible) */}
				<Checkbox
					checked={row.getIsSelected()}
					onCheckedChange={(value) => row.toggleSelected(!!value)}
					aria-label="Select row"
					className="mt-0.5 shrink-0 max-md:mt-1"
				/>

				{/* Sub-data badges — scroll horizontally on narrow widths */}
				<div className="flex min-h-9 min-w-0 flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] pb-0.5 sm:flex-wrap sm:overflow-visible sm:pb-0">
					{badges.map((badge) => (
						<ExpandableBadge
							key={badge.tabId}
							config={badge}
							isExpanded={isExpanded}
							currentTab={currentTab}
							onToggle={handleBadgeToggle}
							tabIndex={tabIndex}
						/>
					))}
				</div>

				{/* Actions dropdown (3-dot menu) */}
				<div className="flex h-9 w-9 shrink-0 items-center justify-center sm:h-5 sm:w-5">
					{actionsDropdown}
				</div>
			</div>
		</TooltipProvider>
	);
}
