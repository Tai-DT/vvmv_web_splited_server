"use client";

import {
	type ColumnDef,
	type ColumnFiltersState,
	type ExpandedState,
	getCoreRowModel,
	getExpandedRowModel,
	getSortedRowModel,
	type SortingState,
	type Updater,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./table-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	DataTablePagination,
	DataTableToolbar as SharedToolbar,
} from "@/components/shared/data-table";
import { useAirports } from "@/hooks/use-airports";
import { useCargoTypes } from "@/hooks/use-cargo-types";
import { useFollowUpMutation } from "@/hooks/use-followup-mutation";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePartners } from "@/hooks/use-partners";
import { useServiceModes } from "@/hooks/use-service-modes";
import { useSiteUsers } from "@/hooks/use-site-users";
import { useUnits } from "@/hooks/use-units";
import { useWorkTypes } from "@/hooks/use-work-types";
import { useSession } from "@/lib/auth-client";
import { exportToExcel } from "@/lib/export-excel";
import {
	BOT_ACTIONS,
	type BotActionType,
	formatValidationErrors,
	validateFollowUpForBotAction,
} from "@/lib/validation/followup-validation";
import { AddRecordDialog } from "../../../_components/shared/dialogs/add-record-dialog";
import { ColumnManageDialog } from "../../../_components/shared/dialogs/column-manage-dialog";
import type { FollowUpRow, SubTabType } from "../../types";
import { CreateContainerDialog } from "../dialogs/create-container-dialog";
import { DeleteTransationDialog } from "../dialogs/delete-transaction-dialog";
import { FollowUpDetailsDialog } from "../dialogs/followup-details-dialog";
import {
	AdvancedFilterPopover,
	type FilterCondition,
	isJobDone,
	isJobFinished,
} from "../filters/advanced-filter";
import { DateRangePicker } from "../shared/date-range-picker";
import { FOLLOWUP_HEADERS } from "./column-headers";
import { FOLLOWUP_LABELS } from "./column-labels";
import { getColumns } from "./data-table-columns";
import { DataTableContent } from "./data-table-content";
import {
	getFollowupMobileColumnVisibility,
	visibilityDiffFromMobilePreset,
} from "./followup-mobile-column-preset";
import { useStatsStore } from "./use-stats-store";
import { createTableStore } from "./use-table-state";

// TableMeta is now defined in ./table-types.ts

