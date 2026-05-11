"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import {
	BuildingIcon,
	CalendarIcon,
	CheckCircle2Icon,
	ChevronDownIcon,
	ChevronRightIcon,
	ClockIcon,
	DollarSignIcon,
	FileSpreadsheetIcon,
	FilterIcon,
	ReceiptIcon,
	RefreshCwIcon,
	SearchIcon,
	UsersIcon,
	XCircleIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

type VendorCostStatus = "PENDING" | "APPROVED" | "REJECTED";

interface CostRow {
	id: string;
	feeName: string;
	isDisbursement: boolean;
	vatPercent: number | null;
	totalVat: number | null;
	totalFee: number | null;
	sellerTaxCode: string | null;
	invoiceNumber: string | null;
	invoiceLink: string | null;
	trackingCode: string | null;
	note: string | null;
	status: VendorCostStatus;
	reviewedAt: string | null;
	createdAt: string;
	vendor: { name: string } | null;
	feeType: { name: string } | null;
	reviewer: { name: string | null; email: string } | null;
	fcr: {
		id: string;
		fcrNumber: string | null;
		implementationDate: string | null;
		plateNumber: string | null;
		vendor: string | null;
		truckingFollowUpId: string;
		truckingFollowUp: {
			id: string;
			jobNumber: string | null;
			requestNumber: string | null;
			companyName: string | null;
			taxCode: string | null;
			invoiceTaxCode: string | null;
			serviceMode: string | null;
			operationType: string | null;
			billOrBooking: string | null;
		} | null;
	};
}

interface GrandTotal {
	totalFee: number;
	totalVat: number;
	totalAmount: number;
	approvedAmount: number;
	pendingAmount: number;
	count: number;
}

interface ReportResponse {
	costs: CostRow[];
	grandTotal: GrandTotal;
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined) =>
	(n ?? 0).toLocaleString("vi-VN", { minimumFractionDigits: 0 });

const fmtDate = (d: string | null | undefined) => {
	if (!d) return "—";
	try {
		return format(new Date(d), "dd/MM/yyyy", { locale: vi });
	} catch {
		return "—";
	}
};

// ─── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: VendorCostStatus }) {
	if (status === "APPROVED")
		return (
			<Badge className="bg-emerald-100 text-emerald-700 border-0 gap-1 text-[10px] font-semibold">
				<CheckCircle2Icon className="w-3 h-3" /> Duyệt
			</Badge>
		);
	if (status === "REJECTED")
		return (
			<Badge className="bg-red-100 text-red-700 border-0 gap-1 text-[10px] font-semibold">
				<XCircleIcon className="w-3 h-3" /> Từ chối
			</Badge>
		);
	return (
		<Badge className="bg-amber-100 text-amber-700 border-0 gap-1 text-[10px] font-semibold">
			<ClockIcon className="w-3 h-3" /> Chờ duyệt
		</Badge>
	);
}

// ─── Summary KPI Card ──────────────────────────────────────────────────────────

function KpiCard({
	label,
	value,
	sub,
	accent,
	icon: Icon,
}: {
	label: string;
	value: string;
	sub?: string;
	accent: string;
	icon: React.ElementType;
}) {
	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-2xl border border-white/60 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm shadow-sm p-5 flex flex-col gap-2 transition-all hover:shadow-md",
			)}
		>
			<div
				className={cn(
					"w-9 h-9 rounded-xl flex items-center justify-center",
					accent,
				)}
			>
				<Icon className="w-5 h-5 text-white" />
			</div>
			<div className="flex flex-col gap-0.5">
				<span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
					{label}
				</span>
				<span className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
					{value}
				</span>
				{sub && <span className="text-[11px] text-slate-400">{sub}</span>}
			</div>
			<div
				className={cn(
					"absolute -bottom-4 -right-4 w-20 h-20 rounded-full opacity-10",
					accent,
				)}
			/>
		</div>
	);
}

// ─── Group row (collapsed / expanded) ─────────────────────────────────────────

interface GroupedData {
	key: string; // truckingFollowUpId
	jobNumber: string | null;
	requestNumber: string | null;
	companyName: string | null;
	taxCode: string | null;
	invoiceTaxCode: string | null;
	serviceMode: string | null;
	costs: CostRow[];
	totalFee: number;
	totalVat: number;
	approvedFee: number;
	pendingFee: number;
	minDate: string | null;
	maxDate: string | null;
	isVVMV: boolean; // true if any cost has vatPercent 8 | 5 | null
}

