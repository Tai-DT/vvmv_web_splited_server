"use client";

import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext } from "@dnd-kit/sortable";
import { useQueryClient } from "@tanstack/react-query";
import { flexRender, type Table as TanStackTable } from "@tanstack/react-table";
import {
	Box,
	ClipboardList,
	CreditCard,
	FileSpreadsheet,
	FileText,
	GripVertical,
	History,
	List,
	ListTodo,
} from "lucide-react";
import { Fragment, type ReactNode, useState } from "react";
import { ActivityLogPanel } from "@/components/shared/activity-log-panel";
import {
	BaseDetailsPanel,
	DataTableEmptyState,
	DataTableLoadingBar,
	ExpandedDetailTableCell,
	splitOrderedLeafHeadersByPin,
	splitVisibleCellsByPin,
	type TabConfig,
} from "@/components/shared/data-table";
import { PaymentRequestPanel } from "@/components/shared/payment-request-panel";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useHorizontalDragScroll } from "@/hooks/use-horizontal-drag-scroll";
import { cn } from "@/lib/utils";
import { ContainersPanel } from "../../../trucking-followup/_components/panels/containers-panel";
import { DeclarationsPanel } from "../../../trucking-followup/_components/panels/declarations-panel";
import type { FollowUpRow, SubTabType } from "../../types";
import { PRIORITY_OPTIONS } from "../cells/badge-cell-job-priority";
import { CargoListPanel } from "../panels/cargo-list-panel";
import { CdsInfoPanel } from "../panels/cds/cds-info-panel";
import { CerOfOriginPanel } from "../panels/cerOfOrigin-panel";
import { InvokerTasksPanel } from "../panels/invoker-tasks-panel";
import { FOLLOWUP_LABELS } from "./column-labels";
import {
	FollowUpMainRowWrapper,
	FollowUpRowDragHeaderSpacer,
} from "./follow-up-sortable-row-shell";
import type { SubPanelVisibility } from "./use-table-state";

/** Build tab configs for the expanded row details panel */
function buildFollowUpTabs(
	row: FollowUpRow,
	subPanelVisibility: SubPanelVisibility,
	onRefresh?: () => void,
): TabConfig[] {
	const containerCount = row.containers?.length || 0;
	const declarationCount = row.declarations?.length || 0;
	const taskCount = row.invokerTasks?.length || 0;
	const coCount = row.cerOfOrigins?.length || 0;
	const cargoCount = row._count?.cargoLists || 0;
	const paymentCount =
		row._count?.paymentRequests || row.paymentRequests?.length || 0;

	return [
		{
			id: "tasks",
			label: "Tasks",
			icon: ListTodo,
			count: taskCount,
			visible: subPanelVisibility?.tasks !== false,
			content: <InvokerTasksPanel tasks={row.invokerTasks || []} />,
		},
		{
			id: "containers",
			label: "Containers",
			icon: Box,
			count: containerCount,
			visible: subPanelVisibility.containers && containerCount > 0,
			content: (
				<ContainersPanel
					containers={row.containers || []}
					declarations={row.declarations || []}
					logisticsFollowUpId={row.id}
					followUpWarehouse={row.warehouse}
					isFinished={false}
					mode="logistics"
					taxCode={row.taxCode}
					billOrBooking={row.billOrBooking}
					operationType={row.operationType}
					fromLocation={row.location}
					followUpDeliveryDate={row.deliveryDate}
				/>
			),
		},
		{
			id: "declarations",
			label: "Declarations",
			icon: ClipboardList,
			count: declarationCount,
			visible: subPanelVisibility.declarations && declarationCount > 0,
			content: <DeclarationsPanel declarations={row.declarations || []} />,
		},
		{
			id: "co",
			label: "Cer Of Origin",
			icon: FileText,
			count: coCount,
			visible: subPanelVisibility.cerOfOrigins && coCount > 0,
			content: <CerOfOriginPanel cerOfOrigins={row.cerOfOrigins || []} />,
		},
		{
			id: "cargo",
			label: "Cargo List",
			icon: List,
			count: cargoCount,
			visible: true,
			content: (
				<CargoListPanel
					followUpId={row.id}
					operationCode={row.cdsInfo?.operationCode ?? null}
					onRefresh={onRefresh}
				/>
			),
		},
		{
			id: "cdsInfo",
			label: "CDS Info",
			icon: FileSpreadsheet,
			count: 0,
			visible: true,
			content: (
				<CdsInfoPanel
					followUpId={row.id}
					onRefresh={onRefresh}
					followUpSummary={row}
					operationType={row.operationType}
					taxCode={row.taxCode}
					companyName={row.companyName}
					serviceMode={row.serviceMode}
					containers={row.containers || []}
					declarations={row.declarations || []}
				/>
			),
		},
		{
			id: "payment",
			label: "Payment",
			icon: CreditCard,
			count: paymentCount,
			visible: true,
			content: (
				<PaymentRequestPanel
					apiPath="/api/followup/payment-request"
					parentId={row.id}
					parentIdParam="followUpId"
				/>
			),
		},
		{
			id: "activity",
			label: "Activity",
			icon: History,
			count: 0,
			visible: true,
			content: (
				<ActivityLogPanel
					jobId={row.id}
					apiPath="/api/followup/activity-log"
					fieldLabels={FOLLOWUP_LABELS}
				/>
			),
		},
	];
}

