"use client";

import {
	Download,
	ExternalLink,
	Loader2,
	Package,
	Plus,
	Receipt,
	Save,
	Truck,
	Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	cleanPlateNumber,
	PLATE_URL_REGEX,
	formatPlateNumber as standardFormatPlate,
} from "@/lib/trucking/plate-utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type VendorSession = {
	id: string;
	name: string;
	site: string;
};

type FeeType = {
	id: string;
	name: string;
	serviceMode: string | null;
	feeCode?: string | null;
};

type CostRow = {
	id?: string;
	feeTypeId?: string | null;
	feeName: string;
	isDisbursement: boolean;
	vatPercent?: number | null;
	totalVat?: number | null;
	totalFee?: number | null;
	sellerTaxCode?: string | null;
	invoiceNumber?: string | null;
	invoiceLink?: string | null;
	trackingCode?: string | null;
	invoiceSentDate?: string | null;
	note?: string | null;
	rowOrder: number;
	// Status workflow
	status?: "PENDING" | "APPROVED" | "REJECTED" | null;
	rejectionReason?: string | null;
};

type Assignment = {
	id: string;
	truckingFollowUpId: string | null;
	jobNumber: string | null;
	serviceMode: string | null;
	requestNumber: string | null;
	billOrBooking: string | null;
	vehicleInfo: string | null;
	fcrNumber: string | null;
	implementationDate: string | null;
	cbm: number | null;
	grossWeight: number | null;
	quantity: number | null;
	containerNo: string | null;
	truckType: string | null;
	plateNumber: string | null;
	shipper: string | null;
	shipperName: string | null;
	pickUpTime: string | null;
	pickupAt: string | null;
	deliveryAt: string | null;
	declarationNumbers: string[];
	isFinished: boolean;
	costs: CostRow[];
};

const PLATE_NUMBER_HINT =
	"Biển số phải đúng định dạng, ví dụ: 50E-146.80, 51LD-123.45 hoặc 51C-1234";
