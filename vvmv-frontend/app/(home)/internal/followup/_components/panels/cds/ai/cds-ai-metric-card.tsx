"use client";

import { cn } from "@/lib/utils";
import type { CdsAiMetricCardProps } from "./cds-ai-types";

/**
 * ECUS-style metric card — flat borders, no rounded corners.
 */
const TONE_CLASSES: Record<CdsAiMetricCardProps["tone"], string> = {
	sky: "border-sky-200 bg-sky-50 text-sky-900",
	amber: "border-amber-200 bg-amber-50 text-amber-900",
	emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
	rose: "border-red-200 bg-red-50 text-red-900",
	slate: "border-[#ddd] bg-[#f7f7f7] text-black",
};

export function CdsAiMetricCard({
	tone,
	label,
	value,
	description,
}: CdsAiMetricCardProps) {
	return (
		<div className={cn("border px-1.5 py-1", TONE_CLASSES[tone])}>
			<div className="text-[8px] font-medium uppercase tracking-[0.08em] opacity-70">
				{label}
			</div>
			<div className="text-[13px] font-bold leading-tight">{value}</div>
			{description ? (
				<div className="mt-0.5 text-[8px] opacity-60">{description}</div>
			) : null}
		</div>
	);
}
