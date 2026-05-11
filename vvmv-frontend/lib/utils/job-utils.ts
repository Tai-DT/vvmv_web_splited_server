import type { Site } from "@/prisma/client";

/**
 * Determines the site (domain) based on the job number prefix.
 * Rules:
 * - Starts with 'HCM' -> SGN
 * - Starts with 'HAN' -> HAN
 * - Otherwise -> DAD
 */
export function getSiteFromJobNumber(
	jobNumber: string | null | undefined,
): Site {
	if (!jobNumber) return "SGN"; // Default fallback

	const upperJob = jobNumber.trim().toUpperCase();

	if (upperJob.startsWith("HCM")) {
		return "SGN";
	}

	if (upperJob.startsWith("HAN")) {
		return "HAN";
	}

	return "DAD";
}