const CONTAINER_NUMBER_PATTERN = /^[A-Z]{4}\d{7}$/;
const CONTAINER_NUMBER_HINT = "Số container phải đúng định dạng YMMU6948968";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNumber(value: unknown): number | null {
	if (value === null || value === undefined || value === "") return null;
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

function formatAmountPattern(value: number | null | undefined): string {
	if (value === null || value === undefined || !Number.isFinite(value)) {
		return "";
	}

	const intPart = String(Math.round(value));
	const withGroup = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
	return withGroup;
}

function parseAmountPattern(value: unknown): number | null {
	const raw = String(value ?? "").trim();
	if (!raw) return null;

	const cleaned = raw.replace(/[^\d-]/g, "");
	if (!cleaned || cleaned === "-" || cleaned === ".") return null;

	const num = Number(cleaned);
	return Number.isFinite(num) ? num : null;
}

function formatDate(value?: string | null): string {
	if (!value) return "-";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return String(value);
	return date.toLocaleDateString("vi-VN");
}

function isValidPlateNumber(value: string | null | undefined): boolean {
	if (!value) return false;
	return PLATE_URL_REGEX.test(cleanPlateNumber(value));
}

function normalizeContainerNo(value: string): string {
	return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function isValidContainerNo(value: string): boolean {
	return CONTAINER_NUMBER_PATTERN.test(normalizeContainerNo(value));
}

function getAssignmentLabel(assignment: Assignment, index: number): string {
	const job = assignment.jobNumber?.trim();
	const fcr = assignment.fcrNumber?.trim();
	const request = assignment.requestNumber?.trim();
	if (job && fcr) return `${job} - ${fcr}`;
	if (fcr) return `FCR: ${fcr}`;
	if (job) return `Job: ${job}`;
	if (request) return `Request: ${request}`;
	return `Lô hàng #${index + 1}`;
}

function getDisplayFeeName(row: CostRow, feeTypes: FeeType[]): string {
	if (row.feeTypeId) {
		const ft = feeTypes.find((f) => f.id === row.feeTypeId);
		if (ft?.name) return ft.name;
	}
	const codeMatch = feeTypes.find(
		(f) =>
			(f.feeCode && f.feeCode === row.feeName) ||
			(f.serviceMode && f.serviceMode === row.feeName) ||
			f.name === row.feeName,
	);
	return codeMatch?.name || row.feeName || "";
}

function isFCL(serviceMode: string | null | undefined): boolean {
	return String(serviceMode || "")
		.trim()
		.toUpperCase()
		.startsWith("FCL");
}

function makeBlankCostRow(overrides: Partial<CostRow> = {}): CostRow {
	return {
		feeTypeId: null,
		feeName: "",
		isDisbursement: false,
		vatPercent: null,
		totalVat: null,
		totalFee: null,
		sellerTaxCode: null,
		invoiceNumber: null,
		invoiceLink: null,
		trackingCode: null,
		invoiceSentDate: null,
		note: null,
		rowOrder: 1,
		...overrides,
	};
}

// ─── Sub-component: Assignment info card ─────────────────────────────────────

function _AssignmentInfoCard({ assignment }: { assignment: Assignment }) {
	return (
		<div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2 text-xs">
			{[
				{ label: "Job", value: assignment.jobNumber },
				{ label: "Service", value: assignment.serviceMode },
				{ label: "FCR", value: assignment.fcrNumber },
				{ label: "Ngày TH", value: formatDate(assignment.implementationDate) },
				{ label: "Số container", value: assignment.containerNo },
				{ label: "Số xe", value: assignment.plateNumber },
				{ label: "Loại xe", value: assignment.truckType },
				{ label: "Giờ lấy hàng", value: assignment.pickUpTime },
				{ label: "Shipper", value: assignment.shipper },
				{ label: "Điểm đi", value: assignment.pickupAt },
				{ label: "Điểm đến", value: assignment.deliveryAt },
				{ label: "CBM", value: assignment.cbm?.toString() },
				{ label: "GW (kg)", value: assignment.grossWeight?.toString() },
				{ label: "Qty", value: assignment.quantity?.toString() },
			].map(({ label, value }) => (
				<div key={label} className="rounded-lg border bg-slate-50 px-3 py-2">
					<div className="text-slate-400 font-medium">{label}</div>
					<div className="text-slate-800 font-semibold truncate">
						{value || "-"}
					</div>
				</div>
			))}
		</div>
	);
}

// ─── Excel-like Unified Table ──────────────────────────────────────────────────

type FlatRow = {
	assignmentId: string;
	assignmentLabel: string;
	assignment: Assignment;
	rowIndex: number; // index within this assignment's rows
	isGroupHeader?: boolean;
};

// Cell ref map for keyboard navigation
type CellRef = { assignmentId: string; rowIndex: number; colIndex: number };

type ExcelTableProps = {
	assignments: Assignment[];
	feeTypes: FeeType[];
	isDisbursementTab: boolean;
	showContainerColumn: boolean;
	showBillOrBookingColumn: boolean;
	showVehicleInfoColumn: boolean;
	plateNumberMap: Record<string, string>;
	containerNoMap: Record<string, string>;
	vehicleInfoMap: Record<string, string>;
	onPlateNumberChange: (assignmentId: string, value: string) => void;
	onContainerNoChange: (assignmentId: string, value: string) => void;
	onVehicleInfoChange: (assignmentId: string, value: string) => void;
	isFullscreen?: boolean;
	getRows: (assignmentId: string) => CostRow[];
	onUpdateRow: (
		assignmentId: string,
		rowIndex: number,
		patch: Partial<CostRow>,
	) => void;
	onAddRow: (assignmentId: string, afterIndex?: number) => void;
	onRemoveRow: (assignmentId: string, rowIndex: number) => void;
	sessionSite?: string;
};

function ExcelTable({
	assignments,
	feeTypes,
	isDisbursementTab,
	showContainerColumn,
	showBillOrBookingColumn,
	showVehicleInfoColumn,
	plateNumberMap,
	containerNoMap,
	vehicleInfoMap,
	onPlateNumberChange,
	onContainerNoChange,
	onVehicleInfoChange,
	isFullscreen = false,
	getRows,
	onUpdateRow,
	onAddRow,
	onRemoveRow,
	sessionSite,
}: ExcelTableProps) {
	const tableRef = React.useRef<HTMLTableElement>(null);

	// ── Column definitions: info (rowspan) + cost ──
	const infoCols = [
		{ key: "stt", label: "STT", w: "w-[40px]" },
		{ key: "date", label: "Ngày TH", w: "w-[85px]" },
		{ key: "lot", label: "Lô / Job", w: "min-w-[160px]" },
		...(showBillOrBookingColumn
			? [{ key: "billOrBooking", label: "Bill/Booking", w: "min-w-[140px]" }]
			: []),
		...(showContainerColumn && !isDisbursementTab
			? [{ key: "containerNo", label: "Số container", w: "min-w-[120px]" }]
			: []),
		...(!isDisbursementTab
			? [{ key: "plateNumber", label: "Số xe", w: "min-w-[110px]" }]
			: []),
		{ key: "truckType", label: "Loại xe", w: "min-w-[100px]" },
		...(!isDisbursementTab
			? [
					{ key: "pickupAt", label: "Điểm đi", w: "min-w-[150px]" },
					{ key: "pickUpTime", label: "Giờ lấy hàng", w: "min-w-[110px]" },
					{ key: "deliveryAt", label: "Điểm đến", w: "min-w-[150px]" },
				]
			: []),
		...(showVehicleInfoColumn
			? [{ key: "vehicleInfo", label: "Thông tin xe", w: "min-w-[160px]" }]
			: []),
		{ key: "declarationNumbers", label: "Số tờ khai", w: "min-w-[90px]" },
		...(showContainerColumn && isDisbursementTab
			? [{ key: "containerNo", label: "Số container", w: "min-w-[120px]" }]
			: []),
	];
	const costCols = [
		{ key: "insert", label: "", w: "w-7" },
		...(isDisbursementTab
			? [
					{
						key: "sellerTaxCode",
						label:
							sessionSite === "SGN"
								? "MST bên bán (Nếu VAT > 0) *"
								: "MST bên bán *",
						w: "min-w-[100px]",
					},
					{ key: "invoiceNumber", label: "Số hóa đơn *", w: "min-w-[60px]" },
				]
			: []),
		{ key: "feeName", label: "Tên phí", w: "min-w-[170px]" },
		...(!isDisbursementTab
			? [{ key: "totalFee", label: "Tổng Phí (Trước VAT)", w: "min-w-[110px]" }]
			: []),
		...(isDisbursementTab
			? [
					{ key: "vatPercent", label: "% VAT *", w: "w-[80px]" },
					{ key: "totalVat", label: "Tổng VAT *", w: "min-w-[100px]" },
					{ key: "totalFee", label: "Tổng Phí (Gồm VAT)", w: "min-w-[110px]" },
					{ key: "invoiceLink", label: "Link hóa đơn", w: "min-w-[140px]" },
					{ key: "trackingCode", label: "Mã tra cứu", w: "min-w-[130px]" },
				]
			: []),
		{ key: "note", label: "Ghi chú", w: "min-w-[140px]" },
		...(isDisbursementTab
			? [{ key: "invoiceSentDate", label: "Ngày gửi HĐ", w: "min-w-[120px]" }]
			: []),
		{
			key: "status",
			label: "Trạng thái",
			w: "min-w-[160px] whitespace-nowrap",
		},
		{ key: "delete", label: "", w: "w-8" },
	];

	// Editable cost cols for keyboard nav
	const editableCostCols = costCols
		.map((c, i) => ({ ...c, i }))
		.filter((c) => !["insert", "delete"].includes(c.key));
	// Keep editableCols alias so existing handleKeyDown/handlePaste still work
	const editableCols = editableCostCols;

	// ── Keyboard navigation ──
	function getCellInput(
		aId: string,
		rowIdx: number,
		colIdx: number,
	): HTMLElement | null {
		const selector = `[data-cell="${aId}:${rowIdx}:${colIdx}"]`;
		return tableRef.current?.querySelector<HTMLElement>(selector) ?? null;
	}

	function focusCell(aId: string, rowIdx: number, colIdx: number) {
		const el = getCellInput(aId, rowIdx, colIdx);
		el?.focus();
		if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
			el.select();
		}
	}

	function handleKeyDown(
		e: React.KeyboardEvent,
		assignmentId: string,
		rowIndex: number,
		colIndex: number, // index in editableCols
	) {
		const rows = getRows(assignmentId);
		const lastEditableCol = editableCols.length - 1;

		// Find current assignment position
		const aIdx = assignments.findIndex((a) => a.id === assignmentId);

		if (e.key === "Tab") {
			e.preventDefault();
			if (!e.shiftKey) {
				// Next col
				if (colIndex < lastEditableCol) {
					focusCell(assignmentId, rowIndex, colIndex + 1);
				} else {
					// Next row in same assignment, or first col of next row
					if (rowIndex < rows.length - 1) {
						focusCell(assignmentId, rowIndex + 1, 0);
					} else {
						// Next assignment
						const nextA = assignments[aIdx + 1];
						if (nextA) focusCell(nextA.id, 0, 0);
					}
				}
			} else {
				// Shift+Tab: previous col
				if (colIndex > 0) {
					focusCell(assignmentId, rowIndex, colIndex - 1);
				} else {
					// Prev row
					if (rowIndex > 0) {
						focusCell(assignmentId, rowIndex - 1, lastEditableCol);
					} else {
						const prevA = assignments[aIdx - 1];
						if (prevA) {
							const prevRows = getRows(prevA.id);
							focusCell(prevA.id, prevRows.length - 1, lastEditableCol);
						}
					}
				}
			}
		} else if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			if (rowIndex < rows.length - 1) {
				focusCell(assignmentId, rowIndex + 1, colIndex);
			} else {
				// Add new row then focus
				onAddRow(assignmentId, rowIndex);
				// Focus new row next tick
				setTimeout(() => focusCell(assignmentId, rowIndex + 1, colIndex), 30);
			}
		} else if (e.key === "ArrowDown" && !e.shiftKey) {
			if (rowIndex < rows.length - 1) {
				e.preventDefault();
				focusCell(assignmentId, rowIndex + 1, colIndex);
			}
		} else if (e.key === "ArrowUp" && !e.shiftKey) {
			if (rowIndex > 0) {
				e.preventDefault();
				focusCell(assignmentId, rowIndex - 1, colIndex);
			}
		}
	}

	// ── Paste handler (Ctrl+V Excel-style) ──
	function handlePaste(
		e: React.ClipboardEvent,
		assignmentId: string,
		startRowIndex: number,
		startColIndex: number, // index in editableCols
	) {
		const text = e.clipboardData.getData("text/plain");
		if (!text.includes("\t") && !text.includes("\n")) return; // single value: let default
		e.preventDefault();

		const pastedRows = text
			.replace(/\r\n/g, "\n")
			.split("\n")
			.filter((r) => r !== "");

		const rows = getRows(assignmentId);
		pastedRows.forEach((pastedRow, ri) => {
			const targetRowIndex = startRowIndex + ri;
			const cells = pastedRow.split("\t");

			// Add rows if needed
			if (targetRowIndex >= rows.length) {
				onAddRow(assignmentId, rows.length - 1);
			}

			cells.forEach((value, ci) => {
				const colIdx = startColIndex + ci;
				if (colIdx >= editableCols.length) return;
				const colKey = editableCols[colIdx].key;
				const trimmed = value.trim();
				const patch: Partial<CostRow> = {};
				if (colKey === "feeName") patch.feeName = trimmed;
				else if (colKey === "totalFee") {
					patch.totalFee = parseAmountPattern(trimmed);
				} else if (colKey === "vatPercent")
					patch.vatPercent = toNumber(trimmed);
				else if (colKey === "totalVat") {
					patch.totalVat = parseAmountPattern(trimmed);
				} else if (colKey === "sellerTaxCode") {
					patch.sellerTaxCode = trimmed;
				} else if (colKey === "invoiceNumber") {
					patch.invoiceNumber = trimmed;
				} else if (colKey === "invoiceLink") patch.invoiceLink = trimmed;
				else if (colKey === "trackingCode") patch.trackingCode = trimmed;
				else if (colKey === "note") patch.note = trimmed;
				if (Object.keys(patch).length) {
					onUpdateRow(assignmentId, targetRowIndex, patch);
				}
			});
		});
	}

	// ── Render ──
	if (assignments.length === 0) {
		return (
			<div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
				Không tìm thấy lô hàng nào khớp với bộ lọc.
			</div>
		);
	}

	return (
		<div
			className={
				isFullscreen
					? "overflow-auto h-full min-h-0 pb-26"
					: "overflow-auto rounded-xl border border-slate-200 max-h-[calc(100vh-280px)]"
			}
		>
			<table ref={tableRef} className="w-full text-sm border-collapse">
				{/* Sticky header */}
				<thead className="sticky top-0 z-30 bg-slate-100 text-xs text-slate-600 shadow-sm">
					<tr>
						{infoCols.map((col) => (
							<th
								key={col.key}
								className={`px-2 py-2 text-left font-semibold border-b border-r border-slate-200 ${col.w} whitespace-nowrap bg-slate-100`}
							>
								{col.label}
							</th>
						))}
						{costCols.map((col) => (
							<th
								key={col.key}
								className={`px-2 py-2 text-left font-semibold border-b border-slate-200 ${col.w} whitespace-nowrap bg-slate-100`}
							>
								{col.label}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{assignments.map((assignment, aIdx) => {
						const rows = getRows(assignment.id);
						const rowSpan = rows.length;
						return (
							<React.Fragment key={assignment.id}>
								{rows.map((row, rowIdx) => {
									const isLocked =
										row.status === "APPROVED" || row.status === "REJECTED";
									const isApproved = row.status === "APPROVED";
									const isRejected = row.status === "REJECTED";
									const rowBg = isApproved
										? "bg-emerald-50/50"
										: isRejected
											? "bg-red-50/40 opacity-80"
											: "hover:bg-blue-50/30";

									return (
										<tr
											key={`${row.id || "new"}-${rowIdx}`}
											className={`border-b border-slate-100 group ${rowBg}`}
											style={
												rowIdx === 0 ? { borderTop: "2px solid #94a3b8" } : {}
											}
										>
											{/* Info cells: only on first row, rowspan covers siblings */}
											{rowIdx === 0 && (
												<>
													{/* STT */}
													<td
														rowSpan={rowSpan}
														className="px-2 py-1.5 align-top border-r border-slate-200 bg-slate-50/60 text-xs text-slate-400 font-mono text-center"
														style={{ borderTop: "2px solid #94a3b8" }}
													>
														{aIdx + 1}
													</td>
													{/* Ngày TH */}
													<td
														rowSpan={rowSpan}
														className="px-2 py-1.5 align-top border-r border-slate-200 bg-slate-50/60 text-xs text-slate-500 whitespace-nowrap"
														style={{ borderTop: "2px solid #94a3b8" }}
													>
														{assignment.implementationDate ? (
															formatDate(assignment.implementationDate)
														) : (
															<span className="text-slate-300">—</span>
														)}
													</td>
													{/* Lô / Job */}
													<td
														rowSpan={rowSpan}
														className="px-2 py-1.5 align-top border-r border-slate-200 bg-slate-50/60 text-xs"
														style={{ borderTop: "2px solid #94a3b8" }}
													>
														<div className="font-semibold text-slate-700 leading-tight">
															{getAssignmentLabel(assignment, aIdx)}
														</div>
														{isDisbursementTab && assignment.serviceMode && (
															<Badge
																variant="secondary"
																className="text-[10px] h-4 px-1 mt-0.5"
															>
																{assignment.serviceMode}
															</Badge>
														)}
														{assignment.shipperName && (
															<Badge
																variant="outline"
																className="text-[10px] h-4 px-1.5 mt-1 bg-amber-50 text-amber-700 border-amber-300 font-semibold truncate max-w-[150px]"
																title={assignment.shipperName}
															>
																{assignment.shipperName}
															</Badge>
														)}
													</td>
													{showBillOrBookingColumn && (
														<td
															rowSpan={rowSpan}
															className="px-2 py-1.5 align-top border-r border-slate-200 bg-slate-50/60 text-xs text-slate-600 whitespace-normal break-all"
															style={{ borderTop: "2px solid #94a3b8" }}
														>
															{assignment.billOrBooking || (
																<span className="text-slate-300">—</span>
															)}
														</td>
													)}
													{showContainerColumn && !isDisbursementTab && (
														<td
															rowSpan={rowSpan}
															className="px-2 py-1.5 align-top border-r border-slate-200 bg-slate-50/60 text-xs text-slate-600"
															style={{ borderTop: "2px solid #94a3b8" }}
														>
															{!assignment.isFinished &&
															(assignment.containerNo?.trim()?.length ?? 0) <
																6 ? (
																<input
																	value={
																		containerNoMap[assignment.id] ??
																		assignment.containerNo ??
																		""
																	}
																	onChange={(e) =>
																		onContainerNoChange(
																			assignment.id,
																			e.target.value,
																		)
																	}
																	placeholder="Nhập số container"
																	className="w-full h-7 px-2 text-xs rounded border border-slate-300 bg-white focus:border-blue-400 focus:outline-none"
																/>
															) : (
																assignment.containerNo || (
																	<span className="text-slate-300">—</span>
																)
															)}
														</td>
													)}
													{!isDisbursementTab && (
														<td
															rowSpan={rowSpan}
															className="px-2 py-1.5 align-top border-r border-slate-200 bg-slate-50/60 text-xs text-slate-600"
															style={{ borderTop: "2px solid #94a3b8" }}
														>
															{showContainerColumn &&
															!assignment.isFinished &&
															(assignment.plateNumber?.trim()?.length ?? 0) ===
																0 ? (
																<input
																	value={
																		plateNumberMap[assignment.id] ??
																		assignment.plateNumber ??
																		""
																	}
																	onChange={(e) =>
																		onPlateNumberChange(
																			assignment.id,
																			e.target.value,
																		)
																	}
																	placeholder="Nhập số xe"
																	className="w-full h-7 px-2 text-xs rounded border border-slate-300 bg-white focus:border-blue-400 focus:outline-none"
																/>
															) : (
																assignment.plateNumber || (
																	<span className="text-slate-300">—</span>
																)
															)}
														</td>
													)}
													<td
														rowSpan={rowSpan}
														className="px-2 py-1.5 align-top border-r border-slate-200 bg-slate-50/60 text-xs text-slate-600"
														style={{ borderTop: "2px solid #94a3b8" }}
													>
														{assignment.truckType || (
															<span className="text-slate-300">—</span>
														)}
													</td>
													{!isDisbursementTab && (
														<>
															<td
																rowSpan={rowSpan}
																className="px-2 py-1.5 align-top border-r border-slate-200 bg-slate-50/60 text-xs text-slate-600"
																style={{ borderTop: "2px solid #94a3b8" }}
															>
																{assignment.pickupAt || (
																	<span className="text-slate-300">—</span>
																)}
															</td>
															<td
																rowSpan={rowSpan}
																className="px-2 py-1.5 align-top border-r border-slate-200 bg-slate-50/60 text-xs text-slate-600"
																style={{ borderTop: "2px solid #94a3b8" }}
															>
																{assignment.pickUpTime || (
																	<span className="text-slate-300">—</span>
																)}
															</td>
															<td
																rowSpan={rowSpan}
																className="px-2 py-1.5 align-top border-r border-slate-200 bg-slate-50/60 text-xs text-slate-600"
																style={{ borderTop: "2px solid #94a3b8" }}
															>
																{assignment.deliveryAt || (
																	<span className="text-slate-300">—</span>
																)}
															</td>
														</>
													)}
													{/* Remove old date cell - now rendered at top */}
													{showVehicleInfoColumn && (
														<td
															rowSpan={rowSpan}
															className="px-2 py-1.5 align-top border-r border-slate-200 bg-white text-xs"
															style={{ borderTop: "2px solid #94a3b8" }}
														>
															<textarea
																value={vehicleInfoMap[assignment.id] ?? ""}
																onChange={(e) =>
																	onVehicleInfoChange(
																		assignment.id,
																		e.target.value,
																	)
																}
																disabled={assignment.isFinished}
																placeholder={
																	assignment.isFinished
																		? "Job đã hoàn thành"
																		: "Nhập thông tin xe..."
																}
																rows={3}
																title={
																	assignment.isFinished
																		? "Không thể sửa khi job đã finished"
																		: undefined
																}
																className={`w-full resize-none text-xs text-slate-700 break-words focus:outline-none rounded px-1 min-h-[50px] ${
																	assignment.isFinished
																		? "bg-slate-100 text-slate-400 placeholder:text-slate-300 cursor-not-allowed"
																		: "bg-transparent focus:bg-blue-50 placeholder:text-slate-300"
																}`}
															/>
														</td>
													)}
													{/* Declaration numbers — always visible */}
													<td
														rowSpan={rowSpan}
														className="px-2 py-1.5 align-top border-r border-slate-200 bg-slate-50/60 text-xs"
														style={{ borderTop: "2px solid #94a3b8" }}
													>
														{assignment.declarationNumbers.length > 0 ? (
															<div className="flex flex-col gap-1">
																{assignment.declarationNumbers.map((dn) => (
																	<span
																		key={dn}
																		className="inline-block px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono text-[10px] whitespace-nowrap"
																	>
																		{dn}
																	</span>
																))}
															</div>
														) : (
															<span className="text-slate-300">—</span>
														)}
													</td>
													{showContainerColumn && isDisbursementTab && (
														<td
															rowSpan={rowSpan}
															className="px-2 py-1.5 align-top border-r border-slate-200 bg-slate-50/60 text-xs text-slate-600"
															style={{ borderTop: "2px solid #94a3b8" }}
														>
															{assignment.containerNo || (
																<span className="text-slate-300">—</span>
															)}
														</td>
													)}
												</>
											)}

											{/* Insert button — hidden for locked rows, but always shown on last row to allow adding new fees */}
											<td className="px-0.5 py-0.5 text-center">
												{(!isLocked || rowIdx === rows.length - 1) && (
													<button
														className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center mx-auto hover:bg-blue-600"
														onClick={() => onAddRow(assignment.id, rowIdx)}
														title="Chèn dòng tại đây"
													>
														<Plus className="w-3 h-3" />
													</button>
												)}
											</td>

											{/* Disbursement-only: MST bên bán and Số hóa đơn */}
											{isDisbursementTab && (
												<>
													<td className="px-1 py-0.5">
														<input
															disabled={isLocked}
															className={`w-full h-7 px-2 text-xs rounded border border-transparent focus:outline-none focus:ring-0 ${isLocked ? "bg-transparent text-slate-600 cursor-default" : "hover:border-slate-300 focus:border-blue-400 bg-transparent focus:bg-white"}`}
															value={row.sellerTaxCode || ""}
															placeholder="MST bên bán..."
															data-cell={`${assignment.id}:${rowIdx}:0`}
															onChange={(e) =>
																onUpdateRow(assignment.id, rowIdx, {
																	sellerTaxCode: e.target.value,
																})
															}
															onKeyDown={(e) =>
																handleKeyDown(e, assignment.id, rowIdx, 0)
															}
															onPaste={(e) =>
																handlePaste(e, assignment.id, rowIdx, 0)
															}
														/>
													</td>
													<td className="px-1 py-0.5">
														<input
															disabled={isLocked}
															className={`w-full h-7 px-2 text-xs rounded border border-transparent focus:outline-none focus:ring-0 ${isLocked ? "bg-transparent text-slate-600 cursor-default" : "hover:border-slate-300 focus:border-blue-400 bg-transparent focus:bg-white"}`}
															value={row.invoiceNumber || ""}
															placeholder="Số hóa đơn..."
															data-cell={`${assignment.id}:${rowIdx}:1`}
															onChange={(e) =>
																onUpdateRow(assignment.id, rowIdx, {
																	invoiceNumber: e.target.value,
																})
															}
															onKeyDown={(e) =>
																handleKeyDown(e, assignment.id, rowIdx, 1)
															}
															onPaste={(e) =>
																handlePaste(e, assignment.id, rowIdx, 1)
															}
														/>
													</td>
												</>
											)}

											{/* Fee name */}
											<td className="px-1 py-0.5">
												{isLocked ? (
													<div>
														<span className="text-xs text-slate-700 px-1">
															{getDisplayFeeName(row, feeTypes) || "—"}
														</span>
														{isRejected && row.rejectionReason && (
															<div className="text-[10px] text-red-500 mt-0.5 px-1 italic">
																Lý do: {row.rejectionReason}
															</div>
														)}
													</div>
												) : (
													<select
														className="w-full h-7 px-1 text-xs rounded border border-transparent hover:border-slate-300 focus:border-blue-400 focus:outline-none bg-transparent focus:bg-white cursor-pointer"
														value={row.feeTypeId || ""}
														data-cell={`${assignment.id}:${rowIdx}:${isDisbursementTab ? 2 : 0}`}
														onChange={(e) => {
															const v = e.target.value;
															const ft = feeTypes.find((f) => f.id === v);
															onUpdateRow(assignment.id, rowIdx, {
																feeTypeId: v || null,
																feeName: ft
																	? ft.feeCode || ft.serviceMode || ft.name
																	: "",
															});
														}}
														onKeyDown={(e) => {
															if (e.key === "Tab" || e.key === "Enter")
																handleKeyDown(
																	e,
																	assignment.id,
																	rowIdx,
																	isDisbursementTab ? 2 : 0,
																);
														}}
													>
														<option value="">-- Chọn phí --</option>
														{feeTypes.map((ft) => (
															<option key={ft.id} value={ft.id}>
																{ft.name}
															</option>
														))}
													</select>
												)}
											</td>

											{/* Total fee for Non-Disbursement */}
											{!isDisbursementTab && (
												<td className="px-1 py-0.5">
													<input
														type="text"
														inputMode="decimal"
														disabled={isLocked}
														className={`w-full h-7 px-2 text-xs rounded border border-transparent focus:outline-none focus:ring-0 text-right ${isLocked ? "bg-transparent text-slate-600 cursor-default" : "hover:border-slate-300 focus:border-blue-400 bg-transparent focus:bg-white"}`}
														value={formatAmountPattern(row.totalFee)}
														placeholder="0"
														data-cell={`${assignment.id}:${rowIdx}:1`}
														onChange={(e) =>
															onUpdateRow(assignment.id, rowIdx, {
																totalFee: parseAmountPattern(e.target.value),
															})
														}
														onKeyDown={(e) =>
															handleKeyDown(e, assignment.id, rowIdx, 1)
														}
														onPaste={(e) =>
															handlePaste(e, assignment.id, rowIdx, 1)
														}
													/>
												</td>
											)}
											{/* Removed non-disbursement payment column */}
											{/* Disbursement-only columns */}
											{isDisbursementTab && (
												<>
													<td className="px-1 py-0.5">
														<input
															type="number"
															disabled={isLocked}
															className={`w-full h-7 px-2 text-xs rounded border border-transparent focus:outline-none focus:ring-0 text-right ${isLocked ? "bg-transparent text-slate-600 cursor-default" : "hover:border-slate-300 focus:border-blue-400 bg-transparent focus:bg-white"}`}
															value={row.vatPercent ?? ""}
															placeholder="0"
															data-cell={`${assignment.id}:${rowIdx}:3`}
															onChange={(e) =>
																onUpdateRow(assignment.id, rowIdx, {
																	vatPercent: toNumber(e.target.value),
																})
															}
															onKeyDown={(e) =>
																handleKeyDown(e, assignment.id, rowIdx, 3)
															}
															onPaste={(e) =>
																handlePaste(e, assignment.id, rowIdx, 3)
															}
														/>
													</td>
													<td className="px-1 py-0.5">
														<input
															type="text"
															inputMode="decimal"
															disabled={isLocked}
															className={`w-full h-7 px-2 text-xs rounded border border-transparent focus:outline-none focus:ring-0 text-right ${isLocked ? "bg-transparent text-slate-600 cursor-default" : "hover:border-slate-300 focus:border-blue-400 bg-transparent focus:bg-white"}`}
															value={formatAmountPattern(row.totalVat)}
															placeholder="0"
															data-cell={`${assignment.id}:${rowIdx}:4`}
															onChange={(e) =>
																onUpdateRow(assignment.id, rowIdx, {
																	totalVat: parseAmountPattern(e.target.value),
																})
															}
															onKeyDown={(e) =>
																handleKeyDown(e, assignment.id, rowIdx, 4)
															}
															onPaste={(e) =>
																handlePaste(e, assignment.id, rowIdx, 4)
															}
														/>
													</td>
													<td className="px-1 py-0.5">
														<input
															type="text"
															inputMode="decimal"
															disabled={isLocked}
															className={`w-full h-7 px-2 text-xs rounded border border-transparent focus:outline-none focus:ring-0 text-right ${isLocked ? "bg-transparent text-slate-600 cursor-default" : "hover:border-slate-300 focus:border-blue-400 bg-transparent focus:bg-white"}`}
															value={formatAmountPattern(row.totalFee)}
															placeholder="0"
															data-cell={`${assignment.id}:${rowIdx}:5`}
															onChange={(e) =>
																onUpdateRow(assignment.id, rowIdx, {
																	totalFee: parseAmountPattern(e.target.value),
																})
															}
															onKeyDown={(e) =>
																handleKeyDown(e, assignment.id, rowIdx, 5)
															}
															onPaste={(e) =>
																handlePaste(e, assignment.id, rowIdx, 5)
															}
														/>
													</td>
													<td className="px-1 py-0.5">
														<input
															disabled={isLocked}
															className={`w-full h-7 px-2 text-xs rounded border border-transparent focus:outline-none focus:ring-0 ${isLocked ? "bg-transparent text-slate-600 cursor-default" : "hover:border-slate-300 focus:border-blue-400 bg-transparent focus:bg-white"}`}
															value={row.invoiceLink || ""}
															placeholder="https://..."
															data-cell={`${assignment.id}:${rowIdx}:6`}
															onChange={(e) =>
																onUpdateRow(assignment.id, rowIdx, {
																	invoiceLink: e.target.value,
																})
															}
															onKeyDown={(e) =>
																handleKeyDown(e, assignment.id, rowIdx, 6)
															}
															onPaste={(e) =>
																handlePaste(e, assignment.id, rowIdx, 6)
															}
														/>
													</td>
													<td className="px-1 py-0.5">
														<input
															disabled={isLocked}
															className={`w-full h-7 px-2 text-xs rounded border border-transparent focus:outline-none focus:ring-0 ${isLocked ? "bg-transparent text-slate-600 cursor-default" : "hover:border-slate-300 focus:border-blue-400 bg-transparent focus:bg-white"}`}
															value={row.trackingCode || ""}
															placeholder="Mã tra cứu..."
															data-cell={`${assignment.id}:${rowIdx}:7`}
															onChange={(e) =>
																onUpdateRow(assignment.id, rowIdx, {
																	trackingCode: e.target.value,
																})
															}
															onKeyDown={(e) =>
																handleKeyDown(e, assignment.id, rowIdx, 7)
															}
															onPaste={(e) =>
																handlePaste(e, assignment.id, rowIdx, 7)
															}
														/>
													</td>
												</>
											)}

											{/* Note */}
											<td className="px-1 py-0.5 align-top">
												{isLocked ? (
													<span className="text-xs text-slate-600 px-2 py-1 block whitespace-pre-wrap break-words">
														{row.note || (
															<span className="text-slate-400">—</span>
														)}
													</span>
												) : (
													<textarea
														className="w-full min-h-[28px] px-2 py-1 text-xs rounded border border-transparent hover:border-slate-300 focus:border-blue-400 focus:outline-none focus:ring-0 bg-transparent focus:bg-white resize-none overflow-hidden leading-tight"
														value={row.note || ""}
														placeholder="Ghi chú..."
														rows={1}
														data-cell={`${assignment.id}:${rowIdx}:${isDisbursementTab ? 8 : 2}`}
														onChange={(e) => {
															// Auto-resize
															e.target.style.height = "auto";
															e.target.style.height = `${e.target.scrollHeight}px`;
															onUpdateRow(assignment.id, rowIdx, {
																note: e.target.value,
															});
														}}
														onPaste={(e) =>
															handlePaste(
																e as unknown as React.ClipboardEvent<HTMLInputElement>,
																assignment.id,
																rowIdx,
																isDisbursementTab ? 8 : 2,
															)
														}
													/>
												)}
											</td>

											{/* Invoice Sent Date */}
											{isDisbursementTab && (
												<td className="px-1 py-0.5">
													<input
														disabled={isLocked}
														className={`w-full h-7 px-2 text-xs rounded border border-transparent focus:outline-none focus:ring-0 ${isLocked ? "bg-transparent text-slate-600 cursor-default" : "hover:border-slate-300 focus:border-blue-400 bg-transparent focus:bg-white"}`}
														value={row.invoiceSentDate || ""}
														placeholder="VD: 25/03/2025..."
														data-cell={`${assignment.id}:${rowIdx}:9`}
														onChange={(e) =>
															onUpdateRow(assignment.id, rowIdx, {
																invoiceSentDate: e.target.value,
															})
														}
														onKeyDown={(e) =>
															handleKeyDown(e, assignment.id, rowIdx, 9)
														}
														onPaste={(e) =>
															handlePaste(e, assignment.id, rowIdx, 9)
														}
													/>
												</td>
											)}

											{/* Status column */}
											<td className="px-1 py-0.5 text-center whitespace-nowrap">
												{isApproved ? (
													<span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
														✅ Đã duyệt
													</span>
												) : isRejected ? (
													<span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
														❌ Từ chối
													</span>
												) : (
													<span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-300 font-medium">
														⏳ Chờ duyệt
													</span>
												)}
											</td>

											{/* Delete — hidden for locked rows */}
											<td className="px-1 py-0.5 text-center">
												{!isLocked && (
													<button
														className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-red-400 hover:text-red-600 px-1"
														onClick={() => onRemoveRow(assignment.id, rowIdx)}
														disabled={
															rows.filter(
																(r) => !r.status || r.status === "PENDING",
															).length <= 1
														}
													>
														✕
													</button>
												)}
											</td>
										</tr>
									);
								})}
							</React.Fragment>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

// ─── Main state per section ───────────────────────────────────────────────────

type SectionKey = "fcl" | "lcl" | "disbursement";
type TabKey = SectionKey | "summary";

type SectionState = {
	/** rows keyed by FCR id */
	rowsMap: Record<string, CostRow[]>;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VendorPortalPage() {
	const router = useRouter();
	const [loading, setLoading] = useState(true);
	const [session, setSession] = useState<VendorSession | null>(null);
	const [assignments, setAssignments] = useState<Assignment[]>([]);
	const [feeTypesFCL, setFeeTypesFCL] = useState<FeeType[]>([]);
	const [feeTypesLCL, setFeeTypesLCL] = useState<FeeType[]>([]);
	const [saving, setSaving] = useState(false);

	// Tab navigation
	const [activeSection, setActiveSection] = useState<TabKey>("fcl");
	const [isTableFocusMode, setIsTableFocusMode] = useState(false);

	// Per-section state (rows only)
	const [sectionState, setSectionState] = useState<
		Record<SectionKey, SectionState>
	>({
		fcl: { rowsMap: {} },
		lcl: { rowsMap: {} },
		disbursement: { rowsMap: {} },
	});

	// Global search keyword
	const [globalSearch, setGlobalSearch] = useState("");

	// Summary tab section toggles
	const [summarySelectedSections, setSummarySelectedSections] = useState<
		Record<SectionKey, boolean>
	>({
		fcl: true,
		lcl: true,
		disbursement: true,
	});

	// Import error dialog
	const [importErrors, setImportErrors] = useState<string[]>([]);

	// Vehicle info edits (fcrId → value), auto-saved on blur
	const [vehicleInfoMap, setVehicleInfoMap] = useState<Record<string, string>>(
		{},
	);
	const [plateNumberMap, setPlateNumberMap] = useState<Record<string, string>>(
		{},
	);
	const [containerNoMap, setContainerNoMap] = useState<Record<string, string>>(
		{},
	);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const tab = params.get("tab");
		const focusMode = params.get("focusTable") === "1";

		if (
			tab === "fcl" ||
			tab === "lcl" ||
			tab === "disbursement" ||
			tab === "summary"
		) {
			setActiveSection(tab);
		}

		if (focusMode) {
			setIsTableFocusMode(true);
		}
	}, []);

	useEffect(() => {
		if (!isTableFocusMode) return;

		const prevHtmlOverflow = document.documentElement.style.overflow;
		const prevBodyOverflow = document.body.style.overflow;

		document.documentElement.style.overflow = "hidden";
		document.body.style.overflow = "hidden";

		return () => {
			document.documentElement.style.overflow = prevHtmlOverflow;
			document.body.style.overflow = prevBodyOverflow;
		};
	}, [isTableFocusMode]);

	const openTableInNewTab = useCallback((section: TabKey) => {
		const url = new URL(window.location.href);
		url.searchParams.set("focusTable", "1");
		url.searchParams.set("tab", section);
		window.open(url.toString(), "_blank", "noopener,noreferrer");
	}, []);

	// Helper: compute default date range (last 30 days + 7 days ahead)
	function getDefaultDateRange() {
		const today = new Date();
		const from = new Date(today);
		from.setDate(today.getDate() - 30);
		const to = new Date(today);
		to.setDate(today.getDate() + 7);
		return {
			from: from.toISOString().slice(0, 10),
			to: to.toISOString().slice(0, 10),
		};
	}

	// Global date filter – default to last week (Mon → Sun)
	const [globalDateFrom, setGlobalDateFrom] = useState(() => {
		const today = new Date();
		const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...
		const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek + 6;
		const lastMonday = new Date(today);
		lastMonday.setDate(today.getDate() - daysToLastMonday);
		return lastMonday.toISOString().slice(0, 10);
	});
	const [globalDateTo, setGlobalDateTo] = useState(() => {
		const today = new Date();
		const dayOfWeek = today.getDay();
		// Next Sunday (including future dates)
		const daysToNextSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
		const nextSunday = new Date(today);
		nextSunday.setDate(today.getDate() + daysToNextSunday);
		return nextSunday.toISOString().slice(0, 10);
	});

	// ── Derived lists ──
	const fclAssignments = useMemo(
		() => assignments.filter((a) => isFCL(a.serviceMode)),
		[assignments],
	);
	const lclAssignments = useMemo(
		() => assignments.filter((a) => !isFCL(a.serviceMode)),
		[assignments],
	);

	// ── Fetch helpers ──

	const fetchSession = useCallback(async () => {
		const res = await fetch("/api/external/vendor-portal/session");
		if (!res.ok) {
			setSession(null);
			return null;
		}
		const data = await res.json();
		setSession(data.vendor);
		return data.vendor as VendorSession;
	}, []);

	const fetchAssignments = useCallback(async () => {
		const res = await fetch("/api/external/vendor-portal/assignments");
		if (!res.ok) throw new Error("Failed to fetch assignments");
		const data = await res.json();
		return (data.data || []) as Assignment[];
	}, []);

	const fetchFeeTypes = useCallback(async (mode: "FCL" | "LCL") => {
		const res = await fetch(
			`/api/external/vendor-portal/fee-types?serviceMode=${mode}`,
		);
		if (!res.ok) return [];
		const data = await res.json();
		return (data.feeTypes || []) as FeeType[];
	}, []);

	// ── Build initial rows for an assignment ──
	function buildRows(assignment: Assignment, disbursementOnly: boolean) {
		const costs = disbursementOnly
			? assignment.costs.filter((c) => c.isDisbursement)
			: assignment.costs.filter((c) => !c.isDisbursement);

		// Load ALL costs into the grid — APPROVED/REJECTED shown as read-only
		if (costs.length > 0) {
			return costs.map((c, i) => ({ ...c, rowOrder: c.rowOrder || i + 1 }));
		}
		return [makeBlankCostRow({ rowOrder: 1 })];
	}

	// ── Bootstrap ──
	useEffect(() => {
		const bootstrap = async () => {
			setLoading(true);
			try {
				const vendor = await fetchSession();
				if (!vendor) return;

				const [list, fclFees, lclFees] = await Promise.all([
					fetchAssignments(),
					fetchFeeTypes("FCL"),
					fetchFeeTypes("LCL"),
				]);

				setAssignments(list);
				setFeeTypesFCL(fclFees);
				setFeeTypesLCL(lclFees);

				// Initialise vehicleInfoMap from fetched data
				const viMap: Record<string, string> = {};
				const plateMap: Record<string, string> = {};
				const containerMap: Record<string, string> = {};
				for (const a of list) {
					if (a.vehicleInfo) viMap[a.id] = a.vehicleInfo;
					if (a.plateNumber) plateMap[a.id] = a.plateNumber;
					if (a.containerNo) containerMap[a.id] = a.containerNo;
				}
				setVehicleInfoMap(viMap);
				setPlateNumberMap(plateMap);
				setContainerNoMap(containerMap);

				// ── initialise sectionState rows from fetched data ──
				const buildSectionRows = (
					items: Assignment[],
					disbursement: boolean,
				): Record<string, CostRow[]> => {
					const map: Record<string, CostRow[]> = {};
					for (const a of items) {
						map[a.id] = buildRows(a, disbursement);
					}
					return map;
				};

				const fclList = list.filter((a) => isFCL(a.serviceMode));
				const lclList = list.filter((a) => !isFCL(a.serviceMode));

				setSectionState({
					fcl: { rowsMap: buildSectionRows(fclList, false) },
					lcl: { rowsMap: buildSectionRows(lclList, false) },
					disbursement: { rowsMap: buildSectionRows(list, true) },
				});
			} catch (err) {
				console.error(err);
				toast.error("Không thể tải dữ liệu");
			} finally {
				setLoading(false);
			}
		};
		bootstrap();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [buildRows, fetchAssignments, fetchFeeTypes, fetchSession]);

	// ── Section helpers ──

	function getBaseAssignments(section: SectionKey): Assignment[] {
		if (section === "disbursement") return assignments;
		if (section === "fcl") return fclAssignments;
		return lclAssignments;
	}

	function getFilteredAssignments(section: SectionKey): Assignment[] {
		const base = getBaseAssignments(section);
		const kw = globalSearch.trim().toLowerCase();
		return base.filter((a) => {
			// Date filter — nếu có bộ lọc ngày mà record không có ngày → loại ra
			if (globalDateFrom || globalDateTo) {
				if (!a.implementationDate) return false;
				const d = a.implementationDate.slice(0, 10);
				if (globalDateFrom && d < globalDateFrom) return false;
				if (globalDateTo && d > globalDateTo) return false;
			}
			// Keyword search
			if (kw) {
				const haystack = [
					a.jobNumber,
					a.fcrNumber,
					a.requestNumber,
					a.billOrBooking,
					a.containerNo,
					a.plateNumber,
					a.shipper,
				]
					.filter(Boolean)
					.join(" ")
					.toLowerCase();
				if (!haystack.includes(kw)) return false;
			}
			return true;
		});
	}

	// ── Row helpers ──

	function getRows(section: SectionKey, fcrId: string): CostRow[] {
		return (
			sectionState[section].rowsMap[fcrId] || [
				makeBlankCostRow({ rowOrder: 1 }),
			]
		);
	}

	function setRows(section: SectionKey, fcrId: string, rows: CostRow[]) {
		setSectionState((prev) => ({
			...prev,
			[section]: {
				...prev[section],
				rowsMap: {
					...prev[section].rowsMap,
					[fcrId]: rows,
				},
			},
		}));
	}

	function updateRow(
		section: SectionKey,
		fcrId: string,
		index: number,
		patch: Partial<CostRow>,
	) {
		const current = getRows(section, fcrId);
		const next = [...current];
		next[index] = { ...next[index], ...patch };
		setRows(section, fcrId, next);
	}

	function _addRow(section: SectionKey, fcrId: string) {
		const current = getRows(section, fcrId);
		setRows(section, fcrId, [
			...current,
			makeBlankCostRow({ rowOrder: current.length + 1 }),
		]);
	}

	function removeRow(section: SectionKey, fcrId: string, index: number) {
		const current = getRows(section, fcrId);
		if (current.length <= 1) return;
		const next = current
			.filter((_, i) => i !== index)
			.map((r, i) => ({ ...r, rowOrder: i + 1 }));
		setRows(section, fcrId, next);
	}

	// ── Vehicle info ──

	function handleVehicleInfoChange(id: string, value: string) {
		setVehicleInfoMap((prev) => ({ ...prev, [id]: value }));
	}

	function handlePlateNumberChange(id: string, value: string) {
		setPlateNumberMap((prev) => ({
			...prev,
			[id]: standardFormatPlate(value) || "",
		}));
	}

	function handleContainerNoChange(id: string, value: string) {
		setContainerNoMap((prev) => ({
			...prev,
			[id]: normalizeContainerNo(value),
		}));
	}

	// ── Save ──

	async function saveSection(section: SectionKey) {
		const targets = getFilteredAssignments(section);
		const isDisbursement = section === "disbursement";

		if (!targets.length) {
			toast.error("Không có lô hàng nào để lưu (kiểm tra bộ lọc)");
			return;
		}
		const payloadRows: {
			id?: string;
			truckingFollowUpId: string;
			fcrId: string;
			feeTypeId?: string | null;
			feeName: string;
			isDisbursement: boolean;
			vatPercent?: number | null;
			totalVat?: number | null;
			totalFee?: number | null;
			sellerTaxCode?: string | null;
			invoiceNumber?: string | null;
			invoiceLink?: string | null;
			trackingCode?: string | null;
			note?: string | null;
			rowOrder: number;
		}[] = [];

		for (const a of targets) {
			if (!a.truckingFollowUpId) continue;
			const rows = getRows(section, a.id);
			for (const [idx, row] of rows.entries()) {
				if (row.status === "APPROVED" || row.status === "REJECTED") continue;

				if (
					!row.feeName.trim() &&
					row.totalFee !== null &&
					row.totalFee !== undefined
				) {
					const label = getAssignmentLabel(a, targets.indexOf(a));
					toast.error(`[${label}] Dòng ${idx + 1}: Cần điền Tên phí`);
					return;
				}
				if (!row.feeName.trim()) continue;
				payloadRows.push({
					...row,
					rowOrder: idx + 1,
					fcrId: a.id,
					truckingFollowUpId: a.truckingFollowUpId,
					isDisbursement: isDisbursement ? true : row.isDisbursement,
					...(isDisbursement
						? {}
						: {
								vatPercent: null,
								totalVat: null,
								sellerTaxCode: null,
								invoiceNumber: null,
								invoiceLink: null,
								trackingCode: null,
								invoiceSentDate: null,
							}),
				});
			}
		}

		if (!payloadRows.length && isDisbursement) {
			toast.error("Cần ít nhất 1 dòng có tên phí");
			return;
		}

		if (!isDisbursement && payloadRows.length > 0) {
			const missingFee = payloadRows.filter(
				(r) =>
					r.totalFee === null || r.totalFee === undefined || r.totalFee <= 0,
			);
			if (missingFee.length > 0) {
				const labels = missingFee.map((r) => `[${r.feeName}]`).join(", ");
				toast.error(`Tổng Phí (Trước VAT) phải lớn hơn 0 cho: ${labels}`);
				return;
			}
		}

		if (isDisbursement) {
			const saveErrors: string[] = [];
			for (const r of payloadRows) {
				const label = `[${r.feeName}]`;
				if (
					r.totalFee === null ||
					r.totalFee === undefined ||
					r.totalFee <= 0
				) {
					saveErrors.push(`${label}: Tổng Phí (Gồm VAT) phải lớn hơn 0`);
				}
				if (r.vatPercent === null || r.vatPercent === undefined) {
					saveErrors.push(`${label}: % VAT không được để trống`);
				} else if (r.vatPercent < 0 || r.vatPercent > 10) {
					saveErrors.push(`${label}: % VAT "${r.vatPercent}" phải từ 0 đến 10`);
				}
				if (r.totalVat === null || r.totalVat === undefined) {
					saveErrors.push(`${label}: Tổng VAT không được để trống`);
				} else if (r.totalVat < 0 || Math.floor(r.totalVat) !== r.totalVat) {
					saveErrors.push(`${label}: Tổng VAT phải là số nguyên không âm`);
				}
				// SGN branch: MST only mandatory if VAT > 0
				const isSgnBranch = session?.site === "SGN";
				const isMstRequired = !isSgnBranch || (r.totalVat || 0) > 0;

				if (isMstRequired && (!r.sellerTaxCode || !r.sellerTaxCode.trim())) {
					saveErrors.push(`${label}: MST bên bán không được để trống`);
				}
				if (!r.invoiceNumber || !r.invoiceNumber.trim()) {
					saveErrors.push(`${label}: Số hóa đơn không được để trống`);
				}
			}
			if (saveErrors.length > 0) {
				setImportErrors(saveErrors);
				return;
			}
		}

		const replaceForFcrIds = targets.map((a) => a.id);

		setSaving(true);
		try {
			if (!isDisbursement) {
				const normalize = (v: string | null | undefined) => (v || "").trim();
				const normalizePlateForCompare = cleanPlateNumber;

				for (const a of targets) {
					if (plateNumberMap[a.id] === undefined) continue;

					const currentPlateNumber = isValidPlateNumber(a.plateNumber)
						? normalizePlateForCompare(a.plateNumber)
						: "";
					const nextPlateNumber = isValidPlateNumber(plateNumberMap[a.id])
						? normalizePlateForCompare(plateNumberMap[a.id])
						: "";

					if (
						nextPlateNumber &&
						nextPlateNumber !== currentPlateNumber &&
						!isValidPlateNumber(nextPlateNumber)
					) {
						const label = getAssignmentLabel(a, targets.indexOf(a));
						throw new Error(`[${label}] ${PLATE_NUMBER_HINT}`);
					}
				}

				for (const a of targets) {
					if (containerNoMap[a.id] === undefined) continue;

					const currentContainer = normalizeContainerNo(
						normalize(a.containerNo),
					);
					const nextContainer = normalizeContainerNo(
						normalize(containerNoMap[a.id]),
					);

					if (
						nextContainer &&
						nextContainer !== currentContainer &&
						!isValidContainerNo(nextContainer)
					) {
						const label = getAssignmentLabel(a, targets.indexOf(a));
						throw new Error(`[${label}] ${CONTAINER_NUMBER_HINT}`);
					}
				}

				const assignmentUpdates = targets
					.map((a) => {
						const currentVehicleInfo = normalize(a.vehicleInfo);
						const currentPlateNumber =
							standardFormatPlate(normalize(a.plateNumber)) || "";
						const currentContainerNo = normalizeContainerNo(
							normalize(a.containerNo),
						);

						const nextVehicleInfo = normalize(vehicleInfoMap[a.id]);
						const nextPlateNumber =
							standardFormatPlate(normalize(plateNumberMap[a.id])) || "";
						const nextContainerNo = normalizeContainerNo(
							normalize(containerNoMap[a.id]),
						);

						const patch: {
							fcrId: string;
							vehicleInfo?: string | null;
							plateNumber?: string | null;
							containerNo?: string | null;
						} = { fcrId: a.id };

						if (
							vehicleInfoMap[a.id] !== undefined &&
							nextVehicleInfo !== currentVehicleInfo
						) {
							patch.vehicleInfo = nextVehicleInfo || null;
						}

						if (
							plateNumberMap[a.id] !== undefined &&
							nextPlateNumber !== currentPlateNumber
						) {
							patch.plateNumber = nextPlateNumber || null;
						}

						if (
							containerNoMap[a.id] !== undefined &&
							nextContainerNo !== currentContainerNo
						) {
							patch.containerNo = nextContainerNo || null;
						}

						return patch;
					})
					.filter(
						(p) =>
							p.vehicleInfo !== undefined ||
							p.plateNumber !== undefined ||
							p.containerNo !== undefined,
					);

				await Promise.all(
					assignmentUpdates.map(async (patch) => {
						const res = await fetch(
							"/api/external/vendor-portal/vehicle-info",
							{
								method: "PATCH",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify(patch),
							},
						);
						if (!res.ok) {
							const err = await res.json().catch(() => ({}));
							throw new Error(err.message || "Lưu thông tin lô hàng thất bại");
						}
					}),
				);
			}

			if (payloadRows.length > 0) {
				const res = await fetch("/api/external/vendor-portal/costs", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "MANUAL",
						replaceForFcrIds,
						isDisbursementMode: isDisbursement,
						rows: payloadRows,
					}),
				});

				if (!res.ok) {
					const err = await res.json();
					throw new Error(err.message || "Save failed");
				}
			}

			toast.success(`Đã lưu thành công ${targets.length} lô hàng`);

			const list = await fetchAssignments();
			setAssignments(list);
			const viMap: Record<string, string> = {};
			const plateMap: Record<string, string> = {};
			const containerMap: Record<string, string> = {};
			for (const a of list) {
				if (a.vehicleInfo) viMap[a.id] = a.vehicleInfo;
				if (a.plateNumber) plateMap[a.id] = a.plateNumber;
				if (a.containerNo) containerMap[a.id] = a.containerNo;
			}
			setVehicleInfoMap(viMap);
			setPlateNumberMap(plateMap);
			setContainerNoMap(containerMap);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Lưu thất bại");
		} finally {
			setSaving(false);
		}
	}

	// ── Export Excel ──

	async function exportExcel(section: SectionKey) {
		const targets = getFilteredAssignments(section);
		const isDisbursement = section === "disbursement";
		const showContainerColumn = section !== "lcl";
		const showBillOrBookingColumn =
			section === "fcl" || section === "disbursement";
		const showVehicleInfoColumn = section === "fcl" || section === "lcl";

		if (!targets.length) {
			toast.error("Không có lô hàng nào để export (kiểm tra bộ lọc)");
			return;
		}

		// ── Header row – must match UI column labels exactly ──
		const headers = [
			"STT",
			"Ngày TH",
			"Tên công ty",
			"Lô / Job",
			...(showBillOrBookingColumn ? ["Bill/Booking"] : []),
			...(showContainerColumn && !isDisbursement ? ["Số container"] : []),
			...(!isDisbursement ? ["Số xe"] : []),
			"Loại xe",
			...(!isDisbursement ? ["Điểm đi", "Giờ lấy hàng", "Điểm đến"] : []),
			...(showVehicleInfoColumn ? ["Thông tin xe"] : []),
			"Số tờ khai",
			...(showContainerColumn && isDisbursement ? ["Số container"] : []),
			...(isDisbursement ? ["MST bên bán", "Số hóa đơn"] : []),
			"Tên phí",
			...(!isDisbursement ? ["Tổng Phí (Trước VAT)"] : []),
			...(isDisbursement
				? [
						"% VAT",
						"Tổng VAT",
						"Tổng Phí (Gồm VAT)",
						"Link hóa đơn",
						"Mã tra cứu",
					]
				: []),
			"Ghi chú",
			...(isDisbursement ? ["Ngày gửi HĐ"] : []),
		];

		const allRows: unknown[][] = [];

		for (const a of targets) {
			// Export tất cả PENDING rows (kể cả chưa điền tên phí) — APPROVED/REJECTED không export
			const allAssignmentRows = getRows(section, a.id);
			const exportRows = allAssignmentRows.filter(
				(r) => !r.status || r.status === "PENDING",
			);
			if (exportRows.length === 0) continue;

			const lotLabel =
				[a.jobNumber, a.fcrNumber].filter(Boolean).join(" / ") ||
				a.id.slice(0, 8);
			const dateCell = formatDate(a.implementationDate);

			const stt = targets.indexOf(a) + 1;

			for (const row of exportRows) {
				const r: unknown[] = [
					stt,
					dateCell,
					a.shipperName || "",
					lotLabel,
					...(showBillOrBookingColumn ? [a.billOrBooking || ""] : []),
					...(showContainerColumn && !isDisbursement
						? [a.containerNo || ""]
						: []),
					...(!isDisbursement ? [a.plateNumber || ""] : []),
					a.truckType || "",
					...(!isDisbursement
						? [a.pickupAt || "", a.pickUpTime || "", a.deliveryAt || ""]
						: []),
					...(showVehicleInfoColumn
						? [vehicleInfoMap[a.id] ?? a.vehicleInfo ?? ""]
						: []),
					a.declarationNumbers.join(", "),
					...(showContainerColumn && isDisbursement
						? [a.containerNo || ""]
						: []),
					...(isDisbursement
						? [row.sellerTaxCode || "", row.invoiceNumber || ""]
						: []),
					getDisplayFeeName(
						row,
						section === "lcl"
							? feeTypesLCL
							: section === "disbursement"
								? [...feeTypesFCL, ...feeTypesLCL]
								: feeTypesFCL,
					),
					...(!isDisbursement ? [row.totalFee ?? null] : []),
					...(isDisbursement
						? [
								row.vatPercent ?? "",
								row.totalVat ?? null,
								row.totalFee ?? null,
								row.invoiceLink || "",
								row.trackingCode || "",
							]
						: []),
					row.note || "",
					...(isDisbursement ? [row.invoiceSentDate || ""] : []),
				];
				allRows.push(r);
			}
		}

		const ExcelJS = await import("exceljs");
		const workbook = new ExcelJS.Workbook();
		const worksheet = workbook.addWorksheet(section);

		worksheet.addRow(headers);
		for (const row of allRows) {
			worksheet.addRow(row);
		}

		const headerRow = worksheet.getRow(1);
		headerRow.font = { bold: true };
		worksheet.views = [{ state: "frozen", ySplit: 1 }];

		const availableFeeTypes =
			section === "lcl"
				? feeTypesLCL
				: section === "disbursement"
					? [
							...feeTypesFCL,
							...feeTypesLCL.filter(
								(l) => !feeTypesFCL.some((f) => f.id === l.id),
							),
						]
					: feeTypesFCL;
		const feeNames = Array.from(
			new Set(availableFeeTypes.map((f) => f.name.trim()).filter(Boolean)),
		).sort((a, b) => a.localeCompare(b, "vi"));
		const totalFeeCol =
			headers.indexOf(
				isDisbursement ? "Tổng Phí (Gồm VAT)" : "Tổng Phí (Trước VAT)",
			) + 1;
		const paymentCol = headers.indexOf("Tổng thanh toán (VAT 8%)") + 1;
		const totalVatCol = headers.indexOf("Tổng VAT") + 1;
		const feeNameCol = headers.indexOf("Tên phí") + 1;
		const amountFormat = "#,##0";
		const templateRowCount = 2000;

		const applyNumberFormat = (col: number) => {
			if (col <= 0) return;
			for (let rowNum = 2; rowNum <= templateRowCount + 1; rowNum++) {
				worksheet.getCell(rowNum, col).numFmt = amountFormat;
			}
		};

		applyNumberFormat(totalFeeCol);
		applyNumberFormat(totalVatCol);
		applyNumberFormat(paymentCol);

		if (feeNameCol > 0 && feeNames.length > 0) {
			let formula: string | null = null;

			const escaped = feeNames.map((n) => n.replace(/"/g, '""'));
			const inlineFormula = `"${escaped.join(",")}"`;

			if (inlineFormula.length <= 255) {
				formula = inlineFormula;
			} else {
				const listSheet = workbook.addWorksheet("_lists");
				listSheet.state = "veryHidden";
				for (let i = 0; i < feeNames.length; i++) {
					listSheet.getCell(i + 1, 1).value = feeNames[i];
				}
				formula = `'_lists'!$A$1:$A$${feeNames.length}`;
			}

			for (let rowNum = 2; rowNum <= templateRowCount + 1; rowNum++) {
				worksheet.getCell(rowNum, feeNameCol).dataValidation = {
					type: "list",
					allowBlank: true,
					formulae: [formula],
					showErrorMessage: true,
					errorTitle: "Tên phí không hợp lệ",
					error: "Vui lòng chọn tên phí từ danh sách.",
				};
			}
		}

		worksheet.columns = headers.map((h, i) => {
			const maxLen = allRows.reduce((max, row) => {
				const cell = String(row[i] ?? "");
				return Math.max(max, cell.length);
			}, h.length);
			return { width: Math.min(Math.max(maxLen + 2, 10), 50) };
		});

		const filename =
			section === "fcl"
				? "vendor-costs-Container"
				: section === "lcl"
					? "vendor-costs-XeTai"
					: "vendor-costs-ChiHo";

		const buffer = await workbook.xlsx.writeBuffer();
		const blob = new Blob([buffer as ArrayBuffer], {
			type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		});
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = `${filename}.xlsx`;
		anchor.click();
		URL.revokeObjectURL(url);
	}

	// ── Import Excel ──

	async function importExcel(section: SectionKey, file: File) {
		const isDisbursement = section === "disbursement";
		const effectiveAssignments = getBaseAssignments(section);

		const data = await file.arrayBuffer();
		const workbook = XLSX.read(data);
		const firstSheetName = workbook.SheetNames[0];

		// ── Validate file belongs to this tab ──
		const tabLabels: Record<string, string> = {
			fcl: "Container",
			lcl: "Xe tải",
			disbursement: "Chi hộ",
		};
		if (
			firstSheetName === "fcl" ||
			firstSheetName === "lcl" ||
			firstSheetName === "disbursement"
		) {
			// File was exported from our app – validate tab matches
			if (firstSheetName !== section) {
				setImportErrors([
					`File này được export từ tab "${tabLabels[firstSheetName]}", không thể import vào tab "${tabLabels[section]}". Vui lòng mở đúng tab trước khi import.`,
				]);
				return;
			}
		}
		// (files without a recognised sheet name are accepted – legacy/manual files)

		const firstSheet = workbook.Sheets[firstSheetName];
		const jsonRows =
			XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet);

		if (!jsonRows.length) {
			toast.error("File Excel không có dữ liệu");
			return;
		}

		// ── Helper: read cell by possible VI or legacy EN key ──
		function readCell(row: Record<string, unknown>, ...keys: string[]): string {
			for (const k of keys) {
				if (row[k] !== undefined && row[k] !== null && row[k] !== "") {
					return String(row[k]).trim();
				}
			}
			return "";
		}

		// ── Resolve fee types for this section ──
		const availableFeeTypes =
			section === "lcl"
				? feeTypesLCL
				: section === "disbursement"
					? [
							...feeTypesFCL,
							...feeTypesLCL.filter(
								(l) => !feeTypesFCL.some((f) => f.id === l.id),
							),
						]
					: feeTypesFCL;

		// ───────────────────────────────────────────────────────
		// PASS 1 – VALIDATE (collect all errors, stop if any)
		// ───────────────────────────────────────────────────────
		const errors: string[] = [];
		const importedPlateByAssignment = new Map<string, string>();
		const importedContainerByAssignment = new Map<string, string>();

		for (const [idx, row] of jsonRows.entries()) {
			const line = idx + 2; // Excel row number (row 1 = header)

			// Skip blank rows (no relevant data filled in)
			const hasFeeName = readCell(row, "Tên phí", "feeName") !== "";
			const hasTotalFee = readCell(row, "Tổng phí", "totalFee") !== "";
			const hasPlateNumber = readCell(row, "Số xe", "plateNumber") !== "";
			const hasContainerNo =
				readCell(row, "Số container", "containerNo") !== "";
			const hasCostPayload = hasFeeName || hasTotalFee;
			if (!hasFeeName && !hasTotalFee && !hasPlateNumber && !hasContainerNo)
				continue;

			// ── Lô / Job ──
			const lotCell = readCell(row, "Lô / Job", "fcrNumber", "jobNumber");
			let matchedAssignment: Assignment | undefined;
			if (!lotCell) {
				errors.push(`Dòng ${line}: Cột "Lô / Job" bị trống`);
			} else {
				const cellVal = lotCell.trim().toLowerCase();
				matchedAssignment = effectiveAssignments.find((a) => {
					const expected =
						[a.jobNumber, a.fcrNumber].filter(Boolean).join(" / ") ||
						a.id.slice(0, 8);
					if (expected.toLowerCase() === cellVal) return true;
					const job = a.jobNumber?.trim().toLowerCase();
					const fcr = a.fcrNumber?.trim().toLowerCase();
					if (job && fcr && cellVal === `${job} - ${fcr}`) return true;
					if (job && fcr && cellVal === `${job} / ${fcr}`) return true;
					if (fcr && cellVal === fcr) return true;
					if (job && cellVal === job) return true;
					return false;
				});
				if (!matchedAssignment) {
					errors.push(
						`Dòng ${line}: Lô/Job "${lotCell}" không tìm thấy trong danh sách`,
					);
				}
			}

			// Vehicle/container columns are editable in Container tab.
			if (section === "fcl" && matchedAssignment) {
				const importedPlateRaw = readCell(row, "Số xe", "plateNumber");
				if (importedPlateRaw) {
					const importedPlateComparable = cleanPlateNumber(importedPlateRaw);
					const currentPlateComparable = cleanPlateNumber(
						matchedAssignment.plateNumber || "",
					);
					if (importedPlateComparable !== currentPlateComparable) {
						const formattedPlate = standardFormatPlate(importedPlateRaw) || "";
						if (!isValidPlateNumber(formattedPlate)) {
							errors.push(
								`Dòng ${line}: Cột "Số xe" không hợp lệ (${PLATE_NUMBER_HINT})`,
							);
						} else {
							const existing = importedPlateByAssignment.get(
								matchedAssignment.id,
							);
							if (existing && existing !== formattedPlate) {
								errors.push(
									`Dòng ${line}: Lô/Job "${lotCell}" có nhiều giá trị "Số xe" khác nhau trong cùng file`,
								);
							} else {
								importedPlateByAssignment.set(
									matchedAssignment.id,
									formattedPlate,
								);
							}
						}
					}
				}

				const importedContainerRaw = readCell(
					row,
					"Số container",
					"containerNo",
				);
				if (importedContainerRaw) {
					const normalizedContainer =
						normalizeContainerNo(importedContainerRaw);
					const currentContainer = normalizeContainerNo(
						matchedAssignment.containerNo || "",
					);
					if (normalizedContainer !== currentContainer) {
						if (!isValidContainerNo(normalizedContainer)) {
							errors.push(
								`Dòng ${line}: Cột "Số container" không hợp lệ (${CONTAINER_NUMBER_HINT})`,
							);
						} else {
							const existing = importedContainerByAssignment.get(
								matchedAssignment.id,
							);
							if (existing && existing !== normalizedContainer) {
								errors.push(
									`Dòng ${line}: Lô/Job "${lotCell}" có nhiều giá trị "Số container" khác nhau trong cùng file`,
								);
							} else {
								importedContainerByAssignment.set(
									matchedAssignment.id,
									normalizedContainer,
								);
							}
						}
					}
				}
			}

			if (hasCostPayload) {
				// ── Tên phí ──
				const feeName = readCell(row, "Tên phí", "feeName");
				if (!feeName) {
					errors.push(`Dòng ${line}: Tên phí không được để trống`);
				} else {
					const ftMatch = availableFeeTypes.find(
						(ft) => ft.name.toLowerCase() === feeName.toLowerCase(),
					);
					if (!ftMatch) {
						errors.push(
							`Dòng ${line}: Tên phí "${feeName}" không hợp lệ (không có trong danh mục phí)`,
						);
					}
				}

				// ── Tổng phí – phải là số nguyên không âm ──
				const totalFeeStr = readCell(
					row,
					"Tổng Phí (Gồm VAT)",
					"Tổng Phí (Trước VAT)",
					"Tổng phí",
					"totalFee",
				);
				if (totalFeeStr === "") {
					errors.push(
						`Dòng ${line}: Tổng phí không được để trống (phải lớn hơn 0)`,
					);
				} else {
					const n = parseAmountPattern(totalFeeStr);
					if (n === null || !Number.isFinite(n) || Math.floor(n) !== n) {
						errors.push(`Dòng ${line}: Tổng phí "${totalFeeStr}" không hợp lệ`);
					} else if (n <= 0) {
						errors.push(
							`Dòng ${line}: Tổng phí "${totalFeeStr}" phải lớn hơn 0`,
						);
					}
				}

				// ── % VAT / Tổng VAT (chi hộ) ──
				if (isDisbursement) {
					const vatStr = readCell(row, "% VAT", "vatPercent");
					if (vatStr === "") {
						errors.push(`Dòng ${line}: % VAT không được để trống`);
					} else {
						const vat = Number(vatStr);
						if (Number.isNaN(vat) || vat < 0 || vat > 10) {
							errors.push(`Dòng ${line}: % VAT "${vatStr}" phải từ 0 đến 10`);
						}
					}

					const totalVatStr = readCell(row, "Tổng VAT", "totalVat");
					if (totalVatStr === "") {
						errors.push(`Dòng ${line}: Tổng VAT không được để trống`);
					} else {
						const tv = parseAmountPattern(totalVatStr);
						if (tv === null) {
							errors.push(
								`Dòng ${line}: Tổng VAT "${totalVatStr}" phải là số nguyên không âm`,
							);
						} else if (
							!Number.isFinite(tv) ||
							tv < 0 ||
							Math.floor(tv) !== tv
						) {
							errors.push(
								`Dòng ${line}: Tổng VAT "${totalVatStr}" phải là số nguyên không âm`,
							);
						}
					}
				}

				// ── MST bên bán ──
				const isSgnBranch = session?.site === "SGN";
				const totalVatStrForMstCheck = readCell(row, "Tổng VAT", "totalVat");
				const totalVatValForMstCheck =
					parseAmountPattern(totalVatStrForMstCheck) || 0;
				const isMstRequired = !isSgnBranch || totalVatValForMstCheck > 0;

				if (isMstRequired) {
					const sellerTaxCode = readCell(row, "MST bên bán", "sellerTaxCode");
					if (!sellerTaxCode || !sellerTaxCode.trim()) {
						errors.push(`Dòng ${line}: MST bên bán không được để trống`);
					}
				}
			}
		}

		// ── Nếu có lỗi → hiện dialog, DỪNG import ──
		if (errors.length > 0) {
			setImportErrors(errors);
			return; // STOP – nothing is imported
		}

		// ───────────────────────────────────────────────────────
		// PASS 2 – APPLY (validation passed, safe to import)
		// ───────────────────────────────────────────────────────
		const grouped = new Map<string, CostRow[]>();
		const importedPlateUpdates = new Map<string, string>();
		const importedContainerUpdates = new Map<string, string>();

		for (const [idx, row] of jsonRows.entries()) {
			const lotCell = readCell(row, "Lô / Job", "fcrNumber", "jobNumber");

			// Skip blank rows
			const hasFeeName = readCell(row, "Tên phí", "feeName") !== "";
			const hasTotalFee =
				readCell(
					row,
					"Tổng Phí (Gồm VAT)",
					"Tổng Phí (Trước VAT)",
					"Tổng phí",
					"totalFee",
				) !== "";
			const hasPlateNumber = readCell(row, "Số xe", "plateNumber") !== "";
			const hasContainerNo =
				readCell(row, "Số container", "containerNo") !== "";
			if (!hasFeeName && !hasTotalFee && !hasPlateNumber && !hasContainerNo)
				continue;

			const cellVal = lotCell.trim().toLowerCase();
			const assignment = effectiveAssignments.find((a) => {
				const expected =
					[a.jobNumber, a.fcrNumber].filter(Boolean).join(" / ") ||
					a.id.slice(0, 8);
				if (expected.toLowerCase() === cellVal) return true;
				const job = a.jobNumber?.trim().toLowerCase();
				const fcr = a.fcrNumber?.trim().toLowerCase();
				if (job && fcr && cellVal === `${job} - ${fcr}`) return true;
				if (job && fcr && cellVal === `${job} / ${fcr}`) return true;
				if (fcr && cellVal === fcr) return true;
				if (job && cellVal === job) return true;
				return false;
			})!; // safe – already validated above

			if (section === "fcl") {
				const importedPlateRaw = readCell(row, "Số xe", "plateNumber");
				if (importedPlateRaw) {
					const formattedPlate = standardFormatPlate(importedPlateRaw) || "";
					const importedComparable = cleanPlateNumber(formattedPlate);
					const currentComparable = cleanPlateNumber(
						assignment.plateNumber || "",
					);
					if (importedComparable !== currentComparable) {
						importedPlateUpdates.set(assignment.id, formattedPlate);
					}
				}

				const importedContainerRaw = readCell(
					row,
					"Số container",
					"containerNo",
				);
				if (importedContainerRaw) {
					const normalizedContainer =
						normalizeContainerNo(importedContainerRaw);
					const currentContainer = normalizeContainerNo(
						assignment.containerNo || "",
					);
					if (normalizedContainer !== currentContainer) {
						importedContainerUpdates.set(assignment.id, normalizedContainer);
					}
				}
			}

			const feeName = readCell(row, "Tên phí", "feeName");
			const matchedFt = availableFeeTypes.find(
				(ft) => ft.name.toLowerCase() === feeName.toLowerCase(),
			);

			if (!hasFeeName && !hasTotalFee) continue;

			const costRow: CostRow = {
				feeTypeId: matchedFt?.id ?? null,
				feeName: matchedFt
					? matchedFt.feeCode || matchedFt.serviceMode || matchedFt.name
					: feeName,
				isDisbursement: !!isDisbursement,
				totalFee: parseAmountPattern(
					readCell(
						row,
						"Tổng Phí (Gồm VAT)",
						"Tổng Phí (Trước VAT)",
						"Tổng phí",
						"totalFee",
					),
				),
				vatPercent: isDisbursement
					? toNumber(readCell(row, "% VAT", "vatPercent"))
					: null,
				totalVat: isDisbursement
					? parseAmountPattern(readCell(row, "Tổng VAT", "totalVat"))
					: null,
				invoiceLink: isDisbursement
					? readCell(row, "Link hóa đơn", "invoiceLink") || null
					: null,
				sellerTaxCode: isDisbursement
					? readCell(row, "MST bên bán", "sellerTaxCode") || null
					: null,
				invoiceNumber: isDisbursement
					? readCell(row, "Số hóa đơn", "invoiceNumber") || null
					: null,
				trackingCode: isDisbursement
					? readCell(row, "Mã tra cứu", "trackingCode") || null
					: null,
				invoiceSentDate: isDisbursement
					? readCell(row, "Ngày gửi HĐ", "invoiceSentDate") || null
					: null,
				note: readCell(row, "Ghi chú", "note") || null,
				rowOrder: idx + 1,
			};

			if (!grouped.has(assignment.id)) grouped.set(assignment.id, []);
			grouped.get(assignment.id)?.push(costRow);
		}

		let matched = 0;
		for (const [assignmentId, rows] of grouped.entries()) {
			setRows(
				section,
				assignmentId,
				rows.map((r, i) => ({ ...r, rowOrder: i + 1 })),
			);
			matched++;
		}

		if (section === "fcl" && importedPlateUpdates.size > 0) {
			setPlateNumberMap((prev) => {
				const next = { ...prev };
				for (const [assignmentId, plate] of importedPlateUpdates.entries()) {
					next[assignmentId] = plate;
				}
				return next;
			});
		}

		if (section === "fcl" && importedContainerUpdates.size > 0) {
			setContainerNoMap((prev) => {
				const next = { ...prev };
				for (const [
					assignmentId,
					containerNo,
				] of importedContainerUpdates.entries()) {
					next[assignmentId] = containerNo;
				}
				return next;
			});
		}

		toast.success(`Đã nhập dữ liệu cho ${matched} lô hàng từ Excel`);
	}

	// ─── Loading / auth guard ──────────────────────────────────────────────────

	if (loading) {
		return (
			<div className="min-h-screen bg-slate-50 flex items-center justify-center">
				<div className="flex flex-col items-center gap-3 text-slate-500">
					<Loader2 className="w-8 h-8 animate-spin" />
					<p className="text-sm">Đang tải Vendor Portal...</p>
				</div>
			</div>
		);
	}

	if (!session) {
		router.replace("/login");
		return null;
	}

	// ─── Render each section tab ───────────────────────────────────────────────

	function renderSummarySection() {
		const sectionMeta: Array<{ key: SectionKey; label: string }> = [
			{ key: "fcl", label: "Container" },
			{ key: "lcl", label: "Xe tải" },
			{ key: "disbursement", label: "Chi hộ" },
		];
		const activeMeta = sectionMeta.filter(
			(meta) => summarySelectedSections[meta.key],
		);

		const rows: Array<{
			sectionLabel: string;
			lotLabel: string;
			pickupAt: string | null;
			deliveryAt: string | null;
			feeName: string;
			totalFee: number;
			totalVat: number;
			payment: number;
			status?: "PENDING" | "APPROVED" | "REJECTED" | null;
			rejectionReason?: string | null;
		}> = [];

		for (const meta of activeMeta) {
			const list = getFilteredAssignments(meta.key);
			for (const a of list) {
				const lotLabel =
					[a.jobNumber, a.fcrNumber].filter(Boolean).join(" / ") ||
					a.id.slice(0, 8);
				const costs = getRows(meta.key, a.id);

				for (const row of costs) {
					const hasData = Boolean(
						row.feeName.trim() ||
							row.totalFee !== null ||
							row.totalVat !== null,
					);
					if (!hasData) continue;

					const totalFeeEntered = row.totalFee ?? 0;
					const isDisburse = meta.key === "disbursement";

					const totalVat = isDisburse
						? (row.totalVat ?? 0)
						: Math.round(totalFeeEntered * 0.08);
					// Cho bảng tổng hợp thì Chi hộ cần trừ ngược lại phần VAT để ra trước VAT
					const beforeVatFee = isDisburse
						? totalFeeEntered - totalVat
						: totalFeeEntered;

					const displayFee = getDisplayFeeName(
						row,
						meta.key === "lcl"
							? feeTypesLCL
							: meta.key === "disbursement"
								? [...feeTypesFCL, ...feeTypesLCL]
								: feeTypesFCL,
					);

					rows.push({
						sectionLabel: meta.label,
						lotLabel,
						pickupAt: a.pickupAt,
						deliveryAt: a.deliveryAt,
						feeName: displayFee || "-",
						totalFee: beforeVatFee,
						totalVat,
						payment: beforeVatFee + totalVat,
						status: row.status,
						rejectionReason: row.rejectionReason,
					});
				}
			}
		}

		const totalFeeAll = rows.reduce((sum, r) => sum + r.totalFee, 0);
		const totalVatAll = rows.reduce((sum, r) => sum + r.totalVat, 0);
		const grandTotalPayment = rows.reduce((sum, r) => sum + r.payment, 0);

		const filteredCounts: Record<SectionKey, number> = {
			fcl: getFilteredAssignments("fcl").length,
			lcl: getFilteredAssignments("lcl").length,
			disbursement: getFilteredAssignments("disbursement").length,
		};

		const selectedCount = Object.values(summarySelectedSections).filter(
			Boolean,
		).length;

		if (!selectedCount) {
			if (isTableFocusMode) {
				return (
					<div className="py-8 text-center text-sm text-slate-400">
						Vui lòng tick ít nhất 1 nhóm để xem dữ liệu tổng hợp.
					</div>
				);
			}
			return (
				<div className="space-y-4 pt-2">
					<div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
						<div className="text-xs font-medium text-slate-500 mb-2">
							Chọn nhóm để tổng hợp
						</div>
						<div className="flex flex-wrap items-center gap-3">
							{sectionMeta.map((meta) => (
								<label
									key={meta.key}
									className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm"
								>
									<Checkbox
										checked={summarySelectedSections[meta.key]}
										onCheckedChange={(checked) =>
											setSummarySelectedSections((prev) => ({
												...prev,
												[meta.key]: Boolean(checked),
											}))
										}
									/>
									<span>{meta.label}</span>
									<Badge variant="secondary" className="text-[11px] h-5">
										{filteredCounts[meta.key]}
									</Badge>
								</label>
							))}
						</div>
					</div>
					<div className="py-8 text-center text-sm text-slate-400">
						Vui lòng tick ít nhất 1 nhóm để xem dữ liệu tổng hợp.
					</div>
				</div>
			);
		}

		if (!rows.length) {
			if (isTableFocusMode) {
				return (
					<div className="py-8 text-center text-sm text-slate-400">
						Chưa có dữ liệu phí để tổng hợp theo bộ lọc hiện tại.
					</div>
				);
			}
			return (
				<div className="space-y-4 pt-2">
					<div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
						<div className="text-xs font-medium text-slate-500 mb-2">
							Chọn nhóm để tổng hợp
						</div>
						<div className="flex flex-wrap items-center gap-3">
							{sectionMeta.map((meta) => (
								<label
									key={meta.key}
									className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm"
								>
									<Checkbox
										checked={summarySelectedSections[meta.key]}
										onCheckedChange={(checked) =>
											setSummarySelectedSections((prev) => ({
												...prev,
												[meta.key]: Boolean(checked),
											}))
										}
									/>
									<span>{meta.label}</span>
									<Badge variant="secondary" className="text-[11px] h-5">
										{filteredCounts[meta.key]}
									</Badge>
								</label>
							))}
						</div>
					</div>
					<div className="py-8 text-center text-sm text-slate-400">
						Chưa có dữ liệu phí để tổng hợp theo bộ lọc hiện tại.
					</div>
				</div>
			);
		}

		return (
			<div className="space-y-4 pt-2">
				{!isTableFocusMode && (
					<>
						<div className="flex justify-end">
							<Button
								variant="outline"
								size="sm"
								onClick={() => openTableInNewTab("summary")}
							>
								<ExternalLink className="w-4 h-4 mr-1.5" />
								Mở rộng
							</Button>
						</div>
						<div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
							<div className="text-xs font-medium text-slate-500 mb-2">
								Chọn nhóm để tổng hợp
							</div>
							<div className="flex flex-wrap items-center gap-3">
								{sectionMeta.map((meta) => (
									<label
										key={meta.key}
										className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm"
									>
										<Checkbox
											checked={summarySelectedSections[meta.key]}
											onCheckedChange={(checked) =>
												setSummarySelectedSections((prev) => ({
													...prev,
													[meta.key]: Boolean(checked),
												}))
											}
										/>
										<span>{meta.label}</span>
										<Badge variant="secondary" className="text-[11px] h-5">
											{filteredCounts[meta.key]}
										</Badge>
									</label>
								))}
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
							<div className="rounded-xl border bg-slate-50 px-4 py-3">
								<div className="text-xs text-slate-500">
									Tổng phí (Trước VAT)
								</div>
								<div className="text-lg font-semibold text-slate-900">
									{formatAmountPattern(totalFeeAll)}
								</div>
							</div>
							<div className="rounded-xl border bg-slate-50 px-4 py-3">
								<div className="text-xs text-slate-500">Tổng VAT</div>
								<div className="text-lg font-semibold text-slate-900">
									{formatAmountPattern(totalVatAll)}
								</div>
							</div>
							<div className="rounded-xl border bg-emerald-50 border-emerald-200 px-4 py-3">
								<div className="text-xs text-emerald-700">Tổng thanh toán</div>
								<div className="text-lg font-semibold text-emerald-800">
									{formatAmountPattern(grandTotalPayment)}
								</div>
							</div>
						</div>
					</>
				)}

				<div
					className={
						isTableFocusMode
							? "overflow-auto h-full min-h-0 pb-26"
							: "overflow-auto rounded-xl border border-slate-200"
					}
				>
					<table className="w-full text-sm border-collapse">
						<thead className="sticky top-0 z-30 bg-slate-100 text-xs text-slate-600 shadow-sm">
							<tr>
								<th className="px-3 py-2 text-left font-semibold border-b">
									Nhóm
								</th>
								<th className="px-3 py-2 text-left font-semibold border-b">
									Lô / Job
								</th>
								<th className="px-3 py-2 text-left font-semibold border-b">
									Điểm đi
								</th>
								<th className="px-3 py-2 text-left font-semibold border-b">
									Điểm đến
								</th>
								<th className="px-3 py-2 text-left font-semibold border-b">
									Tên phí
								</th>
								<th className="px-3 py-2 text-center font-semibold border-b min-w-[160px] whitespace-nowrap">
									Trạng thái
								</th>
								<th className="px-3 py-2 text-left font-semibold border-b min-w-[160px]">
									Lý do từ chối
								</th>
								<th className="px-3 py-2 text-right font-semibold border-b">
									Tổng phí (Trước VAT)
								</th>
								<th className="px-3 py-2 text-right font-semibold border-b">
									Tổng VAT
								</th>
								<th className="px-3 py-2 text-right font-semibold border-b">
									Thanh toán
								</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((r, idx) => (
								<tr
									key={`${r.sectionLabel}-${r.lotLabel}-${r.feeName}-${idx}`}
									className={`border-b border-slate-100 ${
										r.status === "APPROVED"
											? "bg-emerald-50/40"
											: r.status === "REJECTED"
												? "bg-red-50/30 opacity-70"
												: ""
									}`}
								>
									<td className="px-3 py-2">{r.sectionLabel}</td>
									<td className="px-3 py-2">{r.lotLabel}</td>
									<td className="px-3 py-2">
										{r.pickupAt || <span className="text-slate-300">—</span>}
									</td>
									<td className="px-3 py-2">
										{r.deliveryAt || <span className="text-slate-300">—</span>}
									</td>
									<td className="px-3 py-2">{r.feeName}</td>
									<td className="px-3 py-2 text-center whitespace-nowrap">
										{r.status === "APPROVED" ? (
											<span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
												✅ Đã duyệt
											</span>
										) : r.status === "REJECTED" ? (
											<span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
												❌ Từ chối
											</span>
										) : (
											<span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-300 font-medium">
												⏳ Chờ duyệt
											</span>
										)}
									</td>
									<td className="px-3 py-2">
										{r.status === "REJECTED" && r.rejectionReason ? (
											<span className="text-xs text-red-500 italic">
												{r.rejectionReason}
											</span>
										) : (
											<span className="text-slate-300">—</span>
										)}
									</td>
									<td className="px-3 py-2 text-right">
										{formatAmountPattern(r.totalFee)}
									</td>
									<td className="px-3 py-2 text-right">
										{formatAmountPattern(r.totalVat)}
									</td>
									<td className="px-3 py-2 text-right font-medium">
										{formatAmountPattern(r.payment)}
									</td>
								</tr>
							))}

							<tr className="bg-emerald-50 border-t-2 border-emerald-200">
								<td
									className="px-3 py-2 font-semibold text-emerald-800 text-right"
									colSpan={7}
								>
									Tổng:
								</td>
								<td className="px-3 py-2 text-right font-semibold text-emerald-800">
									{formatAmountPattern(totalFeeAll)}
								</td>
								<td className="px-3 py-2 text-right font-semibold text-emerald-800">
									{formatAmountPattern(totalVatAll)}
								</td>
								<td className="px-3 py-2 text-right font-bold text-emerald-800">
									{formatAmountPattern(grandTotalPayment)}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		);
	}

	function renderSection(section: SectionKey) {
		const allForSection = getBaseAssignments(section);
		const displayAssignments = getFilteredAssignments(section);
		const isDisbursement = section === "disbursement";
		const feeTypes =
			section === "lcl"
				? feeTypesLCL
				: section === "disbursement"
					? [
							...feeTypesFCL,
							...feeTypesLCL.filter(
								(l) => !feeTypesFCL.some((f) => f.id === l.id),
							),
						]
					: feeTypesFCL;

		if (allForSection.length === 0) {
			return (
				<div className="py-12 text-center text-sm text-slate-400">
					Không có lô hàng nào thuộc nhóm này.
				</div>
			);
		}

		if (isTableFocusMode) {
			return (
				<div className="h-full min-h-0 min-w-0 w-full flex flex-col overflow-hidden">
					<div className="sticky top-0 z-40 shrink-0 flex items-center justify-end gap-2 border-b bg-white/95 px-3 py-2 backdrop-blur">
						<Button
							variant="outline"
							size="sm"
							onClick={() => exportExcel(section)}
						>
							<Download className="w-4 h-4 mr-1.5" />
							Export Excel
						</Button>
						<label className="inline-flex cursor-pointer">
							<input
								type="file"
								accept=".xlsx,.xls"
								className="hidden"
								onChange={async (e) => {
									const input = e.currentTarget;
									const file = e.target.files?.[0];
									if (file) await importExcel(section, file);
									if (input) input.value = "";
								}}
							/>
							<span className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm bg-white hover:bg-slate-50 font-medium transition-colors">
								<Upload className="w-4 h-4" />
								Import Excel
							</span>
						</label>
						<Button
							size="sm"
							onClick={() => saveSection(section)}
							disabled={saving}
						>
							{saving ? (
								<Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
							) : (
								<Save className="w-4 h-4 mr-1.5" />
							)}
							Lưu {displayAssignments.length} lô
						</Button>
					</div>
					<div className="min-h-0 flex-1 min-w-0 w-full">
						<ExcelTable
							sessionSite={session?.site}
							assignments={displayAssignments}
							feeTypes={feeTypes}
							isDisbursementTab={isDisbursement}
							showContainerColumn={section !== "lcl"}
							showBillOrBookingColumn={
								section === "fcl" || section === "disbursement"
							}
							showVehicleInfoColumn={section === "fcl" || section === "lcl"}
							plateNumberMap={plateNumberMap}
							containerNoMap={containerNoMap}
							vehicleInfoMap={vehicleInfoMap}
							onPlateNumberChange={handlePlateNumberChange}
							onContainerNoChange={handleContainerNoChange}
							onVehicleInfoChange={handleVehicleInfoChange}
							isFullscreen
							getRows={(aId) => getRows(section, aId)}
							onUpdateRow={(aId, rowIdx, patch) =>
								updateRow(section, aId, rowIdx, patch)
							}
							onAddRow={(aId, afterIndex) => {
								const current = getRows(section, aId);
								const insertAt =
									afterIndex !== undefined ? afterIndex + 1 : current.length;
								const next = [
									...current.slice(0, insertAt),
									makeBlankCostRow({ rowOrder: insertAt + 1 }),
									...current
										.slice(insertAt)
										.map((r, i) => ({ ...r, rowOrder: insertAt + 2 + i })),
								];
								setRows(section, aId, next);
							}}
							onRemoveRow={(aId, rowIdx) => removeRow(section, aId, rowIdx)}
						/>
					</div>
				</div>
			);
		}

		return (
			<div className="space-y-4 pt-2">
				{/* ── Toolbar ── */}
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-xs text-slate-500">
						Hiển thị <strong>{displayAssignments.length}</strong>/
						{allForSection.length} lô hàng
					</span>
					<div className="flex-1" />
					<Button
						variant="outline"
						size="sm"
						onClick={() => openTableInNewTab(section)}
					>
						<ExternalLink className="w-4 h-4 mr-1.5" />
						Mở rộng
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => exportExcel(section)}
					>
						<Download className="w-4 h-4 mr-1.5" />
						Export Excel
					</Button>
					<label className="inline-flex cursor-pointer">
						<input
							type="file"
							accept=".xlsx,.xls"
							className="hidden"
							onChange={async (e) => {
								const input = e.currentTarget;
								const file = e.target.files?.[0];
								if (file) await importExcel(section, file);
								if (input) input.value = "";
							}}
						/>
						<span className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm bg-white hover:bg-slate-50 font-medium transition-colors">
							<Upload className="w-4 h-4" />
							Import Excel
						</span>
					</label>
					<Button
						size="sm"
						onClick={() => saveSection(section)}
						disabled={saving}
					>
						{saving ? (
							<Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
						) : (
							<Save className="w-4 h-4 mr-1.5" />
						)}
						Lưu {displayAssignments.length} lô
					</Button>
				</div>

				{/* ── Excel table (all assignments unified) ── */}
				<ExcelTable
					sessionSite={session?.site}
					assignments={displayAssignments}
					feeTypes={feeTypes}
					isDisbursementTab={isDisbursement}
					showContainerColumn={section !== "lcl"}
					showBillOrBookingColumn={
						section === "fcl" || section === "disbursement"
					}
					showVehicleInfoColumn={section === "fcl" || section === "lcl"}
					plateNumberMap={plateNumberMap}
					containerNoMap={containerNoMap}
					vehicleInfoMap={vehicleInfoMap}
					onPlateNumberChange={handlePlateNumberChange}
					onContainerNoChange={handleContainerNoChange}
					onVehicleInfoChange={handleVehicleInfoChange}
					getRows={(aId) => getRows(section, aId)}
					onUpdateRow={(aId, rowIdx, patch) =>
						updateRow(section, aId, rowIdx, patch)
					}
					onAddRow={(aId, afterIndex) => {
						const current = getRows(section, aId);
						const insertAt =
							afterIndex !== undefined ? afterIndex + 1 : current.length;
						const next = [
							...current.slice(0, insertAt),
							makeBlankCostRow({ rowOrder: insertAt + 1 }),
							...current
								.slice(insertAt)
								.map((r, i) => ({ ...r, rowOrder: insertAt + 2 + i })),
						];
						setRows(section, aId, next);
					}}
					onRemoveRow={(aId, rowIdx) => removeRow(section, aId, rowIdx)}
				/>

				{/* Sticky save when many results */}
				{displayAssignments.length > 1 && (
					<div className="sticky bottom-4 flex justify-end">
						<Button
							onClick={() => saveSection(section)}
							disabled={saving}
							className="shadow-lg"
						>
							{saving ? (
								<Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
							) : (
								<Save className="w-4 h-4 mr-1.5" />
							)}
							Lưu tất cả ({displayAssignments.length} lô)
						</Button>
					</div>
				)}
			</div>
		);
	}

	// ─── Main render ──────────────────────────────────────────────────────────

	// Pre-compute filtered counts for tab badges
	const filteredFclCount = getFilteredAssignments("fcl").length;
	const filteredLclCount = getFilteredAssignments("lcl").length;
	const filteredDisbursementCount =
		getFilteredAssignments("disbursement").length;
	const summaryCount =
		(summarySelectedSections.fcl ? filteredFclCount : 0) +
		(summarySelectedSections.lcl ? filteredLclCount : 0) +
		(summarySelectedSections.disbursement ? filteredDisbursementCount : 0);

	return (
		<div
			className={
				isTableFocusMode
					? "h-[100dvh] w-screen bg-white overflow-hidden"
					: "min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 p-4 md:p-6"
			}
		>
			<div
				className={
					isTableFocusMode
						? "h-full w-full"
						: "mx-auto max-w-[1600px] space-y-4"
				}
			>
				{/* ── Import Error Dialog ── */}
				<Dialog
					open={importErrors.length > 0}
					onOpenChange={(open) => {
						if (!open) setImportErrors([]);
					}}
				>
					<DialogContent showCloseButton={false}>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2 text-red-600">
								<span className="text-lg">⚠️</span>
								File Excel có {importErrors.length} lỗi — không thể import
							</DialogTitle>
						</DialogHeader>
						<div className="max-h-[50vh] overflow-y-auto rounded-lg border border-red-100 bg-red-50 p-3 space-y-1">
							{importErrors.map((err, i) => (
								<div
									key={i}
									className="flex items-start gap-2 text-sm text-red-700"
								>
									<span className="shrink-0 mt-0.5 text-red-400">&#8226;</span>
									<span>{err}</span>
								</div>
							))}
						</div>
						<p className="text-xs text-slate-500">
							Vui lòng sửa lại file và import lại. Không có dữ liệu nào được ghi
							vào hệ thống.
						</p>
						<DialogFooter>
							<Button onClick={() => setImportErrors([])} variant="outline">
								Đóng
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				{/* Header */}
				{!isTableFocusMode && (
					<div className="rounded-2xl border bg-white px-5 py-4 shadow-sm">
						<div className="flex items-center justify-between gap-4 flex-wrap">
							<div>
								<h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
									Vendor Cost Portal
								</h1>
								<div className="mt-1.5 flex items-center gap-2 flex-wrap">
									<Badge className="text-xs">{session.name}</Badge>
									<Badge variant="secondary" className="text-xs">
										Site {session.site}
									</Badge>
									<span className="text-slate-400 text-xs">
										{fclAssignments.length} container &bull;{" "}
										{lclAssignments.length} xe tải &bull; {assignments.length}{" "}
										lô tổng
									</span>
								</div>
							</div>

							{/* Global date filter – max range 30 days, allows future */}
							{(() => {
								const minAllowed = (() => {
									const d = new Date();
									d.setDate(d.getDate() - 30);
									return d.toISOString().slice(0, 10);
								})();
								const maxAllowed = (() => {
									const d = new Date();
									d.setDate(d.getDate() + 30);
									return d.toISOString().slice(0, 10);
								})();
								// max of dateFrom = dateTo (if set) or maxAllowed
								const maxFrom = globalDateTo || maxAllowed;
								// min of dateTo = dateFrom (if set)
								const minTo = globalDateFrom || minAllowed;
								// max of dateTo = min(dateFrom+30, maxAllowed)
								const maxTo = (() => {
									if (!globalDateFrom) return maxAllowed;
									const d = new Date(globalDateFrom);
									d.setDate(d.getDate() + 30);
									const plus30 = d.toISOString().slice(0, 10);
									return plus30 < maxAllowed ? plus30 : maxAllowed;
								})();

								return (
									<div className="flex items-center gap-2 flex-wrap">
										<span className="text-xs font-medium text-slate-500 whitespace-nowrap">
											Lọc ngày TH:
										</span>
										<Input
											type="date"
											value={globalDateFrom}
											min={minAllowed}
											max={maxFrom}
											onChange={(e) => {
												const val = e.target.value;
												setGlobalDateFrom(val);
												// clamp dateTo if range > 30 days
												if (val && globalDateTo) {
													const from = new Date(val);
													const to = new Date(globalDateTo);
													const diff =
														(to.getTime() - from.getTime()) / 86400000;
													if (diff > 30) {
														const capped = new Date(from);
														capped.setDate(from.getDate() + 30);
														setGlobalDateTo(capped.toISOString().slice(0, 10));
													}
												}
											}}
											className="h-8 text-xs w-[140px]"
										/>
										<span className="text-xs text-slate-400">→</span>
										<Input
											type="date"
											value={globalDateTo}
											min={minTo}
											max={maxTo}
											onChange={(e) => {
												const val = e.target.value;
												setGlobalDateTo(val);
												// clamp dateFrom if range > 30 days
												if (val && globalDateFrom) {
													const from = new Date(globalDateFrom);
													const to = new Date(val);
													const diff =
														(to.getTime() - from.getTime()) / 86400000;
													if (diff > 30) {
														const capped = new Date(to);
														capped.setDate(to.getDate() - 30);
														setGlobalDateFrom(
															capped.toISOString().slice(0, 10),
														);
													}
												}
											}}
											className="h-8 text-xs w-[140px]"
										/>
										<span className="text-xs text-slate-400 whitespace-nowrap">
											≤ 30 ngày
										</span>
										{(globalDateFrom || globalDateTo) && (
											<Button
												variant="ghost"
												size="sm"
												className="h-8 text-xs px-2 text-slate-500 hover:text-red-500"
												onClick={() => {
													const def = getDefaultDateRange();
													setGlobalDateFrom(def.from);
													setGlobalDateTo(def.to);
												}}
											>
												Xóa lọc (30 ngày)
											</Button>
										)}
									</div>
								);
							})()}

							{/* Global search */}
							<div className="flex items-center gap-2">
								<Input
									type="search"
									value={globalSearch}
									onChange={(e) => setGlobalSearch(e.target.value)}
									placeholder="Tìm job, FCR, container, xe..."
									className="h-8 text-xs w-[220px]"
								/>
								{globalSearch && (
									<Button
										variant="ghost"
										size="sm"
										className="h-8 text-xs px-2 text-slate-500 hover:text-red-500"
										onClick={() => setGlobalSearch("")}
									>
										Xoá
									</Button>
								)}
							</div>
						</div>
					</div>
				)}

				{/* Main tabs */}
				<div
					className={
						isTableFocusMode
							? "h-full overflow-hidden flex flex-col w-full min-w-0"
							: "rounded-2xl border bg-white shadow-sm overflow-hidden w-full min-w-0"
					}
				>
					<Tabs
						value={activeSection}
						onValueChange={(v) => setActiveSection(v as TabKey)}
						className={
							isTableFocusMode
								? "h-full min-h-0 flex flex-col w-full min-w-0"
								: "w-full min-w-0"
						}
					>
						{!isTableFocusMode && (
							<div className="border-b bg-slate-50 px-4 pt-3">
								<TabsList className="bg-transparent gap-1 h-auto p-0">
									<TabsTrigger
										value="fcl"
										className="flex items-center gap-2 rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-white data-[state=active]:shadow-none px-4 py-2.5 font-medium text-sm text-slate-600 data-[state=active]:text-blue-600"
									>
										<Truck className="w-4 h-4" />
										Container
										<Badge
											variant="secondary"
											className="ml-1 text-xs h-5 px-1.5"
										>
											{filteredFclCount}
										</Badge>
									</TabsTrigger>
									<TabsTrigger
										value="lcl"
										className="flex items-center gap-2 rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-green-500 data-[state=active]:bg-white data-[state=active]:shadow-none px-4 py-2.5 font-medium text-sm text-slate-600 data-[state=active]:text-green-600"
									>
										<Package className="w-4 h-4" />
										Xe tải
										<Badge
											variant="secondary"
											className="ml-1 text-xs h-5 px-1.5"
										>
											{filteredLclCount}
										</Badge>
									</TabsTrigger>
									<TabsTrigger
										value="disbursement"
										className="flex items-center gap-2 rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-white data-[state=active]:shadow-none px-4 py-2.5 font-medium text-sm text-slate-600 data-[state=active]:text-orange-600"
									>
										<Receipt className="w-4 h-4" />
										Chi hộ
										<Badge
											variant="secondary"
											className="ml-1 text-xs h-5 px-1.5"
										>
											{filteredDisbursementCount}
										</Badge>
									</TabsTrigger>
									<TabsTrigger
										value="summary"
										className="flex items-center gap-2 rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-white data-[state=active]:shadow-none px-4 py-2.5 font-medium text-sm text-slate-600 data-[state=active]:text-emerald-600"
									>
										<Save className="w-4 h-4" />
										Tổng hợp
										<Badge
											variant="secondary"
											className="ml-1 text-xs h-5 px-1.5"
										>
											{summaryCount}
										</Badge>
									</TabsTrigger>
								</TabsList>
							</div>
						)}

						<div
							className={
								isTableFocusMode
									? "p-0 h-full min-h-0 min-w-0 w-full"
									: "p-4 md:p-5 min-w-0 w-full"
							}
						>
							<TabsContent
								value="fcl"
								className={
									isTableFocusMode
										? "mt-0 h-full min-h-0 min-w-0 w-full data-[state=active]:flex data-[state=active]:flex-col"
										: "mt-0 min-w-0 w-full"
								}
							>
								{!isTableFocusMode && (
									<div className="text-xs text-slate-500 mb-2">
										Nhập phí vận chuyển container (FCL). Không bao gồm chi hộ và
										các trường VAT, hóa đơn.
									</div>
								)}
								{renderSection("fcl")}
							</TabsContent>

							<TabsContent
								value="lcl"
								className={
									isTableFocusMode
										? "mt-0 h-full min-h-0 min-w-0 w-full data-[state=active]:flex data-[state=active]:flex-col"
										: "mt-0 min-w-0 w-full"
								}
							>
								{!isTableFocusMode && (
									<div className="text-xs text-slate-500 mb-2">
										Nhập phí vận chuyển xe tải (LCL và các dịch vụ không phải
										container).
									</div>
								)}
								{renderSection("lcl")}
							</TabsContent>

							<TabsContent
								value="disbursement"
								className={
									isTableFocusMode
										? "mt-0 h-full min-h-0 min-w-0 w-full data-[state=active]:flex data-[state=active]:flex-col"
										: "mt-0 min-w-0 w-full"
								}
							>
								{!isTableFocusMode && (
									<div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
										<strong>Chi hộ:</strong> Áp dụng cho toàn bộ lô hàng
										(container và xe tải). Tất cả phí sẽ được đánh dấu là chi
										hộ. Có thể nhập thêm % VAT, Tổng VAT, MST bên bán, Số hóa
										đơn, Link hóa đơn và Mã tra cứu.
									</div>
								)}
								{renderSection("disbursement")}
							</TabsContent>

							<TabsContent
								value="summary"
								className={
									isTableFocusMode
										? "mt-0 h-full min-h-0 min-w-0 w-full data-[state=active]:flex data-[state=active]:flex-col"
										: "mt-0 min-w-0 w-full"
								}
							>
								{!isTableFocusMode && (
									<div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-2">
										Bảng tổng hợp dữ liệu từ 3 tab Container, Xe tải và Chi hộ.
										Dòng cuối là <strong>Tổng thanh toán</strong>.
									</div>
								)}
								{renderSummarySection()}
							</TabsContent>
						</div>
					</Tabs>
				</div>
			</div>
		</div>
	);
}
