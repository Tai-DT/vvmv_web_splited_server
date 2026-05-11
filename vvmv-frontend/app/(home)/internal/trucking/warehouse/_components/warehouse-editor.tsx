"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Building2,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronRight as ChevronRightIcon,
	ClipboardPaste,
	FileSpreadsheet,
	FileText,
	Loader2,
	MapPin,
	Pencil,
	Phone,
	Plus,
	RefreshCw,
	Save,
	Search,
	ShieldCheck,
	Trash2,
	Warehouse,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getFetchErrorMessage } from "@/lib/api/client";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

interface PartnerRecord {
	id: string;
	taxCode: string | null;
	cccd: string | null;
	site: string;
	invoiceData?: string | null;
}

interface WarehouseRecord {
	id: string;
	partnersMasterDataId: string;
	warehouseName: string;
	deliveryAddress: string | null;
	contactInfo: string | null;
	invoiceInfo: string | null;
	mapPosition: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
	partner: PartnerRecord;
	user?: { name: string | null; email: string };
}

interface WareFormState {
	warehouseName: string;
	deliveryAddress: string;
	contactInfo: string;
	invoiceInfo: string;
	mapPosition: string;
	notes: string;
}

const EMPTY_WARE_FORM: WareFormState = {
	warehouseName: "",
	deliveryAddress: "",
	contactInfo: "",
	invoiceInfo: "",
	mapPosition: "",
	notes: "",
};

// ─── Group records by partnersMasterDataId ──────────────────────────────────

function groupByPartner(records: WarehouseRecord[]) {
	const map = new Map<
		string,
		{ partner: PartnerRecord; rows: WarehouseRecord[] }
	>();
	for (const r of records) {
		// Group by taxCode+site (visual grouping), fallback to id if no taxCode
		const displayKey =
			(r.partner.taxCode || r.partner.cccd || r.partner.id) +
			"__" +
			r.partner.site;
		if (!map.has(displayKey)) {
			map.set(displayKey, { partner: r.partner, rows: [] });
		}
		map.get(displayKey)?.rows.push(r);
	}
	return map;
}

function partnerLabel(p: PartnerRecord) {
	const id = p.taxCode || p.cccd || p.id.slice(0, 8);
	return `${id} (${p.site})`;
}

// ─── Partner search dropdown ─────────────────────────────────────────────────

