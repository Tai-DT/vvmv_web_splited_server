"use client";

import {
	Activity,
	Bell,
	CheckCircle2,
	ListTodo,
	PackageCheck,
	TruckIcon,
} from "lucide-react";
import type { ReactNode } from "react";

interface StatsCardsProps {
	active: number;
	pending: number;
	loaded: number;
	finished: number;
	done: number;
	pendingApproval: number;
	/** Determines label/color of the approval box: true = Accounting (chi hộ), false = Trucking (cước) */
	isAccountingUser?: boolean;
	currentFilter:
		| "all"
		| "active"
		| "pending"
		| "loaded"
		| "finished"
		| "done"
		| "pending-approval"
		| "pending-trucking-approval"
		| "pending-disbursement-approval";
	onFilterChange: (
		filter:
			| "all"
			| "active"
			| "pending"
			| "loaded"
			| "finished"
			| "done"
			| "pending-approval"
			| "pending-trucking-approval"
			| "pending-disbursement-approval",
	) => void;
}

interface StatCardConfig {
	type:
		| "all"
		| "active"
		| "pending"
		| "loaded"
		| "finished"
		| "done"
		| "pending-approval"
		| "pending-trucking-approval"
		| "pending-disbursement-approval";
	label: string;
	icon: React.ElementType;
	value: number;
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

export const StatsCards = ({
	active,
	pending,
	loaded,
	finished,
	done,
	pendingApproval,
	isAccountingUser = false,
	currentFilter,
	onFilterChange,
}: StatsCardsProps) => {
	const total = active + finished + done;

	const stats: StatCardConfig[] = [
		{
			type: "all",
			label: "Total",
			icon: ListTodo,
			value: total,
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
			type: "pending",
			label: "Pending",
			icon: Activity,
			value: pending,
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
			badge: (
				<span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full ring-1 ring-white dark:ring-gray-900 animate-pulse" />
			),
		},
		{
			type: "loaded",
			label: "Loaded",
			icon: TruckIcon,
			value: loaded,
			color: {
				activeText: "text-sky-700 dark:text-sky-300",
				inactiveText: "text-slate-600 dark:text-slate-400",
				activeIcon: "bg-sky-500 text-white ring-sky-500/20",
				inactiveIcon:
					"bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400",
				activeBg: "bg-sky-50 dark:bg-sky-900/20",
				inactiveBg: "bg-white dark:bg-gray-900/40",
				activeBorder: "border-sky-200 dark:border-sky-800",
				inactiveBorder: "border-slate-200 dark:border-slate-800",
				activeRing: "ring-2 ring-sky-500/20",
			},
		},
		{
			type: "finished",
			label: "Finished",
			icon: CheckCircle2,
			value: finished,
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
			type: "done",
			label: "Done",
			icon: PackageCheck,
			value: done,
			color: {
				activeText: "text-indigo-700 dark:text-indigo-300",
				inactiveText: "text-slate-600 dark:text-slate-400",
				activeIcon: "bg-indigo-500 text-white ring-indigo-500/20",
				inactiveIcon:
					"bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
				activeBg: "bg-indigo-50 dark:bg-indigo-900/20",
				inactiveBg: "bg-white dark:bg-gray-900/40",
				activeBorder: "border-indigo-200 dark:border-indigo-800",
				inactiveBorder: "border-slate-200 dark:border-slate-800",
				activeRing: "ring-2 ring-indigo-500/20",
			},
		},
		{
			type: isAccountingUser
				? "pending-disbursement-approval"
				: "pending-trucking-approval",
			// Trucking = cước vận chuyển approve; Accounting = chi hộ approve
			label: isAccountingUser ? "Chi hộ" : "Cần duyệt",
			icon: Bell,
			value: pendingApproval,
			color: {
				activeText: "text-violet-700 dark:text-violet-300",
				inactiveText: "text-slate-600 dark:text-slate-400",
				activeIcon: "bg-violet-500 text-white ring-violet-500/20",
				inactiveIcon:
					"bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400",
				activeBg: "bg-violet-50 dark:bg-violet-900/20",
				inactiveBg: "bg-white dark:bg-gray-900/40",
				activeBorder: "border-violet-200 dark:border-violet-800",
				inactiveBorder: "border-slate-200 dark:border-slate-800",
				activeRing: "ring-2 ring-violet-500/20",
			},
			badge:
				pendingApproval > 0 ? (
					<span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-violet-500 rounded-full ring-1 ring-white dark:ring-gray-900 animate-pulse" />
				) : undefined,
		},
	];

	return (
		<div className="grid grid-cols-6 gap-2 sm:gap-3 w-full">
			{stats.map(({ type, label, icon: Icon, value, color, badge }) => {
				const isActive = currentFilter === type;

				return (
					<div
						key={type}
						onClick={() => onFilterChange(type)}
						className={`relative overflow-hidden p-2 sm:p-2.5 rounded-lg sm:rounded-xl border shadow-sm flex sm:items-center gap-1 sm:gap-2 group cursor-pointer transition-all duration-300 flex-col sm:flex-row items-start ${
							isActive
								? `${color.activeBg} ${color.activeBorder} ${color.activeRing} shadow-md scale-[1.02]`
								: `${color.inactiveBg} ${color.inactiveBorder} hover:shadow-md hover:scale-[1.01]`
						}`}
					>
						<div
							className={`p-1 rounded sm:rounded-lg transition-all duration-300 ring-1 relative flex-shrink-0 ${
								isActive
									? color.activeIcon
									: `${color.inactiveIcon} group-hover:scale-110`
							}`}
						>
							<Icon className="size-3 sm:size-5" />
							{badge}
						</div>
						<div>
							<p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight hidden sm:block">
								{label}
							</p>
							<h3 className="text-sm sm:text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight">
								{value}
							</h3>
						</div>
					</div>
				);
			})}
		</div>
	);
};
