"use client";

import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";
import {
	ChevronDown,
	History,
	Loader2,
	Pencil,
	Plus,
	Trash2,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";

interface ActivityLogEntry {
	id: string;
	userId: string | null;
	userName: string | null;
	action: string;
	subResource: string | null;
	subResourceId: string | null;
	field: string | null;
	oldValue: unknown;
	newValue: unknown;
	createdAt: string;
}

interface ActivityLogPanelProps {
	jobId: string;
	apiPath: string;
	fieldLabels?: Record<string, string>;
}

type ActionColor = "blue" | "emerald" | "red" | "slate";

function getActionColor(action: string): ActionColor {
	if (action.startsWith("UPDATE")) return "blue";
	if (action.startsWith("CREATE")) return "emerald";
	if (action.startsWith("DELETE")) return "red";
	return "slate";
}

const DOT_COLORS: Record<ActionColor, string> = {
	blue: "bg-blue-400 dark:bg-blue-500",
	emerald: "bg-emerald-400 dark:bg-emerald-500",
	red: "bg-red-400 dark:bg-red-500",
	slate: "bg-slate-300 dark:bg-slate-600",
};

const USER_COLORS: Record<ActionColor, string> = {
	blue: "text-blue-600 dark:text-blue-400",
	emerald: "text-emerald-600 dark:text-emerald-400",
	red: "text-red-600 dark:text-red-400",
	slate: "text-slate-500 dark:text-slate-400",
};

function getActionIcon(action: string) {
	if (action.startsWith("UPDATE")) {
		return <Pencil className="size-3.5 text-blue-500 shrink-0 mt-0.5" />;
	}
	if (action.startsWith("CREATE")) {
		return <Plus className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />;
	}
	if (action.startsWith("DELETE")) {
		return <Trash2 className="size-3.5 text-red-500 shrink-0 mt-0.5" />;
	}
	return <History className="size-3.5 text-slate-400 shrink-0 mt-0.5" />;
}

function tryFormatDate(str: string): string | null {
	// Match ISO date strings like 2026-07-01T00:00:00.000Z or 2026-07-01
	if (!/^\d{4}-\d{2}-\d{2}/.test(str)) return null;
	try {
		const d = parseISO(str);
		if (!isValid(d)) return null;
		return format(d, "dd/MM/yyyy");
	} catch {
		return null;
	}
}

function formatValue(val: unknown): string {
	if (val === null || val === undefined) return "—";
	if (typeof val === "string") {
		return tryFormatDate(val) ?? (val === "" ? "—" : val);
	}
	if (val instanceof Date) {
		return format(val, "dd/MM/yyyy");
	}
	if (typeof val === "object") {
		const obj = val as Record<string, unknown>;
		const first = Object.values(obj)[0];
		return first !== null && first !== undefined ? String(first) : "—";
	}
	return String(val);
}

function fallbackFieldLabel(field: string): string {
	// Convert camelCase / snake_case to a readable label when no mapping is provided.
	return field
		.replace(/_/g, " ")
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.trim();
}

function getDescription(
	log: ActivityLogEntry,
	fieldLabels?: Record<string, string>,
): React.ReactNode {
	const label = log.field
		? (fieldLabels?.[log.field] ?? fallbackFieldLabel(log.field))
		: null;

	switch (log.action) {
		case "UPDATE_FIELD":
			if (label) {
				const oldStr = formatValue(log.oldValue);
				const newStr = formatValue(log.newValue);
				return (
					<>
						Updated{" "}
						<span className="font-semibold text-blue-600 dark:text-blue-400">
							{label}
						</span>
						{`: ${oldStr} → ${newStr}`}
					</>
				);
			}
			return "Updated a field";

		case "CREATE_FCR": {
			const fcrNum =
				log.newValue && typeof log.newValue === "object"
					? (log.newValue as any).fcrNumber
					: null;
			return fcrNum ? `Created FCR #${fcrNum}` : "Created FCR";
		}

		case "UPDATE_FCR":
			if (label) {
				const oldStr = formatValue(log.oldValue);
				const newStr = formatValue(log.newValue);
				return (
					<>
						Updated FCR —{" "}
						<span className="font-semibold text-blue-600 dark:text-blue-400">
							{label}
						</span>
						{`: ${oldStr} → ${newStr}`}
					</>
				);
			}
			return "Updated FCR";

		case "UPDATE_CONTAINER":
			if (label) {
				const oldStr = formatValue(log.oldValue);
				const newStr = formatValue(log.newValue);
				return (
					<>
						Updated Container —{" "}
						<span className="font-semibold text-blue-600 dark:text-blue-400">
							{label}
						</span>
						{`: ${oldStr} → ${newStr}`}
					</>
				);
			}
			return "Updated Container";

		case "CREATE_CONTAINER": {
			const cNo =
				log.newValue && typeof log.newValue === "object"
					? (log.newValue as any).containerNo
					: null;
			return cNo ? `Created Container ${cNo}` : "Created Container";
		}

		case "DELETE_CONTAINER": {
			const dNo =
				log.oldValue && typeof log.oldValue === "object"
					? (log.oldValue as any).containerNo
					: null;
			return dNo ? `Deleted Container ${dNo}` : "Deleted Container";
		}

		case "DELETE_FCR": {
			const delFcrNum =
				log.oldValue && typeof log.oldValue === "object"
					? (log.oldValue as any).fcrNumber
					: null;
			return delFcrNum ? `Deleted ${delFcrNum}` : "Deleted FCR";
		}

		case "UPDATE_CARGO_LIST": {
			const count =
				log.newValue && typeof log.newValue === "object"
					? (log.newValue as any).itemCount
					: null;
			return count != null
				? `Updated Cargo List (${count} item${count !== 1 ? "s" : ""})`
				: "Updated Cargo List";
		}

		case "UPDATE_CDS_INFO":
			if (label) {
				const oldStr = formatValue(log.oldValue);
				const newStr = formatValue(log.newValue);
				return (
					<>
						Updated CDS Info{" "}
						<span className="font-semibold text-blue-600 dark:text-blue-400">
							{label}
						</span>
						{`: ${oldStr} → ${newStr}`}
					</>
				);
			}
			return "Updated CDS Info";

		default:
			return log.action.replace(/_/g, " ").toLowerCase();
	}
}

function SubResourceBadge({ subResource }: { subResource: string | null }) {
	if (!subResource) return null;
	const colors: Record<string, string> = {
		fcr: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
		container: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
		cds_info:
			"bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
	};
	const cls =
		colors[subResource] ??
		"bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
	return (
		<span
			className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${cls}`}
		>
			{subResource}
		</span>
	);
}

export function ActivityLogPanel({
	jobId,
	apiPath,
	fieldLabels,
}: ActivityLogPanelProps) {
	const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const PAGE_SIZE = 50;

	const fetchLogs = useCallback(
		async (pageNum: number, replace: boolean) => {
			setIsLoading(true);
			setError(null);
			try {
				const res = await apiFetch(
					`${apiPath}?id=${encodeURIComponent(jobId)}&page=${pageNum}&pageSize=${PAGE_SIZE}`,
				);
				if (!res.ok) throw new Error("Failed to load activity log");
				const data = await res.json();
				setLogs((prev) => (replace ? data.logs : [...prev, ...data.logs]));
				setTotal(data.total);
				setPage(pageNum);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Unknown error");
			} finally {
				setIsLoading(false);
			}
		},
		[apiPath, jobId],
	);

	useEffect(() => {
		fetchLogs(1, true);
	}, [fetchLogs]);

	const hasMore = logs.length < total;

	return (
		<div className="flex flex-col gap-3 p-4">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<History className="size-4 text-slate-500" />
					<span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
						Activity Log
					</span>
					{total > 0 && (
						<span className="text-xs text-slate-400">({total})</span>
					)}
				</div>
				<button
					type="button"
					onClick={() => fetchLogs(1, true)}
					disabled={isLoading}
					className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
				>
					Refresh
				</button>
			</div>

			{/* Error */}
			{error && (
				<div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
					{error}
				</div>
			)}

			{/* Log list */}
			{logs.length === 0 && !isLoading ? (
				<div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
					<History className="size-8 opacity-40" />
					<p className="text-sm">No activity recorded yet</p>
					<p className="text-xs text-slate-400/70">
						Changes to this job will appear here
					</p>
				</div>
			) : (
				<ol className="relative border-l border-slate-200 dark:border-slate-700 ml-2 space-y-0">
					{logs.map((log) => {
						const color = getActionColor(log.action);
						return (
							<li key={log.id} className="mb-4 ml-4">
								{/* Timeline dot */}
								<span
									className={`absolute -left-1.5 mt-1 flex size-3 items-center justify-center rounded-full border-2 border-white dark:border-slate-900 ${DOT_COLORS[color]}`}
								/>

								<div className="flex flex-col gap-1">
									{/* Top row: icon + description + badge */}
									<div className="flex items-start gap-1.5 flex-wrap">
										{getActionIcon(log.action)}
										<span className="text-sm text-slate-800 dark:text-slate-200 leading-snug">
											{getDescription(log, fieldLabels)}
										</span>
										<SubResourceBadge subResource={log.subResource} />
									</div>

									{/* Bottom row: user + time */}
									<div className="flex items-center gap-1.5 text-xs text-slate-400">
										<span className={`font-semibold ${USER_COLORS[color]}`}>
											{log.userName ?? "Unknown user"}
										</span>
										<span>·</span>
										<span className="flex items-center gap-1">
											{format(new Date(log.createdAt), "dd/MM/yyyy HH:mm")}
											<span className="text-slate-400/80">
												(
												{formatDistanceToNow(new Date(log.createdAt), {
													addSuffix: true,
												})}
												)
											</span>
										</span>
									</div>
								</div>
							</li>
						);
					})}
				</ol>
			)}

			{/* Load more */}
			{hasMore && (
				<button
					type="button"
					onClick={() => fetchLogs(page + 1, false)}
					disabled={isLoading}
					className="flex items-center justify-center gap-1.5 w-full py-2 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
				>
					{isLoading ? (
						<Loader2 className="size-3.5 animate-spin" />
					) : (
						<ChevronDown className="size-3.5" />
					)}
					Load more ({total - logs.length} remaining)
				</button>
			)}

			{/* Loading skeleton on first load */}
			{isLoading && logs.length === 0 && (
				<div className="space-y-3 animate-pulse">
					{[...Array(4)].map((_, i) => (
						<div key={i} className="flex gap-2">
							<div className="size-3 rounded-full bg-slate-200 dark:bg-slate-700 mt-1 shrink-0" />
							<div className="flex-1 space-y-1.5">
								<div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
								<div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/3" />
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
