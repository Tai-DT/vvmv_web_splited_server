"use client";

import { create } from "zustand";

type DispatchViewMode = "day" | "week";

interface DispatchToolbarState {
	viewMode: DispatchViewMode;
	focusDate: string;
	showFilters: boolean;
	setViewMode: (mode: DispatchViewMode) => void;
	setFocusDate: (date: string) => void;
	setShowFilters: (show: boolean) => void;
}

function getTodayStr() {
	return new Date().toISOString().slice(0, 10);
}

export const useDispatchToolbarStore = create<DispatchToolbarState>((set) => ({
	viewMode: "day",
	focusDate: getTodayStr(),
	showFilters: true,
	setViewMode: (mode) => set({ viewMode: mode }),
	setFocusDate: (date) => set({ focusDate: date }),
	setShowFilters: (show) => set({ showFilters: show }),
}));
