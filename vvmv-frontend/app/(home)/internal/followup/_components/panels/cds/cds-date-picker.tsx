// cds-date-picker.tsx – DatePickerInput component extracted from cds-info-panel.tsx
"use client";

import { CalendarIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverPositioner,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toDisplayDate } from "./cds-print";
import { toIsoDate } from "./cds-utils";

interface DatePickerInputProps {
	value: string | null | undefined;
	onChange: (iso: string | null) => void;
	inputClassName?: string;
	triggerClassName?: string;
	wrapperClassName?: string;
	disabled?: boolean;
	title?: string;
	placeholder?: string;
}

export function DatePickerInput({
	value,
	onChange,
	inputClassName,
	triggerClassName,
	wrapperClassName,
	disabled = false,
	title,
	placeholder = "dd/mm/yyyy",
}: DatePickerInputProps) {
	const [textInput, setTextInput] = useState(() => toDisplayDate(value));
	const [open, setOpen] = useState(false);
	const draftValueRef = useRef(textInput);
	const isFocusedRef = useRef(false);
	const isOpenRef = useRef(false);

	useEffect(() => {
		isOpenRef.current = open;
	}, [open]);

	useEffect(() => {
		const nextDisplayValue = toDisplayDate(value);

		if (
			(isFocusedRef.current || isOpenRef.current) &&
			nextDisplayValue !== draftValueRef.current
		) {
			return;
		}

		draftValueRef.current = nextDisplayValue;
		setTextInput(nextDisplayValue);
	}, [value]);

	useEffect(() => {
		if (disabled) {
			setOpen(false);
		}
	}, [disabled]);

	const normalizedValue = typeof value === "string" ? value.trim() : "";
	const normalizedIsoValue = /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(normalizedValue)
		? normalizedValue.slice(0, 10)
		: /^\d{2}\/\d{2}\/\d{4}$/.test(normalizedValue)
			? toIsoDate(normalizedValue)
			: "";
	const selectedDay = normalizedIsoValue
		? new Date(`${normalizedIsoValue}T12:00:00`)
		: undefined;

	const commitTextInput = () => {
		const raw = draftValueRef.current.trim();

		if (raw === "") {
			if (normalizedIsoValue) {
				onChange(null);
			}
			return;
		}

		const iso = toIsoDate(raw);

		if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
			if (iso !== normalizedIsoValue) {
				onChange(iso);
			}
			return;
		}

		const fallbackDisplayValue = toDisplayDate(value);
		draftValueRef.current = fallbackDisplayValue;
		setTextInput(fallbackDisplayValue);
	};

	const handleTextChange = (raw: string) => {
		draftValueRef.current = raw;
		setTextInput(raw);
		const iso = toIsoDate(raw);
		// Only propagate if fully valid dd/mm/yyyy or empty
		if (raw === "") onChange(null);
		else if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) onChange(iso);
	};

	const handleCalendarSelect = (day: Date | undefined) => {
		if (!day) return;
		const y = day.getFullYear();
		const mo = String(day.getMonth() + 1).padStart(2, "0");
		const d = String(day.getDate()).padStart(2, "0");
		const iso = `${y}-${mo}-${d}`;
		onChange(iso);
		draftValueRef.current = `${d}/${mo}/${y}`;
		setTextInput(draftValueRef.current);
		setOpen(false);
	};

	return (
		<div className={cn("flex items-center gap-0 w-full", wrapperClassName)}>
			<Input
				type="text"
				value={textInput}
				onChange={(e) => handleTextChange(e.target.value)}
				onFocus={() => {
					isFocusedRef.current = true;
				}}
				onBlur={() => {
					isFocusedRef.current = false;
					commitTextInput();
				}}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						commitTextInput();
					}
				}}
				disabled={disabled}
				placeholder={placeholder}
				maxLength={10}
				title={title}
				className={cn("flex-1 min-w-0 focus:z-10", inputClassName)}
			/>
			<Popover
				open={!disabled && open}
				onOpenChange={(nextOpen) => {
					if (!disabled) {
						setOpen(nextOpen);
					}
				}}
			>
				<PopoverTrigger
					type="button"
					disabled={disabled}
					title={title}
					className={cn(
						"flex items-center justify-center shrink-0 transition-colors",
						disabled && "cursor-default",
						triggerClassName,
					)}
				>
					<CalendarIcon className="w-3.5 h-3.5 stroke-[2.5]" />
				</PopoverTrigger>
				<PopoverPositioner side="bottom" sideOffset={4}>
					<PopoverContent className="p-0 w-auto">
						<Calendar
							mode="single"
							selected={selectedDay}
							onSelect={handleCalendarSelect}
							defaultMonth={selectedDay}
							captionLayout="dropdown"
							autoFocus
						/>
					</PopoverContent>
				</PopoverPositioner>
			</Popover>
		</div>
	);
}
