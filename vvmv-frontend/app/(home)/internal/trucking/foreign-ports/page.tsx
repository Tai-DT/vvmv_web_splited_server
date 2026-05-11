import { ForeignPortManagementClient } from "./_components/foreign-port-management-client";

export const metadata = {
	title: "Quản lý Cảng Nước Ngoài | Trucking | VVMV",
	description:
		"Quản lý danh sách cảng đích và cảng chuyển tải nước ngoài cho Trucking Follow Up.",
};

export default function ForeignPortManagementPage() {
	return (
		<div className="flex flex-col h-full gap-4 overflow-hidden">
			<div className="flex flex-col gap-1 shrink-0 px-6 pt-6">
				<h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white uppercase italic">
					Quản lý Cảng Nước Ngoài
				</h1>
				<p className="text-sm text-slate-500 font-bold uppercase tracking-widest opacity-60">
					Cập nhật danh sách cảng đích và cảng chuyển tải quốc tế.
				</p>
			</div>
			<div className="flex-1 min-h-0 overflow-auto px-6 pb-6">
				<ForeignPortManagementClient />
			</div>
		</div>
	);
}
