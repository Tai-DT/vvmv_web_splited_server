import { useQueryClient } from "@tanstack/react-query";
import type { Row, Table } from "@tanstack/react-table";
import {
	CheckCircle,
	Eye,
	Layers,
	Loader2,
	RefreshCw,
	XCircle,
} from "lucide-react";
import { memo, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCellTabIndex } from "../../../followup/_components/cells/use-cell-tab-index";
import { CopyButton } from "../../../followup/_components/shared/copy-button";
import type { TruckingFollowUpRow } from "../../types";

interface TruckingJobNumberCellProps {
	getValue: () => unknown;
	row: Row<TruckingFollowUpRow>;
	column: { id: string };
	table: Table<TruckingFollowUpRow>;
}

/**
 * TruckingJobNumberCell Component
 *
 * Displays the job number with 2-row layout (matching Logistics):
 * - Row 1: Job number text + sub-jobs badge
 * - Row 2: Finish status + Inspector + Check ERP + Copy
 */
function TruckingJobNumberCellComponent({
	getValue,
	row,
	column,
	table,
}: TruckingJobNumberCellProps) {
	const value = getValue() as string;
	const { id: truckingFollowUpId, isFinished } = row.original;
	const tabIndex = useCellTabIndex(table as any, row.original.id, column.id);
	const [isLoading, setIsLoading] = useState(false);
	const [localIsFinished, setLocalIsFinished] = useState(isFinished ?? false);
	const queryClient = useQueryClient();

	useEffect(() => {
		setLocalIsFinished(isFinished ?? false);
	}, [isFinished]);

	const handleCheckFinished = async () => {
		if (!value) {
			toast.error("Job number is required to check status");
			return;
		}

		setIsLoading(true);
		try {
			const response = await fetch("/api/followup/check-delivered", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ truckingFollowUpId, jobNumber: value }),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.message || "Failed to check status");
			}

			setLocalIsFinished(data.isFinished);
			queryClient.invalidateQueries({ queryKey: ["trucking-followups"] });

			toast.success(
				data.isFinished
					? "✓ Job is FINISHED in ERP"
					: "✗ Job is NOT finished in ERP",
			);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to check status",
			);
		} finally {
			setIsLoading(false);
		}
	};

	if (!value) {
		return (
			<span className="text-muted-foreground" tabIndex={tabIndex}>
				—
			</span>
		);
	}

	return (
		<div className="flex flex-col gap-0.5" tabIndex={tabIndex}>
			{/* Row 1: Job number + sub-jobs badge */}
			<div className="flex items-center gap-1.5">
				<span className="font-semibold text-[13px]">{value}</span>
				{row.original.subJobsCount ? (
					<div
						className="flex items-center gap-0.5 px-1 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded text-[10px] font-medium border border-indigo-100 dark:border-indigo-900/50"
						title={`${row.original.subJobsCount} sub-jobs combined`}
					>
						<Layers className="w-2.5 h-2.5" />
						<span>+{row.original.subJobsCount}</span>
					</div>
				) : null}
			</div>

			{/* Row 2: Action buttons */}
			<div className="flex items-center gap-0.5">
				{/* Finish status indicator */}
				{localIsFinished ? (
					<CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
				) : (
					<XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
				)}

				{/* Inspector button */}
				<Button
					variant="ghost"
					size="icon"
					className="h-5 w-5 shrink-0"
					disabled
					onClick={() =>
						(table.options.meta as any)?.onViewDetails?.(row.original)
					}
					title="Open Details Inspector"
				>
					<Eye className="w-3.5 h-3.5 text-muted-foreground hover:text-indigo-600 transition-colors" />
				</Button>

				{/* Check ERP button */}
				<Button
					variant="ghost"
					size="icon"
					className="h-5 w-5 shrink-0"
					onClick={handleCheckFinished}
					disabled={isLoading}
					title="Check ERP status"
				>
					{isLoading ? (
						<Loader2 className="w-3 h-3 animate-spin" />
					) : (
						<RefreshCw className="w-3 h-3 text-muted-foreground hover:text-blue-500" />
					)}
				</Button>

				{/* Copy button */}
				<CopyButton value={value} label="Job number copied" iconSize="size-3" />
			</div>
		</div>
	);
}

export const TruckingJobNumberCell = memo(TruckingJobNumberCellComponent);
