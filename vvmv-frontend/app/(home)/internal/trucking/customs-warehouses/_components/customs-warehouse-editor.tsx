"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ChevronLeft,
	ChevronRight,
	FileSpreadsheet,
	Loader2,
	Pencil,
	Plus,
	RefreshCw,
	Save,
	Search,
	Trash2,
	Warehouse,
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
import type { Site } from "@/prisma/client";

interface CustomsWarehouseRecord {
	id: string;
	whCode: string;
	whName: string;
	site: Site;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
	user?: { name: string | null; email: string };
}

export function CustomsWarehouseEditor() {
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
	const [editingRecord, setEditingRecord] =
		useState<CustomsWarehouseRecord | null>(null);
	const [isImporting, setIsImporting] = useState(false);
	const [importRows, setImportRows] = useState<any[]>([]);

	const [newWhCode, setNewWhCode] = useState("");
	const [newWhName, setNewWhName] = useState("");
	const [newSite, setNewSite] = useState<Site>((userSite || "SGN") as Site);

	useEffect(() => {
		const t = setTimeout(() => {
			setDebouncedSearch(searchQuery);
			setPage(1);
		}, 500);
		return () => clearTimeout(t);
	}, [searchQuery]);

	const { data, isLoading, isFetching } = useQuery({
		queryKey: ["customs-warehouses-admin", page, debouncedSearch],
		queryFn: async () => {
			const params = new URLSearchParams({
				page: page.toString(),
				pageSize: pageSize.toString(),
				search: debouncedSearch,
			});
			const res = await fetch(`/api/admin/customs-warehouses?${params}`);
			if (!res.ok) throw new Error("Failed to load data");
			return res.json();
		},
	});

	const records: CustomsWarehouseRecord[] = data?.items || [];
	const pagination = data?.pagination || { total: 0, totalPages: 1 };

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ["customs-warehouses-admin"] });
		queryClient.invalidateQueries({ queryKey: ["customs-warehouses"] });
	};

	const createMutation = useMutation({
		mutationFn: async (payload: any) => {
			const res = await fetch("/api/admin/customs-warehouses", {
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
			toast.success("Đã thêm kho hải quan thành công");
			setIsAdding(false);
			setNewWhCode("");
			setNewWhName("");
		},
		onError: (err: any) => toast.error(err.message),
	});

	const updateMutation = useMutation({
		mutationFn: async (payload: any) => {
			const res = await fetch("/api/admin/customs-warehouses", {
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
			const res = await fetch(`/api/admin/customs-warehouses?id=${id}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("Failed to delete");
			return res.json();
		},
		onSuccess: () => {
			invalidate();
			toast.success("Đã xóa kho hải quan");
		},
		onError: (err: any) => toast.error(err.message),
	});

	const createMultiMutation = useMutation({
		mutationFn: async (items: any[]) => {
			const res = await fetch("/api/admin/customs-warehouses", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(items),
			});
			const data = await res.json();
			if (!res.ok)
				throw new Error(data.details || data.error || "Lỗi không xác định");
			return data;
		},
		onSuccess: () => {
			invalidate();
			toast.success("Đã nhập dữ liệu thành công");
			setIsImporting(false);
			setImportRows([]);
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
					const cols = line.split("\t");
					return {
						whCode: cols[0]?.trim() || "",
						whName: cols[1]?.trim() || "",
						site: userSite || ("SGN" as Site),
					};
				})
				.filter((item) => item.whCode && item.whName);
			setImportRows((prev) => [...newItems, ...prev]);
			toast.success(`Đã nhận ${newItems.length} dòng từ Excel`);
		}
	};

	return (
		<div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border shadow-xl overflow-hidden animate-in fade-in zoom-in duration-500">
			{/* Header */}
			<div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/50 p-6 border-b shrink-0">
				<div className="flex items-center gap-4">
					<div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
						<Warehouse className="size-6 text-cyan-600" />
					</div>
					<div>
						<h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
							Danh mục Kho Hải Quan (WH HQ)
						</h3>
						<div className="flex items-center gap-2 mt-0.5">
							<span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
								{pagination.total} bản ghi
							</span>
							{isFetching && (
								<Loader2 className="size-3 animate-spin text-cyan-600" />
							)}
						</div>
					</div>
				</div>

				<div className="flex items-center gap-3">
					<div className="relative group">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-cyan-600 transition-colors" />
						<Input
							placeholder="Tìm theo mã kho, tên kho..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-10 w-[300px] h-11 border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 backdrop-blur rounded-xl focus:ring-4 focus:ring-cyan-50 dark:focus:ring-cyan-900/20 transition-all font-medium"
						/>
					</div>
					<Button
						variant="outline"
						size="icon"
						onClick={() =>
							queryClient.invalidateQueries({
								queryKey: ["customs-warehouses-admin"],
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
						onClick={() => {
							setNewWhCode("");
							setNewWhName("");
							setNewSite((userSite || "SGN") as Site);
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
							<TableHead className="w-[200px] text-[10px] font-black uppercase tracking-widest text-slate-500 py-6 border-b border-slate-100 dark:border-slate-800">
								WH Code
							</TableHead>
							<TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-6 border-b border-slate-100 dark:border-slate-800">
								WH Name
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
								<TableCell className="w-[200px] py-4 px-4">
									<Badge
										variant="outline"
										className="font-black text-xs px-3 py-1 bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 border-cyan-200 dark:border-cyan-700 tracking-wider"
									>
										{row.whCode}
									</Badge>
								</TableCell>
								<TableCell className="py-4 px-4 font-semibold text-slate-700 dark:text-slate-200">
									{row.whName}
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
											className="h-8 w-8 text-slate-300 hover:text-cyan-600 opacity-0 group-hover:opacity-100 transition-all"
										>
											<Pencil className="size-4" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => {
												if (
													window.confirm(
														`Xóa kho "${row.whCode} – ${row.whName}"?`,
													)
												) {
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
									Không có dữ liệu kho hải quan
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			{/* Pagination */}
			<div className="flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur p-6 border-t shrink-0">
				<div className="flex items-center gap-6 text-xs font-bold text-slate-500">
					<div className="flex items-center gap-2">
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
				<DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
					<div className="p-8 bg-gradient-to-br from-cyan-600 to-teal-700 text-white relative overflow-hidden">
						<div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl opacity-50" />
						<DialogHeader className="relative z-10 space-y-2">
							<DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-3">
								<Plus className="size-8" />
								Thêm Kho Hải Quan
							</DialogTitle>
							<DialogDescription className="text-cyan-100/80 text-sm font-medium leading-relaxed">
								Thêm mã kho hải quan (WH HQ) vào hệ thống. WH Code phải là duy
								nhất trong cùng site.
							</DialogDescription>
						</DialogHeader>
					</div>
					<div className="p-8 space-y-5 bg-white dark:bg-slate-900">
						<div className="space-y-2">
							<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
								WH Code <span className="text-red-500">*</span>
							</label>
							<Input
								placeholder="VD: HCM01, CT02..."
								value={newWhCode}
								onChange={(e) => setNewWhCode(e.target.value.toUpperCase())}
								className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-4 focus:ring-cyan-500/10 font-bold tracking-widest"
								autoFocus
							/>
							<p className="text-[10px] text-slate-400 font-medium">
								Mã kho duy nhất, sẽ tự động in hoa.
							</p>
						</div>
						<div className="space-y-2">
							<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
								WH Name <span className="text-red-500">*</span>
							</label>
							<Input
								placeholder="VD: Kho Hải Quan Cát Lái..."
								value={newWhName}
								onChange={(e) => setNewWhName(e.target.value)}
								onKeyDown={(e) => {
									if (
										e.key === "Enter" &&
										newWhCode.trim() &&
										newWhName.trim()
									) {
										createMutation.mutate({
											whCode: newWhCode.trim(),
											whName: newWhName.trim(),
											site: newSite,
										});
									}
								}}
								className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-4 focus:ring-cyan-500/10 font-bold"
							/>
						</div>
						{isAdmin && (
							<div className="space-y-2">
								<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
									Site (Vùng miền)
								</label>
								<Select
									value={newSite}
									onValueChange={(val: any) => setNewSite(val as Site)}
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
							onClick={() =>
								createMutation.mutate({
									whCode: newWhCode.trim(),
									whName: newWhName.trim(),
									site: newSite,
								})
							}
							disabled={
								!newWhCode.trim() ||
								!newWhName.trim() ||
								createMutation.isPending
							}
							className="w-full h-14 bg-cyan-600 hover:bg-cyan-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-cyan-500/20 gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
						>
							{createMutation.isPending ? (
								<Loader2 className="animate-spin size-6" />
							) : (
								<Save className="size-6" />
							)}
							Lưu Kho Hải Quan
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{/* Edit Dialog */}
			<Dialog open={isEditing} onOpenChange={setIsEditing}>
				<DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
					<div className="p-8 bg-gradient-to-br from-teal-700 to-cyan-600 text-white relative overflow-hidden">
						<div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl opacity-50" />
						<DialogHeader className="relative z-10 space-y-2">
							<DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-3">
								<Pencil className="size-8" />
								Cập Nhật Kho HQ
							</DialogTitle>
							<DialogDescription className="text-cyan-100/80 text-sm font-medium leading-relaxed">
								Chỉnh sửa thông tin kho hải quan.
							</DialogDescription>
						</DialogHeader>
					</div>
					<div className="p-8 space-y-5 bg-white dark:bg-slate-900">
						<div className="space-y-2">
							<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
								WH Code <span className="text-red-500">*</span>
							</label>
							<Input
								value={editingRecord?.whCode || ""}
								onChange={(e) =>
									setEditingRecord((p) =>
										p ? { ...p, whCode: e.target.value.toUpperCase() } : null,
									)
								}
								className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-4 focus:ring-cyan-500/10 font-black tracking-widest"
								autoFocus
							/>
						</div>
						<div className="space-y-2">
							<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
								WH Name <span className="text-red-500">*</span>
							</label>
							<Input
								value={editingRecord?.whName || ""}
								onChange={(e) =>
									setEditingRecord((p) =>
										p ? { ...p, whName: e.target.value } : null,
									)
								}
								className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-4 focus:ring-cyan-500/10 font-bold"
							/>
						</div>
						<Button
							onClick={() =>
								updateMutation.mutate({
									id: editingRecord?.id,
									whCode: editingRecord?.whCode,
									whName: editingRecord?.whName,
								})
							}
							disabled={
								!editingRecord?.whCode ||
								!editingRecord?.whName ||
								updateMutation.isPending
							}
							className="w-full h-14 bg-teal-700 hover:bg-teal-800 text-white rounded-2xl font-black text-lg shadow-xl shadow-teal-500/20 gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
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
			<Dialog open={isImporting} onOpenChange={setIsImporting}>
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
										<span className="text-cyan-400 text-2xl font-black">
											Beta
										</span>
									</DialogTitle>
									<DialogDescription className="text-slate-400 text-sm font-bold uppercase tracking-[0.2em]">
										Cột A: WH Code • Cột B: WH Name
									</DialogDescription>
								</div>
							</div>
						</DialogHeader>
					</div>
					<div className="flex-1 overflow-hidden flex flex-col p-2 bg-slate-100 dark:bg-slate-900">
						<div
							className="flex-1 overflow-auto rounded-2xl bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 focus:outline-none focus:border-cyan-400 transition-colors cursor-text"
							onPaste={handleImportPaste}
						>
							{importRows.length === 0 ? (
								<div className="flex flex-col items-center justify-center h-64 gap-3">
									<FileSpreadsheet className="size-12 text-slate-200 dark:text-slate-700" />
									<p className="text-slate-300 dark:text-slate-600 text-sm font-black uppercase tracking-widest">
										Click vào đây rồi dán từ Excel (Ctrl+V)
									</p>
									<p className="text-slate-300 dark:text-slate-600 text-xs font-medium">
										Cột A = WH Code &nbsp;|&nbsp; Cột B = WH Name
									</p>
								</div>
							) : (
								<table className="w-full text-xs">
									<thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b">
										<tr>
											<th className="text-left p-3 font-black uppercase tracking-widest text-slate-400 w-8">
												#
											</th>
											<th className="text-left p-3 font-black uppercase tracking-widest text-slate-400 w-48">
												WH Code
											</th>
											<th className="text-left p-3 font-black uppercase tracking-widest text-slate-400">
												WH Name
											</th>
											<th className="w-10" />
										</tr>
									</thead>
									<tbody>
										{importRows.map((row, i) => (
											<tr
												key={i}
												className="border-b border-slate-50 dark:border-slate-800 hover:bg-cyan-50/30 dark:hover:bg-cyan-900/10"
											>
												<td className="p-3 text-slate-400 font-bold font-mono">
													{i + 1}
												</td>
												<td className="p-3 font-black tracking-wider text-cyan-700 dark:text-cyan-300">
													{row.whCode}
												</td>
												<td className="p-3 font-medium text-slate-700 dark:text-slate-200">
													{row.whName}
												</td>
												<td className="p-3">
													<button
														onClick={() =>
															setImportRows((prev) =>
																prev.filter((_, idx) => idx !== i),
															)
														}
														className="text-slate-300 hover:text-red-500 transition-colors"
													>
														<Trash2 className="size-3.5" />
													</button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							)}
						</div>
					</div>
					{importRows.length > 0 && (
						<div className="p-6 border-t bg-white dark:bg-slate-900 flex items-center justify-between gap-4 flex-shrink-0">
							<span className="text-sm font-bold text-slate-500">
								{importRows.length} dòng sẵn sàng nhập
							</span>
							<div className="flex gap-3">
								<Button
									variant="outline"
									onClick={() => setImportRows([])}
									className="rounded-xl font-bold"
								>
									Xóa tất cả
								</Button>
								<Button
									onClick={() =>
										createMultiMutation.mutate(
											importRows.map((r) => ({
												...r,
												site: userSite || "SGN",
											})),
										)
									}
									disabled={createMultiMutation.isPending}
									className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-black px-8 gap-2 shadow-lg shadow-cyan-500/20"
								>
									{createMultiMutation.isPending ? (
										<Loader2 className="animate-spin size-4" />
									) : (
										<Save className="size-4" />
									)}
									Nhập {importRows.length} dòng
								</Button>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
