import { describe, expect, it } from "vitest";
import { buildCdsAiChatTranscript } from "./cds-ai-chat-transcript";

describe("buildCdsAiChatTranscript", () => {
	it("formats roles and trims newest messages via maxPairs", () => {
		const text = buildCdsAiChatTranscript(
			[
				{ role: "user", text: "câu cũ" },
				{ role: "assistant", text: "ok" },
				{ role: "user", text: "sửa invoice" },
				{ role: "assistant", text: "đã sửa" },
			],
			{ maxPairs: 1, maxChars: 10_000 },
		);
		expect(text).toContain("Người dùng: sửa invoice");
		expect(text).not.toContain("câu cũ");
	});

	it("returns empty string for no messages", () => {
		expect(buildCdsAiChatTranscript([])).toBe("");
	});
});
