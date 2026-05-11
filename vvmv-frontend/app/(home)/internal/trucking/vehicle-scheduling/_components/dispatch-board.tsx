"use client";

import {
	type CollisionDetection,
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	PointerSensor,
	pointerWithin,
	rectIntersection,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	Funnel,
	MapPin,
	Package,
	RefreshCw,
	Weight,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { CombineJobsDialog } from "../../../trucking-followup/_components/dialogs/combine-jobs-dialog";
import type { TruckingFollowUpRow } from "../../../trucking-followup/types";
import type { BoardData, FCRBoardItem, TruckSlot } from "../types";
import { useFCRFieldsStore } from "../use-fcr-fields-store";
import { DayColumn } from "./day-column";
import {
	DispatchFilterBar,
	type DispatchFilters,
	EMPTY_FILTERS,
	filterFcr,
	isFiltering,
} from "./dispatch-filter-bar";
import { FCRFieldsPopover } from "./fcr-fields-popover";
import { FcrTableRow } from "./fcr-table-row";
import { useDispatchHeaderStore } from "./use-dispatch-header-store";
import { useDispatchToolbarStore } from "./use-dispatch-toolbar-store";

function generateDateRange(from: string, to: string): string[] {
	const dates: string[] = [];
	const current = new Date(`${from}T00:00:00Z`);
	const end = new Date(`${to}T00:00:00Z`);
	while (current <= end) {
		dates.push(current.toISOString().slice(0, 10));
		current.setUTCDate(current.getUTCDate() + 1);
	}
	return dates;
}

function addDays(dateStr: string, n: number) {
	const d = new Date(`${dateStr}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
}

async function fetchBoard(from: string, to: string): Promise<BoardData> {
	const params = new URLSearchParams({ from, to });
	const res = await fetch(`/api/dispatch/board?${params}`);
	if (!res.ok) throw new Error("Failed to fetch dispatch board");
	return res.json();
}

async function assignFcr(payload: {
	fcrIds: string[];
	truckingNumberId: string;
	implementationDate: string;
	tripNumber: number;
}) {
	const res = await fetch("/api/dispatch/assign", {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	if (!res.ok) throw new Error("Failed to assign FCR");
}

async function unassignFcr(payload: {
	fcrIds: string[];
	implementationDate?: string | null;
}) {
	const res = await fetch("/api/dispatch/unassign", {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	if (!res.ok) throw new Error("Failed to unassign FCR");
}

export function DispatchBoard() {
	const customCollisionDetection: CollisionDetection = useCallback((args) => {
		const pointerCollisions = pointerWithin(args);

		// 1. Phân loại xem con trỏ chuột có đang trỏ thẳng vào các thẻ FCR hay Cột không
		const fcrHit = pointerCollisions.find(
			(c) =>
				String(c.id).startsWith("fcr-") || String(c.id).startsWith("column-"),
		);

		if (fcrHit) {
			// NGUYÊN NHÂN LAG TRƯỚC ĐÂY: Trả về container lớn gây loạn thuật toán của thư viện.
			// CÁCH SỬA MỚI: Chỉ tính toán mượt mà trên nội bộ các FCR với nhau, bỏ qua container lớn ở vòng lặp đo đạc này.
			return rectIntersection({
				...args,
				droppableContainers: args.droppableContainers.filter(
					(c) =>
						String(c.id).startsWith("fcr-") ||
						String(c.id).startsWith("column-"),
				),
			});
		}

		if (pointerCollisions.length > 0) {
			// 2. Kéo thả vào xe trống, vendor rỗng (không chạm FCR nào)
			return pointerCollisions;
		}

		// Dịch chuyển chuột ra rìa ngoài
		return rectIntersection(args);
	}, []);

	// ── All hooks must be declared before any early return ──────────────────

	const [localSlots, setLocalSlots] = useState<Map<string, TruckSlot[]>>(
		new Map(),
	);
	const [activeFcr, setActiveFcr] = useState<FCRBoardItem | null>(null);
	const [activeDragFcrIds, setActiveDragFcrIds] = useState<string[]>([]);
	const [selectedFcrIds, setSelectedFcrIds] = useState<Set<string>>(
		() => new Set(),
	);
	const [combineDialogOpen, setCombineDialogOpen] = useState(false);
	const [combineRows, setCombineRows] = useState<TruckingFollowUpRow[]>([]);
	const [combineLoading, setCombineLoading] = useState(false);
	const [combineTargetTruckingNumberId, setCombineTargetTruckingNumberId] =
		useState<string>("");
	const viewMode = useDispatchToolbarStore((s) => s.viewMode);
	const setViewMode = useDispatchToolbarStore((s) => s.setViewMode);
	const focusDate = useDispatchToolbarStore((s) => s.focusDate);
	const setFocusDate = useDispatchToolbarStore((s) => s.setFocusDate);
	const showFilters = useDispatchToolbarStore((s) => s.showFilters);
	const setShowFilters = useDispatchToolbarStore((s) => s.setShowFilters);

	const columnsOrder = useFCRFieldsStore((s) => s.columnsOrder);
	const setColumnsOrder = useFCRFieldsStore((s) => s.setColumnsOrder);

	const [filters, setFilters] = useState<DispatchFilters>(() => {
		try {
			const saved = localStorage.getItem("dispatch-filters");
			return saved ? { ...EMPTY_FILTERS, ...JSON.parse(saved) } : EMPTY_FILTERS;
		} catch {
			return EMPTY_FILTERS;
		}
	});

	const { data: sessionData } = useSession();
	const currentUserId = sessionData?.user?.id ?? null;
	const setHeaderStats = useDispatchHeaderStore((state) => state.setStats);
	const clearHeaderStats = useDispatchHeaderStore((state) => state.clearStats);

	useEffect(() => {
		localStorage.setItem("dispatch-filters", JSON.stringify(filters));
	}, [filters]);

	useEffect(() => {
		// Reset filters to hidden on every page load
		setShowFilters(false);
	}, [setShowFilters]);

	useEffect(
		() => () => {
			clearHeaderStats();
		},
		[clearHeaderStats],
	);

	useEffect(() => {
		localStorage.setItem("dispatch-show-filters", JSON.stringify(showFilters));
	}, [showFilters]);

	function shiftRange(dir: 1 | -1) {
		const step = viewMode === "week" ? 7 : 1;
		setFocusDate(addDays(focusDate, dir * step));
	}

	const from = focusDate;
	const to = viewMode === "week" ? addDays(focusDate, 6) : focusDate;

	const queryClient = useQueryClient();
	const queryKey = ["dispatch-board", from, to, viewMode];

	const { data, isLoading, isError, isFetching, refetch } = useQuery({
		queryKey,
		queryFn: () => fetchBoard(from, to),
		staleTime: 1000 * 60 * 2,
	});

	useEffect(() => {
		if (data?.stats) {
			setHeaderStats(data.stats);
		} else {
			clearHeaderStats();
		}
	}, [data?.stats, setHeaderStats, clearHeaderStats]);

	// Derive service modes for the dropdown — empty array while loading
	const serviceModes = useMemo(() => {
		if (!data) return [];
		const modes = new Set<string>();
		for (const f of data.unscheduledFcrs) {
			if (f.truckingFollowUp.serviceMode)
				modes.add(f.truckingFollowUp.serviceMode);
		}
		for (const day of data.days) {
			for (const truck of day.trucks) {
				for (const trip of truck.trips) {
					for (const f of trip.fcrs) {
						if (f.truckingFollowUp.serviceMode)
							modes.add(f.truckingFollowUp.serviceMode);
					}
				}
			}
		}
		return [...modes].sort();
	}, [data]);

	// Collect unique company names from board FCRs for the shipper dropdown.
	const shippers = useMemo(() => {
		if (!data) return [];
		const set = new Set<string>();
		const allFcrs = [
			...data.unscheduledFcrs,
			...data.days.flatMap((d) =>
				d.trucks.flatMap((t) => t.trips.flatMap((p) => p.fcrs)),
			),
		];
		for (const f of allFcrs) {
			if (f.truckingFollowUp.companyName)
				set.add(f.truckingFollowUp.companyName);
		}
		return [...set].sort();
	}, [data]);

	const assignMutation = useMutation({
		mutationFn: assignFcr,
		onMutate: async ({
			fcrIds,
			truckingNumberId,
			implementationDate,
			tripNumber,
		}) => {
			await queryClient.cancelQueries({ queryKey });
			const snapshot = queryClient.getQueryData<BoardData>(queryKey);

			queryClient.setQueryData<BoardData>(queryKey, (old) => {
				if (!old) return old;

				let movedFcrs: FCRBoardItem[] = [];
				const fcrIdSet = new Set(fcrIds);

				const allBoardFcrs = [
					...old.unscheduledFcrs,
					...old.days.flatMap((d) =>
						d.trucks.flatMap((t) => t.trips.flatMap((p) => p.fcrs)),
					),
				];

				const fcrsToMove = allBoardFcrs.filter((f) => fcrIdSet.has(f.id));
				if (fcrsToMove.length === 0) return old;

				movedFcrs = fcrsToMove.map((f) => ({
					...f,
					truckingNumberId,
					implementationDate,
					tripNumber,
				}));

				const removeFromAll = (fcrs: FCRBoardItem[]) =>
					fcrs.filter((f) => !fcrIdSet.has(f.id));

				const newDays = old.days.map((day) => {
					if (day.date !== implementationDate) {
						return {
							...day,
							trucks: day.trucks.map((t) => ({
								...t,
								trips: t.trips.map((p) => ({
									...p,
									fcrs: removeFromAll(p.fcrs),
								})),
							})),
						};
					}
					const truckExists = day.trucks.find(
						(t) => t.truckingNumberId === truckingNumberId,
					);
					const truckInfo = old.allTrucks.find(
						(t) => t.id === truckingNumberId,
					);
					const updatedTrucks = truckExists
						? day.trucks.map((t) => {
								if (t.truckingNumberId !== truckingNumberId)
									return {
										...t,
										trips: t.trips.map((p) => ({
											...p,
											fcrs: removeFromAll(p.fcrs),
										})),
									};
								const tripExists = t.trips.find(
									(p) => p.tripNumber === tripNumber,
								);
								return {
									...t,
									trips: tripExists
										? t.trips.map((p) =>
												p.tripNumber === tripNumber
													? {
															...p,
															fcrs: [...removeFromAll(p.fcrs), ...movedFcrs],
														}
													: { ...p, fcrs: removeFromAll(p.fcrs) },
											)
										: [
												...t.trips.map((p) => ({
													...p,
													fcrs: removeFromAll(p.fcrs),
												})),
												{ tripNumber, fcrs: movedFcrs },
											],
								};
							})
						: [
								...day.trucks.map((t) => ({
									...t,
									trips: t.trips.map((p) => ({
										...p,
										fcrs: removeFromAll(p.fcrs),
									})),
								})),
								{
									truckingNumberId,
									plateNumber: truckInfo?.plateNumber ?? "",
									driverName: truckInfo?.driverName ?? null,
									vehicleType: truckInfo?.vehicleType ?? null,
									payloadTonnes: truckInfo?.payloadTonnes ?? null,
									isVendor: false,
									vendorName: null,
									trips: [{ tripNumber, fcrs: movedFcrs }],
								},
							];
					return { ...day, trucks: updatedTrucks };
				});

				return {
					...old,
					unscheduledFcrs: removeFromAll(old.unscheduledFcrs),
					days: newDays,
					stats: {
						...old.stats,
						unscheduledCount: removeFromAll(old.unscheduledFcrs).length,
					},
				};
			});

			return { snapshot };
		},
		onError: (_err, _vars, ctx) => {
			if (ctx?.snapshot) queryClient.setQueryData(queryKey, ctx.snapshot);
			toast.error("Không thể phân công FCR");
		},
		onSettled: () => {
			queryClient.refetchQueries({ queryKey });
			queryClient.invalidateQueries({ queryKey: ["trucking-followups"] });
		},
	});

	const unassignMutation = useMutation({
		mutationFn: unassignFcr,
		onMutate: async ({ fcrIds, implementationDate }) => {
			await queryClient.cancelQueries({ queryKey });
			const snapshot = queryClient.getQueryData<BoardData>(queryKey);

			queryClient.setQueryData<BoardData>(queryKey, (old) => {
				if (!old) return old;
				const fcrIdSet = new Set(fcrIds);

				const fcrsToMove = old.days
					.flatMap((d) =>
						d.trucks.flatMap((t) => t.trips.flatMap((p) => p.fcrs)),
					)
					.filter((f) => fcrIdSet.has(f.id));
				if (fcrsToMove.length === 0) return old;

				const unassignedFcrs: FCRBoardItem[] = fcrsToMove.map((f) => ({
					...f,
					truckingNumberId: null,
					implementationDate: implementationDate ?? null,
					tripNumber: 1,
				}));

				return {
					...old,
					unscheduledFcrs: [...old.unscheduledFcrs, ...unassignedFcrs],
					days: old.days.map((d) => ({
						...d,
						trucks: d.trucks.map((t) => ({
							...t,
							trips: t.trips.map((p) => ({
								...p,
								fcrs: p.fcrs.filter((f) => !fcrIdSet.has(f.id)),
							})),
						})),
					})),
					stats: {
						...old.stats,
						unscheduledCount:
							old.stats.unscheduledCount + unassignedFcrs.length,
					},
				};
			});

			return { snapshot };
		},
		onError: (_err, _vars, ctx) => {
			if (ctx?.snapshot) queryClient.setQueryData(queryKey, ctx.snapshot);
			toast.error("Không thể bỏ phân công FCR");
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey });
			queryClient.invalidateQueries({ queryKey: ["trucking-followups"] });
		},
	});

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
	);

	const handleDragStart = useCallback(
		(event: DragStartEvent) => {
			if (!data) return;
			const fcrId = String(event.active.id).replace("fcr-", "");
			const dragIds = selectedFcrIds.has(fcrId) ? [...selectedFcrIds] : [fcrId];
			const found =
				data.unscheduledFcrs.find((f) => f.id === fcrId) ??
				data.days
					.flatMap((d) =>
						d.trucks.flatMap((t) => t.trips.flatMap((p) => p.fcrs)),
					)
					.find((f) => f.id === fcrId);
			setActiveDragFcrIds(dragIds);
			setActiveFcr(found ?? null);
		},
		[data, selectedFcrIds],
	);

	const handleDragEnd = useCallback(
		(event: DragEndEvent) => {
			setActiveFcr(null);
			setActiveDragFcrIds([]);
			const { active, over } = event;
			if (!over) return;

			const activeData = active.data.current as any;
			if (activeData?.type === "column") {
				const activeColKey = activeData.colKey;
				const overColKey = (over.data.current as any)?.colKey;
				if (activeColKey && overColKey && activeColKey !== overColKey) {
					const oldIndex = columnsOrder.indexOf(activeColKey);
					const newIndex = columnsOrder.indexOf(overColKey);
					setColumnsOrder(arrayMove(columnsOrder, oldIndex, newIndex));
				}
				return;
			}

			const activeFcrId = String(active.id).replace("fcr-", "");
			const draggedFcrIds =
				activeDragFcrIds.length > 0 ? activeDragFcrIds : [activeFcrId];

			const overFcrId = String(over.id).startsWith("fcr-")
				? String(over.id).replace("fcr-", "")
				: null;

			// Handle reordering within unscheduled list
			if (
				overFcrId &&
				activeFcrId !== overFcrId &&
				!activeDragFcrIds.some((id) => id !== activeFcrId)
			) {
				// Find if both are unscheduled
				const isUnscheduled =
					data?.unscheduledFcrs.some((f) => f.id === activeFcrId) &&
					data?.unscheduledFcrs.some((f) => f.id === overFcrId);
				if (isUnscheduled) {
					queryClient.setQueryData<BoardData>(queryKey, (old) => {
						if (!old) return old;
						const oldIndex = old.unscheduledFcrs.findIndex(
							(f) => f.id === activeFcrId,
						);
						const newIndex = old.unscheduledFcrs.findIndex(
							(f) => f.id === overFcrId,
						);
						if (oldIndex !== -1 && newIndex !== -1) {
							return {
								...old,
								unscheduledFcrs: arrayMove(
									old.unscheduledFcrs,
									oldIndex,
									newIndex,
								),
							};
						}
						return old;
					});
					return;
				}
			}

			if (String(over.id).startsWith("unscheduled") || overFcrId) {
				// If sorting inside truck OR drop over another FCR but not the same list, or dropping to Unscheduled zone
				// Let's just treat dropping onto Unscheduled zone as Unassign.
				const overData = over.data.current as
					| { type: string; date?: string; columnDate?: string }
					| undefined;
				// If it's an FCR, we might not have 'date' in its drop target, but if we drop over 'unscheduled' area we do.
				// Actually for now, dropping FCR over another FCR in Unscheduled list if NOT unscheduled currently, should unassign and place there.
				// But let's fallback to unassign without precise date if it's over an unscheduled FCR.
				if (
					!overFcrId ||
					data?.unscheduledFcrs.some((f) => f.id === overFcrId)
				) {
					// We just unassign if it's not a local reorder. Local reorder was handled above.
					const isLocalReorder =
						overFcrId &&
						data?.unscheduledFcrs.some((f) => f.id === activeFcrId);
					if (!isLocalReorder) {
						const implementationDate =
							overData?.type === "unscheduled"
								? (overData.date ?? null)
								: (overData?.columnDate ?? null);
						unassignMutation.mutate({
							fcrIds: draggedFcrIds,
							implementationDate,
						});
					}
				} else if (overFcrId) {
					// Dropped over a Truck FCR. Find which truck it belongs to.
					const truckRecord = data?.days
						.flatMap((d) =>
							d.trucks.flatMap((t) =>
								t.trips.flatMap((p) =>
									p.fcrs.map((f) => ({
										...f,
										truckDate: d.date,
										tId: t.truckingNumberId,
										pNum: p.tripNumber,
									})),
								),
							),
						)
						.find((f) => f.id === overFcrId);
					if (truckRecord) {
						assignMutation.mutate({
							fcrIds: draggedFcrIds,
							truckingNumberId: truckRecord.tId!,
							implementationDate: truckRecord.truckDate!,
							tripNumber: truckRecord.pNum!,
						});
					}
				}
			} else {
				const overData = over.data.current as
					| {
							type: string;
							truckingNumberId: string;
							date: string;
							tripNumber: number;
					  }
					| undefined;
				if (overData?.type === "truck-slot") {
					assignMutation.mutate({
						fcrIds: draggedFcrIds,
						truckingNumberId: overData.truckingNumberId,
						implementationDate: overData.date,
						tripNumber: overData.tripNumber,
					});
				}
			}

			setSelectedFcrIds((prev) => {
				if (prev.size === 0) return prev;
				const next = new Set(prev);
				for (const id of draggedFcrIds) {
					next.delete(id);
				}
				return next;
			});
		},
		[
			assignMutation,
			unassignMutation,
			activeDragFcrIds,
			columnsOrder,
			setColumnsOrder,
			queryClient,
			queryKey,
			data,
		],
	);

	const handleAddTruck = useCallback(
		(truckId: string, date: string, tripNumber: number) => {
			const truckInfo = data?.allTrucks.find((t) => t.id === truckId);
			if (!truckInfo) return;
			setLocalSlots((prev) => {
				const next = new Map(prev);
				const existing = next.get(date) ?? [];
				const idx = existing.findIndex((s) => s.truckingNumberId === truckId);

				if (idx >= 0) {
					const slot = existing[idx];
					if (!slot.trips.some((t) => t.tripNumber === tripNumber)) {
						const updated = [...existing];
						updated[idx] = {
							...slot,
							trips: [...slot.trips, { tripNumber, fcrs: [] }],
						};
						next.set(date, updated);
					}
					return next;
				}

				next.set(date, [
					{
						truckingNumberId: truckId,
						plateNumber: truckInfo.plateNumber,
						driverName: truckInfo.driverName,
						vehicleType: truckInfo.vehicleType,
						payloadTonnes: truckInfo.payloadTonnes,
						isVendor: truckInfo.isVendor,
						vendorName: truckInfo.vendorName,
						trips: [{ tripNumber, fcrs: [] }],
					},
					...existing,
				]);
				return next;
			});
		},
		[data],
	);

	const handleAddVendor = useCallback(
		async (vendorId: string, date: string) => {
			try {
				const res = await fetch("/api/dispatch/add-vendor", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ vendorId }),
				});
				if (!res.ok) throw new Error("Failed to add vendor");
				const { id, vendorName } = await res.json();
				setLocalSlots((prev) => {
					const next = new Map(prev);
					const existing = next.get(date) ?? [];
					const localSlot = existing.find((s) => s.truckingNumberId === id);
					const boardSlot = data?.days
						.find((d) => d.date === date)
						?.trucks.find((s) => s.truckingNumberId === id);

					const localMax = localSlot
						? Math.max(...localSlot.trips.map((t) => t.tripNumber), 0)
						: 0;
					const boardMax = boardSlot
						? Math.max(...boardSlot.trips.map((t) => t.tripNumber), 0)
						: 0;
					const nextTrip = Math.max(localMax, boardMax) + 1;

					const idx = existing.findIndex((s) => s.truckingNumberId === id);
					if (idx >= 0) {
						const slot = existing[idx];
						if (!slot.trips.some((t) => t.tripNumber === nextTrip)) {
							const updated = [...existing];
							updated[idx] = {
								...slot,
								trips: [...slot.trips, { tripNumber: nextTrip, fcrs: [] }],
							};
							next.set(date, updated);
						}
						return next;
					}

					next.set(date, [
						{
							truckingNumberId: id,
							plateNumber: "",
							driverName: null,
							vehicleType: null,
							payloadTonnes: null,
							isVendor: true,
							vendorName,
							trips: [{ tripNumber: nextTrip, fcrs: [] }],
						},
						...existing,
					]);
					return next;
				});
			} catch {
				toast.error("Không thể thêm nhà thầu");
			}
		},
		[data],
	);

	const handleMoveAllInSlot = useCallback(
		async (fcrIds: string[], targetId: string, date: string) => {
			if (fcrIds.length === 0) return;
			try {
				let targetTruckingNumberId = "";
				if (targetId.startsWith("truck:")) {
					targetTruckingNumberId = targetId.replace("truck:", "");
				} else if (targetId.startsWith("vendor:")) {
					const vendorId = targetId.replace("vendor:", "");
					const res = await fetch("/api/dispatch/add-vendor", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ vendorId }),
					});
					if (!res.ok) throw new Error("Failed to resolve vendor slot");
					const payload = (await res.json()) as { id: string };
					targetTruckingNumberId = payload.id;
				} else {
					throw new Error("Invalid target type");
				}

				await assignFcr({
					fcrIds,
					truckingNumberId: targetTruckingNumberId,
					implementationDate: date,
					tripNumber: 1,
				});
				toast.success("Đã đổi xe/vendor cho tất cả FCR");
				await queryClient.invalidateQueries({ queryKey });
				await queryClient.invalidateQueries({
					queryKey: ["trucking-followups"],
				});
			} catch {
				toast.error("Không thể đổi xe/vendor cho tất cả FCR");
			}
		},
		[queryClient, queryKey],
	);

	const handleRemoveLocalSlot = useCallback((id: string, date: string) => {
		setLocalSlots((prev) => {
			const next = new Map(prev);
			const existing = next.get(date) ?? [];
			next.set(
				date,
				existing.filter((s) => s.truckingNumberId !== id),
			);
			return next;
		});
	}, []);

	const handleRemoveAllInSlot = useCallback(
		async (fcrIds: string[], date: string) => {
			if (fcrIds.length === 0) return;
			try {
				await unassignFcr({
					fcrIds,
					implementationDate: date,
				});
				toast.success("Đã bỏ tất cả FCR khỏi xe/vendor");
				await queryClient.invalidateQueries({ queryKey });
				await queryClient.invalidateQueries({
					queryKey: ["trucking-followups"],
				});
			} catch {
				toast.error("Không thể bỏ tất cả FCR khỏi xe/vendor");
			}
		},
		[queryClient, queryKey],
	);

	const handleCombineJobsInSlot = useCallback(
		async (fcrs: FCRBoardItem[], truckingNumberId: string) => {
			const byJob = new Map<
				string,
				{
					id: string;
					jobNumber: string;
					companyName: string;
					fcrCount: number;
				}
			>();

			for (const fcr of fcrs) {
				const jobId = fcr.truckingFollowUp.id;
				const current = byJob.get(jobId);
				if (!current) {
					byJob.set(jobId, {
						id: jobId,
						jobNumber: fcr.truckingFollowUp.jobNumber ?? "(không có mã job)",
						companyName: fcr.truckingFollowUp.companyName ?? "",
						fcrCount: 1,
					});
				} else {
					current.fcrCount += 1;
				}
			}

			const jobs = [...byJob.values()];
			if (jobs.length < 2) {
				toast.info("Cần ít nhất 2 job trong xe/vendor để combine.");
				return;
			}

			const rows: TruckingFollowUpRow[] = jobs
				.sort((a, b) => a.jobNumber.localeCompare(b.jobNumber))
				.map((job) => ({
					id: job.id,
					jobNumber: job.jobNumber,
					companyName: job.companyName || null,
					fcrs: Array.from({ length: job.fcrCount }, (_, idx) => ({
						id: `${job.id}-${idx}`,
					})),
				}));

			setCombineRows(rows);
			setCombineTargetTruckingNumberId(truckingNumberId);
			setCombineDialogOpen(true);
		},
		[],
	);

	const handleCombineConfirm = useCallback(
		async (keeperJobId: string, deleteJobIds: string[]) => {
			setCombineLoading(true);
			try {
				const response = await fetch("/api/trucking-followup/combine-jobs", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						keeperJobId,
						deleteJobIds,
						requiredTruckingNumberId: combineTargetTruckingNumberId,
					}),
				});

				const result = await response.json();
				if (!response.ok) {
					throw new Error(result.message || "Không thể combine jobs");
				}

				toast.success(
					`Đã combine ${result.mergedCount} job vào ${result.keeperJobNumber}`,
				);
				setCombineDialogOpen(false);
				setCombineRows([]);
				setCombineTargetTruckingNumberId("");
				await queryClient.invalidateQueries({ queryKey });
				await queryClient.invalidateQueries({
					queryKey: ["trucking-followups"],
				});
			} catch (error) {
				toast.error(
					error instanceof Error ? error.message : "Không thể combine jobs",
					{ duration: 8000 },
				);
			} finally {
				setCombineLoading(false);
			}
		},
		[combineTargetTruckingNumberId, queryClient, queryKey],
	);

	const handleAutoSync = useCallback(
		async (skipConfirm = false) => {
			if (
				!skipConfirm &&
				!window.confirm(
					"Hệ thống sẽ tự động xếp xe cho các lô hàng đã có thông tin biển số hoặc nhà thầu. Tiếp tục?",
				)
			)
				return;
			try {
				const site = (sessionData?.user as any)?.site || "SGN";
				const res = await fetch(`/api/dispatch/auto-sync?site=${site}`, {
					method: "POST",
				});
				const result = await res.json();
				if (!res.ok) throw new Error(result.message);

				if (!skipConfirm) toast.success(result.message);
				queryClient.invalidateQueries({ queryKey });
				queryClient.invalidateQueries({ queryKey: ["trucking-followups"] });
			} catch (error) {
				if (!skipConfirm)
					toast.error(error instanceof Error ? error.message : "Giao điểm lỗi");
			}
		},
		[sessionData?.user, queryClient, queryKey],
	);

	// Auto-sync on mount to organize existing plate/vendor data
	const hasSyncedRef = useRef(false);
	useEffect(() => {
		if (sessionData?.user && !hasSyncedRef.current) {
			handleAutoSync(true);
			hasSyncedRef.current = true;
		}
	}, [sessionData?.user, handleAutoSync]);

	// Group unscheduled FCRs by effectiveDate
	const unscheduledByDate = useMemo(() => {
		const map = new Map<string, FCRBoardItem[]>();
		for (const fcr of data?.unscheduledFcrs ?? []) {
			const d =
				fcr.implementationDate ??
				fcr.truckingFollowUp.implementationDate ??
				"__none__";
			if (!map.has(d)) map.set(d, []);
			map.get(d)?.push(fcr);
		}
		return map;
	}, [data?.unscheduledFcrs]);

	const allFcrById = useMemo(() => {
		const map = new Map<string, FCRBoardItem>();
		if (!data) return map;

		for (const fcr of data.unscheduledFcrs) {
			map.set(fcr.id, fcr);
		}
		for (const day of data.days) {
			for (const truck of day.trucks) {
				for (const trip of truck.trips) {
					for (const fcr of trip.fcrs) {
						map.set(fcr.id, fcr);
					}
				}
			}
		}

		return map;
	}, [data]);

	useEffect(() => {
		if (!data) return;
		setSelectedFcrIds((prev) => {
			if (prev.size === 0) return prev;
			const next = new Set([...prev].filter((id) => allFcrById.has(id)));
			return next.size === prev.size ? prev : next;
		});
	}, [allFcrById, data]);

	const handleToggleFcrSelection = useCallback(
		(fcrId: string, selected: boolean) => {
			setSelectedFcrIds((prev) => {
				const next = new Set(prev);
				if (selected) {
					next.add(fcrId);
				} else {
					next.delete(fcrId);
				}
				return next;
			});
		},
		[],
	);

	const clearSelection = useCallback(() => {
		setSelectedFcrIds(new Set());
	}, []);

	const selectedFcrStats = useMemo(() => {
		if (selectedFcrIds.size === 0) return null;
		let totalGw = 0;
		let totalCbm = 0;
		let totalQty = 0;
		const stops: string[] = [];
		const seenStops = new Set<string>();
		const serviceModeSet = new Set<string>();

		for (const id of selectedFcrIds) {
			const fcr = allFcrById.get(id);
			if (!fcr) continue;
			totalGw += fcr.grossWeight ?? 0;
			totalCbm += fcr.cbm ?? 0;
			totalQty += fcr.quantity ?? 0;
			for (const loc of [fcr.pickupAt, fcr.deliveryAt]) {
				if (loc && !seenStops.has(loc)) {
					seenStops.add(loc);
					stops.push(loc);
				}
			}
			const sm = fcr.truckingFollowUp.serviceMode;
			if (sm) {
				const upper = sm.toUpperCase();
				if (upper.includes("CPN") || upper.includes("AIR"))
					serviceModeSet.add("AIR");
				else if (upper.includes("FCL")) serviceModeSet.add("FCL");
				else serviceModeSet.add("LCL");
			}
		}

		return {
			count: selectedFcrIds.size,
			totalGw,
			totalCbm,
			totalQty,
			stops,
			serviceModes: ["FCL", "LCL", "AIR"].filter((m) => serviceModeSet.has(m)),
		};
	}, [selectedFcrIds, allFcrById]);

	// ── Early returns after all hooks ───────────────────────────────────────

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
				<span className="ml-2 text-sm text-slate-500">Đang tải...</span>
			</div>
		);
	}

	if (isError || !data) {
		return (
			<div className="flex items-center justify-center h-64 text-red-500 text-sm">
				Không thể tải dữ liệu dispatch board
			</div>
		);
	}

	const dates = generateDateRange(from, to);
	const rangeLabel = viewMode === "day" ? from : `${from} → ${to}`;
	const filtering = isFiltering(filters);
	const matchFcr = (fcr: FCRBoardItem) =>
		filterFcr(fcr, filters, currentUserId);

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={customCollisionDetection}
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
		>
			<div
				className={
					viewMode === "day"
						? "flex flex-col gap-3 px-2 pb-2 pt-1 h-full overflow-hidden"
						: "flex flex-col gap-4 px-4 pb-4 pt-2 h-full overflow-hidden"
				}
			>
				{/* Week navigation + tools */}
				<div className="md:hidden flex items-center justify-end gap-2 px-1">
					<div className="flex items-center gap-1 rounded-md border border-slate-300 bg-white p-0.5">
						<button
							type="button"
							onClick={() => setViewMode("day")}
							className={
								viewMode === "day"
									? "px-2 py-1 text-[11px] font-semibold rounded bg-blue-500 text-white"
									: "px-2 py-1 text-[11px] font-semibold rounded text-slate-600 hover:bg-slate-100"
							}
						>
							Daily
						</button>
						<button
							type="button"
							onClick={() => setViewMode("week")}
							className={
								viewMode === "week"
									? "px-2 py-1 text-[11px] font-semibold rounded bg-blue-500 text-white"
									: "px-2 py-1 text-[11px] font-semibold rounded text-slate-600 hover:bg-slate-100"
							}
						>
							Weekly
						</button>
					</div>
					<button
						type="button"
						onClick={() => shiftRange(-1)}
						className="p-1 rounded hover:bg-slate-100 text-slate-600"
					>
						<ChevronLeft className="w-4 h-4" />
					</button>
					<span className="text-xs text-slate-500 min-w-[120px] text-center">
						{rangeLabel}
					</span>
					<button
						type="button"
						onClick={() => shiftRange(1)}
						className="p-1 rounded hover:bg-slate-100 text-slate-600"
					>
						<ChevronRight className="w-4 h-4" />
					</button>
					<button
						type="button"
						onClick={() => refetch()}
						className="p-1 rounded hover:bg-slate-100 text-slate-600"
						title="Refresh dispatch"
					>
						<RefreshCw
							className={cn("w-4 h-4", isFetching && "animate-spin")}
						/>
					</button>
					<button
						type="button"
						onClick={() => setShowFilters(!showFilters)}
						className={cn(
							"h-7 px-2 rounded border text-[11px] font-semibold flex items-center gap-1.5",
							showFilters
								? "border-blue-300 bg-blue-50 text-blue-700"
								: "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
						)}
						title={showFilters ? "Ẩn bộ lọc" : "Hiện bộ lọc"}
					>
						<Funnel className="w-3.5 h-3.5" />
						Bộ lọc
						{showFilters ? (
							<ChevronUp className="w-3.5 h-3.5" />
						) : (
							<ChevronDown className="w-3.5 h-3.5" />
						)}
					</button>
					<FCRFieldsPopover />
				</div>

				{/* Filter bar — client-side filtering */}
				{showFilters && (
					<DispatchFilterBar
						filters={filters}
						onChange={setFilters}
						serviceModes={serviceModes}
						shippers={shippers}
					/>
				)}

				{selectedFcrStats && (
					<div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 space-y-1.5">
						<div className="flex items-center justify-between">
							<p className="text-xs font-medium text-blue-700">
								Đã chọn {selectedFcrStats.count} FCR — kéo một FCR đã chọn để di
								chuyển tất cả
							</p>
							<button
								type="button"
								onClick={clearSelection}
								className="p-0.5 rounded hover:bg-blue-100 text-blue-600"
								title="Bỏ chọn"
							>
								<X className="w-3.5 h-3.5" />
							</button>
						</div>
						<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-blue-800">
							{selectedFcrStats.serviceModes.length > 0 && (
								<span className="flex items-center gap-1">
									{selectedFcrStats.serviceModes.map((m) => (
										<span
											key={m}
											className={cn(
												"px-1.5 py-0.5 rounded font-semibold text-[10px]",
												m === "FCL" && "bg-blue-200 text-blue-800",
												m === "LCL" && "bg-amber-200 text-amber-800",
												m === "AIR" && "bg-purple-200 text-purple-800",
											)}
										>
											{m}
										</span>
									))}
								</span>
							)}
							<span className="flex items-center gap-1">
								<Weight className="w-3 h-3" />
								{selectedFcrStats.totalGw >= 1000
									? `${(selectedFcrStats.totalGw / 1000).toFixed(1)}t`
									: `${selectedFcrStats.totalGw.toLocaleString()}kg`}
							</span>
							<span className="flex items-center gap-1">
								<Package className="w-3 h-3" />
								{selectedFcrStats.totalCbm.toFixed(2)} CBM
							</span>
							{selectedFcrStats.totalQty > 0 && (
								<span className="flex items-center gap-1">
									SL: {selectedFcrStats.totalQty}
								</span>
							)}
							{selectedFcrStats.stops.length > 0 && (
								<span className="flex items-center gap-1 min-w-0">
									<MapPin className="w-3 h-3 shrink-0" />
									<span className="truncate">
										{selectedFcrStats.stops.map((stop, i) => (
											<span key={stop}>
												{i > 0 && <span className="text-blue-400"> → </span>}
												<span
													className={cn(
														"font-medium",
														i === 0 && "text-green-700",
														i === selectedFcrStats.stops.length - 1 &&
															i !== 0 &&
															"text-red-700",
													)}
												>
													{stop}
												</span>
											</span>
										))}
									</span>
								</span>
							)}
						</div>
					</div>
				)}

				{/* Day rows */}
				<div
					className={
						viewMode === "day"
							? "flex flex-col gap-1 overflow-hidden pb-0 flex-1 min-h-0"
							: "flex flex-col gap-1 overflow-x-auto pb-4 flex-1"
					}
				>
					{dates.map((date) => {
						const dayData = data.days.find((d) => d.date === date) ?? {
							date,
							trucks: [],
						};
						return (
							<DayColumn
								key={date}
								day={dayData}
								allTrucks={data.allTrucks}
								allVendors={data.allVendors}
								localSlots={localSlots.get(date) ?? []}
								onAddTruck={handleAddTruck}
								onAddVendor={handleAddVendor}
								onRemoveLocalSlot={handleRemoveLocalSlot}
								onMoveAllInSlot={handleMoveAllInSlot}
								onRemoveAllInSlot={handleRemoveAllInSlot}
								onCombineJobsInSlot={handleCombineJobsInSlot}
								filterFcr={filtering ? matchFcr : undefined}
								unscheduledFcrs={unscheduledByDate.get(date) ?? []}
								selectedFcrIds={selectedFcrIds}
								onToggleFcrSelection={handleToggleFcrSelection}
								unscheduledDateFilter={filters.date || undefined}
								isDailyView={viewMode === "day"}
							/>
						);
					})}
				</div>
			</div>

			<DragOverlay dropAnimation={null}>
				{activeFcr ? (
					<div className="relative">
						<table className="bg-white border rounded shadow-xl opacity-90 text-sm">
							<tbody>
								<FcrTableRow
									fcr={activeFcr}
									columnsOrder={columnsOrder}
									isSelected={true}
									onToggleSelection={() => {}}
								/>
							</tbody>
						</table>
						{activeDragFcrIds.length > 1 && (
							<span className="absolute -right-2 -top-2 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg z-50">
								+{activeDragFcrIds.length - 1}
							</span>
						)}
					</div>
				) : null}
			</DragOverlay>

			{combineRows.length >= 2 && (
				<CombineJobsDialog
					open={combineDialogOpen}
					onOpenChange={(open) => {
						setCombineDialogOpen(open);
						if (!open) {
							setCombineRows([]);
							setCombineTargetTruckingNumberId("");
						}
					}}
					allRows={combineRows}
					isLoading={combineLoading}
					onConfirm={handleCombineConfirm}
				/>
			)}
		</DndContext>
	);
}
