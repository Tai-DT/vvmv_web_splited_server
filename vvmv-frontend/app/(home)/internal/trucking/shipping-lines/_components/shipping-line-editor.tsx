"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertCircle,
	ChevronLeft,
	ChevronRight,
	ClipboardPaste,
	FileSpreadsheet,
	Loader2,
	Pencil,
	Plus,
	RefreshCw,
	Save,
	Search,
	ShieldCheck,
	Ship,
	Trash2,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import type { OperationType, Site } from "@/prisma/client";

interface ShippingLineRecord {
	id: string;
	name: string;
	operationType: OperationType | null;
	site: Site;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
	user?: {
		name: string | null;
		email: string;
	};
}

export function ShippingLineEditor() {
	const queryClient = useQueryClient();
	const { data: sessionData } = useSession();
	const session = sessionData?.user;
	const userSite = (session as any)?.site as Site | undefined;
	const isAdmin = session?.role === "ADMIN" || session?.role === "SUPERADMIN";

	// Filter & Pagination State
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [page, setPage] = useState(1);
	const pageSize = 50;

	// Error Popup State
	const [errorDetails, setErrorDetails] = useState<{
		title: string;
		message: string;
	} | null>(null);
	const isErrorOpen = !!errorDetails;

	// State for Modals
	const [isAdding, setIsAdding] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [editingRecord, setEditingRecord] = useState<ShippingLineRecord | null>(
		null,
	);
	const [isImporting, setIsImporting] = useState(false);
	const [importRows, setImportRows] = useState<any[]>([]);
	const [newRecord, setNewRecord] = useState({
		name: "",
		operationType: null as OperationType | null,
		site: (userSite || "SGN") as Site,
	});

	// Debouncing Search
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(searchQuery);
			setPage(1);
		}, 500);
		return () => clearTimeout(timer);
	}, [searchQuery]);

	// Fetch Data
	const { data, isLoading, isFetching } = useQuery({
		queryKey: ["shipping-lines-admin", page, debouncedSearch],
		queryFn: async () => {
			const params = new URLSearchParams({
				page: page.toString(),
				pageSize: pageSize.toString(),
				search: debouncedSearch,
			});
			const response = await fetch(`/api/admin/shipping-lines?${params}`);
			if (!response.ok) throw new Error("Failed to load data");
			return response.json();
		},
	});

	const records: ShippingLineRecord[] = data?.items || [];
	const pagination = data?.pagination || { total: 0, totalPages: 1 };

	// Mutations
	const createMutation = useMutation({
		mutationFn: async (payload: any) => {
			const res = await fetch("/api/admin/shipping-lines", {
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
			queryClient.invalidateQueries({ queryKey: ["shipping-lines-admin"] });
			queryClient.invalidateQueries({ queryKey: ["shipping-lines"] });
			toast.success("Đã thêm thành công");
			setIsAdding(false);
			setNewRecord({
				name: "",
				operationType: null,
				site: (userSite || "SGN") as Site,
			});
		},
		onError: (err: any) => {
			setErrorDetails({
				title: "Lỗi Thêm Mới",
				message: err.message,
			});
		},
	});

	const updateMutation = useMutation({
		mutationFn: async (payload: any) => {
			const res = await fetch("/api/admin/shipping-lines", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const result = await res.json();
			if (!res.ok)
				throw new Error(result.error || result.details || "Failed to update");
			return result;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["shipping-lines-admin"] });
			queryClient.invalidateQueries({ queryKey: ["shipping-lines"] });
			toast.success("Đã cập nhật thành công");
			setIsEditing(false);
			setEditingRecord(null);
		},
		onError: (err: any) => {
			setErrorDetails({
				title: "Lỗi Cập Nhật",
				message: err.message,
			});
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async (id: string) => {
			const res = await fetch(`/api/admin/shipping-lines?id=${id}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("Failed to delete");
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["shipping-lines-admin"] });
			queryClient.invalidateQueries({ queryKey: ["shipping-lines"] });
			toast.success("Đã xóa");
		},
		onError: (err: any) => {
			setErrorDetails({
				title: "Lỗi Xóa Dữ Liệu",
				message: err.message,
			});
		},
	});

	const createMultiMutation = useMutation({
		mutationFn: async (items: any[]) => {
			const res = await fetch("/api/admin/shipping-lines", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(items),
			});
			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.details || data.error || "Lỗi không xác định");
			}
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["shipping-lines-admin"] });
			queryClient.invalidateQueries({ queryKey: ["shipping-lines"] });
			toast.success("Đã nhập dữ liệu thành công");
			setIsImporting(false);
			setImportRows([]);
		},
		onError: (err: any) => {
			setErrorDetails({
				title: "Lỗi Nhập Excel",
				message: err.message,
			});
		},
	});

	const handleImportPaste = (e: React.ClipboardEvent) => {
		const clipboardData = e.clipboardData.getData("text");
		const lines = clipboardData
			.split(/\r?\n/)
			.filter((line) => line.trim() !== "");

		if (lines.length > 0) {
			e.preventDefault();
			const newItems = lines
				.map((line) => {
					const [name, operationType] = line.split("\t");
					const opType = operationType?.trim().toUpperCase();
					return {
						name: name?.trim() || "",
						operationType:
							opType === "XUAT" || opType === "NHAP" ? opType : null,
						site: userSite || ("SGN" as Site),
					};
				})
				.filter((item) => item.name);

			setImportRows((prev) => [...newItems, ...prev]);
			toast.success(`Đã nhận ${newItems.length} dòng từ Excel`);
		}
	};

	return (
		<div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border shadow-xl overflow-hidden animate-in fade-in zoom-in duration-500">
			{/* Header Actions */}
			<div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/50 p-6 border-b shrink-0">
				<div className="flex items-center gap-4">
					<div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
						<Ship className="size-6 text-blue-600 dark:text-blue-400" />
					</div>
					<div>
						<h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
							Danh mục Hãng Tàu
						</h3>
						<div className="flex items-center gap-2 mt-0.5">
							<span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
								{pagination.total} bản ghi được tìm thấy
							</span>
							{isFetching && (
								<Loader2 className="size-3 animate-spin text-blue-500" />
							)}
						</div>
					</div>
				</div>

				<div className="flex items-center gap-3">
					<div className="relative group">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
						<Input
							placeholder="Tìm theo tên hãng tàu..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-10 w-[320px] h-11 border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 backdrop-blur rounded-xl focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 transition-all font-medium"
						/>
					</div>
					<Button
						variant="outline"
						size="icon"
						onClick={() =>
							queryClient.invalidateQueries({
								queryKey: ["shipping-lines-admin"],
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
						onClick={() => setIsAdding(true)}
						className="bg-blue-600 hover:bg-blue-700 h-11 px-6 rounded-xl font-bold shadow-lg shadow-blue-500/20 text-white transition-all active:scale-95 flex items-center gap-2"
					>
						<Plus className="size-5" />
						Thêm mới
					</Button>
				</div>
			</div>

			{/* Main Table Content */}
			<div className="flex-1 overflow-auto bg-white/50 dark:bg-transparent custom-scrollbar">
				<Table className="relative w-full border-separate border-spacing-0">
					<TableHeader className="sticky top-0 z-10 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur border-b">
						<TableRow className="hover:bg-transparent border-none">
							<TableHead className="w-16 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 py-6 border-b border-slate-100 dark:border-slate-800">
								STT
							</TableHead>
							<TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-6 border-b border-slate-100 dark:border-slate-800">
								Tên Hãng Tàu
							</TableHead>
							<TableHead className="w-[150px] text-[10px] font-black uppercase tracking-widest text-slate-500 py-6 border-b border-slate-100 dark:border-slate-800">
								Xuất/Nhập
							</TableHead>
							<TableHead className="w-24 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 py-6 border-b border-slate-100 dark:border-slate-800">
								Site
							</TableHead>
							<TableHead className="w-16 sticky right-0 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur border-b border-l border-slate-100 dark:border-slate-800"></TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{records.map((row, index) => (
							<TableRow
								key={row.id}
								className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors border-b border-slate-50 dark:border-slate-800/50"
							>
								<TableCell className="text-center font-mono text-[11px] text-slate-400 font-bold py-4">
									{(page - 1) * pageSize + index + 1}
								</TableCell>
								<TableCell className="py-4 px-4 font-bold text-slate-700 dark:text-slate-200">
									{row.name}
								</TableCell>
								<TableCell className="py-4 px-4">
									{row.operationType ? (
										<Badge
											variant={row.operationType === "XUAT" ? "orange" : "cyan"}
											className="text-xs font-semibold"
										>
											{row.operationType}
										</Badge>
									) : (
										<span className="text-xs italic text-slate-400">All</span>
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
								<TableCell className="py-4 text-right pr-4 sticky right-0 bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/10 transition-colors">
									<div className="flex items-center justify-end gap-2">
										<Button
											variant="ghost"
											size="icon"
											onClick={() => {
												setEditingRecord(row);
												setIsEditing(true);
											}}
											className="h-8 w-8 text-slate-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all"
										>
											<Pencil className="size-4" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => {
												if (window.confirm("Xóa hãng tàu này?")) {
													deleteMutation.mutate(row.id);
												}
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
									Không có dữ liệu hãng tàu
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			{/* Pagination Footer */}
			<div className="flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur p-6 border-t shrink-0">
				<div className="flex items-center gap-6 text-xs font-bold text-slate-500">
					<div className="flex items-center gap-2">
						<span className="uppercase tracking-[0.2em] opacity-40">
							Hiển thị
						</span>
						<span className="text-blue-600 dark:text-blue-400 font-black text-sm">
							{Math.min((page - 1) * pageSize + 1, pagination.total)} -{" "}
							{Math.min(page * pageSize, pagination.total)}
						</span>
						<span className="opacity-20 italic">của</span>
						<span className="font-black text-sm text-slate-800 dark:text-slate-200">
							{pagination.total}
						</span>
					</div>
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

					<div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-inner font-black text-sm text-blue-600 tracking-tighter">
						<span>Trang</span>
						<Input
							type="number"
							value={page}
							onChange={(e) => {
								const val = parseInt(e.target.value, 10);
								if (val >= 1 && val <= pagination.totalPages) setPage(val);
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
				<DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
					<div className="p-8 bg-gradient-to-br from-blue-600 to-indigo-700 text-white relative overflow-hidden">
						<div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl opacity-50" />
						<DialogHeader className="relative z-10 space-y-2">
							<DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-3">
								<Plus className="size-8" />
								Thêm Hãng Tàu
							</DialogTitle>
							<DialogDescription className="text-blue-100/80 text-sm font-medium leading-relaxed max-w-[320px]">
								Thiết lập thông tin Hãng tàu để dễ dàng chọn lựa trong Trucking
								Follow Up.
							</DialogDescription>
						</DialogHeader>
					</div>

					<div className="p-8 space-y-6 bg-white dark:bg-slate-900">
						<div className="space-y-4">
							<div className="space-y-2">
								<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
									Tên Hãng Tàu
								</label>
								<Input
									placeholder="Nhập tên hãng tàu..."
									value={newRecord.name}
									onChange={(e) =>
										setNewRecord((p) => ({ ...p, name: e.target.value }))
									}
									className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-4 focus:ring-blue-500/10 font-bold"
								/>
							</div>

							<div className="space-y-2">
								<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
									Xuất / Nhập (Operation Type)
								</label>
								<Select
									value={newRecord.operationType || "ALL"}
									onValueChange={(val) =>
										setNewRecord((p) => ({
											...p,
											operationType:
												val === "ALL" ? null : (val as OperationType),
										}))
									}
								>
									<SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold">
										<SelectValue />
									</SelectTrigger>
									<SelectPositioner className="z-[150]">
										<SelectContent className="rounded-2xl">
											<SelectItem value="ALL">Áp dụng cho tất cả</SelectItem>
											<SelectItem value="XUAT">XUAT - Xuất khẩu</SelectItem>
											<SelectItem value="NHAP">NHAP - Nhập khẩu</SelectItem>
										</SelectContent>
									</SelectPositioner>
								</Select>
							</div>

							{isAdmin && (
								<div className="space-y-2">
									<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
										Site (Vùng miền)
									</label>
									<Select
										value={newRecord.site}
										onValueChange={(val: any) =>
											setNewRecord((p) => ({ ...p, site: val as Site }))
										}
									>
										<SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold">
											<SelectValue />
										</SelectTrigger>
										<SelectPositioner className="z-[150]">
											<SelectContent className="rounded-2xl">
												<SelectItem value="SGN">
													SGN - TP. Hồ Chí Minh
												</SelectItem>
												<SelectItem value="HAN">HAN - Hà Nội</SelectItem>
												<SelectItem value="DAD">DAD - Đà Nẵng</SelectItem>
											</SelectContent>
										</SelectPositioner>
									</Select>
								</div>
							)}
						</div>

						<div className="pt-2">
							<Button
								onClick={() => createMutation.mutate(newRecord)}
								disabled={!newRecord.name || createMutation.isPending}
								className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-blue-500/20 gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
							>
								{createMutation.isPending ? (
									<Loader2 className="animate-spin size-6" />
								) : (
									<Save className="size-6" />
								)}
								Lưu hãng tàu
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Import Dialog */}
			<Dialog open={isImporting} onOpenChange={setIsImporting}>
				<DialogContent className="sm:max-w-5xl p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl flex flex-col max-h-[90vh]">
					<div className="p-10 bg-gradient-to-br from-indigo-900 via-slate-900 to-black text-white relative flex-shrink-0">
						<div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
						<DialogHeader className="relative z-10">
							<div className="flex items-center gap-4 mb-4">
								<div className="p-3 bg-white/10 rounded-2xl backdrop-blur-xl border border-white/20">
									<FileSpreadsheet className="size-8 text-blue-400" />
								</div>
								<div className="space-y-1">
									<DialogTitle className="text-4xl font-black tracking-tight uppercase italic">
										Excel Import{" "}
										<span className="text-blue-500 text-2xl font-black">
											Beta
										</span>
									</DialogTitle>
									<DialogDescription className="text-slate-400 text-sm font-bold uppercase tracking-[0.2em]">
										Nhập liệu thần tốc • Tên hãng tàu, Loại hình
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
								<div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 group cursor-default select-none">
									<div className="p-10 rounded-full bg-slate-50 dark:bg-slate-800/50 mb-6 group-hover:scale-110 transition-transform duration-500">
										<ClipboardPaste className="size-16 opacity-20" />
									</div>
									<h3 className="text-2xl font-black tracking-tight text-slate-300 dark:text-slate-600 uppercase italic">
										Ready to Receive
									</h3>
									<p className="text-xs font-bold uppercase tracking-widest mt-2 opacity-50">
										Dán dữ liệu từ Excel (Cột A: Tên hãng tàu, B: XUAT/NHAP)
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
												Tên Hãng Tàu
											</TableHead>
											<TableHead className="w-48 text-[10px] font-black uppercase text-slate-500">
												Xuất / Nhập
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{importRows.map((row, i) => (
											<TableRow
												key={i}
												className="hover:bg-slate-50 dark:hover:bg-white/5 border-b border-slate-100 dark:border-slate-800/50"
											>
												<TableCell className="text-center font-mono text-[10px] font-bold opacity-30">
													{i + 1}
												</TableCell>
												<TableCell className="font-bold text-blue-600 bg-blue-50/50 dark:bg-blue-900/10 uppercase">
													{row.name}
												</TableCell>
												<TableCell className="text-xs font-bold text-slate-500">
													{row.operationType || "All"}
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
								<span className="text-3xl font-black tracking-tighter text-indigo-600 leading-none">
									{importRows.length}
								</span>
							</div>
							{importRows.length > 0 && (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setImportRows([])}
									className="text-red-500 text-[10px] font-black uppercase tracking-wider hover:bg-red-50"
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
								className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] px-10 shadow-xl shadow-indigo-500/20 gap-2"
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

			{/* Edit Dialog */}
			<Dialog open={isEditing} onOpenChange={setIsEditing}>
				<DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
					<div className="p-8 bg-gradient-to-br from-indigo-600 to-blue-700 text-white relative overflow-hidden">
						<div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl opacity-50" />
						<DialogHeader className="relative z-10 space-y-2">
							<DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-3">
								<Pencil className="size-8" />
								Cập Nhật Hãng Tàu
							</DialogTitle>
							<DialogDescription className="text-blue-100/80 text-sm font-medium leading-relaxed max-w-[320px]">
								Chỉnh sửa thông tên hãng tàu hoặc loại hình vận hành.
							</DialogDescription>
						</DialogHeader>
					</div>

					<div className="p-8 space-y-6 bg-white dark:bg-slate-900">
						<div className="space-y-4">
							<div className="space-y-2">
								<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
									Tên Hãng Tàu
								</label>
								<Input
									placeholder="Nhập tên hãng tàu..."
									value={editingRecord?.name || ""}
									onChange={(e) =>
										setEditingRecord((p) =>
											p ? { ...p, name: e.target.value } : null,
										)
									}
									className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-4 focus:ring-blue-500/10 font-bold"
								/>
							</div>

							<div className="space-y-2">
								<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
									Xuất / Nhập (Operation Type)
								</label>
								<Select
									value={editingRecord?.operationType || "ALL"}
									onValueChange={(val) =>
										setEditingRecord((p) =>
											p
												? {
														...p,
														operationType:
															val === "ALL" ? null : (val as OperationType),
													}
												: null,
										)
									}
								>
									<SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold">
										<SelectValue />
									</SelectTrigger>
									<SelectPositioner className="z-[150]">
										<SelectContent className="rounded-2xl">
											<SelectItem value="ALL">Áp dụng cho tất cả</SelectItem>
											<SelectItem value="XUAT">XUAT - Xuất khẩu</SelectItem>
											<SelectItem value="NHAP">NHAP - Nhập khẩu</SelectItem>
										</SelectContent>
									</SelectPositioner>
								</Select>
							</div>
						</div>

						<div className="pt-2">
							<Button
								onClick={() =>
									updateMutation.mutate({
										id: editingRecord?.id,
										name: editingRecord?.name,
										operationType: editingRecord?.operationType,
									})
								}
								disabled={!editingRecord?.name || updateMutation.isPending}
								className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-500/20 gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
							>
								{updateMutation.isPending ? (
									<Loader2 className="animate-spin size-6" />
								) : (
									<Save className="size-6" />
								)}
								Lưu Thay Đổi
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Critical Error Dialog */}
			<Dialog open={isErrorOpen} onOpenChange={() => setErrorDetails(null)}>
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
							className="w-full h-14 bg-slate-900 hover:bg-black text-white rounded-2xl font-black uppercase tracking-widest text-sm mt-8 transition-all active:scale-95 shadow-xl shadow-slate-200 dark:shadow-none"
						>
							Đã Hiểu (Close)
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
