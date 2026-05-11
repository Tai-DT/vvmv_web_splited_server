import { WarehouseClient } from "./_components/warehouse-client";

export const metadata = {
	title: "Quản lý Kho (Warehouse) | Trucking | VVMV",
	description:
		"Quản lý thông tin kho hàng: tên kho, địa chỉ giao hàng, liên hệ, thông tin xuất hoá đơn.",
};

export default function WarehousePage() {
	return (
		<div className="flex flex-col h-full gap-4 overflow-hidden">
			<div className="flex flex-col gap-1 shrink-0 px-6 pt-6">
				<h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white uppercase italic">
					Quản lý Kho (Warehouse)
				</h1>
				<p className="text-sm text-slate-500 font-bold uppercase tracking-widest opacity-60">
					Cấu hình thông tin kho theo MST khách hàng — địa chỉ, liên hệ, thông
					tin hoá đơn.
				</p>
			</div>
			<div className="flex-1 min-h-0 overflow-auto px-6 pb-6">
				<WarehouseClient />
			</div>
		</div>
	);
}
