import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "@/components/ui/badge";

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

const PLEASANT_VARIANTS: BadgeVariant[] = [
	"purple",
	"orange",
	"cyan",
	"indigo",
	"emerald",
	"lime",
	"teal",
	"sky",
	"violet",
	"fuchsia",
	"rose",
	"pink",
	"info",
	"success",
	"warning",
];

/**
 * Deterministically picks a pleasant badge variant based on a string input.
 * This ensures the same name always gets the same color.
 */
export function stringToColorVariant(
	str: string | null | undefined,
): BadgeVariant {
	if (!str) return "secondary";

	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
	}

	const index = Math.abs(hash) % PLEASANT_VARIANTS.length;
	return PLEASANT_VARIANTS[index];
}
