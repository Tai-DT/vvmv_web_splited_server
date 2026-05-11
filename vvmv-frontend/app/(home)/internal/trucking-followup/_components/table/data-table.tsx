"use client";

import {
	getCoreRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table";
import "./table-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTablePagination } from "@/components/shared/data-table";
import { useAirports } from "@/hooks/use-airports";
import { useForeignPorts } from "@/hooks/use-foreign-ports";
import { useOps } from "@/hooks/use-ops";
import { usePartners } from "@/hooks/use-partners";
import { usePickOrLiftPlaces } from "@/hooks/use-pick-or-lift-place";
import { useServiceModes } from "@/hooks/use-service-modes";
import { useShippingLines } from "@/hooks/use-shipping-lines";
import { type SiteUser, useSiteUsers } from "@/hooks/use-site-users";
import { useTruckTypes } from "@/hooks/use-truck-types";
import { useVendors } from "@/hooks/use-vendor";
import { useSession } from "@/lib/auth-client";
import { exportToExcel } from "@/lib/export-excel";
import {
	formatValidationErrors,
	TRUCKING_BOT_ACTIONS,
	TRUCKING_BULK_ACTIONS,
	type TruckingBotActionType,
	validateTruckingFollowUpForBotAction,
} from "@/lib/validation/trucking-followup-validation";
import { AddRecordDialog } from "../../../_components/shared/dialogs/add-record-dialog";
import { ColumnManageDialog } from "../../../_components/shared/dialogs/column-manage-dialog";
import type { ComboboxOption } from "../../../followup/_components/cells/combobox-cell";
import { useTruckingFollowUpMutation } from "../../hooks/use-trucking-mutation";
import type { TruckingFollowUpRow } from "../../types";
import { CombineJobsDialog } from "../dialogs/combine-jobs-dialog";
import { ContainerInfoMailDialog } from "../dialogs/container-info-mail-dialog";
import { DeleteTruckingTransactionDialog } from "../dialogs/delete-trucking-transaction-dialog";
import {
	type MailDraft,
	MailPreviewDialog,
} from "../dialogs/mail-preview-dialog";
import { TruckingFollowUpDetailsDialog } from "../dialogs/trucking-followup-details-dialog";
import type { FilterCondition } from "../filters/trucking-advanced-filter";
import { TRUCKING_FOLLOWUP_HEADERS } from "./column-headers";
import { FCR_LABELS, TRUCKING_FOLLOWUP_LABELS } from "./column-labels";
import { getTruckingColumns } from "./data-table-columns";
import { TruckingDataTableContent } from "./data-table-content";
import { TruckingDataTableToolbar } from "./data-table-toolbar";
import { useTruckingStatsStore } from "./use-stats-store";
import { createTruckingTableStore } from "./use-table-state";

export const TruckingDataTable = () => {
	const { data: session } = useSession();
	const userId = session?.user?.id ?? "guest";
	const queryClient = useQueryClient();

	const useTableStore = createTruckingTableStore(userId);
	const hasHydrated = useTableStore((state) => state._hasHydrated);
	const columnOrder = useTableStore((state) => state.columnOrder);
	const columnVisibility = useTableStore((state) => state.columnVisibility);
	const columnPinning = useTableStore((state) => state.columnPinning);
	const columnSizing = useTableStore((state) => state.columnSizing);
	const storePageSize = useTableStore((state) => state.pageSize);
	const statusFilter = useTableStore((state) => state.statusFilter);
	const dateRange = useTableStore((state) => state.dateRange);
	const hideOthersTasks = useTableStore((state) => state.hideOthersTasks);
	const setHideOthersTasks = useTableStore((state) => state.setHideOthersTasks);
	const serviceModeFilter = useTableStore((state) => state.serviceModeFilter);
	const setServiceModeFilter = useTableStore(
		(state) => state.setServiceModeFilter,
	);

	const setColumnOrder = useTableStore((state) => state.setColumnOrder);
	const setColumnVisibility = useTableStore(
		(state) => state.setColumnVisibility,
	);
	const setColumnPinning = useTableStore((state) => state.setColumnPinning);
	const setColumnSizing = useTableStore((state) => state.setColumnSizing);
	const setStorePageSize = useTableStore((state) => state.setPageSize);
	const setDateRange = useTableStore((state) => state.setDateRange);
	const activeRowTabs = useTableStore((state) => state.activeRowTabs);
	const setActiveRowTab = useTableStore((state) => state.setActiveRowTab);

	const [sorting, setSorting] = useState([]);
	const [globalFilter, setGlobalFilter] = useState("");
	const [advancedFilters, setAdvancedFilters] = useState<FilterCondition[]>([]);
	const [columnManageOpen, setColumnManageOpen] = useState(false);
	const [addRecordDialogOpen, setAddRecordDialogOpen] = useState(false);
	const [detailsOpen, setDetailsOpen] = useState(false);
	const [detailsRow, setDetailsRow] = useState<TruckingFollowUpRow | null>(
		null,
	);
	const [rowSelection, setRowSelection] = useState({});
	const [combineDialogOpen, setCombineDialogOpen] = useState(false);
	const [combineRows, setCombineRows] = useState<TruckingFollowUpRow[]>([]);
	const [combineLoading, setCombineLoading] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deleteFollowUp, setDeleteFollowUp] =
		useState<TruckingFollowUpRow | null>(null);

	// Mail drafts — lifted here so dialog persists across 30s auto-refresh
	const [mailDrafts, setMailDrafts] = useState<MailDraft[]>([]);
	// Container info mail — lifted here so dialog persists across 30s auto-refresh
	const [containerInfoMailRow, setContainerInfoMailRow] =
		useState<TruckingFollowUpRow | null>(null);

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
	const userRole = session?.user?.role;

	// Detect if user belongs to Accounting department (view-only mode)
	const { data: userDepts } = useQuery({
		queryKey: ["user-departments", userId],
		queryFn: async () => {
			const res = await fetch("/api/user/departments");
			if (!res.ok) return { departments: [] };
			return res.json();
		},
		enabled: !!userId && userId !== "guest",
	});
	const isReadOnly: boolean =
		(userDepts?.departments ?? []).includes("Accounting") &&
		userRole !== "ADMIN" &&
		userRole !== "SUPERADMIN";

	// Set default hideOthersTasks based on role if not yet set
	useEffect(() => {
		if (!userId || !userRole || !hasHydrated) return;

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

	// Store pagination metadata from API
	const [paginationMeta, setPaginationMeta] = useState({
		total: 0,
		totalPages: 1,
	});

	// Helpers to fetch data
	const {
		data: result,
		isLoading,
		isFetching,
		refetch,
	} = useQuery({
		queryKey: [
			"trucking-followups",
			globalFilter,
			dateRange,
			advancedFilters,
			statusFilter,
			hideOthersTasks,
			serviceModeFilter,
			pagination.pageIndex,
			pagination.pageSize,
		],
		queryFn: async () => {
			const params = new URLSearchParams();
			if (globalFilter) params.append("search", globalFilter);
			if (dateRange?.from) params.append("from", dateRange.from);
			if (dateRange?.to) params.append("to", dateRange.to);
			if (advancedFilters.length > 0)
				params.append("filters", JSON.stringify(advancedFilters));
			if (statusFilter !== "all") params.append("status", statusFilter);
			if (hideOthersTasks) params.append("hideOthers", "true");

			// Build serviceModeTypes param
			const smTypes = [
				...(serviceModeFilter.fcl ? ["fcl"] : []),
				...(serviceModeFilter.air ? ["air"] : []),
				...(serviceModeFilter.lcl ? ["lcl"] : []),
			];
			params.append("serviceModeTypes", smTypes.join(","));

			params.append("page", (pagination.pageIndex + 1).toString());
			params.append("pageSize", pagination.pageSize.toString());

			const response = await fetch(
				`/api/trucking-followup?${params.toString()}`,
			);
			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.error || "Failed to fetch");
			}
			return await response.json();
		},
		enabled: hasHydrated,
		refetchInterval: 30000,
		refetchIntervalInBackground: false,
		staleTime: 0,
	});

	// Use the merged data from API (API now handles parent-child merging)
	const data = useMemo(() => {
		return result?.data || [];
	}, [result?.data]);

	// Update pagination metadata from API response
	useEffect(() => {
		if (result?.pagination) {
			setPaginationMeta({
				total: result.pagination.total || 0,
				totalPages: result.pagination.totalPages || 1,
			});
		}
	}, [result?.pagination]);

	// Update global stats store with latest counts from API
	const updateStatsStore = useTruckingStatsStore((state) => state.updateStats);
	const setIsAccountingUser = useTruckingStatsStore(
		(state) => state.setIsAccountingUser,
	);
	useEffect(() => {
		if (result?.stats) {
			updateStatsStore(
				result.stats.active || 0,
				result.stats.pending || 0,
				result.stats.loaded || 0,
				result.stats.finished || 0,
				result.stats.done || 0,
				result.stats.pendingTruckingApproval || 0,
				result.stats.pendingDisbursementApproval || 0,
			);
		}
	}, [result?.stats, updateStatsStore]);

	// Sync Accounting user flag into store so InternalHeader can read it
	useEffect(() => {
		setIsAccountingUser(isReadOnly);
	}, [isReadOnly, setIsAccountingUser]);

	const { serviceModes } = useServiceModes();
	const { users: siteUsersRaw } = useSiteUsers("Trucking");
	const { vendors: vendorsRaw } = useVendors();
	const { pickOrLiftPlaces: pickOrLiftPlacesRaw } = usePickOrLiftPlaces();
	const { ops: opsRaw } = useOps();
	const { airports: airportsRaw } = useAirports();
	const { truckTypes: truckTypesRaw } = useTruckTypes();
	const { shippingLines } = useShippingLines();
	const { partners } = usePartners();
	const { mutate: updateTruckingFollowUp } = useTruckingFollowUpMutation();

	const siteUsers = useMemo((): ComboboxOption[] => {
		return (siteUsersRaw || []).map((u: SiteUser) => ({
			id: u.id,
			name: u.name || u.email,
		}));
	}, [siteUsersRaw]);

	const vendors = useMemo((): ComboboxOption[] => {
		return (vendorsRaw || []).map((v: string) => ({
			id: v,
			name: v,
		}));
	}, [vendorsRaw]);

	const pickOrLiftPlaces = useMemo((): ComboboxOption[] => {
		return (pickOrLiftPlacesRaw || []).map((p: string) => ({
			id: p,
			name: p,
		}));
	}, [pickOrLiftPlacesRaw]);

	const ops = useMemo((): ComboboxOption[] => {
		return (opsRaw || []).map((v: string) => ({
			id: v,
			name: v,
		}));
	}, [opsRaw]);

	const airports = useMemo((): ComboboxOption[] => {
		return (airportsRaw || [])
			.filter((a) => a.id !== "")
			.map((a) => ({ id: a.id, name: a.name }));
	}, [airportsRaw]);

	const truckTypes = useMemo((): ComboboxOption[] => {
		return (truckTypesRaw || []).map((t: string) => ({ id: t, name: t }));
	}, [truckTypesRaw]);

	const { ports: destinationPortsRaw } = useForeignPorts("DESTINATION");
	const { ports: transitPortsRaw } = useForeignPorts("TRANSIT");

	const destinationPorts = useMemo((): ComboboxOption[] => {
		return (destinationPortsRaw || []).map((p) => ({
			id: p.name,
			name: p.name,
		}));
	}, [destinationPortsRaw]);

	const transitPorts = useMemo((): ComboboxOption[] => {
		return (transitPortsRaw || []).map((p) => ({ id: p.name, name: p.name }));
	}, [transitPortsRaw]);

	const handleRefresh = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: ["trucking-followups"] });
		queryClient.invalidateQueries({ queryKey: ["dispatch-board"] });
	}, [queryClient]);

	const handleDeleteRecord = useCallback(
		async (record: TruckingFollowUpRow) => {
			let toastId: string | number | undefined;
			try {
				// Show loading toast
				toastId = toast.loading("Deleting transaction...");

				// Call the delete-job API which handles ERP deletion + RPA soft-delete
				const response = await fetch("/api/trucking-followup/delete-job", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						id: record.id,
						jobNumber: record.jobNumber,
					}),
				});

				const result = await response.json();

				if (!response.ok || !result.success) {
					throw new Error(result.message || "Failed to delete transaction");
				}

				// Dismiss loading toast
				if (toastId) toast.dismiss(toastId);

				// Show success toast
				toast.success("Transaction deleted successfully!", {
					duration: 5000,
				});

				setDeleteDialogOpen(false);

				// Refresh data
				queryClient.invalidateQueries({ queryKey: ["trucking-followups"] });
				queryClient.invalidateQueries({ queryKey: ["dispatch-board"] });
			} catch (error) {
				// Dismiss loading toast on error
				if (toastId) toast.dismiss(toastId);
				console.error("Error deleting transaction:", error);
				toast.error("Failed to delete transaction", {
					description: error instanceof Error ? error.message : "Unknown error",
					duration: Infinity,
				});
			}
		},
		[queryClient],
	);

	const handleCombineConfirm = useCallback(
		async (keeperJobId: string, deleteJobIds: string[]) => {
			setCombineLoading(true);
			try {
				const response = await fetch("/api/trucking-followup/combine-jobs", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ keeperJobId, deleteJobIds }),
				});

				if (!response.ok) {
					const err = await response.json();
					throw new Error(err.message || "Failed to combine jobs");
				}

				const result = await response.json();
				toast.success(
					`Đã gộp ${result.mergedCount} job vào ${result.keeperJobNumber}`,
				);
				setCombineDialogOpen(false);
				table.resetRowSelection();
				queryClient.invalidateQueries({ queryKey: ["trucking-followups"] });
				queryClient.invalidateQueries({ queryKey: ["dispatch-board"] });
			} catch (error) {
				toast.error(
					error instanceof Error ? error.message : "Failed to combine jobs",
					{
						duration: 8000,
					},
				);
			} finally {
				setCombineLoading(false);
			}
		},
		[queryClient],
	);

	const handleAddRecord = useCallback(
		async (newRecord: any, files?: FileList | null) => {
			let toastId: string | number | undefined;
			try {
				// Cast to any to access trucking-specific fields
				const recordData = newRecord as any;

				// 0. Check folder exists using API route
				const folderName = encodeURIComponent(recordData.taxCode || "na");
				// For trucking, we can use implementationDate or shmtDate as the reference date
				const shmtDateParam = newRecord.shmtDate
					? `&shmtDate=${encodeURIComponent(newRecord.shmtDate)}`
					: "";

				const checkFolderResponse = await fetch(
					`/api/followup/check-folder?folderName=${folderName}${shmtDateParam}`,
					{
						method: "GET",
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
						`Customer folder '${recordData.taxCode}' not found in any Shared Drive. Please create it first.`,
					);
				}

				// Show loading toast
				toastId = toast.loading("Creating trucking transaction...");

				// 1. Create transaction in ERP to get jobNumber
				const transResponse = await fetch("/api/transaction/create", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						operationType: "TRUCK",
						taxCode: recordData.taxCode,
					}),
				});

				if (!transResponse.ok) {
					const errorData = await transResponse.json();
					throw new Error(
						errorData.message || "Failed to create transaction in ERP",
					);
				}

				const transResult = await transResponse.json();

				// 2. Upload files and create structured folders
				let driveUrl = "";
				let localPath = "";
				let uploadError = "";

				try {
					const formData = new FormData();
					formData.append("customerCode", recordData.taxCode || "");
					formData.append("operationType", "TRUCK"); // Structured as Month/TRUCK/TransID
					formData.append("transID", transResult.transID);

					// Append all files if present
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

				// 3. Build payload with generated jobNumber and document links
				const payload: any = {
					taxCode: recordData.taxCode,
					operationType: recordData.operationType, // XUAT or NHAP from dialog
					jobNumber: transResult.transID, // Use ERP-generated transID
					requestNumber: transResult.hwbno, // Store HWBNO as requestNumber (FCR format)
					companyName: transResult.customerName || null,
					driveUrl: driveUrl || null,
					localPath: localPath || null,
				};

				// Add optional fields only if they have values
				if (recordData.ops) payload.ops = recordData.ops;
				if (recordData.billOrBooking)
					payload.billOrBooking = recordData.billOrBooking;
				if (recordData.serviceMode)
					payload.serviceMode = recordData.serviceMode;
				if (recordData.cbm != null) payload.cbm = recordData.cbm;
				if (recordData.grossWeight != null)
					payload.grossWeight = recordData.grossWeight;
				if (recordData.quantity != null) payload.quantity = recordData.quantity;

				// Handler is a foreign key - only include if it has a valid value
				if (recordData.handler && recordData.handler !== "") {
					payload.handler = recordData.handler;
				}

				// Add other optional trucking fields
				if (recordData.closingTime)
					payload.closingTime = recordData.closingTime;
				if (recordData.cutOffTime) payload.cutOffTime = recordData.cutOffTime;
				if (recordData.vesselName) payload.vesselName = recordData.vesselName;
				if (recordData.veselNumber)
					payload.veselNumber = recordData.veselNumber;
				if (recordData.carrierName)
					payload.carrierName = recordData.carrierName;
				if (recordData.routineDetail)
					payload.routineDetail = recordData.routineDetail;
				if (recordData.fromLocation)
					payload.fromLocation = recordData.fromLocation;
				if (recordData.toLocation) payload.toLocation = recordData.toLocation;
				if (recordData.pickOrLiftPlace)
					payload.pickOrLiftPlace = recordData.pickOrLiftPlace;
				if (recordData.commodityName)
					payload.commodityName = recordData.commodityName;
				if (recordData.warehouse) payload.warehouse = recordData.warehouse;
				if (recordData.pickUpTime) payload.pickUpTime = recordData.pickUpTime;
				if (recordData.ccgh) payload.ccgh = recordData.ccgh;
				if (recordData.authority) payload.authority = recordData.authority;
				if (recordData.maLo) payload.maLo = recordData.maLo;
				if (recordData.transitPort)
					payload.transitPort = recordData.transitPort;
				if (recordData.destinationPort)
					payload.destinationPort = recordData.destinationPort;
				if (recordData.deliveryContactDetail)
					payload.deliveryContactDetail = recordData.deliveryContactDetail;
				if (recordData.eportService)
					payload.eportService = recordData.eportService;
				if (recordData.maNhanConmt)
					payload.maNhanConmt = recordData.maNhanConmt;
				if (recordData.soLenh) payload.soLenh = recordData.soLenh;
				if (recordData.ngatDienDate)
					payload.ngatDienDate = recordData.ngatDienDate;
				if (recordData.note) payload.note = recordData.note;
				if (recordData.note2) payload.note2 = recordData.note2;
				if (recordData.note3) payload.note3 = recordData.note3;
				if (recordData.note4) payload.note4 = recordData.note4;
				if (recordData.note5) payload.note5 = recordData.note5;
				if (recordData.hsCode) payload.hsCode = recordData.hsCode;
				if (recordData.donViKhuTrung)
					payload.donViKhuTrung = recordData.donViKhuTrung;
				if (recordData.temperature != null)
					payload.temperature = recordData.temperature;
				if (recordData.payDate) payload.payDate = recordData.payDate;
				if (recordData.bbbt) payload.bbbt = recordData.bbbt;
				if (recordData.clientName) payload.clientName = recordData.clientName;
				if (recordData.invoiceTaxCode)
					payload.invoiceTaxCode = recordData.invoiceTaxCode;
				if (recordData.vendor) payload.vendor = recordData.vendor;
				if (recordData.truckType) payload.truckType = recordData.truckType;
				if (recordData.tTypeC) payload.tTypeC = recordData.tTypeC;
				if (recordData.implementationDate)
					payload.implementationDate = recordData.implementationDate;

				// Add containers if present
				if (recordData.containers && recordData.containers.length > 0) {
					payload.containers = recordData.containers;
				}

				// 3. Save to RPA database with generated IDs
				const response = await fetch("/api/trucking-followup", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.message || "Failed to create trucking record");
				}

				// Refresh table data
				await queryClient.invalidateQueries({
					queryKey: ["trucking-followups"],
				});
				await queryClient.invalidateQueries({ queryKey: ["dispatch-board"] });

				// Dismiss loading toast
				if (toastId) toast.dismiss(toastId);

				// Show success toast with transaction details
				toast.success("Trucking transaction created successfully!", {
					description: `Job Number: ${transResult.transID} | FCR: ${transResult.hwbno}\nCustomer: ${transResult.customerName}\nSite: ${transResult.site}`,
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
			} catch (error) {
				// Dismiss loading toast
				if (toastId) toast.dismiss(toastId);

				console.error("Error creating trucking record:", error);
				toast.error(
					error instanceof Error
						? error.message
						: "Failed to create trucking record",
					{
						duration: 5000,
					},
				);
			}
		},
		[queryClient],
	);

	const handleExport = useCallback(async () => {
		const smTypes = [
			...(serviceModeFilter.fcl ? ["fcl"] : []),
			...(serviceModeFilter.air ? ["air"] : []),
			...(serviceModeFilter.lcl ? ["lcl"] : []),
		];
		await exportToExcel({
			apiUrl: "/api/trucking-followup",
			sheetName: "Trucking FollowUps",
			filename: "trucking_followups",
			filenameTimestampFormat: "datetime",
			excludeColumns: ["actions"],
			filters: {
				search: globalFilter,
				status: statusFilter,
				hideOthers: hideOthersTasks ?? undefined,
				advanced: advancedFilters,
				dateRange: dateRange ?? undefined,
				serviceModeTypes: smTypes.join(","),
			},
			transformRow: (original: any) => {
				const rowData: Record<string, any> = {};

				// Get all column IDs from data
				const columnIds = Object.keys(original).filter(
					(id) => id !== "actions",
				);

				for (const colId of columnIds) {
					const config =
						TRUCKING_FOLLOWUP_LABELS[
							colId as keyof typeof TRUCKING_FOLLOWUP_LABELS
						] || FCR_LABELS[colId as keyof typeof FCR_LABELS];
					const header = (config as any)?.header || colId;
					let value = original[colId];

					// Special handle for createdBy (resolve to user name)
					if (colId === "createdBy") {
						const user = original.user;
						value = user?.username || user?.email || value;
					}

					rowData[header] = value ?? "";
				}

				return rowData;
			},
		});
	}, [
		globalFilter,
		statusFilter,
		hideOthersTasks,
		advancedFilters,
		dateRange,
		serviceModeFilter,
	]);

	const columns = useMemo(
		() =>
			getTruckingColumns(
				serviceModes,
				siteUsers,
				vendors,
				pickOrLiftPlaces,
				ops,
			),
		[serviceModes, siteUsers, vendors, pickOrLiftPlaces, ops],
	);

	// Initialize column order if empty OR add new columns that don't exist in saved order
	useEffect(() => {
		if (!hasHydrated) return;

		const allColumnIds = columns.map(
			(col) => (col as any).accessorKey || (col as any).id,
		);

		if (columnOrder.length === 0) {
			// First time user - set default order
			setColumnOrder(allColumnIds);
		} else {
			// Existing user - check for new columns not in saved order or mismatch in first columns
			const newColumns = allColumnIds.filter((id) => !columnOrder.includes(id));
			const isMismatch =
				columnOrder[0] !== "actions" || columnOrder[1] !== "jobNumber";

			if (newColumns.length > 0 || isMismatch) {
				const baseOrder = isMismatch
					? [
							"actions",
							"jobNumber",
							...columnOrder.filter(
								(id) => id !== "actions" && id !== "jobNumber",
							),
						]
					: columnOrder;
				setColumnOrder([...baseOrder, ...newColumns]);
			}
		}
	}, [hasHydrated, columnOrder, columns, setColumnOrder]);

	// Keep detailsRow in sync with latest data from query
	useEffect(() => {
		if (detailsOpen && detailsRow?.id && data) {
			const updatedRow = data.find((r: any) => r.id === detailsRow.id);
			if (updatedRow && updatedRow !== detailsRow) {
				setDetailsRow(updatedRow);
			}
		}
	}, [data, detailsOpen, detailsRow]);

	// Filter column definition list for the advanced filter popover
	const filterableColumns = useMemo(() => {
		const mainCols = columns
			.filter((col) => col.id !== "actions")
			.map((col) => {
				const key = col.id as keyof typeof TRUCKING_FOLLOWUP_LABELS;
				return {
					accessorKey: col.id as string,
					header: TRUCKING_FOLLOWUP_LABELS[key] || (col.id as string),
				};
			});

		return mainCols;
	}, [columns]);

	const table = useReactTable({
		data: data || [],
		columns,
		getRowId: (row) => row.id,
		state: {
			columnOrder,
			columnVisibility,
			columnPinning,
			columnSizing,
			sorting,
			globalFilter,
			pagination,
			rowSelection,
		},
		enableRowSelection: true,
		onRowSelectionChange: setRowSelection,
		onPaginationChange: onPaginationChange,
		onColumnOrderChange: setColumnOrder,
		onColumnVisibilityChange: setColumnVisibility,
		onColumnPinningChange: setColumnPinning,
		onColumnSizingChange: setColumnSizing,
		onSortingChange: setSorting as any,
		onGlobalFilterChange: setGlobalFilter,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		enableColumnResizing: true,
		columnResizeMode: "onChange",
		enableColumnPinning: true,
		manualPagination: true,
		rowCount: paginationMeta.total,
		meta: {
			activeRowTabs,
			onSubTabClick: (rowId: string, tab: string) => {
				setActiveRowTab(rowId, tab);
			},
			onViewDetails: (rowData: TruckingFollowUpRow) => {
				setDetailsRow(rowData);
				setDetailsOpen(true);
			},
			onDeleteTransaction: (rowData: TruckingFollowUpRow) => {
				setDeleteFollowUp(rowData);
				setDeleteDialogOpen(true);
			},
			// Mail preview — managed at table level to survive auto-refresh
			onComposeMail: (drafts: MailDraft[]) => {
				setMailDrafts(drafts);
			},
			onOpenContainerInfoMail: (rowData: TruckingFollowUpRow) => {
				setContainerInfoMailRow(rowData);
			},
			updateData: (rowId: string, columnId: string, value: unknown) => {
				if (isReadOnly) return; // Block edits for Accounting (view-only)
				updateTruckingFollowUp({ id: rowId, field: columnId, value });
			},
			dependencies: {
				serviceModes: serviceModes,
				siteUsers: siteUsersRaw,
				vendors: vendors,
				pickOrLiftPlaces: pickOrLiftPlaces,
				ops: ops,
				airports: airports,
				truckTypes: truckTypes,
				shippingLines: shippingLines,
				partners: partners,
				destinationPorts: destinationPorts,
				transitPorts: transitPorts,
			},
			onBulkAction: async (action: string) => {
				const selectedRows = table.getSelectedRowModel().rows;

				if (selectedRows.length === 0) {
					toast.error("No rows selected");
					return;
				}

				// Combine Job: open confirmation dialog, keeper = the row whose action was clicked
				if (action === TRUCKING_BULK_ACTIONS.COMBINE_JOB) {
					if (selectedRows.length < 2) {
						toast.error("Vui lòng chọn ít nhất 2 job để gộp");
						return;
					}
					setCombineRows(selectedRows.map((r) => r.original));
					setCombineDialogOpen(true);
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

						// CLIENT-SIDE VALIDATION using trucking validation
						const validationErrors = validateTruckingFollowUpForBotAction(
							row.original,
							action as TruckingBotActionType,
						);

						if (validationErrors.length > 0) {
							failedCount++;
							errors.push(
								`${jobNumber}: ${formatValidationErrors(validationErrors)}`,
							);
							continue;
						}

						// PROCEED WITH ACTION using trucking API endpoint
						try {
							if (action === TRUCKING_BOT_ACTIONS.FAST_UNFINISH) {
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

							const endpoint = "/api/trucking-followup/create-invoker-job";

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

					// Clear selection and refresh data
					table.resetRowSelection();
					refetch();
				} catch (error) {
					console.error("Bulk action error:", error);
					toast.error("Failed to execute bulk action");
				}
			},
		},
	});

	if (!hasHydrated) return null;

	return (
		<div className="flex flex-col max-h-full gap-4">
			<TruckingDataTableToolbar
				columns={filterableColumns}
				onGlobalFilterChange={setGlobalFilter}
				onRefresh={handleRefresh}
				isRefreshing={isFetching}
				onColumnManageClick={() => setColumnManageOpen(true)}
				onAddRecordClick={
					isReadOnly ? undefined : () => setAddRecordDialogOpen(true)
				}
				onExport={handleExport}
				dateRange={dateRange}
				onDateRangeChange={setDateRange}
				advancedFilters={advancedFilters}
				onApplyFilters={setAdvancedFilters}
				hideOthersTasks={hideOthersTasks}
				onHideOthersTasksChange={setHideOthersTasks}
				serviceModeFilter={serviceModeFilter}
				onServiceModeFilterChange={setServiceModeFilter}
				siteUsers={siteUsersRaw}
				vendors={vendors}
				ops={opsRaw}
			/>
			<TruckingDataTableContent
				table={table as any}
				isLoading={isLoading}
				isFetching={isFetching}
				activeRowTabs={activeRowTabs}
				isAccountingUser={isReadOnly}
			/>
			<DataTablePagination
				table={table as any}
				pagination={pagination}
				paginationMeta={paginationMeta}
			/>

			<ColumnManageDialog
				table={table as any}
				open={columnManageOpen}
				onOpenChange={setColumnManageOpen}
				columnHeaders={TRUCKING_FOLLOWUP_HEADERS}
			/>

			<TruckingFollowUpDetailsDialog
				row={detailsRow}
				open={detailsOpen}
				onOpenChange={setDetailsOpen}
				isRefreshing={isFetching}
			/>

			<AddRecordDialog
				open={addRecordDialogOpen}
				onOpenChange={setAddRecordDialogOpen}
				onAddRecord={handleAddRecord}
				mode="TRUCKING"
			/>

			{combineRows.length >= 2 && (
				<CombineJobsDialog
					open={combineDialogOpen}
					onOpenChange={setCombineDialogOpen}
					allRows={combineRows}
					isLoading={combineLoading}
					onConfirm={handleCombineConfirm}
				/>
			)}

			<DeleteTruckingTransactionDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				followUp={deleteFollowUp}
				onDeleteRecord={handleDeleteRecord}
			/>

			<MailPreviewDialog
				drafts={mailDrafts}
				onClose={() => setMailDrafts([])}
			/>

			<ContainerInfoMailDialog
				open={!!containerInfoMailRow}
				onOpenChange={(open) => {
					if (!open) setContainerInfoMailRow(null);
				}}
				row={containerInfoMailRow}
			/>
		</div>
	);
};
