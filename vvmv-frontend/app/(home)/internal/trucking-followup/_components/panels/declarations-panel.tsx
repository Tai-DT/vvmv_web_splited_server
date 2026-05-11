"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import { SiQuicklook } from "react-icons/si";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { DECLARATION_HEADERS } from "../../../followup/_components/table/column-headers";
import type { DeclarationRow } from "../../../followup/types";

interface DeclarationsPanelProps {
	declarations: DeclarationRow[];
}

export function DeclarationsPanel({ declarations }: DeclarationsPanelProps) {
	const formatDate = (dateStr: string | null | undefined, showTime = false) => {
		if (!dateStr) return "—";
		try {
			const date = new Date(dateStr);
			if (showTime) {
				return date.toLocaleString("en-US", {
					year: "numeric",
					month: "short",
					day: "numeric",
					hour: "2-digit",
					minute: "2-digit",
					hour12: false,
				});
			}
			return date.toLocaleDateString("en-US", {
				year: "numeric",
				month: "short",
				day: "numeric",
			});
		} catch {
			return "—";
		}
	};

	const formatNumber = (value: number | null | undefined) => {
		if (value === null || value === undefined) return "—";
		return value.toLocaleString();
	};

	const getChannelVariant = (batch: string | null | undefined) => {
		if (!batch) return "secondary";
		const normalized = batch.toLowerCase();
		if (normalized.includes("xanh")) return "success";
		if (normalized.includes("vàng")) return "warning";
		if (normalized.includes("đỏ")) return "destructive";
		return "secondary";
	};

	const totalGW = declarations.reduce(
		(acc, d) => acc + (Number(d.grossWeight) || 0),
		0,
	);
	const totalQty = declarations.reduce(
		(acc, d) => acc + (Number(d.quantity) || 0),
		0,
	);

	const content = (
		<div className="p-4 space-y-4">
			{/* Desktop: Table view (md and above) */}
			<div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
				<Table className="text-xs w-full">
					<TableHeader className="bg-slate-100 dark:bg-slate-800">
						<TableRow>
							<TableHead className="px-2 py-2 w-8 text-center font-semibold text-slate-700 dark:text-slate-200">
								#
							</TableHead>
							<TableHead className="py-2 px-1 w-10 text-center font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap"></TableHead>
							<TableHead className="py-2 px-1 w-10 text-center font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
								MV
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
								{DECLARATION_HEADERS.declarationNumber}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
								{DECLARATION_HEADERS.batch}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 text-center whitespace-nowrap">
								{DECLARATION_HEADERS.attachDocuments}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
								{DECLARATION_HEADERS.kvgsDate}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
								{DECLARATION_HEADERS.tqDate}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
								{DECLARATION_HEADERS.firstCds}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
								{DECLARATION_HEADERS.authority}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
								{DECLARATION_HEADERS.customsCode}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
								{DECLARATION_HEADERS.diaDiemLuuKho}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
								{DECLARATION_HEADERS.diaDiemBaoThue}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
								{DECLARATION_HEADERS.workType}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
								{DECLARATION_HEADERS.declarationDate}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 text-right whitespace-nowrap">
								{DECLARATION_HEADERS.grossWeight}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 text-right whitespace-nowrap">
								{DECLARATION_HEADERS.quantity}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
								{DECLARATION_HEADERS.unit}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
								{DECLARATION_HEADERS.etaEtd}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
								{DECLARATION_HEADERS.billBooking}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
								{DECLARATION_HEADERS.invoice}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
								{DECLARATION_HEADERS.pol}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
								{DECLARATION_HEADERS.pod}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
								{DECLARATION_HEADERS.warehouse}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
								{DECLARATION_HEADERS.vehicle}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
								{DECLARATION_HEADERS.mstClient}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 min-w-[150px]">
								{DECLARATION_HEADERS.clientName}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 min-w-[150px]">
								{DECLARATION_HEADERS.partner}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
								{DECLARATION_HEADERS.containers}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 text-right whitespace-nowrap">
								{DECLARATION_HEADERS.totalTaxAmount}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 text-right whitespace-nowrap">
								{DECLARATION_HEADERS.vatTax}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 text-right whitespace-nowrap">
								{DECLARATION_HEADERS.ieTax}
							</TableHead>
							<TableHead className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 min-w-[200px]">
								{DECLARATION_HEADERS.taxRemark}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
						{declarations.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={32}
									className="py-8 text-center text-muted-foreground italic"
								>
									No declarations found
								</TableCell>
							</TableRow>
						) : (
							declarations.map((declaration, index) => (
								<TableRow
									key={declaration.id || index}
									className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
								>
									<TableCell className="px-2 py-2 text-center text-muted-foreground">
										{index + 1}
									</TableCell>
									<TableCell className="py-2 px-1 text-center whitespace-nowrap">
										{declaration.driveUrl && (
											<Link
												href={declaration.driveUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 inline-flex items-center text-blue-500"
											>
												<SiQuicklook />
											</Link>
										)}
									</TableCell>
									<TableCell className="py-2 px-1 text-center whitespace-nowrap">
										{declaration.mvUrl && (
											<Link
												href={declaration.mvUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 inline-flex items-center text-emerald-500"
												title="Barcode file"
											>
												<FileText className="size-3.5" />
											</Link>
										)}
									</TableCell>
									<TableCell className="py-2 px-3 font-medium whitespace-nowrap">
										{declaration.declarationNumber || "—"}
									</TableCell>
									<TableCell className="py-2 px-3 whitespace-nowrap">
										{declaration.batch ? (
											<Badge
												variant={
													getChannelVariant(declaration.batch) as
														| "success"
														| "warning"
														| "destructive"
														| "secondary"
												}
												className="px-2 py-0.5 text-xs font-semibold"
											>
												{declaration.batch}
											</Badge>
										) : (
											"—"
										)}
									</TableCell>
									<TableCell className="py-2 px-3 text-center whitespace-nowrap">
										{declaration.attachDocuments || "—"}
									</TableCell>
									<TableCell className="py-2 px-3 text-muted-foreground whitespace-nowrap">
										{formatDate(declaration.kvgsDate, true)}
									</TableCell>
									<TableCell className="py-2 px-3 text-muted-foreground whitespace-nowrap">
										{formatDate(declaration.tqDate, true)}
									</TableCell>
									<TableCell className="py-2 px-3 text-indigo-600 dark:text-indigo-400 font-medium whitespace-nowrap">
										{declaration.firstCds || "—"}
									</TableCell>
									<TableCell className="py-2 px-3 whitespace-nowrap">
										{declaration.authority || "—"}
									</TableCell>
									<TableCell className="py-2 px-3 whitespace-nowrap">
										{declaration.customsCode || "—"}
									</TableCell>
									<TableCell className="py-2 px-3 whitespace-nowrap">
										{declaration.diaDiemLuuKho || "—"}
									</TableCell>
									<TableCell className="py-2 px-3 whitespace-nowrap">
										{declaration.diaDiemBaoThue || "—"}
									</TableCell>
									<TableCell className="py-2 px-3 whitespace-nowrap">
										{declaration.workType || "—"}
									</TableCell>
									<TableCell className="py-2 px-3 text-muted-foreground whitespace-nowrap">
										{formatDate(declaration.declarationDate)}
									</TableCell>
									<TableCell className="py-2 px-3 text-right tabular-nums whitespace-nowrap">
										{formatNumber(declaration.grossWeight)}
									</TableCell>
									<TableCell className="py-2 px-3 text-right tabular-nums whitespace-nowrap">
										{formatNumber(declaration.quantity)}
									</TableCell>
									<TableCell className="py-2 px-3 whitespace-nowrap">
										{declaration.unit || "—"}
									</TableCell>
									<TableCell className="py-2 px-3 text-muted-foreground whitespace-nowrap">
										{formatDate(declaration.etaEtd)}
									</TableCell>
									<TableCell className="py-2 px-3 whitespace-nowrap">
										{declaration.billBooking || "—"}
									</TableCell>
									<TableCell className="py-2 px-3 whitespace-nowrap">
										{declaration.invoice || "—"}
									</TableCell>
									<TableCell className="py-2 px-3 whitespace-nowrap">
										{declaration.pol || "—"}
									</TableCell>
									<TableCell className="py-2 px-3 whitespace-nowrap">
										{declaration.pod || "—"}
									</TableCell>
									<TableCell className="py-2 px-3 whitespace-nowrap">
										{declaration.warehouse || "—"}
									</TableCell>
									<TableCell className="py-2 px-3 whitespace-nowrap">
										{declaration.vehicle || "—"}
									</TableCell>
									<TableCell className="py-2 px-3 whitespace-nowrap">
										{declaration.mstClient || "—"}
									</TableCell>
									<TableCell className="py-2 px-3 min-w-[150px] break-words">
										{declaration.clientName || "—"}
									</TableCell>
									<TableCell className="py-2 px-3 min-w-[150px] break-words">
										{declaration.partner || "—"}
									</TableCell>
									<TableCell className="py-2 px-3 whitespace-nowrap">
										{declaration.containers || "—"}
									</TableCell>
									<TableCell className="py-2 px-3 text-right tabular-nums whitespace-nowrap">
										{formatNumber(declaration.totalTaxAmount)}
									</TableCell>
									<TableCell className="py-2 px-3 text-right tabular-nums whitespace-nowrap">
										{formatNumber(declaration.vatTax)}
									</TableCell>
									<TableCell className="py-2 px-3 text-right tabular-nums whitespace-nowrap">
										{formatNumber(declaration.ieTax)}
									</TableCell>
									<TableCell className="py-2 px-3 min-w-[200px] max-w-[400px] break-words">
										{declaration.taxRemark || "—"}
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			{/* Mobile/Tablet: Card grid (below md) */}
			<div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
				{declarations.length === 0 ? (
					<div className="col-span-full py-4 text-center text-muted-foreground text-sm">
						No declarations found
					</div>
				) : (
					declarations.map((declaration, index) => (
						<div
							key={declaration.id || index}
							className="p-3 bg-neutral-50 rounded-md border"
						>
							<div className="flex items-center justify-between mb-2">
								<div className="flex items-center gap-2">
									<span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500">
										{index + 1}
									</span>
									<div className="font-medium text-xs truncate">
										{declaration.declarationNumber || "—"}
									</div>
								</div>
							</div>
							<div className="space-y-1 text-xs text-muted-foreground">
								{declaration.batch && (
									<div className="flex items-center gap-1.5">
										<span className="font-medium">Luồng:</span>{" "}
										<Badge
											variant={
												getChannelVariant(declaration.batch) as
													| "success"
													| "warning"
													| "destructive"
													| "secondary"
											}
											className="px-2 py-0.5 text-xs font-semibold"
										>
											{declaration.batch}
										</Badge>
									</div>
								)}
								{declaration.attachDocuments && (
									<div className="flex items-center gap-1.5">
										<span className="font-medium">CT đính kèm:</span>{" "}
										{declaration.attachDocuments}
									</div>
								)}
								{declaration.kvgsDate && (
									<div className="truncate">
										<span className="font-medium">Ngày qua KVGS:</span>{" "}
										{formatDate(declaration.kvgsDate, true)}
									</div>
								)}
								{declaration.tqDate && (
									<div className="truncate">
										<span className="font-medium">Ngày TQ:</span>{" "}
										{formatDate(declaration.tqDate, true)}
									</div>
								)}
								{declaration.firstCds && (
									<div className="truncate text-indigo-600 dark:text-indigo-400 font-medium">
										<span className="font-medium">First CDS:</span>{" "}
										{declaration.firstCds}
									</div>
								)}
								{declaration.authority && (
									<div className="truncate">
										<span className="font-medium">CQ:</span>{" "}
										{declaration.authority}
									</div>
								)}
								{declaration.customsCode && (
									<div className="truncate">
										<span className="font-medium">Mã HQ:</span>{" "}
										{declaration.customsCode}
									</div>
								)}
								{declaration.diaDiemLuuKho && (
									<div className="truncate">
										<span className="font-medium">ĐĐ lưu kho:</span>{" "}
										{declaration.diaDiemLuuKho}
									</div>
								)}
								{declaration.diaDiemBaoThue && (
									<div className="truncate">
										<span className="font-medium">ĐĐ VCBT:</span>{" "}
										{declaration.diaDiemBaoThue}
									</div>
								)}
								{declaration.workType && (
									<div className="truncate">
										<span className="font-medium">LH:</span>{" "}
										{declaration.workType}
									</div>
								)}
								<div>
									<span className="font-medium">Date:</span>{" "}
									{formatDate(declaration.declarationDate)}
								</div>
								{declaration.grossWeight && (
									<div>
										<span className="font-medium">G.W:</span>{" "}
										{formatNumber(declaration.grossWeight)}
									</div>
								)}
								{declaration.quantity && (
									<div>
										<span className="font-medium">QTY:</span>{" "}
										{formatNumber(declaration.quantity)} {declaration.unit}
									</div>
								)}
								{declaration.etaEtd && (
									<div>
										<span className="font-medium">ETA/ETD:</span>{" "}
										{formatDate(declaration.etaEtd)}
									</div>
								)}
								{declaration.billBooking && (
									<div className="truncate">
										<span className="font-medium">Bill:</span>{" "}
										{declaration.billBooking}
									</div>
								)}
								{declaration.invoice && (
									<div className="truncate">
										<span className="font-medium">Invoice:</span>{" "}
										{declaration.invoice}
									</div>
								)}
								{(declaration.pol || declaration.pod) && (
									<div className="truncate">
										<span className="font-medium">POL/POD:</span>{" "}
										{declaration.pol || "—"} / {declaration.pod || "—"}
									</div>
								)}
								{declaration.warehouse && (
									<div className="truncate">
										<span className="font-medium">Warehouse:</span>{" "}
										{declaration.warehouse}
									</div>
								)}
								{declaration.vehicle && (
									<div className="truncate">
										<span className="font-medium">Vehicle:</span>{" "}
										{declaration.vehicle}
									</div>
								)}
								{declaration.clientName && (
									<div className="break-words">
										<span className="font-medium">Client:</span>{" "}
										{declaration.clientName}
									</div>
								)}
								{declaration.mstClient && (
									<div className="truncate">
										<span className="font-medium">MST:</span>{" "}
										{declaration.mstClient}
									</div>
								)}
								{declaration.partner && (
									<div className="break-words">
										<span className="font-medium">Partner:</span>{" "}
										{declaration.partner}
									</div>
								)}
								{declaration.containers && (
									<div className="truncate">
										<span className="font-medium">Container:</span>{" "}
										{declaration.containers}
									</div>
								)}
								{declaration.totalTaxAmount && (
									<div>
										<span className="font-medium">Total Tax:</span>{" "}
										{formatNumber(declaration.totalTaxAmount)}
									</div>
								)}
								{declaration.vatTax && (
									<div>
										<span className="font-medium">VAT:</span>{" "}
										{formatNumber(declaration.vatTax)}
									</div>
								)}
								{declaration.ieTax && (
									<div>
										<span className="font-medium">IE Tax:</span>{" "}
										{formatNumber(declaration.ieTax)}
									</div>
								)}
								{declaration.taxRemark && (
									<div className="break-words italic text-slate-500">
										<span className="font-medium not-italic">Remark:</span>{" "}
										{declaration.taxRemark}
									</div>
								)}
								{declaration.driveUrl && (
									<div>
										<Link
											href={declaration.driveUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="flex items-center gap-1.5 text-primary hover:underline group"
										>
											<SiQuicklook />{" "}
											<span className="text-sm truncate">View</span>
										</Link>
									</div>
								)}
								{declaration.mvUrl && (
									<div>
										<Link
											href={declaration.mvUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="flex items-center gap-1.5 text-emerald-600 hover:underline group"
										>
											<FileText className="size-3.5" />{" "}
											<span className="text-sm truncate">Barcode</span>
										</Link>
									</div>
								)}
							</div>
						</div>
					))
				)}
			</div>

			{/* Summary footer */}
			<div className="flex items-center justify-between mt-3 px-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
				<div className="flex items-center gap-4">
					<span>
						<FileText className="w-3.5 h-3.5 inline mr-1" />
						{declarations.length} Declarations
					</span>
					<span>Total G.W: {totalGW.toLocaleString()} kg</span>
					<span>Total Qty: {totalQty.toLocaleString()}</span>
				</div>
			</div>
		</div>
	);

	return content;
}