function GroupRow({
	group,
	viewMode: _viewMode,
}: {
	group: GroupedData;
	viewMode: "detail" | "summary";
}) {
	const [open, setOpen] = useState(false);
	const { isVVMV } = group;

	return (
		<>
			{/* Group header row */}
			<tr
				className="group border-b border-slate-100 dark:border-slate-800 hover:bg-blue-50/40 dark:hover:bg-blue-900/10 cursor-pointer transition-colors"
				onClick={() => setOpen((p) => !p)}
			>
				{/* Expand icon */}
				<td className="py-2.5 pl-4 pr-2 w-8">
					{open ? (
						<ChevronDownIcon className="w-4 h-4 text-slate-400" />
					) : (
						<ChevronRightIcon className="w-4 h-4 text-slate-400" />
					)}
				</td>
				{/* Job / Request */}
				<td className="py-2.5 pr-3 font-semibold text-blue-700 dark:text-blue-400 text-xs whitespace-nowrap">
					{group.jobNumber || group.requestNumber || "—"}
				</td>
				{/* Company */}
				<td className="py-2.5 pr-3 text-xs text-slate-700 dark:text-slate-200 max-w-[160px] truncate">
					{group.companyName || "—"}
				</td>
				{/* Tax code (seller) */}
				<td className="py-2.5 pr-3 text-xs text-slate-500 whitespace-nowrap">
					{group.taxCode || "—"}
				</td>
				{/* Invoice type badge */}
				<td className="py-2.5 pr-3">
					{isVVMV ? (
						<Badge className="bg-violet-100 text-violet-700 border-0 text-[10px] font-semibold shrink-0">
							Hóa đơn VVMV
						</Badge>
					) : (
						<Badge className="bg-sky-100 text-sky-700 border-0 text-[10px] font-semibold shrink-0">
							Hóa đơn KH
						</Badge>
					)}
				</td>
				{/* Invoice tax code */}
				<td className="py-2.5 pr-3 text-xs text-slate-500 whitespace-nowrap">
					{group.invoiceTaxCode || "—"}
				</td>
				{/* Service mode */}
				<td className="py-2.5 pr-3 text-xs text-slate-500 whitespace-nowrap">
					{group.serviceMode || "—"}
				</td>
				{/* Date range */}
				<td className="py-2.5 pr-3 text-xs text-slate-400 whitespace-nowrap">
					{group.minDate && group.maxDate && group.minDate !== group.maxDate
						? `${fmtDate(group.minDate)} – ${fmtDate(group.maxDate)}`
						: fmtDate(group.minDate)}
				</td>
				{/* Count */}
				<td className="py-2.5 pr-3 text-xs text-center text-slate-400 tabular-nums">
					{group.costs.length}
				</td>
				{/* Total fee */}
				<td className="py-2.5 pr-3 text-xs text-right font-semibold text-slate-800 dark:text-slate-100 tabular-nums whitespace-nowrap">
					{fmt(group.totalFee)}
				</td>
				{/* Approved */}
				<td className="py-2.5 pr-3 text-xs text-right text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">
					{fmt(group.approvedFee)}
				</td>
				{/* Pending */}
				<td className="py-2.5 pr-4 text-xs text-right text-amber-600 dark:text-amber-400 tabular-nums whitespace-nowrap">
					{fmt(group.pendingFee)}
				</td>
			</tr>

			{/* Detail rows */}
			{open &&
				group.costs.map((cost, idx) => (
					<tr
						key={cost.id}
						className={cn(
							"border-b border-slate-50 dark:border-slate-800/50 transition-colors",
							idx % 2 === 0
								? "bg-slate-50/60 dark:bg-slate-800/20"
								: "bg-white/60 dark:bg-slate-900/20",
							"hover:bg-blue-50/20 dark:hover:bg-blue-900/5",
						)}
					>
						{/* Indent */}
						<td className="py-2 pl-10 pr-2 w-8" />
						{/* FCR number */}
						<td className="py-2 pr-3 text-[11px] text-slate-500 whitespace-nowrap">
							{cost.fcr.fcrNumber || "—"}
							{cost.fcr.implementationDate && (
								<div className="text-[10px] text-slate-400">
									{fmtDate(cost.fcr.implementationDate)}
								</div>
							)}
						</td>
						{/* Fee name */}
						<td
							className="py-2 pr-3 text-[11px] text-slate-700 dark:text-slate-300 font-medium"
							colSpan={2}
						>
							{cost.feeName}
							{cost.note && (
								<div className="text-[10px] text-slate-400 truncate max-w-[200px]">
									{cost.note}
								</div>
							)}
						</td>
						{/* Vendor */}
						<td className="py-2 pr-3 text-[11px] text-slate-500">
							{cost.vendor?.name || cost.fcr.vendor || "—"}
						</td>
						{/* Invoice number */}
						<td className="py-2 pr-3 text-[11px] text-slate-500 whitespace-nowrap">
							{cost.invoiceNumber || "—"}
							{cost.sellerTaxCode && (
								<div className="text-[10px] text-slate-400">
									MST: {cost.sellerTaxCode}
								</div>
							)}
						</td>
						{/* Plate / tracking */}
						<td className="py-2 pr-3 text-[11px] text-slate-400 whitespace-nowrap">
							{cost.fcr.plateNumber || cost.trackingCode || "—"}
						</td>
						{/* Date of cost creation */}
						<td className="py-2 pr-3 text-[11px] text-slate-400 whitespace-nowrap">
							{fmtDate(cost.createdAt)}
						</td>
						{/* Status */}
						<td className="py-2 pr-3 text-center">
							<StatusBadge status={cost.status} />
						</td>
						{/* Total fee */}
						<td className="py-2 pr-3 text-right text-[11px] font-semibold text-slate-800 dark:text-slate-100 tabular-nums whitespace-nowrap">
							{fmt(cost.totalFee)}
						</td>
						{/* VAT */}
						<td className="py-2 pr-3 text-right text-[11px] text-slate-400 tabular-nums whitespace-nowrap">
							{cost.vatPercent != null ? `${cost.vatPercent}%` : "—"}
						</td>
						{/* Detail: reviewer */}
						<td className="py-2 pr-4 text-[11px] text-slate-400 whitespace-nowrap">
							{cost.reviewer?.name || "—"}
						</td>
					</tr>
				))}
		</>
	);
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function DisbursementReportPage() {
	const [from, setFrom] = useState("");
	const [to, setTo] = useState("");
	const [approvalStatus, setApprovalStatus] = useState("ALL");
	const [clientType, setClientType] = useState("ALL");
	const [clientSearch, setClientSearch] = useState("");
	const [appliedFrom, setAppliedFrom] = useState("");
	const [appliedTo, setAppliedTo] = useState("");
	const [appliedClientSearch, setAppliedClientSearch] = useState("");
	const [viewMode] = useState<"detail" | "summary">("detail");

	// Set date defaults after mount (avoids SSR/client hydration mismatch from timezone differences)
	useEffect(() => {
		const now = new Date();
		const defaultTo = format(now, "yyyy-MM-dd");
		const defaultFrom = format(
			new Date(now.getFullYear(), now.getMonth(), 1),
			"yyyy-MM-dd",
		);

		setTo(defaultTo);
		setFrom(defaultFrom);
		setAppliedTo(defaultTo);
		setAppliedFrom(defaultFrom);
	}, []);

	const applyPendingFilters = useCallback(() => {
		setAppliedFrom(from);
		setAppliedTo(to);
		setAppliedClientSearch(clientSearch);
	}, [clientSearch, from, to]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			applyPendingFilters();
		}, 400);

		return () => window.clearTimeout(timer);
	}, [applyPendingFilters]);

	const hasPendingFilters =
		from !== appliedFrom ||
		to !== appliedTo ||
		clientSearch !== appliedClientSearch;

	// fetch
	const queryKey = [
		"disbursement-report",
		appliedFrom,
		appliedTo,
		approvalStatus,
		clientType,
		appliedClientSearch,
	];

	const { data, isLoading, isFetching, refetch } = useQuery<ReportResponse>({
		queryKey,
		queryFn: async () => {
			const params = new URLSearchParams();
			if (appliedFrom) params.set("from", appliedFrom);
			if (appliedTo) params.set("to", appliedTo);
			params.set("approvalStatus", approvalStatus);
			params.set("clientType", clientType);
			if (appliedClientSearch) params.set("clientSearch", appliedClientSearch);
			const res = await fetch(`/api/accounting/disbursement-report?${params}`);
			if (!res.ok) throw new Error("Failed to fetch report");
			return res.json();
		},
		staleTime: 30_000,
	});

	const handleRefresh = useCallback(() => {
		if (hasPendingFilters) {
			applyPendingFilters();
			return;
		}

		void refetch();
	}, [applyPendingFilters, hasPendingFilters, refetch]);

	// Helper: determine if a single cost is VVMV (vatPercent 8 or 5)
	const costIsVVMV = (c: CostRow) => c.vatPercent === 8 || c.vatPercent === 5;

	// Group costs by (truckingFollowUpId + isVVMV) so mixed-VAT jobs
	// appear in BOTH sections with only their relevant costs — same as Excel
	const grouped = useMemo<GroupedData[]>(() => {
		if (!data?.costs) return [];
		const map = new Map<string, GroupedData>();
		for (const cost of data.costs) {
			const jobId = cost.fcr.truckingFollowUpId;
			const vvmv = costIsVVMV(cost);
			const key = `${jobId}_${vvmv ? "vvmv" : "kh"}`;
			if (!map.has(key)) {
				map.set(key, {
					key,
					jobNumber: cost.fcr.truckingFollowUp?.jobNumber ?? null,
					requestNumber: cost.fcr.truckingFollowUp?.requestNumber ?? null,
					companyName: cost.fcr.truckingFollowUp?.companyName ?? null,
					taxCode: cost.fcr.truckingFollowUp?.taxCode ?? null,
					invoiceTaxCode: cost.fcr.truckingFollowUp?.invoiceTaxCode ?? null,
					serviceMode: cost.fcr.truckingFollowUp?.serviceMode ?? null,
					costs: [],
					totalFee: 0,
					totalVat: 0,
					approvedFee: 0,
					pendingFee: 0,
					minDate: null,
					maxDate: null,
					isVVMV: vvmv,
				});
			}
			const g = map.get(key)!;
			g.costs.push(cost);
			const fee = cost.totalFee ?? 0;
			const vat = cost.totalVat ?? 0;
			g.totalFee += fee;
			g.totalVat += vat;
			if (cost.status === "APPROVED") g.approvedFee += fee;
			else if (cost.status === "PENDING") g.pendingFee += fee;
			if (cost.fcr.implementationDate) {
				if (!g.minDate || cost.fcr.implementationDate < g.minDate)
					g.minDate = cost.fcr.implementationDate;
				if (!g.maxDate || cost.fcr.implementationDate > g.maxDate)
					g.maxDate = cost.fcr.implementationDate;
			}
		}
		return Array.from(map.values());
	}, [data?.costs, costIsVVMV]);

	// Split by VAT-based invoice type
	const vvmvGroups = grouped.filter((g) => g.isVVMV);
	const clientGroups = grouped.filter((g) => !g.isVVMV);

	const gt = data?.grandTotal;

	// ── Excel export with ExcelJS ──────────────────────────────────────────────
	const [isExporting, setIsExporting] = useState(false);

	const handleExportExcel = useCallback(async () => {
		if (!data?.costs?.length) return;
		setIsExporting(true);
		try {
			const ExcelJS = await import("exceljs");
			const wb = new ExcelJS.Workbook();
			wb.creator = "VVMV Kế toán";
			wb.created = new Date();

			const HEADERS = [
				"Job / Request",
				"Công ty",
				"MST KH",
				"Loại HĐ",
				"MST Invoice",
				"Service",
				"FCR",
				"Ngày TH",
				"Tên phí",
				"Vendor",
				"Số HĐ",
				"MST bên bán",
				"Số tiền (₫)",
				"VAT%",
				"Tổng VAT (₫)",
				"Trạng thái",
				"Người duyệt",
				"Ngày duyệt",
				"Ghi chú",
			];

			const MONEY_COLS = [13, 15]; // 1-based: Số tiền, Tổng VAT

			const buildRows = (costs: CostRow[]) => {
				// Sort: same job together → then by FCR date → then by rowOrder
				const sorted = [...costs].sort((a, b) => {
					const jobA =
						a.fcr.truckingFollowUp?.jobNumber ||
						a.fcr.truckingFollowUp?.requestNumber ||
						"";
					const jobB =
						b.fcr.truckingFollowUp?.jobNumber ||
						b.fcr.truckingFollowUp?.requestNumber ||
						"";
					if (jobA !== jobB) return jobA.localeCompare(jobB);
					const dateA = a.fcr.implementationDate ?? "";
					const dateB = b.fcr.implementationDate ?? "";
					if (dateA !== dateB) return dateA < dateB ? -1 : 1;
					return 0;
				});
				return sorted.map((c) => {
					const tfup = c.fcr.truckingFollowUp;
					const isVVMV = c.vatPercent === 8 || c.vatPercent === 5;
					const statusLabel =
						c.status === "APPROVED"
							? "Đã duyệt"
							: c.status === "REJECTED"
								? "Từ chối"
								: "Chờ duyệt";
					return [
						tfup?.jobNumber || tfup?.requestNumber || "",
						tfup?.companyName || "",
						tfup?.taxCode || "",
						isVVMV ? "HĐ VVMV" : "HĐ KH",
						tfup?.invoiceTaxCode || "",
						tfup?.serviceMode || "",
						c.fcr.fcrNumber || "",
						c.fcr.implementationDate ? new Date(c.fcr.implementationDate) : "",
						c.feeName,
						c.vendor?.name || c.fcr.vendor || "",
						c.invoiceNumber || "",
						c.sellerTaxCode || "",
						c.totalFee ?? null,
						c.vatPercent ?? null,
						c.totalVat ?? null,
						statusLabel,
						c.reviewer?.name || "",
						c.reviewedAt ? new Date(c.reviewedAt) : "",
						c.note || "",
					];
				});
			};

			const applySheet = (
				ws: import("exceljs").Worksheet,
				rows: unknown[][],
			) => {
				// Header row
				const hRow = ws.addRow(HEADERS);
				hRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
				hRow.fill = {
					type: "pattern",
					pattern: "solid",
					fgColor: { argb: "FF3B5BDB" },
				};
				hRow.height = 18;
				hRow.alignment = { vertical: "middle" };

				// Data rows
				for (const r of rows) {
					const dRow = ws.addRow(r);
					dRow.font = { size: 9 };
					dRow.height = 15;

					// Date column formatting
					const dateCell = dRow.getCell(8); // Ngày TH
					if (dateCell.value instanceof Date) {
						dateCell.numFmt = "dd/mm/yyyy";
					}
					const reviewDateCell = dRow.getCell(18); // Ngày duyệt
					if (reviewDateCell.value instanceof Date) {
						reviewDateCell.numFmt = "dd/mm/yyyy";
					}
				}

				// Number format for money columns
				for (const colIdx of MONEY_COLS) {
					for (let rowNum = 2; rowNum <= rows.length + 1; rowNum++) {
						ws.getCell(rowNum, colIdx).numFmt = "#,##0";
					}
				}

				// Freeze header
				ws.views = [{ state: "frozen", ySplit: 1 }];

				// Auto column widths
				ws.columns = HEADERS.map((h, i) => {
					const maxCellLen = rows.reduce((mx, row) => {
						const val = row[i];
						const s = val instanceof Date ? "dd/mm/yyyy" : String(val ?? "");
						return Math.max(mx, s.length);
					}, h.length);
					return { width: Math.min(Math.max(maxCellLen + 2, 10), 55) };
				});

				// Alternating row colors
				for (let rowNum = 2; rowNum <= rows.length + 1; rowNum++) {
					const row = ws.getRow(rowNum);
					if (rowNum % 2 === 0) {
						row.eachCell({ includeEmpty: true }, (cell) => {
							cell.fill = {
								type: "pattern",
								pattern: "solid",
								fgColor: { argb: "FFF8F9FA" },
							};
						});
					}
				}
			};

			// Sheet 1: HĐ VVMV (vatPercent = 8 | 5)
			const vvmvCosts = data?.costs.filter(
				(c) => c.vatPercent === 8 || c.vatPercent === 5,
			);
			const wsVVMV = wb.addWorksheet("HĐ VVMV");
			applySheet(wsVVMV, buildRows(vvmvCosts));

			// Sheet 2: HĐ Khách hàng (vatPercent not 8 or 5)
			const khCosts = data?.costs.filter(
				(c) => c.vatPercent !== 8 && c.vatPercent !== 5,
			);
			const wsKH = wb.addWorksheet("HĐ Khách hàng");
			applySheet(wsKH, buildRows(khCosts));

			// Sheet 3: Tổng hợp
			const wsSummary = wb.addWorksheet("Tổng hợp");
			const summaryHeaders = [
				"Nhóm",
				"Job / Request",
				"Công ty",
				"MST KH",
				"Service",
				"Tổng phí (₫)",
				"Đã duyệt (₫)",
				"Chờ duyệt (₫)",
			];
			const shRow = wsSummary.addRow(summaryHeaders);
			shRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
			shRow.fill = {
				type: "pattern",
				pattern: "solid",
				fgColor: { argb: "FF6741D9" },
			};
			shRow.height = 18;

			for (const g of grouped) {
				const isVVMV = g.isVVMV;
				wsSummary.addRow([
					isVVMV ? "HĐ VVMV" : "HĐ Khách hàng",
					g.jobNumber || g.requestNumber || "",
					g.companyName || "",
					g.taxCode || "",
					g.serviceMode || "",
					g.totalFee,
					g.approvedFee,
					g.pendingFee,
				]);
			}
			// Grand total row
			const gTotalRow = wsSummary.addRow([
				"TỔNG CỘNG",
				"",
				"",
				"",
				"",
				data?.grandTotal.totalFee,
				data?.grandTotal.approvedAmount,
				data?.grandTotal.pendingAmount,
			]);
			gTotalRow.font = { bold: true, size: 10 };
			gTotalRow.fill = {
				type: "pattern",
				pattern: "solid",
				fgColor: { argb: "FFFFF9DB" },
			};
			// Number format for summary money columns
			for (let c = 6; c <= 8; c++) {
				for (let rowNum = 2; rowNum <= grouped.length + 2; rowNum++) {
					wsSummary.getCell(rowNum, c).numFmt = "#,##0";
				}
			}
			wsSummary.views = [{ state: "frozen", ySplit: 1 }];
			wsSummary.columns = summaryHeaders.map((h) => ({
				width: Math.max(h.length + 4, 16),
			}));

			// Write and download
			const buffer = await wb.xlsx.writeBuffer();
			const blob = new Blob([buffer as ArrayBuffer], {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `BaoCaoChiHo_${appliedFrom}_${appliedTo}.xlsx`;
			a.click();
			URL.revokeObjectURL(url);
		} catch (err) {
			console.error("Export Excel error:", err);
		} finally {
			setIsExporting(false);
		}
	}, [appliedFrom, appliedTo, data, grouped]);

	// ─── Render ─────────────────────────────────────────────────────────────────

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-slate-950 dark:via-blue-950/20 dark:to-indigo-950/10 p-4 md:p-6">
			{/* Page header */}
			<div className="mb-6">
				<div className="flex items-center gap-3 mb-1">
					<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg">
						<ReceiptIcon className="w-5 h-5 text-white" />
					</div>
					<div>
						<h1 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
							Báo Cáo Chi Hộ
						</h1>
						<p className="text-xs text-slate-400 font-medium">
							Kế toán · Thanh toán chi hộ từ VendorCost
						</p>
					</div>
				</div>
			</div>

			{/* ─── Filter Bar ──────────────────────────────────────────────────────── */}
			<div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-2xl border border-white/60 dark:border-slate-700/50 shadow-sm p-4 mb-5">
				<div className="flex items-center gap-2 mb-3">
					<FilterIcon className="w-4 h-4 text-slate-400" />
					<span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
						Bộ lọc
					</span>
				</div>
				<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
					{/* From */}
					<div className="flex flex-col gap-1">
						<label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
							Từ ngày (FCR)
						</label>
						<div className="relative">
							<CalendarIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
							<Input
								type="date"
								value={from}
								onChange={(e) => setFrom(e.target.value)}
								onBlur={applyPendingFilters}
								className="pl-8 h-9 text-xs"
							/>
						</div>
					</div>

					{/* To */}
					<div className="flex flex-col gap-1">
						<label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
							Đến ngày (FCR)
						</label>
						<div className="relative">
							<CalendarIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
							<Input
								type="date"
								value={to}
								onChange={(e) => setTo(e.target.value)}
								onBlur={applyPendingFilters}
								className="pl-8 h-9 text-xs"
							/>
						</div>
					</div>

					{/* Approval status */}
					<div className="flex flex-col gap-1">
						<label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
							Trạng thái duyệt
						</label>
						<Select
							value={approvalStatus}
							onValueChange={(v) => {
								setApprovalStatus(v as string);
								applyPendingFilters();
							}}
						>
							<SelectTrigger className="h-9 text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectPositioner>
								<SelectContent>
									<SelectItem value="ALL">Tất cả</SelectItem>
									<SelectItem value="APPROVED">Đã duyệt</SelectItem>
									<SelectItem value="PENDING">Chờ duyệt</SelectItem>
								</SelectContent>
							</SelectPositioner>
						</Select>
					</div>

					{/* Client type */}
					<div className="flex flex-col gap-1">
						<label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
							Loại hóa đơn
						</label>
						<Select
							value={clientType}
							onValueChange={(v) => {
								setClientType(v as string);
								applyPendingFilters();
							}}
						>
							<SelectTrigger className="h-9 text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectPositioner>
								<SelectContent>
									<SelectItem value="ALL">Tất cả</SelectItem>
									<SelectItem value="VVMV">HĐ viết về VVMV (có MST)</SelectItem>
									<SelectItem value="CLIENT">HĐ viết về khách hàng</SelectItem>
								</SelectContent>
							</SelectPositioner>
						</Select>
					</div>

					{/* Client search */}
					<div className="flex flex-col gap-1">
						<label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
							Tìm khách / Job
						</label>
						<div className="relative">
							<SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
							<Input
								placeholder="Công ty, MST, Job số..."
								value={clientSearch}
								onChange={(e) => setClientSearch(e.target.value)}
								onBlur={applyPendingFilters}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										applyPendingFilters();
									}
								}}
								className="pl-8 h-9 text-xs"
							/>
						</div>
					</div>
				</div>

				{/* Action buttons */}
				<div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
					<Button
						variant="outline"
						size="sm"
						onClick={handleRefresh}
						disabled={isFetching}
						className="h-8 text-xs gap-1.5"
					>
						<RefreshCwIcon
							className={cn("w-3.5 h-3.5", isFetching && "animate-spin")}
						/>
						{hasPendingFilters ? "Áp dụng lọc" : "Làm mới"}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={handleExportExcel}
						disabled={!data?.costs?.length || isExporting}
						className="h-8 text-xs gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400"
					>
						<FileSpreadsheetIcon
							className={cn("w-3.5 h-3.5", isExporting && "animate-spin")}
						/>
						{isExporting ? "Đang xuất..." : "Xuất Excel"}
					</Button>
					<div className="ml-auto flex items-center gap-2 text-[11px] text-slate-400">
						{data && (
							<>
								<span>{gt?.count ?? 0} dòng chi hộ</span>
								<span>·</span>
								<span>{grouped.length} lô/job</span>
							</>
						)}
					</div>
				</div>
			</div>

			{/* ─── KPI Cards ───────────────────────────────────────────────────────── */}
			{isLoading ? (
				<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
					{[...Array(4)].map((_, i) => (
						<Skeleton key={i} className="h-28 rounded-2xl" />
					))}
				</div>
			) : gt ? (
				<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
					<KpiCard
						label="Tổng chi hộ"
						value={`${fmt(gt.totalFee)} ₫`}
						sub={`${gt.count} khoản`}
						accent="bg-blue-500"
						icon={DollarSignIcon}
					/>
					<KpiCard
						label="Đã duyệt"
						value={`${fmt(gt.approvedAmount)} ₫`}
						accent="bg-emerald-500"
						icon={CheckCircle2Icon}
					/>
					<KpiCard
						label="Chờ duyệt"
						value={`${fmt(gt.pendingAmount)} ₫`}
						accent="bg-amber-500"
						icon={ClockIcon}
					/>
					<KpiCard
						label="HĐ VVMV / KH"
						value={`${vvmvGroups.length} / ${clientGroups.length}`}
						sub="lô có hóa đơn VVMV / khách hàng"
						accent="bg-violet-500"
						icon={BuildingIcon}
					/>
				</div>
			) : null}

			{/* ─── Section: HĐ VVMV ─────────────────────────────────────────────── */}
			<ReportSection
				title="Hóa Đơn Viết Về VVMV"
				subtitle="(invoiceTaxCode có MST)"
				groups={clientType === "CLIENT" ? [] : vvmvGroups}
				accentColor="violet"
				icon={BuildingIcon}
				isLoading={isLoading}
				viewMode={viewMode}
				hidden={clientType === "CLIENT"}
			/>

			{/* ─── Section: HĐ Khách Hàng ──────────────────────────────────────── */}
			<ReportSection
				title="Hóa Đơn Viết Về Khách Hàng"
				subtitle="(invoiceTaxCode trống hoặc 0)"
				groups={clientType === "VVMV" ? [] : clientGroups}
				accentColor="sky"
				icon={UsersIcon}
				isLoading={isLoading}
				viewMode={viewMode}
				hidden={clientType === "VVMV"}
			/>
		</div>
	);
}

