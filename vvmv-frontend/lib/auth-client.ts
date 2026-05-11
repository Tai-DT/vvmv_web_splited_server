import { adminClient, usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { ac, adminRole, customerRole, staffRole } from "./auth-permissions";

/**
 * Base URL for Better Auth client (`/api/auth/*`).
 *
 * In normal setups use **`undefined`** so requests are same-origin (`/api/auth/...`).
 * If we passed `NEXT_PUBLIC_APP_URL` (e.g. `http://localhost:3000`) while the user
 * opens the site at `http://127.0.0.1:3000`, the browser treats that as cross-origin
 * and auth endpoints return **401** for sign-in/session (`username`, `login` in DevTools).
 *
 * Only set `NEXT_PUBLIC_BETTER_AUTH_URL` when auth really lives on another origin.
 */
function resolveClientAuthBaseUrl(): string | undefined {
	return process.env.NEXT_PUBLIC_BETTER_AUTH_URL?.trim() || undefined;
}

export const authClient = createAuthClient({
	baseURL: resolveClientAuthBaseUrl(),
	plugins: [
		usernameClient(),
		adminClient({
			ac,
			roles: {
				CUSTOMER: customerRole,
				STAFF: staffRole,
				ADMIN: adminRole,
			},
		}),
	],
});

export const { signOut, useSession, signIn, signUp } = authClient;

// Export permission checking methods
export const { admin } = authClient;
