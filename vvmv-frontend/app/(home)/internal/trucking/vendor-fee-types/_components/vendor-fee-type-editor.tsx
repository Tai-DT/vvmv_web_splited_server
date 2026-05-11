"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	BadgeDollarSign,
	Check,
	ChevronsUpDown,
	ClipboardPaste,
	FileSpreadsheet,
	Loader2,
	Pencil,
	Plus,
	RefreshCw,
	Search,
	Trash2,
	X,
} from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { type Site, VendorFeeMode } from "@/prisma/client";

type VendorFeeTypeRecord = {
	id: string;
	name: string;
	feeCode: string | null;
	feeDescription: string | null;
	mode: VendorFeeMode;
	site: Site;
	isActive: boolean;
	isNotDefault: boolean;
	vendor?: { id: string; name: string } | null;
};

type FormState = {
	name: string;
	feeCode: string;
	feeDescription: string;
	mode: VendorFeeMode;
	isActive: "active" | "inactive";
	isNotDefault: boolean;
	site: Site;
};

type ImportRow = {
	name: string;
	feeCode: string;
	feeDescription: string;
	mode: VendorFeeMode;
	isActive: "active" | "inactive";
	isNotDefault: boolean;
	site: Site;
};

function emptyForm(defaultSite: Site): FormState {
	return {
		name: "",
		feeCode: "",
		feeDescription: "",
		mode: VendorFeeMode.ALL,
		isActive: "active",
		isNotDefault: false,
		site: defaultSite,
	};
}

const MODE_OPTIONS: VendorFeeMode[] = [
	VendorFeeMode.ALL,
	VendorFeeMode.FCL,
	VendorFeeMode.LCL,
];

function normalizeMode(value: unknown): VendorFeeMode {
	const raw = String(value || VendorFeeMode.ALL)
		.trim()
		.toUpperCase();
	if (raw === VendorFeeMode.FCL) return VendorFeeMode.FCL;
	if (raw === VendorFeeMode.LCL) return VendorFeeMode.LCL;
	return VendorFeeMode.ALL;
}

