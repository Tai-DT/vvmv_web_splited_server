"use client";

import { flexRender, type Table as TanStackTable } from "@tanstack/react-table";
import {
	Box,
	CreditCard,
	FileText,
	GripVertical,
	History,
	ListTodo,
	Receipt,
	Truck,
} from "lucide-react";
import { Fragment, useState } from "react";
import { ActivityLogPanel } from "@/components/shared/activity-log-panel";
import {
	BaseDetailsPanel,
	DataTableEmptyState,
	DataTableLoadingBar,
	ExpandedDetailTableCell,
	splitOrderedLeafHeadersByPin,
	splitVisibleCellsByPin,
	splitVisibleLeafColumnsByPin,
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
import { InvokerTasksPanel } from "../../../followup/_components/panels/invoker-tasks-panel";
import type { TruckingFollowUpRow } from "../../types";
import { ContainersPanel } from "../panels/containers-panel";
import { DeclarationsPanel } from "../panels/declarations-panel";
import { FCRPanel } from "../panels/fcr-panel";
import { VendorCostsPanel } from "../panels/vendor-costs-panel";
import { TRUCKING_FOLLOWUP_LABELS } from "./column-labels";

/** Build tab configs for the trucking expanded row details panel */
function buildTruckingTabs(
	row: TruckingFollowUpRow,
	isAccountingUser = false,
): TabConfig[] {
	const containerCount = row.containers?.length || 0;
	const declarationCount = row.declarations?.length || 0;
	const fcrCount = row.fcrs?.length || 0;
	const taskCount = row.invokerTasks?.length || 0;
	const paymentCount =
		row._count?.paymentRequests || row.paymentRequests?.length || 0;
	const vendorCostCount = (row.fcrs || []).reduce(
		(sum, fcr) => sum + (fcr.vendorCosts?.length || 0),
		0,
	);

	return [
		{
			id: "tasks",
			label: "Tasks",
			icon: ListTodo,
			count: taskCount,
			content: <InvokerTasksPanel tasks={row.invokerTasks || []} />,
		},
		{
			id: "fcr",
			label: "FCR",
			icon: Truck,
			count: fcrCount,
			content: (
				<FCRPanel
					truckingId={row.id}
					isFinished={row.isFinished}
					fcrs={row.fcrs || []}
					containers={row.containers || []}
					truckingRow={row}
				/>
			),
		},
		{
			id: "declarations",
			label: "Declarations",
			icon: FileText,
			count: declarationCount,
			content: <DeclarationsPanel declarations={row.declarations || []} />,
		},
		{
			id: "containers",
			label: "Containers",
			icon: Box,
			count: containerCount,
			content: (
				<ContainersPanel
					containers={row.containers || []}
					fcrs={row.fcrs || []}
					declarations={row.declarations || []}
					createdBy={row.createdBy}
					truckingFollowUpId={row.id}
					isFinished={row.isFinished}
					taxCode={(row as any).taxCode}
					driveUrl={row.driveUrl || row.followUps?.[0]?.driveUrl}
					jobNumber={row.jobNumber}
					billOrBooking={row.billOrBooking}
					operationType={(row as any).operationType}
					fromLocation={(row as any).fromLocation}
					toLocation={(row as any).toLocation}
				/>
			),
		},
		{
			id: "vendor-costs",
			label: "Vendor Costs",
			icon: Receipt,
			count: vendorCostCount,
			content: (
				<VendorCostsPanel
					fcrs={row.fcrs || []}
					isAccountingUser={isAccountingUser}
				/>
			),
		},
		{
			id: "payment",
			label: "Payment",
			icon: CreditCard,
			count: paymentCount,
			content: (
				<PaymentRequestPanel
					apiPath="/api/trucking-followup/payment-request"
					parentId={row.id}
					parentIdParam="truckingFollowUpId"
				/>
			),
		},
		{
			id: "activity",
			label: "Activity",
			icon: History,
			count: 0,
			content: (
				<ActivityLogPanel
					jobId={row.id}
					apiPath="/api/trucking-followup/activity-log"
					fieldLabels={TRUCKING_FOLLOWUP_LABELS}
				/>
			),
		},
	];
}

interface DataTableContentProps {
	table: TanStackTable<TruckingFollowUpRow>;
	isLoading?: boolean;
	isFetching?: boolean;
	activeRowTabs?: Record<string, string>;
	isAccountingUser?: boolean;
}

export function TruckingDataTableContent({
	table,
	isLoading,
	isFetching,
	activeRowTabs = {},
	isAccountingUser = false,
}: DataTableContentProps) {
	const headerGroups = table.getHeaderGroups();
	const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
	const [dropTargetColumnId, setDropTargetColumnId] = useState<string | null>(
		null,
	);
	const { containerRef, dragScrollHandlers } =
		useHorizontalDragScroll<HTMLDivElement>();

	const handleDragStart = (e: React.DragEvent, columnId: string) => {
		setDraggedColumnId(columnId);
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", columnId);

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
		if (draggedColumnId && targetColumnId !== draggedColumnId) {
			setDropTargetColumnId(targetColumnId);
		}
	};

	const handleDragLeave = (e: React.DragEvent, targetColumnId: string) => {
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

	// Render skeleton rows during initial load
	const renderSkeletonRows = () => {
		const pageSize = table.getState().pagination.pageSize || 10;

		return Array.from({ length: pageSize }).map((_, rowIndex) => {
			const { left, center, right } = splitVisibleLeafColumnsByPin(table);

			return (
				<TableRow
					key={`skeleton-${rowIndex}`}
					className="flex border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900"
				>
					{/* Left Pinned Skeletons */}
					{left.map((column, idx) => {
						const columnSize = column.getSize();
						const leftOffset = left
							.slice(0, idx)
							.reduce((acc, h) => acc + h.getSize(), 0);

						return (
							<TableCell
								key={`skeleton-${rowIndex}-${column.id}-left`}
								style={{
									width: `${columnSize}px`,
									minWidth: `${columnSize}px`,
									maxWidth: `${columnSize}px`,
									left: `${leftOffset}px`,
								}}
								className={cn(
									"sticky z-20 border-r bg-white dark:bg-slate-900 px-1.5 py-2 overflow-hidden flex-none",
									idx === left.length - 1 &&
										"shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)]",
								)}
							>
								<Skeleton className="h-4 w-full opacity-60" />
							</TableCell>
						);
					})}

					{/* Center (Unpinned) Skeletons */}
					{center.map((column) => {
						const columnSize = column.getSize();
						return (
							<TableCell
								key={`skeleton-${rowIndex}-${column.id}-center`}
								style={{
									width: `${columnSize}px`,
									minWidth: `${columnSize}px`,
									maxWidth: `${columnSize}px`,
								}}
								className="border-r border-slate-200 dark:border-slate-700 px-1.5 py-2 overflow-hidden flex-none"
							>
								<Skeleton className="h-4 w-full opacity-60" />
							</TableCell>
						);
					})}

					{/* Right Pinned Skeletons */}
					{right.map((column, idx) => {
						const columnSize = column.getSize();
						const rightOffset = right
							.slice(idx + 1)
							.reduce((acc, c) => acc + c.getSize(), 0);

						return (
							<TableCell
								key={`skeleton-${rowIndex}-${column.id}-right`}
								style={{
									width: `${columnSize}px`,
									minWidth: `${columnSize}px`,
									maxWidth: `${columnSize}px`,
									right: `${rightOffset}px`,
								}}
								className={cn(
									"sticky z-20 border-l bg-white dark:bg-slate-900 px-1.5 py-2 overflow-hidden flex-none shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.08)]",
								)}
							>
								<Skeleton className="h-4 w-full opacity-60" />
							</TableCell>
						);
					})}
				</TableRow>
			);
		});
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
			<Table className="min-w-0 w-full border-separate border-spacing-0">
				{/* Sticky Header */}
				<TableHeader className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-40">
					{headerGroups.map((headerGroup) => {
						const { left, center, right } = splitOrderedLeafHeadersByPin(
							table,
							headerGroup,
						);

						return (
							<TableRow
								key={headerGroup.id}
								className="flex border-b border-slate-200 dark:border-slate-700"
							>
								{/* Left Pinned Headers */}
								{left.map((header, index) => {
									const columnSize = header.getSize();
									const minSize = header.column.columnDef.minSize ?? 50;
									const maxSize = header.column.columnDef.maxSize ?? 1000;
									const columnId = header.column.id;
									const isDragging = draggedColumnId === columnId;
									const dropPosition = getDropPosition(columnId);
									// Calculate left offset for sticky positioning
									const leftOffset = left
										.slice(0, index)
										.reduce((acc, h) => acc + h.getSize(), 0);

									const isPermanentlyPinned =
										(
											header.column.columnDef.meta as {
												isPermanentlyPinned?: boolean;
											}
										)?.isPermanentlyPinned ?? false;

									return (
										<TableHead
											key={header.id}
											onDragOver={
												isPermanentlyPinned
													? undefined
													: (e) => handleDragOver(e, columnId)
											}
											onDragLeave={
												isPermanentlyPinned
													? undefined
													: (e) => handleDragLeave(e, columnId)
											}
											onDrop={
												isPermanentlyPinned
													? undefined
													: (e) => handleDrop(e, columnId)
											}
											className={cn(
												"sticky top-0 bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 px-1.5 py-1 h-8 flex items-center gap-1 z-50 flex-none",
												index === left.length - 1 &&
													"shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]",
												isDragging && "opacity-50",
											)}
											style={{
												width: `${columnSize}px`,
												minWidth: `${minSize}px`,
												maxWidth: `${maxSize}px`,
												left: `${leftOffset}px`,
											}}
										>
											{/* Drop indicators */}
											{!isPermanentlyPinned && dropPosition === "left" && (
												<div className="absolute left-0 top-0 h-full w-1 bg-blue-500 z-30 rounded-full" />
											)}
											{!isPermanentlyPinned && dropPosition === "right" && (
												<div className="absolute right-0 top-0 h-full w-1 bg-blue-500 z-30 rounded-full" />
											)}
											{/* Drag handle - only for non-permanently pinned columns */}
											{!isPermanentlyPinned && (
												<div
													draggable
													onDragStart={(e) => handleDragStart(e, columnId)}
													onDragEnd={handleDragEnd}
													className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
												>
													<GripVertical className="size-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
												</div>
											)}
											<span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate">
												{flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
											</span>
											{header.column.getCanResize() && (
												<div
													onMouseDown={header.getResizeHandler()}
													onTouchStart={header.getResizeHandler()}
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
								{center.map((header) => {
									const columnSize = header.getSize();
									const minSize = header.column.columnDef.minSize ?? 50;
									const maxSize = header.column.columnDef.maxSize ?? 1000;
									const columnId = header.column.id;
									const isDragging = draggedColumnId === columnId;
									const dropPosition = getDropPosition(columnId);

									return (
										<TableHead
											key={header.id}
											onDragOver={(e) => handleDragOver(e, columnId)}
											onDragLeave={(e) => handleDragLeave(e, columnId)}
											onDrop={(e) => handleDrop(e, columnId)}
											className={cn(
												"sticky top-0 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 px-1.5 py-1 h-8 flex items-center gap-1 z-40 flex-none",
												isDragging && "opacity-50",
											)}
											style={{
												width: `${columnSize}px`,
												minWidth: `${minSize}px`,
												maxWidth: `${maxSize}px`,
											}}
										>
											{/* Drop indicator */}
											{dropPosition === "left" && (
												<div className="absolute left-0 top-0 h-full w-1 bg-blue-500 z-30 rounded-full" />
											)}
											{dropPosition === "right" && (
												<div className="absolute right-0 top-0 h-full w-1 bg-blue-500 z-30 rounded-full" />
											)}
											<div
												draggable
												onDragStart={(e) => handleDragStart(e, columnId)}
												onDragEnd={handleDragEnd}
												className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
											>
												<GripVertical className="size-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
											</div>
											<span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate">
												{flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
											</span>
											{header.column.getCanResize() && (
												<div
													onMouseDown={header.getResizeHandler()}
													onTouchStart={header.getResizeHandler()}
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
									const columnSize = header.getSize();
									const minSize = header.column.columnDef.minSize ?? 50;
									const maxSize = header.column.columnDef.maxSize ?? 1000;
									const columnId = header.column.id;
									const isDragging = draggedColumnId === columnId;
									const dropPosition = getDropPosition(columnId);
									// Calculate right offset for sticky positioning
									const rightOffset = right
										.slice(index + 1)
										.reduce((acc, h) => acc + h.getSize(), 0);

									return (
										<TableHead
											key={header.id}
											onDragOver={(e) => handleDragOver(e, columnId)}
											onDragLeave={(e) => handleDragLeave(e, columnId)}
											onDrop={(e) => handleDrop(e, columnId)}
											className={cn(
												"sticky top-0 bg-slate-100 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 px-1.5 py-1 h-8 flex items-center gap-1 z-50 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.3)] flex-none",
												isDragging && "opacity-50",
											)}
											style={{
												width: `${columnSize}px`,
												minWidth: `${minSize}px`,
												maxWidth: `${maxSize}px`,
												right: `${rightOffset}px`,
											}}
										>
											{/* Drop indicator */}
											{dropPosition === "left" && (
												<div className="absolute left-0 top-0 h-full w-1 bg-blue-500 z-30 rounded-full" />
											)}
											{dropPosition === "right" && (
												<div className="absolute right-0 top-0 h-full w-1 bg-blue-500 z-30 rounded-full" />
											)}
											<div
												draggable
												onDragStart={(e) => handleDragStart(e, columnId)}
												onDragEnd={handleDragEnd}
												className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
											>
												<GripVertical className="size-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
											</div>
											<span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate">
												{flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
											</span>
											{header.column.getCanResize() && (
												<div
													onMouseDown={header.getResizeHandler()}
													onTouchStart={header.getResizeHandler()}
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

								const totalColumns = left.length + center.length + right.length;

								const isEvenRow = rowIndex % 2 === 0;
								const isFinished = row.original.isFinished;
								const hasCCGH =
									row.original.ccgh && row.original.ccgh.length > 0;
								const containers = row.original.containers || [];
								const allContainersHavePOD =
									containers.length === 0 ||
									containers.every((c) => !!c.podUrl && c.podUrl.trim() !== "");
								const isDone = Boolean(
									isFinished && hasCCGH && allContainersHavePOD,
								);

								// Alternating row background logic - matches Logistics scheme
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
									? "group-hover:bg-indigo-200 dark:group-hover:bg-[#1e1b4b]/80"
									: isFinished
										? "group-hover:bg-emerald-200 dark:group-hover:bg-[#063a2f]/80"
										: "group-hover:bg-blue-50 dark:group-hover:bg-slate-700/50";

								const declarations = row.original.declarations || [];
								const allDeclarationsHaveMvUrl =
									declarations.length > 0 &&
									declarations.every((d) => d.mvUrl && d.mvUrl.trim() !== "");

								const batchColorClasses = allDeclarationsHaveMvUrl
									? "bg-orange-500 dark:bg-orange-900/40 group-hover:bg-orange-200 dark:group-hover:bg-orange-900/60"
									: row.original.hasTqDateComplete
										? "bg-sky-100 dark:bg-sky-900/35 group-hover:bg-sky-200 dark:group-hover:bg-sky-900/50"
										: row.original.highestPriorityBatch === "red" ||
												row.original.hasRedDeclaration
											? "bg-red-100 dark:bg-red-900/35 group-hover:bg-red-200 dark:group-hover:bg-red-900/50"
											: row.original.highestPriorityBatch === "yellow"
												? "bg-yellow-100 dark:bg-yellow-900/40 group-hover:bg-yellow-200 dark:group-hover:bg-yellow-900/60"
												: row.original.highestPriorityBatch === "green"
													? "bg-green-100 dark:bg-green-900/35 group-hover:bg-green-200 dark:group-hover:bg-green-900/50"
													: "";

								return (
									<Fragment key={row.id}>
										<TableRow
											key={row.id}
											data-state={row.getIsSelected() && "selected"}
											className={cn(
												"flex transition-colors duration-150 group",
												rowBgClasses,
												rowHoverClasses,
												row.getIsExpanded() &&
													(isDone
														? "bg-indigo-200 dark:bg-indigo-900"
														: isFinished
															? "bg-emerald-200 dark:bg-emerald-900"
															: "bg-blue-100/50 dark:bg-slate-800"),
											)}
										>
											{/* Left Pinned Cells */}
											{left.map((cell, index) => {
												const columnSize = cell.column.getSize();
												const minSize = cell.column.columnDef.minSize ?? 50;
												const maxSize = cell.column.columnDef.maxSize ?? 1000;
												const leftOffset = left
													.slice(0, index)
													.reduce((acc, c) => acc + c.column.getSize(), 0);

												const batchActionClasses =
													cell.column.id === "actions" ? batchColorClasses : "";

												return (
													<TableCell
														data-no-drag-scroll
														key={cell.id}
														style={{
															width: `${columnSize}px`,
															minWidth: `${minSize}px`,
															maxWidth: `${maxSize}px`,
															left: `${leftOffset}px`,
														}}
														className={cn(
															"sticky z-20 border-r border-slate-200 dark:border-slate-700 px-1.5 py-1 text-xs select-text transition-colors duration-150 flex-none",
															index === left.length - 1 &&
																"shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.25)]",
															rowBgClasses,
															rowHoverClasses,
															batchActionClasses,
														)}
													>
														{flexRender(
															cell.column.columnDef.cell,
															cell.getContext(),
														)}
													</TableCell>
												);
											})}

											{/* Center (Unpinned) Cells */}
											{center.map((cell) => {
												const columnSize = cell.column.getSize();
												const minSize = cell.column.columnDef.minSize ?? 50;
												const maxSize = cell.column.columnDef.maxSize ?? 1000;

												const batchActionClasses =
													cell.column.id === "actions" ? batchColorClasses : "";

												return (
													<TableCell
														data-no-drag-scroll
														key={cell.id}
														style={{
															width: `${columnSize}px`,
															minWidth: `${minSize}px`,
															maxWidth: `${maxSize}px`,
														}}
														className={cn(
															"border-r border-slate-200 dark:border-slate-700 px-1.5 py-1 text-xs select-text transition-colors duration-150 flex-none",
															rowBgClasses,
															rowHoverClasses,
															batchActionClasses,
														)}
													>
														{flexRender(
															cell.column.columnDef.cell,
															cell.getContext(),
														)}
													</TableCell>
												);
											})}

											{/* Right Pinned Cells */}
											{right.map((cell, index) => {
												const columnSize = cell.column.getSize();
												const minSize = cell.column.columnDef.minSize ?? 50;
												const maxSize = cell.column.columnDef.maxSize ?? 1000;
												const rightOffset = right
													.slice(index + 1)
													.reduce((acc, c) => acc + c.column.getSize(), 0);

												const batchActionClasses =
													cell.column.id === "actions" ? batchColorClasses : "";

												return (
													<TableCell
														data-no-drag-scroll
														key={cell.id}
														style={{
															width: `${columnSize}px`,
															minWidth: `${minSize}px`,
															maxWidth: `${maxSize}px`,
															right: `${rightOffset}px`,
														}}
														className={cn(
															"sticky z-20 border-l border-slate-200 dark:border-slate-700 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.08)] dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.25)] px-1.5 py-1 text-xs select-text transition-colors duration-150 flex-none",
															rowBgClasses,
															rowHoverClasses,
															batchActionClasses,
														)}
													>
														{flexRender(
															cell.column.columnDef.cell,
															cell.getContext(),
														)}
													</TableCell>
												);
											})}
										</TableRow>
										{/* Expanded row details */}
										{row.getIsExpanded() && (
											<TableRow className="bg-slate-50 dark:bg-slate-800/50">
												<ExpandedDetailTableCell colSpan={totalColumns}>
													<BaseDetailsPanel
														tabs={buildTruckingTabs(
															row.original,
															isAccountingUser,
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
		</div>
	);
}
