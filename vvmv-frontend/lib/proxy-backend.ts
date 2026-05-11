import { type NextRequest, NextResponse } from "next/server";

/**
 * Header set by the Nest catch-all fallback to signal "I do not implement this
 * route — let the Next handler take it." See `vvmv-backend/src/app.controller.ts`.
 */
const NOT_IMPLEMENTED_HEADER = "x-backend-not-implemented";

/**
 * Hop-by-hop and content-coding response headers we must drop when forwarding
 * the upstream Nest response back through Next, otherwise the browser may try
 * to decode an already-decoded body (and Next may set its own length).
 */
const STRIPPED_RESPONSE_HEADERS = new Set([
	"content-encoding",
	"content-length",
	"transfer-encoding",
	"connection",
	"keep-alive",
]);

/** When `BACKEND_URL` (or legacy `API_URL`) points at **vvmv-backend** (NestJS), forward so cookies/session stay aligned during migration. */
export function backendBaseUrl(): string | undefined {
	const raw = process.env.BACKEND_URL?.trim() || process.env.API_URL?.trim();
	return raw?.replace(/\/$/, "");
}

/**
 * Delegate the incoming Next request to the standalone Nest API.
 *
 * - When `apiPath` is omitted, the path after `/api/` from the incoming URL is
 *   used (so the caller doesn't have to repeat the path string).
 * - The request body is read from a `clone()` so the original request stream
 *   stays consumable by the Next handler when we fall through.
 * - Returns `null` (so Next runs the local handler) when:
 *     • `BACKEND_URL` / `API_URL` is not configured;
 *     • the upstream is unreachable (connection error);
 *     • Nest responded 404 with the `x-backend-not-implemented` marker.
 */
export async function tryDelegateToStandaloneApi(
	request: NextRequest,
	apiPath?: string,
): Promise<NextResponse | null> {
	const base = backendBaseUrl();
	if (!base) return null;

	const incoming = new URL(request.url);
	const derived = apiPath ?? incoming.pathname.replace(/^\/api\/?/, "");
	const normalized = derived.replace(/^\/+/, "");
	if (!normalized) return null;

	const target = new URL(`${base}/${normalized}`);
	incoming.searchParams.forEach((value, key) => {
		target.searchParams.set(key, value);
	});

	const method = request.method;
	const headers = new Headers();
	const cookie = request.headers.get("cookie");
	if (cookie) headers.set("cookie", cookie);
	const ct = request.headers.get("content-type");
	if (ct && method !== "GET" && method !== "HEAD") {
		headers.set("content-type", ct);
	}
	const auth = request.headers.get("authorization");
	if (auth) headers.set("authorization", auth);
	const xff =
		request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip");
	if (xff) headers.set("x-forwarded-for", xff);

	const init: RequestInit = {
		method,
		headers,
		cache: "no-store",
	};

	if (method !== "GET" && method !== "HEAD") {
		// Use clone() so the original request body remains readable for the Next
		// handler when we decide to fall through (e.g. 404 marker from Nest).
		init.body = await request.clone().arrayBuffer();
	}

	let upstream: Response;
	try {
		upstream = await fetch(target.toString(), init);
	} catch {
		return null;
	}

	if (
		upstream.status === 404 &&
		upstream.headers.get(NOT_IMPLEMENTED_HEADER) === "1"
	) {
		return null;
	}

	const body = await upstream.arrayBuffer();
	const responseHeaders = new Headers();
	upstream.headers.forEach((value, key) => {
		if (STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) return;
		responseHeaders.append(key, value);
	});
	if (!responseHeaders.has("content-type")) {
		responseHeaders.set("content-type", "application/json");
	}

	return new NextResponse(body, {
		status: upstream.status,
		headers: responseHeaders,
	});
}
