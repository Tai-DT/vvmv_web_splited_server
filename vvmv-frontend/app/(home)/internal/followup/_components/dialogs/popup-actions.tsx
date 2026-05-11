"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileSearch, Loader2, Play } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	BOT_ACTIONS,
	type BotActionType,
	formatValidationErrors,
	validateFollowUpForBotAction,
} from "@/lib/validation/followup-validation";
import type { FollowUpRow } from "../../types";

interface DeclarationActionsProps {
	row: FollowUpRow;
	disabled?: boolean;
}

/**
 * Actions for Declarations tab in popup
 * - Check qua KVGS (Check thông quan)
 * - Check CDS Attachment (Check file đính kèm)
 */
export function DeclarationActions({ row, disabled }: DeclarationActionsProps) {
	const [loadingAction, setLoadingAction] = useState<string | null>(null);
	const queryClient = useQueryClient();

	const handleAction = async (action: BotActionType) => {
		if (!row.jobNumber) {
			toast.error("Cannot execute action: No job number found");
			return;
		}

		// Client-side validation
		const validationErrors = validateFollowUpForBotAction(row, action);
		if (validationErrors.length > 0) {
			toast.error("Cannot execute action", {
				description: formatValidationErrors(validationErrors),
				duration: 8000,
			});
			return;
		}

		setLoadingAction(action);
		try {
			let endpoint = "/api/followup/create-invoker-job";
			if (action === BOT_ACTIONS.CHECK_QUA_KVGS) {
				endpoint = "/api/followup/check-quan-kvgs";
			} else if (action === BOT_ACTIONS.CHECK_CDS_ATTACHMENT) {
				endpoint = "/api/followup/check-cds-attachment";
			}

			const response = await fetch(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ taskName: action, jobNumber: row.jobNumber }),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || "Failed to execute action");
			}

			const result = await response.json();

			// Show detailed toast for each declaration result
			if (result.results) {
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
						toast.info(`Dec ${res.declarationNumber}: ${res.status}`, {
							description: res.message,
							duration: 5000,
						});
					}
				});
			} else {
				toast.success(`Action executed: ${action}`);
			}

			// Refresh data
			queryClient.invalidateQueries({ queryKey: ["followups"] });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Action failed", {
				duration: 8000,
			});
		} finally {
			setLoadingAction(null);
		}
	};

	const isLoading = loadingAction !== null;

	return (
		<div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 p-4 bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
			<span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
				Quick Actions:
			</span>
			<Button
				size="sm"
				onClick={() => handleAction(BOT_ACTIONS.CHECK_QUA_KVGS)}
				disabled={disabled || isLoading}
				className="gap-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border border-emerald-300 shadow-sm sm:flex-1 sm:max-w-fit"
			>
				{loadingAction === BOT_ACTIONS.CHECK_QUA_KVGS ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					<CheckCircle2 className="size-4" />
				)}
				Check qua KVGS
			</Button>
			<Button
				size="sm"
				onClick={() => handleAction(BOT_ACTIONS.CHECK_CDS_ATTACHMENT)}
				disabled={disabled || isLoading}
				className="gap-2 bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-300 shadow-sm sm:flex-1 sm:max-w-fit"
			>
				{loadingAction === BOT_ACTIONS.CHECK_CDS_ATTACHMENT ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					<FileSearch className="size-4" />
				)}
				Check CDS Attachment
			</Button>
		</div>
	);
}

interface TaskActionsProps {
	row: FollowUpRow;
	disabled?: boolean;
}

const BOT_ACTIONS_LIST = [
	{
		action: BOT_ACTIONS.FAST_INPUT,
		label: "Fast Input",
		color:
			"bg-indigo-100 hover:bg-indigo-200 text-indigo-700 border-indigo-300",
	},
	{
		action: BOT_ACTIONS.DRAFT_CDS,
		label: "Draft CDS",
		color:
			"bg-purple-100 hover:bg-purple-200 text-purple-700 border-purple-300",
	},
	{
		action: BOT_ACTIONS.FAST_CDS,
		label: "Fast CDS",
		color:
			"bg-violet-100 hover:bg-violet-200 text-violet-700 border-violet-300",
	},
	{
		action: BOT_ACTIONS.FAST_CO,
		label: "Fast CO",
		color:
			"bg-fuchsia-100 hover:bg-fuchsia-200 text-fuchsia-700 border-fuchsia-300",
	},
	{
		action: BOT_ACTIONS.TRUCKING_REQUEST,
		label: "Trucking Request",
		color: "bg-amber-100 hover:bg-amber-200 text-amber-700 border-amber-300",
	},
	{
		action: BOT_ACTIONS.CSHT_REQUEST,
		label: "CSHT Request",
		color:
			"bg-orange-100 hover:bg-orange-200 text-orange-700 border-orange-300",
	},
	{
		action: BOT_ACTIONS.TAX_REQUEST,
		label: "Tax Request",
		color: "bg-rose-100 hover:bg-rose-200 text-rose-700 border-rose-300",
	},
	{
		action: BOT_ACTIONS.LPHQ_REQUEST,
		label: "LPHQ Request",
		color: "bg-pink-100 hover:bg-pink-200 text-pink-700 border-pink-300",
	},
	{
		action: BOT_ACTIONS.FAST_FINISH,
		label: "Fast Finish",
		color: "bg-teal-100 hover:bg-teal-200 text-teal-700 border-teal-300",
	},
] as const;

