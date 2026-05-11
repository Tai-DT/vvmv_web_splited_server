"use client";

import type { Row, Table } from "@tanstack/react-table";
import { Folder, Pencil } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { memo, useCallback, useEffect, useState } from "react";
import { SiGoogledrive } from "react-icons/si";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton } from "../shared/copy-button";
import { useCellTabIndex } from "./use-cell-tab-index";

interface DocumentsCellProps {
	row: Row<any>;
	table: Table<any>;
	readOnly?: boolean;
}

const DocumentsCellComponent = (
	props: DocumentsCellProps & { getValue?: () => any },
) => {
	const { row, table, readOnly, getValue } = props;
	const value = getValue ? getValue() : null;

	const driveUrl = value?.driveUrl ?? row.original.driveUrl;
	const localPath = value?.localPath ?? row.original.localPath;
	const tabIndex = useCellTabIndex(table, row.original.id, "documents");

	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [editLocalPath, setEditLocalPath] = useState(localPath || "");
	const [editDriveUrl, setEditDriveUrl] = useState(driveUrl || "");

	useEffect(() => {
		if (isDialogOpen) {
			setEditLocalPath(localPath || "");
			setEditDriveUrl(driveUrl || "");
		}
	}, [isDialogOpen, localPath, driveUrl]);

	const handleSave = useCallback(() => {
		const meta = table.options.meta as any;

		let hasChanged = false;
		if (editLocalPath !== (localPath || "")) {
			meta?.updateData?.(row.original.id, "localPath", editLocalPath);
			hasChanged = true;
		}

		if (editDriveUrl !== (driveUrl || "")) {
			meta?.updateData?.(row.original.id, "driveUrl", editDriveUrl);
			hasChanged = true;
		}

		if (hasChanged) {
			toast.success("Documents updated");
		}

		setIsDialogOpen(false);
	}, [
		table.options.meta,
		row.original.id,
		editLocalPath,
		editDriveUrl,
		localPath,
		driveUrl,
	]);

	const handleOpenEdit = (e: React.MouseEvent) => {
		e.stopPropagation();
		setIsDialogOpen(true);
	};

	// If both empty, show placeholder with edit button on hover
	if (!driveUrl && !localPath) {
		return (
			<div className="flex items-center gap-1 group/doc h-full w-full py-1">
				<span className="text-muted-foreground text-sm">—</span>
				{!readOnly && (
					<button
						onClick={handleOpenEdit}
						className="opacity-0 group-hover/doc:opacity-100 text-muted-foreground hover:text-primary transition-all p-1"
						title="Edit Documents"
					>
						<Pencil className="h-3 w-3" />
					</button>
				)}
				{!readOnly && renderEditDialog()}
			</div>
		);
	}

	function renderEditDialog() {
		return (
			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent
					className="sm:max-w-[600px]"
					onClick={(e) => e.stopPropagation()}
				>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-xl">
							<Folder className="h-6 w-6 text-primary" />
							Edit Documents
						</DialogTitle>
					</DialogHeader>
					<div className="grid gap-6 py-4">
						<div className="grid gap-2">
							<label
								htmlFor="driveUrl"
								className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2"
							>
								<SiGoogledrive className="h-4 w-4" /> Google Drive URL
							</label>
							<Textarea
								id="driveUrl"
								value={editDriveUrl}
								onChange={(e) => setEditDriveUrl(e.target.value)}
								placeholder="https://drive.google.com/..."
								className="min-h-[100px] text-sm leading-relaxed"
							/>
						</div>
						<div className="grid gap-2">
							<label
								htmlFor="localPath"
								className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2"
							>
								<Folder className="h-4 w-4" /> Local / UNC Path
							</label>
							<Textarea
								id="localPath"
								value={editLocalPath}
								onChange={(e) => setEditLocalPath(e.target.value)}
								placeholder="\\server\share\folder..."
								className="min-h-[100px] text-sm leading-relaxed"
							/>
						</div>
					</div>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button variant="outline" onClick={() => setIsDialogOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleSave}>Save Changes</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<div className="flex flex-col gap-1.5 py-1 px-1 group/doc-cell">
			<div className="flex items-start justify-between gap-1">
				<div className="flex flex-col gap-1.5 min-w-0 flex-1">
					{/* Drive URL */}
					{driveUrl && (
						<div className="flex items-center gap-1.5 min-w-0">
							<Link
								href={driveUrl}
								target="_blank"
								rel="noopener noreferrer"
								tabIndex={tabIndex}
								className="flex items-center gap-1.5 text-primary hover:underline truncate flex-1"
							>
								<SiGoogledrive className="shrink-0 size-3.5" />
								<span className="text-xs font-medium">Drive</span>
							</Link>
							<CopyButton
								value={driveUrl}
								label="URL copied"
								iconSize="h-3 w-3"
							/>
						</div>
					)}

					{/* Local Path */}
					{localPath && (
						<div className="flex items-center gap-1.5 min-w-0">
							<div className="flex items-center gap-1.5 min-w-0 flex-1">
								<Folder className="h-3.5 w-3.5 shrink-0 text-primary" />
								<span
									className="text-xs font-medium text-primary truncate cursor-help"
									title={localPath}
								>
									Local
								</span>
							</div>
							<CopyButton
								value={localPath}
								label="Path copied"
								iconSize="h-3 w-3"
							/>
						</div>
					)}
				</div>

				{/* Single Edit Button for both */}
				{!readOnly && (
					<button
						onClick={handleOpenEdit}
						className="opacity-0 group-hover/doc-cell:opacity-100 text-muted-foreground hover:text-primary transition-all p-1 shrink-0 bg-secondary/50 rounded-md"
						title="Edit Documents"
					>
						<Pencil className="h-3.5 w-3.5" />
					</button>
				)}
			</div>

			{!readOnly && renderEditDialog()}
		</div>
	);
};

export const DocumentsCell = memo(DocumentsCellComponent);
