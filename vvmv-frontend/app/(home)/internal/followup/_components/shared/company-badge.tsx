"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CompanyBadgeProps {
	taxCode?: string | null;
	companyName: string | null;
	className?: string;
}

export function CompanyBadge({
	taxCode,
	companyName,
	className,
}: CompanyBadgeProps) {
	// Fetch company colors from the server
	const { data: companyColors } = useQuery({
		queryKey: ["company-colors"],
		queryFn: async () => {
			const response = await fetch("/api/admin/company-colors");
			if (!response.ok) return null;
			return response.json();
		},
		staleTime: 1000 * 60 * 5, // 5 minutes
	});

	const colorMap = useMemo(() => {
		if (!companyColors?.colors) return new Map<string, string>();
		return new Map(companyColors.colors.map((c: any) => [c.taxCode, c.color]));
	}, [companyColors]);

	if (!companyName || companyName.trim() === "") {
		return <span className="text-muted-foreground italic">—</span>;
	}

	const variant = (taxCode ? colorMap.get(taxCode) : null) || "default";

	return (
		<Badge
			variant={variant as any}
			className={cn(
				"font-semibold shadow-sm overflow-hidden text-ellipsis max-w-full",
				className,
			)}
		>
			{companyName}
		</Badge>
	);
}
