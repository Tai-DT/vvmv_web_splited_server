"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipPositioner,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSession } from "@/lib/auth-client";
import type { FCRRow, VendorCostRow } from "../../types";

interface VendorCostsPanelProps {
	fcrs: FCRRow[];
	onRefresh?: () => void;
	/** When true (Accounting dept): Cước vận chuyển = view-only, Chi hộ = can approve/reject */
	isAccountingUser?: boolean;
}

function formatAmount(value?: number | null) {
	if (value === null || value === undefined || !Number.isFinite(value)) {
		return "-";
	}
	return Math.round(value).toLocaleString("vi-VN");
}

function formatDateTime(value?: string | Date | null) {
	if (!value) return "-";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return String(value);
	return date.toLocaleString("vi-VN");
}

function StatusDot({ row }: { row: VendorCostRow }) {
	const { status, rejectionReason, reviewedAt, reviewer } = row;

	const cfg =
		status === "APPROVED"
			? { dot: "bg-emerald-500", text: "Đã duyệt", cls: "text-emerald-700" }
			: status === "REJECTED"
				? { dot: "bg-red-500", text: "Từ chối", cls: "text-red-600" }
				: { dot: "bg-amber-400", text: "Chờ duyệt", cls: "text-amber-600" };

	const tooltipLines = [
		reviewer?.name
			? `Bởi: ${reviewer.name}`
			: reviewer?.email
				? `Bởi: ${reviewer.email}`
				: null,
		reviewedAt ? formatDateTime(reviewedAt) : null,
		rejectionReason ? `Lý do: ${rejectionReason}` : null,
	].filter(Boolean);

	const inner = (
		<span
			className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${cfg.cls}`}
		>
			<span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
			{cfg.text}
		</span>
	);

	if (!tooltipLines.length) return inner;

	return (
		<Tooltip>
			<TooltipTrigger className="cursor-default">{inner}</TooltipTrigger>
			<TooltipPositioner>
				<TooltipContent className="max-w-[260px] text-xs space-y-0.5">
					{tooltipLines.map((line, i) => (
						<div key={i}>{line}</div>
					))}
				</TooltipContent>
			</TooltipPositioner>
		</Tooltip>
	);
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function VendorCostsPanel({
	fcrs,
	onRefresh,
	isAccountingUser = false,
}: VendorCostsPanelProps) {
	const { data: session } = useSession();

	// Reject dialog state
	const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
	const [rejectingIds, setRejectingIds] = useState<string[]>([]);
	const [rejectReason, setRejectReason] = useState("");
	const [reviewing, setReviewing] = useState(false);

	// Bulk selection state
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

	// Optimistic overrides: costId → patched fields
	const [localOverrides, setLocalOverrides] = useState<
		Record<string, Partial<VendorCostRow>>
	>({});

	const applyOverrides = (ids: string[], patch: Partial<VendorCostRow>) => {
		setLocalOverrides((prev) => {
			const next = { ...prev };
			const reviewer = session?.user
				? { name: session.user.name ?? null, email: session.user.email ?? "" }
				: null;
			ids.forEach((id) => {
				next[id] = {
					...prev[id],
					...patch,
					reviewer: reviewer ?? undefined,
					reviewedAt: new Date().toISOString(),
				};
			});
			return next;
		});
	};

	type RowWithFcr = VendorCostRow & {
		fcrNumber: string | null;
		containerNo: string | null;
	};

	// Apply optimistic overrides to rows
	const allRows: RowWithFcr[] = fcrs.flatMap((fcr) =>
		(fcr.vendorCosts || []).map((cost) => ({
			...cost,
			...(localOverrides[cost.id] ?? {}),
			fcrNumber: fcr.fcrNumber ?? null,
			containerNo: fcr.containerNo ?? null,
		})),
	);

	// Split by type (Case 0, Case 1/2/3, Standard Trucking)
	const truckingRows = allRows.filter(
		(r) => !r.isDisbursement && r.feeType?.isNotDefault !== true,
	);
	// Non-default Buying rows (Trucking approves)
	const nonDefaultRows = allRows.filter(
		(r) => r.feeType?.isNotDefault === true && !r.isSelling,
	);
	// Standard Disbursements (Accounting approves)
	const disbursementRows = allRows.filter(
		(r) => r.isDisbursement && r.feeType?.isNotDefault !== true,
	);
	// Non-default Selling rows / Doanh thu khác (Accounting approves)
	const sellingNonDefaultRows = allRows.filter(
		(r) => r.isSelling && r.feeType?.isNotDefault === true,
	);

	// Totals (exclude rejected from totals)
	const truckingActive = truckingRows.filter((r) => r.status !== "REJECTED");
	const truckingTotalFee = truckingActive.reduce(
		(s, r) => s + (r.totalFee ?? 0),
		0,
	);
	const truckingTotalVat = truckingActive.reduce(
		(s, r) => s + (r.totalVat ?? 0),
		0,
	);

	const nonDefaultActive = nonDefaultRows.filter(
		(r) => r.status !== "REJECTED",
	);
	const nonDefaultTotalFee = nonDefaultActive.reduce(
		(s, r) => s + (r.totalFee ?? 0),
		0,
	);
	// Case 0 non-default total matches totalFee include 8% vat for display purposes?
	// No, let's just keep raw totalFee + VAT (calculated as totalFee * 0.08)
	const nonDefaultTotalVat = nonDefaultActive.reduce(
		(s, r) => s + (r.totalVat ?? Math.round((r.totalFee || 0) * 0.08)),
		0,
	);

	const disbursementActive = disbursementRows.filter(
		(r) => r.status !== "REJECTED",
	);
	const disbursementTotalFee = disbursementActive.reduce(
		(s, r) => s + (r.totalFee ?? 0),
		0,
	);
	const disbursementTotalVat = disbursementActive.reduce(
		(s, r) => s + (r.totalVat ?? 0),
		0,
	);

	const sellingNonDefaultActive = sellingNonDefaultRows.filter(
		(r) => r.status !== "REJECTED",
	);
	const sellingNonDefaultTotalFee = sellingNonDefaultActive.reduce(
		(s, r) => s + (r.totalFee ?? 0),
		0,
	);
	const sellingNonDefaultTotalVat = sellingNonDefaultActive.reduce(
		(s, r) => s + (r.totalVat ?? 0),
		0,
	);

	// ── Review handlers ──

	const handleReview = useCallback(
		async (costId: string, action: "APPROVE" | "REJECT", reason?: string) => {
			setReviewing(true);
			try {
				const res = await fetch("/api/external/vendor-portal/costs/review", {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ costId, action, reason }),
				});
				const json = await res.json();
				if (!res.ok) {
					// Show ERP-specific errors if available
					if (json.erpErrors?.length) {
						json.erpErrors.forEach((e: string) =>
							toast.error(e, { duration: 8000 }),
						);
					} else {
						toast.error(json.message || "Lỗi không xác định", {
							duration: 6000,
						});
					}
					return;
				}
				// Optimistic: update UI immediately
				applyOverrides([costId], {
					status: action === "APPROVE" ? "APPROVED" : "REJECTED",
					rejectionReason: reason ?? null,
					reviewMessage: action === "APPROVE" ? json.reviewMessage : null,
				});
				if (action === "APPROVE" && json.erpResult) {
					toast.success(
						`Đã duyệt & import vào FAST: ${json.erpResult?.message ?? "thành công"}`,
						{ duration: 5000 },
					);
				} else {
					toast.success(
						action === "APPROVE" ? "Đã duyệt phí" : "Đã từ chối phí",
					);
				}
				onRefresh?.();
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Thao tác thất bại");
			} finally {
				setReviewing(false);
			}
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[
			onRefresh, // Optimistic: update UI immediately
			applyOverrides,
		],
	);

	const openRejectDialog = (ids: string[]) => {
		setRejectingIds(ids);
		setRejectReason("");
		setRejectDialogOpen(true);
	};

	const confirmReject = async () => {
		if (!rejectingIds.length || !rejectReason.trim()) return;
		setReviewing(true);
		try {
			await Promise.all(
				rejectingIds.map((id) =>
					fetch("/api/external/vendor-portal/costs/review", {
						method: "PATCH",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							costId: id,
							action: "REJECT",
							reason: rejectReason.trim(),
						}),
					}),
				),
			);
			applyOverrides(rejectingIds, {
				status: "REJECTED",
				rejectionReason: rejectReason.trim(),
			});
			toast.success(`Đã từ chối ${rejectingIds.length} phí`);
			setSelectedIds(new Set());
			onRefresh?.();
		} catch {
			toast.error("Từ chối thất bại");
		} finally {
			setReviewing(false);
			setRejectDialogOpen(false);
			setRejectingIds([]);
			setRejectReason("");
		}
	};

	const handleBulkApprove = async (ids: string[]) => {
		if (!ids.length) return;
		setReviewing(true);
		let successCount = 0;
		let failCount = 0;
		const erpErrors: string[] = [];
		try {
			for (const id of ids) {
				const res = await fetch("/api/external/vendor-portal/costs/review", {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ costId: id, action: "APPROVE" }),
				});
				const json = await res.json();
				if (res.ok) {
					successCount++;
					applyOverrides([id], { status: "APPROVED" });
				} else {
					failCount++;
					if (json.erpErrors?.length) {
						erpErrors.push(...json.erpErrors);
					} else if (json.message) {
						erpErrors.push(json.message);
					}
				}
			}
			if (successCount > 0)
				toast.success(
					`Đã duyệt ${successCount} phí${erpErrors.length ? " (có lỗi FAST bên dưới)" : ""}`,
				);
			erpErrors.forEach((e) => toast.error(e, { duration: 8000 }));
			if (failCount > 0 && !erpErrors.length)
				toast.error(`${failCount} phí duyệt thất bại`);
			setSelectedIds(new Set());
			onRefresh?.();
		} catch {
			toast.error("Duyệt thất bại");
		} finally {
			setReviewing(false);
		}
	};

	if (!allRows.length) {
		return (
			<div className="p-8 text-center text-muted-foreground italic">
				Chưa có chi phí nào được vendor nhập cho trucking job này.
			</div>
		);
	}

	// ── Render a cost table ──
	const renderTable = (
		tableRows: RowWithFcr[],
		opts: { canApprove: boolean; isDisbursement: boolean },
	) => {
		const { canApprove, isDisbursement } = opts;
		if (!tableRows.length) return null;

		const pendingRows = tableRows.filter(
			(r) => !r.status || r.status === "PENDING",
		);
		const pendingIds = pendingRows.map((r) => r.id);
		const selectedInTable = pendingIds.filter((id) => selectedIds.has(id));
		const allSelected =
			pendingIds.length > 0 && selectedInTable.length === pendingIds.length;
		const someSelected = selectedInTable.length > 0;

		const toggleRow = (id: string) => {
			setSelectedIds((prev) => {
				const next = new Set(prev);
				if (next.has(id)) next.delete(id);
				else next.add(id);
				return next;
			});
		};

		const toggleAll = () => {
			setSelectedIds((prev) => {
				const next = new Set(prev);
				if (allSelected) {
					pendingIds.forEach((id) => next.delete(id));
				} else {
					pendingIds.forEach((id) => next.add(id));
				}
				return next;
			});
		};

		return (
			<div className="space-y-2">
				{/* Bulk action bar */}
				{canApprove && someSelected && (
					<div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
						<span className="text-xs font-medium text-blue-700">
							Đã chọn {selectedInTable.length} phí
						</span>
						<div className="flex-1" />
						<Button
							size="sm"
							className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700"
							disabled={reviewing}
							onClick={() => handleBulkApprove(selectedInTable)}
						>
							✅ Duyệt tất cả
						</Button>
						<Button
							size="sm"
							variant="destructive"
							className="h-7 px-3 text-xs"
							disabled={reviewing}
							onClick={() => openRejectDialog(selectedInTable)}
						>
							❌ Từ chối tất cả
						</Button>
						<Button
							size="sm"
							variant="ghost"
							className="h-7 px-2 text-xs text-slate-500"
							onClick={() => setSelectedIds(new Set())}
						>
							Bỏ chọn
						</Button>
					</div>
				)}

				<div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
					<Table className="w-full text-xs">
						<TableHeader className="bg-slate-100 dark:bg-slate-800">
							<TableRow>
								{canApprove && (
									<TableHead className="px-2 py-2 w-8 text-center">
										<input
											type="checkbox"
											className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
											checked={allSelected}
											ref={(el) => {
												if (el) el.indeterminate = someSelected && !allSelected;
											}}
											onChange={toggleAll}
											disabled={pendingIds.length === 0}
											title={`Chọn tất cả ${pendingIds.length} dòng chờ duyệt`}
										/>
									</TableHead>
								)}
								<TableHead className="px-2 py-2 w-8 text-center">#</TableHead>
								<TableHead className="px-2 py-2 w-[110px] whitespace-nowrap text-center">
									Trạng thái
								</TableHead>
								{canApprove && (
									<TableHead className="px-2 py-2 w-32 text-center">
										Thao tác
									</TableHead>
								)}
								<TableHead className="px-2 py-2 w-24">FCR</TableHead>
								<TableHead className="px-2 py-2 w-28">Cont</TableHead>
								<TableHead className="px-2 py-2 w-24">Vendor</TableHead>
								<TableHead className="px-2 py-2 min-w-[180px]">
									Tên phí
								</TableHead>
								{!isDisbursement && (
									<TableHead className="px-2 py-2 w-28 text-right">
										Tổng phí (Trước VAT)
									</TableHead>
								)}
								{isDisbursement && (
									<>
										<TableHead className="px-2 py-2 w-16 text-right">
											% VAT
										</TableHead>
										<TableHead className="px-2 py-2 w-24 text-right">
											Tổng VAT
										</TableHead>
										<TableHead className="px-2 py-2 w-28 text-right">
											Tổng phí (Gồm VAT)
										</TableHead>
									</>
								)}
								{isDisbursement && (
									<>
										<TableHead className="px-2 py-2 min-w-[130px]">
											MST bên bán
										</TableHead>
										<TableHead className="px-2 py-2 min-w-[130px]">
											Số hóa đơn
										</TableHead>
									</>
								)}
								<TableHead className="px-2 py-2 min-w-[180px]">
									Ghi chú
								</TableHead>
								<TableHead className="px-2 py-2 min-w-[150px]">
									Thông báo hệ thống
								</TableHead>
								{isDisbursement && (
									<TableHead className="px-2 py-2 min-w-[140px]">
										Hoá đơn / Tra cứu
									</TableHead>
								)}
								<TableHead className="px-2 py-2 min-w-[140px]">
									Xử lý bởi
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
							{tableRows.map((row, index) => {
								const totalFeeEntered = row.totalFee ?? 0;
								const _payment = isDisbursement
									? totalFeeEntered
									: Math.round(totalFeeEntered * 1.08);
								const vendorName =
									row.vendor?.name || row.createdByVendor || "-";
								const isPending = !row.status || row.status === "PENDING";

								const rowColorClass =
									row.status === "APPROVED"
										? "bg-emerald-50/60 hover:bg-emerald-50"
										: row.status === "REJECTED"
											? "bg-red-50/50 opacity-70 hover:opacity-100"
											: "hover:bg-amber-50/40";

								return (
									<TableRow key={row.id} className={rowColorClass}>
										{canApprove && (
											<TableCell className="px-2 py-2 text-center">
												{isPending ? (
													<input
														type="checkbox"
														className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
														checked={selectedIds.has(row.id)}
														onChange={() => toggleRow(row.id)}
													/>
												) : (
													<span className="text-slate-200">—</span>
												)}
											</TableCell>
										)}
										<TableCell className="px-2 py-2 text-center text-muted-foreground">
											{index + 1}
										</TableCell>
										<TableCell className="px-2 py-2 whitespace-nowrap">
											<StatusDot row={row} />
										</TableCell>
										{canApprove && (
											<TableCell className="px-2 py-2 text-center align-middle">
												{isPending && session?.user ? (
													<div className="flex justify-center gap-1 flex-wrap">
														<Button
															size="sm"
															className="h-6 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700"
															disabled={reviewing}
															onClick={() => handleReview(row.id, "APPROVE")}
															title={
																row.isDisbursement
																	? "Duyệt & import vào FAST"
																	: "Duyệt phí"
															}
														>
															Duyệt
														</Button>
														<Button
															size="sm"
															variant="destructive"
															className="h-6 px-2 text-[11px]"
															disabled={reviewing}
															onClick={() => openRejectDialog([row.id])}
														>
															Từ chối
														</Button>
													</div>
												) : (
													<span className="text-slate-300">—</span>
												)}
											</TableCell>
										)}
										<TableCell className="px-2 py-2 font-medium">
											{row.fcrNumber || "-"}
										</TableCell>
										<TableCell className="px-2 py-2 font-mono text-[11px]">
											{row.containerNo || "—"}
										</TableCell>
										<TableCell className="px-2 py-2">{vendorName}</TableCell>
										<TableCell className="px-2 py-2">
											{row.feeName || row.feeType?.name || "-"}
										</TableCell>
										{!isDisbursement && (
											<TableCell className="px-2 py-2 text-right tabular-nums">
												{formatAmount(row.totalFee)}
											</TableCell>
										)}
										{isDisbursement && (
											<>
												<TableCell className="px-2 py-2 text-right tabular-nums">
													{row.vatPercent ?? "-"}
												</TableCell>
												<TableCell className="px-2 py-2 text-right tabular-nums">
													{formatAmount(row.totalVat)}
												</TableCell>
												<TableCell className="px-2 py-2 text-right tabular-nums">
													{formatAmount(row.totalFee)}
												</TableCell>
											</>
										)}
										{isDisbursement && (
											<>
												<TableCell className="px-2 py-2">
													{row.sellerTaxCode || "-"}
												</TableCell>
												<TableCell className="px-2 py-2">
													{row.invoiceNumber || "-"}
												</TableCell>
											</>
										)}
										<TableCell className="px-2 py-2">
											{row.note || "-"}
										</TableCell>
										<TableCell className="px-2 py-2">
											{row.reviewMessage ? (
												<span className="text-blue-600 font-medium">
													{row.reviewMessage}
												</span>
											) : (
												<span className="text-slate-300">—</span>
											)}
										</TableCell>
										{isDisbursement && (
											<TableCell className="px-2 py-2">
												<div className="flex flex-col gap-1">
													{row.invoiceLink ? (
														<a
															href={row.invoiceLink}
															target="_blank"
															rel="noopener noreferrer"
															className="text-blue-600 hover:underline truncate"
														>
															Link hoá đơn
														</a>
													) : null}
													<span className="text-muted-foreground break-all">
														{row.trackingCode ||
															(!row.invoiceLink ? "-" : null)}
													</span>
												</div>
											</TableCell>
										)}
										<TableCell className="px-2 py-2">
											{row.reviewer ? (
												<div className="flex flex-col gap-0.5">
													<span className="font-medium text-slate-700 text-[11px]">
														{row.reviewer.name || row.reviewer.email}
													</span>
													{row.reviewedAt && (
														<span className="text-[10px] text-slate-400">
															{formatDateTime(row.reviewedAt)}
														</span>
													)}
												</div>
											) : (
												<span className="text-slate-300 text-[11px]">—</span>
											)}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>
			</div>
		);
	};

	// ── Section block renderer ──
	const renderSection = (
		title: string,
		allRows: RowWithFcr[],
		totalFee: number,
		totalVat: number,
		canApprove: boolean,
		accentColor: "blue" | "amber",
	) => {
		const borderClass =
			accentColor === "blue" ? "border-blue-200" : "border-amber-200";
		const bgClass = accentColor === "blue" ? "bg-blue-50" : "bg-amber-50";
		const titleClass =
			accentColor === "blue" ? "text-blue-800" : "text-amber-800";

		// Determine lock badge: show who should approve this section
		const showLockBadge = !canApprove;
		const lockLabel =
			accentColor === "blue"
				? isAccountingUser
					? "🔒 Trucking duyệt"
					: "🔒 Kế toán duyệt"
				: "🔒 Kế toán duyệt";

		return (
			<div className={`rounded-xl border ${borderClass} overflow-hidden`}>
				{/* Section header */}
				<div
					className={`flex flex-wrap items-center gap-3 px-4 py-2.5 ${bgClass}`}
				>
					<span className={`text-sm font-semibold ${titleClass}`}>{title}</span>
					{showLockBadge && (
						<Badge
							variant="outline"
							className="border-slate-400 text-slate-500 text-[10px]"
						>
							{lockLabel}
						</Badge>
					)}
					<div className="flex-1" />
					<span className="text-xs text-slate-500">
						Phí:{" "}
						<strong>
							{formatAmount(
								accentColor === "amber" ? totalFee - totalVat : totalFee,
							)}
						</strong>
						{totalVat > 0 && (
							<>
								{" "}
								&nbsp;|&nbsp; VAT: <strong>{formatAmount(totalVat)}</strong>
							</>
						)}
						&nbsp;|&nbsp; Tổng:{" "}
						<strong className="text-slate-700">
							{formatAmount(
								accentColor === "amber" ? totalFee : totalFee + totalVat,
							)}
						</strong>
					</span>
				</div>

				{/* Unified table — all statuses */}
				<div className="p-3">
					{allRows.length > 0 ? (
						renderTable(allRows, {
							canApprove,
							isDisbursement: accentColor === "amber",
						})
					) : (
						<div className="py-4 text-center text-xs text-slate-400 italic">
							Chưa có phí nào
						</div>
					)}
				</div>
			</div>
		);
	};

	return (
		<>
			<div className="p-4 space-y-4">
				{isAccountingUser ? (
					<>
						{/* Accounting view: Chi hộ first (they approve this) */}
						{renderSection(
							"🧾 Chi hộ",
							disbursementRows,
							disbursementTotalFee,
							disbursementTotalVat,
							true, // Accounting can approve
							"amber",
						)}

						{/* Doanh thu khác (Accounting can approve) */}
						{renderSection(
							"💰 Doanh thu khác",
							sellingNonDefaultRows,
							sellingNonDefaultTotalFee,
							sellingNonDefaultTotalVat,
							true, // Accounting can approve
							"amber",
						)}

						{/* Cước vận chuyển second (view-only for Accounting) */}
						{renderSection(
							"🚛 Cước vận chuyển",
							truckingRows,
							truckingTotalFee,
							truckingTotalVat,
							false, // view-only
							"blue",
						)}

						{/* Phí ngoài Default (view-only for Accounting) */}
						{renderSection(
							"➕ Phí ngoài Default",
							nonDefaultRows,
							nonDefaultTotalFee,
							nonDefaultTotalVat,
							false, // view-only
							"blue",
						)}
					</>
				) : (
					<>
						{/* Default view: Cước vận chuyển first */}
						{renderSection(
							"🚛 Cước vận chuyển",
							truckingRows,
							truckingTotalFee,
							truckingTotalVat,
							true, // Trucking can approve
							"blue",
						)}

						{/* Phí ngoài Default (Dành cho Trucking duyệt) */}
						{renderSection(
							"➕ Phí ngoài Default",
							nonDefaultRows,
							nonDefaultTotalFee,
							nonDefaultTotalVat,
							true, // Trucking can approve
							"blue",
						)}

						{/* Chi hộ second (view-only, Kế toán duyệt) */}
						{renderSection(
							"🧾 Chi hộ",
							disbursementRows,
							disbursementTotalFee,
							disbursementTotalVat,
							false, // view-only
							"amber",
						)}

						{/* Doanh thu khác (view-only, Kế toán duyệt) */}
						{renderSection(
							"💰 Doanh thu khác",
							sellingNonDefaultRows,
							sellingNonDefaultTotalFee,
							sellingNonDefaultTotalVat,
							false, // view-only
							"amber",
						)}
					</>
				)}
			</div>

			{/* Reject reason dialog */}
			<Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Lý do từ chối</DialogTitle>
					</DialogHeader>
					<Textarea
						placeholder="Nhập lý do từ chối phí này..."
						value={rejectReason}
						onChange={(e) => setRejectReason(e.target.value)}
						rows={3}
						className="resize-none"
					/>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setRejectDialogOpen(false)}
							disabled={reviewing}
						>
							Huỷ
						</Button>
						<Button
							variant="destructive"
							onClick={confirmReject}
							disabled={reviewing || !rejectReason.trim()}
						>
							{reviewing ? "Đang xử lý..." : "Xác nhận từ chối"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
