"use client";

import type { Table } from "@tanstack/react-table";
import { CalendarIcon, X } from "lucide-react";
import type React from "react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverPositioner,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { FollowUpRow } from "../../types";
import { useCellTabIndex } from "./use-cell-tab-index";

interface DateCellProps {
	getValue: () => unknown;
	row: { original: FollowUpRow };
	column: { id: string };
	table: Table<FollowUpRow>;
	readOnly?: boolean;
	type?: "date" | "datetime-local";
	multiline?: boolean;
}

type ParsedDateTime = { date: string; time: string };

// Parse user-typed strings tolerantly into { date: "YYYY-MM-DD", time: "HH:mm" }.
// Returns { date: "", time: "" } if unparseable.
// Handles: "dd/mm/yyyy", "dd/mm/yyyy HH:mm", "yyyy-mm-dd", "yyyy-mm-ddTHH:mm", etc.
function parseTypedDate(raw: string): ParsedDateTime {
	const s = raw.trim();
	if (!s) return { date: "", time: "" };

	// Split off optional time part "HH:mm" or "HH:MM:SS" after a space or T
	const timeMatch = s.match(/[\sT](\d{1,2}):(\d{2})(?::\d{2})?$/);
	const timeParsed = timeMatch
		? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`
		: "";
	const datePart = timeMatch
		? s.slice(0, s.length - timeMatch[0].length).trim()
		: s;

	// Already ISO date format YYYY-MM-DD
	if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
		return { date: datePart, time: timeParsed };
	}

	// dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy
	const dmyMatch = datePart.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
	if (dmyMatch) {
		const d = dmyMatch[1].padStart(2, "0");
		const m = dmyMatch[2].padStart(2, "0");
		let y = dmyMatch[3];
		if (y.length === 2) y = `20${y}`;
		const check = new Date(`${y}-${m}-${d}`);
		if (!Number.isNaN(check.getTime()))
			return { date: `${y}-${m}-${d}`, time: timeParsed };
	}

	// Fallback: let Date parse the whole string
	const fallback = new Date(s);
	if (!Number.isNaN(fallback.getTime())) {
		const fd = String(fallback.getUTCDate()).padStart(2, "0");
		const fm = String(fallback.getUTCMonth() + 1).padStart(2, "0");
		const fy = fallback.getUTCFullYear();
		const fh = String(fallback.getUTCHours()).padStart(2, "0");
		const fmin = String(fallback.getUTCMinutes()).padStart(2, "0");
		return { date: `${fy}-${fm}-${fd}`, time: timeParsed || `${fh}:${fmin}` };
	}

	return { date: "", time: "" };
}

// Convert ISO datetime or date string → "YYYY-MM-DD" using UTC methods
// to avoid local timezone shifting the date.
function toDatePart(value: string | null | undefined): string {
	if (!value) return "";
	try {
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return "";
		const y = d.getUTCFullYear();
		const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
		const day = String(d.getUTCDate()).padStart(2, "0");
		return `${y}-${mo}-${day}`;
	} catch {
		return "";
	}
}

// Convert ISO string → "HH:mm" using UTC methods
function toTimePart(value: string | null | undefined): string {
	if (!value) return "";
	try {
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return "00:00";
		return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
	} catch {
		return "00:00";
	}
}

// Format for display in view mode: dd/mm/yyyy [HH:mm] using UTC methods
function toDisplayFormat(
	value: string | null | undefined,
	isDatetime: boolean,
): string {
	if (!value) return "";
	try {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return "";
		const d = String(date.getUTCDate()).padStart(2, "0");
		const m = String(date.getUTCMonth() + 1).padStart(2, "0");
		const y = date.getUTCFullYear();
		if (isDatetime) {
			const hh = String(date.getUTCHours()).padStart(2, "0");
			const mm = String(date.getUTCMinutes()).padStart(2, "0");
			return `${d}/${m}/${y} ${hh}:${mm}`;
		}
		return `${d}/${m}/${y}`;
	} catch {
		return "";
	}
}

/**
 * DateCell Component
 *
 * Edit mode shows:
 * - Text input for keyboard entry (parses dd/mm/yyyy, d/m/yy, yyyy-mm-dd)
 * - Calendar icon that opens a popover date-picker
 * - For datetime: a time input below the calendar
 */
function DateCellComponent({
	getValue,
	row: { original },
	column: { id },
	table,
	readOnly = false,
	type = "date",
	multiline = false,
}: DateCellProps) {
	const rawValue = getValue() as string | null | undefined;
	const isDatetime = type === "datetime-local";

	const tabIndex = useCellTabIndex(table, original.id, id);

	const [isEditing, setIsEditing] = useState(false);
	const [popoverOpen, setPopoverOpen] = useState(false);

	// Text field the user types into (displays as dd/mm/yyyy)
	const [textInput, setTextInput] = useState("");
	// Canonical date part: "YYYY-MM-DD" or ""
	const [datePart, setDatePart] = useState(toDatePart(rawValue));
	// Time part: "HH:mm"
	const [timePart, setTimePart] = useState(toTimePart(rawValue));

	const textRef = useRef<HTMLInputElement>(null);

	// Sync when rawValue changes externally
	useEffect(() => {
		if (!isEditing) {
			setDatePart(toDatePart(rawValue));
			setTimePart(toTimePart(rawValue));
		}
	}, [rawValue, isEditing]);

	const enterEdit = useCallback(() => {
		if (original.canEdit === false || readOnly) return;
		const dp = toDatePart(rawValue);
		setDatePart(dp);
		setTimePart(toTimePart(rawValue));
		// Show current value as dd/mm/yyyy in text box
		if (dp) {
			const [y, mo, d] = dp.split("-");
			setTextInput(`${d}/${mo}/${y}`);
		} else {
			setTextInput("");
		}
		setIsEditing(true);
	}, [original.canEdit, readOnly, rawValue]);

	// Build ISO value from date + time parts, then save
	const commitSave = useCallback(
		(dp: string, tp: string) => {
			const originalIso = rawValue ?? null;
			if (!dp) {
				if (originalIso !== null) {
					(table.options.meta as any)?.updateData?.(original.id, id, null);
				}
				setIsEditing(false);
				return;
			}
			const isoValue = isDatetime
				? `${dp}T${tp || "00:00"}:00.000Z`
				: `${dp}T00:00:00.000Z`;
			if (
				isoValue !== (originalIso ? new Date(originalIso).toISOString() : null)
			) {
				(table.options.meta as any)?.updateData?.(original.id, id, isoValue);
			}
			setIsEditing(false);
		},
		[table.options.meta, original.id, id, rawValue, isDatetime],
	);

	// When user blurs the text input: parse and normalize
	const handleTextBlur = useCallback(() => {
		if (popoverOpen) return; // Don't save yet if calendar is open
		const { date: parsed, time: parsedTime } = parseTypedDate(textInput);
		if (parsed) {
			// Sync text display to normalized form
			const [y, mo, d] = parsed.split("-");
			setTextInput(`${d}/${mo}/${y}`);
			if (parsedTime) setTimePart(parsedTime);
		}
		setDatePart(parsed);
		// Don't commitSave yet — wait for overall blur (handled by container onBlur)
	}, [textInput, popoverOpen]);

	// Calendar selection
	const handleCalendarSelect = useCallback(
		(day: Date | undefined) => {
			if (!day) {
				setDatePart("");
				setTextInput("");
				setPopoverOpen(false);
				return;
			}
			const y = day.getFullYear();
			const mo = String(day.getMonth() + 1).padStart(2, "0");
			const d = String(day.getDate()).padStart(2, "0");
			const dp = `${y}-${mo}-${d}`;
			setDatePart(dp);
			setTextInput(`${d}/${mo}/${y}`);
			setPopoverOpen(false);
			// For date-only: save immediately on selection
			if (!isDatetime) {
				commitSave(dp, timePart);
			}
		},
		[isDatetime, timePart, commitSave],
	);

	// Handle Enter/Escape in text input
	const handleTextKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Enter") {
				e.preventDefault();
				const { date: parsed, time: parsedTime } = parseTypedDate(textInput);
				const tp = parsedTime || timePart;
				setDatePart(parsed);
				if (parsedTime) setTimePart(parsedTime);
				commitSave(parsed, tp);
			} else if (e.key === "Escape") {
				setIsEditing(false);
				setPopoverOpen(false);
			}
		},
		[textInput, timePart, commitSave],
	);

	// Container onBlur — fires when focus leaves the entire edit widget
	const handleContainerBlur = useCallback(
		(e: React.FocusEvent<HTMLDivElement>) => {
			// If focus moved to a child of this container, ignore
			if (e.currentTarget.contains(e.relatedTarget as Node)) return;
			if (popoverOpen) return;
			const { date: parsed, time: parsedTime } = parseTypedDate(textInput);
			commitSave(parsed, parsedTime || timePart);
		},
		[textInput, timePart, popoverOpen, commitSave],
	);

	// View mode
	if (!isEditing) {
		const display = toDisplayFormat(rawValue, isDatetime);
		const editable = original.canEdit !== false && !readOnly;
		return (
			<div
				onClick={enterEdit}
				tabIndex={editable ? tabIndex : undefined}
				onKeyDown={(e) => {
					if ((e.key === "Enter" || e.key === " ") && editable) {
						e.preventDefault();
						enterEdit();
					}
				}}
				onPaste={(e) => {
					if (!editable) return;
					e.preventDefault();
					const pasted = e.clipboardData.getData("text").trim();
					if (!pasted) return;
					const { date: parsed, time: parsedTime } = parseTypedDate(pasted);
					if (parsed) {
						const [y, mo, d] = parsed.split("-");
						const tp = parsedTime || timePart;
						setDatePart(parsed);
						setTimePart(tp);
						setTextInput(`${d}/${mo}/${y}`);
						setIsEditing(true);
						commitSave(parsed, tp);
					} else {
						// Unknown format — enter edit mode with raw text so user can fix it
						setTextInput(pasted);
						setDatePart("");
						setIsEditing(true);
					}
				}}
				className={`${
					editable ? "cursor-pointer" : "cursor-default"
				} w-full h-full flex ${
					multiline
						? "items-start py-1 whitespace-pre-line text-[11px] leading-tight"
						: "items-center py-1"
				} px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
			>
				{display ||
					(multiline && rawValue ? (
						rawValue
					) : (
						<span className="text-muted-foreground">—</span>
					))}
			</div>
		);
	}

	// Edit mode
	const selectedDay = datePart ? new Date(`${datePart}T12:00:00Z`) : undefined;

	return (
		<div
			className="flex items-center gap-1 w-full px-1 py-0.5"
			onBlur={handleContainerBlur}
		>
			{/* Text input */}
			<input
				ref={textRef}
				value={textInput}
				placeholder="dd/mm/yyyy"
				onChange={(e) => setTextInput(e.target.value)}
				onBlur={handleTextBlur}
				onKeyDown={handleTextKeyDown}
				className="flex-1 min-w-0 px-1.5 py-0.5 text-sm border border-input rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
			/>

			{/* Clear button — only when there's a value */}
			{(datePart || textInput) && (
				<button
					type="button"
					tabIndex={-1}
					onClick={() => {
						setDatePart("");
						setTextInput("");
						textRef.current?.focus();
					}}
					className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
				>
					<X className="w-3 h-3" />
				</button>
			)}

			{/* Calendar picker */}
			<Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
				<PopoverTrigger
					tabIndex={-1}
					className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
				>
					<CalendarIcon className="w-3.5 h-3.5" />
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
						{/* Time input for datetime-local */}
						{isDatetime && (
							<div className="flex items-center gap-2 px-3 pb-3 pt-1 border-t">
								<span className="text-xs text-muted-foreground">Giờ:</span>
								<input
									type="time"
									value={timePart}
									onChange={(e) => setTimePart(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											commitSave(datePart, timePart);
											setPopoverOpen(false);
										}
									}}
									className="flex-1 text-sm border border-input rounded px-1.5 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
								/>
								<button
									type="button"
									onClick={() => {
										commitSave(datePart, timePart);
										setPopoverOpen(false);
									}}
									className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
								>
									OK
								</button>
							</div>
						)}
					</PopoverContent>
				</PopoverPositioner>
			</Popover>
		</div>
	);
}

function areDateCellPropsEqual(
	prevProps: DateCellProps,
	nextProps: DateCellProps,
) {
	return (
		prevProps.getValue() === nextProps.getValue() &&
		prevProps.row.original.id === nextProps.row.original.id &&
		prevProps.column.id === nextProps.column.id &&
		prevProps.readOnly === nextProps.readOnly
	);
}

export const DateCell = memo(DateCellComponent, areDateCellPropsEqual);
