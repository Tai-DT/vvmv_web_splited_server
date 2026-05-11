"use client";

import type { InvokerTask } from "../../types";
import { StatusBadge } from "../cells/badge-cell";
import { UserDisplay } from "../cells/user-display";

interface InvokerTasksPanelProps {
	tasks: InvokerTask[];
}

/**
 * Collapsible panel for displaying invoker tasks
 * Shows: Task Name | Status | Triggered By | Message | Created | Started | Completed | Machine
 */
export function InvokerTasksPanel({ tasks = [] }: InvokerTasksPanelProps) {
	// Ensure tasks is an array
	const taskList = Array.isArray(tasks) ? tasks : [];

	const formatDate = (dateValue: any) => {
		if (!dateValue) return "—";
		try {
			const date = new Date(dateValue);
			if (Number.isNaN(date.getTime())) return "—";
			return date.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
			});
		} catch {
			return "—";
		}
	};

	// Convert email to user object for UserDisplay (fallback if no DB user found)
	const emailToUser = (email: string | null) => {
		if (!email || typeof email !== "string") return null;
		const namePart = email.split("@")[0];
		if (!namePart) return { email, name: email };

		// Convert email prefix to name (e.g., "john.doe" -> "John Doe")
		const name = namePart
			.replace(/[._]/g, " ")
			.split(" ")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(" ");
		return {
			id: email,
			email,
			name,
		};
	};

	// Get user to display: prefer DB user, fallback to parsed email
	const getDisplayUser = (task: InvokerTask) => {
		if (!task) return null;
		if (task.triggered_by_user) {
			return task.triggered_by_user;
		}
		return emailToUser(task.user_account);
	};

	if (taskList.length === 0) {
		return (
			<div className="p-8 text-center text-muted-foreground text-xs italic">
				No tasks found for this job.
			</div>
		);
	}

	return (
		<div className="p-4 space-y-4">
			{/* Desktop: Table view (md and above) */}
			<div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
				<table className="text-xs w-full">
					<thead className="bg-slate-100 dark:bg-slate-800">
						<tr>
							<th className="text-center py-2 px-2 w-8 font-semibold text-slate-700 dark:text-slate-200">
								#
							</th>
							<th className="text-left py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">
								Task Name
							</th>
							<th className="text-left py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">
								Status
							</th>
							<th className="text-left py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">
								Message
							</th>
							<th className="text-left py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">
								Created
							</th>
							<th className="text-left py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">
								Started
							</th>
							<th className="text-left py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">
								Completed
							</th>
							<th className="text-left py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">
								Machine
							</th>
							<th className="text-left py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">
								Triggered By
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
						{taskList.map((task, index) => {
							if (!task) return null;
							const taskNameLower = (task.task_name || "").toLowerCase();
							const statusLower = (task.status || "").toLowerCase();
							const messageLower = (task.message || "").toLowerCase();

							const isFastFinishCompleted =
								taskNameLower === "fast finish" &&
								(statusLower === "completed" || statusLower === "done") &&
								messageLower.includes("success");

							const triggeredByUser = getDisplayUser(task);

							return (
								<tr
									key={index}
									className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
										isFastFinishCompleted
											? "bg-green-50/80 dark:bg-green-900/20"
											: ""
									}`}
								>
									<td className="py-2 px-2 text-center text-muted-foreground">
										{index + 1}
									</td>
									<td className="py-2 px-3 font-medium">
										{task.task_name || "—"}
									</td>
									<td className="py-2 px-3">
										<StatusBadge
											value={task.status || "—"}
											message={task.message || task.status || "—"}
										/>
									</td>

									<td
										className="py-2 px-3 text-muted-foreground max-w-[200px] truncate"
										title={task.message || ""}
									>
										{task.message || "—"}
									</td>
									<td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
										{formatDate(task.created_time)}
									</td>
									<td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
										{formatDate(task.started_time)}
									</td>
									<td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
										{formatDate(task.completed_time)}
									</td>
									<td className="py-2 px-3 text-muted-foreground">
										{task.machine_name || "—"}
									</td>
									<td className="py-2 px-3">
										{triggeredByUser ? (
											<UserDisplay
												user={triggeredByUser as any}
												size="sm"
												showEmail={true}
											/>
										) : (
											<span className="text-muted-foreground">—</span>
										)}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			{/* Mobile/Tablet: Card grid (below md) */}
			<div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
				{taskList.map((task, index) => {
					if (!task) return null;
					const taskNameLower = (task.task_name || "").toLowerCase();
					const statusLower = (task.status || "").toLowerCase();
					const messageLower = (task.message || "").toLowerCase();

					const isFastFinishCompleted =
						taskNameLower === "fast finish" &&
						(statusLower === "completed" || statusLower === "done") &&
						messageLower.includes("success");

					const triggeredByUser = getDisplayUser(task);

					return (
						<div
							key={index}
							className={`p-3 rounded-md border ${
								isFastFinishCompleted
									? "bg-green-50/80 dark:bg-green-900/20"
									: "bg-neutral-50"
							}`}
						>
							<div className="flex items-center justify-between mb-2">
								<span className="font-medium text-xs truncate mr-2">
									{task.task_name || "—"}
								</span>
								<StatusBadge
									value={task.status || "—"}
									message={task.message || task.status || "—"}
								/>
							</div>
							<div className="space-y-1 text-xs text-muted-foreground">
								{triggeredByUser && (
									<div className="flex items-center gap-1">
										<span className="font-medium">By:</span>{" "}
										<UserDisplay
											user={triggeredByUser as any}
											size="xs"
											showEmail={false}
										/>
									</div>
								)}
								<div className="truncate" title={task.message || ""}>
									<span className="font-medium">Message:</span>{" "}
									{task.message || "—"}
								</div>
								<div>
									<span className="font-medium">Created:</span>{" "}
									{formatDate(task.created_time)}
								</div>
								<div>
									<span className="font-medium">Started:</span>{" "}
									{formatDate(task.started_time)}
								</div>
								<div>
									<span className="font-medium">Done:</span>{" "}
									{formatDate(task.completed_time)}
								</div>
								<div className="truncate">
									<span className="font-medium">Machine:</span>{" "}
									{task.machine_name || "—"}
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
