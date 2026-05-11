import type { Metadata } from "next";
import { VendorFeeTypeManagementClient } from "./_components/vendor-fee-type-management-client";

export const metadata: Metadata = {
	title: "Cấu hình phí Vendor | Trucking",
	description: "Thiết lập tên phí và loại phí dùng cho Vendor Portal.",
};

export default function VendorFeeTypePage() {
	return (
		<div className="flex flex-col h-full gap-4 overflow-hidden">
			<div className="flex flex-col gap-1 shrink-0 px-6 pt-6">
				<h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white uppercase italic">
					Cấu Hình Phí Vendor
				</h1>
				<p className="text-sm text-slate-500 font-bold uppercase tracking-widest opacity-60">
					Cấu hình Tên phí và Loại phí để vendor chọn nhanh khi nhập chi phí.
				</p>
			</div>

			<div className="flex-1 min-h-0 overflow-auto px-6 pb-6">
				<VendorFeeTypeManagementClient />
			</div>
		</div>
	);
}
