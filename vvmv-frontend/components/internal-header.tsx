"use client";

import { BarChart3, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import {
	StatsCards,
	type StatusFilterType,
} from "@/app/(home)/internal/followup/_components/table/stats-cards";
import { useStatsStore } from "@/app/(home)/internal/followup/_components/table/use-stats-store";
import { createTableStore } from "@/app/(home)/internal/followup/_components/table/use-table-state";
import { DeclarationStatsCards } from "@/app/(home)/internal/followup/declaration-report/_components/declaration-stats-cards";
import { DispatchHeaderControls } from "@/app/(home)/internal/trucking/dispatch/_components/dispatch-header-controls";
import { useDispatchHeaderStore } from "@/app/(home)/internal/trucking/dispatch/_components/use-dispatch-header-store";
import { DispatchHeaderControls as VehicleSchedulingHeaderControls } from "@/app/(home)/internal/trucking/vehicle-scheduling/_components/dispatch-header-controls";
import { useDispatchHeaderStore as useVehicleSchedulingHeaderStore } from "@/app/(home)/internal/trucking/vehicle-scheduling/_components/use-dispatch-header-store";
import { StatsCards as TruckingStatsCards } from "@/app/(home)/internal/trucking-followup/_components/table/stats-cards";
import { useTruckingStatsStore } from "@/app/(home)/internal/trucking-followup/_components/table/use-stats-store";
import { createTruckingTableStore } from "@/app/(home)/internal/trucking-followup/_components/table/use-table-state";
import { ContainerStatsCards } from "@/app/(home)/internal/trucking-followup/container-report/_components/container-stats-cards";
import { TruckStatsCards as TruckReportStatsCards } from "@/app/(home)/internal/trucking-followup/truck-report/_components/truck-stats-cards";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { useSession } from "@/lib/auth-client";
import { navigationItems } from "@/lib/constants/menu";

export function InternalHeader() {
	const pathname = usePathname();
	const { toggleSidebar } = useSidebar();
	const { data: session } = useSession();
	const userId = session?.user?.id ?? "anonymous";

	// Always call the hook unconditionally (Rules of Hooks)
	const useTableStore = createTableStore(userId);
	const statsStore = useStatsStore();
	const statusFilter = useTableStore((state) => state.statusFilter);
	const setStatusFilter = useTableStore((state) => state.setStatusFilter) as (
		filter: StatusFilterType,
	) => void;

	const useTruckingTableStore = createTruckingTableStore(userId);
	const truckingStatsStore = useTruckingStatsStore();
	const truckingStatusFilter = useTruckingTableStore(
		(state) => state.statusFilter,
	);
	const setTruckingStatusFilter = useTruckingTableStore(
		(state) => state.setStatusFilter,
	);

	// Determine if Accounting user for the approval box label & count
	// isAccountingUser is set by data-table.tsx into the store
	const isAccountingForHeader = truckingStatsStore.isAccountingUser;
	const pendingApprovalForHeader = isAccountingForHeader
		? truckingStatsStore.pendingDisbursementApproval
		: truckingStatsStore.pendingTruckingApproval;

	const currentItem = navigationItems.find((item) => {
		if (item.link) {
			return pathname === item.link || pathname.startsWith(`${item.link}/`);
		}
		return false;
	});

	const pageTitle = currentItem?.title || "Dashboard";
	const isDeclarationReportPage = pathname.startsWith(
		"/internal/followup/declaration-report",
	);
	const isContainerReportPage = pathname.startsWith(
		"/internal/trucking-followup/container-report",
	);
	const isTruckReportPage = pathname.startsWith(
		"/internal/trucking-followup/truck-report",
	);
	const isFollowupPage =
		pathname.startsWith("/internal/followup") &&
		!pathname.startsWith("/internal/trucking-followup") &&
		!isDeclarationReportPage;
	const isTruckingPage =
		pathname.startsWith("/internal/trucking-followup") &&
		!isContainerReportPage &&
		!isTruckReportPage;
	const isDispatchPage = pathname.startsWith("/internal/trucking/dispatch");
	const isVehicleSchedulingPage = pathname.startsWith(
		"/internal/trucking/vehicle-scheduling",
	);

	const dispatchStats = useDispatchHeaderStore((state) => state.stats);
	const vehicleSchedulingStats = useVehicleSchedulingHeaderStore(
		(state) => state.stats,
	);

	const showDispatchSpecificHeader = isDispatchPage || isVehicleSchedulingPage;
	const currentStats = isVehicleSchedulingPage
		? vehicleSchedulingStats
		: dispatchStats;

	return (
		<header className="p-3 sm:p-4 sticky top-0 z-30 border-b border-gray-200/50 dark:border-gray-800/50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
			{/* Desktop header */}
			<div className="flex min-h-0 flex-row flex-wrap items-start gap-2 md:gap-3 lg:flex-nowrap">
				<div className="flex min-w-0 shrink-0 items-center gap-1 px-2 md:gap-3 md:px-4">
					<Button
						variant="ghost"
						size="icon"
						onClick={toggleSidebar}
						className="md:hidden h-9 w-9 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
						title="Toggle sidebar"
					>
						<Menu className="h-5 w-5" />
					</Button>
					{showDispatchSpecificHeader ? (
						<div className="hidden md:flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
							<BarChart3 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
							<span>
								Tổng FCR: <strong>{currentStats?.totalFcrs ?? "--"}</strong>
							</span>
							<span>
								Chưa lên lịch:{" "}
								<strong
									className={
										(currentStats?.unscheduledCount ?? 0) > 0
											? "text-amber-600"
											: "text-emerald-600"
									}
								>
									{currentStats?.unscheduledCount ?? "--"}
								</strong>
							</span>
							<span>
								Xe: <strong>{currentStats?.totalTrucks ?? "--"}</strong>
							</span>
						</div>
					) : (
						<div className="flex flex-col">
							<h1 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white tracking-tight">
								{pageTitle}
							</h1>
							<div className="flex items-center gap-2">
								<div className="h-1 w-6 md:w-8 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.5)]" />
								<span className="text-[8px] md:text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] sm:whitespace-nowrap">
									VVMV Portal
								</span>
							</div>
						</div>
					)}
				</div>

				{/* Stats cards - only show on followup page */}
				{isFollowupPage && (
					<div className="min-h-0 min-w-0 flex-1 basis-[min(100%,20rem)]">
						<StatsCards
							active={statsStore.active}
							activeNoTrucking={statsStore.activeNoTrucking}
							activeWithTrucking={statsStore.activeWithTrucking}
							finished={statsStore.finished}
							done={statsStore.done}
							currentFilter={statusFilter}
							onFilterChange={setStatusFilter}
						/>
					</div>
				)}

				{isDeclarationReportPage && <DeclarationStatsCards />}

				{isContainerReportPage && <ContainerStatsCards />}

				{isTruckReportPage && <TruckReportStatsCards />}

				{isTruckingPage && (
					<div className="min-h-0 min-w-0 flex-1 basis-[min(100%,20rem)]">
						<TruckingStatsCards
							active={truckingStatsStore.active}
							pending={truckingStatsStore.pending}
							loaded={truckingStatsStore.loaded}
							finished={truckingStatsStore.finished}
							done={truckingStatsStore.done}
							pendingApproval={pendingApprovalForHeader}
							isAccountingUser={isAccountingForHeader}
							currentFilter={truckingStatusFilter}
							onFilterChange={setTruckingStatusFilter}
						/>
					</div>
				)}

				{isDispatchPage && <DispatchHeaderControls />}
				{isVehicleSchedulingPage && <VehicleSchedulingHeaderControls />}
			</div>
		</header>
	);
}
