import { TrackingManagementClient } from "./_components/tracking-management-client";

export const metadata = {
	title: "Quản lý Tracking | VVMV",
	description: "Hệ thống cập nhật thông tin hành trình vận đơn",
};

export default function TrackingManagementPage() {
	return (
		<div className="flex flex-col h-full gap-4 overflow-auto">
			<div className="flex flex-col gap-1 shrink-0">
				<h1 className="text-2xl font-bold tracking-tight text-slate-900">
					Quản lý Tracking
				</h1>
				<p className="text-sm text-slate-500">
					Cập nhật trạng thái và lộ trình cho các mã vận đơn.
				</p>
			</div>

			<div className="flex-1 min-h-0 overflow-auto">
				<TrackingManagementClient />
			</div>
		</div>
	);
}
