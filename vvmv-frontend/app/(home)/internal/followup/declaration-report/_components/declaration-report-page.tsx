"use client";

import {
	ChevronLeft,
	ChevronRight,
	FileSpreadsheet,
	FileText,
	Filter,
	FilterX,
	RefreshCw,
	Search,
	X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { PartnerCombobox } from "../../_components/shared/partner-combobox";
import { useDeclarationReportStatsStore } from "./use-declaration-report-stats-store";

// ─── Types ────────────────────────────────────────────────────────────────────
type ReportRow = {
	declarationId: string;
	declarationType?: string | null;
	declarationNumber?: string | null;
	batch?: string | null;
	authority?: string | null;
	workType?: string | null;
	declarationDate?: string | null;
	grossWeight?: number | null;
	quantity?: number | null;
	unit?: string | null;
	etaEtd?: string | null;
	billBooking?: string | null;
	invoice?: string | null;
	pol?: string | null;
	pod?: string | null;
	warehouse?: string | null;
	mstClient?: string | null;
	clientName?: string | null;
	partner?: string | null;
	totalTaxAmount?: number | null;
	vatTax?: number | null;
	ieTax?: number | null;
	taxRemark?: string | null;
	tqDate?: string | null;
	kvgsDate?: string | null;
	firstCds?: string | null;
	diaDiemLuuKho?: string | null;
	diaDiemBaoThue?: string | null;
	containers?: string | null;
	containerNos?: string | null;
	containerSizes?: string | null;
	attachDocuments?: string | null;
	driveUrl?: string | null;
	mvUrl?: string | null;
	customsCode?: string | null;
	// From FollowUp
	followUpId?: string | null;
	jobNumber?: string | null;
	taxCode?: string | null;
	companyName?: string | null;
	operationType?: string | null;
	serviceMode?: string | null;
	followUpWarehouse?: string | null;
	followUpAuthority?: string | null;
	billOrBooking?: string | null;
	supplier?: string | null;
	commodityName?: string | null;
	followUpNote2?: string | null;
	followUpNote3?: string | null;
	followUpNotes?: string | null;
	handler?: string | null;
	isFinished?: boolean | null;
	domain?: string | null;
	followUpCreatedAt?: string | null;
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

function fmtNum(val: number | null | undefined): string {
	if (val === null || val === undefined) return "—";
	return val.toLocaleString("vi-VN");
}

function _fmtCurrency(val: number | null | undefined): string {
	if (val === null || val === undefined) return "—";
	return val.toLocaleString("vi-VN", { style: "currency", currency: "VND" });
}

// ─── Filter Form ──────────────────────────────────────────────────────────────
type Filters = {
	search: string;
	dateFrom: string;
	dateTo: string;
	taxCode: string;
	companyName: string;
	operationType: string;
	workType: string;
};

const EMPTY_FILTERS: Filters = {
	search: "",
	dateFrom: "",
	dateTo: "",
	taxCode: "",
	companyName: "",
	operationType: "",
	workType: "",
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DeclarationReportPage() {
	const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
	const [data, setData] = useState<ReportRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [searched, setSearched] = useState(false);
	const [showFilters, setShowFilters] = useState(true);
	const [page, setPage] = useState(1);
	const PAGE_SIZE = 100;

	const updateStats = useDeclarationReportStatsStore((s) => s.updateStats);

	const setFilter = (key: keyof Filters, val: string) =>
		setFilters((prev) => ({ ...prev, [key]: val }));

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
					`/api/followup/declaration-report?${params.toString()}`,
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

	// ── Summary stats ──────────────────────────────────────────────
	const summary = useMemo(() => {
		const totalDeclarations = data.length;
		const totalTax = data.reduce((s, r) => s + (r.totalTaxAmount ?? 0), 0);
		const uniqueJobs = new Set(data.map((r) => r.jobNumber).filter(Boolean))
			.size;
		const uniqueCompanies = new Set(
			data.map((r) => r.companyName).filter(Boolean),
		).size;
		return { totalDeclarations, totalTax, uniqueJobs, uniqueCompanies };
	}, [data]);

	useEffect(() => {
		updateStats(
			summary.totalDeclarations,
			summary.uniqueJobs,
			summary.uniqueCompanies,
			summary.totalTax,
		);
	}, [summary, updateStats]);

	// ── Export Excel ─────────────────────────────────────────────────────────
	const [isExporting, setIsExporting] = useState(false);

	const handleExport = useCallback(async () => {
		if (data.length === 0) {
			toast.error("Không có dữ liệu để xuất");
			return;
		}

		setIsExporting(true);
		try {
			const ExcelJS = await import("exceljs");
			const wb = new ExcelJS.Workbook();
			const ws = wb.addWorksheet("Báo cáo tờ khai");

			const headers = [
				"STT",
				"Số Job",
				"Công ty (MST)",
				"Tên công ty",
				"Xuất/Nhập",
				"Service Mode",
				"Bill/Booking",
				"Loại tờ khai",
				"Số tờ khai",
				"CDS đầu tiên",
				"Ngày tờ khai",
				"Loại hình",
				"Cơ quan hải quan",
				"Luồng",
				"Container trên TK",
				"Số container",
				"Loại container",
				"ETA/ETD",
				"POL",
				"POD",
				"Kho",
				"Tên hàng",
				"Gross Weight (kg)",
				"Số lượng",
				"ĐVT",
				"Hóa đơn",
				"Đối tác",
				"Tổng tiền thuế",
				"Thuế VAT",
				"Thuế XNK",
				"Ghi chú thuế",
				"Ngày TQ",
				"Ngày KVGS",
				"Địa điểm lưu kho",
				"Địa điểm bao thue",
				"Ghi chú (FollowUp)",
				"Ghi chú 2",
				"Ghi chú 3",
				"Trạng thái",
				"Domain",
				"MV URL (Barcode)",
			];

			const headerRow = ws.addRow(headers);
			headerRow.font = { bold: true };
			headerRow.alignment = { vertical: "middle", horizontal: "center" };

			data.forEach((r, i) => {
				const rowData = [
					i + 1,
					r.jobNumber ?? "",
					r.taxCode ?? "",
					r.companyName ?? "",
					r.operationType ?? "",
					r.serviceMode ?? "",
					r.billOrBooking ?? r.billBooking ?? "",
					r.declarationType ?? "",
					r.declarationNumber ?? "",
					r.firstCds ?? "",
					r.declarationDate ? fmtDate(r.declarationDate) : "",
					r.workType ?? "",
					r.authority ?? "",
					r.batch ?? "",
					r.containers ?? "",
					r.containerNos ?? "",
					r.containerSizes ?? "",
					r.etaEtd ? fmtDate(r.etaEtd) : "",
					r.pol ?? "",
					r.pod ?? "",
					r.warehouse ?? r.followUpWarehouse ?? "",
					r.commodityName ?? "",
					r.grossWeight ?? "",
					r.quantity ?? "",
					r.unit ?? "",
					r.invoice ?? "",
					r.partner ?? r.clientName ?? "",
					r.totalTaxAmount ?? "",
					r.vatTax ?? "",
					r.ieTax ?? "",
					r.taxRemark ?? "",
					r.tqDate ? fmtDate(r.tqDate) : "",
					r.kvgsDate ? fmtDate(r.kvgsDate) : "",
					r.diaDiemLuuKho ?? "",
					r.diaDiemBaoThue ?? "",
					r.followUpNotes ?? "",
					r.followUpNote2 ?? "",
					r.followUpNote3 ?? "",
					r.isFinished ? "Hoàn thành" : "Đang xử lý",
					r.domain ?? "",
					r.mvUrl ?? "",
				];

				const row = ws.addRow(rowData);

				// Color the row based on Luồng (index 12)
				const batch = (r.batch || "").toLowerCase();
				let color = "";
				if (batch.includes("xanh"))
					color = "C6EFCE"; // Light green
				else if (batch.includes("vàng"))
					color = "FFEB9C"; // Light yellow
				else if (batch.includes("đỏ")) color = "FFC7CE"; // Light red

				if (color) {
					row.eachCell((cell) => {
						cell.fill = {
							type: "pattern",
							pattern: "solid",
							fgColor: { argb: color },
						};
					});
				}

				// Force string type for specific columns to preserve leading zeros
				// MST (3), TK (9), F-CDS (10), Date (11), ETA (18), TQ (32), KVGS (33) - 1-based indices
				const stringCols = [3, 9, 10, 11, 18, 32, 33];
				stringCols.forEach((colIdx) => {
					row.getCell(colIdx).numFmt = "@";
				});

				// Wrap text for container info columns (Cont (RPA) = 15, Số container = 16, Loại container = 17)
				row.getCell(15).alignment = { wrapText: true, vertical: "middle" };
				row.getCell(16).alignment = { wrapText: true, vertical: "middle" };
				row.getCell(17).alignment = { wrapText: true, vertical: "middle" };
			});

			// Auto width
			ws.columns = headers.map((h, i) => {
				const maxLen = Math.max(
					h.length,
					...data.slice(0, 100).map((r) => {
						const rowData = [
							"",
							r.jobNumber,
							r.taxCode,
							r.companyName,
							r.operationType,
							r.serviceMode,
							r.billOrBooking || r.billBooking,
							r.declarationType,
							r.declarationNumber,
							r.firstCds,
							r.declarationDate,
							r.workType,
							r.authority,
							r.batch,
							r.containers,
							r.containerNos,
							r.containerSizes,
							r.etaEtd,
						];
						return String(rowData[i] ?? "").length;
					}),
				);
				return { width: Math.min(maxLen + 2, 40) };
			});

			const buffer = await wb.xlsx.writeBuffer();
			const blob = new Blob([buffer], {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			});
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = `bao-cao-to-khai-${new Date().toISOString().slice(0, 10)}.xlsx`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
			toast.success(`Đã xuất file thành công`);
		} catch (err: any) {
			console.error("Export Excel error:", err);
			toast.error("Lỗi khi xuất file Excel");
		} finally {
			setIsExporting(false);
		}
	}, [data]);

	// ─── Column definitions ───────────────────────────────────────────────────
	const columns: {
		key: keyof ReportRow | "stt";
		label: string;
		width?: string;
	}[] = [
		{ key: "stt", label: "STT", width: "50px" },
		{ key: "jobNumber", label: "Số Job", width: "130px" },
		{ key: "companyName", label: "Công ty", width: "180px" },
		{ key: "taxCode", label: "MST" },
		{ key: "operationType", label: "Loại", width: "70px" },
		{ key: "serviceMode", label: "Mode", width: "80px" },
		{ key: "declarationType", label: "Loại TK", width: "80px" },
		{ key: "declarationNumber", label: "Số tờ khai", width: "150px" },
		{ key: "firstCds", label: "CDS đầu tiên", width: "130px" },
		{ key: "declarationDate", label: "Ngày TK", width: "100px" },
		{ key: "workType", label: "Loại hình", width: "120px" },
		{ key: "authority", label: "Cơ quan HQ", width: "120px" },
		{ key: "batch", label: "Luồng", width: "130px" },
		{ key: "containerNos", label: "Số Container", width: "150px" },
		{ key: "containerSizes", label: "Loại Cont", width: "100px" },
		{ key: "containers", label: "Container trên TK", width: "130px" },
		{ key: "billBooking", label: "Bill/Booking", width: "140px" },
		{ key: "etaEtd", label: "ETA/ETD", width: "100px" },
		{ key: "pol", label: "POL", width: "100px" },
		{ key: "pod", label: "POD", width: "100px" },
		{ key: "warehouse", label: "Kho", width: "120px" },
		{ key: "commodityName", label: "Tên hàng", width: "150px" },
		{ key: "grossWeight", label: "G.W (kg)", width: "100px" },
		{ key: "quantity", label: "Số lượng", width: "80px" },
		{ key: "totalTaxAmount", label: "Tổng thuế", width: "120px" },
		{ key: "vatTax", label: "Thuế VAT", width: "110px" },
		{ key: "ieTax", label: "Thuế XNK", width: "110px" },
		{ key: "tqDate", label: "Ngày TQ", width: "100px" },
		{ key: "kvgsDate", label: "Ngày KVGS", width: "110px" },
		{ key: "isFinished", label: "Trạng thái", width: "110px" },
		{ key: "followUpNotes", label: "Ghi chú (F.Up)", width: "200px" },
		{ key: "mvUrl", label: "MV URL", width: "160px" },
	];

	function getCellValue(
		row: ReportRow,
		key: keyof ReportRow | "stt",
		index: number,
	): React.ReactNode {
		if (key === "stt") return index + 1;

		const val = row[key as keyof ReportRow];

		if (
			key === "declarationDate" ||
			key === "etaEtd" ||
			key === "tqDate" ||
			key === "kvgsDate"
		) {
			return fmtDate(val as string);
		}
		if (key === "declarationType") {
			return val ? (
				<Badge
					variant="outline"
					className="border-indigo-300 text-indigo-700 bg-indigo-50 font-bold"
				>
					{val as string}
				</Badge>
			) : (
				"—"
			);
		}
		if (
			key === "containerNos" ||
			key === "containerSizes" ||
			key === "containers"
		) {
			return val ? (
				<div className="whitespace-pre-line leading-relaxed">
					{val as string}
				</div>
			) : (
				"—"
			);
		}
		if (key === "batch") {
			const getChannelVariant = (v: string | null | undefined) => {
				if (!v) return "outline";
				const normalized = v.toLowerCase();
				if (normalized.includes("xanh")) return "success";
				if (normalized.includes("vàng")) return "warning";
				if (normalized.includes("đỏ")) return "destructive";
				return "outline";
			};
			return val ? (
				<Badge variant={getChannelVariant(val as string)} className="font-bold">
					{String(val)}
				</Badge>
			) : (
				"—"
			);
		}
		if (key === "grossWeight") return fmtNum(val as number);
		if (key === "totalTaxAmount" || key === "vatTax" || key === "ieTax") {
			return val !== null && val !== undefined ? fmtNum(val as number) : "—";
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
					{val}
				</Badge>
			) : (
				"—"
			);
		}
		if (key === "isFinished") {
			return (
				<Badge
					variant="outline"
					className={
						val
							? "border-green-300 text-green-700 bg-green-50"
							: "border-yellow-300 text-yellow-700 bg-yellow-50"
					}
				>
					{val ? "Hoàn thành" : "Đang xử lý"}
				</Badge>
			);
		}
		if (key === "mvUrl") {
			return val ? (
				<Link
					href={String(val)}
					target="_blank"
					rel="noopener noreferrer"
					className="text-emerald-600 hover:underline text-xs truncate max-w-[140px] inline-block"
					title={String(val)}
				>
					📎 Barcode
				</Link>
			) : (
				"—"
			);
		}
		if (val === null || val === undefined || val === "") return "—";
		return String(val);
	}

	// ─── Render ───────────────────────────────────────────────────────────────
	return (
		<div className="flex flex-col gap-6 p-6 min-h-screen bg-muted/30">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
						<FileText className="size-6 text-primary" />
						Báo cáo Tờ khai Logistics
					</h1>
					<p className="text-sm text-muted-foreground mt-1">
						Xem và tải báo cáo theo từng tờ khai hải quan
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
						disabled={data.length === 0 || isExporting}
						className="gap-2"
						variant="outline"
					>
						{isExporting ? (
							<RefreshCw className="size-4 animate-spin" />
						) : (
							<FileSpreadsheet className="size-4" />
						)}
						{isExporting ? "Đang xuất..." : "Xuất Excel"}
						{data.length > 0 && !isExporting && (
							<Badge variant="secondary" className="ml-1">
								{data.length}
							</Badge>
						)}
					</Button>
				</div>
			</div>

			{/* Filters & Search */}
			{showFilters && (
				<div className="rounded-xl border bg-card shadow-sm p-4 sm:p-5 flex flex-col gap-6">
					{/* Top Search Bar */}
					<div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center w-full">
						<div className="relative flex-1 w-full">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
							<Input
								placeholder="Nhập hoặc dán (paste) nhiều số tờ khai, số job... cách nhau bởi dấu cách hoặc hàng dọc"
								value={filters.search}
								onChange={(e) => setFilter("search", e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && handleSearch()}
								className="pl-9 pr-10 h-10 w-full"
							/>
							{filters.search && (
								<Button
									variant="ghost"
									size="icon"
									className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
									onClick={() => {
										setFilter("search", "");
									}}
								>
									<X className="size-4" />
								</Button>
							)}
						</div>
						<div className="flex flex-shrink-0 items-center gap-2">
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
								{loading ? "Đang tải..." : "Tìm kiếm"}
							</Button>
						</div>
					</div>

					<div className="h-px w-full bg-border" />

					{/* Detailed Filters Grid */}
					<div>
						<h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
							Bộ lọc chi tiết
						</h2>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
							<div className="space-y-1.5 col-span-1 sm:col-span-2 lg:col-span-1">
								<label className="text-xs font-medium text-muted-foreground">
									Thời gian (Ngày TK)
								</label>
								<div className="flex items-center gap-2">
									<Input
										type="date"
										value={filters.dateFrom}
										onChange={(e) => setFilter("dateFrom", e.target.value)}
										className="w-full text-xs px-2"
										title="Từ ngày"
									/>
									<span className="text-muted-foreground text-xs">-</span>
									<Input
										type="date"
										value={filters.dateTo}
										onChange={(e) => setFilter("dateTo", e.target.value)}
										className="w-full text-xs px-2"
										title="Đến ngày"
									/>
								</div>
							</div>
							<div className="space-y-1.5">
								<label className="text-xs font-medium text-muted-foreground">
									Khách hàng / Công ty
								</label>
								<PartnerCombobox
									value={filters.taxCode} // Combobox uses ID/taxCode natively
									onChange={(val) => setFilter("taxCode", val)}
									onPartnerSelect={(partner) => {
										setFilter("taxCode", partner?.id || "");
										setFilter("companyName", partner?.name || "");
									}}
									placeholder="Chọn mã số thuế hoặc tên công ty..."
								/>
							</div>
							<div className="space-y-1.5">
								<label className="text-xs font-medium text-muted-foreground">
									Loại hình
								</label>
								<Input
									placeholder="A10, B13..."
									value={filters.workType}
									onChange={(e) => setFilter("workType", e.target.value)}
								/>
							</div>
							<div className="space-y-1.5">
								<label className="text-xs font-medium text-muted-foreground">
									Xuất/Nhập
								</label>
								<Select
									value={filters.operationType}
									// eslint-disable-next-line @typescript-eslint/no-explicit-any
									onValueChange={(v: any) =>
										setFilter("operationType", v === "ALL" ? "" : String(v))
									}
								>
									<SelectTrigger>
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
							{/* Filter Operations */}
							<div className="col-span-1 sm:col-span-2 lg:col-span-1 flex items-end justify-end gap-2">
								<Button
									onClick={() => handleSearch()}
									disabled={loading}
									className="gap-2 shadow-sm"
									variant="default"
								>
									{loading ? (
										<RefreshCw className="size-4 animate-spin" />
									) : (
										<Search className="size-4" />
									)}
									{loading ? "Đang tải..." : "Lọc"}
								</Button>
								<Button
									onClick={handleReset}
									disabled={loading}
									className="px-3 bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
									title="Xóa bộ lọc"
								>
									Đặt lại
								</Button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Table */}
			{searched && (
				<div className="rounded-xl border bg-card shadow-sm overflow-hidden">
					{/* Table toolbar: count only */}
					<div className="px-4 py-2.5 border-b bg-muted/30 flex items-center gap-3">
						<span className="text-xs text-muted-foreground">
							<span className="font-semibold text-primary">{data.length}</span>{" "}
							tờ khai
							{filters.search && (
								<span className="text-muted-foreground/70">
									{" "}
									— đang lọc theo “{filters.search}”
								</span>
							)}
						</span>
						{data.length >= 20000 && (
							<span className="text-xs text-amber-600">
								⚠ Tối đa 20.000 dòng
							</span>
						)}
					</div>
					{data.length === 0 ? (
						<div className="py-16 text-center text-muted-foreground">
							<FileText className="size-10 mx-auto mb-3 opacity-30" />
							<p className="text-sm">Không tìm thấy tờ khai nào</p>
						</div>
					) : (
						<div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
							<Table>
								<TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
									<TableRow>
										{columns.map((col) => (
											<TableHead
												key={col.key}
												className="whitespace-nowrap text-xs font-semibold py-2 px-3"
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
											key={row.declarationId}
											className="hover:bg-muted/40 transition-colors"
										>
											{columns.map((col) => (
												<TableCell
													key={col.key}
													className="py-2 px-3 text-xs whitespace-nowrap"
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
					{/* Pagination Controls */}
					{data.length > 0 && (
						<div className="px-4 py-3 border-t bg-muted/10 flex items-center justify-between">
							<span className="text-xs text-muted-foreground hidden sm:block">
								Hiển thị dòng {(page - 1) * PAGE_SIZE + 1} đến{" "}
								{Math.min(page * PAGE_SIZE, data.length)} / {data.length}
							</span>
							<div className="flex items-center gap-1 mx-auto sm:ml-auto sm:mr-0">
								<Button
									variant="outline"
									size="icon"
									className="h-8 w-8"
									disabled={page === 1}
									onClick={() => setPage((p) => p - 1)}
								>
									<ChevronLeft className="size-4" />
								</Button>
								<span className="text-xs font-medium px-2">
									Trang {page} / {totalPages}
								</span>
								<Button
									variant="outline"
									size="icon"
									className="h-8 w-8"
									disabled={page === totalPages || totalPages === 0}
									onClick={() => setPage((p) => p + 1)}
								>
									<ChevronRight className="size-4" />
								</Button>
							</div>
						</div>
					)}
				</div>
			)}

			{!searched && (
				<div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
					<FileText className="size-16 opacity-20 mb-4" />
					<p className="text-base font-medium">Chưa có dữ liệu</p>
					<p className="text-sm">
						Chọn bộ lọc và nhấn "Tìm kiếm" để xem báo cáo
					</p>
				</div>
			)}
		</div>
	);
}
