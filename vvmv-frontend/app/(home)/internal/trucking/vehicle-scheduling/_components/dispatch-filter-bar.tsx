"use client";

import { CalendarDays, Search, X } from "lucide-react";
import { useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuPositioner,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { FCRBoardItem } from "../types";

export interface DispatchFilters {
	search: string;
	opType: "all" | "XUAT" | "NHAP";
	serviceModes: string[] | null; // null = show all; [] = show none; [...] = allowlist
	shippers: string[];
	date: string;
	hideOthersTasks: boolean;
}

export const EMPTY_FILTERS: DispatchFilters = {
	search: "",
	opType: "all",
	serviceModes: null,
	shippers: [],
	date: "",
	hideOthersTasks: false,
};

const QUICK_SERVICE_MODES = ["FCL", "AIR", "LCL"] as const;

/** Parse raw search string into tokens (split by comma / whitespace / newline) */
export function parseSearchTokens(raw: string): string[] {
	return raw
		.split(/[\s,;\n\r]+/)
		.map((t) => t.trim().toLowerCase())
		.filter(Boolean);
}

export function filterFcr(
	fcr: FCRBoardItem,
	filters: DispatchFilters,
	currentUserId?: string | null,
): boolean {
	if (
		filters.opType !== "all" &&
		fcr.truckingFollowUp.operationType !== filters.opType
	) {
		return false;
	}

	if (filters.serviceModes !== null) {
		const sm = fcr.truckingFollowUp.serviceMode ?? "";
		if (!filters.serviceModes.includes(sm)) return false;
	}

	if (
		filters.shippers.length > 0 &&
		!filters.shippers.includes(fcr.truckingFollowUp.companyName ?? "")
	) {
		return false;
	}

	if (
		filters.hideOthersTasks &&
		currentUserId &&
		fcr.truckingFollowUp.createdBy !== currentUserId
	) {
		return false;
	}

	if (filters.search) {
		const tokens = parseSearchTokens(filters.search);
		if (tokens.length === 0) return true;

		const fcrNum = fcr.fcrNumber?.toLowerCase() ?? "";
		const jobNum = fcr.truckingFollowUp.jobNumber?.toLowerCase() ?? "";
		const bill = fcr.truckingFollowUp.billOrBooking?.toLowerCase() ?? "";
		const shipper = (fcr.shipper ?? "").toLowerCase();
		const company = (fcr.truckingFollowUp.companyName ?? "").toLowerCase();
		const warehouse = (fcr.truckingFollowUp.warehouse ?? "").toLowerCase();

		// FCR passes if ANY token matches any of its searchable fields
		return tokens.some(
			(t) =>
				fcrNum.includes(t) ||
				jobNum.includes(t) ||
				bill.includes(t) ||
				shipper.includes(t) ||
				company.includes(t) ||
				warehouse.includes(t),
		);
	}

	return true;
}

export function isFiltering(filters: DispatchFilters): boolean {
	return (
		filters.search !== "" ||
		filters.opType !== "all" ||
		filters.serviceModes !== null ||
		filters.shippers.length > 0 ||
		filters.date !== "" ||
		filters.hideOthersTasks
	);
}

interface DispatchFilterBarProps {
	filters: DispatchFilters;
	onChange: (filters: DispatchFilters) => void;
	serviceModes: string[];
	shippers: string[];
}

export function DispatchFilterBar({
	filters,
	onChange,
	serviceModes,
	shippers,
}: DispatchFilterBarProps) {
	const active = isFiltering(filters);
	const [searchExpanded, setSearchExpanded] = useState(false);
	const searchRef = useRef<HTMLTextAreaElement>(null);
	const searchTokens = parseSearchTokens(filters.search);
	const multiSearch = searchTokens.length > 1;

	function resolveExplicit(): string[] {
		return filters.serviceModes ?? [...serviceModes];
	}

	function toNullIfAll(next: string[]): string[] | null {
		return serviceModes.every((m) => next.includes(m)) ? null : next;
	}

	function toggleQuickMode(prefix: string) {
		const variants = serviceModes.filter((m) =>
			m.toUpperCase().startsWith(prefix.toUpperCase()),
		);
		const explicit = resolveExplicit();
		const allChecked = variants.every((v) => explicit.includes(v));
		const next = allChecked
			? explicit.filter((m) => !variants.includes(m))
			: [...new Set([...explicit, ...variants])];
		onChange({ ...filters, serviceModes: toNullIfAll(next) });
	}

	function toggleServiceMode(mode: string) {
		const explicit = resolveExplicit();
		const next = explicit.includes(mode)
			? explicit.filter((m) => m !== mode)
			: [...explicit, mode];
		onChange({ ...filters, serviceModes: toNullIfAll(next) });
	}

	return (
		<div className="flex flex-col gap-3 p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200">
			{/* First row: Search + Operation type + Dropdowns */}
			<div className="flex items-center gap-3 flex-wrap">
				{/* Search input — supports multi-value (comma / space / newline separated) */}
				<div className="relative flex-1 min-w-[200px]">
					<Search className="absolute left-3 top-[10px] w-4 h-4 text-slate-400 pointer-events-none" />
					<textarea
						ref={searchRef}
						value={filters.search}
						rows={searchExpanded ? 4 : 1}
						onChange={(e) => onChange({ ...filters, search: e.target.value })}
						onFocus={() => setSearchExpanded(true)}
						onBlur={() => setSearchExpanded(false)}
						placeholder={
							searchExpanded
								? "Nhập nhiều FCR / job / bill...\nMỗi giá trị trên 1 dòng, hoặc cách nhau bằng dấu phẩy"
								: "Tìm FCR, job, bill... (nhiều giá trị)"
						}
						className={cn(
							"w-full pl-9 pr-16 py-2 text-sm rounded-lg border border-slate-300 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all resize-none leading-snug",
							multiSearch && "border-blue-400 bg-blue-50/40",
						)}
					/>
					<div className="absolute right-2 top-[6px] flex items-center gap-1">
						{multiSearch && (
							<span className="text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full leading-none">
								{searchTokens.length}
							</span>
						)}
						{filters.search && (
							<button
								type="button"
								onMouseDown={(e) => {
									e.preventDefault();
									onChange({ ...filters, search: "" });
								}}
								className="text-slate-400 hover:text-slate-600 p-0.5"
							>
								<X className="w-3.5 h-3.5" />
							</button>
						)}
					</div>
				</div>

				{/* Operation type toggle */}
				<div className="flex gap-1 rounded-lg border border-slate-300 overflow-hidden bg-white shadow-sm">
					{(["all", "NHAP", "XUAT"] as const).map((type) => (
						<button
							key={type}
							type="button"
							onClick={() => onChange({ ...filters, opType: type })}
							className={cn(
								"px-3 py-2 text-xs font-semibold transition-all",
								filters.opType === type
									? type === "NHAP"
										? "bg-blue-500 text-white shadow-md"
										: type === "XUAT"
											? "bg-orange-500 text-white shadow-md"
											: "bg-slate-700 text-white shadow-md"
									: "bg-white text-slate-600 hover:bg-slate-50",
							)}
						>
							{type === "all" ? "Tất cả" : type === "NHAP" ? "Nhập" : "Xuất"}
						</button>
					))}
				</div>

				{/* Service mode dropdown */}
				{serviceModes.length > 0 && (
					<DropdownMenu>
						<DropdownMenuTrigger
							className={cn(
								"flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-all",
								filters.serviceModes !== null
									? "bg-purple-500 text-white border-purple-600 shadow-md hover:bg-purple-600"
									: "bg-white text-slate-600 border-slate-300 hover:bg-slate-50",
							)}
						>
							<span>
								{filters.serviceModes !== null
									? filters.serviceModes.length === 0
										? "Dịch vụ (0)"
										: `Dịch vụ (${filters.serviceModes.length})`
									: "Tất cả dịch vụ"}
							</span>
							<span className="opacity-70">▼</span>
						</DropdownMenuTrigger>
						<DropdownMenuPositioner className="z-[1000]">
							<DropdownMenuContent className="min-w-[220px] z-[999]">
								<div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 mb-1">
									<span className="text-[11px] text-slate-500 uppercase tracking-widest font-bold">
										Service Mode
									</span>
									<button
										type="button"
										onClick={() =>
											onChange({
												...filters,
												serviceModes: filters.serviceModes === null ? [] : null,
											})
										}
										className="text-[11px] font-medium text-purple-600 hover:text-purple-700 transition-colors"
									>
										{filters.serviceModes === null
											? "Bỏ tất cả"
											: "Chọn tất cả"}
									</button>
								</div>
								{serviceModes.map((mode) => (
									<DropdownMenuCheckboxItem
										key={mode}
										checked={
											filters.serviceModes === null ||
											filters.serviceModes.includes(mode)
										}
										onCheckedChange={() => toggleServiceMode(mode)}
									>
										<span className="font-medium">{mode}</span>
									</DropdownMenuCheckboxItem>
								))}
							</DropdownMenuContent>
						</DropdownMenuPositioner>
					</DropdownMenu>
				)}

				{/* Shipper dropdown */}
				{shippers.length > 0 && (
					<DropdownMenu>
						<DropdownMenuTrigger
							className={cn(
								"flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-all",
								filters.shippers.length > 0
									? "bg-emerald-500 text-white border-emerald-600 shadow-md hover:bg-emerald-600"
									: "bg-white text-slate-600 border-slate-300 hover:bg-slate-50",
							)}
						>
							<span>
								{filters.shippers.length > 0
									? `Shipper (${filters.shippers.length})`
									: "Tất cả shipper"}
							</span>
							<span className="opacity-70">▼</span>
						</DropdownMenuTrigger>
						<DropdownMenuPositioner className="z-[1000]">
							<DropdownMenuContent className="min-w-[250px] z-[999]">
								{shippers.map((s) => (
									<DropdownMenuCheckboxItem
										key={s}
										checked={filters.shippers.includes(s)}
										onCheckedChange={() => {
											const next = filters.shippers.includes(s)
												? filters.shippers.filter((x) => x !== s)
												: [...filters.shippers, s];
											onChange({ ...filters, shippers: next });
										}}
									>
										<span className="font-medium">{s}</span>
									</DropdownMenuCheckboxItem>
								))}
							</DropdownMenuContent>
						</DropdownMenuPositioner>
					</DropdownMenu>
				)}

				{/* Date filter */}
				<div className="relative">
					<CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
					<input
						type="date"
						value={filters.date}
						onChange={(e) => onChange({ ...filters, date: e.target.value })}
						className={cn(
							"pl-9 pr-3 py-2 text-xs rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
							filters.date
								? "border-amber-400 bg-amber-50 text-amber-700 font-semibold"
								: "border-slate-300 text-slate-600",
						)}
					/>
				</div>

				{/* Clear all filters */}
				<button
					type="button"
					onClick={() => onChange(EMPTY_FILTERS)}
					className={cn(
						"flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors border",
						active
							? "text-red-600 hover:bg-red-50 border-red-200 cursor-pointer"
							: "text-red-600/30 border-red-200/30 cursor-not-allowed invisible",
					)}
					disabled={!active}
				>
					<X className="w-3.5 h-3.5" />
					Xóa
				</button>
			</div>

			{/* Second row: Quick filters + Hide others */}
			<div className="flex items-center gap-4 flex-wrap">
				{/* Hide others tasks */}
				<label className="flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors">
					<Checkbox
						checked={filters.hideOthersTasks}
						onCheckedChange={(checked) =>
							onChange({ ...filters, hideOthersTasks: !!checked })
						}
					/>
					<span className="text-sm font-medium text-slate-700">
						Chỉ việc của tôi
					</span>
				</label>

				{/* Separator */}
				<div className="w-px h-4 bg-slate-300" />

				{/* Quick service mode filters */}
				<div className="flex items-center gap-2">
					<span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
						Dịch vụ nhanh:
					</span>
					{QUICK_SERVICE_MODES.map((mode) => (
						<label
							key={mode}
							className="flex items-center gap-2 cursor-pointer select-none px-2.5 py-1 rounded-md hover:bg-slate-200 transition-colors"
						>
							<Checkbox
								checked={
									filters.serviceModes === null ||
									serviceModes
										.filter((m) =>
											m.toUpperCase().startsWith(mode.toUpperCase()),
										)
										.every((v) => filters.serviceModes?.includes(v))
								}
								onCheckedChange={() => toggleQuickMode(mode)}
							/>
							<span className="text-xs font-bold text-slate-700 uppercase">
								{mode}
							</span>
						</label>
					))}
				</div>
			</div>
		</div>
	);
}
