import type { StateStorage } from "zustand/middleware";
import { createTableDbStorage } from "@/lib/table-db-storage";

function createNoopStorage(): StateStorage {
	return {
		getItem: () => null,
		setItem: () => {},
		removeItem: () => {},
	};
}

/**
 * When true, use localStorage for table state instead of `/api/table-preferences`
 * (no session — avoids 401s and console noise; same as legacy `guest` user).
 */
export function isLocalOnlyTableUserId(userId: string): boolean {
	return userId === "" || userId === "anonymous" || userId === "guest";
}

/** Zustand {@link StateStorage} for persisted table UI (DB when logged in, else local). */
export function createTableUserPersistStorage(
	userId: string,
	dbKey: string,
): StateStorage {
	if (typeof document === "undefined") {
		return createNoopStorage();
	}
	if (isLocalOnlyTableUserId(userId)) {
		return localStorage;
	}
	return createTableDbStorage(dbKey);
}
