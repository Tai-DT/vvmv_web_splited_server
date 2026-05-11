"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { Check, ChevronsUpDown } from "lucide-react";
import type React from "react";
import { useMemo, useRef, useState } from "react";
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
import { cn } from "@/lib/utils";

export interface VirtualizedComboboxItem {
	id: string;
	name: string;
}

export interface VirtualizedComboboxProps {
	// Data
	items: VirtualizedComboboxItem[];
	value: string;
	onChange?: (value: string) => void;

	// Customization
	label?: string;
	placeholder?: string;
	searchPlaceholder?: string;
	emptyMessage?: string;
	required?: boolean;
	disabled?: boolean;

	// Styling
	className?: string;
	triggerClassName?: string;
	displayValue?: "id" | "name";
	onBlur?: () => void;
	autoFocus?: boolean;
	contentClassName?: string;
	showClearOption?: boolean;
	hideId?: boolean;
	defaultOpen?: boolean;
	renderSelected?: (
		selectedItem: VirtualizedComboboxItem | undefined,
	) => React.ReactNode;
}

function hasVisibleItemId(item: VirtualizedComboboxItem | undefined) {
	return Boolean(
		item?.id?.trim() &&
			item.name?.trim() &&
			item.id.trim() !== item.name.trim(),
	);
}

function SelectedNameWithCode({
	item,
	hideId,
}: {
	item: VirtualizedComboboxItem;
	hideId: boolean;
}) {
	if (hideId || !hasVisibleItemId(item)) {
		return item.name;
	}

	return (
		<span className="flex min-w-0 items-center gap-1.5">
			<span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">
				{item.id}
			</span>
			<span className="min-w-0 truncate">{item.name}</span>
		</span>
	);
}

