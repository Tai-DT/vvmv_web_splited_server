import { create } from "zustand";

interface TruckReportStatsState {
	totalRecords: number;
	totalJobs: number;
	totalCbm: number;
	totalGw: number;
	updateStats: (
		totalRecords: number,
		totalJobs: number,
		totalCbm: number,
		totalGw: number,
	) => void;
}

export const useTruckReportStatsStore = create<TruckReportStatsState>(
	(set) => ({
		totalRecords: 0,
		totalJobs: 0,
		totalCbm: 0,
		totalGw: 0,
		updateStats: (totalRecords, totalJobs, totalCbm, totalGw) =>
			set({ totalRecords, totalJobs, totalCbm, totalGw }),
	}),
);
