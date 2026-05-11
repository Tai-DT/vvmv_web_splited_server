"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { CellContext } from "@tanstack/react-table";
import {
	ExternalLink,
	Link2,
	Loader2,
	Plus,
	Trash2,
	Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverPositioner,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Tooltip,
	TooltipContent,
	TooltipPositioner,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TruckingFollowUpRow } from "../../types";

type DriveUrlsCellProps = CellContext<TruckingFollowUpRow, unknown> & {
	onUpdate?: (id: string, field: string, value: string[]) => void;
	readOnly?: boolean;
};

export function DriveUrlsCell({
	row,
	column,
	table,
	onUpdate,
	readOnly = false,
}: DriveUrlsCellProps) {
	const queryClient = useQueryClient();
	const containers = row.original.containers || [];
	const hasContainers = containers.length > 0;
	const [isOpen, setIsOpen] = useState(false);
	const [urls, setUrls] = useState<string[]>([]);
	const [newUrl, setNewUrl] = useState("");
	const [isUploading, setIsUploading] = useState(false);
	const [selectedContainerId, setSelectedContainerId] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const updateData =
		onUpdate ??
		((table.options.meta as any)?.updateData as
			| ((id: string, field: string, value: string[]) => void)
			| undefined);

	const originalValue = row.getValue(column.id);

	// Initialize urls from row data
	useEffect(() => {
		if (Array.isArray(originalValue)) {
			setUrls(originalValue as string[]);
		} else if (typeof originalValue === "string" && originalValue) {
			setUrls([originalValue]);
		} else {
			setUrls([]);
		}
	}, [originalValue]);

	useEffect(() => {
		if (!hasContainers) {
			setSelectedContainerId("");
			return;
		}

		const firstContainerId = containers[0]?.id || "";
		setSelectedContainerId((prev) => {
			if (prev && containers.some((container) => container.id === prev)) {
				return prev;
			}
			return firstContainerId;
		});
	}, [containers, hasContainers]);

	const handleAddUrl = useCallback(() => {
		if (newUrl.trim()) {
			const updatedUrls = [...urls, newUrl.trim()];
			setUrls(updatedUrls);
			setNewUrl("");
			updateData?.(row.original.id, column.id, updatedUrls);
			inputRef.current?.focus();
		}
	}, [newUrl, urls, updateData, row.original.id, column.id]);

	const handleRemoveUrl = useCallback(
		(index: number) => {
			const updatedUrls = urls.filter((_, i) => i !== index);
			setUrls(updatedUrls);
			updateData?.(row.original.id, column.id, updatedUrls);
		},
		[urls, updateData, row.original.id, column.id],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				handleAddUrl();
			}
		},
		[handleAddUrl],
	);

	const openUrl = useCallback((url: string) => {
		window.open(url, "_blank", "noopener,noreferrer");
	}, []);

	const handleUploadFiles = useCallback(
		async (fileList: FileList | null) => {
			const files = Array.from(fileList || []);
			if (files.length === 0) return;

			setIsUploading(true);
			try {
				if (hasContainers && !selectedContainerId) {
					throw new Error("Vui lòng chọn container để cập nhật POD");
				}

				const formData = new FormData();
				formData.append("truckingFollowUpId", row.original.id);
				if (selectedContainerId) {
					formData.append("containerId", selectedContainerId);
				}
				files.forEach((file) => formData.append("files", file));

				const response = await fetch("/api/trucking-followup/ccgh/upload", {
					method: "POST",
					body: formData,
				});

				const result = await response.json();
				if (!response.ok) {
					throw new Error(result.message || "Upload CCGH thất bại");
				}

				const updatedUrls = Array.isArray(result.ccgh) ? result.ccgh : urls;
				setUrls(updatedUrls);
				fileInputRef.current!.value = "";
				queryClient.invalidateQueries({ queryKey: ["trucking-followups"] });

				toast.success(`Đã upload ${files.length} file CCGH`, {
					description: result.folderUrl || undefined,
				});
			} catch (error) {
				toast.error(
					error instanceof Error ? error.message : "Upload CCGH thất bại",
				);
			} finally {
				setIsUploading(false);
			}
		},
		[hasContainers, queryClient, row.original.id, selectedContainerId, urls],
	);

	const handleFileInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			void handleUploadFiles(e.target.files);
		},
		[handleUploadFiles],
	);

	// Extract domain name for display
	const getDomainName = (url: string) => {
		try {
			const urlObj = new URL(url);
			return urlObj.hostname.replace("www.", "");
		} catch {
			return url.length > 25 ? `${url.substring(0, 25)}...` : url;
		}
	};

	return (
		<div className="flex items-center gap-1 w-full h-full">
			{/* Show first URL as clickable link if available */}
			{urls.length > 0 ? (
				<Tooltip>
					<TooltipTrigger
						onClick={() => openUrl(urls[0])}
						className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 truncate max-w-[80px] cursor-pointer"
					>
						<ExternalLink className="size-3 shrink-0" />
						<span className="truncate">{getDomainName(urls[0])}</span>
					</TooltipTrigger>
					<TooltipPositioner>
						<TooltipContent className="max-w-xs">
							<p className="text-xs break-all">{urls[0]}</p>
						</TooltipContent>
					</TooltipPositioner>
				</Tooltip>
			) : (
				<span className="text-xs text-slate-400">-</span>
			)}

			{/* Show count badge if more than 1 URL */}
			{urls.length > 1 && (
				<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium">
					+{urls.length - 1}
				</span>
			)}

			{/* Edit button / Popover */}
			<Popover open={isOpen} onOpenChange={setIsOpen}>
				<PopoverTrigger className="h-5 w-5 p-0 ml-auto shrink-0 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center rounded">
					<Link2 className="size-3" />
				</PopoverTrigger>
				<PopoverPositioner>
					<PopoverContent className="w-80 p-3">
						<div className="space-y-3">
							<div className="text-xs font-medium text-slate-700 dark:text-slate-300">
								Quản lý CCGH Links ({urls.length})
							</div>

							{!readOnly && (
								<div className="space-y-2">
									{hasContainers && (
										<div className="space-y-1">
											<label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
												Chọn container để cập nhật POD URL
											</label>
											<select
												value={selectedContainerId}
												onChange={(e) => setSelectedContainerId(e.target.value)}
												disabled={isUploading}
												className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
											>
												<option value="">Chọn container...</option>
												{containers.map((container, index) => (
													<option key={container.id} value={container.id}>
														{container.containerNo?.trim() ||
															`Container ${index + 1}`}
													</option>
												))}
											</select>
										</div>
									)}

									<div className="flex items-center gap-2">
										<input
											ref={fileInputRef}
											type="file"
											multiple
											className="hidden"
											onChange={handleFileInputChange}
										/>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => fileInputRef.current?.click()}
											disabled={isUploading}
											className="h-8 text-xs"
										>
											{isUploading ? (
												<Loader2 className="mr-1 size-3 animate-spin" />
											) : (
												<Upload className="mr-1 size-3" />
											)}
											Upload file
										</Button>
										<span className="text-[11px] text-slate-500">
											{hasContainers
												? "Upload vào sub folder TRUCKING và cập nhật POD của container đã chọn"
												: "Tự upload vào sub folder TRUCKING"}
										</span>
									</div>
								</div>
							)}

							{/* List of existing URLs */}
							<div className="space-y-1.5 max-h-[200px] overflow-y-auto">
								{urls.length === 0 ? (
									<p className="text-xs text-slate-400 py-2 text-center">
										Chưa có link nào
									</p>
								) : (
									urls.map((url, index) => (
										<div
											key={index}
											className="flex items-center gap-2 p-2 rounded-md bg-slate-50 dark:bg-slate-800 group"
										>
											<button
												type="button"
												onClick={() => openUrl(url)}
												className="flex-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 truncate text-left"
												title={url}
											>
												{getDomainName(url)}
											</button>
											{!readOnly && (
												<Button
													variant="ghost"
													size="sm"
													onClick={() => handleRemoveUrl(index)}
													className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
												>
													<Trash2 className="size-3" />
												</Button>
											)}
										</div>
									))
								)}
							</div>

							{/* Add new URL input */}
							{!readOnly && (
								<div className="flex gap-2">
									<Input
										ref={inputRef}
										value={newUrl}
										onChange={(e) => setNewUrl(e.target.value)}
										onKeyDown={handleKeyDown}
										placeholder="Nhập URL mới..."
										className="h-8 text-xs"
									/>
									<Button
										size="sm"
										onClick={handleAddUrl}
										disabled={!newUrl.trim() || isUploading}
										className="h-8 px-2"
									>
										<Plus className="size-3" />
									</Button>
								</div>
							)}
						</div>
					</PopoverContent>
				</PopoverPositioner>
			</Popover>
		</div>
	);
}
