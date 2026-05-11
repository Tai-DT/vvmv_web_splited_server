import { createHash } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import {
	getClientIp,
	getQueryParams,
	logApiCall,
	truncateResponseBody,
} from "@/lib/api-call-logger";
import { prismaRPA } from "@/lib/db";

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

const API_ENDPOINT = "/api/external/container-declarations";

/**
 * GET /api/external/container-declarations?job_number=HCMLOGT260301004
 *
 * Returns container numbers mapped to declaration numbers for a given trucking job.
 * Searches both trucking and linked logistics follow-ups.
 * Uses container_declaration junction table if data exists, falls back to cross join.
 *
 * Query params:
 * - job_number (required): The trucking job number
 *
 * Returns:
 * - data: Array of { containerNo, declarationNumber } pairs
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
			logApiCall({
				endpoint: API_ENDPOINT,
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
				endpoint: API_ENDPOINT,
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
		if (
			!validation.apiKey?.permissions.includes("get-container-declarations")
		) {
			const responseBody = {
				success: false,
				message:
					"API key does not have permission for get-container-declarations",
			};
			logApiCall({
				endpoint: API_ENDPOINT,
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
				errorMessage: "Permission denied: get-container-declarations",
			});
			return NextResponse.json(responseBody, { status: 403 });
		}

		// 4. Get job_number from query params
		const { searchParams } = new URL(request.url);
		const jobNumber = searchParams.get("job_number");

		if (!jobNumber) {
			const responseBody = {
				success: false,
				message: "Missing required query parameter: job_number",
			};
			logApiCall({
				endpoint: API_ENDPOINT,
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
				errorMessage: "Missing job_number",
			});
			return NextResponse.json(responseBody, { status: 400 });
		}

		// 5. Find trucking job
		const truckingJob = await prismaRPA.truckingFollowUp.findFirst({
			where: { jobNumber, isDeleted: false },
			select: { id: true, jobNumber: true, requestNumber: true },
		});

		if (!truckingJob) {
			const responseBody = {
				success: false,
				message: `Trucking job not found: ${jobNumber}`,
			};
			logApiCall({
				endpoint: API_ENDPOINT,
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
				errorMessage: `Job not found: ${jobNumber}`,
			});
			return NextResponse.json(responseBody, { status: 404 });
		}

		// 6. Find linked logistics follow-ups
		const orConditions: any[] = [{ jobNumber }];
		if (truckingJob.requestNumber) {
			orConditions.push({
				requestTruckingNo: truckingJob.requestNumber,
			});
		}

		const logisticsJobs = await prismaRPA.followUp.findMany({
			where: { OR: orConditions, isDeleted: false },
			select: { id: true },
		});

		const logisticIds = logisticsJobs.map((j) => j.id);

		// 7. Build source conditions (trucking + logistics)
		const sourceConditions: any[] = [{ truckingFollowUpId: truckingJob.id }];
		if (logisticIds.length > 0) {
			sourceConditions.push({ followUpId: { in: logisticIds } });
		}

		// 8. Get containers with declaration links
		const containers = await prismaRPA.container.findMany({
			where: {
				OR: sourceConditions,
				containerNo: { not: null },
				noEport: false,
			},
			select: {
				containerNo: true,
				declarationLinks: {
					select: {
						declaration: {
							select: { declarationNumber: true },
						},
					},
				},
			},
		});

		// 9. Get all declarations for cross-join fallback
		const allDeclarations = await prismaRPA.declaration.findMany({
			where: {
				OR: sourceConditions,
				declarationNumber: { not: null },
			},
			select: { declarationNumber: true },
		});

		// 10. Per-container logic:
		//   - Container CÓ junction links → dùng junction links
		//   - Container KHÔNG CÓ junction links → cross join với tất cả declarations
		const results: { containerNo: string; declarationNumber: string }[] = [];

		for (const c of containers) {
			if (c.declarationLinks.length > 0) {
				// Has junction data → use specific links
				for (const link of c.declarationLinks) {
					if (link.declaration.declarationNumber) {
						results.push({
							containerNo: c.containerNo!,
							declarationNumber: link.declaration.declarationNumber,
						});
					}
				}
			} else {
				// No junction data → cross join with all declarations
				for (const d of allDeclarations) {
					results.push({
						containerNo: c.containerNo!,
						declarationNumber: d.declarationNumber!,
					});
				}
			}
		}

		const responseBody = {
			success: true,
			count: results.length,
		};

		// Log: success
		logApiCall({
			endpoint: API_ENDPOINT,
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
				jobNumber: truckingJob.jobNumber,
				requestNumber: truckingJob.requestNumber,
				data: results,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error("External Container-Declarations API error:", error);

		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";

		const responseBody = {
			success: false,
			message: "Failed to fetch container-declaration data",
			error: errorMessage,
		};

		logApiCall({
			endpoint: API_ENDPOINT,
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
