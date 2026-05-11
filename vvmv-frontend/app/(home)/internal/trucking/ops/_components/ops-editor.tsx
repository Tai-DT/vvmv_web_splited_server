"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
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
	Trash2,
	Truck,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

interface OpsRecord {
	id: string;
	name: string;
	site: Site;
	emails: string[];
	autoMail: boolean;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
	user?: { name: string | null; email: string };
}

export function OpsEditor() {
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
	const [editingRecord, setEditingRecord] = useState<OpsRecord | null>(null);
	const [isImporting, setIsImporting] = useState(false);
	const [importRows, setImportRows] = useState<any[]>([]);
	const [newName, setNewName] = useState("");
	const [newSite, setNewSite] = useState<Site>((userSite || "SGN") as Site);
	const [newEmails, setNewEmails] = useState<string[]>([]);
	const [newAutoMail, setNewAutoMail] = useState(false);
	const [newEmailInput, setNewEmailInput] = useState("");
	const [editEmailInput, setEditEmailInput] = useState("");
	const newEmailRef = useRef<HTMLInputElement>(null);
	const editEmailRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const t = setTimeout(() => {
			setDebouncedSearch(searchQuery);
			setPage(1);
		}, 500);
		return () => clearTimeout(t);
	}, [searchQuery]);

	const { data, isLoading, isFetching } = useQuery({
		queryKey: ["ops-admin", page, debouncedSearch],
		queryFn: async () => {
			const params = new URLSearchParams({
				page: page.toString(),
				pageSize: pageSize.toString(),
				search: debouncedSearch,
			});
			const res = await fetch(`/api/admin/ops?${params}`);
			if (!res.ok) throw new Error("Failed to load data");
			return res.json();
		},
	});

	const records: OpsRecord[] = data?.items || [];
	const pagination = data?.pagination || { total: 0, totalPages: 1 };

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ["ops-admin"] });
		queryClient.invalidateQueries({ queryKey: ["ops"] });
	};

	const createMutation = useMutation({
		mutationFn: async (payload: any) => {
			const res = await fetch("/api/admin/ops", {
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
			toast.success("Đã thêm ops thành công");
			setIsAdding(false);
			setNewName("");
			setNewEmails([]);
			setNewAutoMail(false);
			setNewEmailInput("");
		},
		onError: (err: any) => toast.error(err.message),
	});

	const updateMutation = useMutation({
		mutationFn: async (payload: any) => {
			const res = await fetch("/api/admin/ops", {
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
			setEditEmailInput("");
		},
		onError: (err: any) => toast.error(err.message),
	});

	const deleteMutation = useMutation({
		mutationFn: async (id: string) => {
			const res = await fetch(`/api/admin/ops?id=${id}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("Failed to delete");
			return res.json();
		},
		onSuccess: () => {
			invalidate();
			toast.success("Đã xóa ops");
		},
		onError: (err: any) => toast.error(err.message),
	});

	const createMultiMutation = useMutation({
		mutationFn: async (items: any[]) => {
			const res = await fetch("/api/admin/ops", {
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
						<Truck className="size-6 text-orange-500" />
					</div>
					<div>
						<h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
							Danh mục Ops
						</h3>
						<div className="flex items-center gap-2 mt-0.5">
							<span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
								{pagination.total} bản ghi
							</span>
							{isFetching && (
								<Loader2 className="size-3 animate-spin text-orange-500" />
							)}
						</div>
					</div>
				</div>

				<div className="flex items-center gap-3">
					<div className="relative group">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-orange-500 transition-colors" />
						<Input
							placeholder="Tìm theo tên ops..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-10 w-[300px] h-11 border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 backdrop-blur rounded-xl focus:ring-4 focus:ring-orange-50 dark:focus:ring-orange-900/20 transition-all font-medium"
						/>
					</div>
					<Button
						variant="outline"
						size="icon"
						onClick={() =>
							queryClient.invalidateQueries({ queryKey: ["ops-admin"] })
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
							setNewName("");
							setNewSite((userSite || "SGN") as Site);
							setNewAutoMail(false);
							setIsAdding(true);
						}}
						className="bg-orange-500 hover:bg-orange-600 h-11 px-6 rounded-xl font-bold shadow-lg shadow-orange-500/20 text-white transition-all active:scale-95 flex items-center gap-2"
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
							<TableHead className="w-[350px] max-w-[350px] text-[10px] font-black uppercase tracking-widest text-slate-500 py-6 border-b border-slate-100 dark:border-slate-800">
								Tên Ops
							</TableHead>
							<TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-6 border-b border-slate-100 dark:border-slate-800">
								Emails
							</TableHead>
							<TableHead className="w-32 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 py-6 border-b border-slate-100 dark:border-slate-800">
								Gửi Mail Tự Động
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
								className="group hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-colors border-b border-slate-50 dark:border-slate-800/50"
							>
								<TableCell className="text-center font-mono text-[11px] text-slate-400 font-bold py-4">
									{(page - 1) * pageSize + index + 1}
								</TableCell>
								<TableCell className="w-[350px] max-w-[350px] py-4 px-4 font-bold text-slate-700 dark:text-slate-200 truncate">
									<span title={row.name}>{row.name}</span>
								</TableCell>
								<TableCell className="py-4 px-4">
									<div className="flex flex-wrap gap-1">
										{(row.emails || []).map((email) => (
											<Badge
												key={email}
												variant="secondary"
												className="text-[10px] font-medium py-0.5 px-2 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0"
											>
												{email}
											</Badge>
										))}
									</div>
								</TableCell>
								<TableCell className="text-center py-4">
									{row.autoMail ? (
										<Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] uppercase font-black px-2">
											ON
										</Badge>
									) : (
										<Badge
											variant="outline"
											className="text-slate-300 border-slate-200 text-[10px] uppercase font-black px-2"
										>
											OFF
										</Badge>
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
								<TableCell className="py-4 text-right pr-4 sticky right-0 bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800 group-hover:bg-orange-50/30 dark:group-hover:bg-orange-900/10 transition-colors">
									<div className="flex items-center justify-end gap-2">
										<Button
											variant="ghost"
											size="icon"
											onClick={() => {
												setEditingRecord(row);
												setEditEmailInput("");
												setIsEditing(true);
											}}
											className="h-8 w-8 text-slate-300 hover:text-orange-500 opacity-0 group-hover:opacity-100 transition-all"
										>
											<Pencil className="size-4" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => {
												if (window.confirm("Xóa ops này?")) {
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
									colSpan={4}
									className="h-96 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-50"
								>
									Không có dữ liệu ops
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
						<span className="text-orange-500 font-black text-sm">
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
					<div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-inner font-black text-sm text-orange-500 tracking-tighter">
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
					<div className="p-8 bg-gradient-to-br from-orange-500 to-amber-600 text-white relative overflow-hidden">
						<div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl opacity-50" />
						<DialogHeader className="relative z-10 space-y-2">
							<DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-3">
								<Plus className="size-8" />
								Thêm Ops
							</DialogTitle>
							<DialogDescription className="text-orange-100/80 text-sm font-medium leading-relaxed">
								Thiết lập thông tin Ops để dễ dàng chọn lựa trong Trucking
								Follow Up.
							</DialogDescription>
						</DialogHeader>
					</div>
					<div className="p-8 space-y-6 bg-white dark:bg-slate-900">
						<div className="space-y-2">
							<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
								Tên Ops
							</label>
							<Input
								placeholder="Nhập tên ops..."
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && newName.trim())
										createMutation.mutate({
											name: newName.trim(),
											site: newSite,
											emails: newEmails,
											autoMail: newAutoMail,
										});
								}}
								className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-4 focus:ring-orange-500/10 font-bold"
								autoFocus
							/>
						</div>
						{/* Emails */}
						<div className="space-y-2">
							<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
								Emails
							</label>
							<div className="flex gap-2">
								<Input
									ref={newEmailRef}
									placeholder="Nhập từng email rồi nhấn Enter..."
									value={newEmailInput}
									onChange={(e) => setNewEmailInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											const v = newEmailInput.trim().toLowerCase();
											if (v && !newEmails.includes(v)) {
												setNewEmails((prev) => [...prev, v]);
											}
											setNewEmailInput("");
										}
									}}
									className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-4 focus:ring-orange-500/10 font-medium text-sm flex-1"
								/>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => {
										const v = newEmailInput.trim().toLowerCase();
										if (v && !newEmails.includes(v)) {
											setNewEmails((prev) => [...prev, v]);
										}
										setNewEmailInput("");
										newEmailRef.current?.focus();
									}}
									className="h-10 rounded-xl border-slate-200 font-bold px-4"
								>
									+ Thêm
								</Button>
							</div>
							{newEmails.length > 0 && (
								<div className="flex flex-wrap gap-1.5 pt-1">
									{newEmails.map((email) => (
										<span
											key={email}
											className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-[11px] font-semibold px-2.5 py-1 rounded-full"
										>
											{email}
											<button
												type="button"
												onClick={() =>
													setNewEmails((prev) =>
														prev.filter((e) => e !== email),
													)
												}
												className="ml-0.5 opacity-60 hover:opacity-100 text-blue-900 dark:text-blue-200"
											>
												×
											</button>
										</span>
									))}
								</div>
							)}
						</div>
						{/* Auto Mail */}
						<div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
							<Checkbox
								id="new-auto-mail"
								checked={newAutoMail}
								onCheckedChange={(val) => setNewAutoMail(!!val)}
								className="size-5 rounded-md border-slate-300 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
							/>
							<div className="flex flex-col">
								<label
									htmlFor="new-auto-mail"
									className="text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
								>
									Gửi Mail Tự Động
								</label>
								<span className="text-[10px] font-medium text-slate-400">
									Tự động gửi email thông báo khi có cập nhật
								</span>
							</div>
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
									name: newName.trim(),
									site: newSite,
									emails: newEmails,
									autoMail: newAutoMail,
								})
							}
							disabled={!newName.trim() || createMutation.isPending}
							className="w-full h-14 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-orange-500/20 gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
						>
							{createMutation.isPending ? (
								<Loader2 className="animate-spin size-6" />
							) : (
								<Save className="size-6" />
							)}
							Lưu Ops
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{/* Edit Dialog */}
			<Dialog open={isEditing} onOpenChange={setIsEditing}>
				<DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
					<div className="p-8 bg-gradient-to-br from-amber-600 to-orange-600 text-white relative overflow-hidden">
						<div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl opacity-50" />
						<DialogHeader className="relative z-10 space-y-2">
							<DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-3">
								<Pencil className="size-8" />
								Cập Nhật Ops
							</DialogTitle>
							<DialogDescription className="text-orange-100/80 text-sm font-medium leading-relaxed">
								Chỉnh sửa tên ops.
							</DialogDescription>
						</DialogHeader>
					</div>
					<div className="p-8 space-y-6 bg-white dark:bg-slate-900">
						<div className="space-y-2">
							<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
								Tên Ops
							</label>
							<Input
								value={editingRecord?.name || ""}
								onChange={(e) =>
									setEditingRecord((p) =>
										p ? { ...p, name: e.target.value } : null,
									)
								}
								className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-4 focus:ring-orange-500/10 font-bold"
								autoFocus
							/>
						</div>
						{/* Emails */}
						<div className="space-y-2">
							<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
								Emails
							</label>
							<div className="flex gap-2">
								<Input
									ref={editEmailRef}
									placeholder="Nhập từng email rồi nhấn Enter..."
									value={editEmailInput}
									onChange={(e) => setEditEmailInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											const v = editEmailInput.trim().toLowerCase();
											if (
												v &&
												editingRecord &&
												!editingRecord.emails.includes(v)
											) {
												setEditingRecord((p) =>
													p ? { ...p, emails: [...p.emails, v] } : null,
												);
											}
											setEditEmailInput("");
										}
									}}
									className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-4 focus:ring-orange-500/10 font-medium text-sm flex-1"
								/>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => {
										const v = editEmailInput.trim().toLowerCase();
										if (
											v &&
											editingRecord &&
											!editingRecord.emails.includes(v)
										) {
											setEditingRecord((p) =>
												p ? { ...p, emails: [...p.emails, v] } : null,
											);
										}
										setEditEmailInput("");
										editEmailRef.current?.focus();
									}}
									className="h-10 rounded-xl border-slate-200 font-bold px-4"
								>
									+ Thêm
								</Button>
							</div>
							{(editingRecord?.emails || []).length > 0 && (
								<div className="flex flex-wrap gap-1.5 pt-1">
									{editingRecord?.emails.map((email) => (
										<span
											key={email}
											className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-[11px] font-semibold px-2.5 py-1 rounded-full"
										>
											{email}
											<button
												type="button"
												onClick={() =>
													setEditingRecord((p) =>
														p
															? {
																	...p,
																	emails: p.emails.filter((e) => e !== email),
																}
															: null,
													)
												}
												className="ml-0.5 opacity-60 hover:opacity-100 text-blue-900 dark:text-blue-200"
											>
												×
											</button>
										</span>
									))}
								</div>
							)}
						</div>
						{/* Auto Mail */}
						<div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
							<Checkbox
								id="edit-auto-mail"
								checked={editingRecord?.autoMail || false}
								onCheckedChange={(val) =>
									setEditingRecord((p) =>
										p ? { ...p, autoMail: !!val } : null,
									)
								}
								className="size-5 rounded-md border-slate-300 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
							/>
							<div className="flex flex-col">
								<label
									htmlFor="edit-auto-mail"
									className="text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
								>
									Gửi Mail Tự Động
								</label>
								<span className="text-[10px] font-medium text-slate-400">
									Tự động gửi email thông báo khi có cập nhật
								</span>
							</div>
						</div>
						<Button
							onClick={() =>
								updateMutation.mutate({
									id: editingRecord?.id,
									name: editingRecord?.name,
									emails: editingRecord?.emails || [],
									autoMail: editingRecord?.autoMail,
								})
							}
							disabled={!editingRecord?.name || updateMutation.isPending}
							className="w-full h-14 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-amber-500/20 gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
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
					<div className="p-10 bg-gradient-to-br from-orange-900 via-slate-900 to-black text-white relative flex-shrink-0">
						<DialogHeader className="relative z-10">
							<div className="flex items-center gap-4 mb-4">
								<div className="p-3 bg-white/10 rounded-2xl backdrop-blur-xl border border-white/20">
									<FileSpreadsheet className="size-8 text-orange-400" />
								</div>
								<div className="space-y-1">
									<DialogTitle className="text-4xl font-black tracking-tight uppercase italic">
										Excel Import{" "}
										<span className="text-orange-400 text-2xl font-black">
											Beta
										</span>
									</DialogTitle>
									<DialogDescription className="text-slate-400 text-sm font-bold uppercase tracking-[0.2em]">
										Nhập liệu thần tốc • Tên ops (Cột A)
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
										Dán dữ liệu từ Excel (Cột A: Tên Ops)
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
												Tên Ops
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
												<TableCell className="font-bold text-orange-600 bg-orange-50/50 dark:bg-orange-900/10 uppercase">
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
								<span className="text-3xl font-black tracking-tighter text-orange-500 leading-none">
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
								className="bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] px-10 shadow-xl shadow-orange-500/20 gap-2"
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
