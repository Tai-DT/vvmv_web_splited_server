/**
 * Customer username/password login: Better Auth first, then vendor-portal fallback.
 * Extracted for unit tests — keep behavior aligned with `app/login/page.tsx`.
 */

export type UsernameSignInResult = {
	data?: { user?: unknown; token?: string } | null;
	error?: unknown;
};

export type CustomerLoginDeps = {
	signInUsername: (input: {
		username: string;
		password: string;
	}) => Promise<UsernameSignInResult>;
	/** Override for tests (defaults to global `fetch`). */
	fetchImpl?: typeof fetch;
};

export type CustomerLoginOutcome =
	| { ok: true; redirectTo: "/settings" }
	| { ok: true; redirectTo: "/vendor-portal" }
	| { ok: false };

function isBetterAuthUsernameSuccess(result: UsernameSignInResult): boolean {
	if (result.error) {
		return false;
	}
	const data = result.data as
		| { user?: unknown; token?: string }
		| null
		| undefined;
	if (data == null) {
		return false;
	}
	const hasUser = data.user != null;
	const hasToken = Boolean(data.token);
	return hasUser || hasToken;
}

export async function performCustomerLogin(
	username: string,
	password: string,
	deps: CustomerLoginDeps,
): Promise<CustomerLoginOutcome> {
	const fetchImpl = deps.fetchImpl ?? fetch;

	const result = await deps.signInUsername({ username, password });
	if (isBetterAuthUsernameSuccess(result)) {
		return { ok: true, redirectTo: "/settings" };
	}

	const vendorRes = await fetchImpl("/api/external/vendor-portal/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username, password }),
	});

	if (!vendorRes.ok) {
		return { ok: false };
	}

	try {
		const body = (await vendorRes.json()) as { success?: boolean };
		if (body.success === true) {
			return { ok: true, redirectTo: "/vendor-portal" };
		}
	} catch {
		// Non-JSON or malformed — treat as failure
	}

	return { ok: false };
}
