import { CustomsWarehouseManagementClient } from "./_components/customs-warehouse-management-client";

export const metadata = {
	title: "Quản lý Kho Hải Quan | Trucking | VVMV",
	description:
		"Quản lý danh sách kho hải quan (WH HQ) – kho lưu giữ hàng dưới sự giám sát hải quan.",
};

export default function CustomsWarehousePage() {
	return (
		<div className="flex flex-col h-full gap-4 overflow-hidden">
			<div className="flex flex-col gap-1 shrink-0 px-6 pt-6">
				<h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white uppercase italic">
					Quản lý Kho Hải Quan (WH HQ)
				</h1>
				<p className="text-sm text-slate-500 font-bold uppercase tracking-widest opacity-60">
					Danh mục kho hải quan · Phân biệt với kho khách hàng (Warehouse)
				</p>
			</div>

			<div className="flex-1 min-h-0 overflow-auto px-6 pb-6">
				<CustomsWarehouseManagementClient />
			</div>
		</div>
	);
}
