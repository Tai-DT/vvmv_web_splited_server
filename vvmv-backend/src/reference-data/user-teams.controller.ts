import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { SessionGuard } from "../auth/session.guard";
import { PrismaService } from "../prisma/prisma.service";

@Controller("user/teams")
@UseGuards(SessionGuard)
export class UserTeamsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(@Req() req: Request) {
    const sessionUser = req.sessionUser!;
    const user = await this.prisma.user.findUnique({
      where: { id: sessionUser.id },
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

    return {
      isLeader: (user?.teamLeaderships?.length || 0) > 0,
      teamCount: user?.teamLeaderships?.length || 0,
      managedMemberIds: Array.from(managedMemberIds),
      teamMemberIds: Array.from(teamMemberIds),
    };
  }
}
