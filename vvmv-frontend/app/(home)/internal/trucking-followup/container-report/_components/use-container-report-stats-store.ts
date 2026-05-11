import { create } from "zustand";

type ContainerReportStatsStore = {
	totalContainers: number;
	totalJobs: number;
	totalCompanies: number;

	updateStats: (
		totalContainers: number,
		totalJobs: number,
		totalCompanies: number,
	) => void;
};

export const useContainerReportStatsStore = create<ContainerReportStatsStore>(
	(set) => ({
		totalContainers: 0,
		totalJobs: 0,
		totalCompanies: 0,

		updateStats: (totalContainers, totalJobs, totalCompanies) =>
			set({
				totalContainers,
				totalJobs,
				totalCompanies,
			}),
	}),
);
