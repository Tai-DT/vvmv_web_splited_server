"use client";

import type { Row, Table } from "@tanstack/react-table";
import {
	AlertTriangle,
	Box,
	Container,
	CreditCard,
	FileText,
	History,
	ListTodo,
	Mail,
	Play,
	Receipt,
	Trash2,
	Truck,
	X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
	type BadgeConfig,
	BaseActionDropdown,
	BaseActionsCell,
	type DropdownItemConfig,
} from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	formatValidationErrors,
	TRUCKING_BOT_ACTIONS,
	type TruckingBotActionType,
	validateTruckingFollowUpForBotAction,
} from "@/lib/validation/trucking-followup-validation";
import type { TruckingFollowUpRow } from "../../types";
import {
	type GmailThread,
	GmailThreadPicker,
} from "../dialogs/gmail-thread-picker";

const BOT_ACTIONS_LIST = [
	TRUCKING_BOT_ACTIONS.TRUCKING_INPUT,
	TRUCKING_BOT_ACTIONS.POD_MAKING,
	TRUCKING_BOT_ACTIONS.EPORT_DECLARATION,
	TRUCKING_BOT_ACTIONS.MAKING_CONTAINER_PACKING,
	TRUCKING_BOT_ACTIONS.REGISTER_VESSEL_DEPARTURE,
	// TRUCKING_BOT_ACTIONS.FAST_FINISH,
	TRUCKING_BOT_ACTIONS.FAST_UNFINISH,
] as const;

interface TruckingActionsCellProps {
	row: Row<TruckingFollowUpRow>;
	table: Table<TruckingFollowUpRow>;
	onRefresh?: () => void;
}

type TraTauConfirmDialogState = {
	title: string;
	message: string;
	details?: Array<{ label: string; value?: string | null }>;
	confirmText: string;
	cancelText?: string;
	hideCancel?: boolean;
};

type ComposeMailStep = "choice" | "thread-picker" | null;

/**
 * TruckingActionsCell Component
 *
 * Renders the primary action column in the TruckingFollowUp table.
 * - Displays status badges for sub-data (Containers, Declarations, FCRs)
 * - Handles row expansion
 * - Integrates action dropdown for row-level actions
 */
