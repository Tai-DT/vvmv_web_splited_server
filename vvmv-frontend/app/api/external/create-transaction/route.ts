import { createHash } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import {
	getClientIp,
	logApiCall,
	truncateResponseBody,
} from "@/lib/api-call-logger";
import { prismaRPA } from "@/lib/db";
import { createErpTransaction } from "@/lib/erp/transaction-service";

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
					erpAccount: true,
					username: true,
					email: true,
					site: true,
					name: true,
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
 * POST /api/external/create-transaction
 * Creates a transaction in the ERP system via external API key authentication
 */
export async function POST(request: NextRequest) {
	const startTime = Date.now();
	const clientIp = getClientIp(request);
	const userAgent = request.headers.get("user-agent");
	let requestBody: Record<string, unknown> | null = null;

	try {
		// 1. Get API key from header
		const apiKey = request.headers.get("X-API-Key");

		if (!apiKey) {
			const responseBody = {
				success: false,
				message: "Missing X-API-Key header",
			};
			logApiCall({
				endpoint: "/api/external/create-transaction",
				method: "POST",
				statusCode: 401,
				responseTimeMs: Date.now() - startTime,
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
				endpoint: "/api/external/create-transaction",
				method: "POST",
				statusCode: 401,
				responseTimeMs: Date.now() - startTime,
				responseBody,
				ipAddress: clientIp,
				userAgent,
				errorMessage: validation.error,
			});
			return NextResponse.json(responseBody, { status: 401 });
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const validatedApiKey = (validation as any).apiKey;
		const user = (validation as any).user;
		const apiKeySite = (validation as any).site;

		if (!user) {
			const responseBody = {
				success: false,
				message: "API key user not found",
			};
			logApiCall({
				endpoint: "/api/external/create-transaction",
				method: "POST",
				statusCode: 404,
				responseTimeMs: Date.now() - startTime,
				apiKeyId: validatedApiKey?.id,
				apiKeyName: validatedApiKey?.name,
				responseBody,
				ipAddress: clientIp,
				userAgent,
				errorMessage: "API key user not found",
			});
			return NextResponse.json(responseBody, { status: 404 });
		}

		// 3. Check permission
		if (!validatedApiKey?.permissions.includes("create-transaction")) {
			const responseBody = {
				success: false,
				message: "API key does not have permission for create-transaction",
			};
			logApiCall({
				endpoint: "/api/external/create-transaction",
				method: "POST",
				statusCode: 403,
				responseTimeMs: Date.now() - startTime,
				apiKeyId: validatedApiKey?.id,
				apiKeyName: validatedApiKey?.name,
				userId: user.id,
				userName: user.name,
				site: apiKeySite,
				responseBody,
				ipAddress: clientIp,
				userAgent,
				errorMessage: "Permission denied: create-transaction",
			});
			return NextResponse.json(responseBody, { status: 403 });
		}

		// 4. Parse request body
		const body = await request.json();
		requestBody = body;
		const {
			operationType,
			taxCode,
			hwbno,
			erpAccount: overrideErpAccount,
			site: overrideSite,
		} = body;

		// 5. Validate required fields
		if (!operationType || !taxCode) {
			const responseBody = {
				success: false,
				message: "Missing required fields: operationType, taxCode",
			};
			logApiCall({
				endpoint: "/api/external/create-transaction",
				method: "POST",
				statusCode: 400,
				responseTimeMs: Date.now() - startTime,
				apiKeyId: validatedApiKey?.id,
				apiKeyName: validatedApiKey?.name,
				userId: user.id,
				userName: user.name,
				site: apiKeySite,
				requestBody,
				responseBody,
				ipAddress: clientIp,
				userAgent,
				errorMessage: "Missing required fields: operationType, taxCode",
			});
			return NextResponse.json(responseBody, { status: 400 });
		}

		// Validate operationType
		if (!["NHAP", "XUAT"].includes(operationType)) {
			const responseBody = {
				success: false,
				message: "operationType must be 'NHAP' or 'XUAT'",
			};
			logApiCall({
				endpoint: "/api/external/create-transaction",
				method: "POST",
				statusCode: 400,
				responseTimeMs: Date.now() - startTime,
				apiKeyId: validatedApiKey?.id,
				apiKeyName: validatedApiKey?.name,
				userId: user.id,
				userName: user.name,
				site: apiKeySite,
				requestBody,
				responseBody,
				ipAddress: clientIp,
				userAgent,
				errorMessage: "operationType must be 'NHAP' or 'XUAT'",
			});
			return NextResponse.json(responseBody, { status: 400 });
		}

		// 6. Use erpAccount if available (override or from user)
		const userAccount = overrideErpAccount || user.erpAccount || user.username;

		if (!userAccount) {
			const responseBody = {
				success: false,
				message:
					"User does not have an ERP account configured, and no erpAccount was provided in the request",
			};
			logApiCall({
				endpoint: "/api/external/create-transaction",
				method: "POST",
				statusCode: 400,
				responseTimeMs: Date.now() - startTime,
				apiKeyId: validatedApiKey?.id,
				apiKeyName: validatedApiKey?.name,
				userId: user.id,
				userName: user.name,
				site: apiKeySite,
				requestBody,
				responseBody,
				ipAddress: clientIp,
				userAgent,
				errorMessage: "No ERP account configured",
			});
			return NextResponse.json(responseBody, { status: 400 });
		}

		// 7. Create transaction using shared service
		const result = await createErpTransaction({
			operationType,
			taxCode,
			hwbno,
			site: overrideSite || apiKeySite || "SGN",
			erpAccount: userAccount,
		});

		// 8. Return result
		const responseBody = {
			success: true,
			transID: result.NEW_FILE_NO,
			hwbno: result.HWBNO,
			customerCode: result.CUSTOMER_CODE,
			customerName: result.CUSTOMER_NAME,
			site: result.erpSite,
			serviceType: result.serviceType,
		};

		// Log: success
		logApiCall({
			endpoint: "/api/external/create-transaction",
			method: "POST",
			statusCode: 201,
			responseTimeMs: Date.now() - startTime,
			apiKeyId: validatedApiKey?.id,
			apiKeyName: validatedApiKey?.name,
			userId: user.id,
			userName: user.name,
			site: apiKeySite,
			requestBody,
			responseBody: truncateResponseBody(responseBody),
			ipAddress: clientIp,
			userAgent,
		});

		return NextResponse.json(responseBody, { status: 201 });
	} catch (error) {
		console.error("External Transaction creation error:", error);

		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";

		const responseBody = {
			success: false,
			message: errorMessage,
			error: errorMessage,
		};

		// Log: error
		logApiCall({
			endpoint: "/api/external/create-transaction",
			method: "POST",
			statusCode: 500,
			responseTimeMs: Date.now() - startTime,
			requestBody,
			responseBody: truncateResponseBody(responseBody),
			ipAddress: clientIp,
			userAgent,
			errorMessage,
		});

		return NextResponse.json(responseBody, { status: 500 });
	}
}
