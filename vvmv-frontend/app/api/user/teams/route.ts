import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { tryDelegateToStandaloneApi } from "@/lib/proxy-backend";

export async function GET(request: NextRequest) {
	const delegated = await tryDelegateToStandaloneApi(request, "user/teams");
	if (delegated) return delegated;

	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	const user = await prismaRPA.user.findUnique({
		where: { id: session.user.id },
		select: {
			teamLeaderships: {
				include: {
					team: {
						include: {
							members: {
								select: { userId: true },
							},
						},
					},
				},
			},
			teamMemberships: {
				include: {
					team: {
						include: {
							members: {
								select: { userId: true },
							},
						},
					},
				},
			},
		},
	});

	const managedMemberIds = new Set<string>();
	user?.teamLeaderships?.forEach((l) => {
		l.team.members.forEach((m) => managedMemberIds.add(m.userId));
	});

	const teamMemberIds = new Set<string>();
	user?.teamMemberships?.forEach((ms) => {
		ms.team.members.forEach((m) => teamMemberIds.add(m.userId));
	});

	return NextResponse.json({
		isLeader: (user?.teamLeaderships?.length || 0) > 0,
		teamCount: user?.teamLeaderships?.length || 0,
		managedMemberIds: Array.from(managedMemberIds),
		teamMemberIds: Array.from(teamMemberIds),
	});
}
