"use client";

import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuPositioner,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubPositioner,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Configuration for a dropdown menu item
 */
export interface DropdownActionConfig {
	/** Unique key for the action */
	key: string;
	/** Display label */
	label: string;
	/** Icon component (optional) */
	icon?: React.ComponentType<{ className?: string }>;
	/** Click handler */
	onClick: () => void;
	/** Whether the action is disabled */
	disabled?: boolean;
	/** Custom class name for the item */
	className?: string;
}

/**
 * Configuration for a dropdown submenu
 */
export interface DropdownSubmenuConfig {
	/** Unique key for the submenu */
	key: string;
	/** Display label */
	label: string;
	/** Icon component (optional) */
	icon?: React.ComponentType<{ className?: string }>;
	/** Array of actions in the submenu */
	actions: DropdownActionConfig[];
	/** Whether the submenu is disabled */
	disabled?: boolean;
}

/**
 * Configuration for a separator in the dropdown
 */
export interface DropdownSeparatorConfig {
	type: "separator";
	key: string;
}

/**
 * Union type for all dropdown item types
 */
export type DropdownItemConfig =
	| DropdownActionConfig
	| DropdownSubmenuConfig
	| DropdownSeparatorConfig;

interface BaseActionDropdownProps {
	/** Array of dropdown items (actions, submenus, separators) */
	items: DropdownItemConfig[];
	/** Whether any action is currently loading */
	isLoading?: boolean;
	/** Custom trigger button (optional) - must be a valid React element */
	trigger?: React.ReactElement;
	/** Optional label for dropdown menu */
	menuLabel?: string;
}

/**
 * BaseActionDropdown Component
 *
 * Reusable dropdown menu for table row actions.
 * Supports flat actions, submenus, and separators.
 *
 * @example
 * ```tsx
 * <BaseActionDropdown
 *   items={[
 *     {
 *       key: "submenu",
 *       label: "Create Actions",
 *       icon: Play,
 *       actions: [
 *         { key: "action1", label: "Action 1", onClick: handleAction1 },
 *         { key: "action2", label: "Action 2", onClick: handleAction2 },
 *       ],
 *     },
 *     { type: "separator", key: "sep1" },
 *     {
 *       key: "delete",
 *       label: "Delete",
 *       icon: Trash2,
 *       onClick: handleDelete,
 *       className: "text-red-700",
 *     },
 *   ]}
 *   isLoading={isLoading}
 * />
 * ```
 */
export const BaseActionDropdown = ({
	items,
	isLoading = false,
	trigger,
	menuLabel,
}: BaseActionDropdownProps) => {
	const renderItem = (item: DropdownItemConfig) => {
		// Separator
		if ("type" in item && item.type === "separator") {
			return <DropdownMenuSeparator key={item.key} />;
		}

		// Submenu
		if ("actions" in item) {
			const submenu = item as DropdownSubmenuConfig;
			const Icon = submenu.icon;

			return (
				<DropdownMenuSub key={submenu.key}>
					<DropdownMenuSubTrigger disabled={submenu.disabled || isLoading}>
						{Icon && <Icon className="mr-2 h-4 w-4" />}
						{submenu.label}
					</DropdownMenuSubTrigger>
					<DropdownMenuSubPositioner side="right" sideOffset={6}>
						<DropdownMenuSubContent>
							{submenu.actions.map((action) => {
								const ActionIcon = action.icon;
								return (
									<DropdownMenuItem
										key={action.key}
										onClick={action.onClick}
										disabled={action.disabled || isLoading}
										className={action.className}
									>
										{ActionIcon && <ActionIcon className="mr-2 h-4 w-4" />}
										{action.label}
									</DropdownMenuItem>
								);
							})}
						</DropdownMenuSubContent>
					</DropdownMenuSubPositioner>
				</DropdownMenuSub>
			);
		}

		// Regular action
		const action = item as DropdownActionConfig;
		const Icon = action.icon;

		return (
			<DropdownMenuItem
				key={action.key}
				onClick={action.onClick}
				disabled={action.disabled || isLoading}
				className={action.className}
			>
				{Icon && <Icon className="mr-2 h-4 w-4" />}
				{action.label}
			</DropdownMenuItem>
		);
	};

	const defaultTrigger = (
		<Button
			variant="ghost"
			size="icon"
			className="size-4 p-0 hover:bg-slate-100 dark:hover:bg-slate-800"
		>
			<MoreVertical className="size-3 text-slate-500" />
		</Button>
	);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={trigger || defaultTrigger} />
			<DropdownMenuPositioner align="start">
				<DropdownMenuContent className="w-52">
					{menuLabel && (
						<>
							<DropdownMenuGroup>
								<DropdownMenuLabel>{menuLabel}</DropdownMenuLabel>
							</DropdownMenuGroup>
							<DropdownMenuSeparator />
						</>
					)}
					{items.map(renderItem)}
				</DropdownMenuContent>
			</DropdownMenuPositioner>
		</DropdownMenu>
	);
};
