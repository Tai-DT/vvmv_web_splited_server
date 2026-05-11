"use client";

import { memo } from "react";
import { CompanyBadge } from "../../../followup/_components/shared/company-badge";
import type { TruckingFollowUpRow } from "../../types";

interface TruckingCompanyBadgeCellProps {
	getValue: () => unknown;
	row: { original: TruckingFollowUpRow };
}

function TruckingCompanyBadgeCellComponent({
	getValue,
	row,
}: TruckingCompanyBadgeCellProps) {
	const companyName = getValue() as string | null | undefined;
	const taxCode = row.original.taxCode;

	return <CompanyBadge taxCode={taxCode} companyName={companyName || null} />;
}

export const TruckingCompanyBadgeCell = memo(TruckingCompanyBadgeCellComponent);
