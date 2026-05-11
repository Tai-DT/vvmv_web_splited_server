import { prismaRPA } from "@/lib/db";

interface BaseLogParams {
	userId?: string | null;
	userName?: string | null;
	action: string;
	subResource?: string;
	subResourceId?: string;
	field?: string;
	oldValue?: unknown;
	newValue?: unknown;
}

export function logTruckingActivity(
	truckingFollowUpId: string,
	params: BaseLogParams,
): void {
	prismaRPA.truckingActivityLog
		.create({
			data: {
				truckingFollowUpId,
				userId: params.userId ?? null,
				userName: params.userName ?? null,
				action: params.action,
				subResource: params.subResource ?? null,
				subResourceId: params.subResourceId ?? null,
				field: params.field ?? null,
				oldValue:
					params.oldValue !== undefined ? (params.oldValue as any) : undefined,
				newValue:
					params.newValue !== undefined ? (params.newValue as any) : undefined,
			},
		})
		.catch(console.error);
}

export function logFollowUpActivity(
	followUpId: string,
	params: BaseLogParams,
): void {
	prismaRPA.followUpActivityLog
		.create({
			data: {
				followUpId,
				userId: params.userId ?? null,
				userName: params.userName ?? null,
				action: params.action,
				subResource: params.subResource ?? null,
				subResourceId: params.subResourceId ?? null,
				field: params.field ?? null,
				oldValue:
					params.oldValue !== undefined ? (params.oldValue as any) : undefined,
				newValue:
					params.newValue !== undefined ? (params.newValue as any) : undefined,
			},
		})
		.catch(console.error);
}
