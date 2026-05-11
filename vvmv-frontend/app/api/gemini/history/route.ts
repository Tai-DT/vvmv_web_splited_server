import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

export const dynamic = "force-dynamic";
const HISTORY_CACHE_TTL_MS = 30_000;
const HISTORY_MAX_RESPONSE_TEXT_LENGTH = 12_000;

const globalForGeminiHistoryCache = globalThis as unknown as {
	geminiHistoryCache?: Map<string, { expiresAt: number; payload: unknown }>;
};

function getHistoryCache() {
	if (!globalForGeminiHistoryCache.geminiHistoryCache) {
		globalForGeminiHistoryCache.geminiHistoryCache = new Map();
	}
	return globalForGeminiHistoryCache.geminiHistoryCache;
}

function pruneExpiredHistoryCacheEntries(
	cache: Map<string, { expiresAt: number; payload: unknown }>,
	now: number,
) {
	for (const [key, entry] of cache.entries()) {
		if (entry.expiresAt <= now) {
			cache.delete(key);
		}
	}
}

function trimModelText(value: string | null | undefined) {
	const text = String(value ?? "");
	if (text.length <= HISTORY_MAX_RESPONSE_TEXT_LENGTH) {
		return text;
	}
	return `${text.slice(0, HISTORY_MAX_RESPONSE_TEXT_LENGTH)} ...[truncated]`;
}

export async function GET(req: Request) {
	try {
		const session = await auth.api.getSession({ headers: req.headers });
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(req.url);
		const jobNumber = searchParams.get("jobNumber");
		const requestedSessionId = searchParams.get("sessionId");

		if (!jobNumber) {
			return NextResponse.json({ error: "Missing jobNumber" }, { status: 400 });
		}

		const cacheKey = `${session.user.id}::${jobNumber}::${requestedSessionId ?? "latest"}`;
		const cache = getHistoryCache();
		const now = Date.now();
		pruneExpiredHistoryCacheEntries(cache, now);
		const cached = cache.get(cacheKey);
		if (cached && cached.expiresAt > now) {
			return NextResponse.json(cached.payload);
		}

		const history = await prismaRPA.geminiHistory.findMany({
			where: {
				jobNumber: jobNumber,
				goal: { in: ["extract", "chat-extract"] },
				status: 200,
			},
			orderBy: { createdAt: "asc" },
			select: {
				userCustomPrompt: true,
				response: true,
				goal: true,
				createdAt: true,
				sessionId: true,
				fileNames: true,
				fileIds: true,
			},
		});

		// Grouping into sessions
		const sessionMap: Record<string, any> = {};

		history.forEach((entry) => {
			const sid = entry.sessionId || "default";
			if (!sessionMap[sid]) {
				sessionMap[sid] = {
					id: sid,
					date: entry.createdAt,
					messages: [],
					latestData: null,
					fileNames: [],
					fileIds: [],
				};
			}

			// Keep the fileNames/fileIds from the first "extract" entry of this session
			if (entry.goal === "extract" && sessionMap[sid].fileNames.length === 0) {
				sessionMap[sid].fileNames = entry.fileNames || [];
				sessionMap[sid].fileIds = entry.fileIds || [];
			}

			let modelText = "";
			try {
				const parsed = JSON.parse(entry.response || "{}");
				const data = parsed.data || parsed;
				if (data && (data.cargoList || data.companyName)) {
					sessionMap[sid].latestData = data;
				}
				modelText =
					parsed.explanation ||
					(entry.goal === "extract"
						? "Dữ liệu đã được trích xuất từ tài liệu."
						: entry.response);
			} catch {
				modelText = entry.response || "";
			}
			modelText = trimModelText(modelText);

			sessionMap[sid].messages.push(
				{
					role: "user",
					parts: [
						{ text: entry.userCustomPrompt || "Yêu cầu trích xuất dữ liệu" },
					],
				},
				{ role: "model", parts: [{ text: modelText }] },
			);
		});

		const sessionList = Object.values(sessionMap)
			.reverse()
			.map((s) => ({
				id: s.id,
				date: s.date,
				label: `Phiên ${new Date(s.date).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}`,
				fileNames: s.fileNames as string[],
			}));

		// Default to latest session if none requested
		const targetSid =
			requestedSessionId || (sessionList.length > 0 ? sessionList[0].id : null);
		const targetSession = targetSid ? sessionMap[targetSid] : null;

		const payload = {
			sessions: sessionList,
			history: targetSession?.messages || [],
			latestData: targetSession?.latestData || null,
			currentSessionId: targetSid,
			fileNames: targetSession?.fileNames || [],
			fileIds: targetSession?.fileIds || [],
		};
		cache.set(cacheKey, {
			expiresAt: Date.now() + HISTORY_CACHE_TTL_MS,
			payload,
		});

		return NextResponse.json(payload);
	} catch (error: any) {
		console.error("Error fetching chat history:", error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
