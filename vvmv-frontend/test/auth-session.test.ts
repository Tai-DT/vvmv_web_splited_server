import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
	auth: {
		api: {
			getSession: vi.fn(),
		},
	},
}));

import { auth } from "@/lib/auth";
import {
	getOptionalAuthSession,
	isAuthGetSessionPath,
} from "@/lib/auth-session";

describe("auth-session", () => {
	const getSessionMock = auth.api.getSession as unknown as ReturnType<
		typeof vi.fn
	>;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("matches the Better Auth get-session endpoint", () => {
		expect(isAuthGetSessionPath("/api/auth/get-session")).toBe(true);
		expect(isAuthGetSessionPath("/api/auth/sign-out")).toBe(false);
	});

	it("returns the resolved session when lookup succeeds", async () => {
		const session = {
			session: { id: "session-1" },
			user: { id: "user-1", email: "user@example.com" },
		};

		getSessionMock.mockResolvedValue(session);

		await expect(
			getOptionalAuthSession(new Headers(), "test:success"),
		).resolves.toEqual(session);
	});

	it("returns null when optional session lookup fails", async () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		getSessionMock.mockRejectedValue(new Error("Failed to get session"));

		await expect(
			getOptionalAuthSession(new Headers(), "test:failure"),
		).resolves.toBeNull();

		expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
	});
});
