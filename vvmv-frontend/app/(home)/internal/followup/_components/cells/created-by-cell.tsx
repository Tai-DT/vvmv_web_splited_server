"use client";

import type { Row, Table } from "@tanstack/react-table";
import type { FollowUpRow } from "../../types";
import { useCellTabIndex } from "./use-cell-tab-index";
import { UserDisplay } from "./user-display";

interface CreatedByCellProps {
	row: Row<FollowUpRow>;
	table: Table<FollowUpRow>;
}

/**
 * CreatedByCell Component
 *
 * Displays the profile info of the user who created the record.
 * Uses the shared UserDisplay component.
 */
export const CreatedByCell = ({ row, table }: CreatedByCellProps) => {
	const originalUser = row.original.user;

	// Try to find user in siteUsers if not in original row object
	const siteUsers = (table.options.meta as any)?.dependencies?.siteUsers || [];
	const resolvedUser = siteUsers.find(
		(u: any) => u.id === row.original.createdBy,
	);

	const user = originalUser || resolvedUser;

	const tabIndex = useCellTabIndex(table, row.original.id, "createdBy");

	return (
		<div tabIndex={tabIndex}>
			<UserDisplay user={user} size="md" showEmail />
		</div>
	);
};
