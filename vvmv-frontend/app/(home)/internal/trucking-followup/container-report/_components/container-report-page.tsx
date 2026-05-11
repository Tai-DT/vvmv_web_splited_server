"use client";

import {
	Box,
	CheckCircle2,
	Clock,
	FileSpreadsheet,
	Filter,
	FilterX,
	RefreshCw,
	Search,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useAirports } from "@/hooks/use-airports";
import { useContainerSizes } from "@/hooks/use-container-sizes";
import { cn } from "@/lib/utils";
import { PartnerCombobox } from "../../../followup/_components/shared/partner-combobox";
import { useContainerReportStatsStore } from "./use-container-report-stats-store";

// ─── Types ────────────────────────────────────────────────────────────────────
type ReportRow = {
	id: string;
	containerNo?: string | null;
	sealNo?: string | null;
	containerSize?: string | null;
	containerType?: string | null;
	grossWeight?: number | null;
	tareWeight?: number | null;
	implementationDate?: string | null;
	warehouse?: string | null;
	plateNumber?: string | null;
	vendor?: string | null;
	status?: "FINISHED" | "PENDING" | null;

	// Trucking Follow Up
	truckingFollowUpId?: string | null;
	jobNumber?: string | null;
	taxCode?: string | null;
	companyName?: string | null;
	billOrBooking?: string | null;
	serviceMode?: string | null;
	operationType?: string | null;

	// FCR
	fcrNumber?: string | null;
	driver?: string | null;
	fcrPlateNumber?: string | null;
	fcrVendor?: string | null;
	fromLocation?: string | null;
	toLocation?: string | null;

	// TF Extra
	pickOrLiftPlace?: string | null;
	routineDetail?: string | null;
	note?: string | null;
	jobLog?: string | null;
	handler?: string | null;
	ops?: string | null;
	ccgh?: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(val: string | null | undefined): string {
	if (!val) return "—";
	try {
		const d = new Date(val);
		if (Number.isNaN(d.getTime())) return String(val);
		const day = String(d.getDate()).padStart(2, "0");
		const month = String(d.getMonth() + 1).padStart(2, "0");
		const year = d.getFullYear();
		return `${day}/${month}/${year}`;
	} catch {
		return String(val);
	}
}

function _fmtNum(val: number | null | undefined): string {
	if (val === null || val === undefined) return "—";
	return val.toLocaleString("vi-VN");
}

// ─── Filter Form ──────────────────────────────────────────────────────────────
type Filters = {
	search: string;
	dateFrom: string;
	dateTo: string;
	taxCode: string;
	companyName: string;
	containerNo: string;
	containerSize: string;
	operationType: string;
	vendor: string;
	status: string;
	ccgh: string;
};

const EMPTY_FILTERS: Filters = {
	search: "",
	dateFrom: "",
	dateTo: "",
	taxCode: "",
	companyName: "",
	containerNo: "",
	containerSize: "",
	operationType: "",
	vendor: "",
	status: "",
	ccgh: "",
};

export default function ContainerReportPage() {
	const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
	const [data, setData] = useState<ReportRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [searched, setSearched] = useState(false);
	const [showFilters, setShowFilters] = useState(true);
	const [page, setPage] = useState(1);
	const [vendors, setVendors] = useState<string[]>([]);
	const { containerSizes } = useContainerSizes();
	const { airports } = useAirports();
	const PAGE_SIZE = 100;

	const airportNameToId = useMemo(() => {
		const map = new Map<string, string>();
		for (const a of airports) {
			if (a.name && a.id) map.set(a.name.trim().toLowerCase(), a.id);
		}
		return map;
	}, [airports]);

	const resolveAirportIds = useCallback(
		(locationStr: string | null | undefined): string => {
			if (!locationStr) return "—";
			return locationStr
				.split(" -> ")
				.map((name) => airportNameToId.get(name.trim().toLowerCase()) ?? "—")
				.join(" -> ");
		},
		[airportNameToId],
	);

	const updateStats = useContainerReportStatsStore((s) => s.updateStats);

	const setFilter = (key: keyof Filters, val: string) =>
		setFilters((prev) => ({ ...prev, [key]: val }));

	useEffect(() => {
		fetch("/api/vendors")
			.then((res) => res.json())
			.then((json) => setVendors(json.vendors || []))
			.catch((err) => console.error("Failed to load vendors", err));
	}, []);

	const handleSearch = useCallback(
		async (overrideFilters?: Filters) => {
			setLoading(true);
			try {
				const f = overrideFilters ?? filters;
				const params = new URLSearchParams();
				Object.entries(f).forEach(([k, v]) => {
					if (v) params.set(k, v);
				});
				const res = await fetch(
					`/api/trucking-followup/container-report?${params.toString()}`,
				);
				if (!res.ok) throw new Error((await res.json()).message);
				const json = await res.json();
				setData(json.data ?? []);
				setPage(1);
				setSearched(true);
			} catch (err: any) {
				toast.error(err.message || "Lỗi khi tải báo cáo");
			} finally {
				setLoading(false);
			}
		},
		[filters],
	);

	const handleReset = () => {
		setFilters(EMPTY_FILTERS);
		setData([]);
		setSearched(false);
		setPage(1);
	};

	const pagedData = useMemo(() => {
		return data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
	}, [data, page]);

	const totalPages = Math.ceil(data.length / PAGE_SIZE);

	const summary = useMemo(() => {
		const totalContainers = data.length;
		const totalJobs = new Set(data.map((r) => r.jobNumber).filter(Boolean))
			.size;
		const totalCompanies = new Set(
			data.map((r) => r.companyName).filter(Boolean),
		).size;
		return { totalContainers, totalJobs, totalCompanies };
	}, [data]);

	useEffect(() => {
		updateStats(
			summary.totalContainers,
			summary.totalJobs,
			summary.totalCompanies,
		);
	}, [summary, updateStats]);

	const handleExport = useCallback(() => {
		if (data.length === 0) {
			toast.error("Không có dữ liệu để xuất");
			return;
		}
		const headers = [
			"STT",
			"Số Job",
			"Job Log",
			"Khách hàng",
			"MST",
			"Xuất/Nhập",
			"Trạng thái",
			"Handler",
			"Bill/Booking",
			"Số Container",
			"Số Seal",
			"Size",
			"Loại Cont",
			"G.W (kg)",
			"Tare (kg)",
			"Ngày thực hiện",
			"Kho",
			"Số xe",
			"Tài xế (FCR)",
			"Số FCR",
			"Điểm đi",
			"Điểm đến",
			"Điểm đi FAST",
			"Điểm đến FAST",
			"Nơi lấy/trả rỗng",
			"Lộ trình chi tiết",
			"Nhà xe",
			"Ghi chú",
			"OPS",
			"CCGH",
		];
		const rows = data.map((r, i) => [
			i + 1,
			r.jobNumber ?? "",
			r.jobLog ?? "",
			r.companyName ?? "",
			r.taxCode ?? "",
			r.operationType === "XUAT" ? "Xuất" : "Nhập",
			r.status === "FINISHED" ? "Hoàn thành" : "Đang xử lý",
			r.handler ?? "",
			r.billOrBooking ?? "",
			r.containerNo ?? "",
			r.sealNo ?? "",
			r.containerSize ?? "",
			r.containerType ?? "",
			r.grossWeight ?? "",
			r.tareWeight ?? "",
			r.implementationDate ? fmtDate(r.implementationDate) : "",
			r.warehouse ?? "",
			r.plateNumber ?? "",
			r.driver ?? "",
			r.fcrNumber ?? "",
			r.fromLocation ?? "",
			r.toLocation ?? "",
			resolveAirportIds(r.fromLocation),
			resolveAirportIds(r.toLocation),
			r.pickOrLiftPlace ?? "",
			r.routineDetail ?? "",
			r.vendor ?? "",
			r.note ?? "",
			r.ops ?? "",
			r.ccgh ?? "",
		]);
		const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

		// Ensure certain columns are treated as strings to keep leading zeros (MST, Ngày thực hiện, Cont, FCR)
		const stringColIndices = [4, 9, 15, 19];
		const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
		for (let r = range.s.r + 1; r <= range.e.r; r++) {
			stringColIndices.forEach((c) => {
				const cellAddress = XLSX.utils.encode_cell({ r, c });
				if (ws[cellAddress]) {
					ws[cellAddress].t = "s";
				}
			});
		}

		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, "Báo cáo Container");
		const filename = `bao-cao-container-${new Date().toISOString().slice(0, 10)}.xlsx`;
		XLSX.writeFile(wb, filename);
		toast.success(`Đã xuất file ${filename}`);
	}, [data, resolveAirportIds]);

	type ColumnKey = keyof ReportRow | "stt" | "fromLocationId" | "toLocationId";

	const columns: {
		key: ColumnKey;
		label: string;
		width?: string;
	}[] = [
		{ key: "stt", label: "STT", width: "50px" },
		{ key: "jobNumber", label: "Số Job", width: "130px" },
		{ key: "jobLog", label: "Job Log", width: "130px" },
		{ key: "companyName", label: "Khách hàng", width: "180px" },
		{ key: "handler", label: "Handler", width: "120px" },
		{ key: "status", label: "Trạng thái", width: "120px" },
		{ key: "operationType", label: "Loại", width: "70px" },
		{ key: "containerNo", label: "Số Container", width: "130px" },
		{ key: "sealNo", label: "Số Seal", width: "100px" },
		{ key: "containerSize", label: "Size", width: "70px" },
		{ key: "grossWeight", label: "G.W (kg)", width: "100px" },
		{ key: "plateNumber", label: "Số xe", width: "100px" },
		{ key: "driver", label: "Tài xế", width: "130px" },
		{ key: "fcrNumber", label: "Số FCR", width: "150px" },
		{ key: "fromLocation", label: "Điểm đi", width: "150px" },
		{ key: "toLocation", label: "Điểm đến", width: "150px" },
		{ key: "fromLocationId", label: "Điểm đi FAST", width: "120px" },
		{ key: "toLocationId", label: "Điểm đến FAST", width: "120px" },
		{ key: "pickOrLiftPlace", label: "Nơi lấy/trả rỗng", width: "150px" },
		{ key: "routineDetail", label: "Lộ trình chi tiết", width: "200px" },
		{ key: "vendor", label: "Nhà xe", width: "150px" },
		{ key: "warehouse", label: "Kho", width: "150px" },
		{ key: "billOrBooking", label: "Bill/Booking", width: "140px" },
		{ key: "note", label: "Ghi chú", width: "200px" },
		{ key: "ops", label: "OPS", width: "120px" },
		{ key: "ccgh", label: "CCGH", width: "80px" },
	];

	function getCellValue(
		row: ReportRow,
		key: ColumnKey,
		index: number,
	): React.ReactNode {
		if (key === "stt") return index + 1;
		if (key === "fromLocationId") return resolveAirportIds(row.fromLocation);
		if (key === "toLocationId") return resolveAirportIds(row.toLocation);
		const val = row[key as keyof ReportRow];
		if (key === "implementationDate") return fmtDate(val as string);

		if (key === "status") {
			const isFin = row.status === "FINISHED";
			return (
				<Badge
					variant="outline"
					className={cn(
						"gap-1 px-2 py-0.5 font-bold uppercase text-[10px]",
						isFin
							? "border-emerald-300 text-emerald-700 bg-emerald-50"
							: "border-amber-300 text-amber-700 bg-amber-50",
					)}
				>
					{isFin ? (
						<CheckCircle2 className="size-3" />
					) : (
						<Clock className="size-3" />
					)}
					{isFin ? "Hoàn thành" : "Đang xử lý"}
				</Badge>
			);
		}

		if (key === "operationType") {
			return val ? (
				<Badge
					variant="outline"
					className={
						val === "XUAT"
							? "border-blue-300 text-blue-700 bg-blue-50"
							: "border-orange-300 text-orange-700 bg-orange-50"
					}
				>
					{val === "XUAT" ? "Xuất" : "Nhập"}
				</Badge>
			) : (
				"—"
			);
		}
		if (key === "ccgh") {
			return val === "Yes" ? (
				<Badge
					variant="outline"
					className="border-green-300 text-green-700 bg-green-50 font-bold px-2 py-0"
				>
					Yes
				</Badge>
			) : (
				<Badge
					variant="outline"
					className="border-slate-300 text-slate-500 bg-slate-50 font-bold px-2 py-0"
				>
					No
				</Badge>
			);
		}
		if (key === "containerNo")
			return (
				<span className="font-mono font-bold text-blue-600 dark:text-blue-400">
					{val || "—"}
				</span>
			);
		return val === null || val === undefined || val === "" ? "—" : String(val);
	}

	return (
		<div className="flex flex-col gap-6 p-6 min-h-screen bg-muted/30">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
						<Box className="size-6 text-primary" />
						Báo cáo Container Trucking
					</h1>
					<p className="text-sm text-muted-foreground mt-1">
						Theo dõi chi tiết container, lịch trình xe và thông tin FCR
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						onClick={() => setShowFilters(!showFilters)}
						variant={showFilters ? "secondary" : "outline"}
						className="gap-2"
					>
						{showFilters ? (
							<FilterX className="size-4" />
						) : (
							<Filter className="size-4" />
						)}
						{showFilters ? "Ẩn bộ lọc" : "Hiện bộ lọc"}
					</Button>
					<Button
						onClick={handleExport}
						disabled={data.length === 0}
						className="gap-2"
						variant="outline"
					>
						<FileSpreadsheet className="size-4" />
						Xuất Excel
						{data.length > 0 && (
							<Badge variant="secondary" className="ml-1">
								{data.length}
							</Badge>
						)}
					</Button>
				</div>
			</div>

			{showFilters && (
				<div className="rounded-xl border bg-card shadow-sm p-4 sm:p-5 flex flex-col gap-6 font-sans">
					<div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center w-full">
						<div className="relative flex-1 w-full">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
							<Input
								id="container-report-search"
								placeholder="Nhập hoặc dán nhiều số container, số job, số xe..."
								value={filters.search}
								onChange={(e) => setFilter("search", e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && handleSearch()}
								className="pl-9 pr-10 h-10 w-full"
							/>
							{filters.search && (
								<Button
									variant="ghost"
									size="icon"
									className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
									onClick={() => setFilter("search", "")}
								>
									<X className="size-4" />
								</Button>
							)}
						</div>
						<Button
							onClick={() => handleSearch()}
							disabled={loading}
							className="gap-2 h-10 px-6"
						>
							{loading ? (
								<RefreshCw className="size-4 animate-spin" />
							) : (
								<Search className="size-4" />
							)}
							Tìm kiếm
						</Button>
					</div>

					<div className="h-px w-full bg-border" />

					<div>
						<h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4 opacity-70">
							Bộ lọc chi tiết
						</h2>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-x-3 gap-y-4 items-end">
							<div className="space-y-1.5 lg:col-span-2">
								<label className="text-[11px] font-bold text-muted-foreground uppercase block h-4 mb-1">
									Thời gian thực hiện
								</label>
								<div className="flex items-center gap-2 h-8">
									<Input
										id="container-report-date-from"
										type="date"
										value={filters.dateFrom}
										onChange={(e) => setFilter("dateFrom", e.target.value)}
										className="w-full h-8 text-[11px] px-2 shadow-none border-muted-foreground/20"
									/>
									<span className="text-muted-foreground text-[11px] font-bold">
										-
									</span>
									<Input
										id="container-report-date-to"
										type="date"
										value={filters.dateTo}
										onChange={(e) => setFilter("dateTo", e.target.value)}
										className="w-full h-8 text-[11px] px-2 shadow-none border-muted-foreground/20"
									/>
								</div>
							</div>

							<div className="space-y-1.5 lg:col-span-2">
								<label className="text-[11px] font-bold text-muted-foreground uppercase block h-4 mb-1">
									Khách hàng
								</label>
								<div className="h-8">
									<PartnerCombobox
										value={filters.taxCode}
										onPartnerSelect={(p) => {
											setFilter("taxCode", p?.id || "");
											setFilter("companyName", p?.name || "");
										}}
										placeholder="Chọn khách hàng..."
										triggerClassName="h-8 text-[11px] border-muted-foreground/20"
									/>
								</div>
							</div>

							<div className="space-y-1.5 lg:col-span-1">
								<label className="text-[11px] font-bold text-muted-foreground uppercase block h-4 mb-1 whitespace-nowrap">
									Trạng thái
								</label>
								<div className="h-8">
									<Select
										value={filters.status || "ALL"}
										onValueChange={(v) =>
											setFilter("status", v === "ALL" ? "" : (v as string))
										}
									>
										<SelectTrigger className="h-8 text-[11px] shadow-none border-muted-foreground/20">
											<SelectValue placeholder="Tất cả" />
										</SelectTrigger>
										<SelectPositioner>
											<SelectContent>
												<SelectItem value="ALL">Tất cả</SelectItem>
												<SelectItem value="FINISHED">Hoàn thành</SelectItem>
												<SelectItem value="PENDING">Đang xử lý</SelectItem>
											</SelectContent>
										</SelectPositioner>
									</Select>
								</div>
							</div>

							<div className="space-y-1.5 lg:col-span-1">
								<label className="text-[11px] font-bold text-muted-foreground uppercase block h-4 mb-1">
									Nhà xe
								</label>
								<div className="h-8">
									<Select
										value={filters.vendor || "ALL"}
										onValueChange={(v) =>
											setFilter("vendor", v === "ALL" ? "" : (v as string))
										}
									>
										<SelectTrigger className="h-8 text-[11px] shadow-none border-muted-foreground/20">
											<SelectValue placeholder="Tất cả" />
										</SelectTrigger>
										<SelectPositioner>
											<SelectContent>
												<SelectItem value="ALL">Tất cả</SelectItem>
												{vendors.map((v) => (
													<SelectItem key={v} value={v}>
														{v}
													</SelectItem>
												))}
											</SelectContent>
										</SelectPositioner>
									</Select>
								</div>
							</div>

							<div className="space-y-1.5 lg:col-span-1">
								<label className="text-[11px] font-bold text-muted-foreground uppercase block h-4 mb-1">
									Size
								</label>
								<div className="h-8">
									<Select
										value={filters.containerSize || "ALL"}
										onValueChange={(v) =>
											setFilter(
												"containerSize",
												v === "ALL" ? "" : (v as string),
											)
										}
									>
										<SelectTrigger className="h-8 text-[11px] shadow-none border-muted-foreground/20">
											<SelectValue placeholder="Tất cả" />
										</SelectTrigger>
										<SelectPositioner>
											<SelectContent>
												<SelectItem value="ALL">Tất cả</SelectItem>
												{containerSizes.map((size) => (
													<SelectItem key={size} value={size}>
														{size}
													</SelectItem>
												))}
											</SelectContent>
										</SelectPositioner>
									</Select>
								</div>
							</div>

							<div className="space-y-1.5 lg:col-span-1">
								<label className="text-[11px] font-bold text-muted-foreground uppercase block h-4 mb-1">
									X/N
								</label>
								<div className="h-8">
									<Select
										value={filters.operationType || "ALL"}
										onValueChange={(v) =>
											setFilter(
												"operationType",
												v === "ALL" ? "" : (v as string),
											)
										}
									>
										<SelectTrigger className="h-8 text-[11px] shadow-none border-muted-foreground/20">
											<SelectValue placeholder="Tất cả" />
										</SelectTrigger>
										<SelectPositioner>
											<SelectContent>
												<SelectItem value="ALL">Tất cả</SelectItem>
												<SelectItem value="XUAT">Xuất</SelectItem>
												<SelectItem value="NHAP">Nhập</SelectItem>
											</SelectContent>
										</SelectPositioner>
									</Select>
								</div>
							</div>

							<div className="space-y-1.5 lg:col-span-1">
								<label className="text-[11px] font-bold text-muted-foreground uppercase block h-4 mb-1">
									CCGH
								</label>
								<div className="h-8">
									<Select
										value={filters.ccgh || "ALL"}
										onValueChange={(v) =>
											setFilter("ccgh", v === "ALL" ? "" : (v as string))
										}
									>
										<SelectTrigger className="h-8 text-[11px] shadow-none border-muted-foreground/20">
											<SelectValue placeholder="Tất cả" />
										</SelectTrigger>
										<SelectPositioner>
											<SelectContent>
												<SelectItem value="ALL">Tất cả</SelectItem>
												<SelectItem value="Yes">Yes</SelectItem>
												<SelectItem value="No">No</SelectItem>
											</SelectContent>
										</SelectPositioner>
									</Select>
								</div>
							</div>

							{/* Filter Operations */}
							<div className="flex items-center justify-end gap-1.5 lg:col-span-1 h-8 lg:ml-auto">
								<Button
									onClick={() => handleSearch()}
									disabled={loading}
									className="gap-2 h-8 text-[11px] uppercase group whitespace-nowrap shadow-sm hover:translate-y-[-1px] transition-all"
									variant="default"
								>
									{loading ? (
										<RefreshCw className="size-3 animate-spin" />
									) : (
										<Filter className="size-3 group-hover:scale-110 transition-transform" />
									)}
									Lọc
								</Button>
								<Button
									onClick={handleReset}
									disabled={loading}
									variant="outline"
									className="h-8 px-3 text-[11px] uppercase border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 hover:text-amber-800 transition-all font-bold shadow-sm"
								>
									Reset
								</Button>
							</div>
						</div>
					</div>
				</div>
			)}

			{searched && (
				<div className="rounded-xl border bg-card shadow-sm overflow-hidden">
					<div className="px-4 py-2.5 border-b bg-muted/30 flex items-center justify-between">
						<span className="text-xs text-muted-foreground font-medium">
							Tìm thấy{" "}
							<span className="font-bold text-primary px-1 bg-primary/10 rounded">
								{data.length}
							</span>{" "}
							container phù hợp
						</span>
					</div>
					{data.length === 0 ? (
						<div className="py-24 text-center text-muted-foreground">
							<Box className="size-12 mx-auto mb-4 opacity-20" />
							<p className="text-sm font-medium">
								Không tìm thấy container nào
							</p>
						</div>
					) : (
						<div className="overflow-x-auto max-h-[65vh] overflow-y-auto custom-scrollbar">
							<Table>
								<TableHeader className="sticky top-0 z-10 bg-muted/90 backdrop-blur-md">
									<TableRow>
										{columns.map((col) => (
											<TableHead
												key={col.key}
												className="whitespace-nowrap text-xs font-bold py-3 px-4 uppercase"
												style={{ minWidth: col.width }}
											>
												{col.label}
											</TableHead>
										))}
									</TableRow>
								</TableHeader>
								<TableBody>
									{pagedData.map((row, i) => (
										<TableRow
											key={row.id}
											className="hover:bg-primary/5 transition-colors group"
										>
											{columns.map((col) => (
												<TableCell
													key={col.key}
													className="py-2.5 px-4 text-xs whitespace-nowrap border-b border-border/50 group-last:border-0"
												>
													{getCellValue(
														row,
														col.key,
														(page - 1) * PAGE_SIZE + i,
													)}
												</TableCell>
											))}
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					)}
					{data.length > 0 && (
						<div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-between">
							<p className="text-xs text-muted-foreground font-medium">
								Đang hiển thị{" "}
								<span className="font-bold text-foreground">
									{(page - 1) * PAGE_SIZE + 1}
								</span>{" "}
								-{" "}
								<span className="font-bold text-foreground">
									{Math.min(page * PAGE_SIZE, data.length)}
								</span>{" "}
								/{" "}
								<span className="font-bold text-foreground">{data.length}</span>
							</p>
							<div className="flex items-center gap-3">
								<Button
									variant="outline"
									size="sm"
									className="h-8"
									disabled={page === 1}
									onClick={() => setPage(page - 1)}
								>
									Trước
								</Button>
								<Badge
									variant="secondary"
									className="h-7 px-2 font-bold text-xs"
								>
									{page} / {totalPages}
								</Badge>
								<Button
									variant="outline"
									size="sm"
									className="h-8"
									disabled={page === totalPages}
									onClick={() => setPage(page + 1)}
								>
									Tiếp
								</Button>
							</div>
						</div>
					)}
				</div>
			)}

			{!searched && (
				<div className="flex flex-col items-center justify-center py-32 text-muted-foreground/40 bg-card/50 rounded-2xl border-2 border-dashed">
					<Box className="size-20 opacity-10 mb-6 animate-pulse" />
					<p className="text-xl font-bold tracking-tight text-foreground/40">
						Sẵn sàng phân tích dữ liệu
					</p>
				</div>
			)}
		</div>
	);
}
