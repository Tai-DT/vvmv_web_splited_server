"use client";

import {
	horizontalListSortingStrategy,
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	ChevronDown,
	ChevronsUpDown,
	ChevronUp,
	GripVertical,
	Search,
	SlidersHorizontal,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ALL_OPTIONAL_FIELDS } from "@/lib/trucking/fcr-fields";
import { cn } from "@/lib/utils";
import type { FCRBoardItem } from "../types";
import { useFCRFieldsStore } from "../use-fcr-fields-store";
import { FcrTableRow } from "./fcr-table-row";

const ALL_POSSIBLE_COLUMNS = [
	{ key: "type", label: "N/X" },
	{ key: "serviceMode", label: "Mode" },
	...ALL_OPTIONAL_FIELDS,
];

const NUMERIC_COLS = new Set(["weight", "cbm", "qty"]);

type SortDir = "asc" | "desc";
type SortItem = { colKey: string; dir: SortDir };
type SortState = SortItem[];

/** Extract plain-text / numeric comparable value from an FCR for a given column key */
function getFcrColumnText(fcr: FCRBoardItem, colKey: string): string {
	switch (colKey) {
		case "type":
			return fcr.truckingFollowUp.operationType === "NHAP"
				? "nhap n"
				: "xuat x";
		case "serviceMode":
			return fcr.truckingFollowUp.serviceMode ?? "";
		case "fcrNumber":
			return fcr.fcrNumber ?? "";
		case "date": {
			const raw =
				fcr.implementationDate ?? fcr.truckingFollowUp.implementationDate;
			if (!raw) return "";
			const s = typeof raw === "string" ? raw : (raw as Date).toISOString();
			const parts = s.split("-");
			return parts.length === 3 ? `${parts[2].substring(0, 2)}/${parts[1]}` : s;
		}
		case "weight":
			return fcr.grossWeight != null ? String(fcr.grossWeight) : "";
		case "cbm":
			return fcr.cbm != null ? String(fcr.cbm) : "";
		case "qty":
			return fcr.quantity != null ? String(fcr.quantity) : "";
		case "jobNumber":
			return fcr.truckingFollowUp.jobNumber ?? "";
		case "billOrBooking":
			return fcr.truckingFollowUp.billOrBooking ?? "";
		case "companyName":
			return fcr.truckingFollowUp.companyName ?? "";
		case "warehouse":
			return fcr.truckingFollowUp.warehouse ?? "";
		case "route":
			return [fcr.pickupAt, fcr.deliveryAt].filter(Boolean).join(" ");
		case "shipper":
			return (
				fcr.truckingFollowUp.companyName?.trim() || fcr.shipper?.trim() || ""
			);
		case "vendor":
			return fcr.vendor ?? "";
		case "plateNumber":
			return fcr.plateNumber ?? "";
		case "driver":
			return fcr.driver ?? "";
		case "truckType":
			return fcr.truckType ?? "";
		case "containerNumber":
			return fcr.containerNo ?? "";
		case "routineDetail":
			return fcr.truckingFollowUp.routineDetail ?? "";
		case "pickUpTime":
			return fcr.truckingFollowUp.pickUpTime ?? "";
		case "pickupAt":
			return fcr.pickupAt ?? "";
		case "deliveryAt":
			return fcr.deliveryAt ?? "";
		case "notes":
			return [fcr.notes, fcr.truckingFollowUp.note].filter(Boolean).join(" ");
		default:
			return "";
	}
}

function getFcrNumericValue(fcr: FCRBoardItem, colKey: string): number {
	switch (colKey) {
		case "weight":
			return fcr.grossWeight ?? 0;
		case "cbm":
			return fcr.cbm ?? 0;
		case "qty":
			return fcr.quantity ?? 0;
		default:
			return 0;
	}
}

// ─── Header Cell ─────────────────────────────────────────────────────────────

