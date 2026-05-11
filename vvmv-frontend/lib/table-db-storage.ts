import type { StateStorage } from "zustand/middleware";
import { apiFetch } from "@/lib/api/client";

function debounce<T extends (...args: never[]) => void>(
	fn: T,
	delay: number,
): T {
	let timer: ReturnType<typeof setTimeout> | null = null;
	return ((...args: Parameters<T>) => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => fn(...args), delay);
	}) as T;
}

/**
 * Creates a Zustand StateStorage adapter backed by the /api/table-preferences endpoint.
 * Each call returns an isolated instance with its own debounce timer.
 *
 * The `tableKey` is stored as a unique identifier per user in the DB.
 * Zustand persist wraps state as {"state":{...},"version":0} — we match that envelope.
 */
export function createTableDbStorage(tableKey: string): StateStorage {
	const debouncedWrite = debounce(async (value: string) => {
		try {
			const parsed = JSON.parse(value);
			await apiFetch("/api/table-preferences", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					tableKey,
					preferences: parsed.state ?? parsed,
				}),
			});
		} catch (error) {
			console.error(
				`[TableDbStorage] Failed to write preferences for "${tableKey}":`,
				error,
			);
		}
	}, 500);

	return {
		getItem: async (_name: string): Promise<string | null> => {
			if (typeof window === "undefined") return null;
			try {
				const res = await apiFetch(
					`/api/table-preferences?tableKey=${encodeURIComponent(tableKey)}`,
				);

				if (res.status === 401) {
					// Not signed in — no server prefs; use defaults without treating as an error.
					return null;
				}

				if (!res.ok) {
					// If the request failed (500, etc.), we throw so Zustand doesn't
					// assume the storage is empty and overwrite it with defaults later.
					throw new Error(
						`Failed to fetch table preferences: ${res.status} ${res.statusText}`,
					);
				}

				const data = await res.json();
				if (data.preferences === null) return null;
				return JSON.stringify({ state: data.preferences, version: 0 });
			} catch (error) {
				console.error(
					`[TableDbStorage] Error loading preferences for "${tableKey}":`,
					error,
				);
				throw error;
			}
		},

		setItem: (_name: string, value: string): void => {
			if (typeof window === "undefined") return;
			debouncedWrite(value);
		},

		removeItem: () => {},
	};
}
