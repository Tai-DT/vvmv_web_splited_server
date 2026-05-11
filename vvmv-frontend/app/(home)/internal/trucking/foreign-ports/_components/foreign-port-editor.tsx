"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Anchor,
	Check,
	ChevronLeft,
	ChevronRight,
	ChevronsUpDown,
	ClipboardPaste,
	FileSpreadsheet,
	Loader2,
	Pencil,
	Plus,
	RefreshCw,
	Save,
	Search,
	ShieldCheck,
	Trash2,
} from "lucide-react";
import React, { useEffect, useState } from "react";
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
	Select,
	SelectContent,
	SelectItem,
	SelectPositioner,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useAirports } from "@/hooks/use-airports";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import type { PortType, Site } from "@/prisma/client";

interface ForeignPortRecord {
	id: string;
	name: string;
	portType: PortType | null;
	domesticPort?: string | null;
	site: Site;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
	user?: { name: string | null; email: string };
}

const PORT_TYPE_LABELS: Record<string, string> = {
	DESTINATION: "Cảng đích",
	TRANSIT: "Cảng chuyển tải",
};

export function ForeignPortEditor() {
	const queryClient = useQueryClient();
	const { data: sessionData } = useSession();
	const session = sessionData?.user;
	const userSite = (session as any)?.site as Site | undefined;
	const isAdmin = session?.role === "ADMIN" || session?.role === "SUPERADMIN";

	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [page, setPage] = useState(1);
	const pageSize = 50;

	const [isAdding, setIsAdding] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [editingRecord, setEditingRecord] = useState<ForeignPortRecord | null>(
		null,
	);
	const [isImporting, setIsImporting] = useState(false);
	const [importRows, setImportRows] = useState<any[]>([]);
	const [importResult, setImportResult] = useState<{
		inserted: number;
		skipped: { row: number; name: string; reason: string }[];
	} | null>(null);
	const [newRecord, setNewRecord] = useState({
		name: "",
		portType: null as PortType | null,
		domesticPort: "",
		site: (userSite || "SGN") as Site,
	});

	useEffect(() => {
		const t = setTimeout(() => {
			setDebouncedSearch(searchQuery);
			setPage(1);
		}, 500);
		return () => clearTimeout(t);
	}, [searchQuery]);

	const { data, isLoading, isFetching } = useQuery({
		queryKey: ["foreign-ports-admin", page, debouncedSearch],
		queryFn: async () => {
			const params = new URLSearchParams({
				page: page.toString(),
				pageSize: pageSize.toString(),
				search: debouncedSearch,
			});
			const res = await fetch(`/api/admin/foreign-ports?${params}`);
			if (!res.ok) throw new Error("Failed to load data");
			return res.json();
		},
	});

	const records: ForeignPortRecord[] = data?.items || [];
	const pagination = data?.pagination || { total: 0, totalPages: 1 };

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ["foreign-ports-admin"] });
		queryClient.invalidateQueries({ queryKey: ["foreign-ports"] });
	};

	const createMutation = useMutation({
		mutationFn: async (payload: any) => {
			const res = await fetch("/api/admin/foreign-ports", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const result = await res.json();
			if (!res.ok)
				throw new Error(result.error || result.details || "Failed to create");
			return result;
		},
		onSuccess: () => {
			invalidate();
			toast.success("Đã thêm cảng thành công");
			setIsAdding(false);
			setNewRecord({
				name: "",
				portType: null,
				domesticPort: "",
				site: (userSite || "SGN") as Site,
			});
		},
		onError: (err: any) => toast.error(err.message),
	});

	const updateMutation = useMutation({
		mutationFn: async (payload: any) => {
			const res = await fetch("/api/admin/foreign-ports", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const result = await res.json();
			if (!res.ok) throw new Error(result.error || "Failed to update");
			return result;
		},
		onSuccess: () => {
			invalidate();
			toast.success("Đã cập nhật thành công");
			setIsEditing(false);
			setEditingRecord(null);
		},
		onError: (err: any) => toast.error(err.message),
	});

	const deleteMutation = useMutation({
		mutationFn: async (id: string) => {
			const res = await fetch(`/api/admin/foreign-ports?id=${id}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("Failed to delete");
			return res.json();
		},
		onSuccess: () => {
			invalidate();
			toast.success("Đã xóa cảng");
		},
		onError: (err: any) => toast.error(err.message),
	});

	const createMultiMutation = useMutation({
		mutationFn: async (items: any[]) => {
			const res = await fetch("/api/admin/foreign-ports", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(items),
			});
			const data = await res.json();
			if (!res.ok)
				throw new Error(data.details || data.error || "Lỗi không xác định");
			return data;
		},
		onSuccess: (data) => {
			invalidate();
			setImportResult({ inserted: data.inserted, skipped: data.skipped || [] });
			setImportRows([]);
			if ((data.skipped || []).length === 0) {
				toast.success(`Đã nhập ${data.inserted} cảng thành công`);
			} else {
				toast.warning(
					`Đã nhập ${data.inserted} cảng. Bỏ qua ${data.skipped.length} dòng trùng.`,
				);
			}
		},
		onError: (err: any) => toast.error(err.message),
	});

	const handleImportPaste = (e: React.ClipboardEvent) => {
		const text = e.clipboardData.getData("text");
		const lines = text.split(/\r?\n/).filter((l) => l.trim());
		if (lines.length > 0) {
			e.preventDefault();
			const newItems = lines
				.map((line) => {
					const [name, portTypeRaw, domesticPortRaw] = line.split("\t");
					const portType = portTypeRaw?.trim().toUpperCase();
					return {
						name: name?.trim() || "",
						portType:
							portType === "DESTINATION" || portType === "TRANSIT"
								? portType
								: null,
						domesticPort: domesticPortRaw?.trim() || "",
						site: userSite || ("SGN" as Site),
					};
				})
				.filter((item) => item.name);
			setImportRows((prev) => [...newItems, ...prev]);
			toast.success(`Đã nhận ${newItems.length} dòng từ Excel`);
		}
	};

	const PortTypeSelector = ({
		value,
		onChange,
	}: {
		value: PortType | null;
		onChange: (v: PortType | null) => void;
	}) => (
		<Select
			value={value || "ALL"}
			onValueChange={(v) => onChange(v === "ALL" ? null : (v as PortType))}
		>
			<SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold">
				<SelectValue />
			</SelectTrigger>
			<SelectPositioner className="z-[150]">
				<SelectContent className="rounded-2xl">
					<SelectItem value="ALL">Áp dụng cho tất cả (All)</SelectItem>
					<SelectItem value="DESTINATION">Cảng đích</SelectItem>
					<SelectItem value="TRANSIT">Cảng chuyển tải</SelectItem>
				</SelectContent>
			</SelectPositioner>
		</Select>
	);

	return (
		<div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border shadow-xl overflow-hidden animate-in fade-in zoom-in duration-500">
			{/* Header */}
			<div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/50 p-6 border-b shrink-0">
				<div className="flex items-center gap-4">
					<div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
						<Anchor className="size-6 text-cyan-600" />
					</div>
					<div>
						<h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
							Danh mục Cảng Nước Ngoài
						</h3>
						<div className="flex items-center gap-2 mt-0.5">
							<span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
								{pagination.total} bản ghi
							</span>
							{isFetching && (
								<Loader2 className="size-3 animate-spin text-cyan-500" />
							)}
						</div>
					</div>
				</div>
				<div className="flex items-center gap-3">
					<div className="relative group">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-cyan-500 transition-colors" />
						<Input
							placeholder="Tìm theo tên cảng..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-10 w-[300px] h-11 border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 backdrop-blur rounded-xl focus:ring-4 focus:ring-cyan-50 transition-all font-medium"
						/>
					</div>
					<Button
						variant="outline"
						size="icon"
						onClick={() =>
							queryClient.invalidateQueries({
								queryKey: ["foreign-ports-admin"],
							})
						}
						className="h-11 w-11 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-white transition-all shadow-sm"
					>
						<RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
					</Button>
					<Button
						onClick={() => setIsImporting(true)}
						variant="outline"
						className="h-11 px-4 rounded-xl font-bold border-slate-200 hover:bg-white text-slate-600 transition-all flex items-center gap-2"
					>
						<FileSpreadsheet className="size-5" />
						Nhập từ Excel
					</Button>
					<Button
						onClick={() => {
							setNewRecord({
								name: "",
								portType: null,
								domesticPort: "",
								site: (userSite || "SGN") as Site,
							});
							setIsAdding(true);
						}}
						className="bg-cyan-600 hover:bg-cyan-700 h-11 px-6 rounded-xl font-bold shadow-lg shadow-cyan-500/20 text-white transition-all active:scale-95 flex items-center gap-2"
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
							<TableHead className="w-16 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 py-6 border-b border-slate-100 dark:border-slate-800">
								STT
							</TableHead>
							<TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-6 border-b border-slate-100 dark:border-slate-800">
								Tên Cảng
							</TableHead>
							<TableHead className="w-[200px] text-[10px] font-black uppercase tracking-widest text-slate-500 py-6 border-b border-slate-100 dark:border-slate-800">
								Loại Cảng
							</TableHead>
							<TableHead className="w-[200px] text-[10px] font-black uppercase tracking-widest text-slate-500 py-6 border-b border-slate-100 dark:border-slate-800">
								Mã Cảng Nội Địa
							</TableHead>
							<TableHead className="w-24 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 py-6 border-b border-slate-100 dark:border-slate-800">
								Site
							</TableHead>
							<TableHead className="w-16 sticky right-0 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur border-b border-l border-slate-100 dark:border-slate-800" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{records.map((row, index) => (
							<TableRow
								key={row.id}
								className="group hover:bg-cyan-50/30 dark:hover:bg-cyan-900/10 transition-colors border-b border-slate-50 dark:border-slate-800/50"
							>
								<TableCell className="text-center font-mono text-[11px] text-slate-400 font-bold py-4">
									{(page - 1) * pageSize + index + 1}
								</TableCell>
								<TableCell className="py-4 px-4 font-bold text-slate-700 dark:text-slate-200">
									{row.name}
								</TableCell>
								<TableCell className="py-4 px-4">
									{row.portType ? (
										<Badge
											variant={
												row.portType === "DESTINATION" ? "orange" : "cyan"
											}
											className="text-xs font-semibold"
										>
											{PORT_TYPE_LABELS[row.portType]}
										</Badge>
									) : (
										<span className="text-xs italic text-slate-400">All</span>
									)}
								</TableCell>
								<TableCell className="py-4 px-4">
									{row.domesticPort ? (
										<span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
											{row.domesticPort}
										</span>
									) : (
										<span className="text-xs italic text-slate-400">-</span>
									)}
								</TableCell>
								<TableCell className="text-center py-4">
									<Badge
										variant="outline"
										className="text-[10px] font-black py-0 px-2 bg-slate-50 dark:bg-slate-800"
									>
										{row.site}
									</Badge>
								</TableCell>
								<TableCell className="py-4 text-right pr-4 sticky right-0 bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800 group-hover:bg-cyan-50/30 dark:group-hover:bg-cyan-900/10 transition-colors">
									<div className="flex items-center justify-end gap-2">
										<Button
											variant="ghost"
											size="icon"
											onClick={() => {
												setEditingRecord(row);
												setIsEditing(true);
											}}
											className="h-8 w-8 text-slate-300 hover:text-cyan-500 opacity-0 group-hover:opacity-100 transition-all"
										>
											<Pencil className="size-4" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => {
												if (window.confirm("Xóa cảng này?"))
													deleteMutation.mutate(row.id);
											}}
											className="h-8 w-8 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
										>
											<Trash2 className="size-4" />
										</Button>
									</div>
								</TableCell>
							</TableRow>
						))}
						{records.length === 0 && !isLoading && (
							<TableRow>
								<TableCell
									colSpan={5}
									className="h-96 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-50"
								>
									Không có dữ liệu cảng
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			{/* Pagination */}
			<div className="flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur p-6 border-t shrink-0">
				<div className="flex items-center gap-2 text-xs font-bold text-slate-500">
					<span className="uppercase tracking-[0.2em] opacity-40">
						Hiển thị
					</span>
					<span className="text-cyan-600 font-black text-sm">
						{Math.min((page - 1) * pageSize + 1, pagination.total)} –{" "}
						{Math.min(page * pageSize, pagination.total)}
					</span>
					<span className="opacity-20 italic">của</span>
					<span className="font-black text-sm text-slate-800 dark:text-slate-200">
						{pagination.total}
					</span>
				</div>
				<div className="flex items-center gap-3">
					<Button
						variant="outline"
						size="icon"
						onClick={() => setPage((p) => Math.max(1, p - 1))}
						disabled={page === 1}
						className="h-10 w-10 rounded-xl border-slate-200 shadow-sm hover:bg-white dark:hover:bg-slate-800 dark:border-slate-700"
					>
						<ChevronLeft className="size-4" />
					</Button>
					<div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-inner font-black text-sm text-cyan-600 tracking-tighter">
						<span>Trang</span>
						<Input
							type="number"
							value={page}
							onChange={(e) => {
								const v = parseInt(e.target.value, 10);
								if (v >= 1 && v <= pagination.totalPages) setPage(v);
							}}
							className="w-10 h-6 p-0 text-center border-none bg-transparent font-black focus:ring-0"
						/>
						<span className="opacity-30">/ {pagination.totalPages}</span>
					</div>
					<Button
						variant="outline"
						size="icon"
						onClick={() =>
							setPage((p) => Math.min(pagination.totalPages, p + 1))
						}
						disabled={page >= pagination.totalPages}
						className="h-10 w-10 rounded-xl border-slate-200 shadow-sm hover:bg-white dark:hover:bg-slate-800 dark:border-slate-700"
					>
						<ChevronRight className="size-4" />
					</Button>
				</div>
			</div>

			{/* Add Dialog */}
			<Dialog open={isAdding} onOpenChange={setIsAdding}>
				<DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
					<div className="p-8 bg-gradient-to-br from-cyan-600 to-teal-700 text-white relative overflow-hidden">
						<div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl opacity-50" />
						<DialogHeader className="relative z-10 space-y-2">
							<DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-3">
								<Plus className="size-8" />
								Thêm Cảng Nước Ngoài
							</DialogTitle>
							<DialogDescription className="text-cyan-100/80 text-sm font-medium leading-relaxed">
								Thiết lập tên cảng và loại để dùng trong Trucking Follow Up.
							</DialogDescription>
						</DialogHeader>
					</div>
					<div className="p-8 space-y-5 bg-white dark:bg-slate-900">
						<div className="space-y-2">
							<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
								Tên Cảng
							</label>
							<Input
								placeholder="Nhập tên cảng..."
								value={newRecord.name}
								onChange={(e) =>
									setNewRecord((p) => ({ ...p, name: e.target.value }))
								}
								onKeyDown={(e) => {
									if (e.key === "Enter" && newRecord.name.trim())
										createMutation.mutate(newRecord);
								}}
								className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-4 focus:ring-cyan-500/10 font-bold"
								autoFocus
							/>
						</div>
						<div className="space-y-2">
							<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
								Loại Cảng
							</label>
							<PortTypeSelector
								value={newRecord.portType}
								onChange={(v) => setNewRecord((p) => ({ ...p, portType: v }))}
							/>
						</div>
						<div className="space-y-2">
							<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
								Mã Cảng Nội Địa
							</label>
							{(() => {
								const { airports, isLoading } = useAirports();
								const [open, setOpen] = React.useState(false);
								const selected = airports.find(
									(a) => a.name === newRecord.domesticPort,
								);
								return (
									<Popover open={open} onOpenChange={setOpen}>
										<PopoverTrigger>
											<Button
												variant="outline"
												role="combobox"
												aria-expanded={open}
												disabled={isLoading}
												className="w-full h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold justify-between"
											>
												{selected ? (
													<span>
														{selected.id} - {selected.name}
													</span>
												) : (
													<span className="text-muted-foreground">
														Chọn cảng nội địa...
													</span>
												)}
												<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
											</Button>
										</PopoverTrigger>
										<PopoverPositioner className="z-[150]" sideOffset={4}>
											<PopoverContent className="w-full p-0">
												<Command>
													<CommandInput placeholder="Tìm cảng nội địa..." />
													<CommandList>
														<CommandEmpty>Không tìm thấy cảng.</CommandEmpty>
														<CommandGroup>
															<CommandItem
																onSelect={() => {
																	setNewRecord((p) => ({
																		...p,
																		domesticPort: "",
																	}));
																	setOpen(false);
																}}
															>
																<Check
																	className={cn(
																		"mr-2 h-4 w-4",
																		!newRecord.domesticPort
																			? "opacity-100"
																			: "opacity-0",
																	)}
																/>
																<span className="text-muted-foreground italic">
																	Bỏ chọn
																</span>
															</CommandItem>
															{airports.map((airport) => (
																<CommandItem
																	key={airport.id}
																	onSelect={() => {
																		setNewRecord((p) => ({
																			...p,
																			domesticPort: airport.name || "",
																		}));
																		setOpen(false);
																	}}
																	value={airport.name || ""}
																>
																	<Check
																		className={cn(
																			"mr-2 h-4 w-4",
																			newRecord.domesticPort === airport.name
																				? "opacity-100"
																				: "opacity-0",
																		)}
																	/>
																	{airport.id} - {airport.name}
																</CommandItem>
															))}
														</CommandGroup>
													</CommandList>
												</Command>
											</PopoverContent>
										</PopoverPositioner>
									</Popover>
								);
							})()}
						</div>
						{isAdmin && (
							<div className="space-y-2">
								<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
									Site
								</label>
								<Select
									value={newRecord.site}
									onValueChange={(v: any) =>
										setNewRecord((p) => ({ ...p, site: v as Site }))
									}
								>
									<SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold">
										<SelectValue />
									</SelectTrigger>
									<SelectPositioner className="z-[150]">
										<SelectContent className="rounded-2xl">
											<SelectItem value="SGN">SGN - TP. Hồ Chí Minh</SelectItem>
											<SelectItem value="HAN">HAN - Hà Nội</SelectItem>
											<SelectItem value="DAD">DAD - Đà Nẵng</SelectItem>
										</SelectContent>
									</SelectPositioner>
								</Select>
							</div>
						)}
						<Button
							onClick={() => createMutation.mutate(newRecord)}
							disabled={!newRecord.name.trim() || createMutation.isPending}
							className="w-full h-14 bg-cyan-600 hover:bg-cyan-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-cyan-500/20 gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
						>
							{createMutation.isPending ? (
								<Loader2 className="animate-spin size-6" />
							) : (
								<Save className="size-6" />
							)}
							Lưu Cảng
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{/* Edit Dialog */}
			<Dialog open={isEditing} onOpenChange={setIsEditing}>
				<DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
					<div className="p-8 bg-gradient-to-br from-teal-600 to-cyan-700 text-white relative overflow-hidden">
						<div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl opacity-50" />
						<DialogHeader className="relative z-10 space-y-2">
							<DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-3">
								<Pencil className="size-8" />
								Cập Nhật Cảng
							</DialogTitle>
							<DialogDescription className="text-teal-100/80 text-sm font-medium leading-relaxed">
								Chỉnh sửa tên cảng hoặc loại cảng.
							</DialogDescription>
						</DialogHeader>
					</div>
					<div className="p-8 space-y-5 bg-white dark:bg-slate-900">
						<div className="space-y-2">
							<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
								Tên Cảng
							</label>
							<Input
								value={editingRecord?.name || ""}
								onChange={(e) =>
									setEditingRecord((p) =>
										p ? { ...p, name: e.target.value } : null,
									)
								}
								className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-4 focus:ring-cyan-500/10 font-bold"
								autoFocus
							/>
						</div>
						<div className="space-y-2">
							<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
								Loại Cảng
							</label>
							<PortTypeSelector
								value={editingRecord?.portType || null}
								onChange={(v) =>
									setEditingRecord((p) => (p ? { ...p, portType: v } : null))
								}
							/>
						</div>
						<div className="space-y-2">
							<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
								Mã Cảng Nội Địa
							</label>
							{(() => {
								const { airports, isLoading } = useAirports();
								const [open, setOpen] = React.useState(false);
								const selected = airports.find(
									(a) => a.name === editingRecord?.domesticPort,
								);
								return (
									<Popover open={open} onOpenChange={setOpen}>
										<PopoverTrigger>
											<Button
												variant="outline"
												role="combobox"
												aria-expanded={open}
												disabled={isLoading}
												className="w-full h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold justify-between"
											>
												{selected ? (
													<span>
														{selected.id} - {selected.name}
													</span>
												) : (
													<span className="text-muted-foreground">
														Chọn cảng nội địa...
													</span>
												)}
												<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
											</Button>
										</PopoverTrigger>
										<PopoverPositioner className="z-[150]" sideOffset={4}>
											<PopoverContent className="w-full p-0">
												<Command>
													<CommandInput placeholder="Tìm cảng nội địa..." />
													<CommandList>
														<CommandEmpty>Không tìm thấy cảng.</CommandEmpty>
														<CommandGroup>
															<CommandItem
																onSelect={() => {
																	setEditingRecord((p) =>
																		p ? { ...p, domesticPort: "" } : null,
																	);
																	setOpen(false);
																}}
															>
																<Check
																	className={cn(
																		"mr-2 h-4 w-4",
																		!editingRecord?.domesticPort
																			? "opacity-100"
																			: "opacity-0",
																	)}
																/>
																<span className="text-muted-foreground italic">
																	Bỏ chọn
																</span>
															</CommandItem>
															{airports.map((airport) => (
																<CommandItem
																	key={airport.id}
																	onSelect={() => {
																		setEditingRecord((p) =>
																			p
																				? {
																						...p,
																						domesticPort: airport.name || "",
																					}
																				: null,
																		);
																		setOpen(false);
																	}}
																	value={airport.name || ""}
																>
																	<Check
																		className={cn(
																			"mr-2 h-4 w-4",
																			editingRecord?.domesticPort ===
																				airport.name
																				? "opacity-100"
																				: "opacity-0",
																		)}
																	/>
																	{airport.id} - {airport.name}
																</CommandItem>
															))}
														</CommandGroup>
													</CommandList>
												</Command>
											</PopoverContent>
										</PopoverPositioner>
									</Popover>
								);
							})()}
						</div>
						<Button
							onClick={() =>
								updateMutation.mutate({
									id: editingRecord?.id,
									name: editingRecord?.name,
									portType: editingRecord?.portType,
									domesticPort: editingRecord?.domesticPort,
								})
							}
							disabled={!editingRecord?.name || updateMutation.isPending}
							className="w-full h-14 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-teal-500/20 gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
						>
							{updateMutation.isPending ? (
								<Loader2 className="animate-spin size-6" />
							) : (
								<Save className="size-6" />
							)}
							Lưu Thay Đổi
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{/* Import Dialog */}
			<Dialog
				open={isImporting}
				onOpenChange={(open) => {
					setIsImporting(open);
					if (!open) {
						setImportResult(null);
						setImportRows([]);
					}
				}}
			>
				<DialogContent className="sm:max-w-3xl p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl flex flex-col max-h-[90vh]">
					<div className="p-10 bg-gradient-to-br from-cyan-900 via-slate-900 to-black text-white relative flex-shrink-0">
						<DialogHeader className="relative z-10">
							<div className="flex items-center gap-4 mb-4">
								<div className="p-3 bg-white/10 rounded-2xl backdrop-blur-xl border border-white/20">
									<FileSpreadsheet className="size-8 text-cyan-400" />
								</div>
								<div className="space-y-1">
									<DialogTitle className="text-4xl font-black tracking-tight uppercase italic">
										Excel Import{" "}
										<span className="text-cyan-400 text-2xl">Beta</span>
									</DialogTitle>
									<DialogDescription className="text-slate-400 text-sm font-bold uppercase tracking-[0.2em]">
										Cột A: Tên cảng • Cột B: DESTINATION/TRANSIT (hoặc để trống
										nếu dùng cho cả hai loại) • Cột C: TÊN cảng nội địa (có thể
										để trống)
									</DialogDescription>
								</div>
							</div>
						</DialogHeader>
					</div>
					<div className="flex-1 overflow-hidden flex flex-col p-2 bg-slate-100 dark:bg-slate-900">
						<div
							className="flex-1 overflow-auto bg-white dark:bg-slate-800 rounded-[2rem] shadow-inner border-2 border-dashed border-slate-200 dark:border-slate-700 relative min-h-[300px]"
							onPaste={handleImportPaste}
						>
							{importRows.length === 0 ? (
								<div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 cursor-default select-none">
									<div className="p-10 rounded-full bg-slate-50 dark:bg-slate-800/50 mb-6">
										<ClipboardPaste className="size-16 opacity-20" />
									</div>
									<h3 className="text-2xl font-black tracking-tight text-slate-300 dark:text-slate-600 uppercase italic">
										Ready to Receive
									</h3>
									<p className="text-xs font-bold uppercase tracking-widest mt-2 opacity-50">
										Cột A: Tên cảng
									</p>
									<p className="text-xs font-bold uppercase tracking-widest mt-2 opacity-50">
										Cột B: DESTINATION hoặc TRANSIT hoặc bỏ trống nếu dùng cho
										cả hai loại Cảng
									</p>
									<p className="text-xs font-bold uppercase tracking-widest mt-2 opacity-50">
										Cột C: TÊN cảng nội địa (có thể để trống)
									</p>
								</div>
							) : (
								<Table>
									<TableHeader className="sticky top-0 bg-white dark:bg-slate-800 z-10">
										<TableRow className="border-b-2">
											<TableHead className="w-16 text-center text-[10px] font-black uppercase text-slate-500">
												Row
											</TableHead>
											<TableHead className="text-[10px] font-black uppercase text-slate-500">
												Tên Cảng
											</TableHead>
											<TableHead className="w-48 text-[10px] font-black uppercase text-slate-500">
												Loại
											</TableHead>
											<TableHead className="w-48 text-[10px] font-black uppercase text-slate-500">
												Mã Cảng Nội Địa
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{importRows.map((row, i) => (
											<TableRow
												key={i}
												className="hover:bg-slate-50 border-b border-slate-100"
											>
												<TableCell className="text-center font-mono text-[10px] font-bold opacity-30">
													{i + 1}
												</TableCell>
												<TableCell className="font-bold text-cyan-600 bg-cyan-50/50 uppercase">
													{row.name}
												</TableCell>
												<TableCell className="text-xs font-bold text-slate-500">
													{row.portType
														? PORT_TYPE_LABELS[row.portType]
														: "All"}
												</TableCell>
												<TableCell className="text-xs font-bold text-slate-700">
													{row.domesticPort || (
														<span className="italic text-slate-400">-</span>
													)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</div>
					</div>
					<DialogFooter className="p-8 bg-white dark:bg-slate-950 flex shrink-0 items-center justify-between">
						{/* Result panel — shown after import */}
						{importResult ? (
							<div className="flex flex-col gap-3 w-full">
								<div className="flex items-center gap-6">
									<div className="flex flex-col">
										<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
											Đã nhập
										</span>
										<span className="text-3xl font-black tracking-tighter text-emerald-600 leading-none">
											{importResult.inserted}
										</span>
									</div>
									{importResult.skipped.length > 0 && (
										<div className="flex flex-col">
											<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
												Bỏ qua (trùng)
											</span>
											<span className="text-3xl font-black tracking-tighter text-amber-500 leading-none">
												{importResult.skipped.length}
											</span>
										</div>
									)}
								</div>
								{importResult.skipped.length > 0 && (
									<div className="max-h-32 overflow-auto rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
										<p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-2">
											Các dòng bị bỏ qua:
										</p>
										<ul className="space-y-0.5">
											{importResult.skipped.map((s) => (
												<li
													key={s.row}
													className="text-xs font-medium text-amber-700 dark:text-amber-300 flex items-center gap-2"
												>
													<span className="font-mono text-[10px] opacity-50">
														Dòng {s.row}
													</span>
													<span className="font-bold">{s.name}</span>
													<span className="opacity-60">— {s.reason}</span>
												</li>
											))}
										</ul>
									</div>
								)}
								<Button
									onClick={() => {
										setIsImporting(false);
										setImportResult(null);
									}}
									className="self-end bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] px-10"
								>
									Đóng
								</Button>
							</div>
						) : (
							<>
								<div className="flex items-center gap-4">
									<div className="flex flex-col">
										<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
											Items Detected
										</span>
										<span className="text-3xl font-black tracking-tighter text-cyan-600 leading-none">
											{importRows.length}
										</span>
									</div>
									{importRows.length > 0 && (
										<Button
											variant="ghost"
											size="sm"
											onClick={() => setImportRows([])}
											className="text-red-500 text-[10px] font-black uppercase hover:bg-red-50"
										>
											Clear All
										</Button>
									)}
								</div>
								<div className="flex gap-3">
									<Button
										variant="outline"
										onClick={() => setIsImporting(false)}
										className="rounded-2xl font-black uppercase tracking-widest text-[10px] px-8 border-slate-200"
									>
										Cancel
									</Button>
									<Button
										onClick={() => createMultiMutation.mutate(importRows)}
										disabled={
											importRows.length === 0 || createMultiMutation.isPending
										}
										className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] px-10 shadow-xl shadow-cyan-500/20 gap-2"
									>
										{createMultiMutation.isPending ? (
											<Loader2 className="size-4 animate-spin" />
										) : (
											<ShieldCheck className="size-4" />
										)}
										Finalize Import
									</Button>
								</div>
							</>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
