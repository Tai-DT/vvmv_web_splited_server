"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertCircle,
	Check,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	ChevronsUpDown,
	ClipboardPaste,
	FileSpreadsheet,
	Loader2,
	Package,
	Pencil,
	Plus,
	RefreshCw,
	Save,
	Search,
	ShieldCheck,
	Trash2,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverPositioner,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { type Airport, useAirports } from "@/hooks/use-airports";
import { useContainerSizes } from "@/hooks/use-container-sizes";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type Site = "SGN" | "HAN" | "DAD";

interface ContainerSizeConfigRecord {
	id: string;
	containerSize: string;
	isoType?: string | null;
	kc?: string | null;
	port?: string | null;
	site: Site;
	createdAt: string;
	updatedAt: string;
}

type FormState = {
	containerSize: string;
	isoType: string;
	kc: string;
	port: string;
};

// ─── Airport Combobox (standalone, no hooks inside parent render) ───────────
function AirportCombobox({
	value,
	onChange,
	airports,
}: {
	value: string;
	onChange: (v: string) => void;
	airports: Airport[];
}) {
	const [open, setOpen] = useState(false);
	const selected = airports.find((a) => a.name === value);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<Button
						variant="outline"
						role="combobox"
						aria-expanded={open}
						className="w-full justify-between font-normal h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none text-sm"
					/>
				}
			>
				{selected?.name ? (
					<span className="truncate">{selected.name}</span>
				) : (
					<span className="text-muted-foreground italic opacity-60">
						Chọn cảng / sân bay...
					</span>
				)}
				<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
			</PopoverTrigger>
			<PopoverPositioner className="z-[150]" sideOffset={4}>
				<PopoverContent className="w-full p-0 rounded-xl overflow-hidden border-none shadow-2xl">
					<Command>
						<CommandInput placeholder="Tìm cảng / sân bay..." />
						<CommandList className="max-h-[240px]">
							<CommandEmpty>Không tìm thấy.</CommandEmpty>
							<CommandGroup>
								<CommandItem
									onSelect={() => {
										onChange("");
										setOpen(false);
									}}
								>
									<Check
										className={cn(
											"mr-2 h-4 w-4",
											!value ? "opacity-100" : "opacity-0",
										)}
									/>
									<span className="text-muted-foreground italic">
										— Không chọn —
									</span>
								</CommandItem>
								{airports
									.filter((a) => a.id !== "")
									.map((a) => (
										<CommandItem
											key={a.id}
											onSelect={() => {
												onChange(a.name);
												setOpen(false);
											}}
										>
											<Check
												className={cn(
													"mr-2 h-4 w-4",
													value === a.name ? "opacity-100" : "opacity-0",
												)}
											/>
											{a.name}
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

// ─── ContainerSize Combobox ───────────────────────────────────────────────
function ContainerSizeCombobox({
	value,
	onChange,
	sizes,
	disabled = false,
}: {
	value: string;
	onChange: (v: string) => void;
	sizes: string[];
	disabled?: boolean;
}) {
	const [open, setOpen] = useState(false);
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<Button
						variant="outline"
						role="combobox"
						disabled={disabled}
						aria-expanded={open}
						className={cn(
							"w-full justify-between font-mono font-black uppercase h-12 rounded-xl border-none text-sm",
							disabled
								? "bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
								: "bg-slate-50 dark:bg-slate-800",
						)}
					/>
				}
			>
				{value || (
					<span className="font-normal font-sans italic text-muted-foreground opacity-60">
						Chọn container size từ ERP...
					</span>
				)}
				<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
			</PopoverTrigger>
			{!disabled && (
				<PopoverPositioner className="z-[150]" sideOffset={4}>
					<PopoverContent className="w-full p-0 rounded-xl overflow-hidden border-none shadow-2xl">
						<Command>
							<CommandInput placeholder="Tìm size..." />
							<CommandList className="max-h-[240px]">
								<CommandEmpty>Không tìm thấy.</CommandEmpty>
								<CommandGroup>
									{sizes.map((s) => (
										<CommandItem
											key={s}
											onSelect={() => {
												onChange(s);
												setOpen(false);
											}}
										>
											<Check
												className={cn(
													"mr-2 h-4 w-4",
													value === s ? "opacity-100" : "opacity-0",
												)}
											/>
											<span className="font-mono font-bold">{s}</span>
										</CommandItem>
									))}
								</CommandGroup>
							</CommandList>
						</Command>
					</PopoverContent>
				</PopoverPositioner>
			)}
		</Popover>
	);
}

// ─── Reusable field label ─────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
	return (
		<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
			{children}
		</label>
	);
}

