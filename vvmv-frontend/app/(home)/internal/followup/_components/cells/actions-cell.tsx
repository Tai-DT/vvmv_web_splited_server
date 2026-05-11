"use client";

import type { Row, Table } from "@tanstack/react-table";
import {
	Box,
	ClipboardList,
	CreditCard,
	FileSpreadsheet,
	FileText,
	History,
	List,
	ListTodo,
	Package,
	Play,
	RefreshCw,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	type BadgeConfig,
	BaseActionDropdown,
	BaseActionsCell,
	type DropdownItemConfig,
} from "@/components/shared/data-table";
import {
	BOT_ACTIONS,
	type BotActionType,
	formatValidationErrors,
	validateFollowUpForBotAction,
} from "@/lib/validation/followup-validation";
import type { FollowUpRow } from "../../types";
import { useCellTabIndex } from "./use-cell-tab-index";

const BOT_ACTIONS_LIST = [
	BOT_ACTIONS.FAST_INPUT,
	BOT_ACTIONS.DRAFT_CDS,
	BOT_ACTIONS.FAST_CDS,
	BOT_ACTIONS.FAST_CO,
	BOT_ACTIONS.TRUCKING_REQUEST,
	BOT_ACTIONS.CSHT_REQUEST,
	BOT_ACTIONS.TAX_REQUEST,
	BOT_ACTIONS.LPHQ_REQUEST,
	BOT_ACTIONS.CHECK_QUA_KVGS,
	BOT_ACTIONS.CHECK_CDS_ATTACHMENT,
	BOT_ACTIONS.FAST_FINISH,
	BOT_ACTIONS.FAST_UNFINISH,
] as const;

interface ActionsCellProps {
	row: Row<FollowUpRow>;
	table: Table<FollowUpRow>;
}

/**
 * ActionsCell Component
 *
 * Renders the primary action column in the FollowUp table.
 * - Displays status badges for sub-data (Tasks, Containers, Declarations, CO)
 * - Handles row expansion and sub-tab selection via badges
 * - Integrates the action dropdown for row-level actions
 */
