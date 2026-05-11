"use client";

import { Badge } from "@/components/ui/badge";

interface FcrVehicleInfoCellProps {
	getValue: () => unknown;
}

export function FcrVehicleInfoCell({ getValue }: FcrVehicleInfoCellProps) {
	const raw = String(getValue() ?? "").trim();
	if (!raw) {
		return <span className="text-muted-foreground text-xs italic">—</span>;
	}
	const lines = raw.split("\n").filter(Boolean);
	return (
		<div className="flex flex-col gap-1 min-w-0">
			{lines.map((line, i) => (
				<Badge
					key={i}
					variant="secondary"
					className="text-xs px-1.5 py-0.5 w-fit font-normal whitespace-normal break-words max-w-full"
				>
					{line}
				</Badge>
			))}
		</div>
	);
}