// ─── Main Editor ──────────────────────────────────────────────────────────
export function ContainerSizeConfigEditor() {
	const queryClient = useQueryClient();
	const { data: sessionData } = useSession();
	const session = sessionData?.user;
	const userSite = (session as any)?.site as Site | undefined;

	const { containerSizes } = useContainerSizes();
	const { airports } = useAirports();

	// ── State ─────────────────────────────────────────────────────────────────
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [page, setPage] = useState(1);
	const pageSize = 50;

	// Dialog states
	const [isAdding, setIsAdding] = useState(false);
	const [isImporting, setIsImporting] = useState(false);
	const [editingRecord, setEditingRecord] =
		useState<ContainerSizeConfigRecord | null>(null);
	const [errorDetails, setErrorDetails] = useState<{
		title: string;
		message: string;
	} | null>(null);
	const [importResult, setImportResult] = useState<{
		count: number;
		skipped: number;
		duplicates: string[];
	} | null>(null);

	// Controlled form state (shared between add & edit dialogs)
	const [form, setForm] = useState<FormState>({
		containerSize: "",
		isoType: "",
		kc: "",
		port: "",
	});

	// Import state
	const [importRows, setImportRows] = useState<
		Array<FormState & { site: Site }>
	>([]);
	const [importSite, setImportSite] = useState<Site>(
		(userSite || "SGN") as Site,
	);

	// ── Debounce search ───────────────────────────────────────────────────────
	useEffect(() => {
		const t = setTimeout(() => {
			setDebouncedSearch(searchQuery);
			setPage(1);
		}, 400);
		return () => clearTimeout(t);
	}, [searchQuery]);

	// ── Fetch ─────────────────────────────────────────────────────────────────
	const { data, isLoading, isFetching } = useQuery({
		queryKey: ["container-size-configs-admin", page, debouncedSearch],
		queryFn: async () => {
			const params = new URLSearchParams({
				page: String(page),
				pageSize: String(pageSize),
				search: debouncedSearch,
			});
			const res = await fetch(`/api/admin/container-size-configs?${params}`);
			if (!res.ok) throw new Error("Failed to load data");
			return res.json();
		},
	});

	const records: ContainerSizeConfigRecord[] = data?.items || [];
	const pagination = data?.pagination || { total: 0, totalPages: 1 };

	// ── Invalidate both admin + public caches ─────────────────────────────────
	const invalidate = useCallback(() => {
		queryClient.invalidateQueries({
			queryKey: ["container-size-configs-admin"],
		});
		queryClient.invalidateQueries({ queryKey: ["container-size-configs"] });
	}, [queryClient]);

	// ── Mutations ─────────────────────────────────────────────────────────────
	const createMutation = useMutation({
		mutationFn: async (payload: FormState & { site: Site }) => {
			const res = await fetch("/api/admin/container-size-configs", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || "Failed to create");
			return data;
		},
		onSuccess: () => {
			invalidate();
			toast.success("Đã thêm cấu hình container size");
			setIsAdding(false);
			setForm({ containerSize: "", isoType: "", kc: "", port: "" });
		},
		onError: (err: any) =>
			setErrorDetails({ title: "Lỗi Thêm Mới", message: err.message }),
	});

	const updateMutation = useMutation({
		mutationFn: async (payload: FormState & { id: string; site: Site }) => {
			const res = await fetch("/api/admin/container-size-configs", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || "Failed to update");
			return data;
		},
		onSuccess: () => {
			invalidate();
			toast.success("Đã cập nhật");
			setEditingRecord(null);
		},
		onError: (err: any) =>
			setErrorDetails({ title: "Lỗi Cập Nhật", message: err.message }),
	});

	const deleteMutation = useMutation({
		mutationFn: async (id: string) => {
			const res = await fetch(`/api/admin/container-size-configs?id=${id}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("Failed to delete");
		},
		onSuccess: () => {
			invalidate();
			toast.success("Đã xóa");
		},
		onError: (err: any) =>
			setErrorDetails({ title: "Lỗi Xóa Dữ Liệu", message: err.message }),
	});

	const createMultiMutation = useMutation({
		mutationFn: async (items: typeof importRows) => {
			const res = await fetch("/api/admin/container-size-configs", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(items),
			});
			const data = await res.json();
			if (!res.ok)
				throw new Error(data.message || data.details || "Lỗi không xác định");
			return data;
		},
		onSuccess: (data) => {
			invalidate();
			setIsImporting(false);
			setImportRows([]);
			// Show result summary dialog
			setImportResult({
				count: data.count,
				skipped: data.skipped,
				duplicates: data.duplicates || [],
			});
		},
		onError: (err: any) =>
			setErrorDetails({ title: "Lỗi Nhập Excel", message: err.message }),
	});

	// ── Helpers ───────────────────────────────────────────────────────────────
	const openAdd = () => {
		setForm({ containerSize: "", isoType: "", kc: "", port: "" });
		setIsAdding(true);
	};

	const openEdit = (r: ContainerSizeConfigRecord) => {
		setEditingRecord(r);
		setForm({
			containerSize: r.containerSize,
			isoType: r.isoType || "",
			kc: r.kc || "",
			port: r.port || "",
		});
	};

	const airportName = useCallback(
		(id: string | null | undefined) => {
			if (!id) return "—";
			return airports.find((a) => a.id === id)?.name || id;
		},
		[airports],
	);

	const handleImportPaste = (e: React.ClipboardEvent) => {
		const text = e.clipboardData.getData("text");
		const lines = text.split(/\r?\n/).filter((l) => l.trim());
		if (lines.length === 0) return;
		e.preventDefault();
		const parsed = lines
			.map((line) => {
				const cols = line.split("\t");
				return {
					containerSize: (cols[0] || "").trim().toUpperCase(),
					isoType: (cols[1] || "").trim().toUpperCase(),
					kc: (cols[2] || "").trim(),
					port: (cols[3] || "").trim(),
					site: importSite,
				};
			})
			.filter((r) => r.containerSize);
		setImportRows((prev) => [...parsed, ...prev]);
		toast.success(`Đã nhận ${parsed.length} dòng từ Excel`);
	};

	// ── Form shared fields (defined outside renders to avoid focus loss) ───────
	const sharedFormFields = (
		<>
			{/* ISO Type */}
			<div className="space-y-2">
				<FieldLabel>ISO 6346 Type (4 ký tự, tuỳ chọn)</FieldLabel>
				<Input
					placeholder="Ví dụ: 22G1, 45G1, 22R1..."
					value={form.isoType}
					maxLength={4}
					onChange={(e) =>
						setForm((p) => ({ ...p, isoType: e.target.value.toUpperCase() }))
					}
					className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-4 focus:ring-teal-500/10 font-mono font-bold"
				/>
			</div>

			{/* KC / Kích cỡ */}
			<div className="space-y-2">
				<FieldLabel>Kích Cỡ (KC) — tuỳ chọn</FieldLabel>
				<Input
					placeholder="Ví dụ: 20'DC, 40'HC, 40'RF..."
					value={form.kc}
					onChange={(e) => setForm((p) => ({ ...p, kc: e.target.value }))}
					className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-4 focus:ring-teal-500/10 font-bold"
				/>
			</div>

			{/* Port – Combobox */}
			<div className="space-y-2">
				<FieldLabel>Cảng / Sân Bay — tuỳ chọn</FieldLabel>
				<AirportCombobox
					value={form.port}
					onChange={(v) => setForm((p) => ({ ...p, port: v }))}
					airports={airports}
				/>
			</div>
		</>
	);

	return (
		<div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border shadow-xl overflow-hidden animate-in fade-in zoom-in duration-500">
			{/* Header */}
			<div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/50 p-6 border-b shrink-0">
				<div className="flex items-center gap-4">
					<div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
						<Package className="size-6 text-teal-600 dark:text-teal-400" />
					</div>
					<div>
						<h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
							Cấu Hình Kích Thước Container
						</h3>
						<div className="flex items-center gap-2 mt-0.5">
							<span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
								{pagination.total} cấu hình
							</span>
							{isFetching && (
								<Loader2 className="size-3 animate-spin text-teal-500" />
							)}
						</div>
					</div>
				</div>

				<div className="flex items-center gap-3">
					<div className="relative group">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-teal-500 transition-colors" />
						<Input
							placeholder="Tìm theo size, ISO type, kích cỡ..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-10 w-[300px] h-11 border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 backdrop-blur rounded-xl focus:ring-4 focus:ring-teal-50 dark:focus:ring-teal-900/20 transition-all font-medium"
						/>
					</div>
					<Button
						variant="outline"
						size="icon"
						onClick={() =>
							queryClient.invalidateQueries({
								queryKey: ["container-size-configs-admin"],
							})
						}
						className="h-11 w-11 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-white transition-all shadow-sm"
					>
						<RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
					</Button>
					<Button
						onClick={() => setIsImporting(true)}
						variant="outline"
						className="h-11 px-4 rounded-xl font-bold border-slate-200 dark:border-slate-700 hover:bg-white text-slate-600 dark:text-slate-300 transition-all flex items-center gap-2"
					>
						<FileSpreadsheet className="size-5" />
						Nhập từ Excel
					</Button>
					<Button
						onClick={openAdd}
						className="bg-teal-600 hover:bg-teal-700 h-11 px-6 rounded-xl font-bold shadow-lg shadow-teal-500/20 text-white transition-all active:scale-95 flex items-center gap-2"
					>
						<Plus className="size-5" />
						Thêm mới
					</Button>
				</div>
			</div>

			{/* Table */}
			<div className="flex-1 overflow-auto bg-white/50 dark:bg-transparent custom-scrollbar">
				<Table className="relative w-full border-separate border-spacing-0">
					<TableHeader className="sticky top-0 z-10 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur border-b">
						<TableRow className="hover:bg-transparent border-none">
							{[
								{ label: "STT", w: "w-12" },
								{ label: "Container Size (ERP)", w: "w-[180px]" },
								{ label: "ISO 6346 Type", w: "w-[130px]" },
								{ label: "Kích Cỡ (KC)", w: "w-[160px]" },
								{ label: "Cảng / Sân Bay", w: "w-[220px]" },
								{ label: "Site", w: "w-20" },
							].map((h) => (
								<TableHead
									key={h.label}
									className={cn(
										h.w,
										"text-[10px] font-black uppercase tracking-widest text-slate-500 py-5 border-b border-slate-100 dark:border-slate-800",
									)}
								>
									{h.label}
								</TableHead>
							))}
							<TableHead className="w-16 sticky right-0 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur border-b border-l border-slate-100 dark:border-slate-800" />
						</TableRow>
					</TableHeader>

					<TableBody>
						{isLoading ? (
							<TableRow>
								<TableCell colSpan={7} className="h-60 text-center">
									<Loader2 className="size-6 animate-spin mx-auto text-teal-500" />
								</TableCell>
							</TableRow>
						) : records.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={7}
									className="h-60 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-50"
								>
									Chưa có cấu hình nào
								</TableCell>
							</TableRow>
						) : (
							records.map((row, idx) => (
								<TableRow
									key={row.id}
									className="group hover:bg-teal-50/30 dark:hover:bg-teal-900/10 transition-colors border-b border-slate-50 dark:border-slate-800/50"
								>
									<TableCell className="text-center font-mono text-[11px] text-slate-400 font-bold py-4">
										{(page - 1) * pageSize + idx + 1}
									</TableCell>
									<TableCell className="py-4 px-4 font-mono font-black text-slate-700 dark:text-slate-200 uppercase">
										{row.containerSize}
									</TableCell>
									<TableCell className="py-4 px-4">
										{row.isoType ? (
											<Badge
												variant="outline"
												className="font-mono font-black text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/30"
											>
												{row.isoType}
											</Badge>
										) : (
											<span className="text-slate-300 dark:text-slate-600 italic text-xs">
												chưa có
											</span>
										)}
									</TableCell>
									<TableCell className="py-4 px-4 font-bold text-slate-600 dark:text-slate-300">
										{row.kc || (
											<span className="text-slate-300 dark:text-slate-600 italic text-xs">
												chưa có
											</span>
										)}
									</TableCell>
									<TableCell className="py-4 px-4 text-sm text-slate-600 dark:text-slate-300">
										{airportName(row.port)}
									</TableCell>
									<TableCell className="text-center py-4">
										<Badge
											variant="outline"
											className="text-[10px] font-black py-0 px-2 bg-slate-50 dark:bg-slate-800"
										>
											{row.site}
										</Badge>
									</TableCell>
									<TableCell className="py-4 text-right pr-4 sticky right-0 bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800 group-hover:bg-teal-50/30 dark:group-hover:bg-teal-900/10 transition-colors">
										<div className="flex items-center justify-end gap-2">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => openEdit(row)}
												className="h-8 w-8 text-slate-300 hover:text-teal-500 opacity-0 group-hover:opacity-100 transition-all"
											>
												<Pencil className="size-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => {
													if (window.confirm("Xóa cấu hình này?"))
														deleteMutation.mutate(row.id);
												}}
												className="h-8 w-8 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
											>
												<Trash2 className="size-4" />
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			{/* Pagination */}
			<div className="flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur p-5 border-t shrink-0">
				<span className="text-xs font-bold text-slate-500">
					{pagination.total} cấu hình tổng cộng
				</span>
				<div className="flex items-center gap-3">
					<Button
						variant="outline"
						size="icon"
						onClick={() => setPage((p) => Math.max(1, p - 1))}
						disabled={page === 1}
						className="h-10 w-10 rounded-xl border-slate-200 shadow-sm dark:border-slate-700"
					>
						<ChevronLeft className="size-4" />
					</Button>
					<span className="text-sm font-black text-teal-600">
						{page} / {pagination.totalPages || 1}
					</span>
					<Button
						variant="outline"
						size="icon"
						onClick={() =>
							setPage((p) => Math.min(pagination.totalPages, p + 1))
						}
						disabled={page >= pagination.totalPages}
						className="h-10 w-10 rounded-xl border-slate-200 shadow-sm dark:border-slate-700"
					>
						<ChevronRight className="size-4" />
					</Button>
				</div>
			</div>

			{/* ── Add Dialog ── */}
			<Dialog open={isAdding} onOpenChange={setIsAdding}>
				<DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
					<div className="p-8 bg-gradient-to-br from-teal-600 to-cyan-700 text-white relative overflow-hidden">
						<div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl opacity-50" />
						<DialogHeader className="relative z-10 space-y-2">
							<DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-3">
								<Plus className="size-8" /> Thêm Cấu Hình
							</DialogTitle>
							<DialogDescription className="text-teal-100/80 text-sm font-medium leading-relaxed">
								Gán ISO type và kích cỡ cho từng loại container size từ ERP.
							</DialogDescription>
						</DialogHeader>
					</div>
					<div className="p-8 bg-white dark:bg-slate-900 space-y-5">
						{/* Container Size */}
						<div className="space-y-2">
							<FieldLabel>Container Size (từ ERP) *</FieldLabel>
							<ContainerSizeCombobox
								value={form.containerSize}
								onChange={(v) => setForm((p) => ({ ...p, containerSize: v }))}
								sizes={containerSizes}
							/>
						</div>

						{sharedFormFields}

						<Button
							onClick={() =>
								createMutation.mutate({
									...form,
									site: (userSite || "SGN") as Site,
								})
							}
							disabled={createMutation.isPending || !form.containerSize}
							className="w-full h-14 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-lg shadow-xl gap-3 mt-2 transition-all active:scale-[0.98] disabled:opacity-50"
						>
							{createMutation.isPending ? (
								<Loader2 className="animate-spin size-6" />
							) : (
								<Save className="size-6" />
							)}
							Lưu cấu hình
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{/* ── Edit Dialog ── */}
			<Dialog
				open={!!editingRecord}
				onOpenChange={(o) => !o && setEditingRecord(null)}
			>
				<DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
					<div className="p-8 bg-gradient-to-br from-slate-700 to-slate-900 text-white relative overflow-hidden">
						<div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl opacity-50" />
						<DialogHeader className="relative z-10 space-y-2">
							<DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-3">
								<Pencil className="size-7" /> Chỉnh Sửa
							</DialogTitle>
							<DialogDescription className="text-slate-300/80 text-sm font-medium">
								Container size không thể thay đổi. Cập nhật ISO type, kích cỡ,
								cảng.
							</DialogDescription>
						</DialogHeader>
					</div>
					<div className="p-8 bg-white dark:bg-slate-900 space-y-5">
						{/* Container Size – read only */}
						<div className="space-y-2">
							<FieldLabel>Container Size (ERP)</FieldLabel>
							<div className="h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center px-4">
								<span className="font-mono font-black text-slate-500 uppercase tracking-wider">
									{form.containerSize}
								</span>
							</div>
						</div>

						{sharedFormFields}

						<Button
							onClick={() => {
								if (!editingRecord) return;
								updateMutation.mutate({
									id: editingRecord.id,
									site: editingRecord.site,
									...form,
								});
							}}
							disabled={updateMutation.isPending}
							className="w-full h-14 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-black text-lg shadow-xl gap-3 mt-2 transition-all active:scale-[0.98] disabled:opacity-50"
						>
							{updateMutation.isPending ? (
								<Loader2 className="animate-spin size-6" />
							) : (
								<Save className="size-6" />
							)}
							Lưu thay đổi
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{/* ── Import Dialog ── */}
			<Dialog
				open={isImporting}
				onOpenChange={(o) => {
					if (!o) {
						setIsImporting(false);
						setImportRows([]);
					}
				}}
			>
				<DialogContent className="sm:max-w-3xl p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl flex flex-col max-h-[90vh]">
					<div className="p-10 bg-gradient-to-br from-teal-900 via-slate-900 to-black text-white relative flex-shrink-0">
						<DialogHeader className="relative z-10">
							<div className="flex items-center gap-4 mb-4">
								<div className="p-3 bg-white/10 rounded-2xl backdrop-blur-xl border border-white/20">
									<FileSpreadsheet className="size-8 text-teal-400" />
								</div>
								<div className="space-y-1">
									<DialogTitle className="text-4xl font-black tracking-tight uppercase italic">
										Excel Import{" "}
										<span className="text-teal-400 text-2xl font-black">
											Beta
										</span>
									</DialogTitle>
									<DialogDescription className="text-slate-400 text-sm font-bold uppercase tracking-[0.2em]">
										Cột A: Container Size&nbsp;|&nbsp;B: ISO Type&nbsp;|&nbsp;C:
										Kích Cỡ&nbsp;|&nbsp;D: Cảng
									</DialogDescription>
								</div>
							</div>
							{/* Site selector */}
							<div className="flex items-center gap-3 pt-2">
								<span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
									Site:
								</span>
								{(["SGN", "HAN", "DAD"] as Site[]).map((s) => (
									<button
										key={s}
										onClick={() => {
											setImportSite(s);
											setImportRows((p) => p.map((r) => ({ ...r, site: s })));
										}}
										className={cn(
											"px-3 py-1 rounded-lg text-xs font-black uppercase transition-all",
											importSite === s
												? "bg-teal-500 text-white"
												: "bg-white/10 text-slate-300 hover:bg-white/20",
										)}
									>
										{s}
									</button>
								))}
							</div>
						</DialogHeader>
					</div>

					<div className="flex-1 overflow-hidden flex flex-col p-2 bg-slate-100 dark:bg-slate-900">
						<div
							className="flex-1 overflow-auto bg-white dark:bg-slate-800 rounded-[2rem] shadow-inner border-2 border-dashed border-slate-200 dark:border-slate-700 relative min-h-[260px]"
							onPaste={handleImportPaste}
						>
							{importRows.length === 0 ? (
								<div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 group cursor-default select-none">
									<div className="p-10 rounded-full bg-slate-50 dark:bg-slate-800/50 mb-6 group-hover:scale-110 transition-transform duration-500">
										<ClipboardPaste className="size-16 opacity-20" />
									</div>
									<h3 className="text-2xl font-black tracking-tight text-slate-300 dark:text-slate-600 uppercase italic">
										Ready to Receive
									</h3>
									<p className="text-xs font-bold uppercase tracking-widest mt-2 opacity-50">
										Dán dữ liệu từ Excel — A: Size · B: ISO · C: Kích cỡ · D:
										Cảng
									</p>
								</div>
							) : (
								<Table>
									<TableHeader className="sticky top-0 bg-white dark:bg-slate-800 z-10">
										<TableRow className="border-b-2">
											<TableHead className="w-12 text-center text-[10px] font-black uppercase text-slate-500">
												#
											</TableHead>
											<TableHead className="text-[10px] font-black uppercase text-slate-500">
												Container Size
											</TableHead>
											<TableHead className="text-[10px] font-black uppercase text-slate-500">
												ISO Type
											</TableHead>
											<TableHead className="text-[10px] font-black uppercase text-slate-500">
												Kích Cỡ
											</TableHead>
											<TableHead className="text-[10px] font-black uppercase text-slate-500">
												Cảng
											</TableHead>
											<TableHead className="w-10" />
										</TableRow>
									</TableHeader>
									<TableBody>
										{importRows.map((row, i) => (
											<TableRow
												key={i}
												className="hover:bg-slate-50 dark:hover:bg-white/5 border-b border-slate-100 dark:border-slate-800/50 group"
											>
												<TableCell className="text-center font-mono text-[10px] font-bold opacity-30">
													{i + 1}
												</TableCell>
												<TableCell className="font-black font-mono text-teal-700 dark:text-teal-400 uppercase">
													{row.containerSize}
												</TableCell>
												<TableCell>
													<input
														value={row.isoType}
														maxLength={4}
														onChange={(e) =>
															setImportRows((p) =>
																p.map((r, j) =>
																	j === i
																		? {
																				...r,
																				isoType: e.target.value.toUpperCase(),
																			}
																		: r,
																),
															)
														}
														className="w-20 h-6 text-xs font-mono font-bold px-1.5 border rounded bg-background"
													/>
												</TableCell>
												<TableCell>
													<input
														value={row.kc}
														onChange={(e) =>
															setImportRows((p) =>
																p.map((r, j) =>
																	j === i ? { ...r, kc: e.target.value } : r,
																),
															)
														}
														className="w-24 h-6 text-xs font-bold px-1.5 border rounded bg-background"
													/>
												</TableCell>
												<TableCell className="text-xs text-slate-500 font-medium">
													{row.port || "—"}
												</TableCell>
												<TableCell>
													<button
														onClick={() =>
															setImportRows((p) => p.filter((_, j) => j !== i))
														}
														className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
													>
														<Trash2 className="size-3.5" />
													</button>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</div>
					</div>

					<DialogFooter className="p-8 bg-white dark:bg-slate-950 flex shrink-0 items-center justify-between">
						<div className="flex items-center gap-4">
							<div className="flex flex-col">
								<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
									Items Detected
								</span>
								<span className="text-3xl font-black tracking-tighter text-teal-600 leading-none">
									{importRows.length}
								</span>
							</div>
							{importRows.length > 0 && (
								<button
									onClick={() => setImportRows([])}
									className="text-red-500 text-[10px] font-black uppercase tracking-wider hover:text-red-700 transition"
								>
									Clear All
								</button>
							)}
						</div>
						<div className="flex gap-3">
							<Button
								variant="outline"
								onClick={() => {
									setIsImporting(false);
									setImportRows([]);
								}}
								className="rounded-2xl font-black uppercase tracking-widest text-[10px] px-8 border-slate-200"
							>
								Cancel
							</Button>
							<Button
								onClick={() => createMultiMutation.mutate(importRows)}
								disabled={
									importRows.length === 0 || createMultiMutation.isPending
								}
								className="bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] px-10 shadow-xl shadow-teal-500/20 gap-2"
							>
								{createMultiMutation.isPending ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<ShieldCheck className="size-4" />
								)}
								Finalize Import
							</Button>
						</div>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			{/* ── Error Dialog (like ShippingLineEditor) ── */}
			<Dialog open={!!errorDetails} onOpenChange={() => setErrorDetails(null)}>
				<DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
					<div className="p-8 bg-red-500 text-white flex flex-col items-center gap-4 text-center">
						<div className="p-4 bg-white/20 rounded-full backdrop-blur-md">
							<AlertCircle className="size-12" />
						</div>
						<div>
							<DialogTitle className="text-2xl font-black uppercase italic tracking-tighter mb-1">
								{errorDetails?.title || "System Error"}
							</DialogTitle>
							<DialogDescription className="text-red-50/80 font-bold text-xs uppercase tracking-widest">
								Critical Operation Failed
							</DialogDescription>
						</div>
					</div>
					<div className="p-10 bg-white dark:bg-slate-900">
						<div className="p-6 bg-red-50 dark:bg-red-950/20 rounded-2xl border border-red-100 dark:border-red-900/30 overflow-y-auto max-h-[40vh]">
							<p className="text-sm font-bold text-red-600 dark:text-red-400 leading-relaxed text-left whitespace-pre-wrap">
								{errorDetails?.message ||
									"Đã có lỗi xảy ra. Vui lòng kiểm tra lại dữ liệu và thử lại."}
							</p>
						</div>
						<Button
							onClick={() => setErrorDetails(null)}
							className="w-full h-14 bg-slate-900 hover:bg-black text-white rounded-2xl font-black uppercase tracking-widest text-sm mt-8 transition-all active:scale-95 shadow-xl"
						>
							Đã Hiểu (Close)
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{/* ── Import Result Dialog ── */}
			<Dialog open={!!importResult} onOpenChange={() => setImportResult(null)}>
				<DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
					<div
						className={cn(
							"p-8 text-white flex flex-col items-center gap-4 text-center",
							importResult?.skipped && importResult.skipped > 0
								? "bg-amber-500"
								: "bg-teal-500",
						)}
					>
						<div className="p-4 bg-white/20 rounded-full backdrop-blur-md">
							<CheckCircle2 className="size-12" />
						</div>
						<div>
							<DialogTitle className="text-2xl font-black uppercase italic tracking-tighter mb-1">
								Import Hoàn Tất
							</DialogTitle>
							<DialogDescription className="text-white/80 font-bold text-xs uppercase tracking-widest">
								{importResult?.count} thêm mới · {importResult?.skipped} bỏ qua
								trùng
							</DialogDescription>
						</div>
					</div>
					<div className="p-8 bg-white dark:bg-slate-900 space-y-4">
						<div className="grid grid-cols-2 gap-3">
							<div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-2xl text-center">
								<div className="text-3xl font-black text-teal-600">
									{importResult?.count}
								</div>
								<div className="text-[10px] font-black uppercase tracking-widest text-teal-500 mt-1">
									Đã nhập
								</div>
							</div>
							<div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl text-center">
								<div className="text-3xl font-black text-amber-500">
									{importResult?.skipped}
								</div>
								<div className="text-[10px] font-black uppercase tracking-widest text-amber-400 mt-1">
									Bỏ qua (trùng)
								</div>
							</div>
						</div>
						{importResult?.duplicates && importResult.duplicates.length > 0 && (
							<div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-800/30 overflow-y-auto max-h-[36vh]">
								<p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-2">
									Dòng bị trùng (ISO Type + Cảng đã tồn tại):
								</p>
								<ul className="space-y-1">
									{importResult.duplicates.map((d, i) => (
										<li
											key={i}
											className="text-xs font-bold text-amber-700 dark:text-amber-400 font-mono"
										>
											{d}
										</li>
									))}
								</ul>
							</div>
						)}
						<Button
							onClick={() => setImportResult(null)}
							className="w-full h-14 bg-slate-900 hover:bg-black text-white rounded-2xl font-black uppercase tracking-widest text-sm transition-all active:scale-95 shadow-xl"
						>
							Đóng
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
