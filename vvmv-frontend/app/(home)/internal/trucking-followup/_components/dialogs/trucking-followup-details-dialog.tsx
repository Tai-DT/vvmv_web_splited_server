"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
	Box,
	CreditCard,
	FileText,
	History,
	ListChecks,
	Loader2,
	Save,
	Settings2,
	Truck,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ActivityLogPanel } from "@/components/shared/activity-log-panel";
import { PaymentRequestPanel } from "@/components/shared/payment-request-panel";
import { Button } from "@/components/ui/button";
import {
	BaseJobDetailsDialog,
	DialogFooter,
	type TabConfig,
} from "../../../followup/_components/dialogs/base-job-details-dialog";
import { InvokerTasksPanel } from "../../../followup/_components/panels/invoker-tasks-panel";
import type { TruckingFollowUpRow } from "../../types";
import { ContainersPanel } from "../panels/containers-panel";
import { DeclarationsPanel } from "../panels/declarations-panel";
import { FCRPanel } from "../panels/fcr-panel";
import { InformationPanelEditable } from "../panels/information-panel-editable";
import { TRUCKING_FOLLOWUP_LABELS } from "../table/column-labels";

interface TruckingFollowUpDetailsDialogProps {
	row: TruckingFollowUpRow | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	isRefreshing?: boolean;
}

