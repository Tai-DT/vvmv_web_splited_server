"use client";

import {
	Check,
	ChevronsUpDown,
	ClipboardList,
	Package,
	Settings2,
	Truck,
} from "lucide-react";
import { WarehouseCombobox } from "@/components/shared/warehouse-combobox";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverPositioner,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectPositioner,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAirports } from "@/hooks/use-airports";
import { useCargoTypes } from "@/hooks/use-cargo-types";
import { useServiceModes } from "@/hooks/use-service-modes";
import { useSiteUsers } from "@/hooks/use-site-users";
import { useUnits } from "@/hooks/use-units";
import { useWorkTypes } from "@/hooks/use-work-types";
import { cn } from "@/lib/utils";
import type { FollowUp } from "@/prisma/client";
import { UserDisplay } from "../cells/user-display";
import { PartnerCombobox } from "../shared/partner-combobox";
import { FOLLOWUP_LABELS } from "../table/column-labels";

interface InformationPanelEditableProps {
	formData: Partial<FollowUp>;
	isReadOnly: boolean;
	handlerOpen: boolean;
	setHandlerOpen: (open: boolean) => void;
	onFieldChange: (field: keyof FollowUp, value: any) => void;
}

export function InformationPanelEditable({
	formData,
	isReadOnly,
	handlerOpen,
	setHandlerOpen,
	onFieldChange,
}: InformationPanelEditableProps) {
	const { airports } = useAirports();
	const { serviceModes } = useServiceModes();
	const { units } = useUnits();
	const { cargoTypes } = useCargoTypes();
	const { workTypes } = useWorkTypes();
	const { users: siteUsers } = useSiteUsers();

	const renderInput = (
		field: keyof FollowUp,
		type: string = "text",
		placeholder?: string,
		forceDisabled: boolean = false,
	) => (
		<div className="space-y-2">
			<label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide ml-1">
				{FOLLOWUP_LABELS[field as any] || field}
			</label>
			<Input
				type={type}
				value={(formData as any)[field] ?? ""}
				onChange={(e) => onFieldChange(field, e.target.value)}
				disabled={isReadOnly || forceDisabled}
				placeholder={
					placeholder || `Enter ${FOLLOWUP_LABELS[field as any] || field}...`
				}
				className={cn(
					"text-sm",
					(isReadOnly || forceDisabled) &&
						"bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed",
				)}
			/>
		</div>
	);

	const renderSelect = (
		field: keyof FollowUp,
		options: string[],
		placeholder?: string,
		forceDisabled: boolean = false,
	) => (
		<div className="space-y-2">
			<label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide ml-1">
				{FOLLOWUP_LABELS[field as any] || field}
			</label>
			<Select
				value={(formData as any)[field] || ""}
				onValueChange={(val) => onFieldChange(field, val)}
				disabled={isReadOnly || forceDisabled}
			>
				<SelectTrigger
					className={cn(
						"text-sm",
						(isReadOnly || forceDisabled) &&
							"bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed",
					)}
				>
					<SelectValue
						placeholder={
							placeholder ||
							`Select ${FOLLOWUP_LABELS[field as any] || field}...`
						}
					/>
				</SelectTrigger>
				{!(isReadOnly || forceDisabled) && (
					<SelectPositioner className="z-[110]">
						<SelectContent className="text-sm">
							{options.map((opt, index) => (
								<SelectItem key={`${field}-${opt}-${index}`} value={opt}>
									{opt}
								</SelectItem>
							))}
						</SelectContent>
					</SelectPositioner>
				)}
			</Select>
		</div>
	);

	const renderTextarea = (
		field: keyof FollowUp,
		label: string,
		placeholder?: string,
	) => (
		<div className="space-y-2">
			<label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide ml-1">
				{label}
			</label>
			<Textarea
				value={(formData as any)[field] || ""}
				onChange={(e) => onFieldChange(field, e.target.value)}
				disabled={isReadOnly}
				rows={3}
				className={cn(
					"text-sm resize-none",
					isReadOnly &&
						"bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed",
				)}
				placeholder={placeholder}
			/>
		</div>
	);

	const renderHandlerSelect = () => (
		<div className="space-y-2">
			<label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide ml-1">
				Handler
			</label>
			<Popover open={handlerOpen} onOpenChange={setHandlerOpen}>
				<PopoverTrigger
					render={
						<Button
							variant="outline"
							role="combobox"
							aria-expanded={handlerOpen}
							disabled={isReadOnly}
							className={cn(
								"w-full justify-between font-normal h-10 text-sm",
								isReadOnly &&
									"bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed",
							)}
						/>
					}
				>
					{(() => {
						const handlerId = (formData as any).handler;
						const user = siteUsers.find((u) => u.id === handlerId);
						if (!user)
							return (
								<span className="text-muted-foreground">Select handler...</span>
							);
						return <UserDisplay user={user} size="sm" />;
					})()}
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</PopoverTrigger>
				{!isReadOnly && (
					<PopoverPositioner className="z-[110]">
						<PopoverContent className="w-full p-0">
							<Command>
								<CommandInput placeholder="Search user..." />
								<CommandList>
									<CommandEmpty>No users found.</CommandEmpty>
									<CommandGroup>
										<CommandItem
											onSelect={() => {
												onFieldChange("handler", null);
												setHandlerOpen(false);
											}}
										>
											<Check
												className={cn(
													"mr-2 h-4 w-4",
													!(formData as any).handler
														? "opacity-100"
														: "opacity-0",
												)}
											/>
											<span className="text-muted-foreground italic">
												None (Clear)
											</span>
										</CommandItem>
										{siteUsers.map((user, index) => (
											<CommandItem
												key={`handler-${user.id}-${index}`}
												onSelect={() => {
													onFieldChange("handler", user.id);
													setHandlerOpen(false);
												}}
											>
												<Check
													className={cn(
														"mr-2 h-4 w-4",
														(formData as any).handler === user.id
															? "opacity-100"
															: "opacity-0",
													)}
												/>
												<UserDisplay user={user} size="sm" showEmail />
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</PopoverPositioner>
				)}
			</Popover>
		</div>
	);

	return (
		<div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 pb-10">
			{/* SECTION 1: BASIC INFORMATION */}
			<div className="space-y-6">
				<div className="flex items-center gap-3 border-b pb-3 border-slate-200 dark:border-slate-800">
					<div className="size-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
						<Settings2 className="size-5" />
					</div>
					<h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">
						Basic Information
					</h3>
				</div>
				<div className="grid gap-4 sm:gap-6 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
					{renderInput("taxCode", "text", undefined, true)}
					{renderSelect("operationType", ["XUAT", "NHAP"], undefined, true)}
					{renderInput("poNumber", "text")}
					{renderInput("arNumber", "text", undefined, true)}
					{renderInput("requestTruckingNo", "text", undefined, true)}
					{renderHandlerSelect()}
				</div>
			</div>

			{/* SECTION 2: LOGISTICS & TRANSPORTATION */}
			<div className="space-y-6">
				<div className="flex items-center gap-3 border-b pb-3 border-slate-200 dark:border-slate-800">
					<div className="size-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
						<Truck className="size-5" />
					</div>
					<h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">
						Logistics & Transportation
					</h3>
				</div>
				<div className="grid gap-4 sm:gap-6 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
					{renderSelect("serviceMode", serviceModes)}
					{renderSelect("cargoType", cargoTypes)}
					{renderSelect("workType", workTypes)}
					{renderInput("pol", "text")}
					{renderInput("pod", "text")}
					<WarehouseCombobox
						taxCode={(formData as any).taxCode}
						value={(formData as any).warehouse ?? ""}
						onChange={(val) => onFieldChange("warehouse", val)}
						label="Kho"
						disabled={isReadOnly}
					/>
					{renderSelect(
						"authority",
						airports.map((a) => a.name),
					)}
					{renderInput("supervisionGate", "text")}
					{renderInput("location", "text")}
					{renderInput("pickupLocation", "text")}
					{renderInput("loadingLocation", "text")}
					{renderInput("transportMethod", "text")}
					{renderInput("etaEtd", "date")}
					{renderInput("shmtDate", "date")}
					{renderInput("deliveryDate", "date")}
					{renderInput("transportDate", "date")}
					{renderInput("pickUpTime", "text")}
					{renderInput("truckNumber", "text")}
				</div>
			</div>

			{/* SECTION 3: CARGO & DOCUMENTATION */}
			<div className="space-y-6">
				<div className="flex items-center gap-3 border-b pb-3 border-slate-200 dark:border-slate-800">
					<div className="size-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
						<Package className="size-5" />
					</div>
					<h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">
						Cargo & Documentation
					</h3>
				</div>
				<div className="space-y-8">
					<div className="grid gap-4 sm:gap-6 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
						{renderInput("quantity", "number")}
						{renderSelect("unit", units)}
						{renderInput("grossWeight", "number")}
						{renderInput("cbm", "number")}
						{renderInput("commodityName", "text")}
					</div>
					<div className="mt-2 pt-6 border-t border-slate-200 dark:border-slate-800 grid gap-4 sm:gap-6 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
						{renderInput("invoice", "text")}
						{renderInput("billOrBooking", "text")}
						{renderInput("taxService", "text")}
						{renderInput("coNumber", "text")}
						<div className="space-y-2 sm:col-span-2 lg:col-span-2">
							<PartnerCombobox
								label="Supplier (Tax Code)"
								value={(formData.supplier as string) || ""}
								onChange={(value) => onFieldChange("supplier", value)}
								placeholder="Select supplier..."
								disabled={isReadOnly}
							/>
						</div>
					</div>
				</div>
			</div>

			{/* SECTION 4: NOTES & PRIORITY */}
			<div className="space-y-6">
				<div className="flex items-center gap-3 border-b pb-3 border-slate-200 dark:border-slate-800">
					<div className="size-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
						<ClipboardList className="size-5" />
					</div>
					<h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">
						Notes & Priority
					</h3>
				</div>
				<div className="grid gap-4 sm:gap-6 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
					<div className="lg:col-span-3">
						{renderTextarea(
							"notes",
							"Processing Notes",
							"Type internal job updates here...",
						)}
					</div>
					{renderTextarea("note2", FOLLOWUP_LABELS.note2)}
					{renderTextarea("note3", FOLLOWUP_LABELS.note3)}
					<div className="lg:col-span-3">
						{renderInput("botMessage", "text", undefined, true)}
					</div>
				</div>
			</div>
		</div>
	);
}