export function VirtualizedCombobox({
	items,
	value,
	onChange,
	label,
	placeholder = "Select item...",
	searchPlaceholder = "Search...",
	emptyMessage = "No results found.",
	required = false,
	disabled = false,
	className,
	triggerClassName,
	contentClassName,
	displayValue = "id",
	onBlur,
	autoFocus,
	showClearOption = true,
	hideId = false,
	defaultOpen = false,
	renderSelected,
}: VirtualizedComboboxProps) {
	const [open, setOpen] = useState(defaultOpen);
	const [searchValue, setSearchValue] = useState("");
	const triggerRef = useRef<HTMLButtonElement>(null);
	const [triggerWidth, setTriggerWidth] = useState<number | undefined>();

	// Filter items based on search
	const filteredItems = useMemo(() => {
		if (!searchValue) return items;
		const searchLower = searchValue.toLowerCase();
		return items.filter(
			(item) =>
				item.id.toLowerCase().includes(searchLower) ||
				item.name.toLowerCase().includes(searchLower),
		);
	}, [items, searchValue]);

	// Virtualization setup - only use for large lists
	const parentRef = useRef<HTMLDivElement>(null);
	const shouldVirtualize = filteredItems.length > 100;
	const virtualizer = useVirtualizer({
		count: shouldVirtualize ? filteredItems.length : 0,
		getScrollElement: () => parentRef.current,
		estimateSize: () => 32,
		overscan: 5,
	});

	// Find selected item to display
	const selectedItem = items.find((item) => item.id === value);

	const handleSelect = (itemId: string) => {
		onChange?.(itemId);
		setOpen(false);
		setSearchValue("");
	};

	return (
		<div className={cn(label, className)}>
			{label && (
				<label className="text-sm font-medium">
					{label}
					{required && <span className="text-red-500 ml-1">*</span>}
				</label>
			)}
			<Popover
				open={disabled ? false : open}
				onOpenChange={(newOpen) => {
					if (disabled) return;
					setOpen(newOpen);
					// Update trigger width when opening
					if (newOpen && triggerRef.current) {
						setTriggerWidth(triggerRef.current.offsetWidth);
					}
					if (!newOpen) {
						// Use setTimeout to ensure focus has shifted
						setTimeout(() => {
							// If focus is NOT on the trigger button, it means we clicked away
							if (document.activeElement !== triggerRef.current) {
								onBlur?.();
							}
						}, 100);
					}
				}}
			>
				<PopoverTrigger
					className="min-w-0 block w-full"
					render={
						<Button
							ref={triggerRef}
							variant="outline"
							role="combobox"
							aria-expanded={open}
							disabled={disabled}
							autoFocus={autoFocus}
							onBlur={() => {
								// Only trigger if popover is NOT open.
								// If it IS open, the popover's onOpenChange(false) will handle it.
								if (!open) onBlur?.();
							}}
							className={cn(
								"w-full h-10 font-normal overflow-hidden relative",
								disabled && "opacity-50 cursor-not-allowed bg-muted",
								triggerClassName,
							)}
						>
							<span className="truncate min-w-0 pr-8 text-left block">
								{renderSelected ? (
									(renderSelected(selectedItem) ?? (
										<span className="text-muted-foreground">{placeholder}</span>
									))
								) : selectedItem ? (
									displayValue === "name" ? (
										<SelectedNameWithCode item={selectedItem} hideId={hideId} />
									) : (
										selectedItem.id
									)
								) : (
									<span className="text-muted-foreground">{placeholder}</span>
								)}
							</span>
							<ChevronsUpDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 shrink-0 opacity-50 pointer-events-none" />
						</Button>
					}
				></PopoverTrigger>
				<PopoverPositioner className="z-[110]" sideOffset={4}>
					<PopoverContent
						className={cn("p-0 shadow-xl", contentClassName)}
						style={{
							width: triggerWidth ? `${triggerWidth}px` : "auto",
							minWidth: "200px",
						}}
					>
						<Command shouldFilter={false}>
							<CommandInput
								placeholder={searchPlaceholder}
								className="h-9"
								value={searchValue}
								onValueChange={setSearchValue}
							/>
							<CommandList
								ref={parentRef}
								style={{ maxHeight: "300px", overflow: "auto" }}
							>
								<CommandEmpty>{emptyMessage}</CommandEmpty>
								{showClearOption && (
									<CommandGroup>
										<CommandItem
											value="__clear__"
											onSelect={() => handleSelect("")}
											className="flex items-center gap-2"
										>
											<span className="text-muted-foreground italic">
												Clear selection
											</span>
											<Check
												className={cn(
													"ml-auto h-4 w-4 shrink-0",
													!value ? "opacity-100" : "opacity-0",
												)}
											/>
										</CommandItem>
									</CommandGroup>
								)}
								{filteredItems.length > 0 && (
									<CommandGroup>
										{shouldVirtualize ? (
											<div
												ref={parentRef}
												style={{
													height: "250px",
													width: "100%",
													overflow: "auto",
													position: "relative",
												}}
											>
												<div
													style={{
														height: `${virtualizer.getTotalSize()}px`,
														width: "100%",
														position: "relative",
													}}
												>
													{virtualizer.getVirtualItems().map((virtualItem) => {
														const item = filteredItems[virtualItem.index];
														return (
															<CommandItem
																key={`${item.id}-${virtualItem.index}`}
																value={`${item.id} ${item.name}`}
																onSelect={() => handleSelect(item.id)}
																className="flex items-center justify-between"
																style={{
																	position: "absolute",
																	top: 0,
																	left: 0,
																	width: "100%",
																	height: `${virtualItem.size}px`,
																	transform: `translateY(${virtualItem.start}px)`,
																}}
															>
																<div className="flex items-center gap-3 truncate">
																	{!hideId && item.id !== item.name && (
																		<span className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded leading-none">
																			{item.id}
																		</span>
																	)}
																	<span className="truncate text-xs">
																		{item.name}
																	</span>
																</div>
																<Check
																	className={cn(
																		"h-4 w-4 shrink-0",
																		value === item.id
																			? "opacity-100"
																			: "opacity-0",
																	)}
																/>
															</CommandItem>
														);
													})}
												</div>
											</div>
										) : (
											/* Non-virtualized rendering for small lists */
											filteredItems.map((item) => (
												<CommandItem
													key={item.id}
													value={`${item.id} ${item.name}`}
													onSelect={() => handleSelect(item.id)}
													className="flex items-center justify-between"
												>
													<div className="flex items-center gap-3 truncate">
														{!hideId && item.id !== item.name && (
															<span className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded leading-none">
																{item.id}
															</span>
														)}
														<span className="truncate text-xs">
															{item.name}
														</span>
													</div>
													<Check
														className={cn(
															"h-4 w-4 shrink-0",
															value === item.id ? "opacity-100" : "opacity-0",
														)}
													/>
												</CommandItem>
											))
										)}
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
