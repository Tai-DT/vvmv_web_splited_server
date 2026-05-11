import type { NextConfig } from "next";
import {
	NEST_REGISTERED_API_PATHS,
	type RegisteredApiPath,
} from "./lib/backend-registry";

/**
 * `BACKEND_URL` (or legacy `API_URL`) points at the standalone NestJS
 * (`vvmv-backend`). When set, every path in `NEST_REGISTERED_API_PATHS` is
 * proxied to Nest by Next's built-in rewrite engine *before* the local
 * route handlers under `app/api` are consulted, so Nest authoritatively
 * owns those endpoints. Unregistered paths still fall through to the
 * local Next handler (or to Better Auth for `/api/auth/[...all]`).
 *
 * Paths under `NEVER_PROXY_TO_NEST_PREFIXES` are never proxied (defense in
 * depth: stale `.next` after registry edits, or a mistaken re-add to the list).
 * After changing rewrites, restart dev and remove `.next` if behavior looks cached.
 *
 * Set neither variable to fully short-circuit delegation (useful in solo dev
 * against a Postgres on the same machine).
 */

const NEVER_PROXY_TO_NEST_PREFIXES: readonly string[] = [
	"/api/auth",
	"/api/external/vendor-portal",
];

function shouldProxyToNest({ source }: RegisteredApiPath): boolean {
	return !NEVER_PROXY_TO_NEST_PREFIXES.some((prefix) =>
		source.startsWith(prefix),
	);
}
function backendBase(): string | null {
	const raw = process.env.BACKEND_URL?.trim() || process.env.API_URL?.trim();
	if (!raw) return null;
	return raw.replace(/\/$/, "");
}

const nextConfig: NextConfig = {
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "lh3.googleusercontent.com",
				pathname: "/**",
			},
			{
				protocol: "https",
				hostname: "**.googleusercontent.com",
				pathname: "/**",
			},
		],
	},
	async rewrites() {
		const base = backendBase();
		if (process.env.NODE_ENV === "development") {
			if (base) {
				console.log(
					`[next.config] BACKEND_URL=${base} — registered /api/* routes proxy to Nest`,
				);
			} else {
				console.warn(
					"[next.config] BACKEND_URL unset — Nest rewrites disabled (set in .env.local)",
				);
			}
		}
		if (!base) return [];

		// Strip `/api` from the source — Nest mounts the same segments without
		// an `/api` prefix (see vvmv-backend/README.md). Parameter syntax such
		// as `:id` and `:all*` is preserved by Next's rewrite engine.
		const beforeFiles = NEST_REGISTERED_API_PATHS.filter(shouldProxyToNest).map(
			({ source }) => ({
				source,
				destination: `${base}${source.replace(/^\/api/, "")}`,
			}),
		);

		return { beforeFiles };
	},
};

export default nextConfig;
