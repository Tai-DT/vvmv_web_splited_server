"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
	CreditCard,
	FileText,
	History,
	ListChecks,
	Loader2,
	Package,
	Save,
	Settings2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ActivityLogPanel } from "@/components/shared/activity-log-panel";
import { PaymentRequestPanel } from "@/components/shared/payment-request-panel";
import { Button } from "@/components/ui/button";
import type { FollowUp } from "@/prisma/client";
import { DeclarationsPanel } from "../../../trucking-followup/_components/panels/declarations-panel";
import type { FollowUpRow } from "../../types";
import { CargoListPanel } from "../panels/cargo-list-panel";
import { InformationPanelEditable } from "../panels/information-panel-editable";
import { InvokerTasksPanel } from "../panels/invoker-tasks-panel";
import { FOLLOWUP_LABELS } from "../table/column-labels";
import {
	BaseJobDetailsDialog,
	DialogFooter,
	type TabConfig,
} from "./base-job-details-dialog";
import { DeclarationActions, TaskActions } from "./popup-actions";

interface FollowUpDetailsDialogProps {
	row: FollowUpRow | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	isRefreshing?: boolean;
}

export function FollowUpDetailsDialog({
	row,
	open,
	onOpenChange,
	isRefreshing = false,
}: FollowUpDetailsDialogProps) {
	const [formData, setFormData] = useState<Partial<FollowUp>>({});
	const originalDataRef = useRef<Partial<FollowUp>>({});
	const isInitializedRef = useRef(false);
	const [isSaving, setIsSaving] = useState(false);
	const [handlerOpen, setHandlerOpen] = useState(false);
	const queryClient = useQueryClient();

	useEffect(() => {
		if (row && open && !isInitializedRef.current) {
			const data: any = {};
			Object.keys(row).forEach((key) => {
				const val = (row as any)[key];
				if (val instanceof Date) {
					data[key] = val.toISOString().slice(0, 10);
				} else if (
					val &&
					typeof val === "string" &&
					(key.toLowerCase().includes("date") ||
						key.toLowerCase().includes("time") ||
						key === "etaEtd" ||
						key === "shmtDate")
				) {
					try {
						const date = new Date(val);
						if (!Number.isNaN(date.getTime())) {
							data[key] = date.toISOString().slice(0, 10);
						} else {
							data[key] = val;
						}
					} catch (_e) {
						data[key] = val;
					}
				} else {
					data[key] = val ?? "";
				}
			});
			setFormData(data);
			originalDataRef.current = JSON.parse(JSON.stringify(data));
			isInitializedRef.current = true;
		}
		if (!open) {
			isInitializedRef.current = false;
		}
	}, [row, open]);

	const _hasChanges = useMemo(() => {
		const originalData = originalDataRef.current;
		if (Object.keys(originalData).length === 0) return false;

		const editableKeys = [
			"notes",
			"note2",
			"note3",
			"handler",
			"jobPriority",
			"serviceMode",
			"cargoType",
			"workType",
			"pol",
			"pod",
			"warehouse",
			"authority",
			"supervisionGate",
			"location",
			"pickupLocation",
			"loadingLocation",
			"transportMethod",
			"etaEtd",
			"shmtDate",
			"deliveryDate",
			"transportDate",
			"pickUpTime",
			"truckNumber",
			"quantity",
			"unit",
			"grossWeight",
			"cbm",
			"commodityName",
			"invoice",
			"billOrBooking",
			"taxService",
			"coNumber",
			"supplier",
			"poNumber",
		];

		for (const key of editableKeys) {
			const original = (originalData as any)[key];
			const current = (formData as any)[key];
			const normalizedOriginal =
				original === null || original === undefined ? "" : String(original);
			const normalizedCurrent =
				current === null || current === undefined ? "" : String(current);
			if (normalizedOriginal !== normalizedCurrent) {
				return true;
			}
		}
		return false;
	}, [formData]);

	const handleInputChange = (field: keyof FollowUp, value: any) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	const handleSave = async () => {
		if (!row) return;
		setIsSaving(true);

		try {
			const updatableFields = Object.keys(formData).filter((key) => {
				const val = (formData as any)[key];
				const oldVal = (row as any)[key];
				return (
					String(val) !== String(oldVal ?? "") &&
					key !== "id" &&
					key !== "createdAt" &&
					key !== "updatedAt" &&
					key !== "invokerTasks" &&
					key !== "declarations" &&
					key !== "containers" &&
					key !== "cerOfOrigins" &&
					key !== "cargoLists" &&
					!key.startsWith("_") // Exclude computed fields (e.g., _isFinished, _isDone)
				);
			});

			if (updatableFields.length === 0) {
				toast.info("No changes to save");
				return;
			}

			const promises = updatableFields.map((field) =>
				fetch("/api/followup/update", {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						id: row.id,
						field,
						value:
							(formData as any)[field] === "" ? null : (formData as any)[field],
					}),
				}),
			);

			const results = await Promise.all(promises);
			const errors = await Promise.all(
				results.filter((r) => !r.ok).map((r) => r.json()),
			);

			if (errors.length > 0) {
				throw new Error(
					`Failed to update some fields: ${errors.map((e) => e.message).join(", ")}`,
				);
			}

			toast.success("Record updated successfully");
			queryClient.invalidateQueries({ queryKey: ["followups"] });
			// Dialog stays open for continued editing
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to update record",
			);
		} finally {
			setIsSaving(false);
		}
	};

	if (!row) return null;

	const isRowReadOnly = row.canEdit === false;

	const tabs: TabConfig[] = [
		{
			value: "general",
			label: "Information",
			labelShort: "Info",
			icon: Settings2,
			content: (
				<InformationPanelEditable
					formData={formData}
					isReadOnly={isRowReadOnly}
					handlerOpen={handlerOpen}
					setHandlerOpen={setHandlerOpen}
					onFieldChange={handleInputChange}
				/>
			),
		},
		{
			value: "cargo-list",
			label: "Cargo List",
			labelShort: "Cargo",
			icon: Package,
			content: (
				<div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-2">
					<CargoListPanel
						followUpId={row.id}
						operationCode={row.cdsInfo?.operationCode ?? null}
						onRefresh={() =>
							queryClient.invalidateQueries({ queryKey: ["followups"] })
						}
					/>
				</div>
			),
			badge: row.cargoLists?.length || 0,
		},
		{
			value: "declarations",
			label: "Declarations",
			labelShort: "Decl",
			icon: FileText,
			content: (
				<div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
					<DeclarationActions row={row} disabled={isRowReadOnly} />
					<div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
						<DeclarationsPanel declarations={row.declarations || []} />
					</div>
				</div>
			),
			badge: row.declarations?.length || 0,
		},
		{
			value: "tasks",
			label: "Tasks",
			labelShort: "Tasks",
			icon: ListChecks,
			content: (
				<div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
					<TaskActions row={row} disabled={isRowReadOnly} />
					<div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
						{(row.invokerTasks?.length || 0) > 0 ? (
							<InvokerTasksPanel tasks={row.invokerTasks || []} />
						) : (
							<div className="p-8 text-center text-muted-foreground">
								No tasks found for this job.
							</div>
						)}
					</div>
				</div>
			),
			badge: row.invokerTasks?.length || 0,
		},
		{
			value: "payment",
			label: "Payment",
			labelShort: "Pay",
			icon: CreditCard,
			content: (
				<PaymentRequestPanel
					apiPath="/api/followup/payment-request"
					parentId={row.id}
					parentIdParam="followUpId"
				/>
			),
			badge: row.paymentRequests?.length || 0 || undefined,
		},
		{
			value: "activity",
			label: "Activity",
			labelShort: "Log",
			icon: History,
			content: (
				<ActivityLogPanel
					jobId={row.id}
					apiPath="/api/followup/activity-log"
					fieldLabels={FOLLOWUP_LABELS}
				/>
			),
		},
	];

	const footer = (
		<DialogFooter className="px-4 sm:px-6 lg:px-10 py-4 sm:py-5 border-t bg-white dark:bg-slate-900 shrink-0 flex flex-col sm:flex-row gap-2 sm:gap-3">
			<Button
				variant="ghost"
				onClick={() => onOpenChange(false)}
				disabled={isSaving}
				className="h-10 sm:h-11 lg:h-12 px-4 sm:px-6 lg:px-8 text-sm sm:text-base font-semibold bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800/50 rounded-lg transition-colors w-full sm:w-auto"
			>
				Close
			</Button>
			{!isRowReadOnly && (
				<Button
					onClick={handleSave}
					disabled={isSaving}
					className="h-10 sm:h-11 lg:h-12 px-6 sm:px-8 lg:px-12 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm sm:text-base font-bold rounded-lg shadow-lg shadow-indigo-600/20 gap-2 transition-all active:scale-95 w-full sm:w-auto"
				>
					{isSaving ? (
						<Loader2 className="size-4 sm:size-5 animate-spin" />
					) : (
						<Save className="size-4 sm:size-5" />
					)}
					<span>Update Record</span>
				</Button>
			)}
		</DialogFooter>
	);

	return (
		<BaseJobDetailsDialog
			open={open}
			onOpenChange={onOpenChange}
			jobNumber={row.jobNumber}
			companyName={row.companyName}
			driveUrl={row.driveUrl}
			isRefreshing={isRefreshing}
			tabs={tabs}
			defaultTab="general"
			footer={footer}
		/>
	);
}
