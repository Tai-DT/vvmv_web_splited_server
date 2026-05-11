"use client";

import { Input } from "@base-ui/react";
import type { Table } from "@tanstack/react-table";
import React, { memo, useCallback } from "react";
import type { FollowUpRow } from "../../types";
import { useCellTabIndex } from "./use-cell-tab-index";

interface EditableCellProps {
	getValue: () => unknown;
	row: { original: FollowUpRow };
	column: { id: string };
	table: Table<FollowUpRow>;
	type?: "text" | "number";
	multiline?: boolean; // Enable multiline mode for long text (wrap text + textarea editing)
	readOnly?: boolean;
	format?: "currency-vnd"; // Display format: currency-vnd = ###.###.### (dots as thousand separators)
	viewClassName?: string; // Optional class applied to the text span in view mode
}

/**
 * EditableCell Component
 *
 * A reusable cell component with edit/view mode toggle.
 * - View mode: displays plain text, clickable to enter edit mode
 * - Edit mode: shows input field with auto-focus and auto-select
 *
 * Features:
 * - Save on blur (click away)
 * - Save on Enter key press (Ctrl+Enter for multiline mode)
 * - Cancel on Escape key (reverts changes)
 * - Auto-focus and auto-select text in edit mode
 * - Smooth transitions between modes
 * - Memoized to prevent unnecessary re-renders
 * - Multiline mode: wraps text in view mode, uses textarea in edit mode
 */
function EditableCellComponent({
	getValue,
	row: { original },
	column: { id },
	table,
	type = "text",
	multiline = false,
	readOnly = false,
	format,
	viewClassName,
}: EditableCellProps) {
	const initialValue = (getValue() as string | null | undefined) ?? "";
	const [isEditing, setIsEditing] = React.useState(false);
	const [value, setValue] = React.useState(initialValue);
	const inputRef = React.useRef<HTMLInputElement>(null);
	const textareaRef = React.useRef<HTMLTextAreaElement>(null);

	// Format value for display (view mode only)
	const formatDisplay = useCallback(
		(raw: string) => {
			if (!raw || raw === "") return null;
			if (format === "currency-vnd") {
				const num = parseFloat(raw);
				if (Number.isNaN(num)) return raw;
				// Format with dot as thousand separator, no decimal
				return Math.round(num)
					.toString()
					.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
			}
			return raw;
		},
		[format],
	);

	// Calculate tabIndex based on visual column order
	const tabIndex = useCellTabIndex(table, original.id, id);

	// Auto-focus input when entering edit mode
	React.useEffect(() => {
		if (isEditing) {
			if (multiline) {
				textareaRef.current?.focus();
				textareaRef.current?.select();
			} else {
				inputRef.current?.focus();
				// Select all text for easier replacement
				inputRef.current?.select();
			}
		}
	}, [isEditing, multiline]);

	// Auto-resize textarea
	React.useEffect(() => {
		if (isEditing && multiline && textareaRef.current) {
			const textarea = textareaRef.current;
			textarea.style.height = "auto";
			textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`; // Max height 200px
		}
	}, [isEditing, multiline]);

	// Sync external value changes
	React.useEffect(() => {
		setValue(initialValue);
	}, [initialValue]);

	// Memoize handlers to prevent recreation on every render
	const handleSave = useCallback(() => {
		// Only update if value actually changed
		if (value !== initialValue) {
			(table.options.meta as any)?.updateData?.(original.id, id, value);
		}
		setIsEditing(false);
	}, [table.options.meta, original.id, id, value, initialValue]);

	const handleCancel = useCallback(() => {
		setValue(initialValue);
		setIsEditing(false);
	}, [initialValue]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			if (multiline) {
				// For multiline, use Ctrl+Enter to save, Enter for new line
				if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
					e.preventDefault();
					handleSave();
				} else if (e.key === "Escape") {
					handleCancel();
				}
			} else {
				if (e.key === "Enter") {
					handleSave();
				} else if (e.key === "Escape") {
					handleCancel();
				}
			}
		},
		[handleSave, handleCancel, multiline],
	);

	// Handle input validation for number fields
	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			const newValue = e.target.value;

			// For number fields, only allow positive numeric input (digits and decimal point)
			if (type === "number") {
				// Allow empty string, digits, and decimal point only
				if (newValue === "" || /^\d*\.?\d*$/.test(newValue)) {
					setValue(newValue);
				}
			} else {
				setValue(newValue);
			}
		},
		[type],
	);

	// View mode: plain text
	if (!isEditing) {
		return (
			<div
				onClick={() => {
					if (original.canEdit !== false && !readOnly) {
						setIsEditing(true);
					}
				}}
				tabIndex={
					original.canEdit !== false && !readOnly ? tabIndex : undefined
				}
				onKeyDown={(e) => {
					if (
						(e.key === "Enter" || e.key === " ") &&
						original.canEdit !== false &&
						!readOnly
					) {
						e.preventDefault();
						setIsEditing(true);
					}
				}}
				className={`${
					original.canEdit !== false && !readOnly
						? "cursor-pointer transition-colors"
						: "cursor-default"
				} w-full h-full flex py-1 px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 overflow-hidden`}
			>
				<span
					title={multiline && value ? value : undefined}
					className={`${
						multiline
							? "line-clamp-2 break-words whitespace-pre-line w-full"
							: "truncate"
					} ${viewClassName || ""}`}
				>
					{value !== "" && value !== null && value !== undefined ? (
						(formatDisplay(value) ?? value)
					) : (
						<span className="text-muted-foreground">—</span>
					)}
				</span>
			</div>
		);
	}

	// Edit mode: textarea for multiline, input for single line
	if (multiline) {
		return (
			<textarea
				ref={textareaRef}
				value={value}
				onChange={handleChange}
				onBlur={handleSave}
				onKeyDown={handleKeyDown}
				tabIndex={tabIndex}
				className="w-full px-2 py-1 border border-input rounded bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none min-h-[60px]"
				placeholder="Ctrl+Enter to save"
			/>
		);
	}

	// Edit mode: input field
	return (
		<Input
			ref={inputRef}
			type="text"
			value={value}
			onChange={handleChange}
			onBlur={handleSave}
			onKeyDown={handleKeyDown}
			tabIndex={tabIndex}
			className="w-full px-2 py-1 border border-input rounded bg-background focus:outline-none focus:ring-2 focus:ring-ring"
			inputMode={type === "number" ? "decimal" : "text"}
		/>
	);
}

// Custom comparison function for memo - only re-render if value or identity changes
function arePropsEqual(
	prevProps: EditableCellProps,
	nextProps: EditableCellProps,
) {
	return (
		prevProps.getValue() === nextProps.getValue() &&
		prevProps.row.original.id === nextProps.row.original.id &&
		prevProps.column.id === nextProps.column.id &&
		prevProps.multiline === nextProps.multiline &&
		prevProps.readOnly === nextProps.readOnly &&
		prevProps.format === nextProps.format
	);
}

export const EditableCell = memo(EditableCellComponent, arePropsEqual);
