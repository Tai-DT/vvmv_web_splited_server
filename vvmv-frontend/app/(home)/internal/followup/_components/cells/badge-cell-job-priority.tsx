"use client";

import type { Table } from "@tanstack/react-table";
import type { VariantProps } from "class-variance-authority";
import { memo, useCallback, useMemo, useState } from "react";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectPositioner,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { FollowUpRow } from "../../types";
import { useCellTabIndex } from "./use-cell-tab-index";

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

interface BadgeCellProps {
	getValue: () => unknown;
	row: { original: FollowUpRow };
	column: { id: string };
	table: Table<FollowUpRow>;
	useDependency?: string;
}

export const PRIORITY_OPTIONS = [
	{
		value: 1,
		label: "P1 - Urgent",
		color: "destructive",
		backGround: "bg-destructive/10 text-destructive",
	},
	{
		value: 2,
		label: "P2 - High",
		color: "orange",
		backGround: "bg-orange-500/10 text-orange-600",
	},
	{
		value: 3,
		label: "P3 - Medium",
		color: "secondary",
		backGround: "bg-secondary/10 text-secondary-foreground",
	},
	{
		value: 4,
		label: "P4 - Normal",
		color: "info",
		backGround: "bg-blue-500/10 text-blue-600",
	},
	{
		value: 7,
		label: "P7 - Waiting",
		color: "cyan",
		backGround: "bg-cyan-500/10 text-cyan-600",
	},
] as const;

function getBadgeVariant(value: number): BadgeVariant {
	const option = PRIORITY_OPTIONS.find((opt) => opt.value === value);
	return (option?.color as BadgeVariant) || "secondary";
}

export const BadgeCellJobPriority = memo(
	({ getValue, row, column, table }: BadgeCellProps) => {
		const values = getValue() as number | string | null | undefined;
		const [isEditing, setIsEditing] = useState(false);

		// Calculate tabIndex based on visual column order
		const tabIndex = useCellTabIndex(table, row.original.id, column.id);

		const handleSelect = useCallback(
			(option: number) => {
				(table.options.meta as any)?.updateData?.(
					row.original.id,
					column.id,
					option,
				);
				setIsEditing(false);
			},
			[table.options.meta, row.original.id, column.id],
		);

		const renderBadges = useMemo(
			() => (
				<div className="flex flex-wrap gap-2">
					<Badge
						className="text-xs px-1 py-0.5"
						variant={getBadgeVariant(Number(values))}
					>
						{PRIORITY_OPTIONS.find((opt) => opt.value === Number(values))
							?.label || "P7 - Waiting"}
					</Badge>
				</div>
			),
			[values],
		);

		if (!isEditing) {
			return (
				<button
					onClick={() => setIsEditing(true)}
					tabIndex={tabIndex}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							setIsEditing(true);
						}
					}}
					className="flex flex-wrap gap-2 w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					{renderBadges}
				</button>
			);
		}

		const selectedValue = Number(values ?? 7);

		return (
			<Select
				value={String(selectedValue)}
				onValueChange={(value) => {
					if (value) {
						handleSelect(Number(value));
					}
				}}
				onOpenChange={(open) => !open && setIsEditing(false)}
				defaultOpen={true}
			>
				<SelectTrigger className="w-auto" tabIndex={tabIndex}>
					<SelectValue placeholder="Select option" />
				</SelectTrigger>
				<SelectPositioner>
					<SelectContent>
						{PRIORITY_OPTIONS.map((option) => (
							<SelectItem
								key={option.value}
								value={String(option.value)}
								className={option.backGround}
							>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</SelectPositioner>
			</Select>
		);
	},
);

BadgeCellJobPriority.displayName = "BadgeCellJobPriority";
