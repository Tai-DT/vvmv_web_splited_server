"use client";

import { format, parse } from "date-fns";
import { Calendar, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverPositioner,
	PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps {
	dateRange: { from: string; to: string } | null;
	onDateRangeChange: (range: { from: string; to: string }) => void;
}

export function DateRangePicker({
	dateRange,
	onDateRangeChange,
}: DateRangePickerProps) {
	const [open, setOpen] = useState(false);
	const [tempRange, setTempRange] = useState<{
		from: Date;
		to?: Date;
	} | null>(null);

	// Convert stored string dates to Date objects for calendar
	const selectedDates = useMemo(() => {
		if (tempRange) {
			return tempRange;
		}

		if (!dateRange || (!dateRange.from && !dateRange.to)) {
			return undefined;
		}

		let from: Date | undefined;
		let to: Date | undefined;

		if (dateRange.from) {
			const parsed = parse(dateRange.from, "yyyy-MM-dd", new Date());
			if (!Number.isNaN(parsed.getTime())) {
				from = parsed;
			}
		}
		if (dateRange.to) {
			const parsed = parse(dateRange.to, "yyyy-MM-dd", new Date());
			if (!Number.isNaN(parsed.getTime())) {
				to = parsed;
			}
		}

		return from ? { from, to } : undefined;
	}, [dateRange, tempRange]);

	const handleSelect = useCallback(
		(range: { from?: Date; to?: Date } | undefined) => {
			if (!range?.from) {
				setTempRange(null);
				return;
			}
			setTempRange({ from: range.from, to: range.to });
		},
		[],
	);

	const handleApply = useCallback(() => {
		if (!tempRange?.from) {
			return;
		}

		const from = format(tempRange.from, "yyyy-MM-dd");
		const to = tempRange.to ? format(tempRange.to, "yyyy-MM-dd") : from;

		onDateRangeChange({ from, to });
		setOpen(false);
		setTempRange(null);
	}, [tempRange, onDateRangeChange]);

	const handleClear = useCallback(() => {
		setTempRange(null);
		onDateRangeChange({ from: "", to: "" });
		setOpen(false);
	}, [onDateRangeChange]);

	const handleCancel = useCallback(() => {
		setTempRange(null);
		setOpen(false);
	}, []);

	// Format display text
	const displayText = useMemo(() => {
		const range = tempRange || selectedDates;
		if (!range || !range.from) {
			return "Select dates";
		}

		const fromStr = format(range.from, "MMM d, yyyy");
		if (!range.to) {
			return fromStr;
		}

		const toStr = format(range.to, "MMM d, yyyy");
		return `${fromStr} - ${toStr}`;
	}, [selectedDates, tempRange]);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger className="w-auto px-2 md:px-3 h-9 md:h-10 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 gap-2 justify-start flex items-center font-medium text-sm">
				<Calendar className="h-4 w-4 text-slate-500 dark:text-slate-400" />
				<span className="hidden sm:inline text-xs md:text-sm text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
					{displayText}
				</span>
			</PopoverTrigger>

			<PopoverPositioner>
				<PopoverContent className="w-auto p-4">
					<div className="space-y-4">
						<div>
							<h3 className="text-sm font-semibold mb-3">Select Date Range</h3>
							<CalendarComponent
								mode="range"
								selected={selectedDates}
								onSelect={handleSelect as any}
							/>
						</div>

						<div className="flex gap-2 justify-end pt-2 border-t border-slate-200 dark:border-slate-700">
							<Button
								variant="outline"
								size="sm"
								onClick={handleCancel}
								className="text-xs"
							>
								Cancel
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={handleClear}
								className="text-xs"
							>
								<X className="h-3 w-3 mr-1" />
								Clear
							</Button>
							<Button
								size="sm"
								onClick={handleApply}
								disabled={!tempRange?.from}
								className="text-xs"
							>
								Apply
							</Button>
						</div>
					</div>
				</PopoverContent>
			</PopoverPositioner>
		</Popover>
	);
}
