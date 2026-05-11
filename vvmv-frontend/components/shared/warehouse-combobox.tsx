"use client";

import { Check, ChevronsUpDown, Warehouse } from "lucide-react";
import { useMemo, useState } from "react";
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
import {
	useWarehouseByTaxCode,
	type WarehouseOption,
} from "@/hooks/use-warehouse-by-taxcode";
import { cn } from "@/lib/utils";

export interface WarehouseComboboxProps {
	/**
	 * The customer tax code (MST). When provided, the combobox will fetch and
	 * display WarehouseConfig entries linked to this taxCode via PartnersMasterData.
	 * When empty/null, all options are cleared and a notice is shown.
	 */
	taxCode: string | null | undefined;

	/** Currently selected warehouse name value */
	value: string;

	/** Called when the user selects or clears a warehouse */
	onChange?: (value: string) => void;

	/**
	 * Called with the full WarehouseOption when the user makes a selection.
	 * Useful for auto-filling delivery address / contact info on the parent form.
	 */
	onWarehouseSelect?: (warehouse: WarehouseOption | null) => void;

	/** Label shown above the combobox. Defaults to "Kho" */
	label?: string;

	/** Placeholder text when no value is selected */
	placeholder?: string;

	/** Whether the combobox is disabled */
	disabled?: boolean;

	/** Whether a value is required */
	required?: boolean;

	/** Additional className for the wrapper div */
	className?: string;

	/** Additional className for the trigger button */
	triggerClassName?: string;

	/** z-index for the popover positioner (useful inside dialogs/drawers) */
	positionerClassName?: string;
}

/**
 * WarehouseCombobox
 *
 * A reusable, searchable combo-box that lists warehouse names from
 * WarehouseConfig, filtered by a customer's taxCode (via PartnersMasterData).
 *
 * Usage:
 * ```tsx
 * <WarehouseCombobox
 *   taxCode={formData.taxCode}
 *   value={formData.warehouse ?? ""}
 *   onChange={(name) => setFormData({ ...formData, warehouse: name })}
 *   onWarehouseSelect={(wh) => {
 *     // optionally pre-fill delivery address, contact info, etc.
 *   }}
 *   label="Kho"
 *   disabled={isReadOnly}
 * />
 * ```
 */
export function WarehouseCombobox({
	taxCode,
	value,
	onChange,
	onWarehouseSelect,
	label = "Kho",
	placeholder = "Chọn kho...",
	disabled = false,
	required = false,
	className,
	triggerClassName,
	positionerClassName = "z-[110]",
}: WarehouseComboboxProps) {
	const [open, setOpen] = useState(false);
	const [searchValue, setSearchValue] = useState("");

	const { warehouses, isLoading } = useWarehouseByTaxCode(taxCode);

	// Filter by search
	const filteredWarehouses = useMemo(() => {
		if (!searchValue) return warehouses;
		const q = searchValue.toLowerCase();
		return warehouses.filter((w) => w.warehouseName.toLowerCase().includes(q));
	}, [warehouses, searchValue]);

	const _selectedWarehouse = warehouses.find((w) => w.warehouseName === value);

	const handleSelect = (warehouseName: string) => {
		const wh =
			warehouses.find((w) => w.warehouseName === warehouseName) ?? null;
		onChange?.(warehouseName);
		onWarehouseSelect?.(wh);
		setOpen(false);
		setSearchValue("");
	};

	const handleClear = () => {
		onChange?.("");
		onWarehouseSelect?.(null);
		setOpen(false);
		setSearchValue("");
	};

	const hasTaxCode = Boolean(taxCode && taxCode.trim() !== "");

	return (
		<div className={cn("space-y-2", className)}>
			{label && (
				<label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide ml-1">
					{label}
					{required && <span className="text-red-500 ml-1">*</span>}
				</label>
			)}

			<Popover
				open={disabled ? false : open}
				onOpenChange={(next) => {
					if (disabled) return;
					setOpen(next);
				}}
			>
				<PopoverTrigger
					className="min-w-0 block w-full"
					render={
						<Button
							variant="outline"
							role="combobox"
							aria-expanded={open}
							disabled={disabled}
							className={cn(
								"w-full h-10 font-normal overflow-hidden relative justify-between text-sm",
								disabled && "opacity-50 cursor-not-allowed bg-muted",
								triggerClassName,
							)}
						/>
					}
				>
					<span className="flex items-center gap-2 truncate min-w-0 pr-8">
						<Warehouse className="size-4 shrink-0 text-muted-foreground" />
						{value ? (
							<span className="truncate">{value}</span>
						) : (
							<span className="text-muted-foreground">
								{!hasTaxCode
									? "Vui lòng chọn MST trước"
									: isLoading
										? "Đang tải kho..."
										: placeholder}
							</span>
						)}
					</span>
					<ChevronsUpDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 shrink-0 opacity-50 pointer-events-none" />
				</PopoverTrigger>

				<PopoverPositioner className={positionerClassName} sideOffset={4}>
					<PopoverContent
						className="p-0 shadow-xl"
						style={{
							minWidth: "240px",
							width: "var(--radix-popover-trigger-width, 280px)",
						}}
					>
						<Command shouldFilter={false}>
							<CommandInput
								placeholder="Tìm tên kho..."
								className="h-9"
								value={searchValue}
								onValueChange={setSearchValue}
							/>
							<CommandList style={{ maxHeight: "260px", overflow: "auto" }}>
								{/* No taxCode notice */}
								{!hasTaxCode && (
									<CommandEmpty>
										Vui lòng nhập Mã số thuế (MST) để lọc danh sách kho.
									</CommandEmpty>
								)}

								{/* Loading */}
								{hasTaxCode && isLoading && (
									<CommandEmpty>Đang tải danh sách kho...</CommandEmpty>
								)}

								{/* No results */}
								{hasTaxCode &&
									!isLoading &&
									filteredWarehouses.length === 0 && (
										<CommandEmpty>
											{warehouses.length === 0
												? "Không tìm thấy kho nào cho MST này."
												: "Không có kết quả phù hợp."}
										</CommandEmpty>
									)}

								{/* Clear option */}
								{value && (
									<CommandGroup>
										<CommandItem
											value="__clear__"
											onSelect={handleClear}
											className="flex items-center gap-2 text-muted-foreground italic"
										>
											Xóa lựa chọn
										</CommandItem>
									</CommandGroup>
								)}

								{/* Warehouse list */}
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
													<span className="font-medium text-sm truncate">
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
														value === wh.warehouseName
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
		</div>
	);
}
