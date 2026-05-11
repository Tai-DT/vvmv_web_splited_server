import { describe, expect, it, vi } from "vitest";

import { performCustomerLogin } from "@/lib/login-customer";

describe("performCustomerLogin", () => {
	it("returns /settings when Better Auth username sign-in succeeds", async () => {
		const signInUsername = vi.fn().mockResolvedValue({
			data: { user: { id: "u1" }, token: "sess" },
			error: null,
		});

		await expect(
			performCustomerLogin("alice", "secret", { signInUsername }),
		).resolves.toEqual({ ok: true, redirectTo: "/settings" });

		expect(signInUsername).toHaveBeenCalledWith({
			username: "alice",
			password: "secret",
		});
	});

	it("falls back to vendor portal when Better Auth fails but vendor login succeeds", async () => {
		const signInUsername = vi
			.fn()
			.mockResolvedValue({ error: { message: "Invalid" } });

		const fetchImpl = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ success: true }),
		});

		await expect(
			performCustomerLogin("vendor1", "pw", {
				signInUsername,
				fetchImpl: fetchImpl as unknown as typeof fetch,
			}),
		).resolves.toEqual({ ok: true, redirectTo: "/vendor-portal" });

		expect(fetchImpl).toHaveBeenCalledWith(
			"/api/external/vendor-portal/login",
			expect.objectContaining({
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username: "vendor1", password: "pw" }),
			}),
		);
	});

	it("returns ok:false when both Better Auth and vendor login fail", async () => {
		const signInUsername = vi
			.fn()
			.mockResolvedValue({ error: { message: "Invalid" } });

		const fetchImpl = vi.fn().mockResolvedValue({
			ok: false,
			status: 401,
		});

		await expect(
			performCustomerLogin("x", "y", {
				signInUsername,
				fetchImpl: fetchImpl as unknown as typeof fetch,
			}),
		).resolves.toEqual({ ok: false });
	});

	it("does not treat empty Better Auth result as success", async () => {
		const signInUsername = vi.fn().mockResolvedValue({});
		const fetchImpl = vi.fn().mockResolvedValue({
			ok: false,
			status: 401,
		});

		await expect(
			performCustomerLogin("alice", "secret", {
				signInUsername,
				fetchImpl: fetchImpl as unknown as typeof fetch,
			}),
		).resolves.toEqual({ ok: false });

		expect(signInUsername).toHaveBeenCalled();
	});
});
