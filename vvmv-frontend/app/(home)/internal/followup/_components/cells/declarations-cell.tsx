"use client";

import { Badge } from "@/components/ui/badge";
import type { FollowUpRow } from "../../types";

interface DeclarationsCellProps {
	row: { original: FollowUpRow };
}

export function DeclarationsCell({ row }: DeclarationsCellProps) {
	const declarations = row.original.declarations || [];

	if (declarations.length === 0) {
		return <span className="text-muted-foreground italic">—</span>;
	}

	const getChannelVariant = (batch: string | null | undefined) => {
		if (!batch) return "secondary";
		const normalized = batch.toLowerCase();
		if (normalized.includes("xanh")) return "success";
		if (normalized.includes("vàng")) return "warning";
		if (normalized.includes("đỏ")) return "destructive";
		return "secondary";
	};

	const toDisplayFormat = (value: string | null | undefined): string => {
		if (!value) return "";
		try {
			const date = new Date(value);
			if (Number.isNaN(date.getTime())) return "";
			return date.toLocaleDateString("vi-VN", {
				day: "2-digit",
				month: "2-digit",
			});
		} catch {
			return "";
		}
	};

	return (
		<div className="flex flex-col gap-1.5 py-1">
			{declarations.map((d, i) => (
				<div
					key={d.id || i}
					className="flex items-center gap-2 whitespace-nowrap"
				>
					<Badge
						variant={getChannelVariant(d.batch)}
						className="px-2 py-0.5 text-xs font-bold font-mono"
					>
						{d.declarationNumber || "N/A"}
					</Badge>
					{d.declarationDate && (
						<span className="text-[10px] text-muted-foreground font-semibold">
							{toDisplayFormat(d.declarationDate)}
						</span>
					)}
				</div>
			))}
		</div>
	);
}
