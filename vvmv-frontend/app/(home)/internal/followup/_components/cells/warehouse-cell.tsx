"use client";

import type { Table } from "@tanstack/react-table";
import { Check, ChevronsUpDown, Warehouse } from "lucide-react";
import { memo, useMemo, useState } from "react";
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
import { useWarehouseByTaxCode } from "@/hooks/use-warehouse-by-taxcode";
import { cn } from "@/lib/utils";
import type { FollowUpRow } from "../../types";
import { useCellTabIndex } from "./use-cell-tab-index";

interface WarehouseCellProps {
	getValue: () => unknown;
	row: { original: FollowUpRow };
	column: { id: string };
	table: Table<FollowUpRow>;
	readOnly?: boolean;
}

/**
 * WarehouseCell
 *
 * A table cell that renders a searchable combobox listing WarehouseConfig
 * names filtered by the row's taxCode (via PartnersMasterData).
 *
 * If the row has no taxCode, a plain editable text fallback is shown.
 */
function WarehouseCellComponent({
	getValue,
	row: { original },
	column: { id },
	table,
	readOnly = false,
}: WarehouseCellProps) {
	const currentValue = (getValue() as string | null | undefined) ?? "";
	const [open, setOpen] = useState(false);
	const [searchValue, setSearchValue] = useState("");

	const tabIndex = useCellTabIndex(table, original.id, id);

	// Fetch warehouses for this row's taxCode
	const taxCode = original.taxCode ?? null;
	const { warehouses, isLoading } = useWarehouseByTaxCode(taxCode);

	const filteredWarehouses = useMemo(() => {
		if (!searchValue) return warehouses;
		const q = searchValue.toLowerCase();
		return warehouses.filter((w) => w.warehouseName.toLowerCase().includes(q));
	}, [warehouses, searchValue]);

	const isDisabled = original.canEdit === false || readOnly;
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

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<Button
						variant="ghost"
						role="combobox"
						aria-expanded={open}
						tabIndex={!isDisabled ? tabIndex : undefined}
						disabled={isDisabled}
						className={cn(
							"w-full justify-between h-auto min-h-[32px] px-2 py-1 font-normal gap-1",
							isDisabled && "opacity-100 cursor-default hover:bg-transparent",
						)}
					/>
				}
			>
				<span className="flex items-center gap-1.5 truncate min-w-0">
					<Warehouse className="size-3 shrink-0 text-muted-foreground" />
					{currentValue ? (
						<span className="truncate text-xs">{currentValue}</span>
					) : (
						<span className="text-muted-foreground text-xs">
							{!hasTaxCode ? "—" : "Chọn kho..."}
						</span>
					)}
				</span>
				{!isDisabled && (
					<ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-40" />
				)}
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
							{/* No taxCode */}
							{!hasTaxCode && (
								<CommandEmpty>Không có MST để lọc kho.</CommandEmpty>
							)}

							{/* Loading */}
							{hasTaxCode && isLoading && (
								<CommandEmpty>Đang tải...</CommandEmpty>
							)}

							{/* No results */}
							{hasTaxCode && !isLoading && filteredWarehouses.length === 0 && (
								<CommandEmpty>
									{warehouses.length === 0
										? "Chưa cấu hình kho cho MST này."
										: "Không có kết quả."}
								</CommandEmpty>
							)}

							{/* Clear */}
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

							{/* Warehouse options */}
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

function areWarehouseCellPropsEqual(
	prevProps: WarehouseCellProps,
	nextProps: WarehouseCellProps,
) {
	return (
		prevProps.getValue() === nextProps.getValue() &&
		prevProps.row.original.id === nextProps.row.original.id &&
		prevProps.row.original.taxCode === nextProps.row.original.taxCode &&
		prevProps.column.id === nextProps.column.id &&
		prevProps.readOnly === nextProps.readOnly
	);
}

export const WarehouseCell = memo(
	WarehouseCellComponent,
	areWarehouseCellPropsEqual,
);
