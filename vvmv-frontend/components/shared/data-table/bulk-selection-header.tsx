"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPositioner,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BOT_ACTIONS } from "@/lib/validation/followup-validation";

interface BulkSelectionHeaderProps {
	table: any; // TanStack Table instance
	actions?: readonly string[]; // Optional custom actions list
}

const DEFAULT_BOT_ACTIONS = [
	BOT_ACTIONS.FAST_INPUT,
	BOT_ACTIONS.DRAFT_CDS,
	BOT_ACTIONS.FAST_CDS,
	BOT_ACTIONS.FAST_CO,
	BOT_ACTIONS.TRUCKING_REQUEST,
	BOT_ACTIONS.CSHT_REQUEST,
	BOT_ACTIONS.TAX_REQUEST,
	BOT_ACTIONS.LPHQ_REQUEST,
	BOT_ACTIONS.CHECK_QUA_KVGS,
	BOT_ACTIONS.CHECK_CDS_ATTACHMENT,
	BOT_ACTIONS.FAST_FINISH,
	BOT_ACTIONS.FAST_UNFINISH,
] as const;

/**
 * Common bulk selection header component for data tables
 * Displays: checkbox for select all + selected count + Actions dropdown + clear button
 *
 * Used by both logistics and trucking follow-up tables
 */
export function BulkSelectionHeader({
	table,
	actions = DEFAULT_BOT_ACTIONS,
}: BulkSelectionHeaderProps) {
	const selectedCount = Object.keys(table.getState().rowSelection).length;
	const allSelected = table.getIsAllPageRowsSelected();
	const someSelected = table.getIsSomePageRowsSelected();

	return (
		<div className="flex items-center gap-2 w-full">
			<Checkbox
				checked={allSelected}
				indeterminate={!allSelected && someSelected}
				onCheckedChange={(value: boolean) =>
					table.toggleAllPageRowsSelected(!!value)
				}
				aria-label="Select all rows"
			/>
			{selectedCount > 0 && (
				<>
					<span className="text-xs font-medium text-slate-600 dark:text-slate-400">
						{selectedCount}
					</span>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button
									variant="default"
									size="sm"
									className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700 text-white"
								>
									Actions
								</Button>
							}
						/>
						<DropdownMenuPositioner align="start">
							<DropdownMenuContent className="w-52">
								{actions.map((action) => (
									<DropdownMenuItem
										key={action}
										onClick={() => {
											// Trigger bulk action via table meta
											table.options.meta?.onBulkAction?.(action);
										}}
									>
										{action}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenuPositioner>
					</DropdownMenu>
				</>
			)}
		</div>
	);
}
