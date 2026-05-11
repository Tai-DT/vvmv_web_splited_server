"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Reserves the same horizontal space as `FollowUpSortableRowShell`’s row drag button so
 * thead and tbody columns stay aligned (icon size-3.5 + p-0.5 + margins).
 */
export function FollowUpRowDragHeaderSpacer() {
	return (
		<span
			className="-ml-0.5 mr-0.5 inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded p-0.5"
			aria-hidden
		/>
	);
}

/** Plain row or sortable row based on mode (sortable must live under `SortableContext`). */
export function FollowUpMainRowWrapper({
	enableReorder,
	rowId,
	rowClassName,
	children,
}: {
	enableReorder: boolean;
	rowId: string;
	rowClassName: string;
	children: (dragHandle: ReactNode | null) => ReactNode;
}) {
	if (enableReorder) {
		return (
			<FollowUpSortableRowShell id={rowId} enabled className={rowClassName}>
				{(dh) => children(dh)}
			</FollowUpSortableRowShell>
		);
	}
	return <TableRow className={rowClassName}>{children(null)}</TableRow>;
}

/** Wraps a data row: drag handle uses activator ref so horizontal scroll / cells stay usable. */
export function FollowUpSortableRowShell({
	id,
	enabled,
	className,
	children,
}: {
	id: string;
	enabled: boolean;
	className?: string;
	children: (dragHandle: ReactNode) => ReactNode;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id, disabled: !enabled });

	const style =
		enabled && transform
			? {
					transform: CSS.Transform.toString(transform),
					transition,
				}
			: undefined;

	const dragHandle = enabled ? (
		<button
			type="button"
			ref={setActivatorNodeRef}
			{...attributes}
			{...listeners}
			data-no-drag-scroll
			className="-ml-0.5 mr-0.5 inline-flex shrink-0 cursor-grab touch-none rounded p-0.5 text-slate-400 hover:bg-slate-200 active:cursor-grabbing dark:hover:bg-slate-700"
			title="Kéo để sắp xếp dòng (trang hiện tại)"
			aria-label="Kéo để sắp xếp dòng"
		>
			<GripVertical className="size-3.5" />
		</button>
	) : null;

	return (
		<TableRow
			ref={setNodeRef}
			style={style}
			className={cn(
				className,
				enabled && isDragging && "relative z-20 opacity-95 shadow-sm",
			)}
		>
			{children(dragHandle)}
		</TableRow>
	);
}
