"use client";

import { Activity, CheckCircle2, ListTodo, PackageCheck } from "lucide-react";

export type StatusFilterType =
	| "all"
	| "active"
	| "activeNoTrucking"
	| "activeWithTrucking"
	| "finished"
	| "done";

interface StatsCardsProps {
	active: number;
	activeNoTrucking: number;
	activeWithTrucking: number;
	finished: number;
	done: number;
	currentFilter: StatusFilterType;
	onFilterChange: (filter: StatusFilterType) => void;
}

export const StatsCards = ({
	active,
	activeNoTrucking,
	activeWithTrucking,
	finished,
	done,
	currentFilter,
	onFilterChange,
}: StatsCardsProps) => {
	const total = active + finished + done;

	const isActiveGroup =
		currentFilter === "active" ||
		currentFilter === "activeNoTrucking" ||
		currentFilter === "activeWithTrucking";

	const cardBase =
		"relative overflow-hidden p-2 sm:p-2.5 rounded-lg sm:rounded-xl border shadow-sm group cursor-pointer transition-all duration-300 h-full min-h-0 flex flex-col";

	return (
		<div className="grid w-full min-w-0 grid-cols-2 items-stretch gap-2 sm:gap-3 md:grid-cols-4">
			{/* TOTAL */}
			<div
				onClick={() => onFilterChange("all")}
				className={`${cardBase} justify-center ${
					currentFilter === "all"
						? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 ring-2 ring-blue-500/20 shadow-md"
						: "bg-white dark:bg-gray-900/40 border-slate-200 dark:border-slate-800 hover:shadow-md hover:scale-[1.01]"
				}`}
			>
				<div className="flex items-center gap-2">
					<div
						className={`p-1.5 sm:p-2 rounded sm:rounded-lg transition-all duration-300 ring-1 flex-shrink-0 ${
							currentFilter === "all"
								? "bg-blue-500 text-white ring-blue-500/20"
								: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-110"
						}`}
					>
						<ListTodo className="size-4 sm:size-5" />
					</div>
					<div>
						<p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">
							Total
						</p>
						<h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
							{total}
						</h3>
					</div>
				</div>
			</div>

			{/* ACTIVE */}
			<div
				onClick={() => onFilterChange("active")}
				className={`${cardBase} ${
					isActiveGroup
						? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 ring-2 ring-amber-500/20 shadow-md"
						: "bg-white dark:bg-gray-900/40 border-slate-200 dark:border-slate-800 hover:shadow-md hover:scale-[1.01]"
				}`}
			>
				<div className="flex min-h-0 flex-1 flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
					<div className="flex items-start gap-2">
						<div
							className={`p-1.5 sm:p-2 rounded sm:rounded-lg transition-all duration-300 ring-1 flex-shrink-0 ${
								isActiveGroup
									? "bg-amber-500 text-white ring-amber-500/20"
									: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-110"
							}`}
						>
							<Activity className="size-4 sm:size-5" />
						</div>
						<div className="min-w-0 flex-1">
							<p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">
								Active
							</p>
							<h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
								{active}
							</h3>
						</div>
					</div>

					{/* Sub-filters: stay at bottom on small screens, inline end on xl */}
					<div className="mt-auto flex w-full flex-shrink-0 flex-row flex-wrap items-center justify-end gap-2 xl:mt-0 xl:w-auto xl:justify-end">
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								onFilterChange(
									currentFilter === "activeNoTrucking"
										? "active"
										: "activeNoTrucking",
								);
							}}
							title="Chưa có Request"
							className={`group flex flex-1 items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-all duration-300 sm:text-xs xl:flex-initial ${
								currentFilter === "activeNoTrucking"
									? "scale-[1.03] border-transparent bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-red-500/20"
									: "border-red-200 bg-red-50 text-red-600 hover:scale-[1.02] hover:bg-red-100 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/50"
							}`}
						>
							<div className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5">
								<span
									className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${currentFilter === "activeNoTrucking" ? "bg-white" : "bg-red-400"}`}
								/>
								<span
									className={`relative inline-flex h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5 ${currentFilter === "activeNoTrucking" ? "bg-white" : "bg-red-500"}`}
								/>
							</div>
							<span className="hidden sm:inline">No Req</span>
							<span className="sm:hidden">No</span>
							<span
								className={`min-w-[24px] rounded-full px-2 py-0.5 text-center text-xs font-black shadow-sm transition-colors ${
									currentFilter === "activeNoTrucking"
										? "bg-white text-red-600 dark:bg-white dark:text-red-600"
										: "bg-red-200 text-red-800 group-hover:bg-red-300 dark:bg-red-900 dark:text-red-100 dark:group-hover:bg-red-800"
								}`}
							>
								{activeNoTrucking}
							</span>
						</button>

						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								onFilterChange(
									currentFilter === "activeWithTrucking"
										? "active"
										: "activeWithTrucking",
								);
							}}
							title="Đã có request"
							className={`group flex flex-1 items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-all duration-300 sm:text-xs xl:flex-initial ${
								currentFilter === "activeWithTrucking"
									? "scale-[1.03] border-transparent bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-orange-500/20"
									: "border-orange-200 bg-orange-50 text-orange-600 hover:scale-[1.02] hover:bg-orange-100 dark:border-orange-800/50 dark:bg-orange-950/30 dark:text-orange-400 dark:hover:bg-orange-900/50"
							}`}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="12"
								height="12"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.5"
								strokeLinecap="round"
								strokeLinejoin="round"
								className={
									currentFilter === "activeWithTrucking"
										? "text-white"
										: "text-orange-500"
								}
							>
								<path d="M10 17h4V5H2v12h3" />
								<path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h2" />
								<path d="M14 17h1" />
								<circle cx="7.5" cy="17.5" r="2.5" />
								<circle cx="17.5" cy="17.5" r="2.5" />
							</svg>
							<span className="hidden sm:inline">Req'd</span>
							<span className="sm:hidden">Yes</span>
							<span
								className={`min-w-[24px] rounded-full px-2 py-0.5 text-center text-xs font-black shadow-sm transition-colors ${
									currentFilter === "activeWithTrucking"
										? "bg-white text-orange-600 dark:bg-white dark:text-orange-600"
										: "bg-orange-200 text-orange-800 group-hover:bg-orange-300 dark:bg-orange-900 dark:text-orange-100 dark:group-hover:bg-orange-800"
								}`}
							>
								{activeWithTrucking}
							</span>
						</button>
					</div>
				</div>
			</div>

			{/* FINISHED */}
			<div
				onClick={() => onFilterChange("finished")}
				className={`${cardBase} justify-center ${
					currentFilter === "finished"
						? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 ring-2 ring-emerald-500/20 shadow-md"
						: "bg-white dark:bg-gray-900/40 border-slate-200 dark:border-slate-800 hover:shadow-md hover:scale-[1.01]"
				}`}
			>
				<div className="flex items-center gap-2">
					<div
						className={`p-1.5 sm:p-2 rounded sm:rounded-lg transition-all duration-300 ring-1 flex-shrink-0 ${
							currentFilter === "finished"
								? "bg-emerald-500 text-white ring-emerald-500/20"
								: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110"
						}`}
					>
						<CheckCircle2 className="size-4 sm:size-5" />
					</div>
					<div>
						<p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">
							Finished
						</p>
						<h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
							{finished}
						</h3>
					</div>
				</div>
			</div>

			{/* DONE */}
			<div
				onClick={() => onFilterChange("done")}
				className={`${cardBase} justify-center ${
					currentFilter === "done"
						? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 ring-2 ring-indigo-500/20 shadow-md"
						: "bg-white dark:bg-gray-900/40 border-slate-200 dark:border-slate-800 hover:shadow-md hover:scale-[1.01]"
				}`}
			>
				<div className="flex items-center gap-2">
					<div
						className={`p-1.5 sm:p-2 rounded sm:rounded-lg transition-all duration-300 ring-1 flex-shrink-0 ${
							currentFilter === "done"
								? "bg-indigo-500 text-white ring-indigo-500/20"
								: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-110"
						}`}
					>
						<PackageCheck className="size-4 sm:size-5" />
					</div>
					<div>
						<p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">
							Done
						</p>
						<h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
							{done}
						</h3>
					</div>
				</div>
			</div>
		</div>
	);
};
