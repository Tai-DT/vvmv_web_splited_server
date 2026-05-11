"use client";

import { Anchor, Package, TrendingUp, Weight } from "lucide-react";
import type { ReactNode } from "react";
import { useTruckReportStatsStore } from "./use-truck-report-stats-store";

interface StatCardConfig {
	type: string;
	label: string;
	icon: React.ElementType;
	value: string | number;
	color: {
		activeBg: string;
		inactiveBg: string;
		activeBorder: string;
		inactiveBorder: string;
		activeIcon: string;
		inactiveIcon: string;
	};
	badge?: ReactNode;
}

export const TruckStatsCards = () => {
	const statsStore = useTruckReportStatsStore();

	const stats: StatCardConfig[] = [
		{
			type: "total",
			label: "Tổng Lô hàng",
			icon: Package,
			value: statsStore.totalRecords.toLocaleString("vi-VN"),
			color: {
				activeBg: "bg-blue-50 dark:bg-blue-900/20",
				inactiveBg: "bg-white dark:bg-gray-900/40",
				activeBorder: "border-blue-200 dark:border-blue-800",
				inactiveBorder: "border-slate-200 dark:border-slate-800",
				activeIcon: "bg-blue-500 text-white ring-blue-500/20",
				inactiveIcon:
					"bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",
			},
		},
		{
			type: "jobs",
			label: "Số Job",
			icon: TrendingUp,
			value: statsStore.totalJobs.toLocaleString("vi-VN"),
			color: {
				activeBg: "bg-purple-50 dark:bg-purple-900/20",
				inactiveBg: "bg-white dark:bg-gray-900/40",
				activeBorder: "border-purple-200 dark:border-purple-800",
				inactiveBorder: "border-slate-200 dark:border-slate-800",
				activeIcon: "bg-purple-500 text-white ring-purple-500/20",
				inactiveIcon:
					"bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400",
			},
		},
		{
			type: "cbm",
			label: "Tổng CBM",
			icon: Anchor,
			value: statsStore.totalCbm.toLocaleString("vi-VN"),
			color: {
				activeBg: "bg-emerald-50 dark:bg-emerald-900/20",
				inactiveBg: "bg-white dark:bg-gray-900/40",
				activeBorder: "border-emerald-200 dark:border-emerald-800",
				inactiveBorder: "border-slate-200 dark:border-slate-800",
				activeIcon: "bg-emerald-500 text-white ring-emerald-500/20",
				inactiveIcon:
					"bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
			},
		},
		{
			type: "grossWeight",
			label: "Tổng G.W (kg)",
			icon: Weight,
			value: statsStore.totalGw.toLocaleString("vi-VN"),
			color: {
				activeBg: "bg-amber-50 dark:bg-amber-900/20",
				inactiveBg: "bg-white dark:bg-gray-900/40",
				activeBorder: "border-amber-200 dark:border-amber-800",
				inactiveBorder: "border-slate-200 dark:border-slate-800",
				activeIcon: "bg-amber-500 text-white ring-amber-500/20",
				inactiveIcon:
					"bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
			},
		},
	];

	return (
		<div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 w-full">
			{stats.map(({ type, label, icon: Icon, value, color }) => {
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