export const TruckingActionsCell = ({
	row,
	table,
	onRefresh,
}: TruckingActionsCellProps) => {
	const { declarations, containers, fcrs, invokerTasks } = row.original;
	const dCount = declarations?.length || 0;
	const cCount = containers?.length || 0;
	const fcrCount = fcrs?.length || 0;
	const tCount = invokerTasks?.length || 0;
	const vendorCostCount = (fcrs || []).reduce(
		(sum, fcr) => sum + (fcr.vendorCosts?.length || 0),
		0,
	);
	const activityCount = row.original._count?.activityLogs || 0;
	const paymentCount =
		row.original._count?.paymentRequests ||
		row.original.paymentRequests?.length ||
		0;
	const [isLoading, setIsLoading] = useState(false);
	const jobNumber = row.original.jobNumber;
	const _isExportOperation =
		(row.original.operationType || "").toUpperCase() === "XUAT";
	const botActions = BOT_ACTIONS_LIST;
	const [confirmDialog, setConfirmDialog] =
		useState<TraTauConfirmDialogState | null>(null);
	const [composeMailStep, setComposeMailStep] = useState<ComposeMailStep>(null);
	const confirmResolverRef = useRef<((result: boolean) => void) | null>(null);

	const _openConfirmDialog = (state: TraTauConfirmDialogState) => {
		return new Promise<boolean>((resolve) => {
			confirmResolverRef.current = resolve;
			setConfirmDialog(state);
		});
	};

	const closeConfirmDialog = (result: boolean) => {
		setConfirmDialog(null);
		if (confirmResolverRef.current) {
			confirmResolverRef.current(result);
			confirmResolverRef.current = null;
		}
	};

	const handleComposeMail = async (selectedThread?: GmailThread | null) => {
		if (!jobNumber) {
			toast.error("Cannot compose mail: No job number found");
			return;
		}

		setIsLoading(true);
		const toastId = toast.loading("Đang tạo email...");
		try {
			const res = await fetch("/api/trucking-followup/compose-mail", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ jobNumber }),
			});
			const result = await res.json();

			toast.dismiss(toastId);

			// 422 = validation: one or more FCRs are missing required info
			if (res.status === 422) {
				const errors: string[] = result.errors ?? [];
				toast.error("FCR chưa đủ thông tin — không thể tạo mail", {
					description: errors.length ? errors.join("\n") : result.message,
					duration: Infinity,
				});
				return;
			}

			if (!res.ok) {
				throw new Error(result.message || "Failed to generate mail link");
			}

			if (result.emailsFound === 0) {
				toast.warning("Không tìm thấy người nhận cho email này.");
				return;
			}

			// Delegate to table-level handler (survives 30s auto-refresh)
			if (result.drafts?.length) {
				const drafts = selectedThread
					? result.drafts.map((draft: any) => ({
							...draft,
							subject: selectedThread.subject,
							replyThread: {
								threadId: selectedThread.threadId,
								inReplyTo: selectedThread.inReplyTo,
								references: selectedThread.references,
							},
						}))
					: result.drafts;
				table.options.meta?.onComposeMail?.(drafts);
			}
		} catch (error: any) {
			toast.dismiss(toastId);
			toast.error("Lỗi khi tạo email", { description: error.message });
		} finally {
			setIsLoading(false);
		}
	};

	const handleComposeMailWithChoice = () => {
		setComposeMailStep("choice");
	};

	const handleComposeWithoutThread = async () => {
		setComposeMailStep(null);
		await handleComposeMail();
	};

	const handleSelectComposeThread = async (thread: GmailThread) => {
		setComposeMailStep(null);
		await handleComposeMail(thread);
	};

	const handleActionClick = async (action: string) => {
		if (!jobNumber) {
			toast.error("Cannot create job: No job number found");
			return;
		}

		// 1. CLIENT-SIDE VALIDATION (quick checks)
		const validationErrors = validateTruckingFollowUpForBotAction(
			row.original,
			action as TruckingBotActionType,
		);

		if (validationErrors.length > 0) {
			toast.error("Cannot execute action", {
				description: formatValidationErrors(validationErrors),
				duration: Infinity,
			});
			return;
		}

		// 1b. INVOICE CHECK — block Trucking Input if already invoiced
		if (action === TRUCKING_BOT_ACTIONS.TRUCKING_INPUT) {
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
				toast.error("Không thể kiểm tra trạng thái hóa đơn ERP", {
					description: "Vui lòng thử lại hoặc liên hệ IT.",
					duration: Infinity,
				});
				return;
			}

			// 1c. PLATE NUMBER CHECK — validate and auto-register FCR plate numbers
			const fcrs = row.original.fcrs || [];

			// Validate: check for FCRs with empty plateNumber first
			const fcrsWithoutPlate = fcrs.filter((fcr) => !fcr.plateNumber?.trim());
			if (fcrsWithoutPlate.length > 0) {
				const fcrList = fcrsWithoutPlate
					.map((fcr) => fcr.fcrNumber || fcr.id)
					.join(", ");
				toast.error("FCR chưa có biển số xe — không thể chạy Trucking Input", {
					description: `${fcrsWithoutPlate.length} FCR chưa điền biển số: ${fcrList}`,
					duration: Infinity,
				});
				return;
			}

			// Build a map: raw plateNumber → list of FCR IDs that carry it
			const plateToFcrIds = new Map<string, string[]>();
			for (const fcr of fcrs) {
				const p = fcr.plateNumber?.trim().toUpperCase();
				if (!p) continue;
				if (!plateToFcrIds.has(p)) plateToFcrIds.set(p, []);
				plateToFcrIds.get(p)?.push(fcr.id);
			}

			if (plateToFcrIds.size > 0) {
				const plateErrors: string[] = [];
				const plateCreated: string[] = [];

				setIsLoading(true);
				try {
					for (const [plate, fcrIds] of plateToFcrIds.entries()) {
						const res = await fetch("/api/dispatch/check-plate", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ plateNumber: plate, fcrIds }),
						});
						const result = await res.json();

						if (res.status === 422 || !result.ok) {
							plateErrors.push(
								result.message || `Biển số "${plate}" không hợp lệ`,
							);
						} else if (result.created) {
							plateCreated.push(result.normalized || plate);
						}
					}
				} finally {
					setIsLoading(false);
				}

				if (plateErrors.length > 0) {
					toast.error(
						"Biển số xe không hợp lệ — không thể chạy Trucking Input",
						{
							description: plateErrors.join("\n"),
							duration: Infinity,
						},
					);
					return;
				}

				if (plateCreated.length > 0) {
					toast.info(
						`Đã tự động đăng ký ${plateCreated.length} biển số mới: ${plateCreated.join(", ")}`,
					);
				}
			}
		}

		// 4. PROCEED WITH ACTION
		setIsLoading(true);
		try {
			// FAST Finish Trucking: dedicated endpoint with real-time result
			if (action === TRUCKING_BOT_ACTIONS.FAST_FINISH) {
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

				// Refresh the table to reflect updated status
				if (onRefresh) {
					onRefresh();
				} else if (table.options.meta?.refreshData) {
					table.options.meta.refreshData();
				}
				return;
			}

			// FAST Un-Finish: dedicated endpoint, resets isFinished in ERP + local DB
			if (action === TRUCKING_BOT_ACTIONS.FAST_UNFINISH) {
				const response = await fetch("/api/trucking-followup/fast-unfinish", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ jobNumber }),
				});

				const result = await response.json();

				if (result.success) {
					toast.success(`FAST Un-Finish: Thành công`, {
						description: result.message || "Job un-finished successfully",
					});
				} else {
					toast.error(`FAST Un-Finish: Lỗi`, {
						description: result.message || "Unknown error",
						duration: Infinity,
					});
				}

				if (onRefresh) {
					onRefresh();
				} else if (table.options.meta?.refreshData) {
					table.options.meta.refreshData();
				}
				return;
			}

			const endpoint = "/api/trucking-followup/create-invoker-job";

			const response = await fetch(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ taskName: action, jobNumber }),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || "Failed to create invoker job");
			}

			await response.json(); // Consume response

			toast.success(`Job created: ${action}`);

			// Refresh the table
			if (onRefresh) {
				onRefresh();
			} else if (table.options.meta?.refreshData) {
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

	// Define badge configurations
	// ... (lines 122-163 kept as is) ...
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
			icon: Truck,
			count: fcrCount,
			tabId: "fcr",
			label: "FCRs",
			colorClasses:
				"bg-blue-500/5 text-blue-600 border-blue-200 dark:border-blue-900/50 hover:bg-blue-500/10",
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
			icon: FileText,
			count: dCount,
			tabId: "declarations",
			label: "Declarations",
			colorClasses:
				"bg-emerald-500/5 text-emerald-600 border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-500/10",
		},
		{
			icon: Receipt,
			count: vendorCostCount,
			tabId: "vendor-costs",
			label: "Vendor Costs",
			colorClasses:
				"bg-orange-500/5 text-orange-600 border-orange-200 dark:border-orange-900/50 hover:bg-orange-500/10",
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
		{
			key: "bot-actions",
			label: "Bot Actions",
			icon: Play,
			disabled: isLoading,
			actions: botActions.map((action) => ({
				key: action,
				label: action,
				onClick: () => handleActionClick(action),
				disabled: isLoading,
			})),
		},
		{ type: "separator" as const, key: "sep-mail" },
		{
			key: "compose-mail",
			label: "Gửi Mail Vendor & Ops",
			icon: Mail,
			onClick: handleComposeMailWithChoice,
			disabled: isLoading || fcrCount === 0,
			className: "text-blue-600 dark:text-blue-400",
		},
		{
			key: "container-info-mail",
			label: "Gửi Mail Container",
			icon: Container,
			onClick: () =>
				table.options.meta?.onOpenContainerInfoMail?.(row.original),
			disabled: isLoading || cCount === 0,
			className: "text-teal-600 dark:text-teal-400",
		},
		// Separator
		{ type: "separator", key: "sep1" },
		// Delete
		{
			key: "delete",
			label: "Delete",
			icon: Trash2,
			onClick: () => {
				if (table.options.meta?.onDeleteTransaction) {
					table.options.meta.onDeleteTransaction(row.original);
				}
			},
			disabled: isLoading || !table.options.meta?.onDeleteTransaction,
			className: "text-red-700",
		},
	];

	return (
		<>
			<BaseActionsCell
				row={row}
				table={table}
				badges={badges}
				actionsDropdown={
					<BaseActionDropdown items={dropdownItems} isLoading={isLoading} />
				}
			/>

			<Dialog
				open={!!confirmDialog}
				onOpenChange={(open) => {
					if (!open && confirmDialog) {
						closeConfirmDialog(false);
					}
				}}
			>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<AlertTriangle className="h-5 w-5 text-amber-500" />
							{confirmDialog?.title}
						</DialogTitle>
						<DialogDescription className="pt-1 whitespace-pre-line">
							{confirmDialog?.message}
						</DialogDescription>
					</DialogHeader>

					{!!confirmDialog?.details?.length && (
						<div className="space-y-1.5 rounded border bg-slate-50 dark:bg-slate-900 p-3 text-xs">
							{confirmDialog.details.map((item) => (
								<div key={item.label} className="flex gap-2">
									<span className="text-muted-foreground w-24 shrink-0">
										{item.label}:
									</span>
									<span className="font-medium break-all">
										{item.value || "-"}
									</span>
								</div>
							))}
						</div>
					)}

					<DialogFooter className="gap-2 sm:gap-0">
						{!confirmDialog?.hideCancel && (
							<Button
								variant="outline"
								onClick={() => closeConfirmDialog(false)}
							>
								{confirmDialog?.cancelText || "Hủy"}
							</Button>
						)}
						<Button onClick={() => closeConfirmDialog(true)}>
							{confirmDialog?.confirmText || "Xác nhận"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={composeMailStep === "choice"}
				onOpenChange={(open) => {
					if (!open) setComposeMailStep(null);
				}}
			>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Chọn luồng email</DialogTitle>
						<DialogDescription>
							Bạn muốn gửi mail mới như hiện tại hay gắn mail này vào một luồng
							Gmail đã có sẵn?
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button variant="outline" onClick={handleComposeWithoutThread}>
							No, tạo mail mới
						</Button>
						<Button onClick={() => setComposeMailStep("thread-picker")}>
							Yes, chọn mail cũ
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={composeMailStep === "thread-picker"}
				onOpenChange={(open) => {
					if (!open) setComposeMailStep(null);
				}}
			>
				<DialogContent className="p-0 max-w-[640px] max-h-[90dvh] flex flex-col gap-0 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl shadow-xl overflow-hidden [&>button]:hidden">
					<div className="flex flex-col flex-1 min-h-0">
						<div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
							<div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600">
								<Mail className="size-4 text-white" />
							</div>
							<div className="flex-1">
								<p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
									Chọn mail cũ để nối luồng
								</p>
								<p className="text-[11px] text-slate-400">
									Sau khi chọn, mail mới vẫn giữ body và người nhận như hiện
									tại, chỉ dùng tiêu đề và thread của mail cũ.
								</p>
							</div>
							<button
								onClick={() => setComposeMailStep(null)}
								className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
							>
								<X className="size-4" />
							</button>
						</div>

						<div className="px-5 py-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
							<button
								type="button"
								onClick={() => setComposeMailStep("choice")}
								className="text-[11px] font-medium text-slate-500 hover:text-blue-600 transition-colors"
							>
								Quay lại
							</button>
						</div>

						<GmailThreadPicker onSelect={handleSelectComposeThread} />
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
};
