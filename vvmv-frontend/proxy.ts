import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Default Better Auth session cookie (see `advanced.cookiePrefix` if customized). */
const BETTER_AUTH_SESSION = "better-auth.session_token";

function isPublicPath(pathname: string): boolean {
	if (pathname === "/") return true;
	if (
		pathname === "/about" ||
		pathname === "/contact" ||
		pathname === "/services" ||
		pathname === "/vendor-portal" ||
		pathname === "/access-denied" ||
		pathname === "/gemini-test"
	) {
		return true;
	}
	if (pathname.startsWith("/external")) return true;
	if (pathname.startsWith("/login")) return true;
	if (pathname.startsWith("/api/auth")) return true;
	if (pathname.startsWith("/_next")) return true;
	if (pathname.startsWith("/ingest")) return true;
	return false;
}

/** Next.js 16+: replaces deprecated root `middleware.ts` (Turbopack resolves `proxy`). */
export function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;

	if (isPublicPath(pathname)) {
		return NextResponse.next();
	}

	if (pathname.startsWith("/api/")) {
		return NextResponse.next();
	}

	if (pathname.includes(".") && !pathname.startsWith("/api/")) {
		return NextResponse.next();
	}

	const hasSession = request.cookies.has(BETTER_AUTH_SESSION);

	if (!hasSession) {
		const loginUrl = new URL("/login", request.url);
		loginUrl.searchParams.set(
			"callbackUrl",
			`${pathname}${request.nextUrl.search}`,
		);
		return NextResponse.redirect(loginUrl);
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:ico|png|jpg|jpeg|svg|gif|webp|woff2?)$).*)",
	],
};
