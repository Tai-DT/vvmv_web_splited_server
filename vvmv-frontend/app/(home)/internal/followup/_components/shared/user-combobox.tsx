"use client";

import { Check, ChevronsUpDown } from "lucide-react";
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
import { useSiteUsers } from "@/hooks/use-site-users";
import { cn } from "@/lib/utils";
import { UserDisplay } from "../cells/user-display";

export interface UserComboboxProps {
	value: string;
	onChange: (value: string) => void;
	label?: string;
	placeholder?: string;
	required?: boolean;
	className?: string;
	triggerClassName?: string;
	department?: string;
}

export function UserCombobox({
	value,
	onChange,
	label,
	placeholder = "Select user...",
	required = false,
	className,
	triggerClassName,
	department,
}: UserComboboxProps) {
	const [open, setOpen] = useState(false);
	const { users, isLoading } = useSiteUsers(department);

	const selectedUser = useMemo(() => {
		return users.find((u) => u.id === value);
	}, [users, value]);

	return (
		<div className={cn(label && "space-y-2", className)}>
			{label && (
				<label className="text-sm font-medium">
					{label}
					{required && <span className="text-red-500 ml-1">*</span>}
				</label>
			)}
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger
					render={
						<Button
							variant="outline"
							role="combobox"
							aria-expanded={open}
							className={cn(
								"w-full justify-between h-9 px-3 font-normal",
								triggerClassName,
							)}
						/>
					}
				>
					{selectedUser ? (
						<UserDisplay
							user={selectedUser}
							size="xs"
							showEmail={false}
							className="flex-1"
						/>
					) : (
						<span className="text-muted-foreground">
							{isLoading ? "Loading..." : placeholder}
						</span>
					)}
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</PopoverTrigger>
				<PopoverPositioner className="z-[110]">
					<PopoverContent className="w-[300px] p-0">
						<Command>
							<CommandInput placeholder="Search user..." className="h-9" />
							<CommandList>
								<CommandEmpty>
									{isLoading ? "Loading users..." : "No users found."}
								</CommandEmpty>
								<CommandGroup>
									<CommandItem
										value="__clear__"
										onSelect={() => {
											onChange("");
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
												!value ? "opacity-100" : "opacity-0",
											)}
										/>
									</CommandItem>
									{users.map((user) => (
										<CommandItem
											key={user.id}
											value={`${user.email} ${user.name || ""} ${user.username || ""} ${user.id}`}
											onSelect={() => {
												onChange(user.id);
												setOpen(false);
											}}
											className="flex items-center justify-between"
										>
											<UserDisplay
												user={user}
												size="sm"
												showEmail={true}
												className="flex-1"
											/>
											<Check
												className={cn(
													"ml-auto h-4 w-4",
													value === user.id ? "opacity-100" : "opacity-0",
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
		</div>
	);
}
