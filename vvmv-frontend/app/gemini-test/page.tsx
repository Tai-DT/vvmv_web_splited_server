"use client";

import {
	Bot,
	Building2,
	ChevronRight,
	Copy,
	FileCheck,
	FileDown,
	FileText,
	Globe,
	History,
	LayoutDashboard,
	MessageSquare,
	Package,
	Plus,
	Receipt,
	RefreshCw,
	Search,
	Send,
	Sparkles,
	Trash2,
	Truck,
	Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

// Types for Structured Data
interface LogisticsData {
	thong_tin_to_khai: {
		ma_phan_loai: string;
		ma_loai_hinh: string;
		phuong_thuc_van_chuyen: string;
		phan_loai_to_chuc: string;
		co_quan_hai_quan: string;
	};
	nguoi_nhap_khau: {
		ten: string;
		dia_chi: string;
	};
	nguoi_xuat_khau: {
		ten: string;
		dia_chi: string;
		ma_nuoc: string;
	};
	logistic: {
		so_van_don: string;
		so_luong: string;
		loai_kien: string;
		trong_luong: string;
		so_container: string;
		dia_diem_luu_kho: string;
		ngay_den: string;
	};
	hoa_don: {
		so_hoa_don: string;
		ngay_phat_hanh: string;
		tong_tri_gia: string;
		phan_loai_hoa_don: string;
	};
	hang_hoa: Array<{
		stt: number;
		ma_so: string;
		mo_ta: string;
		so_luong: string;
		don_gia: string;
		hs_code_goi_y: string;
		ly_do_hs_code: string;
	}>;
}

const defaultData: LogisticsData = {
	thong_tin_to_khai: {
		ma_phan_loai: "",
		ma_loai_hinh: "",
		phuong_thuc_van_chuyen: "",
		phan_loai_to_chuc: "",
		co_quan_hai_quan: "",
	},
	nguoi_nhap_khau: { ten: "", dia_chi: "" },
	nguoi_xuat_khau: { ten: "", dia_chi: "", ma_nuoc: "" },
	logistic: {
		so_van_don: "",
		so_luong: "",
		loai_kien: "",
		trong_luong: "",
		so_container: "",
		dia_diem_luu_kho: "",
		ngay_den: "",
	},
	hoa_don: {
		so_hoa_don: "",
		ngay_phat_hanh: "",
		tong_tri_gia: "",
		phan_loai_hoa_don: "",
	},
	hang_hoa: [],
};

export default function GeminiEnhancedTester() {
	const [files, setFiles] = useState<File[]>([]);
	const [model, setModel] = useState("gemini-3.1-pro-preview");
	const [loading, setLoading] = useState(false);
	const [extractedData, setExtractedData] =
		useState<LogisticsData>(defaultData);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files) {
			const newFiles = Array.from(e.target.files);
			setFiles((prev) => [...prev, ...newFiles]);
			toast.info(`Đã thêm ${newFiles.length} file tài liệu`);
		}
	};

	const fileToBase64 = (
		file: File,
	): Promise<{ mime_type: string; data: string }> => {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.readAsDataURL(file);
			reader.onload = () => {
				const base64String = (reader.result as string).split(",")[1];
				resolve({ mime_type: file.type, data: base64String });
			};
			reader.onerror = (error) => reject(error);
		});
	};

	const handleAnalyze = async () => {
		if (files.length === 0) {
			toast.error("Vui lòng tải lên chứng từ để phân tích");
			return;
		}

		setLoading(true);
		try {
			const parts: any[] = [
				{
					text: `Hãy phân tích tệp đính kèm và trích xuất thông tin tờ khai hải quan. 
          YÊU CẦU QUAN TRỌNG: Trả về kết quả DUY NHẤT một khối JSON hợp lệ theo cấu trúc sau, không bao gồm văn bản giải thích.
          Cấu trúc JSON:
          {
            "thong_tin_to_khai": { "ma_phan_loai": "...", "ma_loai_hinh": "...", "phuong_thuc_van_chuyen": "...", "phan_loai_to_chuc": "...", "co_quan_hai_quan": "..." },
            "nguoi_nhap_khau": { "ten": "...", "dia_chi": "..." },
            "nguoi_xuat_khau": { "ten": "...", "dia_chi": "...", "ma_nuoc": "..." },
            "logistic": { "so_van_don": "...", "so_luong": "...", "loai_kien": "...", "trong_luong": "...", "so_container": "...", "dia_diem_luu_kho": "...", "ngay_den": "..." },
            "hoa_don": { "so_hoa_don": "...", "ngay_phat_hanh": "...", "tong_tri_gia": "...", "phan_loai_hoa_don": "..." },
            "hang_hoa": [ { "stt": 1, "ma_so": "...", "mo_ta": "...", "so_luong": "...", "don_gia": "...", "hs_code_goi_y": "...", "ly_do_hs_code": "..." } ]
          }`,
				},
			];

			for (const file of files) {
				const isExcel =
					file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
				if (isExcel) {
					const data = await file.arrayBuffer();
					const workbook = XLSX.read(data);
					let excelText = `[File: ${file.name}]\n`;
					workbook.SheetNames.forEach((name) => {
						excelText += `${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}\n`;
					});
					parts.push({ text: excelText });
				} else {
					const fData = await fileToBase64(file);
					parts.push({
						inline_data: { mime_type: fData.mime_type, data: fData.data },
					});
				}
			}

			const response = await fetch("/api/gemini", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ model, contents: [{ parts }] }),
			});

			const data = await response.json();
			if (data.text) {
				// AI often wraps JSON in code blocks
				const jsonStr = data.text.replace(/```json|```/g, "").trim();
				const parsed = JSON.parse(jsonStr);
				setExtractedData(parsed);
				toast.success("Dữ liệu đã được tự động điền!");
			} else {
				throw new Error(data.error || "Không nhận được phản hồi phù hợp");
			}
		} catch (error: any) {
			console.error(error);
			toast.error(`Lỗi phân tích: ${error.message}`);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex h-screen bg-[#F8F9FB] text-[#333] font-sans overflow-hidden">
			{/* --- Main Dashboard --- */}
			<main className="flex-1 flex overflow-hidden">
				{/* Column 2: Document List & Form */}
				<div className="w-[75%] flex flex-col overflow-hidden border-r border-[#E5E7EB]">
					{/* Main Top Header */}
					<header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 shrink-0">
						<div className="flex items-center gap-4">
							<h2 className="text-lg font-bold">Tờ khai nhập khẩu</h2>
							<span className="text-[11px] text-[#9CA3AF]">
								Được tạo lúc 15:45:20 27/02/2026
							</span>
						</div>
						<div className="flex items-center gap-3">
							<select value={model} onChange={(e) => setModel(e.target.value)}>
								<option value="gemini-3.1-pro-preview">
									Gemini 3.1 Pro (Preview 2026)
								</option>
								<option value="gemini-3-flash-preview">
									Gemini 3 Flash (Preview)
								</option>
								<option value="gemini-2.0-flash-thinking-experimental">
									Gemini 2.0 Thinking (Extra Reasoning)
								</option>
							</select>
							<Button
								variant="outline"
								size="sm"
								className="h-9 gap-2 font-bold text-[#4B5563]"
								onClick={() => window.location.reload()}
							>
								<RefreshCw className="w-4 h-4" /> Tạo lại
							</Button>
							<Button
								size="sm"
								className="h-9 gap-2 bg-[#EF6C00] hover:bg-[#D84315] font-bold"
							>
								<FileDown className="w-4 h-4" /> Xuất file
							</Button>
						</div>
					</header>

					<div className="flex-1 overflow-auto p-8 bg-[#F9FAFB] space-y-8">
						{/* Document Thumbnail List */}
						<section className="space-y-4">
							<div className="flex items-center justify-between">
								<h3 className="text-sm font-bold flex items-center gap-2">
									<LayoutDashboard className="w-4 h-4 text-[#EF6C00]" /> Danh
									sách tài liệu
								</h3>
								<button
									onClick={() => fileInputRef.current?.click()}
									className="px-4 py-1.5 bg-[#EF6C00] text-white rounded-full text-xs font-bold flex items-center gap-2 hover:bg-[#D84315] transition-all"
								>
									<Plus className="w-3 h-3" /> Thêm tài liệu
								</button>
								<input
									type="file"
									multiple
									hidden
									ref={fileInputRef}
									onChange={handleFileChange}
								/>
							</div>

							{files.length === 0 ? (
								<div
									className="border-2 border-dashed border-[#E5E7EB] rounded-2xl p-12 text-center bg-white cursor-pointer hover:border-[#EF6C00]/50 transition-all"
									onClick={() => fileInputRef.current?.click()}
								>
									<Upload className="w-12 h-12 text-[#9CA3AF] mx-auto mb-4" />
									<p className="text-sm font-bold text-[#4B5563]">
										Kéo thả hoặc nhấn để chọn tài liệu
									</p>
									<p className="text-xs text-[#9CA3AF] mt-1">
										Hỗ trợ PDF, Images, Excel...
									</p>
								</div>
							) : (
								<div className="grid grid-cols-4 gap-4">
									{files.map((f, i) => (
										<div
											key={i}
											className="bg-white border border-[#E5E7EB] rounded-xl p-3 flex gap-3 relative group overflow-hidden"
										>
											<div className="w-12 h-16 bg-blue-50 rounded border border-blue-100 flex items-center justify-center shrink-0">
												{f.type.includes("pdf") ? (
													<FileText className="text-blue-500" />
												) : (
													<Package className="text-orange-400" />
												)}
												<span className="absolute top-1 left-1 text-[8px] font-bold bg-white/80 px-1 rounded shadow-sm uppercase">
													{f.name.split(".").pop()}
												</span>
											</div>
											<div className="flex-1 min-w-0 pr-4">
												<p className="text-[11px] font-bold truncate leading-tight mb-1">
													{f.name}
												</p>
												<div className="flex flex-wrap gap-1">
													<span className="text-[8px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">
														Chứng từ
													</span>
												</div>
											</div>
											<button
												onClick={() =>
													setFiles((prev) => prev.filter((_, idx) => idx !== i))
												}
												className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 p-1 rounded-full text-red-500"
											>
												<Trash2 className="w-3 h-3" />
											</button>
										</div>
									))}
									<button
										onClick={handleAnalyze}
										disabled={loading}
										className="border-2 border-dashed border-[#EF6C00]/30 rounded-xl flex flex-col items-center justify-center text-[#EF6C00] bg-[#FFF7ED] hover:bg-[#FFEDD5] transition-all"
									>
										{loading ? (
											<Spinner className="w-6 h-6" />
										) : (
											<Sparkles className="w-6 h-6 animate-pulse" />
										)}
										<span className="text-[11px] font-bold mt-2 uppercase tracking-tight">
											Phân tích bằng AI
										</span>
									</button>
								</div>
							)}
						</section>

						{/* Structured Form */}
						<div className="space-y-6 animate-in fade-in duration-700">
							{/* Sec 1: Thông tin tờ khai */}
							<FormSection
								title="Thông tin tờ khai"
								icon={<FileCheck className="w-4 h-4" />}
							>
								<div className="grid grid-cols-2 gap-x-8 gap-y-4">
									<FormInput
										label="Mã phân loại kiểm tra"
										value={extractedData.thong_tin_to_khai.ma_phan_loai}
										readOnly
									/>
									<FormInput
										label="Mã loại hình"
										value={extractedData.thong_tin_to_khai.ma_loai_hinh}
										readOnly
									/>
									<FormInput
										label="Phương thức vận chuyển"
										value={
											extractedData.thong_tin_to_khai.phuong_thuc_van_chuyen
										}
										readOnly
									/>
									<FormInput
										label="Cơ quan Hải quan"
										value={extractedData.thong_tin_to_khai.co_quan_hai_quan}
										readOnly
									/>
								</div>
							</FormSection>

							{/* Sec 2: Người nhập/xuất */}
							<div className="grid grid-cols-2 gap-6">
								<FormSection
									title="Người nhập khẩu"
									icon={<Building2 className="w-4 h-4" />}
								>
									<div className="space-y-4">
										<FormInput
											label="Tên công ty"
											value={extractedData.nguoi_nhap_khau.ten}
											readOnly
										/>
										<FormInput
											label="Địa chỉ"
											value={extractedData.nguoi_nhap_khau.dia_chi}
											readOnly
										/>
									</div>
								</FormSection>
								<FormSection
									title="Người xuất khẩu"
									icon={<Globe className="w-4 h-4" />}
								>
									<div className="space-y-4">
										<FormInput
											label="Tên công ty"
											value={extractedData.nguoi_xuat_khau.ten}
											readOnly
										/>
										<FormInput
											label="Địa chỉ"
											value={extractedData.nguoi_xuat_khau.dia_chi}
											readOnly
										/>
									</div>
								</FormSection>
							</div>

							{/* Sec 3: Logistics */}
							<FormSection
								title="Logistics / Vân tải"
								icon={<Truck className="w-4 h-4" />}
							>
								<div className="grid grid-cols-3 gap-6">
									<FormInput
										label="Số vận đơn (B/L)"
										value={extractedData.logistic.so_van_don}
										readOnly
									/>
									<FormInput
										label="Số lượng kiện"
										value={extractedData.logistic.so_luong}
										readOnly
									/>
									<FormInput
										label="Loại kiện"
										value={extractedData.logistic.loai_kien}
										readOnly
									/>
									<FormInput
										label="Trọng lượng (Gross)"
										value={extractedData.logistic.trong_luong}
										readOnly
									/>
									<FormInput
										label="Địa điểm lưu kho"
										value={extractedData.logistic.dia_diem_luu_kho}
										readOnly
									/>
									<FormInput
										label="Ngày đến (ETA)"
										value={extractedData.logistic.ngay_den}
										readOnly
									/>
								</div>
							</FormSection>

							{/* Sec 4: Hóa đơn */}
							<FormSection
								title="Thông tin hóa đơn"
								icon={<Receipt className="w-4 h-4" />}
							>
								<div className="grid grid-cols-4 gap-6">
									<FormInput
										label="Số hóa đơn"
										value={extractedData.hoa_don.so_hoa_don}
										readOnly
									/>
									<FormInput
										label="Ngày phát hành"
										value={extractedData.hoa_don.ngay_phat_hanh}
										readOnly
									/>
									<FormInput
										label="Tổng giá trị"
										value={extractedData.hoa_don.tong_tri_gia}
										readOnly
									/>
									<FormInput
										label="Loại hóa đơn"
										value={extractedData.hoa_don.phan_loai_hoa_don}
										readOnly
									/>
								</div>
							</FormSection>

							{/* Sec 5: Chi tiết hàng hóa */}
							<FormSection
								title={`Chi tiết hàng hóa (${extractedData.hang_hoa.length})`}
								icon={<Package className="w-4 h-4" />}
							>
								<div className="overflow-x-auto">
									<table className="w-full text-left text-xs">
										<thead>
											<tr className="border-b border-[#E5E7EB] text-[#6B7280]">
												<th className="py-2 font-bold w-12">STT</th>
												<th className="py-2 font-bold">Mô tả hàng hóa</th>
												<th className="py-2 font-bold w-32 text-center">
													Mã HS gợi ý
												</th>
												<th className="py-2 font-bold w-24 text-right">
													Số lượng
												</th>
												<th className="py-2 font-bold w-24 text-right">
													Đơn giá
												</th>
											</tr>
										</thead>
										<tbody>
											{extractedData.hang_hoa.length === 0 ? (
												<tr>
													<td
														colSpan={5}
														className="py-8 text-center text-[#9CA3AF] italic"
													>
														Chưa có dữ liệu hàng hóa
													</td>
												</tr>
											) : (
												extractedData.hang_hoa.map((item, idx) => (
													<tr
														key={idx}
														className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors group"
													>
														<td className="py-3 font-medium">{item.stt}</td>
														<td className="py-3">
															<p className="font-bold">{item.ma_so}</p>
															<p className="text-[#6B7280] line-clamp-1">
																{item.mo_ta}
															</p>
														</td>
														<td className="py-3 text-center">
															<span
																className="bg-orange-100 text-[#EF6C00] px-2 py-1 rounded font-bold text-[10px] cursor-help"
																title={item.ly_do_hs_code}
															>
																{item.hs_code_goi_y}
															</span>
														</td>
														<td className="py-3 text-right font-bold">
															{item.so_luong}
														</td>
														<td className="py-3 text-right font-bold">
															{item.don_gia}
														</td>
													</tr>
												))
											)}
										</tbody>
									</table>
								</div>
							</FormSection>
						</div>
					</div>
				</div>

				{/* Column 3: AI Insights & Chat */}
				<div className="w-[25%] bg-white flex flex-col shrink-0 shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">
					<div className="p-6 border-b border-[#E5E7EB]">
						<h3 className="text-sm font-bold flex items-center gap-2">
							<Bot className="w-4 h-4 text-[#EF6C00]" /> HS Code & Phân tích
						</h3>
					</div>

					<div className="flex-1 overflow-auto p-6 space-y-6">
						{extractedData.hang_hoa.length > 0 ? (
							extractedData.hang_hoa.map((item, i) => (
								<div
									key={i}
									className="p-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl space-y-3 hover:border-[#EF6C00]/40 transition-all"
								>
									<div className="flex justify-between items-start">
										<span className="text-xs font-bold text-[#EF6C00]">
											Gợi ý mã HS
										</span>
										<Copy className="w-3 h-3 text-[#9CA3AF] cursor-pointer hover:text-[#EF6C00]" />
									</div>
									<p className="text-lg font-black tracking-widest text-[#111827]">
										{item.hs_code_goi_y}
									</p>
									<div className="space-y-1">
										<p className="text-[10px] font-bold text-[#6B7280]">
											Lý do áp mã:
										</p>
										<p className="text-[11px] leading-relaxed text-[#4B5563] italic">
											"{item.ly_do_hs_code}"
										</p>
									</div>
									<div className="pt-2 border-t border-[#E5E7EB] flex items-center justify-between">
										<p className="text-[10px] font-bold text-[#9CA3AF]">
											Sản phẩm: {item.ma_so}
										</p>
										<ChevronRight className="w-3 h-3 text-[#9CA3AF]" />
									</div>
								</div>
							))
						) : (
							<div className="h-full flex flex-col items-center justify-center text-[#9CA3AF] opacity-40 text-center px-4">
								<Search className="w-12 h-12 mb-4" />
								<p className="text-xs font-bold uppercase tracking-widest">
									Không có dữ liệu đề xuất
								</p>
								<p className="text-[10px] mt-2">
									Dữ liệu HS Code sẽ xuất hiện sau khi AI phân tích chứng từ.
								</p>
							</div>
						)}
					</div>

					<div className="p-4 border-t border-[#E5E7EB] bg-white">
						<div className="relative">
							<input
								placeholder="Bạn muốn hỏi gì về lô hàng này?"
								className="w-full h-12 pl-4 pr-12 bg-[#F3F4F6] border-none rounded-xl text-sm focus:ring-2 focus:ring-[#EF6C00]/20 outline-none transition-all placeholder:text-[#9CA3AF]"
							/>
							<button className="absolute right-2 top-2 w-8 h-8 bg-[#EF6C00] text-white rounded-lg flex items-center justify-center shadow-lg shadow-orange-200">
								<Send className="w-4 h-4" />
							</button>
						</div>
						<div className="mt-3 flex items-center justify-center gap-4">
							<button className="text-[10px] font-bold text-[#9CA3AF] flex items-center gap-1.5 hover:text-[#EF6C00] transition-colors uppercase">
								<History className="w-3 h-3" /> Lịch sử
							</button>
							<span className="w-1 h-1 rounded-full bg-gray-300" />
							<button className="text-[10px] font-bold text-[#9CA3AF] flex items-center gap-1.5 hover:text-[#EF6C00] transition-colors uppercase">
								<MessageSquare className="w-3 h-3" /> Góp ý
							</button>
						</div>
					</div>
				</div>
			</main>

			<style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #ef6c00;
          opacity: 0.5;
        }
      `}</style>
		</div>
	);
}

// Helper Components
function FormSection({
	title,
	icon,
	children,
}: {
	title: string;
	icon: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-sm">
			<div className="px-6 py-3 border-b border-[#E5E7EB] bg-[#FFF7ED]/30 flex items-center gap-2">
				<span className="text-[#EF6C00] p-1.5 bg-[#FFF7ED] rounded-lg">
					{icon}
				</span>
				<h4 className="text-[13px] font-bold uppercase tracking-tight text-[#4B5563]">
					{title}
				</h4>
			</div>
			<div className="p-6">{children}</div>
		</div>
	);
}

function FormInput({
	label,
	value,
	readOnly = false,
}: {
	label: string;
	value: string;
	readOnly?: boolean;
}) {
	return (
		<div className="space-y-1.5">
			<label className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide">
				{label}
			</label>
			<div
				className={cn(
					"min-h-[40px] w-full px-3 py-2 text-sm border bg-white rounded-lg flex items-center font-medium",
					readOnly
						? "border-[#F3F4F6] text-[#111827]"
						: "border-[#E5E7EB] focus:border-[#EF6C00] focus:ring-1 focus:ring-[#EF6C00]",
				)}
			>
				{value || <span className="text-[#D1D5DB] italic">N/A</span>}
			</div>
		</div>
	);
}
