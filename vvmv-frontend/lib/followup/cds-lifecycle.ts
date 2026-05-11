import { prismaRPA } from "@/lib/db";

export const CDS_DRAFT_LIFECYCLE_RESET = {
	cdsStatus: "DRAFT" as const,
	ecusDeclarationId: null,
	registeredAt: null,
	registeredBy: null,
};

export async function resetFollowUpCdsLifecycleToDraft(followUpId: string) {
	await prismaRPA.followUpCdsInfo.updateMany({
		where: { followUpId },
		data: CDS_DRAFT_LIFECYCLE_RESET,
	});
}
