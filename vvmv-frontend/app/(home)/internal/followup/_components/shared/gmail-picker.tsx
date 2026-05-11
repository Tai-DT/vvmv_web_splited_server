"use client";

import {
	AlertCircle,
	ChevronDown,
	Mail,
	Paperclip,
	RefreshCw,
	Search,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";

export interface GmailAttachment {
	id: string;
	filename: string;
	mimeType: string;
	size: number;
}

interface GmailMessage {
	id: string;
	threadId: string;
	subject: string;
	from: string;
	date: string;
	snippet: string;
	attachments: GmailAttachment[];
}

interface GmailPickerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onFilesSelected: (files: File[]) => void;
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
}

/**
 * Format date to locale string
 */
function formatDate(dateStr: string): string {
	try {
		const date = new Date(dateStr);
		return date.toLocaleDateString("vi-VN", {
			day: "2-digit",
			month: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return dateStr;
	}
}

/**
 * Extract sender name from email "From" header
 */
function extractSenderName(from: string): string {
	const match = from.match(/^(.+?)\s*<.+>$/);
	if (match) {
		return match[1].replace(/"/g, "");
	}
	return from.split("@")[0];
}

/**
 * Debounce hook
 */
function useDebounce<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState<T>(value);

	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedValue(value);
		}, delay);

		return () => {
			clearTimeout(handler);
		};
	}, [value, delay]);

	return debouncedValue;
}

