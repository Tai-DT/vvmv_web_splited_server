"use client";

import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Table } from "@tanstack/react-table";
import {
	Columns3,
	Eye,
	EyeOff,
	GripVertical,
	Pin,
	PinOff,
	RotateCcw,
	Search,
	SortAsc,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnConfig } from "@/components/shared/data-table/types/column-config";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ColumnManageDialogProps<TData> {
	table: Table<TData>;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	columnHeaders: Record<string, ColumnConfig>;
}

interface ColumnItem {
	id: string;
	header: string;
	visible: boolean;
	pinned: false | "left" | "right";
	isPermanentlyPinned?: boolean;
	canHide?: boolean;
}

// ---------- Pin Toggle Button ----------
function PinButton({
	pinned,
	isPermanentlyPinned,
	onChange,
}: {
	pinned: false | "left" | "right";
	isPermanentlyPinned?: boolean;
	onChange: (pin: false | "left" | "right") => void;
}) {
	const cycle = () => {
		if (isPermanentlyPinned) return;
		if (!pinned) onChange("left");
		else if (pinned === "left") onChange("right");
		else onChange(false);
	};

	const label =
		pinned === "left" ? "Left" : pinned === "right" ? "Right" : "Unpin";
	const color =
		pinned === "left"
			? "text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-900/20 dark:border-indigo-800"
			: pinned === "right"
				? "text-violet-600 bg-violet-50 border-violet-200 dark:text-violet-400 dark:bg-violet-900/20 dark:border-violet-800"
				: "text-slate-400 bg-slate-50 border-slate-200 dark:text-slate-500 dark:bg-slate-800/50 dark:border-slate-700";

	return (
		<button
			type="button"
			onClick={cycle}
			disabled={isPermanentlyPinned}
			title={`Pin: ${label} (click to cycle)`}
			className={cn(
				"flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border transition-all",
				color,
				isPermanentlyPinned
					? "cursor-not-allowed opacity-60"
					: "hover:opacity-80 cursor-pointer",
			)}
		>
			{pinned ? (
				<Pin className="size-2.5 shrink-0" />
			) : (
				<PinOff className="size-2.5 shrink-0 opacity-50" />
			)}
			{label}
		</button>
	);
}

// ---------- Draggable Row (for manual-order mode) ----------
function SortableColumnRow({
	item,
	onVisibilityChange,
	onPinChange,
}: {
	item: ColumnItem;
	onVisibilityChange: (v: boolean) => void;
	onPinChange: (pin: false | "left" | "right") => void;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: item.id, disabled: item.isPermanentlyPinned });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.4 : 1,
		zIndex: isDragging ? 50 : undefined,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				"flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
				item.visible
					? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
					: "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800",
				isDragging && "shadow-lg ring-2 ring-indigo-400/40",
			)}
		>
			{/* Drag handle */}
			<div
				{...attributes}
				{...listeners}
				className={cn(
					"shrink-0 touch-none",
					item.isPermanentlyPinned
						? "cursor-not-allowed text-slate-200 dark:text-slate-700"
						: "cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400",
				)}
			>
				<GripVertical className="size-4" />
			</div>

			{/* Label */}
			<span
				className={cn(
					"flex-1 min-w-0 truncate text-xs font-semibold",
					item.visible
						? "text-slate-800 dark:text-slate-100"
						: "text-slate-400 dark:text-slate-500 line-through",
				)}
			>
				{item.header || item.id}
			</span>

			{/* Pin button */}
			<PinButton
				pinned={item.pinned}
				isPermanentlyPinned={item.isPermanentlyPinned}
				onChange={onPinChange}
			/>

			{/* Visibility checkbox */}
			<Checkbox
				checked={item.visible}
				disabled={!item.canHide}
				onCheckedChange={item.canHide ? onVisibilityChange : undefined}
				className="ml-1 shrink-0"
			/>
		</div>
	);
}

