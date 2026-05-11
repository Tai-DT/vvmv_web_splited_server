"use client";

import type { Row, Table } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import type { TruckingFollowUpRow } from "../../types";

interface TruckingStatusCellProps {
	row: Row<TruckingFollowUpRow>;
	table: Table<TruckingFollowUpRow>;
}

/**
 * TruckingStatusCell Component
 *
 * Renders the status column for trucking follow-up by processing invokerTasks.
 * - Sorts tasks by created time (latest first)
 * - Displays up to 3 task status badges
 * - Handles special FAIL/SUCCESS cases based on message content
 */
export const TruckingStatusCell = ({ row }: TruckingStatusCellProps) => {
	const invokerTasks = row.original.invokerTasks || [];

	if (invokerTasks.length === 0) {
		return <span className="text-muted-foreground">—</span>;
	}

	// Sort tasks by created_time (latest first)
	const sortedTasks = [...invokerTasks].sort((a, b) => {
		const timeA = a.created_time ? new Date(a.created_time).getTime() : 0;
		const timeB = b.created_time ? new Date(b.created_time).getTime() : 0;
		return timeB - timeA;
	});

	// Show task name + status for each task (max 2)
	const displayTasks = sortedTasks.slice(0, 2);

	// Map status to badge variant
	const getStatusVariant = (status: string) => {
		const map: Record<
			string,
			"success" | "info" | "secondary" | "destructive"
		> = {
			Completed: "success",
			SUCCESS: "success",
			Done: "success",
			Finished: "success",
			Processing: "info",
			Pending: "secondary",
			Error: "destructive",
			FAIL: "destructive",
		};
		return map[status] || "secondary";
	};

	return (
		<div className="flex flex-wrap gap-1">
			{displayTasks.map((task, idx) => {
				let status = task.status || "Pending";
				const message = task.message;

				if (status === "Completed" && message?.includes("FAIL - ")) {
					status = "FAIL";
				} else if (status === "Completed" && message?.includes("SUCCESS")) {
					status = "SUCCESS";
				}

				const variant = getStatusVariant(status);

				return (
					<Badge
						key={`${task.task_name}-${idx}`}
						variant={variant}
						className="text-xs px-1 py-0.5"
					>
						{task.task_name}: {status}
					</Badge>
				);
			})}
			{sortedTasks.length > 2 && (
				<span className="text-xs text-muted-foreground">
					+{sortedTasks.length - 2} more
				</span>
			)}
		</div>
	);
};