function PartnerSelectField({
	value,
	onChange,
}: {
	value: PartnerRecord | null;
	onChange: (p: PartnerRecord | null) => void;
}) {
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const t = setTimeout(() => setDebouncedSearch(search), 400);
		return () => clearTimeout(t);
	}, [search]);

	const { data, isFetching, isError, error } = useQuery({
		queryKey: ["partners-master-data-search", debouncedSearch],
		queryFn: async () => {
			const params = new URLSearchParams({
				page: "1",
				pageSize: "30",
				search: debouncedSearch,
			});
			const res = await fetch(`/api/admin/partners-master-data?${params}`);
			if (!res.ok) {
				throw new Error(
					await getFetchErrorMessage(res, "Failed to load partners"),
				);
			}
			return res.json();
		},
		enabled: open,
	});

	const partners: PartnerRecord[] = data?.partners || [];

	return (
		<div className="relative">
			<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-1.5 mb-2">
				<Building2 className="size-3" /> Đối Tác (MST / CCCD) *
			</label>
			{value ? (
				<div className="flex items-center gap-2 h-12 px-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700">
					<span className="font-mono font-bold text-indigo-700 dark:text-indigo-300 flex-1">
						{partnerLabel(value)}
					</span>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => {
							onChange(null);
							setOpen(true);
						}}
						className="h-7 text-[10px] font-black text-slate-400 hover:text-red-500 px-2"
					>
						Đổi
					</Button>
				</div>
			) : (
				<div className="relative">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
					<Input
						placeholder="Tìm theo MST hoặc CCCD..."
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							setOpen(true);
						}}
						onFocus={() => setOpen(true)}
						className="h-12 pl-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-4 focus:ring-indigo-500/10 font-bold"
						autoFocus
					/>
					{open && (
						<div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 max-h-[200px] overflow-auto">
							{isFetching ? (
								<div className="flex items-center justify-center py-6">
									<Loader2 className="size-4 animate-spin text-indigo-400" />
								</div>
							) : isError ? (
								<div className="text-center py-6 px-3 text-xs text-red-600 dark:text-red-400 font-medium">
									{error instanceof Error ? error.message : "Failed to load"}
								</div>
							) : partners.length === 0 ? (
								<div className="text-center py-6 text-xs text-slate-400 font-bold uppercase tracking-wider">
									Không tìm thấy đối tác
								</div>
							) : (
								partners.map((p) => (
									<button
										key={p.id}
										type="button"
										onClick={() => {
											onChange(p);
											setOpen(false);
											setSearch("");
										}}
										className="w-full text-left px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors border-b border-slate-50 dark:border-slate-700/50 last:border-0"
									>
										<span className="font-mono font-bold text-slate-800 dark:text-slate-100">
											{p.taxCode || p.cccd || "—"}
										</span>
										<span className="ml-2 text-[10px] font-black text-slate-400 uppercase">
											{p.site}
										</span>
										{p.cccd && p.taxCode && (
											<span className="ml-2 text-[10px] text-slate-400">
												CCCD: {p.cccd}
											</span>
										)}
									</button>
								))
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

// ─── Main editor ─────────────────────────────────────────────────────────────

export function WarehouseEditor() {
	const queryClient = useQueryClient();
	const { data: sessionData } = useSession();
	const _session = sessionData?.user;

	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [page, setPage] = useState(1);
	const pageSize = 100;

	const [isAdding, setIsAdding] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [editingRecord, setEditingRecord] = useState<WarehouseRecord | null>(
		null,
	);

	// add form
	const [selectedPartner, setSelectedPartner] = useState<PartnerRecord | null>(
		null,
	);
	const [addForm, setAddForm] = useState<WareFormState>(EMPTY_WARE_FORM);

	// Auto-fill invoiceInfo when partner changes and invoiceInfo is empty
	useEffect(() => {
		if (selectedPartner?.invoiceData && !addForm.invoiceInfo.trim()) {
			setAddForm((prev) => ({
				...prev,
				invoiceInfo: selectedPartner.invoiceData!,
			}));
		}
		// Only run when selectedPartner changes
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedPartner, addForm.invoiceInfo.trim]);

	// edit form
	const [editForm, setEditForm] = useState<WareFormState>(EMPTY_WARE_FORM);

	// Collapsed groups
	const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
		new Set(),
	);

	// Excel import
	const [isImporting, setIsImporting] = useState(false);
	const [_importPartner, setImportPartner] = useState<PartnerRecord | null>(
		null,
	);
	const [importRows, setImportRows] = useState<any[]>([]);

	useEffect(() => {
		const t = setTimeout(() => {
			setDebouncedSearch(searchQuery);
			setPage(1);
		}, 500);
		return () => clearTimeout(t);
	}, [searchQuery]);

	const { data, isLoading, isFetching } = useQuery({
		queryKey: ["warehouse-configs", page, debouncedSearch],
		queryFn: async () => {
			const params = new URLSearchParams({
				page: page.toString(),
				pageSize: pageSize.toString(),
				search: debouncedSearch,
			});
			const res = await fetch(`/api/admin/warehouse-configs?${params}`);
			if (!res.ok) {
				throw new Error(
					await getFetchErrorMessage(res, "Failed to load warehouse list"),
				);
			}
			return res.json();
		},
	});

	const records: WarehouseRecord[] = data?.items || [];
	const pagination = data?.pagination || { total: 0, totalPages: 1 };
	const grouped = groupByPartner(records);

	const invalidate = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: ["warehouse-configs"] });
	}, [queryClient]);

	const createMutation = useMutation({
		mutationFn: async (payload: any) => {
			const res = await fetch("/api/admin/warehouse-configs", {
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
			toast.success("Đã thêm kho thành công");
			setIsAdding(false);
			setAddForm(EMPTY_WARE_FORM);
			setSelectedPartner(null);
		},
		onError: (err: any) => toast.error(err.message),
	});

	const updateMutation = useMutation({
		mutationFn: async (payload: any) => {
			const res = await fetch("/api/admin/warehouse-configs", {
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
			const res = await fetch(`/api/admin/warehouse-configs?id=${id}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("Failed to delete");
			return res.json();
		},
		onSuccess: () => {
			invalidate();
			toast.success("Đã xóa kho");
		},
		onError: (err: any) => toast.error(err.message),
	});

	const batchImportMutation = useMutation({
		mutationFn: async (items: any[]) => {
			const res = await fetch("/api/admin/warehouse-configs", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(items),
			});
			const data = await res.json();
			if (!res.ok)
				throw new Error(data.error || data.details || "Lỗi không xác định");
			return data;
		},
		onSuccess: (data) => {
			invalidate();
			toast.success(`Đã nhập ${data.count} kho thành công`);
			setIsImporting(false);
			setImportRows([]);
			setImportPartner(null);
		},
		onError: (err: any) => toast.error(err.message),
	});

	const toggleGroup = (id: string) => {
		setCollapsedGroups((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const openAdd = (prefillPartner?: PartnerRecord) => {
		setAddForm(EMPTY_WARE_FORM);
		setSelectedPartner(prefillPartner || null);
		// Pre-fill invoice info from partner data when opening from the group header
		if (prefillPartner?.invoiceData) {
			setAddForm((prev) => ({
				...prev,
				invoiceInfo: prefillPartner.invoiceData!,
			}));
		}
		setIsAdding(true);
	};

	const openImport = (prefillPartner?: PartnerRecord) => {
		setImportRows([]);
		setImportPartner(prefillPartner || null);
		setIsImporting(true);
	};

	// Parser Excel TSV đúng chuẩn — xử lý cell có xuống hàng (wrapped in "...")
	const parseExcelTSV = (text: string): string[][] => {
		const rows: string[][] = [];
		let row: string[] = [];
		let cell = "";
		let inQuotes = false;

		for (let i = 0; i < text.length; i++) {
			const ch = text[i];
			const next = text[i + 1];

			if (inQuotes) {
				if (ch === '"' && next === '"') {
					// Escaped quote
					cell += '"';
					i++;
				} else if (ch === '"') {
					inQuotes = false;
				} else {
					cell += ch;
				}
			} else {
				if (ch === '"') {
					inQuotes = true;
				} else if (ch === "\t") {
					row.push(cell);
					cell = "";
				} else if (ch === "\n" || (ch === "\r" && next === "\n")) {
					if (ch === "\r") i++; // skip \n after \r
					row.push(cell);
					cell = "";
					if (row.some((c) => c.trim())) rows.push(row);
					row = [];
				} else {
					cell += ch;
				}
			}
		}
		// Last cell / row
		row.push(cell);
		if (row.some((c) => c.trim())) rows.push(row);
		return rows;
	};

	// Cột: A=MST, B=Tên kho, C=Địa chỉ, D=Liên hệ, E=Hoá đơn, F=Ghi chú
	const handleImportPaste = (e: React.ClipboardEvent) => {
		const text = e.clipboardData.getData("text");
		if (!text.trim()) return;
		e.preventDefault();

		const rows = parseExcelTSV(text);
		const newItems = rows
			.map((cols) => ({
				taxCode: cols[0]?.trim() || "",
				warehouseName: cols[1]?.trim() || "",
				deliveryAddress: cols[2]?.trim() || "",
				contactInfo: cols[3]?.trim() || "",
				invoiceInfo: cols[4]?.trim() || "",
				notes: cols[5]?.trim() || "",
				mapPosition: cols[6]?.trim() || "",
			}))
			.filter((item) => item.warehouseName); // tên kho là bắt buộc

		if (newItems.length === 0) {
			toast.error("Không đọc được dữ liệu — cột B (Tên kho) là bắt buộc");
			return;
		}

		setImportRows((prev) => [...newItems, ...prev]);
		toast.success(`Đã nhận ${newItems.length} dòng từ Excel`);
	};

	const openEdit = (record: WarehouseRecord) => {
		setEditingRecord(record);
		setEditForm({
			warehouseName: record.warehouseName,
			deliveryAddress: record.deliveryAddress || "",
			contactInfo: record.contactInfo || "",
			invoiceInfo: record.invoiceInfo || "",
			mapPosition: record.mapPosition || "",
			notes: record.notes || "",
		});
		setIsEditing(true);
	};

	return (
		<div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border shadow-xl overflow-hidden animate-in fade-in zoom-in duration-500">
			{/* Header */}
			<div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/50 p-6 border-b shrink-0">
				<div className="flex items-center gap-4">
					<div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
						<Warehouse className="size-6 text-indigo-600" />
					</div>
					<div>
						<h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
							Danh mục Kho
						</h3>
						<div className="flex items-center gap-2 mt-0.5">
							<span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
								{pagination.total} bản ghi
							</span>
							{isFetching && (
								<Loader2 className="size-3 animate-spin text-indigo-500" />
							)}
						</div>
					</div>
				</div>

				<div className="flex items-center gap-3">
					<div className="relative group">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-indigo-500 transition-colors" />
						<Input
							placeholder="Tìm MST, tên kho, địa chỉ..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-10 w-[300px] h-11 border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 backdrop-blur rounded-xl focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/20 transition-all font-medium"
						/>
					</div>
					<Button
						variant="outline"
						size="icon"
						onClick={invalidate}
						className="h-11 w-11 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-white transition-all shadow-sm"
					>
						<RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
					</Button>
					<Button
						onClick={() => openImport()}
						variant="outline"
						className="h-11 px-4 rounded-xl font-bold border-slate-200 dark:border-slate-700 hover:bg-white text-slate-600 dark:text-slate-300 transition-all flex items-center gap-2"
					>
						<FileSpreadsheet className="size-5" />
						Nhập từ Excel
					</Button>
					<Button
						onClick={() => openAdd()}
						className="bg-indigo-600 hover:bg-indigo-700 h-11 px-6 rounded-xl font-bold shadow-lg shadow-indigo-500/20 text-white transition-all active:scale-95 flex items-center gap-2"
					>
						<Plus className="size-5" />
						Thêm kho
					</Button>
				</div>
			</div>

			{/* Table */}
			<div className="flex-1 overflow-auto bg-white/50 dark:bg-transparent custom-scrollbar">
				<Table className="relative w-full border-separate border-spacing-0">
					<TableHeader className="sticky top-0 z-10 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur border-b">
						<TableRow className="hover:bg-transparent border-none">
							<TableHead className="w-10 border-b border-slate-100 dark:border-slate-800" />
							<TableHead className="w-[220px] text-[10px] font-black uppercase tracking-widest text-slate-500 py-4 border-b border-slate-100 dark:border-slate-800">
								<div className="flex items-center gap-1.5">
									<Warehouse className="size-3" /> Tên Kho
								</div>
							</TableHead>
							<TableHead className="w-[220px] text-[10px] font-black uppercase tracking-widest text-slate-500 py-4 border-b border-slate-100 dark:border-slate-800">
								<div className="flex items-center gap-1.5">
									<MapPin className="size-3" /> Địa Chỉ Giao Hàng
								</div>
							</TableHead>
							<TableHead className="w-[220px] text-[10px] font-black uppercase tracking-widest text-slate-500 py-4 border-b border-slate-100 dark:border-slate-800">
								<div className="flex items-center gap-1.5">
									<Phone className="size-3" /> Thông Tin Liên Hệ
								</div>
							</TableHead>
							<TableHead className="w-[220px] text-[10px] font-black uppercase tracking-widest text-slate-500 py-4 border-b border-slate-100 dark:border-slate-800">
								<div className="flex items-center gap-1.5">
									<FileText className="size-3" /> Thông Tin Xuất Hoá Đơn
								</div>
							</TableHead>
							<TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4 border-b border-slate-100 dark:border-slate-800">
								Ghi Chú
							</TableHead>
							<TableHead className="w-16 sticky right-0 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur border-b border-l border-slate-100 dark:border-slate-800" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading ? (
							<TableRow>
								<TableCell colSpan={7} className="h-48 text-center">
									<Loader2 className="size-6 animate-spin mx-auto text-indigo-400" />
								</TableCell>
							</TableRow>
						) : grouped.size === 0 ? (
							<TableRow>
								<TableCell
									colSpan={7}
									className="h-96 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-50"
								>
									Không có dữ liệu kho
								</TableCell>
							</TableRow>
						) : (
							Array.from(grouped.entries()).map(
								([partnerId, { partner, rows }]) => {
									const isCollapsed = collapsedGroups.has(partnerId);
									return (
										<React.Fragment key={partnerId}>
											{/* Group header */}
											<TableRow
												className="bg-indigo-50/60 dark:bg-indigo-900/10 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer border-b border-indigo-100/60 dark:border-indigo-800/30"
												onClick={() => toggleGroup(partnerId)}
											>
												<TableCell className="text-center py-3 w-10">
													{isCollapsed ? (
														<ChevronRightIcon className="size-4 text-indigo-400 mx-auto" />
													) : (
														<ChevronDown className="size-4 text-indigo-400 mx-auto" />
													)}
												</TableCell>
												<TableCell colSpan={5} className="py-3 px-4">
													<div className="flex items-center gap-3">
														<span className="font-mono text-sm bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-lg font-black">
															MST: {partner.taxCode || partner.cccd || "—"}
														</span>
														<Badge className="bg-slate-100 dark:bg-slate-800 text-slate-500 border-0 text-[10px] font-black">
															{partner.site}
														</Badge>
														<Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-700 text-[10px] font-black">
															{rows.length} kho
														</Badge>
													</div>
												</TableCell>
												<TableCell className="py-3 text-right pr-4 sticky right-0 bg-indigo-50/60 dark:bg-indigo-900/10 border-l border-indigo-100/60 dark:border-indigo-800/30">
													<div className="flex items-center gap-3">
														<Button
															variant="ghost"
															size="sm"
															onClick={(e) => {
																e.stopPropagation();
																openAdd(partner);
															}}
															className="h-7 px-3 text-[10px] font-black text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg gap-1"
														>
															<Plus className="size-3" /> Thêm kho
														</Button>
														<Button
															variant="ghost"
															size="sm"
															onClick={(e) => {
																e.stopPropagation();
																openImport(partner);
															}}
															className="h-7 px-3 text-[10px] font-black text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg gap-1"
														>
															<FileSpreadsheet className="size-3" /> Excel
														</Button>
													</div>
												</TableCell>
											</TableRow>

											{/* Detail rows */}
											{!isCollapsed &&
												rows.map((row, index) => (
													<TableRow
														key={row.id}
														className="group hover:bg-indigo-50/20 dark:hover:bg-indigo-900/5 transition-colors border-b border-slate-50 dark:border-slate-800/50"
													>
														<TableCell className="text-center font-mono text-[11px] text-slate-400 font-bold py-4">
															{index + 1}
														</TableCell>
														<TableCell className="py-4 px-4 max-w-[160px]">
															<div className="flex flex-col gap-1.5">
																<span className="font-bold text-slate-800 dark:text-slate-100">
																	{row.warehouseName}
																</span>
																{row.mapPosition && (
																	<a
																		href={row.mapPosition}
																		target="_blank"
																		rel="noopener noreferrer"
																		onClick={(e) => e.stopPropagation()}
																		className="self-start inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 px-2 py-1 rounded-md transition-colors border border-indigo-100 dark:border-indigo-800"
																	>
																		<MapPin className="size-2.5" /> Bản đồ
																	</a>
																)}
															</div>
														</TableCell>
														<TableCell className="py-4 px-4 max-w-[180px]">
															{row.deliveryAddress ? (
																<span className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line line-clamp-3">
																	{row.deliveryAddress}
																</span>
															) : (
																<span className="text-slate-300 dark:text-slate-600 text-xs italic">
																	—
																</span>
															)}
														</TableCell>
														<TableCell className="py-4 px-4 max-w-[160px]">
															{row.contactInfo ? (
																<span className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line line-clamp-3">
																	{row.contactInfo}
																</span>
															) : (
																<span className="text-slate-300 dark:text-slate-600 text-xs italic">
																	—
																</span>
															)}
														</TableCell>
														<TableCell className="py-4 px-4">
															{row.invoiceInfo ? (
																<span className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">
																	{row.invoiceInfo}
																</span>
															) : (
																<span className="text-slate-300 dark:text-slate-600 text-xs italic">
																	—
																</span>
															)}
														</TableCell>
														<TableCell className="py-4 px-4 max-w-[220px]">
															{row.notes ? (
																<span className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line line-clamp-3">
																	{row.notes}
																</span>
															) : (
																<span className="text-slate-300 dark:text-slate-600 text-xs italic">
																	—
																</span>
															)}
														</TableCell>
														<TableCell className="py-4 text-right pr-4 sticky right-0 bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800 group-hover:bg-indigo-50/20 transition-colors">
															<div className="flex items-center justify-end gap-2">
																<Button
																	variant="ghost"
																	size="icon"
																	onClick={() => openEdit(row)}
																	className="h-8 w-8 text-slate-300 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-all"
																>
																	<Pencil className="size-4" />
																</Button>
																<Button
																	variant="ghost"
																	size="icon"
																	onClick={() => {
																		if (
																			window.confirm(
																				`Xóa kho "${row.warehouseName}"?`,
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
										</React.Fragment>
									);
								},
							)
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
					<span className="text-indigo-600 font-black text-sm">
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
						className="h-10 w-10 rounded-xl border-slate-200 shadow-sm hover:bg-white dark:hover:bg-slate-800 dark:border-slate-700"
					>
						<ChevronLeft className="size-4" />
					</Button>
					<div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-inner font-black text-sm text-indigo-600">
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

			{/* ─── Add Dialog ─────────────────────────────────── */}
			<Dialog
				open={isAdding}
				onOpenChange={(v) => {
					setIsAdding(v);
					if (!v) {
						setSelectedPartner(null);
						setAddForm(EMPTY_WARE_FORM);
					}
				}}
			>
				<DialogContent className="sm:max-w-[560px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
					<div className="p-8 bg-gradient-to-br from-indigo-600 to-violet-700 text-white relative overflow-hidden">
						<div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl opacity-50" />
						<DialogHeader className="relative z-10 space-y-2">
							<DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-3">
								<Plus className="size-8" /> Thêm Kho
							</DialogTitle>
							<DialogDescription className="text-indigo-100/80 text-sm font-medium leading-relaxed">
								Chọn đối tác (MST phải có trong hệ thống), sau đó nhập thông tin
								kho.
							</DialogDescription>
						</DialogHeader>
					</div>
					<div className="p-8 space-y-5 bg-white dark:bg-slate-900 overflow-y-auto max-h-[65vh]">
						<PartnerSelectField
							value={selectedPartner}
							onChange={(p) => {
								setSelectedPartner(p);
								// Auto-fill invoiceInfo from partner when field is empty
								if (p?.invoiceData && !addForm.invoiceInfo.trim()) {
									setAddForm((prev) => ({
										...prev,
										invoiceInfo: p.invoiceData!,
									}));
								}
							}}
						/>
						<WareFormFields
							form={addForm}
							onChange={setAddForm}
							invoiceSuggestion={selectedPartner?.invoiceData ?? null}
						/>
						<Button
							onClick={() =>
								createMutation.mutate({
									partnersMasterDataId: selectedPartner?.id,
									...addForm,
									warehouseName: addForm.warehouseName.trim(),
								})
							}
							disabled={
								!selectedPartner ||
								!addForm.warehouseName.trim() ||
								createMutation.isPending
							}
							className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-500/20 gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
						>
							{createMutation.isPending ? (
								<Loader2 className="animate-spin size-6" />
							) : (
								<Save className="size-6" />
							)}
							Lưu Kho
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{/* ─── Edit Dialog ─────────────────────────────────── */}
			<Dialog open={isEditing} onOpenChange={setIsEditing}>
				<DialogContent className="sm:max-w-[560px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
					<div className="p-8 bg-gradient-to-br from-violet-600 to-indigo-700 text-white relative overflow-hidden">
						<div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl opacity-50" />
						<DialogHeader className="relative z-10 space-y-2">
							<DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-3">
								<Pencil className="size-8" /> Cập Nhật Kho
							</DialogTitle>
							{editingRecord && (
								<DialogDescription className="text-violet-100/80 text-sm font-medium">
									MST:{" "}
									{editingRecord.partner.taxCode ||
										editingRecord.partner.cccd ||
										"—"}{" "}
									— {editingRecord.warehouseName}
								</DialogDescription>
							)}
						</DialogHeader>
					</div>
					<div className="p-8 space-y-5 bg-white dark:bg-slate-900 overflow-y-auto max-h-[65vh]">
						<WareFormFields form={editForm} onChange={setEditForm} />
						<Button
							onClick={() =>
								updateMutation.mutate({
									id: editingRecord?.id,
									...editForm,
									warehouseName: editForm.warehouseName.trim(),
								})
							}
							disabled={
								!editForm.warehouseName.trim() || updateMutation.isPending
							}
							className="w-full h-14 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-violet-500/20 gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
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
			{/* ─── Import Dialog (Excel) ───────────────────────── */}
			<Dialog
				open={isImporting}
				onOpenChange={(v) => {
					setIsImporting(v);
					if (!v) {
						setImportRows([]);
						setImportPartner(null);
					}
				}}
			>
				<DialogContent className="sm:max-w-3xl p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl flex flex-col max-h-[90vh]">
					<div className="p-10 bg-gradient-to-br from-indigo-900 via-slate-900 to-black text-white relative flex-shrink-0">
						<DialogHeader className="relative z-10">
							<div className="flex items-center gap-4 mb-5">
								<div className="p-3 bg-white/10 rounded-2xl backdrop-blur-xl border border-white/20">
									<FileSpreadsheet className="size-8 text-indigo-400" />
								</div>
								<div className="space-y-1">
									<DialogTitle className="text-4xl font-black tracking-tight uppercase italic">
										Excel Import{" "}
										<span className="text-indigo-400 text-2xl font-black">
											Beta
										</span>
									</DialogTitle>
									<p className="text-slate-400 text-sm font-bold uppercase tracking-[0.15em]">
										A: MST · B: Tên kho · C: Địa chỉ · D: Liên hệ · E: Hoá đơn ·
										F: Ghi chú · G: Định vị
									</p>
									<p className="text-slate-500 text-xs italic">
										* Cột MST dùng để tự tìm đối tác — nhiều cty trong 1 lần
										paste
									</p>
								</div>
							</div>
						</DialogHeader>
					</div>

					<div className="flex-1 overflow-hidden flex flex-col p-2 bg-slate-100 dark:bg-slate-900">
						<div
							className="flex-1 overflow-auto bg-white dark:bg-slate-800 rounded-[2rem] shadow-inner border-2 border-dashed border-slate-200 dark:border-slate-700 relative min-h-[260px]"
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
										Click vào vùng này rồi Ctrl+V dán từ Excel
									</p>
								</div>
							) : (
								<Table>
									<TableHeader className="sticky top-0 bg-white dark:bg-slate-800 z-10">
										<TableRow className="border-b-2">
											<TableHead className="w-12 text-center text-[10px] font-black uppercase text-slate-500">
												Row
											</TableHead>
											<TableHead className="w-[120px] text-[10px] font-black uppercase text-slate-500">
												MST
											</TableHead>
											<TableHead className="text-[10px] font-black uppercase text-slate-500">
												Tên Kho
											</TableHead>
											<TableHead className="text-[10px] font-black uppercase text-slate-500">
												Địa Chỉ
											</TableHead>
											<TableHead className="text-[10px] font-black uppercase text-slate-500">
												Liên Hệ
											</TableHead>
											<TableHead className="text-[10px] font-black uppercase text-slate-500">
												Hoá Đơn
											</TableHead>
											<TableHead className="text-[10px] font-black uppercase text-slate-500">
												Ghi Chú
											</TableHead>
											<TableHead className="text-[10px] font-black uppercase text-slate-500">
												Định Vị
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
												<TableCell className="font-mono text-xs font-bold text-indigo-500 dark:text-indigo-400">
													{row.taxCode || (
														<span className="opacity-30 italic">—</span>
													)}
												</TableCell>
												<TableCell className="font-bold text-slate-800 dark:text-slate-100">
													{row.warehouseName}
												</TableCell>
												<TableCell className="text-sm text-slate-600 dark:text-slate-300 max-w-[160px] truncate">
													{row.deliveryAddress || (
														<span className="opacity-30">—</span>
													)}
												</TableCell>
												<TableCell className="text-sm text-slate-600 dark:text-slate-300 max-w-[140px] truncate">
													{row.contactInfo || (
														<span className="opacity-30">—</span>
													)}
												</TableCell>
												<TableCell className="text-sm text-slate-600 dark:text-slate-300 max-w-[160px] truncate">
													{row.invoiceInfo || (
														<span className="opacity-30">—</span>
													)}
												</TableCell>
												<TableCell className="text-sm text-slate-600 dark:text-slate-300 max-w-[140px] truncate">
													{row.notes || <span className="opacity-30">—</span>}
												</TableCell>
												<TableCell className="text-sm text-slate-600 dark:text-slate-300 max-w-[140px] truncate">
													{row.mapPosition || (
														<span className="opacity-30">—</span>
													)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</div>
					</div>

					<div className="p-8 bg-white dark:bg-slate-950 flex shrink-0 items-center justify-between border-t border-slate-100 dark:border-slate-800">
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
								className="rounded-2xl font-black uppercase text-[10px] px-8 border-slate-200"
							>
								Cancel
							</Button>
							<Button
								onClick={() => {
									batchImportMutation.mutate(importRows);
								}}
								disabled={
									importRows.length === 0 || batchImportMutation.isPending
								}
								className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase text-[10px] px-10 shadow-xl gap-2"
							>
								{batchImportMutation.isPending ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<ShieldCheck className="size-4" />
								)}
								Finalize Import
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}

// ─── Warehouse form fields (không bao gồm partner) ───────────────────────────

function WareFormFields({
	form,
	onChange,
	invoiceSuggestion,
}: {
	form: WareFormState;
	onChange: React.Dispatch<React.SetStateAction<WareFormState>>;
	invoiceSuggestion?: string | null;
}) {
	const set = (key: keyof WareFormState) => (val: string) =>
		onChange((p) => ({ ...p, [key]: val }));

	return (
		<>
			<div className="space-y-2">
				<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-1.5">
					<Warehouse className="size-3" /> Tên Kho *
				</label>
				<Input
					placeholder="VD: KHO HCM 1, KHO PHƯỚC LỘC..."
					value={form.warehouseName}
					onChange={(e) => set("warehouseName")(e.target.value)}
					className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-4 focus:ring-indigo-500/10 font-bold"
				/>
			</div>

			<div className="space-y-2">
				<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-1.5">
					<MapPin className="size-3" /> Địa Chỉ Giao Hàng
				</label>
				<Textarea
					placeholder="VD: 123 Đường ABC, Phường XYZ, Quận 1, TP.HCM"
					value={form.deliveryAddress}
					onChange={(e) => set("deliveryAddress")(e.target.value)}
					className="rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-4 focus:ring-indigo-500/10 font-medium resize-none"
					rows={2}
				/>
			</div>

			<div className="space-y-2">
				<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-1.5">
					<MapPin className="size-3" /> Link Định Vị Kho
				</label>
				<Input
					placeholder="VD: https://goo.gl/maps/..."
					value={form.mapPosition}
					onChange={(e) => set("mapPosition")(e.target.value)}
					className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-4 focus:ring-indigo-500/10 font-medium"
				/>
			</div>

			<div className="space-y-2">
				<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-1.5">
					<Phone className="size-3" /> Thông Tin Liên Hệ
				</label>
				<Textarea
					placeholder={"VD: Nguyễn Văn A - 0901234567\nTrần Thị B - 0987654321"}
					value={form.contactInfo}
					onChange={(e) => set("contactInfo")(e.target.value)}
					className="rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-4 focus:ring-indigo-500/10 font-medium resize-none"
					rows={3}
				/>
			</div>

			<div className="space-y-2">
				<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-1.5">
					<FileText className="size-3" /> Thông Tin Xuất Hoá Đơn
				</label>
				{/* Suggestion banner: show when partner has invoiceData but field is different */}
				{invoiceSuggestion &&
					form.invoiceInfo.trim() !== invoiceSuggestion.trim() && (
						<div className="flex items-start gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs">
							<FileText className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
							<div className="flex-1 min-w-0">
								<p className="text-emerald-700 dark:text-emerald-300 font-bold mb-0.5">
									Gợi ý từ MST:
								</p>
								<pre className="text-emerald-600 dark:text-emerald-400 font-sans whitespace-pre-wrap line-clamp-3 text-[11px]">
									{invoiceSuggestion}
								</pre>
							</div>
							<button
								type="button"
								onClick={() => set("invoiceInfo")(invoiceSuggestion)}
								className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 transition-colors shrink-0 underline underline-offset-2 mt-0.5"
							>
								Dùng
							</button>
						</div>
					)}
				<Textarea
					placeholder={
						"VD: Công ty TNHH ABC\nMST: 0312345678\nĐịa chỉ: 456 Đường DEF..."
					}
					value={form.invoiceInfo}
					onChange={(e) => set("invoiceInfo")(e.target.value)}
					className="rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-4 focus:ring-indigo-500/10 font-medium resize-none"
					rows={4}
				/>
			</div>

			<div className="space-y-2">
				<label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
					Ghi Chú
				</label>
				<Textarea
					placeholder="Ghi chú thêm..."
					value={form.notes}
					onChange={(e) => set("notes")(e.target.value)}
					className="rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-4 focus:ring-indigo-500/10 font-medium resize-none"
					rows={2}
				/>
			</div>
		</>
	);
}
