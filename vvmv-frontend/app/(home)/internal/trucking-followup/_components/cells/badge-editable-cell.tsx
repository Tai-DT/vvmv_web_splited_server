"use client";

import type { Table } from "@tanstack/react-table";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { stringToColorVariant } from "@/lib/utils/color-utils";
import { useCellTabIndex } from "../../../followup/_components/cells/use-cell-tab-index";
import type { TruckingFollowUpRow } from "../../types";

interface BadgeEditableCellProps {
	getValue: () => unknown;
	row: { original: TruckingFollowUpRow };
	column: { id: string };
	table: Table<TruckingFollowUpRow>;
	placeholder?: string;
	readOnly?: boolean;
}

function BadgeEditableCellComponent({
	getValue,
	row: { original },
	column: { id },
	table,
	placeholder = "Enter values...",
	readOnly = false,
}: BadgeEditableCellProps) {
	const initialValue = (getValue() as string | null | undefined) ?? "";
	const [isEditing, setIsEditing] = useState(false);
	const [tempValue, setTempValue] = useState(initialValue);
	const containerRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const values = useMemo(() => {
		if (!initialValue) return [];
		return initialValue.split("\n").filter(Boolean);
	}, [initialValue]);

	const tabIndex = useCellTabIndex(table, original.id, id);

	const handleSave = useCallback(() => {
		if (tempValue !== initialValue) {
			(table.options.meta as any)?.updateData?.(original.id, id, tempValue);
		}
		setIsEditing(false);
	}, [table.options.meta, original.id, id, tempValue, initialValue]);

	const handleCancel = useCallback(() => {
		setTempValue(initialValue);
		setIsEditing(false);
	}, [initialValue]);

	// Focus textarea when entering edit mode
	useEffect(() => {
		if (isEditing && textareaRef.current) {
			textareaRef.current.focus();
			textareaRef.current.select();
		}
	}, [isEditing]);

	// Sync with initialValue if it changes externally
	useEffect(() => {
		setTempValue(initialValue);
	}, [initialValue]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			handleSave();
		} else if (e.key === "Escape") {
			handleCancel();
		}
	};

	const canEdit = !readOnly;

	if (!isEditing || !canEdit) {
		return (
			<div
				ref={containerRef}
				className={cn(
					"w-full h-full flex items-center px-1 py-1 rounded transition-colors group min-h-[32px]",
					canEdit && "cursor-pointer hover:bg-muted/30",
				)}
				onClick={() => canEdit && setIsEditing(true)}
				tabIndex={canEdit ? tabIndex : undefined}
				onKeyDown={(e) => {
					if (canEdit && (e.key === "Enter" || e.key === " ")) {
						e.preventDefault();
						setIsEditing(true);
					}
				}}
			>
				{values.length > 1 ? (
					<div className="flex flex-wrap gap-1 w-full min-w-0">
						{values.map((v, i) => (
							<Badge
								key={i}
								variant={stringToColorVariant(v)}
								className="px-2.5 py-0.5 text-xs font-medium max-w-full truncate block"
							>
								{v}
							</Badge>
						))}
					</div>
				) : values.length === 1 ? (
					<Badge
						variant={stringToColorVariant(values[0])}
						className="px-3 py-1 text-xs font-semibold tracking-tight shadow-sm max-w-full truncate block"
					>
						{values[0]}
					</Badge>
				) : (
					<span className="text-muted-foreground text-xs opacity-50 px-1">
						{placeholder}
					</span>
				)}
			</div>
		);
	}

	return (
		<div className="w-full h-full p-1">
			<textarea
				ref={textareaRef}
				value={tempValue}
				onChange={(e) => setTempValue(e.target.value)}
				onBlur={handleSave}
				onKeyDown={handleKeyDown}
				placeholder="One per line. Ctrl+Enter to save"
				className="w-full text-xs p-1.5 border rounded bg-background focus:ring-1 focus:ring-primary focus:outline-none min-h-[80px] resize-none shadow-sm"
			/>
		</div>
	);
}

function arePropsEqual(
	prevProps: BadgeEditableCellProps,
	nextProps: BadgeEditableCellProps,
) {
	return (
		prevProps.getValue() === nextProps.getValue() &&
		prevProps.row.original.id === nextProps.row.original.id &&
		prevProps.column.id === nextProps.column.id &&
		prevProps.readOnly === nextProps.readOnly
	);
}

export const BadgeEditableCell = memo(
	BadgeEditableCellComponent,
	arePropsEqual,
);
