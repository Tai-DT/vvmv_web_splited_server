"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectPositioner,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useContainerSizes } from "@/hooks/use-container-sizes";
import type { ContainerRow } from "../../types";

interface ContainerDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	followUpId: string;
	container?: ContainerRow | null; // If provided, edit mode; otherwise, add mode
	onSuccess?: () => void;
}

/**
 * ContainerDialog Component
 *
 * A dialog for adding or editing containers.
 * - Add mode: container prop is null/undefined
 * - Edit mode: container prop has data
 */
export function ContainerDialog({
	open,
	onOpenChange,
	followUpId,
	container,
	onSuccess,
}: ContainerDialogProps) {
	const isEditMode = !!container;
	const { containerSizes } = useContainerSizes();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [formData, setFormData] = useState<Partial<ContainerRow>>({
		containerNo: "",
		sealNo: "",
		containerSize: "",
		quantity: 1, // Default quantity is 1
		grossWeight: undefined,
		tareWeight: undefined,
	});

	// Reset form data when dialog opens/closes or container changes
	useEffect(() => {
		if (open) {
			if (container) {
				setFormData({
					containerNo: container.containerNo || "",
					sealNo: container.sealNo || "",
					containerSize: container.containerSize || "",
					quantity: container.quantity ?? 1, // Default to 1 if not set
					grossWeight: container.grossWeight ?? undefined,
					tareWeight: container.tareWeight ?? undefined,
				});
			} else {
				setFormData({
					containerNo: "",
					sealNo: "",
					containerSize: "",
					quantity: 1, // Default quantity is 1
					grossWeight: undefined,
					tareWeight: undefined,
				});
			}
		}
	}, [open, container]);

	const handleSubmit = async () => {
		if (!formData.containerNo) {
			toast.error("Container No is required");
			return;
		}

		setIsSubmitting(true);
		try {
			const endpoint = isEditMode
				? "/api/followup/update-container"
				: "/api/followup/create-container";
			const method = isEditMode ? "PATCH" : "POST";

			const body = isEditMode
				? {
						containerId: container?.id,
						...formData,
						quantity: formData.quantity ?? 1, // Default to 1 if not specified
					}
				: {
						followUpId,
						...formData,
						quantity: formData.quantity ?? 1, // Default to 1 if not specified
					};

			const response = await fetch(endpoint, {
				method,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(
					error.message ||
						`Failed to ${isEditMode ? "update" : "add"} container`,
				);
			}

			toast.success(
				`Container ${isEditMode ? "updated" : "added"} successfully`,
			);
			onOpenChange(false);
			onSuccess?.();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: `Failed to ${isEditMode ? "update" : "add"} container`,
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>
						{isEditMode ? "Edit Container" : "Add Container"}
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{/* Container No */}
					<div className="space-y-2">
						<label className="text-sm font-medium">
							Container No <span className="text-red-500">*</span>
						</label>
						<Input
							placeholder="Enter container number"
							value={formData.containerNo || ""}
							onChange={(e) =>
								setFormData((prev) => ({
									...prev,
									containerNo: e.target.value,
								}))
							}
						/>
					</div>

					{/* Seal No */}
					<div className="space-y-2">
						<label className="text-sm font-medium">Seal No</label>
						<Input
							placeholder="Enter seal number"
							value={formData.sealNo || ""}
							onChange={(e) =>
								setFormData((prev) => ({
									...prev,
									sealNo: e.target.value,
								}))
							}
						/>
					</div>

					{/* Container Size */}
					<div className="space-y-2">
						<label className="text-sm font-medium">Container Size</label>
						<Select
							value={formData.containerSize || ""}
							onValueChange={(value: unknown) =>
								setFormData((prev) => ({
									...prev,
									containerSize: value as string,
								}))
							}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Select size" />
							</SelectTrigger>
							<SelectPositioner>
								<SelectContent>
									{containerSizes.map((size) => (
										<SelectItem key={size} value={size}>
											{size}
										</SelectItem>
									))}
								</SelectContent>
							</SelectPositioner>
						</Select>
					</div>

					{/* Gross Weight */}
					<div className="space-y-2">
						<label className="text-sm font-medium">Gross Weight</label>
						<Input
							type="number"
							step="0.01"
							placeholder="Enter gross weight"
							value={formData.grossWeight ?? ""}
							onChange={(e) => {
								const val = parseFloat(e.target.value);
								setFormData((prev) => ({
									...prev,
									grossWeight: Number.isNaN(val) ? undefined : val,
								}));
							}}
						/>
					</div>

					{/* Tare Weight */}
					<div className="space-y-2">
						<label className="text-sm font-medium">Tare Weight</label>
						<Input
							type="number"
							step="0.01"
							placeholder="Enter tare weight"
							value={formData.tareWeight ?? ""}
							onChange={(e) => {
								const val = parseFloat(e.target.value);
								setFormData((prev) => ({
									...prev,
									tareWeight: Number.isNaN(val) ? undefined : val,
								}));
							}}
						/>
					</div>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isSubmitting}
					>
						Cancel
					</Button>
					<Button onClick={handleSubmit} disabled={isSubmitting}>
						{isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
						{isEditMode ? "Save Changes" : "Add Container"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
