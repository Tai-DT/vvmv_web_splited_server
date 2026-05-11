"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ChevronLeft,
	ChevronRight,
	ClipboardPaste,
	FileSpreadsheet,
	Loader2,
	MapPin,
	Pencil,
	Plus,
	RefreshCw,
	Save,
	Search,
	ShieldCheck,
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
import type { Site } from "@/prisma/client";

interface PlaceRecord {
	id: string;
	name: string;
	site: Site;
	createdAt: string;
	updatedAt: string;
}

export function PickOrLiftPlaceEditor() {
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
	const [editingRecord, setEditingRecord] = useState<PlaceRecord | null>(null);
	const [isImporting, setIsImporting] = useState(false);
	const [importRows, setImportRows] = useState<any[]>([]);
	const [newName, setNewName] = useState("");
	const [newSite, setNewSite] = useState<Site>((userSite || "SGN") as Site);

	useEffect(() => {
		const t = setTimeout(() => {
			setDebouncedSearch(searchQuery);
			setPage(1);
		}, 500);
		return () => clearTimeout(t);
	}, [searchQuery]);

	const { data, isLoading, isFetching } = useQuery({
		queryKey: ["pick-or-lift-places-admin", page, debouncedSearch],
		queryFn: async () => {
			const params = new URLSearchParams({
				page: page.toString(),
				pageSize: pageSize.toString(),
				search: debouncedSearch,
			});
			const res = await fetch(`/api/admin/pick-or-lift-places?${params}`);
			if (!res.ok) throw new Error("Failed to load data");
			return res.json();
		},
	});

	const records: PlaceRecord[] = data?.items || [];
	const pagination = data?.pagination || { total: 0, totalPages: 1 };

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ["pick-or-lift-places-admin"] });
		queryClient.invalidateQueries({ queryKey: ["pick-or-lift-places"] });
	};

	const createMutation = useMutation({
		mutationFn: async (payload: any) => {
			const res = await fetch("/api/admin/pick-or-lift-places", {
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
			toast.success("Đã thêm thành công");
			setIsAdding(false);
			setNewName("");
		},
		onError: (err: any) => toast.error(err.message),
	});

	const updateMutation = useMutation({
		mutationFn: async (payload: any) => {
			const res = await fetch("/api/admin/pick-or-lift-places", {
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
			const res = await fetch(`/api/admin/pick-or-lift-places?id=${id}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("Failed to delete");
			return res.json();
		},
		onSuccess: () => {
			invalidate();
			toast.success("Đã xóa");
		},
		onError: (err: any) => toast.error(err.message),
	});

	const createMultiMutation = useMutation({
		mutationFn: async (items: any[]) => {
			const res = await fetch("/api/admin/pick-or-lift-places", {
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
				.map((line) => ({
					name: line.split("\t")[0]?.trim() || "",
					site: userSite || ("SGN" as Site),
				}))
				.filter((item) => item.name);
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
						<MapPin className="size-6 text-emerald-600" />
					</div>
					<div>
						<h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
							Danh mục Nơi Lấy/Trả
						</h3>
						<div className="flex items-center gap-2 mt-0.5">
							<span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
								{pagination.total} bản ghi
							</span>
							{isFetching && (
								<Loader2 className="size-3 animate-spin text-emerald-500" />
							)}
						</div>
					</div>
				</div>
				<div className="flex items-center gap-3">
					<div className="relative group">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
						<Input
							placeholder="Tìm theo tên..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-10 w-[300px] h-11 border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 backdrop-blur rounded-xl focus:ring-4 focus:ring-emerald-50 transition-all font-medium"
						/>
					</div>
					<Button
						variant="outline"
						size="icon"
						onClick={() =>
							queryClient.invalidateQueries({
								queryKey: ["pick-or-lift-places-admin"],
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
							setNewName("");
							setNewSite((userSite || "SGN") as Site);
							setIsAdding(true);
						}}
						className="bg-emerald-600 hover:bg-emerald-700 h-11 px-6 rounded-xl font-bold shadow-lg shadow-emerald-500/20 text-white transition-all active:scale-95 flex items-center gap-2"
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
								Tên Nơi Lấy/Trả
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
								className="group hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-colors border-b border-slate-50 dark:border-slate-800/50"
							>
								<TableCell className="text-center font-mono text-[11px] text-slate-400 font-bold py-4">
									{(page - 1) * pageSize + index + 1}
								</TableCell>
								<TableCell className="py-4 px-4 font-bold text-slate-700 dark:text-slate-200">
									{row.name}
								</TableCell>
								<TableCell className="text-center py-4">
									<Badge
										variant="outline"
										className="text-[10px] font-black py-0 px-2 bg-slate-50 dark:bg-slate-800"
									>
										{row.site}
									</Badge>
								</TableCell>
								<TableCell className="py-4 text-right pr-4 sticky right-0 bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800 group-hover:bg-emerald-50/30 dark:group-hover:bg-emerald-900/10 transition-colors">
									<div className="flex items-center justify-end gap-2">
										<Button
											variant="ghost"
											size="icon"
											onClick={() => {
												setEditingRecord(row);
												setIsEditing(true);
											}}
											className="h-8 w-8 text-slate-300 hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition-all"
										>
											<Pencil className="size-4" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => {
												if (window.confirm("Xóa nơi này?"))
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
									colSpan={4}
									className="h-96 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-50"
								>
									Không có dữ liệu
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
					<span className="text-emerald-600 font-black text-sm">
						{Math.min((page - 1) * pageSize + 1, pagination.total)} –{" "}
						{Math.min(page * pageSize, pagination.total)}
					</span>
					<span className="opacity-20 italic">của</span>
					<span className="font-black text-sm">{pagination.total}</span>
				</div>
				<div className="flex items-center gap-3">
					<Button
						variant="outline"
						size="icon"
						onClick={() => setPage((p) => Math.max(1, p - 1))}
						disabled={page === 1}
						className="h-10 w-10 rounded-xl border-slate-200 shadow-sm hover:bg-white"
					>
						<ChevronLeft className="size-4" />
					</Button>
					<div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border rounded-xl shadow-inner font-black text-sm text-emerald-600">
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
						className="h-10 w-10 rounded-xl border-slate-200 shadow-sm hover:bg-white"
					>
						<ChevronRight className="size-4" />
					</Button>
				</div>
			</div>

			{/* Add Dialog */}
			<Dialog open={isAdding} onOpenChange={setIsAdding}>
				<DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
					<div className="p-8 bg-gradient-to-br from-emerald-600 to-teal-700 text-white relative overflow-hidden">
						<div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl opacity-50" />
						<DialogHeader className="relative z-10 space-y-2">
							<DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-3">
								<Plus className="size-8" />
								Thêm Nơi Lấy/Trả
							</DialogTitle>
							<DialogDescription className="text-emerald-100/80 text-sm font-medium">
								Thêm địa điểm lấy/trả container vào danh mục.
							</DialogDescription>
						</DialogHeader>
					</div>
					<div className="p-8 space-y-5 bg-white dark:bg-slate-900">
						<div className="space-y-2">
							<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
								Tên địa điểm
							</label>
							<Input
								placeholder="VD: CẢNG CÁT LÁI..."
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && newName.trim())
										createMutation.mutate({
											name: newName.trim(),
											site: newSite,
										});
								}}
								className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-4 focus:ring-emerald-500/10 font-bold"
								autoFocus
							/>
						</div>
						{isAdmin && (
							<div className="space-y-2">
								<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
									Site
								</label>
								<Select
									value={newSite}
									onValueChange={(v: any) => setNewSite(v as Site)}
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
								createMutation.mutate({ name: newName.trim(), site: newSite })
							}
							disabled={!newName.trim() || createMutation.isPending}
							className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-500/20 gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
						>
							{createMutation.isPending ? (
								<Loader2 className="animate-spin size-6" />
							) : (
								<Save className="size-6" />
							)}
							Lưu
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{/* Edit Dialog */}
			<Dialog open={isEditing} onOpenChange={setIsEditing}>
				<DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
					<div className="p-8 bg-gradient-to-br from-teal-600 to-emerald-700 text-white relative overflow-hidden">
						<div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl opacity-50" />
						<DialogHeader className="relative z-10 space-y-2">
							<DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-3">
								<Pencil className="size-8" />
								Cập Nhật Địa Điểm
							</DialogTitle>
							<DialogDescription className="text-teal-100/80 text-sm font-medium">
								Chỉnh sửa tên địa điểm lấy/trả.
							</DialogDescription>
						</DialogHeader>
					</div>
					<div className="p-8 space-y-5 bg-white dark:bg-slate-900">
						<div className="space-y-2">
							<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
								Tên địa điểm
							</label>
							<Input
								value={editingRecord?.name || ""}
								onChange={(e) =>
									setEditingRecord((p) =>
										p ? { ...p, name: e.target.value } : null,
									)
								}
								className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-4 focus:ring-emerald-500/10 font-bold"
								autoFocus
							/>
						</div>
						<Button
							onClick={() =>
								updateMutation.mutate({
									id: editingRecord?.id,
									name: editingRecord?.name,
								})
							}
							disabled={!editingRecord?.name || updateMutation.isPending}
							className="w-full h-14 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-lg shadow-xl gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
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
					<div className="p-10 bg-gradient-to-br from-emerald-900 via-slate-900 to-black text-white flex-shrink-0">
						<DialogHeader>
							<div className="flex items-center gap-4 mb-4">
								<div className="p-3 bg-white/10 rounded-2xl border border-white/20">
									<FileSpreadsheet className="size-8 text-emerald-400" />
								</div>
								<div className="space-y-1">
									<DialogTitle className="text-4xl font-black tracking-tight uppercase italic">
										Excel Import{" "}
										<span className="text-emerald-400 text-2xl">Beta</span>
									</DialogTitle>
									<DialogDescription className="text-slate-400 text-sm font-bold uppercase tracking-[0.2em]">
										Tên địa điểm (Cột A)
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
									<div className="p-10 rounded-full bg-slate-50 mb-6">
										<ClipboardPaste className="size-16 opacity-20" />
									</div>
									<h3 className="text-2xl font-black tracking-tight text-slate-300 uppercase italic">
										Ready to Receive
									</h3>
									<p className="text-xs font-bold uppercase tracking-widest mt-2 opacity-50">
										Dán dữ liệu từ Excel (Cột A: Tên địa điểm)
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
												Tên Địa Điểm
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
												<TableCell className="font-bold text-emerald-600 bg-emerald-50/50 uppercase">
													{row.name}
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
								<span className="text-3xl font-black tracking-tighter text-emerald-600 leading-none">
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
								className="rounded-2xl font-black uppercase text-[10px] px-8 border-slate-200"
							>
								Cancel
							</Button>
							<Button
								onClick={() => createMultiMutation.mutate(importRows)}
								disabled={
									importRows.length === 0 || createMultiMutation.isPending
								}
								className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase text-[10px] px-10 shadow-xl gap-2"
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
		</div>
	);
}
