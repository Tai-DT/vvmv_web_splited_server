"use client";

import { useMemo } from "react";
import { EditableCell } from "../../../followup/_components/cells/editable-cell";
import type { TruckingFollowUpRow } from "../../types";
import { TruckingDiffCellWrapper } from "./trucking-diff-cell-wrapper";

/**
 * TruckingGrossWeightCell Component
 *
 * Displays the total Gross Weight for a Trucking Follow-up row.
 * If the row has associated containers (direct or via logistics follow-ups)
 * or associated FCR records, the cell becomes read-only and displays the sum.
 *
 * The API already merges direct and linked containers into row.containers.
 */
export function TruckingGrossWeightCell(props: any) {
	const row = props.row.original as TruckingFollowUpRow;

	// Calculate total gross weight from containers or FCRs
	const { totalGW, source } = useMemo(() => {
		// 1. Check containers first
		if (row.containers && row.containers.length > 0) {
			return {
				totalGW: row.containers.reduce(
					(sum, c) => sum + (Number(c.grossWeight) || 0),
					0,
				),
				source: "containers",
			};
		}

		// 2. Fallback to FCRs if no containers
		if (row.fcrs && row.fcrs.length > 0) {
			return {
				totalGW: row.fcrs.reduce(
					(sum, f) => sum + (Number(f.grossWeight) || 0),
					0,
				),
				// If more than 1 FCR, it must be read-only aggregate
				source: row.fcrs.length > 1 ? "fcrs" : null,
			};
		}

		return { totalGW: null, source: null };
	}, [row.containers, row.fcrs]);

	const isReadOnly =
		source === "containers" ||
		source === "fcrs" ||
		(row.containers?.length || 0) > 0;

	if (isReadOnly) {
		return (
			<TruckingDiffCellWrapper props={props}>
				<div
					className="w-full h-full flex items-center px-2 py-1 font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50/30 dark:bg-indigo-900/10 rounded"
					title={
						source === "containers"
							? "Total sum from containers"
							: "Total sum from FCRs"
					}
				>
					{totalGW !== null
						? totalGW.toLocaleString("en-US", {
								minimumFractionDigits: 0,
								maximumFractionDigits: 3,
							})
						: "0"}
				</div>
			</TruckingDiffCellWrapper>
		);
	}

	// No containers: behave like a normal editable number cell
	return (
		<TruckingDiffCellWrapper props={props}>
			<EditableCell {...props} type="number" />
		</TruckingDiffCellWrapper>
	);
}
