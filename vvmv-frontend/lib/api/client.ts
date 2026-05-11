/**
 * HTTP client for browser (and server) calls to this app's REST API.
 * When `NEXT_PUBLIC_API_URL` is set, requests go to that origin (split deploy).
 * When unset, paths stay relative (same-origin to this Next app).
 * Server-side `BACKEND_URL` rewrites in `next.config.ts` do not change this:
 * the browser still calls `origin + /api/...`; Next then proxies to Nest.
 */

function trimTrailingSlash(url: string): string {
	return url.replace(/\/+$/, "");
}

/** Public origin for `/api/*` (no trailing slash). Empty = same-origin. */
export function getPublicApiBaseUrl(): string {
	const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
	if (!raw) {
		return "";
	}
	return trimTrailingSlash(raw);
}

/** Resolve `/api/...` to full URL when split deploy is configured. */
export function apiUrl(path: string): string {
	if (!path.startsWith("/")) {
		throw new Error(`apiUrl: path must start with /, got: ${path}`);
	}
	const base = getPublicApiBaseUrl();
	return base ? `${base}${path}` : path;
}

/**
 * Like `fetch`, but when `input` is a string path starting with `/api`,
 * prefixes `NEXT_PUBLIC_API_URL` for split deployments.
 * Uses `credentials: "include"` by default so session cookies work cross-origin.
 */
export function apiFetch(
	input: string | URL | Request,
	init?: RequestInit,
): Promise<Response> {
	let resolved: string | URL | Request = input;

	if (typeof input === "string" && input.startsWith("/api")) {
		resolved = apiUrl(input);
	}

	const nextInit: RequestInit = {
		credentials: init?.credentials ?? "include",
		...init,
	};

	return fetch(resolved, nextInit);
}

/**
 * Reads `message`, `error`, or `details` from a JSON error response.
 * Use when `response.ok` is false (after clone if the body may be read again).
 */
export async function getFetchErrorMessage(
	response: Response,
	fallback: string,
): Promise<string> {
	try {
		const data = (await response.clone().json()) as Record<string, unknown>;
		const msg =
			(typeof data.message === "string" && data.message.trim()) ||
			(typeof data.error === "string" && data.error.trim()) ||
			(typeof data.details === "string" && data.details.trim());
		return msg || fallback;
	} catch {
		return fallback;
	}
}
