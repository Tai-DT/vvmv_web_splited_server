import { create } from "zustand";

interface StatsState {
	active: number;
	activeNoTrucking: number;
	activeWithTrucking: number;
	finished: number;
	done: number;
	updateStats: (
		active: number,
		activeNoTrucking: number,
		activeWithTrucking: number,
		finished: number,
		done: number,
	) => void;
}

export const useStatsStore = create<StatsState>((set) => ({
	active: 0,
	activeNoTrucking: 0,
	activeWithTrucking: 0,
	finished: 0,
	done: 0,
	updateStats: (active, activeNoTrucking, activeWithTrucking, finished, done) =>
		set({ active, activeNoTrucking, activeWithTrucking, finished, done }),
}));
