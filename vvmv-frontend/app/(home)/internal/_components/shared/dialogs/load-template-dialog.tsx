"use client";

import {
	FolderOpenIcon,
	Layers,
	Loader2,
	SearchIcon,
	Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	useDeleteTemplate,
	useFieldTemplates,
} from "@/hooks/use-field-templates";

type TemplateItem = {
	id: string;
	name: string;
	description?: string | null;
	selectedFields: string[];
	fieldData?: Record<string, any> | null;
};

interface LoadTemplateDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** "load" = single-load into form (default). "batch" = multi-select to add to batch queue. */
	mode?: "load" | "batch";
	onLoadTemplate?: (
		templateId: string,
		selectedFields: string[],
		fieldData?: Record<string, any> | null,
		templateMeta?: {
			name: string;
			description?: string | null;
		},
	) => void;
	/** Called in batch mode with all selected templates */
	onAddToBatch?: (templates: TemplateItem[]) => void;
}

export function LoadTemplateDialog({
	open,
	onOpenChange,
	mode = "load",
	onLoadTemplate,
	onAddToBatch,
}: LoadTemplateDialogProps) {
	const { data: templates, isLoading } = useFieldTemplates();
	const deleteTemplate = useDeleteTemplate();
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

	const handleClose = (v: boolean) => {
		setSearch("");
		setSelectedIds(new Set());
		onOpenChange(v);
	};

	const handleDelete = async (templateId: string, templateName: string) => {
		setDeletingId(templateId);
		try {
			await deleteTemplate.mutateAsync(templateId);
			toast.success(`Template "${templateName}" deleted`);
			setSelectedIds((prev) => {
				const next = new Set(prev);
				next.delete(templateId);
				return next;
			});
		} catch (_error) {
			toast.error("Failed to delete template");
		} finally {
			setDeletingId(null);
		}
	};

	const handleLoad = (template: TemplateItem) => {
		onLoadTemplate?.(template.id, template.selectedFields, template.fieldData, {
			name: template.name,
			description: template.description ?? null,
		});
		handleClose(false);
		toast.success(`Loaded template: ${template.name}`);
	};

	const handleToggle = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const handleBatchAdd = () => {
		const chosen = (templates ?? []).filter((t) => selectedIds.has(t.id));
		if (chosen.length === 0) return;
		onAddToBatch?.(chosen);
		toast.success(
			`Added ${chosen.length} template${chosen.length !== 1 ? "s" : ""} to batch`,
		);
		handleClose(false);
	};

	const filteredTemplates = templates?.filter((t) =>
		t.name.toLowerCase().includes(search.toLowerCase()),
	);

	const isBatch = mode === "batch";

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						{isBatch ? (
							<Layers className="size-5" />
						) : (
							<FolderOpenIcon className="size-5" />
						)}
						{isBatch ? "Add Templates to Batch" : "Load Field Template"}
					</DialogTitle>
				</DialogHeader>

				<div className="relative">
					<SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
					<Input
						placeholder="Search templates..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-8"
					/>
				</div>

				<div className="space-y-2 max-h-[400px] overflow-y-auto">
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="size-6 animate-spin text-muted-foreground" />
						</div>
					) : filteredTemplates?.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground text-sm">
							{search
								? "No templates match your search"
								: "No saved templates yet"}
						</div>
					) : (
						filteredTemplates?.map((template) => (
							<div
								key={template.id}
								className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
									isBatch && selectedIds.has(template.id)
										? "border-primary bg-primary/5"
										: "hover:bg-muted/50"
								}`}
							>
								{isBatch && (
									<Checkbox
										id={`batch-${template.id}`}
										checked={selectedIds.has(template.id)}
										onCheckedChange={() => handleToggle(template.id)}
										className="mr-2 shrink-0"
									/>
								)}
								<button
									type="button"
									onClick={() =>
										isBatch ? handleToggle(template.id) : handleLoad(template)
									}
									className="flex-1 text-left"
								>
									<div className="font-medium">{template.name}</div>
									{template.description && (
										<div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
											{template.description}
										</div>
									)}
									<div className="text-xs text-muted-foreground mt-1 space-y-0.5">
										<div>
											• {template.selectedFields.length} optional field
											{template.selectedFields.length !== 1 ? "s" : ""}
										</div>
										{template.fieldData?._containers &&
											Array.isArray(template.fieldData._containers) &&
											template.fieldData._containers.length > 0 && (
												<div>
													• {template.fieldData._containers.length} container
													{template.fieldData._containers.length !== 1
														? "s"
														: ""}
												</div>
											)}
										{template.fieldData?._duplicateCount &&
											template.fieldData._duplicateCount > 1 && (
												<div>
													• Duplicate: {template.fieldData._duplicateCount}x
												</div>
											)}
										{(template.fieldData?.operationType ||
											template.fieldData?.taxCode) && (
											<div>• Required fields included</div>
										)}
									</div>
								</button>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={(e) => {
										e.stopPropagation();
										handleDelete(template.id, template.name);
									}}
									disabled={deletingId === template.id}
									className="text-destructive hover:text-destructive ml-2"
								>
									{deletingId === template.id ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<Trash2Icon className="size-4" />
									)}
								</Button>
							</div>
						))
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => handleClose(false)}>
						Cancel
					</Button>
					{isBatch && (
						<Button
							disabled={selectedIds.size === 0}
							onClick={handleBatchAdd}
							className="bg-purple-600 hover:bg-purple-700 text-white"
						>
							Add Selected ({selectedIds.size})
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
