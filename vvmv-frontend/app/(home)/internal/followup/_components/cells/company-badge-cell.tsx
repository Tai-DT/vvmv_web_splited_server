"use client";

import { memo } from "react";
import type { FollowUpRow } from "../../types";
import { CompanyBadge } from "../shared/company-badge";

interface CompanyBadgeCellProps {
	getValue: () => unknown;
	row: { original: FollowUpRow };
}

function CompanyBadgeCellComponent({ getValue, row }: CompanyBadgeCellProps) {
	const companyName = getValue() as string | null | undefined;
	const taxCode = row.original.taxCode;

	return <CompanyBadge taxCode={taxCode} companyName={companyName || null} />;
}

export const CompanyBadgeCell = memo(CompanyBadgeCellComponent);
