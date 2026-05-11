"use client";

import type { Row } from "@tanstack/react-table";
import { UserDisplay } from "@/components/ui/user-display";
import type { TruckingFollowUpRow } from "../../types";

interface TruckingUserCellProps {
	row: Row<TruckingFollowUpRow>;
}

export function TruckingCreatedByCell({ row }: TruckingUserCellProps) {
	const data = row.original;
	const user = data.user;
	const createdById = data.createdBy;

	if (user) {
		return <UserDisplay user={user} size="sm" showEmail />;
	}

	if (createdById) {
		return (
			<span className="text-xs text-muted-foreground truncate">
				{createdById}
			</span>
		);
	}

	return <span className="text-muted-foreground">-</span>;
}

export function TruckingHandlerCell({ row }: TruckingUserCellProps) {
	const data = row.original;
	const handlerUser = data.handlerUser;
	const handlerId = data.handler;

	if (handlerUser) {
		return <UserDisplay user={handlerUser} size="sm" showEmail />;
	}

	if (handlerId) {
		return (
			<span className="text-xs text-muted-foreground truncate">
				{handlerId}
			</span>
		);
	}

	return <span className="text-muted-foreground">-</span>;
}
