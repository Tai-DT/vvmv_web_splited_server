"use client";

import {
	FileSpreadsheet,
	Loader2,
	PencilIcon,
	PlusIcon,
	Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { ContainerRow } from "../../types";
import { ContainerDialog } from "../dialogs/container-dialog";
import { ImportContainersDialog } from "../dialogs/import-containers-dialog";
import { CONTAINER_HEADERS } from "../table/column-headers";

interface ContainersPanelProps {
	containers: ContainerRow[];
	followUpId: string;
	onContainerAdded?: () => void;
}

/**
 * Collapsible panel for displaying and adding container children
 * Shows all container fields from Prisma schema with ability to add/edit containers
 */
export function ContainersPanel({
	containers,
	followUpId,
	onContainerAdded,
}: ContainersPanelProps) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [importDialogOpen, setImportDialogOpen] = useState(false);
	const [editingContainer, setEditingContainer] = useState<ContainerRow | null>(
		null,
	);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const formatNumber = (value: number | null | undefined) => {
		if (value === null || value === undefined) return "—";
		return value.toLocaleString();
	};

	const handleOpenEditDialog = (container: ContainerRow) => {
		setEditingContainer(container);
		setDialogOpen(true);
	};

	const handleDialogClose = (open: boolean) => {
		setDialogOpen(open);
		if (!open) {
			setEditingContainer(null);
		}
	};

	const handleDeleteContainer = async (containerId: string) => {
		setDeletingId(containerId);
		try {
			const response = await fetch("/api/followup/delete-container", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ containerId }),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || "Failed to delete container");
			}

			toast.success("Container deleted successfully");
			onContainerAdded?.(); // Refresh data
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to delete container",
			);
		} finally {
			setDeletingId(null);
		}
	};

	const content = (
		<div className="space-y-4 p-4">
			{/* Action Buttons */}
			<div className="flex items-center justify-end gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => setImportDialogOpen(true)}
					className="gap-2"
				>
					<FileSpreadsheet className="size-4" />
					Import from Excel
				</Button>
				<Button
					type="button"
					variant="default"
					size="sm"
					onClick={() => setDialogOpen(true)}
					className="gap-2"
				>
					<PlusIcon className="size-4" />
					Add Container
				</Button>
			</div>

			{/* Desktop: Table view (md and above) */}
			<div className="hidden md:block overflow-x-auto">
				<Table>
					<TableHeader>
						<TableRow className="text-muted-foreground italic">
							<TableHead className="text-left py-2 px-3 font-medium whitespace-nowrap">
								{CONTAINER_HEADERS.containerNo}
							</TableHead>
							<TableHead className="text-left py-2 px-3 font-medium whitespace-nowrap">
								{CONTAINER_HEADERS.sealNo}
							</TableHead>
							<TableHead className="text-left py-2 px-3 font-medium whitespace-nowrap">
								{CONTAINER_HEADERS.containerSize}
							</TableHead>
							{/* Quantity column hidden - default value is always 1 */}
							<TableHead className="text-left py-2 px-3 font-medium whitespace-nowrap">
								{CONTAINER_HEADERS.grossWeight}
							</TableHead>
							<TableHead className="text-left py-2 px-3 font-medium whitespace-nowrap">
								{CONTAINER_HEADERS.packageQty}
							</TableHead>
							<TableHead className="text-left py-2 px-3 font-medium whitespace-nowrap">
								{CONTAINER_HEADERS.tareWeight}
							</TableHead>
							<TableHead className="text-right py-2 px-3 font-medium whitespace-nowrap w-16">
								Actions
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{containers.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={6}
									className="py-4 px-3 text-center text-muted-foreground"
								>
									No containers added yet
								</TableCell>
							</TableRow>
						) : (
							<>
								{containers.map((container, index) => (
									<TableRow
										key={container.id || index}
										className="hover:bg-muted/30 transition-colors"
									>
										<TableCell className="py-2 px-3 font-medium whitespace-nowrap">
											{container.containerNo || "—"}
										</TableCell>
										<TableCell className="py-2 px-3 whitespace-nowrap">
											{container.sealNo || "—"}
										</TableCell>
										<TableCell className="py-2 px-3 whitespace-nowrap">
											{container.containerSize || "—"}
										</TableCell>
										{/* Quantity column hidden - default value is always 1 */}
										<TableCell className="py-2 px-3 whitespace-nowrap">
											{formatNumber(container.grossWeight)}
										</TableCell>
										<TableCell className="py-2 px-3 whitespace-nowrap">
											{formatNumber(container.packageQty)}
										</TableCell>
										<TableCell className="py-2 px-3 whitespace-nowrap">
											{formatNumber(container.tareWeight)}
										</TableCell>
										<TableCell className="py-2 px-3 text-right">
											<div className="flex items-center justify-end gap-1">
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={() => handleOpenEditDialog(container)}
													className="h-6 w-6 p-0"
												>
													<PencilIcon className="size-3" />
												</Button>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={() => handleDeleteContainer(container.id)}
													disabled={deletingId === container.id}
													className="h-6 w-6 p-0 text-destructive hover:text-destructive"
												>
													{deletingId === container.id ? (
														<Loader2 className="size-3 animate-spin" />
													) : (
														<Trash2Icon className="size-3" />
													)}
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))}
								{/* Add New Row */}
								<TableRow className="hover:bg-muted/20 transition-colors">
									<TableCell colSpan={6} className="py-2 px-3">
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => setDialogOpen(true)}
											className="w-full h-8 justify-start gap-2 text-muted-foreground hover:text-foreground"
										>
											<PlusIcon className="size-4" />
											Add Container
										</Button>
									</TableCell>
								</TableRow>
							</>
						)}
					</TableBody>
				</Table>
			</div>

			{/* Mobile/Tablet: Card grid (below md) */}
			<div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
				{containers.length === 0 ? (
					<div className="col-span-full py-4 text-center text-muted-foreground text-sm">
						No containers added yet
					</div>
				) : (
					<>
						{containers.map((container, index) => (
							<div
								key={container.id || index}
								className="p-3 bg-neutral-50 rounded-md border relative"
							>
								<div className="absolute top-2 right-2 flex items-center gap-1">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => handleOpenEditDialog(container)}
										className="h-6 w-6 p-0"
									>
										<PencilIcon className="size-3" />
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => handleDeleteContainer(container.id)}
										disabled={deletingId === container.id}
										className="h-6 w-6 p-0 text-destructive hover:text-destructive"
									>
										{deletingId === container.id ? (
											<Loader2 className="size-3 animate-spin" />
										) : (
											<Trash2Icon className="size-3" />
										)}
									</Button>
								</div>
								<div className="font-medium text-xs mb-2 truncate pr-16">
									{container.containerNo || "—"}
								</div>
								<div className="space-y-1 text-xs text-muted-foreground">
									{container.sealNo && (
										<div className="truncate">
											<span className="font-medium">Seal:</span>{" "}
											{container.sealNo}
										</div>
									)}
									{container.containerSize && (
										<div>
											<span className="font-medium">Size:</span>{" "}
											{container.containerSize}
										</div>
									)}
									{/* Quantity hidden - default value is always 1 */}
									{container.grossWeight && (
										<div>
											<span className="font-medium">G.W:</span>{" "}
											{formatNumber(container.grossWeight)}
										</div>
									)}
									{container.packageQty && (
										<div>
											<span className="font-medium">Package Qty:</span>{" "}
											{formatNumber(container.packageQty)}
										</div>
									)}
									{container.tareWeight && (
										<div>
											<span className="font-medium">Tare Weight:</span>{" "}
											{formatNumber(container.tareWeight)}
										</div>
									)}
								</div>
							</div>
						))}
						{/* Add New Card */}
						<div className="col-span-1">
							<Button
								type="button"
								variant="outline"
								onClick={() => setDialogOpen(true)}
								className="w-full h-full min-h-[100px] border-dashed hover:bg-muted/50 hover:border-solid transition-all"
							>
								<div className="flex flex-col items-center gap-2 text-muted-foreground">
									<PlusIcon className="size-5" />
									<span className="text-xs font-medium">Add Container</span>
								</div>
							</Button>
						</div>
					</>
				)}
			</div>
		</div>
	);

	return (
		<>
			<ContainerDialog
				open={dialogOpen}
				onOpenChange={handleDialogClose}
				followUpId={followUpId}
				container={editingContainer}
				onSuccess={onContainerAdded}
			/>
			<ImportContainersDialog
				open={importDialogOpen}
				onOpenChange={setImportDialogOpen}
				followUpId={followUpId}
			/>
			{content}
		</>
	);
}