export function TruckingFollowUpDetailsDialog({
	row,
	open,
	onOpenChange,
	isRefreshing = false,
}: TruckingFollowUpDetailsDialogProps) {
	const [formData, setFormData] = useState<any>({});
	const originalDataRef = useRef<any>({});
	const isInitializedRef = useRef(false);
	const [isSaving, setIsSaving] = useState(false);
	const [handlerOpen, setHandlerOpen] = useState(false);
	const queryClient = useQueryClient();

	useEffect(() => {
		if (row && open && !isInitializedRef.current) {
			const fcrs = row.fcrs || [];
			const containers = row.containers || [];
			const hasContainers = containers.length > 0;

			const uniqueFCR = <T,>(
				getter: (f: (typeof fcrs)[0]) => T | null | undefined,
			): T[] => [...new Set(fcrs.map(getter).filter((v): v is T => !!v))];
			const uniqueContainer = (
				getter: (c: (typeof containers)[0]) => string | null | undefined,
			): string =>
				[...new Set(containers.map(getter).filter(Boolean))].join(", ");

			const fcrFromLocations = uniqueFCR((f) => f.pickupAt);
			const fcrToLocations = uniqueFCR((f) => f.deliveryAt);
			const fcrTruckTypes = uniqueFCR((f) => f.truckType);
			const fcrVendors = uniqueFCR((f) => f.vendor);
			const fcrImplDates = uniqueFCR((f) => f.implementationDate);
			const fcrTTypeCs = uniqueFCR((f) => f.tTypeC);

			const data: any = {
				...row,
				handler: row.handler || "",
				commodityName: row.commodityName || "",
				billOrBooking: row.billOrBooking || "",
				eportBooking: row.eportBooking || "",
				fromLocation: fcrFromLocations.length === 1 ? fcrFromLocations[0] : "",
				toLocation: fcrToLocations.length === 1 ? fcrToLocations[0] : "",
				truckType: fcrTruckTypes.length === 1 ? fcrTruckTypes[0] : "",
				tTypeC: fcrTTypeCs.length === 1 ? fcrTTypeCs[0] : "",
				vendor: fcrVendors.length === 1 ? fcrVendors[0] : "",
				implementationDate: fcrImplDates.length === 1 ? fcrImplDates[0] : "",
				cutOffTime: hasContainers ? uniqueContainer((c) => c.cutOffTime) : "",
				closingTime: hasContainers ? uniqueContainer((c) => c.closingTime) : "",
				vesselName: hasContainers ? uniqueContainer((c) => c.vesselName) : "",
				veselNumber: hasContainers ? uniqueContainer((c) => c.veselNumber) : "",
				pickOrLiftPlace: hasContainers
					? uniqueContainer((c) => c.pickOrLiftPlace)
					: "",
				maLo: hasContainers ? uniqueContainer((c) => c.maLo) : "",
				invoiceTaxCode: hasContainers
					? uniqueContainer((c) => c.vatTaxCode)
					: "",
				warehouse: hasContainers ? uniqueContainer((c) => c.warehouse) : "",
				carrierName: row.carrierName || "",
				cbm: row.cbm ?? "",
				grossWeight: row.grossWeight ?? "",
				quantity: row.quantity ?? "",
				note: row.note || "",
				note2: row.note2 || "",
				note3: row.note3 || "",
				note4: row.note4 || "",
				note5: row.note5 || "",
			};
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

		// Non-editable fields that should be excluded from change detection
		const excludedKeys = new Set([
			"id",
			"createdAt",
			"updatedAt",
			"createdBy",
			"fcrs",
			"declarations",
			"containers",
			"followUps",
			"user",
			"handlerUser",
			"invokerTasks",
			"subJobsCount",
			"taxCode",
			"operationType",
			"requestNumber",
			"serviceMode",
		]);

		// Check all keys in formData
		return Object.keys(formData).some((key) => {
			// Skip excluded keys and computed fields (starting with _)
			if (excludedKeys.has(key) || key.startsWith("_")) return false;

			const original = originalData[key];
			const current = formData[key];

			// No change if values are equal
			if (original === current) return false;

			// Treat null and empty string as equivalent
			if (
				(original === null || original === "") &&
				(current === null || current === "")
			)
				return false;

			return true;
		});
	}, [formData]);

	const handleInputChange = (field: string, value: any) => {
		setFormData((prev: any) => ({ ...prev, [field]: value }));
	};

	const handleSave = async () => {
		if (!row) return;

		setIsSaving(true);
		try {
			// Get all changed fields dynamically
			const updatableFields = Object.keys(formData).filter((key) => {
				const val = (formData as any)[key];
				const oldVal = (originalDataRef.current as any)[key];
				return (
					String(val) !== String(oldVal ?? "") &&
					key !== "id" &&
					key !== "createdAt" &&
					key !== "updatedAt" &&
					key !== "createdBy" &&
					key !== "fcrs" &&
					key !== "declarations" &&
					key !== "containers" &&
					key !== "followUps" &&
					key !== "user" &&
					key !== "handlerUser" &&
					key !== "invokerTasks" &&
					key !== "subJobsCount" &&
					!key.startsWith("_") // Exclude computed fields
				);
			});

			if (updatableFields.length === 0) {
				toast.info("No changes to save");
				return;
			}

			// Send individual PATCH requests for each field
			const promises = updatableFields.map((field) =>
				fetch("/api/trucking-followup/update", {
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

			// Update the original reference so hasChanges becomes false
			originalDataRef.current = JSON.parse(JSON.stringify(formData));
			queryClient.invalidateQueries({ queryKey: ["trucking-followup"] });
			toast.success("Changes saved successfully");
			// Dialog stays open for continued editing
		} catch (error) {
			console.error("Save error:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to save changes",
			);
		} finally {
			setIsSaving(false);
		}
	};

	if (!row) return null;

	// Drive URL: trucking row links to logistics driveUrl via followUps
	const driveUrl = row.driveUrl || row.followUps?.[0]?.driveUrl || null;

	const tabs: TabConfig[] = [
		{
			value: "information",
			label: "Information",
			labelShort: "Info",
			icon: Settings2,
			content: (
				<InformationPanelEditable
					row={row}
					formData={formData}
					onFieldChange={handleInputChange}
					handlerOpen={handlerOpen}
					setHandlerOpen={setHandlerOpen}
				/>
			),
		},
		{
			value: "fcr",
			label: "FCR",
			labelShort: "FCR",
			icon: Truck,
			content: (
				<FCRPanel
					truckingId={row.id}
					fcrs={row.fcrs || []}
					containers={row.containers || []}
					isFinished={row.isFinished}
					truckingRow={row}
				/>
			),
			badge: row.fcrs?.length || 0,
		},
		{
			value: "declarations",
			label: "Declarations",
			labelShort: "Decl",
			icon: FileText,
			content: <DeclarationsPanel declarations={row.declarations || []} />,
			badge: row.declarations?.length || 0,
		},
		{
			value: "containers",
			label: "Containers",
			labelShort: "Cont",
			icon: Box,
			content: (
				<ContainersPanel
					containers={row.containers || []}
					fcrs={row.fcrs || []}
					declarations={row.declarations || []}
					createdBy={row.createdBy}
					truckingFollowUpId={row.id}
					isFinished={row.isFinished}
					taxCode={row.taxCode}
					driveUrl={driveUrl}
					jobNumber={row.jobNumber}
					billOrBooking={row.billOrBooking}
					operationType={row.operationType}
					fromLocation={row.fromLocation}
					toLocation={row.toLocation}
				/>
			),
			badge: row.containers?.length || 0,
		},
		{
			value: "tasks",
			label: "Tasks",
			labelShort: "Tasks",
			icon: ListChecks,
			content: <InvokerTasksPanel tasks={row.invokerTasks || []} />,
			badge: row.invokerTasks?.length || 0,
		},
		{
			value: "payment",
			label: "Payment",
			labelShort: "Pay",
			icon: CreditCard,
			content: (
				<PaymentRequestPanel
					apiPath="/api/trucking-followup/payment-request"
					parentId={row.id}
					parentIdParam="truckingFollowUpId"
				/>
			),
			badge:
				row._count?.paymentRequests ||
				row.paymentRequests?.length ||
				0 ||
				undefined,
		},
		{
			value: "activity",
			label: "Activity",
			labelShort: "Log",
			icon: History,
			content: (
				<ActivityLogPanel
					jobId={row.id}
					apiPath="/api/trucking-followup/activity-log"
					fieldLabels={TRUCKING_FOLLOWUP_LABELS}
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
		</DialogFooter>
	);

	return (
		<BaseJobDetailsDialog
			open={open}
			onOpenChange={onOpenChange}
			jobNumber={row.jobNumber}
			companyName={row.companyName}
			driveUrl={driveUrl}
			isRefreshing={isRefreshing}
			tabs={tabs}
			defaultTab="information"
			footer={footer}
		/>
	);
}
