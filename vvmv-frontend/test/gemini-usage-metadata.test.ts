import { describe, expect, it } from "vitest";
import { extractGeminiUsageMetrics } from "@/lib/gemini-usage-metadata";

describe("extractGeminiUsageMetrics", () => {
	it("maps Gemini usage metadata fields to nullable history columns", () => {
		expect(
			extractGeminiUsageMetrics({
				promptTokenCount: 123,
				candidatesTokenCount: 456,
				totalTokenCount: 579,
			}),
		).toEqual({
			promptTokens: 123,
			candidatesTokens: 456,
			totalTokens: 579,
		});
	});

	it("accepts snake_case usage metadata from payload variants", () => {
		expect(
			extractGeminiUsageMetrics({
				usage_metadata: {
					prompt_token_count: 12,
					candidates_token_count: 34,
					total_token_count: 46,
				},
			}),
		).toEqual({
			promptTokens: 12,
			candidatesTokens: 34,
			totalTokens: 46,
		});
	});

	it("returns null for missing or invalid token counts", () => {
		expect(
			extractGeminiUsageMetrics({
				promptTokenCount: "123",
				candidatesTokenCount: Number.NaN,
				totalTokenCount: undefined,
			}),
		).toEqual({
			promptTokens: null,
			candidatesTokens: null,
			totalTokens: null,
		});
	});
});
