"use client";

import { File, Mail, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { GmailPicker } from "./gmail-picker";

interface FileUploadProps {
	files: File[];
	onChange: (files: File[]) => void;
	maxFiles?: number; // default 10
	accept?: string;
	disabled?: boolean;
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
	if (bytes === 0) return "0 Bytes";
	const k = 1024;
	const sizes = ["Bytes", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Math.round((bytes / k ** i) * 100) / 100}${sizes[i]}`;
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
	const ext = filename.split(".").pop()?.toLowerCase() || "";
	return ext.toUpperCase();
}

/**
 * Get badge color based on file type
 */
function getFileTypeBadgeColor(filename: string): string {
	const ext = filename.split(".").pop()?.toLowerCase() || "";
	if (["pdf"].includes(ext))
		return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
	if (["doc", "docx", "xls", "xlsx"].includes(ext))
		return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
	if (["jpg", "jpeg", "png", "gif", "svg"].includes(ext))
		return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
	if (["zip", "rar"].includes(ext))
		return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
	return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
}

export function FileUpload({
	files,
	onChange,
	maxFiles = 10,
	accept,
	disabled = false,
}: FileUploadProps) {
	const [isDragging, setIsDragging] = useState(false);
	const [gmailPickerOpen, setGmailPickerOpen] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		if (!disabled) {
			setIsDragging(true);
		}
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);

		if (disabled) return;

		const droppedFiles = Array.from(e.dataTransfer.files);
		const newFiles = [...files, ...droppedFiles].slice(0, maxFiles);
		onChange(newFiles);
	};

	const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files) {
			const selectedFiles = Array.from(e.target.files);
			const newFiles = [...files, ...selectedFiles].slice(0, maxFiles);
			onChange(newFiles);
			// Reset input so same file can be selected again
			e.target.value = "";
		}
	};

	const handleBrowseClick = () => {
		fileInputRef.current?.click();
	};

	const handleRemoveFile = (index: number) => {
		const newFiles = files.filter((_, i) => i !== index);
		onChange(newFiles);
	};

	const handleRemoveAll = () => {
		onChange([]);
	};

	const handleGmailFilesSelected = (gmailFiles: File[]) => {
		const newFiles = [...files, ...gmailFiles].slice(0, maxFiles);
		onChange(newFiles);
	};

	return (
		<div className="space-y-4">
			<div className="grid grid-cols-1 gap-3">
				{/* Local Upload Section - Matches Gmail style */}
				<div
					onDragOver={handleDragOver}
					onDragLeave={handleDragLeave}
					onDrop={handleDrop}
					onClick={!disabled ? handleBrowseClick : undefined}
					className={`
            relative p-1 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border transition-all duration-200
            ${
							isDragging
								? "border-primary ring-2 ring-primary/20 bg-primary/5 scale-[1.01]"
								: "border-blue-100 dark:border-blue-900/30 hover:border-blue-300 dark:hover:border-blue-700 shadow-sm"
						}
            ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
          `}
				>
					<input
						ref={fileInputRef}
						type="file"
						multiple
						accept={accept}
						onChange={handleFileInputChange}
						disabled={disabled}
						className="hidden"
					/>

					<div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between px-3 py-2">
						<div className="flex items-center gap-3">
							<div className="size-9 rounded-lg bg-white dark:bg-zinc-900 shadow-sm border flex items-center justify-center">
								<Upload
									className={`size-5 ${isDragging ? "text-primary animate-bounce font-bold" : "text-blue-500"}`}
								/>
							</div>
							<div>
								<p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
									{isDragging ? "Drop files now" : "Local File Upload"}
								</p>
								<p className="text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px] sm:max-w-none">
									{isDragging
										? "Release to add files"
										: "Select or drop files from your device"}
								</p>
							</div>
						</div>
						<Button
							type="button"
							variant="default"
							size="sm"
							disabled={disabled}
							className="bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm transition-all active:scale-95"
							onClick={(e) => {
								e.stopPropagation();
								handleBrowseClick();
							}}
						>
							Browse Files
						</Button>
					</div>
				</div>

				{/* Gmail Import Section - Consistent UI */}
				<div className="p-1 rounded-xl bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border border-red-100 dark:border-red-900/30 shadow-sm">
					<div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between px-3 py-2">
						<div className="flex items-center gap-3">
							<div className="size-9 rounded-lg bg-white dark:bg-zinc-900 shadow-sm border flex items-center justify-center">
								<Mail className="size-5 text-red-500" />
							</div>
							<div>
								<p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
									Smart Gmail Import
								</p>
								<p className="text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px] sm:max-w-none">
									Quickly attach files from your emails
								</p>
							</div>
						</div>
						<Button
							type="button"
							variant="default"
							size="sm"
							onClick={() => setGmailPickerOpen(true)}
							disabled={disabled}
							className="bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm transition-all active:scale-95"
						>
							Connect Gmail
						</Button>
					</div>
				</div>
			</div>

			{/* Gmail Picker Modal */}
			<GmailPicker
				open={gmailPickerOpen}
				onOpenChange={setGmailPickerOpen}
				onFilesSelected={handleGmailFilesSelected}
			/>

			{/* File List */}
			{files.length > 0 && (
				<div className="space-y-4">
					{/* Header */}
					<div className="flex items-center justify-between">
						<h3 className="text-sm font-semibold">Files ({files.length})</h3>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={handleRemoveAll}
							disabled={disabled}
							className="gap-1"
						>
							<Trash2 className="size-4" />
							Remove all
						</Button>
					</div>

					{/* File Table */}
					<div className="rounded-lg border overflow-hidden">
						<table className="w-full table-fixed">
							<thead>
								<tr className="border-b bg-muted/50">
									<th className="p-3 text-left text-sm font-medium text-muted-foreground">
										Name
									</th>
									<th className="p-3 text-left text-sm font-medium text-muted-foreground w-24">
										Type
									</th>
									<th className="p-3 text-left text-sm font-medium text-muted-foreground w-28">
										Size
									</th>
									<th className="p-3 w-16"></th>
								</tr>
							</thead>
							<tbody>
								{files.map((file, index) => (
									<tr
										key={`${file.name}-${index}`}
										className="border-b last:border-0 hover:bg-muted/30 transition-colors"
									>
										{/* File Name */}
										<td className="p-3">
											<div className="flex items-center gap-2 min-w-0">
												<File className="size-4 text-muted-foreground flex-shrink-0" />
												<span className="text-sm truncate" title={file.name}>
													{file.name}
												</span>
											</div>
										</td>

										{/* File Type */}
										<td className="p-3 w-24">
											<span
												className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap ${getFileTypeBadgeColor(file.name)}`}
											>
												{getFileExtension(file.name)}
											</span>
										</td>

										{/* File Size */}
										<td className="p-3 text-sm text-muted-foreground w-28 whitespace-nowrap">
											{formatFileSize(file.size)}
										</td>

										{/* Actions */}
										<td className="p-3">
											<div className="flex items-center justify-end">
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={() => handleRemoveFile(index)}
													disabled={disabled}
													className="size-8 p-0 text-destructive hover:text-destructive"
													title="Remove"
												>
													<Trash2 className="size-4" />
												</Button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</div>
	);
}