export const DataTable = () => {
	const { data: session } = useSession();
	const userId = session?.user?.id ?? "anonymous";
	const userRole = session?.user?.role; // Get user role from session
	const queryClient = useQueryClient();
	const { mutate: updateFollowUp } = useFollowUpMutation();
	const { serviceModes } = useServiceModes();
	const { units } = useUnits();
	const { cargoTypes } = useCargoTypes();
	const { workTypes } = useWorkTypes();
	const { airports } = useAirports();
	const { partners } = usePartners();
	const { users: siteUsers } = useSiteUsers("Logistics");

	// Fetch team leadership status
	const { data: userTeams } = useQuery({
		queryKey: ["user-teams", userId],
		queryFn: async () => {
			const response = await fetch("/api/user/teams");
			if (!response.ok) return null;
			return response.json();
		},
		enabled: !!userId,
	});

	const isTeamLeader = userTeams?.isLeader || false;

	// Detect if user belongs to Accounting department (view-only mode)
	const { data: userDepts } = useQuery({
		queryKey: ["user-departments", userId],
		queryFn: async () => {
			const res = await fetch("/api/user/departments");
			if (!res.ok) return { departments: [] };
			return res.json();
		},
		enabled: !!userId,
	});
	const isReadOnly: boolean =
		(userDepts?.departments ?? []).includes("Accounting") &&
		userRole !== "ADMIN" &&
		userRole !== "SUPERADMIN";

	// Create Zustand store instance for this user (with localStorage persistence)
	const useTableStore = createTableStore(userId);

	// Get state and setters from Zustand store
	const hasHydrated = useTableStore((state) => state._hasHydrated);
	const storePageSize = useTableStore((state) => state.pageSize);
	const setStorePageSize = useTableStore((state) => state.setPageSize);

	const [pageIndex, setPageIndex] = useState(0);

	// Derive pagination object from local pageIndex and persisted storePageSize
	// This ensures a single source of truth for each piece of state
	const pagination = useMemo(
		() => ({
			pageIndex,
			pageSize: storePageSize || 10,
		}),
		[pageIndex, storePageSize],
	);

	// Store pagination and stats metadata from API
	const [paginationMeta, setPaginationMeta] = useState({
		total: 0,
		totalPages: 1,
	});

	const [serverStats, setServerStats] = useState({
		active: 0,
		finished: 0,
		done: 0,
	});

	// Debounced search term for server-side search
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [globalFilter, setGlobalFilter] = useState<string>("");
	const [debouncedGlobalFilter, setDebouncedGlobalFilter] = useState("");

	// Non-persisted state (sorting, filtering, expanded, pagination)
	const [advancedFilters, setAdvancedFilters] = useState<FilterCondition[]>([]);
	const [sorting, setSorting] = useState<SortingState>([
		{ id: "createdAt", desc: true }, // Default sort by createdAt (Date Created) descending (latest first)
	]);

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedGlobalFilter(globalFilter);
		}, 500); // 500ms debounce
		return () => clearTimeout(timer);
	}, [globalFilter]);

	const hideOthersTasks = useTableStore((state) => state.hideOthersTasks);
	const setHideOthersTasks = useTableStore((state) => state.setHideOthersTasks);
	const dateRange = useTableStore((state) => state.dateRange);
	const setDateRange = useTableStore((state) => state.setDateRange);
	const statusFilter = useTableStore((state) => state.statusFilter);

	// Handle pagination changes from TanStack Table
	const onPaginationChange = useCallback(
		(updaterOrValue: any) => {
			const next =
				typeof updaterOrValue === "function"
					? updaterOrValue({ pageIndex, pageSize: storePageSize || 10 })
					: updaterOrValue;

			setPageIndex(next.pageIndex);
			if (next.pageSize !== storePageSize) {
				setStorePageSize(next.pageSize);
			}
		},
		[pageIndex, storePageSize, setStorePageSize],
	);

	// Initialize date range if not set (default to empty strings)
	useEffect(() => {
		if (hasHydrated && dateRange === null) {
			setDateRange({ from: "", to: "" });
		}
	}, [hasHydrated, dateRange, setDateRange]);

	// Reset to first page when search terms or filters change
	useEffect(() => {
		setPageIndex(0);
	}, []);

	// ... (skipping to useQuery)
	// Fetch data from API using TanStack Query with server-side pagination, search and filters
	const { data, isFetching, isLoading } = useQuery<FollowUpRow[]>({
		queryKey: [
			"followups",
			pagination.pageIndex,
			pagination.pageSize,
			debouncedGlobalFilter,
			statusFilter,
			hideOthersTasks,
			advancedFilters,
			sorting,
			dateRange,
		],
		queryFn: async () => {
			const page = pagination.pageIndex + 1; // Convert 0-based to 1-based
			const pageSize = pagination.pageSize;
			const params = new URLSearchParams({
				page: page.toString(),
				pageSize: pageSize.toString(),
				hideOthers: hideOthersTasks ? "true" : "false",
			});

			if (debouncedGlobalFilter) {
				params.append("search", debouncedGlobalFilter);
			}

			if (statusFilter !== "all") {
				params.append("status", statusFilter);
			}

			if (advancedFilters.length > 0) {
				params.append("filters", JSON.stringify(advancedFilters));
			}

			if (sorting.length > 0) {
				params.append("sorting", JSON.stringify(sorting));
			}

			if (dateRange) {
				params.append("from", dateRange.from);
				params.append("to", dateRange.to);
			}

			const response = await fetch(`/api/followup?${params}`);
			if (!response.ok) {
				throw new Error("Failed to fetch follow-ups");
			}
			const result = await response.json();
			// Extract pagination and stats metadata from API response
			if (result.pagination) {
				setPaginationMeta({
					total: result.pagination.total || 0,
					totalPages: result.pagination.totalPages || 1,
				});
			}
			if (result.stats) {
				setServerStats(result.stats);
			}
			// Extract data from paginated response structure
			const rawData = result.data || result;
			// Deduplicate by ID just in case API ever returns duplicates (safety first)
			const uniqueData = Array.isArray(rawData)
				? Array.from(
						new Map(rawData.map((item: any) => [item.id, item])).values(),
					)
				: rawData;

			return uniqueData;
		},
		enabled: hasHydrated, // Wait for localStorage to hydrate before querying
		refetchInterval: 30000,
		refetchIntervalInBackground: false,
		staleTime: 0, // Consider data immediately stale for stats filter changes
	});

	// Refresh data handler
	const handleRefresh = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: ["followups"] });
	}, [queryClient]);

	const [expanded, setExpanded] = useState<ExpandedState>({});
	const [rowSelection, setRowSelection] = useState({});
	const [reorderDialogOpen, setReorderDialogOpen] = useState(false);
	const [addRecordDialogOpen, setAddRecordDialogOpen] = useState(false);
	const [addRecordPrefillData, setAddRecordPrefillData] =
		useState<FollowUpRow | null>(null);
	const [containerDialogOpen, setContainerDialogOpen] = useState(false);
	const [containerFollowUp, setContainerFollowUp] =
		useState<FollowUpRow | null>(null);
	const [deleteTransactionDialogOpen, setDeleteTransactionDialogOpen] =
		useState(false);

	const [deleteTransactionFollowUp, setdeleteTransactionFollowUp] =
		useState<FollowUpRow | null>(null);

	const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
	const [detailsFollowUp, setDetailsFollowUp] = useState<FollowUpRow | null>(
		null,
	);

	// Synchronize detailsFollowUp with latest data from server when cache is invalidated/updated
	useEffect(() => {
		if (detailsDialogOpen && detailsFollowUp && data) {
			const updatedRow = data.find((r) => r.id === detailsFollowUp.id);
			if (updatedRow && updatedRow !== detailsFollowUp) {
				setDetailsFollowUp(updatedRow);
			}
		}
	}, [data, detailsDialogOpen, detailsFollowUp]);

	const handleViewDetails = useCallback((row: FollowUpRow) => {
		setDetailsFollowUp(row);
		setDetailsDialogOpen(true);
	}, []);

	const columns = useMemo(() => getColumns(), []);

	const columnOrder = useTableStore((state) => state.columnOrder);
	const columnVisibility = useTableStore((state) => state.columnVisibility);
	const isMobile = useIsMobile();
	const columnVisibilityForTable = useMemo(() => {
		if (!isMobile) return columnVisibility;
		return {
			...getFollowupMobileColumnVisibility(),
			...columnVisibility,
		};
	}, [isMobile, columnVisibility]);
	const columnPinning = useTableStore((state) => state.columnPinning);
	const columnSizing = useTableStore((state) => state.columnSizing);
	const setColumnOrder = useTableStore((state) => state.setColumnOrder);
	const setColumnVisibility = useTableStore(
		(state) => state.setColumnVisibility,
	);
	const setColumnPinning = useTableStore((state) => state.setColumnPinning);
	const setColumnSizing = useTableStore((state) => state.setColumnSizing);
	const subPanelVisibility = useTableStore((state) => state.subPanelVisibility);

	const onColumnVisibilityChange = useCallback(
		(updaterOrValue: Updater<VisibilityState>) => {
			const effectivePrev = isMobile
				? { ...getFollowupMobileColumnVisibility(), ...columnVisibility }
				: columnVisibility;

			const nextEffective =
				typeof updaterOrValue === "function"
					? updaterOrValue(effectivePrev)
					: updaterOrValue;

			if (!isMobile) {
				setColumnVisibility(nextEffective);
				return;
			}

			setColumnVisibility(
				visibilityDiffFromMobilePreset(
					nextEffective,
					getFollowupMobileColumnVisibility(),
				),
			);
		},
		[isMobile, columnVisibility, setColumnVisibility],
	);

	// Initialize column order if empty OR add new columns that don't exist in saved order
	// Wait for Zustand persist middleware to hydrate from localStorage before initializing
	useEffect(() => {
		if (!hasHydrated) return; // Wait for localStorage hydration

		const allColumnIds = columns.map(
			(col) => (col as any).accessorKey || (col as any).id,
		);

		if (columnOrder.length === 0) {
			// First time user - set default order (setColumnOrder will auto-position system columns)
			setColumnOrder(allColumnIds);
		} else {
			// Existing user - check for new columns not in saved order
			const prunedColumnOrder = columnOrder.filter((id) =>
				allColumnIds.includes(id),
			);
			const newColumns = allColumnIds.filter(
				(id) => !prunedColumnOrder.includes(id),
			);
			if (
				newColumns.length > 0 ||
				prunedColumnOrder.length !== columnOrder.length
			) {
				// Add new columns at the end (setColumnOrder will auto-position system columns)
				setColumnOrder([...prunedColumnOrder, ...newColumns]);
			}
		}
	}, [hasHydrated, columnOrder, columns, setColumnOrder]);

	// Track active sub-tab for each row when clicking on sub-table icons
	const [activeRowTabs, setActiveRowTabs] = useState<
		Record<string, SubTabType>
	>({});

	// Set default hideOthersTasks based on role if not yet set
	useEffect(() => {
		// Wait for session data (userId, userRole) and table hydration
		if (!userId || !userRole || !hasHydrated) return;

		// Only apply if it hasn't been set yet (still null)
		if (hideOthersTasks === null) {
			if (
				userRole === "ADMIN" ||
				userRole === "MANAGER" ||
				userRole === "SUPERADMIN"
			) {
				setHideOthersTasks(false);
			} else if (
				userRole === "STAFF" ||
				userRole === "LEADER" ||
				isTeamLeader
			) {
				setHideOthersTasks(true);
			} else {
				// Fallback for other roles
				setHideOthersTasks(false);
			}
		}
	}, [
		userId,
		userRole,
		hasHydrated,
		hideOthersTasks,
		isTeamLeader,
		setHideOthersTasks,
	]);

	const scopedData = useMemo(() => {
		if (!data) return [];

		// Pre-calculate expensive computed fields once per data update
		const enhancedData = data.map((row) => ({
			...row,
			_isFinished: isJobFinished(row),
			_isDone: isJobDone(row),
		}));

		return enhancedData;
	}, [data]);

	// 2. Statistics display based on global server stats
	const stats = serverStats;

	// Update global stats store with latest counts from API
	const updateStatsStore = useStatsStore((state) => state.updateStats);
	useEffect(() => {
		if (stats) {
			updateStatsStore(
				stats.active || 0,
				(stats as any).activeNoTrucking || 0,
				(stats as any).activeWithTrucking || 0,
				stats.finished || 0,
				stats.done || 0,
			);
		}
	}, [stats, updateStatsStore]);

	// 3. Final table data: server order, optional client-only reorder within current page
	const [manualRowOrderIds, setManualRowOrderIds] = useState<string[] | null>(
		null,
	);

	useEffect(() => {
		const ids = scopedData.map((r) => r.id);
		setManualRowOrderIds((prev) => {
			if (prev === null) return null;
			if (ids.length !== prev.length) return null;
			const a = [...ids].sort().join("\0");
			const b = [...prev].sort().join("\0");
			return a === b ? prev : null;
		});
	}, [scopedData]);

	const filteredData = useMemo(() => {
		if (!manualRowOrderIds || manualRowOrderIds.length !== scopedData.length) {
			return scopedData;
		}
		const map = new Map(scopedData.map((r) => [r.id, r]));
		const next: typeof scopedData = [];
		for (const id of manualRowOrderIds) {
			const row = map.get(id);
			if (row === undefined) return scopedData;
			next.push(row);
		}
		return next;
	}, [scopedData, manualRowOrderIds]);

	const handleRowOrderChange = useCallback((orderedIds: string[]) => {
		setManualRowOrderIds(orderedIds);
	}, []);

	// Memoize dependencies to prevent new object reference on every render
	// (fixes "Cannot update a component while rendering a different component" crash)
	const dependencies = useMemo(
		() => ({
			serviceModes,
			units,
			cargoTypes,
			workTypes,
			airports,
			partners,
			siteUsers,
		}),
		[serviceModes, units, cargoTypes, workTypes, airports, partners, siteUsers],
	);

	// Handler for adding new record - memoized to prevent recreation
	const handleAddRecord = useCallback(
		async (newRecord: FollowUpRow, files?: FileList | null) => {
			let toastId: string | number | undefined;
			try {
				// Check folder exists using API route (GET với query params)
				const folderName = encodeURIComponent(newRecord.taxCode || "na");
				const shmtDateParam = newRecord.shmtDate
					? `&shmtDate=${encodeURIComponent(newRecord.shmtDate)}`
					: "";

				// Sử dụng GET với query parameter
				const checkFolderResponse = await fetch(
					`/api/followup/check-folder?folderName=${folderName}${shmtDateParam}`,
					{
						method: "GET", // GET method
						headers: {
							"Content-Type": "application/json",
						},
					},
				);

				if (!checkFolderResponse.ok) {
					const errorData = await checkFolderResponse.json();
					throw new Error(errorData.error || "Failed to check folder");
				}

				const folderCheckResult = await checkFolderResponse.json();

				if (!folderCheckResult.success || !folderCheckResult.result) {
					throw new Error(
						`Customer folder '${newRecord.taxCode}' not found in any Shared Drive. Please create it first.`,
					);
				}

				// Check if operation type is XUAT or NHAP
				if (
					newRecord.operationType === "XUAT" ||
					newRecord.operationType === "NHAP"
				) {
					// Show loading toast
					toastId = toast.loading("Creating transaction...");

					// Call the create-transaction API to generate TransID in ERP
					const response = await fetch("/api/transaction/create", {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							operationType: newRecord.operationType,
							taxCode: newRecord.taxCode,
							hwbno: "", // HWBNO is auto-generated by SQL
						}),
					});

					if (!response.ok) {
						const errorData = await response.json();
						throw new Error(
							errorData.message || "Failed to create transaction",
						);
					}

					const result = await response.json();

					// If files are provided, upload them to Google Drive
					let driveUrl = "";
					let localPath = "";
					let uploadError = "";

					// if (files && files.length > 0) {
					try {
						const formData = new FormData();
						// Use the tax code from the form, not the customer code from ERP df
						formData.append("customerCode", newRecord.taxCode || "");
						formData.append("operationType", newRecord.operationType);
						formData.append("transID", result.transID);
						if (newRecord.shmtDate) {
							formData.append("shmtDate", newRecord.shmtDate);
						}

						// Append all files
						if (files && files.length > 0) {
							for (let i = 0; i < files.length; i++) {
								formData.append(`file${i}`, files[i]);
							}
						}
						const uploadResponse = await fetch("/api/followup/upload-files", {
							method: "POST",
							body: formData,
						});

						const uploadResult = await uploadResponse.json();

						if (uploadResponse.ok && uploadResult.success) {
							driveUrl = uploadResult.driveUrl;
							localPath = uploadResult.localPath || "";
						} else {
							uploadError = uploadResult.message || "File upload failed";
						}
					} catch (error) {
						uploadError =
							error instanceof Error ? error.message : "Unknown upload error";
					}
					// }

					// Save record to RPA database with Drive URL and local path
					let dbSaveError = "";
					try {
						const createResponse = await fetch("/api/followup/create", {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								...newRecord,
								driveUrl: driveUrl || null,
								localPath: localPath || null,
								jobNumber: result.transID, // Store TransID as job number
								companyName: result.customerName || null,
							}),
						});

						if (!createResponse.ok) {
							const errorData = await createResponse.json();
							dbSaveError =
								errorData.message || "Failed to save record to database";
						}
					} catch (error) {
						dbSaveError =
							error instanceof Error ? error.message : "Unknown database error";
					}

					// Invalidate query cache to refresh the table immediately
					await queryClient.invalidateQueries({ queryKey: ["followups"] });

					// Dismiss loading toast
					if (toastId) toast.dismiss(toastId);

					// Show success toast with transaction details
					toast.success("Transaction created successfully!", {
						description: `File No: ${result.transID} | HWBNO: ${result.hwbno}\nCustomer: ${result.customerName} (${result.customerCode})\nSite: ${result.site} | Service: ${result.serviceType}`,
						duration: 5000,
					});

					// Show file upload status
					if (driveUrl) {
						toast.success("Files uploaded to Google Drive", {
							description: driveUrl,
							duration: 5000,
						});
					} else if (uploadError) {
						toast.error("File upload failed", {
							description: uploadError,
							duration: 6000,
						});
					}

					// Show database save status
					if (dbSaveError) {
						toast.error("Database save failed", {
							description: dbSaveError,
							duration: 6000,
						});
					} else {
						toast.success("Record saved to database");

						// Auto-run FAST Input action after successful job creation
						try {
							const fastInputResponse = await fetch(
								"/api/followup/create-invoker-job",
								{
									method: "POST",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({
										taskName: "FAST Input",
										jobNumber: result.transID,
									}),
								},
							);

							if (fastInputResponse.ok) {
								toast.success("FAST Input job created", {
									description: `Auto-triggered for ${result.transID}`,
									duration: 3000,
								});
							} else {
								const fastInputError = await fastInputResponse.json();
								toast.error("FAST Input job failed", {
									description: `${result.transID} Error: ${fastInputError.details || fastInputError.message || "Unknown error"}`,
									duration: 5000,
								});
							}
						} catch (fastInputErr) {
							toast.error("FAST Input job failed", {
								description:
									fastInputErr instanceof Error
										? fastInputErr.message
										: `${result.transID} Error: Unknown error`,
								duration: 5000,
							});
						}
					}
				} else {
					// For other operation types, no action needed yet
				}
			} catch (error) {
				// Dismiss loading toast on error
				if (toastId) toast.dismiss(toastId);
				console.error("Error creating transaction:", error);
				toast.error("Failed to create transaction", {
					description: error instanceof Error ? error.message : "Unknown error",
					duration: Infinity,
				});
			}
		},
		[queryClient],
	);

	const handleDeleteRecord = useCallback(async (record: FollowUpRow) => {
		let toastId: string | number | undefined;
		try {
			// Check transaction not exists using API route (GET với query params)
			const checkTransResponse = await fetch(
				`/api/followup/check-transid?transid=${record.jobNumber}`,
				{
					method: "GET", // GET method
					headers: {
						"Content-Type": "application/json",
					},
				},
			);

			if (!checkTransResponse.ok) {
				const errorData = await checkTransResponse.json();
				throw new Error(errorData.error || "Failed to check job number");
			}

			const transCheckResult = await checkTransResponse.json();
			if (!transCheckResult.success) {
				throw new Error(`Check '${record.jobNumber}' fail.`);
			}
			if (transCheckResult.transCount > 0) {
				throw new Error(
					`Job ${record.jobNumber} still in FAST. Please delete it in FAST first.'`,
				);
			}
			// Show loading toast
			toastId = toast.loading("Deleting transaction...");

			// Call the create-transaction API to generate TransID in ERP
			const response = await fetch("/api/followup/update", {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					id: record.id,
					field: "isDeleted",
					value: true,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || "Failed to delete transaction");
			}

			// Dismiss loading toast
			if (toastId) toast.dismiss(toastId);

			// Show success toast with transaction details
			toast.success("Transaction delete successfully!", {
				duration: 5000,
			});

			setDeleteTransactionDialogOpen(false);
		} catch (error) {
			// Dismiss loading toast on error
			if (toastId) toast.dismiss(toastId);
			console.error("Error delete transaction:", error);
			toast.error("Failed to delete transaction", {
				description: error instanceof Error ? error.message : "Unknown error",
				duration: Infinity,
			});
		}
	}, []);

	const table = useReactTable({
		data: filteredData,
		columns,
		getRowId: (row) => row.id,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getExpandedRowModel: getExpandedRowModel(),
		// NOTE: Do NOT use getPaginationRowModel() - pagination is handled server-side
		// Server returns already-paginated data, no need for client-side pagination
		// Row can always expand since cargo list is always available (lazy loaded)
		getRowCanExpand: (row) => {
			const { declarations, invokerTasks, containers, cerOfOrigins } =
				row.original;
			return (
				(declarations?.length || 0) > 0 ||
				(invokerTasks?.length || 0) > 0 ||
				(containers?.length || 0) > 0 ||
				(cerOfOrigins?.length || 0) > 0 ||
				true // Cargo list tab is always available
			);
		},
		// Don't expand rows that aren't rendered (performance optimization for server-side pagination)
		paginateExpandedRows: false,
		// Prevent page reset when data changes (e.g., after editing a cell)
		autoResetPageIndex: false,
		enableColumnResizing: true,
		columnResizeMode: "onChange",
		enableColumnPinning: true,
		enableRowSelection: true,
		// NOTE: No client-side filtering - all filtering handled server-side
		state: {
			columnOrder,
			columnVisibility: columnVisibilityForTable,
			columnFilters,
			// NOTE: globalFilter removed from state - only used for search input value via onGlobalFilterChange
			sorting,
			expanded,
			columnPinning,
			columnSizing,
			pagination,
			rowSelection,
		},
		onColumnOrderChange: setColumnOrder,
		onColumnVisibilityChange: onColumnVisibilityChange,
		onColumnFiltersChange: setColumnFilters,
		onGlobalFilterChange: setGlobalFilter,
		onSortingChange: setSorting,
		onExpandedChange: setExpanded,
		onColumnPinningChange: setColumnPinning,
		onColumnSizingChange: setColumnSizing,
		onPaginationChange: onPaginationChange,
		onRowSelectionChange: setRowSelection,
		meta: {
			// Optimistic updateData handler using mutation hook - instant UI update
			updateData: useCallback(
				(rowId: string, columnId: string, value: unknown) => {
					if (isReadOnly) return; // Block edits for Accounting (view-only)
					updateFollowUp({ id: rowId, field: columnId, value });
				},
				[updateFollowUp, isReadOnly],
			),
			// Refresh data function for status-action-dropdown (full refresh)
			refreshData: useCallback(() => {
				queryClient.invalidateQueries({ queryKey: ["followups"] });
			}, [queryClient]),
			// Rerun transaction handler - opens AddRecordDialog with prefilled data
			onRerunTransaction: useCallback((rowData: FollowUpRow) => {
				setAddRecordPrefillData(rowData);
				setAddRecordDialogOpen(true);
			}, []),
			// Create container handler - opens container dialog
			onCreateContainer: useCallback((rowData: FollowUpRow) => {
				setContainerFollowUp(rowData);
				setContainerDialogOpen(true);
			}, []),

			onDeleteTransation: (row: FollowUpRow) => {
				setdeleteTransactionFollowUp(row);
				setDeleteTransactionDialogOpen(true);
			},

			onViewDetails: handleViewDetails,
			// Track which sub-tab is active per row (used by BaseActionsCell for toggle)
			activeRowTabs,
			// Set active sub-tab when clicking on a sub-table icon
			onSubTabClick: (rowId: string, tab: SubTabType) => {
				setActiveRowTabs((prev) => ({ ...prev, [rowId]: tab }));
			},
			// Bulk action handler
			onBulkAction: async (action: string) => {
				const selectedRows = table.getSelectedRowModel().rows;

				if (selectedRows.length === 0) {
					toast.error("No rows selected");
					return;
				}

				let successCount = 0;
				let failedCount = 0;
				const errors: string[] = [];

				try {
					for (const row of selectedRows) {
						const jobNumber = row.original.jobNumber;

						if (!jobNumber) {
							failedCount++;
							errors.push(`Row ${row.id}: No job number found`);
							continue;
						}

						// CLIENT-SIDE VALIDATION
						const validationErrors = validateFollowUpForBotAction(
							row.original,
							action as BotActionType,
						);

						if (validationErrors.length > 0) {
							failedCount++;
							errors.push(
								`${jobNumber}: ${formatValidationErrors(validationErrors)}`,
							);
							continue;
						}

						// INVOICE CHECK — block FAST Input / FAST CDS / FAST CO if already invoiced
						const INVOICE_BLOCKED_ACTIONS = [
							BOT_ACTIONS.FAST_INPUT,
							BOT_ACTIONS.FAST_CDS,
							BOT_ACTIONS.FAST_CO,
						] as string[];
						if (INVOICE_BLOCKED_ACTIONS.includes(action)) {
							try {
								const invoiceRes = await fetch(
									`/api/erp/check-invoice?job=${encodeURIComponent(jobNumber)}`,
								);
								const invoiceData = await invoiceRes.json();
								if (invoiceData.hasInvoice) {
									failedCount++;
									errors.push(
										`${jobNumber}: Đã xuất hóa đơn thu khách (${invoiceData.totalCount} hóa đơn)`,
									);
									continue;
								}
							} catch {
								failedCount++;
								errors.push(
									`${jobNumber}: Không thể kiểm tra trạng thái hóa đơn ERP`,
								);
								continue;
							}
						}

						// PROCEED WITH ACTION
						try {
							if (action === BOT_ACTIONS.FAST_FINISH) {
								const response = await fetch(
									"/api/followup/fast-finish-logistic",
									{
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({ jobNumber }),
									},
								);

								const result = await response.json();

								if (!response.ok || !result.success) {
									throw new Error(result.message || "Failed to finish job");
								}

								successCount++;
								continue;
							}

							if (action === BOT_ACTIONS.FAST_UNFINISH) {
								const response = await fetch(
									"/api/trucking-followup/fast-unfinish",
									{
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({ jobNumber }),
									},
								);

								const result = await response.json();

								if (!response.ok || !result.success) {
									throw new Error(result.message || "Failed to un-finish job");
								}

								successCount++;
								continue;
							}

							let endpoint = "/api/followup/create-invoker-job";
							if (action === BOT_ACTIONS.CHECK_QUA_KVGS) {
								endpoint = "/api/followup/check-quan-kvgs";
							} else if (action === BOT_ACTIONS.CHECK_CDS_ATTACHMENT) {
								endpoint = "/api/followup/check-cds-attachment";
							}

							const response = await fetch(endpoint, {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({ taskName: action, jobNumber }),
							});

							if (!response.ok) {
								const error = await response.json();
								throw new Error(
									error.message || "Failed to create invoker job",
								);
							}

							successCount++;
						} catch (error) {
							failedCount++;
							errors.push(
								`${jobNumber}: ${error instanceof Error ? error.message : "Failed to create job"}`,
							);
						}
					}

					// Show summary toast
					if (successCount > 0) {
						toast.success(`${action} completed`, {
							description: `${successCount} job(s) created successfully${failedCount > 0 ? `, ${failedCount} failed` : ""}`,
							duration: 5000,
						});
					}

					if (failedCount > 0) {
						toast.error(`${failedCount} job(s) failed`, {
							description: errors.slice(0, 3).join("\n"),
							duration: 10000,
						});
					}

					// Refresh the table
					queryClient.invalidateQueries({ queryKey: ["followups"] });

					// Clear selection after action
					table.resetRowSelection();
				} catch (error) {
					toast.error("Bulk action failed", {
						description:
							error instanceof Error ? error.message : "Unknown error",
						duration: 10000,
					});
				}
			},
			dependencies,
		},
	});

	// Export to Excel handler
	const handleExport = useCallback(async () => {
		await exportToExcel({
			apiUrl: "/api/followup",
			sheetName: "FollowUp",
			filename: "FollowUp_Export",
			headerConfigs: FOLLOWUP_HEADERS,
			dependencies: (table.options.meta as any)?.dependencies,
			excludeColumns: ["actions", "documents"],
			getVisibleColumns: () => table.getVisibleLeafColumns(),
			filters: {
				search: debouncedGlobalFilter,
				status: statusFilter,
				hideOthers: hideOthersTasks ?? undefined,
				advanced: advancedFilters,
				sorting: sorting,
				dateRange: dateRange ?? undefined,
			},
			filenameTimestampFormat: "date",
			errorToastDuration: Number.POSITIVE_INFINITY,
			transformRow: (original: any, _visibleColumns: string[]) => {
				const rowData: Record<string, any> = {};

				const visibleCols = table
					.getVisibleLeafColumns()
					.filter((col) => col.id !== "actions" && col.id !== "documents");

				for (const col of visibleCols) {
					const config =
						FOLLOWUP_HEADERS[col.id as keyof typeof FOLLOWUP_HEADERS];
					const header = config?.header || col.id;
					let value = original[col.id];

					// Resolve IDs to names if dependency exists
					const useDependency = config?.cellProps?.useDependency;
					if (useDependency && (table.options.meta as any)?.dependencies) {
						const deps = (table.options.meta as any).dependencies[
							useDependency
						];
						if (Array.isArray(deps)) {
							const option = deps.find(
								(opt: any) => (opt.id || opt.value) === value,
							);
							if (option) value = option.name || option.label || value;
						}
					}

					// Special handle for createdBy (resolve to user name)
					if (col.id === "createdBy") {
						const user = original.user;
						value = user?.username || user?.email || value;
					}

					// Special handle for status (resolve to invoker tasks summary)
					if (col.id === "status") {
						const tasks = original.invokerTasks || [];
						if (tasks.length > 0) {
							const sortedTasks = [...tasks].sort((a, b) => {
								const tA = a.created_time
									? new Date(a.created_time).getTime()
									: 0;
								const tB = b.created_time
									? new Date(b.created_time).getTime()
									: 0;
								return tB - tA;
							});
							value = sortedTasks
								.slice(0, 3)
								.map((t) => `${t.task_name}: ${t.status}`)
								.join(", ");
						} else {
							value = original.status || "";
						}
					}

					// Special handle for declarations column
					if (col.id === "declarations") {
						const declarations = original.declarations || [];
						value = declarations
							.map((d: any) => d.declarationNumber)
							.filter(Boolean)
							.join(", ");

						// Add Declaration Date column
						const declDates = declarations
							.map((d: any) => d.declarationDate)
							.filter(Boolean)
							.map((d: any) => {
								try {
									const dateObj = new Date(d);
									return Number.isNaN(dateObj.getTime())
										? ""
										: dateObj.toLocaleDateString("vi-VN");
								} catch {
									return "";
								}
							})
							.filter(Boolean)
							.join(", ");

						rowData[header] = value;
						rowData["Ngày tờ khai"] = declDates;

						// Add Ngày qua KVGS column (Requirement: only in Excel, not in UI)
						const kvgsDates = declarations
							.map((d: any) => d.kvgsDate)
							.filter(Boolean)
							.map((d: any) => {
								try {
									const dateObj = new Date(d);
									return Number.isNaN(dateObj.getTime())
										? ""
										: dateObj.toLocaleDateString("vi-VN");
								} catch {
									return "";
								}
							})
							.filter(Boolean)
							.join(", ");
						rowData["Ngày qua KVGS"] = kvgsDates;

						continue;
					}

					// Format dates and handle null values
					if (
						value &&
						typeof value === "string" &&
						(col.id.toLowerCase().includes("date") ||
							col.id.toLowerCase().includes("time") ||
							col.id === "etaEtd")
					) {
						try {
							const date = new Date(value);
							if (!Number.isNaN(date.getTime())) {
								value = date.toLocaleDateString("vi-VN");
							}
						} catch {
							// keep original value
						}
					} else if (value instanceof Date) {
						value = value.toLocaleDateString("vi-VN");
					} else if (value === null || value === undefined) {
						value = "";
					}

					rowData[header] = value;
				}

				// Ensure "Ngày tờ khai" and "Ngày qua KVGS" fallback if declarations column was not visible
				const declarations = original.declarations || [];
				if (rowData["Ngày tờ khai"] === undefined) {
					rowData["Ngày tờ khai"] = declarations
						.map((d: any) => d.declarationDate)
						.filter(Boolean)
						.map((d: any) => {
							try {
								const dateObj = new Date(d);
								return Number.isNaN(dateObj.getTime())
									? ""
									: dateObj.toLocaleDateString("vi-VN");
							} catch {
								return "";
							}
						})
						.filter(Boolean)
						.join(", ");
				}

				if (rowData["Ngày qua KVGS"] === undefined) {
					rowData["Ngày qua KVGS"] = declarations
						.map((d: any) => d.kvgsDate)
						.filter(Boolean)
						.map((d: any) => {
							try {
								const dateObj = new Date(d);
								return Number.isNaN(dateObj.getTime())
									? ""
									: dateObj.toLocaleDateString("vi-VN");
							} catch {
								return "";
							}
						})
						.filter(Boolean)
						.join(", ");
				}

				return rowData;
			},
		});
	}, [
		table,
		debouncedGlobalFilter,
		statusFilter,
		hideOthersTasks,
		advancedFilters,
		sorting,
		dateRange,
	]);

	return (
		<div className="flex flex-col max-h-full gap-4">
			<SharedToolbar
				onGlobalFilterChange={setGlobalFilter}
				searchPlaceholder="Tìm kiếm... (nhiều job: JOB1, JOB2, JOB3)"
				AdvancedFilterComponent={AdvancedFilterPopover}
				advancedFilters={advancedFilters as any}
				onApplyFilters={(filters: any) => setAdvancedFilters(filters)}
				hideOthersTasks={!!hideOthersTasks}
				onHideOthersTasksChange={setHideOthersTasks}
				dependencies={useMemo(
					() => ({
						serviceModes,
						units,
						cargoTypes,
						workTypes,
						airports,
						partners,
						siteUsers,
					}),
					[
						serviceModes,
						units,
						cargoTypes,
						workTypes,
						airports,
						partners,
						siteUsers,
					],
				)}
				columns={useMemo(
					() =>
						columns
							.filter(
								(
									col,
								): col is ColumnDef<FollowUpRow> & { accessorKey: string } =>
									("accessorKey" in col || !!col.id) &&
									col.id !== "actions" &&
									col.id !== "documents",
							)
							.map((col) => {
								const key = (col.accessorKey as string) || col.id!;
								return {
									accessorKey: key,
									header: FOLLOWUP_LABELS[key] || key,
								};
							}),
					[columns],
				)}
				dateRange={dateRange}
				onDateRangeChange={setDateRange}
				DateRangeComponent={DateRangePicker}
				showAddButton={!isReadOnly}
				onAddRecordClick={useCallback(() => {
					setAddRecordPrefillData(null); // Clear prefill for new record
					setAddRecordDialogOpen(true);
				}, [])}
				showExportButton={true}
				onExport={handleExport}
				onColumnManageClick={useCallback(() => setReorderDialogOpen(true), [])}
				onRefresh={handleRefresh}
				isRefreshing={isFetching}
			/>

			{isMobile ? (
				<p className="-mt-1 px-1 text-[11px] leading-snug text-muted-foreground md:hidden">
					Màn hình nhỏ: một số cột được ẩn mặc định. Vuốt ngang trên bảng để xem
					thêm. Bật lại cột trong Quản lý cột (biểu tượng cột).
				</p>
			) : null}

			<DataTableContent
				table={table}
				subPanelVisibility={subPanelVisibility}
				activeRowTabs={activeRowTabs}
				isLoading={isLoading}
				isFetching={isFetching}
				enableRowReorder={!isReadOnly && !isMobile}
				onRowOrderChange={handleRowOrderChange}
			/>

			<DataTablePagination
				table={table}
				pagination={pagination}
				paginationMeta={paginationMeta}
			/>

			<ColumnManageDialog
				table={table}
				open={reorderDialogOpen}
				onOpenChange={setReorderDialogOpen}
				columnHeaders={FOLLOWUP_HEADERS}
			/>

			<AddRecordDialog
				open={addRecordDialogOpen}
				onOpenChange={(open) => {
					setAddRecordDialogOpen(open);
					if (!open) setAddRecordPrefillData(null); // Clear prefill when closing
				}}
				onAddRecord={handleAddRecord}
				prefillData={addRecordPrefillData}
			/>

			<CreateContainerDialog
				open={containerDialogOpen}
				onOpenChange={setContainerDialogOpen}
				followUp={containerFollowUp}
			/>

			<DeleteTransationDialog
				open={deleteTransactionDialogOpen}
				onOpenChange={(open) => {
					setDeleteTransactionDialogOpen(open);
				}}
				followUp={deleteTransactionFollowUp}
				onDeleteRecord={handleDeleteRecord}
			/>

			<FollowUpDetailsDialog
				open={detailsDialogOpen}
				onOpenChange={setDetailsDialogOpen}
				row={detailsFollowUp}
				isRefreshing={isFetching}
			/>
		</div>
	);
};
