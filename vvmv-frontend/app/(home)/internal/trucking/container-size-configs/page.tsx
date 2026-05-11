import type { Metadata } from "next";
import { ContainerSizeConfigManagementClient } from "./_components/container-size-config-management-client";

export const metadata: Metadata = {
	title: "Cấu Hình Kích Thước Container | Trucking",
	description:
		"Cấu hình ánh xạ Container Size (ERP) sang ISO 6346 type, kích cỡ và cảng/sân bay",
};

export default function ContainerSizeConfigPage() {
	return (
		<div className="flex flex-col h-full gap-4 overflow-hidden">
			<div className="flex flex-col gap-1 shrink-0 px-6 pt-6">
				<h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white uppercase italic">
					Cấu Hình Kích Thước Container
				</h1>
				<p className="text-sm text-slate-500 font-bold uppercase tracking-widest opacity-60">
					Gán ISO 6346 Type, Kích Cỡ và Cảng/Sân Bay cho từng loại Container
					Size ERP.
				</p>
			</div>

			<div className="flex-1 min-h-0 overflow-auto px-6 pb-6">
				<ContainerSizeConfigManagementClient />
			</div>
		</div>
	);
}
