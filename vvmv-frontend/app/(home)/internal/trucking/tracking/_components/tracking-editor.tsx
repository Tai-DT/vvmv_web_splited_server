"use client";

import {
	ChevronLeft,
	ChevronRight,
	Loader2,
	RefreshCw,
	Save,
	Search,
	Trash2,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

// Column definitions for tracking
type TrackingColumn = {
	key: string;
	label: string;
	type: "text" | "number" | "date";
	minWidth?: string;
};

const TRACKING_COLUMNS: TrackingColumn[] = [
	{
		key: "deliveryNumber",
		label: "B (Vận đơn)",
		type: "text",
		minWidth: "140px",
	},
	{ key: "image", label: "C (Ảnh URL)", type: "text", minWidth: "120px" },
	{ key: "time", label: "D (Thời gian)", type: "date", minWidth: "160px" },
	{ key: "location", label: "Vị trí (E)", type: "text", minWidth: "120px" },
	{ key: "file", label: "File (F)", type: "text", minWidth: "100px" },
	{ key: "userMail", label: "Email (G)", type: "text", minWidth: "150px" },
	{ key: "userName", label: "Người tạo (H)", type: "text", minWidth: "140px" },
	{ key: "userTel", label: "SĐT (I)", type: "text", minWidth: "110px" },
	{ key: "note", label: "Ghi chú (J)", type: "text", minWidth: "150px" },
	{ key: "status", label: "Trạng thái (K)", type: "text", minWidth: "140px" },
	{ key: "description", label: "Mô tả (L)", type: "text", minWidth: "200px" },
	{
		key: "customerName",
		label: "Khách hàng (M)",
		type: "text",
		minWidth: "150px",
	},
	{ key: "from", label: "Từ (N)", type: "text", minWidth: "100px" },
	{ key: "to", label: "Đến (O)", type: "text", minWidth: "100px" },
	{ key: "dateSend", label: "Ngày gửi (P)", type: "date", minWidth: "130px" },
	{ key: "totalBox", label: "Số kiện (Q)", type: "number", minWidth: "90px" },
	{ key: "weight", label: "Cân nặng (R)", type: "number", minWidth: "90px" },
	{ key: "address", label: "Địa chỉ (S)", type: "text", minWidth: "200px" },
];

import { AddTrackingDialog } from "./add-tracking-dialog";

export function TrackingEditor() {
	const [data, setData] = useState<any[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");

	// Pagination state
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(50);
	const [totalItems, setTotalItems] = useState(0);

	const formatToLocalValue = (dateStr: any, type: string) => {
		if (!dateStr) return "";
		const date = new Date(dateStr);
		if (Number.isNaN(date.getTime())) return "";

		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		const hours = String(date.getHours()).padStart(2, "0");
		const minutes = String(date.getMinutes()).padStart(2, "0");

		if (type === "date") return `${year}-${month}-${day}`;
		return `${year}-${month}-${day}T${hours}:${minutes}`;
	};

	const _createEmptyRow = useCallback(
		() => ({
			deliveryNumber: "",
			status: "",
			time: new Date().toISOString(),
			location: "",
			description: "",
			customerName: "",
			from: "",
			to: "",
			dateSend: new Date().toISOString().slice(0, 10),
			totalBox: 0,
			weight: 0,
			address: "",
			note: "",
			userName: "",
			userTel: "",
			userMail: "",
			file: "",
			image: "",
		}),
		[],
	);

	const fetchTracking = useCallback(async () => {
		setIsLoading(true);
		try {
			const offset = (page - 1) * pageSize;
			const url = searchQuery
				? `/api/tracking?deliveryNumber=${encodeURIComponent(searchQuery)}&limit=${pageSize}&offset=${offset}`
				: `/api/tracking?limit=${pageSize}&offset=${offset}`;

			const response = await fetch(url);
			if (!response.ok) throw new Error("Failed to load data");
			const result = await response.json();
			setData(result.items);
			setTotalItems(result.total);
		} catch (_error) {
			toast.error("Error loading data");
		} finally {
			setIsLoading(false);
		}
	}, [searchQuery, page, pageSize]);

	useEffect(() => {
		fetchTracking();
	}, [fetchTracking]);

	// Reset to page 1 on search
	const handleSearch = () => {
		setPage(1);
		fetchTracking();
	};

	const handleCellChange = (
		rowIndex: number,
		columnKey: string,
		value: string,
	) => {
		setData((prev) => {
			const newData = [...prev];
			const column = TRACKING_COLUMNS.find((c) => c.key === columnKey);

			let parsedValue: any = value;
			if (column?.type === "number") {
				parsedValue = parseFloat(value.replace(/,/g, "")) || 0;
			} else if (column?.type === "date") {
				const d = new Date(value);
				parsedValue = Number.isNaN(d.getTime()) ? value : d.toISOString();
			}

			newData[rowIndex] = { ...newData[rowIndex], [columnKey]: parsedValue };
			return newData;
		});
	};

	const handlePaste = (e: React.ClipboardEvent) => {
		const target = e.target as HTMLElement;
		const clipboardData = e.clipboardData.getData("text");
		const rows = clipboardData
			.split(/\r?\n/)
			.filter((row) => row.trim() !== "");

		// If not pasting into an input, ignore or show hint
		if (target.tagName !== "INPUT") return;

		// Pasting into a cell - handle as grid fill starting from that cell
		if (rows.length <= 1 && !rows[0].includes("\t")) return; // Single cell paste - let native handle it

		e.preventDefault();
		const input = target as HTMLInputElement;
		const cell = input.closest("td");
		const tableRow = cell?.closest("tr");
		const tbody = tableRow?.closest("tbody");

		if (cell && tableRow && tbody) {
			const allCells = Array.from(tableRow.querySelectorAll("td"));
			const cellIndex = allCells.indexOf(cell);
			const startColumnIndex = cellIndex - 1; // Skip index col (#)

			const allRows = Array.from(tbody.querySelectorAll("tr"));
			const startRowIndex = allRows.indexOf(tableRow);

			setData((prev) => {
				const newData = [...prev];
				rows.forEach((rowText, rowOffset) => {
					const rowIndex = startRowIndex + rowOffset;
					if (rowIndex >= newData.length) return; // Don't add new rows in edit mode

					const cellValues = rowText.split("\t");

					cellValues.forEach((value, colOffset) => {
						const columnIndex = startColumnIndex + colOffset;
						if (columnIndex < 0 || columnIndex >= TRACKING_COLUMNS.length)
							return;

						const column = TRACKING_COLUMNS[columnIndex];
						const val = value.trim();

						if (column.type === "number") {
							newData[rowIndex][column.key] =
								parseFloat(val.replace(/,/g, "")) || 0;
						} else if (column.type === "date") {
							const date = new Date(val);
							newData[rowIndex][column.key] = Number.isNaN(date.getTime())
								? val
								: date.toISOString();
						} else {
							newData[rowIndex][column.key] = val;
						}
					});
				});
				return newData;
			});
			toast.success(`Đã cập nhật dữ liệu từ paste`);
		}
	};

	const handleSave = async () => {
		setIsSaving(true);
		try {
			const response = await fetch("/api/tracking", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ items: data }),
			});
			if (!response.ok) throw new Error("Lỗi khi lưu");
			toast.success("Đã lưu thành công");
			fetchTracking();
		} catch (_error) {
			toast.error("Không thể lưu dữ liệu");
		} finally {
			setIsSaving(false);
		}
	};

	const deleteRow = async (index: number) => {
		const item = data[index];
		if (item.id) {
			if (!confirm("Bạn có chắc chắn muốn xóa dòng này khỏi DB?")) return;
			try {
				const res = await fetch("/api/tracking", {
					method: "DELETE",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ ids: [item.id] }),
				});
				if (!res.ok) throw new Error();
				toast.success("Đã xóa");
				fetchTracking();
			} catch {
				toast.error("Lỗi khi xóa");
				return;
			}
		}
	};

	const totalPages = Math.ceil(totalItems / pageSize);

	return (
		<div className="flex flex-col h-full bg-white rounded-xl border shadow-sm overflow-auto">
			{/* Search and Action Header - Fixed */}
			<div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 border-b shrink-0">
				<div className="flex items-center gap-2">
					<div className="relative">
						<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Tìm mã vận đơn..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-9 w-[300px] h-10 border-slate-200"
							onKeyDown={(e) => e.key === "Enter" && handleSearch()}
						/>
					</div>
					<Button
						variant="outline"
						size="icon"
						onClick={fetchTracking}
						disabled={isLoading}
						className="h-10 w-10 border-slate-200"
					>
						<RefreshCw
							className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
						/>
					</Button>
					<div className="text-xs text-muted-foreground ml-2 px-3 py-1 bg-slate-100 rounded-full font-medium">
						Tổng cộng:{" "}
						<span className="font-bold text-blue-600">{totalItems}</span> bản
						ghi
					</div>
				</div>

				<div className="flex items-center gap-2">
					<AddTrackingDialog onSuccess={fetchTracking} />
					<Button
						onClick={handleSave}
						disabled={isSaving || data.length === 0}
						className="bg-emerald-600 hover:bg-emerald-700 h-10 px-6 font-bold shadow-lg shadow-emerald-100 transition-all active:scale-95"
					>
						{isSaving ? (
							<Loader2 className="h-4 w-4 animate-spin mr-2" />
						) : (
							<Save className="h-4 w-4 mr-2" />
						)}
						Lưu thay đổi bảng sửa
					</Button>
				</div>
			</div>

			{/* Scrollable Table Area */}
			<div
				className="flex-1 overflow-y-auto bg-white max-h-[80vh]"
				onPaste={handlePaste}
			>
				<Table className="relative min-w-full border-separate border-spacing-0">
					<TableHeader className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_rgba(0,0,0,0.05)]">
						<TableRow className="hover:bg-transparent">
							<TableHead className="w-12 text-center text-[10px] uppercase font-bold text-slate-500 bg-slate-50 sticky left-0 z-20">
								STT
							</TableHead>
							{TRACKING_COLUMNS.map((col) => (
								<TableHead
									key={col.key}
									style={{ minWidth: col.minWidth }}
									className="text-[10px] font-bold uppercase py-4 text-slate-700 bg-slate-50 border-b"
								>
									{col.label}
								</TableHead>
							))}
							<TableHead className="w-12 bg-slate-50 border-b"></TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{data.map((item, index) => (
							<TableRow
								key={item.id || index}
								className="hover:bg-blue-50/30 group border-b border-slate-50 transition-colors"
							>
								<TableCell className="text-center text-[11px] text-muted-foreground font-medium bg-white sticky left-0 z-10 border-r border-slate-100 group-hover:bg-blue-50 transition-colors">
									{(page - 1) * pageSize + index + 1}
								</TableCell>
								{TRACKING_COLUMNS.map((col) => (
									<TableCell
										key={col.key}
										className="p-0.5 px-2 text-center border-b border-slate-50/50"
									>
										<Input
											type={
												col.type === "number"
													? "number"
													: col.type === "date"
														? "datetime-local"
														: "text"
											}
											value={
												col.type === "date" && item[col.key]
													? formatToLocalValue(item[col.key], "datetime-local")
													: (item[col.key] ?? "")
											}
											onChange={(e) =>
												handleCellChange(index, col.key, e.target.value)
											}
											className="h-9 text-xs border-transparent bg-transparent hover:border-slate-200 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50/50 px-2 transition-all rounded-md text-center font-medium"
										/>
									</TableCell>
								))}
								<TableCell className="text-center border-b border-slate-50/50">
									<Button
										variant="ghost"
										size="icon"
										onClick={() => deleteRow(index)}
										className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</TableCell>
							</TableRow>
						))}
						{data.length === 0 && !isLoading && (
							<TableRow>
								<TableCell
									colSpan={TRACKING_COLUMNS.length + 2}
									className="h-32 text-center text-muted-foreground bg-slate-50/20"
								>
									<div className="flex flex-col items-center gap-2">
										<Search className="h-8 w-8 opacity-20" />
										<span>Không tìm thấy dữ liệu vận đơn.</span>
									</div>
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			{/* Fixed Pagination Footer */}
			<div className="flex items-center justify-between bg-white p-4 border-t shadow-[0_-1px_rgba(0,0,0,0.05)] shrink-0">
				<div className="flex items-center gap-4 text-xs text-muted-foreground">
					<div className="flex items-center gap-2">
						Hiển thị
						<select
							value={pageSize}
							onChange={(e) => {
								setPageSize(Number(e.target.value));
								setPage(1);
							}}
							className="border border-slate-200 rounded-lg p-1 text-xs focus:ring-2 focus:ring-blue-500 outline-none h-8 w-16 text-center font-bold text-slate-700 cursor-pointer hover:bg-slate-50"
						>
							{[20, 50, 100, 200].map((size) => (
								<option key={size} value={size}>
									{size}
								</option>
							))}
						</select>
						dòng mỗi trang
					</div>
					<span className="opacity-30">|</span>
					<span className="font-medium">
						Đang xem{" "}
						<span className="text-blue-600">
							{Math.min((page - 1) * pageSize + 1, totalItems)} -{" "}
							{Math.min(page * pageSize, totalItems)}
						</span>{" "}
						/ {totalItems}
					</span>
				</div>

				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="icon"
						onClick={() => setPage((p) => Math.max(1, p - 1))}
						disabled={page === 1 || isLoading}
						className="h-9 w-9 rounded-xl border-slate-200 hover:bg-blue-50 hover:text-blue-600 transition-all hover:border-blue-200"
					>
						<ChevronLeft className="h-4 w-4" />
					</Button>

					<div className="flex items-center gap-1.5 px-3 bg-slate-50 rounded-xl border h-9">
						<Input
							type="number"
							value={page}
							onChange={(e) => {
								const v = parseInt(e.target.value, 10);
								if (v >= 1 && v <= totalPages) setPage(v);
							}}
							className="w-10 h-6 text-center text-xs p-0 border-none bg-transparent font-bold focus:ring-0"
						/>
						<span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
							/ {totalPages}
						</span>
					</div>

					<Button
						variant="outline"
						size="icon"
						onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
						disabled={page >= totalPages || isLoading}
						className="h-9 w-9 rounded-xl border-slate-200 hover:bg-blue-50 hover:text-blue-600 transition-all hover:border-blue-200"
					>
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Toast-like Hint bar */}
			<div className="bg-blue-600 text-[10px] text-white/90 py-1.5 px-4 font-bold uppercase tracking-[0.2em] text-center shrink-0">
				Mẹo: Copy từ Excel & Ctrl+V vào ô bất kỳ để nhập liệu nhanh • Dữ liệu
				được bảo mật bởi VVMV
			</div>
		</div>
	);
}