export const ActionsCell = ({ row, table }: ActionsCellProps) => {
	const { declarations, invokerTasks, containers, cerOfOrigins } = row.original;
	const dCount = declarations?.length || 0;
	const tCount = invokerTasks?.length || 0;
	const cCount = containers?.length || 0;
	const coCount = cerOfOrigins?.length || 0;
	const cargoCount = row.original._count?.cargoLists || 0;
	const activityCount = row.original._count?.activityLogs || 0;
	const paymentCount =
		row.original._count?.paymentRequests ||
		row.original.paymentRequests?.length ||
		0;
	const [isLoading, setIsLoading] = useState(false);
	const jobNumber = row.original.jobNumber;

	// Calculate tabIndex based on visual column order
	const tabIndex = useCellTabIndex(table, row.original.id, "actions");

	// Handler for bot actions
	const handleActionClick = async (action: string) => {
		if (!jobNumber) {
			toast.error("Cannot create job: No job number found");
			return;
		}

		// 1. CLIENT-SIDE VALIDATION (quick checks)
		const validationErrors = validateFollowUpForBotAction(
			row.original,
			action as BotActionType,
		);

		if (validationErrors.length > 0) {
			toast.error("Cannot execute action", {
				description: formatValidationErrors(validationErrors),
				duration: Infinity,
			});
			return;
		}

		// 1b. INVOICE CHECK — block FAST Input / FAST CDS / FAST CO if already invoiced
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
					toast.error("Không thể thực hiện: Đã xuất hóa đơn thu khách", {
						description: `Job ${jobNumber} đã có ${invoiceData.totalCount} phí xuất hóa đơn. Liên hệ kế toán nếu cần điều chỉnh.`,
						duration: Infinity,
					});
					return;
				}
			} catch {
				toast.error("Không thể kiểm tra trạng thái hóa đơn FAST", {
					description: "Vui lòng thử lại hoặc liên hệ IT.",
					duration: Infinity,
				});
				return;
			}
		}

		// 2. SERVER-SIDE VALIDATION FOR FAST CDS (check Google Drive)
		if (action === BOT_ACTIONS.FAST_CDS) {
			try {
				const fileCheckResponse = await fetch(
					"/api/followup/check-declaration-files",
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ driveUrl: row.original.driveUrl }),
					},
				);

				const fileCheckResult = await fileCheckResponse.json();

				if (!fileCheckResult.hasValidFiles) {
					toast.error("Missing required declaration files", {
						description: `TO KHAI THONG QUAN folder must contain at least one Excel (.xlsx/.xls) or PDF (.pdf) file.\n\nMissing: ${fileCheckResult.missingFileTypes.join(", ")}`,
						duration: Infinity,
					});
					return;
				}
			} catch (error) {
				toast.error("Failed to check declaration files", {
					description: error instanceof Error ? error.message : "Unknown error",
					duration: Infinity,
				});
				return;
			}
		}

		// 3. SERVER-SIDE VALIDATION FOR CSHT REQUEST (check Google Drive)
		if (action === BOT_ACTIONS.CSHT_REQUEST) {
			try {
				const fileCheckResponse = await fetch(
					"/api/followup/check-csht-files",
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ driveUrl: row.original.driveUrl }),
					},
				);

				const fileCheckResult = await fileCheckResponse.json();

				if (!fileCheckResult.hasValidFiles) {
					toast.error("Missing required CSHT files", {
						description: `TO KHAI THONG QUAN folder must contain at least one PDF file with "CSHT" or "csht" in the name.\n\nMissing: ${fileCheckResult.missingFileTypes.join(", ")}`,
						duration: Infinity,
					});
					return;
				}
			} catch (error) {
				toast.error("Failed to check CSHT files", {
					description: error instanceof Error ? error.message : "Unknown error",
					duration: Infinity,
				});
				return;
			}
		}

		// SERVER-SIDE VALIDATION FOR TAX REQUEST (check Google Drive)
		if (action === BOT_ACTIONS.TAX_REQUEST) {
			try {
				const fileCheckResponse = await fetch("/api/followup/check-tax-files", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ driveUrl: row.original.driveUrl }),
				});

				const fileCheckResult = await fileCheckResponse.json();

				if (!fileCheckResult.hasValidFiles) {
					toast.error("Missing required TAX files", {
						description: `TO KHAI THONG QUAN folder must contain at least one Excel file (.xls/.xlsx) with "thue" or "THUE" in the name.\n\nMissing: ${fileCheckResult.missingFileTypes.join(", ")}`,
						duration: Infinity,
					});
					return;
				}
			} catch (error) {
				toast.error("Failed to check TAX files", {
					description: error instanceof Error ? error.message : "Unknown error",
					duration: Infinity,
				});
				return;
			}
		}

		// SERVER-SIDE VALIDATION FOR LPHQ REQUEST (check Google Drive)
		if (action === BOT_ACTIONS.LPHQ_REQUEST) {
			try {
				const fileCheckResponse = await fetch(
					"/api/followup/check-lphq-files",
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ driveUrl: row.original.driveUrl }),
					},
				);

				const fileCheckResult = await fileCheckResponse.json();

				if (!fileCheckResult.hasValidFiles) {
					toast.error("Missing required LPHQ files", {
						description: `TO KHAI THONG QUAN folder must contain at least one Excel file (.xls/.xlsx) with "lphq" or "LPHQ" in the name.\n\nMissing: ${fileCheckResult.missingFileTypes.join(", ")}`,
						duration: Infinity,
					});
					return;
				}
			} catch (error) {
				toast.error("Failed to check LPHQ files", {
					description: error instanceof Error ? error.message : "Unknown error",
					duration: Infinity,
				});
				return;
			}
		}

		// 4. PROCEED WITH ACTION
		setIsLoading(true);
		try {
			// FAST Finish Logistic: dedicated endpoint with real-time result
			if (action === BOT_ACTIONS.FAST_FINISH) {
				const response = await fetch("/api/followup/fast-finish-logistic", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ jobNumber }),
				});

				const result = await response.json();

				if (result.success) {
					toast.success(`FAST Finish: Thành công`, {
						description: result.message || "Shipment finished successfully",
					});
				} else {
					toast.error(`FAST Finish: Lỗi`, {
						description: result.message || "Unknown error",
						duration: Infinity,
					});
				}

				// Refresh the table to reflect updated invoker status
				if (table.options.meta?.refreshData) {
					table.options.meta.refreshData();
				}
				return;
			}

			// FAST Un-Finish Logistic: calls trucking fast-unfinish API
			if (action === BOT_ACTIONS.FAST_UNFINISH) {
				const response = await fetch("/api/trucking-followup/fast-unfinish", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ jobNumber }),
				});

				const result = await response.json();

				if (result.success) {
					toast.success(`FAST Un-Finish: Thành công`, {
						description: result.message || "Shipment un-finished successfully",
					});
				} else {
					toast.error(`FAST Un-Finish: Lỗi`, {
						description: result.message || "Unknown error",
						duration: Infinity,
					});
				}

				// Refresh the table to reflect updated invoker status
				if (table.options.meta?.refreshData) {
					table.options.meta.refreshData();
				}
				return;
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
				throw new Error(error.message || "Failed to create invoker job");
			}

			const result = await response.json();

			const isRealTimeAction =
				action === BOT_ACTIONS.CHECK_QUA_KVGS ||
				action === BOT_ACTIONS.CHECK_CDS_ATTACHMENT;

			if (isRealTimeAction && result.results) {
				// Show detailed toast for each declaration result
				result.results.forEach((res: any) => {
					if (res.status === "Success") {
						toast.success(`Dec ${res.declarationNumber}: Success`, {
							description:
								res.message +
								(res.kvgsDate ? ` (${res.kvgsDate})` : "") +
								(res.attachDocuments ? ` [${res.attachDocuments}]` : ""),
						});
					} else if (res.status === "Error") {
						toast.error(`Dec ${res.declarationNumber}: Error`, {
							description: res.message,
							duration: 5000,
						});
					} else {
						// Status: Info or Skipping
						toast.info(`Dec ${res.declarationNumber}: ${res.status}`, {
							description: res.message,
							duration: 5000,
						});
					}
				});
			} else {
				toast.success(`Job created: ${action}`);
			}

			// Refresh the table
			if (table.options.meta?.refreshData) {
				table.options.meta.refreshData();
			}
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to create job",
				{
					duration: Infinity,
				},
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleRerunTransaction = () => {
		if (table.options.meta?.onRerunTransaction) {
			table.options.meta.onRerunTransaction(row.original);
		}
	};

	const handleCreateContainer = () => {
		if (table.options.meta?.onCreateContainer) {
			table.options.meta.onCreateContainer(row.original);
		}
	};

	const handleDeleteTransaction = () => {
		if (table.options.meta?.onDeleteTransation) {
			table.options.meta.onDeleteTransation(row.original);
		}
	};

	// Define badge configurations
	const badges: BadgeConfig[] = [
		{
			icon: ListTodo,
			count: tCount,
			tabId: "tasks",
			label: "Tasks",
			colorClasses:
				"bg-purple-500/5 text-purple-600 border-purple-200 dark:border-purple-900/50 hover:bg-purple-500/10",
		},
		{
			icon: Box,
			count: cCount,
			tabId: "containers",
			label: "Containers",
			colorClasses:
				"bg-amber-500/5 text-amber-600 border-amber-200 dark:border-amber-900/50 hover:bg-amber-500/10",
		},
		{
			icon: ClipboardList,
			count: dCount,
			tabId: "declarations",
			label: "Declarations",
			colorClasses:
				"bg-emerald-500/5 text-emerald-600 border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-500/10",
		},
		{
			icon: FileText,
			count: coCount,
			tabId: "co",
			label: "Cer Of Origin",
			colorClasses:
				"bg-purple-500/5 text-purple-600 border-purple-200 dark:border-purple-900/50 hover:bg-purple-500/10",
		},
		{
			icon: List,
			count: cargoCount,
			tabId: "cargo",
			label: "Cargo List",
			colorClasses:
				"bg-slate-500/5 text-slate-600 border-slate-200 dark:border-slate-900/50 hover:bg-slate-100",
		},
		{
			icon: FileSpreadsheet,
			count: 0,
			tabId: "cdsInfo",
			label: "CDS Info",
			colorClasses:
				"bg-cyan-500/5 text-cyan-700 border-cyan-200 dark:border-cyan-900/50 hover:bg-cyan-500/10",
			alwaysVisible: true,
			hideCount: true,
			ariaLabel: "Open CDS Info",
		},
		{
			icon: CreditCard,
			count: paymentCount,
			tabId: "payment",
			label: "Payment",
			colorClasses:
				"bg-teal-500/5 text-teal-600 border-teal-200 dark:border-teal-900/50 hover:bg-teal-500/10",
		},
		{
			icon: History,
			count: activityCount,
			tabId: "activity",
			label: "Activity Log",
			colorClasses:
				"bg-slate-500/5 text-slate-600 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800",
		},
	];

	// Configure dropdown items using BaseActionDropdown
	const dropdownItems: DropdownItemConfig[] = [
		// Create Actions Submenu
		{
			key: "create-actions",
			label: "Create Actions",
			icon: Play,
			disabled: isLoading,
			actions: BOT_ACTIONS_LIST.map((action) => ({
				key: action,
				label: action,
				onClick: () => handleActionClick(action),
				disabled: isLoading,
			})),
		},
		// Separator
		{ type: "separator", key: "sep1" },
		// Duplicate Transaction
		{
			key: "duplicate",
			label: "Duplicate Transaction",
			icon: RefreshCw,
			onClick: handleRerunTransaction,
			disabled: isLoading || !table.options.meta?.onRerunTransaction,
		},
		// Add Containers
		{
			key: "add-containers",
			label: "Add Containers",
			icon: Package,
			onClick: handleCreateContainer,
			disabled: isLoading || !table.options.meta?.onCreateContainer,
		},
		// Delete
		{
			key: "delete",
			label: "Delete",
			icon: Trash2,
			onClick: handleDeleteTransaction,
			disabled: isLoading || !table.options.meta?.onDeleteTransation,
			className: "text-red-700",
		},
	];

	return (
		<BaseActionsCell
			row={row}
			table={table}
			badges={badges}
			tabIndex={tabIndex}
			actionsDropdown={
				<BaseActionDropdown items={dropdownItems} isLoading={isLoading} />
			}
		/>
	);
};
