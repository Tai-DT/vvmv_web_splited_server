export type CdsAiTranscriptTurn = {
	role: "user" | "assistant";
	text: string;
};

const DEFAULT_MAX_CHARS = 12_000;
/** Max user+assistant pairs counted from the end (each pair = 2 turns). */
const DEFAULT_MAX_PAIRS = 6;

function truncateToChars(text: string, maxChars: number): string {
	if (text.length <= maxChars) {
		return text;
	}
	// Keep the tail: the newest turns carry the instruction being answered.
	return `[...đã cắt bớt phần đầu để giới hạn độ dài.]\n${text.slice(-maxChars)}`;
}

/**
 * Builds a plain-text transcript for Gemini (newest context preserved by trimming from the start).
 */
export function buildCdsAiChatTranscript(
	messages: readonly CdsAiTranscriptTurn[],
	options?: { maxChars?: number; maxPairs?: number },
): string {
	const maxChars = options?.maxChars ?? DEFAULT_MAX_CHARS;
	const maxPairs = options?.maxPairs ?? DEFAULT_MAX_PAIRS;
	if (!messages.length) {
		return "";
	}

	const maxTurns = Math.max(2, maxPairs * 2);
	const slice = messages.slice(-maxTurns);

	const lines: string[] = [];
	for (const message of slice) {
		const roleLabel = message.role === "user" ? "Người dùng" : "Trợ lý";
		const body = message.text.trim().replace(/\s+/g, " ");
		if (body) {
			lines.push(`${roleLabel}: ${body}`);
		}
	}

	return truncateToChars(lines.join("\n"), maxChars);
}