// ─── Section component ────────────────────────────────────────────────────────

function ReportSection({
	title,
	subtitle,
	groups,
	accentColor,
	icon: Icon,
	isLoading,
	viewMode,
	hidden,
}: {
	title: string;
	subtitle: string;
	groups: GroupedData[];
	accentColor: "violet" | "sky";
	icon: React.ElementType;
	isLoading: boolean;
	viewMode: "detail" | "summary";
	hidden?: boolean;
}) {
	const [open, setOpen] = useState(true);

	const sectionTotal = groups.reduce((a, g) => a + g.totalFee, 0);
	const sectionApproved = groups.reduce((a, g) => a + g.approvedFee, 0);
	const sectionPending = groups.reduce((a, g) => a + g.pendingFee, 0);

	const accentClasses = {
		violet: {
			header:
				"from-violet-50 to-purple-50/50 dark:from-violet-950/20 dark:to-purple-950/10",
			icon: "bg-violet-600",
			border: "border-violet-100 dark:border-violet-800/30",
			title: "text-violet-800 dark:text-violet-300",
		},
		sky: {
			header:
				"from-sky-50 to-blue-50/50 dark:from-sky-950/20 dark:to-blue-950/10",
			icon: "bg-sky-600",
			border: "border-sky-100 dark:border-sky-800/30",
			title: "text-sky-800 dark:text-sky-300",
		},
	}[accentColor];

	if (hidden) return null;

	return (
		<div
			className={cn(
				"rounded-2xl border shadow-sm mb-4 overflow-hidden",
				accentClasses.border,
				"bg-white/80 dark:bg-slate-800/60 backdrop-blur-sm",
			)}
		>
			{/* Section header */}
			<button
				className={cn(
					"w-full flex items-center gap-3 px-5 py-3 bg-gradient-to-r text-left",
					accentClasses.header,
				)}
				onClick={() => setOpen((p) => !p)}
			>
				<div
					className={cn(
						"w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
						accentClasses.icon,
					)}
				>
					<Icon className="w-4 h-4 text-white" />
				</div>
				<div className="flex-1 min-w-0">
					<div className={cn("font-bold text-sm", accentClasses.title)}>
						{title}
					</div>
					<div className="text-[11px] text-slate-400">{subtitle}</div>
				</div>
				<div className="flex items-center gap-4 text-right shrink-0">
					<div>
						<div className="text-[10px] text-slate-400 uppercase tracking-wide">
							Tổng
						</div>
						<div className="text-sm font-bold text-slate-800 dark:text-white tabular-nums">
							{fmt(sectionTotal)} ₫
						</div>
					</div>
					<div>
						<div className="text-[10px] text-emerald-500 uppercase tracking-wide">
							Duyệt
						</div>
						<div className="text-sm font-semibold text-emerald-600 tabular-nums">
							{fmt(sectionApproved)} ₫
						</div>
					</div>
					<div>
						<div className="text-[10px] text-amber-500 uppercase tracking-wide">
							Chờ
						</div>
						<div className="text-sm font-semibold text-amber-600 tabular-nums">
							{fmt(sectionPending)} ₫
						</div>
					</div>
					<div className="text-[11px] text-slate-400 w-14 text-center">
						{groups.length} lô
					</div>
					{open ? (
						<ChevronDownIcon className="w-4 h-4 text-slate-400" />
					) : (
						<ChevronRightIcon className="w-4 h-4 text-slate-400" />
					)}
				</div>
			</button>

			{/* Table */}
			{open && (
				<div className="overflow-x-auto">
					{isLoading ? (
						<div className="p-6 space-y-2">
							{[...Array(4)].map((_, i) => (
								<Skeleton key={i} className="h-10 w-full rounded-lg" />
							))}
						</div>
					) : groups.length === 0 ? (
						<div className="py-10 flex flex-col items-center text-slate-400 gap-2">
							<ReceiptIcon className="w-8 h-8 opacity-30" />
							<span className="text-sm">
								Không có dữ liệu trong khoảng thời gian này
							</span>
						</div>
					) : (
						<table className="w-full text-xs">
							<thead>
								<tr className="border-b-2 border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40">
									<th className="py-2 pl-4 pr-2 w-8" />
									<th className="py-2 pr-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[10px] whitespace-nowrap">
										Job / Request
									</th>
									<th className="py-2 pr-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[10px]">
										Công ty
									</th>
									<th className="py-2 pr-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[10px] whitespace-nowrap">
										MST KH
									</th>
									<th className="py-2 pr-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[10px] whitespace-nowrap">
										Loại HĐ
									</th>
									<th className="py-2 pr-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[10px] whitespace-nowrap">
										MST Invoice
									</th>
									<th className="py-2 pr-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[10px] whitespace-nowrap">
										Service
									</th>
									<th className="py-2 pr-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[10px] whitespace-nowrap">
										Ngày FCR
									</th>
									<th className="py-2 pr-3 text-center font-semibold text-slate-500 uppercase tracking-wide text-[10px]">
										SL
									</th>
									<th className="py-2 pr-3 text-right font-semibold text-slate-500 uppercase tracking-wide text-[10px] whitespace-nowrap">
										Tổng (₫)
									</th>
									<th className="py-2 pr-3 text-right font-semibold text-emerald-500 uppercase tracking-wide text-[10px] whitespace-nowrap">
										Đã duyệt (₫)
									</th>
									<th className="py-2 pr-4 text-right font-semibold text-amber-500 uppercase tracking-wide text-[10px] whitespace-nowrap">
										Chờ duyệt (₫)
									</th>
								</tr>
							</thead>
							<tbody>
								{groups.map((g) => (
									<GroupRow key={g.key} group={g} viewMode={viewMode} />
								))}
							</tbody>
							{/* Section footer total */}
							<tfoot>
								<tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 font-bold">
									<td
										colSpan={9}
										className="py-2.5 pl-12 pr-3 text-xs text-slate-600 dark:text-slate-300"
									>
										Tổng cộng • {groups.length} lô
									</td>
									<td className="py-2.5 pr-3 text-right text-xs text-slate-800 dark:text-white tabular-nums whitespace-nowrap">
										{fmt(sectionTotal)} ₫
									</td>
									<td className="py-2.5 pr-3 text-right text-xs text-emerald-600 tabular-nums whitespace-nowrap">
										{fmt(sectionApproved)} ₫
									</td>
									<td className="py-2.5 pr-4 text-right text-xs text-amber-600 tabular-nums whitespace-nowrap">
										{fmt(sectionPending)} ₫
									</td>
								</tr>
							</tfoot>
						</table>
					)}
				</div>
			)}
		</div>
	);
}
