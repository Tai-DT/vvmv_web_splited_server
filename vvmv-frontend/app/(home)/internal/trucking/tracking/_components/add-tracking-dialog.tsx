"use client";

import {
	ClipboardPaste,
	Plus,
	Save,
	Table as TableIcon,
	Trash2,
	X,
} from "lucide-react";
import type React from "react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
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

interface AddTrackingDialogProps {
	onSuccess: () => void;
}

const TRACKING_COLUMNS = [
	{ key: "deliveryNumber", label: "B (Vận đơn)", minWidth: "140px" },
	{ key: "image", label: "C (Ảnh URL)", minWidth: "120px" },
	{
		key: "time",
		label: "D (Thời gian)",
		type: "datetime-local",
		minWidth: "160px",
	},
	{ key: "location", label: "E (Vị trí)", minWidth: "120px" },
	{ key: "file", label: "F (File)", minWidth: "100px" },
	{ key: "userMail", label: "G (Email)", minWidth: "150px" },
	{ key: "userName", label: "H (Người tạo)", minWidth: "140px" },
	{ key: "userTel", label: "I (SĐT)", minWidth: "110px" },
	{ key: "note", label: "J (Ghi chú)", minWidth: "150px" },
	{ key: "status", label: "K (Trạng thái)", minWidth: "140px" },
	{ key: "description", label: "L (Mô tả)", minWidth: "200px" },
	{ key: "customerName", label: "M (Khách hàng)", minWidth: "150px" },
	{ key: "from", label: "N (Từ)", minWidth: "100px" },
	{ key: "to", label: "O (Đến)", minWidth: "100px" },
	{
		key: "dateSend",
		label: "P (Ngày gửi)",
		type: "datetime-local",
		minWidth: "160px",
	},
	{ key: "totalBox", label: "Q (Số kiện)", type: "number", minWidth: "90px" },
	{ key: "weight", label: "R (Cân nặng)", type: "number", minWidth: "90px" },
	{ key: "address", label: "S (Địa chỉ)", minWidth: "200px" },
];

