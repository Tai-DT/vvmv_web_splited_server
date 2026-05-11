"use client";

import type { Table } from "@tanstack/react-table";
import { Check, ChevronsUpDown } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { useWarehouseByTaxCode } from "@/hooks/use-warehouse-by-taxcode";
import { cn } from "@/lib/utils";
import { stringToColorVariant } from "@/lib/utils/color-utils";
import { useCellTabIndex } from "../../../followup/_components/cells/use-cell-tab-index";
import type { TruckingFollowUpRow } from "../../types";

interface TruckingWarehouseCellProps {
	getValue: () => unknown;
	row: { original: TruckingFollowUpRow };
	column: { id: string };
	table: Table<TruckingFollowUpRow>;
	placeholder?: string;
	readOnly?: boolean;
}

/**
 * TruckingWarehouseCell
 *
 * Drop-in replacement for BadgeEditableCell on the "warehouse" column.
 * Keeps the same badge display + tab/keyboard navigation, but replaces
 * the textarea editor with a WarehouseConfig-filtered combobox.
 *
 * Filtering is done by row.taxCode (TruckingFollowUp → PartnersMasterData → WarehouseConfig).
 */
function TruckingWarehouseCellComponent({
	getValue,
	row: { original },
	column: { id },
	table,
	placeholder = "Chọn kho...",
	readOnly = false,
}: TruckingWarehouseCellProps) {
	const currentValue = (getValue() as string | null | undefined) ?? "";
	const [open, setOpen] = useState(false);
	const [searchValue, setSearchValue] = useState("");

	const tabIndex = useCellTabIndex(table, original.id, id);

	// Filter warehouses by the row's taxCode
	const taxCode = original.taxCode ?? null;
	const { warehouses, isLoading } = useWarehouseByTaxCode(taxCode);

	const filteredWarehouses = useMemo(() => {
		if (!searchValue) return warehouses;
		const q = searchValue.toLowerCase();
		return warehouses.filter((w) => w.warehouseName.toLowerCase().includes(q));
	}, [warehouses, searchValue]);

	const canEdit = !readOnly;
	const hasTaxCode = Boolean(taxCode && taxCode.trim() !== "");

	const handleSelect = (warehouseName: string) => {
		(table.options.meta as any)?.updateData?.(original.id, id, warehouseName);
		setOpen(false);
		setSearchValue("");
	};

	const handleClear = () => {
		(table.options.meta as any)?.updateData?.(original.id, id, "");
		setOpen(false);
		setSearchValue("");
	};

	const openCombobox = () => {
		if (canEdit) setOpen(true);
	};

	// ── Split multi-warehouse value identical to BadgeEditableCell ──────────────
	const values = useMemo(() => {
		if (!currentValue) return [];
		return currentValue.split("\n").filter(Boolean);
	}, [currentValue]);

	// ── Trigger element (same look & feel as BadgeEditableCell display mode) ──
	const triggerContent = (
		<div
			className={cn(
				"w-full h-full flex items-center justify-between px-1 py-1 rounded transition-colors group min-h-[32px]",
				canEdit && "cursor-pointer hover:bg-muted/30",
				!canEdit && "cursor-default",
			)}
			tabIndex={canEdit ? tabIndex : undefined}
			onKeyDown={(e) => {
				if (canEdit && (e.key === "Enter" || e.key === " ")) {
					e.preventDefault();
					openCombobox();
				}
				if (e.key === "Escape") setOpen(false);
			}}
		>
			{/* Multi-badge display — identical to BadgeEditableCell */}
			<span className="flex-1 min-w-0">
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
			</span>
			{/* Chevron hint shown on hover */}
			{canEdit && (
				<ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-40 transition-opacity ml-1" />
			)}
		</div>
	);

	return (
		<Popover
			open={open}
			onOpenChange={(v) => {
				if (canEdit || !v) setOpen(v);
			}}
		>
			<PopoverTrigger
				onClick={openCombobox}
				className="w-full text-left outline-none focus:outline-none"
				aria-disabled={!canEdit}
			>
				{triggerContent}
			</PopoverTrigger>

			<PopoverPositioner>
				<PopoverContent className="w-[280px] p-0">
					<Command shouldFilter={false}>
						<CommandInput
							placeholder="Tìm tên kho..."
							className="h-9"
							value={searchValue}
							onValueChange={setSearchValue}
						/>
						<CommandList style={{ maxHeight: "260px", overflow: "auto" }}>
							{/* Không có taxCode */}
							{!hasTaxCode && (
								<CommandEmpty>Không có MST để lọc kho.</CommandEmpty>
							)}

							{/* Đang tải */}
							{hasTaxCode && isLoading && (
								<CommandEmpty>Đang tải...</CommandEmpty>
							)}

							{/* Không có kết quả */}
							{hasTaxCode && !isLoading && filteredWarehouses.length === 0 && (
								<CommandEmpty>
									{warehouses.length === 0
										? "Chưa cấu hình kho cho MST này."
										: "Không có kết quả."}
								</CommandEmpty>
							)}

							{/* Xóa lựa chọn */}
							{currentValue && (
								<CommandGroup>
									<CommandItem
										value="__clear__"
										onSelect={handleClear}
										className="text-muted-foreground italic"
									>
										Xóa lựa chọn
									</CommandItem>
								</CommandGroup>
							)}

							{/* Danh sách kho */}
							{filteredWarehouses.length > 0 && (
								<CommandGroup>
									{filteredWarehouses.map((wh) => (
										<CommandItem
											key={wh.id}
											value={wh.warehouseName}
											onSelect={() => handleSelect(wh.warehouseName)}
											className="flex items-center justify-between gap-2"
										>
											<div className="flex flex-col min-w-0">
												<span className="text-sm font-medium truncate">
													{wh.warehouseName}
												</span>
												{wh.deliveryAddress && (
													<span className="text-[10px] text-muted-foreground truncate">
														{wh.deliveryAddress}
													</span>
												)}
											</div>
											<Check
												className={cn(
													"h-4 w-4 shrink-0",
													currentValue === wh.warehouseName
														? "opacity-100"
														: "opacity-0",
												)}
											/>
										</CommandItem>
									))}
								</CommandGroup>
							)}
						</CommandList>
					</Command>
				</PopoverContent>
			</PopoverPositioner>
		</Popover>
	);
}

function arePropsEqual(
	prevProps: TruckingWarehouseCellProps,
	nextProps: TruckingWarehouseCellProps,
) {
	return (
		prevProps.getValue() === nextProps.getValue() &&
		prevProps.row.original.id === nextProps.row.original.id &&
		prevProps.row.original.taxCode === nextProps.row.original.taxCode &&
		prevProps.column.id === nextProps.column.id &&
		prevProps.readOnly === nextProps.readOnly
	);
}

export const TruckingWarehouseCell = memo(
	TruckingWarehouseCellComponent,
	arePropsEqual,
);