export function VendorFeeTypeEditor() {
	const queryClient = useQueryClient();
	const { data: sessionData } = useSession();
	const session = sessionData?.user;
	const userSite = ((session as { site?: Site } | undefined)?.site ||
		"SGN") as Site;

	const [searchQuery, setSearchQuery] = useState("");
	const [isAdding, setIsAdding] = useState(false);
	const [feePopoverOpen, setFeePopoverOpen] = useState(false);
	const [isImporting, setIsImporting] = useState(false);
	const [editingRecord, setEditingRecord] =
		useState<VendorFeeTypeRecord | null>(null);
	const [form, setForm] = useState<FormState>(emptyForm(userSite));
	const [importRows, setImportRows] = useState<ImportRow[]>([]);

	const { data: erpFees = [] } = useQuery({
		queryKey: ["erp-fee-descriptions", userSite],
		queryFn: async () => {
			const res = await fetch(`/api/erp/fee-descriptions?site=${userSite}`);
			const data = await res.json();
			return (data.descriptions || []) as {
				feeCode: string;
				feeDescEn: string;
			}[];
		},
	});

	const {
		data: queryData,
		isLoading,
		isFetching,
	} = useQuery({
		queryKey: ["vendor-fee-types-admin"],
		queryFn: async (): Promise<{
			feeTypes: VendorFeeTypeRecord[];
			canEdit: boolean;
		}> => {
			const res = await fetch("/api/vendor-fee-types");
			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.message || "Failed to fetch vendor fee types");
			}
			return { feeTypes: data.feeTypes || [], canEdit: !!data.canEdit };
		},
	});

	const records: VendorFeeTypeRecord[] = queryData?.feeTypes ?? [];
	const canEdit = queryData?.canEdit ?? false;

	const filteredRecords = useMemo(() => {
		const keyword = searchQuery.trim().toLowerCase();
		if (!keyword) return records;

		return records.filter((row) => {
			return [row.name, row.feeCode || "", row.feeDescription || "", row.site]
				.join(" ")
				.toLowerCase()
				.includes(keyword);
		});
	}, [records, searchQuery]);

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ["vendor-fee-types-admin"] });
	};

	const createMutation = useMutation({
		mutationFn: async (payload: FormState) => {
			const res = await fetch("/api/vendor-fee-types", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: payload.name.trim(),
					feeCode: payload.feeCode.trim() || null,
					feeDescription: payload.feeDescription.trim() || null,
					mode: payload.mode,
					isActive: payload.isActive === "active",
					isNotDefault: payload.isNotDefault,
					site: payload.site,
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || "Failed to create");
			return data;
		},
		onSuccess: () => {
			invalidate();
			toast.success("Đã thêm loại phí");
			setIsAdding(false);
			setForm(emptyForm(userSite));
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const updateMutation = useMutation({
		mutationFn: async ({ id, payload }: { id: string; payload: FormState }) => {
			const res = await fetch("/api/vendor-fee-types", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id,
					name: payload.name.trim(),
					feeCode: payload.feeCode.trim() || null,
					feeDescription: payload.feeDescription.trim() || null,
					mode: payload.mode,
					isActive: payload.isActive === "active",
					isNotDefault: payload.isNotDefault,
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || "Failed to update");
			return data;
		},
		onSuccess: () => {
			invalidate();
			toast.success("Đã cập nhật loại phí");
			setEditingRecord(null);
			setForm(emptyForm(userSite));
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const deleteMutation = useMutation({
		mutationFn: async (id: string) => {
			const res = await fetch(`/api/vendor-fee-types?id=${id}`, {
				method: "DELETE",
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || "Failed to delete");
			return data;
		},
		onSuccess: () => {
			invalidate();
			toast.success("Đã xóa loại phí");
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const importMutation = useMutation({
		mutationFn: async (rows: ImportRow[]) => {
			const res = await fetch("/api/vendor-fee-types", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(
					rows.map((row) => ({
						name: row.name.trim(),
						feeCode: row.feeCode.trim() || null,
						feeDescription: row.feeDescription.trim() || null,
						mode: row.mode,
						isActive: row.isActive === "active",
						isNotDefault: row.isNotDefault,
						site: row.site,
					})),
				),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || "Import failed");
			return data;
		},
		onSuccess: (data: { count?: number }) => {
			invalidate();
			const count = data?.count ?? importRows.length;
			toast.success(`Đã import ${count} loại phí`);
			setIsImporting(false);
			setImportRows([]);
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const openAdd = () => {
		setForm(emptyForm(userSite));
		setIsAdding(true);
	};

	const openImport = () => {
		setImportRows([]);
		setIsImporting(true);
	};

	const handleImportPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
		const text = e.clipboardData.getData("text");
		const lines = text
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean);

		if (!lines.length) return;

		e.preventDefault();

		const rows: ImportRow[] = lines
			.map((line) => line.split("\t"))
			.map((cols) => {
				return {
					name: String(cols[0] || "").trim(),
					feeCode: String(cols[1] || "").trim(),
					feeDescription: String(cols[2] || "").trim(),
					mode: normalizeMode(cols[3]),
					isActive: "active" as const,
					isNotDefault: false,
					site: userSite,
				};
			})
			.filter((row) => row.name);

		setImportRows((prev) => [...rows, ...prev]);
		toast.success(`Đã nhận ${rows.length} dòng từ Excel`);
	};

	const openEdit = (row: VendorFeeTypeRecord) => {
		setEditingRecord(row);
		setForm({
			name: row.name,
			feeCode: row.feeCode || "",
			feeDescription: row.feeDescription || "",
			mode: row.mode,
			isActive: row.isActive ? "active" : "inactive",
			isNotDefault: row.isNotDefault,
			site: row.site,
		});
	};

	const submitCreate = () => {
		if (!form.name.trim()) {
			toast.error("Tên phí là bắt buộc");
			return;
		}
		createMutation.mutate(form);
	};

	const submitUpdate = () => {
		if (!editingRecord) return;
		if (!form.name.trim()) {
			toast.error("Tên phí là bắt buộc");
			return;
		}
		updateMutation.mutate({ id: editingRecord.id, payload: form });
	};

	const submitImport = () => {
		if (!importRows.length) {
			toast.error("Chưa có dữ liệu để import");
			return;
		}
		importMutation.mutate(importRows);
	};

	return (
		<div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border shadow-xl overflow-hidden animate-in fade-in zoom-in duration-500">
			<div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/50 p-6 border-b shrink-0">
				<div className="flex items-center gap-4">
					<div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
						<BadgeDollarSign className="size-6 text-orange-500" />
					</div>
					<div>
						<h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
							Danh mục loại phí Vendor
						</h3>
						<div className="flex items-center gap-2 mt-0.5">
							<span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
								{filteredRecords.length} bản ghi
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
							placeholder="Tìm theo tên phí / loại phí..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-10 w-[300px] h-11 border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 rounded-xl"
						/>
					</div>
					<Button
						variant="outline"
						size="icon"
						onClick={invalidate}
						className="h-11 w-11 rounded-xl"
					>
						<RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
					</Button>
					{canEdit && (
						<>
							<Button
								onClick={openImport}
								variant="outline"
								className="h-11 px-4 rounded-xl font-bold border-slate-200 dark:border-slate-700 hover:bg-white text-slate-600 dark:text-slate-300"
							>
								<FileSpreadsheet className="size-5 mr-2" />
								Nhập từ Excel
							</Button>
							<Button
								onClick={openAdd}
								className="bg-orange-500 hover:bg-orange-600 h-11 px-6 rounded-xl font-bold shadow-lg shadow-orange-500/20 text-white"
							>
								<Plus className="size-5 mr-2" />
								Thêm mới
							</Button>
						</>
					)}
				</div>
			</div>

			<div className="flex-1 overflow-auto bg-white/50 dark:bg-transparent custom-scrollbar">
				<Table className="relative w-full border-separate border-spacing-0">
					<TableHeader className="sticky top-0 z-10 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur border-b">
						<TableRow className="hover:bg-transparent border-none">
							<TableHead className="w-16 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 py-6 border-b">
								STT
							</TableHead>
							<TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-6 border-b">
								Tên phí
							</TableHead>
							<TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-6 border-b">
								Code phí
							</TableHead>
							<TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-6 border-b">
								Mô tả (FAST)
							</TableHead>
							<TableHead className="w-24 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 py-6 border-b">
								Mode
							</TableHead>
							<TableHead className="w-24 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 py-6 border-b">
								Site
							</TableHead>
							<TableHead className="w-24 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 py-6 border-b">
								Trạng thái
							</TableHead>
							<TableHead className="w-24 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 py-6 border-b">
								Ngoài Default
							</TableHead>
							<TableHead className="w-20 sticky right-0 bg-slate-50/90 dark:bg-slate-900/90 border-b border-l" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{filteredRecords.map((row, index) => (
							<TableRow
								key={row.id}
								className="group hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-colors"
							>
								<TableCell className="text-center font-mono text-[11px] text-slate-400 font-bold py-4">
									{index + 1}
								</TableCell>
								<TableCell className="py-4 px-4 font-bold text-slate-700 dark:text-slate-200">
									{row.name}
								</TableCell>
								<TableCell className="py-4 px-4 text-slate-600 dark:text-slate-300">
									{row.feeCode || "-"}
								</TableCell>
								<TableCell className="py-4 px-4 text-slate-500 italic text-[13px]">
									{row.feeDescription || "-"}
								</TableCell>
								<TableCell className="text-center py-4">
									<Badge
										variant={
											row.mode === VendorFeeMode.ALL ? "secondary" : "default"
										}
										className={cn(
											"text-[10px] font-black py-0 px-2",
											row.mode === VendorFeeMode.ALL
												? "bg-slate-200 text-slate-700"
												: "bg-orange-500 text-white hover:bg-orange-500",
										)}
									>
										{row.mode}
									</Badge>
								</TableCell>
								<TableCell className="text-center py-4">
									<Badge
										variant="outline"
										className="text-[10px] font-black py-0 px-2 bg-slate-50 dark:bg-slate-800"
									>
										{row.site}
									</Badge>
								</TableCell>
								<TableCell className="text-center py-4">
									<Badge
										variant={row.isActive ? "default" : "secondary"}
										className={cn(
											"text-[10px] font-black py-0 px-2",
											row.isActive
												? "bg-emerald-600 hover:bg-emerald-600"
												: "bg-slate-200 text-slate-700",
										)}
									>
										{row.isActive ? "Active" : "Inactive"}
									</Badge>
								</TableCell>
								<TableCell className="text-center py-4">
									{row.isNotDefault ? (
										<Badge
											variant="outline"
											className="text-[10px] border-red-200 text-red-600 bg-red-50"
										>
											Ngoài Default
										</Badge>
									) : (
										<span className="text-slate-300 text-[10px]">—</span>
									)}
								</TableCell>
								<TableCell className="py-4 text-right pr-4 sticky right-0 bg-white dark:bg-slate-900 border-l group-hover:bg-orange-50/30 dark:group-hover:bg-orange-900/10 transition-colors">
									{canEdit && (
										<div className="flex items-center justify-end gap-2">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => openEdit(row)}
												className="h-8 w-8 text-slate-300 hover:text-orange-500 opacity-0 group-hover:opacity-100 transition-all"
											>
												<Pencil className="size-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => {
													if (window.confirm("Xóa loại phí này?")) {
														deleteMutation.mutate(row.id);
													}
												}}
												className="h-8 w-8 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
											>
												<Trash2 className="size-4" />
											</Button>
										</div>
									)}
								</TableCell>
							</TableRow>
						))}

						{filteredRecords.length === 0 && !isLoading && (
							<TableRow>
								<TableCell
									colSpan={7}
									className="h-72 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-50"
								>
									Không có dữ liệu loại phí
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			<Dialog open={isImporting} onOpenChange={setIsImporting}>
				<DialogContent className="sm:max-w-[760px] rounded-2xl">
					<DialogHeader>
						<DialogTitle>Nhập loại phí từ Excel</DialogTitle>
						<DialogDescription>
							Dán dữ liệu từ Excel theo cột: Tên phí, Code phí, Mô tả (ERP),
							Mode.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-1">
						<div className="rounded-xl border bg-slate-50 p-3 text-xs text-slate-600">
							<div className="font-bold mb-1">Ví dụ dòng Excel</div>
							<div className="font-mono">
								Phí nâng hạ [TAB] NH [TAB] Lift off [TAB] FCL
							</div>
							<div className="mt-2 text-[11px] text-slate-500">
								Mode chấp nhận `ALL`, `FCL`, `LCL`. Site và trạng thái sẽ dùng
								mặc định từ tài khoản hiện tại.
							</div>
						</div>

						<div>
							<label className="text-sm font-semibold text-slate-700">
								Dán dữ liệu từ Excel
							</label>
							<div className="mt-1 relative">
								<Textarea
									onPaste={handleImportPaste}
									placeholder="Copy vùng dữ liệu từ Excel và paste vào đây"
									className="min-h-24"
								/>
								<div className="absolute right-2 top-2 text-slate-400">
									<ClipboardPaste className="size-4" />
								</div>
							</div>
						</div>

						<div className="rounded-xl border overflow-hidden">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-14">#</TableHead>
										<TableHead>Tên phí</TableHead>
										<TableHead>Code phí</TableHead>
										<TableHead>Mô tả (ERP)</TableHead>
										<TableHead className="w-28">Mode</TableHead>
										<TableHead className="w-14" />
									</TableRow>
								</TableHeader>
								<TableBody>
									{importRows.map((row, index) => (
										<TableRow key={`${row.name}-${index}`}>
											<TableCell>{index + 1}</TableCell>
											<TableCell>{row.name}</TableCell>
											<TableCell>{row.feeCode || "-"}</TableCell>
											<TableCell>{row.feeDescription || "-"}</TableCell>
											<TableCell>{row.mode}</TableCell>
											<TableCell>
												<Button
													variant="ghost"
													size="icon"
													onClick={() =>
														setImportRows((prev) =>
															prev.filter((_, i) => i !== index),
														)
													}
												>
													<X className="size-4" />
												</Button>
											</TableCell>
										</TableRow>
									))}
									{importRows.length === 0 && (
										<TableRow>
											<TableCell
												colSpan={6}
												className="text-center text-slate-400 h-28"
											>
												Chưa có dữ liệu. Hãy paste từ Excel.
											</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
						</div>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setImportRows([]);
								setIsImporting(false);
							}}
						>
							Hủy
						</Button>
						<Button
							variant="outline"
							onClick={() => setImportRows([])}
							disabled={!importRows.length || importMutation.isPending}
						>
							Xóa danh sách
						</Button>
						<Button onClick={submitImport} disabled={importMutation.isPending}>
							{importMutation.isPending && (
								<Loader2 className="size-4 mr-2 animate-spin" />
							)}
							Lưu import
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={isAdding} onOpenChange={setIsAdding}>
				<DialogContent className="sm:max-w-[560px] rounded-2xl">
					<DialogHeader>
						<DialogTitle>Thêm loại phí mới</DialogTitle>
						<DialogDescription>
							Nhập Tên phí, Code phí và mode áp dụng để vendor có thể chọn
							nhanh.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-1">
						<div>
							<label className="text-sm font-semibold text-slate-700">
								Tên phí
							</label>
							<Input
								value={form.name}
								onChange={(e) =>
									setForm((prev) => ({ ...prev, name: e.target.value }))
								}
								placeholder="Ví dụ: Phí nâng hạ"
								className="mt-1"
							/>
						</div>

						<div className="flex flex-col gap-2">
							<label className="text-sm font-semibold text-slate-700">
								Code phí (ERP)
							</label>
							<Popover open={feePopoverOpen} onOpenChange={setFeePopoverOpen}>
								<PopoverTrigger
									render={
										<Button
											variant="outline"
											role="combobox"
											aria-expanded={feePopoverOpen}
											className="w-full justify-between"
										/>
									}
								>
									{form.feeCode
										? erpFees.find((f) => f.feeCode === form.feeCode)
												?.feeCode || form.feeCode
										: "Chọn code phí từ ERP..."}
									<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
								</PopoverTrigger>
								<PopoverPositioner>
									<PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
										<Command>
											<CommandInput placeholder="Tìm mã phí..." />
											<CommandList>
												<CommandEmpty>Không tìm thấy mã phí.</CommandEmpty>
												<CommandGroup>
													<CommandList>
														{erpFees.map((fee) => (
															<CommandItem
																key={fee.feeCode}
																value={`${fee.feeCode} ${fee.feeDescEn}`}
																onSelect={() => {
																	setForm((prev) => ({
																		...prev,
																		feeCode: fee.feeCode,
																		feeDescription: fee.feeDescEn,
																		name: prev.name || fee.feeDescEn,
																	}));
																	setFeePopoverOpen(false);
																}}
															>
																<Check
																	className={cn(
																		"mr-2 h-4 w-4",
																		form.feeCode === fee.feeCode
																			? "opacity-100"
																			: "opacity-0",
																	)}
																/>
																<div className="flex flex-col">
																	<span className="font-bold">
																		{fee.feeCode}
																	</span>
																	<span className="text-xs text-slate-500 italic">
																		{fee.feeDescEn}
																	</span>
																</div>
															</CommandItem>
														))}
													</CommandList>
												</CommandGroup>
											</CommandList>
										</Command>
									</PopoverContent>
								</PopoverPositioner>
							</Popover>
						</div>

						<div>
							<label className="text-sm font-semibold text-slate-700">
								Mô tả phí (ERP)
							</label>
							<Input
								value={form.feeDescription}
								readOnly
								placeholder="Tự động lấy từ ERP"
								className="mt-1 bg-slate-50 text-slate-500 italic"
							/>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="text-sm font-semibold text-slate-700">
									Mode
								</label>
								<Select
									value={form.mode}
									onValueChange={(value) =>
										setForm((prev) => ({
											...prev,
											mode: normalizeMode(value),
										}))
									}
								>
									<SelectTrigger className="mt-1 w-full">
										<SelectValue placeholder="Chọn mode" />
									</SelectTrigger>
									<SelectPositioner>
										<SelectContent>
											{MODE_OPTIONS.map((mode) => (
												<SelectItem key={mode} value={mode}>
													{mode}
												</SelectItem>
											))}
										</SelectContent>
									</SelectPositioner>
								</Select>
							</div>
						</div>

						<div className="flex flex-col gap-4 p-3 bg-slate-50 rounded-xl border border-dotted border-slate-300">
							<div className="flex items-center space-x-2">
								<Checkbox
									id="isActive"
									checked={form.isActive === "active"}
									onCheckedChange={(checked) =>
										setForm((prev) => ({
											...prev,
											isActive: checked ? "active" : "inactive",
										}))
									}
								/>
								<div className="grid gap-1.5 leading-none">
									<label
										htmlFor="isActive"
										className="text-sm font-bold leading-none cursor-pointer text-slate-700"
									>
										Kích hoạt (Hiển thị cho Vendor)
									</label>
								</div>
							</div>

							<div className="flex items-center space-x-2">
								<Checkbox
									id="isNotDefault"
									checked={form.isNotDefault}
									onCheckedChange={(checked) =>
										setForm((prev) => ({
											...prev,
											isNotDefault: !!checked,
										}))
									}
								/>
								<div className="grid gap-1.5 leading-none">
									<label
										htmlFor="isNotDefault"
										className="text-sm font-bold leading-none cursor-pointer text-slate-700"
									>
										Phí này ngoài Default
									</label>
									<p className="text-[11px] text-slate-500 italic">
										Đánh dấu nếu đây là mã phí phát sinh đặc thù, không phải phí
										mặc định
									</p>
								</div>
							</div>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setIsAdding(false)}>
							Hủy
						</Button>
						<Button onClick={submitCreate} disabled={createMutation.isPending}>
							{createMutation.isPending && (
								<Loader2 className="size-4 mr-2 animate-spin" />
							)}
							Lưu
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={Boolean(editingRecord)}
				onOpenChange={(open) => {
					if (!open) {
						setEditingRecord(null);
						setForm(emptyForm(userSite));
					}
				}}
			>
				<DialogContent className="sm:max-w-[560px] rounded-2xl">
					<DialogHeader>
						<DialogTitle>Cập nhật loại phí</DialogTitle>
						<DialogDescription>
							Cập nhật tên phí, code phí, mode và trạng thái hiển thị cho
							vendor.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-1">
						<div>
							<label className="text-sm font-semibold text-slate-700">
								Tên phí
							</label>
							<Input
								value={form.name}
								onChange={(e) =>
									setForm((prev) => ({ ...prev, name: e.target.value }))
								}
								placeholder="Ví dụ: Phí nâng hạ"
								className="mt-1"
							/>
						</div>

						<div className="flex flex-col gap-2">
							<label className="text-sm font-semibold text-slate-700">
								Code phí (ERP)
							</label>
							<Popover open={feePopoverOpen} onOpenChange={setFeePopoverOpen}>
								<PopoverTrigger
									render={
										<Button
											variant="outline"
											role="combobox"
											aria-expanded={feePopoverOpen}
											className="w-full justify-between"
										/>
									}
								>
									{form.feeCode
										? erpFees.find((f) => f.feeCode === form.feeCode)
												?.feeCode || form.feeCode
										: "Chọn code phí từ ERP..."}
									<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
								</PopoverTrigger>
								<PopoverPositioner>
									<PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
										<Command>
											<CommandInput placeholder="Tìm mã phí..." />
											<CommandList>
												<CommandEmpty>Không tìm thấy mã phí.</CommandEmpty>
												<CommandGroup>
													<CommandList>
														{erpFees.map((fee) => (
															<CommandItem
																key={fee.feeCode}
																value={`${fee.feeCode} ${fee.feeDescEn}`}
																onSelect={() => {
																	setForm((prev) => ({
																		...prev,
																		feeCode: fee.feeCode,
																		feeDescription: fee.feeDescEn,
																		name: prev.name || fee.feeDescEn,
																	}));
																	setFeePopoverOpen(false);
																}}
															>
																<Check
																	className={cn(
																		"mr-2 h-4 w-4",
																		form.feeCode === fee.feeCode
																			? "opacity-100"
																			: "opacity-0",
																	)}
																/>
																<div className="flex flex-col">
																	<span className="font-bold">
																		{fee.feeCode}
																	</span>
																	<span className="text-xs text-slate-500 italic">
																		{fee.feeDescEn}
																	</span>
																</div>
															</CommandItem>
														))}
													</CommandList>
												</CommandGroup>
											</CommandList>
										</Command>
									</PopoverContent>
								</PopoverPositioner>
							</Popover>
						</div>

						<div>
							<label className="text-sm font-semibold text-slate-700">
								Mô tả phí (FAST)
							</label>
							<Input
								value={form.feeDescription}
								readOnly
								placeholder="Tự động lấy từ ERP"
								className="mt-1 bg-slate-50 text-slate-500 italic"
							/>
						</div>

						<div>
							<label className="text-sm font-semibold text-slate-700">
								Mode
							</label>
							<Select
								value={form.mode}
								onValueChange={(value) =>
									setForm((prev) => ({
										...prev,
										mode: normalizeMode(value),
									}))
								}
							>
								<SelectTrigger className="mt-1 w-full">
									<SelectValue placeholder="Chọn mode" />
								</SelectTrigger>
								<SelectPositioner>
									<SelectContent>
										{MODE_OPTIONS.map((mode) => (
											<SelectItem key={mode} value={mode}>
												{mode}
											</SelectItem>
										))}
									</SelectContent>
								</SelectPositioner>
							</Select>
						</div>

						<div>
							<label className="text-sm font-semibold text-slate-700">
								Trạng thái
							</label>
							<Select
								value={form.isActive}
								onValueChange={(value) =>
									setForm((prev) => ({
										...prev,
										isActive:
											String(value || "active") === "inactive"
												? "inactive"
												: "active",
									}))
								}
							>
								<SelectTrigger className="mt-1 w-full">
									<SelectValue placeholder="Chọn trạng thái" />
								</SelectTrigger>
								<SelectPositioner>
									<SelectContent>
										<SelectItem value="active">Active</SelectItem>
										<SelectItem value="inactive">Inactive</SelectItem>
									</SelectContent>
								</SelectPositioner>
							</Select>
						</div>

						<div className="flex items-center space-x-2 bg-slate-50 p-3 rounded-xl border border-dotted border-slate-300">
							<Checkbox
								id="isNotDefaultUpdate"
								checked={form.isNotDefault}
								onCheckedChange={(checked) =>
									setForm((prev) => ({
										...prev,
										isNotDefault: !!checked,
									}))
								}
							/>
							<div className="grid gap-1.5 leading-none">
								<label
									htmlFor="isNotDefaultUpdate"
									className="text-sm font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-slate-700"
								>
									Phí này ngoài Default
								</label>
							</div>
						</div>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setEditingRecord(null);
								setForm(emptyForm(userSite));
							}}
						>
							Hủy
						</Button>
						<Button onClick={submitUpdate} disabled={updateMutation.isPending}>
							{updateMutation.isPending && (
								<Loader2 className="size-4 mr-2 animate-spin" />
							)}
							Cập nhật
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
