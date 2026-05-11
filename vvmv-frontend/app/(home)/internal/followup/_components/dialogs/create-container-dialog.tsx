"use client";

import { useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useContainerSizes } from "@/hooks/use-container-sizes";
import type { ContainerRow, FollowUpRow } from "../../types";
import { ContainerFields } from "../shared/container-fields";
import { ImportContainersDialog } from "./import-containers-dialog";

// Generate UUID
function generateUUID(): string {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return crypto.randomUUID();
	}
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

interface AddContainersDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	followUp: FollowUpRow | null;
}

export function CreateContainerDialog({
	open,
	onOpenChange,
	followUp,
}: AddContainersDialogProps) {
	const queryClient = useQueryClient();
	const { containerSizes } = useContainerSizes();
	const [isLoading, setIsLoading] = useState(false);
	const [importDialogOpen, setImportDialogOpen] = useState(false);
	const [containers, setContainers] = useState<Partial<ContainerRow>[]>([
		{
			id: generateUUID(),
			containerNo: "",
			sealNo: "",
			containerSize: "",
			quantity: 1, // Default quantity is 1
			grossWeight: undefined,
		},
	]);

	const handleAddContainer = () => {
		setContainers((prev) => [
			...prev,
			{
				id: generateUUID(),
				containerNo: "",
				sealNo: "",
				containerSize: "",
				quantity: 1, // Default quantity is 1
				grossWeight: undefined,
			},
		]);
	};

	const handleRemoveContainer = (index: number) => {
		setContainers((prev) => prev.filter((_, i) => i !== index));
	};

	const handleContainerFieldChange = (
		index: number,
		field: keyof ContainerRow,
		value: string | number,
	) => {
		setContainers((prev) =>
			prev.map((container, i) =>
				i === index ? { ...container, [field]: value } : container,
			),
		);
	};

	const handleSubmit = async () => {
		if (!followUp?.id) {
			toast.error("No follow-up record selected");
			return;
		}

		// Filter out empty containers
		const validContainers = containers.filter((c) => c.containerNo?.trim());

		if (validContainers.length === 0) {
			toast.error("Please enter at least one container number");
			return;
		}

		// Check for duplicates within the form (case-insensitive)
		const seen = new Map<string, number>();
		const duplicates: string[] = [];

		validContainers.forEach((container, index) => {
			const normalizedNo = container.containerNo?.trim().toUpperCase();
			if (normalizedNo) {
				if (seen.has(normalizedNo)) {
					duplicates.push(normalizedNo);
				} else {
					seen.set(normalizedNo, index);
				}
			}
		});

		if (duplicates.length > 0) {
			toast.error(
				`Duplicate container numbers found: ${Array.from(new Set(duplicates)).join(", ")}`,
			);
			return;
		}

		setIsLoading(true);
		try {
			// Create all containers
			const results = await Promise.all(
				validContainers.map((container) =>
					fetch("/api/followup/create-container", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							followUpId: followUp.id,
							containerNo: container.containerNo,
							sealNo: container.sealNo || null,
							containerSize: container.containerSize || null,
							quantity: container.quantity ?? 1, // Default to 1 if not specified
							grossWeight: container.grossWeight ?? null,
						}),
					}),
				),
			);

			const failedCount = results.filter((r) => !r.ok).length;
			const successCount = results.length - failedCount;

			// Refresh data
			await queryClient.invalidateQueries({ queryKey: ["followups"] });

			if (failedCount > 0) {
				toast.warning(
					`${successCount} container(s) created, ${failedCount} failed`,
				);
			} else {
				toast.success(
					`${successCount} container${successCount > 1 ? "s" : ""} created successfully`,
				);
			}

			// Reset and close
			setContainers([
				{
					id: generateUUID(),
					containerNo: "",
					sealNo: "",
					containerSize: "",
					quantity: 1, // Default quantity is 1
					grossWeight: undefined,
				},
			]);
			onOpenChange(false);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to create containers",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => {
		setContainers([
			{
				id: generateUUID(),
				containerNo: "",
				sealNo: "",
				containerSize: "",
				quantity: 1, // Default quantity is 1
				grossWeight: undefined,
			},
		]);
		onOpenChange(false);
	};

	return (
		<>
			<ImportContainersDialog
				open={importDialogOpen}
				onOpenChange={setImportDialogOpen}
				followUpId={followUp?.id || ""}
			/>
			<Dialog open={open} onOpenChange={handleClose}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Add Containers</DialogTitle>
					</DialogHeader>

					<div className="space-y-4">
						{/* Follow-up Info */}
						{followUp && (
							<div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
								<p className="font-medium text-muted-foreground">For Record:</p>
								<p>Job: {followUp.jobNumber || "—"}</p>
								<p>Company: {followUp.companyName || "—"}</p>
							</div>
						)}

						{/* Container Fields */}
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium text-muted-foreground">
									Containers ({containers.length})
								</span>
								<div className="flex items-center gap-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => setImportDialogOpen(true)}
										className="gap-1"
									>
										<FileSpreadsheet className="size-4" />
										Import Excel
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={handleAddContainer}
										className="gap-1"
									>
										<PlusIcon className="size-4" />
										Add Container
									</Button>
								</div>
							</div>

							{containers.map((container, index) => (
								<ContainerFields
									key={container.id || index}
									index={index}
									container={container}
									onFieldChange={(field, value) =>
										handleContainerFieldChange(index, field, value)
									}
									onRemove={() => handleRemoveContainer(index)}
									showRemoveButton={containers.length > 1}
									containerSizes={containerSizes}
								/>
							))}
						</div>
					</div>

					<DialogFooter className="pt-4">
						<Button
							variant="outline"
							onClick={handleClose}
							disabled={isLoading}
						>
							Cancel
						</Button>
						<Button onClick={handleSubmit} disabled={isLoading}>
							{isLoading
								? "Creating..."
								: `Add ${containers.filter((c) => c.containerNo?.trim()).length || ""} Container${containers.filter((c) => c.containerNo?.trim()).length !== 1 ? "s" : ""}`}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
