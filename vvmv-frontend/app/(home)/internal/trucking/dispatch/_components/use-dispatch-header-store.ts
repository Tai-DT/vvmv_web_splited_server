"use client";

import { create } from "zustand";

interface DispatchHeaderStats {
	totalFcrs: number;
	unscheduledCount: number;
	totalTrucks: number;
}

interface DispatchHeaderState {
	stats: DispatchHeaderStats | null;
	setStats: (stats: DispatchHeaderStats) => void;
	clearStats: () => void;
}

export const useDispatchHeaderStore = create<DispatchHeaderState>((set) => ({
	stats: null,
	setStats: (stats) => set({ stats }),
	clearStats: () => set({ stats: null }),
}));
