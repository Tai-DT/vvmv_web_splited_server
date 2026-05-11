"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import {
	type FilterCondition,
	type FilterOperator,
	AdvancedFilterPopover as SharedAdvancedFilterPopover,
} from "@/components/shared/advanced-filter";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import type { FollowUpRow, InvokerTask } from "../../types";
import { UserDisplay } from "../cells/user-display";
import { FOLLOWUP_HEADERS } from "../table/column-headers";

// Re-export types for backward compatibility
export type { FilterCondition, FilterOperator };

// Datetime columns that should use date range filter
const DATETIME_COLUMNS = [
	"pickUpTime",
	"deliveryDate",
	"startTime",
	"endTime",
	"shmtDate",
	"transportDate",
	"etaEtd",
	"createdAt",
	"updatedAt",
];

type AdvancedFilterPopoverProps = {
	columns: Array<{ accessorKey: string; header: string }>;
	filters: FilterCondition[];
	onApplyFilters: (filters: FilterCondition[]) => void;
	hideOthersTasks: boolean;
	onHideOthersTasksChange: (value: boolean) => void;
	dependencies?: Record<string, any>;
};

export function AdvancedFilterPopover({
	columns,
	filters,
	onApplyFilters,
	hideOthersTasks,
	onHideOthersTasksChange,
	dependencies,
}: AdvancedFilterPopoverProps) {
	// Custom value input renderer for follow-up specific columns
	const renderCustomValueInput = (
		filter: FilterCondition,
		updateFilter: (id: string, updates: Partial<FilterCondition>) => void,
	) => {
		const config =
			FOLLOWUP_HEADERS[filter.column as keyof typeof FOLLOWUP_HEADERS];
		const useDependency = config?.cellProps?.useDependency;

		// Handle special enums or dependencies
		type FilterOption = {
			id: string;
			name: string;
			displayName: string;
			code?: string;
			email?: string;
		};
		let options: FilterOption[] = [];

		if (filter.column === "operationType") {
			options = [
				{ id: "XUAT", name: "XUAT", displayName: "XUAT" },
				{ id: "NHAP", name: "NHAP", displayName: "NHAP" },
			];
		} else if (useDependency && dependencies?.[useDependency]) {
			const depData = dependencies[useDependency];
			if (Array.isArray(depData)) {
				options = depData.map((item: any) => {
					const id = item.id || item;
					const name = item.name || item.label || item;
					const code = item.code || (item.id ? item.id : "");

					const isUserDep = useDependency === "siteUsers";
					const showCode =
						code && code !== name && !isUserDep && code.length < 15;

					return {
						id,
						name,
						code,
						email: item.email || "",
						displayName: showCode ? `[${code}] ${name}` : name,
					};
				});
			}
		}

		if (options.length > 0) {
			const selectedOption = options.find((opt) => opt.id === filter.value);
			const isUserDep = useDependency === "siteUsers";

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
						{isUserDep && selectedOption ? (
							<UserDisplay
								user={dependencies?.[useDependency]?.find(
									(u: any) => u.id === filter.value,
								)}
								size="xs"
								showEmail={false}
								className="flex-1 min-w-0"
							/>
						) : (
							<span className="truncate">
								{selectedOption
									? selectedOption.displayName
									: "Select value..."}
							</span>
						)}
						<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</PopoverTrigger>
					<PopoverPositioner>
						<PopoverContent className="w-[300px] p-0">
							<Command>
								<CommandInput placeholder="Search value..." className="h-8" />
								<CommandList>
									<CommandEmpty>No results found.</CommandEmpty>
									<CommandGroup>
										{options.map((opt) => (
											<CommandItem
												key={opt.id}
												value={`${opt.email || ""} ${opt.id} ${opt.name} ${opt.code || ""}`}
												onSelect={() => {
													updateFilter(filter.id, {
														value: opt.id,
													});
												}}
												className="flex items-center justify-between"
											>
												{isUserDep ? (
													<UserDisplay
														user={dependencies?.[useDependency]?.find(
															(u: any) => u.id === opt.id,
														)}
														size="sm"
														showEmail={true}
														className="flex-1 min-w-0"
													/>
												) : (
													<span className="truncate">{opt.displayName}</span>
												)}
												<Check
													className={cn(
														"ml-auto h-4 w-4",
														filter.value === opt.id
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

		return null; // Use default input
	};

	return (
		<SharedAdvancedFilterPopover
			columns={columns}
			filters={filters}
			onApplyFilters={onApplyFilters}
			hideOthersTasks={hideOthersTasks}
			onHideOthersTasksChange={onHideOthersTasksChange}
			dateTimeColumns={DATETIME_COLUMNS}
			renderCustomValueInput={renderCustomValueInput}
		/>
	);
}

// Filter evaluation function - evaluates a single condition against a value
export function evaluateCondition(
	cellValue: unknown,
	operator: FilterOperator,
	filterValue: string,
): boolean {
	const compareValue = filterValue.toLowerCase();

	// Special handling for objects (like our handler object)
	if (cellValue && typeof cellValue === "object" && "id" in cellValue) {
		const val = cellValue as { id: string; searchable: string; full: string };

		switch (operator) {
			case "contains":
				return val.full.includes(compareValue);
			case "does_not_contain":
				return !val.full.includes(compareValue);
			case "equals":
				return (
					val.id.toLowerCase() === compareValue || val.full === compareValue
				);
			case "does_not_equal":
				return (
					val.id.toLowerCase() !== compareValue && val.full !== compareValue
				);
			case "starts_with":
				return val.full.startsWith(compareValue);
			case "ends_with":
				return val.full.endsWith(compareValue);
			case "is_empty":
				return false;
			case "is_not_empty":
				return true;
			default:
				return true;
		}
	}

	// Convert cell value to string for comparison
	const strValue = cellValue?.toString().toLowerCase() ?? "";

	switch (operator) {
		case "contains":
			return strValue.includes(compareValue);
		case "does_not_contain":
			return !strValue.includes(compareValue);
		case "equals":
			return strValue === compareValue;
		case "does_not_equal":
			return strValue !== compareValue;
		case "starts_with":
			return strValue.startsWith(compareValue);
		case "ends_with":
			return strValue.endsWith(compareValue);
		case "is_empty":
			return strValue === "" || cellValue === null || cellValue === undefined;
		case "is_not_empty":
			return strValue !== "" && cellValue !== null && cellValue !== undefined;
		case "date_range":
			// Date range is handled separately in evaluateDateRange
			return true;
		default:
			return true;
	}
}

// Evaluate date range condition
function evaluateDateRange(
	cellValue: unknown,
	startDate: string | undefined,
	endDate: string | undefined,
): boolean {
	// If no dates specified, include all
	if (!startDate && !endDate) return true;

	// If cell value is empty/null, exclude from results
	if (cellValue === null || cellValue === undefined || cellValue === "") {
		return false;
	}

	// Parse cell value as date
	const cellDate = new Date(cellValue as string);
	if (Number.isNaN(cellDate.getTime())) return false;

	// Set cell date to start of day for comparison
	const cellDateOnly = new Date(
		cellDate.getFullYear(),
		cellDate.getMonth(),
		cellDate.getDate(),
	);

	// Check start date
	if (startDate) {
		const start = new Date(startDate);
		const startDateOnly = new Date(
			start.getFullYear(),
			start.getMonth(),
			start.getDate(),
		);
		if (cellDateOnly < startDateOnly) return false;
	}

	// Check end date
	if (endDate) {
		const end = new Date(endDate);
		const endDateOnly = new Date(
			end.getFullYear(),
			end.getMonth(),
			end.getDate(),
		);
		if (cellDateOnly > endDateOnly) return false;
	}

	return true;
}

// Helper to get the latest task status from invokerTasks
function getLatestTaskStatus(invokerTasks: InvokerTask[] | undefined): string {
	if (!invokerTasks || invokerTasks.length === 0) return "";

	const latestTask = invokerTasks.reduce((latest, task) => {
		if (!latest) return task;
		const latestTime = latest.created_time
			? new Date(latest.created_time).getTime()
			: 0;
		const taskTime = task.created_time
			? new Date(task.created_time).getTime()
			: 0;
		return taskTime > latestTime ? task : latest;
	}, invokerTasks[0]);

	return latestTask.status;
}

// Get cell value, handling computed columns like 'status'
function getCellValue(
	row: FollowUpRow,
	column: string,
	dependencies?: Record<string, any>,
): unknown {
	if (column === "status") {
		// Status is computed from invokerTasks
		return getLatestTaskStatus(row.invokerTasks);
	}

	// Special handling for handler column - resolved via siteUsers dependency
	if (column === "handler" && dependencies?.siteUsers) {
		const handlerId = row.handler;
		if (!handlerId) return "";

		const handlerUser = dependencies.siteUsers.find(
			(u: any) => u.id === handlerId,
		);
		if (!handlerUser) return handlerId;

		return {
			id: handlerId,
			searchable:
				`${handlerUser.name || ""} ${handlerUser.email} ${handlerUser.username || ""}`.toLowerCase(),
			full: `${handlerUser.name || ""} ${handlerUser.email} ${handlerUser.username || ""} ${handlerId}`.toLowerCase(),
		};
	}

	// Special handling for createdBy column - search by name, email, username, and ID
	if (column === "createdBy") {
		const user = row.user;
		const resolvedUser = dependencies?.siteUsers?.find(
			(u: any) => u.id === row.createdBy,
		);

		const targetUser = user || resolvedUser;

		if (!targetUser) return row.createdBy;

		return {
			id: row.createdBy,
			searchable:
				`${targetUser.name || ""} ${targetUser.email} ${targetUser.username || ""}`.toLowerCase(),
			full: `${targetUser.name || ""} ${targetUser.email} ${targetUser.username || ""} ${row.createdBy}`.toLowerCase(),
		};
	}

	// Special handling for declarations column - join all declaration numbers into a searchable string
	if (column === "declarations") {
		const declarations = row.declarations || [];
		return declarations.map((d) => d.declarationNumber).join(" ");
	}

	return (row as any)[column];
}

// Evaluate a single filter condition (handles both regular and date range)
function evaluateSingleFilter(
	row: FollowUpRow,
	filter: FilterCondition,
	dependencies?: Record<string, any>,
): boolean {
	const cellValue = getCellValue(row, filter.column, dependencies);

	if (filter.operator === "date_range") {
		return evaluateDateRange(cellValue, filter.startDate, filter.endDate);
	}

	return evaluateCondition(cellValue, filter.operator, filter.value);
}

// Evaluate all filter conditions against a row
export function evaluateFilters(
	row: FollowUpRow,
	filters: FilterCondition[],
	dependencies?: Record<string, any>,
): boolean {
	if (filters.length === 0) return true;

	// Start with the result of the first filter
	let result = evaluateSingleFilter(row, filters[0], dependencies);

	// Apply subsequent filters with their logical operators
	for (let i = 1; i < filters.length; i++) {
		const filter = filters[i];
		const conditionResult = evaluateSingleFilter(row, filter, dependencies);

		if (filter.logicalOperator === "and") {
			result = result && conditionResult;
		} else {
			result = result || conditionResult;
		}
	}

	return result;
}

// Check if row is finished
export function isJobFinished(row: FollowUpRow): boolean {
	return row.isFinished === true;
}

// Check if row is done (Finished + all declarations have KVGS date and attachments)
export function isJobDone(row: FollowUpRow): boolean {
	if (!isJobFinished(row)) return false;

	// If there's Certificate of Origin data, being finished is enough to be "Done"
	const cerOfOrigins = row.cerOfOrigins || [];
	if (cerOfOrigins.length > 0) return true;

	// Otherwise, fallback to declaration-based criteria
	const declarations = row.declarations || [];
	if (declarations.length === 0) return true;

	return declarations.every((d) => {
		// Check KVGS: required if enableKVGS is true (default true)
		const kvgsOk =
			row.enableKVGS === false ||
			(d.kvgsDate !== null && d.kvgsDate !== undefined);

		// Check CDS: required if enableCDS is true (default true)
		const cdsOk =
			row.enableCDS === false ||
			(d.attachDocuments !== null &&
				d.attachDocuments !== undefined &&
				d.attachDocuments.trim() !== "");

		return kvgsOk && cdsOk;
	});
}
