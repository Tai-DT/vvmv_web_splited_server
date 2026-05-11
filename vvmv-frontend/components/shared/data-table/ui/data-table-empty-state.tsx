import { SearchX } from "lucide-react";

export function DataTableEmptyState() {
	return (
		<div className="flex items-center justify-center border border-slate-200 dark:border-slate-700 rounded-xl shadow-md bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 h-96 flex-col p-4">
			<div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
				<SearchX className="size-8 text-slate-400 dark:text-slate-500" />
			</div>
			<p className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-1">
				No results found
			</p>
			<p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-xs">
				Try adjusting your filters or add a new record to get started
			</p>
		</div>
	);
}
