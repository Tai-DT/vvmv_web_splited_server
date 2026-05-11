import { Injectable } from "@nestjs/common";

@Injectable()
export class GeminiService {
  async generateContent(input: {
    model?: string;
    contents: unknown[];
    systemInstruction?: string;
    responseType?: string;
  }) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const model =
      input.model ||
      process.env.GEMINI_MODEL ||
      process.env.GOOGLE_GEMINI_MODEL ||
      "gemini-2.5-flash";

    const requestBody: Record<string, unknown> = {
      contents: input.contents,
      generationConfig: {
        temperature: 0.1,
        topP: 0.95,
        ...(input.responseType === "json"
          ? { response_mime_type: "application/json" }
          : {}),
      },
    };

    if (input.systemInstruction) {
      requestBody.system_instruction = {
        parts: [{ text: input.systemInstruction }],
      };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      },
    );

    const data = await response.json().catch(() => ({}));
    return { status: response.status, ok: response.ok, data, requestBody };
  }

  extractText(data: unknown): string {
    const candidate = (data as { candidates?: unknown[] })?.candidates?.[0] as
      | { content?: { parts?: Array<{ text?: string }> } }
      | undefined;
    return candidate?.content?.parts?.map((part) => part.text ?? "").join("") ??
      "";
  }

  extractUsage(data: unknown) {
    const usage = (data as { usageMetadata?: Record<string, unknown> })
      ?.usageMetadata;
    if (!usage) return {};
    return {
      promptTokens: numberValue(usage.promptTokenCount),
      candidatesTokens: numberValue(usage.candidatesTokenCount),
      totalTokens: numberValue(usage.totalTokenCount),
    };
  }
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