export function GmailPicker({
	open,
	onOpenChange,
	onFilesSelected,
}: GmailPickerProps) {
	const [messages, setMessages] = useState<GmailMessage[]>([]);
	const [loading, setLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [expandedMessage, setExpandedMessage] = useState<string | null>(null);
	const [selectedAttachments, setSelectedAttachments] = useState<
		Map<string, { messageId: string; attachment: GmailAttachment }>
	>(new Map());
	const [importing, setImporting] = useState(false);

	// Search and pagination state
	const [searchQuery, setSearchQuery] = useState("");
	const [nextPageToken, setNextPageToken] = useState<string | undefined>();
	const debouncedSearch = useDebounce(searchQuery, 300);

	// Build the query string
	const buildQuery = useCallback((userQuery: string) => {
		const baseQuery = "has:attachment";
		if (userQuery.trim()) {
			return `${baseQuery} ${userQuery.trim()}`;
		}
		return baseQuery;
	}, []);

	// Fetch messages
	const fetchMessages = useCallback(
		async (pageToken?: string) => {
			const isLoadMore = !!pageToken;
			if (isLoadMore) {
				setLoadingMore(true);
			} else {
				setLoading(true);
				setMessages([]);
			}
			setError(null);

			try {
				const query = buildQuery(debouncedSearch);
				const params = new URLSearchParams({
					maxResults: "10",
					q: query,
				});
				if (pageToken) {
					params.set("pageToken", pageToken);
				}

				const response = await fetch(`/api/gmail/messages?${params}`);
				const data = await response.json();

				if (!response.ok) {
					throw new Error(
						data.message || data.error || "Failed to fetch emails",
					);
				}

				if (isLoadMore) {
					setMessages((prev) => [...prev, ...(data.messages || [])]);
				} else {
					setMessages(data.messages || []);
				}
				setNextPageToken(data.nextPageToken);
			} catch (err: unknown) {
				const message =
					err instanceof Error ? err.message : "Failed to fetch emails";
				setError(message);
				console.error("Error fetching Gmail messages:", err);
			} finally {
				setLoading(false);
				setLoadingMore(false);
			}
		},
		[debouncedSearch, buildQuery],
	);

	// Fetch messages when dialog opens or search changes
	useEffect(() => {
		if (open) {
			fetchMessages();
		} else {
			// Reset state when closing
			setSelectedAttachments(new Map());
			setExpandedMessage(null);
			setError(null);
			setSearchQuery("");
			setNextPageToken(undefined);
		}
	}, [open, fetchMessages]);

	const toggleAttachment = (messageId: string, attachment: GmailAttachment) => {
		const key = `${messageId}-${attachment.id}`;
		setSelectedAttachments((prev) => {
			const newMap = new Map(prev);
			if (newMap.has(key)) {
				newMap.delete(key);
			} else {
				newMap.set(key, { messageId, attachment });
			}
			return newMap;
		});
	};

	const toggleAllAttachments = (message: GmailMessage, checked: boolean) => {
		setSelectedAttachments((prev) => {
			const newMap = new Map(prev);
			message.attachments.forEach((attachment) => {
				const key = `${message.id}-${attachment.id}`;
				if (checked) {
					newMap.set(key, { messageId: message.id, attachment });
				} else {
					newMap.delete(key);
				}
			});
			return newMap;
		});
	};

	const handleImport = async () => {
		if (selectedAttachments.size === 0) {
			toast.error("Please select at least one attachment");
			return;
		}

		setImporting(true);

		try {
			// Group attachments by messageId for efficient API calls
			const groupedByMessage = new Map<
				string,
				Array<{ id: string; filename: string; mimeType: string }>
			>();

			for (const [, value] of selectedAttachments) {
				const { messageId, attachment } = value;
				if (!groupedByMessage.has(messageId)) {
					groupedByMessage.set(messageId, []);
				}
				groupedByMessage.get(messageId)?.push({
					id: attachment.id,
					filename: attachment.filename,
					mimeType: attachment.mimeType,
				});
			}

			// Download attachments from each message
			const allFiles: File[] = [];

			for (const [messageId, attachments] of groupedByMessage) {
				const response = await fetch("/api/gmail/attachments", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ messageId, attachments }),
				});

				if (!response.ok) {
					const data = await response.json();
					throw new Error(data.message || "Failed to download attachments");
				}

				const data = await response.json();

				// Convert base64 data to File objects
				for (const file of data.files) {
					const byteCharacters = atob(file.data);
					const byteNumbers = new Array(byteCharacters.length);
					for (let i = 0; i < byteCharacters.length; i++) {
						byteNumbers[i] = byteCharacters.charCodeAt(i);
					}
					const byteArray = new Uint8Array(byteNumbers);
					const blob = new Blob([byteArray], { type: file.mimeType });
					const fileObj = new File([blob], file.filename, {
						type: file.mimeType,
					});
					allFiles.push(fileObj);
				}
			}

			toast.success(`Imported ${allFiles.length} file(s) from Gmail`);
			onFilesSelected(allFiles);
			onOpenChange(false);
		} catch (err: unknown) {
			const message =
				err instanceof Error ? err.message : "Failed to import attachments";
			toast.error(message);
			console.error("Error importing Gmail attachments:", err);
		} finally {
			setImporting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Mail className="size-5" />
						Import from Gmail
					</DialogTitle>
				</DialogHeader>

				{/* Search Bar */}
				<div className="flex items-center gap-2 pb-2 border-b">
					<div className="relative flex-1">
						<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
						<Input
							placeholder="Search emails (e.g. job number, subject, sender...)"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-9"
						/>
					</div>
					<Button
						variant="outline"
						size="icon"
						onClick={() => fetchMessages()}
						disabled={loading}
						title="Refresh"
					>
						<RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
					</Button>
				</div>

				<div className="flex-1 overflow-y-auto min-h-0">
					{/* Loading State */}
					{loading && (
						<div className="flex items-center justify-center py-12">
							<RefreshCw className="size-6 animate-spin text-muted-foreground" />
							<span className="ml-2 text-muted-foreground">
								Loading emails...
							</span>
						</div>
					)}

					{/* Error State */}
					{error && !loading && (
						<div className="flex flex-col items-center justify-center py-12 gap-4">
							<AlertCircle className="size-12 text-destructive" />
							<p className="text-center text-destructive">{error}</p>
							<Button variant="outline" onClick={() => fetchMessages()}>
								<RefreshCw className="size-4 mr-2" />
								Try Again
							</Button>
						</div>
					)}

					{/* Empty State */}
					{!loading && !error && messages.length === 0 && (
						<div className="flex flex-col items-center justify-center py-12 gap-2">
							<Mail className="size-12 text-muted-foreground" />
							<p className="text-muted-foreground">
								{searchQuery
									? "No emails found matching your search"
									: "No emails with attachments found"}
							</p>
						</div>
					)}

					{/* Message List */}
					{!loading && !error && messages.length > 0 && (
						<div className="space-y-2">
							{messages.map((message) => {
								const hasSelectedInMessage = Array.from(
									selectedAttachments.keys(),
								).some((k) => k.startsWith(`${message.id}-`));
								const isExpanded = expandedMessage === message.id;

								return (
									<div
										key={message.id}
										className={cn(
											"group border rounded-xl overflow-hidden transition-all duration-300 relative",
											isExpanded
												? "ring-2 ring-primary/30 border-primary/40 shadow-xl bg-card"
												: "hover:border-primary/40 hover:shadow-lg bg-transparent",
											hasSelectedInMessage &&
												!isExpanded &&
												"bg-gradient-to-r from-primary/[0.08] to-transparent border-primary/30 shadow-md",
										)}
									>
										{/* Message Header */}
										<button
											type="button"
											className={cn(
												"w-full p-4 text-left transition-all duration-300 relative overflow-hidden",
												isExpanded
													? "bg-gradient-to-b from-primary/[0.08] to-transparent"
													: "hover:bg-muted/60",
											)}
											onClick={() =>
												setExpandedMessage(
													expandedMessage === message.id ? null : message.id,
												)
											}
										>
											{/* Active indicator for selected files with glow */}
											{hasSelectedInMessage && (
												<div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-primary to-blue-400 shadow-[0_0_12px_rgba(var(--primary),0.6)] z-20" />
											)}

											<div className="flex items-start justify-between gap-3 relative z-10">
												<div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
													<Mail
														className={cn(
															"size-5 transition-colors",
															hasSelectedInMessage
																? "text-primary"
																: "text-muted-foreground",
														)}
													/>
												</div>

												<div className="min-w-0 flex-1 py-0.5">
													<p
														className={cn(
															"font-semibold truncate text-[15px] transition-colors",
															isExpanded ? "text-primary" : "text-foreground",
														)}
													>
														{message.subject}
													</p>
													<div className="flex items-center gap-2 mt-0.5">
														<span className="text-sm font-medium text-muted-foreground truncate max-w-[180px]">
															{extractSenderName(message.from)}
														</span>
														<span className="shrink-0 text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted/50 border border-slate-200 dark:border-slate-800">
															{formatDate(message.date)}
														</span>
													</div>
												</div>

												<div className="flex flex-col items-end gap-2 shrink-0">
													<Badge
														variant={
															hasSelectedInMessage ? "default" : "secondary"
														}
														className={cn(
															"gap-1 px-2.5 py-0.5 rounded-full transition-all duration-300",
															hasSelectedInMessage
																? "bg-primary shadow-sm hover:bg-primary/90"
																: "bg-muted/80",
														)}
													>
														<Paperclip className="size-3" />
														<span className="text-[11px] font-bold">
															{message.attachments.length}
														</span>
													</Badge>
													<ChevronDown
														className={cn(
															"size-4 text-muted-foreground transition-transform duration-300",
															isExpanded
																? "rotate-180 text-primary"
																: "group-hover:translate-y-0.5",
														)}
													/>
												</div>
											</div>
										</button>

										{/* Attachment List (Expanded) */}
										{expandedMessage === message.id && (
											<div className="border-t bg-muted/20 p-3 space-y-2">
												{/* Select All Toggle */}
												{message.attachments.length > 1 && (
													<div className="flex items-center gap-3 px-2 py-1.5 mb-1 bg-muted/60 rounded border border-dashed border-muted-foreground/40 shadow-sm">
														<Checkbox
															id={`select-all-${message.id}`}
															checked={message.attachments.every((a) =>
																selectedAttachments.has(
																	`${message.id}-${a.id}`,
																),
															)}
															onCheckedChange={(checked) =>
																toggleAllAttachments(message, !!checked)
															}
														/>
														<label
															htmlFor={`select-all-${message.id}`}
															className="text-xs font-bold text-foreground cursor-pointer flex-1"
														>
															Tất cả đính kèm ({message.attachments.length})
														</label>
													</div>
												)}

												{message.attachments.map((attachment) => {
													const key = `${message.id}-${attachment.id}`;
													const isSelected = selectedAttachments.has(key);

													return (
														<button
															type="button"
															key={attachment.id}
															className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors w-full text-left ${
																isSelected
																	? "bg-primary/10 border border-primary/30"
																	: "hover:bg-muted/50"
															}`}
															onClick={() =>
																toggleAttachment(message.id, attachment)
															}
														>
															<Checkbox
																checked={isSelected}
																onCheckedChange={() =>
																	toggleAttachment(message.id, attachment)
																}
																onClick={(e) => e.stopPropagation()}
															/>
															<Paperclip className="size-4 text-muted-foreground shrink-0" />
															<span className="flex-1 truncate text-sm">
																{attachment.filename}
															</span>
															<span className="text-xs text-muted-foreground shrink-0">
																{formatFileSize(attachment.size)}
															</span>
														</button>
													);
												})}
											</div>
										)}
									</div>
								);
							})}

							{/* Load More Button */}
							{nextPageToken && (
								<div className="flex justify-center pt-2">
									<Button
										variant="outline"
										onClick={() => fetchMessages(nextPageToken)}
										disabled={loadingMore}
										className="gap-2"
									>
										{loadingMore ? (
											<>
												<RefreshCw className="size-4 animate-spin" />
												Loading...
											</>
										) : (
											<>
												<ChevronDown className="size-4" />
												Load More Emails
											</>
										)}
									</Button>
								</div>
							)}
						</div>
					)}
				</div>

				<DialogFooter className="border-t pt-4 mt-4">
					<div className="flex items-center justify-between w-full">
						<span className="text-sm text-muted-foreground">
							{selectedAttachments.size} file(s) selected
							{messages.length > 0 && ` • ${messages.length} emails loaded`}
						</span>
						<div className="flex gap-2">
							<Button variant="outline" onClick={() => onOpenChange(false)}>
								Cancel
							</Button>
							<Button
								onClick={handleImport}
								disabled={selectedAttachments.size === 0 || importing}
							>
								{importing ? (
									<>
										<RefreshCw className="size-4 mr-2 animate-spin" />
										Importing...
									</>
								) : (
									<>
										<Mail className="size-4 mr-2" />
										Import Selected
									</>
								)}
							</Button>
						</div>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
