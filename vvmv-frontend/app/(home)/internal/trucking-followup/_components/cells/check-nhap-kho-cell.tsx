"use client";

import type { Table } from "@tanstack/react-table";
import { memo, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TruckingFollowUpRow } from "../../types";

export const CHECK_NHAP_KHO_OPTIONS = [
	{ id: "CHƯA NHẬP KHO", name: "CHƯA NHẬP KHO", color: "secondary" },
	{ id: "PHÂN CÔNG NHẬP", name: "PHÂN CÔNG NHẬP", color: "info" },
	{ id: "ĐANG NHẬP", name: "ĐANG NHẬP", color: "warning" },
	{ id: "NHẬP ĐỦ", name: "NHẬP ĐỦ", color: "success" },
] as const;

function getVariant(value: string | null | undefined) {
	const opt = CHECK_NHAP_KHO_OPTIONS.find((o) => o.id === value);
	return (opt?.color ?? "secondary") as
		| "secondary"
		| "info"
		| "warning"
		| "success";
}

interface CheckNhapKhoCellProps {
	getValue: () => unknown;
	row: { original: TruckingFollowUpRow };
	column: { id: string };
	table: Table<TruckingFollowUpRow>;
}

function CheckNhapKhoCellComponent({
	getValue,
	row: { original },
	column: { id },
	table,
}: CheckNhapKhoCellProps) {
	const value = getValue() as string | null | undefined;
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	// Close dropdown when clicking outside
	useEffect(() => {
		if (!isOpen) return;
		const handleClickOutside = (e: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [isOpen]);

	const handleSelect = (optionId: string) => {
		const newValue = optionId === value ? null : optionId;
		(table.options.meta as any)?.updateData?.(original.id, id, newValue);
		setIsOpen(false);
	};

	return (
		// relative container so the dropdown is positioned relative to the cell
		<div ref={containerRef} className="relative w-full h-full">
			{/* Trigger - always visible, does NOT grow in height */}
			<div
				className="w-full h-full flex items-center px-1 py-1 cursor-pointer hover:bg-muted/30 rounded transition-colors"
				onClick={() => setIsOpen((prev) => !prev)}
			>
				{value ? (
					<Badge
						variant={getVariant(value)}
						className="px-2.5 py-0.5 text-xs font-medium max-w-full truncate block"
					>
						{value}
					</Badge>
				) : (
					<span className="text-muted-foreground text-xs opacity-50">
						Chọn trạng thái...
					</span>
				)}
			</div>

			{/* Floating dropdown - absolute so it does NOT push row height */}
			{isOpen && (
				<div className="absolute left-0 top-full mt-0.5 z-50 min-w-[160px] w-full bg-popover border border-border rounded-md shadow-lg py-1">
					{CHECK_NHAP_KHO_OPTIONS.map((opt) => (
						<button
							key={opt.id}
							type="button"
							onClick={() => handleSelect(opt.id)}
							className={cn(
								"w-full text-left px-2 py-1 text-xs transition-colors hover:bg-muted/50 flex items-center",
								value === opt.id && "bg-muted",
							)}
						>
							<Badge
								variant={opt.color}
								className="px-2 py-0.5 text-xs font-medium"
							>
								{opt.name}
							</Badge>
							{value === opt.id && (
								<span className="ml-auto text-[10px] text-muted-foreground">
									✓
								</span>
							)}
						</button>
					))}
				</div>
			)}
		</div>
	);
}

function arePropsEqual(
	prevProps: CheckNhapKhoCellProps,
	nextProps: CheckNhapKhoCellProps,
) {
	return (
		prevProps.getValue() === nextProps.getValue() &&
		prevProps.row.original.id === nextProps.row.original.id &&
		prevProps.column.id === nextProps.column.id
	);
}

export const CheckNhapKhoCell = memo(CheckNhapKhoCellComponent, arePropsEqual);
