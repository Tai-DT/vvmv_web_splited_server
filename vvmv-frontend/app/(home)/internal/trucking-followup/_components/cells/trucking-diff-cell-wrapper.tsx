"use client";

import { RefreshCw } from "lucide-react";
import type React from "react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { TruckingFollowUpRow } from "../../types";

export function TruckingDiffCellWrapper({
	props,
	children,
}: {
	props: any;
	children: React.ReactNode;
}) {
	const row = props.row.original as TruckingFollowUpRow;
	const columnId = props.column.id as keyof TruckingFollowUpRow;

	// Get followUp value
	const followUpValue =
		row.followUps?.[0]?.[columnId as keyof (typeof row.followUps)[0]];
	const currentValue = row[columnId];

	// Safe comparison
	const isDifferent = useMemo(() => {
		if (!row.followUps || row.followUps.length === 0) return false;

		// Default to comparison of string values
		const currentStr = (currentValue ?? "").toString().trim();
		const followUpStr = (followUpValue ?? "").toString().trim();

		// For numbers we might want to parse floats to ignore trailing zeros,
		// e.g. "10" vs "10.0" but JS toString() usually handles this if they are numeric
		// Let's explicitly check numeric equality if both are valid numbers
		if (
			currentStr !== "" &&
			followUpStr !== "" &&
			!Number.isNaN(Number(currentStr)) &&
			!Number.isNaN(Number(followUpStr))
		) {
			return Number(currentStr) !== Number(followUpStr);
		}

		return currentStr !== followUpStr;
	}, [currentValue, followUpValue, row.followUps]);

	const handleSync = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (props.table?.options?.meta?.updateData) {
			props.table.options.meta.updateData(
				row.id,
				columnId,
				followUpValue ?? null,
			);
		}
	};

	if (isDifferent) {
		return (
			<div className="relative group w-full h-full flex items-center bg-orange-50/50 dark:bg-orange-950/20">
				<div className="flex-1 overflow-hidden" title="Khác với Follow-up">
					{children}
				</div>
				<div className="absolute right-1 flex flex-col items-end z-10 mr-1 p-0.5 rounded shadow-sm bg-white/90 dark:bg-zinc-900/90 border border-orange-200 dark:border-orange-800">
					<div className="flex items-center gap-1">
						<span
							className="text-[10px] text-orange-600 font-bold max-w-[60px] truncate"
							title={`Follow-up: ${followUpValue}`}
						>
							F:{" "}
							{followUpValue !== null && followUpValue !== undefined
								? String(followUpValue)
								: "Trống"}
						</span>
						<Button
							variant="ghost"
							size="icon"
							className="h-4 w-4 bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-900 dark:text-orange-300 dark:hover:bg-orange-800"
							onClick={handleSync}
							title="Cập nhật theo Follow-up"
						>
							<RefreshCw className="h-2.5 w-2.5" />
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return <>{children}</>;
}
