"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
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

export interface WarehouseInlineCellProps {
	/** MST của record cha (FollowUp.taxCode hoặc TruckingFollowUp.taxCode) */
	taxCode?: string | null;

	/** Giá trị kho đang được chọn */
	value: string;

	/** Callback khi user chọn / xóa kho */
	onChange: (val: string) => void;

	/** Highlight ô khi có thay đổi chưa lưu */
	isDirty?: boolean;

	/** Khi true: chỉ hiển thị, không cho chỉnh sửa (synced from container) */
	disabled?: boolean;

	/** className bổ sung cho wrapper */
	className?: string;
}

/**
 * WarehouseInlineCell
 *
 * Combobox nhỏ gọn dành cho các bảng dạng spreadsheet (Excel-style).
 * Khác với WarehouseCombobox (dành cho form/panel), component này:
 *   - Chiều cao chỉ 24px (h-6), vừa với dòng bảng
 *   - Không có label
 *   - Không có border, nền trong suốt, chỉ hiện hiệu ứng hover nhẹ
 *
 * Sử dụng:
 * ```tsx
 * <WarehouseInlineCell
 *   taxCode={row.taxCode}       // MST từ record cha
 *   value={row.warehouse ?? ""}
 *   onChange={(val) => handleCellChange(rowIndex, "warehouse", val)}
 *   isDirty={isDirty}
 * />
 * ```
 */
export function WarehouseInlineCell({
	taxCode,
	value,
	onChange,
	isDirty = false,
	disabled = false,
	className,
}: WarehouseInlineCellProps) {
	const [open, setOpen] = useState(false);
	const [searchValue, setSearchValue] = useState("");

	const { warehouses, isLoading } = useWarehouseByTaxCode(taxCode);
	const hasTaxCode = Boolean(taxCode && taxCode.trim() !== "");

	const filtered = useMemo(() => {
		if (!searchValue) return warehouses;
		const q = searchValue.toLowerCase();
		return warehouses.filter((w) => w.warehouseName.toLowerCase().includes(q));
	}, [warehouses, searchValue]);

	const handleSelect = (val: string) => {
		onChange(val);
		setOpen(false);
		setSearchValue("");
	};

	const handleClear = () => {
		onChange("");
		setOpen(false);
		setSearchValue("");
	};

	return (
		<div
			className={cn(isDirty && "ring-2 ring-amber-400/50 rounded", className)}
		>
			<Popover
				open={disabled ? false : open}
				onOpenChange={(v) => {
					if (!disabled) setOpen(v);
				}}
			>
				<PopoverTrigger
					className={cn(
						"flex h-6 w-full items-center justify-between rounded px-1 py-0 text-[11px]",
						"border-0 bg-transparent focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary/30",
						!disabled && "hover:bg-slate-100 dark:hover:bg-slate-800",
						disabled
							? "cursor-not-allowed opacity-60 text-indigo-600 dark:text-indigo-400 font-semibold"
							: !value && "text-muted-foreground italic",
					)}
					role="combobox"
					aria-expanded={open}
					aria-disabled={disabled}
					tabIndex={disabled ? -1 : 0}
				>
					<span className="truncate">
						{value || (hasTaxCode ? "Chọn kho..." : "—")}
					</span>
					<ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
				</PopoverTrigger>

				<PopoverPositioner>
					<PopoverContent className="w-[300px] p-0">
						<Command shouldFilter={false}>
							<CommandInput
								placeholder="Tìm kho..."
								className="h-8 text-xs"
								value={searchValue}
								onValueChange={setSearchValue}
							/>
							<CommandList style={{ maxHeight: "220px", overflow: "auto" }}>
								{/* Chưa có MST */}
								{!hasTaxCode && (
									<CommandEmpty className="text-xs">
										Chưa có MST để lọc kho.
									</CommandEmpty>
								)}

								{/* Đang tải */}
								{hasTaxCode && isLoading && (
									<CommandEmpty className="text-xs">Đang tải...</CommandEmpty>
								)}

								{/* Không tìm thấy */}
								{hasTaxCode && !isLoading && filtered.length === 0 && (
									<CommandEmpty className="text-xs">
										{warehouses.length === 0
											? "Chưa cấu hình kho cho MST này."
											: "Không tìm thấy kho."}
									</CommandEmpty>
								)}

								{/* Xóa lựa chọn */}
								{value && (
									<CommandGroup>
										<CommandItem
											value="__clear__"
											onSelect={handleClear}
											className="text-xs text-muted-foreground italic"
										>
											Xóa lựa chọn
										</CommandItem>
									</CommandGroup>
								)}

								{/* Danh sách kho */}
								{filtered.length > 0 && (
									<CommandGroup>
										{filtered.map((wh) => (
											<CommandItem
												key={wh.id}
												value={wh.warehouseName}
												onSelect={handleSelect}
												className="text-xs flex items-center justify-between"
											>
												<div className="flex flex-col min-w-0">
													<span className="truncate font-medium">
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
														"h-3 w-3 shrink-0",
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