interface DataTableContentProps {
	table: TanStackTable<FollowUpRow>;
	subPanelVisibility: SubPanelVisibility;
	activeRowTabs?: Record<string, SubTabType>;
	isLoading?: boolean;
	isFetching?: boolean;
	/** Client-only reorder of rows on the current page (not persisted to server). */
	enableRowReorder?: boolean;
	onRowOrderChange?: (orderedIds: string[]) => void;
}

export function DataTableContent({
	table,
	subPanelVisibility,
	activeRowTabs = {},
	isLoading,
	isFetching,
	enableRowReorder = false,
	onRowOrderChange,
}: DataTableContentProps) {
	const headerGroups = table.getHeaderGroups();
	const queryClient = useQueryClient();
	const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
	const [dropTargetColumnId, setDropTargetColumnId] = useState<string | null>(
		null,
	);
	const { containerRef, dragScrollHandlers } =
		useHorizontalDragScroll<HTMLDivElement>();

	const showRowDrag =
		enableRowReorder && typeof onRowOrderChange === "function";

	const rowDragSensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { distance: 10 },
		}),
	);

	const handleRowDragEnd = (event: DragEndEvent) => {
		if (!enableRowReorder || !onRowOrderChange) return;
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		const ids = table.getRowModel().rows.map((r) => r.id);
		const oldIndex = ids.indexOf(String(active.id));
		const newIndex = ids.indexOf(String(over.id));
		if (oldIndex === -1 || newIndex === -1) return;
		onRowOrderChange(arrayMove(ids, oldIndex, newIndex));
	};

	const sortableRowIds = table.getRowModel().rows.map((r) => r.id);

	const handleDragStart = (e: React.DragEvent, columnId: string) => {
		setDraggedColumnId(columnId);
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", columnId);

		// Use the parent TableHead as drag image (whole column header)
		const gripElement = e.currentTarget as HTMLElement;
		const tableHead = gripElement.closest("th");
		if (tableHead) {
			const clone = tableHead.cloneNode(true) as HTMLElement;
			clone.style.position = "absolute";
			clone.style.top = "-1000px";
			clone.style.opacity = "0.9";
			clone.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
			document.body.appendChild(clone);
			e.dataTransfer.setDragImage(clone, 20, 20);
			setTimeout(() => document.body.removeChild(clone), 0);
		}
	};

	const handleDragOver = (e: React.DragEvent, targetColumnId: string) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		if (!draggedColumnId || targetColumnId === draggedColumnId) return;
		setDropTargetColumnId((prev) =>
			prev === targetColumnId ? prev : targetColumnId,
		);
	};

	const handleDragLeave = (e: React.DragEvent, targetColumnId: string) => {
		// Avoid flicker when moving between children inside the same header cell
		const nextTarget = e.relatedTarget as Node | null;
		if (nextTarget && e.currentTarget.contains(nextTarget)) return;
		setDropTargetColumnId((prev) => (prev === targetColumnId ? null : prev));
	};

	const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
		e.preventDefault();
		setDropTargetColumnId(null);
		if (!draggedColumnId || draggedColumnId === targetColumnId) {
			setDraggedColumnId(null);
			return;
		}

		const currentOrder = [...table.getState().columnOrder];
		const draggedIndex = currentOrder.indexOf(draggedColumnId);
		const targetIndex = currentOrder.indexOf(targetColumnId);

		if (draggedIndex === -1 || targetIndex === -1) {
			setDraggedColumnId(null);
			return;
		}

		// Match getDropPosition: dragging left→right shows indicator on the right of the
		// target (insert after target); right→left shows left (insert before target).
		const insertAfterTarget = draggedIndex < targetIndex;

		currentOrder.splice(draggedIndex, 1);
		const targetAfter = currentOrder.indexOf(targetColumnId);
		if (targetAfter === -1) {
			setDraggedColumnId(null);
			return;
		}
		const insertAt = insertAfterTarget ? targetAfter + 1 : targetAfter;
		currentOrder.splice(insertAt, 0, draggedColumnId);
		table.setColumnOrder(currentOrder);

		setDraggedColumnId(null);
	};

	const handleDragEnd = () => {
		setDraggedColumnId(null);
		setDropTargetColumnId(null);
	};

	// Get drop indicator position (left or right side of target)
	const getDropPosition = (targetColumnId: string): "left" | "right" | null => {
		if (
			!draggedColumnId ||
			!dropTargetColumnId ||
			dropTargetColumnId !== targetColumnId
		) {
			return null;
		}
		const currentOrder = table.getState().columnOrder;
		const draggedIndex = currentOrder.indexOf(draggedColumnId);
		const targetIndex = currentOrder.indexOf(targetColumnId);
		return draggedIndex < targetIndex ? "right" : "left";
	};

	const handleContainerAdded = () => {
		queryClient.invalidateQueries({ queryKey: ["followups"] });
	};

	/**
	 * Shared utility to calculate column positioning (left/right offsets)
	 * Ensures headers and cells always align correctly
	 * Accounts for drag handle spacer width when showRowDrag is enabled
	 */
	const getColumnPosition = (
		columns: any[],
		index: number,
		pin: "left" | "right" | null,
		isFirstColumn: boolean = false,
	) => {
		const DRAG_HANDLE_WIDTH = 22; // min-w-[22px] from FollowUpRowDragHeaderSpacer
		const hasDragHandle = showRowDrag && isFirstColumn;

		if (pin === "left") {
			let leftOffset = 0;
			if (hasDragHandle && index === 0) {
				// First column with drag handle starts after the spacer
				leftOffset = DRAG_HANDLE_WIDTH;
			} else {
				// Calculate offset from previous columns
				leftOffset = columns
					.slice(0, index)
					.reduce((acc, c) => acc + (c.getSize ? c.getSize() : c.column.getSize()), 0);
				// Add drag handle width to offset if any previous column had it
				if (hasDragHandle && index > 0) {
					leftOffset += DRAG_HANDLE_WIDTH;
				}
			}
			return { left: leftOffset, right: undefined };
		}
		if (pin === "right") {
			const rightOffset = columns
				.slice(index + 1)
				.reduce((acc, c) => acc + (c.getSize ? c.getSize() : c.column.getSize()), 0);
			return { left: undefined, right: rightOffset };
		}
		return { left: undefined, right: undefined };
	};

	/**
	 * Shared utility to get column size constraints
	 */
	const getColumnSize = (column: any) => {
		const size = column.getSize ? column.getSize() : column.column.getSize();
		const minSize = column.column.columnDef.minSize ?? 50;
		const maxSize = column.column.columnDef.maxSize ?? 1000;
		return { size, minSize, maxSize };
	};

	// Render skeleton rows during initial load or page change
	const renderSkeletonRows = () => {
		const pageSize = table.getState().pagination.pageSize || 10;
		const visibleColumns = table.getVisibleLeafColumns();

		return Array.from({ length: pageSize }).map((_, rowIndex) => (
			<TableRow
				key={`skeleton-${rowIndex}`}
				className="flex w-max border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900"
			>
				{visibleColumns.map((column, colIndex) => {
					const isPinnedLeft = column.getIsPinned() === "left";
					const isPinnedRight = column.getIsPinned() === "right";

					let leftOffset = 0;
					if (isPinnedLeft) {
						leftOffset = visibleColumns
							.slice(0, colIndex)
							.filter((c) => c.getIsPinned() === "left")
							.reduce((acc, c) => acc + c.getSize(), 0);
					}

					let rightOffset = 0;
					if (isPinnedRight) {
						rightOffset = visibleColumns
							.slice(colIndex + 1)
							.filter((c) => c.getIsPinned() === "right")
							.reduce((acc, c) => acc + c.getSize(), 0);
					}

					return (
						<TableCell
							key={`skeleton-${rowIndex}-${column.id}-${colIndex}`}
							style={{
								width: `${column.getSize()}px`,
								minWidth: `${column.columnDef.minSize || 50}px`,
								maxWidth: `${column.columnDef.maxSize || 1000}px`,
								left: isPinnedLeft ? `${leftOffset}px` : undefined,
								right: isPinnedRight ? `${rightOffset}px` : undefined,
							}}
							className={cn(
								"flex-none shrink-0 px-1.5 py-2 overflow-hidden",
								isPinnedLeft &&
									"sticky z-20 border-r bg-white dark:bg-slate-900 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)]",
								isPinnedRight &&
									"sticky z-20 border-l bg-white dark:bg-slate-900 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.08)]",
							)}
						>
							<div className="flex min-w-0 items-start gap-0.5">
								{showRowDrag && colIndex === 0 && (
									<FollowUpRowDragHeaderSpacer />
								)}
								<div className="min-w-0 flex-1">
									<Skeleton className="h-4 w-full opacity-60" />
								</div>
							</div>
						</TableCell>
					);
				})}
			</TableRow>
		));
	};

	// Show empty state if no rows and not loading
	if (!isLoading && table.getRowModel().rows.length === 0) {
		return <DataTableEmptyState />;
	}

	return (
		<div
			ref={containerRef}
			{...dragScrollHandlers}
			className="relative flex min-w-0 flex-1 flex-col isolate touch-pan-x overflow-x-auto overflow-y-visible overscroll-x-contain rounded-xl border bg-white shadow-md dark:bg-slate-900"
		>
			{/* Subtle progress bar for background fetching */}
			<DataTableLoadingBar visible={!!(isFetching && !isLoading)} />
			{(() => {
				const tableElement = (
					<Table
						className="w-max"
						style={{
							// Match TanStack column widths exactly — minWidth:100% was stretching the
							// table past sum(columns) when the scroll container was wider, misaligning thead/tbody flex rows.
							width: `${table.getTotalSize()}px`,
							minWidth: `${table.getTotalSize()}px`,
						}}
					>
						{/* MUI X Premium-style Header */}
						<TableHeader className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-40">
							{headerGroups.map((headerGroup) => {
								// Same leaf order as row.getVisibleCells() — headerGroup.headers alone can mismatch
								const { left, center, right } = splitOrderedLeafHeadersByPin(
									table,
									headerGroup,
								);

								return (
									<TableRow
										key={headerGroup.id}
										className="flex border-b border-slate-200 dark:border-slate-700 w-max"
									>
										{/* Left Pinned Headers */}
										{left.map((header, index) => {
											const { size: columnSize, minSize, maxSize } = getColumnSize(header);
											const columnId = header.column.id;
											const isDragging = draggedColumnId === columnId;
											const dropPosition = getDropPosition(columnId);
											const { left: leftOffset } = getColumnPosition(left, index, "left", index === 0);

											// Check if this column is pinned (left pinned columns cannot be dragged)
											const isPinned = header.column.getIsPinned() === "left";
											// Check if this column is permanently pinned (like Actions)
											const isPermanentlyPinned =
												(
													header.column.columnDef.meta as {
														isPermanentlyPinned?: boolean;
													}
												)?.isPermanentlyPinned ?? false;
											const isDropTarget = dropTargetColumnId === columnId;
											const cannotDrag = isPinned || isPermanentlyPinned;

											return (
												<TableHead
													key={header.id}
													onDragOver={
														cannotDrag
															? undefined
															: (e) => handleDragOver(e, columnId)
													}
													onDragLeave={
														cannotDrag
															? undefined
															: (e) => handleDragLeave(e, columnId)
													}
													onDrop={
														cannotDrag
															? undefined
															: (e) => handleDrop(e, columnId)
													}
													className={`sticky top-0 flex-none shrink-0 relative overflow-hidden bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 px-1.5 py-1 h-8 flex items-center gap-1 z-50 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)] ${
														isDragging ? "opacity-50" : ""
													} ${isDropTarget ? "ring-1 ring-blue-500 ring-inset" : ""}`}
													style={{
														width: `${columnSize}px`,
														minWidth: `${minSize}px`,
														maxWidth: `${maxSize}px`,
														left: leftOffset !== undefined ? `${leftOffset}px` : undefined,
													}}
												>
													{/* Match row drag handle width in body so thead/td columns line up */}
													{showRowDrag && index === 0 && (
														<FollowUpRowDragHeaderSpacer />
													)}
													{/* Drop indicators - only show for draggable columns */}
													{!cannotDrag && dropPosition === "left" && (
														<div className="absolute left-0 top-0 h-full w-1.5 bg-blue-500 z-30 rounded-full" />
													)}
													{!cannotDrag && dropPosition === "right" && (
														<div className="absolute right-0 top-0 h-full w-1.5 bg-blue-500 z-30 rounded-full" />
													)}
													{/* Drag handle - only for non-pinned columns */}
													{!cannotDrag && (
														<div
															draggable
															onDragStart={(e) => handleDragStart(e, columnId)}
															onDragEnd={handleDragEnd}
															data-no-drag-scroll
															className="cursor-grab active:cursor-grabging p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
														>
															<GripVertical className="size-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
														</div>
													)}
													<div className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate">
														{flexRender(
															header.column.columnDef.header,
															header.getContext(),
														)}
													</div>
													{header.column.getCanResize() && (
														<div
															onMouseDown={header.getResizeHandler()}
															onTouchStart={header.getResizeHandler()}
															data-no-drag-scroll
															className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none transition-all ${
																header.column.getIsResizing()
																	? "bg-blue-500 opacity-100"
																	: "bg-slate-300 dark:bg-slate-600 hover:bg-blue-400 opacity-0 hover:opacity-100"
															}`}
														/>
													)}
												</TableHead>
											);
										})}

										{/* Center (Unpinned) Headers */}
										{center.map((header, centerIndex) => {
											const { size: columnSize, minSize, maxSize } = getColumnSize(header);
											const columnId = header.column.id;
											const isDragging = draggedColumnId === columnId;
											const dropPosition = getDropPosition(columnId);
											const isDropTarget = dropTargetColumnId === columnId;
											const isFirstColumn = left.length === 0 && centerIndex === 0;

											// Check if this column is permanently pinned
											const isPermanentlyPinned =
												(
													header.column.columnDef.meta as {
														isPermanentlyPinned?: boolean;
													}
												)?.isPermanentlyPinned ?? false;
											const cannotDrag = isPermanentlyPinned;

											return (
												<TableHead
													key={header.id}
													onDragOver={
														cannotDrag
															? undefined
															: (e) => handleDragOver(e, columnId)
													}
													onDragLeave={
														cannotDrag
															? undefined
															: (e) => handleDragLeave(e, columnId)
													}
													onDrop={
														cannotDrag
															? undefined
															: (e) => handleDrop(e, columnId)
													}
													className={`sticky top-0 flex-none shrink-0 relative overflow-hidden bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 px-1.5 py-1 h-8 flex items-center gap-1 z-40 ${
														isDragging ? "opacity-50" : ""
													} ${isDropTarget ? "ring-1 ring-blue-500 ring-inset" : ""}`}
													style={{
														width: `${columnSize}px`,
														minWidth: `${minSize}px`,
														maxWidth: `${maxSize}px`,
													}}
												>
													{showRowDrag && isFirstColumn && <FollowUpRowDragHeaderSpacer />}
													{/* Drop indicator - left side */}
													{!cannotDrag && dropPosition === "left" && (
														<div className="absolute left-0 top-0 h-full w-1.5 bg-blue-500 z-30 rounded-full" />
													)}
													{/* Drop indicator - right side */}
													{!cannotDrag && dropPosition === "right" && (
														<div className="absolute right-0 top-0 h-full w-1.5 bg-blue-500 z-30 rounded-full" />
													)}
													{!cannotDrag && (
														<div
															draggable
															onDragStart={(e) => handleDragStart(e, columnId)}
															onDragEnd={handleDragEnd}
															data-no-drag-scroll
															className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
														>
															<GripVertical className="size-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
														</div>
													)}
													<div className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate">
														{flexRender(
															header.column.columnDef.header,
															header.getContext(),
														)}
													</div>
													{header.column.getCanResize() && (
														<div
															onMouseDown={header.getResizeHandler()}
															onTouchStart={header.getResizeHandler()}
															data-no-drag-scroll
															className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none transition-all ${
																header.column.getIsResizing()
																	? "bg-blue-500 opacity-100"
																	: "bg-slate-300 dark:bg-slate-600 hover:bg-blue-400 opacity-0 hover:opacity-100"
															}`}
														/>
													)}
												</TableHead>
											);
										})}

										{/* Right Pinned Headers */}
										{right.map((header, index) => {
											const { size: columnSize, minSize, maxSize } = getColumnSize(header);
											const columnId = header.column.id;
											const isDragging = draggedColumnId === columnId;
											const dropPosition = getDropPosition(columnId);
											const { right: rightOffset } = getColumnPosition(right, index, "right");
											const isDropTarget = dropTargetColumnId === columnId;

											// Check if this column is pinned (right pinned columns cannot be dragged)
											const isPinned = header.column.getIsPinned() === "right";
											// Check if this column is permanently pinned
											const isPermanentlyPinned =
												(
													header.column.columnDef.meta as {
														isPermanentlyPinned?: boolean;
													}
												)?.isPermanentlyPinned ?? false;
											const cannotDrag = isPinned || isPermanentlyPinned;

											return (
												<TableHead
													key={header.id}
													onDragOver={
														cannotDrag
															? undefined
															: (e) => handleDragOver(e, columnId)
													}
													onDragLeave={
														cannotDrag
															? undefined
															: (e) => handleDragLeave(e, columnId)
													}
													onDrop={
														cannotDrag
															? undefined
															: (e) => handleDrop(e, columnId)
													}
													className={`sticky top-0 flex-none shrink-0 relative overflow-hidden bg-slate-100 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 px-1.5 py-1 h-8 flex items-center gap-1 z-50 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.3)] ${
														isDragging ? "opacity-50" : ""
													} ${isDropTarget ? "ring-1 ring-blue-500 ring-inset" : ""}`}
													style={{
														width: `${columnSize}px`,
														minWidth: `${minSize}px`,
														maxWidth: `${maxSize}px`,
														right: rightOffset !== undefined ? `${rightOffset}px` : undefined,
													}}
												>
													{/* Drop indicator - left side */}
													{!cannotDrag && dropPosition === "left" && (
														<div className="absolute left-0 top-0 h-full w-1.5 bg-blue-500 z-30 rounded-full" />
													)}
													{/* Drop indicator - right side */}
													{!cannotDrag && dropPosition === "right" && (
														<div className="absolute right-0 top-0 h-full w-1.5 bg-blue-500 z-30 rounded-full" />
													)}
													{!cannotDrag && (
														<div
															draggable
															onDragStart={(e) => handleDragStart(e, columnId)}
															onDragEnd={handleDragEnd}
															data-no-drag-scroll
															className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
														>
															<GripVertical className="size-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
														</div>
													)}
													<div className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate">
														{flexRender(
															header.column.columnDef.header,
															header.getContext(),
														)}
													</div>
													{header.column.getCanResize() && (
														<div
															onMouseDown={header.getResizeHandler()}
															onTouchStart={header.getResizeHandler()}
															data-no-drag-scroll
															className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none transition-all ${
																header.column.getIsResizing()
																	? "bg-blue-500 opacity-100"
																	: "bg-slate-300 dark:bg-slate-600 hover:bg-blue-400 opacity-0 hover:opacity-100"
															}`}
														/>
													)}
												</TableHead>
											);
										})}
									</TableRow>
								);
							})}
						</TableHeader>
						<TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
							{isLoading && table.getRowModel().rows.length === 0
								? renderSkeletonRows()
								: table.getRowModel().rows.map((row, rowIndex) => {
										const { left, center, right } = splitVisibleCellsByPin(row);

										const hasInvokerTasks =
											(row.original.invokerTasks?.length || 0) > 0;
										const hasDeclarations =
											(row.original.declarations?.length || 0) > 0;
										const hasContainers =
											(row.original.containers?.length || 0) > 0;
										const totalColumns =
											left.length + center.length + right.length;
										const hasCerOfOrigins =
											(row.original.cerOfOrigins?.length || 0) > 0;
										const hasCargoLists =
											(row.original._count?.cargoLists || 0) >= 0;

										const isDone = !!row.original._isDone;
										const isFinished = !!row.original._isFinished;

										const jobPriority = row.original.jobPriority;
										const cellBackGround = PRIORITY_OPTIONS.find(
											(opt) => opt.value === Number(jobPriority),
										)?.backGround;

										const isEvenRow = rowIndex % 2 === 0;

										const rowBgClasses = isDone
											? isEvenRow
												? "bg-indigo-50 dark:bg-[#1e1b4b]/40"
												: "bg-indigo-100 dark:bg-[#1e1b4b]/60"
											: isFinished
												? isEvenRow
													? "bg-emerald-50 dark:bg-[#062d24]"
													: "bg-emerald-100 dark:bg-[#063a2f]"
												: isEvenRow
													? "bg-white dark:bg-slate-900"
													: "bg-slate-50 dark:bg-slate-800";

										const rowHoverClasses = isDone
											? "group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/60"
											: isFinished
												? "group-hover:bg-emerald-200 dark:group-hover:bg-[#064e3b]"
												: "group-hover:bg-blue-50 dark:group-hover:bg-slate-700/50";

										const rowClassName = `flex transition-colors duration-150 group ${rowBgClasses} ${rowHoverClasses} w-max`;

										const renderCells = (dragHandle: ReactNode | null) => {
											const isFirstColumnLeft = left.length > 0;
											const isFirstColumnCenter = left.length === 0;

											return (
												<>
													{left.map((cell, index) => {
														const { size: columnSize, minSize, maxSize } = getColumnSize(cell);
														const { left: leftOffset } = getColumnPosition(left, index, "left", index === 0);

														return (
															<TableCell
																data-no-drag-scroll
																key={`${row.id}-${cell.column.id}-left-${index}`}
																style={{
																	width: `${columnSize}px`,
																	minWidth: `${minSize}px`,
																	maxWidth: `${maxSize}px`,
																	left: leftOffset !== undefined ? `${leftOffset}px` : undefined,
																}}
																className={`sticky flex-none shrink-0 z-20 border-r border-slate-200 dark:border-slate-700 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.25)] px-1.5 py-1 text-xs overflow-hidden select-text transition-colors duration-150 ${rowBgClasses} ${rowHoverClasses}`}
															>
																<div className="flex min-w-0 items-start gap-0.5">
																	{index === 0 ? dragHandle : null}
																	<div className="min-w-0 flex-1 overflow-hidden">
																		{flexRender(
																			cell.column.columnDef.cell,
																			cell.getContext(),
																		)}
																	</div>
																</div>
															</TableCell>
														);
													})}

													{center.map((cell, index) => {
														const { size: columnSize, minSize, maxSize } = getColumnSize(cell);
														const isFirstColumn = isFirstColumnCenter && index === 0;

														return (
															<TableCell
																data-no-drag-scroll
																key={`${row.id}-${cell.column.id}-center`}
																style={{
																	width: `${columnSize}px`,
																	minWidth: `${minSize}px`,
																	maxWidth: `${maxSize}px`,
																}}
																className={`flex-none shrink-0 border-r border-slate-200 dark:border-slate-700 px-1.5 py-1 text-xs overflow-hidden select-text transition-colors duration-150 ${
																	cellBackGround && !isFinished && !isDone
																		? `${cellBackGround} group-hover:brightness-95 dark:group-hover:brightness-110`
																		: `${rowBgClasses} ${rowHoverClasses}`
																}`}
															>
																<div className="flex min-w-0 items-start gap-0.5">
																	{isFirstColumn ? dragHandle : null}
																	<div className="min-w-0 flex-1 overflow-hidden">
																		{flexRender(
																			cell.column.columnDef.cell,
																			cell.getContext(),
																		)}
																	</div>
																</div>
															</TableCell>
														);
													})}

													{right.map((cell, index) => {
														const { size: columnSize, minSize, maxSize } = getColumnSize(cell);
														const { right: rightOffset } = getColumnPosition(right, index, "right");

														return (
															<TableCell
																data-no-drag-scroll
																key={`${row.id}-${cell.column.id}-right-${index}`}
																style={{
																	width: `${columnSize}px`,
																	minWidth: `${minSize}px`,
																	maxWidth: `${maxSize}px`,
																	right: rightOffset !== undefined ? `${rightOffset}px` : undefined,
																}}
																className={`sticky flex-none shrink-0 z-20 border-l border-slate-200 dark:border-slate-700 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.08)] dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.25)] px-1.5 py-1 text-xs overflow-hidden select-text transition-colors duration-150 ${rowBgClasses} ${rowHoverClasses}`}
															>
																{flexRender(
																	cell.column.columnDef.cell,
																	cell.getContext(),
																)}
															</TableCell>
														);
													})}
												</>
											);
										};

										return (
											<Fragment key={row.id}>
												<FollowUpMainRowWrapper
													enableReorder={showRowDrag}
													rowId={row.id}
													rowClassName={rowClassName}
												>
													{(dh) => renderCells(dh)}
												</FollowUpMainRowWrapper>
												{row.getIsExpanded() &&
													(hasDeclarations ||
														hasCerOfOrigins ||
														hasContainers ||
														hasInvokerTasks ||
														hasCargoLists) && (
														<TableRow
															key={`${row.id}-details`}
															className="bg-slate-50 dark:bg-slate-800/50"
														>
															<ExpandedDetailTableCell colSpan={totalColumns}>
																<BaseDetailsPanel
																	tabs={buildFollowUpTabs(
																		row.original,
																		subPanelVisibility,
																		handleContainerAdded,
																	)}
																	activeTab={activeRowTabs[row.id]}
																	onTabChange={(tab: string) =>
																		(table.options.meta as any)?.onSubTabClick?.(
																			row.id,
																			tab,
																		)
																	}
																/>
															</ExpandedDetailTableCell>
														</TableRow>
													)}
											</Fragment>
										);
									})}
						</TableBody>
					</Table>
				);

				if (!showRowDrag) return tableElement;

				return (
					<DndContext
						collisionDetection={closestCenter}
						modifiers={[restrictToVerticalAxis]}
						onDragEnd={handleRowDragEnd}
						sensors={rowDragSensors}
					>
						<SortableContext items={sortableRowIds}>
							{tableElement}
						</SortableContext>
					</DndContext>
				);
			})()}
		</div>
	);
}
