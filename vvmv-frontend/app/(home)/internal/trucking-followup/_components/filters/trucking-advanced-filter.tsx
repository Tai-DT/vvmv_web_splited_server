"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import {
	type FilterCondition,
	type FilterOperator,
	AdvancedFilterPopover as SharedAdvancedFilterPopover,
} from "@/components/shared/advanced-filter";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverPositioner,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectPositioner,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { UserDisplay } from "@/components/ui/user-display";
import { cn } from "@/lib/utils";
import { CHECK_NHAP_KHO_OPTIONS } from "../cells/check-nhap-kho-cell";
import type { ServiceModeFilter } from "../table/use-table-state";

// Re-export types for backward compatibility
export type { FilterCondition, FilterOperator };

// Datetime columns that should use date range filter for trucking
const DATETIME_COLUMNS = [
	"ngatDienDate",
	"implementationDate",
	"fcr.implementationDate",
	"createdAt",
	"updatedAt",
	"payDate",
];

// Columns that use siteUsers dependency (user-select combobox)
const USER_COLUMNS = ["handler", "createdBy"];

// Columns that use vendor dependency (vendor-select combobox)
const VENDOR_COLUMNS = ["vendor"];

// Columns that use ops dependency (ops-select combobox)
const OPS_COLUMNS = ["ops"];

// Columns that are boolean (yes/no toggle)
const BOOLEAN_COLUMNS = ["pvst", "bienBanBT"];

// Columns that use a fixed set of options
const SELECT_OPTION_COLUMNS: Record<
	string,
	{ value: string; label: string }[]
> = {
	checkNhapKho: CHECK_NHAP_KHO_OPTIONS.map((o) => ({
		value: o.id,
		label: o.name,
	})),
};

type TruckingAdvancedFilterProps = {
	columns: Array<{ accessorKey: string; header: string }>;
	filters: FilterCondition[];
	onApplyFilters: (filters: FilterCondition[]) => void;
	hideOthersTasks: boolean | null;
	onHideOthersTasksChange: (value: boolean) => void;
	dependencies?: {
		serviceModeFilter?: ServiceModeFilter;
		onServiceModeFilterChange?: (filter: ServiceModeFilter) => void;
		siteUsers?: any[];
		vendors?: any[];
		ops?: string[];
	};
};

