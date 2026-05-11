import type { Metadata } from "next";
import { ShippingLineManagementClient } from "./_components/shipping-line-management-client";

export const metadata: Metadata = {
	title: "Quản lý Hãng Tàu (Shipping Lines) | Trucking",
	description: "Quản lý danh mục hãng tàu cho Trucking",
};

export default function ShippingLineManagementPage() {
	return (
		<div className="flex flex-col h-full gap-4 overflow-hidden">
			<div className="flex flex-col gap-1 shrink-0 px-6 pt-6">
				<h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white uppercase italic">
					Quản lý Hãng Tàu (Shipping Lines)
				</h1>
				<p className="text-sm text-slate-500 font-bold uppercase tracking-widest opacity-60">
					Cập nhật danh sách các hãng tàu vận chuyển.
				</p>
			</div>

			<div className="flex-1 min-h-0 overflow-auto px-6 pb-6">
				<ShippingLineManagementClient />
			</div>
		</div>
	);
}
