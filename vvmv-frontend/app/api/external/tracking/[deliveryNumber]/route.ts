import { createHash } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import {
	getClientIp,
	getQueryParams,
	logApiCall,
	truncateResponseBody,
} from "@/lib/api-call-logger";
import { prismaRPA } from "@/lib/db";

function hashApiKey(key: string): string {
	return createHash("sha256").update(key).digest("hex");
}

async function validateApiKey(apiKey: string) {
	const hashedKey = hashApiKey(apiKey);
	const apiKeyRecord = await prismaRPA.apiKey.findUnique({
		where: { key: hashedKey },
		include: {
			user: {
				select: {
					id: true,
					name: true,
					email: true,
					site: true,
				},
			},
		},
	});
	if (!apiKeyRecord) {
		return { valid: false, error: "Invalid API key" };
	}
	if (!apiKeyRecord.isActive) {
		return { valid: false, error: "API key has been revoked" };
	}
	if (apiKeyRecord.expiresAt && new Date() > apiKeyRecord.expiresAt) {
		return { valid: false, error: "API key has expired" };
	}
	await prismaRPA.apiKey.update({
		where: { id: apiKeyRecord.id },
		data: { lastUsedAt: new Date() },
	});
	return {
		valid: true,
		apiKey: apiKeyRecord,
		user: apiKeyRecord.user,
		site: apiKeyRecord.site,
	};
}

// GET /api/external/tracking/[deliveryNumber]
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ deliveryNumber: string }> },
) {
	const startTime = Date.now();
	const clientIp = getClientIp(request);
	const userAgent = request.headers.get("user-agent");
	const queryParams = getQueryParams(request);
	const { deliveryNumber } = await params;

	try {
		// 1. Get API key from header
		const apiKey = request.headers.get("X-API-Key");
		if (!apiKey) {
			const responseBody = {
				success: false,
				message: "Missing X-API-Key header",
			};
			logApiCall({
				endpoint: `/api/external/tracking/${deliveryNumber}`,
				method: "GET",
				statusCode: 401,
				responseTimeMs: Date.now() - startTime,
				requestParams: queryParams,
				responseBody,
				ipAddress: clientIp,
				userAgent,
				errorMessage: "Missing X-API-Key header",
			});
			return NextResponse.json(responseBody, { status: 401 });
		}

		// 2. Validate API key
		const validation = await validateApiKey(apiKey);
		if (!validation.valid) {
			const responseBody = { success: false, message: validation.error };
			logApiCall({
				endpoint: `/api/external/tracking/${deliveryNumber}`,
				method: "GET",
				statusCode: 401,
				responseTimeMs: Date.now() - startTime,
				requestParams: queryParams,
				responseBody,
				ipAddress: clientIp,
				userAgent,
				errorMessage: validation.error,
			});
			return NextResponse.json(responseBody, { status: 401 });
		}

		// 3. Check permission
		if (!validation.apiKey?.permissions.includes("get-tracking")) {
			const responseBody = {
				success: false,
				message: "API key does not have permission for get-tracking",
			};
			logApiCall({
				endpoint: `/api/external/tracking/${deliveryNumber}`,
				method: "GET",
				statusCode: 403,
				responseTimeMs: Date.now() - startTime,
				apiKeyId: validation.apiKey?.id,
				apiKeyName: validation.apiKey?.name,
				userId: validation.user?.id,
				userName: validation.user?.name,
				site: validation.site,
				requestParams: queryParams,
				responseBody,
				ipAddress: clientIp,
				userAgent,
				errorMessage: "Permission denied: get-tracking",
			});
			return NextResponse.json(responseBody, { status: 403 });
		}

		// 4. Validate deliveryNumber
		if (!deliveryNumber) {
			const responseBody = {
				success: false,
				message: "Missing deliveryNumber",
			};
			logApiCall({
				endpoint: `/api/external/tracking/${deliveryNumber}`,
				method: "GET",
				statusCode: 400,
				responseTimeMs: Date.now() - startTime,
				apiKeyId: validation.apiKey?.id,
				apiKeyName: validation.apiKey?.name,
				userId: validation.user?.id,
				userName: validation.user?.name,
				site: validation.site,
				requestParams: queryParams,
				responseBody,
				ipAddress: clientIp,
				userAgent,
				errorMessage: "Missing deliveryNumber",
			});
			return NextResponse.json(responseBody, { status: 400 });
		}

		// 5. Query tracking by deliveryNumber (latest record)
		const tracking = await prismaRPA.tracking.findFirst({
			where: { deliveryNumber },
			orderBy: { time: "desc" },
		});

		if (!tracking) {
			const responseBody = { success: false, message: "Not found" };
			logApiCall({
				endpoint: `/api/external/tracking/${deliveryNumber}`,
				method: "GET",
				statusCode: 404,
				responseTimeMs: Date.now() - startTime,
				apiKeyId: validation.apiKey?.id,
				apiKeyName: validation.apiKey?.name,
				userId: validation.user?.id,
				userName: validation.user?.name,
				site: validation.site,
				requestParams: queryParams,
				responseBody,
				ipAddress: clientIp,
				userAgent,
				errorMessage: "Not found",
			});
			return NextResponse.json(responseBody, { status: 404 });
		}

		// 6. Success response
		const responseBody = { success: true, data: tracking };
		logApiCall({
			endpoint: `/api/external/tracking/${deliveryNumber}`,
			method: "GET",
			statusCode: 200,
			responseTimeMs: Date.now() - startTime,
			apiKeyId: validation.apiKey?.id,
			apiKeyName: validation.apiKey?.name,
			userId: validation.user?.id,
			userName: validation.user?.name,
			site: validation.site,
			requestParams: queryParams,
			responseBody: truncateResponseBody(responseBody),
			ipAddress: clientIp,
			userAgent,
		});
		return NextResponse.json(responseBody, { status: 200 });
	} catch (error) {
		console.error("Fetch tracking by deliveryNumber error:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		const responseBody = {
			success: false,
			message: "Internal Server Error",
			error: errorMessage,
		};
		logApiCall({
			endpoint: `/api/external/tracking/${deliveryNumber}`,
			method: "GET",
			statusCode: 500,
			responseTimeMs: Date.now() - startTime,
			requestParams: queryParams,
			responseBody: truncateResponseBody(responseBody),
			ipAddress: clientIp,
			userAgent,
			errorMessage,
		});
		return NextResponse.json(responseBody, { status: 500 });
	}
}
