"use client";

import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectPositioner,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ContainerRow } from "../../types";

interface ContainerFieldsProps {
	index: number;
	container: Partial<ContainerRow>;
	onFieldChange: (field: keyof ContainerRow, value: string | number) => void;
	onRemove: () => void;
	showRemoveButton?: boolean;
	containerSizes?: string[];
	error?: string | null;
}

export function ContainerFields({
	index,
	container,
	onFieldChange,
	onRemove,
	showRemoveButton = true,
	containerSizes = [],
	error,
}: ContainerFieldsProps) {
	return (
		<div
			className={cn(
				"border rounded-lg p-4 space-y-4 bg-muted/30 transition-colors",
				error && "border-red-500 bg-red-50/10 dark:bg-red-950/20",
			)}
		>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span className="text-sm font-medium text-muted-foreground">
						Container #{index + 1}
					</span>
					{error && (
						<span className="text-[11px] font-medium text-red-500 animate-in fade-in slide-in-from-left-1">
							{error}
						</span>
					)}
				</div>
				{showRemoveButton && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={onRemove}
						className="h-8 w-8 p-0 text-destructive hover:text-destructive"
					>
						<XIcon className="size-4" />
					</Button>
				)}
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{/* Container No */}
				<div className="space-y-2">
					<label className="text-sm font-medium">
						Container No <span className="text-red-500">*</span>
					</label>
					<Input
						placeholder="Enter container number"
						value={container.containerNo || ""}
						onChange={(e) => onFieldChange("containerNo", e.target.value)}
						className={cn(
							error &&
								"border-red-500 focus-visible:ring-red-500 bg-red-50/30 dark:bg-red-950/20",
						)}
					/>
				</div>

				{/* Seal No */}
				<div className="space-y-2">
					<label className="text-sm font-medium">Seal No</label>
					<Input
						placeholder="Enter seal number"
						value={container.sealNo || ""}
						onChange={(e) => onFieldChange("sealNo", e.target.value)}
					/>
				</div>

				{/* Container Size */}
				<div className="space-y-2">
					<label className="text-sm font-medium">Container Size</label>
					<Select
						value={container.containerSize || ""}
						onValueChange={(value: unknown) =>
							onFieldChange("containerSize", value as string)
						}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Select size" />
						</SelectTrigger>
						<SelectPositioner>
							<SelectContent>
								{containerSizes.map((size) => (
									<SelectItem key={size} value={size}>
										{size}
									</SelectItem>
								))}
							</SelectContent>
						</SelectPositioner>
					</Select>
				</div>

				{/* Gross Weight */}
				<div className="space-y-2">
					<label className="text-sm font-medium">G.W</label>
					<Input
						type="number"
						step="0.01"
						placeholder="Enter gross weight"
						value={container.grossWeight ?? ""}
						onChange={(e) => {
							const val =
								e.target.value === "" ? "" : parseFloat(e.target.value);
							onFieldChange(
								"grossWeight",
								Number.isNaN(val as number) && val !== "" ? 0 : val,
							);
						}}
					/>
				</div>

				{/* Package Qty */}
				<div className="space-y-2">
					<label className="text-sm font-medium">Package Qty</label>
					<Input
						type="number"
						step="1"
						placeholder="Enter package quantity"
						value={container.packageQty ?? ""}
						onChange={(e) => {
							const val =
								e.target.value === "" ? "" : parseFloat(e.target.value);
							onFieldChange(
								"packageQty",
								Number.isNaN(val as number) && val !== "" ? 0 : val,
							);
						}}
					/>
				</div>

				{/* Tare Weight */}
				<div className="space-y-2">
					<label className="text-sm font-medium">Tare Weight</label>
					<Input
						type="number"
						step="0.01"
						placeholder="Enter tare weight"
						value={container.tareWeight ?? ""}
						onChange={(e) => {
							const val =
								e.target.value === "" ? "" : parseFloat(e.target.value);
							onFieldChange(
								"tareWeight",
								Number.isNaN(val as number) && val !== "" ? 0 : val,
							);
						}}
					/>
				</div>
			</div>
		</div>
	);
}
