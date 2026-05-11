/** localStorage key for the user's last chosen CDS AI Gemini model. */
export const CDS_AI_DOCUMENT_MODEL_STORAGE_KEY = "cds-ai-document-model";

/**
 * Models shown in the CDS AI picker. Set in deploy:
 * - `NEXT_PUBLIC_GEMINI_CDS_DOCUMENT_MODELS` — comma-separated, e.g.
 *   `gemini-2.5-flash,gemini-2.5-pro`
 * - Or a single `NEXT_PUBLIC_GEMINI_CDS_DOCUMENT_MODEL`
 * - Default: one Flash model
 */
export function parseCdsAiDocumentModelOptions(): string[] {
	const multi = process.env.NEXT_PUBLIC_GEMINI_CDS_DOCUMENT_MODELS?.trim();
	if (multi) {
		const parts = multi
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		const uniq = [...new Set(parts)];
		if (uniq.length > 0) {
			return uniq;
		}
	}
	const single = process.env.NEXT_PUBLIC_GEMINI_CDS_DOCUMENT_MODEL?.trim();
	if (single) {
		return [single];
	}
	return ["gemini-2.5-flash"];
}
