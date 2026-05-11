"use client";

import { Download, Plus, RefreshCw, Settings2, X } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DateRange, FilterCondition } from "./types";

export interface DataTableToolbarProps {
	// Core search
	onGlobalFilterChange: (value: string) => void;
	searchPlaceholder?: string;

	// Filters
	AdvancedFilterComponent: React.ComponentType<any>;
	advancedFilters: FilterCondition[];
	onApplyFilters: (filters: FilterCondition[]) => void;
	hideOthersTasks: boolean | null;
	onHideOthersTasksChange: (value: boolean) => void;
	dependencies?: Record<string, any>;
	columns: Array<{ accessorKey: string; header: string }>;

	// Date range picker
	dateRange: DateRange | null;
	onDateRangeChange: (range: DateRange) => void;
	DateRangeComponent: React.ComponentType<{
		dateRange: DateRange | null;
		onDateRangeChange: (range: DateRange) => void;
	}>;

	// Optional buttons
	showAddButton?: boolean;
	onAddRecordClick?: () => void;
	showExportButton?: boolean;
	onExport?: () => void;

	// Column management (always shown)
	onColumnManageClick: () => void;

	// Refresh (always shown)
	onRefresh: () => void;
	isRefreshing?: boolean;
}

export function DataTableToolbar({
	onGlobalFilterChange,
	searchPlaceholder,
	AdvancedFilterComponent,
	advancedFilters,
	onApplyFilters,
	hideOthersTasks,
	onHideOthersTasksChange,
	dependencies,
	columns,
	dateRange,
	onDateRangeChange,
	DateRangeComponent,
	showAddButton = false,
	onAddRecordClick,
	showExportButton = false,
	onExport,
	onColumnManageClick,
	onRefresh,
	isRefreshing,
}: DataTableToolbarProps) {
	const [searchValue, setSearchValue] = useState<string>("");

	const handleSearchChange = useCallback(
		(value: string) => {
			setSearchValue(value);
			onGlobalFilterChange(value.trim());
		},
		[onGlobalFilterChange],
	);

	return (
		<div className="flex flex-col gap-2 lg:flex-row sm:items-center sm:justify-between sm:gap-3 md:gap-3">
			{/* Search Input */}
			<div className="relative w-full min-w-0">
				<Input
					value={searchValue}
					onChange={(e) => handleSearchChange(e.target.value)}
					placeholder={searchPlaceholder || "Search..."}
					className="w-full min-w-0 rounded-full px-3 md:px-4 pr-8 md:pr-9 text-sm md:text-base h-9 md:h-10 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-400"
				/>
				{searchValue && (
					<button
						type="button"
						onClick={() => handleSearchChange("")}
						className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
						title="Clear search"
					>
						<X className="h-4 w-4" />
					</button>
				)}
			</div>

			{/* Action Buttons */}
			<div className="flex items-center gap-1.5 md:gap-2 w-full">
				{/* Optional Add Button */}
				{showAddButton && onAddRecordClick && (
					<Button
						onClick={onAddRecordClick}
						className="md:h-10 flex-1 gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-md hover:shadow-lg transition-all duration-200 text-white font-medium text-sm md:text-base"
					>
						<Plus className="h-4 w-4" />
						<span>Add New</span>
					</Button>
				)}

				{/* Advanced Filter */}
				<AdvancedFilterComponent
					columns={columns}
					filters={advancedFilters}
					onApplyFilters={onApplyFilters}
					hideOthersTasks={hideOthersTasks}
					onHideOthersTasksChange={onHideOthersTasksChange}
					dependencies={dependencies}
				/>

				{/* Date Range Picker */}
				<DateRangeComponent
					dateRange={dateRange}
					onDateRangeChange={onDateRangeChange}
				/>

				{/* Column Management */}
				<Button
					variant="outline"
					onClick={onColumnManageClick}
					className="gap-1 md:gap-2 w-9 sm:w-auto px-2 md:px-3 md:h-10 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs md:text-sm"
				>
					<Settings2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
					<span className="hidden sm:inline text-slate-700 dark:text-slate-300">
						Columns
					</span>
				</Button>

				{/* Optional Export Button */}
				{showExportButton && onExport && (
					<Button
						variant="outline"
						size="icon"
						onClick={onExport}
						title="Export to Excel"
						className="h-9 md:h-10 w-9 md:w-10 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
					>
						<Download className="h-4 w-4 text-slate-500 dark:text-slate-400" />
					</Button>
				)}

				{/* Refresh Button */}
				<Button
					variant="outline"
					size="icon"
					onClick={onRefresh}
					disabled={isRefreshing}
					title="Refresh data"
					className="h-9 md:h-10 w-9 md:w-10 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
				>
					<RefreshCw
						className={`h-4 w-4 text-slate-500 dark:text-slate-400 ${isRefreshing ? "animate-spin" : ""}`}
					/>
				</Button>
			</div>
		</div>
	);
}
