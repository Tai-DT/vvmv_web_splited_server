"use client";

import { FileSpreadsheet } from "lucide-react";
import type React from "react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { CargoListRow, FollowUpCdsInfoRow } from "../../../types";
import {
	FOLLOWUP_CARGO_COLUMNS,
	formatPanelDisplayValue,
} from "../panel-config";

export interface CdsCargoGridProps {
	cargoList?: Partial<CargoListRow>[];
	data: Partial<FollowUpCdsInfoRow>;
	isLoading?: boolean;
}

const CENTER_ALIGNED_COLUMN_KEYS = new Set<keyof CargoListRow>([
	"customCode",
	"hsCode",
	"originalCountry",
	"unit",
	"importTaxCode",
	"vatTaxCode",
	"dutyReductionCode",
	"unit2",
	"lineTaxableValue",
	"exportTaxRatePercent",
	"exportTaxAmount",
	"taxableUnitPrice",
]);

const WIDTH_OVERRIDES: Partial<Record<keyof CargoListRow, string>> = {
	customCode: "78px",
	hsCode: "84px",
	vietnameseName: "172px",
	originalCountry: "64px",
	qty: "68px",
	unit: "74px",
	unitPrice: "82px",
	totalPrice: "88px",
	lineTaxableValue: "88px",
	exportTaxRatePercent: "72px",
	exportTaxAmount: "84px",
	taxableUnitPrice: "82px",
	imExDutyExemptionCode: "162px",
	imExDutyExemptionCondition: "148px",
	imExDutyExemptionAmount: "116px",
	importTaxCode: "120px",
	importTaxRate: "92px",
	importTaxAmount: "112px",
	vatTaxCode: "104px",
	vatTaxRate: "82px",
	vatTaxAmount: "104px",
	dutyReductionCode: "92px",
	qty2: "68px",
	unit2: "78px",
	originalCargoName: "164px",
};
const ROW_NUMBER_WIDTH = 24;

function hasVisibleCargoValue(row: Partial<CargoListRow> | null | undefined) {
	if (!row) {
		return false;
	}

	return Object.entries(row).some(([key, value]) => {
		if (
			key === "id" ||
			key === "followUpId" ||
			key === "createdAt" ||
			key === "updatedAt"
		) {
			return false;
		}

		return value !== null && value !== undefined && String(value).trim() !== "";
	});
}

function parseWidth(width?: string) {
	const numericWidth = Number.parseFloat(width ?? "0");
	return Number.isFinite(numericWidth) ? numericWidth : 0;
}

export const CdsCargoGrid: React.FC<CdsCargoGridProps> = ({
	cargoList = [],
	data: _data,
	isLoading = false,
}) => {
	const columns = useMemo(() => {
		const baseColumns = FOLLOWUP_CARGO_COLUMNS.map((column) => ({
			...column,
			width: WIDTH_OVERRIDES[column.key] ?? column.compactWidth ?? "84px",
		}));
		const totalWidth = baseColumns.reduce(
			(sum, column) => sum + parseWidth(column.width),
			ROW_NUMBER_WIDTH,
		);

		return baseColumns.map((column) => ({
			...column,
			widthPercent:
				totalWidth > 0
					? `${(parseWidth(column.width) / totalWidth) * 100}%`
					: `${100 / baseColumns.length}%`,
		}));
	}, []);
	const rowNumberWidthPercent = useMemo(() => {
		const usedWidthPercent = columns.reduce((sum, column) => {
			const percent = Number.parseFloat(column.widthPercent);
			return sum + (Number.isFinite(percent) ? percent : 0);
		}, 0);

		return `${Math.max(0, 100 - usedWidthPercent)}%`;
	}, [columns]);

	const rows = useMemo(
		() => cargoList.filter((row) => hasVisibleCargoValue(row)),
		[cargoList],
	);

	const visibleRows = useMemo(() => {
		if (rows.length === 0) {
			return Array.from({ length: 7 }, () => null);
		}

		return [
			...rows,
			...Array.from({ length: Math.max(0, 7 - rows.length) }, () => null),
		];
	}, [rows]);

	return (
		<div
			className="flex h-full min-h-0 flex-col rounded-sm border border-[#ececec] bg-white"
			style={{ fontFamily: "Tahoma, Arial, sans-serif" }}
		>
			<div className="flex items-start justify-between gap-3 border-b border-[#f0f0f0] px-3 py-2">
				<div className="min-w-0">
					<div className="flex items-center gap-2 text-[12px] font-medium text-slate-700">
						<FileSpreadsheet className="size-3.5 shrink-0 text-slate-500" />
						<span className="truncate">Cargo List Management</span>
					</div>
					<div className="mt-1 text-[9px] text-slate-400">
						Hiển thị đầy đủ các cột danh sách hàng trên một bảng duy nhất.
					</div>
				</div>
				<div className="shrink-0 text-[9px] text-slate-400">
					{rows.length > 0 ? `${rows.length} dòng hàng` : "Chưa có dữ liệu"}
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
				{isLoading ? (
					<div className="flex min-h-[220px] items-center justify-center px-4 text-[11px] text-slate-500">
						Đang tải danh sách hàng...
					</div>
				) : (
					<table
						className="border-collapse text-[9px] text-slate-700"
						style={{
							tableLayout: "fixed",
							width: "100%",
						}}
					>
						<colgroup>
							<col style={{ width: rowNumberWidthPercent }} />
							{columns.map((column) => (
								<col key={column.key} style={{ width: column.widthPercent }} />
							))}
						</colgroup>
						<thead>
							<tr className="bg-[#fcfcfc]">
								<th className="sticky top-0 z-10 border-b border-[#ededed] bg-[#fcfcfc] px-1 py-1 text-center text-[8px] font-normal text-slate-500">
									*
								</th>
								{columns.map((column) => (
									<th
										key={column.key}
										title={column.label}
										className="sticky top-0 z-10 border-b border-[#ededed] bg-[#fcfcfc] px-1 py-1 text-left text-[8px] font-normal leading-tight text-slate-500 whitespace-nowrap"
									>
										{column.label}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{visibleRows.map((row, rowIndex) => (
								<tr
									key={row?.id ?? `cargo-row-${rowIndex}`}
									className={cn(
										"border-b border-[#f3f3f3]",
										row ? "bg-white" : "bg-white/70",
									)}
								>
									<td className="px-1 py-1 align-middle text-center text-[8px] text-slate-400">
										{row ? rowIndex + 1 : ""}
									</td>
									{columns.map((column) => {
										const displayValue = row
											? formatPanelDisplayValue(row[column.key], column.type)
											: "";
										const isNumericColumn = column.type === "number";
										const isCenteredColumn = CENTER_ALIGNED_COLUMN_KEYS.has(
											column.key,
										);

										return (
											<td
												key={`${row?.id ?? rowIndex}-${column.key}`}
												title={displayValue}
												className={cn(
													"px-1 py-1 align-middle text-[9px] text-slate-700",
													isNumericColumn && "text-right tabular-nums",
													isCenteredColumn && !isNumericColumn && "text-center",
												)}
											>
												<div className="truncate whitespace-nowrap">
													{displayValue || (
														<span className="text-transparent">.</span>
													)}
												</div>
											</td>
										);
									})}
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
};
