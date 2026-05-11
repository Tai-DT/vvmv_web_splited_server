import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { prismaRPA } from "@/lib/db";

const VENDOR_PORTAL_COOKIE = "vendor_portal_token";
const TOKEN_EXPIRY_SECONDS = 60 * 60 * 12; // 12 hours

type VendorTokenPayload = {
	accountId: string;
	vendorId: string;
	vendorName: string;
	site: string;
	exp: number;
};

function getSecret(): string {
	return (
		process.env.VENDOR_PORTAL_SECRET ||
		process.env.BETTER_AUTH_SECRET ||
		"dev-vendor-portal-secret"
	);
}

function base64UrlEncode(value: string): string {
	return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string): string {
	return Buffer.from(value, "base64url").toString("utf-8");
}

function signPayload(payload: string): string {
	return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createVendorToken(
	payload: Omit<VendorTokenPayload, "exp">,
): string {
	const fullPayload: VendorTokenPayload = {
		...payload,
		exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECONDS,
	};

	const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
	const signature = signPayload(encodedPayload);
	return `${encodedPayload}.${signature}`;
}

export function verifyVendorToken(token: string): VendorTokenPayload | null {
	const [encodedPayload, signature] = token.split(".");
	if (!encodedPayload || !signature) return null;

	const expectedSignature = signPayload(encodedPayload);
	const sigA = Buffer.from(signature);
	const sigB = Buffer.from(expectedSignature);

	if (sigA.length !== sigB.length || !timingSafeEqual(sigA, sigB)) {
		return null;
	}

	try {
		const payload = JSON.parse(
			base64UrlDecode(encodedPayload),
		) as VendorTokenPayload;
		if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
			return null;
		}
		return payload;
	} catch {
		return null;
	}
}

export function hashVendorPassword(password: string): string {
	return createHash("sha256").update(password).digest("hex");
}

export function verifyVendorPassword(
	password: string,
	storedHash: string,
): boolean {
	const hashed = hashVendorPassword(password);
	const a = Buffer.from(hashed);
	const b = Buffer.from(storedHash);

	if (a.length !== b.length) return false;
	return timingSafeEqual(a, b);
}

export async function setVendorPortalCookie(token: string) {
	const cookieStore = await cookies();
	cookieStore.set(VENDOR_PORTAL_COOKIE, token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: TOKEN_EXPIRY_SECONDS,
	});
}

export async function clearVendorPortalCookie() {
	const cookieStore = await cookies();
	cookieStore.set(VENDOR_PORTAL_COOKIE, "", {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: 0,
	});
}

export function getVendorPortalTokenFromRequest(
	request: NextRequest,
): string | null {
	const bearerToken = request.headers
		.get("authorization")
		?.replace(/^Bearer\s+/i, "");
	if (bearerToken) return bearerToken;

	const cookieToken = request.cookies.get(VENDOR_PORTAL_COOKIE)?.value;
	return cookieToken || null;
}

export async function getVendorPortalContext(request: NextRequest) {
	const token = getVendorPortalTokenFromRequest(request);
	if (!token) return null;

	const payload = verifyVendorToken(token);
	if (!payload) return null;

	const account = await prismaRPA.vendorPortalAccount.findUnique({
		where: { id: payload.accountId },
		include: {
			vendor: {
				select: {
					id: true,
					name: true,
					site: true,
				},
			},
		},
	});

	if (!account || !account.isActive) return null;

	return {
		token,
		payload,
		account,
		vendor: account.vendor,
	};
}
