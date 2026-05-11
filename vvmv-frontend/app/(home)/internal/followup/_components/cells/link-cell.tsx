import type { Table } from "@tanstack/react-table";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { FollowUpRow } from "../../types";
import { useCellTabIndex } from "./use-cell-tab-index";

interface LinkCellProps {
	getValue: () => unknown;
	row: { original: FollowUpRow };
	column: { id: string };
	table: Table<FollowUpRow>;
}

/**
 * LinkCell Component
 *
 * A reusable cell component for displaying clickable links.
 * - Displays an "Open" button with external link icon
 * - Clicking the button opens the URL in a new tab
 * - Returns empty cell if URL is empty or undefined
 */
export function LinkCell({ getValue, row, column, table }: LinkCellProps) {
	const url = getValue() as string;
	const tabIndex = useCellTabIndex(table, row.original.id, column.id);

	// Return empty cell if no URL
	if (!url) {
		return null;
	}

	return (
		<Link
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			tabIndex={tabIndex}
		>
			<Button variant="link">
				Open
				<ExternalLink className="size-3" />
			</Button>
		</Link>
	);
}
