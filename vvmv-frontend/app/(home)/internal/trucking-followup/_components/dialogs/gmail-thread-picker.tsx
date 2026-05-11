"use client";

import {
	AlertCircle,
	ChevronDown,
	ChevronRight,
	Mail,
	RefreshCw,
	Reply,
	Search,
	X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export interface GmailThread {
	id: string;
	threadId: string;
	lastMessageId: string;
	subject: string;
	from: string;
	to: string;
	cc?: string;
	date: string;
	snippet: string;
	messageCount: number;
	inReplyTo: string;
	references: string;
	messages?: GmailThread[];
}

interface GmailThreadPickerProps {
	onSelect: (thread: GmailThread) => void;
}

function formatDate(value: string) {
	try {
		const date = new Date(value);
		return date.toLocaleDateString("vi-VN", {
			day: "2-digit",
			month: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return value;
	}
}

function senderName(from: string) {
	const match = from.match(/^(.+?)\s*<.+>$/);
	return match ? match[1].replace(/"/g, "") : from.split("@")[0];
}

export function GmailThreadPicker({ onSelect }: GmailThreadPickerProps) {
	const [threads, setThreads] = useState<GmailThread[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [nextPageToken, setNextPageToken] = useState<string | undefined>();
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [expandedThreads, setExpandedThreads] = useState<Set<string>>(
		new Set(),
	);

	const toggleExpand = (threadId: string, e: React.MouseEvent) => {
		e.stopPropagation();
		setExpandedThreads((prev) => {
			const next = new Set(prev);
			if (next.has(threadId)) {
				next.delete(threadId);
			} else {
				next.add(threadId);
			}
			return next;
		});
	};

	useEffect(() => {
		const timeoutId = setTimeout(() => setDebouncedSearch(search), 350);
		return () => clearTimeout(timeoutId);
	}, [search]);

	const fetchThreads = useCallback(
		async (query: string, pageToken?: string) => {
			if (pageToken) {
				setLoadingMore(true);
			} else {
				setLoading(true);
				setThreads([]);
			}
			setError(null);

			try {
				const params = new URLSearchParams({
					maxResults: "15",
					q: query || "label:INBOX OR label:SENT",
				});
				if (pageToken) params.set("pageToken", pageToken);

				const response = await fetch(`/api/gmail/threads?${params}`);
				const data = await response.json();
				if (!response.ok) {
					throw new Error(
						data.message || data.error || "Failed to fetch threads",
					);
				}

				if (pageToken) {
					setThreads((prev) => [...prev, ...(data.threads || [])]);
				} else {
					setThreads(data.threads || []);
				}
				setNextPageToken(data.nextPageToken);
			} catch (err: any) {
				setError(err.message || "Failed to fetch threads");
			} finally {
				setLoading(false);
				setLoadingMore(false);
			}
		},
		[],
	);

	useEffect(() => {
		fetchThreads(
			debouncedSearch
				? `(label:INBOX OR label:SENT) ${debouncedSearch}`
				: "label:INBOX OR label:SENT",
		);
	}, [debouncedSearch, fetchThreads]);

	return (
		<div className="flex flex-col gap-0 flex-1 min-h-0">
			<div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
				<div className="relative">
					<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Tìm email theo tiêu đề, người gửi..."
						className="w-full pl-8 pr-8 py-1.5 text-[12px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition"
					/>
					{search && (
						<button
							type="button"
							onClick={() => setSearch("")}
							className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
						>
							<X className="size-3" />
						</button>
					)}
				</div>
			</div>

			<div className="flex-1 overflow-y-auto min-h-0">
				{loading && (
					<div className="flex items-center justify-center py-12 text-slate-400 gap-2">
						<RefreshCw className="size-4 animate-spin" />
						<span className="text-[12px]">Đang tải hộp thư...</span>
					</div>
				)}

				{error && !loading && (
					<div className="flex flex-col items-center justify-center py-12 gap-3 text-red-500 px-6">
						<AlertCircle className="size-8 opacity-40" />
						<p className="text-[12px] text-center">{error}</p>
						<button
							type="button"
							onClick={() =>
								fetchThreads(debouncedSearch || "label:INBOX OR label:SENT")
							}
							className="text-[11px] underline text-blue-500"
						>
							Thử lại
						</button>
					</div>
				)}

				{!loading && !error && threads.length === 0 && (
					<div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
						<Mail className="size-8 opacity-30" />
						<p className="text-[12px]">Không tìm thấy email</p>
					</div>
				)}

				{!loading && !error && threads.length > 0 && (
					<div className="divide-y divide-slate-100 dark:divide-slate-800">
						{threads.map((thread) => {
							const isExpanded = expandedThreads.has(thread.id);
							const hasMultiple =
								(thread.messages?.length || thread.messageCount) > 1;

							return (
								<div key={thread.id} className="flex flex-col">
									<button
										type="button"
										onClick={(e) => {
											if (hasMultiple) {
												toggleExpand(thread.id, e);
											} else {
												onSelect(thread);
											}
										}}
										className="w-full text-left px-5 py-3 hover:bg-blue-50 dark:hover:bg-slate-800/60 transition-colors group"
									>
										<div className="flex items-start gap-3">
											<div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 shrink-0 mt-0.5">
												<Reply className="size-3.5 text-blue-600 dark:text-blue-400" />
											</div>
											<div className="flex-1 min-w-0">
												<p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
													{thread.subject}
													{hasMultiple && (
														<span className="text-slate-400">
															{isExpanded ? (
																<ChevronDown className="size-3.5" />
															) : (
																<ChevronRight className="size-3.5" />
															)}
														</span>
													)}
												</p>
												<div className="flex items-center gap-2 mt-0.5">
													<span className="text-[11px] text-slate-500 truncate max-w-[200px]">
														{senderName(thread.from)}
													</span>
													{hasMultiple && (
														<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-semibold tabular-nums">
															{thread.messages?.length || thread.messageCount}
														</span>
													)}
													<span className="text-[10px] text-slate-400 ml-auto shrink-0">
														{formatDate(thread.date)}
													</span>
												</div>
												<p className="text-[11px] text-slate-400 truncate mt-0.5">
													{thread.snippet}
												</p>
											</div>
										</div>
									</button>

									{/* Expanded Messages */}
									{isExpanded && thread.messages && (
										<div className="bg-slate-50 dark:bg-slate-900/50 border-t border-b border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
											{thread.messages.map((msg) => (
												<button
													key={msg.lastMessageId}
													type="button"
													onClick={() => onSelect(msg)}
													className="w-full text-left pl-14 pr-5 py-2.5 hover:bg-blue-50/50 dark:hover:bg-slate-800/40 transition-colors group flex items-start gap-3"
												>
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-2">
															<span className="text-[12px] font-medium text-slate-700 dark:text-slate-200 truncate">
																{senderName(msg.from)}
															</span>
															<span className="text-[10px] text-slate-400 ml-auto shrink-0">
																{formatDate(msg.date)}
															</span>
														</div>
														<div className="mt-1 flex flex-col gap-1">
															{msg.to && (
																<div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
																	<span className="font-medium text-slate-400 dark:text-slate-500 w-4 shrink-0 leading-[1.35]">
																		To:
																	</span>
																	<span className="flex-1 break-words leading-[1.35]">
																		{msg.to}
																	</span>
																</div>
															)}
															{msg.cc && (
																<div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
																	<span className="font-medium text-slate-400 dark:text-slate-500 w-4 shrink-0 leading-[1.35]">
																		Cc:
																	</span>
																	<span className="flex-1 break-words leading-[1.35]">
																		{msg.cc}
																	</span>
																</div>
															)}
														</div>
														<p className="text-[11px] text-slate-400 truncate mt-1">
															{msg.snippet || "Không có nội dung"}
														</p>
													</div>
													<div className="opacity-0 group-hover:opacity-100 transition-opacity">
														<Reply className="size-3.5 text-blue-500 mt-1" />
													</div>
												</button>
											))}
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}

				{nextPageToken && !loading && (
					<div className="flex justify-center py-3">
						<button
							type="button"
							onClick={() =>
								fetchThreads(
									debouncedSearch || "label:INBOX OR label:SENT",
									nextPageToken,
								)
							}
							disabled={loadingMore}
							className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-blue-600 px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 transition-colors"
						>
							{loadingMore ? (
								<>
									<RefreshCw className="size-3 animate-spin" /> Đang tải...
								</>
							) : (
								<>
									<ChevronDown className="size-3" /> Tải thêm
								</>
							)}
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
