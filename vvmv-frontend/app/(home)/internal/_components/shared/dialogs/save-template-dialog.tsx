"use client";

import { SaveIcon } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
	useCreateTemplate,
	useUpdateTemplate,
} from "@/hooks/use-field-templates";

interface SaveTemplateDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	selectedFields: string[];
	fieldData?: Record<string, any>; // Data values to save (including containers, duplicateCount)
	mode?: "create" | "update";
	editingTemplate?: {
		id: string;
		name: string;
		description?: string | null;
	} | null;
}

export function SaveTemplateDialog({
	open,
	onOpenChange,
	selectedFields,
	fieldData,
	mode = "create",
	editingTemplate,
}: SaveTemplateDialogProps) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const createTemplate = useCreateTemplate();
	const updateTemplate = useUpdateTemplate();

	const isUpdateMode = mode === "update" && !!editingTemplate;

	useEffect(() => {
		if (!open) return;
		if (isUpdateMode && editingTemplate) {
			setName(editingTemplate.name);
			setDescription(editingTemplate.description || "");
			return;
		}

		setName("");
		setDescription("");
	}, [open, isUpdateMode, editingTemplate]);

	const handleSave = async () => {
		if (!name.trim()) {
			toast.error("Please enter a template name");
			return;
		}

		try {
			if (isUpdateMode && editingTemplate) {
				await updateTemplate.mutateAsync({
					id: editingTemplate.id,
					name: name.trim(),
					selectedFields,
					fieldData,
					description: description.trim() || undefined,
				});
				toast.success(`Template "${name}" updated successfully`);
			} else {
				await createTemplate.mutateAsync({
					name: name.trim(),
					selectedFields,
					fieldData,
					description: description.trim() || undefined,
				});
				toast.success(`Template "${name}" saved successfully`);
			}
			setName("");
			setDescription("");
			onOpenChange(false);
		} catch (error: any) {
			if (error.message?.includes("already exists")) {
				toast.error("A template with this name already exists");
			} else {
				toast.error("Failed to save template");
			}
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<SaveIcon className="size-5" />
						{isUpdateMode ? "Update Field Template" : "Save Field Template"}
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<label className="text-sm font-medium">Template Name</label>
						<Input
							placeholder="e.g., Export Template, Import Default"
							value={name}
							onChange={(e) => setName(e.target.value)}
							autoFocus
						/>
					</div>

					<div className="space-y-2">
						<label className="text-sm font-medium">
							Description{" "}
							<span className="text-muted-foreground">(Optional)</span>
						</label>
						<Textarea
							placeholder="Brief description of what this template is for..."
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							rows={3}
						/>
					</div>

					<div className="space-y-1 text-xs text-muted-foreground">
						<div>
							• {selectedFields.length} optional field
							{selectedFields.length !== 1 ? "s" : ""}
						</div>
						{fieldData?._containers &&
							Array.isArray(fieldData._containers) &&
							fieldData._containers.length > 0 && (
								<div>
									• {fieldData._containers.length} container
									{fieldData._containers.length !== 1 ? "s" : ""}
								</div>
							)}
						{fieldData?._duplicateCount && fieldData._duplicateCount > 1 && (
							<div>• Duplicate count: {fieldData._duplicateCount}</div>
						)}
						{(fieldData?.operationType || fieldData?.taxCode) && (
							<div>• Required fields included</div>
						)}
					</div>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => {
							setName("");
							setDescription("");
							onOpenChange(false);
						}}
					>
						Cancel
					</Button>
					<Button
						onClick={handleSave}
						disabled={createTemplate.isPending || updateTemplate.isPending}
					>
						{createTemplate.isPending || updateTemplate.isPending
							? "Saving..."
							: isUpdateMode
								? "Update Template"
								: "Save Template"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
