"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { Table } from "@tanstack/react-table";
import {
	CheckCircle,
	Eye,
	Loader2,
	RefreshCw,
	Sparkles,
	XCircle,
} from "lucide-react";
import { memo, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { FollowUpRow } from "../../types";
import { GeminiAutoFillDialog } from "../dialogs/gemini-autofill-dialog";
import { CopyButton } from "../shared/copy-button";
import { useCellTabIndex } from "./use-cell-tab-index";

interface JobNumberCellProps {
	getValue: () => unknown;
	row: { original: FollowUpRow };
	column: { id: string };
	table: Table<FollowUpRow>;
}

/**
 * JobNumberCell Component
 *
 * Displays the job number with:
 * - Finish status indicator (✓/✗)
 * - Check ERP button
 * - Copy button
 */
function JobNumberCellComponent({
	getValue,
	row,
	column,
	table,
}: JobNumberCellProps) {
	const value = getValue() as string;
	const { id: followUpId, isFinished, driveUrl } = row.original;
	const tabIndex = useCellTabIndex(table, row.original.id, column.id);

	const [isLoading, setIsLoading] = useState(false);
	const [localIsFinished, setLocalIsFinished] = useState(isFinished ?? false);
	const [isGeminiOpen, setIsGeminiOpen] = useState(false);
	const queryClient = useQueryClient();

	useEffect(() => {
		setLocalIsFinished(isFinished ?? false);
	}, [isFinished]);

	const handleCheckDelivered = async () => {
		if (!value) {
			toast.error("Job number is required to check delivered status");
			return;
		}

		setIsLoading(true);
		try {
			const response = await fetch("/api/followup/check-delivered", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ followUpId, jobNumber: value }),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.message || "Failed to check delivered status");
			}

			setLocalIsFinished(data.isFinished);
			queryClient.invalidateQueries({ queryKey: ["followups"] });

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
			{/* Row 1: Finish status indicator + Job number */}
			<div className="flex items-center gap-1.5">
				<span className="font-semibold text-[13px]">{value}</span>
			</div>

			{/* Row 2: Action buttons — larger touch targets on small screens */}
			<div className="flex max-w-full items-center gap-1 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] pb-0.5 sm:gap-0.5 sm:overflow-visible sm:pb-0">
				{/* Inspector button */}
				{localIsFinished ? (
					<CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-500 max-md:h-4 max-md:w-4" />
				) : (
					<XCircle className="h-3.5 w-3.5 shrink-0 text-red-400 max-md:h-4 max-md:w-4" />
				)}
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 shrink-0 sm:h-5 sm:w-5"
					onClick={() => table.options.meta?.onViewDetails?.(row.original)}
					title="Open Details Inspector"
				>
					<Eye className="h-3.5 w-3.5 text-muted-foreground transition-colors hover:text-indigo-600 sm:h-3.5 sm:w-3.5" />
				</Button>

				{/* Check ERP button */}
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 shrink-0 sm:h-5 sm:w-5"
					onClick={handleCheckDelivered}
					disabled={isLoading}
					title="Check ERP status"
				>
					{isLoading ? (
						<Loader2 className="h-3 w-3 animate-spin" />
					) : (
						<RefreshCw className="h-3 w-3 text-muted-foreground hover:text-blue-500" />
					)}
				</Button>

				{/* Copy button */}
				<CopyButton value={value} label="Job number copied" iconSize="size-3" />

				{/* Gemini AI Auto-fill button */}
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 shrink-0 sm:h-5 sm:w-5"
					onClick={() => setIsGeminiOpen(true)}
					title="AI Auto-fill from documents"
					disabled={isFinished}
				>
					<Sparkles className="h-3.5 w-3.5 text-orange-500 hover:text-orange-600 sm:h-3.5 sm:w-3.5" />
				</Button>
			</div>

			{!isFinished && (
				<GeminiAutoFillDialog
					id={followUpId}
					type="followup"
					jobNumber={value}
					driveUrl={driveUrl}
					isOpen={isGeminiOpen}
					onOpenChange={setIsGeminiOpen}
					onSuccess={() =>
						queryClient.invalidateQueries({ queryKey: ["followups"] })
					}
					initialData={row.original}
				/>
			)}
		</div>
	);
}

export const JobNumberCell = memo(JobNumberCellComponent);
