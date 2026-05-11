/**
 * CDS AI — intent gates for chat-driven apply (client).
 *
 * **Operational analytics** (classify production issues):
 * - Query recent prompts: `SELECT "userCustomPrompt", status, "errorMessage" FROM "GeminiHistory"
 *   WHERE goal = 'cds-ai-document' ORDER BY "createdAt" DESC LIMIT 50;`
 * - **Missing context**: user refers to "như lần trước" / multi-step — address via chat transcript in API.
 * - **Regex gate**: prompt lacks update verbs / cargo hints — expand patterns below + cargo diff trust.
 * - **Model quality**: JSON parse errors or wrong extraction — model/temperature/few-shot.
 */
import { normalizePromptSearchText } from "@/lib/followup/cds-ai-chat-cds-info-patch";

/** User clearly wants to mutate CDS/cargo data (not Q&A only). */
export function isExplicitUserUpdatePrompt(promptText: string) {
	const normalized = normalizePromptSearchText(promptText);
	return (
		/\b(cap nhat|sua|sua lai|sua ten|sua hang|dien ma|dien vao|dien lai|dien cho|dien tat ca|gan|set|update|replace|change|fill|doi thanh|doi sang|thay bang|thay the|thay thanh|bo dong|xoa|loai bo|go bo|chen|them dong|them hang|them mat hang|lap lai|format|chinh lai|chinh sua|dinh dang|ghi de|ap dung)\b/.test(
			normalized,
		) ||
		/\b(bo|xoa)\s*#?\s*[\d.a-z]+/.test(normalized) ||
		/\b(bo|loai\s+bo|xoa)\s+chuoi\b/.test(normalized) ||
		/\b(dia diem|noi nhan|noi xep|nhan hang|xep hang|do hang|dich|van don|chung tu|ptvt|phuong tien|ma dd|ma dia diem)\b/.test(
			normalized,
		) ||
		/\b(?:chon|lua\s+chon)\s+(?:ma\s+)?\d{1,4}\b[\s\S]{0,160}?(?:bo\s+phan|xu\s+ly|to\s+khai|ma\s+bo)/.test(
			normalized,
		) ||
		/(?:bo\s+phan|xu\s+ly|ma\s+bo|to\s+khai)[\s\S]{0,160}?\b(?:chon|lua\s+chon)\s+(?:ma\s+)?\d{1,4}\b/.test(
			normalized,
		) ||
		/\b(?:dong|dong\s+hang|dong\s+so|stt)\s*(?:so|:)?\s*\d+/.test(normalized)
	);
}

/** Prompt is about line items / HS / country / names — cargo merge allowed. */
export function isExplicitCargoUpdatePrompt(promptText: string) {
	const normalized = normalizePromptSearchText(promptText);
	return /\b(danh sach hang|ma hs|hs code|ma hang|ten hang|ten tieng|vietnamese|ten goc|nuoc xuat xu|xuat xu|original country|cargo|hang hoa|mat hang|dong hang|dong so|hang so|bo hang|sua hang|gom hang|tach hang|ghi chu hang)\b/.test(
		normalized,
	);
}

export function isBroadDataOperationPrompt(promptText: string) {
	const normalized = normalizePromptSearchText(promptText);
	return /\b(toan bo|tat ca|du lieu|to khai|cds|form|theo chung tu|theo data|theo he thong|xu ly het|tat ca dòng|tat ca dong)\b/.test(
		normalized,
	);
}

/**
 * True when the user likely refers to cargo lines (enables trusting model cargo diffs
 * when explicit HS keywords are absent, e.g. "bỏ #123 trong tên").
 */
export function promptMentionsCargoScope(promptText: string) {
	const normalized = normalizePromptSearchText(promptText);
	return (
		isExplicitCargoUpdatePrompt(promptText) ||
		isBroadDataOperationPrompt(promptText) ||
		/\b(ten|ma|dong|stt|chi\s+tiet|phan\s+hang|mat\s+hang|sku|mpn|pn)\b/.test(
			normalized,
		) ||
		/#?\d{2,4}\b/.test(promptText.trim())
	);
}
