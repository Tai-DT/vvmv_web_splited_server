"use client";

import { Filter, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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

// Filter operator types
export type FilterOperator =
	| "contains"
	| "does_not_contain"
	| "equals"
	| "does_not_equal"
	| "starts_with"
	| "ends_with"
	| "is_empty"
	| "is_not_empty"
	| "date_range";

// Logical operator for combining filters
export type LogicalOperator = "and" | "or";

// Single filter condition
export interface FilterCondition {
	id: string;
	column: string;
	operator: FilterOperator;
	value: string;
	logicalOperator: LogicalOperator;
	startDate?: string;
	endDate?: string;
}

// Operator options with labels
const OPERATORS: { value: FilterOperator; label: string }[] = [
	{ value: "contains", label: "contains" },
	{ value: "does_not_contain", label: "does not contain" },
	{ value: "equals", label: "equals" },
	{ value: "does_not_equal", label: "does not equal" },
	{ value: "starts_with", label: "starts with" },
	{ value: "ends_with", label: "ends with" },
	{ value: "is_empty", label: "is empty" },
	{ value: "is_not_empty", label: "is not empty" },
];

// Check if operator needs a value input
const operatorNeedsValue = (operator: FilterOperator): boolean => {
	return operator !== "is_empty" && operator !== "is_not_empty";
};

type AdvancedFilterPopoverProps = {
	columns: Array<{ accessorKey: string; header: string }>;
	filters: FilterCondition[];
	onApplyFilters: (filters: FilterCondition[]) => void;
	hideOthersTasks: boolean | null;
	onHideOthersTasksChange: (value: boolean) => void;
	dateTimeColumns?: string[];
	noOperatorColumns?: string[];
	renderCustomValueInput?: (
		filter: FilterCondition,
		updateFilter: (id: string, updates: Partial<FilterCondition>) => void,
	) => React.ReactNode | null;
	extraHeaderContent?: React.ReactNode;
};

// Generate unique ID for filter conditions
const generateId = () => Math.random().toString(36).substring(2, 9);

// Check if a column is a datetime column
const isDateTimeColumn = (
	column: string,
	dateTimeColumns: string[] = [],
): boolean => {
	return dateTimeColumns.includes(column);
};

function normalizeFilterCondition(
	filter: FilterCondition,
	columns: Array<{ accessorKey: string; header: string }>,
	dateTimeColumns: string[],
	noOperatorColumns: string[],
): FilterCondition {
	const fallbackColumn = columns[0]?.accessorKey || "";
	const column =
		typeof filter.column === "string" && filter.column.trim()
			? filter.column
			: fallbackColumn;
	const isDateTime = isDateTimeColumn(column, dateTimeColumns);
	const isNoOperator = noOperatorColumns.includes(column);

	const operator =
		filter.operator === "date_range"
			? "date_range"
			: filter.operator === "contains" ||
					filter.operator === "does_not_contain" ||
					filter.operator === "equals" ||
					filter.operator === "does_not_equal" ||
					filter.operator === "starts_with" ||
					filter.operator === "ends_with" ||
					filter.operator === "is_empty" ||
					filter.operator === "is_not_empty"
				? filter.operator
				: isDateTime
					? "date_range"
					: "contains";

	return {
		...filter,
		column,
		operator: isDateTime ? "date_range" : isNoOperator ? "equals" : operator,
		value: typeof filter.value === "string" ? filter.value : "",
		logicalOperator: filter.logicalOperator === "or" ? "or" : "and",
		startDate: typeof filter.startDate === "string" ? filter.startDate : "",
		endDate: typeof filter.endDate === "string" ? filter.endDate : "",
	};
}

function normalizeFilterConditions(
	filters: FilterCondition[],
	columns: Array<{ accessorKey: string; header: string }>,
	dateTimeColumns: string[],
	noOperatorColumns: string[],
) {
	return filters.map((filter) =>
		normalizeFilterCondition(
			filter,
			columns,
			dateTimeColumns,
			noOperatorColumns,
		),
	);
}

export function AdvancedFilterPopover({
	columns,
	filters,
	onApplyFilters,
	hideOthersTasks,
	onHideOthersTasksChange,
	dateTimeColumns = [],
	noOperatorColumns = [],
	renderCustomValueInput,
	extraHeaderContent,
}: AdvancedFilterPopoverProps) {
	const [open, setOpen] = useState(false);
	const [localFilters, setLocalFilters] = useState<FilterCondition[]>(() =>
		normalizeFilterConditions(
			filters,
			columns,
			dateTimeColumns,
			noOperatorColumns,
		),
	);

	useEffect(() => {
		if (open) {
			setLocalFilters(
				normalizeFilterConditions(
					filters,
					columns,
					dateTimeColumns,
					noOperatorColumns,
				),
			);
		}
	}, [columns, dateTimeColumns, filters, noOperatorColumns, open]);

	const addFilter = useCallback(() => {
		const firstColumn = columns[0]?.accessorKey || "";
		const isDateTime = isDateTimeColumn(firstColumn, dateTimeColumns);
		const newFilter: FilterCondition = {
			id: generateId(),
			column: firstColumn,
			operator: isDateTime ? "date_range" : "contains",
			value: "",
			logicalOperator: "and",
			startDate: "",
			endDate: "",
		};
		setLocalFilters((prev) => [...prev, newFilter]);
	}, [columns, dateTimeColumns]);

	const removeFilter = useCallback((id: string) => {
		setLocalFilters((prev) => prev.filter((f) => f.id !== id));
	}, []);

	const updateFilter = useCallback(
		(id: string, updates: Partial<FilterCondition>) => {
			setLocalFilters((prev) =>
				prev.map((f) => {
					if (f.id !== id) return f;

					if (updates.column && updates.column !== f.column) {
						const isDateTime = isDateTimeColumn(
							updates.column,
							dateTimeColumns,
						);
						const wasDateTime = isDateTimeColumn(f.column, dateTimeColumns);
						const isNoOperator = noOperatorColumns.includes(updates.column);

						if (isDateTime) {
							return {
								...f,
								...updates,
								operator: "date_range" as FilterOperator,
								value: "",
								startDate: "",
								endDate: "",
							};
						}
						if (isNoOperator) {
							return {
								...f,
								...updates,
								operator: "equals" as FilterOperator,
								value: "",
								startDate: "",
								endDate: "",
							};
						}
						if (wasDateTime) {
							return {
								...f,
								...updates,
								operator: "contains" as FilterOperator,
								value: "",
								startDate: "",
								endDate: "",
							};
						}
					}

					return { ...f, ...updates };
				}),
			);
		},
		[dateTimeColumns, noOperatorColumns],
	);

	const handleApply = useCallback(() => {
		onApplyFilters(
			normalizeFilterConditions(
				localFilters,
				columns,
				dateTimeColumns,
				noOperatorColumns,
			),
		);
		setOpen(false);
	}, [
		columns,
		dateTimeColumns,
		localFilters,
		noOperatorColumns,
		onApplyFilters,
	]);

	const activeFilterCount = filters.length;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={<button type="button" />}
				className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-9 w-9 sm:w-auto sm:px-2 shrink-0 md:h-10 ${
					activeFilterCount > 0
						? "bg-primary shadow hover:bg-primary/90"
						: "border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
				}`}
			>
				<Filter
					className={`h-4 w-4 text-slate-500 dark:text-slate-400 ${activeFilterCount > 0 ? "text-white" : "text-slate-700"}`}
				/>
				<span
					className={`hidden sm:inline dark:text-slate-300 ${activeFilterCount > 0 ? "text-white" : "text-slate-700"}`}
				>
					{activeFilterCount > 0 ? `Filters (${activeFilterCount})` : "Filters"}
				</span>
			</PopoverTrigger>

			<PopoverPositioner className="z-[160]" sideOffset={8}>
				<PopoverContent className="w-[720px] max-w-[calc(100vw-16px)] p-0">
					<div className="space-y-2 px-4 pt-4 pb-2 border-b w-full">
						<div className="flex items-center gap-2">
							<Checkbox
								checked={hideOthersTasks === true}
								onCheckedChange={(checked) =>
									onHideOthersTasksChange(checked === true)
								}
								id="hide-others-tasks"
							/>
							<label
								htmlFor="hide-others-tasks"
								className="text-sm text-muted-foreground cursor-pointer select-none"
							>
								Hide others tasks
							</label>
						</div>
						{extraHeaderContent}
					</div>

					{/* Filter rows - scrollable */}
					<div className="max-h-[400px] overflow-y-auto p-4 space-y-3 w-full">
						{localFilters.length === 0 ? (
							<div className="text-center text-muted-foreground py-4">
								No filters added. Click "Add filter" to create one.
							</div>
						) : (
							localFilters.map((filter, index) => (
								<div
									key={filter.id}
									className="flex items-center gap-2 flex-nowrap"
								>
									{/* Remove button */}
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="h-8 w-8"
										onClick={() => removeFilter(filter.id)}
									>
										<X className="h-4 w-4" />
									</Button>

									{/* Logical operator (AND/OR) - shown for all except first filter */}
									{index > 0 ? (
										<Select
											value={filter.logicalOperator}
											onValueChange={(value) =>
												updateFilter(filter.id, {
													logicalOperator: value as LogicalOperator,
												})
											}
										>
											<SelectTrigger className="w-[70px] h-8 shrink-0">
												<SelectValue />
											</SelectTrigger>
											<SelectPositioner>
												<SelectContent>
													<SelectItem value="and">And</SelectItem>
													<SelectItem value="or">Or</SelectItem>
												</SelectContent>
											</SelectPositioner>
										</Select>
									) : (
										<div className="w-[70px] shrink-0" />
									)}

									{/* Column selector */}
									<Select
										value={filter.column}
										onValueChange={(value) =>
											updateFilter(filter.id, { column: value as string })
										}
									>
										<SelectTrigger className="w-[140px] h-8 shrink-0">
											<SelectValue>
												{columns.find(
													(col) => col.accessorKey === filter.column,
												)?.header || filter.column}
											</SelectValue>
										</SelectTrigger>

										<SelectPositioner>
											<SelectContent>
												{[...columns]
													.sort((a, b) =>
														(a.header || "").localeCompare(b.header || ""),
													)
													.map((col) => (
														<SelectItem
															key={col.accessorKey}
															value={col.accessorKey}
														>
															{col.header}
														</SelectItem>
													))}
											</SelectContent>
										</SelectPositioner>
									</Select>

									{/* For datetime columns: show date range inputs */}
									{isDateTimeColumn(filter.column, dateTimeColumns) ? (
										<>
											<Input
												type="date"
												value={filter.startDate ?? ""}
												onChange={(e) =>
													updateFilter(filter.id, { startDate: e.target.value })
												}
												placeholder="Start date"
												className="w-[140px] h-8 shrink-0"
											/>
											<span className="text-muted-foreground text-sm">to</span>
											<Input
												type="date"
												value={filter.endDate ?? ""}
												onChange={(e) =>
													updateFilter(filter.id, { endDate: e.target.value })
												}
												placeholder="End date"
												className="w-[140px] h-8 shrink-0"
											/>
										</>
									) : noOperatorColumns.includes(filter.column) ? (
										/* For choice columns: skip operator, show only value input */
										renderCustomValueInput?.(filter, updateFilter) || (
											<Input
												value={filter.value ?? ""}
												onChange={(e) =>
													updateFilter(filter.id, { value: e.target.value })
												}
												placeholder="Filter value"
												className="flex-1 min-w-[120px] h-8"
											/>
										)
									) : (
										<>
											{/* Operator selector */}
											<Select
												value={filter.operator}
												onValueChange={(value) =>
													updateFilter(filter.id, {
														operator: value as FilterOperator,
													})
												}
											>
												<SelectTrigger className="w-[140px] h-8 shrink-0">
													<SelectValue />
												</SelectTrigger>
												<SelectPositioner>
													<SelectContent>
														{OPERATORS.filter(
															(op) => op.value !== "date_range",
														).map((op) => (
															<SelectItem key={op.value} value={op.value}>
																{op.label}
															</SelectItem>
														))}
													</SelectContent>
												</SelectPositioner>
											</Select>

											{/* Value input (hidden for is_empty/is_not_empty) */}
											{operatorNeedsValue(filter.operator) ? (
												renderCustomValueInput ? (
													renderCustomValueInput(filter, updateFilter) || (
														<Input
															value={filter.value ?? ""}
															onChange={(e) =>
																updateFilter(filter.id, {
																	value: e.target.value,
																})
															}
															placeholder="Filter value"
															className="flex-1 min-w-[120px] h-8"
														/>
													)
												) : (
													<Input
														value={filter.value ?? ""}
														onChange={(e) =>
															updateFilter(filter.id, {
																value: e.target.value,
															})
														}
														placeholder="Filter value"
														className="flex-1 min-w-[120px] h-8"
													/>
												)
											) : (
												<div className="flex-1 min-w-[120px]" />
											)}
										</>
									)}
								</div>
							))
						)}
					</div>

					{/* Footer with action buttons */}
					<div className="flex items-center justify-between border-t p-3 gap-2">
						<div className="flex gap-2">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={addFilter}
								className="gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
							>
								<Plus className="h-4 w-4" />
								Add filter
							</Button>

							{localFilters.length > 0 && (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => setLocalFilters([])}
									className="gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
								>
									<Trash2 className="h-4 w-4" />
									Remove all
								</Button>
							)}
						</div>

						<Button type="button" size="sm" onClick={handleApply}>
							Apply
						</Button>
					</div>
				</PopoverContent>
			</PopoverPositioner>
		</Popover>
	);
}