function FcrTableHeaderCell({
	colKey,
	label,
	filterValue,
	onFilterChange,
	sortInfo,
	onSortChange,
	forceClose,
	width,
	onResize,
}: {
	colKey: string;
	label: string;
	filterValue: string;
	onFilterChange: (val: string) => void;
	sortInfo: { dir: SortDir; rank: number } | null;
	onSortChange: () => void;
	forceClose?: boolean;
	width?: number;
	onResize: (width: number) => void;
}) {
	const [filterOpen, setFilterOpen] = useState(false);
	const resizingRef = useRef(false);

	// Synchronize internal open state with global clear
	useEffect(() => {
		if (forceClose && filterValue === "") {
			setFilterOpen(false);
		}
	}, [forceClose, filterValue]);
	const inputRef = useRef<HTMLInputElement>(null);
	const hasFilter = filterValue.trim() !== "";
	const isFilterVisible = filterOpen || hasFilter;
	const isActive = hasFilter || sortInfo !== null;

	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: `col-${colKey}`,
		data: { type: "column", colKey },
		disabled: resizingRef.current,
	});

	const thRef = useRef<HTMLTableHeaderCellElement | null>(null);

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		width: width ? `${width}px` : "150px",
		minWidth: width ? `${width}px` : "150px",
	};

	const handleToggleFilter = useCallback(
		(e: React.PointerEvent) => {
			if (resizingRef.current) return;
			e.stopPropagation();
			e.preventDefault();
			if (hasFilter) {
				onFilterChange("");
				setFilterOpen(false);
			} else {
				setFilterOpen((v) => {
					const next = !v;
					if (next) setTimeout(() => inputRef.current?.focus(), 60);
					return next;
				});
			}
		},
		[hasFilter, onFilterChange],
	);

	const handleSortClick = useCallback(
		(e: React.MouseEvent) => {
			if (resizingRef.current) return;
			e.stopPropagation();
			e.preventDefault();
			onSortChange();
		},
		[onSortChange],
	);

	const handleInputKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Escape") {
				onFilterChange("");
				setFilterOpen(false);
			}
		},
		[onFilterChange],
	);

	const handleInputBlur = useCallback(() => {
		if (!hasFilter) setFilterOpen(false);
	}, [hasFilter]);

	const onMouseDown = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		resizingRef.current = true;
		const startX = e.clientX;
		const startWidth =
			width || (thRef.current?.getBoundingClientRect().width ?? 100);

		const onMouseMove = (moveEvent: MouseEvent) => {
			const newWidth = Math.max(50, startWidth + (moveEvent.clientX - startX));
			onResize(newWidth);
		};

		const onMouseUp = () => {
			resizingRef.current = false;
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
		};

		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", onMouseUp);
	};

	const SortIcon =
		sortInfo?.dir === "asc"
			? ChevronUp
			: sortInfo?.dir === "desc"
				? ChevronDown
				: ChevronsUpDown;

	return (
		<th
			ref={(node) => {
				setNodeRef(node);
				thRef.current = node;
			}}
			style={style}
			{...attributes}
			className={cn(
				"p-0 text-left align-top select-none transition-colors group relative border-r border-slate-300 last:border-r-0",
				isDragging && "opacity-40",
				isActive
					? hasFilter
						? "bg-blue-50"
						: "bg-violet-50/60"
					: "bg-slate-100",
			)}
		>
			<div className="flex items-center gap-0.5 px-1.5 pt-1.5 pb-1 h-full">
				{/* ── Drag handle ─────────────────────────────── */}
				<div
					{...listeners}
					className="shrink-0 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-400 mt-px"
					title="Kéo để sắp xếp cột"
				>
					<GripVertical className="w-3 h-3" />
				</div>

				{/* ── Label + sort click ─────────────────────── */}
				<button
					type="button"
					onClick={handleSortClick}
					title={
						sortInfo?.dir === "asc"
							? "Đang sắp xếp tăng dần — click để đảo"
							: sortInfo?.dir === "desc"
								? "Đang sắp xếp giảm dần — click để bỏ"
								: "Click để thêm vào danh sách sắp xếp"
					}
					className={cn(
						"flex items-center gap-0.5 flex-1 min-w-0 rounded px-0.5 transition-colors",
						"hover:bg-black/5 active:bg-black/10",
					)}
				>
					<span
						className={cn(
							"text-[10px] font-bold tracking-wide uppercase truncate leading-none",
							sortInfo
								? "text-violet-700"
								: hasFilter
									? "text-blue-700"
									: "text-slate-500",
						)}
					>
						{label}
						{sortInfo && sortInfo.rank > 0 && (
							<span className="ml-0.5 text-[8px] opacity-70">
								({sortInfo.rank})
							</span>
						)}
					</span>
					<SortIcon
						className={cn(
							"shrink-0 transition-colors",
							sortInfo
								? "w-3 h-3 text-violet-500"
								: "w-2.5 h-2.5 text-slate-400 group-hover:text-slate-600",
						)}
					/>
				</button>

				{/* ── Filter icon ───────────────────────────── */}
				<button
					type="button"
					onPointerDown={handleToggleFilter}
					title={hasFilter ? "Xóa filter cột này" : "Lọc cột này"}
					className={cn(
						"shrink-0 rounded p-0.5 transition-all mr-1",
						hasFilter
							? "text-blue-500 bg-blue-100"
							: "text-slate-400 hover:text-slate-600 hover:bg-slate-200",
					)}
				>
					{hasFilter ? (
						<X className="w-2.5 h-2.5" />
					) : (
						<Search className="w-2.5 h-2.5" />
					)}
				</button>
			</div>

			{/* ── Inline filter input ──────────────────────── */}
			<div
				className={cn(
					"overflow-hidden transition-all duration-200 ease-in-out",
					isFilterVisible
						? "max-h-8 opacity-100 pb-1.5 px-1.5"
						: "max-h-0 opacity-0",
				)}
			>
				<input
					ref={inputRef}
					type="text"
					value={filterValue}
					onPointerDown={(e) => e.stopPropagation()}
					onChange={(e) => onFilterChange(e.target.value)}
					onKeyDown={handleInputKeyDown}
					onBlur={handleInputBlur}
					placeholder="tìm..."
					className={cn(
						"w-full h-5 px-1.5 text-[9px] rounded border font-medium",
						"placeholder:text-slate-300 focus:outline-none transition-all",
						"focus:ring-1 focus:ring-blue-400 focus:border-blue-400",
						hasFilter
							? "border-blue-300 bg-blue-50 text-blue-800"
							: "border-slate-200 bg-white text-slate-600",
					)}
				/>
			</div>

			{/* ── Resizer ─────────────────────────────────── */}
			<div
				onMouseDown={onMouseDown}
				className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 opacity-0 group-hover:opacity-100 z-10 transition-colors"
			/>
		</th>
	);
}

