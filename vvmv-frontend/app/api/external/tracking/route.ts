import { createHash } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import {
	getClientIp,
	getQueryParams,
	logApiCall,
	truncateResponseBody,
} from "@/lib/api-call-logger";
import { prismaRPA } from "@/lib/db";
import { Prisma } from "@/prisma/client";

/**
 * Hash API key for comparison
 */
function hashApiKey(key: string): string {
	return createHash("sha256").update(key).digest("hex");
}

/**
 * Validate API Key and return associated user info
 */
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

	// Update lastUsedAt
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

/**
 * GET /api/external/tracking
 * Get all tracking data grouped by delivery_number, with only the latest created_at row for each
 *
 * Query params:
 * - delivery_number: Optional filter by specific delivery number
 *
 * Returns:
 * - data: Array of tracking records, grouped by delivery_number with the latest created_at for each
 */
export async function GET(request: NextRequest) {
	const startTime = Date.now();
	const clientIp = getClientIp(request);
	const userAgent = request.headers.get("user-agent");
	const queryParams = getQueryParams(request);

	try {
		// 1. Get API key from header
		const apiKey = request.headers.get("X-API-Key");

		if (!apiKey) {
			const responseBody = {
				success: false,
				message: "Missing X-API-Key header",
			};
			// Log: missing API key
			logApiCall({
				endpoint: "/api/external/tracking",
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
			// Log: invalid API key
			logApiCall({
				endpoint: "/api/external/tracking",
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
			// Log: permission denied
			logApiCall({
				endpoint: "/api/external/tracking",
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

		// 4. Get query parameters
		const { searchParams } = new URL(request.url);
		const deliveryNumberFilter = searchParams.get("delivery_number");

		// 5. Build the WHERE clause conditionally
		const whereClause = deliveryNumberFilter
			? Prisma.sql`AND t.delivery_number = ${deliveryNumberFilter}`
			: Prisma.empty;

		// 6. Get all tracking data with optional filter
		// Use raw SQL to get only the latest time row for each delivery_number
		const trackingData = await prismaRPA.$queryRaw<
			Array<{
				delivery_number: string | null;
				image: string | null;
				time: Date | null;
				location: string | null;
				file: string | null;
				user_mail: string | null;
				user_name: string | null;
				user_tel: string | null;
				note: string | null;
				status: string | null;
				description: string | null;
				customer_name: string | null;
				from: string | null;
				to: string | null;
				date_send: Date | null;
				total_box: number | null;
				weight: number | null;
				address: string | null;
			}>
		>(Prisma.sql`
      WITH RankedTracking AS (
        SELECT 
          t.*,
          ROW_NUMBER() OVER (
            PARTITION BY t.delivery_number 
            ORDER BY t.time DESC NULLS LAST
          ) as rn
        FROM tracking t
        WHERE t.delivery_number IS NOT NULL
          ${whereClause}
      )
      SELECT 
        delivery_number,
        image,
        time,
        location,
        file,
        user_mail,
        user_name,
        user_tel,
        note,
        status,
        description,
        customer_name,
        "from",
        "to",
        date_send,
        total_box,
        weight,
        address
      FROM RankedTracking
      WHERE rn = 1
      ORDER BY time DESC NULLS LAST
    `);

		// 7. Format response data
		const formattedData = trackingData.map((record) => ({
			deliveryNumber: record.delivery_number,
			image: record.image,
			time: record.time,
			location: record.location,
			file: record.file,
			userMail: record.user_mail,
			userName: record.user_name,
			userTel: record.user_tel,
			note: record.note,
			status: record.status,
			description: record.description,
			customerName: record.customer_name,
			from: record.from,
			to: record.to,
			dateSend: record.date_send,
			totalBox: record.total_box,
			weight: record.weight,
			address: record.address,
		}));

		const responseBody = {
			success: true,
			count: formattedData.length,
		};

		// Log: success
		logApiCall({
			endpoint: "/api/external/tracking",
			method: "GET",
			statusCode: 200,
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
		});

		return NextResponse.json(
			{
				...responseBody,
				data: formattedData,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error("External Tracking API error:", error);

		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";

		const responseBody = {
			success: false,
			message: "Failed to fetch tracking data",
			error: errorMessage,
		};

		// Log: error
		logApiCall({
			endpoint: "/api/external/tracking",
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
