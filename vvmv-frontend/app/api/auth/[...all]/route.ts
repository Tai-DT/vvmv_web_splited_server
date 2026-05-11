import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import {
	isAuthGetSessionPath,
	logAuthHandlerFailure,
	logOptionalSessionFailure,
} from "@/lib/auth-session";

const authRouteHandler = toNextJsHandler(auth);

export async function GET(request: Request) {
	try {
		return await authRouteHandler.GET(request);
	} catch (error) {
		const pathname = new URL(request.url).pathname;

		if (isAuthGetSessionPath(pathname)) {
			logOptionalSessionFailure(pathname, error);
			return Response.json(null, { status: 200 });
		}

		logAuthHandlerFailure("GET", error);
		throw error;
	}
}

export async function POST(request: Request) {
	try {
		return await authRouteHandler.POST(request);
	} catch (error) {
		logAuthHandlerFailure("POST", error);
		const message =
			error instanceof Error ? error.message : getSafeAuthErrorString(error);

		if (process.env.NODE_ENV === "development") {
			return Response.json(
				{
					code: "AUTH_HANDLER_ERROR",
					message,
					hint: "Often: DATABASE_URL unreachable, schema drift vs Prisma, or trustedOrigin/baseURL mismatch. Confirm BETTER_AUTH_SECRET is set in prod.",
				},
				{ status: 500 },
			);
		}

		return Response.json(
			{ code: "AUTH_HANDLER_ERROR", message: "Internal Server Error" },
			{ status: 500 },
		);
	}
}

function getSafeAuthErrorString(error: unknown): string {
	try {
		return JSON.stringify(error);
	} catch {
		return String(error);
	}
}
