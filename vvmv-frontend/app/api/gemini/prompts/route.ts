import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

export const dynamic = "force-dynamic";
const PROMPTS_CACHE_TTL_MS = 30_000;

const globalForGeminiPromptsCache = globalThis as unknown as {
	geminiPromptsCache?: Map<string, { expiresAt: number; payload: unknown }>;
};

function getPromptsCache() {
	if (!globalForGeminiPromptsCache.geminiPromptsCache) {
		globalForGeminiPromptsCache.geminiPromptsCache = new Map();
	}
	return globalForGeminiPromptsCache.geminiPromptsCache;
}

function pruneExpiredPromptsCacheEntries(
	cache: Map<string, { expiresAt: number; payload: unknown }>,
	now: number,
) {
	for (const [key, entry] of cache.entries()) {
		if (entry.expiresAt <= now) {
			cache.delete(key);
		}
	}
}

export async function GET(req: Request) {
	try {
		const session = await auth.api.getSession({ headers: req.headers });
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(req.url);
		const taxCode = searchParams.get("taxCode") || undefined;
		const operationType = searchParams.get("operationType") || undefined;
		const serviceMode = searchParams.get("serviceMode") || undefined;
		const search = searchParams.get("search") || undefined;
		const goal = searchParams.get("goal") || undefined;
		const cacheKey = [
			session.user.id,
			taxCode ?? "",
			operationType ?? "",
			serviceMode ?? "",
			search ?? "",
			goal ?? "",
		].join("::");
		const cache = getPromptsCache();
		const now = Date.now();
		pruneExpiredPromptsCacheEntries(cache, now);
		const cached = cache.get(cacheKey);
		if (cached && cached.expiresAt > now) {
			return NextResponse.json(cached.payload);
		}

		// Fetch entries to calculate frequency and priority
		const entries = await prismaRPA.geminiHistory.findMany({
			where: {
				userId: session.user.id,
				goal: goal || undefined,
				userCustomPrompt: {
					not: null,
					...(search ? { contains: search, mode: "insensitive" } : {}),
				},
			},
			select: {
				userCustomPrompt: true,
				taxCode: true,
				operationType: true,
				serviceMode: true,
				createdAt: true,
			},
			orderBy: { createdAt: "desc" },
			take: 500, // Look at more entries to get better frequency data
		});

		// Group by prompt content and calculate stats
		const promptStats = new Map<
			string,
			{
				prompt: string;
				count: number;
				lastUsed: Date;
				priority: number;
				taxCode: string | null;
				operationType: string | null;
				serviceMode: string | null;
			}
		>();

		for (const entry of entries) {
			const p = entry.userCustomPrompt?.trim();
			if (!p) {
				continue;
			}

			// Priority logic:
			// 0: Match all 3 (taxCode, operationType, serviceMode)
			// 1: Match main context (taxCode, operationType)
			// 2: Match any 1 context
			// 3: No match
			let priority = 3;
			if (
				taxCode &&
				operationType &&
				serviceMode &&
				entry.taxCode === taxCode &&
				entry.operationType === operationType &&
				entry.serviceMode === serviceMode
			) {
				priority = 0;
			} else if (
				taxCode &&
				operationType &&
				entry.taxCode === taxCode &&
				entry.operationType === operationType
			) {
				priority = 1;
			} else if (
				(taxCode && entry.taxCode === taxCode) ||
				(operationType && entry.operationType === operationType) ||
				(serviceMode && entry.serviceMode === serviceMode)
			) {
				priority = 2;
			}

			const existing = promptStats.get(p);
			if (existing) {
				existing.count += 1;
				// Keep the highest priority found for this prompt
				if (priority < existing.priority) {
					existing.priority = priority;
					existing.taxCode = entry.taxCode;
					existing.operationType = entry.operationType;
					existing.serviceMode = entry.serviceMode;
				}
			} else {
				promptStats.set(p, {
					prompt: p,
					count: 1,
					lastUsed: entry.createdAt,
					priority,
					taxCode: entry.taxCode,
					operationType: entry.operationType,
					serviceMode: entry.serviceMode,
				});
			}
		}

		// Convert Map to Array and Sort
		const sortedPrompts = Array.from(promptStats.values()).sort((a, b) => {
			// 1. Priority (Ascending: 0 is highest)
			if (a.priority !== b.priority) {
				return a.priority - b.priority;
			}
			// 2. Frequency (Descending: most used first)
			if (b.count !== a.count) {
				return b.count - a.count;
			}
			// 3. Recency (Descending: most recent first)
			return b.lastUsed.getTime() - a.lastUsed.getTime();
		});

		const payload = {
			prompts: sortedPrompts.slice(0, 30).map((r) => ({
				prompt: r.prompt,
				taxCode: r.taxCode,
				operationType: r.operationType,
				serviceMode: r.serviceMode,
				priority: r.priority,
				count: r.count,
			})),
		};
		cache.set(cacheKey, {
			expiresAt: Date.now() + PROMPTS_CACHE_TTL_MS,
			payload,
		});

		return NextResponse.json(payload);
	} catch (error: any) {
		console.error("Error fetching prompt history:", error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
