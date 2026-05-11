"use client";

import type { Table } from "@tanstack/react-table";
import { memo } from "react";
import type { TruckingFollowUpRow } from "../../types";

interface BooleanToggleCellProps {
	getValue: () => unknown;
	row: { original: TruckingFollowUpRow };
	column: { id: string };
	table: Table<TruckingFollowUpRow>;
}

function BooleanToggleCellComponent({
	getValue,
	row: { original },
	column: { id },
	table,
}: BooleanToggleCellProps) {
	const value = getValue() as boolean | null | undefined;
	const isChecked = value === true;

	const handleToggle = () => {
		(table.options.meta as any)?.updateData?.(original.id, id, !isChecked);
	};

	return (
		<div className="w-full h-full flex items-center justify-center px-1">
			<button
				type="button"
				role="switch"
				aria-checked={isChecked}
				onClick={handleToggle}
				className={`
          relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          ${isChecked ? "bg-green-500" : "bg-muted"}
        `}
			>
				<span
					className={`
            pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0
            transition duration-200 ease-in-out
            ${isChecked ? "translate-x-4" : "translate-x-0"}
          `}
				/>
			</button>
		</div>
	);
}

function arePropsEqual(
	prevProps: BooleanToggleCellProps,
	nextProps: BooleanToggleCellProps,
) {
	return (
		prevProps.getValue() === nextProps.getValue() &&
		prevProps.row.original.id === nextProps.row.original.id &&
		prevProps.column.id === nextProps.column.id
	);
}

export const BooleanToggleCell = memo(
	BooleanToggleCellComponent,
	arePropsEqual,
);
