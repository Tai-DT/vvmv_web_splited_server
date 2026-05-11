"use client";

import type { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type React from "react";
import { useCallback } from "react";
import type { FollowUpRow } from "../../types";

interface SortableHeaderProps {
	column: Column<FollowUpRow, any>;
	children: React.ReactNode;
}

/**
 * SortableHeader Component
 *
 * Handles sorting logic and visual cues for table headers.
 * - Toggles between ASC, DESC, and None
 * - Displays appropriate icons based on sort state
 * - Memoized click handler for performance
 */
export const SortableHeader = ({ column, children }: SortableHeaderProps) => {
	const isSorted = column.getIsSorted();
	const canSort = column.getCanSort();

	const handleClick = useCallback(() => {
		column.toggleSorting(column.getIsSorted() === "asc");
	}, [column]);

	if (!canSort) {
		return <span className="truncate">{children}</span>;
	}

	return (
		<button
			onClick={handleClick}
			className="flex min-w-0 w-full items-center gap-2 hover:text-foreground transition-colors"
			title={
				isSorted === "asc"
					? "Sort descending"
					: isSorted === "desc"
						? "Clear sort"
						: "Sort ascending"
			}
		>
			<span className="min-w-0 flex-1 truncate">{children}</span>
			{isSorted === "asc" && <ArrowUp className="size-4 shrink-0" />}
			{isSorted === "desc" && <ArrowDown className="size-4 shrink-0" />}
			{!isSorted && <ArrowUpDown className="size-4 shrink-0 opacity-50" />}
		</button>
	);
};