export function AddTrackingDialog({ onSuccess }: AddTrackingDialogProps) {
	const [open, setOpen] = useState(false);
	const [rows, setRows] = useState<any[]>([]);
	const [isSaving, setIsSaving] = useState(false);

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

	const createEmptyRow = useCallback(
		() => ({
			deliveryNumber: "",
			status: "Đã nhận hàng",
			time: new Date().toISOString(),
			location: "KHO VN",
			description: "",
			customerName: "",
			from: "",
			to: "",
			dateSend: new Date().toISOString(),
			totalBox: 0,
			weight: 0,
			address: "",
			note: "",
		}),
		[],
	);

	const handleAddRow = () => {
		setRows((prev) => [createEmptyRow(), ...prev]);
	};

	const handleRemoveRow = (index: number) => {
		setRows((prev) => prev.filter((_, i) => i !== index));
	};

	const handleCellChange = (index: number, key: string, value: any) => {
		setRows((prev) => {
			const newRows = [...prev];
			const col = TRACKING_COLUMNS.find((c) => c.key === key);
			let parsedValue = value;
			if (col?.type === "datetime-local" || col?.type === "date") {
				const d = new Date(value);
				if (!Number.isNaN(d.getTime())) {
					parsedValue = d.toISOString();
				}
			}

			newRows[index] = { ...newRows[index], [key]: parsedValue };
			return newRows;
		});
	};

	const handlePaste = (e: React.ClipboardEvent) => {
		const target = e.target as HTMLElement;
		// Only handle paste if not in an input (bulk paste area) or if we want to override input paste for multi-cell
		const clipboardData = e.clipboardData.getData("text");
		const lines = clipboardData
			.split(/\r?\n/)
			.filter((line) => line.trim() !== "");

		if (lines.length === 0) return;

		// If it looks like multi-column data from Excel
		if (lines.some((line) => line.includes("\t")) || lines.length > 1) {
			if (target.tagName === "INPUT") {
				// If in input, we only override if it's multiple rows/cols
				e.preventDefault();
			}

			const newRows = lines.map((line) => {
				const cols = line.split("\t");
				const rowData: any = createEmptyRow();

				TRACKING_COLUMNS.forEach((col, i) => {
					const val = (cols[i] || "").trim();
					if (col.type === "number") {
						rowData[col.key] = parseFloat(val.replace(/,/g, "")) || 0;
					} else if (col.type === "datetime-local" || col.type === "date") {
						const date = new Date(val);
						if (!Number.isNaN(date.getTime())) {
							rowData[col.key] = date.toISOString();
						} else {
							rowData[col.key] = val;
						}
					} else {
						rowData[col.key] = val;
					}
				});

				return rowData;
			});

			setRows((prev) => [...newRows, ...prev]);
			toast.success(`Đã nhận ${newRows.length} dòng từ Excel`);
		}
	};

	const handleSave = async () => {
		if (rows.length === 0) {
			toast.error("Vui lòng thêm ít nhất một dòng");
			return;
		}

		const invalid = rows.some((r) => !r.deliveryNumber);
		if (invalid) {
			toast.error("Một số dòng thiếu Mã vận đơn");
			return;
		}

		setIsSaving(true);
		try {
			const response = await fetch("/api/tracking", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ items: rows }),
			});

			if (!response.ok) throw new Error("Thất bại");

			toast.success(`Đã lưu thành công ${rows.length} dòng`);
			setRows([]);
			setOpen(false);
			onSuccess();
		} catch (_error) {
			toast.error("Có lỗi xảy ra khi lưu dữ liệu");
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger
				nativeButton={true}
				render={
					<Button className="bg-blue-600 hover:bg-blue-700 shadow-sm transition-all active:scale-95">
						<Plus className="h-4 w-4 mr-2" /> Thêm vận đơn mới
					</Button>
				}
			/>
			<DialogContent className="!fixed !inset-0 !w-screen !h-screen !max-w-none !max-h-none !m-0 !p-0 !rounded-none border-none flex flex-col overflow-hidden !translate-x-0 !translate-y-0 z-[100]">
				<DialogHeader className="p-6 pb-4 bg-white border-b shrink-0 h-[100px] flex flex-col justify-center">
					<div className="flex items-center justify-between">
						<div className="space-y-1">
							<DialogTitle className="flex items-center gap-2 text-2xl font-bold text-slate-800">
								<div className="p-2 bg-blue-50 rounded-lg text-blue-600">
									<ClipboardPaste className="h-6 w-6" />
								</div>
								Nhập liệu vận đơn mới
							</DialogTitle>
							<DialogDescription className="text-slate-500 text-base">
								Hỗ trợ dán trực tiếp từ Excel. Dữ liệu sẽ được lưu mới vào hệ
								thống tracking.
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				<div className="flex-1 overflow-hidden flex flex-col bg-slate-50/30">
					<div className="flex-1 overflow-auto p-8 pt-4">
						<div
							className="border-2 border-dashed border-slate-200 rounded-2xl bg-white min-h-[400px] relative transition-colors focus-within:border-blue-200 focus-within:bg-blue-50/5"
							onPaste={handlePaste}
						>
							{rows.length === 0 ? (
								<div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-6 animate-in fade-in zoom-in duration-300">
									<div className="w-24 h-24 bg-slate-50 rounded-3xl flex items-center justify-center shadow-inner border border-slate-100">
										<TableIcon className="h-12 w-12 opacity-30" />
									</div>
									<div className="text-center space-y-2">
										<p className="font-semibold text-lg text-slate-600">
											Sẵn sàng nhận dữ liệu
										</p>
										<p className="text-sm max-w-[300px] leading-relaxed">
											Nhấn{" "}
											<kbd className="px-2 py-1 bg-slate-100 rounded border border-slate-300 text-slate-700">
												Ctrl+V
											</kbd>{" "}
											để dán từ Excel <br /> hoặc thêm thủ công từng dòng.
										</p>
									</div>
									<Button
										variant="outline"
										className="rounded-xl border-slate-200 hover:bg-white hover:border-blue-400 hover:text-blue-600 transition-all font-medium"
										onClick={handleAddRow}
									>
										<Plus className="h-4 w-4 mr-2" /> Bắt đầu với dòng trống
									</Button>
								</div>
							) : (
								<div className="animate-in fade-in duration-300">
									<Table>
										<TableHeader className="bg-slate-50/80 backdrop-blur sticky top-0 z-20">
											<TableRow className="hover:bg-transparent border-slate-200">
												<TableHead className="w-16 text-center text-slate-500 font-bold uppercase text-[10px] tracking-wider">
													STT
												</TableHead>
												{TRACKING_COLUMNS.map((col) => (
													<TableHead
														key={col.key}
														style={{ minWidth: col.minWidth }}
														className="text-slate-700 font-bold uppercase text-[10px] tracking-wider py-4"
													>
														{col.label}
													</TableHead>
												))}
												<TableHead className="w-16"></TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{rows.map((row, index) => (
												<TableRow
													key={index}
													className="hover:bg-blue-50/30 transition-colors border-slate-100 group/row"
												>
													<TableCell className="text-center text-xs text-slate-400 font-bold">
														{index + 1}
													</TableCell>
													{TRACKING_COLUMNS.map((col) => (
														<TableCell key={col.key} className="p-1 px-2">
															<Input
																type={col.type || "text"}
																value={
																	col.type === "datetime-local" ||
																	col.type === "date"
																		? formatToLocalValue(
																				row[col.key],
																				"datetime-local",
																			)
																		: (row[col.key] ?? "")
																}
																onChange={(e) =>
																	handleCellChange(
																		index,
																		col.key,
																		e.target.value,
																	)
																}
																className="h-10 text-sm border-transparent focus:border-blue-400 focus:ring-4 focus:ring-blue-100 bg-transparent focus:bg-white rounded-xl transition-all font-medium"
																placeholder="..."
															/>
														</TableCell>
													))}
													<TableCell className="p-1 text-center">
														<Button
															variant="ghost"
															size="icon"
															onClick={() => handleRemoveRow(index)}
															className="h-9 w-9 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
														>
															<X className="h-4 w-4" />
														</Button>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							)}
						</div>
					</div>
				</div>

				<DialogFooter className="p-8 bg-white border-t items-center justify-between sm:justify-between">
					<div className="flex items-center gap-6">
						<div className="flex flex-col">
							<span className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">
								Tổng số dòng
							</span>
							<span className="text-2xl font-black text-blue-600">
								{rows.length}
							</span>
						</div>
						{rows.length > 0 && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setRows([])}
								className="text-red-500 hover:text-red-600 hover:bg-red-50 font-bold text-xs uppercase tracking-wider"
							>
								<Trash2 className="size-3 mr-2" /> Xóa tất cả
							</Button>
						)}
					</div>
					<div className="flex gap-3">
						<DialogClose
							nativeButton={true}
							render={
								<Button
									variant="outline"
									className="rounded-xl font-bold border-slate-200"
								>
									Đóng lại
								</Button>
							}
						/>
						<Button
							variant="secondary"
							className="rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
							onClick={handleAddRow}
							disabled={isSaving}
						>
							<Plus className="h-4 w-4 mr-2" /> Thêm dòng mới
						</Button>
						<Button
							onClick={handleSave}
							disabled={isSaving || rows.length === 0}
							className="bg-blue-600 hover:bg-blue-700 h-11 px-8 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:shadow-none"
						>
							{isSaving ? (
								<Save className="h-4 w-4 animate-spin mr-2" />
							) : (
								<Save className="h-4 w-4 mr-2" />
							)}
							Lưu vào hệ thống
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
