import type { NextRequest } from "next/server";
import { prismaRPA } from "@/lib/db";
import type { Prisma } from "@/prisma/client";

interface ApiCallLogData {
	endpoint: string;
	method: string;
	statusCode: number;
	responseTimeMs: number;
	apiKeyId?: string | null;
	apiKeyName?: string | null;
	userId?: string | null;
	userName?: string | null;
	site?: string | null;
	requestBody?: Record<string, unknown> | null;
	requestParams?: Record<string, string> | null;
	responseBody?: Record<string, unknown> | null;
	ipAddress?: string | null;
	userAgent?: string | null;
	errorMessage?: string | null;
}

/**
 * Log an external API call to the database.
 * This runs asynchronously and does not block the response.
 */
export async function logApiCall(data: ApiCallLogData): Promise<void> {
	try {
		await prismaRPA.apiCallLog.create({
			data: {
				endpoint: data.endpoint,
				method: data.method,
				statusCode: data.statusCode,
				responseTimeMs: data.responseTimeMs,
				apiKeyId: data.apiKeyId ?? null,
				apiKeyName: data.apiKeyName ?? null,
				userId: data.userId ?? null,
				userName: data.userName ?? null,
				site: data.site ?? null,
				requestBody: (data.requestBody as Prisma.JsonObject) ?? undefined,
				requestParams: (data.requestParams as Prisma.JsonObject) ?? undefined,
				responseBody: (data.responseBody as Prisma.JsonObject) ?? undefined,
				ipAddress: data.ipAddress ?? null,
				userAgent: data.userAgent ?? null,
				errorMessage: data.errorMessage ?? null,
			},
		});
	} catch (error) {
		// Don't let logging failures affect the API response
		console.error("Failed to log API call:", error);
	}
}

/**
 * Extract client IP address from the request
 */
export function getClientIp(request: NextRequest): string | null {
	return (
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
		request.headers.get("x-real-ip") ||
		request.headers.get("cf-connecting-ip") ||
		null
	);
}

/**
 * Extract query params as a plain object
 */
export function getQueryParams(
	request: NextRequest,
): Record<string, string> | null {
	const { searchParams } = new URL(request.url);
	const params: Record<string, string> = {};
	searchParams.forEach((value, key) => {
		params[key] = value;
	});
	return Object.keys(params).length > 0 ? params : null;
}

/**
 * Truncate response body to avoid storing huge payloads.
 * Only keeps success status and count, not the full data array.
 */
export function truncateResponseBody(
	body: Record<string, unknown>,
): Record<string, unknown> {
	const truncated: Record<string, unknown> = {};

	if ("success" in body) truncated.success = body.success;
	if ("message" in body) truncated.message = body.message;
	if ("count" in body) truncated.count = body.count;
	if ("error" in body) truncated.error = body.error;
	if ("transID" in body) truncated.transID = body.transID;
	if ("hwbno" in body) truncated.hwbno = body.hwbno;

	return truncated;
}
