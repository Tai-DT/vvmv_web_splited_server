"use client";

import { DataTableToolbar as SharedToolbar } from "@/components/shared/data-table";
import { DateRangePicker } from "../../../followup/_components/shared/date-range-picker";
import {
	type FilterCondition,
	TruckingAdvancedFilter,
} from "../filters/trucking-advanced-filter";
import type { ServiceModeFilter } from "./use-table-state";

type TruckingDataTableToolbarProps = {
	columns: Array<{ accessorKey: string; header: string }>;
	onGlobalFilterChange: (value: string) => void;
	onRefresh: () => void;
	isRefreshing?: boolean;
	onColumnManageClick: () => void;
	dateRange: { from: string; to: string } | null;
	onDateRangeChange: (range: { from: string; to: string }) => void;
	advancedFilters: FilterCondition[];
	onApplyFilters: (filters: FilterCondition[]) => void;
	hideOthersTasks: boolean | null;
	onHideOthersTasksChange: (value: boolean) => void;
	serviceModeFilter: ServiceModeFilter;
	onServiceModeFilterChange: (filter: ServiceModeFilter) => void;
	onAddRecordClick?: () => void;
	onExport?: () => void;
	siteUsers?: any[];
	vendors?: any[];
	ops?: string[];
};

export function TruckingDataTableToolbar({
	columns,
	onGlobalFilterChange,
	onRefresh,
	isRefreshing,
	onColumnManageClick,
	dateRange,
	onDateRangeChange,
	advancedFilters,
	onApplyFilters,
	hideOthersTasks,
	onHideOthersTasksChange,
	serviceModeFilter,
	onServiceModeFilterChange,
	onAddRecordClick,
	onExport,
	siteUsers,
	vendors,
	ops,
}: TruckingDataTableToolbarProps) {
	return (
		<SharedToolbar
			onGlobalFilterChange={onGlobalFilterChange}
			searchPlaceholder="Tìm kiếm... (nhiều job: JOB1, JOB2, JOB3)"
			AdvancedFilterComponent={TruckingAdvancedFilter}
			advancedFilters={advancedFilters as any}
			onApplyFilters={onApplyFilters as any}
			hideOthersTasks={hideOthersTasks}
			onHideOthersTasksChange={onHideOthersTasksChange}
			columns={columns}
			dateRange={dateRange}
			onDateRangeChange={onDateRangeChange}
			DateRangeComponent={DateRangePicker}
			showAddButton={!!onAddRecordClick}
			onAddRecordClick={onAddRecordClick}
			showExportButton={!!onExport}
			onExport={onExport}
			onColumnManageClick={onColumnManageClick}
			onRefresh={onRefresh}
			isRefreshing={isRefreshing}
			dependencies={{
				serviceModeFilter,
				onServiceModeFilterChange,
				siteUsers,
				vendors,
				ops,
			}}
		/>
	);
}
