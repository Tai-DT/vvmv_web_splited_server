/**
 * Regex for standard Vietnamese truck/trailer plate numbers.
 * Example matches: 61C-123.45, 51H-123.45, 51R-123.45, 60C12345
 * Groups:
 * 1: Province + Class (e.g., 61C, 51R, 51H1)
 * 2: First 3 digits (e.g., 123)
 * 3: Last 2 digits (e.g., 45)
 */
export const PLATE_URL_REGEX = /^(\d{2}[A-Za-z]{1,2})(\d{2,3})(\d{2})$/;

/**
 * Normalizes a raw plate number string into the standard format:
 * - 5 digits: XXY-XXX.XX (e.g. 61C-123.45)
 * - 4 digits: XXY-XXXX (e.g. 51C-1234)
 * @param raw The raw plate number string
 * @returns Normalized string
 */
export function formatPlateNumber(
	raw: string | null | undefined,
): string | null {
	if (!raw) return null;
	const trimmed = raw.trim();
	if (!trimmed) return null;

	// Clean the string for matching (remove spaces, dots, dashes)
	const clean = trimmed.replace(/[\s.-]/g, "").toUpperCase();

	// Standard truck plate pattern: 2 digits + 1-2 letters, followed by 4-5 digits.
	// Note: We removed the optional digit from prefix group to avoid "stealing" from the number part.
	const match = clean.match(/^(\d{2}[A-Za-z]{1,2})(\d{2,3})(\d{2})$/);

	if (match) {
		const province = match[1];
		const part1 = match[2];
		const part2 = match[3];

		// 5 digits: XXX.XX
		if (part1.length === 3) {
			return `${province}-${part1}.${part2}`;
		}
		// 4 digits: XXXX
		return `${province}-${part1}${part2}`;
	}

	// Handle SNP combined format (e.g. 61H12345-51R12345)
	// We use an unanchored match to extract the first valid-looking plate
	const extractMatch = clean.match(/(\d{2}[A-Za-z]{1,2})(\d{2,3})(\d{2})/);
	if (extractMatch && clean.length >= 13) {
		const province = extractMatch[1];
		const part1 = extractMatch[2];
		const part2 = extractMatch[3];
		return part1.length === 3
			? `${province}-${part1}.${part2}`
			: `${province}-${part1}${part2}`;
	}

	// Fallback: Preserve exactly what the user is typing if it doesn't match a standard plate yet
	// or if they've typed extra characters we don't want to silently truncate.
	return trimmed.toUpperCase();
}

/**
 * Strips all punctuation and spaces for comparison or database lookup.
 */
export function cleanPlateNumber(plate: string | null | undefined): string {
	if (!plate) return "";
	return plate.replace(/[\s\-.]/g, "").toUpperCase();
}