export function TruckingAdvancedFilter({
	columns,
	filters,
	onApplyFilters,
	hideOthersTasks,
	onHideOthersTasksChange,
	dependencies,
}: TruckingAdvancedFilterProps) {
	const {
		serviceModeFilter,
		onServiceModeFilterChange,
		siteUsers,
		vendors,
		ops,
	} = dependencies ?? {};

	const renderCustomValueInput = (
		filter: FilterCondition,
		updateFilter: (id: string, updates: Partial<FilterCondition>) => void,
	) => {
		// Boolean columns (PVST, Biên bản BT) → Có/Không dropdown
		if (BOOLEAN_COLUMNS.includes(filter.column)) {
			return (
				<Select
					value={filter.value as string}
					onValueChange={(value) =>
						updateFilter(filter.id, { value: value as string })
					}
				>
					<SelectTrigger className="flex-1 min-w-[120px] h-8">
						<SelectValue placeholder="Chọn..." />
					</SelectTrigger>
					<SelectPositioner>
						<SelectContent>
							<SelectItem value="true">Có ✓</SelectItem>
							<SelectItem value="false">Không ✗</SelectItem>
						</SelectContent>
					</SelectPositioner>
				</Select>
			);
		}

		// Fixed-option columns (checkNhapKho) → Select dropdown
		const selectOptions = SELECT_OPTION_COLUMNS[filter.column];
		if (selectOptions) {
			return (
				<Select
					value={filter.value as string}
					onValueChange={(value) =>
						updateFilter(filter.id, { value: value as string })
					}
				>
					<SelectTrigger className="flex-1 min-w-[160px] h-8">
						<SelectValue placeholder="Chọn trạng thái..." />
					</SelectTrigger>
					<SelectPositioner>
						<SelectContent>
							{selectOptions.map((opt) => (
								<SelectItem key={opt.value} value={opt.value}>
									{opt.label}
								</SelectItem>
							))}
						</SelectContent>
					</SelectPositioner>
				</Select>
			);
		}

		// User columns (handler, createdBy) → user-select combobox
		// User columns (handler, createdBy) → user-select combobox
		if (USER_COLUMNS.includes(filter.column) && siteUsers?.length) {
			const selectedUser = siteUsers.find((u) => u.id === filter.value);

			return (
				<Popover>
					<PopoverTrigger
						render={
							<Button
								type="button"
								variant="outline"
								role="combobox"
								className="flex-1 min-w-[120px] h-8 justify-between px-2 font-normal"
							/>
						}
					>
						{selectedUser ? (
							<UserDisplay
								user={selectedUser}
								size="xs"
								showEmail={false}
								className="flex-1 min-w-0"
							/>
						) : (
							<span className="truncate text-muted-foreground">
								Select user...
							</span>
						)}
						<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</PopoverTrigger>
					<PopoverPositioner>
						<PopoverContent className="w-[300px] p-0">
							<Command>
								<CommandInput placeholder="Search user..." className="h-8" />
								<CommandList>
									<CommandEmpty>No users found.</CommandEmpty>
									<CommandGroup>
										{siteUsers.map((user) => (
											<CommandItem
												key={user.id}
												value={`${user.email || ""} ${user.id} ${user.name || ""}`}
												onSelect={() =>
													updateFilter(filter.id, { value: user.id })
												}
												className="flex items-center justify-between"
											>
												<UserDisplay
													user={user}
													size="sm"
													showEmail={true}
													className="flex-1 min-w-0"
												/>
												<Check
													className={cn(
														"ml-auto h-4 w-4",
														filter.value === user.id
															? "opacity-100"
															: "opacity-0",
													)}
												/>
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</PopoverPositioner>
				</Popover>
			);
		}

		// Ops columns (ops) -> ops-select combobox
		if (OPS_COLUMNS.includes(filter.column) && ops?.length) {
			return (
				<Popover>
					<PopoverTrigger
						render={
							<Button
								type="button"
								variant="outline"
								role="combobox"
								className="flex-1 min-w-[120px] h-8 justify-between px-2 font-normal"
							/>
						}
					>
						{filter.value ? (
							<span className="truncate flex-1 text-left px-1">
								{filter.value as string}
							</span>
						) : (
							<span className="truncate text-muted-foreground flex-1 text-left px-1">
								Chọn OPS...
							</span>
						)}
						<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</PopoverTrigger>
					<PopoverPositioner>
						<PopoverContent className="w-[240px] p-0">
							<Command>
								<CommandInput placeholder="Tìm OPS..." className="h-8" />
								<CommandList>
									<CommandEmpty>Không tìm thấy.</CommandEmpty>
									<CommandGroup>
										{ops.map((opsName) => (
											<CommandItem
												key={opsName}
												value={opsName}
												onSelect={() =>
													updateFilter(filter.id, { value: opsName })
												}
												className="flex items-center justify-between"
											>
												<span className="flex-1 truncate">{opsName}</span>
												<Check
													className={cn(
														"ml-auto h-4 w-4",
														filter.value === opsName
															? "opacity-100"
															: "opacity-0",
													)}
												/>
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</PopoverPositioner>
				</Popover>
			);
		}

		// Vendor columns (vendor) -> vendor-select combobox
		if (VENDOR_COLUMNS.includes(filter.column) && vendors?.length) {
			// For vendors, filter.value stores the vendor's 'name' or 'id' which are both the same string
			const selectedVendor = vendors.find((v) => v.id === filter.value);

			return (
				<Popover>
					<PopoverTrigger
						render={
							<Button
								type="button"
								variant="outline"
								role="combobox"
								className="flex-1 min-w-[120px] h-8 justify-between px-2 font-normal"
							/>
						}
					>
						{selectedVendor ? (
							<span className="truncate flex-1 text-left px-1">
								{selectedVendor.name}
							</span>
						) : (
							<span className="truncate text-muted-foreground flex-1 text-left px-1">
								Select vendor...
							</span>
						)}
						<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</PopoverTrigger>
					<PopoverPositioner>
						<PopoverContent className="w-[300px] p-0">
							<Command>
								<CommandInput placeholder="Search vendor..." className="h-8" />
								<CommandList>
									<CommandEmpty>No vendors found.</CommandEmpty>
									<CommandGroup>
										{vendors.map((vendor) => (
											<CommandItem
												key={vendor.id}
												value={vendor.name}
												onSelect={() =>
													updateFilter(filter.id, { value: vendor.name })
												}
												className="flex items-center justify-between"
											>
												<span className="flex-1 truncate">{vendor.name}</span>
												<Check
													className={cn(
														"ml-auto h-4 w-4",
														filter.value === vendor.name
															? "opacity-100"
															: "opacity-0",
													)}
												/>
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</PopoverPositioner>
				</Popover>
			);
		}

		return null;
	};

	const serviceModeContent =
		serviceModeFilter && onServiceModeFilterChange ? (
			<div className="flex items-center gap-3">
				{(["fcl", "air", "lcl"] as const).map((type) => (
					<label
						key={type}
						htmlFor={`filter-sm-${type}`}
						className="flex items-center gap-1.5 cursor-pointer select-none"
					>
						<Checkbox
							id={`filter-sm-${type}`}
							checked={serviceModeFilter[type]}
							onCheckedChange={(checked) =>
								onServiceModeFilterChange({
									...serviceModeFilter,
									[type]: !!checked,
								})
							}
						/>
						<span className="text-sm text-muted-foreground uppercase">
							{type}
						</span>
					</label>
				))}
			</div>
		) : null;

	return (
		<SharedAdvancedFilterPopover
			columns={columns}
			filters={filters}
			onApplyFilters={onApplyFilters}
			hideOthersTasks={hideOthersTasks}
			onHideOthersTasksChange={onHideOthersTasksChange}
			dateTimeColumns={DATETIME_COLUMNS}
			noOperatorColumns={[
				...USER_COLUMNS,
				...VENDOR_COLUMNS,
				...OPS_COLUMNS,
				...BOOLEAN_COLUMNS,
				...Object.keys(SELECT_OPTION_COLUMNS),
			]}
			renderCustomValueInput={renderCustomValueInput}
			extraHeaderContent={serviceModeContent}
		/>
	);
}