// ─── FcrTable ─────────────────────────────────────────────────────────────────

export function FcrTable({
	fcrs,
	columnsOrder,
	selectedFcrIds,
	onToggleSelection,
	onSelectAll,
	allSelected,
	columnDate,
}: {
	fcrs: FCRBoardItem[];
	columnsOrder: string[];
	selectedFcrIds: Set<string>;
	onToggleSelection: (id: string, selected: boolean) => void;
	onSelectAll: (selected: boolean, visibleIds: string[]) => void;
	allSelected: boolean;
	columnDate?: string;
}) {
	const [columnFilters, setColumnFilters] = useState<Record<string, string>>(
		{},
	);
	const [sortState, setSortState] = useState<SortState>([]);

	const handleFilterChange = useCallback((colKey: string, val: string) => {
		setColumnFilters((prev) => ({ ...prev, [colKey]: val }));
	}, []);

	// Cycle: asc → desc → none (always appends to multi-sort)
	const handleSortChange = useCallback((colKey: string) => {
		setSortState((prev) => {
			const existingIdx = prev.findIndex((s) => s.colKey === colKey);

			if (existingIdx === -1) {
				// Add new column to the end of sort criteria
				return [...prev, { colKey, dir: "asc" }];
			}

			const current = prev[existingIdx];
			if (current.dir === "asc") {
				// Toggle to desc
				const next = [...prev];
				next[existingIdx] = { ...current, dir: "desc" };
				return next;
			} else {
				// Remove from sort
				return prev.filter((s) => s.colKey !== colKey);
			}
		});
	}, []);

	const visibleCols = useMemo(() => {
		return columnsOrder.map((colKey) => {
			const found = ALL_POSSIBLE_COLUMNS.find((c) => c.key === colKey);
			return { key: colKey, label: found?.label ?? colKey };
		});
	}, [columnsOrder]);

	// 1. Filter
	const filteredFcrs = useMemo(() => {
		const activeFilters = Object.entries(columnFilters).filter(
			([, v]) => v.trim() !== "",
		);
		if (activeFilters.length === 0) return fcrs;
		return fcrs.filter((fcr) =>
			activeFilters.every(([colKey, filterVal]) => {
				const text = getFcrColumnText(fcr, colKey).toLowerCase();
				return text.includes(filterVal.toLowerCase().trim());
			}),
		);
	}, [fcrs, columnFilters]);

	// 2. Sort
	const displayFcrs = useMemo(() => {
		if (sortState.length === 0) return filteredFcrs;

		return [...filteredFcrs].sort((a, b) => {
			for (const { colKey, dir } of sortState) {
				const mul = dir === "asc" ? 1 : -1;
				let res = 0;

				if (NUMERIC_COLS.has(colKey)) {
					res = getFcrNumericValue(a, colKey) - getFcrNumericValue(b, colKey);
				} else if (colKey === "date") {
					const aRaw =
						a.implementationDate ?? a.truckingFollowUp.implementationDate ?? "";
					const bRaw =
						b.implementationDate ?? b.truckingFollowUp.implementationDate ?? "";
					res = aRaw.localeCompare(bRaw);
				} else {
					res = getFcrColumnText(a, colKey).localeCompare(
						getFcrColumnText(b, colKey),
						"vi",
					);
				}

				if (res !== 0) return res * mul;
			}
			return 0;
		});
	}, [filteredFcrs, sortState]);

	const activeFilterCount = Object.values(columnFilters).filter(
		(v) => v.trim() !== "",
	).length;
	const hasActiveFilter = activeFilterCount > 0;
	const hasSort = sortState.length > 0;
	const showStatusBar = hasActiveFilter || hasSort;

	const fcrIds = useMemo(
		() => displayFcrs.map((f) => `fcr-${f.id}`),
		[displayFcrs],
	);
	const columnIds = useMemo(
		() => columnsOrder.map((c) => `col-${c}`),
		[columnsOrder],
	);

	const columnWidths = useFCRFieldsStore((s) => s.columnWidths);
	const setColumnWidth = useFCRFieldsStore((s) => s.setColumnWidth);

	return (
		<div
			className="w-full rounded-lg border border-slate-200 bg-white flex flex-col"
			style={{ maxHeight: "calc(100vh - 180px)" }}
		>
			{/* Fixed-height Status Bar — prevents header jumping */}
			<div className="flex items-center justify-between px-2.5 h-7 bg-slate-50/50 border-b border-slate-100 shrink-0">
				<div className="flex items-center gap-3">
					<div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-700/80">
						<SlidersHorizontal className="w-3 h-3" />
						<span>
							KẾT QUẢ: {displayFcrs.length}/{fcrs.length}
						</span>
					</div>

					{hasActiveFilter ? (
						<button
							onClick={() => setColumnFilters({})}
							className="flex items-center gap-1 text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors"
						>
							<Search className="w-2.5 h-2.5" />
							BỎ LỌC ({activeFilterCount})
						</button>
					) : hasSort ? null : (
						<span className="text-[9px] text-slate-400 italic">
							Bảng chưa bật lọc
						</span>
					)}

					{hasSort && (
						<button
							onClick={() => setSortState([])}
							className="flex items-center gap-1 text-[9px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded border border-violet-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors"
						>
							<ChevronUp className="w-2.5 h-2.5" />
							BỎ SẮP XẾP ({sortState.length})
						</button>
					)}
				</div>

				{showStatusBar ? (
					<button
						onClick={() => {
							setColumnFilters({});
							setSortState([]);
						}}
						className="text-[9px] font-bold text-slate-400 hover:text-red-600 flex items-center gap-1"
					>
						<X className="w-2.5 h-2.5" />
						BỎ TẤT CẢ
					</button>
				) : (
					<span className="text-[9px] text-slate-300 font-medium">
						Chế độ xem chuẩn
					</span>
				)}
			</div>

			<div className="overflow-auto flex-1">
				<table className="min-w-full w-max text-sm table-fixed">
					<thead className="sticky top-0 z-10">
						<tr className="border-b border-slate-200">
							{/* Checkbox */}
							<th className="p-2 w-8 text-center bg-slate-100 align-middle border-r border-slate-300">
								<input
									type="checkbox"
									checked={allSelected && displayFcrs.length > 0}
									onChange={(e) =>
										onSelectAll(
											e.target.checked,
											displayFcrs.map((f) => f.id),
										)
									}
									className="cursor-pointer"
								/>
							</th>
							{/* Row drag handle column */}
							<th className="p-2 w-8 bg-slate-100 border-r border-slate-300" />
							<SortableContext
								items={columnIds}
								strategy={horizontalListSortingStrategy}
							>
								{visibleCols.map((col) => {
									const sortIdx = sortState.findIndex(
										(s) => s.colKey === col.key,
									);
									const sortEntry =
										sortIdx !== -1 ? sortState[sortIdx] : undefined;
									const sortInfo =
										sortEntry?.dir !== undefined
											? {
													dir: sortEntry.dir,
													rank: sortState.length > 1 ? sortIdx + 1 : 0,
												}
											: null;
									return (
										<FcrTableHeaderCell
											key={col.key}
											colKey={col.key}
											label={col.label}
											filterValue={columnFilters[col.key] ?? ""}
											onFilterChange={(val) => handleFilterChange(col.key, val)}
											sortInfo={sortInfo}
											onSortChange={() => handleSortChange(col.key)}
											forceClose={!hasActiveFilter}
											width={columnWidths[col.key]}
											onResize={(w) => setColumnWidth(col.key, w)}
										/>
									);
								})}
							</SortableContext>
							{/* Spacer column to absorb remaining width */}
							<th className="w-auto bg-slate-100" />
						</tr>
					</thead>
					<tbody className="bg-white">
						{displayFcrs.length === 0 ? (
							<tr>
								<td
									colSpan={columnsOrder.length + 3}
									className="p-8 text-center text-slate-400 text-xs italic"
								>
									{hasActiveFilter
										? "Không có FCR khớp với bộ lọc"
										: "Không có dữ liệu FCR"}
								</td>
							</tr>
						) : (
							<SortableContext
								items={fcrIds}
								strategy={verticalListSortingStrategy}
							>
								{displayFcrs.map((fcr, idx) => (
									<FcrTableRow
										key={fcr.id}
										fcr={fcr}
										index={idx}
										columnsOrder={columnsOrder}
										isSelected={selectedFcrIds.has(fcr.id)}
										onToggleSelection={onToggleSelection}
										columnDate={columnDate}
									/>
								))}
							</SortableContext>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
