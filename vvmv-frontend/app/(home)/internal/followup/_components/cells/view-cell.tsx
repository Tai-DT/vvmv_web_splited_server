"use client";

import type { Table } from "@tanstack/react-table";
import { memo } from "react";
import { cn } from "@/lib/utils";
import type { FollowUpRow } from "../../types";
import { useCellTabIndex } from "./use-cell-tab-index";

interface ViewCellProps {
	getValue: () => unknown;
	className?: string;
	row: { original: FollowUpRow };
	column: { id: string };
	table: Table<FollowUpRow>;
}

/**
 * ViewCell Component
 *
 * A simple read-only cell component for displaying text values.
 * - Displays plain text with optional monospace font
 * - Shows em-dash for empty/null values
 * - Truncates long text with ellipsis
 */
function ViewCellComponent({
	getValue,
	className,
	row,
	column,
	table,
}: ViewCellProps) {
	const value = getValue() as string | null | undefined;
	const tabIndex = useCellTabIndex(table, row.original.id, column.id);

	if (!value || value.trim() === "") {
		return (
			<span className="text-muted-foreground" tabIndex={tabIndex}>
				—
			</span>
		);
	}

	return (
		<span
			className={cn("text-sm truncate block", className)}
			tabIndex={tabIndex}
		>
			{value}
		</span>
	);
}

export const ViewCell = memo(ViewCellComponent);