// ---------- Static Row (for A-Z mode) ----------
function StaticColumnRow({
	item,
	onVisibilityChange,
	onPinChange,
}: {
	item: ColumnItem;
	onVisibilityChange: (v: boolean) => void;
	onPinChange: (pin: false | "left" | "right") => void;
}) {
	return (
		<div
			className={cn(
				"flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
				item.visible
					? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
					: "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800",
			)}
		>
			{/* Placeholder for grip (no drag in A-Z mode) */}
			<div className="shrink-0 w-4" />

			<span
				className={cn(
					"flex-1 min-w-0 truncate text-xs font-semibold",
					item.visible
						? "text-slate-800 dark:text-slate-100"
						: "text-slate-400 dark:text-slate-500 line-through",
				)}
			>
				{item.header || item.id}
			</span>

			<PinButton
				pinned={item.pinned}
				isPermanentlyPinned={item.isPermanentlyPinned}
				onChange={onPinChange}
			/>

			<Checkbox
				checked={item.visible}
				disabled={!item.canHide}
				onCheckedChange={item.canHide ? onVisibilityChange : undefined}
				className="ml-1 shrink-0"
			/>
		</div>
	);
}

// ---------- Main Dialog ----------
export function ColumnManageDialog<TData>({
	table,
	open,
	onOpenChange,
	columnHeaders,
}: ColumnManageDialogProps<TData>) {
	const allColumns = table.getAllColumns();

	const [columnIds, setColumnIds] = useState<string[]>(() => {
		const order = table.getState().columnOrder;
		return order.length > 0 ? order : allColumns.map((c) => c.id);
	});

	// Local map tracks visible/pin so we can update without re-sorting the list
	const [localState, setLocalState] = useState<
		Map<string, { visible: boolean; pinned: false | "left" | "right" }>
	>(() => new Map());

	const [search, setSearch] = useState("");
	const [sortAZ, setSortAZ] = useState(false);

	// Initialise / re-sync when dialog opens
	useEffect(() => {
		if (open) {
			const order = table.getState().columnOrder;
			const ids = order.length > 0 ? order : allColumns.map((c) => c.id);
			setColumnIds(ids);
			setSearch("");
			setSortAZ(false);

			const map = new Map<
				string,
				{ visible: boolean; pinned: false | "left" | "right" }
			>();
			ids.forEach((id) => {
				const col = allColumns.find((c) => c.id === id);
				map.set(id, {
					visible: col?.getIsVisible() ?? true,
					pinned: col?.getIsPinned() ?? false,
				});
			});
			setLocalState(map);
		}
	}, [open, table, allColumns]);

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const handleDragEnd = useCallback(
		(event: DragEndEvent) => {
			const { active, over } = event;
			if (over && active.id !== over.id) {
				const oldIndex = columnIds.indexOf(active.id as string);
				const newIndex = columnIds.indexOf(over.id as string);
				const newOrder = arrayMove(columnIds, oldIndex, newIndex);
				setColumnIds(newOrder);
				table.setColumnOrder(newOrder);
			}
		},
		[columnIds, table],
	);

	// Build items — order comes from columnIds (stable), state from localState (no sort side-effect)
	const items: ColumnItem[] = useMemo(() => {
		return columnIds
			.filter((id) => id !== "actions")
			.map((id) => {
				const cfg = columnHeaders[id];
				const ls = localState.get(id);
				const col = allColumns.find((c) => c.id === id);
				return {
					id,
					header: cfg?.header || id,
					visible: ls?.visible ?? col?.getIsVisible() ?? true,
					pinned: ls?.pinned ?? col?.getIsPinned() ?? false,
					isPermanentlyPinned: cfg?.isPermanentlyPinned ?? false,
					canHide: cfg?.enableHiding !== false,
				};
			});
	}, [columnIds, columnHeaders, localState, allColumns]);

	// Apply search filter
	const filtered = useMemo(() => {
		if (!search.trim()) return items;
		const q = search.toLowerCase();
		return items.filter(
			(item) =>
				item.header.toLowerCase().includes(q) ||
				item.id.toLowerCase().includes(q),
		);
	}, [items, search]);

	// Sort if A-Z mode — uses stable sort so items with same header keep relative order
	const displayItems = useMemo(() => {
		if (!sortAZ) return filtered;
		return [...filtered].sort((a, b) => a.header.localeCompare(b.header, "vi"));
	}, [filtered, sortAZ]);

	// Stats
	const visibleCount = items.filter((i) => i.visible).length;
	const pinnedCount = items.filter((i) => i.pinned).length;
	const totalCount = items.length;

	// Update localState only (no re-sort triggered), then apply to table
	const handleVisibility = (id: string, visible: boolean) => {
		setLocalState((prev) => {
			const next = new Map(prev);
			const cur = next.get(id) ?? { visible: true, pinned: false as const };
			next.set(id, { ...cur, visible });
			return next;
		});
		const col = allColumns.find((c) => c.id === id);
		col?.toggleVisibility(visible);
	};

	const handlePin = (id: string, pin: false | "left" | "right") => {
		setLocalState((prev) => {
			const next = new Map(prev);
			const cur = next.get(id) ?? { visible: true, pinned: false as const };
			next.set(id, { ...cur, pinned: pin });
			return next;
		});
		const col = allColumns.find((c) => c.id === id);
		col?.pin(pin);
	};

	const handleShowAll = () => {
		setLocalState((prev) => {
			const next = new Map(prev);
			next.forEach((val, id) => {
				if (columnHeaders[id]?.enableHiding !== false) {
					next.set(id, { ...val, visible: true });
				}
			});
			return next;
		});
		allColumns.forEach((col) => {
			if (col.id !== "actions" && col.getCanHide()) col.toggleVisibility(true);
		});
	};

	const handleHideAll = () => {
		setLocalState((prev) => {
			const next = new Map(prev);
			next.forEach((val, id) => {
				if (id !== "actions" && columnHeaders[id]?.enableHiding !== false) {
					next.set(id, { ...val, visible: false });
				}
			});
			return next;
		});
		allColumns.forEach((col) => {
			const cfg = columnHeaders[col.id];
			if (col.id !== "actions" && cfg?.enableHiding !== false)
				col.toggleVisibility(false);
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="!max-w-xl p-0 gap-0 overflow-hidden rounded-2xl">
				{/* Header */}
				<DialogHeader className="px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-900">
					<div className="flex items-center gap-3">
						<div className="size-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/20">
							<Columns3 className="size-5 text-white" />
						</div>
						<div>
							<DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
								Manage Columns
							</DialogTitle>
							<p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
								<span className="font-semibold text-indigo-600">
									{visibleCount}
								</span>
								/{totalCount} visible
								{pinnedCount > 0 && (
									<span className="ml-2 text-violet-600 font-semibold">
										· {pinnedCount} pinned
									</span>
								)}
							</p>
						</div>
					</div>
				</DialogHeader>

				{/* Toolbar */}
				<div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
					{/* Search */}
					<div className="relative flex-1">
						<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
						<Input
							placeholder="Tìm cột..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="pl-8 h-8 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-indigo-500"
						/>
					</div>

					{/* Sort toggle */}
					<button
						type="button"
						onClick={() => setSortAZ((v) => !v)}
						title={
							sortAZ
								? "Đang xếp A-Z — click để xếp theo vị trí bảng"
								: "Xếp A-Z"
						}
						className={cn(
							"flex items-center gap-1.5 h-8 px-3 rounded-md text-[11px] font-bold uppercase tracking-wide border transition-all shrink-0",
							sortAZ
								? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-400/30"
								: "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-400",
						)}
					>
						<SortAsc className="size-3.5" />
						A–Z
					</button>

					{/* Show/Hide all */}
					<button
						type="button"
						onClick={handleShowAll}
						title="Hiện tất cả"
						className="flex items-center gap-1 h-8 px-2 rounded-md text-[11px] font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-all shrink-0"
					>
						<Eye className="size-3.5" />
					</button>
					<button
						type="button"
						onClick={handleHideAll}
						title="Ẩn tất cả"
						className="flex items-center gap-1 h-8 px-2 rounded-md text-[11px] font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 transition-all shrink-0"
					>
						<EyeOff className="size-3.5" />
					</button>
				</div>

				{/* Legend */}
				<div className="flex items-center gap-4 px-4 py-2 bg-slate-50/60 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
					<span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex-1">
						{sortAZ ? "Sắp xếp A-Z" : "Theo thứ tự bảng (kéo để sắp xếp)"}
					</span>
					<div className="flex items-center gap-3 text-[10px] text-slate-400">
						<span className="flex items-center gap-1">
							<span className="inline-block size-2 rounded-sm bg-indigo-400" />
							Pin trái
						</span>
						<span className="flex items-center gap-1">
							<span className="inline-block size-2 rounded-sm bg-violet-400" />
							Pin phải
						</span>
						<span className="flex items-center gap-1">
							<Checkbox checked={true} className="size-3 pointer-events-none" />
							Hiện
						</span>
					</div>
				</div>

				{/* Column list */}
				<div className="overflow-y-auto max-h-[380px] px-3 py-3 space-y-1.5">
					{displayItems.length === 0 && (
						<div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-600">
							<Search className="size-8 mb-2 opacity-30" />
							<p className="text-sm font-medium">Không tìm thấy cột nào</p>
							<p className="text-xs mt-1">Thử tìm với từ khóa khác</p>
						</div>
					)}

					{sortAZ ? (
						// A-Z mode: static rows (no drag)
						displayItems.map((item) => (
							<StaticColumnRow
								key={item.id}
								item={item}
								onVisibilityChange={(v) => handleVisibility(item.id, v)}
								onPinChange={(pin) => handlePin(item.id, pin)}
							/>
						))
					) : (
						// Manual order mode: draggable rows
						<DndContext
							sensors={sensors}
							collisionDetection={closestCenter}
							onDragEnd={handleDragEnd}
							modifiers={[restrictToVerticalAxis]}
						>
							<SortableContext
								items={displayItems.map((i) => i.id)}
								strategy={verticalListSortingStrategy}
							>
								{displayItems.map((item) => (
									<SortableColumnRow
										key={item.id}
										item={item}
										onVisibilityChange={(v) => handleVisibility(item.id, v)}
										onPinChange={(pin) => handlePin(item.id, pin)}
									/>
								))}
							</SortableContext>
						</DndContext>
					)}
				</div>

				{/* Footer */}
				<DialogFooter className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-2">
					<button
						type="button"
						onClick={() => {
							// Reset to default order (all visible)
							const defaultOrder = allColumns.map((c) => c.id);
							setColumnIds(defaultOrder);
							table.setColumnOrder(defaultOrder);
							allColumns.forEach((col) => {
								if (col.id !== "actions") col.toggleVisibility(true);
								col.pin(false);
							});
							// Re-pin permanently pinned
							allColumns.forEach((col) => {
								const cfg = columnHeaders[col.id];
								if (cfg?.isPermanentlyPinned) col.pin("left");
							});
							// Rebuild localState to match reset
							const map = new Map<
								string,
								{ visible: boolean; pinned: false | "left" | "right" }
							>();
							defaultOrder.forEach((id) => {
								const cfg = columnHeaders[id];
								map.set(id, {
									visible: true,
									pinned: cfg?.isPermanentlyPinned ? "left" : false,
								});
							});
							setLocalState(map);
						}}
						className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-semibold transition-colors"
					>
						<RotateCcw className="size-3.5" />
						Đặt lại mặc định
					</button>
					<Button
						onClick={() => onOpenChange(false)}
						className="h-9 px-6 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm shadow-indigo-400/30 transition-all"
					>
						Xong
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
