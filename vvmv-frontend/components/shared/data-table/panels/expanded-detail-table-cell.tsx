"use client";

import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type ExpandedDetailTableCellProps = {
	colSpan: number;
	children: ReactNode;
} & Omit<ComponentProps<typeof TableCell>, "colSpan" | "children">;

/**
 * Table cell for expandable row detail panels. Colspan cells otherwise grow to the
 * full width of every column (~thousands of px on wide grids); cap width to the
 * visible content area so horizontal scroll stays usable.
 */
export function ExpandedDetailTableCell({
	colSpan,
	children,
	className,
	style,
	...cellProps
}: ExpandedDetailTableCellProps) {
	const { state: sidebarState, isMobile } = useSidebar();
	/** Mobile: sidebar is a sheet; main is effectively full-bleed — do not subtract desktop sidebar width. */
	const maxWidth: string = isMobile
		? "min(100%, calc(100dvw - 1rem - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)))"
		: sidebarState === "expanded"
			? "min(100%, calc(100dvw - var(--sidebar-width) - 2rem))"
			: "min(100%, calc(100dvw - var(--sidebar-width-icon) - 2rem))";

	return (
		<TableCell
			{...cellProps}
			colSpan={colSpan}
			data-no-drag-scroll
			style={
				{
					maxWidth,
					...(style as CSSProperties | undefined),
				} satisfies CSSProperties
			}
			className={cn(
				/* Horizontal scroll belongs on the table wrapper, not here — avoids nested scroll + tab strip jumping */
				"p-0 border-none align-top min-w-0 overflow-x-hidden overflow-y-visible",
				className,
			)}
		>
			<div className="min-w-0 max-w-full isolate">{children}</div>
		</TableCell>
	);
}
