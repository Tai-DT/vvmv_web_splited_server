"use client";

import type { Row, Table } from "@tanstack/react-table";
import type { FollowUpRow } from "../../types";
import { useCellTabIndex } from "./use-cell-tab-index";

interface DateTimeCellProps {
	row: Row<FollowUpRow>;
	table: Table<FollowUpRow>;
	column: { id: string };
	getValue: () => unknown;
}

/**
 * DateTimeCell Component
 *
 * Formats and displays datetime fields (createdAt, updatedAt, etc.)
 * Shows date and time in a readable format
 */
export const DateTimeCell = ({
	row,
	table,
	column,
	getValue,
}: DateTimeCellProps) => {
	const dateStr = getValue() as string | null | undefined;
	const tabIndex = useCellTabIndex(table, row.original.id, column.id);

	if (!dateStr)
		return (
			<span className="text-muted-foreground" tabIndex={tabIndex}>
				—
			</span>
		);

	try {
		const date = new Date(dateStr);
		return (
			<span className="text-sm" tabIndex={tabIndex}>
				{date.toLocaleDateString("en-US", {
					year: "numeric",
					month: "short",
					day: "numeric",
					hour: "2-digit",
					minute: "2-digit",
				})}
			</span>
		);
	} catch {
		return (
			<span className="text-muted-foreground" tabIndex={tabIndex}>
				—
			</span>
		);
	}
};
