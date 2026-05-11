export type GeminiUsageMetadataLike =
	| {
			promptTokenCount?: unknown;
			candidatesTokenCount?: unknown;
			totalTokenCount?: unknown;
			prompt_token_count?: unknown;
			candidates_token_count?: unknown;
			total_token_count?: unknown;
			promptTokens?: unknown;
			candidatesTokens?: unknown;
			totalTokens?: unknown;
			prompt_tokens?: unknown;
			candidates_tokens?: unknown;
			total_tokens?: unknown;
			usageMetadata?: GeminiUsageMetadataLike;
			usage_metadata?: GeminiUsageMetadataLike;
	  }
	| null
	| undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function resolveUsageMetadata(
	value: GeminiUsageMetadataLike,
): Record<string, unknown> | null {
	if (!isRecord(value)) {
		return null;
	}

	if (isRecord(value.usageMetadata)) {
		return value.usageMetadata;
	}

	if (isRecord(value.usage_metadata)) {
		return value.usage_metadata;
	}

	return value;
}

function firstDefined(...values: unknown[]) {
	return values.find((value) => value !== undefined);
}

function toNullableInt(value: unknown): number | null {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return null;
	}

	return Math.trunc(value);
}

export function extractGeminiUsageMetrics(
	usageMetadata: GeminiUsageMetadataLike,
) {
	const metadata = resolveUsageMetadata(usageMetadata);

	return {
		promptTokens: toNullableInt(
			firstDefined(
				metadata?.promptTokenCount,
				metadata?.prompt_token_count,
				metadata?.promptTokens,
				metadata?.prompt_tokens,
			),
		),
		candidatesTokens: toNullableInt(
			firstDefined(
				metadata?.candidatesTokenCount,
				metadata?.candidates_token_count,
				metadata?.candidatesTokens,
				metadata?.candidates_tokens,
			),
		),
		totalTokens: toNullableInt(
			firstDefined(
				metadata?.totalTokenCount,
				metadata?.total_token_count,
				metadata?.totalTokens,
				metadata?.total_tokens,
			),
		),
	};
}
