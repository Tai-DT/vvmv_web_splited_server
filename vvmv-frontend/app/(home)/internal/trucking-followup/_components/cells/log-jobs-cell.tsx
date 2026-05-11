"use client";

import type { CellContext } from "@tanstack/react-table";
import type { TruckingFollowUpRow } from "../../types";

interface LogJobsCellProps extends CellContext<TruckingFollowUpRow, any> {}

export function LogJobsCell({ row }: LogJobsCellProps) {
	const followUps = row.original.followUps || [];

	// Extract all job numbers from related logistics follow-ups
	const logJobNumbers = followUps
		.map((f) => f.jobNumber)
		.filter((jobNumber): jobNumber is string => !!jobNumber);

	// Remove duplicates
	const uniqueJobNumbers = [...new Set(logJobNumbers)];

	if (uniqueJobNumbers.length === 0) {
		return <span className="text-muted-foreground text-sm">-</span>;
	}

	return (
		<div className="flex flex-col gap-0.5">
			{uniqueJobNumbers.map((jobNumber, index) => (
				<span key={`${jobNumber}-${index}`} className="text-sm text-foreground">
					{jobNumber}
				</span>
			))}
		</div>
	);
}
