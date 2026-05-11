"use client";

import {
	ArrowRight,
	Calendar,
	FileSpreadsheet,
	RefreshCw,
	Truck,
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
import { useSession } from "@/lib/auth-client";

// ─── Types ────────────────────────────────────────────────────────────────────
type DailyReportRow = {
	id: string;
	jobNumber: string;
	fcrNumber: string;
	plateNumber: string;
	shipper: string;
	warehouse: string;
	grossWeight: number;
	cbm: number;
	quantity: number;
	pickupAt: string;
	deliveryAt: string;
	companyName: string;
	operationType: string;
	note: string;
	routineDetail: string;
};

type GroupedData = {
	plateNumber: string;
	rows: DailyReportRow[];
	totalCbm: number;
	totalGw: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtNum(val: number | null | undefined): string {
	if (val === null || val === undefined) return "0";
	return val.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

export default function DailyTruckReportPage() {
	const { data: session } = useSession();
	const [date, setDate] = useState<string>(
		new Date().toISOString().split("T")[0],
	);
	const [vendor, setVendor] = useState<string>("ALL");
	const [vendors, setVendors] = useState<string[]>([]);
	const [data, setData] = useState<DailyReportRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [searched, setSearched] = useState(false);

	// Set default vendor based on user site
	useEffect(() => {
		const user = session?.user as any;
		if (user?.site) {
			if (user.site === "HAN") {
				setVendor("VVMV.HN");
			} else if (user.site === "SGN") {
				setVendor("VVMVSG");
			}
		}
	}, [session?.user]);

	useEffect(() => {
		fetch("/api/vendors")
			.then((res) => res.json())
			.then((json) => setVendors(json.vendors || []))
			.catch((err) => console.error("Failed to load vendors", err));
	}, []);

	const fetchData = useCallback(
		async (currentDate: string, currentVendor: string) => {
			setLoading(true);
			try {
				const params = new URLSearchParams({ date: currentDate });
				if (currentVendor !== "ALL") params.append("vendor", currentVendor);

				const res = await fetch(
					`/api/trucking-followup/daily-truck-report?${params.toString()}`,
				);
				if (!res.ok) throw new Error((await res.json()).message);
				const json = await res.json();
				setData(json.data ?? []);
				setSearched(true);
			} catch (err: any) {
				toast.error(err.message || "Lỗi khi tải báo cáo");
			} finally {
				setLoading(false);
			}
		},
		[],
	);

	useEffect(() => {
		fetchData(date, vendor);
	}, [date, vendor, fetchData]);

	const groupedData = useMemo(() => {
		const groups: Record<string, DailyReportRow[]> = {};
		data.forEach((row) => {
			const plate = row.plateNumber || "CHƯA CÓ XE";
			if (!groups[plate]) groups[plate] = [];
			groups[plate].push(row);
		});

		return Object.entries(groups)
			.map(([plateNumber, rows]) => ({
				plateNumber,
				rows,
				totalCbm: rows.reduce((sum, r) => sum + r.cbm, 0),
				totalGw: rows.reduce((sum, r) => sum + r.grossWeight, 0),
			}))
			.sort((a, b) => a.plateNumber.localeCompare(b.plateNumber));
	}, [data]);

	const handleExport = useCallback(() => {
		if (data.length === 0) {
			toast.error("Không có dữ liệu để xuất");
			return;
		}
		const headers = [
			"Số xe",
			"Số FCR",
			"Người gửi (Shipper)",
			"Kho (Warehouse)",
			"G.W (kg)",
			"CBM",
			"Số kiện",
			"Lịch trình",
			"Giờ Pickup",
			"Giờ Delivery",
			"Khách hàng",
			"Loại hình",
			"Ghi chú",
		];

		const rows: any[] = [];
		groupedData.forEach((group) => {
			group.rows.forEach((r) => {
				rows.push([
					group.plateNumber,
					r.fcrNumber,
					r.shipper,
					r.warehouse,
					r.grossWeight,
					r.cbm,
					r.quantity,
					r.routineDetail,
					r.pickupAt,
					r.deliveryAt,
					r.companyName,
					r.operationType,
					r.note,
				]);
			});
			// Add a summary row for the group
			rows.push([
				`TỔNG XE ${group.plateNumber}`,
				"",
				"",
				"",
				"",
				group.totalGw,
				group.totalCbm,
				group.rows.reduce((sum, r) => sum + r.quantity, 0),
				"",
				"",
				"",
				"",
				"",
				"",
			]);
			rows.push([]); // Empty row for spacing
		});

		const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, "Báo cáo Chuyến xe");
		const filename = `bao-cao-chuyen-xe-${date}.xlsx`;
		XLSX.writeFile(wb, filename);
		toast.success(`Đã xuất file ${filename}`);
	}, [data, groupedData, date]);

	return (
		<div className="flex flex-col gap-6 p-6 min-h-screen bg-slate-50/50 dark:bg-slate-950/50">
			{/* Header Section */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-black tracking-tighter flex items-center gap-2 text-slate-900 dark:text-white uppercase italic">
						<Truck className="size-8 text-blue-600 fill-blue-600/10" />
						Báo cáo Chuyến Xe Hàng Ngày
					</h1>
					<p className="text-sm text-slate-500 font-medium mt-1">
						Theo dõi chi tiết công việc của từng đầu xe theo ngày
					</p>
				</div>

				<div className="flex items-center gap-3">
					<div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl shadow-sm">
						<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 px-1 border-r border-slate-100 dark:border-slate-800">
							Nhà xe
						</span>
						<Select
							value={vendor}
							onValueChange={(val) => setVendor(val as string)}
						>
							<SelectTrigger className="border-none bg-transparent focus:ring-0 w-44 font-bold text-sm h-8 shadow-none">
								<SelectValue placeholder="Tất cả nhà xe" />
							</SelectTrigger>
							<SelectPositioner>
								<SelectContent className="rounded-2xl border-slate-200 shadow-xl">
									<SelectItem value="ALL" className="font-bold text-xs">
										TẤT CẢ NHÀ XE
									</SelectItem>
									{vendors.map((v) => (
										<SelectItem key={v} value={v} className="text-xs">
											{v}
										</SelectItem>
									))}
								</SelectContent>
							</SelectPositioner>
						</Select>
					</div>

					<div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl shadow-sm">
						<Calendar className="size-4 text-blue-500 ml-2" />
						<Input
							type="date"
							value={date}
							onChange={(e) => setDate(e.target.value)}
							className="border-none bg-transparent focus-visible:ring-0 w-36 font-bold text-sm h-8"
						/>
					</div>

					<Button
						onClick={() => fetchData(date, vendor)}
						disabled={loading}
						variant="outline"
						className="rounded-2xl h-11 px-5 border-slate-200"
					>
						{loading ? (
							<RefreshCw className="size-4 animate-spin" />
						) : (
							<RefreshCw className="size-4" />
						)}
					</Button>

					<Button
						onClick={handleExport}
						disabled={data.length === 0}
						className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl h-11 px-6 shadow-lg shadow-emerald-500/20 font-bold gap-2"
					>
						<FileSpreadsheet className="size-4" />
						Xuất Excel
					</Button>
				</div>
			</div>

			{/* Stats Summary */}
			{searched && (
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
					<div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-1">
						<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
							Tổng Số Xe Chạy
						</span>
						<div className="flex items-baseline gap-1">
							<span className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white">
								{groupedData.length}
							</span>
							<span className="text-xs font-bold text-slate-400">Xe</span>
						</div>
					</div>
					<div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-1">
						<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
							Tổng Số FCR
						</span>
						<div className="flex items-baseline gap-1">
							<span className="text-3xl font-black tracking-tighter text-blue-600">
								{data.length}
							</span>
							<span className="text-xs font-bold text-slate-400">Kiện</span>
						</div>
					</div>
					<div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-1">
						<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
							Tổng Trọng Lượng (GW)
						</span>
						<div className="flex items-baseline gap-1">
							<span className="text-3xl font-black tracking-tighter text-emerald-600">
								{fmtNum(data.reduce((sum, r) => sum + r.grossWeight, 0))}
							</span>
							<span className="text-xs font-bold text-slate-400">kg</span>
						</div>
					</div>
					<div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-1">
						<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
							Tổng Khối Lượng (CBM)
						</span>
						<div className="flex items-baseline gap-1">
							<span className="text-3xl font-black tracking-tighter text-amber-500">
								{fmtNum(data.reduce((sum, r) => sum + r.cbm, 0))}
							</span>
							<span className="text-xs font-bold text-slate-400">m³</span>
						</div>
					</div>
				</div>
			)}

			{/* Main Content */}
			<div className="flex flex-col gap-8">
				{loading ? (
					<div className="flex flex-col items-center justify-center py-40 gap-4">
						<div className="size-16 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
						<p className="font-bold text-slate-400 animate-pulse uppercase tracking-widest text-xs">
							Đang nạp dữ liệu...
						</p>
					</div>
				) : data.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-40 bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-inner">
						<div className="size-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
							<Truck className="size-12 text-slate-200 dark:text-slate-700" />
						</div>
						<p className="text-xl font-black text-slate-400 uppercase tracking-tighter italic">
							Không tìm thấy dữ liệu
						</p>
						<p className="text-sm text-slate-400 font-medium">
							Vui lòng chọn ngày khác hoặc kiểm tra lại lịch thực hiện
						</p>
					</div>
				) : (
					<div className="space-y-10">
						{groupedData.map((group) => (
							<div
								key={group.plateNumber}
								className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col"
							>
								{/* Truck Header */}
								<div className="bg-slate-50/50 dark:bg-slate-800/50 px-8 py-6 flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 dark:border-slate-800 gap-4">
									<div className="flex items-center gap-5">
										<div className="size-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
											<Truck className="size-7 text-white" />
										</div>
										<div>
											<h2 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white uppercase italic leading-none mb-1">
												{group.plateNumber}
											</h2>
											<div className="flex items-center gap-2">
												<Badge
													variant="outline"
													className="text-[10px] font-black uppercase tracking-widest border-blue-200 text-blue-600 bg-blue-50 dark:bg-blue-900/10"
												>
													{group.rows.length} Chuyến
												</Badge>
												<span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
													Hoạt động ngày{" "}
													{new Date(date).toLocaleDateString("vi-VN")}
												</span>
											</div>
										</div>
									</div>

									<div className="flex items-center gap-8">
										<div className="flex flex-col items-end">
											<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
												Tổng GW
											</span>
											<span className="text-xl font-black text-emerald-600 tracking-tighter">
												{fmtNum(group.totalGw)} kg
											</span>
										</div>
										<div className="flex flex-col items-end border-l border-slate-200 dark:border-slate-700 pl-8">
											<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
												Tổng CBM
											</span>
											<span className="text-xl font-black text-amber-500 tracking-tighter">
												{fmtNum(group.totalCbm)} m³
											</span>
										</div>
									</div>
								</div>

								{/* Truck Details Table */}
								<div className="overflow-x-auto">
									<Table>
										<TableHeader>
											<TableRow className="hover:bg-transparent border-none">
												<TableHead className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 border-none">
													Khách hàng
												</TableHead>
												<TableHead className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 border-none">
													FCR / Kiện
												</TableHead>
												<TableHead className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 border-none">
													Chi Tiết Vận Chuyển
												</TableHead>
												<TableHead className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 border-none">
													Lộ trình
												</TableHead>
												<TableHead className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 border-none">
													Ghi chú
												</TableHead>
												<TableHead className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 border-none text-right">
													Tải Trọng
												</TableHead>
												<TableHead className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 border-none">
													Thời Gian
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{group.rows.map((row) => (
												<TableRow
													key={row.id}
													className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 border-t border-slate-50 dark:border-slate-800/50 group"
												>
													<TableCell className="px-8 py-5">
														<p className="font-black text-slate-900 dark:text-white tracking-widest text-sm uppercase">
															{row.companyName}
														</p>
														<p className="text-[10px] font-bold text-slate-400 italic">
															Mã lô: {row.fcrNumber}
														</p>
													</TableCell>
													<TableCell className="px-4 py-5">
														<div className="flex flex-col gap-1">
															<Badge
																variant="secondary"
																className="w-fit font-mono font-bold text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded overflow-hidden"
															>
																{row.fcrNumber}
															</Badge>
															<span className="text-[10px] font-bold text-slate-500">
																{row.quantity} kiện
															</span>
														</div>
													</TableCell>
													<TableCell className="px-4 py-5">
														<div className="flex flex-col gap-1">
															<div className="flex items-center gap-1.5">
																<span className="text-[10px] font-black text-slate-400 uppercase tracking-wider w-12">
																	Từ:
																</span>
																<span className="text-xs font-bold text-slate-700 dark:text-slate-300">
																	{row.shipper}
																</span>
															</div>
															<div className="flex items-center gap-1.5">
																<span className="text-[10px] font-black text-slate-400 uppercase tracking-wider w-12">
																	Đến:
																</span>
																<span className="text-xs font-bold text-blue-600 dark:text-blue-400">
																	{row.warehouse}
																</span>
															</div>
														</div>
													</TableCell>
													<TableCell className="px-4 py-5 max-w-[200px]">
														{row.routineDetail ? (
															<div className="bg-amber-50 dark:bg-amber-900/10 p-2 rounded-xl border border-amber-100 dark:border-amber-900/30">
																<p className="text-xs font-semibold text-slate-700 dark:text-slate-300 line-clamp-2">
																	{row.routineDetail}
																</p>
															</div>
														) : (
															<span className="text-slate-300 italic text-[10px]">
																không có
															</span>
														)}
													</TableCell>
													<TableCell className="px-4 py-5 max-w-[200px]">
														{row.note ? (
															<p className="text-xs font-medium text-slate-500 dark:text-slate-400 italic leading-relaxed">
																“{row.note}”
															</p>
														) : (
															<span className="text-slate-300 italic text-[10px]">
																không có
															</span>
														)}
													</TableCell>
													<TableCell className="px-4 py-5 text-right">
														<div className="flex flex-col items-end">
															<span className="text-sm font-black text-slate-900 dark:text-white tracking-tighter">
																{fmtNum(row.grossWeight)} kg
															</span>
															<span className="text-[10px] font-bold text-slate-400 tracking-wider whitespace-nowrap">
																{fmtNum(row.cbm)} m³ (CBM)
															</span>
														</div>
													</TableCell>
													<TableCell className="px-8 py-5">
														<div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors border border-transparent group-hover:border-slate-100 dark:group-hover:border-slate-600 shadow-sm shadow-transparent group-hover:shadow-slate-200/50">
															<div className="flex flex-col items-center">
																<span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
																	Pickup
																</span>
																<span className="text-xs font-black text-slate-700 dark:text-slate-200">
																	{row.pickupAt || "—"}
																</span>
															</div>
															<ArrowRight className="size-3 text-slate-300" />
															<div className="flex flex-col items-center">
																<span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
																	Delivery
																</span>
																<span className="text-xs font-black text-blue-600 dark:text-blue-400">
																	{row.deliveryAt || "—"}
																</span>
															</div>
														</div>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
