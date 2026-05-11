import { create } from "zustand";

interface DeclarationReportStatsState {
	totalDeclarations: number;
	uniqueJobs: number;
	uniqueCompanies: number;
	totalTax: number;
	updateStats: (
		totalDeclarations: number,
		uniqueJobs: number,
		uniqueCompanies: number,
		totalTax: number,
	) => void;
}

export const useDeclarationReportStatsStore =
	create<DeclarationReportStatsState>((set) => ({
		totalDeclarations: 0,
		uniqueJobs: 0,
		uniqueCompanies: 0,
		totalTax: 0,
		updateStats: (totalDeclarations, uniqueJobs, uniqueCompanies, totalTax) =>
			set({ totalDeclarations, uniqueJobs, uniqueCompanies, totalTax }),
	}));