/**
 * Actions for Tasks tab in popup
 * - Bot actions like Fast Input, Draft CDS, Fast CDS, etc.
 */
export function TaskActions({ row, disabled }: TaskActionsProps) {
	const [loadingAction, setLoadingAction] = useState<string | null>(null);
	const queryClient = useQueryClient();

	const handleAction = async (action: BotActionType) => {
		if (!row.jobNumber) {
			toast.error("Cannot execute action: No job number found");
			return;
		}

		// Client-side validation
		const validationErrors = validateFollowUpForBotAction(row, action);
		if (validationErrors.length > 0) {
			toast.error("Cannot execute action", {
				description: formatValidationErrors(validationErrors),
				duration: 8000,
			});
			return;
		}

		// Invoice check — block FAST Input / FAST CDS / FAST CO if already invoiced
		const INVOICE_BLOCKED_ACTIONS = [
			BOT_ACTIONS.FAST_INPUT,
			BOT_ACTIONS.FAST_CDS,
			BOT_ACTIONS.FAST_CO,
		] as string[];
		if (INVOICE_BLOCKED_ACTIONS.includes(action)) {
			try {
				const invoiceRes = await fetch(
					`/api/erp/check-invoice?job=${encodeURIComponent(row.jobNumber)}`,
				);
				const invoiceData = await invoiceRes.json();
				if (invoiceData.hasInvoice) {
					toast.error("Không thể thực hiện: Đã xuất hóa đơn thu khách", {
						description: `Job ${row.jobNumber} đã có ${invoiceData.totalCount} hóa đơn. Liên hệ kế toán nếu cần điều chỉnh.`,
						duration: Infinity,
					});
					return;
				}
			} catch {
				toast.error("Không thể kiểm tra trạng thái hóa đơn ERP", {
					description: "Vui lòng thử lại hoặc liên hệ IT.",
					duration: Infinity,
				});
				return;
			}
		}

		// Server-side file checks for specific actions
		if (action === BOT_ACTIONS.FAST_CDS) {
			try {
				const fileCheckResponse = await fetch(
					"/api/followup/check-declaration-files",
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ driveUrl: row.driveUrl }),
					},
				);
				const fileCheckResult = await fileCheckResponse.json();
				if (!fileCheckResult.hasValidFiles) {
					toast.error("Missing required declaration files", {
						description: `TO KHAI THONG QUAN folder must contain at least one Excel (.xlsx/.xls) or PDF (.pdf) file.`,
						duration: 8000,
					});
					return;
				}
			} catch (_error) {
				toast.error("Failed to check declaration files");
				return;
			}
		}

		if (action === BOT_ACTIONS.CSHT_REQUEST) {
			try {
				const fileCheckResponse = await fetch(
					"/api/followup/check-csht-files",
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ driveUrl: row.driveUrl }),
					},
				);
				const fileCheckResult = await fileCheckResponse.json();
				if (!fileCheckResult.hasValidFiles) {
					toast.error("Missing required CSHT files", {
						description: `TO KHAI THONG QUAN folder must contain at least one PDF file with "CSHT" in the name.`,
						duration: 8000,
					});
					return;
				}
			} catch (_error) {
				toast.error("Failed to check CSHT files");
				return;
			}
		}

		setLoadingAction(action);
		try {
			const response = await fetch("/api/followup/create-invoker-job", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ taskName: action, jobNumber: row.jobNumber }),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || "Failed to create job");
			}

			toast.success(`Job created: ${action}`);
			queryClient.invalidateQueries({ queryKey: ["followups"] });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Action failed", {
				duration: 8000,
			});
		} finally {
			setLoadingAction(null);
		}
	};

	const isLoading = loadingAction !== null;

	return (
		<div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800 space-y-3">
			<div className="flex items-center gap-2">
				<Play className="size-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
				<span className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">
					Create Bot Actions:
				</span>
			</div>
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
				{BOT_ACTIONS_LIST.map(({ action, label, color }) => (
					<Button
						key={action}
						size="sm"
						onClick={() => handleAction(action)}
						disabled={disabled || isLoading}
						className={`gap-2 border shadow-sm ${color}`}
					>
						{loadingAction === action ? (
							<Loader2 className="size-4 animate-spin" />
						) : null}
						{label}
					</Button>
				))}
			</div>
		</div>
	);
}
