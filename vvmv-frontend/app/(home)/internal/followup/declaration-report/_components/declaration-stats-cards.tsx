"use client";

import { Building2, DollarSign, FileText, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { useDeclarationReportStatsStore } from "./use-declaration-report-stats-store";

function fmtCurrency(val: number | null | undefined): string {
	if (val === null || val === undefined) return "—";
	return val.toLocaleString("vi-VN", { style: "currency", currency: "VND" });
}

interface StatCardConfig {
	type: string;
	label: string;
	icon: React.ElementType;
	value: string | number;
	color: {
		activeText: string;
		inactiveText: string;
		activeIcon: string;
		inactiveIcon: string;
		activeBg: string;
		inactiveBg: string;
		activeBorder: string;
		inactiveBorder: string;
		activeRing: string;
	};
	badge?: ReactNode;
}

export const DeclarationStatsCards = () => {
	const statsStore = useDeclarationReportStatsStore();

	const stats: StatCardConfig[] = [
		{
			type: "total",
			label: "Tổng tờ khai",
			icon: FileText,
			value: statsStore.totalDeclarations.toLocaleString("vi-VN"),
			color: {
				activeText: "text-blue-700 dark:text-blue-300",
				inactiveText: "text-slate-600 dark:text-slate-400",
				activeIcon: "bg-blue-500 text-white ring-blue-500/20",
				inactiveIcon:
					"bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",
				activeBg: "bg-blue-50 dark:bg-blue-900/20",
				inactiveBg: "bg-white dark:bg-gray-900/40",
				activeBorder: "border-blue-200 dark:border-blue-800",
				inactiveBorder: "border-slate-200 dark:border-slate-800",
				activeRing: "ring-2 ring-blue-500/20",
			},
		},
		{
			type: "jobs",
			label: "Job liên quan",
			icon: TrendingUp,
			value: statsStore.uniqueJobs.toLocaleString("vi-VN"),
			color: {
				activeText: "text-purple-700 dark:text-purple-300",
				inactiveText: "text-slate-600 dark:text-slate-400",
				activeIcon: "bg-purple-500 text-white ring-purple-500/20",
				inactiveIcon:
					"bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400",
				activeBg: "bg-purple-50 dark:bg-purple-900/20",
				inactiveBg: "bg-white dark:bg-gray-900/40",
				activeBorder: "border-purple-200 dark:border-purple-800",
				inactiveBorder: "border-slate-200 dark:border-slate-800",
				activeRing: "ring-2 ring-purple-500/20",
			},
		},
		{
			type: "companies",
			label: "Khách hàng",
			icon: Building2,
			value: statsStore.uniqueCompanies.toLocaleString("vi-VN"),
			color: {
				activeText: "text-emerald-700 dark:text-emerald-300",
				inactiveText: "text-slate-600 dark:text-slate-400",
				activeIcon: "bg-emerald-500 text-white ring-emerald-500/20",
				inactiveIcon:
					"bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
				activeBg: "bg-emerald-50 dark:bg-emerald-900/20",
				inactiveBg: "bg-white dark:bg-gray-900/40",
				activeBorder: "border-emerald-200 dark:border-emerald-800",
				inactiveBorder: "border-slate-200 dark:border-slate-800",
				activeRing: "ring-2 ring-emerald-500/20",
			},
		},
		{
			type: "tax",
			label: "Tiền thuế",
			icon: DollarSign,
			value: fmtCurrency(statsStore.totalTax),
			color: {
				activeText: "text-orange-700 dark:text-orange-300",
				inactiveText: "text-slate-600 dark:text-slate-400",
				activeIcon: "bg-orange-500 text-white ring-orange-500/20",
				inactiveIcon:
					"bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400",
				activeBg: "bg-orange-50 dark:bg-orange-900/20",
				inactiveBg: "bg-white dark:bg-gray-900/40",
				activeBorder: "border-orange-200 dark:border-orange-800",
				inactiveBorder: "border-slate-200 dark:border-slate-800",
				activeRing: "ring-2 ring-orange-500/20",
			},
		},
	];

	return (
		<div className="grid grid-cols-4 gap-2 sm:gap-3 w-full">
			{stats.map(({ type, label, icon: Icon, value, color, badge }) => {
				return (
					<div
						key={type}
						className={`relative overflow-hidden p-2 sm:p-2.5 rounded-lg sm:rounded-xl border shadow-sm flex sm:items-center gap-1 sm:gap-2 group transition-all duration-300 flex-col sm:flex-row items-start ${color.inactiveBg} ${color.inactiveBorder}`}
						title={label}
					>
						<div
							className={`p-1 rounded sm:rounded-lg transition-all duration-300 ring-1 relative flex-shrink-0 ${color.inactiveIcon}`}
						>
							<Icon className="size-3 sm:size-5" />
							{badge}
						</div>
						<div className="overflow-hidden">
							<p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight hidden sm:block truncate">
								{label}
							</p>
							<h3 className="text-sm sm:text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight truncate">
								{value}
							</h3>
						</div>
					</div>
				);
			})}
		</div>
	);
};
