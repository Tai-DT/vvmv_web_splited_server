import type { Metadata } from "next";
import { VehicleManagementClient } from "./_components/vehicle-management-client";

export const metadata: Metadata = {
	title: "Quản lý Phương Tiện (Vehicles) | Trucking",
	description: "Quản lý danh mục biển số xe, tài xế và loại xe cho Trucking",
};

export default function VehicleManagementPage() {
	return (
		<div className="flex flex-col h-full gap-4 overflow-hidden">
			<div className="flex flex-col gap-1 shrink-0 px-6 pt-6">
				<h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white uppercase italic">
					Quản lý Phương Tiện (Vehicles)
				</h1>
				<p className="text-sm text-slate-500 font-bold uppercase tracking-widest opacity-60">
					Cập nhật Biển số xe, Tài xế và Loại xe vận chuyển của đội xe.
				</p>
			</div>

			<div className="flex-1 min-h-0 overflow-auto px-6 pb-6">
				<VehicleManagementClient />
			</div>
		</div>
	);
}
