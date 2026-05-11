import { PrismaPg } from "@prisma/adapter-pg";
import { compareSync } from "bcryptjs";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import {
	hashPassword,
	verifyPassword as verifyScryptPassword,
} from "better-auth/crypto";
import { admin, username } from "better-auth/plugins";
import { Pool } from "pg";
import { PrismaClient } from "@/prisma/client";
import type { Role } from "@/types/auth";
import {
	ac,
	adminRole,
	customerRole,
	managerRole,
	staffRole,
} from "./auth-permissions";
import { verifyVendorPassword } from "./vendor-portal-auth";

if (!process.env.DATABASE_URL?.trim() && process.env.NODE_ENV !== "test") {
	console.error(
		"[auth] DATABASE_URL is missing — Better Auth cannot use PostgreSQL (username/password and sessions will fail).",
	);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/** Origins allowed to call Better Auth (split UI on another host). */
function parseTrustedOrigins(): string[] {
	const raw = process.env.AUTH_TRUSTED_ORIGINS?.trim();
	const fromEnv = raw
		? raw
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean)
		: [];
	const app = process.env.NEXT_PUBLIC_APP_URL?.trim();
	const merged = new Set<string>(fromEnv);
	if (app) {
		merged.add(app);
	}
	if (merged.size === 0) {
		merged.add("http://localhost:3000");
		merged.add("http://127.0.0.1:3000");
	}
	// Dev: allow both loopback hostnames so AUTH_TRUSTED_ORIGINS / APP_URL mismatch
	// does not block sign-in when switching localhost ↔ 127.0.0.1.
	if (process.env.NODE_ENV === "development") {
		merged.add("http://localhost:3000");
		merged.add("http://127.0.0.1:3000");
	}
	return [...merged];
}

/** Absolute URL of this app’s `/api/auth` routes (must match what the browser uses). */
function resolveAuthBaseUrl(): string | undefined {
	const raw =
		process.env.BETTER_AUTH_BASE_URL?.trim() ||
		process.env.NEXT_PUBLIC_APP_URL?.trim();
	if (!raw) {
		// Let Better Auth derive origin from the incoming request (see handler in
		// better-auth when `baseURL` is unset). A wrong hardcoded localhost breaks
		// deployed hosts when env is missing or mis-set.
		return undefined;
	}
	try {
		new URL(raw);
		return raw;
	} catch {
		console.warn(
			"[auth] Invalid BETTER_AUTH_BASE_URL / NEXT_PUBLIC_APP_URL; using request-derived base URL.",
		);
		return undefined;
	}
}

/** Same DB + same secret as Nest (`vvmv-backend`) so sessions issued here validate everywhere. */
function googleSocialProviderOrEmpty() {
	const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
	const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
	if (!clientId || !clientSecret) {
		return {};
	}
	return {
		google: {
			clientId,
			clientSecret,
			scope: [
				"openid",
				"email",
				"profile",
				"https://www.googleapis.com/auth/gmail.readonly",
				"https://www.googleapis.com/auth/gmail.send",
			],
			accessType: "offline" as const,
			prompt: "consent" as const,
			mapProfileToUser: (profile: {
				email?: string;
				name?: string;
				picture?: string;
			}) => {
				const isVVMVEmail = profile.email?.endsWith("@vvmv.com.vn");
				const role: Role = isVVMVEmail ? "STAFF" : "CUSTOMER";
				return {
					email: profile.email,
					name: profile.name,
					image: profile.picture,
					emailVerified: isVVMVEmail,
					role,
					username: profile.email?.split("@")[0],
				};
			},
		},
	};
}

export const auth = betterAuth({
	/** Must match `BETTER_AUTH_SECRET` in `vvmv-backend` (vendor portal + shared signing). */
	secret: process.env.BETTER_AUTH_SECRET,
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),
	user: {
		additionalFields: {
			site: {
				type: "string",
				required: false,
			},
			erpAccount: {
				type: "string",
				required: false,
			},
		},
	},
	plugins: [
		username(),
		admin({
			ac,
			defaultRole: "STAFF",
			roles: {
				CUSTOMER: customerRole,
				STAFF: staffRole,
				MANAGER: managerRole,
				ADMIN: adminRole,
			},
		}),
	],
	socialProviders: googleSocialProviderOrEmpty(),
	databaseHooks: {
		account: {
			create: {
				after: async (account) => {
					if (account.providerId === "google" && account.accessToken) {
						try {
							const res = await fetch(
								"https://www.googleapis.com/oauth2/v3/userinfo",
								{
									headers: { Authorization: `Bearer ${account.accessToken}` },
								},
							);
							if (res.ok) {
								const profile = await res.json();
								await prisma.user.update({
									where: { id: account.userId },
									data: {
										name: profile.name || undefined,
										image: profile.picture || undefined,
									},
								});
							}
						} catch (err) {
							console.error("Sync on account create failed:", err);
						}
					}
				},
			},
			update: {
				after: async (account) => {
					if (account.providerId === "google" && account.accessToken) {
						try {
							const res = await fetch(
								"https://www.googleapis.com/oauth2/v3/userinfo",
								{
									headers: { Authorization: `Bearer ${account.accessToken}` },
								},
							);
							if (res.ok) {
								const profile = await res.json();
								await prisma.user.update({
									where: { id: account.userId },
									data: {
										name: profile.name || undefined,
										image: profile.picture || undefined,
									},
								});
							}
						} catch (err) {
							console.error("Sync on account update failed:", err);
						}
					}
				},
			},
		},
	},
	account: {
		accountLinking: {
			enabled: true,
			updateUserInfoOnLink: true,
		},
	},
	emailAndPassword: {
		enabled: true,
		password: {
			hash: hashPassword,
			verify: async ({ hash, password }) => {
				// Legacy hashes in `account.password`: SHA-256 hex — same as
				// `vendor_portal_account.password_hash` (see vendor-portal-auth).
				// Better Auth's default is scrypt (`salt:key`).
				if (/^[0-9a-f]{64}$/i.test(hash)) {
					return verifyVendorPassword(password, hash);
				}
				// Legacy bcrypt from scripts such as `vvmv-backend/create-test-user.ts`.
				if (hash.startsWith("$2")) {
					return compareSync(password, hash);
				}
				try {
					return await verifyScryptPassword({ hash, password });
				} catch {
					return false;
				}
			},
		},
	},
	trustedOrigins: parseTrustedOrigins(),
	baseURL: resolveAuthBaseUrl(),
});
