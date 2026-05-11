import { create } from "zustand";

interface TruckingStatsState {
	active: number;
	pending: number;
	loaded: number;
	finished: number;
	done: number;
	pendingTruckingApproval: number;
	pendingDisbursementApproval: number;
	isAccountingUser: boolean;
	updateStats: (
		active: number,
		pending: number,
		loaded: number,
		finished: number,
		done: number,
		pendingTruckingApproval?: number,
		pendingDisbursementApproval?: number,
	) => void;
	setIsAccountingUser: (value: boolean) => void;
}

export const useTruckingStatsStore = create<TruckingStatsState>((set) => ({
	active: 0,
	pending: 0,
	loaded: 0,
	finished: 0,
	done: 0,
	pendingTruckingApproval: 0,
	pendingDisbursementApproval: 0,
	isAccountingUser: false,
	updateStats: (
		active,
		pending,
		loaded,
		finished,
		done,
		pendingTruckingApproval = 0,
		pendingDisbursementApproval = 0,
	) =>
		set({
			active,
			pending,
			loaded,
			finished,
			done,
			pendingTruckingApproval,
			pendingDisbursementApproval,
		}),
	setIsAccountingUser: (value) => set({ isAccountingUser: value }),
}));
