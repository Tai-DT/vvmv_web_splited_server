"use client";

import type { Table } from "@tanstack/react-table";
import { Check } from "lucide-react";
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
import type { SiteUser } from "@/hooks/use-site-users";

import { cn } from "@/lib/utils";
import { useCellTabIndex } from "./use-cell-tab-index";
import { UserDisplay, type UserDisplaySize } from "./user-display";

interface HandlerCellProps {
	getValue: () => unknown;
	row: { original: any };
	column: { id: string };
	table: Table<any>;
	useDependency?: string;
}

/**
 * HandlerCell Component
 *
 * A cell component that displays handler info like CreatedByCell (with avatar)
 * but allows selection from site users via dropdown.
 *
 * Features:
 * - Displays user avatar, name, and email when a handler is selected
 * - Dropdown to select from users in the same site
 * - Stores user ID in the handler field
 * - Search/filter through users
 */
function HandlerCellComponent({
	getValue,
	row: { original },
	column: { id },
	table,
	useDependency = "siteUsers",
}: HandlerCellProps) {
	const initialValue = (getValue() as string | null | undefined) ?? "";
	const [open, setOpen] = useState(false);

	// Calculate tabIndex based on visual column order
	const tabIndex = useCellTabIndex(table, original.id, id);

	// Get site users from table meta dependencies
	const siteUsers: SiteUser[] = useMemo(() => {
		if (useDependency && (table.options.meta as any)?.dependencies) {
			return (table.options.meta as any).dependencies[useDependency] || [];
		}
		return [];
	}, [useDependency, table.options.meta]);

	// Find selected user from dependencies or use data from row
	const selectedUser = useMemo<SiteUser | undefined>(() => {
		// 1. Priority: Use the resolved handlerUser object from the API if available
		if (original.handlerUser) {
			return {
				id: original.handlerUser.id,
				name:
					original.handlerUser.name ||
					original.handlerUser.username ||
					original.handlerUser.email,
				email: original.handlerUser.email,
				username: original.handlerUser.username,
				image: original.handlerUser.image,
				site: original.domain || null,
			} as SiteUser;
		}

		// 2. Fallback: Search in siteUsers dependency using various identifiers
		const val = initialValue.trim();
		if (val) {
			const depUser = siteUsers.find(
				(user) =>
					user.id === val || user.email === val || user.username === val,
			);
			if (depUser) return depUser;
		}

		return undefined;
	}, [siteUsers, initialValue, original.handlerUser, original.domain]);

	// Render user display using shared UserDisplay component
	const renderUserDisplay = (
		user: SiteUser | undefined,
		_size: UserDisplaySize = "sm",
	) => {
		if (!user) {
			return (
				<span className="text-muted-foreground truncate">
					{selectedUser
						? selectedUser.name || initialValue
						: initialValue || "Select handler..."}
				</span>
			);
		}

		return <UserDisplay user={user} size="md" showEmail />;
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<Button
						variant="ghost"
						role="combobox"
						aria-expanded={open}
						tabIndex={original.canEdit !== false ? tabIndex : undefined}
						disabled={original.canEdit === false}
						className={cn(
							"w-full justify-between h-auto min-h-[40px] px-2 py-1 font-normal",
							original.canEdit === false &&
								"opacity-100 cursor-default hover:bg-transparent",
						)}
					/>
				}
			>
				{renderUserDisplay(selectedUser, "sm")}
				{/* <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /> */}
			</PopoverTrigger>
			<PopoverPositioner>
				<PopoverContent className="w-[320px] p-0">
					<Command>
						<CommandInput placeholder="Search user..." className="h-9" />
						<CommandList>
							<CommandEmpty>No users found.</CommandEmpty>
							<CommandGroup>
								{/* Option to clear selection */}
								<CommandItem
									value="__clear__"
									onSelect={() => {
										(table.options.meta as any)?.updateData?.(
											original.id,
											id,
											null,
										);
										setOpen(false);
									}}
									className="flex items-center gap-2"
								>
									<span className="text-muted-foreground italic">
										Clear selection
									</span>
									<Check
										className={cn(
											"ml-auto h-4 w-4 shrink-0",
											!initialValue ? "opacity-100" : "opacity-0",
										)}
									/>
								</CommandItem>

								{siteUsers.map((user) => (
									<CommandItem
										key={user.id}
										value={`${user.email} ${user.name || ""} ${user.username || ""} ${user.id}`}
										onSelect={() => {
											(table.options.meta as any)?.updateData?.(
												original.id,
												id,
												user.id,
											);
											setOpen(false);
										}}
										className="flex items-center gap-2 py-2"
									>
										<UserDisplay
											user={user}
											size="md"
											showEmail
											className="flex-1 min-w-0"
										/>
										<Check
											className={cn(
												"h-4 w-4 shrink-0",
												initialValue === user.id ? "opacity-100" : "opacity-0",
											)}
										/>
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</PopoverPositioner>
		</Popover>
	);
}

// Custom comparison function for memo
function areHandlerCellPropsEqual(
	prevProps: HandlerCellProps,
	nextProps: HandlerCellProps,
) {
	return (
		prevProps.getValue() === nextProps.getValue() &&
		prevProps.row.original.id === nextProps.row.original.id &&
		prevProps.column.id === nextProps.column.id &&
		prevProps.row.original.handlerUser === nextProps.row.original.handlerUser
	);
}

export const HandlerCell = memo(HandlerCellComponent, areHandlerCellPropsEqual);
