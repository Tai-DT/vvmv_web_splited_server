import { auth } from "./auth";

type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;

const loggedOptionalSessionScopes = new Set<string>();

export function isAuthGetSessionPath(pathname: string): boolean {
	return pathname === "/api/auth/get-session";
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}

export function logOptionalSessionFailure(scope: string, error: unknown): void {
	if (loggedOptionalSessionScopes.has(scope)) {
		return;
	}

	loggedOptionalSessionScopes.add(scope);

	console.error(
		`[auth] Optional session lookup failed in ${scope}: ${getErrorMessage(error)}`,
	);
}

/**
 * Uncaught errors from the Better Auth Next handler (e.g. DB down, Prisma
 * errors). Logged on every failure — use the dev JSON body from the route
 * for the first-line hint in the Network tab.
 */
export function logAuthHandlerFailure(method: string, error: unknown): void {
	const message = getErrorMessage(error);
	console.error(`[auth] ${method} /api/auth handler failed: ${message}`);
	if (
		process.env.NODE_ENV === "development" &&
		error instanceof Error &&
		error.stack
	) {
		console.error(error.stack);
	}
}

export async function getOptionalAuthSession(
	headers: Headers,
	scope: string,
): Promise<AuthSession | null> {
	try {
		return await auth.api.getSession({ headers });
	} catch (error) {
		logOptionalSessionFailure(scope, error);
		return null;
	}
}
